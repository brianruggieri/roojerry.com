# roojerry

Personal portfolio and resume site for Brian Ruggieri — [roojerry.com](https://roojerry.com)

Built with [Hugo](https://gohugo.io/), based on [eddiewebb/hugo-resume](https://github.com/eddiewebb/hugo-resume) (MIT). Theme customizations (interactive physics background, achievement system, nav animations) live in project-level overrides under `layouts/`, `static/css/`, and `static/js/`.

## Local Development

```bash
hugo server
```

Open [http://localhost:1313](http://localhost:1313).

## Structure

- `data/` — Resume content (experience, skills, education)
- `content/projects/` — Project write-ups
- `static/img/` — Images
- `static/css/` — Custom stylesheets (project-level overrides)
- `static/js/` — Custom scripts (physics background, achievements, nav animations)
- `layouts/` — Custom layout overrides (baseof.html, partials, vCard)
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
