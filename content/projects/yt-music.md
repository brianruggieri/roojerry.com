---
title: "YouTube Music for macOS"
description: "A lightweight native macOS wrapper for YouTube Music with system integration."
tags: ["Swift", "AppKit", "WebKit", "Core Audio", "JavaScript", "macOS"]
github: "https://github.com/brianruggieri/yt-music-mac"
ctaTitle: "See it on GitHub"
ctaDesc: "Forked from 0xjemm/youtube-music-macos (MIT). All extensions below are my own work."
image: "/img/projects/yt-music/visualizer.png"
poster: "/img/projects/yt-music/visualizer.png"
heroBare: true
featured: true
year: "2026"
featureColumns: 3
features:
  - icon: "fas fa-music"
    title: "Audio-Reactive Visualizer"
    desc: "A third \"Visualizer\" tab on YT Music's Song/Video toggle renders a Butterchurn (MilkDrop) visualization driven by a native Core Audio process tap of the app's own output."
  - icon: "fas fa-palette"
    title: "Native Light Theme"
    desc: "A runtime light theme with its own brand identity and a full accessibility pass — toggled live, with a file-picker and QA sweep behind it."
  - icon: "fas fa-expand"
    title: "Fullscreen Control Bar"
    desc: "A fullscreen visualizer mode with an idle auto-hide control bar — transport, seek, volume, and metadata wired straight to YT playback."
  - icon: "fas fa-download"
    title: "Spotify Import"
    desc: "Connect a Spotify account to match and import playlists and liked songs into YouTube Music, via an in-app OAuth flow."
  - icon: "fas fa-arrows-alt"
    title: "Reshaped App Icon"
    desc: "Redrawn into a proper macOS squircle so it sits correctly in the Dock alongside native apps."
  - icon: "fas fa-plug"
    title: "System Integration"
    desc: "Media keys, Now Playing in Control Center with artwork, and Discord Rich Presence — the lean WebKit core, carried forward from upstream."
screenshots:
  - src: "/img/projects/yt-music/control-center.png"
    caption: "Now Playing in Control Center, with album artwork"
  - src: "/img/projects/yt-music/discord.png"
    caption: "Discord Rich Presence showing the current track"
---

A native macOS wrapper for YouTube Music — no Electron, just a lean WebKit shell with deep system integration. Forked from [0xjemm/youtube-music-macos](https://github.com/0xjemm/youtube-music-macos) (MIT), which stays deliberately minimal.

I took it in a different direction. The headline is an audio-reactive Butterchurn visualizer that taps the app's *own* audio output through Core Audio, plus a full runtime light theme, a fullscreen control bar with idle auto-hide, Spotify import, and a reshaped app icon. Development continues locally across several branches.
