#!/usr/bin/env node
/**
 * Canvas Rendering Performance Test
 *
 * Measures the draw call rate of bg-field.js to catch:
 *   1. Double-draw on init — two paths start the RAF loop simultaneously,
 *      causing ~2x the expected draw rate. (see: bg-field.js ~line 584 vs ~630)
 *   2. Canvas not animating — draw rate too low or zero.
 *
 * HOW IT WORKS
 *   `draw()` is a private function inside bg-field.js's IIFE, so it cannot
 *   be patched directly. Instead we intercept CanvasRenderingContext2D.clearRect,
 *   which draw() calls exactly once per frame. This gives us a precise draw
 *   call count without touching bg-field.js.
 *
 * THRESHOLDS
 *   - Min  25 draws/s  — canvas is actively animating
 *   - Max  90 draws/s  — catches a sustained double-draw loop (~120/s)
 *   Expected steady state on a 60 Hz display: ~55–65 draws/s.
 *
 * RUN:
 *   npm test
 */

import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

const SAMPLE_MS    = 2000;  // measure window
const MIN_DRAWS_PS = 25;    // canvas must be running
const MAX_DRAWS_PS = 90;    // double-draw ceiling (~120/s when broken)

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
  console.log('🎨 Starting canvas performance tests...\n');

  const browser = await puppeteer.launch({ headless: true });

  // ── Inject clearRect counter before any script runs ──────────────────────
  // Must be done per-page before navigation via evaluateOnNewDocument.
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
  });

  await page.evaluateOnNewDocument(() => {
    // Guard: evaluateOnNewDocument re-runs on every navigation (including reloads).
    // Only install the patch once per document — the flag prevents double-wrapping.
    if (window.__clearRectPatched) return;
    window.__clearRectPatched = true;
    window._drawStats = { count: 0, startedAt: null };
    const _origClearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (window._drawStats.startedAt === null) {
        window._drawStats.startedAt = performance.now();
      }
      window._drawStats.count++;
      return _origClearRect.apply(this, args);
    };
  });

  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  } catch {
    console.error(`❌ Cannot reach Hugo server at ${BASE_URL}`);
    await browser.close();
    process.exit(1);
  }

  // ── Test 1: Canvas is animating ──────────────────────────────────────────
  await runTest('Canvas is actively drawing frames', async (page) => {
    // Wait for FIELD to be ready (prefersReducedMotion may not exist on all branches)
    await page.waitForFunction(() => window.FIELD !== undefined, { timeout: 5000 });

    // Reset stats and sample for SAMPLE_MS
    await page.evaluate((ms) => {
      window._drawStats = { count: 0, startedAt: null };
      return new Promise(resolve => setTimeout(resolve, ms));
    }, SAMPLE_MS);

    const { count, startedAt } = await page.evaluate(() => window._drawStats);

    if (startedAt === null || count === 0) {
      throw new Error('Canvas never drew — bg-field.js may not be running');
    }

    const elapsed = SAMPLE_MS / 1000;
    const rate = count / elapsed;

    console.log(`     Draw rate: ${rate.toFixed(1)} draws/s over ${SAMPLE_MS}ms (${count} total)`);

    if (rate < MIN_DRAWS_PS) {
      throw new Error(
        `Draw rate too low: ${rate.toFixed(1)}/s (min ${MIN_DRAWS_PS}/s). Canvas may be stalled.`
      );
    }
  }, page);

  // ── Test 2: No double-draw loop ──────────────────────────────────────────
  await runTest(`Draw rate below double-draw ceiling (${MAX_DRAWS_PS}/s)`, async (page) => {
    // Fresh load so the init path fires cleanly. The evaluateOnNewDocument
    // script installed above re-runs here; the guard prevents double-patching.
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.FIELD !== undefined, { timeout: 5000 });

    await page.evaluate((ms) => {
      window._drawStats = { count: 0, startedAt: null };
      return new Promise(resolve => setTimeout(resolve, ms));
    }, SAMPLE_MS);

    const { count } = await page.evaluate(() => window._drawStats);
    const rate = count / (SAMPLE_MS / 1000);

    console.log(`     Draw rate: ${rate.toFixed(1)} draws/s (ceiling: ${MAX_DRAWS_PS}/s)`);

    if (rate > MAX_DRAWS_PS) {
      throw new Error(
        `Draw rate ${rate.toFixed(1)}/s exceeds ceiling of ${MAX_DRAWS_PS}/s. ` +
        `Likely cause: double-draw on init (bg-field.js ~line 630 calls draw() ` +
        `while init block already queued requestAnimationFrame(draw)).`
      );
    }
  }, page);

  // ── Test 3: Canvas is idle when reduced motion is preferred ──────────────
  // Only runs if bg-field.js exposes prefersReducedMotion (added in the reduced-motion audit PR).
  // Skipped on branches that predate that feature.
  const hasReducedMotionSupport = await page.evaluate(
    () => typeof window.FIELD?.prefersReducedMotion === 'function'
  );
  if (hasReducedMotionSupport) {
  await runTest('Canvas does not draw when prefers-reduced-motion is active', async (page) => {
    // Emulate reduced-motion via Chrome CDP
    const client = await page.createCDPSession();
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.FIELD !== undefined, { timeout: 5000 });

    await page.evaluate((ms) => {
      window._drawStats = { count: 0, startedAt: null };
      return new Promise(resolve => setTimeout(resolve, ms));
    }, 1000);

    const { count } = await page.evaluate(() => window._drawStats);

    if (count > 0) {
      throw new Error(
        `Canvas drew ${count} time(s) despite prefers-reduced-motion: reduce. ` +
        `bg-field.js should stop the RAF loop when reducedMotion is true.`
      );
    }

    console.log(`     Draw count under reduced-motion: ${count} (expected 0)`);

    // Restore
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
  }, page);
  } else {
    console.log('  ⏭  Canvas reduced-motion test skipped (feature not present on this branch)');
  }

  // ── Test 4: Canvas stops drawing after pause ─────────────────────────────
  const hasPlaybackControls = await page.evaluate(
    () => typeof window.FIELD?.pause === 'function'
  );
  if (hasPlaybackControls) {
    await runTest('Canvas stops drawing after FIELD.pause()', async (page) => {
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(() => typeof window.FIELD?.pause === 'function', { timeout: 5000 });

      await page.evaluate(() => window.FIELD.pause());

      await page.evaluate((ms) => {
        window._drawStats = { count: 0, startedAt: null };
        return new Promise(resolve => setTimeout(resolve, ms));
      }, 1000);

      const { count } = await page.evaluate(() => window._drawStats);

      console.log(`     Draw count after pause: ${count} (expected 0)`);

      if (count > 0) {
        throw new Error(
          `Canvas drew ${count} time(s) after FIELD.pause(). RAF loop should be stopped.`
        );
      }
    }, page);

    // ── Test 5: Canvas stops drawing after setVisible(false) ───────────────
    await runTest('Canvas stops drawing after FIELD.setVisible(false)', async (page) => {
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(() => typeof window.FIELD?.setVisible === 'function', { timeout: 5000 });

      // Trigger hide and wait for the 400ms fade to complete
      await page.evaluate(() => window.FIELD.setVisible(false));
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

      await page.evaluate((ms) => {
        window._drawStats = { count: 0, startedAt: null };
        return new Promise(resolve => setTimeout(resolve, ms));
      }, 1000);

      const { count } = await page.evaluate(() => window._drawStats);

      console.log(`     Draw count after setVisible(false): ${count} (expected 0)`);

      if (count > 0) {
        throw new Error(
          `Canvas drew ${count} time(s) after setVisible(false) fade completed. RAF loop should be stopped.`
        );
      }
    }, page);
  } else {
    console.log('  ⏭  Pause/visibility idle tests skipped (playback controls not present on this branch)');
  }

  // ── Test N: getBoundingClientRect not called per animation frame ─────────
  // Regression guard for the forced-reflow fix in applyElementDisturbance().
  // After init the element bounds cache is built; getBoundingClientRect on
  // [data-particle-disturbance] elements must never be called during the RAF
  // loop — only at cache-build time (init / resize).
  //
  // Spy is installed on each disturbance element's own getBoundingClientRect
  // (not on Element.prototype) so calls from unrelated scripts — e.g.
  // name-disturbance.js's per-frame letter animation — don't pollute the count.
  await runTest('getBoundingClientRect not called per animation frame (reflow regression guard)', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.FIELD !== undefined, { timeout: 5000 });

    // Allow init (including buildElementBoundsCache) to finish before installing
    // the spy — we only want to count post-init calls.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));

    // Install BCR spy on each [data-particle-disturbance] element individually.
    const elementCount = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-particle-disturbance]');
      window._bcrCalls = 0;
      elements.forEach(el => {
        const origBCR = el.getBoundingClientRect.bind(el);
        el.getBoundingClientRect = function () {
          window._bcrCalls++;
          return origBCR();
        };
      });
      return elements.length;
    });

    // Wait for exactly 60 animation frames
    await page.evaluate(() => new Promise(resolve => {
      let frames = 0;
      function tick() {
        if (++frames >= 60) return resolve();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));

    const calls = await page.evaluate(() => window._bcrCalls);

    console.log(`     [data-particle-disturbance] elements: ${elementCount}`);
    console.log(`     getBoundingClientRect calls during 60 frames: ${calls} (expected 0)`);

    if (calls > 0) {
      throw new Error(
        `getBoundingClientRect called ${calls} time(s) during 60 animation frames. ` +
        `Expected 0 — element bounds must be cached at init, not queried per frame.`
      );
    }
  }, page);

  // ─── Results ─────────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);

  await browser.close();

  if (failed > 0) {
    console.log('\n🔴 Tests failed.\n');
    process.exit(1);
  }

  console.log('\n🏁 All tests passed!\n');
})();
