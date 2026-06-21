#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await runTest('play tile opens fullscreen overlay and loads its src', async () => {
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	// No iframe should be loaded before interaction
	const before = await page.$eval('#ie-overlay .ie-overlay__frame', f => f.getAttribute('src'));
	if (before !== 'about:blank') throw new Error(`frame preloaded: ${before}`);

	await page.click('.exp-tile--play');
	await page.waitForSelector('#ie-overlay.is-active', { timeout: 3000 });
	const src = await page.$eval('#ie-overlay .ie-overlay__frame', f => f.getAttribute('src'));
	if (!src || src === 'about:blank') throw new Error('frame src not set after open');
});

await runTest('Escape closes the overlay and unloads the iframe', async () => {
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	await page.click('.exp-tile--play');
	await page.waitForSelector('#ie-overlay.is-active', { timeout: 3000 });
	await page.keyboard.press('Escape');
	await page.waitForFunction(
		() => !document.getElementById('ie-overlay').classList.contains('is-active'),
		{ timeout: 3000 });
	const src = await page.$eval('#ie-overlay .ie-overlay__frame', f => f.getAttribute('src'));
	if (src !== 'about:blank') throw new Error(`frame not unloaded: ${src}`);
});

await runTest('live tile has no iframe until interaction', async () => {
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const count = await page.$$eval('.exp-tile--live iframe', els => els.length);
	if (count !== 0) throw new Error(`live iframe present at load: ${count}`);
});

await runTest('hovering a live tile boots its toy inline', async () => {
	const tile = await page.$('.exp-tile--live');
	await tile.hover();
	await page.waitForSelector('.exp-tile--live.is-live .exp-tile__slot iframe', { timeout: 3000 });
	const src = await page.$eval('.exp-tile--live.is-live .exp-tile__slot iframe', f => f.getAttribute('src'));
	if (!src || !src.includes('/experiments/')) throw new Error(`inline src wrong: ${src}`);
});

await runTest('featured project tile links to its detail page', async () => {
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const href = await page.$eval('.exp-tile--project', a => a.getAttribute('href'));
	if (!href || !href.includes('/projects/')) throw new Error(`bad project href: ${href}`);
});

await runTest('reduced-motion: live tile does not auto-boot on hover', async () => {
	await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
	const tile = await page.$('.exp-tile--live');
	await tile.hover();
	await new Promise(r => setTimeout(r, 500));
	const count = await page.$$eval('.exp-tile--live iframe', els => els.length);
	if (count !== 0) throw new Error(`auto-booted under reduced motion: ${count}`);
	await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
});

await browser.close();
if (failures) process.exit(1);
console.log('experiments-wall: all passed');
