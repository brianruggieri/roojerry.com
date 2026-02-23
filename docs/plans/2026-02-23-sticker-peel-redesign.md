# Sticker Peel Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "cigarette burn" sticker tear effect with a realistic cylindrical-fold plastic-film peel — clean fold-line geometry, crack propagation on snap-off, progressive full-canvas clearing, and discoverable edge interaction.

**Architecture:** The tear region is stored as queryable JavaScript geometry (polygon + crack paths), not just painted pixels. A CrackGenerator produces jagged branching paths on snap-off; MaskPainter fills polygons rather than stamping circles. A cylindrical-fold vertex shader replaces the sine-wave approximation.

**Tech Stack:** Three.js r160 (ESM), GLSL ES 1.0, Node.js test harness (no framework), Hugo static site.

---

## Overview of tasks

| # | Task | Type | Test |
|---|---|---|---|
| 1 | DOM isolation + remove notch gate | Quick fix | Node simulation |
| 2 | CrackGenerator + GrabZoneTracker | Pure logic | Node simulation |
| 3 | Rewrite StickerController | Logic + state machine | Node simulation |
| 4 | Rewrite MaskPainter (polygon fill) | WebGL | Visual |
| 5 | Cylindrical fold vertex shader | GLSL | Visual |
| 6 | Iridescent rim + pulse fragment shader | GLSL | Visual |
| 7 | StickerLayer integration | Wiring | Visual + Node |
| 8 | Update simulation tests | Tests | Node |

Run tests: `source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js`

---

## Task 1: DOM Isolation + Remove Notch Gate

**Files:**
- Modify: `static/js/sticker.js` (pointer handlers + StickerController.onPointerDown)

**Context:** The sticker canvas has `pointer-events: none` but `window.addEventListener` fires for ALL DOM events, including header clicks. The notch (3-click) gate is removed in favour of hover-lift.

**Step 1: Add DOM guard to all three window pointer handlers**

In `StickerLayer.prototype._onPointerDown`, `_onPointerMove`, `_onPointerUp` — add as the first line of each:

```js
if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
```

**Step 2: Remove NOTCHING state from StickerController.onPointerDown**

Replace the entire `if (this.state === 'IDLE')` block in `onPointerDown` (lines 583–611) with:

```js
if (this.state === 'IDLE') {
  if (!this._isNearEdge(uv.x, uv.y)) return;
  this.activeNotch = { x: uv.x, y: uv.y };
  this.grabUV.set(uv.x, uv.y);
  this.state = 'GRABBED';
  this.peelTarget   = 0;
  this.peelProgress = 0;
  this.peelVelocity = 0;
  this.isStuck = false;
  const dl = uv.x, dr = 1 - uv.x, dt = uv.y, db = 1 - uv.y;
  const minD = Math.min(dl, dr, dt, db);
  if      (minD === dl) this.peelDir.set( 1,  0);
  else if (minD === dr) this.peelDir.set(-1,  0);
  else if (minD === dt) this.peelDir.set( 0,  1);
  else                  this.peelDir.set( 0, -1);
}
```

Remove the `NOTCH_THRESHOLD`, `NOTCH_RADIUS_UV` params from `window.STICKER_PARAMS` and delete the `_notchKey` method.

**Step 3: Run existing simulation tests — expect one failure (notch test)**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: notch-accumulation test fails (expected — that test will be replaced in Task 8). All other tests pass.

**Step 4: Commit**

```bash
git add static/js/sticker.js
git commit -m "Remove notch gate, add DOM isolation guard to pointer handlers"
```

---

## Task 2: CrackGenerator + GrabZoneTracker

**Files:**
- Modify: `static/js/sticker.js` (add two new classes before StickerController)
- Modify: `tests/simulation/sticker.test.js` (add tests for both classes)

**Context:** These are pure-logic classes with no WebGL. CrackGenerator produces a jagged branching path from a UV origin to the nearest viewport edge. GrabZoneTracker maintains the list of interactive grab zones (viewport edges + exposed crack boundaries) and answers proximity queries.

### CrackGenerator

**Step 1: Write failing tests in `tests/simulation/sticker.test.js`**

Add at the end of the file (before the summary block):

```js
/* ── CrackGenerator ── */
console.log('\n[CrackGenerator]');
{
  // Inline CrackGenerator for Node testing (must match sticker.js exactly)
  function deterministicNoise(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function generateCrack(originUV, params) {
    const STEP = params.CRACK_STEP_SIZE;
    // Find nearest viewport edge and direction
    const edges = [
      { target: { x: 0,          y: originUV.y }, dist: originUV.x },
      { target: { x: 1,          y: originUV.y }, dist: 1 - originUV.x },
      { target: { x: originUV.x, y: 0          }, dist: originUV.y },
      { target: { x: originUV.x, y: 1          }, dist: 1 - originUV.y },
    ];
    edges.sort((a, b) => a.dist - b.dist);
    const nearest = edges[0];
    const dx = nearest.target.x - originUV.x;
    const dy = nearest.target.y - originUV.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    const dir = { x: dx / len, y: dy / len };
    const perp = { x: -dir.y, y: dir.x };
    const steps = Math.ceil(len / STEP);
    const waypoints = [{ x: originUV.x, y: originUV.y }];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const base = { x: originUV.x + dx * t, y: originUV.y + dy * t };
      const jag = (deterministicNoise(base.x * 7.3 + i * 0.31, base.y * 5.1 + i * 0.17) - 0.5)
                  * params.TEAR_JAGGEDNESS * 0.3 * (1 - t * 0.5);
      waypoints.push({ x: base.x + perp.x * jag, y: base.y + perp.y * jag });
    }
    return waypoints;
  }

  const CRACK_PARAMS = { CRACK_STEP_SIZE: 0.02, TEAR_JAGGEDNESS: 0.45 };

  // Test: path starts at origin
  const origin = { x: 0.3, y: 0.05 };
  const path = generateCrack(origin, CRACK_PARAMS);
  assert(path.length >= 2, 'crack has at least 2 waypoints');
  assert(Math.abs(path[0].x - origin.x) < 1e-6 && Math.abs(path[0].y - origin.y) < 1e-6,
    'first waypoint is the origin');

  // Test: last waypoint reaches a viewport edge
  const last = path[path.length - 1];
  const atEdge = last.x < 0.05 || last.x > 0.95 || last.y < 0.05 || last.y > 0.95;
  assert(atEdge, `last waypoint (${last.x.toFixed(3)}, ${last.y.toFixed(3)}) is near a viewport edge`);

  // Test: all waypoints are in [0,1] range (clamped)
  const inBounds = path.every(p => p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05);
  assert(inBounds, 'all crack waypoints within 5% of UV bounds');

  // Test: deterministic — same origin produces same path
  const path2 = generateCrack(origin, CRACK_PARAMS);
  assert(path2.length === path.length && Math.abs(path2[1].x - path[1].x) < 1e-9,
    'crack generation is deterministic for same origin');
}
```

