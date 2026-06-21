# Experiments Wall — Homepage Redesign

**Date:** 2026-06-18
**Status:** Approved design, ready for implementation planning
**Author:** Brian Ruggieri (with Claude)

## Summary

Replace the homepage Projects section's stacked showcase cards with a **two-tier
"experiments wall"** inspired by [screen.toys](https://screen.toys/): a grid of
playful, *alive* tiles that pulls the site slightly away from a pure resume and
toward a tinkerer's portfolio. The wall keeps the site's existing teal/glass
brand identity but borrows screen.toys' layout discipline (large media tiles,
generous gaps, title + one-line caption typography).

Two tiers:

- **Featured work** (top, large tiles): a small number of higher-weight projects
  — Nurbits plus 1–2 others to be surfaced later.
- **Experiments** (below, denser grid): playful toys — Voxel Field, Voxel Fire,
  Voxel Fluid, tube-tree, dog-playground, and future experiments.

## Goals

- Make the homepage feel alive and inviting to play with, not just read.
- Reuse the fullscreen "interactive embed" component already built in PR #15
  (dog-playground) as the foundation.
- Maintain the standing **Lighthouse-max** priority: no heavy assets (iframes,
  WebGL) at page load; everything lazy and interaction-gated.
- Keep the change cohesive with the existing brand and Hugo architecture.

## Non-Goals (out of scope)

- Filtering, tags, or search on the wall.
- Dedicated detail/write-up pages for individual experiments (toys open
  fullscreen in place; only *projects* navigate to detail pages).
- Re-architecting how experiments are built/deployed, or de-bloating the
  tube-tree texture set (see "Notes on repo size").
