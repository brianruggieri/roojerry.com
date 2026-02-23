/**
 * sticker.js — Interactive screen-protector / sticker layer
 *
 * Architecture
 * ─────────────
 * Renders a full-screen "sticker" plane via Three.js (WebGL) in a dedicated
 * canvas that sits above the Canvas-2D particle simulation (#bg-field) and
 * below the DOM content (z-index hierarchy: bg-field -1 → sticker 0 → DOM 1).
 *
 * Internal classes
 *   MaskPainter       – maintains tearMaskRT and residueMaskRT WebGL render
 *                       targets; paints circular stamps into them without
 *                       CPU↔GPU readbacks.
 *   UnionFind         – fast path-compressed union-find used by TearSystem.
 *   TearSystem        – NxM constraint lattice (Verlet integration); breaks
 *                       spring constraints when strain exceeds local toughness;
 *                       outputs detached-node UVs for mask painting.
 *   StickerController – pointer event state machine (IDLE →
 *                       GRABBED → TEARING); spring-damper peel physics with
 *                       stick-slip stick.
 *   StickerLayer      – facade: creates Three.js renderer/scene/camera/mesh
 *                       with custom ShaderMaterial; orchestrates all subsystems
 *                       inside a single rAF loop.
 *
 * Tunable knobs
 *   window.STICKER_PARAMS  – see PARAMS section below; change at runtime.
 *
 * Enable / disable
 *   window.STICKER_LAYER.enable()   – show & activate
 *   window.STICKER_LAYER.disable()  – hide (particles still run behind it)
 *   window.STICKER_LAYER.reset()    – restore intact sticker
 *
 * Requires: Three.js r160 (loaded via ES module import).
 */

import * as THREE from 'three';

