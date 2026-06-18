# Experiments Wall — Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage Projects section with a two-tier "experiments wall" — large featured-project tiles above a dense grid of playful experiment tiles (live toys, fullscreen toys), in the site's existing brand style.

**Architecture:** A new `content/experiments/` Hugo section supplies tile metadata. A new `experimentsWall.html` partial renders two tiers and is wired into `layouts/index.html` in place of the projects `sectionSummary` call. Tile behavior is data-driven by a `kind` field: `live` toys boot inline on hover (a new `live-tile-waker.js`) and fullscreen on click; `play` toys and live-tile expand buttons reuse PR #15's `interactive-embed.js` (generalized here from one trigger to many sharing a single overlay); `project` tiles are plain links to detail pages. No iframe/WebGL loads until a tile is interacted with.

**Tech Stack:** Hugo (static site), Bootstrap 4.5, vanilla JS (no framework), Puppeteer for e2e tests, Node 22 via nvm.

## Global Constraints

- **Depends on PR #15** (`copilot/add-project-page-dog-playground`) being merged first — it provides `static/js/interactive-embed.js`, `static/css/interactive-embed.css`, and the `.ie-overlay` / `.ie-preview` contract this plan extends. Rebase `feat/experiments-wall` onto `main` after #15 lands, before starting Task 4.
- **Node:** activate nvm before any node/npm command: `source ~/.nvm/nvm.sh && nvm use` (Node 22 via `.nvmrc`).
- **Indentation:** tabs (defer to existing file style when editing).
- **Brand tokens only** — never hardcode colors. Use the CSS custom properties in `static/css/design-system.css`: `--brand` `#23759E`, `--brand-dark` `#2D4A52`, `--accent` `#89C45A`, `--muted` `#6E6C70`, radii `--radius-sm/md/lg`, `--shadow-card`, `--shadow-card-hover`.
- **Lighthouse-max** is a standing priority: no iframes/WebGL at page load; all toy loads are interaction-gated and lazy. After deploy, run `npx lighthouse@13.0.3 https://www.roojerry.com --chrome-flags="--headless" --quiet` and update README badges + `.claude/lighthouse-YYYY-MM-DD.md`. Targets: Perf ≥86, A11y/BP/SEO 100.
- **No Google Fonts / no new CDNs.** Fonts are self-hosted.
- **Commits:** brief imperative; **no `Co-Authored-By` trailers**.
- **Tests:** `npm test` (runs `tests/runner.js`, which starts Hugo on port 1313 and discovers `tests/e2e/*.test.js` + `tests/simulation/*.test.js`). Hugo binary path defaults to `/opt/homebrew/bin/hugo` (override via `HUGO_PATH`).
- **Accessibility:** every tile focusable; Enter/Space activates; Esc closes fullscreen; `prefers-reduced-motion` disables shimmer + inline auto-boot.

## File Structure

**Create:**
- `content/experiments/_index.md` — section index (title only).
- `content/experiments/voxel-field.md`, `voxel-fire.md`, `voxel-fluid.md`, `tube-tree.md`, `dog-playground.md` — one stub per toy (frontmatter only) carrying `title`, `blurb`, `kind`, `src`, `poster`, optional `preview`, `weight`.
- `layouts/partials/experimentsWall.html` — renders the two tiers + the single shared `.ie-overlay`.
- `layouts/partials/experimentTile.html` — renders one tile given a page context + `kind`.
- `static/css/experiments-wall.css` — grid, tile, badge, caption, shimmer-poster, responsive rules.
- `static/js/live-tile-waker.js` — hover/tap/focus → inline iframe boot; IntersectionObserver unload; reduced-motion aware.
- `static/img/experiments/` — poster images (`voxel-field.webp`, etc.).
- `tests/e2e/experiments-wall.test.js` — Puppeteer behavior tests.

