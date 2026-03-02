---
title: "Daily Digest"
subtitle: "for Obsidian"
description: "Reads your browser history, search queries, Claude Code sessions, and git commits — then compiles them into an AI-summarized daily note. One command. One note. Everything you did today, in one place."
tagline: "Your day, distilled."
tags: ["TypeScript", "SQLite / WASM", "Obsidian API", "Anthropic Claude", "Ollama"]
statusLabel: "Awaiting Obsidian Community Review"
github: "https://github.com/brianruggieri/obsidian-daily-digest"
release: "https://github.com/brianruggieri/obsidian-daily-digest/releases/latest"
releaseIcon: "fas fa-download"
releaseLabel: "Download Latest"
ctaTitle: "Get Daily Digest"
ctaDesc: "Download from the latest release and drop it into your Obsidian vault's plugin folder."
image: "/img/projects/daily-digest/digest-hero.png"
featured: true
year: "2026"
features:
  - icon: "fas fa-layer-group"
    title: "Collects"
    desc: "Browser history, searches, Claude Code sessions, Codex CLI sessions, and git commits — everything in one pipeline."
  - icon: "fas fa-shield-alt"
    title: "Sanitizes"
    desc: "Scrubs API keys, tokens, passwords, and sensitive URLs before anything reaches your vault or the cloud."
  - icon: "fas fa-atom"
    title: "Summarizes"
    desc: "AI-generated headline, key themes, notable moments, and reflection questions tailored to your day."
  - icon: "fas fa-file-code"
    title: "Writes"
    desc: "A structured Markdown note with Dataview-ready frontmatter and a Notes section that's always preserved across regenerations."
screenshots:
  - src: "/img/projects/daily-digest/digest-hero.png"
    caption: "A full daily digest — headline, themes, and the day's activity in one note"
  - src: "/img/projects/daily-digest/digest-searches-claude.png"
    caption: "Search queries and Claude Code sessions, organized by project"
  - src: "/img/projects/daily-digest/digest-browser.png"
    caption: "Browser activity categorized and grouped by domain"
  - src: "/img/projects/daily-digest/privacy-onboarding.png"
    caption: "Privacy-first onboarding — every source is off by default"
privacyTiers:
  - tier: "4"
    label: "De-identified"
    desc: "Aggregated statistics only. No per-event data — just topic distributions, focus scores, and temporal shapes."
  - tier: "3"
    label: "Classified"
    desc: "Structured abstractions only — activity types, topics, entities. No raw URLs or queries sent."
  - tier: "2"
    label: "Compressed"
    desc: "Budget-proportional summaries — domain counts, top titles, queries. No full URLs."
  - tier: "1"
    label: "Standard"
    desc: "Full context (sanitized). All data types included. Used only with local models by default."
dataSources:
  - name: "Browser history"
    reads: "URLs, page titles, timestamps"
    how: "SQLite read-only copy"
  - name: "Search queries"
    reads: "Queries from Google, Bing, DuckDuckGo, Kagi, Perplexity"
    how: "Extracted from browser history URLs"
  - name: "Claude Code sessions"
    reads: "Your prompts to Claude Code (not responses)"
    how: "~/.claude/projects/**/*.jsonl"
  - name: "Codex CLI sessions"
    reads: "Your prompts to Codex CLI (not responses)"
    how: "~/.codex/history/*.jsonl"
  - name: "Git commits"
    reads: "Commit messages, timestamps, file change stats"
    how: "Local .git directories under a configurable parent folder"
---

What survives a workday: commits, a merged PR, a closed ticket. What doesn't: why I threw out the first approach. The searches that shifted my thinking. The rabbit hole that cost two hours and saved six.

I built this because I kept losing that context. After the third time I re-solved the same problem from scratch, I figured I needed a record. Daily Digest captures all of it and turns it into something you can actually read tomorrow — or six months from now.

**Everything is off by default.** You choose which data sources to enable and whether you want AI summaries. With a local model (Ollama, LM Studio), nothing ever leaves your machine.