(() => {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     PARAMS  (developer-facing tuning knobs)
  ═══════════════════════════════════════════════════════════ */
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

    // Render into tearMaskRT (black overwrites white = torn region grows)
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
    this._scene.clear();
    this.tearMaskRT.dispose();
    this._fillMat.dispose();
  };

  /* ═══════════════════════════════════════════════════════════
     UNION-FIND  (path-compressed, rank-union)
  ═══════════════════════════════════════════════════════════ */

  function UnionFind(n) {
    this.parent = new Int32Array(n);
    this.rank   = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }

  UnionFind.prototype.find = function (x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]; // path halving
      x = this.parent[x];
    }
    return x;
  };

  UnionFind.prototype.union = function (a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return;
    if (this.rank[a] < this.rank[b]) { const t = a; a = b; b = t; }
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a]++;
  };

  /* ═══════════════════════════════════════════════════════════
     TEAR SYSTEM  – constraint lattice
  ═══════════════════════════════════════════════════════════ */

  /**
   * @param {number} lw  Lattice width (nodes)
   * @param {number} lh  Lattice height (nodes)
   * @param {object} params  STICKER_PARAMS
   */
  function TearSystem(lw, lh, params) {
    this.lw = lw;
    this.lh = lh;
    this.params = params;
    this.nodeCount = lw * lh;

    // Node positions (UV space 0–1)
    this.px   = new Float32Array(this.nodeCount);
    this.py   = new Float32Array(this.nodeCount);
    // Previous positions (Verlet)
    this.ppx  = new Float32Array(this.nodeCount);
    this.ppy  = new Float32Array(this.nodeCount);
    // 1 = pinned (adhered to surface), 0 = free
    this.pinned = new Uint8Array(this.nodeCount);

    // Per-node toughness (derived from procedural noise)
    this.toughness = new Float32Array(this.nodeCount);

    // Constraint arrays
    const maxC = lw * lh * 4;
    this.conA      = new Int32Array(maxC);
    this.conB      = new Int32Array(maxC);
    this.conRest   = new Float32Array(maxC);
    this.conBroken = new Uint8Array(maxC);
    this.conCount  = 0;

    this.uf = null;

    // Grab state
    this.grabNode    = -1;
    this.grabTargetX = 0;
    this.grabTargetY = 0;

    this._init();
  }

  /** Simple deterministic 2-D hash → [0,1] */
  TearSystem.prototype._noise = function (x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  TearSystem.prototype._addConstraint = function (a, b, rest) {
    const c = this.conCount++;
    this.conA[c]    = a;
    this.conB[c]    = b;
    this.conRest[c] = rest;
    this.conBroken[c] = 0;
  };

  TearSystem.prototype._init = function () {
    const lw = this.lw, lh = this.lh;
    const restH = 1 / (lw - 1);
    const restV = 1 / (lh - 1);
    const restD = Math.hypot(restH, restV);

    for (let j = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++) {
        const idx = j * lw + i;
        this.px[idx]  = i / (lw - 1);
        this.py[idx]  = j / (lh - 1);
        this.ppx[idx] = this.px[idx];
        this.ppy[idx] = this.py[idx];
        this.pinned[idx] = 1;

        // Procedural toughness: base + noise + anisotropic fibre variation
        const n1 = this._noise(i * 0.31 + 3.7, j * 0.29 + 8.1);
        const n2 = this._noise(i * 0.19 + 11.3, j * 0.37 + 2.9);
        // Horizontal fibres slightly stronger (toughness anisotropy)
        const fibre = Math.abs(Math.sin(j * 0.22)) * 0.15;
        this.toughness[idx] =
          this.params.TEAR_TOUGHNESS_BASE +
          (n1 - 0.5) * this.params.TEAR_JAGGEDNESS +
          (n2 - 0.5) * this.params.TEAR_JAGGEDNESS * 0.4 +
          fibre;

        // Horizontal constraint
        if (i + 1 < lw) this._addConstraint(idx, idx + 1, restH);
        // Vertical constraint
        if (j + 1 < lh) this._addConstraint(idx, idx + lw, restV);
        // Diagonal (shear)
        if (i + 1 < lw && j + 1 < lh) this._addConstraint(idx, idx + lw + 1, restD);
      }
    }

    this._rebuildUF();
  };

  TearSystem.prototype._rebuildUF = function () {
    this.uf = new UnionFind(this.nodeCount);
    for (let c = 0; c < this.conCount; c++) {
      if (!this.conBroken[c]) {
        this.uf.union(this.conA[c], this.conB[c]);
      }
    }
  };

  /** Return the set of component-root IDs that contain at least one pinned node. */
  TearSystem.prototype._pinnedRoots = function () {
    const roots = new Set();
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) roots.add(this.uf.find(i));
    }
    return roots;
  };

  /** Unpin nodes within a UV-space circle (simulate peel front lifting sticker). */
  TearSystem.prototype.releaseRegion = function (uvX, uvY, radius) {
    const ic = Math.round(uvX * (this.lw - 1));
    const jc = Math.round(uvY * (this.lh - 1));
    const ir = Math.ceil(radius * (this.lw - 1)) + 1;
    const jr = Math.ceil(radius * (this.lh - 1)) + 1;

    for (let dj = -jr; dj <= jr; dj++) {
      for (let di = -ir; di <= ir; di++) {
        const ni = ic + di, nj = jc + dj;
        if (ni < 0 || ni >= this.lw || nj < 0 || nj >= this.lh) continue;
        const fx = di / (ir || 1), fy = dj / (jr || 1);
        if (fx * fx + fy * fy <= 1.0) {
          this.pinned[nj * this.lw + ni] = 0;
        }
      }
    }
  };

  /** Nearest lattice node to a UV coordinate. */
  TearSystem.prototype.nodeAt = function (uvX, uvY) {
    const i = Math.max(0, Math.min(this.lw - 1, Math.round(uvX * (this.lw - 1))));
    const j = Math.max(0, Math.min(this.lh - 1, Math.round(uvY * (this.lh - 1))));
    return j * this.lw + i;
  };

  /** Single physics step (called at fixed 60 Hz). */
  TearSystem.prototype.update = function (dt) {
    if (this.grabNode < 0) return;

    // --- Verlet integration (free nodes only) ---
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.pinned[i]) continue;
      const vx = (this.px[i] - this.ppx[i]) * 0.97; // damping
      const vy = (this.py[i] - this.ppy[i]) * 0.97;
      this.ppx[i] = this.px[i];
      this.ppy[i] = this.py[i];
      this.px[i] += vx;
      this.py[i] += vy;
    }

    // --- Apply grab force ---
    const gn = this.grabNode;
    if (gn >= 0 && !this.pinned[gn]) {
      this.px[gn] += (this.grabTargetX - this.px[gn]) * 0.35;
      this.py[gn] += (this.grabTargetY - this.py[gn]) * 0.35;
    }

    // --- Constraint satisfaction + breakage ---
    for (let iter = 0; iter < this.params.CONSTRAINT_ITERS; iter++) {
      for (let c = 0; c < this.conCount; c++) {
        if (this.conBroken[c]) continue;

        const a = this.conA[c], b = this.conB[c];
        const dx = this.px[b] - this.px[a];
        const dy = this.py[b] - this.py[a];
        const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const rest = this.conRest[c];
        const strain = dist / rest;
        const localTough = (this.toughness[a] + this.toughness[b]) * 0.5;

        if (strain > localTough) {
          this.conBroken[c] = 1;
          continue;
        }

        // Position correction (split equally unless pinned)
        const corr = (dist - rest) / dist * 0.5;
        const cx = dx * corr, cy = dy * corr;
        if (!this.pinned[a]) { this.px[a] += cx; this.py[a] += cy; }
        if (!this.pinned[b]) { this.px[b] -= cx; this.py[b] -= cy; }
      }
    }
  };

  /**
   * Return UV positions of nodes detached from the anchored sticker body.
   * Called once per few frames to drive mask painting.
   */
  TearSystem.prototype.getDetachedUVs = function () {
    this._rebuildUF();
    const pinnedRoots = this._pinnedRoots();
    const uvs = [];
    for (let i = 0; i < this.nodeCount; i++) {
      if (!pinnedRoots.has(this.uf.find(i))) {
        uvs.push(this.px[i], this.py[i]); // flat pairs
      }
    }
    return uvs;
  };

  TearSystem.prototype.reset = function () {
    for (let i = 0; i < this.nodeCount; i++) {
      this.px[i]  = (i % this.lw) / (this.lw - 1);
      this.py[i]  = Math.floor(i / this.lw) / (this.lh - 1);
      this.ppx[i] = this.px[i];
      this.ppy[i] = this.py[i];
      this.pinned[i] = 1;
    }
    for (let c = 0; c < this.conCount; c++) this.conBroken[c] = 0;
    this.grabNode = -1;
    this._rebuildUF();
  };

  /* ═══════════════════════════════════════════════════════════
     STICKER CONTROLLER  – pointer + peel physics + notch system
  ═══════════════════════════════════════════════════════════ */

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
    this.hoverZone     = null;

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

  /* ═══════════════════════════════════════════════════════════
     SHADERS
  ═══════════════════════════════════════════════════════════ */

  const STICKER_VERT = /* glsl */`
    uniform vec2  u_peelCenter;
    uniform vec2  u_peelDir;
    uniform float u_peelProgress;
    uniform float u_curlRadius;

    varying vec2  v_uv;
    varying float v_lift;
    varying float v_underside;

    void main() {
      v_uv = uv;
      v_lift      = 0.0;
      v_underside = 0.0;

      vec3 pos = position;

      if (u_peelProgress > 0.01) {
        // Project vertex position onto peel direction
        vec2 fromCenter  = pos.xy - u_peelCenter;
        float projAlong  = dot(fromCenter, u_peelDir);
        // Peel front advances along peelDir; clip-space goes -1..1
        float frontDist  = u_peelProgress * 1.8 - projAlong;
        float liftZone   = u_curlRadius * 2.2;
        float lift       = clamp(1.0 - abs(frontDist) / liftZone, 0.0, 1.0);

        // Only the peeled (behind-front) side lifts
        lift *= step(projAlong, u_peelProgress * 1.8);
        lift *= u_peelProgress;
        v_lift = lift;

        // Curl in Z
        float angle = lift * 2.5;
        pos.z += sin(angle) * u_curlRadius * u_peelProgress * 0.6;

        // Mark underside when angle past ~PI
        v_underside = step(2.2, angle);
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const STICKER_FRAG = /* glsl */`
    uniform sampler2D u_tearMask;
    uniform sampler2D u_residueMask;
    uniform vec3  u_stickerColor;
    uniform float u_opacity;
    uniform float u_time;

    varying vec2  v_uv;
    varying float v_lift;
    varying float v_underside;

    // Fast 2-D hash
    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 47.3);
      return fract(p.x * p.y);
    }

    void main() {
      float tearVal   = texture2D(u_tearMask,    v_uv).r;
      float residueVal = texture2D(u_residueMask, v_uv).r;

      // --- Torn-edge fray (noise-driven alpha erosion near boundary) ---
      float frayNoise  = hash(v_uv * 240.0 + u_time * 0.04);
      float fray       = step(tearVal, frayNoise * 0.09);
      float stickerAlpha = tearVal * (1.0 - fray);

      // --- Residue alpha (visible where sticker is removed) ---
      float residueAlpha = (1.0 - tearVal) * residueVal * 0.55;

      float totalAlpha = stickerAlpha + residueAlpha;
      totalAlpha *= u_opacity;

      if (totalAlpha < 0.02) discard;

      // --- Base sticker colour ---
      vec3 color = u_stickerColor;

      // Slight procedural plastic noise
      float sheen = hash(v_uv * 6.0 + u_time * 0.008) * 0.06;
      color += sheen * (1.0 - v_lift);

      // Edge darkening near tears
      float edgeDark = smoothstep(0.12, 0.0, tearVal);
      color = mix(color, vec3(0.08, 0.05, 0.03), edgeDark * 0.75);

      // Rim highlight at peel edge
      float rimHL = smoothstep(0.55, 0.75, v_lift) * (1.0 - smoothstep(0.75, 1.0, v_lift));
      color += rimHL * vec3(0.35, 0.28, 0.22);

      // Underside shading (adhesive-side visible during curl)
      if (v_underside > 0.5) {
        float adhesiveN = hash(v_uv * 50.0) * 0.4 + 0.6;
        color = u_stickerColor * (0.38 * adhesiveN) + vec3(0.06, 0.04, 0.02);
      }

      // Residue colour (warm amber tint on background)
      vec3 residueColor = vec3(0.72, 0.65, 0.50);
      float blendT = stickerAlpha / (totalAlpha + 0.001);
      color = mix(residueColor, color, blendT);

      gl_FragColor = vec4(color, totalAlpha);
    }
  `;

  /* ═══════════════════════════════════════════════════════════
     STICKER LAYER  – façade / main object
  ═══════════════════════════════════════════════════════════ */

  function StickerLayer() {
    this._params     = null;
    this._canvas     = null;
    this._renderer   = null;
    this._scene      = null;
    this._camera     = null;
    this._mesh       = null;
    this._material   = null;
    this._maskPainter = null;
    this._tearSystem  = null;
    this._controller  = null;

    this._running      = false;
    this._enabled      = true;
    this._lastTime     = 0;
    this._tearTimer    = 0;  // throttle lattice→mask updates
  }

  StickerLayer.prototype.init = function () {
    this._params = window.STICKER_PARAMS;
    const P = this._params;

    // Feature-based mobile detection (touch + narrow viewport)
    const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 1) &&
                     window.innerWidth < 768;

    const maskSize = isMobile ? P.MOBILE_MASK_SIZE  : P.MASK_SIZE;
    const lw = Math.max(8, isMobile ? Math.round(P.LATTICE_W * P.MOBILE_LATTICE_SCALE) : P.LATTICE_W);
    const lh = Math.max(8, isMobile ? Math.round(P.LATTICE_H * P.MOBILE_LATTICE_SCALE) : P.LATTICE_H);

    // --- Canvas ---
    this._canvas = document.createElement('canvas');
    this._canvas.id = 'sticker-canvas';
    this._canvas.setAttribute('aria-hidden', 'true');
    this._canvas.setAttribute('role', 'presentation');
    document.body.insertBefore(this._canvas, document.body.firstChild);

    // --- Renderer ---
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(window.innerWidth, window.innerHeight, true);
    this._renderer.setClearColor(0x000000, 0);

    // --- Scene + camera ---
    this._scene  = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this._camera.position.z = 1;

    // --- Subsystems ---
    this._maskPainter = new MaskPainter(this._renderer, maskSize);
    this._tearSystem  = new TearSystem(lw, lh, P);
    this._controller  = new StickerController(P);

    // --- Mesh ---
    this._buildMesh();

    // --- Events ---
    window.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup',   this._onPointerUp.bind(this));
    window.addEventListener('resize',      this._onResize.bind(this));

    // --- Start loop ---
    this._running  = true;
    this._lastTime = performance.now();
    this._loop();

    console.log('[sticker] Ready. window.STICKER_LAYER.disable() to hide, .reset() to restore.');
  };

  StickerLayer.prototype._buildMesh = function () {
    const P = this._params;
    const geo = new THREE.PlaneGeometry(2, 2, P.SEG_X, P.SEG_Y);

    this._material = new THREE.ShaderMaterial({
      uniforms: {
        u_tearMask:     { value: this._maskPainter.tearMaskRT.texture },
        // u_residueMask: removed — residueMaskRT no longer exists in MaskPainter
        u_stickerColor: { value: new THREE.Vector3(P.STICKER_COLOR[0], P.STICKER_COLOR[1], P.STICKER_COLOR[2]) },
        u_opacity:      { value: P.STICKER_OPACITY },
        u_time:         { value: 0 },
        u_peelCenter:   { value: new THREE.Vector2(-2, -2) },
        u_peelDir:      { value: new THREE.Vector2(1, 0) },
        u_peelProgress: { value: 0 },
        u_curlRadius:   { value: P.CURL_RADIUS },
      },
      vertexShader:   STICKER_VERT,
      fragmentShader: STICKER_FRAG,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
      side: THREE.DoubleSide,
    });

    this._mesh = new THREE.Mesh(geo, this._material);
    this._mesh.renderOrder = 10;
    this._scene.add(this._mesh);
  };


  StickerLayer.prototype._onPointerDown = function (e) {
    if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
    if (this._enabled) this._controller.onPointerDown(e);
  };
  StickerLayer.prototype._onPointerMove = function (e) {
    if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
    if (this._enabled) this._controller.onPointerMove(e);
  };
  StickerLayer.prototype._onPointerUp = function (e) {
    if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
    if (this._enabled) this._controller.onPointerUp(e);
  };

  StickerLayer.prototype._onResize = function () {
    if (!this._renderer) return;
    this._renderer.setSize(window.innerWidth, window.innerHeight, true);
  };

  StickerLayer.prototype._updateMasks = function () {
    // Body will be implemented in a later task.
  };

  StickerLayer.prototype._updateTearSystem = function (dt) {
    const ctrl = this._controller;
    if (ctrl.state !== 'PEELING') return;

    const f = ctrl.peelFrontUV();
    this._tearSystem.grabNode    = this._tearSystem.nodeAt(ctrl.grabUV.x, ctrl.grabUV.y);
    this._tearSystem.grabTargetX = f.x;
    this._tearSystem.grabTargetY = f.y;

    if (ctrl.peelProgress > 0.04) {
      this._tearSystem.releaseRegion(f.x, f.y, 0.09);
    }

    this._tearSystem.update(dt);

    // Propagate detached lattice nodes to tear mask (throttled to ~10 Hz)
    this._tearTimer += dt;
    if (this._tearTimer > 0.10) {
      this._tearTimer = 0;
      const uvFlat = this._tearSystem.getDetachedUVs();
      for (let i = 0; i < uvFlat.length; i += 2) {
        // this._maskPainter.paintTear(uvFlat[i], uvFlat[i + 1], 0.013); // replaced by fillPolygon
      }
    }
  };

  StickerLayer.prototype._updateShaderUniforms = function () {
    const ctrl = this._controller;
    const u    = this._material.uniforms;

    u.u_time.value        = performance.now() * 0.001;
    u.u_peelProgress.value = ctrl.peelProgress;
    u.u_peelDir.value.set(ctrl.peelDir.x, ctrl.peelDir.y);

    if (ctrl.state === 'PEELING') {
      // Map UV [0,1] → clip-space [-1,1] (no Y flip needed; UV y=0 is already bottom)
      u.u_peelCenter.value.set(
        ctrl.grabUV.x * 2 - 1,
        ctrl.grabUV.y * 2 - 1
      );
    } else {
      u.u_peelCenter.value.set(-2, -2); // inactive (off-screen)
    }
  };

  StickerLayer.prototype._loop = function () {
    if (!this._running) return;

    requestAnimationFrame((now) => {
      // Cap dt and skip large jumps caused by tab becoming active after backgrounding
      const raw = (now - this._lastTime) / 1000;
      this._lastTime = now;
      const dt = document.hidden ? 0 : Math.min(raw, 0.05);

      if (this._enabled && dt > 0) {
        this._controller.update(dt);
        this._updateTearSystem(dt);
        this._updateMasks();
        this._updateShaderUniforms();
      }

      this._renderer.setClearColor(0x000000, 0);
      this._renderer.clear(true, true, true);

      if (this._enabled) {
        this._renderer.render(this._scene, this._camera);
      }

      this._loop();
    });
  };

  /** Hide the sticker canvas (particles remain visible). */
  StickerLayer.prototype.disable = function () {
    this._enabled = false;
    if (this._canvas) this._canvas.style.display = 'none';
  };

  /** Show the sticker canvas. */
  StickerLayer.prototype.enable = function () {
    this._enabled = true;
    if (this._canvas) this._canvas.style.display = '';
  };

  /** Restore the sticker to fully intact (clears all tear/residue masks). */
  StickerLayer.prototype.reset = function () {
    this._tearSystem.reset();
    this._maskPainter.reset();
    this._controller.state        = 'IDLE';
    this._controller.peelProgress = 0;
    this._controller.peelVelocity = 0;
  };

  StickerLayer.prototype.dispose = function () {
    this._running = false;
    if (this._maskPainter) this._maskPainter.dispose();
    if (this._material)    this._material.dispose();
    if (this._mesh)        this._mesh.geometry.dispose();
    if (this._renderer)    this._renderer.dispose();
    if (this._canvas)      this._canvas.remove();
  };

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */

  const stickerLayer = new StickerLayer();
  window.STICKER_LAYER = stickerLayer;

  function boot() {
    stickerLayer.init();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // DOM already ready
    setTimeout(boot, 0);
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }

})();