**Modify:**
- `layouts/index.html` — replace the `else if eq . "projects"` branch's `sectionSummary` call with the `experimentsWall` partial.
- `layouts/_default/baseof.html` — add `<link>` for `experiments-wall.css` and `<script defer>` for `live-tile-waker.js` (interactive-embed.css/js arrive via PR #15).
- `static/js/interactive-embed.js` — generalize from a single `.ie-preview` to all `.ie-preview` triggers sharing one `#ie-overlay`; animation origin from `closest('[data-ie-origin]')` when present.
- `i18n/en.json` — add an `"experiments"` label.

---

### Task 1: Experiments content section and tile stubs

**Files:**
- Create: `content/experiments/_index.md`
- Create: `content/experiments/voxel-field.md`, `voxel-fire.md`, `voxel-fluid.md`, `tube-tree.md`, `dog-playground.md`

**Interfaces:**
- Produces: a Hugo section `experiments` whose pages expose `.Params.kind` (`live`|`play`), `.Params.blurb`, `.Params.src`, `.Params.poster`, `.Params.preview` (optional), `.Params.weight`. Consumed by Task 2's partials.

- [ ] **Step 1: Create the section index**

`content/experiments/_index.md`:

```markdown
---
title: "Experiments"
---
```

- [ ] **Step 2: Create the three live voxel stubs**

`content/experiments/voxel-field.md`:

```markdown
---
title: "Voxel Field"
blurb: "Sculpt a field of cubes with your cursor."
kind: "live"
src: "/experiments/voxel/"
poster: "/img/experiments/voxel-field.webp"
weight: 10
---
```

`content/experiments/voxel-fire.md`:

```markdown
---
title: "Voxel Fire"
blurb: "A little voxel bonfire that's hard to look away from."
kind: "live"
src: "/experiments/voxel/fire.html"
poster: "/img/experiments/voxel-fire.webp"
weight: 20
---
```

`content/experiments/voxel-fluid.md`:

```markdown
---
title: "Voxel Fluid"
blurb: "Push voxel fluid around in real time."
kind: "live"
src: "/experiments/voxel/fluid.html"
poster: "/img/experiments/voxel-fluid.webp"
weight: 30
---
```

- [ ] **Step 3: Create the two play stubs**

`content/experiments/tube-tree.md`:

```markdown
---
title: "Tube Tree"
blurb: "Grow a generative tree of tubes. (Big one — loads on click.)"
kind: "play"
src: "/experiments/tube-tree/"
poster: "/img/experiments/tube-tree.webp"
weight: 40
---
```

`content/experiments/dog-playground.md`:

```markdown
---
title: "Dog Playground"
blurb: "Pick a yard, a pup, and a toy. Drag to throw."
kind: "play"
src: "https://brianruggieri.github.io/dog-playground/"
poster: "/img/experiments/dog-playground.webp"
weight: 50
---
```

- [ ] **Step 4: Verify Hugo recognizes the section**

Run: `source ~/.nvm/nvm.sh && nvm use && /opt/homebrew/bin/hugo --quiet list all | grep experiments`
Expected: five `experiments/...` content pages listed (no build errors).

- [ ] **Step 5: Commit**

```bash
git add content/experiments
git commit -m "Add experiments content section with toy stubs"
```

---

### Task 2: Wall and tile partials, wired into the homepage

**Files:**
- Create: `layouts/partials/experimentsWall.html`
- Create: `layouts/partials/experimentTile.html`
- Modify: `layouts/index.html` (projects branch)
- Modify: `i18n/en.json`

**Interfaces:**
- Consumes: Task 1 frontmatter (`kind`, `blurb`, `src`, `poster`, `weight`); featured projects from `content/projects/*.md` where `featured: true` (fields `Title`, `Permalink`, `Params.image`, `Params.subtitle`).
- Produces DOM contract consumed by Tasks 4 & 5:
  - Section wrapper `<section id="experiments" class="resume-section ...">`.
  - Featured project tile: `<a class="exp-tile exp-tile--project" href="{Permalink}">`.
  - Play tile: `<div class="exp-tile exp-tile--play ie-preview" data-src="{src}" data-ie-origin role="button" tabindex="0">`.
  - Live tile: `<div class="exp-tile exp-tile--live" data-ie-origin data-live-src="{src}" role="button" tabindex="0">` containing `<div class="exp-tile__slot"></div>` and `<button class="exp-tile__expand ie-preview" data-src="{src}" data-ie-origin>`.
  - Single shared overlay `<div id="ie-overlay" class="ie-overlay" ...>` rendered once at the end of the wall.

- [ ] **Step 1: Write the tile partial**

`layouts/partials/experimentTile.html` (expects a dict `{ "page": <Page>, "kind": "live|play|project" }`):

```html
{{- $kind := .kind -}}
{{- $p := .page -}}
{{- $poster := $p.Params.poster | default $p.Params.image -}}
{{- $title := $p.Title -}}
{{- $blurb := $p.Params.blurb | default $p.Params.subtitle | default $p.Description -}}

{{- if eq $kind "project" -}}
<a class="exp-tile exp-tile--project" href="{{ $p.Permalink }}">
	<span class="exp-tile__media">
		<img class="exp-tile__poster" src="{{ $poster }}" alt="{{ $title }} — preview"
		     width="640" height="400" loading="lazy">
		<span class="exp-tile__badge exp-tile__badge--project">project</span>
	</span>
	<span class="exp-tile__cap"><b>{{ $title }}</b><span>{{ $blurb }}</span></span>
</a>

{{- else if eq $kind "play" -}}
<div class="exp-tile exp-tile--play ie-preview" data-src="{{ $p.Params.src }}" data-ie-origin
     role="button" tabindex="0" aria-label="Open {{ $title }} fullscreen">
	<span class="exp-tile__media">
		<img class="exp-tile__poster" src="{{ $poster }}" alt="{{ $title }} — preview"
		     width="640" height="400" loading="lazy">
		<span class="exp-tile__badge exp-tile__badge--play">play</span>
		<span class="exp-tile__play" aria-hidden="true">{{ partial "icon.html" (dict "icon" "play") }}</span>
	</span>
	<span class="exp-tile__cap"><b>{{ $title }}</b><span>{{ $blurb }}</span></span>
</div>

{{- else -}}
<div class="exp-tile exp-tile--live" data-ie-origin data-live-src="{{ $p.Params.src }}"
     role="button" tabindex="0" aria-label="Play {{ $title }}">
	<span class="exp-tile__media">
		<img class="exp-tile__poster" src="{{ $poster }}" alt="{{ $title }} — preview"
		     width="640" height="400" loading="lazy">
		<span class="exp-tile__slot" aria-hidden="true"></span>
		<span class="exp-tile__badge exp-tile__badge--live">live</span>
		<button class="exp-tile__expand ie-preview" data-src="{{ $p.Params.src }}" data-ie-origin
		        type="button" aria-label="Open {{ $title }} fullscreen">
			{{ partial "icon.html" (dict "icon" "arrows-alt") }}
		</button>
	</span>
	<span class="exp-tile__cap"><b>{{ $title }}</b><span>{{ $blurb }}</span></span>
</div>
{{- end -}}
```

Note: `data-ie-origin` on the live tile root makes the fullscreen animation expand from the whole tile, not the small expand button (Task 4 reads `closest('[data-ie-origin]')`).

- [ ] **Step 2: Write the wall partial**

`layouts/partials/experimentsWall.html` (invoked with the site context `$`):

```html
<section class="resume-section p-3 p-lg-5 d-flex flex-column" id="experiments">
	<div class="my-auto">
		{{- $projects := .GetPage "section" "projects" -}}
		{{- $featured := where $projects.Pages "Params.featured" true -}}
		{{- $experiments := (.GetPage "section" "experiments").Pages.ByWeight -}}

		<h2 class="mb-4">{{ i18n "projects" }}</h2>
		<div class="exp-grid exp-grid--featured">
			{{- range $featured -}}
				{{ partial "experimentTile.html" (dict "page" . "kind" "project") }}
			{{- end -}}
		</div>

		<h3 class="exp-subhead mt-5 mb-3">{{ i18n "experiments" }}</h3>
		<div class="exp-grid exp-grid--toys">
			{{- range $experiments -}}
				{{ partial "experimentTile.html" (dict "page" . "kind" .Params.kind) }}
			{{- end -}}
		</div>
	</div>

	{{/* Single shared fullscreen overlay for all play/live tiles on this page */}}
	<div id="ie-overlay" class="ie-overlay" aria-modal="true" role="dialog" aria-label="Interactive experiment">
		<div class="ie-overlay__backdrop"></div>
		<iframe class="ie-overlay__frame" src="about:blank" title="Interactive experiment"
		        allow="accelerometer; gyroscope; fullscreen"></iframe>
		<button class="ie-overlay__close" type="button" aria-label="Close interactive">
			{{ partial "icon.html" (dict "icon" "times") }}
		</button>
	</div>
</section>
```

- [ ] **Step 3: Wire it into the homepage**

In `layouts/index.html`, replace the projects branch. Change:

```html
    {{ else if eq . "projects" }}
      {{ with $site.GetPage "section" "projects" }}
        {{ .Scratch.Set "sectionId" "projects" }}
        {{ partial "sectionSummary" . }}
      {{ end }}
```

to:

```html
    {{ else if eq . "projects" }}
      {{ partial "experimentsWall.html" $site }}
```

- [ ] **Step 4: Add the i18n label**

In `i18n/en.json`, add alongside the existing `"projects"` entry:

```json
  "experiments": "Experiments"
```

- [ ] **Step 5: Build and assert markup is present**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use && /opt/homebrew/bin/hugo --quiet --destination /tmp/expwall-build
grep -c 'exp-tile--live' /tmp/expwall-build/index.html
grep -c 'exp-tile--play' /tmp/expwall-build/index.html
grep -c 'exp-tile--project' /tmp/expwall-build/index.html
grep -c 'id="ie-overlay"' /tmp/expwall-build/index.html
```
Expected: `3` live, `2` play, `≥1` project, `1` overlay. No Hugo errors.

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/experimentsWall.html layouts/partials/experimentTile.html layouts/index.html i18n/en.json
git commit -m "Render experiments wall on homepage in place of project cards"
```

---

### Task 3: Wall and tile styling

**Files:**
- Create: `static/css/experiments-wall.css`
- Modify: `layouts/_default/baseof.html` (add the stylesheet link)

**Interfaces:**
- Consumes: the class contract from Task 2.
- Produces: visual layout only; no JS contract.

- [ ] **Step 1: Write the stylesheet**

`static/css/experiments-wall.css`:

```css
/* Experiments wall — two-tier grid of project + toy tiles */

.exp-grid {
	display: grid;
	gap: 18px;
}
.exp-grid--featured {
	grid-template-columns: repeat(2, 1fr);
}
.exp-grid--toys {
	grid-template-columns: repeat(3, 1fr);
	gap: 14px;
}
@media (max-width: 767px) {
	.exp-grid--featured,
	.exp-grid--toys { grid-template-columns: 1fr; }
}

.exp-subhead {
	font-family: inherit;
	text-transform: uppercase;
	letter-spacing: 3px;
	font-size: 0.8rem;
	color: var(--muted);
}

.exp-tile {
	display: flex;
	flex-direction: column;
	text-decoration: none;
	color: inherit;
	cursor: pointer;
	outline: none;
}
.exp-tile__media {
	position: relative;
	display: block;
	aspect-ratio: 16 / 10;
	border-radius: var(--radius-lg);
	overflow: hidden;
	box-shadow: var(--shadow-card);
	transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.exp-tile:hover .exp-tile__media,
.exp-tile:focus-visible .exp-tile__media {
	box-shadow: var(--shadow-card-hover);
	transform: translateY(-2px);
}
.exp-tile:focus-visible .exp-tile__media {
	outline: 3px solid var(--accent);
	outline-offset: 2px;
}
.exp-tile__poster {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

/* Shimmer overlay so live tiles read as "alive" at rest */
.exp-tile--live .exp-tile__media::after {
	content: "";
	position: absolute;
	inset: 0;
	background: linear-gradient(115deg,
		transparent 30%,
		rgb(var(--accent-rgb) / 0.18) 50%,
		transparent 70%);
	background-size: 250% 100%;
	animation: exp-shimmer 4.5s linear infinite;
	pointer-events: none;
}
@keyframes exp-shimmer { to { background-position: -250% 0; } }

/* Inline live iframe injected by live-tile-waker.js */
.exp-tile__slot {
	position: absolute;
	inset: 0;
	display: none;
}
.exp-tile.is-live .exp-tile__slot { display: block; }
.exp-tile.is-live .exp-tile__poster { visibility: hidden; }
.exp-tile.is-live .exp-tile__media::after { display: none; }
.exp-tile__slot iframe {
	width: 100%;
	height: 100%;
	border: 0;
	display: block;
}

.exp-tile__badge {
	position: absolute;
	top: 8px;
	left: 8px;
	font-size: 0.6rem;
	font-weight: 700;
	letter-spacing: 1px;
	text-transform: uppercase;
	padding: 3px 6px;
	border-radius: var(--radius-sm);
	z-index: 2;
}
.exp-tile__badge--live    { background: var(--accent); color: var(--brand-dark); }
.exp-tile__badge--play    { background: rgb(var(--shadow-tint-rgb) / 0.65); color: #fff; }
.exp-tile__badge--project { background: rgb(var(--brand-rgb) / 0.85); color: #fff; }

.exp-tile__play,
.exp-tile__expand {
	position: absolute;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
}
.exp-tile__play {
	inset: 0;
	margin: auto;
	width: 54px;
	height: 54px;
	border-radius: 50%;
	background: rgb(var(--shadow-tint-rgb) / 0.5);
	pointer-events: none;
}
.exp-tile__expand {
	top: 8px;
	right: 8px;
	width: 30px;
	height: 30px;
	border: 0;
	border-radius: var(--radius-sm);
	background: rgb(var(--shadow-tint-rgb) / 0.55);
	cursor: pointer;
}

.exp-tile__cap {
	display: block;
	margin-top: 8px;
}
.exp-tile__cap b { display: block; font-size: 0.95rem; line-height: 1.2; }
.exp-tile__cap span { display: block; font-size: 0.8rem; color: var(--muted); line-height: 1.3; }

@media (prefers-reduced-motion: reduce) {
	.exp-tile--live .exp-tile__media::after { animation: none; }
	.exp-tile__media { transition: none; }
}
```

- [ ] **Step 2: Link the stylesheet**

In `layouts/_default/baseof.html`, after the existing `<link rel="stylesheet" href="/css/projects.css">` line, add:

```html
    <link rel="stylesheet" href="/css/experiments-wall.css">
```

- [ ] **Step 3: Visually verify the build serves the CSS**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use && /opt/homebrew/bin/hugo --quiet --destination /tmp/expwall-build
test -f /tmp/expwall-build/css/experiments-wall.css && grep -q 'exp-grid--toys' /tmp/expwall-build/css/experiments-wall.css && echo OK
grep -q 'experiments-wall.css' /tmp/expwall-build/index.html && echo LINKED
```
Expected: `OK` and `LINKED`.

- [ ] **Step 4: Commit**

```bash
git add static/css/experiments-wall.css layouts/_default/baseof.html
git commit -m "Style the experiments wall grid and tiles"
```

---

### Task 4: Generalize the fullscreen controller to many tiles

**Files:**
- Modify: `static/js/interactive-embed.js`
- Test: `tests/e2e/experiments-wall.test.js` (created here; extended in Task 7)

**Interfaces:**
- Consumes: every `.ie-preview` element with `data-src` (play tiles, live-tile expand buttons, and the legacy single-preview on project detail pages); the shared `#ie-overlay`.
- Produces: clicking/keyboard-activating any `.ie-preview` opens `#ie-overlay`, loads `data-src` into `.ie-overlay__frame`, expands from the origin element's rect (`closest('[data-ie-origin]')` if present, else the trigger), and Esc/close tears down and resets `frame.src` to `about:blank`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/experiments-wall.test.js`:

```js
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
	await page.keyboard.press('Escape');
	await page.waitForFunction(
		() => !document.getElementById('ie-overlay').classList.contains('is-active'),
		{ timeout: 3000 });
	const src = await page.$eval('#ie-overlay .ie-overlay__frame', f => f.getAttribute('src'));
	if (src !== 'about:blank') throw new Error(`frame not unloaded: ${src}`);
});

await browser.close();
if (failures) process.exit(1);
console.log('experiments-wall: all passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: FAIL — `play tile opens fullscreen overlay` errors because the current `interactive-embed.js` binds only the first `.ie-preview` (the expand button may not be the first match, and only one trigger is wired).

- [ ] **Step 3: Generalize the controller**

Replace the top of `static/js/interactive-embed.js` (the single-element lookup + bindings) with multi-trigger logic. Replace this block:

```js
  var preview = document.querySelector(".ie-preview");
  if (!preview) return; // not on an interactive-embed page

  var overlay = document.getElementById("ie-overlay");
```

with:

```js
  var previews = document.querySelectorAll(".ie-preview");
  if (!previews.length) return; // no interactive triggers on this page

  var overlay = document.getElementById("ie-overlay");
```

Then change the helpers and `open()` to take the active trigger. Replace `getPreviewRect`:

```js
  var activeOrigin = null;

  function getPreviewRect() {
    return (activeOrigin || previews[0]).getBoundingClientRect();
  }
```

Change `open()`'s signature and src resolution. Replace:

```js
  function open() {
    if (isOpen) return;
    isOpen = true;

    var rect = getPreviewRect();
```

with:

```js
  function open(trigger) {
    if (isOpen) return;
    isOpen = true;

    activeOrigin = trigger.closest("[data-ie-origin]") || trigger;
    src = trigger.dataset.src;

    var rect = getPreviewRect();
```

(Remove the old module-level `var src = preview.dataset.src;` line near the top; `src` is now resolved per-open. Keep a `var src;` declaration in its place.)

Replace the event bindings block:

```js
  preview.addEventListener("click", open);

  // Also handle Enter/Space for keyboard accessibility
  preview.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
```

with:

```js
  previews.forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(el);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(el);
      }
    });
  });
