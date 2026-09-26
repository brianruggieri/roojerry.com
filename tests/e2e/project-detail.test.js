#!/usr/bin/env node
// tests/e2e/project-detail.test.js
import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const URL = `${BASE_URL}/projects/teightysix/`;

await runTest('story strip renders one row per complete entry', async () => {
	await page.goto(URL, { waitUntil: 'networkidle0' });
	const rows = await page.$$eval('.story-strip__row', els => els.length);
	if (rows < 4 || rows > 6) throw new Error(`expected 4..6 story rows, got ${rows}`);
	const empty = await page.$$eval('.story-strip__row', els => els.filter(r => !r.querySelector('img') || !r.querySelector('figcaption p')).length);
	if (empty) throw new Error(`${empty} story rows are incomplete`);
});

await runTest('story strip skips entries missing src or text', async () => {
	const withText = await page.$$eval('.story-strip__row figcaption p', ps => ps.filter(p => p.textContent.trim()).length);
	const rows = await page.$$eval('.story-strip__row', els => els.length);
	if (withText !== rows) throw new Error(`${rows - withText} rows have empty text`);
});

await runTest('story images are lazy and have alt text', async () => {
	const bad = await page.$$eval('.story-strip__row img', imgs => imgs.filter(i => i.loading !== 'lazy' || !i.alt).length);
	if (bad) throw new Error(`${bad} story images missing lazy/alt`);
});

await runTest('header shows the live link before GitHub', async () => {
	const links = await page.$$eval('.project-detail__header-links a', as => as.map(a => a.className));
	if (!links[0] || !links[0].includes('project-card__link--live')) throw new Error(`first header link: ${links[0]}`);
});

await runTest('CTA shows the live link first', async () => {
	const links = await page.$$eval('.project-cta__actions a', as => as.map(a => a.className));
	if (!links[0] || !links[0].includes('project-card__link--live')) throw new Error(`first CTA link: ${links[0]}`);
});

await runTest('screenshot grid opens the lightbox', async () => {
	await page.click('.gallery-item__zoom');
	await page.waitForSelector('.shot-lightbox[open]', { timeout: 3000 });
	await page.keyboard.press('Escape');
});

await runTest('no em dash anywhere in the rendered page text', async () => {
	const text = await page.evaluate(() => document.body.innerText);
	if (text.includes('—')) throw new Error('em dash found in page text');
});

await browser.close();
if (failures) process.exit(1);
console.log('project-detail: all passed');
