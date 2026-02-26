#!/usr/bin/env node
/**
 * About Section E2E Test Suite
 *
 * Verifies that the About Me section exists, contains biographical content,
 * and is reachable via the navigation link.
 *
 * PREREQUISITES:
 *   Hugo server must be running (handled by runner.js)
 *
 * RUN:
 *   npm test
 */

import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

let passed = 0;
let failed = 0;

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

(async () => {
  console.log('🚀 Starting about section e2e tests...\n');

  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
  });

  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  } catch {
    console.error(`❌ Cannot reach Hugo server at ${BASE_URL}`);
    await browser.close();
    process.exit(1);
  }

  // ── Test 1: About section exists in DOM ─────────────────
  await runTest('About section exists with id="about"', async (page) => {
    const section = await page.$('section#about');
    if (!section) throw new Error('No <section id="about"> found');
  }, page);

  // ── Test 2: Bio paragraphs are present ──────────────────
  // Checks structural presence: at least 3 paragraphs and enough total text.
  // The string 'full-stack' anchors to the professional identity statement
  // that is core to the portfolio's purpose; update both if the bio is rewritten.
  await runTest('About section contains biographical paragraph text', async (page) => {
    const text = await page.$eval('section#about', el => el.innerText);
    if (!text.includes('full-stack')) {
      throw new Error('Expected "full-stack" in about section bio');
    }
    if (text.length < 400) {
      throw new Error(`About section text too short (${text.length} chars); expected at least 400`);
    }
  }, page);

  // ── Test 3: Nav "About" link points to #about ───────────
  await runTest('Nav "About" link href contains #about', async (page) => {
    const href = await page.$eval(
      '#sideNav a.nav-link[href*="about"]',
      el => el.getAttribute('href')
    );
    if (!href || !href.includes('about')) {
      throw new Error(`Expected nav link to #about, got: ${href}`);
    }
  }, page);

  // ── Test 4: Multiple bio paragraphs are present ─────────
  await runTest('About section contains at least 3 bio paragraphs', async (page) => {
    const count = await page.$$eval('section#about p', els => els.length);
    if (count < 3) {
      throw new Error(`Expected at least 3 paragraphs in about section, found ${count}`);
    }
  }, page);

  // ── Results ─────────────────────────────────────────────
  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);

  await browser.close();

  if (failed > 0) {
    console.log('\n🔴 Tests failed.\n');
    process.exit(1);
  }

  console.log('\n🏁 All tests passed!\n');
})();
