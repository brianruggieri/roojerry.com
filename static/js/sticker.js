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
 *   StickerController – pointer event state machine (IDLE → NOTCHING →
 *                       GRABBED → TEARING); spring-damper peel physics with
 *                       stick-slip stick; notch-damage accumulator.
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
    // ── Sticker geometry ──────────────────────────────────────
    /** Subdivision columns of the sticker plane mesh. */
    SEG_X: 50,
    /** Subdivision rows of the sticker plane mesh. */
    SEG_Y: 50,

    // ── Mask render-target resolution ─────────────────────────
    /** Power-of-two size for tearMask and residueMask RTs. */
    MASK_SIZE: 512,
    /** RT size on mobile devices. */
    MOBILE_MASK_SIZE: 256,

    // ── Peel spring physics ────────────────────────────────────
    /** Spring constant (higher = snappier peel). */
    SPRING_K: 7.0,
    /** Damping coefficient applied each fixed step (0–1). */
    SPRING_DAMP: 0.80,

    // ── Stick-slip (viscoelastic lag) ──────────────────────────
    /** Force-proxy threshold below which peel "sticks". */
    STICK_FORCE_THRESH: 0.025,
    /** Velocity impulse released on stick-slip pop. */
    SLIP_IMPULSE: 0.06,

    // ── Tearing engine ─────────────────────────────────────────
    /** Constraint lattice width (nodes). */
    LATTICE_W: 70,
    /** Constraint lattice height (nodes). */
    LATTICE_H: 70,
    /** Mobile lattice scale factor (0–1 relative to desktop sizes). */
    MOBILE_LATTICE_SCALE: 0.5,
    /** Base strain ratio at which constraints break. */
    TEAR_TOUGHNESS_BASE: 1.40,
    /** Per-node toughness variation amplitude (jaggedness). */
    TEAR_JAGGEDNESS: 0.45,
    /** Constraint solver iterations per physics step. */
    CONSTRAINT_ITERS: 7,

    // ── Notching ───────────────────────────────────────────────
    /** Clicks required near an edge before a grab handle appears. */
    NOTCH_THRESHOLD: 3,
    /** UV-space radius that defines the "same notch cell". */
    NOTCH_RADIUS_UV: 0.07,
    /** CSS pixel distance from viewport edge to count as "edge". */
    EDGE_MARGIN_PX: 90,

    // ── Residue ────────────────────────────────────────────────
    /** Base rate of residue deposition per tear step. */
    RESIDUE_DEPOSITION_RATE: 0.35,
    /** Extra residue burst on each stick-slip pop event. */
    RESIDUE_POP_BOOST: 1.8,

    // ── Visual ─────────────────────────────────────────────────
    /** Sticker base colour as [R, G, B] in [0,1]. */
    STICKER_COLOR: [0.93, 0.91, 0.88],
    /** Overall sticker opacity when fully intact. */
    STICKER_OPACITY: 0.94,
    /** Radius of the curl deformation zone (clip-space units, 0–1). */
    CURL_RADIUS: 0.20,

    // ── Performance ────────────────────────────────────────────
    /** Fixed physics timestep (seconds). */
    FIXED_DT: 1 / 60,
  };

  /* ═══════════════════════════════════════════════════════════
     MASK PAINTER
     Maintains two WebGLRenderTargets (tearMask, residueMask) and
     provides stamp methods that paint into them using Three.js scene
     rendering – no CPU readbacks.
  ═══════════════════════════════════════════════════════════ */

  /** @param {THREE.WebGLRenderer} renderer  @param {number} size  Power-of-two */
  function MaskPainter(renderer, size) {
    this.renderer = renderer;
    this.size = size;

    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    };

    /** 1 = intact, 0 = torn/removed */
    this.tearMaskRT   = new THREE.WebGLRenderTarget(size, size, Object.assign({}, rtOpts));
    /** 0 = no residue, 1 = heavy residue */
    this.residueMaskRT = new THREE.WebGLRenderTarget(size, size, Object.assign({}, rtOpts));

    // Paint-scene: ortho camera + single quad
    this._scene  = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._geo    = new THREE.PlaneGeometry(2, 2);

    // --- Tear stamp material (paints BLACK = hole) ---
    this._tearMat = new THREE.ShaderMaterial({
      uniforms: {
        u_center:   { value: new THREE.Vector2(0.5, 0.5) },
        u_radius:   { value: 0.05 },
        u_softness: { value: 0.01 },
      },
      vertexShader: [
        'varying vec2 v_uv;',
        'void main(){v_uv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec2 u_center;',
        'uniform float u_radius;',
        'uniform float u_softness;',
        'varying vec2 v_uv;',
        'void main(){',
        '  float d=distance(v_uv,u_center);',
        '  float a=1.0-smoothstep(u_radius-u_softness,u_radius+u_softness,d);',
        // Paint black (r=0) where stamp is opaque
        '  gl_FragColor=vec4(0.0,0.0,0.0,a);',
        '}',
      ].join('\n'),
      transparent: true,
      // Normal blending: result = src*srcA + dst*(1-srcA)
      // Black * alpha + white * (1-alpha) → darkens toward 0 at stamp
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
    });

    // --- Residue stamp material (paints warm grey additively) ---
    this._residueMat = new THREE.ShaderMaterial({
      uniforms: {
        u_center:    { value: new THREE.Vector2(0.5, 0.5) },
        u_radius:    { value: 0.04 },
        u_intensity: { value: 0.5 },
        u_seed:      { value: 0.0 },
      },
      vertexShader: [
        'varying vec2 v_uv;',
        'void main(){v_uv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec2 u_center;',
        'uniform float u_radius;',
        'uniform float u_intensity;',
        'uniform float u_seed;',
        'varying vec2 v_uv;',
        'float hash(vec2 p){',
        '  p=fract(p*vec2(127.1+u_seed,311.7+u_seed*.3));',
        '  p+=dot(p,p+47.3);',
        '  return fract(p.x*p.y);',
        '}',
        'void main(){',
        '  float d=distance(v_uv,u_center);',
        '  float base=1.0-smoothstep(u_radius*.4,u_radius*1.3,d);',
        '  float n=hash(v_uv*90.0)*.5+.5;',
        '  float val=base*n*u_intensity;',
        '  gl_FragColor=vec4(val,val,val,val);',
        '}',
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this._mesh = new THREE.Mesh(this._geo, this._tearMat);
    this._scene.add(this._mesh);

    // Initialise tearMask to fully WHITE (intact)
    this._fillRT(this.tearMaskRT, new THREE.Color(1, 1, 1));
    // Initialise residueMask to BLACK (no residue)
    this._fillRT(this.residueMaskRT, new THREE.Color(0, 0, 0));
  }

  MaskPainter.prototype._fillRT = function (rt, color) {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(color, 1);
    this.renderer.clear(true, false, false);
    this.renderer.setRenderTarget(prev);
  };

  MaskPainter.prototype._renderStamp = function (rt) {
    const prev    = this.renderer.getRenderTarget();
    const prevAC  = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this._scene, this._camera);
    this.renderer.setRenderTarget(prev);
    this.renderer.autoClear = prevAC;
  };

  /**
   * Paint a tear (hole) at UV position with given radius.
   * @param {number} u  UV x [0,1]
   * @param {number} v  UV y [0,1]
   * @param {number} radius  UV-space radius
   */
  MaskPainter.prototype.paintTear = function (u, v, radius) {
    this._mesh.material = this._tearMat;
    this._tearMat.uniforms.u_center.value.set(u, v);
    this._tearMat.uniforms.u_radius.value   = radius;
    this._tearMat.uniforms.u_softness.value = Math.max(0.004, radius * 0.15);
    this._renderStamp(this.tearMaskRT);
  };

  /**
   * Paint residue at UV position.
   * @param {number} u @param {number} v @param {number} radius @param {number} intensity 0–1
   * @param {number} seed  Random seed for noise variation.
   */
  MaskPainter.prototype.paintResidue = function (u, v, radius, intensity, seed) {
    this._mesh.material = this._residueMat;
    this._residueMat.uniforms.u_center.value.set(u, v);
    this._residueMat.uniforms.u_radius.value    = radius;
    this._residueMat.uniforms.u_intensity.value = intensity;
    this._residueMat.uniforms.u_seed.value      = seed || 0;
    this._renderStamp(this.residueMaskRT);
  };

  MaskPainter.prototype.reset = function () {
    this._fillRT(this.tearMaskRT,    new THREE.Color(1, 1, 1));
    this._fillRT(this.residueMaskRT, new THREE.Color(0, 0, 0));
  };

  MaskPainter.prototype.dispose = function () {
    this.tearMaskRT.dispose();
    this.residueMaskRT.dispose();
    this._geo.dispose();
    this._tearMat.dispose();
    this._residueMat.dispose();
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

  function StickerController(params) {
    this.params = params;

    // State machine
    /** @type {'IDLE'|'NOTCHING'|'GRABBED'|'TEARING'} */
    this.state = 'IDLE';

    // Peel spring state
    this.peelProgress = 0;   // 0–1 current lift amount
    this.peelVelocity = 0;
    this.peelTarget   = 0;   // desired lift (set by pointer drag)

    // Peel geometry in UV space
    this.grabUV  = new THREE.Vector2();
    this.peelDir = new THREE.Vector2(1, 0); // direction of pull

    // Pointer tracking
    this.pointerUV = new THREE.Vector2();

    // Stick-slip
    this.isStuck   = false;
    this.stuckTime = 0;

    // Notch-damage map: quantised UV key → click count
    this.notchDamage  = new Map();
    this.activeNotch  = null; // { x, y } in UV space

    // Pending mask operations flushed each frame
    this._pendingTears    = []; // {u,v,radius}
    this._pendingResidue  = []; // {u,v,radius,intensity,seed}

    // Pop callback (hook for audio / visual flash)
    this.onPop = null;

    // Fixed-timestep accumulator
    this._accum = 0;
  }

  StickerController.prototype._uvFromPointer = function (e) {
    return {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  };

  StickerController.prototype._notchKey = function (u, v) {
    const r = Math.round(1 / this.params.NOTCH_RADIUS_UV);
    return Math.round(u * r) + ',' + Math.round(v * r);
  };

  StickerController.prototype._isNearEdge = function (u, v) {
    const mx = this.params.EDGE_MARGIN_PX / window.innerWidth;
    const my = this.params.EDGE_MARGIN_PX / window.innerHeight;
    return u < mx || u > 1 - mx || v < my || v > 1 - my;
  };

  StickerController.prototype.onPointerDown = function (e) {
    const uv = this._uvFromPointer(e);

    if (this.state === 'IDLE') {
      if (!this._isNearEdge(uv.x, uv.y)) return;

      const key = this._notchKey(uv.x, uv.y);
      const dmg = (this.notchDamage.get(key) || 0) + 1;
      this.notchDamage.set(key, dmg);

      if (dmg < this.params.NOTCH_THRESHOLD) {
        this.state = 'NOTCHING'; // brief transient visual cue
        setTimeout(() => { if (this.state === 'NOTCHING') this.state = 'IDLE'; }, 200);
        return;
      }

      // Notch threshold reached → grab
      this.activeNotch = { x: uv.x, y: uv.y };
      this.grabUV.set(uv.x, uv.y);
      this.state = 'GRABBED';
      this.peelTarget   = 0;
      this.peelProgress = 0;
      this.peelVelocity = 0;
      this.isStuck = false;

      // Determine initial peel direction (away from nearest edge)
      const dl = uv.x, dr = 1 - uv.x, dt = uv.y, db = 1 - uv.y;
      const minD = Math.min(dl, dr, dt, db);
      if      (minD === dl) this.peelDir.set( 1,  0);
      else if (minD === dr) this.peelDir.set(-1,  0);
      else if (minD === dt) this.peelDir.set( 0,  1);
      else                  this.peelDir.set( 0, -1);

    } else if (this.state === 'GRABBED' || this.state === 'TEARING') {
      this.pointerUV.set(uv.x, uv.y);
    }
  };

  StickerController.prototype.onPointerMove = function (e) {
    const uv = this._uvFromPointer(e);
    this.pointerUV.set(uv.x, uv.y);

    if (this.state !== 'GRABBED' && this.state !== 'TEARING') return;

    const dx = uv.x - this.grabUV.x;
    const dy = uv.y - this.grabUV.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.peelTarget = Math.min(1.0, dist * 2.0);

    if (dist > 0.03) {
      this.peelDir.set(dx / dist, dy / dist);
    }
    if (this.peelTarget > 0.20 && this.state === 'GRABBED') {
      this.state = 'TEARING';
    }
  };

  StickerController.prototype.onPointerUp = function () {
    if (this.state === 'GRABBED' || this.state === 'TEARING') {
      this.peelTarget = 0;
      const ctrl = this;
      setTimeout(function () {
        if (ctrl.state === 'GRABBED' || ctrl.state === 'TEARING') {
          ctrl.state = 'IDLE';
          ctrl.peelProgress = 0;
          ctrl.peelVelocity = 0;
          ctrl.isStuck = false;
        }
      }, 600);
    } else {
      this.state = 'IDLE';
    }
  };

  StickerController.prototype._step = function (dt) {
    if (this.state !== 'GRABBED' && this.state !== 'TEARING') return;

    const error = this.peelTarget - this.peelProgress;
    const K     = this.params.SPRING_K;
    const damp  = this.params.SPRING_DAMP;

    if (!this.isStuck) {
      const accel = error * K;
      this.peelVelocity  = this.peelVelocity * damp + accel * dt;
      this.peelProgress += this.peelVelocity;
      this.peelProgress  = Math.max(0, Math.min(1, this.peelProgress));

      // Stick if very slow and nearly at target
      if (Math.abs(this.peelVelocity) < this.params.STICK_FORCE_THRESH * 0.4 &&
          Math.abs(error) < 0.015) {
        this.isStuck   = true;
        this.stuckTime = 0;
      }
    } else {
      this.stuckTime += dt;
      const breakForce = Math.abs(error) * K + this.stuckTime * 0.8;

      if (breakForce > this.params.STICK_FORCE_THRESH * 2.5) {
        this.isStuck = false;
        this.peelVelocity += Math.sign(error) * this.params.SLIP_IMPULSE;

        // Residue burst on pop
        const fu = this.grabUV.x + this.peelDir.x * this.peelProgress;
        const fv = this.grabUV.y + this.peelDir.y * this.peelProgress;
        this._pendingResidue.push({
          u: fu + (Math.random() - 0.5) * 0.03,
          v: fv + (Math.random() - 0.5) * 0.03,
          radius: 0.045,
          intensity: this.params.RESIDUE_POP_BOOST,
          seed: Math.random() * 200,
        });

        if (this.onPop) this.onPop();
      }
    }

    // Ongoing residue deposition while peeling
    if (this.state === 'TEARING' && Math.random() < 0.12) {
      const fu = this.grabUV.x + this.peelDir.x * this.peelProgress * 0.85;
      const fv = this.grabUV.y + this.peelDir.y * this.peelProgress * 0.85;
      this._pendingResidue.push({
        u: fu,
        v: fv,
        radius: 0.025 + Math.random() * 0.025,
        intensity: this.params.RESIDUE_DEPOSITION_RATE,
        seed: Math.random() * 200,
      });
    }
  };

  /** Advance physics by wall-clock delta (fixed sub-steps). */
  StickerController.prototype.update = function (dt) {
    this._accum += dt;
    const FDT = this.params.FIXED_DT;
    while (this._accum >= FDT) {
      this._step(FDT);
      this._accum -= FDT;
    }
  };

  /** Current peel-front UV position. */
  StickerController.prototype.peelFrontUV = function () {
    return {
      x: this.grabUV.x + this.peelDir.x * this.peelProgress,
      y: this.grabUV.y + this.peelDir.y * this.peelProgress,
    };
  };

  /** Consume and return pending mask operations. */
  StickerController.prototype.flush = function () {
    const t = this._pendingTears.slice(),
          r = this._pendingResidue.slice();
    this._pendingTears    = [];
    this._pendingResidue  = [];
    return { tears: t, residue: r };
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
    this._controller.onPop = this._onPop.bind(this);

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
        u_residueMask:  { value: this._maskPainter.residueMaskRT.texture },
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

  StickerLayer.prototype._onPop = function () {
    // Brief opacity flash on stick-slip pop
    if (!this._material) return;
    const u = this._material.uniforms.u_opacity;
    const orig = u.value;
    u.value = Math.min(1, orig + 0.07);
    setTimeout(() => { if (this._material) u.value = orig; }, 90);
  };

  StickerLayer.prototype._onPointerDown = function (e) {
    if (this._enabled) this._controller.onPointerDown(e);
  };
  StickerLayer.prototype._onPointerMove = function (e) {
    if (this._enabled) this._controller.onPointerMove(e);
  };
  StickerLayer.prototype._onPointerUp = function (e) {
    if (this._enabled) this._controller.onPointerUp(e);
  };

  StickerLayer.prototype._onResize = function () {
    if (!this._renderer) return;
    this._renderer.setSize(window.innerWidth, window.innerHeight, true);
  };

  StickerLayer.prototype._updateMasks = function () {
    const ctrl = this._controller;
    const { tears, residue } = ctrl.flush();

    for (const t of tears) {
      this._maskPainter.paintTear(t.u, t.v, t.radius);
    }
    for (const r of residue) {
      this._maskPainter.paintResidue(r.u, r.v, r.radius, r.intensity, r.seed);
    }

    // When actively peeling/tearing: paint peel-front tear on throttled timer
    if (ctrl.state === 'GRABBED' || ctrl.state === 'TEARING') {
      this._tearTimer += 0.016;
      if (this._tearTimer > 0.09) {
        this._tearTimer = 0;
        const f = ctrl.peelFrontUV();
        const spread = 0.05 + ctrl.peelProgress * 0.12;
        this._maskPainter.paintTear(f.x, f.y, spread);

        if (ctrl.peelProgress > 0.06) {
          this._maskPainter.paintResidue(
            f.x + (Math.random() - 0.5) * 0.025,
            f.y + (Math.random() - 0.5) * 0.025,
            0.03, 0.22, Math.random() * 100
          );
        }
      }
    }
  };

  StickerLayer.prototype._updateTearSystem = function (dt) {
    const ctrl = this._controller;
    if (ctrl.state !== 'GRABBED' && ctrl.state !== 'TEARING') return;

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
        this._maskPainter.paintTear(uvFlat[i], uvFlat[i + 1], 0.013);
      }
    }
  };

  StickerLayer.prototype._updateShaderUniforms = function () {
    const ctrl = this._controller;
    const u    = this._material.uniforms;

    u.u_time.value        = performance.now() * 0.001;
    u.u_peelProgress.value = ctrl.peelProgress;
    u.u_peelDir.value.set(ctrl.peelDir.x, ctrl.peelDir.y);

    if (ctrl.state === 'GRABBED' || ctrl.state === 'TEARING') {
      // Map UV [0,1] → clip-space [-1,1] (flip Y)
      u.u_peelCenter.value.set(
        ctrl.grabUV.x * 2 - 1,
        -(ctrl.grabUV.y * 2 - 1)
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
    this._controller.notchDamage  = new Map();
    this._controller.activeNotch  = null;
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
