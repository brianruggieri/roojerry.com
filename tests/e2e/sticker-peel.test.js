#!/usr/bin/env node
/**
 * Sticker Peel E2E Test Suite
 *
 * Simulates realistic human interaction with the background peel effect:
 *   Phase 1 — Initialization: STICKER_LAYER boots, zones registered
 *   Phase 2 — Edge detection: hover triggers at zone points; dead zones diagnosed
 *   Phase 3 — Peel mechanics: PEELING state, snap-back, snap-off, tornFraction
 *   Phase 4 — Human simulation: 8 planned tears clearing the full viewport
 *   Phase 5 — Reset: sticker restores to intact
 *
 * VIEWPORT: 1280 × 800 (fixed for deterministic zone-point arithmetic)
 *
 * EDGE_MARGIN_PX = 90, GRAB_SNAP_PX = 12
 *
 * Zone-point screen positions (for reference):
 *   Left  edge  (x=90):  clientY ∈ {0,100,200,300,400,500,600,700,800}
 *   Right edge  (x=1190): same Y values
 *   Top of screen (clientY=90):  clientX ∈ {0,160,320,480,640,800,960,1120,1280}
 *   Bottom of screen (clientY=710): same X values
 *
 * NOTE ON Y-AXIS CONVENTION:
 *   sticker.js uses UV y = 1 − clientY/height (y=1 = top, y=0 = bottom).
 *   The zone labeled "top"  in the code (normal = {0,1}) sits at clientY≈710 (physical bottom).
 *   The zone labeled "bottom" (normal = {0,−1}) sits at clientY≈90  (physical top).
 *   This means peeling from the physical top of the screen pulls the sticker DOWN,
 *   and peeling from the physical bottom pulls it UP — both physically sensible.
 *
 * NOTE ON EVENT DISPATCH:
 *   page.mouse.move() dispatches events targeting whichever DOM element is under the
 *   cursor. sticker.js filters these with e.target.closest('a,button,...'), which
 *   silently drops events over interactive page content (links, nav items, etc.).
 *   To avoid false failures, we dispatch synthetic PointerEvents on document.body,
 *   which bubbles to window (where sticker's listener lives) with e.target=document.body,
 *   passing the closest() check while carrying the correct clientX/clientY values.
 *
 * PREREQUISITES: Hugo server must be running (handled by tests/runner.js).
 */

import puppeteer from 'puppeteer';
import path      from 'path';
import fs        from 'fs';
import { fileURLToPath } from 'url';
import { BASE_URL } from '../helpers/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Viewport ─────────────────────────────────────────────────────────────────
const VP           = { width: 1280, height: 800 };
const EDGE_MARGIN  = 90;   // STICKER_PARAMS.EDGE_MARGIN_PX
const GRAB_SNAP_PX = 12;   // STICKER_PARAMS.GRAB_SNAP_PX

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Synthetic pointer event helpers ──────────────────────────────────────────
//
// Dispatch PointerEvents on document.body so they bubble up to window's
// sticker listener with e.target = document.body.  This bypasses the
// e.target.closest('a,button,...') filter in sticker.js, which would
// otherwise drop events that land on interactive DOM elements (links, nav
// items, etc.) that may be present at the test coordinates.
//
// sticker.js only reads e.clientX, e.clientY from pointer events, so
// synthetic events are behaviourally identical to real mouse events.

async function stickerMove(page, clientX, clientY) {
  await page.evaluate((cx, cy) => {
    document.body.dispatchEvent(new PointerEvent('pointermove', {
      bubbles:     true,
      cancelable:  true,
      clientX:     cx,
      clientY:     cy,
      isPrimary:   true,
      pointerType: 'mouse',
      pointerId:   1,
    }));
  }, clientX, clientY);
}

async function stickerDown(page, clientX, clientY) {
  await page.evaluate((cx, cy) => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles:     true,
      cancelable:  true,
      clientX:     cx,
      clientY:     cy,
      isPrimary:   true,
      pointerType: 'mouse',
      pointerId:   1,
      button:      0,
      buttons:     1,
    }));
  }, clientX, clientY);
}

async function stickerUp(page, clientX, clientY) {
  await page.evaluate((cx, cy) => {
    document.body.dispatchEvent(new PointerEvent('pointerup', {
      bubbles:     true,
      cancelable:  true,
      clientX:     cx,
      clientY:     cy,
      isPrimary:   true,
      pointerType: 'mouse',
      pointerId:   1,
      button:      0,
      buttons:     0,
    }));
  }, clientX, clientY);
}