```

(The `close()` body is unchanged — it already resets `frame.src = "about:blank"`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: PASS — both `play tile opens fullscreen overlay` and `Escape closes the overlay`.

- [ ] **Step 5: Commit**

```bash
git add static/js/interactive-embed.js tests/e2e/experiments-wall.test.js
git commit -m "Generalize interactive embed to multiple wall tiles"
```

---

### Task 5: Live-tile inline boot on interaction

**Files:**
- Create: `static/js/live-tile-waker.js`
- Modify: `layouts/_default/baseof.html` (add the script)
- Test: `tests/e2e/experiments-wall.test.js` (extend)

**Interfaces:**
- Consumes: `.exp-tile--live` elements with `data-live-src` and an inner `.exp-tile__slot`.
- Produces: on `mouseenter`/`focus`/`touchstart` (unless `prefers-reduced-motion`), injects `<iframe src="{data-live-src}">` into `.exp-tile__slot` and adds class `is-live` to the tile; an `IntersectionObserver` removes the iframe and the class when the tile leaves the viewport. The expand button's fullscreen behavior (Task 4) is unaffected.

- [ ] **Step 1: Write the failing test (append before `await browser.close();`)**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: FAIL — `hovering a live tile boots its toy inline` times out (no waker script yet).

- [ ] **Step 3: Write the waker**

`static/js/live-tile-waker.js`:

```js
/* =============================================================
   Live-tile waker — boots a lightweight toy inline inside a
   grid tile on first interaction, and unloads it when the tile
   scrolls out of view. Heavy toys use interactive-embed instead.
   ============================================================= */

