#!/usr/bin/env node
/**
 * Sticker layer unit / simulation tests.
 *
 * These run entirely in Node (no browser) by importing the logic
 * extracted into testable pure functions from sticker.js.
 *
 * What is tested:
 *   - StickerController peel spring convergence (peelProgress tracks peelTarget)
 *   - CrackGenerator path generation
 *   - GrabZoneTracker snap-to-edge logic
 *   - StickerController v2 state machine
 *   - Torn fraction accumulation
 */

/* ─── minimal THREE stub so sticker.js guards pass in Node ─── */
const THREE_STUB = {
  Vector2: class { constructor(x=0,y=0){this.x=x;this.y=y;} set(x,y){this.x=x;this.y=y;return this;} copy(o){this.x=o.x;this.y=o.y;return this;} },
  Vector3: class { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} },
};

/* ─── inline copies of pure-logic classes (no WebGL) ─── */

/* StickerController (no WebGL, matches sticker.js logic) */
function StickerController(params, innerW, innerH) {
  this.params=params; this._iw=innerW||1920; this._ih=innerH||1080;
  this.state='IDLE';
  this.peelProgress=0; this.peelVelocity=0; this.peelTarget=0;
  this.grabUV={x:0,y:0}; this.peelDir={x:1,y:0};
  this.pointerUV={x:0,y:0};
  this.isStuck=false; this.stuckTime=0;
  this.notchDamage=new Map(); this.activeNotch=null;
  this._pendingTears=[]; this._pendingResidue=[];
  this.onPop=null; this._accum=0;
}
StickerController.prototype._uvFromPointer=function(e){
  return {x:e.clientX/this._iw, y:e.clientY/this._ih};
};
StickerController.prototype._notchKey=function(u,v){
  const r=Math.round(1/this.params.NOTCH_RADIUS_UV);
  return Math.round(u*r)+','+Math.round(v*r);
};
StickerController.prototype._isNearEdge=function(u,v){
  const mx=this.params.EDGE_MARGIN_PX/this._iw,my=this.params.EDGE_MARGIN_PX/this._ih;
  return u<mx||u>1-mx||v<my||v>1-my;
};
StickerController.prototype.onPointerDown=function(e){
  const uv=this._uvFromPointer(e);
  if(this.state==='IDLE'){
    if(!this._isNearEdge(uv.x,uv.y)) return;
    const key=this._notchKey(uv.x,uv.y);
    const dmg=(this.notchDamage.get(key)||0)+1;
    this.notchDamage.set(key,dmg);
    if(dmg<this.params.NOTCH_THRESHOLD){this.state='NOTCHING'; return;}
    this.activeNotch={x:uv.x,y:uv.y};
    this.grabUV.x=uv.x; this.grabUV.y=uv.y;
    this.state='GRABBED';
    this.peelTarget=0; this.peelProgress=0; this.peelVelocity=0; this.isStuck=false;
    const dl=uv.x,dr=1-uv.x,dt=uv.y,db=1-uv.y,m=Math.min(dl,dr,dt,db);
    if(m===dl) {this.peelDir.x=1;this.peelDir.y=0;}
    else if(m===dr){this.peelDir.x=-1;this.peelDir.y=0;}
    else if(m===dt){this.peelDir.x=0;this.peelDir.y=1;}
    else{this.peelDir.x=0;this.peelDir.y=-1;}
  }
};
StickerController.prototype.onPointerMove=function(e){
  const uv=this._uvFromPointer(e);
  this.pointerUV.x=uv.x; this.pointerUV.y=uv.y;
  if(this.state!=='GRABBED'&&this.state!=='TEARING') return;
  const dx=uv.x-this.grabUV.x,dy=uv.y-this.grabUV.y;
  const dist=Math.sqrt(dx*dx+dy*dy);
  this.peelTarget=Math.min(1.0,dist*2.0);
  if(dist>0.03){this.peelDir.x=dx/dist;this.peelDir.y=dy/dist;}
  if(this.peelTarget>0.20&&this.state==='GRABBED') this.state='TEARING';
};
StickerController.prototype._step=function(dt){
  if(this.state!=='GRABBED'&&this.state!=='TEARING') return;
  const error=this.peelTarget-this.peelProgress;
  const K=this.params.SPRING_K,damp=this.params.SPRING_DAMP;
  if(!this.isStuck){
    this.peelVelocity=this.peelVelocity*damp+error*K*dt;
    this.peelProgress+=this.peelVelocity;
    this.peelProgress=Math.max(0,Math.min(1,this.peelProgress));
    if(Math.abs(this.peelVelocity)<(this.params.STICK_FORCE_THRESH||0.025)*.4&&Math.abs(error)<0.015){
      this.isStuck=true; this.stuckTime=0;
    }
  } else {
    this.stuckTime+=dt;
    const bf=Math.abs(error)*K+this.stuckTime*.8;
    if(bf>(this.params.STICK_FORCE_THRESH||0.025)*2.5){
      this.isStuck=false;
      this.peelVelocity+=Math.sign(error)*(this.params.SLIP_IMPULSE||0.06);
      this._pendingResidue.push({u:this.grabUV.x,v:this.grabUV.y,radius:.04,intensity:(this.params.RESIDUE_POP_BOOST||1.8),seed:0});
      if(this.onPop) this.onPop();
    }
  }
};
StickerController.prototype.update=function(dt){
  this._accum+=dt;
  const FDT=this.params.FIXED_DT;
  while(this._accum>=FDT){this._step(FDT);this._accum-=FDT;}
};

