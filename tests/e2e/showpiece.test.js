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

await runTest('showpiece links to the live site and the detail page', async () => {
	const live = await page.$eval('.exp-showpiece__cta--live', a => a.getAttribute('href'));
	if (live !== 'https://cards.roojerry.com/') throw new Error(`live href: ${live}`);
	const rel = await page.$eval('.exp-showpiece__cta--live', a => a.getAttribute('rel'));
	if (!/noopener/.test(rel || '')) throw new Error('live link missing rel=noopener');
	const details = await page.$eval('.exp-showpiece__cta--details', a => a.getAttribute('href'));
	if (!details.includes('/projects/teightysix/')) throw new Error(`details href: ${details}`);
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
	const served = img.webp || img.src;
	if (!served.endsWith('.webp')) throw new Error(`poster is ${served}, expected a webp`);
	const file = join(ROOT, 'static', served);
	const { width, height } = webpSize(file);
	if (width !== Number(img.width) || height !== Number(img.height)) {
		throw new Error(`${served} is ${width}x${height} but the tag declares ${img.width}x${img.height}`);
	}
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