(function () {
	"use strict";

	var tiles = document.querySelectorAll(".exp-tile--live[data-live-src]");
	if (!tiles.length) return;

	var reduce = window.matchMedia &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	function boot(tile) {
		if (tile.classList.contains("is-live")) return;
		var slot = tile.querySelector(".exp-tile__slot");
		if (!slot) return;
		var frame = document.createElement("iframe");
		frame.setAttribute("title", tile.getAttribute("aria-label") || "Experiment");
		frame.setAttribute("loading", "lazy");
		frame.src = tile.dataset.liveSrc;
		slot.appendChild(frame);
		tile.classList.add("is-live");
	}

	function unboot(tile) {
		if (!tile.classList.contains("is-live")) return;
		var slot = tile.querySelector(".exp-tile__slot");
		if (slot) slot.innerHTML = "";
		tile.classList.remove("is-live");
	}

	tiles.forEach(function (tile) {
		if (!reduce) {
			tile.addEventListener("mouseenter", function () { boot(tile); });
			tile.addEventListener("focus", function () { boot(tile); });
			tile.addEventListener("touchstart", function () { boot(tile); }, { passive: true });
		} else {
			// Reduced motion: only an explicit click boots the inline toy.
			tile.addEventListener("click", function (e) {
				if (e.target.closest(".exp-tile__expand")) return; // expand = fullscreen
				boot(tile);
			});
		}
	});

	if ("IntersectionObserver" in window) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) unboot(entry.target);
			});
		}, { rootMargin: "100px" });
		tiles.forEach(function (tile) { io.observe(tile); });
	}
})();
```

- [ ] **Step 4: Register the script**

In `layouts/_default/baseof.html`, after the `interactive-embed.js` script line (added by PR #15), add:

```html
  <script defer src="/js/live-tile-waker.js"></script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: PASS — both new live-tile tests, and all earlier tests still pass.

