# roojerry

Personal portfolio and resume site for Brian Ruggieri — [roojery.com](https://roojery.com)

Built with [Hugo](https://gohugo.io/) using a customized fork of the [resume theme](https://github.com/eddiewebb/hugo-resume).

## Local Development

```bash
hugo server
```

Open [http://localhost:1313](http://localhost:1313).

## Structure

- `data/` — Resume content (experience, skills, education)
- `content/projects/` — Project write-ups
- `static/` — Images and other static assets
- `themes/resume/static/` — CSS and JS (custom design system, background canvas, interactive effects)

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds with Hugo and deploys via rsync. Requires these repository secrets:

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | SSH host |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_PATH` | Remote path |
| `DEPLOY_KEY` | SSH private key |