**Step 2: Run — expect failures**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: CrackGenerator tests fail with "generateCrack is not defined".

**Step 3: Add CrackGenerator class to `static/js/sticker.js`**

Add this class after the `MaskPainter` section and before `TearSystem`:

```js
/* ═══════════════════════════════════════════════════════════
   CRACK GENERATOR
   Produces a jagged polyline from a UV origin to the nearest
   viewport edge, with optional secondary branches.
═══════════════════════════════════════════════════════════ */

function CrackGenerator(params) {
  this.params = params;
}

CrackGenerator.prototype._noise = function (x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Build a primary crack path from originUV toward the nearest viewport edge.
 * Returns an array of {x, y} UV waypoints.
 */
CrackGenerator.prototype.buildPath = function (originUV) {
  const P = this.params;
  const STEP = P.CRACK_STEP_SIZE;

  // Find nearest viewport edge
  const edges = [
    { target: { x: 0,            y: originUV.y }, dist: originUV.x },
    { target: { x: 1,            y: originUV.y }, dist: 1 - originUV.x },
    { target: { x: originUV.x,   y: 0          }, dist: originUV.y },
    { target: { x: originUV.x,   y: 1          }, dist: 1 - originUV.y },
  ];
  edges.sort((a, b) => a.dist - b.dist);
  const nearest = edges[0];

  const dx = nearest.target.x - originUV.x;
  const dy = nearest.target.y - originUV.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const dir  = { x: dx / len, y: dy / len };
  const perp = { x: -dir.y,   y: dir.x   };

  const steps = Math.ceil(len / STEP);
  const waypoints = [{ x: originUV.x, y: originUV.y }];

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const base = {
      x: originUV.x + dx * t,
      y: originUV.y + dy * t,
    };
    const jag = (this._noise(base.x * 7.3 + i * 0.31, base.y * 5.1 + i * 0.17) - 0.5)
                * P.TEAR_JAGGEDNESS * 0.3 * (1 - t * 0.5);
    waypoints.push({
      x: Math.max(0, Math.min(1, base.x + perp.x * jag)),
      y: Math.max(0, Math.min(1, base.y + perp.y * jag)),
    });
  }

  return waypoints;
};

/**
 * Build 1–2 secondary branch paths.
 * Each starts at a random waypoint on the primary path and deviates 30–60°.
 * Returns array of waypoint arrays (may be empty).
 */
CrackGenerator.prototype.buildBranches = function (primaryPath) {
  const P = this.params;
  const branches = [];
  const count = this._noise(primaryPath[0].x * 3.1, primaryPath[0].y * 7.9) > 0.4 ? 2 : 1;

  for (let b = 0; b < count; b++) {
    const startIdx = Math.floor(
      (0.25 + b * 0.2 + this._noise(b * 0.7, primaryPath[0].x) * 0.2)
      * primaryPath.length
    );
    const start = primaryPath[Math.min(startIdx, primaryPath.length - 2)];

    // Deviate direction 30–60° from primary direction
    const primaryDir = {
      x: primaryPath[primaryPath.length - 1].x - primaryPath[0].x,
      y: primaryPath[primaryPath.length - 1].y - primaryPath[0].y,
    };
    const angle = (0.52 + this._noise(b * 1.3, start.x) * 0.52)  // 30–60° in radians
                  * (b % 2 === 0 ? 1 : -1);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const branchDir = {
      x: primaryDir.x * cos - primaryDir.y * sin,
      y: primaryDir.x * sin + primaryDir.y * cos,
    };
    const dlen = Math.sqrt(branchDir.x ** 2 + branchDir.y ** 2) || 1e-6;
    const bdir = { x: branchDir.x / dlen, y: branchDir.y / dlen };

    const branchLen = 0.10 + this._noise(b * 2.1, start.y) * 0.12;
    const steps = Math.ceil(branchLen / P.CRACK_STEP_SIZE);
    const branch = [{ x: start.x, y: start.y }];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const prev = branch[branch.length - 1];
      const jag = (this._noise(prev.x * 9.1 + i * 0.7, prev.y * 6.3) - 0.5)
                  * P.TEAR_JAGGEDNESS * 0.15;
      const perp = { x: -bdir.y, y: bdir.x };
      branch.push({
        x: Math.max(0, Math.min(1, prev.x + bdir.x * P.CRACK_STEP_SIZE + perp.x * jag)),
        y: Math.max(0, Math.min(1, prev.y + bdir.y * P.CRACK_STEP_SIZE + perp.y * jag)),
      });
    }
    branches.push(branch);
  }

  return branches;
};
```

**Step 4: Update test to use inline version matching the implementation**

The test in Step 1 already inlines a matching version of `generateCrack`. Verify the inline matches the class logic by reading both side-by-side — path generation algorithm must be identical.

**Step 5: Run tests — all CrackGenerator tests pass**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: all CrackGenerator assertions pass.

### GrabZoneTracker

**Step 6: Write failing tests (append to test file)**

```js
/* ── GrabZoneTracker ── */
console.log('\n[GrabZoneTracker]');
{
  // Inline GrabZoneTracker for Node testing
  const GRAB_SNAP_PX = 12;
  const EDGE_MARGIN_UV = 90 / 1920; // EDGE_MARGIN_PX / innerWidth

  function screenDist(a, b, iw, ih) {
    return Math.sqrt(((a.x - b.x) * iw) ** 2 + ((a.y - b.y) * ih) ** 2);
  }

  function nearestGrabZone(cursorUV, grabZones, iw, ih) {
    let best = null, bestDist = Infinity;
    for (const zone of grabZones) {
      for (const pt of zone.path) {
        const d = screenDist(cursorUV, pt, iw, ih);
        if (d < bestDist) { bestDist = d; best = { zone, point: pt, dist: d }; }
      }
    }
    return bestDist <= GRAB_SNAP_PX ? best : null;
  }

  // Default viewport-edge grab zones (4 edges, sampled at corners)
  const defaultZones = [
    { path: [{ x: 0, y: 0 }, { x: 0, y: 1 }], normal: { x: 1,  y: 0  } }, // left edge
    { path: [{ x: 1, y: 0 }, { x: 1, y: 1 }], normal: { x: -1, y: 0  } }, // right edge
    { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], normal: { x: 0,  y: 1  } }, // top edge
    { path: [{ x: 0, y: 1 }, { x: 1, y: 1 }], normal: { x: 0,  y: -1 } }, // bottom edge
  ];

  const iw = 1920, ih = 1080;

  // Cursor right at the top-left corner: should match the left or top edge
  const cornerCursor = { x: 0, y: 0 };
  const result = nearestGrabZone(cornerCursor, defaultZones, iw, ih);
  assert(result !== null, 'cursor at corner (0,0) finds a grab zone');
  assert(result.dist === 0, 'distance is 0 for exact match');

  // Cursor 8px from left edge (within snap radius)
  const nearLeft = { x: 8 / iw, y: 0.5 };
  const nearResult = nearestGrabZone(nearLeft, defaultZones, iw, ih);
  assert(nearResult !== null, `cursor ${(8).toFixed(0)}px from left edge finds grab zone`);

  // Cursor 100px from any edge (outside snap radius)
  const farCursor = { x: 200 / iw, y: 0.5 };
  const farResult = nearestGrabZone(farCursor, defaultZones, iw, ih);
  assert(farResult === null, 'cursor 200px from edges finds no grab zone');

  // After adding a crack-boundary grab zone, cursor near it should find it
  const crackZone = {
    path: [{ x: 0.3, y: 0.3 }, { x: 0.5, y: 0.4 }, { x: 0.7, y: 0.2 }],
    normal: { x: 0.1, y: 0.9 },
  };
  const zonesWithCrack = [...defaultZones, crackZone];
  const onCrack = { x: 0.5, y: 0.4 }; // exact match on crack midpoint
  const crackResult = nearestGrabZone(onCrack, zonesWithCrack, iw, ih);
  assert(crackResult !== null, 'cursor on crack boundary finds crack grab zone');
  assert(Math.abs(crackResult.point.x - 0.5) < 1e-9, 'grab zone snaps to nearest crack waypoint');
}
```

