#!/usr/bin/env node
// Captures the teightysix bench from a grid of camera angles, for the
// showpiece tile's hover parallax (static/js/showpiece-views.js).
//
// Each frame is the real scene re-rendered: the background camera orbits the
// pile a few degrees and the held card leans the same way, so the pile slides
// behind the card, cards occlude each other correctly, and the foil answers
// the angle. Nothing is faked in 2D.
//
// It drives a teightysix DEV server, because only the dev build exposes
// `window.__pileScene` (PileBackground.svelte). Start one from the teightysix
// checkout with the local pile, so the visitor seed below fills the table:
//
//   cd ~/git/baseball-cards/teightysix/apps/web
//   VITE_CARD_PERSISTENCE=local npx vite dev --port 5391 --strictPort --host 127.0.0.1
//
// Then:
//
//   node scripts/capture-teightysix-views.mjs [--url http://127.0.0.1:5391/] [--out DIR]
//
// Deterministic by construction: the visitor seed (which builds the pile),
// Math.random (the bench's sample photo) and Date.now (the position board's
// mowing pattern) are all pinned, and the
// room's turntable is frozen at a fixed angle. Run it twice and diff the PNGs
// (--out a different DIR) to confirm on a new teightysix build.
//
// Originals land in the gitignored .claude/ tree; export-teightysix-views.sh
// turns them into the site assets.
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(name);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const URL = arg('--url', 'http://127.0.0.1:5391/');
const OUT = arg('--out', '.claude/teightysix-captures/views');

// The grid. Columns are the camera's yaw about its own up axis, rows its pitch
// about its right axis, both through the pile's centre. A few degrees reads as
// depth; much more and the table's edge shows. The held card leans by the same
// fraction (leanHeld takes -1..1), so card and room agree on where you are.
// Seven columns: at 2.5-degree steps the switch between neighbours was a
// visible jump; at 1.67 it reads as motion.
const YAWS = [-5, -10 / 3, -5 / 3, 0, 5 / 3, 10 / 3, 5];
const PITCHES = [-4, 0, 4];
const TURNTABLE_RAD = 0.6; // the room's fixed turn; chosen for the pile's look, nothing else
const VISITOR_SEED = 'roojerry-showpiece-1';
const RANDOM_SEED = 86;
const SETTLE_MS = 2500; // the card's lean is sprung; this outlasts it

const wait = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
	headless: 'new',
	args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((visitor, seed) => {
	localStorage.setItem('t86.visitor', visitor);
	localStorage.setItem('t86.coach', '1'); // first-visit coachmark seen: it holds the turntable and covers the card
	// The position board picks its mowing pattern from Date.now()
	// (field-patterns.ts patternsForVisit), so the clock is pinned too. The
	// scene's loop runs on performance.now(), which is left alone.
	Date.now = () => 1760486400000;
	// mulberry32, so the bench's sample rotation starts in the same place every run.
	let a = seed >>> 0;
	Math.random = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}, VISITOR_SEED, RANDOM_SEED);
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 });
await wait(12000);

const ready = await page.evaluate(() => {
	const s = window.__pileScene;
	return s ? { cards: s.stats.cards, engine: document.body.innerText.match(/ENGINE\s+([\d.]+)/)?.[1] ?? null } : null;
});
if (!ready) {
	await browser.close();
	throw new Error(`no window.__pileScene at ${URL}: is this a teightysix DEV server with WebGPU?`);
}

const sample = await page.$('button.usesample');
if (!sample) throw new Error('no button.usesample: the bench changed; update this script');
await sample.click();
await wait(8000);

// Freeze the room and wrap the top-down aim with the grid's orbit. aimTopDown
// runs every frame (it carries the turn), so an orbit applied anywhere else
// would be overwritten on the next frame.
await page.evaluate(turn => {
	const s = window.__pileScene;
	s.holdTurntable(true);
	s.turntable = { angle: turn, speed: 0 };
	const aim = s.aimTopDown.bind(s);
	const cam = s.camera;
	const V = cam.position.constructor;
	const Q = cam.quaternion.constructor;
	window.__view = { yaw: 0, pitch: 0 };
	s.aimTopDown = function () {
		aim();
		const { yaw, pitch } = window.__view;
		const up = new V(0, 1, 0).applyQuaternion(cam.quaternion);
		const right = new V(1, 0, 0).applyQuaternion(cam.quaternion);
		const q = new Q().setFromAxisAngle(up, (yaw * Math.PI) / 180)
			.multiply(new Q().setFromAxisAngle(right, (pitch * Math.PI) / 180));
		cam.position.sub(s.restTarget).applyQuaternion(q).add(s.restTarget);
		cam.quaternion.premultiply(q);
	};
	// The HUD's CSS animations (the position diagram pulses) run on wall-clock
	// time, so two runs caught them at different phases. Park them all at 0.
	for (const a of document.getAnimations()) {
		a.pause();
		a.currentTime = 0;
	}
}, TURNTABLE_RAD);

const yawMax = Math.max(...YAWS.map(Math.abs));
const pitchMax = Math.max(...PITCHES.map(Math.abs));
for (const [r, pitch] of PITCHES.entries()) {
	for (const [c, yaw] of YAWS.entries()) {
		await page.evaluate((yaw, pitch, nx, ny) => {
			const s = window.__pileScene;
			window.__view = { yaw, pitch };
			s.leanHeld(nx, ny);
			s.aimTopDown();
			s.start();
		}, yaw, pitch, yaw / yawMax, pitch / pitchMax);
		await wait(SETTLE_MS);
		await page.screenshot({ path: `${OUT}/r${r}c${c}.png` });
	}
}
await browser.close();

writeFileSync(`${OUT}/views.json`, JSON.stringify({
	source: URL,
	engine: ready.engine,
	pileCards: ready.cards,
	visitorSeed: VISITOR_SEED,
	randomSeed: RANDOM_SEED,
	turntableRad: TURNTABLE_RAD,
	yaws: YAWS,
	pitches: PITCHES,
}, null, '\t') + '\n');
console.log(`captured ${YAWS.length * PITCHES.length} views into ${OUT} (engine ${ready.engine}, ${ready.cards} cards)`);