- The fit/landing redesign (PR #20) and the asset-import pipeline (PR #17) —
  orthogonal, though #17 may later auto-generate posters.

## Background / Current State

- **Homepage** (`layouts/index.html`) renders a single scrolling page: About →
  Projects → Experience → Skills → Education. Projects render via the
  `sectionSummary` partial → `projectsSummary.html`, producing large
  screenshot-on-one-side showcase cards.
- **PR #15 (dog-playground)** built a reusable `interactive` embed: a preview
  canvas with a play button that expands an iframe into a **fullscreen takeover**
  (hides nav, background controls, canvases), closeable via X / Esc, with the
  iframe unloaded on close. Driven by `interactive.src` / `interactive.title` /
  `interactive.deco` frontmatter. Files: `static/js/interactive-embed.js`,
  `static/css/interactive-embed.css`, plus wiring in `layouts/_default/baseof.html`
  and `layouts/projects/single.html`. **This is the foundation for the wall.**
- **Deployed experiments are committed to the repo** under `static/experiments/`
  (on `origin/main`), served at `/experiments/...`:
  - `voxel/index.html` — "Voxel Field", ~6 KB, self-contained.
  - `voxel/fire.html` — "Voxel Fire", ~13 KB, self-contained.
  - `voxel/fluid.html` — "Voxel Fluid", ~11 KB, self-contained.
    (Whole `voxel/` directory is ~36 KB — all lightweight.)
  - `tube-tree/` — Vite/three.js app; **~55 MB total** (4.3 MB JS bundle +
    ~50 MB of bark/leaf textures). Must never load until explicitly opened.
- **Projects** (`content/projects/*.md`): Nurbits (`featured: true`), Daily
  Digest (`featured: true`), plus BeeTees, Biology Interactive Case Studies,
  Earth: Lost In Translation, Nice Job Hero, Orbstep. dog-playground is added by
  PR #15 — **reclassified here as an experiment, not featured work.**
- There is currently **no** `content/experiments/` section and no committed
  `static/experiments/index.html` (the live `/experiments/` listing is a server
  autoindex).

## Tile Taxonomy

A `kind` field on each tile drives its appearance and behavior:

| kind | Examples | At rest | Hover / tap (desktop hover, touch tap) | Click / Enter |
|---|---|---|---|---|
| **live** | Voxel Field/Fire/Fluid (≤13 KB each) | CSS/canvas shimmer "poster" so the tile looks alive | boots the real toy **inline** inside the tile (lazy iframe) | expands to **fullscreen takeover** (PR #15 component) |
| **play** | tube-tree (55 MB), dog-playground | poster image (optional looping muted webm for extra life) | — (too heavy to boot inline) | expands to **fullscreen takeover** (PR #15 component) |
| **project** | Nurbits, future featured work | poster image + caption | subtle lift/hover affordance | **navigates** to the project detail page |

Every tile displays:

- A small **badge** in a corner: `live` / `play` / `project`.
- A **caption** below the media: bold title + one short descriptive line
  (screen.toys voice).

## Architecture

### Content / data model

- **New content section `content/experiments/`** — one markdown stub per toy
  (frontmatter only, no body required). Frontmatter fields:
  - `title` (string) — display name, e.g. "Voxel Field"
  - `blurb` (string) — one-line caption
  - `kind` (`live` | `play`) — drives behavior (experiments are never `project`)
  - `src` (string) — URL of the deployed toy, e.g. `/experiments/voxel/` or
    `/experiments/voxel/fire.html`
  - `poster` (string) — path to the at-rest image, e.g.
    `/img/experiments/voxel-field.webp`
  - `preview` (string, optional) — path to a looping muted webm for `play` tiles
  - `weight` (int) — ordering within the experiments grid
  - The toy bundles themselves already live in `static/experiments/`; these stub
    files add the metadata the wall needs to render and order them.
- **Featured tier** continues to read `content/projects/*.md` where
  `featured: true`. Featured projects render as `kind: project` tiles. (Which
  projects are featured beyond Nurbits is a content decision made later by
  editing frontmatter — the design supports any count.)

### Templates

- **New partial `layouts/partials/experimentsWall.html`** renders both tiers:
  the featured-projects tile row and the experiments grid. It replaces the
  current `sectionSummary` invocation for the `projects` section in
  `layouts/index.html`.
- A small tile sub-template (inline or a second partial) renders one tile given
  its `kind`, media, badge, and caption, emitting the right data attributes for
  the JS controllers.
- `projectsSummary.html` (the old showcase card) is retained only if still used
  elsewhere; otherwise it can be removed in this change since the homepage no
  longer calls it. Implementation should verify call sites before deleting.

### JavaScript

- **Reuse `interactive-embed.js` (PR #15)** for the fullscreen takeover used by
  both `play` tiles and the full-click of `live` tiles.
- **New "live-tile waker"** (~30 lines, new small module): on hover (desktop) /
  tap / focus of a `live` tile, inject the toy's iframe inline into the tile to
  boot it. An `IntersectionObserver` unloads the inline iframe when the tile
  scrolls out of view to free resources. Respects `prefers-reduced-motion`
  (no auto-boot; user must explicitly activate).

### CSS

- Extend the brand design tokens (`static/css/design-system.css`) / add a wall
  stylesheet for the grid, tiles, badges, captions, shimmer posters, and the
  two-tier responsive layout. Reuse `interactive-embed.css` for fullscreen.

### Assets

- **Posters** committed to `static/img/experiments/` (webp + fallback),
  generated by screenshotting the live deployed toys. Each poster carries
  explicit `width`/`height` to protect CLS.
- Optional looping **webm previews** for `play` tiles, same directory.

## Performance & Accessibility

- **No iframes or WebGL at page load.** Live toys boot only on interaction;
  heavy toys boot only in fullscreen on click. Inline live iframes are unloaded
  when offscreen. This is doubly important for tube-tree (~55 MB).
- **Lighthouse-max** is a standing project priority: run
  `npx lighthouse@13.0.3 https://www.roojerry.com ...` after deploy and update
  the README badges + `.claude/lighthouse-YYYY-MM-DD.md`.
- **CLS:** posters have intrinsic dimensions; tiles reserve aspect-ratio space.
- **Keyboard:** tiles are focusable; Enter/Space activates; Esc closes fullscreen
  (inherited from PR #15). Badges and captions are real text.
- **Reduced motion:** `prefers-reduced-motion` disables shimmer animation and
  inline auto-boot; tiles fall back to static posters.

## Dependencies & Sequencing

1. **PR #15 must land first** (or its `interactive-embed` component be
   cherry-picked) — it is the foundation for the fullscreen takeover.
2. Implement this feature on the **`feat/experiments-wall` branch** (worktree at
   `.worktrees/experiments-wall`, created off `origin/main`) per project
   convention. Rebase onto `main` after #15 lands.
3. PR #17 (asset pipeline) is orthogonal; a later enhancement could have it
   auto-generate posters/webms for experiments.

## Notes on repo size (informational, not in scope)

The tube-tree directory carries ~50 MB of 1K bark/leaf textures committed to
the repo. This feature does not change that, but it's worth a future cleanup
pass (texture compression / dedup, or moving large binaries out of the static
tree) since it inflates clone size. Tracked separately, not part of this work.

## Success Criteria

- Homepage Projects section is replaced by the two-tier wall in the hybrid brand
  style.
- Featured projects (Nurbits + any others marked `featured: true`) render as
  large `project` tiles that navigate to their detail pages.
- Voxel Field, Fire, and Fluid render as `live` tiles: shimmer at rest, boot
  inline on hover/tap, fullscreen on click.
- tube-tree and dog-playground render as `play` tiles: poster at rest,
  fullscreen on click.
- No iframe/WebGL network or GPU work occurs until a tile is interacted with.
- Keyboard and reduced-motion paths work.
- Lighthouse scores hold at or above current (Perf ≥86, A11y/BP/SEO 100).