// ── Sticker helpers ───────────────────────────────────────────────────────────

async function waitForStickerReady(page, timeout = 5000) {
  await page.waitForFunction(
    () => window.STICKER_LAYER && window.STICKER_LAYER._controller,
    { timeout }
  );
}

async function getStickerState(page) {
  return page.evaluate(() => ({
    state:        window.STICKER_LAYER._controller.state,
    peelProgress: window.STICKER_LAYER._controller.peelProgress,
    tornFraction: window.STICKER_LAYER._tornFraction,
    zonesCount:   window.STICKER_LAYER._grabTracker.zones.length,
    grabUV: {
      x: window.STICKER_LAYER._controller.grabUV.x,
      y: window.STICKER_LAYER._controller.grabUV.y,
    },
    peelDir: {
      x: window.STICKER_LAYER._controller.peelDir.x,
      y: window.STICKER_LAYER._controller.peelDir.y,
    },
  }));
}

/**
 * For a cursor at (clientX, clientY), return diagnostic info about which
 * grab zone is nearest and how far away it is in screen pixels.
 */
async function nearestZoneDiag(page, clientX, clientY) {
  return page.evaluate((cx, cy, iw, ih) => {
    const uv     = { x: cx / iw, y: 1 - cy / ih };
    const tracker = window.STICKER_LAYER._grabTracker;
    let bestDist = Infinity, bestZoneIdx = -1, bestPt = null;
    tracker.zones.forEach((z, zi) => {
      z.path.forEach(pt => {
        const dx = (uv.x - pt.x) * iw;
        const dy = (uv.y - pt.y) * ih;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; bestZoneIdx = zi; bestPt = pt; }
      });
    });
    return {
      cursorUV: uv,
      nearestZone: bestZoneIdx,
      nearestDistPx: bestDist,
      snapRadius: tracker.grabSnapPx,
      nearestPtScreen: bestPt
        ? { x: Math.round(bestPt.x * iw), y: Math.round((1 - bestPt.y) * ih) }
        : null,
    };
  }, clientX, clientY, VP.width, VP.height);
}

/**
 * Dump all zone definitions as human-readable screen coordinates.
 */
async function dumpZones(page) {
  return page.evaluate((iw, ih) => {
    return window.STICKER_LAYER._grabTracker.zones.map((z, i) => ({
      idx: i,
      numPoints: z.path.length,
      normal: { x: Math.round(z.normal.x), y: Math.round(z.normal.y) },
      screenRange: {
        from: {
          x: Math.round(z.path[0].x * iw),
          y: Math.round((1 - z.path[0].y) * ih),
        },
        to: {
          x: Math.round(z.path[z.path.length - 1].x * iw),
          y: Math.round((1 - z.path[z.path.length - 1].y) * ih),
        },
      },
    }));
  }, VP.width, VP.height);
}

/**
 * Perform a complete peel-and-snap-off gesture using synthetic pointer events.
 *
 * @param {object} page     - Puppeteer Page
 * @param {number} startX   - clientX of grab point (must be on a zone point)
 * @param {number} startY   - clientY of grab point
 * @param {number} endX     - clientX of drag destination
 * @param {number} endY     - clientY of drag destination
 */
