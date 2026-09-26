# teightysix Showpiece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put teightysix (cards.roojerry.com) at the top of the portfolio home page with its own detail page, and rewrite every project page's copy so none of it reads as machine-written.

**Architecture:** Hugo static site. A `showpiece: true` frontmatter flag renders a full-width lead tile in the experiments wall above the featured grid. The detail page reuses the existing feature grid, compare slider and lightbox grid, and adds one new `story` section. Assets are exported from the teightysix repo's kept capture stream plus two live-site captures. Copy is rewritten under the `deslop` skill rules.

**Tech Stack:** Hugo (`/opt/homebrew/bin/hugo`), Node 22 via nvm, Puppeteer e2e tests (`npm test`), `cwebp`, purgecss on build.

**Spec:** `docs/superpowers/specs/2026-09-25-teightysix-showpiece-design.md`

## Global Constraints

- Node: `source ~/.nvm/nvm.sh && nvm use` before any `npm`/`node`/`npx`.
- Indentation: tabs in new files (existing files keep their own style).
- Copy: zero em dashes (`—`) in `content/projects/**` and in visible strings under `layouts/**`. No "not X, just Y", no "no A, no B, just C", no bold-first bullets, no tricolon where two items do. Rules and catalog: `~/.claude/skills/deslop/SKILL.md` and its `references/`.
- Content rule (D13): portfolio frames may show invented players, the Commons-attributed showcase, process/tooling frames, and the live site's `og.jpg`. No frame whose subject is a real player rendered from the parent repo's local content (Ohtani, Trout, Betts, Rutschman, Witt, Ober, Bo Jackson). The copy says "invented players, plus a small attributed showcase", never "no real players".
- Icons must exist in `layouts/partials/icon.html` (hardcoded dictionary, no webfont). `external-link-alt`, `github`, `download`, `play`, `times`, `expand` exist.
- Image extension must match bytes. WebP via `cwebp -q 82`. New bytes under `static/img/projects/teightysix/` total under 4 MB.
- Cache-busters: `projects.css?v=5` becomes `?v=6`; `experiments-wall.css` gets `?v=2`.
- purgecss runs on `npm run build` over `public/**/*.html`; any class only added by JS at runtime must go in `purgecss.config.js` safelist. Nothing in this plan adds runtime classes.
- Commit only your own paths with explicit `git add <paths>`. No `git add -A`, no bare `git stash`.
- No Co-Authored-By or Claude-Session trailers in commits.

## Review Focus

1. Two pages carry `showpiece: true`: the wall must render exactly one showpiece tile and demote the rest to ordinary featured tiles (Task 1 test).
2. A project with `live` but no `github`: header and CTA must still render, with the live link first (Task 3 test).
3. `story` entries missing `text` or `src`: the strip must skip the incomplete row rather than emit an empty figure (Task 2 test).
4. Narrow viewport (390px): the showpiece tile stacks, no horizontal scroll (Task 1 visual check, Task 9 check).
5. A screenshot grid item whose webp is missing: the lightbox opens a broken image. Task 7 verifies every referenced path exists on disk before commit.

---

## Ownership map (for parallel dispatch)

| Worker | Owns | Tasks |
|---|---|---|
| A (template + page) | `layouts/**`, `static/css/**`, `tests/**`, `content/projects/teightysix.md`, `purgecss.config.js` | 1, 2, 3, 4 |
| B (assets + polish) | `static/img/projects/teightysix/**`, `content/projects/*.md` except `teightysix.md` | 5, 6, 7 |
| Coordinator | integration, review dispatch, PR | 8, 9 |

Worker A writes `teightysix.md` against the asset paths fixed in Task 5's table without waiting for the files. Both workers commit by explicit path in the same worktree.

---

### Task 1: Showpiece tile on the home page

**Files:**
- Create: `layouts/partials/showpieceTile.html`
- Modify: `layouts/partials/experimentsWall.html`
- Modify: `static/css/experiments-wall.css`
- Modify: `layouts/_default/baseof.html:38`
- Test: `tests/e2e/showpiece.test.js`

**Interfaces:**
- Consumes: page params `showpiece`, `poster`, `title`, `subtitle`, `blurb`, `live`, `Permalink`.
- Produces: DOM `a.exp-showpiece` (one per page), containing `.exp-showpiece__media img`, `.exp-showpiece__cap`, `.exp-showpiece__cta--live[href=live]`, `.exp-showpiece__cta--details[href=permalink]`.

- [ ] **Step 1: Write the failing test**

```js
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
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use && node tests/e2e/showpiece.test.js` (start `npm run dev` in another terminal first, or run `npm test`).
Expected: FAIL, `expected 1 showpiece, got 0`.

- [ ] **Step 3: Create the tile partial**

