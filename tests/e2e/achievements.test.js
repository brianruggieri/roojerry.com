#!/usr/bin/env node
/**
 * Achievement E2E Test Suite
 *
 * Tests the achievement system against the live Hugo dev server.
 *
 * PREREQUISITES:
 *   Hugo server must be running: npm run dev
 *
 * RUN:
 *   npm test
 *
 * ─────────────────────────────────────────────────────────────
 * CONVENTIONS FOR FUTURE ACHIEVEMENT TESTS
 * ─────────────────────────────────────────────────────────────
 * 1. One runTest() per distinct behavior — not one test per achievement.
 *    Good: "coin_clicker_50 does not fire before 50 clicks"
 *    Bad:  "test coin_clicker_50"
 *
 * 2. Always assert structure, not just existence:
 *      - data-achievement-id attribute
 *      - .ach-name text content
 *      - .ach-icon-img src (contains expected filename)
 *
 * 3. Always reload the page at the start of each test (resets JS state).
 *
 * 4. Fast-forward counters with page.evaluate() — never click 50 times:
 *      await page.evaluate(() => { coinClickCounter = 49; });
 *      await page.click(COIN_SELECTOR); // → triggers at 50
 *
 * 5. Use waitForSelector() not waitForTimeout() for positive assertions.
 *    Use a short setTimeout() only when asserting absence (no toast).
 *
 * 6. Always process.exit(1) on failure so CI catches it.
 *
 * ─────────────────────────────────────────────────────────────
 * ADDING TESTS FOR NEW ACHIEVEMENTS
 * ─────────────────────────────────────────────────────────────
 * 1. Add the achievement def to themes/resume/static/js/achievements.js
 * 2. Add the trigger to coin-flip.js (or wherever it fires)
 * 3. Add a runTest() block before the "ADD FUTURE TESTS HERE" marker below
 * 4. npm test — all tests must pass before committing
 */

import puppeteer from 'puppeteer';

import { BASE_URL } from '../helpers/server.js';
const COIN_SELECTOR = '#profileCoin';
const TOAST_SEL     = '.ani_div';

let passed = 0;
let failed = 0;

// ─── Harness ────────────────────────────────────────────────