- [ ] **Step 6: Commit**

```bash
git add static/js/live-tile-waker.js layouts/_default/baseof.html tests/e2e/experiments-wall.test.js
git commit -m "Boot live toy tiles inline on interaction"
```

---

### Task 6: Generate and commit poster images

**Files:**
- Create: `static/img/experiments/voxel-field.webp`, `voxel-fire.webp`, `voxel-fluid.webp`, `tube-tree.webp`, `dog-playground.webp`

**Interfaces:**
- Consumes: the `poster` paths referenced in Task 1 stubs.
- Produces: real preview images at those paths (640×400, webp).

- [ ] **Step 1: Capture screenshots of the deployed toys**

Use a one-off Puppeteer capture (or the gstack `/browse` tool). Run from the worktree:

```bash
source ~/.nvm/nvm.sh && nvm use
node -e '
import("puppeteer").then(async ({ default: pp }) => {
	const shots = [
		["https://www.roojerry.com/experiments/voxel/", "voxel-field"],
		["https://www.roojerry.com/experiments/voxel/fire.html", "voxel-fire"],
		["https://www.roojerry.com/experiments/voxel/fluid.html", "voxel-fluid"],
		["https://www.roojerry.com/experiments/tube-tree/", "tube-tree"],
		["https://brianruggieri.github.io/dog-playground/", "dog-playground"],
	];
	const b = await pp.launch({ headless: "new" });
	const pg = await b.newPage();
	await pg.setViewport({ width: 1280, height: 800 });
	for (const [url, name] of shots) {
		await pg.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
		await new Promise(r => setTimeout(r, 2500)); // let the toy render a frame
		await pg.screenshot({ path: `/tmp/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
		console.log("captured", name);
	}
	await b.close();
});
'
```

- [ ] **Step 2: Resize and convert to webp (640×400)**

Use the system `cwebp`/`sips`, or sharp if available. With sharp:

```bash
source ~/.nvm/nvm.sh && nvm use && npx sharp-cli --version >/dev/null 2>&1
mkdir -p static/img/experiments
for n in voxel-field voxel-fire voxel-fluid tube-tree dog-playground; do
	npx sharp-cli -i /tmp/$n.png -o static/img/experiments/$n.webp resize 640 400 --fit cover
