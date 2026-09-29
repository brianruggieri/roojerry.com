# teightysix Narrated Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the structured product page at `/projects/teightysix/` with one long-form article in Brian's voice, rendered by a new prose-first layout, with figures placed inline at narrative beats.

**Architecture:** A second Hugo layout (`layouts/projects/article.html`) selected by `layout: article` in frontmatter, so every other project page keeps rendering through the untouched `single.html`. Three new shortcodes emit figure markup that the site's existing `shot-lightbox.js` and `img-compare.js` already bind to by class, so no new JavaScript ships. The page's structured params (`features`, `story`, `screenshots`, `compare`) are deleted and their content moves into the body.

**Tech Stack:** Hugo 0.145+ (`build`, not the deprecated `_build`), Bootstrap 4.5 base theme, vanilla JS already in `static/js/`, Puppeteer tests run by `tests/runner.js`, `cwebp` for image conversion.

**Spec:** `docs/superpowers/specs/2026-09-29-teightysix-article-design.md`

**Interview:** `docs/superpowers/plans/2026-09-29-teightysix-article-interview.md` — Task 1 gates the prose tasks only.

## Global Constraints

- **No em dashes anywhere in rendered page text.** `tests/e2e/project-detail.test.js` already asserts this; do not weaken it.
- **US spellings in prose.** No *colour / licence / grey / metre*. The asset path `shots/team-colours.webp` is not renamed.
- **First person throughout the article body.** The narrator does not disappear after the opening.
- **Every image referenced from `content/projects/*.md` must exist under `static/` with a webp sibling**, enforced by `tests/simulation/project-assets.test.js`.
- **Figures long edge 1800 px**, matching the existing `shots/`.
- **No finished render of a current MLB player is published.** Beat 5 uses the public-domain Dorgan pair only. Excluded: every `cards-out/edwards_*_modal.png` and every `.codex/p2l-resample/contact_sheets/` file named for a current player.
- **Tabs for indentation** in templates and test files, matching the existing files.
- **Accessibility is a standing priority** — the site holds Lighthouse A11y 100 and must keep it.
- **Never run `git stash` bare** in this worktree; the stash stack is shared.

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has a test assigned to the task that owns the code.

1. **A `fig` called without `alt` or `caption` renders an unlabeled image**, silently costing the A11y 100 the site holds. → Task 3, Step 1.
2. **`article.html` ships without the `.shot-lightbox` dialog**, so every zoom button is a dead click with no error. → Task 6, Step 7.
3. **The `compare` markup drifts from what `img-compare.js` queries**, degrading silently to two stacked images with no slider and no console error. → Task 4, Step 1.
4. **`jsonld.html` keeps emitting `CreativeWork` for the article**, so the page ships the wrong schema type and nobody notices without viewing source. → Task 7, Step 1.
5. **A figure overflows the viewport at phone width**, reintroducing the horizontal scroll that commit `e322030` fixed on this same branch. → Task 6, Step 9.

---

### Task 1: Source material gate