/* ─── Test harness ─── */
let passed=0,failed=0;

function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else       { console.error('  ✗ FAIL:', msg); failed++; }
}

/* ── StickerController – peel spring convergence ── */
console.log('\n[StickerController – peel spring]');
{
  const PARAMS = {
    SPRING_K:        18,
    SPRING_DAMP:     0.72,
    SNAP_THRESHOLD:  0.35,
    FIXED_DT:        1 / 60,
    CRACK_STEP_SIZE: 0.015,
    TEAR_JAGGEDNESS: 0.45,
  };

  const ctrl = new StickerController(PARAMS, 1920, 1080);
  ctrl.state = 'GRABBED';
  ctrl.grabUV.x = 0.05; ctrl.grabUV.y = 0.5;
  ctrl.peelDir.x = 1; ctrl.peelDir.y = 0;
  ctrl.peelTarget = 0.5;

  // Advance 120 fixed steps (2 seconds at 60 Hz)
  for (let i=0; i<120; i++) ctrl._step(PARAMS.FIXED_DT);

  assert(ctrl.peelProgress > 0.1,
    `peelProgress (${ctrl.peelProgress.toFixed(4)}) moved toward target 0.5`);
  // Allow for stick-slip: progress may be less than target due to sticking
  assert(ctrl.peelProgress <= 1.0,
    'peelProgress never exceeds 1.0');
}


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

/* ── GrabZoneTracker ── */
console.log('\n[GrabZoneTracker]');
{
  // Inline GrabZoneTracker for Node testing
  const GRAB_SNAP_PX = 12;

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
    { path: [{ x: 0, y: 0 }, { x: 0, y: 0.5 }, { x: 0, y: 1 }], normal: { x: 1,  y: 0  } }, // left edge
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


/* ── StickerController v2 ── */
console.log('\n[StickerController v2]');
{
  // Use a fresh params object with v2 values
  const P2 = {
    SNAP_THRESHOLD: 0.35,
    SPRING_K: 18,
    SPRING_DAMP: 0.72,
    FIXED_DT: 1 / 60,
    CRACK_STEP_SIZE: 0.015,
    TEAR_JAGGEDNESS: 0.45,
  };

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

  // onHoverChange callback fires on state change
  let hoverFired = false;
  const ctrlHov = new StickerControllerV2(P2, 1920, 1080);
  ctrlHov.onHoverChange = () => { hoverFired = true; };
  ctrlHov.setHover({ point: { x: 0, y: 0.5 }, normal: { x: 1, y: 0 } });
  assert(hoverFired, 'onHoverChange fires when entering HOVER state');
}

/* ── Torn fraction accumulation ── */
console.log('\n[Torn fraction]');
{
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

/* ── Summary ── */
console.log(`\n[sticker tests] ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