done
ls -la static/img/experiments
```

(If `sharp-cli` is unavailable, use `cwebp -resize 640 400 /tmp/$n.png -o static/img/experiments/$n.webp`.)

- [ ] **Step 3: Verify posters resolve in the build**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use && /opt/homebrew/bin/hugo --quiet --destination /tmp/expwall-build
for n in voxel-field voxel-fire voxel-fluid tube-tree dog-playground; do
	test -f /tmp/expwall-build/img/experiments/$n.webp && echo "OK $n" || echo "MISSING $n";
done
```
Expected: `OK` for all five.

- [ ] **Step 4: Commit**

```bash
git add static/img/experiments
git commit -m "Add experiment poster images"
```

---

### Task 7: Full verification pass

**Files:**
- Modify: `tests/e2e/experiments-wall.test.js` (add project-tile + reduced-motion assertions)

**Interfaces:**
- Consumes: the full wall from Tasks 1–6.
- Produces: a green `npm test` and a Lighthouse check.

- [ ] **Step 1: Add the remaining assertions (append before `await browser.close();`)**

```js
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
```

- [ ] **Step 2: Run the full suite**

Run: `source ~/.nvm/nvm.sh && nvm use && npm test`
Expected: PASS — all `experiments-wall` tests plus the pre-existing `achievements` and `canvas-perf` suites.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run `npm run dev`, open `http://localhost:1313`, and confirm: featured tiles link out; voxel tiles shimmer at rest, boot inline on hover, and the expand button opens fullscreen; tube-tree/dog-playground open fullscreen on click; Esc closes; nothing loads an iframe before interaction (check DevTools Network).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/experiments-wall.test.js
git commit -m "Add project-tile and reduced-motion wall tests"
```

- [ ] **Step 5: Lighthouse (after deploy, per Global Constraints)**

After this branch is merged and deployed, run:
```bash
npx lighthouse@13.0.3 https://www.roojerry.com --chrome-flags="--headless" --quiet
```
Confirm Perf ≥86 and A11y/BP/SEO = 100; update README badges and `.claude/lighthouse-YYYY-MM-DD.md`.

---

## Self-Review

**Spec coverage:**
- Two-tier wall (featured + experiments) → Tasks 2, 3. ✓
- Tile taxonomy live/play/project with badges + captions → Tasks 2, 3. ✓
- live = shimmer at rest, inline on hover/tap, fullscreen on click → Tasks 3 (shimmer), 5 (inline), 4 (fullscreen via expand button). ✓
- play = poster at rest, fullscreen on click → Tasks 2, 4. ✓ (optional webm preview deferred — not required by success criteria; `preview` field exists in the data model for future use.)
- project = poster + caption, navigates to detail page → Tasks 2, 7. ✓
- New `content/experiments/` data model → Task 1. ✓
- `experimentsWall.html` replaces `sectionSummary` projects call in `index.html` → Task 2. ✓
- Reuse `interactive-embed.js`, generalized to many triggers → Task 4. ✓
- Posters in `static/img/experiments/` with intrinsic dimensions (CLS) → Tasks 6, 2 (`width`/`height` attrs). ✓
- No iframe/WebGL at load; offscreen unload → Tasks 4 (lazy frame.src), 5 (IO unboot); asserted in Tasks 4, 5. ✓
- Keyboard + Esc + reduced-motion → Tasks 4, 5; asserted in Task 7. ✓
- Lighthouse-max → Global Constraints + Task 7 Step 5. ✓
- Depends on PR #15; rebase first → Global Constraints. ✓

**Placeholder scan:** No TBD/TODO; all steps carry real code or exact commands. The `preview` (webm) field is intentionally unused for now and documented as such (YAGNI), not a placeholder.

**Type/contract consistency:** Class and attribute names match across tasks — `.ie-preview` + `data-src` + `data-ie-origin` (Tasks 2, 4); `.exp-tile--live` + `data-live-src` + `.exp-tile__slot` + `is-live` (Tasks 2, 3, 5); `#ie-overlay` / `.ie-overlay__frame` (Tasks 2, 4). `getPreviewRect`/`open(trigger)`/`activeOrigin` consistent within Task 4. Poster paths in Task 1 match files produced in Task 6 and the `width`/`height` in Task 2.
