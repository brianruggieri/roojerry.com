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
compare:
  before: "/img/projects/yt-music/player-visualizer-dark.webp"
  after: "/img/projects/yt-music/player-visualizer-light.webp"
  beforeLabel: "Dark"
  afterLabel: "Light"
  caption: "Drag to compare the stock dark UI against the native light theme — same visualizer frame, both themes."
featured: true
year: "2026"
featureColumns: 3
features:
  - icon: "fas fa-music"
    title: "Audio-Reactive Visualizer"
    desc: "A third \"Visualizer\" tab on YT Music's Song/Video toggle renders a Butterchurn (MilkDrop) visualization driven by a native Core Audio process tap of the app's own output."
  - icon: "fas fa-palette"
    title: "Native Light Theme"
    desc: "YouTube Music ships dark-only; this adds a full light theme derived at runtime from YT's own design tokens — so it self-heals across UI changes — with a crossfading dark/light toggle."
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
screenshotsGrid: true
screenshots:
  - src: "/img/projects/yt-music/shots/home-light.webp"
    caption: "Home in the native light theme"
  - src: "/img/projects/yt-music/shots/home-dark.webp"
    caption: "Home in the stock dark theme"
  - src: "/img/projects/yt-music/shots/visualizer-light.webp"
    caption: "Audio-reactive Butterchurn visualizer — the third option on the Song / Video toggle, light theme"
  - src: "/img/projects/yt-music/shots/visualizer-dark.webp"
    caption: "The same visualizer in the stock dark theme, driven by a Core Audio tap of the app's own output"
  - src: "/img/projects/yt-music/shots/player-song-light.webp"
    caption: "Now playing — album art with the Song / Video / Visualizer toggle, light theme"
  - src: "/img/projects/yt-music/shots/player-video-dark.webp"
    caption: "Now playing — music video mode, dark theme"
  - src: "/img/projects/yt-music/shots/explore-dark.webp"
    caption: "Explore — new albums & singles and top songs, dark theme"
  - src: "/img/projects/yt-music/shots/library-light.webp"
    caption: "Library in the light theme, with macOS-native scrollbars"
---

A native macOS wrapper for YouTube Music — no Electron, just a lean WebKit shell with deep system integration. Forked from [0xjemm/youtube-music-macos](https://github.com/0xjemm/youtube-music-macos) (MIT), which stays deliberately minimal.

I took it in a different direction. The headline is an audio-reactive Butterchurn visualizer that taps the app's *own* audio output through Core Audio, plus a full runtime light theme, a fullscreen control bar with idle auto-hide, Spotify import, and a reshaped app icon. Development continues locally across several branches.