```html
{{- /* layouts/partials/showpieceTile.html: the one lead project above the featured grid */ -}}
{{- $p := . -}}
{{- $poster := $p.Params.poster | default $p.Params.image -}}
{{- $webp := $poster | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
{{- $blurb := $p.Params.blurb | default $p.Params.subtitle | default $p.Description -}}
<a class="exp-showpiece" href="{{ $p.Permalink }}" aria-label="{{ $p.Title }}: {{ $blurb }}">
	<span class="exp-showpiece__media">
		<picture>
			{{ if ne $webp $poster }}<source srcset="{{ $webp }}" type="image/webp">{{ end }}
			<img src="{{ $poster }}" alt="{{ $p.Title }} preview" width="1280" height="800" loading="eager" fetchpriority="high">
		</picture>
		<span class="exp-tile__badge exp-tile__badge--project">showpiece</span>
	</span>
	<span class="exp-showpiece__cap">
		<b>{{ $p.Title }}{{ with $p.Params.subtitle }}<span class="exp-showpiece__sub"> {{ . }}</span>{{ end }}</b>
		<span class="exp-showpiece__blurb">{{ $blurb }}</span>
		<span class="exp-showpiece__ctas">
			{{ with $p.Params.live }}
			<span class="exp-showpiece__cta exp-showpiece__cta--live" data-href="{{ . }}">
				{{ partial "icon.html" (dict "icon" "fas fa-external-link-alt") }} Make a card
			</span>
			{{ end }}
			<span class="exp-showpiece__cta exp-showpiece__cta--details">How it was built</span>
		</span>
	</span>
</a>
```

Nested anchors are invalid HTML, so the live CTA cannot be an `<a>` inside the tile link. Use two sibling anchors instead: restructure so the tile is a `<div class="exp-showpiece">` with the poster and title wrapped in one `<a href=permalink>` and the CTAs as sibling anchors. Final markup:

```html
{{- $p := . -}}
{{- $poster := $p.Params.poster | default $p.Params.image -}}
{{- $webp := $poster | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
{{- $blurb := $p.Params.blurb | default $p.Params.subtitle | default $p.Description -}}
<article class="exp-showpiece">
	<a class="exp-showpiece__media" href="{{ $p.Permalink }}" aria-label="{{ $p.Title }}: how it was built">
		<picture>
			{{ if ne $webp $poster }}<source srcset="{{ $webp }}" type="image/webp">{{ end }}
			<img src="{{ $poster }}" alt="{{ $p.Title }} preview" width="1280" height="800" loading="eager" fetchpriority="high">
		</picture>
		<span class="exp-tile__badge exp-tile__badge--project">showpiece</span>
	</a>
	<div class="exp-showpiece__cap">
		<h3 class="exp-showpiece__title">{{ $p.Title }}{{ with $p.Params.subtitle }}<span class="exp-showpiece__sub"> {{ . }}</span>{{ end }}</h3>
		<p class="exp-showpiece__blurb">{{ $blurb }}</p>
		<div class="exp-showpiece__ctas">
			{{ with $p.Params.live }}
			<a class="exp-showpiece__cta exp-showpiece__cta--live" href="{{ . }}" target="_blank" rel="noopener noreferrer">
				{{ partial "icon.html" (dict "icon" "fas fa-external-link-alt") }} Make a card
			</a>
			{{ end }}
			<a class="exp-showpiece__cta exp-showpiece__cta--details" href="{{ $p.Permalink }}">How it was built</a>
		</div>
	</div>
</article>
```

Use the second version. The first is shown only so the reviewer sees why.

- [ ] **Step 4: Wire it into the wall**

Replace the featured block in `layouts/partials/experimentsWall.html`:

```html
		{{- $projects := .GetPage "section" "projects" -}}
		{{- $featured := where $projects.Pages "Params.featured" true -}}
		{{- $showpiece := index (where $featured "Params.showpiece" true).ByWeight 0 -}}
		{{- $experiments := (.GetPage "section" "experiments").Pages.ByWeight -}}

		<h2 class="mb-4">{{ i18n "projects" }}</h2>
		{{- with $showpiece -}}
			{{ partial "showpieceTile.html" . }}
		{{- end -}}
		<div class="exp-grid exp-grid--featured">
			{{- range $featured -}}
				{{- if and $showpiece (eq .Permalink $showpiece.Permalink) -}}{{- continue -}}{{- end -}}
				{{ partial "experimentTile.html" (dict "page" . "kind" "project") }}
			{{- end -}}
		</div>
```

`index ... 0` on an empty slice errors in Hugo; guard it:

```html
		{{- $sp := where $featured "Params.showpiece" true -}}
		{{- $showpiece := "" -}}
		{{- if gt (len $sp) 0 -}}{{- $showpiece = index $sp.ByWeight 0 -}}{{- end -}}
```

- [ ] **Step 5: Styles**

Append to `static/css/experiments-wall.css`:

