# teightysix showpiece page and project copy polish

Design spec, 2026-09-25. Approved in chat with all defaults.

## Goal

Make teightysix (cards.roojerry.com) the most prominent project on the portfolio:
a lead slot on the home page and a detail page built from the repo's own curated
capture stream. While in there, rewrite the copy on every existing project page so
nothing on the site reads as machine-written.

## Source material

- Public repo: `~/git/baseball-cards/teightysix` (GitHub `brianruggieri/teightysix`),
  live at https://cards.roojerry.com since release 1.0.0. Stage 1 is static assets
  only: no publish backend, photographs stay in the browser.
- Spec and history: `.claude/SPEC.md`, `.claude/ROADMAP.md`, `.claude/HANDOFF.md`,
  `.claude/PLAN-RELEASE.md`, `.claude/run-reports/*.md` in that repo.
- Frames: `.claude/captures/kept/*.png|jpg`, with label, caption, reason and context
  per frame in `.claude/captures/captures.jsonl` (status `kept`).

## Content rule (binding)

The teightysix repo records a legal posture (D13 in `PLAN-RELEASE.md` §4.4 and its
`CLAUDE.md`): the public bench ships invented players on generated portraits, place
names and team colours but never club marks, and a small Commons-licensed showcase
of real players with attribution. The portfolio page follows the same line.

Allowed on the portfolio page:

- invented players (the Marlo Fenn backs, the dream set, the tarot)
- the Commons-attributed showcase frames, as deployed
- process and tooling frames (the alphabet specimen, the position board, the
  press-opens-empty pair, the mascot bake-off, the LoRA drift strip, the pile
  scenes, the cut-edge and wear ladders where the subject is invented or Commons)
- the live site's own `og.jpg`

Standard applied at review (coordinator call, 2026-09-25, for Brian to confirm
at the PR): the public bench switched to invented players and Commons
photographs on 2026-09-10, so any pile capture dated before that shows the
original real-MLB seed set. Such a frame ships only if no real person is
recognizable at the shipped size. Under that test the 10,000-card runaway and
its fix (cards a few pixels each, smeared into columns) stay, and every frame
with legible headshots in the pile was dropped and recaptured from the live
site. Not allowed: any frame whose subject is a real player rendered from the parent
repo's local content (Ohtani, Trout, Betts, Rutschman, Witt, Ober, Bo Jackson
frames and the Bailey Ober half of `blue-means-it-never-happened`). When a frame's
manifest `context` does not settle it, leave it out.

The copy must not claim "no real players". The accurate line is "invented players,
plus a small attributed showcase".

## Home page

`layouts/partials/experimentsWall.html` gains a showpiece slot:

- A page with `showpiece: true` in frontmatter renders through a new partial
  `layouts/partials/showpieceTile.html` above the `.exp-grid--featured` grid and is
  excluded from that grid's loop. Exactly one page carries the flag; if several do,
  the first by weight wins and the rest fall back to ordinary featured tiles.
- The tile spans the full section width: poster on one side, title, one-line
  blurb, two links (primary "Make a card" to cards.roojerry.com, secondary
  "How it was built" to the detail page). On narrow viewports it stacks.
- The poster is a 1280-wide webp derived from a kept frame, with explicit width and
  height attributes so CLS stays at 0. `loading="eager"` and `fetchpriority="high"`
  only if measurement shows it is the LCP element; otherwise lazy like the rest.
- Styles live in `static/css/experiments-wall.css` under `.exp-showpiece*`. Bump the
  cache-buster on that stylesheet link in `layouts/_default/baseof.html`.

## Detail page `content/projects/teightysix.md`

Frontmatter: `title: "teightysix"`, `subtitle: "make a 1986 baseball card"`,
`showpiece: true`, `featured: true`, `year: "2026"`, `github`, a new `live` param
(`https://cards.roojerry.com`) that the header renders as a primary link, tags
(TypeScript, Svelte, WebGPU, Three.js, Rapier, Cloudflare Workers, Python parity),
`compare` with two captures taken from the live site at the same viewport (the
empty press with START WITH A PHOTOGRAPH, then the same bench with one of the
site's own sample photographs loaded; the kept `the-press-opens-empty` frame is
not usable because its right half is an Ohtani card), `features` (3 columns,
6 items), `screenshotsGrid: true` with 8 frames, and a new `story` list.

Body copy, in Brian's voice, roughly 250 words: what it is, the parity claim (the
browser render is byte-exact to the Python pipeline, 98/98 fixtures), the 3D pile,
the wear model, the reconstructed typeface, the content posture. Facts come from
the repo docs; nothing is invented, and numbers are quoted with their source
report named in a comment in the frontmatter, not in the prose.

### New `story` section

`layouts/projects/single.html` gains a block after the feature grid:

```yaml
story:
  - src: "/img/projects/teightysix/story/alphabet.png"
    title: "An alphabet rebuilt"
    text: "..."
```

Rendered as `.story-strip`: alternating image and paragraph rows, images lazy,
webp with png fallback, same picture pattern as the gallery. Six frames at most.
Styles in `static/css/projects.css`; bump `projects.css?v=5` to `?v=6`.

### Header `live` link

`single.html` and the tile partial treat `.Params.live` like `github` and
`release`: a `project-card__link project-card__link--live` anchor with the
`fas fa-external-link-alt` icon (already in `icon.html`). Label "Open the bench".
The CTA block at the bottom gets the same link first.

## Assets

`static/img/projects/teightysix/`:

- `hero.png` + `hero.webp` (1800 wide max, the compare "after" or the single hero)
- `poster.webp` (1280 wide, home tile)
- `shots/*.webp` for the grid (1600 wide max, webp only, same rule as yt-music)
- `story/*.png|webp` for the story strip (1600 wide max)

Export with `cwebp -q 82`. Keep PNG only where a template needs the fallback
(`image`, `compare`, `story`). Total new bytes under 4 MB.

## Copy polish on existing pages

Every file under `content/projects/` is rewritten to the `deslop` skill's rules
(installed at `~/.claude/skills/deslop`, with the Wikipedia pattern list in its
references). Concretely:

- zero em dashes in frontmatter strings and body (`grep -c '—'` returns 0 per file)
- no "not X, just Y" or "no A, no B, just C" constructions
- no bold-first bullets, no tricolons where two items do
- every fact, link, number and product name preserved
- thin pages (BeeTees, Biology Interactive Case Studies, Earth: Lost In
  Translation, Nice Job Hero, Orbstep) get one extra concrete sentence only if a
  fact for it exists in the repo or git history; otherwise leave them short
- templates in `layouts/` also drop em dashes from visible strings (the
  `&ldquo;` tagline quotes stay; alt text like "Title — screenshot" becomes
  "Title screenshot")

## Out of scope

- Embedding the bench in an iframe (WebGPU plus hundreds of MB of textures is the
  wrong tier for an overlay).
- Changing the home page `og:image`.
- Any change to the teightysix repo.

## Verification

- `npm test` passes in the worktree (the wall e2e test must still find a
  `.exp-tile--project` and the play/live tiles).
- New e2e checks: the showpiece tile exists once, links to the detail page and
  the live site, and the detail page's story strip and lightbox render.
- `hugo --minify` builds clean.
- `grep -rn '—' content/projects layouts` returns nothing.
- Visual check of home and detail at 390px and 1280px widths.
- Cross-family review (Codex) of the diff before the PR.
- After deploy, PageSpeed Insights mobile and desktop, badges updated if changed.