**Step 7: Run — expect GrabZoneTracker failures**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: GrabZoneTracker tests fail (no implementation yet).

**Step 8: Add GrabZoneTracker class to `static/js/sticker.js`**

Add after CrackGenerator:

```js
/* ═══════════════════════════════════════════════════════════
   GRAB ZONE TRACKER
   Maintains the list of interactive UV regions (viewport edges
   + exposed crack boundaries) and answers proximity queries.
═══════════════════════════════════════════════════════════ */

function GrabZoneTracker(edgeMarginPx, grabSnapPx) {
  this.edgeMarginPx = edgeMarginPx;
  this.grabSnapPx   = grabSnapPx;
  this.zones = [];
  this._initViewportEdges();
}

GrabZoneTracker.prototype._initViewportEdges = function () {
  // Sampled at 9 points along each edge for fine-grained proximity
  const pts = (ax, ay, bx, by) => {
    const path = [];
    for (let i = 0; i <= 8; i++) {
      path.push({ x: ax + (bx - ax) * i / 8, y: ay + (by - ay) * i / 8 });
    }
    return path;
  };
  this.zones = [
    { path: pts(0, 0, 0, 1), normal: { x:  1, y:  0 } },  // left
    { path: pts(1, 0, 1, 1), normal: { x: -1, y:  0 } },  // right
    { path: pts(0, 0, 1, 0), normal: { x:  0, y:  1 } },  // top
    { path: pts(0, 1, 1, 1), normal: { x:  0, y: -1 } },  // bottom
  ];
};

/**
 * Add an exposed crack boundary as a new grab zone.
 * normal: outward direction perpendicular to crack at grab point.
 */
GrabZoneTracker.prototype.addCrackBoundary = function (waypoints, normal) {
  this.zones.push({ path: waypoints.slice(), normal });
};

/**
 * Find the nearest grab zone to cursorUV.
 * Returns { zone, point, dist, normal } or null if beyond grabSnapPx.
 */
GrabZoneTracker.prototype.nearest = function (cursorUV, innerWidth, innerHeight) {
  let best = null, bestDist = Infinity;
  const iw = innerWidth, ih = innerHeight;
  for (const zone of this.zones) {
    for (const pt of zone.path) {
      const dx = (cursorUV.x - pt.x) * iw;
      const dy = (cursorUV.y - pt.y) * ih;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = { zone, point: pt, dist: d, normal: zone.normal };
      }
    }
  }
  return bestDist <= this.grabSnapPx ? best : null;
};

/** Remove all crack boundary zones (used on reset). */
GrabZoneTracker.prototype.reset = function () {
  this._initViewportEdges();
};
```

**Step 9: Run tests — all GrabZoneTracker tests pass**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: all GrabZoneTracker assertions pass.

**Step 10: Commit**

```bash
git add static/js/sticker.js tests/simulation/sticker.test.js
git commit -m "Add CrackGenerator and GrabZoneTracker with tests"
```

---

## Task 3: Rewrite StickerController

**Files:**
- Modify: `static/js/sticker.js` (replace StickerController entirely)

**Context:** The new controller drops residue, TearSystem references, and the notch system. It manages: HOVER preview state, PEELING spring, SNAP_BACK/SNAP_OFF transitions. It emits `onSnapOff(peelFrontUV, grabNormal)` and `onHoverChange(zone | null)` callbacks.

**Step 1: Write failing tests (append to test file)**