```css
/* Showpiece: the one lead project, full width above the featured grid */
.exp-showpiece {
	display: grid;
	grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
	gap: 0;
	margin-bottom: 26px;
	border-radius: var(--radius-lg);
	overflow: hidden;
	background: rgb(255 255 255 / 0.45);
	box-shadow: var(--shadow-card);
}
.exp-showpiece__media {
	position: relative;
	display: block;
	min-width: 0;
	line-height: 0;
}
.exp-showpiece__media img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}
.exp-showpiece__media .exp-tile__badge { position: absolute; top: 12px; left: 12px; }
.exp-showpiece__cap {
	padding: 28px 28px 26px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 0;
}
.exp-showpiece__title {
	font-size: 1.6rem;
	line-height: 1.15;
	margin: 0 0 8px;
}
.exp-showpiece__sub {
	display: block;
	font-size: 0.95rem;
	font-weight: 400;
	color: var(--muted);
	text-transform: none;
	letter-spacing: 0;
}
.exp-showpiece__blurb {
	font-size: 0.95rem;
	line-height: 1.5;
	color: var(--muted);
	margin: 0 0 18px;
}
.exp-showpiece__ctas { display: flex; flex-wrap: wrap; gap: 10px; }
.exp-showpiece__cta {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 10px 16px;
	border-radius: var(--radius-md);
	font-size: 0.9rem;
	font-weight: 600;
	text-decoration: none;
	border: 1px solid transparent;
}
.exp-showpiece__cta svg { width: 14px; height: 14px; }
.exp-showpiece__cta--live { background: var(--brand); color: #fff; }
.exp-showpiece__cta--live:hover,
.exp-showpiece__cta--live:focus-visible { background: var(--brand-dark); color: #fff; text-decoration: none; }
.exp-showpiece__cta--details { border-color: var(--brand); color: var(--brand); background: transparent; }
.exp-showpiece__cta--details:hover,
.exp-showpiece__cta--details:focus-visible { background: rgb(var(--brand-rgb) / 0.08); text-decoration: none; }
@media (max-width: 767px) {
	.exp-showpiece { grid-template-columns: 1fr; }
	.exp-showpiece__cap { padding: 20px 18px 22px; }
	.exp-showpiece__title { font-size: 1.35rem; }
}
```

Check `design-system.css` for the exact token names (`--brand`, `--brand-dark`, `--brand-rgb`, `--radius-lg`, `--radius-md`, `--shadow-card`, `--muted`) and substitute if any differ.

Bump the link in `layouts/_default/baseof.html` to `/css/experiments-wall.css?v=2`.

- [ ] **Step 6: Temporary fixture so the test can pass before Task 4**

Create a minimal `content/projects/teightysix.md` now (Task 4 replaces it):

```yaml
---
title: "teightysix"
subtitle: "make a 1986 baseball card"
description: "Drop in a photograph and it comes back a 1986-style baseball card, drawn in your browser."
live: "https://cards.roojerry.com/"
github: "https://github.com/brianruggieri/teightysix"
poster: "/img/projects/teightysix/poster.webp"
image: "/img/projects/teightysix/hero.png"
showpiece: true
featured: true
weight: 1
year: "2026"
---
```

- [ ] **Step 7: Run the test and the whole suite**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: showpiece tests PASS; `experiments-wall.test.js` still PASS (it queries `.exp-tile--project`, which the other featured pages still provide).

- [ ] **Step 8: Commit**

```bash
git add layouts/partials/showpieceTile.html layouts/partials/experimentsWall.html static/css/experiments-wall.css layouts/_default/baseof.html tests/e2e/showpiece.test.js content/projects/teightysix.md
git commit -m "Add showpiece lead tile to the projects wall"
```

---

### Task 2: Story strip section on the detail page

**Files:**
- Modify: `layouts/projects/single.html` (after the "What it does" block, before "How it works")
- Modify: `static/css/projects.css` (append), `layouts/_default/baseof.html:36` (`?v=6`)
- Test: `tests/e2e/project-detail.test.js`

**Interfaces:**
- Consumes: frontmatter `story: [{src, title, text}]`.
- Produces: DOM `section.story-strip` with `figure.story-strip__row` per complete entry, each holding `picture img` and `figcaption` with `h4.story-strip__title` and `p`.

- [ ] **Step 1: Write the failing test**

```js
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

await runTest('story images are lazy and have alt text', async () => {
	const bad = await page.$$eval('.story-strip__row img', imgs => imgs.filter(i => i.loading !== 'lazy' || !i.alt).length);
	if (bad) throw new Error(`${bad} story images missing lazy/alt`);
});

await runTest('header shows the live link before GitHub', async () => {
	const links = await page.$$eval('.project-detail__header-links a', as => as.map(a => a.className));
	if (!links[0] || !links[0].includes('project-card__link--live')) throw new Error(`first header link: ${links[0]}`);
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
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use && node tests/e2e/project-detail.test.js`
Expected: FAIL on the story-strip count (0 rows) and the header link.

- [ ] **Step 3: Template block**

Insert into `layouts/projects/single.html` between the features block and the pipeline block:

```html
    {{/* ── Story strip: process frames with a paragraph each ── */}}
    {{ with .Params.story }}
    <h3 class="project-section-heading">How it was built</h3>
    <section class="story-strip" aria-label="Build story">
      {{ range . }}
      {{ if and .src .text }}
      {{ $webp := .src | replaceRE `\.(png|jpg|jpeg)$` ".webp" }}
      <figure class="story-strip__row">
        <picture class="story-strip__media">
          {{ if ne $webp .src }}<source srcset="{{ $webp }}" type="image/webp">{{ end }}
          <img src="{{ .src }}" alt="{{ .title | default .text }}" loading="lazy" />
        </picture>
        <figcaption class="story-strip__text">
          {{ with .title }}<h4 class="story-strip__title">{{ . }}</h4>{{ end }}
          <p>{{ .text }}</p>
        </figcaption>
      </figure>
      {{ end }}
      {{ end }}
    </section>
    {{ end }}
```

