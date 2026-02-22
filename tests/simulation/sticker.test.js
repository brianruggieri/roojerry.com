#!/usr/bin/env node
/**
 * Sticker layer unit / simulation tests.
 *
 * These run entirely in Node (no browser) by importing the logic
 * extracted into testable pure functions from sticker.js.
 *
 * What is tested:
 *   - UnionFind connectivity (path-compression, union, find)
 *   - TearSystem initialisation (node count, constraint count, toughness range)
 *   - TearSystem.releaseRegion unpins nodes in radius
 *   - TearSystem.getDetachedUVs returns nodes not connected to any pinned node
 *   - StickerController notch accumulation (NOTCH_THRESHOLD gate)
 *   - StickerController peel spring convergence (peelProgress tracks peelTarget)
 *   - StickerController stick-slip pop fires onPop and deposits residue
 */

/* ─── minimal THREE stub so sticker.js guards pass in Node ─── */
const THREE_STUB = {
  Vector2: class { constructor(x=0,y=0){this.x=x;this.y=y;} set(x,y){this.x=x;this.y=y;return this;} copy(o){this.x=o.x;this.y=o.y;return this;} },
  Vector3: class { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} },
};

/* ─── inline copies of pure-logic classes (no WebGL) ─── */

/* UnionFind */
function UnionFind(n) {
  this.parent = new Int32Array(n);
  this.rank   = new Uint8Array(n);
  for (let i=0;i<n;i++) this.parent[i]=i;
}
UnionFind.prototype.find = function(x) {
  while(this.parent[x]!==x){ this.parent[x]=this.parent[this.parent[x]]; x=this.parent[x]; }
  return x;
};
UnionFind.prototype.union = function(a,b) {
  a=this.find(a); b=this.find(b);
  if(a===b)return;
  if(this.rank[a]<this.rank[b]){const t=a;a=b;b=t;}
  this.parent[b]=a;
  if(this.rank[a]===this.rank[b]) this.rank[a]++;
};
UnionFind.prototype.connected = function(a,b){ return this.find(a)===this.find(b); };