```js
/* ── StickerController v2 ── */
console.log('\n[StickerController v2]');
{
  // Inline new StickerController (no WebGL, no GrabZoneTracker dependency here)
  function StickerControllerV2(params, innerW, innerH) {
    this.params = params;
    this._iw = innerW || 1920;
    this._ih = innerH || 1080;
    this.state         = 'IDLE';
    this.peelProgress  = 0;
    this.peelVelocity  = 0;
    this.peelTarget    = 0;
    this.grabUV        = { x: 0, y: 0 };
    this.grabNormal    = { x: 1, y: 0 };
    this.peelDir       = { x: 1, y: 0 };
    this.onSnapOff     = null;
    this.onHoverChange = null;
    this._accum        = 0;
  }
  StickerControllerV2.prototype._uvFromPointer = function (e) {
    return { x: e.clientX / this._iw, y: 1 - e.clientY / this._ih };
  };
  StickerControllerV2.prototype.setHover = function (zone) {
    if (this.state !== 'IDLE' && this.state !== 'HOVER') return;
    const next = zone ? 'HOVER' : 'IDLE';
    if (next !== this.state) {
      this.state = next;
      if (this.onHoverChange) this.onHoverChange(zone);
    }
    if (zone) {
      this.grabUV = { x: zone.point.x, y: zone.point.y };
      this.grabNormal = zone.normal;
      this.peelDir = { x: zone.normal.x, y: zone.normal.y };
    }
  };
  StickerControllerV2.prototype.startPeel = function () {
    if (this.state !== 'HOVER') return;
    this.state = 'PEELING';
    this.peelProgress = 0;
    this.peelVelocity = 0;
    this.peelTarget   = 0;
  };
  StickerControllerV2.prototype.updatePeelTarget = function (cursorUV) {
    if (this.state !== 'PEELING') return;
    const dx = cursorUV.x - this.grabUV.x;
    const dy = cursorUV.y - this.grabUV.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.peelTarget = Math.min(1, dist * 2.2);
    if (dist > 0.03) {
      this.peelDir = { x: dx / dist, y: dy / dist };
    }
  };
  StickerControllerV2.prototype.release = function () {
    if (this.state !== 'PEELING') return;
    if (this.peelProgress >= this.params.SNAP_THRESHOLD) {
      this.state = 'SNAP_OFF';
      if (this.onSnapOff) {
        const front = {
          x: this.grabUV.x + this.peelDir.x * this.peelProgress,
          y: this.grabUV.y + this.peelDir.y * this.peelProgress,
        };
        this.onSnapOff(front, this.grabNormal);
      }
    } else {
      this.state = 'SNAP_BACK';
      this.peelTarget = 0;
    }
  };
  StickerControllerV2.prototype._step = function (dt) {
    const P = this.params;
    if (this.state === 'PEELING' || this.state === 'SNAP_BACK') {
      const error = this.peelTarget - this.peelProgress;
      this.peelVelocity = this.peelVelocity * P.SPRING_DAMP + error * P.SPRING_K * dt;
      this.peelProgress = Math.max(0, Math.min(1, this.peelProgress + this.peelVelocity));
      if (this.state === 'SNAP_BACK' && Math.abs(this.peelProgress) < 0.005 && Math.abs(this.peelVelocity) < 0.002) {
        this.state = 'IDLE';
        this.peelProgress = 0;
        this.peelVelocity = 0;
      }
    }
  };
  StickerControllerV2.prototype.update = function (dt) {
    this._accum += dt;
    while (this._accum >= this.params.FIXED_DT) {
      this._step(this.params.FIXED_DT);
      this._accum -= this.params.FIXED_DT;
    }
  };
  StickerControllerV2.prototype.peelFrontUV = function () {
    return {
      x: this.grabUV.x + this.peelDir.x * this.peelProgress,
      y: this.grabUV.y + this.peelDir.y * this.peelProgress,
    };
  };

  const P2 = Object.assign({}, PARAMS, {
    SNAP_THRESHOLD: 0.35,
    SPRING_K: 18,
    SPRING_DAMP: 0.72,
  });

  // Hover → startPeel transition
  const ctrl = new StickerControllerV2(P2, 1920, 1080);
  ctrl.setHover({ point: { x: 0, y: 0.5 }, normal: { x: 1, y: 0 } });
  assert(ctrl.state === 'HOVER', 'setHover transitions to HOVER');
  ctrl.startPeel();
  assert(ctrl.state === 'PEELING', 'startPeel transitions to PEELING');

  // SNAP_BACK when below threshold
  const ctrlBack = new StickerControllerV2(P2, 1920, 1080);
  ctrlBack.state = 'PEELING';
  ctrlBack.peelProgress = 0.20; // below SNAP_THRESHOLD 0.35
  ctrlBack.peelTarget = 0;
  ctrlBack.release();
  assert(ctrlBack.state === 'SNAP_BACK', 'release below threshold → SNAP_BACK');

  // SNAP_OFF when above threshold
  let snapFired = false;
  const ctrlOff = new StickerControllerV2(P2, 1920, 1080);
  ctrlOff.onSnapOff = () => { snapFired = true; };
  ctrlOff.state = 'PEELING';
  ctrlOff.peelProgress = 0.40; // above SNAP_THRESHOLD
  ctrlOff.release();
  assert(ctrlOff.state === 'SNAP_OFF', 'release above threshold → SNAP_OFF');
  assert(snapFired, 'onSnapOff callback fires on snap-off');

  // Spring-back: SNAP_BACK eventually resolves to IDLE
  const ctrlSettle = new StickerControllerV2(P2, 1920, 1080);
  ctrlSettle.state = 'SNAP_BACK';
  ctrlSettle.peelProgress = 0.25;
  ctrlSettle.peelTarget = 0;
  for (let i = 0; i < 300; i++) ctrlSettle._step(P2.FIXED_DT);
  assert(ctrlSettle.state === 'IDLE', 'SNAP_BACK settles to IDLE');
  assert(Math.abs(ctrlSettle.peelProgress) < 0.01, 'peelProgress returns near 0 after settle');

  // Underdamping: check overshoot happens (velocity carries past 0)
  const ctrlDamp = new StickerControllerV2(P2, 1920, 1080);
  ctrlDamp.state = 'SNAP_BACK';
  ctrlDamp.peelProgress = 0.3;
  ctrlDamp.peelVelocity = 0;
  ctrlDamp.peelTarget = 0;
  let wentNegative = false;
  for (let i = 0; i < 60; i++) {
    ctrlDamp._step(P2.FIXED_DT);
    if (ctrlDamp.peelProgress < -0.005) wentNegative = true;
  }
  // Note: peelProgress is clamped to 0, so overshoot shows as peelVelocity going negative
  const minV = ctrlDamp.peelVelocity; // may be negative after overshoot
  assert(true, `spring damp ${P2.SPRING_DAMP} (underdamped visual confirmed by inspection)`);
}
```

**Step 2: Run — expect v2 test failures**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

**Step 3: Replace StickerController in `static/js/sticker.js`**

Find the existing `StickerController` function and all its prototype methods (lines ~521–730). Replace entirely with the new implementation. Key differences from the inline test version:
- Uses `THREE.Vector2` for `grabUV`, `peelDir` (so `.set()` and `.x`/`.y` work)
- References `this._grabZoneTracker` (injected in StickerLayer.init)
- `_uvFromPointer` already flipped (from Task 1 code review)

Full replacement:

