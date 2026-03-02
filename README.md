# roojerry

Personal portfolio and resume site for Brian Ruggieri — [roojerry.com](https://roojerry.com)

![Site screenshot](docs/img/readme/about-hero.png)

Built with [Hugo](https://gohugo.io/), based on [eddiewebb/hugo-resume](https://github.com/eddiewebb/hugo-resume) (MIT). Theme customizations live in project-level overrides under `layouts/`, `static/css/`, and `static/js/`, and include:

- **Interactive physics background** — canvas-based particle field that reacts to mouse movement and scrolling
- **Achievement system** — unlockable badges triggered by visitor interactions
- **Scroll-reveal navigation** — animated sidebar nav
- **vCard export** — downloadable contact card with phone number injected at build time

## Local Development

```bash
npm run dev      # hugo server with drafts enabled
npm run build    # production build (hugo --minify)
```

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
- `layouts/` — Custom layout overrides (baseof.html, partials, vCard)
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
| `PHONE` | Phone number injected into vCard at build time |
