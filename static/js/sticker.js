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
 *   MaskPainter       – maintains tearMaskRT WebGL render target;
 *                       fillPolygon() renders solid polygon fills into
 *                       tearMaskRT without CPU↔GPU readbacks.
 *   CrackGenerator    – builds procedural crack paths and branch trees in UV space.
 *   GrabZoneTracker   – tracks viewport-edge and crack-boundary grab zones.
 *   StickerController – pointer event state machine (IDLE →
 *                       HOVER → PEELING → SNAP_BACK | SNAP_OFF); spring-damper
 *                       peel physics with snap-off detection.
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
    if (this.state !== 'HOVER') return;
    this.state         = 'PEELING';
    this.peelProgress  = 0;
    this.peelVelocity  = 0;
    this.peelTarget    = 0;
  };

  StickerController.prototype.onPointerMove = function (e) {
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
    // Sample points along inset lines (EDGE_MARGIN_PX inset from each edge)
    // This makes the hover zone reachable without hugging the exact screen edge
    const iw = (typeof window !== 'undefined') ? window.innerWidth  : 1920;
    const ih = (typeof window !== 'undefined') ? window.innerHeight : 1080;
    const mx = this.edgeMarginPx / iw;   // UV fraction for left/right margin
    const my = this.edgeMarginPx / ih;   // UV fraction for top/bottom margin

    const pts = (ax, ay, bx, by) => {
      const path = [];
      for (let i = 0; i <= 8; i++) {
        path.push({ x: ax + (bx - ax) * i / 8, y: ay + (by - ay) * i / 8 });
      }
      return path;
    };
    this.zones = [
      { path: pts(mx,     0, mx,     1), normal: { x:  1, y:  0 } },  // left
      { path: pts(1 - mx, 0, 1 - mx, 1), normal: { x: -1, y:  0 } },  // right
      { path: pts(0,     my, 1,     my), normal: { x:  0, y:  1 } },  // top
      { path: pts(0, 1 - my, 1, 1 - my), normal: { x:  0, y: -1 } },  // bottom
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
        float arcAlong = sin(theta) * u_curlRadius;
        float arcUp    = (1.0 - cos(theta)) * u_curlRadius;

        // Move vertex: replace the -d penetration with the arc position
        pos.xy += u_peelDir * (arcAlong - (-d));
        pos.z  += arcUp;

        v_lift      = sin(theta);
        v_underside = step(HALF_PI, theta);
      }
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

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

    // \u2500\u2500 Base colour \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    vec3 color = u_stickerColor;
    float sheen = hash(v_uv * 6.0 + u_time * 0.008) * 0.06;
    color += sheen * (1.0 - v_lift);

    // \u2500\u2500 Edge darkening \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    float edgeDark = smoothstep(0.12, 0.0, tearVal);
    color = mix(color, vec3(0.08, 0.05, 0.03), edgeDark * 0.75);

    // \u2500\u2500 Rim highlight at peel fold \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    float rimHL = smoothstep(0.55, 0.75, v_lift) * (1.0 - smoothstep(0.75, 1.0, v_lift));
    color += rimHL * vec3(0.35, 0.28, 0.22);

    // \u2500\u2500 Underside shading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (v_underside > 0.5) {
      float adhesiveN = hash(v_uv * 50.0) * 0.4 + 0.6;
      color = u_stickerColor * (0.38 * adhesiveN) + vec3(0.06, 0.04, 0.02);
    }

    // \u2500\u2500 Iridescent tear-boundary shimmer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    float edgeStrength = abs(dFdx(tearVal)) + abs(dFdy(tearVal));
    edgeStrength = clamp(edgeStrength * 12.0, 0.0, 1.0);
    float edgePhase = v_uv.x * 8.0 + v_uv.y * 5.0;
    vec3 irid = 0.5 + 0.5 * vec3(
      sin(u_time * 3.0 + edgePhase),
      sin(u_time * 3.0 + edgePhase + 2.094),
      sin(u_time * 3.0 + edgePhase + 4.189)
    );
    float boundaryMask = smoothstep(0.90, 1.0, tearVal) * edgeStrength;
    color += irid * boundaryMask * 0.35;

    // \u2500\u2500 Expanding pulse rings at new grab points \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
    this._maskPainter    = null;
    this._crackGen       = null;
    this._grabTracker    = null;
    this._controller     = null;
    this._pulseEvents    = [];
    this._tornFraction   = 0;
    this._crackAnimState = null;

    this._running      = false;
    this._enabled      = true;
    this._lastTime     = 0;
  }

  StickerLayer.prototype.init = function () {
    this._params = window.STICKER_PARAMS;
    const P = this._params;

    // Feature-based mobile detection (touch + narrow viewport)
    const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 1) &&
                     window.innerWidth < 768;

    const maskSize = isMobile ? P.MOBILE_MASK_SIZE  : P.MASK_SIZE;

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
    this._maskPainter   = new MaskPainter(this._renderer, maskSize);
    this._crackGen      = new CrackGenerator(P);
    this._grabTracker   = new GrabZoneTracker(P.EDGE_MARGIN_PX, P.GRAB_SNAP_PX);
    this._controller    = new StickerController(P);
    this._pulseEvents   = [];
    this._tornFraction  = 0;
    this._crackAnimState = null;

    // Wire snap-off callback
    this._controller.onSnapOff = (frontUV, grabNormal) => {
      this._doSnapOff(frontUV, grabNormal);
    };

    // Wire hover change (for cursor style)
    this._controller.onHoverChange = (zone) => {
      document.body.style.cursor = zone ? 'grab' : '';
    };

    // Initialise mask to white (fully intact)
    this._maskPainter.reset();

    // --- Mesh ---
    this._buildMesh();

    // --- Events ---
    // Store bound event listener references for cleanup in dispose()
    this._boundPointerDown = this._onPointerDown.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp   = this._onPointerUp.bind(this);
    this._boundResize      = this._onResize.bind(this);
    window.addEventListener('pointerdown', this._boundPointerDown);
    window.addEventListener('pointermove', this._boundPointerMove);
    window.addEventListener('pointerup',   this._boundPointerUp);
    window.addEventListener('resize',      this._boundResize);

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
        u_foldPoint:    { value: new THREE.Vector2(-2, -2) },
        u_peelDir:      { value: new THREE.Vector2(1, 0) },
        u_peelProgress: { value: 0 },
        u_curlRadius:   { value: P.CURL_RADIUS },
        u_tearMask:     { value: this._maskPainter.tearMaskRT.texture },
        u_stickerColor: { value: new THREE.Vector3(...P.STICKER_COLOR) },
        u_opacity:      { value: P.STICKER_OPACITY },
        u_time:         { value: 0 },
        u_pulsePos:     { value: [new THREE.Vector2(-2,-2), new THREE.Vector2(-2,-2),
                                   new THREE.Vector2(-2,-2), new THREE.Vector2(-2,-2)] },
        u_pulseAge:     { value: [-1, -1, -1, -1] },
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
    if (!this._enabled) return;
    this._controller.onPointerMove(e);
    const uv = {
      x: e.clientX / window.innerWidth,
      y: 1 - e.clientY / window.innerHeight,
    };
    this._updateHover(uv);
  };
  StickerLayer.prototype._onPointerUp = function (e) {
    if (e.target.closest('a,button,input,select,textarea,[tabindex],[contenteditable]')) return;
    if (this._enabled) this._controller.onPointerUp(e);
  };

  StickerLayer.prototype._onResize = function () {
    if (!this._renderer) return;
    this._renderer.setSize(window.innerWidth, window.innerHeight, true);
    this._grabTracker.reset();  // recalculate edge zone UV positions
  };

  StickerLayer.prototype._updateHover = function (pointerUV) {
    if (!pointerUV) return;
    const zone = this._grabTracker.nearest(
      pointerUV,
      window.innerWidth,
      window.innerHeight
    );
    this._controller.setHover(zone ? { point: zone.point, normal: zone.normal } : null);
  };

  StickerLayer.prototype._doSnapOff = function (frontUV, grabNormal) {
    const primary  = this._crackGen.buildPath(frontUV);
    const branches = this._crackGen.buildBranches(primary);

    // Register new grab zone from the primary crack boundary
    this._grabTracker.addCrackBoundary(primary, { x: grabNormal.x, y: grabNormal.y });

    // Emit pulse events at secondary branch termini near viewport edges
    for (const branch of branches) {
      const tip = branch[branch.length - 1];
      const nearEdge = tip.x < 0.08 || tip.x > 0.92 || tip.y < 0.08 || tip.y > 0.92;
      if (nearEdge && this._pulseEvents.length < 4) {
        this._pulseEvents.push({ uvX: tip.x, uvY: tip.y, spawnTime: performance.now() * 0.001 });
      }
    }

    // Build closed tear polygon: crack path + viewport edges to close it
    const polygon = primary.slice();
    const last  = primary[primary.length - 1];
    const first = primary[0];
    const corners = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
    ];
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
    // Walk corners from lastCorner to firstCorner via the shorter path
    const ccwSteps = (firstCorner - lastCorner + 4) % 4;
    const cwSteps  = (lastCorner - firstCorner + 4) % 4;
    const dir = (cwSteps <= ccwSteps) ? -1 : 1;   // clockwise or counterclockwise
    let ci = lastCorner, steps = 0;
    while (ci !== firstCorner && steps < 4) {
      polygon.push(corners[ci]);
      ci = (ci + dir + 4) % 4;
      steps++;
    }
    polygon.push(corners[firstCorner]);

    // Paint polygon into mask
    this._maskPainter.fillPolygon(polygon);

    // Start crack animation
    this._crackAnimState = { primary, branches, progress: 0 };

    // Shoelace formula for actual polygon area (more accurate than bounding box)
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
    }
    area = Math.abs(area) / 2;
    this._tornFraction = Math.min(1, this._tornFraction + area);
    if (this._tornFraction >= 0.98 && this.onCleared) this.onCleared();
  };



  StickerLayer.prototype._updateShaderUniforms = function () {
    const ctrl = this._controller;
    const u    = this._material.uniforms;

    u.u_time.value         = performance.now() * 0.001;
    u.u_peelProgress.value = ctrl.peelProgress;
    u.u_peelDir.value.set(ctrl.peelDir.x, ctrl.peelDir.y);

    if (ctrl.state === 'PEELING' || ctrl.state === 'HOVER' || ctrl.state === 'SNAP_BACK') {
      const front = ctrl.peelFrontUV();
      u.u_foldPoint.value.set(
        front.x * 2 - 1,
        front.y * 2 - 1
      );
    } else {
      u.u_foldPoint.value.set(-2, -2);
    }

    // Pulse events — expire old ones before iterating (avoid splice-during-iteration)
    const now = performance.now() * 0.001;
    this._pulseEvents = this._pulseEvents.filter(p => now - p.spawnTime <= 1.5);
    const pulses = this._pulseEvents;
    for (let i = 0; i < 4; i++) {
      if (i < pulses.length) {
        u.u_pulsePos.value[i].set(pulses[i].uvX, pulses[i].uvY);
        u.u_pulseAge.value[i] = now - pulses[i].spawnTime;
      } else {
        u.u_pulsePos.value[i].set(-2, -2);
        u.u_pulseAge.value[i] = -1;
      }
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
    this._maskPainter.reset();
    this._grabTracker.reset();
    this._controller.state        = 'IDLE';
    this._controller.peelProgress = 0;
    this._controller.peelVelocity = 0;
    this._tornFraction   = 0;
    this._crackAnimState = null;
    this._pulseEvents    = [];
  };

  StickerLayer.prototype.dispose = function () {
    this._running = false;
    window.removeEventListener('pointerdown', this._boundPointerDown);
    window.removeEventListener('pointermove', this._boundPointerMove);
    window.removeEventListener('pointerup',   this._boundPointerUp);
    window.removeEventListener('resize',      this._boundResize);
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
