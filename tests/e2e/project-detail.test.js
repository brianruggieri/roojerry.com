#!/usr/bin/env node
// tests/e2e/project-detail.test.js
//
// The teightysix detail page is withheld from this release (build.render:
// never) until the v2 narrated article replaces it, so the story-strip
// assertions run against a throwaway fixture page and the gallery assertions
// against /projects/yt-music/, which still renders through single.html.
import puppeteer from 'puppeteer';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL } from '../helpers/server.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const GALLERY_URL = `${BASE_URL}/projects/yt-music/`;

// A throwaway project page: two complete story entries and two broken ones.
// build.list: never keeps it out of the wall, the sitemap and index.json.
const fixtureName = 'zz-story-fixture';
const fixtureFile = join(ROOT, 'content', 'projects', `${fixtureName}.md`);
const goodA = '/img/projects/teightysix/story/alphabet.png';
const goodB = '/img/projects/teightysix/story/mascot-bake-off.png';
writeFileSync(fixtureFile, [
	'---',
	'title: "Story fixture"',
	'build:',
	'  list: never',
	'story:',
	`  - src: "${goodA}"`,
	'    title: "First complete entry"',
	'    text: "This entry has both a src and text, so it renders first."',
	'  - title: "No src"',
	'    text: "This entry has no src, so it must not render."',
	`  - src: "${goodB}"`,
	'    title: "Second complete entry"',
	'    text: "This entry is complete and must render second."',
	`  - src: "${goodA}"`,
	'    title: "No text"',
	'---',
	'',
].join('\n'));

try {
	const fixtureUrl = `${BASE_URL}/projects/${fixtureName}/`;
	const deadline = Date.now() + 10000;                  // wait out hugo's live reload
	let ok = false;
	while (Date.now() < deadline) {
		const res = await fetch(fixtureUrl).catch(() => null);
		if (res?.status === 200) { ok = true; break; }
		await new Promise(r => setTimeout(r, 250));
	}
	if (!ok) throw new Error(`${fixtureUrl} never returned 200 within 10s`);
	await page.goto(fixtureUrl, { waitUntil: 'networkidle0' });

	await runTest('story strip renders the complete entries in order and skips broken ones', async () => {
		const srcs = await page.$$eval('.story-strip__row img', imgs => imgs.map(i => i.getAttribute('src')));
		if (srcs.join('|') !== [goodA, goodB].join('|')) {
			throw new Error(`row srcs\n      got  ${srcs.join(', ')}\n      want ${goodA}, ${goodB}`);
		}
		const empty = await page.$$eval('.story-strip__row',
			els => els.filter(r => !r.querySelector('img') || !r.querySelector('figcaption p')?.textContent.trim()).length);
		if (empty) throw new Error(`${empty} story rows are incomplete`);
	});

	await runTest('story images are lazy and have alt text', async () => {
		const bad = await page.$$eval('.story-strip__row img', imgs => imgs.filter(i => i.loading !== 'lazy' || !i.alt).length);
		if (bad) throw new Error(`${bad} story images missing lazy/alt`);
	});
} finally {
	unlinkSync(fixtureFile);
}

await runTest('screenshot grid opens the lightbox', async () => {
	await page.goto(GALLERY_URL, { waitUntil: 'networkidle0' });
	await page.click('.gallery-item__zoom');
	await page.waitForSelector('.shot-lightbox[open]', { timeout: 3000 });
	await page.keyboard.press('Escape');
});

await runTest('no em dash anywhere in the rendered page text', async () => {
	const text = await page.evaluate(() => document.body.innerText);
	if (text.includes('—')) throw new Error('em dash found in page text');
});

// The teightysix detail page is deliberately unrendered this release
// (build.render: never). The dev server still serves such pages for preview,
// so a status-code check is meaningless here; the production build omits the
// directory entirely. The sitemap and index.json are built from the global
// page collections in both modes, so they catch any regression of the build
// block (removing it, or widening list: local).
await runTest('withheld teightysix page is not in the sitemap or the search index', async () => {
	const sitemap = await (await fetch(`${BASE_URL}/sitemap.xml`)).text();
	if (sitemap.includes('/projects/teightysix/')) throw new Error('sitemap lists the unrendered page');
	const index = await (await fetch(`${BASE_URL}/index.json`)).text();
	if (index.includes('/projects/teightysix/')) throw new Error('index.json lists the unrendered page');
});

// layouts/projects/list.html resolves its partial as (printf "%sSummary" .Type),
// so /projects/ needs layouts/partials/projectsSummary.html. Without the site
// override Hugo silently falls back to the theme's plain summary, which has no
// .project-card at all.
await runTest('/projects/ renders the teightysix card with the live link first and no dead details link', async () => {
	await page.goto(`${BASE_URL}/projects/`, { waitUntil: 'networkidle0' });
	const cards = await page.$$eval('.project-card', els => els.length);
	if (!cards) throw new Error('no .project-card on /projects/ (theme fallback partial?)');
	const links = await page.evaluate(() => {
		const card = [...document.querySelectorAll('.project-card')]
			.find(c => c.querySelector('a[href="https://cards.roojerry.com/"]'));
		if (!card) return null;
		return [...card.querySelectorAll('.project-card__links a')]
			.map(a => ({ cls: a.className, href: a.getAttribute('href') }));
	});
	if (!links) throw new Error('no teightysix card on /projects/');
	if (!links[0].cls.includes('project-card__link--live')) throw new Error(`first card link: ${links[0].cls}`);
	if (links[0].href !== 'https://cards.roojerry.com/') throw new Error(`live href: ${links[0].href}`);
	if (links.some(l => l.href && l.href.includes('/projects/teightysix/'))) {
		throw new Error('card links the unrendered detail page');
	}
});

await browser.close();
if (failures) process.exit(1);
console.log('project-detail: all passed');