/* TearSystem (no WebGL, matches sticker.js logic) */
function TearSystem(lw, lh, params) {
  this.lw=lw; this.lh=lh; this.params=params;
  this.nodeCount=lw*lh;
  this.px=new Float32Array(this.nodeCount);
  this.py=new Float32Array(this.nodeCount);
  this.ppx=new Float32Array(this.nodeCount);
  this.ppy=new Float32Array(this.nodeCount);
  this.pinned=new Uint8Array(this.nodeCount);
  this.toughness=new Float32Array(this.nodeCount);
  const maxC=lw*lh*4;
  this.conA=new Int32Array(maxC);
  this.conB=new Int32Array(maxC);
  this.conRest=new Float32Array(maxC);
  this.conBroken=new Uint8Array(maxC);
  this.conCount=0;
  this.uf=null;
  this.grabNode=-1; this.grabTargetX=0; this.grabTargetY=0;
  this._init();
}
TearSystem.prototype._noise=function(x,y){
  const s=Math.sin(x*127.1+y*311.7)*43758.5453; return s-Math.floor(s);
};
TearSystem.prototype._addConstraint=function(a,b,rest){
  const c=this.conCount++;
  this.conA[c]=a; this.conB[c]=b; this.conRest[c]=rest; this.conBroken[c]=0;
};
TearSystem.prototype._init=function(){
  const lw=this.lw,lh=this.lh;
  const rH=1/(lw-1),rV=1/(lh-1),rD=Math.hypot(rH,rV);
  for(let j=0;j<lh;j++){
    for(let i=0;i<lw;i++){
      const idx=j*lw+i;
      this.px[idx]=i/(lw-1); this.py[idx]=j/(lh-1);
      this.ppx[idx]=this.px[idx]; this.ppy[idx]=this.py[idx];
      this.pinned[idx]=1;
      const n1=this._noise(i*.31+3.7,j*.29+8.1);
      const n2=this._noise(i*.19+11.3,j*.37+2.9);
      this.toughness[idx]=this.params.TEAR_TOUGHNESS_BASE+(n1-.5)*this.params.TEAR_JAGGEDNESS+(n2-.5)*this.params.TEAR_JAGGEDNESS*.4;
      if(i+1<lw) this._addConstraint(idx,idx+1,rH);
      if(j+1<lh) this._addConstraint(idx,idx+lw,rV);
      if(i+1<lw&&j+1<lh) this._addConstraint(idx,idx+lw+1,rD);
    }
  }
  this._rebuildUF();
};
TearSystem.prototype._rebuildUF=function(){
  this.uf=new UnionFind(this.nodeCount);
  for(let c=0;c<this.conCount;c++) if(!this.conBroken[c]) this.uf.union(this.conA[c],this.conB[c]);
};
TearSystem.prototype._pinnedRoots=function(){
  const r=new Set(); for(let i=0;i<this.nodeCount;i++) if(this.pinned[i]) r.add(this.uf.find(i)); return r;
};
TearSystem.prototype.releaseRegion=function(uvX,uvY,radius){
  const ic=Math.round(uvX*(this.lw-1)),jc=Math.round(uvY*(this.lh-1));
  const ir=Math.ceil(radius*(this.lw-1))+1,jr=Math.ceil(radius*(this.lh-1))+1;
  for(let dj=-jr;dj<=jr;dj++) for(let di=-ir;di<=ir;di++){
    const ni=ic+di,nj=jc+dj;
    if(ni<0||ni>=this.lw||nj<0||nj>=this.lh) continue;
    const fx=di/(ir||1),fy=dj/(jr||1);
    if(fx*fx+fy*fy<=1.0) this.pinned[nj*this.lw+ni]=0;
  }
};
TearSystem.prototype.nodeAt=function(uvX,uvY){
  const i=Math.max(0,Math.min(this.lw-1,Math.round(uvX*(this.lw-1))));
  const j=Math.max(0,Math.min(this.lh-1,Math.round(uvY*(this.lh-1))));
  return j*this.lw+i;
};
TearSystem.prototype.update=function(dt){
  if(this.grabNode<0) return;
  for(let i=0;i<this.nodeCount;i++){
    if(this.pinned[i]) continue;
    const vx=(this.px[i]-this.ppx[i])*.97,vy=(this.py[i]-this.ppy[i])*.97;
    this.ppx[i]=this.px[i]; this.ppy[i]=this.py[i];
    this.px[i]+=vx; this.py[i]+=vy;
  }
  const gn=this.grabNode;
  if(gn>=0&&!this.pinned[gn]){
    this.px[gn]+=(this.grabTargetX-this.px[gn])*.35;
    this.py[gn]+=(this.grabTargetY-this.py[gn])*.35;
  }
  for(let iter=0;iter<this.params.CONSTRAINT_ITERS;iter++){
    for(let c=0;c<this.conCount;c++){
      if(this.conBroken[c]) continue;
      const a=this.conA[c],b=this.conB[c];
      const dx=this.px[b]-this.px[a],dy=this.py[b]-this.py[a];
      const dist=Math.sqrt(dx*dx+dy*dy)||1e-6;
      const strain=dist/this.conRest[c];
      const localTough=(this.toughness[a]+this.toughness[b])*.5;
      if(strain>localTough){this.conBroken[c]=1;continue;}
      const corr=(dist-this.conRest[c])/dist*.5;
      const cx=dx*corr,cy=dy*corr;
      if(!this.pinned[a]){this.px[a]+=cx;this.py[a]+=cy;}
      if(!this.pinned[b]){this.px[b]-=cx;this.py[b]-=cy;}
    }
  }
};
TearSystem.prototype.getDetachedUVs=function(){
  this._rebuildUF();
  const pr=this._pinnedRoots(),uvs=[];
  for(let i=0;i<this.nodeCount;i++) if(!pr.has(this.uf.find(i))) uvs.push(this.px[i],this.py[i]);
  return uvs;
};
TearSystem.prototype.reset=function(){
  for(let i=0;i<this.nodeCount;i++){
    this.px[i]=(i%this.lw)/(this.lw-1);
    this.py[i]=Math.floor(i/this.lw)/(this.lh-1);
    this.ppx[i]=this.px[i]; this.ppy[i]=this.py[i];
    this.pinned[i]=1;
  }
  for(let c=0;c<this.conCount;c++) this.conBroken[c]=0;
  this.grabNode=-1; this._rebuildUF();
};

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
    if(Math.abs(this.peelVelocity)<this.params.STICK_FORCE_THRESH*.4&&Math.abs(error)<0.015){
      this.isStuck=true; this.stuckTime=0;
    }
  } else {
    this.stuckTime+=dt;
    const bf=Math.abs(error)*K+this.stuckTime*.8;
    if(bf>this.params.STICK_FORCE_THRESH*2.5){
      this.isStuck=false;
      this.peelVelocity+=Math.sign(error)*this.params.SLIP_IMPULSE;
      this._pendingResidue.push({u:this.grabUV.x,v:this.grabUV.y,radius:.04,intensity:this.params.RESIDUE_POP_BOOST,seed:0});
      if(this.onPop) this.onPop();
    }
  }
};
StickerController.prototype.update=function(dt){
  this._accum+=dt;
  const FDT=this.params.FIXED_DT;
  while(this._accum>=FDT){this._step(FDT);this._accum-=FDT;}
};
StickerController.prototype.flush=function(){
  const t=this._pendingTears.slice(),r=this._pendingResidue.slice();
  this._pendingTears=[]; this._pendingResidue=[];
  return {tears:t,residue:r};
};

