---
title: "Claude Code Pulse"
subtitle: "ccp"
description: "A CLI wrapper that hooks into Claude Code's lifecycle events and writes live context — branch, task, status — into each terminal pane's title bar. Built for multi-agent workflows."
tagline: "See what every agent is doing. At a glance."
tags: ["Bash", "CLI Tooling", "Claude Code Hooks", "iTerm2", "macOS"]
statusLabel: "v1.5.0 — Active Development"
github: "https://github.com/brianruggieri/claude-code-pulse"
ctaTitle: "Get Claude Code Pulse"
ctaDesc: "One install script. No sudo. No telemetry. Works in 30 seconds."
image: "/img/projects/claude-code-pulse/demo-4pane.gif"
featured: true
year: "2026"
featureColumns: 3
features:
  - icon: "fas fa-plug"
    title: "Hook Architecture"
    desc: "Integrates directly with Claude Code's hook events — no output parsing or regex fragility."
  - icon: "fas fa-columns"
    title: "Per-Pane Independence"
    desc: "Each split pane updates its own title via OSC 1 sequences. No cross-talk between agents."
  - icon: "fas fa-heartbeat"
    title: "Live Status"
    desc: "Real-time phase indicators: editing, testing, building, pushing, committed, idle."
  - icon: "fas fa-coffee"
    title: "Idle Cycling"
    desc: "10 rotating idle phrases so you can spot at a glance which panes are waiting."
  - icon: "fas fa-brain"
    title: "AI Task Summaries"
    desc: "Optional Haiku-powered summaries condense each turn into 3–5 word labels."
  - icon: "fas fa-bug"
    title: "Debug Mode"
    desc: "Structured JSONL logs with auto-opening Pulse Monitor in a dedicated pane."
pipeline:
  - icon: "fas fa-plug"
    title: "Hook fires"
    desc: "Claude Code emits a lifecycle event via settings.json hooks"
  - icon: "fas fa-cogs"
    title: "Status mapped"
    desc: "Priority-based dispatch maps the event to an emoji + status label"
  - icon: "fas fa-terminal"
    title: "Title updated"
    desc: "OSC 1 escape sequence writes the title to the specific pane"
screenshots:
  - src: "/img/projects/claude-code-pulse/before.png"
    caption: "Before — generic \"project — claude\" on every pane"
  - src: "/img/projects/claude-code-pulse/after.png"
    caption: "After — branch, task, and live status on each pane"
  - src: "/img/projects/claude-code-pulse/status-lifecycle.apng"
    caption: "Full status lifecycle: editing → testing → passed → committed → idle"
  - src: "/img/projects/claude-code-pulse/tmux-after.png"
    caption: "tmux compatibility — same context, different multiplexer"
---

Multi-agent workflows in split panes get disorienting fast — every title bar says the same thing, and there's no way to tell which agent is editing, which just finished, or which is waiting for input.

ccp hooks into Claude Code's lifecycle events and writes real context — branch, task, status — into each pane's title. No output parsing, no regex. Just hooks and escape sequences.
