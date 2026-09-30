#!/usr/bin/env node
// Coin-face rotation: the coin discovers its images from static/img/coin-faces/
// at build time and picks a new one for every back-face reveal.
//
// Two failure modes here are invisible in a screenshot, so they are asserted
// directly: a missing .webp companion (webp-capable browsers get a 404 and the
// face renders blank), and a rotation that repeats the same photo back to back.
import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const backImage = () => page.$eval('#profileCoin .coin-back', el =>
	getComputedStyle(el).backgroundImage);

// Whichever face the flip has turned toward the viewer.
const visibleImage = () => page.$eval('#profileCoin', el => {
	const showingBack = el.classList.contains('flipped');
	const face = el.querySelector(showingBack ? '.coin-back' : '.coin-front');
	return getComputedStyle(face).backgroundImage;
});

// Reduced motion disables the 3-8s auto-flip and zeroes the animation lock, so
// flips driven from the test are the only ones that happen. Without this the
// auto-flip races every assertion below.
// flipCoin() is a no-op while a flip is in flight (the `flipping` guard clears
// on a timeout), so consecutive synchronous calls are swallowed. Every flip must
// wait for the guard to clear or the coin never actually advances.
async function flipOnce() {
	await page.evaluate(() => flipCoin());
	await page.waitForFunction(() => flipping === false, { timeout: 3000 });
}

// One reveal cycle: flip to the back, then back to the front. The swap happens
// once the back face is hidden again, so the next reveal shows a fresh photo.
async function revealCycle() {
	await flipOnce();
	await flipOnce();
}

async function loadQuiet() {
	await page.emulateMediaFeatures([
		{ name: 'prefers-reduced-motion', value: 'reduce' },
	]);
	await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
}

await runTest('coin exposes at least 2 discovered images', async () => {
	await loadQuiet();
	const imgs = await page.$eval('#profileCoin', el =>
		JSON.parse(el.dataset.coinImages || '[]'));
	if (imgs.length < 2) {
		throw new Error(`expected >= 2 coin images, got ${imgs.length}: ${JSON.stringify(imgs)}`);
	}
	if (!imgs.every(p => p.startsWith('/img/coin-faces/'))) {
		throw new Error(`unexpected path outside coin-faces: ${JSON.stringify(imgs)}`);
	}
});

await runTest('every discovered image and its .webp companion resolves', async () => {
	await loadQuiet();
	const imgs = await page.$eval('#profileCoin', el =>
		JSON.parse(el.dataset.coinImages || '[]'));
	const urls = imgs.flatMap(p => [p, p.replace(/\.(png|jpg|jpeg)$/i, '.webp')]);
	const broken = [];
	for (const u of urls) {
		const res = await page.goto(BASE_URL + u);
		if (res.status() !== 200) broken.push(`${u} -> ${res.status()}`);
	}
	if (broken.length) {
		throw new Error(`unreachable coin assets (blank face at runtime): ${broken.join(', ')}`);
	}
});

await runTest('every flip reveals an image the viewer has not just seen', async () => {
	await loadQuiet();
	const imgs = await page.$eval('#profileCoin', el =>
		JSON.parse(el.dataset.coinImages || '[]'));

	// One flip = one reveal. The face that just went out of view is reassigned
	// while hidden, so consecutive reveals must never match.
	const seen = [await visibleImage()];
	for (let i = 0; i < 10; i++) {
		await flipOnce();
		const now = await visibleImage();
		if (now === seen[seen.length - 1]) {
			throw new Error(`flip ${i + 1} revealed the same image again: ${now}`);
		}
		seen.push(now);
	}

	const distinct = new Set(seen).size;
	if (distinct < Math.min(3, imgs.length)) {
		throw new Error(`rotation barely varied: ${distinct} distinct across ${seen.length} reveals`);
	}
});

await runTest('both faces rotate, not just the back', async () => {
	await loadQuiet();
	const front = () => page.$eval('#profileCoin .coin-front', el =>
		getComputedStyle(el).backgroundImage);
	const startFront = await front();
	const startBack = await backImage();

	let frontChanged = false, backChanged = false;
	for (let i = 0; i < 8 && !(frontChanged && backChanged); i++) {
		await flipOnce();
		if (await front() !== startFront) frontChanged = true;
		if (await backImage() !== startBack) backChanged = true;
	}
	if (!frontChanged) throw new Error('front face never changed — it is not drawing from the pool');
	if (!backChanged) throw new Error('back face never changed');
});

await runTest('a reload does not always open on the same face', async () => {
	const first = [];
	for (let i = 0; i < 6; i++) {
		await loadQuiet();
		first.push(await visibleImage());
	}
	if (new Set(first).size < 2) {
		throw new Error(`load face never varied across 6 loads: ${first[0]}`);
	}
});

await browser.close();
if (failures) { console.error(`coin-rotation: ${failures} failed`); process.exit(1); }
console.log('coin-rotation: all passed');