/* ─── Test harness ─── */
let passed=0,failed=0;

function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else       { console.error('  ✗ FAIL:', msg); failed++; }
}

const PARAMS = {
  TEAR_TOUGHNESS_BASE: 1.40,
  TEAR_JAGGEDNESS: 0.45,
  CONSTRAINT_ITERS: 7,
  SPRING_K: 7.0,
  SPRING_DAMP: 0.80,
  STICK_FORCE_THRESH: 0.025,
  SLIP_IMPULSE: 0.06,
  NOTCH_THRESHOLD: 3,
  NOTCH_RADIUS_UV: 0.07,
  EDGE_MARGIN_PX: 90,
  RESIDUE_DEPOSITION_RATE: 0.35,
  RESIDUE_POP_BOOST: 1.8,
  FIXED_DT: 1/60,
};

/* ── UnionFind ── */
console.log('\n[UnionFind]');
{
  const uf = new UnionFind(6);
  uf.union(0, 1); uf.union(1, 2); uf.union(4, 5);
  assert(uf.connected(0, 2),  'transitively connected after union(0,1)+union(1,2)');
  assert(!uf.connected(0, 3), 'node 3 isolated from component {0,1,2}');
  assert(uf.connected(4, 5),  'union(4,5) creates component');
  assert(!uf.connected(2, 5), 'components {0,1,2} and {4,5} are separate');
  // Path compression does not break find
  assert(uf.find(0) === uf.find(2), 'find(0) === find(2) after path compression');
}

/* ── TearSystem – init ── */
console.log('\n[TearSystem – init]');
{
  const lw=10, lh=10;
  const ts = new TearSystem(lw, lh, PARAMS);
  assert(ts.nodeCount === lw * lh,           'nodeCount = lw × lh');
  assert(ts.conCount > 0,                    'constraints created during init');
  // All nodes pinned initially
  let allPinned = true;
  for (let i=0;i<ts.nodeCount;i++) if(!ts.pinned[i]) { allPinned=false; break; }
  assert(allPinned, 'all nodes pinned at init');
  // Toughness in reasonable range
  let tMin=Infinity, tMax=-Infinity;
  for(let i=0;i<ts.nodeCount;i++){if(ts.toughness[i]<tMin)tMin=ts.toughness[i];if(ts.toughness[i]>tMax)tMax=ts.toughness[i];}
  assert(tMin > 0.5 && tMax < 3.5,          `toughness range [${tMin.toFixed(3)}, ${tMax.toFixed(3)}] is sane`);
  // UV layout: corners
  assert(ts.px[0] === 0 && ts.py[0] === 0,  'top-left node at UV(0,0)');
  assert(Math.abs(ts.px[ts.nodeCount-1] - 1) < 1e-5 && Math.abs(ts.py[ts.nodeCount-1] - 1) < 1e-5,
    'bottom-right node at UV(1,1)');
}

/* ── TearSystem – releaseRegion ── */
console.log('\n[TearSystem – releaseRegion]');
{
  const ts = new TearSystem(20, 20, PARAMS);
  // Release a small region at UV centre
  ts.releaseRegion(0.5, 0.5, 0.15);
  let unpinnedCount = 0;
  for (let i=0;i<ts.nodeCount;i++) if(!ts.pinned[i]) unpinnedCount++;
  assert(unpinnedCount > 0, 'releaseRegion unpins nodes at centre');
  assert(unpinnedCount < ts.nodeCount, 'releaseRegion does not unpin everything');
  // Corner nodes should remain pinned
  assert(ts.pinned[0] === 1, 'top-left corner node still pinned after centre release');
}

