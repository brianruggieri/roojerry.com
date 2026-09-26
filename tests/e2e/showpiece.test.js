#!/usr/bin/env node
// tests/e2e/showpiece.test.js
import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

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

await runTest('showpiece poster has explicit dimensions', async () => {
	const dims = await page.$eval('.exp-showpiece__media img', i => [i.getAttribute('width'), i.getAttribute('height')]);
	if (!dims[0] || !dims[1]) throw new Error(`missing width/height: ${dims}`);
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