- [ ] **Step 4: Styles**

Append to `static/css/projects.css`:

```css
/* ── Story strip (How it was built) ── */
.story-strip {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-bottom: 2.5rem;
}
.story-strip__row {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 1.5rem;
    align-items: center;
    margin: 0;
}
.story-strip__row:nth-child(even) .story-strip__media { order: 2; }
.story-strip__media {
    display: block;
    line-height: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    background: var(--bg-mid);
}
.story-strip__media img { width: 100%; height: auto; display: block; }
.story-strip__text { min-width: 0; }
.story-strip__title {
    font-size: 1.05rem;
    margin: 0 0 0.5rem;
    text-transform: none;
    letter-spacing: 0;
}
.story-strip__text p {
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--muted);
    margin: 0;
    max-width: 48ch;
}
@media (max-width: 767px) {
    .story-strip__row { grid-template-columns: 1fr; gap: 0.9rem; }
    .story-strip__row:nth-child(even) .story-strip__media { order: 0; }
}
```

Bump `projects.css?v=5` to `?v=6` in `layouts/_default/baseof.html`.

- [ ] **Step 5: Add `live` to the detail header and CTA**

In `single.html`, inside `.project-detail__header-links` before the github anchor:

```html
        {{ with .Params.live }}
        <a href="{{ . }}" class="project-card__link project-card__link--live"
           target="_blank" rel="noopener noreferrer">
          {{ partial "icon.html" (dict "icon" "fas fa-external-link-alt") }} Open the bench
        </a>
        {{ end }}
```

Change the CTA guard to `{{ if or .Params.live .Params.github .Params.release }}` and add the same anchor (label "Open the bench") first inside `.project-cta__actions`. Add to `projects.css` next to `.project-card__link--github`:

```css
.project-card__link--live { background: var(--brand); color: #fff; border-color: var(--brand); }
.project-card__link--live:hover,
.project-card__link--live:focus-visible { background: var(--brand-dark); color: #fff; }
```

Match the existing `--github` and `--release` rule shapes (read them first; they may set `border`, `padding`, hover transforms).

- [ ] **Step 6: Drop em dashes from template strings**

In `layouts/projects/single.html`: alt `"{{ $.Title }} — {{ $afterLabel }}"` becomes `"{{ $.Title }}, {{ $afterLabel }}"` (both compare images); `"{{ $.Title }} — hero screenshot"` becomes `"{{ $.Title }} hero screenshot"`; `printf "%s — screenshot"` becomes `printf "%s screenshot"`; aria-label `"... — fullscreen"` becomes `"... fullscreen"`. In `layouts/partials/experimentTile.html` and `showpieceTile.html`: `alt="{{ $title }} — preview"` becomes `alt="{{ $title }} preview"`. In `layouts/_default/baseof.html:7`: `printf "%s — %s"` becomes `printf "%s | %s"`. Leave HTML comments alone. Do not touch `layouts/fit/**` (generated report template, out of scope).

- [ ] **Step 7: Run the tests**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: the story-strip and lightbox tests still FAIL until Task 4 adds the content; header link and em dash tests PASS. Note which fail and proceed to Task 3 and 4; the suite must be green by the end of Task 4.

- [ ] **Step 8: Commit**

```bash
git add layouts/projects/single.html static/css/projects.css layouts/_default/baseof.html layouts/partials/experimentTile.html tests/e2e/project-detail.test.js
git commit -m "Add story strip and live link to project detail pages"
```

---

### Task 3: Live link on ordinary featured tiles and dead partial cleanup

