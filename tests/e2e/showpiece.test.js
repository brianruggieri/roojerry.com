#!/usr/bin/env node
// tests/e2e/showpiece.test.js
import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL } from '../helpers/server.js';
import { webpSize } from '../helpers/webp-size.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await runTest('exactly one showpiece tile renders above the featured grid', async () => {
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const count = await page.$$eval('.exp-showpiece', els => els.length);
	if (count !== 1) throw new Error(`expected 1 showpiece, got ${count}`);
	const order = await page.evaluate(() => {
		const sp = document.querySelector('.exp-showpiece');
		const grid = document.querySelector('.exp-grid--featured');
		return sp.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING;
	});
	if (!order) throw new Error('showpiece is not before the featured grid');
});

// The detail page is withheld until the v2 article ships: every anchor in the
// tile must open the live tool, and nothing on the page may link the
// unrendered /projects/teightysix/ URL.
await runTest('showpiece links only to the live tool', async () => {
	const live = await page.$eval('.exp-showpiece__cta--live', a => a.getAttribute('href'));
	if (live !== 'https://cards.roojerry.com/') throw new Error(`live href: ${live}`);
	const rel = await page.$eval('.exp-showpiece__cta--live', a => a.getAttribute('rel'));
	if (!/noopener/.test(rel || '')) throw new Error('live link missing rel=noopener');
	const media = await page.$eval('.exp-showpiece__media', a => a.getAttribute('href'));
	if (media !== 'https://cards.roojerry.com/') throw new Error(`media href: ${media}`);
	const dead = await page.$$eval('a', as => as.map(a => a.getAttribute('href')).filter(h => h && h.includes('/projects/teightysix/')));
	if (dead.length) throw new Error(`links to the unrendered detail page: ${dead.join(', ')}`);
});

await runTest('showpiece page is not duplicated in the featured grid', async () => {
	const hrefs = await page.$$eval('.exp-grid--featured .exp-tile--project', els => els.map(a => a.getAttribute('href')));
	if (hrefs.some(h => h.includes('/projects/teightysix/'))) throw new Error('teightysix also appears as a featured tile');
	if (!hrefs.length) throw new Error('featured grid lost every ordinary project tile');
});

// The tile is above the featured grid but below the fold, so the poster must
// reserve its box without competing with the real LCP element for bandwidth.
await runTest('showpiece poster reserves its real pixel size and loads lazily', async () => {
	const img = await page.$eval('.exp-showpiece__media img', i => ({
		width: i.getAttribute('width'), height: i.getAttribute('height'),
		loading: i.getAttribute('loading'), fetchpriority: i.getAttribute('fetchpriority'),
		src: i.getAttribute('src'),
		webp: document.querySelector('.exp-showpiece__media source')?.getAttribute('srcset'),
	}));
	if (!img.width || !img.height) throw new Error(`missing width/height: ${img.width}x${img.height}`);
	if (img.loading !== 'lazy') throw new Error(`loading=${img.loading}, want lazy`);
	if (img.fetchpriority) throw new Error(`fetchpriority=${img.fetchpriority} on a below-the-fold tile`);

	// The served poster is the webp when there is one; measure the file itself.
	const served = (img.webp || img.src).replace(/\?.*$/, '');
	if (!served.endsWith('.webp')) throw new Error(`poster is ${served}, expected a webp`);
	const file = join(ROOT, 'static', served);
	const { width, height } = webpSize(file);
	if (width !== Number(img.width) || height !== Number(img.height)) {
		throw new Error(`${served} is ${width}x${height} but the tag declares ${img.width}x${img.height}`);
	}
});

// The hover views: a full grid, every frame on disk at the poster's size (the
// canvas crops them exactly as the poster is cropped), and the canvas only
// once they have all decoded.
await runTest('showpiece view grid is complete and matches the poster', async () => {
	await page.setViewport({ width: 1600, height: 1000 });
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const v = await page.$eval('.exp-showpiece__media', a => ({
		urls: (a.getAttribute('data-views') || '').split(/\s+/).filter(Boolean),
		cols: +a.getAttribute('data-views-cols'), rows: +a.getAttribute('data-views-rows'),
	}));
	if (!v.urls.length || v.urls.length !== v.cols * v.rows) throw new Error(`${v.urls.length} views for a ${v.cols}x${v.rows} grid`);
	for (const u of v.urls) {
		if (!/\?v=[0-9a-f]{8}$/.test(u)) throw new Error(`${u} is not content-hashed`);
		const { width, height } = webpSize(join(ROOT, 'static', u.replace(/\?.*$/, '')));
		if (width !== 1280 || height !== 800) throw new Error(`${u} is ${width}x${height}, poster is 1280x800`);
	}
	await page.$eval('.exp-showpiece', el => el.scrollIntoView({ block: 'center' }));
	await page.waitForSelector('.exp-showpiece__views.is-ready', { timeout: 10000 });
	const aria = await page.$eval('.exp-showpiece__views', c => c.getAttribute('aria-hidden'));
	if (aria !== 'true') throw new Error('the views canvas is exposed to assistive tech');
});

await runTest('reduced motion never loads the view grid', async () => {
	const p2 = await browser.newPage();
	await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
	const fetched = [];
	p2.on('request', r => { if (r.url().includes('/views/r')) fetched.push(r.url()); });
	await p2.goto(BASE_URL, { waitUntil: 'networkidle0' });
	await p2.$eval('.exp-showpiece', el => el.scrollIntoView({ block: 'center' }));
	await new Promise(r => setTimeout(r, 1500));
	if (await p2.$('.exp-showpiece__views')) throw new Error('canvas created under reduced motion');
	if (fetched.length) throw new Error(`fetched ${fetched.length} views under reduced motion`);
	await p2.close();
});

// Badges on project tiles were dropped: the tile's size and place already say
// what it is. The play and live badges stay; they say what a tile DOES.
await runTest('project tiles carry no badge', async () => {
	const n = await page.$$eval('.exp-showpiece .exp-tile__badge, .exp-tile--project .exp-tile__badge', els => els.length);
	if (n) throw new Error(`${n} badge(s) on project tiles`);
});

await runTest('no horizontal overflow at 390px', async () => {
	await page.setViewport({ width: 390, height: 844 });
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
	if (over) throw new Error('page scrolls horizontally at 390px');
});

await browser.close();
if (failures) process.exit(1);
console.log('showpiece: all passed');