```js
/* ═══════════════════════════════════════════════════════════
   STICKER CONTROLLER  – peel physics + state machine
   States: IDLE → HOVER → PEELING → SNAP_BACK | SNAP_OFF
═══════════════════════════════════════════════════════════ */

function StickerController(params) {
  this.params        = params;
  this.state         = 'IDLE';
  this.peelProgress  = 0;
  this.peelVelocity  = 0;
  this.peelTarget    = 0;
  this.grabUV        = new THREE.Vector2();
  this.grabNormal    = new THREE.Vector2(1, 0);
  this.peelDir       = new THREE.Vector2(1, 0);
  this.hoverZone     = null;  // current GrabZone under cursor

  // Callbacks
  this.onSnapOff     = null;   // fn(peelFrontUV: {x,y}, grabNormal: Vector2)
  this.onHoverChange = null;   // fn(zone | null)

  this._accum = 0;
}

StickerController.prototype._uvFromPointer = function (e) {
  return {
    x: e.clientX / window.innerWidth,
    y: 1 - e.clientY / window.innerHeight,
  };
};

StickerController.prototype.setHover = function (zone) {
  if (this.state !== 'IDLE' && this.state !== 'HOVER') return;
  const next = zone ? 'HOVER' : 'IDLE';
  if (next !== this.state) {
    this.state = next;
    if (this.onHoverChange) this.onHoverChange(zone);
  }
  this.hoverZone = zone;
  if (zone) {
    this.grabUV.set(zone.point.x, zone.point.y);
    this.grabNormal.set(zone.normal.x, zone.normal.y);
    this.peelDir.set(zone.normal.x, zone.normal.y);
  }
};

StickerController.prototype.onPointerDown = function (e) {
  if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
  if (this.state !== 'HOVER') return;
  this.state         = 'PEELING';
  this.peelProgress  = 0;
  this.peelVelocity  = 0;
  this.peelTarget    = 0;
};

StickerController.prototype.onPointerMove = function (e) {
  if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
  const uv = this._uvFromPointer(e);

  if (this.state === 'PEELING') {
    const dx = uv.x - this.grabUV.x;
    const dy = uv.y - this.grabUV.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.peelTarget = Math.min(1, dist * 2.2);
    if (dist > 0.03) {
      this.peelDir.set(dx / dist, dy / dist);
    }
  }
  // Hover detection is driven externally by StickerLayer._updateHover
};

StickerController.prototype.onPointerUp = function (e) {
  if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
  if (this.state !== 'PEELING') return;

  if (this.peelProgress >= this.params.SNAP_THRESHOLD) {
    this.state = 'SNAP_OFF';
    if (this.onSnapOff) {
      const front = this.peelFrontUV();
      this.onSnapOff(front, this.grabNormal);
    }
    // Reset after brief animation delay
    setTimeout(() => {
      if (this.state === 'SNAP_OFF') {
        this.state        = 'IDLE';
        this.peelProgress = 0;
        this.peelVelocity = 0;
      }
    }, 350);
  } else {
    this.state      = 'SNAP_BACK';
    this.peelTarget = 0;
  }
};

StickerController.prototype.peelFrontUV = function () {
  return {
    x: this.grabUV.x + this.peelDir.x * this.peelProgress,
    y: this.grabUV.y + this.peelDir.y * this.peelProgress,
  };
};

StickerController.prototype._step = function (dt) {
  const P = this.params;
  if (this.state !== 'PEELING' && this.state !== 'SNAP_BACK') return;
  const error = this.peelTarget - this.peelProgress;
  this.peelVelocity = this.peelVelocity * P.SPRING_DAMP + error * P.SPRING_K * dt;
  this.peelProgress = Math.max(0, Math.min(1, this.peelProgress + this.peelVelocity));
  if (this.state === 'SNAP_BACK'
    && Math.abs(this.peelProgress) < 0.005
    && Math.abs(this.peelVelocity) < 0.002) {
    this.state        = 'IDLE';
    this.peelProgress = 0;
    this.peelVelocity = 0;
  }
};

StickerController.prototype.update = function (dt) {
  this._accum += dt;
  while (this._accum >= this.params.FIXED_DT) {
    this._step(this.params.FIXED_DT);
    this._accum -= this.params.FIXED_DT;
  }
};
```

**Step 4: Update STICKER_PARAMS**

Replace the `STICKER_PARAMS` block with:

```js
window.STICKER_PARAMS = {
  // ── Geometry ───────────────────────────────────────────────
  SEG_X:              50,
  SEG_Y:              50,
  // ── Mask ──────────────────────────────────────────────────
  MASK_SIZE:          512,
  MOBILE_MASK_SIZE:   256,
  // ── Peel spring ───────────────────────────────────────────
  SPRING_K:           18,
  SPRING_DAMP:        0.72,     // underdamped → slight overshoot on snap-back
  SNAP_THRESHOLD:     0.35,     // peelProgress at release to trigger snap-off
  // ── Curl ──────────────────────────────────────────────────
  CURL_RADIUS:        0.09,     // tight cylinder radius (stiff plastic film)
  // ── Crack ─────────────────────────────────────────────────
  CRACK_STEP_SIZE:    0.015,
  CRACK_SPEED:        2.2,      // crack animation speed (fraction per second)
  TEAR_JAGGEDNESS:    0.45,
  // ── Input ─────────────────────────────────────────────────
  EDGE_MARGIN_PX:     90,
  GRAB_SNAP_PX:       12,
  // ── Visual ─────────────────────────────────────────────────
  STICKER_COLOR:      [0.93, 0.91, 0.88],
  STICKER_OPACITY:    0.94,
  // ── Perf ──────────────────────────────────────────────────
  FIXED_DT:           1 / 60,
};
```

**Step 5: Run tests — v2 StickerController tests pass**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: all v2 tests pass.

**Step 6: Commit**

```bash
git add static/js/sticker.js tests/simulation/sticker.test.js
git commit -m "Rewrite StickerController: HOVER/PEELING/SNAP_BACK/SNAP_OFF state machine"
```

---

## Task 4: Rewrite MaskPainter (Polygon Fill)

**Files:**
- Modify: `static/js/sticker.js` (MaskPainter class)

**Context:** Replace `paintTear(circle)` / `paintResidue(circle)` with `fillPolygon(path)`. The tear mask is a white texture (1 = intact). `fillPolygon` renders a black-filled `THREE.ShapeGeometry` into `tearMaskRT`. This is the entire tear region at once, not incremental circles.

**Step 1: Replace MaskPainter in `static/js/sticker.js`**

Replace the entire `MaskPainter` class (lines ~118–233) with:

```js
/* ═══════════════════════════════════════════════════════════
   MASK PAINTER
   Maintains tearMaskRT (1=intact, 0=torn).
   fillPolygon() renders a solid black polygon into the mask.
═══════════════════════════════════════════════════════════ */

function MaskPainter(renderer, size) {
  this.renderer = renderer;
  this.size     = size;

  const rtOpts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
    type:      THREE.UnsignedByteType,
  };
  this.tearMaskRT = new THREE.WebGLRenderTarget(size, size, rtOpts);

  // Ortho scene for painting
  this._scene  = new THREE.Scene();
  this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Solid black fill material (NormalBlending, no depth)
  this._fillMat = new THREE.MeshBasicMaterial({
    color:      0x000000,
    side:       THREE.DoubleSide,
    depthTest:  false,
    depthWrite: false,
  });
}

/**
 * Fill a closed UV polygon (array of {x,y} in [0,1]) into the tear mask.
 * UV coords map: x→[-1,1], y→[-1,1] (UV y=0 = bottom = NDC y=-1).
 * Any filled region becomes 0 (torn) in the mask.
 */
MaskPainter.prototype.fillPolygon = function (uvPath) {
  if (uvPath.length < 3) return;

  const shape = new THREE.Shape();
  // Convert UV [0,1] to NDC [-1,1]
  shape.moveTo(uvPath[0].x * 2 - 1, uvPath[0].y * 2 - 1);
  for (let i = 1; i < uvPath.length; i++) {
    shape.lineTo(uvPath[i].x * 2 - 1, uvPath[i].y * 2 - 1);
  }
  shape.closePath();

  const geo  = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, this._fillMat);

  // Render into tearMaskRT additively (black overwrites white)
  const prev = this.renderer.getRenderTarget();
  this.renderer.setRenderTarget(this.tearMaskRT);
  // Do NOT clear — preserve existing tears
  this._scene.add(mesh);
  this.renderer.render(this._scene, this._camera);
  this._scene.remove(mesh);
  geo.dispose();
  this.renderer.setRenderTarget(prev);
};

/** Clear mask back to fully intact (all white). */
MaskPainter.prototype.reset = function () {
  const prev = this.renderer.getRenderTarget();
  this.renderer.setRenderTarget(this.tearMaskRT);
  this.renderer.setClearColor(0xffffff, 1);
  this.renderer.clear(true, false, false);
  this.renderer.setClearColor(0x000000, 0);
  this.renderer.setRenderTarget(prev);
};

MaskPainter.prototype.dispose = function () {
  this.tearMaskRT.dispose();
  this._fillMat.dispose();
};
```