**Files:**
- Read: `docs/superpowers/plans/2026-09-29-teightysix-article-interview.md`
- Create: `.codex/teightysix-article-answers.md` (untracked working file)
- Create: `static/img/projects/teightysix/collage/` (from Brian's photographs)

**Interfaces:**
- Consumes: nothing.
- Produces: `.codex/teightysix-article-answers.md` holding Brian's numbered answers verbatim, and collage images on disk. Tasks 9 and 10 read both.

**This task gates Tasks 9, 10 and 11 only.** Tasks 2 through 8 are independent of it and may run first or in parallel.

- [ ] **Step 1: Collect the answers**

Ask Brian for the interview answers. Save them **verbatim**, by number, with no paraphrase, smoothing or reordering, to `.codex/teightysix-article-answers.md`. His phrasing is the voice source for the draft; a cleaned-up transcript defeats the purpose of asking.

- [ ] **Step 2: Record which blocking questions are unanswered**

At the top of the same file, list the numbers of any unanswered `[BLOCKING]` question. Per the spec, an unanswered blocking question means the beat ships with a marked gap, never a guess.

- [ ] **Step 3: Land the collage photographs**

Convert whatever Brian supplies to the site convention, long edge 1800 px:

```bash
cd /Users/roojerry/git/roojerry/.worktrees/feat-teightysix-showpiece
mkdir -p static/img/projects/teightysix/collage
# Point SRC at wherever Brian dropped the photographs.
SRC=~/Desktop/collages
for f in "$SRC"/*.{jpg,jpeg,JPG,HEIC,png}; do
  [ -e "$f" ] || continue
  base=$(basename "${f%.*}")
  sips -Z 1800 "$f" --out "static/img/projects/teightysix/collage/$base.jpg"
  cwebp -q 82 -resize 1800 0 "static/img/projects/teightysix/collage/$base.jpg" \
    -o "static/img/projects/teightysix/collage/$base.webp"
done
```

Name them for what they show, not for the camera: `boxes.jpg`, `cutting.jpg`, `finished-set.jpg`, `beside-original.jpg`.

- [ ] **Step 4: Commit**

```bash
git add static/img/projects/teightysix/collage/
git commit -m "Add the collage photographs"
```

`.codex/` is untracked by convention and is not committed.

---

### Task 2: Convert and land the new figures

**Files:**
- Create: `static/img/projects/teightysix/micro/{rosette,cut-edge,edge-strip,edge-texture}.{jpg,webp}`
- Create: `static/img/projects/teightysix/loc/{dorgan-1887,dorgan-model}.{jpg,webp}`

**Interfaces:**
- Consumes: nothing.
- Produces: the eight image paths above, referenced by name in Tasks 9 and 10.

- [ ] **Step 1: Convert the microscope and LOC frames**

```bash
cd /Users/roojerry/git/roojerry/.worktrees/feat-teightysix-showpiece
P=~/git/baseball-cards/baseball-cards
M=~/Pictures/camera/microscope
OUT=static/img/projects/teightysix
mkdir -p "$OUT/micro" "$OUT/loc"

convert_one() {  # $1 source  $2 destination stem
  sips -Z 1800 "$1" --out "$2.jpg" >/dev/null
  cwebp -q 82 "$2.jpg" -o "$2.webp" >/dev/null
}

convert_one "$M/morgan86_01_rosette-first-capture.png"          "$OUT/micro/rosette"
convert_one "$M/morgan86b_07_card-edge.png"                      "$OUT/micro/cut-edge"
convert_one "$P/.claude/research/card-edges/morgan86b_07_edge-strip-straight.png" "$OUT/micro/edge-strip"
convert_one "$P/.claude/research/card-edges/edge-texture-tile_1.5mm.png"          "$OUT/micro/edge-texture"
convert_one "$P/p2l-eval/hist_gt/dorgan_2.jpg"                   "$OUT/loc/dorgan-1887"
convert_one "$P/p2l-out/kontext_v2_1000_g4/dorgan_2.png"         "$OUT/loc/dorgan-model"
convert_one "$P/muybridge/plate_274.jpg"                         "$OUT/loc/muybridge-plate"
```

`loc/dorgan-1887` does double duty: it is the real Edwards card that illustrates beat 4
and the ground truth of beat 5's pair. The spec's figure manifest also lists a
dashboard capture for beat 4; no such capture exists on disk, so either screenshot
`imgdash.py` running against `loc-cards/` or write beat 4 without it. Do not stage a
fake dashboard for the photograph.

- [ ] **Step 2: Verify every file landed with both extensions**

```bash
ls -1 static/img/projects/teightysix/micro static/img/projects/teightysix/loc
```

Expected: ten files, four stems under `micro/` and three under `loc/`, each with a `.jpg` and a `.webp`.

- [ ] **Step 3: Open them and confirm each shows what its name claims**

```bash
open static/img/projects/teightysix/micro/*.jpg static/img/projects/teightysix/loc/*.jpg
```

Reject and re-pick the source if any frame is out of focus or illegible at 1800 px. `loc/dorgan-model.jpg` must still show the gibberish caption `EG JOULS / ORSU-DNOHA.L` — that text is the point of the figure, and a crop that loses it is the wrong crop.

- [ ] **Step 4: Commit**

```bash
git add static/img/projects/teightysix/micro static/img/projects/teightysix/loc
git commit -m "Add the microscope and 1887 figures"
```

---

### Task 3: The `fig` shortcode

**Files:**
- Create: `layouts/shortcodes/fig.html`
- Test: `tests/e2e/article-figures.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `{{< fig src alt caption [wide] [fit] >}}`, emitting `<figure class="article-fig">` containing a `button.gallery-item__zoom[data-full]` wrapping a `<picture>`, plus a `<figcaption>`. Tasks 9 and 10 call it. Task 5 reuses its markup shape.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/article-figures.test.js`:

```js
#!/usr/bin/env node
// tests/e2e/article-figures.test.js
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
await page.goto(URL, { waitUntil: 'networkidle0' });

// Review Focus 1: an unlabeled figure is an accessibility regression the
// site's A11y 100 cannot absorb, and nothing else on the page catches it.
await runTest('every article figure has alt text and a caption', async () => {
	const figs = await page.$$eval('.article-fig', els => els.map(f => {
		const img = f.querySelector('img');
		const cap = f.querySelector('figcaption');
		return { ok: !!(img && img.alt.trim() && cap && cap.textContent.trim()) };
	}));
	if (!figs.length) throw new Error('no .article-fig on the page at all');
	const bad = figs.filter(f => !f.ok).length;
	if (bad) throw new Error(`${bad} of ${figs.length} figures missing alt or caption`);
});

await runTest('article figures are lazy and offer a webp source', async () => {
	const bad = await page.$$eval('.article-fig picture', ps => ps.filter(p => {
		const img = p.querySelector('img');
		const src = p.querySelector('source[type="image/webp"]');
		return img.loading !== 'lazy' || (/\.(png|jpe?g)$/.test(img.getAttribute('src')) && !src);
	}).length);
	if (bad) throw new Error(`${bad} figures not lazy or missing a webp source`);
});

await runTest('every zoom button carries a data-full path', async () => {
	const bad = await page.$$eval('.article-fig .gallery-item__zoom',
		bs => bs.filter(b => !b.dataset.full).length);
	if (bad) throw new Error(`${bad} zoom buttons without data-full`);
});

await browser.close();
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/runner.js` (it discovers the new file automatically)
Expected: FAIL with "no .article-fig on the page at all". The empty-set guard is what makes this test genuinely red before the shortcode and the body exist, rather than passing vacuously over zero figures.

- [ ] **Step 3: Write the shortcode**

Create `layouts/shortcodes/fig.html`:

```go-html-template
{{- $src := .Get "src" -}}
{{- $alt := .Get "alt" -}}
{{- $caption := .Get "caption" -}}
{{- if or (not $src) (not $alt) (not $caption) -}}
  {{- errorf "fig: src, alt and caption are all required (got src=%q alt=%q caption=%q) in %s" $src $alt $caption .Page.File.Path -}}
{{- end -}}
{{- $webp := $src | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
<figure class="article-fig{{ with .Get "wide" }} article-fig--wide{{ end }}{{ with .Get "fit" }} article-fig--{{ . }}{{ end }}">
	<button type="button" class="gallery-item__zoom" data-full="{{ $src }}" aria-label="Enlarge: {{ $alt }}">
		<picture>
			{{ if ne $webp $src }}<source srcset="{{ $webp }}" type="image/webp">{{ end }}
			<img src="{{ $src }}" alt="{{ $alt }}" loading="lazy" />
		</picture>
	</button>
	<figcaption>{{ $caption | markdownify }}</figcaption>
</figure>
```

`errorf` fails the build rather than shipping an unlabeled figure, which is the cheapest possible enforcement of Review Focus 1.

- [ ] **Step 4: Prove the guard fires**

```bash
cat > content/projects/zz-fig-fixture.md <<'EOF'
---
title: "Fig fixture"
build:
  list: never
---

{{< fig src="/img/projects/teightysix/story/alphabet.png" alt="" caption="x" >}}
EOF
/opt/homebrew/bin/hugo --renderToMemory --quiet; echo "exit=$?"
rm content/projects/zz-fig-fixture.md
```

Expected: non-zero exit, with an error naming `fig:` and the empty alt.

- [ ] **Step 5: Commit**

```bash
git add layouts/shortcodes/fig.html tests/e2e/article-figures.test.js
git commit -m "Add the fig shortcode and its accessibility guard"
```

---

### Task 4: The `compare` shortcode

**Files:**
- Create: `layouts/shortcodes/compare.html`
- Modify: `tests/e2e/article-figures.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `{{< compare before after beforeLabel afterLabel caption [portrait] >}}`, emitting the `.img-compare` markup that `static/js/img-compare.js` binds. Task 10 calls it once, in the wear beat.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/article-figures.test.js`, before `await browser.close()`:

```js
// Review Focus 3: img-compare.js queries .img-compare__frame and
// .img-compare__range by class and fails silently if either is absent,
// leaving two stacked images and no slider.
await runTest('the compare slider has the markup its JS binds', async () => {
	const shape = await page.$eval('.img-compare', el => ({
		frame: !!el.querySelector('.img-compare__frame'),
		range: !!el.querySelector('.img-compare__range'),
		imgs: el.querySelectorAll('.img-compare__img').length,
		top: !!el.querySelector('.img-compare__img--top'),
		divider: !!el.querySelector('.img-compare__divider'),
	}));
	for (const [k, v] of Object.entries(shape)) {
		if (k === 'imgs') { if (v !== 2) throw new Error(`expected 2 compare images, got ${v}`); continue; }
		if (!v) throw new Error(`compare slider missing ${k}`);
	}
});

await runTest('dragging the compare range moves the clip', async () => {
	const before = await page.$eval('.img-compare__img--top', el => getComputedStyle(el).clipPath);
	await page.$eval('.img-compare__range', el => {
		el.value = '90';
		el.dispatchEvent(new Event('input', { bubbles: true }));
	});
	const after = await page.$eval('.img-compare__img--top', el => getComputedStyle(el).clipPath);
	if (before === after) throw new Error(`clipPath unchanged at ${after}; the slider is not wired`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/e2e/article-figures.test.js` with the dev server up
Expected: FAIL on `page.$eval('.img-compare', ...)` with a node-not-found error, because the article body does not exist yet.

- [ ] **Step 3: Write the shortcode**

Create `layouts/shortcodes/compare.html`. The markup is lifted from `layouts/projects/single.html:81-105` so the JS binds unchanged:

```go-html-template
{{- $before := .Get "before" -}}
{{- $after := .Get "after" -}}
{{- if or (not $before) (not $after) -}}
  {{- errorf "compare: before and after are both required in %s" .Page.File.Path -}}
{{- end -}}
{{- $beforeWebp := $before | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
{{- $afterWebp := $after | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
{{- $beforeLabel := .Get "beforeLabel" | default "Before" -}}
{{- $afterLabel := .Get "afterLabel" | default "After" -}}
<figure class="img-compare{{ if .Get "portrait" }} img-compare--portrait{{ end }}">
	<div class="img-compare__frame">
		<picture class="img-compare__img">
			{{ if ne $afterWebp $after }}<source srcset="{{ $afterWebp }}" type="image/webp">{{ end }}
			<img src="{{ $after }}" alt="{{ .Page.Title }}, {{ $afterLabel }}" loading="lazy" />
		</picture>
		<picture class="img-compare__img img-compare__img--top">
			{{ if ne $beforeWebp $before }}<source srcset="{{ $beforeWebp }}" type="image/webp">{{ end }}
			<img src="{{ $before }}" alt="{{ .Page.Title }}, {{ $beforeLabel }}" loading="lazy" />
		</picture>
		<span class="img-compare__tag img-compare__tag--left" aria-hidden="true">{{ $beforeLabel }}</span>
		<span class="img-compare__tag img-compare__tag--right" aria-hidden="true">{{ $afterLabel }}</span>
		<div class="img-compare__divider" aria-hidden="true"><span class="img-compare__handle"></span></div>
		<input class="img-compare__range" type="range" min="0" max="100" value="50" step="0.1"
		       aria-label="Drag to compare {{ $beforeLabel }} and {{ $afterLabel }}" />
	</div>
	{{ with .Get "caption" }}<figcaption class="img-compare__caption">{{ . | markdownify }}</figcaption>{{ end }}
</figure>
```

Note `loading="lazy"` replaces `single.html`'s `loading="eager"`: in the article the slider is no longer the hero, so it must not compete with the real LCP element.

- [ ] **Step 4: Commit**

```bash
git add layouts/shortcodes/compare.html tests/e2e/article-figures.test.js
git commit -m "Add the compare shortcode"
```

---

### Task 5: The `plate` shortcode

**Files:**
- Create: `layouts/shortcodes/plate.html`
- Modify: `tests/e2e/article-figures.test.js`

**Interfaces:**
- Consumes: the `.article-fig` markup shape from Task 3.
- Produces: `{{< plate src1 alt1 src2 alt2 [src3 alt3] caption >}}`, emitting `<div class="article-plate">` containing two or three `<figure class="article-fig">` children and one shared `<figcaption class="article-plate__caption">`. Task 10 calls it for the runaway/fixed pair and the Dorgan pair.

Numbered parameters rather than nested shortcodes: Hugo can nest via `.Inner` and `RenderString`, but the failure mode is a silently unrendered inner shortcode, and this plan prefers the shape that cannot fail quietly.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/article-figures.test.js`, before `await browser.close()`:

```js
await runTest('every plate holds 2 or 3 figures and one shared caption', async () => {
	const plates = await page.$$eval('.article-plate', ps => ps.map(p => ({
		figs: p.querySelectorAll('.article-fig').length,
		caption: (p.querySelector('.article-plate__caption')?.textContent || '').trim().length,
	})));
	if (!plates.length) throw new Error('no plates rendered');
	for (const [i, p] of plates.entries()) {
		if (p.figs < 2 || p.figs > 3) throw new Error(`plate ${i} has ${p.figs} figures`);
		if (!p.caption) throw new Error(`plate ${i} has no caption`);
	}
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/e2e/article-figures.test.js`
Expected: FAIL with "no plates rendered".

- [ ] **Step 3: Write the shortcode**

Create `layouts/shortcodes/plate.html`:

```go-html-template
{{- $caption := .Get "caption" -}}
{{- if not $caption -}}{{- errorf "plate: caption is required in %s" .Page.File.Path -}}{{- end -}}
<div class="article-plate">
	<div class="article-plate__row">
		{{- range $i := slice 1 2 3 -}}
			{{- $src := $.Get (printf "src%d" $i) -}}
			{{- $alt := $.Get (printf "alt%d" $i) -}}
			{{- if $src -}}
				{{- if not $alt -}}{{- errorf "plate: src%d has no alt%d in %s" $i $i $.Page.File.Path -}}{{- end -}}
				{{- $webp := $src | replaceRE `\.(png|jpg|jpeg)$` ".webp" -}}
				<figure class="article-fig">
					<button type="button" class="gallery-item__zoom" data-full="{{ $src }}" aria-label="Enlarge: {{ $alt }}">
						<picture>
							{{ if ne $webp $src }}<source srcset="{{ $webp }}" type="image/webp">{{ end }}
							<img src="{{ $src }}" alt="{{ $alt }}" loading="lazy" />
						</picture>
					</button>
					<figcaption class="sr-only">{{ $alt }}</figcaption>
				</figure>
			{{- end -}}
		{{- end -}}
	</div>
	<figcaption class="article-plate__caption">{{ $caption | markdownify }}</figcaption>
</div>
```

Each child figure carries a visually hidden `figcaption` so the Task 3 assertion ("every `.article-fig` has alt and a caption") holds for plate children too, while only the shared caption is visible.

- [ ] **Step 4: Add the `sr-only` rule if the theme lacks one**

```bash
grep -rn '\.sr-only' static/css/ themes/ | head
```

Bootstrap 4.5 ships `.sr-only`; if the grep returns nothing, add it to `static/css/projects.css` in Task 6 Step 4 rather than here.

- [ ] **Step 5: Commit**

```bash
git add layouts/shortcodes/plate.html tests/e2e/article-figures.test.js
git commit -m "Add the plate shortcode for paired figures"
```

---

### Task 6: The article layout and its CSS

**Files:**
- Create: `layouts/projects/article.html`
- Modify: `static/css/projects.css`
- Modify: `content/projects/teightysix.md` (frontmatter only, stub body)
- Modify: `tests/e2e/article-figures.test.js`

**Interfaces:**
- Consumes: `fig`, `compare` and `plate` from Tasks 3 to 5.
- Produces: a page at `/projects/teightysix/` rendering `.article-body` and exactly one `.shot-lightbox` dialog. Tasks 9 and 10 write into the body.

- [ ] **Step 1: Read the layout being mirrored**

Read `layouts/projects/single.html` in full. The header block (lines 9 to 53) and the CTA block (lines 256 to 287) are copied into the new layout as-is; everything between them is replaced.

- [ ] **Step 2: Switch the page's frontmatter**

Edit `content/projects/teightysix.md`. Add `layout: article` and `date`, fill the `tagline` slot, and delete `features`, `featureColumns`, `screenshots`, `screenshotsGrid`, `story` and `compare`. Keep `title`, `subtitle`, `description`, `blurb`, `tags`, `statusLabel`, `live`, `github`, `ctaTitle`, `ctaDesc`, `image`, `poster`, `showpiece`, `featured`, `weight`, `year` and the sources comment block.

```yaml
layout: article
date: 2026-09-29
tagline: "the type, the color, the print, and forty years of wear"
```

Replace the body with a stub so the layout can be verified before the prose exists:

```markdown
Placeholder body. Tasks 9 and 10 replace this.

{{< fig src="/img/projects/teightysix/story/alphabet.png" alt="The reconstructed 1986 type cut, A to Z in two heavy rows" caption="Stub caption." >}}

{{< plate src1="/img/projects/teightysix/story/pile-runaway.png" alt1="A shredded spire of cards floating above its table" src2="/img/projects/teightysix/story/pile-fixed.png" alt2="The same ten thousand cards lying flat on the table" caption="Stub plate caption." >}}

{{< compare before="/img/projects/teightysix/compare-mint.png" after="/img/projects/teightysix/compare-worn.png" beforeLabel="1986" afterLabel="2026" portrait="true" caption="Stub compare caption." >}}
```

- [ ] **Step 3: Write the layout**

Create `layouts/projects/article.html`:

```go-html-template
{{ define "main" }}
{{ partial "breadcrumbs" . }}

<section class="resume-section p-3 p-lg-5 d-flex d-column">
	<div class="w-100">
		<article class="project-article">
			<header class="project-detail__header d-flex align-items-start justify-content-between flex-wrap gap-3">
				<div>
					{{ with .Params.statusLabel }}<span class="project-detail__status">{{ . }}</span>{{ end }}
					<h2 class="mb-0">
						{{ .Title }}
						{{ with .Params.subtitle }}<span class="project-detail__subtitle">{{ . }}</span>{{ end }}
					</h2>
					{{ with .Params.tagline }}<p class="project-detail__tagline">&ldquo;{{ . }}&rdquo;</p>{{ end }}
				</div>
				<div class="project-detail__header-links">
					{{ with .Params.live }}
					<a class="project-card__link project-card__link--live" href="{{ . }}" target="_blank" rel="noopener noreferrer">
						{{ partial "icon.html" (dict "icon" "fas fa-external-link-alt") }} Open the bench
					</a>
					{{ end }}
					{{ with .Params.github }}
					<a class="project-card__link" href="{{ . }}" target="_blank" rel="noopener noreferrer">
						{{ partial "icon.html" (dict "icon" "fab fa-github") }} GitHub
					</a>
					{{ end }}
				</div>
			</header>

			{{ with .Params.tags }}
			<ul class="project-detail__tags">
				{{ range . }}<li>{{ . }}</li>{{ end }}
			</ul>
			{{ end }}

			<div class="article-body">
				{{ .Content }}
			</div>
		</article>

		{{ if or .Params.live .Params.github }}
		<div class="project-cta">
			<div class="project-cta__text">
				<h4>{{ .Params.ctaTitle | default (printf "Get %s" .Title) }}</h4>
				{{ with .Params.ctaDesc }}<p>{{ . }}</p>{{ end }}
			</div>
			<div class="project-cta__actions">
				{{ with .Params.live }}
				<a class="project-card__link project-card__link--live" href="{{ . }}" target="_blank" rel="noopener noreferrer">
					{{ partial "icon.html" (dict "icon" "fas fa-external-link-alt") }} Open the bench
				</a>
				{{ end }}
				{{ with .Params.github }}
				<a class="project-card__link" href="{{ . }}" target="_blank" rel="noopener noreferrer">
					{{ partial "icon.html" (dict "icon" "fab fa-github") }} View on GitHub
				</a>
				{{ end }}
			</div>
		</div>
		{{ end }}
	</div>
</section>

<dialog class="shot-lightbox">
	<button type="button" class="shot-lightbox__close" aria-label="Close" autofocus>
		{{ partial "icon.html" (dict "icon" "fas fa-times") }}
	</button>
	<img alt="" />
</dialog>
{{ end }}
```

Copy the `<dialog>` block verbatim from `single.html:224-232` if it differs from the above; `shot-lightbox.js` queries `.shot-lightbox`, its `img`, and `.shot-lightbox__close`, and the `autofocus` on the close button is what keeps Escape working (see the stacking-and-scroll gotchas note).

- [ ] **Step 4: Add the article CSS**

Append to `static/css/projects.css`:

```css
/* ── Long-form article body ── */
.article-body { max-width: 68ch; margin: 2rem auto 0; }
.article-body > p { margin-bottom: 1.35rem; line-height: 1.75; }
.article-body > h2 { margin: 3rem 0 1rem; }
.article-body > blockquote {
	margin: 2.5rem 0; padding-left: 1.25rem;
	border-left: 3px solid var(--accent);
	font-size: 1.15rem; line-height: 1.6;
}
.article-fig { margin: 2.5rem 0; }
.article-fig .gallery-item__zoom {
	display: block; width: 100%; padding: 0; border: 0; background: none; cursor: zoom-in;
}
.article-fig img { display: block; width: 100%; height: auto; border-radius: 6px; }
.article-fig figcaption { margin-top: .6rem; font-size: .9rem; opacity: .8; }
.article-fig--contain img { object-fit: contain; background: #0b0b0b; }
.article-plate { margin: 2.5rem 0; }
.article-plate__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.article-plate .article-fig { margin: 0; }
.article-plate__caption { margin-top: .6rem; font-size: .9rem; opacity: .8; }

/* Figures may break wider than the measure on roomy viewports only. */
@media (min-width: 992px) {
	.article-fig--wide, .article-plate { width: min(100%, 52rem); margin-inline: auto; }
}

/* Review Focus 5: nothing may exceed the viewport at phone width. */
@media (max-width: 767px) {
	.article-body { max-width: 100%; }
	.article-fig--wide, .article-plate { width: 100%; }
	.article-plate__row { grid-template-columns: 1fr; }
}
```

Bump the `projects.css` cache-buster wherever the theme references it (it is at `?v=5` as of `e616b38`).

- [ ] **Step 5: Verify the page renders**

```bash
/opt/homebrew/bin/hugo server -D --port 1319 &
sleep 4
curl -s http://localhost:1319/projects/teightysix/ | grep -c 'article-body\|article-fig\|img-compare\|shot-lightbox'
```

Expected: a non-zero count, and no Hugo build error in the log.

- [ ] **Step 6: Open it and look**

```bash
open http://localhost:1319/projects/teightysix/
```

Confirm by eye: the header still shows the status pill, both links, and the tags; the three stub figures render; the CTA is at the bottom.

- [ ] **Step 7: Add the lightbox test**

Append to `tests/e2e/article-figures.test.js`, before `await browser.close()`:

```js
// Review Focus 2: without the dialog in the layout, every zoom button is a
// dead click and nothing throws.
await runTest('the lightbox dialog exists and a figure opens it', async () => {
	const dialogs = await page.$$eval('.shot-lightbox', els => els.length);
	if (dialogs !== 1) throw new Error(`expected exactly 1 .shot-lightbox, got ${dialogs}`);
	await page.click('.article-fig .gallery-item__zoom');
	await page.waitForSelector('.shot-lightbox[open]', { timeout: 3000 });
	const src = await page.$eval('.shot-lightbox img', i => i.getAttribute('src'));
	if (!src) throw new Error('lightbox opened with no image src');
	await page.keyboard.press('Escape');
	await page.waitForFunction(() => !document.querySelector('.shot-lightbox[open]'), { timeout: 3000 });
});
```

- [ ] **Step 8: Run the figure tests**

Run: `node tests/e2e/article-figures.test.js`
Expected: PASS on all figure, plate, compare and lightbox assertions against the stub body.

- [ ] **Step 9: Add the phone-width overflow test**

Append to `tests/e2e/article-figures.test.js`, before `await browser.close()`:

```js
// Review Focus 5: commit e322030 fixed horizontal scroll on this branch once
// already; a wide figure is the obvious way to reintroduce it.
await runTest('no horizontal overflow at 375px', async () => {
	await page.setViewport({ width: 375, height: 812 });
	await page.goto(URL, { waitUntil: 'networkidle0' });
	const over = await page.evaluate(() =>
		document.documentElement.scrollWidth - document.documentElement.clientWidth);
	if (over > 0) throw new Error(`page scrolls ${over}px horizontally at 375px wide`);
	const wide = await page.$$eval('.article-fig, .article-plate', els =>
		els.filter(e => e.getBoundingClientRect().width > document.documentElement.clientWidth).length);
	if (wide) throw new Error(`${wide} figures wider than the viewport`);
	await page.setViewport({ width: 1280, height: 900 });
});
```

- [ ] **Step 10: Run it**

Run: `node tests/e2e/article-figures.test.js`
Expected: PASS. If it fails, the culprit is almost always a `width:` rule outside the `max-width: 767px` block; fix the CSS, not the test.

- [ ] **Step 11: Commit**

```bash
git add layouts/projects/article.html static/css/projects.css content/projects/teightysix.md tests/e2e/article-figures.test.js
git commit -m "Add the article layout, its CSS, and the figure tests"
```

---

### Task 7: `Article` JSON-LD for article-layout pages

**Files:**
- Modify: `layouts/partials/jsonld.html`
- Test: `tests/e2e/article-figures.test.js`

**Interfaces:**
- Consumes: `layout: article` in frontmatter, set in Task 6.
- Produces: an `Article` JSON-LD node on this page; every other project page keeps its `CreativeWork`.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/article-figures.test.js`, before `await browser.close()`:

```js
// Review Focus 4: a wrong schema type is invisible without viewing source.
await runTest('the article page emits Article JSON-LD, not CreativeWork', async () => {
	await page.goto(URL, { waitUntil: 'networkidle0' });
	const blobs = await page.$$eval('script[type="application/ld+json"]', ss => ss.map(s => s.textContent));
	const types = blobs.flatMap(b => {
		const parsed = JSON.parse(b);
		const nodes = parsed['@graph'] || [parsed];
		return nodes.map(n => n['@type']);
	});
	if (!types.includes('Article')) throw new Error(`no Article node; types were ${types.join(', ')}`);
	if (types.includes('CreativeWork')) throw new Error('CreativeWork still emitted for the article page');
});

await runTest('an ordinary project page still emits CreativeWork', async () => {
	await page.goto(`${BASE_URL}/projects/nurbits/`, { waitUntil: 'networkidle0' });
	const blobs = await page.$$eval('script[type="application/ld+json"]', ss => ss.map(s => s.textContent));
	const types = blobs.flatMap(b => {
		const parsed = JSON.parse(b);
		const nodes = parsed['@graph'] || [parsed];
		return nodes.map(n => n['@type']);
	});
	if (!types.includes('CreativeWork')) throw new Error(`nurbits lost CreativeWork; types were ${types.join(', ')}`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/e2e/article-figures.test.js`
Expected: FAIL with "no Article node; types were CreativeWork".

- [ ] **Step 3: Read the partial before editing**

Read `layouts/partials/jsonld.html` in full and find the branch that emits `CreativeWork` for project pages, including how it int-casts `copyrightYear`.

- [ ] **Step 4: Branch it**

In the project-page branch, wrap the existing `CreativeWork` object in a conditional and add the `Article` alternative. The `Article` node carries:

```go-html-template
{{ if eq .Params.layout "article" }}
{
	"@type": "Article",
	"headline": {{ .Title }},
	"description": {{ .Params.description | default .Summary }},
	"image": {{ with .Params.image }}{{ . | absURL }}{{ else }}""{{ end }},
	"datePublished": {{ .Date.Format "2006-01-02" }},
	"author": { "@type": "Person", "name": "{{ .Site.Params.firstName }} {{ .Site.Params.lastName }}" },
	"mainEntityOfPage": { "@type": "WebPage", "@id": {{ .Permalink }} }
}
{{ else }}
	{{/* Paste the existing CreativeWork object here verbatim, including its
	     int-cast copyrightYear. Do not retype it from memory. */}}
{{ end }}
```

Match the surrounding file's quoting and comma handling exactly; a stray comma makes the whole blob unparseable and the test will catch it as a `JSON.parse` throw rather than a type mismatch.

- [ ] **Step 5: Run the tests**

Run: `node tests/e2e/article-figures.test.js`
Expected: PASS on both JSON-LD assertions.

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/jsonld.html tests/e2e/article-figures.test.js
git commit -m "Emit Article JSON-LD for article-layout project pages"
```

---

### Task 8: Retarget the story-strip tests

**Files:**
- Modify: `tests/e2e/project-detail.test.js`

**Interfaces:**
- Consumes: the article page from Task 6.
- Produces: a test file with no assertions against `.story-strip__row`, and the header, CTA and em-dash assertions intact.

The `story:` frontmatter list is gone, so `storyEntries()`, the two story-strip tests, the lazy/alt story test and the `zz-story-fixture` case all assert against markup that no longer exists on this page. The figure equivalents now live in `article-figures.test.js`.

- [ ] **Step 1: Confirm the file currently fails**

Run: `node tests/e2e/project-detail.test.js`
Expected: FAIL on "story strip renders exactly the complete entries" with `teightysix.md has no story list`.

- [ ] **Step 2: Delete the story-specific assertions**

Remove from `tests/e2e/project-detail.test.js`: the `storyEntries()` helper, the `story` and `complete` consts, the test `story strip renders exactly the complete entries, in order`, the test `story strip skips entries missing src or text` including its `zz-story-fixture` block, and the test `story images are lazy and have alt text`. Drop the now-unused `writeFileSync`, `unlinkSync` and `readFileSync` imports.

**Do not delete** `header shows the live link before GitHub`, `CTA shows the live link first`, or `no em dash anywhere in the rendered page text`. The em-dash test enforces a Global Constraint and is the only automated check on the voice contract.

- [ ] **Step 3: Repoint the lightbox test**

The remaining test `screenshot grid opens the lightbox` clicks `.gallery-item__zoom`, which the `fig` shortcode still emits, so it passes unchanged. Rename it to `a figure opens the lightbox` for accuracy and leave the body alone.

- [ ] **Step 4: Run it**

Run: `node tests/e2e/project-detail.test.js`
Expected: PASS on all four remaining tests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/project-detail.test.js
git commit -m "Retarget the project detail tests at the article layout"
```

---

### Task 9: Draft beats 1 to 7

**Gated by Task 1.** Do not start until `.codex/teightysix-article-answers.md` exists.

**Files:**
- Modify: `content/projects/teightysix.md` (body)

**Interfaces:**
- Consumes: the answers file, the shortcodes from Tasks 3 to 5, the figures from Tasks 1 and 2.
- Produces: the first half of the article body. Task 10 appends to it.

- [ ] **Step 1: Read the three source documents together**

Read, in this order: the spec's beat descriptions and citation table; `.codex/teightysix-article-answers.md`; and Brian's original voice transcript in the session record. Do not begin drafting from the spec alone — the spec says what each beat covers, the answers say how Brian says it, and the second is the one that makes the draft his.

- [ ] **Step 2: Draft beats 1 to 7 into the body**

Replace the stub body. Beats 1 through 7 are: the basement; cutting them up; a question about scans; seventy-five years too early; two archives animating each other; the pivot message; the type came first.

Working rules while drafting:

- Every factual claim traces to the spec's citation table. If a sentence has a number in it and you cannot point at the row, cut the number.
- Where an answer contradicts the record, follow the record and mark the line: `<!-- record says X; Brian's answer said Y -->`.
- Where a `[BLOCKING]` question went unanswered, write `<!-- GAP: interview Q{n} unanswered -->` and write around it. Do not invent the detail.
- Quote the two messages as block quotes: the 2026-08-27 scan question and the 2026-08-29 pivot pair.
- Figures for this half: the collage set (beats 1 and 2), `loc/dorgan-1887` and `loc/dorgan-model` as a plate (beat 5), `story/alphabet` (beat 7).
- No em dashes. US spellings. First person.

- [ ] **Step 3: Verify the build and the figures**

```bash
/opt/homebrew/bin/hugo --renderToMemory --quiet; echo "exit=$?"
node tests/e2e/article-figures.test.js
```

Expected: exit 0 from Hugo, PASS from the figure tests.

- [ ] **Step 4: Read it on the page**

```bash
open http://localhost:1319/projects/teightysix/
```

Read it top to bottom on screen, not in the file. Line length, figure placement and paragraph rhythm are only judgeable rendered.

- [ ] **Step 5: Commit**

```bash
git add content/projects/teightysix.md
git commit -m "Draft the article: basement through the type cut"
```

---

### Task 10: Draft beats 8 to 14

**Gated by Task 1.**

**Files:**
- Modify: `content/projects/teightysix.md` (body)

**Interfaces:**
- Consumes: everything Task 9 consumed, plus the body Task 9 wrote.
- Produces: the complete article body.

- [ ] **Step 1: Draft beats 8 to 14**

The beats are: a kid's microscope; the back and a mascot with a job; nobody is in the right uniform; off the page and onto a table; ten thousand cards and one bad column; shipping it; still on the bench.

Same working rules as Task 9 Step 2. Figures for this half: `micro/rosette`, `micro/cut-edge`, `micro/edge-strip`, `micro/edge-texture` (beat 8); `story/mascot-bake-off` and `shots/back-turned-over` (beat 9); `story/three-hands` and `story/wrong-uniforms` (beat 10); `press-loaded` and the `compare` slider (beat 11); `story/pile-runaway` with `story/pile-fixed` as a plate, and `shots/pile-top-down` (beat 12).

Two specific instructions the spec calls out:

- Beat 8 uses the **measured** screen ruling, ~122 LPI. Beat 7's ink-survival argument stays qualitative, because `TOPPS86.md`'s "~133 lpi" is an era assumption and the two must not both read as measurements.
- Beat 8 handles the microscope's owner exactly as interview Q35 answers it, and mentions no family member unless Brian said yes.

- [ ] **Step 2: Write the close**

Beat 14 ends on `writeup.md`: written day two, mission "the public story of this project — blog post", zero commits in the retrospective's fate table, this article being that branch. Interview Q58 asks whether that framing lands; if Brian said it is too neat, cut it and close on the honest unfinished list instead.

- [ ] **Step 3: Verify the build and the figures**

```bash
/opt/homebrew/bin/hugo --renderToMemory --quiet; echo "exit=$?"
node tests/e2e/article-figures.test.js
```

Expected: exit 0, PASS.

- [ ] **Step 4: Commit**

```bash
git add content/projects/teightysix.md
git commit -m "Draft the article: the microscope through what is still on the bench"
```

---

### Task 11: Deslop, fact-check, and ship the branch

**Files:**
- Modify: `content/projects/teightysix.md`
- Modify: `README.md` if it carries a project blurb that now contradicts the page

**Interfaces:**
- Consumes: the complete body from Task 10.
- Produces: a branch ready for PR.

- [ ] **Step 1: Run the deslop skill over the body**

Invoke the `deslop` skill on the article body. Apply its findings, but hold the voice contract above its defaults: Brian's own constructions are not slop, and a phrase that came straight out of the answers file stays even if it reads as informal.

- [ ] **Step 2: Fact-check every number against the citation table**

Walk the rendered article and, for each number, date, quote and proper noun, point at its row in the spec's citation table. Cut anything you cannot source. Pay particular attention to: 1,379 commits; 2,083 fronts; 65 off-by-one shifts; $6 and $15; 61 to 146 letter observations; 1195 px/mm; ~122 LPI; 0.208 mm; 0.453 mm; 65 and 48 µm; (204, 181, 124); 256 live; 10,000 cards; 1.5 m and 233 mm; 10/4/1 per hundred; 2026-09-25.

- [ ] **Step 3: Resolve every inline marker**

```bash
grep -n '<!-- GAP\|<!-- record says' content/projects/teightysix.md
```

Take each one to Brian. A marker left in the file is a blocker, not a note.

- [ ] **Step 4: Run the full suite**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test
```

Expected: every test file passes, including `showpiece.test.js` untouched and `project-assets.test.js` covering the new `collage/`, `micro/` and `loc/` paths.

- [ ] **Step 5: Check the page at both widths**

```bash
open http://localhost:1319/projects/teightysix/
```

Read it at desktop width and at 375px. Confirm no horizontal scroll, figures sit where the prose wants them, and the lightbox opens and closes.

- [ ] **Step 6: Confirm the home page is unchanged**

```bash
open http://localhost:1319/
```

The showpiece tile still leads the wall and still links here. `showpiece.test.js` asserts this, but look anyway.

- [ ] **Step 7: Commit and open the PR**

```bash
git add -A
git commit -m "Deslop and fact-check the teightysix article"
git push -u origin feat/teightysix-showpiece
gh pr create --title "teightysix: the project page becomes a narrated article" --body "$(cat <<'BODY'
## Summary

Replaces the structured product page at /projects/teightysix/ with a long-form
narrated article. A new `layouts/projects/article.html`, selected by `layout: article`,
renders the body prose-first with figures placed inline; `single.html` and every other
project page are untouched. Three new shortcodes (`fig`, `compare`, `plate`) emit markup
that the existing `shot-lightbox.js` and `img-compare.js` already bind to, so no new
JavaScript ships.

The feature grid, the fixed story strip and the screenshot grid are gone: they restated
the prose almost verbatim, and their content now lives in the article where it belongs.

## Test plan

- `npm test` green, including the new `tests/e2e/article-figures.test.js`
- Figure accessibility, lightbox, compare-slider wiring and 375px overflow all covered
- `Article` JSON-LD asserted on this page, `CreativeWork` asserted still present on /projects/nurbits/
- Read at desktop and 375px; home page showpiece tile unchanged

## Notes

- No finished render of a current MLB player is published; the 1887 section uses the
  public-domain Dorgan pair, per the rights decision in the design spec.
- Every number in the article traces to the citation table in the spec.
- Post-deploy: check PageSpeed Insights, not a local Lighthouse run.
BODY
)"
```

Per the user's standing rules: push with `git`, not `gh`; no `Co-Authored-By` and no `Claude-Session` trailers; never merge to main without asking.

- [ ] **Step 8: Note the post-deploy check**

Add to the PR body: run PageSpeed Insights at https://pagespeed.web.dev after deploy, not a local Lighthouse run. Local runs on this machine are contention-dominated and have swung the same URL across 50 to 82 on performance.