**Files:**
- Delete: `layouts/partials/projectsSummary.html` (unused since PR #21; `grep -rn projectsSummary layouts themes` returns nothing)
- Modify: `tests/e2e/project-detail.test.js` (add the no-github case)

- [ ] **Step 1: Confirm the partial is dead**

Run: `grep -rn 'projectsSummary' layouts themes content hugo.toml`
Expected: no output. If any caller exists, keep the file and skip this task.

- [ ] **Step 2: Delete it and build**

```bash
git rm layouts/partials/projectsSummary.html
/opt/homebrew/bin/hugo --minify --renderToMemory
```
Expected: build succeeds.

- [ ] **Step 3: Test the live-without-github case with a temporary page**

Create `content/projects/zz-live-only.md`:

```yaml
---
title: "Live only"
live: "https://example.com/"
featured: false
build:
  list: never
---
```

Add to `tests/e2e/project-detail.test.js`:

```js
await runTest('live-only project still renders header and CTA', async () => {
	await page.goto(`${BASE_URL}/projects/zz-live-only/`, { waitUntil: 'networkidle0' });
	const header = await page.$('.project-detail__header-links .project-card__link--live');
	const cta = await page.$('.project-cta .project-card__link--live');
	if (!header || !cta) throw new Error('live-only page lost header or CTA link');
});
```

Run it, confirm PASS, then delete `content/projects/zz-live-only.md` and delete that test block (it depended on a fixture that must not ship). Record the pass in the commit message.

- [ ] **Step 4: Commit**

```bash
git add -u layouts/partials/projectsSummary.html tests/e2e/project-detail.test.js
git commit -m "Remove unused projectsSummary partial; live-only header/CTA verified"
```

---

### Task 4: The teightysix page content

**Files:**
- Modify: `content/projects/teightysix.md` (replace the Task 1 stub)

**Interfaces:**
- Consumes: asset paths from Task 5's table (write them now; files arrive from Worker B).
- Produces: the page.

- [ ] **Step 1: Read the sources**

Read, in the teightysix repo (`~/git/baseball-cards/teightysix/.claude/`): `SPEC.md` (Vision, recipe), `HANDOFF.md` (state summary), `ROADMAP.md` (M1, M2, presentation, wear3d, back sections), `PLAN-RELEASE.md` §4.2 and §4.4, and the kept-manifest lines for the frames listed in Task 5. Note exact numbers with their source file: 98/98 parity fixtures (HANDOFF), 256 live cards and 2000 resident (PLAN-RELEASE §4.1), 0.45 mm cut edge (captures manifest), engine perf 63% (ROADMAP), rarity mix 10/4/1 per hundred (manifest `realistic-2000`).

- [ ] **Step 2: Write the frontmatter**

```yaml
---
title: "teightysix"
subtitle: "make a 1986 baseball card"
description: "Drop in a photograph and it comes back a 1986-style baseball card, drawn in your browser and byte-exact to the Python press it was ported from."
blurb: "A 1986-style card press in the browser: WebGPU render, a 3D pile, wear you can dial, and a typeface rebuilt from scans."
tags: ["TypeScript", "Svelte", "WebGPU", "Three.js", "Rapier", "Cloudflare Workers", "Python parity"]
statusLabel: "1.0.0 live at cards.roojerry.com"
live: "https://cards.roojerry.com/"
github: "https://github.com/brianruggieri/teightysix"
ctaTitle: "Make one"
ctaDesc: "The bench runs in the browser. Your photograph stays on your machine."
image: "/img/projects/teightysix/hero.png"
poster: "/img/projects/teightysix/poster.webp"
showpiece: true
featured: true
weight: 1
year: "2026"
# Sources for the numbers in this page: teightysix/.claude/HANDOFF.md (98/98 parity),
# PLAN-RELEASE.md §4.1 (256 live / 2000 resident), ROADMAP.md (render perf),
# captures/captures.jsonl (0.45 mm edge, 10/4/1 rarity mix).
compare:
  before: "/img/projects/teightysix/press-empty.png"
  after: "/img/projects/teightysix/press-loaded.png"
  beforeLabel: "Empty"
  afterLabel: "Loaded"
  caption: "The press as it opens, and the same bench a moment after a sample photograph goes in."
featureColumns: 3
features:
  - icon: "fas fa-check"
    title: "Byte-exact to the Python press"
    desc: "The TypeScript and WebGPU engine reproduces the parent pipeline's output pixel for pixel. 98 of 98 parity fixtures match, and self-hashes are frozen per engine version."
  - icon: "fas fa-cube"
    title: "A pile that is really there"
    desc: "Published cards fall into a shared 3D scene, tumble under Rapier physics and settle face up. 256 cards stay live geometry and the rest bake into the table."
  - icon: "fas fa-hand-paper"
    title: "Wear you can dial"
    desc: "Wear, age, print strength and miscut are recipe fields. The card is a solid with a measured 0.45 mm cut edge, and the corners chip back to board as you turn the knob."
  - icon: "fas fa-font"
    title: "An alphabet rebuilt"
    desc: "The 1986 type never existed as a font. The parent project drew it glyph by glyph from scans, with its own kern table, and the bench sets every name in it."
  - icon: "fas fa-sync"
    title: "The back turns over"
    desc: "Every card carries a period back with a career table. Invented players get a blended career in blue ink; the attributed showcase carries its real record in red."
  - icon: "fas fa-star"
    title: "Foil at real odds"
    desc: "Rare, holo and legendary finishes land at 10, 4 and 1 per hundred publishes. Legendary strikes every black mark on the front in gold."
screenshotsGrid: true
screenshots:
  - src: "/img/projects/teightysix/shots/position-board.webp"
    caption: "The position control is a chalked field with nine lamp plates"
  - src: "/img/projects/teightysix/shots/team-colours.webp"
    caption: "Eight fronts in eight clubs' two-colour schemes"
  - src: "/img/projects/teightysix/shots/career-you-chose.webp"
    caption: "An invented back with a career picked from the bench's chips"
  - src: "/img/projects/teightysix/shots/back-before-you-send-it.webp"
    caption: "The back, turned over on the bench before publish"
  - src: "/img/projects/teightysix/shots/pile-background.webp"
    caption: "The press bench floating over the live pile"
  - src: "/img/projects/teightysix/shots/real-odds.webp"
    caption: "Two thousand cards at the shipped rarity mix"
  - src: "/img/projects/teightysix/shots/cut-corner-ladder.webp"
    caption: "One bottom-right cut, mint to attic find"
  - src: "/img/projects/teightysix/shots/tarot.webp"
    caption: "The Major Arcana as 1880s chromolithograph baseball cards"
story:
  - src: "/img/projects/teightysix/story/alphabet.png"
    title: "The typeface came first"
    text: "The 1986 type was never a font. The parent project drew the full cut from scans, A to Z in two heavy rows, and built a kern table to match. Every name the bench sets goes through it, and a look change still arrives from the parent through one re-pin door."
  - src: "/img/projects/teightysix/story/mascot-bake-off.png"
    title: "Four models drew the mascot"
    text: "One four-pose line-art brief, four image models, one row each. gpt-image-2 stayed on model in every cell. FLUX shrank the character to a stamp, Qwen bled grey backgrounds into the swing, and Playground drew a full-colour boy instead. The bake-off picked the model for every Baseball Man on the backs."
  - src: "/img/projects/teightysix/story/three-hands.png"
    title: "Three hands on the bat"
    text: "A chromolithograph card that would pass for a Library of Congress scan, except the batter has three hands. Frames like this are why the public set is invented players on generated portraits with a human looking at every one before it ships."
  - src: "/img/projects/teightysix/story/pile-runaway.png"
    title: "Ten thousand cards, one bad column"
    text: "Ten thousand cards at 256 live, six draw calls, 120 fps, and a 1.5 metre shredded spire floating over its own table. The cost was flat and the geometry was out of envelope. The frame stayed in the record because it tells both truths at once."
  - src: "/img/projects/teightysix/story/pile-fixed.png"
    title: "The same scene, fixed"
    text: "Same ten thousand cards, same camera. The pile now lies 233 millimetres deep on the table where the column used to float, with the readouts beside it unchanged."
  - src: "/img/projects/teightysix/story/wrong-uniforms.png"
    title: "Nobody is in the right uniform"
    text: "The whole set rebuilt on freely licensed photographs, all sixty fronts in one sheet. The team name across the top almost never matches the jersey under it, and every credited card prints its photographer, licence and Commons link in the bottom margin. That is the showcase, and it is the only real likeness the site ships."
---
```

The story texts above are drafts from the manifest `caption`, `reason` and `context` fields; tighten them against those fields and the deslop checklist, keep every number. Check every icon name exists in `layouts/partials/icon.html`; swap any that does not for one that does.

- [ ] **Step 3: Write the body**

About 250 words, first person, plain. Cover in this order: what a visitor does (drop a photo, pick a place name and position, turn the knobs, turn it over); the parity claim with the number; the pile and what stays live; wear as a physical model; the typeface; the content posture in one sentence ("The public set is invented players on generated portraits, plus a small showcase of Commons-licensed photographs with credit printed on the card"); one closing sentence on what is still in progress (the publish backend, Stage 2). Then run the deslop checklist from `~/.claude/skills/deslop/SKILL.md` on the whole file. `grep -c '—' content/projects/teightysix.md` must print 0.

- [ ] **Step 4: Run the suite**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: all PASS once Worker B's assets exist. If assets are not there yet, the story rows and lightbox still render (the tests check DOM, not image bytes); confirm and note it in the commit.

- [ ] **Step 5: Commit**

```bash
git add content/projects/teightysix.md
git commit -m "Add teightysix showpiece page"
```

---

### Task 5: Export the frames

**Files:**
- Create: `static/img/projects/teightysix/{hero.png,hero.webp,poster.webp,press-empty.png,press-empty.webp,press-loaded.png,press-loaded.webp}`
- Create: `static/img/projects/teightysix/shots/*.webp` (8)
- Create: `static/img/projects/teightysix/story/*.{png,webp}` (6)
- Create: `scripts/export-teightysix-frames.sh`

**Interfaces:**
- Produces the exact paths Task 4 references. Source frames from `~/git/baseball-cards/teightysix/.claude/captures/kept/`:

| target | source | max width |
|---|---|---|
| `poster.webp` | `the-pile-is-the-background.png` | 1280 |
| `hero.png/.webp` | same as `press-loaded` | 1800 |
| `press-empty.*` | live-site capture (Step 2) | 1800 |
| `press-loaded.*` | live-site capture (Step 2) | 1800 |
| `shots/position-board.webp` | `pick-a-spot-on-the-field.png` | 732 (native) |
| `shots/team-colours.webp` | `the-frame-takes-team-colors.jpg` | 1200 |
| `shots/career-you-chose.webp` | `the-career-you-chose.png` | 1594 |
| `shots/back-before-you-send-it.webp` | `the-back-before-you-send-it.png` | 1594 |
| `shots/pile-background.webp` | `the-pile-is-the-background.png` | 1440 |
| `shots/real-odds.webp` | `realistic-2000.png` | 1600 |
| `shots/cut-corner-ladder.webp` | `wear3d-cut-corner-ladder.png` | 1000 |
| `shots/tarot.webp` | `twenty-two-cards-of-a-baseball-tarot.png` | 1600 |
| `story/alphabet.*` | `an-alphabet-rebuilt-from-nothing.png` | 1600 |
| `story/mascot-bake-off.*` | `four-models-drew-baseball-man.png` | 1600 |
| `story/three-hands.*` | `three-hands-on-the-bat.png` | 1024 (native) |
| `story/pile-runaway.*` | `infinite-pile-10k.png` | 1600 |
| `story/pile-fixed.*` | `ten-thousand-cards-redeemed.png` | 1600 |
| `story/wrong-uniforms.*` | `nobody-wears-the-right-uniform.png` | 1600 |

- [ ] **Step 1: Content check on every source frame**

Open each source (Read tool on the PNG) and its manifest line (`grep '"file": "<name>"' captures.jsonl`). Confirm no frame shows a real player from the parent's local content. Two frames were already swapped out at plan time for that reason (`identity-resampled-away.png` shows Mookie Betts, `sixty-cards-three-sheets.png` is the real-player print master), which is why the table uses `three-hands-on-the-bat.png` and `twenty-two-cards-of-a-baseball-tarot.png`. If any other frame fails the check, pick a replacement from the kept set that passes, record the swap in `.codex/SHOWPIECE-ASSETS.md`, and message the coordinator so Task 4's path changes with it.

- [ ] **Step 2: Capture the compare pair from the live site**

Use Playwright (`playwright-core` is not in this repo; Puppeteer is). Script `scripts/capture-teightysix-press.mjs`:

```js
#!/usr/bin/env node
// Captures the empty press and the same bench with a sample photo loaded, same viewport.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
const out = 'static/img/projects/teightysix';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
await page.goto('https://cards.roojerry.com/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: `${out}/press-empty.png` });
// Load a sample photograph. Find the control by reading the DOM first:
// document.querySelectorAll('button, [role=button]') and pick the sample chooser.
const sample = await page.$('[data-sample], button.sample, .samples button');
if (!sample) throw new Error('sample control not found; inspect the DOM and update the selector');
await sample.click();
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: `${out}/press-loaded.png` });
await browser.close();
```

Headless Chrome may not have WebGPU. If the empty press renders blank, capture with the chrome-devtools MCP tools against a real Chrome window at 1600x1000 instead, saving to the same paths. Both frames must be identically framed. If the samples control cannot be found in the DOM, ask the coordinator rather than guessing.

- [ ] **Step 3: Export script**

```bash
#!/usr/bin/env bash
# scripts/export-teightysix-frames.sh: kept capture frames -> site assets
set -euo pipefail
SRC=~/git/baseball-cards/teightysix/.claude/captures/kept
OUT=static/img/projects/teightysix
mkdir -p "$OUT/shots" "$OUT/story"
webp() { cwebp -quiet -q 82 -resize "$3" 0 "$1" -o "$2"; }
png()  { sips -Z "$3" "$1" --out "$2" >/dev/null; }

webp "$SRC/the-pile-is-the-background.png" "$OUT/poster.webp" 1280
webp "$SRC/pick-a-spot-on-the-field.png" "$OUT/shots/position-board.webp" 732
webp "$SRC/the-frame-takes-team-colors.jpg" "$OUT/shots/team-colours.webp" 1200
webp "$SRC/the-career-you-chose.png" "$OUT/shots/career-you-chose.webp" 1594
webp "$SRC/the-back-before-you-send-it.png" "$OUT/shots/back-before-you-send-it.webp" 1594
webp "$SRC/the-pile-is-the-background.png" "$OUT/shots/pile-background.webp" 1440
webp "$SRC/realistic-2000.png" "$OUT/shots/real-odds.webp" 1600
webp "$SRC/wear3d-cut-corner-ladder.png" "$OUT/shots/cut-corner-ladder.webp" 1000
webp "$SRC/twenty-two-cards-of-a-baseball-tarot.png" "$OUT/shots/tarot.webp" 1600

for pair in "an-alphabet-rebuilt-from-nothing:alphabet" "four-models-drew-baseball-man:mascot-bake-off" \
            "three-hands-on-the-bat:three-hands" "infinite-pile-10k:pile-runaway" \
            "ten-thousand-cards-redeemed:pile-fixed" "nobody-wears-the-right-uniform:wrong-uniforms"; do
	s="${pair%%:*}"; t="${pair##*:}"
	png  "$SRC/$s.png" "$OUT/story/$t.png" 1600
	webp "$SRC/$s.png" "$OUT/story/$t.webp" 1600
done

# compare pair + hero (captured by scripts/capture-teightysix-press.mjs)
for n in press-empty press-loaded; do
	png  "$OUT/$n.png" "$OUT/$n.png" 1800
	webp "$OUT/$n.png" "$OUT/$n.webp" 1800
done
cp "$OUT/press-loaded.png" "$OUT/hero.png"; cp "$OUT/press-loaded.webp" "$OUT/hero.webp"
du -sh "$OUT"
```

`cwebp -resize W 0` keeps aspect. `sips -Z` caps the longer side; for landscape frames that is width, which is what the table means.

- [ ] **Step 4: Run it and check budget**

Run: `bash scripts/export-teightysix-frames.sh && du -sk static/img/projects/teightysix && file static/img/projects/teightysix/*.png | grep -v PNG`
Expected: total under 4096 KB; no output from the `file` line (every `.png` is really PNG). If over budget, drop `-q` to 78 on the story PNG->webp pairs and shrink story PNG fallbacks to 1200 wide first.

- [ ] **Step 5: Commit**

```bash
git add scripts/export-teightysix-frames.sh scripts/capture-teightysix-press.mjs static/img/projects/teightysix .codex/SHOWPIECE-ASSETS.md
git commit -m "Add teightysix showpiece image assets"
```

(`.codex/` is untracked by convention; if `git add` refuses it because it is ignored, leave it out of the commit and just keep the file.)

---

### Task 6: Copy polish on existing project pages

**Files:**
- Modify: every `content/projects/*.md` except `teightysix.md` and `_index.md`

- [ ] **Step 1: Baseline**

Run: `for f in content/projects/*.md; do printf "%3s %s\n" "$(grep -o '—' "$f" | wc -l)" "$f"; done`
Record the counts (Pulse 11, dog-playground 9, yt-music 10 at plan time).

- [ ] **Step 2: Rewrite each file under the deslop rules**

Read `~/.claude/skills/deslop/SKILL.md`, then `references/structures.md` and `references/phrases.md`. For each page, edit frontmatter strings (`description`, `tagline`, `ctaDesc`, every `desc`, every `caption`) and the body. Rules that bite here specifically:

- em dash to a comma, a period, or a rewrite. Never a hyphen pair.
- "No output parsing, no regex. Just hooks and escape sequences." shape: state the positive directly ("It uses hooks and escape sequences, nothing parses output.").
- "no Electron, just a lean WebKit shell" shape: same fix.
- yt-music: "Development continues locally across several branches" stays; it is a fact.
- Keep every proper noun, link, version, number, and the `&ldquo;` tagline quoting.
- Thin pages (BeeTees, Biology Interactive Case Studies, Earth: Lost In Translation, Nice Job Hero, Orbstep): read the page and `git log --follow -p <file> | head -80`. Add one concrete sentence only if a fact appears there. Otherwise leave the length alone.

- [ ] **Step 3: Verify**

Run: `grep -rn '—' content/projects/ ; echo "exit $?"`
Expected: no lines, exit 1. Then re-read each edited body once for the Quick Checks list in the skill (rhythm, tricolons, rhetorical questions, bold-first bullets).

- [ ] **Step 4: Build and commit**

```bash
/opt/homebrew/bin/hugo --minify --renderToMemory
git add content/projects/beetees.md content/projects/biology-interactive-case-studies.md content/projects/claude-code-pulse.md content/projects/dog-playground.md content/projects/earth-lost-in-translation.md content/projects/nice-job-hero.md content/projects/nurbits.md content/projects/obsidian-daily-digest.md content/projects/orbstep.md content/projects/yt-music.md
git commit -m "Rewrite project page copy: plain voice, no em dashes"
```

---

### Task 7: Asset path audit

**Files:**
- Create: `tests/simulation/project-assets.test.js`

- [ ] **Step 1: Write the test**

```js
#!/usr/bin/env node
// tests/simulation/project-assets.test.js
// Every image path a project page references must exist under static/.
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'content', 'projects');
let failures = 0;
for (const f of readdirSync(dir).filter(n => n.endsWith('.md') && n !== '_index.md')) {
	const text = readFileSync(join(dir, f), 'utf8');
	const paths = [...text.matchAll(/["']?(\/img\/[^"'\s]+\.(?:png|jpg|jpeg|webp|gif))["']?/g)].map(m => m[1]);
	for (const p of new Set(paths)) {
		const disk = join(root, 'static', p);
		if (!existsSync(disk)) { failures++; console.error(`  ✗ ${f}: missing ${p}`); }
		const webp = disk.replace(/\.(png|jpg|jpeg)$/, '.webp');
		if (/\.(png|jpg|jpeg)$/.test(disk) && !existsSync(webp)) { failures++; console.error(`  ✗ ${f}: no webp beside ${p}`); }
	}
}
console.log(failures ? `  ${failures} asset problem(s)` : '  ✓ all project image paths exist with webp siblings');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `source ~/.nvm/nvm.sh && nvm use && node tests/simulation/project-assets.test.js`
Expected: PASS after Task 5 and Task 4 agree. Any listed miss is a real bug to fix in whichever side is wrong (rename the asset or the path); existing pages that fail (for example a `.gif` hero without webp) get a targeted fix or a documented exclusion in the test with the reason.

- [ ] **Step 3: Commit**

```bash
git add tests/simulation/project-assets.test.js
git commit -m "Test that project image paths exist with webp siblings"
```

---

### Task 8: Integration and review (coordinator)

- [ ] **Step 1:** In the worktree, `source ~/.nvm/nvm.sh && nvm use && npm test` and `npm run build`. Both green. `grep -rn '—' content/projects layouts/projects layouts/partials layouts/_default` empty.
- [ ] **Step 2:** Screenshot home and `/projects/teightysix/` at 1280 and 390 wide (chrome-devtools MCP or Puppeteer) into `.claude/showpiece-2026-09-25/`. Open them (`open <file>`) for Brian.
- [ ] **Step 3:** Dispatch a cold Codex review of `git diff origin/main...HEAD` with the spec path and the content rule; fix P1s, re-review only on a verified failure.
- [ ] **Step 4:** Push `feat/teightysix-showpiece`, open the PR with `gh pr create` (summary, test plan, screenshots, the asset substitutions from `.codex/SHOWPIECE-ASSETS.md`). Do not merge.

### Task 9: Post-deploy (after Brian merges)

- [ ] PageSpeed Insights web UI, mobile and desktop, for `/` and `/projects/teightysix/`. Update README badges and `.claude/lighthouse-2026-MM-DD.md` if scores moved.
