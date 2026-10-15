#!/usr/bin/env node
// Captures the live bench at https://cards.roojerry.com/ (Stage 1: the invented
// player set, so every frame is publishable) and writes FULL-RESOLUTION
// originals to .claude/teightysix-captures/, which is gitignored.
//
// It never writes into static/. scripts/export-teightysix-frames.sh reads these
// originals and produces the site assets, so the exporter can run twice without
// re-encoding its own output.
//
// Existing originals are left alone unless --force is passed, so a re-run does
// not churn frames that already shipped.
//
//   node scripts/capture-teightysix-press.mjs [--force]
import puppeteer from 'puppeteer';
import { mkdirSync, existsSync } from 'fs';

const OUT = '.claude/teightysix-captures';
const FORCE = process.argv.includes('--force');
const FRAMES = ['press-empty', 'press-loaded', 'back-turned-over', 'pile-top-down'];

mkdirSync(OUT, { recursive: true });
if (!FORCE && FRAMES.every(n => existsSync(`${OUT}/${n}.png`))) {
	console.log(`all ${FRAMES.length} originals already in ${OUT}; pass --force to recapture`);
	process.exit(0);
}

const wait = ms => new Promise(r => setTimeout(r, ms));
// Clicks the button whose trimmed innerText matches exactly. The bench is Svelte
// and most controls carry hashed class names, so text is the stable handle.
const clickText = async (page, text) => {
	const handle = await page.evaluateHandle(
		t => [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === t), text);
	const el = handle.asElement();
	if (!el) throw new Error(`no button labelled ${text}`);
	await el.click();
};
const club = page => page.evaluate(() => {
	const b = document.querySelector('button.teambtn');
	return (b?.getAttribute('aria-label') || '').replace(/^.*now /, '');
});

const browser = await puppeteer.launch({
	headless: 'new',
	args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.goto('https://cards.roojerry.com/', { waitUntil: 'networkidle0', timeout: 90000 });
await wait(9000);

// 1. The press as it opens: empty stock on the glass, the local pile behind it.
await page.screenshot({ path: `${OUT}/press-empty.png` });
const clubBefore = await club(page);

// 2. The same bench with one of the bench's own sample photographs in the frame.
await (await page.$('button.usesample')).click();
await wait(7000);
await page.screenshot({ path: `${OUT}/press-loaded.png` });
const clubAfter = await club(page);
if (clubBefore !== clubAfter) {
	console.warn(`WARNING: club changed ${clubBefore} -> ${clubAfter}; the compare pair no longer shows one bench`);
}

// 3. The same card turned over. FRONT / BACK are the bench's turn control.
await clickText(page, 'BACK');
await wait(6000);
await page.screenshot({ path: `${OUT}/back-turned-over.png` });

// 4. Release it. PRINT drops the card into the visitor's own local pile and
//    dismisses the bench, leaving the pile top-down with the print's own plate.
await clickText(page, 'FRONT');
await wait(2500);
await clickText(page, 'PRINT');
await wait(12000);
await page.screenshot({ path: `${OUT}/pile-top-down.png` });

await browser.close();
console.log(`captured ${FRAMES.length} originals into ${OUT} (club ${clubAfter})`);
