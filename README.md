# roojerry

Personal portfolio and resume site for Brian Ruggieri — [roojerry.com](https://www.roojerry.com)

[![Deploy](https://img.shields.io/github/actions/workflow/status/brianruggieri/roojerry.com/deploy.yml?branch=main&label=deploy&style=flat-square)](https://github.com/brianruggieri/roojerry.com/actions)
[![Last commit](https://img.shields.io/github/last-commit/brianruggieri/roojerry.com?style=flat-square)](https://github.com/brianruggieri/roojerry.com/commits/main)
[![Built with Hugo](https://img.shields.io/badge/built%20with-Hugo-FF4088?style=flat-square&logo=hugo&logoColor=white)](https://gohugo.io)

**Lighthouse** (last run: 2026-03-04)
[![Performance](https://img.shields.io/badge/Performance-86-yellowgreen?style=flat-square&logo=lighthouse&logoColor=white)](https://github.com/brianruggieri/roojerry.com/issues)
[![Accessibility](https://img.shields.io/badge/Accessibility-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](https://github.com/brianruggieri/roojerry.com/issues)
[![Best Practices](https://img.shields.io/badge/Best%20Practices-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](https://github.com/brianruggieri/roojerry.com/issues)
[![SEO](https://img.shields.io/badge/SEO-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](https://github.com/brianruggieri/roojerry.com/issues)

![Site screenshot](docs/img/readme/about-hero.png)

Built with [Hugo](https://gohugo.io/), based on [eddiewebb/hugo-resume](https://github.com/eddiewebb/hugo-resume) (MIT). Theme customizations live in project-level overrides under `layouts/`, `static/css/`, and `static/js/`, and include:

- **Interactive physics background** — canvas-based particle field that reacts to mouse movement and scrolling
- **Achievement system** — unlockable badges triggered by visitor interactions
- **Scroll-reveal navigation** — animated sidebar nav

## Local Development

```bash
npm run dev      # hugo server with drafts enabled
npm run build    # production build (hugo --minify)
```

These commands expect [Hugo](https://gohugo.io/) to be installed. The `package.json` scripts are currently configured to invoke Hugo from the macOS Homebrew path `/opt/homebrew/bin/hugo`. On other platforms (Linux, Windows) or macOS setups where Hugo is available on your `$PATH` but not at that exact location, you may need to either:

- Install Hugo so that the binary is available at `/opt/homebrew/bin/hugo`, **or**
- Update the `hugo` paths in `package.json` locally so they match where Hugo is installed on your system (for example, using just `hugo` if it’s on your `$PATH`).
Open [http://localhost:1313](http://localhost:1313).

## Testing

End-to-end and visual regression tests run with [Puppeteer](https://pptr.dev/):

```bash
npm test              # e2e + simulation tests
npm run test:visual   # visual regression snapshots
```

## Structure

- `data/` — Resume content (experience, skills, education, creations)
- `content/projects/` — Project write-ups
- `static/img/` — Images
- `static/css/` — Custom stylesheets (project-level overrides)
- `static/js/` — Custom scripts (physics background, achievements, nav animations)
- `layouts/` — Custom layout overrides (baseof.html, partials)
- `tests/` — Puppeteer-based e2e and visual regression tests
- `themes/resume/` — Vendored upstream theme (eddiewebb/hugo-resume)

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds with Hugo and deploys via rsync. Requires these repository secrets:

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | SSH host |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_PATH` | Remote path |
| `DEPLOY_KEY` | SSH private key |