async function runTest(name, fn, page) {
  try {
    await fn(page);
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

/**
 * Click the coin once and wait for the flip animation lock to release.
 * The coin ignores clicks while flipping (600ms CSS transition).
 * Repeat N times for multi-click scenarios.
 */
async function clickCoin(page, times = 1) {
  await page.waitForSelector(COIN_SELECTOR, { timeout: 3000 });
  for (let i = 0; i < times; i++) {
    await page.click(COIN_SELECTOR);
    await page.waitForFunction(() => !window.flipping, { timeout: 2000 });
  }
}

/**
 * Assert a toast with the given achievementId appears within timeoutMs.
 * Checks: data-achievement-id, .ach-name text, .ach-icon-img src.
 */
async function assertToast(page, { achievementId, name, imageSrc }, timeoutMs = 4000) {
  const selector = `${TOAST_SEL}[data-achievement-id="${achievementId}"]`;
  await page.waitForSelector(selector, { timeout: timeoutMs });

  const result = await page.evaluate((sel, expectedName, expectedSrc) => {
    const card   = document.querySelector(sel);
    const nameEl = card?.querySelector('.ach-name');
    const imgEl  = card?.querySelector('.ach-icon-img');
    return {
      name:     nameEl?.textContent?.trim() ?? null,
      imageSrc: imgEl?.src ?? null,
    };
  }, selector, name, imageSrc);

  if (result.name !== name) {
    throw new Error(`Expected name "${name}", got "${result.name}"`);
  }
  if (imageSrc && !result.imageSrc?.includes(imageSrc)) {
    throw new Error(`Expected image src to contain "${imageSrc}", got "${result.imageSrc}"`);
  }
}

/**
 * Assert no toast with the given achievementId exists in the DOM.
 * Waits waitMs first to give any spurious toast time to appear.
 */
async function assertNoToast(page, achievementId, waitMs = 700) {
  await new Promise(r => setTimeout(r, waitMs));
  const selector = `${TOAST_SEL}[data-achievement-id="${achievementId}"]`;
  const el = await page.$(selector);
  if (el) throw new Error(`Expected no toast for "${achievementId}" but one appeared`);
}

// ─── Main ───────────────────────────────────────────────────

(async () => {
  console.log('🚀 Starting achievement e2e tests...\n');

  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();

  // Surface browser-side JS errors in test output
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
  });

  await page.setViewport({ width: 1280, height: 900 });

  // Verify server is reachable before running anything
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  } catch {
    console.error(`❌ Cannot reach Hugo server at ${BASE_URL}`);
    console.error('   Run: npm run dev\n');
    await browser.close();
    process.exit(1);
  }

  // ── Test 1: No toast on fresh page load ─────────────────
  await runTest('No achievement toast on page load', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await assertNoToast(page, 'coin_clicker');
    await assertNoToast(page, 'coin_clicker_50');
  }, page);

  // ── Test 2: No toast before threshold ───────────────────
  await runTest('No toast after 9 clicks (threshold not reached)', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await clickCoin(page, 9);
    await assertNoToast(page, 'coin_clicker', 400);
  }, page);

  // ── Test 3: coin_clicker unlocks at 10 ──────────────────
  await runTest('coin_clicker unlocks at click 10 with correct name and image', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await clickCoin(page, 10);
    await assertToast(page, {
      achievementId: 'coin_clicker',
      name:          '10 Clicks Hero',
      imageSrc:      'coin-clicker-10.png',
    });
  }, page);

  // ── Test 4: coin_clicker deduplication ──────────────────
  await runTest('coin_clicker does not re-unlock on click 11 (dedup)', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    // Fast-forward to 9, then click to 10 → triggers unlock
    await page.evaluate(() => { coinClickCounter = 9; });
    await page.click(COIN_SELECTOR);
    // Wait for the toast to appear and animate away (3s)
    await page.waitForSelector(`${TOAST_SEL}[data-achievement-id="coin_clicker"]`, { timeout: 3000 });
    await page.waitForFunction(
      (sel) => !document.querySelector(sel),
      { timeout: 6000 },
      `${TOAST_SEL}[data-achievement-id="coin_clicker"]`
    );
    // Click 11 — must not produce a new toast
    await page.click(COIN_SELECTOR);
    await assertNoToast(page, 'coin_clicker', 600);
  }, page);

  // ── Test 5: coin_clicker_50 unlocks at 50 ───────────────
  // NOTE: Uses fast-forward pattern — the established convention for high-count tests.
  // Set coinClickCounter = 49 via page.evaluate(), then one real click triggers at 50.
  await runTest('coin_clicker_50 unlocks at click 50 with correct name and image', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => { coinClickCounter = 49; });
    await page.click(COIN_SELECTOR);
    await assertToast(page, {
      achievementId: 'coin_clicker_50',
      name:          '50 Clicks Legend',
      imageSrc:      'coin-clicker-50.png',
    });
  }, page);

  // ── ADD FUTURE ACHIEVEMENT TESTS HERE ───────────────────
  // Pattern:
  //
  //   await runTest('description of the specific behavior', async (page) => {
  //     await page.reload({ waitUntil: 'networkidle0' });
  //     // Optional: fast-forward any counter
  //     // await page.evaluate(() => { coinClickCounter = N; });
  //     // Trigger the behavior, then assert:
  //     await assertToast(page, {
  //       achievementId: 'your_achievement_id',
  //       name:          'Achievement Display Name',
  //       imageSrc:      'your-icon-filename.png',
  //     });
  //   }, page);

  // ─── Results ────────────────────────────────────────────
  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);

  await browser.close();

  if (failed > 0) {
    console.log('\n🔴 Tests failed.\n');
    process.exit(1);
  }

  console.log('\n🏁 All tests passed!\n');
})();
