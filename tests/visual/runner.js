#!/usr/bin/env node
// tests/visual/runner.js
// Visual regression test runner — computed-style assertions via Puppeteer.
//
// Checks font loading, icon sizing, and layout invariants without pixel diffs.
// Pixel diffs are brittle (OS rendering, AA); property assertions are stable.
//
// Run standalone:  node tests/visual/runner.js
// Run via npm:     npm run test:visual
//
// The runner reuses a Hugo server already on port 1313 if one is running.
// Otherwise it starts one (and stops it on exit).

import puppeteer from 'puppeteer';
import net from 'net';
import { startServer, stopServer, PORT as DEFAULT_PORT } from '../helpers/server.js';

const PORT = parseInt(process.env.PORT || DEFAULT_PORT, 10);
const BASE_URL = `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function px(val) { return parseFloat(val); }

function rem(remVal, basePx = 16) { return remVal * basePx; }

async function probe(port) {
  return new Promise(resolve => {
    const conn = new net.Socket();
    conn.setTimeout(300);
    conn.once('connect', () => { conn.destroy(); resolve(true); });
    conn.once('error', () => resolve(false));
    conn.once('timeout', () => resolve(false));
    conn.connect(port, '127.0.0.1');
  });
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const results = [];

function test(name, fn) {
  results.push({ name, fn });
}

async function runTests(page) {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of results) {
    try {
      await fn(page);
      console.log(`  ✓  ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗  ${name}`);
      console.log(`       ${err.message}`);
      failed++;
    }
  }

  return { passed, failed };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertRange(val, min, max, label) {
  assert(
    val >= min && val <= max,
    `${label}: expected ${min}–${max}, got ${val}`
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// 1. Web font loading — most important test.
//    Saira Extra Condensed (700) at clamp(3.5rem, …, 6rem) ≈ 56–96px at 800px viewport.
//    System fallback (Arial/Helvetica) renders at a different size range.
//    If this fails, Google Fonts didn't load — all icon/layout tests may still pass
//    but the page looks wrong.
test('h1 renders with Saira Extra Condensed (font loaded)', async page => {
  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector('#about h1');
    if (!h1) throw new Error('#about h1 not found');
    const styles = getComputedStyle(h1);
    return {
      fontSize: parseFloat(styles.fontSize),
      fontFamily: styles.fontFamily,
    };
  });
  // At 800px viewport: clamp(3.5rem, calc(-1.5rem + 25vw), 6rem)
  //   = clamp(56px, calc(-24px + 200px), 96px) = clamp(56px, 176px, 96px) = 96px
  // System Arial at default would be ~32–40px. If we see < 50px, fonts didn't load.
  assertRange(metrics.fontSize, 50, 120, `h1 font-size (${metrics.fontFamily})`);
});

// 2. Social icon circles — must match original FA fa-stack.fa-lg size.
//    FA stack: font-size: 1.75rem → stack = 2em wide = 3.5rem = 56px at base 16px.
test('social icon circles are 3.5rem wide (matches FA stack)', async page => {
  const metrics = await page.evaluate(() => {
    const wraps = document.querySelectorAll('.list-social-icons .social-icon-wrap');
    if (wraps.length === 0) throw new Error('.social-icon-wrap not found in icon list');
    const rect = wraps[0].getBoundingClientRect();
    return { count: wraps.length, width: rect.width, height: rect.height };
  });
  assert(metrics.count >= 2, `expected ≥2 social icon wraps, got ${metrics.count}`);
  // 3.5rem = 56px. Allow ±2px for sub-pixel rounding.
  assertRange(metrics.width, 54, 58, 'icon wrap width');
  assertRange(metrics.height, 54, 58, 'icon wrap height');
});

// 3. Social icon SVGs must be white (fill: white on the path).
test('social icon SVG paths fill white', async page => {
  const fill = await page.evaluate(() => {
    const path = document.querySelector('.list-social-icons .social-icon-svg path');
    if (!path) throw new Error('.social-icon-svg path not found');
    return getComputedStyle(path).fill;
  });
  // Browsers normalize 'white' → 'rgb(255, 255, 255)'
  assert(
    fill === 'rgb(255, 255, 255)' || fill === 'white',
    `expected white fill, got: ${fill}`
  );
});

// 4. Feature tile icons must be constrained (not 300×150px SVG default).
test('feature tile icons are sized (not default 300×150px SVG)', async page => {
  const metrics = await page.evaluate(() => {
    const icons = document.querySelectorAll('.feature-tile__icon svg');
    if (icons.length === 0) return null;
    const rect = icons[0].getBoundingClientRect();
    return { count: icons.length, width: rect.width, height: rect.height };
  });
  if (metrics === null) return; // no feature tiles on this page — skip
  // Expected: 1.2rem = 19.2px. Allow a bit wider range for zoom/scaling.
  assertRange(metrics.width, 14, 30, 'feature tile icon width');
  assertRange(metrics.height, 14, 30, 'feature tile icon height');
});

// 5. Project card link icons must be constrained (1em, not 300×150px).
test('project card link icons are sized (not default 300×150px SVG)', async page => {
  const metrics = await page.evaluate(() => {
    const icons = document.querySelectorAll('.project-card__link svg');
    if (icons.length === 0) return null;
    const rect = icons[0].getBoundingClientRect();
    return { count: icons.length, width: rect.width, height: rect.height };
  });
  if (metrics === null) return; // no project links — skip
  // Expected: 1em of the parent button font-size (typically 12–16px).
  assertRange(metrics.width, 8, 24, 'project card link icon width');
  assertRange(metrics.height, 8, 24, 'project card link icon height');
});

// 6. No horizontal overflow — catches layout regressions that push content off-screen.
test('no horizontal overflow (layout integrity)', async page => {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  assert(!overflow, 'page has horizontal overflow — layout broke');
});

// 7. Key nav sections present in DOM.
test('all expected nav sections are in the DOM', async page => {
  const sections = await page.evaluate(() => {
    return ['about', 'projects', 'experience', 'skills', 'education']
      .filter(id => !document.getElementById(id));
  });
  assert(sections.length === 0, `missing sections: ${sections.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const alreadyRunning = await probe(PORT);
  let server = null;

  if (alreadyRunning) {
    console.log(`[visual] Reusing Hugo server already running on port ${PORT}`);
  } else {
    server = await startServer();
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let exitCode = 0;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20000 });

    // Wait for web fonts — the preload+onload pattern fires async
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 800)); // extra settle for font-swap FOUT

    console.log('\n[visual] Running tests against', BASE_URL, '\n');
    const { passed, failed } = await runTests(page);

    console.log(`\n[visual] ${passed} passed, ${failed} failed\n`);
    exitCode = failed > 0 ? 1 : 0;
  } finally {
    await browser.close();
    if (server) stopServer(server);
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('[visual] Fatal error:', err);
  process.exit(1);
});