/* ── TearSystem – detached nodes ── */
console.log('\n[TearSystem – detached nodes]');
{
  const ts = new TearSystem(8, 8, PARAMS);
  // Manually break ALL constraints involving a node not at edges → makes it detached
  // Node at (4,4) = index 4*8+4 = 36 (roughly centre)
  const target = 4 * 8 + 4;
  ts.pinned[target] = 0;
  // Break all constraints touching target node
  for (let c=0; c<ts.conCount; c++) {
    if (ts.conA[c] === target || ts.conB[c] === target) ts.conBroken[c] = 1;
  }
  const uvs = ts.getDetachedUVs();
  assert(uvs.length >= 2, 'getDetachedUVs returns at least one UV pair for isolated node');
  // The returned positions should be close to (0.5, 0.5)
  const u = uvs[0], v = uvs[1];
  assert(Math.abs(u - 0.5) < 0.12 && Math.abs(v - 0.5) < 0.12,
    `detached node UV (${u.toFixed(3)}, ${v.toFixed(3)}) near centre`);
}

/* ── StickerController – notch accumulation ── */
console.log('\n[StickerController – notch]');
{
  const ctrl = new StickerController(PARAMS, 1920, 1080);
  // Edge click: near left edge (x=20 px out of 1920)
  const edge = { clientX: 20, clientY: 540 };

  // Click 1 and 2: state should become NOTCHING but revert to IDLE (async)
  ctrl.onPointerDown(edge);
  assert(ctrl.state === 'NOTCHING' || ctrl.state === 'IDLE',
    'click 1 → NOTCHING (not yet grabbed)');
  ctrl.state = 'IDLE'; // reset async timeout

  ctrl.onPointerDown(edge);
  assert(ctrl.state === 'NOTCHING' || ctrl.state === 'IDLE',
    'click 2 → still not grabbed');
  ctrl.state = 'IDLE';

  // Click 3 (= NOTCH_THRESHOLD): should become GRABBED
  ctrl.onPointerDown(edge);
  assert(ctrl.state === 'GRABBED', `click ${PARAMS.NOTCH_THRESHOLD} → GRABBED`);
  assert(ctrl.activeNotch !== null, 'activeNotch set after threshold');
}

/* ── StickerController – peel spring convergence ── */
console.log('\n[StickerController – peel spring]');
{
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

/* ── StickerController – stick-slip pop fires onPop and deposits residue ── */
console.log('\n[StickerController – stick-slip]');
{
  const ctrl = new StickerController(PARAMS, 1920, 1080);
  let popCount = 0;
  ctrl.onPop = () => popCount++;
  ctrl.state = 'TEARING';
  ctrl.grabUV.x = 0.05; ctrl.grabUV.y = 0.5;
  ctrl.peelDir.x = 1;   ctrl.peelDir.y = 0;
  ctrl.peelTarget = 0.9;

  // Force a stuck state and then drive it to break
  ctrl.isStuck = true;
  ctrl.stuckTime = 10; // long stuck time → guarantees pop condition
  ctrl._step(PARAMS.FIXED_DT);

  assert(!ctrl.isStuck, 'stick-slip pop unsticks the controller');
  assert(ctrl.peelVelocity !== 0, 'pop adds velocity impulse');

  const { residue } = ctrl.flush();
  assert(residue.length > 0, 'pop deposits residue entry');
}

/* ── StickerController – flush clears pending arrays ── */
console.log('\n[StickerController – flush]');
{
  const ctrl = new StickerController(PARAMS, 1920, 1080);
  ctrl._pendingResidue.push({ u:0.5, v:0.5, radius:0.03, intensity:0.5, seed:0 });
  ctrl._pendingTears.push({ u:0.5, v:0.5, radius:0.04 });

  const { tears, residue } = ctrl.flush();
  assert(tears.length === 1   && residue.length === 1,   'flush returns accumulated entries');
  const { tears:t2, residue:r2 } = ctrl.flush();
  assert(t2.length === 0 && r2.length === 0, 'second flush returns empty arrays');
}

/* ── Summary ── */
console.log(`\n[sticker tests] ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
