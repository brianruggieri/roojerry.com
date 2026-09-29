---
title: "Nurbits"
subtitle: "A Music Puzzle Game"
description: "A neuroscience music puzzle game built at Cogent Education on NIH SBIR funding — and one of its levels rebuilt from the original Unity source in Rust and Bevy, playable in the browser."
tagline: "Every chip is a neuron. Get them all firing on the beat."
tags: ["Unity", "C#", "Neuroscience", "Music", "Rust", "Bevy", "WebAssembly"]
statusLabel: "Available on Steam"
github: ""
release: "https://store.steampowered.com/app/651010/Nurbits/"
releaseIcon: "fab fa-steam"
releaseLabel: "View on Steam"
ctaTitle: "Play Nurbits"
ctaDesc: "One level runs right here in the browser. The full game — fifty-odd puzzles, the studio, the robot band — is on Steam."
image: "/img/projects/nurbits/nurbits-hero.jpg"
featured: true
pinned: true
year: "2017"

interactive:
  src: "/experiments/nurbits/"
  title: "Nurbits — 001 Holo-Horizon, loop AZ2"
  poster: "/experiments/nurbits/poster.webp"

features:
  - icon: "fas fa-brain"
    title: "Threshold and Summation"
    desc: "A chip fires when the signal wired into it reaches its threshold. Excitatory chips add, inhibitory chips subtract, relays pass along, and one stimulus chip fires on its own. That is spatial summation, and it is the whole puzzle."
  - icon: "fas fa-music"
    title: "The Puzzle Is the Song"
    desc: "Green cells are the notes this loop needs. Solve the board and the channel plays its part correctly; get it wrong and you hear exactly which note is off, because the synth is playing your answer."
  - icon: "fas fa-heartbeat"
    title: "Pruning and Excitotoxicity"
    desc: "A chip that never reaches threshold is pruned away. A chip driven far past it dies of overstimulation. Both are real neuroscience and both will happen to you."
  - icon: "fas fa-atom"
    title: "Funded to Teach"
    desc: "Built on NIH SBIR grants R43/R44 OD010798 with classroom research at the UGA College of Education. The neuroscience is the curriculum, not a theme."

screenshots:
  - src: "/img/projects/nurbits/nurbits-puzzle.jpg"
    caption: "The studio — each band member holds a channel, and each channel is a stack of loops you unlock by solving puzzles"
  - src: "/img/projects/nurbits/nurbits-creative.jpg"
    caption: "Inside a brain: the signal path for one channel, with effects you earn and can copy between loops"
  - src: "/img/projects/nurbits/nurbits-venue.jpg"
    caption: "Robot customisation — parts are unlocked by progress through the songs"
  - src: "/img/projects/nurbits/nurbits-band.jpg"
    caption: "A later puzzle. Same rules, more chips, and a tray with a cost attached to each one"
---

Nurbits is a music puzzle game about how neurons talk to each other. You are wiring up a robot band, and every chip on the board behaves like a neuron: it has a firing threshold, it sums the signal arriving from the chips wired into it, and when that sum crosses the threshold it fires. Excitatory chips add signal. Inhibitory chips subtract it. Relays pass it on. One stimulus chip fires on its own, and everything else downstream is your problem. Note chips play a note when they fire, so a solved board is a correctly played loop and an unsolved one is a loop you can hear being wrong.

I built systems, tools and the asset pipeline on it at Cogent Education (IS3D) in Athens, Georgia, from 2013 until it shipped on Steam, itch.io and classroom tablets in July 2017.

## What is embedded above

**This is a recreation of one level, not the original game.** Press play and you get loop **AZ2** of the song *001 Holo-Horizon* — channel 3, the square-wave synth, in tutorial mode, 16 columns by 8 rows at 230 BPM in C major. One of the fifty-odd puzzles in the shipped game.

It is a rebuild in Rust and [Bevy](https://bevy.org/), compiled to WebAssembly, written against the original Unity project's own C# rather than from memory: the threshold walk, the connection rules, the tray bookkeeping and the synth's sample truncation chain are transliterations, and the level was identified by decoding all twenty-six song files and scoring every loop against the goal cells in a reference screenshot. Exactly one loop matched. Where the port departs from the original — a fixed 16:9 letterbox instead of Unity's match-height reflow, a mute button the original never had, a click-to-start poster the browser's autoplay policy insists on — those departures are written down rather than quietly absorbed.

The original assets, art, music and the name belong to their original creators and rights holders. This is a personal technical and archival exercise by someone who worked on it, not a release.

If you get stuck, **restart** puts the level back exactly as it starts: everything you placed comes off the board and the tray refills. There is no next level here — this is the one.

One honest caveat. This level leans on green and red to tell you whether a cell is right or wrong, which the original team flagged as a problem in 2013 and worked around elsewhere in the game by using shapes. Changing those colours here would break the thing the port exists to be, so they are unchanged, and the non-colour channels the game already has — the LED count on each chip, the arrows, the tooltip text under the board — are the way through.

## Where it came from

Nurbits was built on NIH Small Business Innovation Research grants **R43/R44 OD010798**, *"Nurbits: Playing for Success in Neuroscience"*, administered by the **NIH Office of the Director**, with **Stephen Borden** as principal investigator. Phase I was $535,000 from 2012; Phase II added $952,094 across 2015–2017 — roughly **$1.49M** in total. The **University of Georgia College of Education** held subawards on both phases under **Georgia Hodges**, who ran the classroom research and is credited in the game as an executive producer.

The credits, taken from the game's own credits screen rather than from memory:

> **Development Team** — Stephen Borden, Jef Freydl, Brian Ruggieri, Dominique Edwards, Scott Malo
>
> **Music** — Mike Albanese, Jace Bartet, JoJo Glidewell, Terence Chiyezhan
>
> **Executive Producers** — Tom Robertson, Georgia Hodges, Casey O'Donnell

Cogent Education was acquired by ExploreLearning in November 2017. The [Steam page](https://store.steampowered.com/app/651010/Nurbits/) is still up.