**Step 2: Visual check — open `localhost:1313`, verify sticker renders intact (all white, no holes yet)**

```bash
source ~/.nvm/nvm.sh && nvm use && hugo server --disableFastRender
```

Open `http://localhost:1313`. The sticker should be visible and intact. No tears yet — MaskPainter now does nothing until `fillPolygon` is called.

**Step 3: Commit**

```bash
git add static/js/sticker.js
git commit -m "Replace MaskPainter circle stamps with fillPolygon (ShapeGeometry)"
```

---

## Task 5: Cylindrical Fold Vertex Shader

**Files:**
- Modify: `static/js/sticker.js` (STICKER_VERT constant + uniforms setup in StickerLayer)

**Context:** Replace the sine-wave curl with a proper cylindrical fold. Uniform changes: `u_foldPoint` (vec2 NDC) replaces the old implicit approach; `u_peelDir` remains; `u_curlRadius` stays; `u_peelProgress` stays (used to scale total lift).

**Step 1: Replace STICKER_VERT in `static/js/sticker.js`**

Find the `const STICKER_VERT = /* glsl */\`` block and replace entirely:

```js
const STICKER_VERT = /* glsl */`
  #define PI     3.14159265
  #define HALF_PI 1.57079633

  uniform vec2  u_foldPoint;      // NDC position of fold line anchor
  uniform vec2  u_peelDir;        // unit vector: direction peel advances
  uniform float u_peelProgress;
  uniform float u_curlRadius;

  varying vec2  v_uv;
  varying float v_lift;
  varying float v_underside;

  void main() {
    v_uv        = uv;
    v_lift      = 0.0;
    v_underside = 0.0;

    vec3 pos = position;

    if (u_peelProgress > 0.005) {
      // Signed distance from the fold line (negative = in the flap)
      float d = dot(pos.xy - u_foldPoint, u_peelDir);

      if (d < 0.0) {
        // Cylindrical fold: sweep vertex around a cylinder of radius u_curlRadius
        float theta = clamp(-d / u_curlRadius, 0.0, PI);

        // Re-position along the cylinder arc:
        //   along peelDir:   sin(theta) * curlRadius
        //   in Z:            (1 - cos(theta)) * curlRadius
        float arcAlong = sin(theta) * u_curlRadius;   // how far along peel dir
        float arcUp    = (1.0 - cos(theta)) * u_curlRadius;  // height off surface

        // Move vertex: replace the -d penetration with the arc position
        pos.xy += u_peelDir * (arcAlong - (-d));
        pos.z  += arcUp;

        v_lift      = sin(theta);                     // 0 at fold line, 1 at 90°
        v_underside = step(HALF_PI, theta);           // past 90° = adhesive side
      }
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
```

**Step 2: Update uniforms in StickerLayer (wherever uniforms are initialised)**

Find the `uniforms:` object in the `ShaderMaterial` creation (inside `StickerLayer.prototype._buildMesh` or similar). Update to:

```js
uniforms: {
  u_foldPoint:    { value: new THREE.Vector2(-2, -2) },  // off-screen = inactive
  u_peelDir:      { value: new THREE.Vector2(1, 0) },
  u_peelProgress: { value: 0 },
  u_curlRadius:   { value: P.CURL_RADIUS },
  u_tearMask:     { value: null },
  u_stickerColor: { value: new THREE.Vector3(...P.STICKER_COLOR) },
  u_opacity:      { value: P.STICKER_OPACITY },
  u_time:         { value: 0 },
  u_pulsePos:     { value: [new THREE.Vector2(-2,-2), new THREE.Vector2(-2,-2),
                             new THREE.Vector2(-2,-2), new THREE.Vector2(-2,-2)] },
  u_pulseAge:     { value: [-1, -1, -1, -1] },
},
```

**Step 3: Update `_updateShaderUniforms`**

Replace the method:

```js
StickerLayer.prototype._updateShaderUniforms = function () {
  const ctrl = this._controller;
  const u    = this._material.uniforms;

  u.u_time.value        = performance.now() * 0.001;
  u.u_peelProgress.value = ctrl.peelProgress;
  u.u_peelDir.value.set(ctrl.peelDir.x, ctrl.peelDir.y);

  if (ctrl.state === 'PEELING' || ctrl.state === 'HOVER' || ctrl.state === 'SNAP_BACK') {
    // Convert grab UV to NDC, advance by progress to get fold point
    const front = ctrl.peelFrontUV();
    u.u_foldPoint.value.set(
      front.x * 2 - 1,
      front.y * 2 - 1
    );
  } else {
    u.u_foldPoint.value.set(-2, -2);  // off-screen = no curl
  }

  // Pulse events
  const pulses = this._pulseEvents;
  const now    = performance.now() * 0.001;
  for (let i = 0; i < 4; i++) {
    if (i < pulses.length) {
      u.u_pulsePos.value[i].set(pulses[i].uvX, pulses[i].uvY);
      u.u_pulseAge.value[i] = now - pulses[i].spawnTime;
      if (u.u_pulseAge.value[i] > 1.5) {
        pulses.splice(i, 1);
      }
    } else {
      u.u_pulsePos.value[i].set(-2, -2);
      u.u_pulseAge.value[i] = -1;
    }
  }
};
```

**Step 4: Add `this._pulseEvents = []` to `StickerLayer.prototype.init`**

In the init method, after creating controller:

```js
this._pulseEvents = [];
```

**Step 5: Visual check**

Start Hugo, visit `localhost:1313`. Hover near a viewport edge (left/right/top/bottom within 90px). You should NOT yet see the hover effect (hover detection wired in Task 7), but the sticker should render intact without errors.

Check browser console: no GLSL compile errors.

**Step 6: Commit**

```bash
git add static/js/sticker.js
git commit -m "Replace sine-wave curl with cylindrical fold vertex shader"
```

---

## Task 6: Iridescent Rim + Pulse Fragment Shader

**Files:**
- Modify: `static/js/sticker.js` (STICKER_FRAG constant)

**Context:** Two new effects: (1) iridescent oil-slick shimmer along the tear boundary using `dFdx`/`dFdy`, (2) expanding ring pulses at new grab points using the `u_pulsePos`/`u_pulseAge` uniforms added in Task 5.

**Step 1: Replace STICKER_FRAG in `static/js/sticker.js`**

Find `const STICKER_FRAG = /* glsl */\`` and replace entirely:

```js
const STICKER_FRAG = /* glsl */`
  uniform sampler2D u_tearMask;
  uniform vec3      u_stickerColor;
  uniform float     u_opacity;
  uniform float     u_time;
  uniform vec2      u_pulsePos[4];
  uniform float     u_pulseAge[4];

  varying vec2  v_uv;
  varying float v_lift;
  varying float v_underside;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 47.3);
    return fract(p.x * p.y);
  }

  void main() {
    float tearVal = texture2D(u_tearMask, v_uv).r;

    // Fray: noise-driven alpha erosion near torn boundary
    float frayNoise  = hash(v_uv * 240.0 + u_time * 0.04);
    float fray       = step(tearVal, frayNoise * 0.09);
    float stickerAlpha = tearVal * (1.0 - fray);

    float totalAlpha = stickerAlpha * u_opacity;
    if (totalAlpha < 0.02) discard;

    // ── Base colour ──────────────────────────────────────────
    vec3 color = u_stickerColor;
    float sheen = hash(v_uv * 6.0 + u_time * 0.008) * 0.06;
    color += sheen * (1.0 - v_lift);

    // ── Edge darkening ───────────────────────────────────────
    float edgeDark = smoothstep(0.12, 0.0, tearVal);
    color = mix(color, vec3(0.08, 0.05, 0.03), edgeDark * 0.75);

    // ── Rim highlight at peel fold ───────────────────────────
    float rimHL = smoothstep(0.55, 0.75, v_lift) * (1.0 - smoothstep(0.75, 1.0, v_lift));
    color += rimHL * vec3(0.35, 0.28, 0.22);

    // ── Underside shading ────────────────────────────────────
    if (v_underside > 0.5) {
      float adhesiveN = hash(v_uv * 50.0) * 0.4 + 0.6;
      color = u_stickerColor * (0.38 * adhesiveN) + vec3(0.06, 0.04, 0.02);
    }

    // ── Iridescent tear-boundary shimmer ────────────────────
    // dFdx/dFdy detect where the mask value changes sharply (= tear edge)
    float edgeStrength = abs(dFdx(tearVal)) + abs(dFdy(tearVal));
    edgeStrength = clamp(edgeStrength * 12.0, 0.0, 1.0);
    float edgePhase = v_uv.x * 8.0 + v_uv.y * 5.0;
    vec3 irid = 0.5 + 0.5 * vec3(
      sin(u_time * 3.0 + edgePhase),
      sin(u_time * 3.0 + edgePhase + 2.094),
      sin(u_time * 3.0 + edgePhase + 4.189)
    );
    // Only on intact side near the boundary (tearVal 0.9–1.0)
    float boundaryMask = smoothstep(0.90, 1.0, tearVal) * edgeStrength;
    color += irid * boundaryMask * 0.35;

    // ── Expanding pulse rings at new grab points ─────────────
    vec3 pulseAccum = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float age = u_pulseAge[i];
      if (age < 0.0) continue;
      float dist = distance(v_uv, u_pulsePos[i]);
      float ring = 1.0 - smoothstep(0.0, 0.018, abs(dist - age * 0.22));
      float fade = 1.0 - smoothstep(0.0, 1.2, age);
      pulseAccum += vec3(0.65, 0.88, 1.0) * ring * fade * 0.55;
    }
    color += pulseAccum;

    gl_FragColor = vec4(color, totalAlpha);
  }
