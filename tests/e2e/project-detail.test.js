#!/usr/bin/env node
// tests/e2e/project-detail.test.js
import puppeteer from 'puppeteer';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL } from '../helpers/server.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
async function runTest(name, fn) {
	try { await fn(); console.log(`  ✓ ${name}`); }
	catch (e) { failures++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// The story list out of the page's own frontmatter, so the assertions below
// compare the rendered strip against its source rather than a magic number.
function storyEntries(file) {
	const front = readFileSync(join(ROOT, 'content', 'projects', file), 'utf8').split('---')[1];
	const lines = front.split('\n');
	const start = lines.findIndex(l => l === 'story:');
	if (start < 0) throw new Error(`${file} has no story list`);
	const entries = [];
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break;                       // next top-level key
		const m = line.match(/^\s*(?:- )?(src|text|title): "(.*)"\s*$/);
		if (!m) continue;
		if (/^\s*- /.test(line)) entries.push({});
		if (entries.length) entries[entries.length - 1][m[1]] = m[2];
	}
	return entries;
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const URL = `${BASE_URL}/projects/teightysix/`;
const story = storyEntries('teightysix.md');
const complete = story.filter(e => e.src && e.text);

await runTest('story strip renders exactly the complete entries, in order', async () => {
	await page.goto(URL, { waitUntil: 'networkidle0' });
	const srcs = await page.$$eval('.story-strip__row img', imgs => imgs.map(i => i.getAttribute('src')));
	if (srcs.length !== complete.length) {
		throw new Error(`frontmatter has ${complete.length} complete entries, page rendered ${srcs.length} rows`);
	}
	const want = complete.map(e => e.src);
	if (srcs.join('|') !== want.join('|')) throw new Error(`row srcs\n      got  ${srcs.join(', ')}\n      want ${want.join(', ')}`);
	const empty = await page.$$eval('.story-strip__row',
		els => els.filter(r => !r.querySelector('img') || !r.querySelector('figcaption p')?.textContent.trim()).length);
	if (empty) throw new Error(`${empty} story rows are incomplete`);
});

await runTest('story strip skips entries missing src or text', async () => {
	// A throwaway project page with one complete entry and two broken ones.
	// build.list: never keeps it out of the wall, the sitemap and index.json.
	const name = 'zz-story-fixture';
	const file = join(ROOT, 'content', 'projects', `${name}.md`);
	const good = '/img/projects/teightysix/story/alphabet.png';
	writeFileSync(file, [
		'---',
		'title: "Story fixture"',
		'build:',
		'  list: never',
		'story:',
		`  - src: "${good}"`,
		'    title: "Complete"',
		'    text: "This entry has both a src and text, so it renders."',
		'  - title: "No src"',
		'    text: "This entry has no src, so it must not render."',
		`  - src: "${good}"`,
		'    title: "No text"',
		'---',
		'',
	].join('\n'));
	try {
		const url = `${BASE_URL}/projects/${name}/`;
		const deadline = Date.now() + 10000;                  // wait out hugo's live reload
		let ok = false;
		while (Date.now() < deadline) {
			const res = await fetch(url).catch(() => null);
			if (res?.status === 200) { ok = true; break; }
			await new Promise(r => setTimeout(r, 250));
		}
		if (!ok) throw new Error(`${url} never returned 200 within 10s`);

		await page.goto(url, { waitUntil: 'networkidle0' });
		const srcs = await page.$$eval('.story-strip__row img', imgs => imgs.map(i => i.getAttribute('src')));
		if (srcs.length !== 1) throw new Error(`expected 1 row from 3 entries, got ${srcs.length}`);
		if (srcs[0] !== good) throw new Error(`rendered row src ${srcs[0]}, expected ${good}`);
	} finally {
		unlinkSync(file);
	}
});

await runTest('story images are lazy and have alt text', async () => {
	await page.goto(URL, { waitUntil: 'networkidle0' });
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

// layouts/projects/list.html resolves its partial as (printf "%sSummary" .Type),
// so /projects/ needs layouts/partials/projectsSummary.html. Without the site
// override Hugo silently falls back to the theme's plain summary, which has no
// .project-card at all.
await runTest('/projects/ renders project cards with the live link first', async () => {
	await page.goto(`${BASE_URL}/projects/`, { waitUntil: 'networkidle0' });
	const cards = await page.$$eval('.project-card', els => els.length);
	if (!cards) throw new Error('no .project-card on /projects/ (theme fallback partial?)');
	const links = await page.evaluate(() => {
		const card = [...document.querySelectorAll('.project-card')]
			.find(c => c.querySelector('a[href*="/projects/teightysix/"]'));
		if (!card) return null;
		return [...card.querySelectorAll('.project-card__links a')]
			.map(a => ({ cls: a.className, href: a.getAttribute('href') }));
	});
	if (!links) throw new Error('no teightysix card on /projects/');
	if (!links[0].cls.includes('project-card__link--live')) throw new Error(`first card link: ${links[0].cls}`);
	if (links[0].href !== 'https://cards.roojerry.com/') throw new Error(`live href: ${links[0].href}`);
});

await browser.close();
if (failures) process.exit(1);
console.log('project-detail: all passed');