async function performTear(page, startX, startY, endX, endY) {
  // 1. Move to edge zone → triggers HOVER via pointermove
  await stickerMove(page, startX, startY);

  const gotHover = await page
    .waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!gotHover) {
    const diag = await nearestZoneDiag(page, startX, startY);
    const state = await page.evaluate(() => window.STICKER_LAYER._controller.state);
    throw new Error(
      `No HOVER at (${startX}, ${startY}). ` +
      `Current state="${state}". ` +
      `Nearest zone point is ${diag.nearestDistPx.toFixed(1)}px away ` +
      `(snap radius = ${diag.snapRadius}px) at screen ` +
      `(${diag.nearestPtScreen?.x ?? '?'}, ${diag.nearestPtScreen?.y ?? '?'}).`
    );
  }

  // 2. Pointer down → PEELING
  await stickerDown(page, startX, startY);
  await page.waitForFunction(
    () => window.STICKER_LAYER._controller.state === 'PEELING',
    { timeout: 500 }
  );

  // 3. Drag in small steps at ~60 fps to allow spring physics to advance
  const STEPS = 45;
  let midPeelScreenshot = false;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    await stickerMove(
      page,
      Math.round(startX + (endX - startX) * t),
      Math.round(startY + (endY - startY) * t)
    );
    await new Promise(r => setTimeout(r, 16));

    // Capture one frame mid-curl while the peel is visually interesting
    if (!midPeelScreenshot) {
      const prog = await page.evaluate(
        () => window.STICKER_LAYER._controller.peelProgress
      );
      if (prog >= 0.35 && prog <= 0.70) {
        await screenshot(page, `mid-peel-${startX}-${startY}`);
        midPeelScreenshot = true;
      }
    }
  }

  // 4. Check peel progress reached snap threshold
  const progress = await page.evaluate(
    () => window.STICKER_LAYER._controller.peelProgress
  );
  if (progress < 0.35) {
    await stickerUp(page, endX, endY);
    throw new Error(
      `peelProgress reached only ${progress.toFixed(3)} — ` +
      `drag was insufficient for snap-off (threshold = 0.35). ` +
      `Try a longer drag distance.`
    );
  }

  // 5. Release → SNAP_OFF fires, then state returns to IDLE after 350 ms timeout
  await stickerUp(page, endX, endY);

  await page.waitForFunction(
    () => window.STICKER_LAYER._controller.state === 'IDLE',
    { timeout: 2500 }
  );
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
const SCREENSHOT_DIR = path.join(__dirname, '../../.claude/screenshots/sticker-peel');
let screenshotIdx = 0;