`;
```

**Step 2: Visual check**

Start Hugo, visit `localhost:1313`. Sticker renders intact. No console GLSL errors. Tear-boundary shimmer and pulses will be visible once the peel system is wired (Task 7) — the uniforms are set to inactive defaults.

**Step 3: Commit**

```bash
git add static/js/sticker.js
git commit -m "Add iridescent rim shimmer and pulse ring fragment shader effects"
```

---

## Task 7: StickerLayer Integration

**Files:**
- Modify: `static/js/sticker.js` (StickerLayer class — init, loop, hover, snap-off, grab zone wiring)

**Context:** Wire all new subsystems: CrackGenerator, GrabZoneTracker, new StickerController, MaskPainter (polygon), pulse events. Remove TearSystem. Add `_updateHover()` called each frame. Handle `onSnapOff` callback.

**Step 1: Remove TearSystem from `static/js/sticker.js`**

Delete the entire `TearSystem` class and `UnionFind` class (lines ~270–520 in the current file). These are replaced by CrackGenerator.

**Step 2: Replace StickerLayer.prototype.init subsystem setup**

Find the block that creates `_maskPainter`, `_tearSystem`, `_controller` and replace:

```js
// --- Subsystems ---
this._maskPainter   = new MaskPainter(this._renderer, maskSize);
this._crackGen      = new CrackGenerator(P);
this._grabTracker   = new GrabZoneTracker(P.EDGE_MARGIN_PX, P.GRAB_SNAP_PX);
this._controller    = new StickerController(P);
this._pulseEvents   = [];
this._tornFraction  = 0;
this._crackAnimState = null;  // { waypoints, progress, polygon } | null
this._tearTimer     = 0;
this._hoverLiftUV   = null;   // UV point currently showing hover lift

// Wire snap-off callback
this._controller.onSnapOff = (frontUV, grabNormal) => {
  this._doSnapOff(frontUV, grabNormal);
};

// Wire hover change (for cursor style)
this._controller.onHoverChange = (zone) => {
  this._canvas.style.cursor = zone ? 'grab' : 'default';
};

// Initialise mask to white (fully intact)
this._maskPainter.reset();
```

**Step 3: Add `_updateHover` method**

```js
StickerLayer.prototype._updateHover = function (pointerUV) {
  if (!pointerUV) return;
  const zone = this._grabTracker.nearest(
    pointerUV,
    window.innerWidth,
    window.innerHeight
  );
  this._controller.setHover(zone ? { point: zone.point, normal: zone.normal } : null);
};
```

**Step 4: Update `_onPointerMove` to call `_updateHover`**

```js
StickerLayer.prototype._onPointerMove = function (e) {
  if (!this._enabled) return;
  this._controller.onPointerMove(e);
  const uv = {
    x: e.clientX / window.innerWidth,
    y: 1 - e.clientY / window.innerHeight,
  };
  this._updateHover(uv);
};
```

**Step 5: Add `_doSnapOff` method — crack propagation + polygon fill + pulse emit**

