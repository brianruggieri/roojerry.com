# Theme Dependency Cleanup Design

**Date:** 2026-02-21
**Status:** Approved
**Branch:** `theme-dependency-cleanup`

## Context

The roojerry.com site uses the `eddiewebb/hugo-resume` Hugo theme, which was originally a git submodule. In commit `b117eb1`, the submodule was dissolved and the theme was vendored directly into `themes/resume/`. Since then, ~55 KB of custom CSS/JS and multiple custom templates have been added directly inside the vendored theme directory. The README describes this as "a customized fork of the resume theme," but the repo is not a GitHub fork — it's an independent site repo with a vendored theme copy.

The custom work has diverged permanently from upstream. There is no intent to track upstream updates.

## Decision

Keep the vendored theme inside this repo. Clean up the structure by splitting custom code into project-level overrides (Hugo's standard override mechanism) and leaving upstream-origin files in `themes/resume/`. Update README language and ensure MIT license compliance.

## File Moves

### Custom CSS → `static/css/` (project root)

- `resume-override.css`
- `tweaks.css`
- `background.css`
- `achievements.css`
- `field-controls.css`
- `disturbance-controls.css`
- `design-system.css`

### Custom JS → `static/js/` (project root)

- `bg-field.js`
- `name-disturbance.js`
- `field-controls.js`
- `name-field.js`
- `coin-flip.js`
- `nav-scroll-reveal.js`
- `achievements.js`

### Stays in `themes/resume/static/` (upstream-origin)

- `resume.css`
- `resume.js`

### Custom partials → `layouts/partials/` (project root)

- `background.html`
- `disturbance-controls.html`
- `field-controls.html`

### Custom layouts → `layouts/_default/` (project root)

- `baseof.html` — heavily modified; becomes project-level override
- `contact.vcf` — custom vCard template

### Stays in `themes/resume/layouts/`

All other upstream-origin templates: `section.html`, `single.html`, `list.html`, `nav.html`, `about.html`, `portfolio/*`, shortcodes, etc.

### Custom archetypes → `archetypes/` (project root)

- `adv-ride/`
- `blog-post/`

### baseof.html strategy

Copy the current modified `baseof.html` to `layouts/_default/baseof.html` (project root). Restore `themes/resume/layouts/_default/baseof.html` to a clean upstream-like version (without custom additions). Hugo's file precedence means the project-level file wins, so the site renders identically.

## Upstream artifact cleanup

Remove from `themes/resume/`:
- `.circleci/` — upstream CI, not used (site uses GitHub Actions)
- `Jenkinsfile` — upstream artifact, not used
- `exampleSite/` — upstream demo site, not needed

## License & Attribution

- **Keep** `themes/resume/LICENSE.md` as-is (upstream MIT license with Eddie Webb's copyright)
- **Update README** to replace "customized fork" with accurate language and maintain upstream attribution link
- No NOTICE file needed — LICENSE.md + README attribution satisfies MIT requirements

## README wording

Replace current theme description with:

> Built with Hugo, based on [eddiewebb/hugo-resume](https://github.com/eddiewebb/hugo-resume) (MIT). Theme customizations (interactive physics background, achievement system, nav animations) live in project-level overrides under `layouts/`, `static/css/`, and `static/js/`.

## Verification

1. **Pre-migration build:** Run `hugo` and capture output in `public/`
2. **Execute all file moves**
3. **Post-migration build:** Run `hugo` and diff against pre-migration output
4. **Expectation:** HTML output should be byte-identical (ignoring build timestamps)
5. **Visual spot-check:** Run `hugo server` and verify:
   - Homepage renders with background canvas and name disturbance effect
   - Nav scroll-reveal animations work
   - Achievement system fires on coin clicks
   - Control panels (disturbance/field) functional
   - Mobile responsive layout intact
   - vCard download works

## What does not change

- `themes/resume/LICENSE.md`
- `themes/resume/theme.toml`
- `hugo.toml` / site config (`theme = "resume"`)
- `themes/resume/i18n/` — internationalization files
- Any upstream-origin layout templates in `themes/resume/layouts/`