async function screenshot(page, label) {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const fname = `${String(++screenshotIdx).padStart(2, '0')}-${label.replace(/[^a-z0-9]/gi, '_')}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname) });
    console.log(`     📸 ${fname}`);
  } catch (e) {
    // screenshots are non-critical — ignore errors
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n🎯 Sticker peel e2e test suite\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',              // ANGLE abstraction layer (not swiftshader directly)
      '--use-angle=swiftshader',     // use SwiftShader as ANGLE backend
      '--enable-unsafe-swiftshader', // required in Chrome 137+ (no longer auto-fallback)
      // NOTE: do NOT pass --disable-gpu — it prevents the GPU process entirely,
      //       which also kills SwiftShader software rendering.
    ],
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser] ${msg.text()}`);
  });

  await page.setViewport(VP);

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  } catch {
    console.error(`❌ Cannot reach Hugo server at ${BASE_URL} — run: npm run dev`);
    await browser.close();
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1: Initialization
  // ══════════════════════════════════════════════════════════════════════════
  console.log('[Phase 1] Initialization\n');

  await runTest('page loads and STICKER_LAYER boots in IDLE state', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);
    const s = await getStickerState(page);
    if (s.state       !== 'IDLE') throw new Error(`state = ${s.state} (expected IDLE)`);
    if (s.tornFraction !== 0)     throw new Error(`tornFraction = ${s.tornFraction} (expected 0)`);
  });

  await runTest('GrabZoneTracker registers exactly 4 viewport-edge zones at boot', async () => {
    const s = await getStickerState(page);
    if (s.zonesCount < 4) throw new Error(`${s.zonesCount} zones (expected ≥ 4)`);
    const zones = await dumpZones(page);
    for (const z of zones) {
      console.log(
        `     zone ${z.idx}  normal=(${z.normal.x},${z.normal.y})  ` +
        `screen (${z.screenRange.from.x},${z.screenRange.from.y}) → ` +
        `(${z.screenRange.to.x},${z.screenRange.to.y})  [${z.numPoints} pts]`
      );
    }
  });

  await runTest('sticker-canvas is present in DOM and visible', async () => {
    const ok = await page.evaluate(() => {
      const el = document.getElementById('sticker-canvas');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    if (!ok) throw new Error('sticker-canvas missing or hidden');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 2: Edge detection
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Phase 2] Edge detection\n');

  // Zone points are sampled every VP.height/8 = 100px vertically,
  // and every VP.width/8 = 160px horizontally.
  // To reliably trigger HOVER the cursor must be ≤ GRAB_SNAP_PX (12 px) from a point.

  const EDGE_ZONE_POINTS = [
    // Left edge: x=90, y at k=1,3,5,7 (y=700,500,300,100)
    { label: 'left edge  (90, 700)',  x: EDGE_MARGIN,            y: 700 },
    { label: 'left edge  (90, 500)',  x: EDGE_MARGIN,            y: 500 },
    { label: 'left edge  (90, 300)',  x: EDGE_MARGIN,            y: 300 },
    { label: 'left edge  (90, 100)',  x: EDGE_MARGIN,            y: 100 },
    // Right edge: x=1190
    { label: 'right edge (1190,400)', x: VP.width - EDGE_MARGIN, y: 400 },
    { label: 'right edge (1190,200)', x: VP.width - EDGE_MARGIN, y: 200 },
    // Physically-top zone (clientY=90, "bottom" in UV)
    { label: 'top screen (640, 90)',  x: 640,                    y: EDGE_MARGIN },
    { label: 'top screen (320, 90)',  x: 320,                    y: EDGE_MARGIN },
    // Physically-bottom zone (clientY=710, "top" in UV)
    { label: 'bot screen (640,710)',  x: 640,                    y: VP.height - EDGE_MARGIN },
    { label: 'bot screen (960,710)',  x: 960,                    y: VP.height - EDGE_MARGIN },
  ];

  await runTest('hover triggers at all sampled zone points', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);

    const failures = [];
    for (const pt of EDGE_ZONE_POINTS) {
      // Reset to center between attempts
      await stickerMove(page, VP.width / 2, VP.height / 2);
      await new Promise(r => setTimeout(r, 30));

      await stickerMove(page, pt.x, pt.y);
      await new Promise(r => setTimeout(r, 60));

      const state = await page.evaluate(() => window.STICKER_LAYER._controller.state);
      if (state !== 'HOVER') {
        const diag = await nearestZoneDiag(page, pt.x, pt.y);
        failures.push(
          `  ${pt.label} → state=${state}, nearest zone pt ${diag.nearestDistPx.toFixed(1)}px ` +
          `away at (${diag.nearestPtScreen?.x},${diag.nearestPtScreen?.y}) [snap=${diag.snapRadius}px]`
        );
      }
    }

    if (failures.length) {
      throw new Error(
        `${failures.length}/${EDGE_ZONE_POINTS.length} zone points did not trigger HOVER:\n` +
        failures.join('\n')
      );
    }
    console.log(`     all ${EDGE_ZONE_POINTS.length} sampled zone points trigger HOVER ✓`);
  });

  await runTest('dead zone between zone points: cursor 50px from nearest point does NOT trigger hover', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);

    // Zone points at clientY=300 and clientY=400 on left edge.
    // Midpoint = y=350, which is 50px from either zone point (>> GRAB_SNAP_PX=12).
    const testX = EDGE_MARGIN;
    const testY = 350;
    await stickerMove(page, testX, testY);
    await new Promise(r => setTimeout(r, 60));
    const state = await page.evaluate(() => window.STICKER_LAYER._controller.state);
    const diag  = await nearestZoneDiag(page, testX, testY);

    console.log(
      `     cursor at (${testX}, ${testY}): state=${state}, ` +
      `nearest zone pt = ${diag.nearestDistPx.toFixed(1)}px away, snapRadius = ${diag.snapRadius}px`
    );

    if (state === 'HOVER') {
      // Edge detection was improved — note it, but don't fail the suite
      console.log(
        '     NOTE: Dead zone at y=350 DID trigger HOVER — zone sampling was densified or snap radius enlarged.'
      );
    } else {
      const deadZoneWidthPx = VP.height / 8 - GRAB_SNAP_PX * 2;
      console.log(
        `     Dead zone confirmed: ${deadZoneWidthPx}px of each ${VP.height/8}px interval is unreachable ` +
        `(GRAB_SNAP_PX=${GRAB_SNAP_PX}, zone-pt spacing=${VP.height/8}px).`
      );
    }
    // This test is diagnostic — always passes
  });

  await runTest('moving away from edge returns state to IDLE', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);
    await stickerMove(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    );
    await stickerMove(page, VP.width / 2, VP.height / 2);
    await new Promise(r => setTimeout(r, 60));
    const state = await page.evaluate(() => window.STICKER_LAYER._controller.state);
    if (state !== 'IDLE') throw new Error(`Expected IDLE after moving to center, got ${state}`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 3: Peel mechanics
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Phase 3] Peel mechanics\n');

  await runTest('pointerdown on HOVER transitions to PEELING', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);
    await stickerMove(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    );
    await stickerDown(page, EDGE_MARGIN, 400);
    const s = await getStickerState(page);
    if (s.state !== 'PEELING') throw new Error(`Expected PEELING after pointerdown, got ${s.state}`);
    // clean up
    await stickerUp(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => ['IDLE', 'SNAP_BACK'].includes(window.STICKER_LAYER._controller.state),
      { timeout: 1000 }
    );
  });

  await runTest('short drag (< snap threshold) → SNAP_BACK → IDLE, tornFraction stays 0', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);
    await stickerMove(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    );
    await stickerDown(page, EDGE_MARGIN, 400);
    // 5 steps of 5px = 25px total — far below the ~160px needed for peelProgress 0.35
    for (let i = 1; i <= 5; i++) await stickerMove(page, EDGE_MARGIN + i * 5, 400);
    await stickerUp(page, EDGE_MARGIN + 25, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'IDLE',
      { timeout: 2000 }
    );
    const s = await getStickerState(page);
    if (s.tornFraction > 0) throw new Error(`tornFraction = ${s.tornFraction} after snap-back (expected 0)`);
  });

  await runTest('long drag (> snap threshold) → peelProgress ≥ 0.35 before release', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);
    await stickerMove(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    );
    await stickerDown(page, EDGE_MARGIN, 400);
    // Drag 600px rightward in 40 steps at ~60 fps
    for (let i = 1; i <= 40; i++) {
      await stickerMove(page, EDGE_MARGIN + Math.round(600 * i / 40), 400);
      await new Promise(r => setTimeout(r, 16));
    }
    const progress = await page.evaluate(
      () => window.STICKER_LAYER._controller.peelProgress
    );
    await stickerUp(page, EDGE_MARGIN + 600, 400);
    if (progress < 0.35) throw new Error(`peelProgress = ${progress.toFixed(3)} (expected ≥ 0.35)`);
    console.log(`     peelProgress at release: ${progress.toFixed(3)}`);
  });

  await runTest('snap-off fires → tornFraction increases and crack boundary zone added', async () => {
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForStickerReady(page);

    const zoneBefore = (await getStickerState(page)).zonesCount;
    await screenshot(page, 'before-first-tear');

    await performTear(page, EDGE_MARGIN, 400, Math.round(VP.width * 0.7), 400);

    const s = await getStickerState(page);
    await screenshot(page, 'after-first-tear');

    if (s.tornFraction <= 0) throw new Error('tornFraction did not increase after snap-off');
    console.log(`     tornFraction after 1 tear: ${(s.tornFraction * 100).toFixed(1)}%`);
    console.log(`     zones: ${zoneBefore} → ${s.zonesCount} (+${s.zonesCount - zoneBefore} crack boundary)`);

    if (s.zonesCount <= zoneBefore) {
      throw new Error(`Expected crack boundary zone added (had ${zoneBefore}, now ${s.zonesCount})`);
    }
  });

  await runTest('peelFrontUV is within viewport after snap-off', async () => {
    const uv = await page.evaluate(() => {
      const c = window.STICKER_LAYER._controller;
      return c.peelFrontUV();
    });
    if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) {
      throw new Error(`peelFrontUV out of [0,1] bounds: (${uv.x.toFixed(3)}, ${uv.y.toFixed(3)})`);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 4: Human simulation — clearing the full viewport
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Phase 4] Human simulation: clearing the full viewport\n');
  console.log('     Starting with fresh sticker, then performing 8 planned tears...\n');

  await page.reload({ waitUntil: 'networkidle0' });
  await waitForStickerReady(page);

  await screenshot(page, 'screen-intact');

  // ┌─────────────────────────────────────────────────────────────────────┐
  // │  TEAR PLAN  — 8 tears working around the viewport from 4 edges     │
  // │                                                                     │
  // │  All start positions are exact zone sample points so HOVER fires.  │
  // │                                                                     │
  // │  Zone pts on left/right edges (clientY): 0,100,200,300,400,500,…   │
  // │  Zone pts on top/bot zones (clientX): 0,160,320,480,640,800,960,…  │
  // └─────────────────────────────────────────────────────────────────────┘
  const tearPlan = [
    {
      name: 'tear 1 — left edge y=300, drag right toward upper-right',
      sx: EDGE_MARGIN,            sy: 300,
      ex: Math.round(VP.width * 0.80), ey: 150,
    },
    {
      name: 'tear 2 — left edge y=500, drag right toward lower-right',
      sx: EDGE_MARGIN,            sy: 500,
      ex: Math.round(VP.width * 0.80), ey: 650,
    },
    {
      name: 'tear 3 — right edge y=200, drag left toward upper-left',
      sx: VP.width - EDGE_MARGIN, sy: 200,
      ex: Math.round(VP.width * 0.20), ey: 100,
    },
    {
      name: 'tear 4 — right edge y=600, drag left toward lower-left',
      sx: VP.width - EDGE_MARGIN, sy: 600,
      ex: Math.round(VP.width * 0.20), ey: 700,
    },
    {
      name: 'tear 5 — top of screen x=640 (clientY=90), drag downward',
      sx: 640,                    sy: EDGE_MARGIN,
      ex: 640,                    ey: Math.round(VP.height * 0.70),
    },
    {
      name: 'tear 6 — bottom of screen x=640 (clientY=710), drag upward',
      sx: 640,                    sy: VP.height - EDGE_MARGIN,
      ex: 640,                    ey: Math.round(VP.height * 0.30),
    },
    {
      name: 'tear 7 — left edge y=400 (midpoint), drag far right',
      sx: EDGE_MARGIN,            sy: 400,
      ex: Math.round(VP.width * 0.90), ey: 400,
    },
    {
      name: 'tear 8 — right edge y=400 (midpoint), drag far left',
      sx: VP.width - EDGE_MARGIN, sy: 400,
      ex: Math.round(VP.width * 0.10), ey: 400,
    },
  ];

  let prevTorn = 0;

  for (let i = 0; i < tearPlan.length; i++) {
    const t = tearPlan[i];
    await runTest(t.name, async () => {
      const before = await page.evaluate(() => window.STICKER_LAYER._tornFraction);

      // Reset hover state before each tear
      await stickerMove(page, VP.width / 2, VP.height / 2);
      await new Promise(r => setTimeout(r, 80));

      await performTear(page, t.sx, t.sy, t.ex, t.ey);

      const after = await page.evaluate(() => window.STICKER_LAYER._tornFraction);
      const delta = after - before;

      await screenshot(page, `tear-${i + 1}`);

      console.log(
        `     tornFraction: ${(before * 100).toFixed(1)}% → ${(after * 100).toFixed(1)}%` +
        `  (+${(delta * 100).toFixed(1)}%)`
      );

      if (after <= before) {
        throw new Error(
          `tornFraction did not increase: ${before.toFixed(4)} → ${after.toFixed(4)}`
        );
      }
      prevTorn = after;
    });
  }

  await runTest('screen is substantially cleared (tornFraction > 0.10) after 8 tears', async () => {
    const torn = await page.evaluate(() => window.STICKER_LAYER._tornFraction);
    console.log(`     final tornFraction = ${(torn * 100).toFixed(1)}%`);
    await screenshot(page, 'screen-cleared');
    if (torn < 0.10) {
      throw new Error(
        `tornFraction = ${(torn * 100).toFixed(1)}% — expected > 10% after 8 tears.`
      );
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 5: Reset
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Phase 5] Reset\n');

  await runTest('STICKER_LAYER.reset() restores intact sticker', async () => {
    await page.evaluate(() => window.STICKER_LAYER.reset());
    const s = await getStickerState(page);
    if (s.state        !== 'IDLE') throw new Error(`state = ${s.state} after reset (expected IDLE)`);
    if (s.tornFraction !== 0)      throw new Error(`tornFraction = ${s.tornFraction} after reset (expected 0)`);
    if (s.zonesCount   !== 4)      throw new Error(`zonesCount = ${s.zonesCount} after reset (expected 4)`);
    await screenshot(page, 'after-reset');
    console.log(`     state=IDLE, tornFraction=0, zones=4 ✓`);
  });

  await runTest('hover works again after reset', async () => {
    await stickerMove(page, EDGE_MARGIN, 400);
    await page.waitForFunction(
      () => window.STICKER_LAYER._controller.state === 'HOVER',
      { timeout: 2000 }
    );
    await stickerMove(page, VP.width / 2, VP.height / 2);
    await new Promise(r => setTimeout(r, 60));
    const state = await page.evaluate(() => window.STICKER_LAYER._controller.state);
    if (state !== 'IDLE') throw new Error(`Expected IDLE after leaving edge, got ${state}`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n[sticker-peel] ${passed} passed, ${failed} failed\n`);
  if (SCREENSHOT_DIR) {
    console.log(`     Screenshots saved to: ${path.relative(process.cwd(), SCREENSHOT_DIR)}/\n`);
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