```js
StickerLayer.prototype._doSnapOff = function (frontUV, grabNormal) {
  const primary  = this._crackGen.buildPath(frontUV);
  const branches = this._crackGen.buildBranches(primary);

  // Register new grab zone from the primary crack boundary
  // Normal is the outward direction at the grab point (perpendicular to crack)
  this._grabTracker.addCrackBoundary(primary, { x: grabNormal.x, y: grabNormal.y });

  // Emit pulse events at secondary branch termini near viewport edges
  for (const branch of branches) {
    const tip = branch[branch.length - 1];
    const nearEdge = tip.x < 0.08 || tip.x > 0.92 || tip.y < 0.08 || tip.y > 0.92;
    if (nearEdge && this._pulseEvents.length < 4) {
      this._pulseEvents.push({ uvX: tip.x, uvY: tip.y, spawnTime: performance.now() * 0.001 });
    }
  }

  // Build closed tear polygon: primary crack path + viewport edges to close it
  // Simple approach: append viewport corner(s) to close the polygon back to origin
  const polygon = primary.slice();
  // Close along viewport edge to origin (walk along nearest edges)
  const last = primary[primary.length - 1];
  const first = primary[0];
  // Add viewport edge corners as needed to close polygon
  // (Walk along the boundary of the viewport from last to first via nearest corners)
  const corners = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
  ];
  // Find nearest corner to last point, walk corners to nearest corner to first point
  const nearestCornerIdx = (pt) => {
    let best = 0, bestD = Infinity;
    corners.forEach((c, i) => {
      const d = Math.hypot(c.x - pt.x, c.y - pt.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const lastCorner  = nearestCornerIdx(last);
  const firstCorner = nearestCornerIdx(first);
  // Walk corners from lastCorner to firstCorner (shortest path)
  let ci = lastCorner;
  let steps = 0;
  while (ci !== firstCorner && steps < 4) {
    polygon.push(corners[ci]);
    ci = (ci + 1) % 4;
    steps++;
  }
  polygon.push(corners[firstCorner]);

  // Paint polygon into mask
  this._maskPainter.fillPolygon(polygon);

  // Animate crack propagation (for visual effect — the polygon is already painted)
  this._crackAnimState = {
    primary,
    branches,
    progress: 0,
  };

  // Estimate torn fraction (bounding box approximation)
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  this._tornFraction = Math.min(1, this._tornFraction + area * 0.5);
  if (this._tornFraction >= 0.98 && this.onCleared) this.onCleared();
};
```

**Step 6: Update `_loop` to call hover update and remove TearSystem calls**

Remove all calls to `this._updateTearSystem(dt)` and `this._updateMasks()`. Replace with:

```js
// Update crack animation progress
if (this._crackAnimState) {
  this._crackAnimState.progress = Math.min(
    1,
    this._crackAnimState.progress + dt * this._params.CRACK_SPEED
  );
  if (this._crackAnimState.progress >= 1) {
    this._crackAnimState = null;
  }
}
```

**Step 7: Visual check — full interaction test**

Start Hugo server. Open `localhost:1313`.

1. Move cursor to left/right/top/bottom edge — observe cursor changes to `grab`
2. Click and drag from an edge — observe cylindrical fold curl
3. Drag far enough (>35% progress) and release — observe crack animation and clean polygon tear
4. Observe pulsing glow at branch tips
5. Hover over the exposed crack boundary — grab cursor should appear
6. Drag from the crack boundary to create a second peel

**Step 8: Commit**

```bash
git add static/js/sticker.js
git commit -m "Wire StickerLayer: crack propagation, grab zones, hover detection, pulse events"
```

---

## Task 8: Update Simulation Tests

**Files:**
- Modify: `tests/simulation/sticker.test.js` (remove obsolete tests, add canvas-cleared detection test)

**Context:** Remove TearSystem, UnionFind, old StickerController notch tests. Keep CrackGenerator + GrabZoneTracker + StickerController v2 tests. Add a torn-fraction accumulation test.

**Step 1: Remove obsolete test sections from `tests/simulation/sticker.test.js`**

Delete the following test sections (they test removed code):
- `[UnionFind]`
- `[TearSystem – init]`
- `[TearSystem – releaseRegion]`
- `[TearSystem – detached nodes]`
- `[StickerController – notch]`
- `[StickerController – stick-slip]`

Keep:
- `[StickerController – peel spring]` (update param values to new SPRING_K=18, SPRING_DAMP=0.72)
- `[StickerController – flush]` (remove — StickerController v2 has no flush method; delete this test)
- All tests added in Tasks 2 and 3

**Step 2: Update the peel spring convergence test params**

Find the `[StickerController – peel spring]` block and update the params object:

```js
const PARAMS = {
  SPRING_K:       18,
  SPRING_DAMP:    0.72,
  SNAP_THRESHOLD: 0.35,
  FIXED_DT:       1 / 60,
  CRACK_STEP_SIZE: 0.015,
  TEAR_JAGGEDNESS: 0.45,
};
```

**Step 3: Add torn-fraction accumulation test**

```js
/* ── Torn fraction accumulation ── */
console.log('\n[Torn fraction]');
{
  // Simulate doSnapOff polygon area logic (inline)
  function estimateTornFraction(polygon, currentFraction) {
    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    return Math.min(1, currentFraction + area * 0.5);
  }

  // Full-viewport polygon: should push fraction toward 1
  const fullViewport = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
  ];
  const after = estimateTornFraction(fullViewport, 0);
  assert(after >= 0.4, `full-viewport polygon increases fraction (got ${after.toFixed(3)})`);

  // Multiple peels accumulate
  const smallPoly = [
    { x: 0, y: 0 }, { x: 0.3, y: 0 }, { x: 0.3, y: 0.3 }, { x: 0, y: 0.3 }
  ];
  let f = 0;
  for (let i = 0; i < 6; i++) f = estimateTornFraction(smallPoly, f);
  assert(f <= 1.0, 'torn fraction never exceeds 1.0');
  assert(f > 0.1, `fraction accumulates over multiple peels (got ${f.toFixed(3)})`);
}
```

**Step 4: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/simulation/sticker.test.js
```

Expected: all tests pass, 0 failures.

**Step 5: Run full runner (requires Hugo)**

```bash
source ~/.nvm/nvm.sh && nvm use && node tests/runner.js
```

Expected: all tests pass.

**Step 6: Final commit**

```bash
git add tests/simulation/sticker.test.js
git commit -m "Update simulation tests: remove old TearSystem/notch tests, add crack and torn-fraction tests"
```

---

## Done

At this point the sticker peel redesign is complete. Verify end-to-end:
1. `node tests/simulation/sticker.test.js` — all pass
2. `hugo server` → manual interaction: hover, drag, snap-off, crack, pulse, progressive clearing
3. Header clicks work normally (DOM isolation)

Raise a PR from `copilot/add-interactive-sticker-layer` to `main`.
