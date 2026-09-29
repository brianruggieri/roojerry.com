---
title: "Nurbits"
subtitle: "A Neuroscience Music Puzzle Game"
description: "A neuroscience music puzzle game built at Cogent Education on NIH SBIR funding, and one of its levels rebuilt from the original Unity source in Rust and Bevy, playable in the browser."
tagline: "Every chip is a neuron. Get them all firing on the beat."
tags: ["Unity", "C#", "Neuroscience", "Music", "Rust", "Bevy", "WebAssembly"]
statusLabel: "Available on Steam"
github: ""
release: "https://store.steampowered.com/app/651010/Nurbits/"
releaseIcon: "fab fa-steam"
releaseLabel: "View on Steam"
ctaTitle: "Play Nurbits"
ctaDesc: "Demo a single puzzle right here in the browser. The full game is on Steam, including fifty-odd puzzles, the music studio, and the full, customizable robot band."
image: "/img/projects/nurbits/nurbits-hero.jpg"
featured: true
pinned: true
year: "2017"

interactive:
  src: "/experiments/nurbits/"
  title: 'Nurbits - "Holo-Horizon AZ2"'
  poster: "/experiments/nurbits/poster.webp"

features:
  - icon: "fas fa-brain"
    title: "Threshold and Summation"
    desc: "A chip fires when the signal wired into it reaches its threshold. Excitatory chips add, inhibitory chips subtract, relays pass along, and one stimulus chip fires on its own. That is spatial summation, and it is the core mechanic of the puzzle."
  - icon: "fas fa-music"
    title: "The Puzzles Build the Song"
    desc: "Green cells are the notes this loop needs. Solve the board and the robot band member plays its part correctly; get it wrong and you hear exactly which note is off, because the synth is playing your wrong answer."
  - icon: "fas fa-heartbeat"
    title: "Pruning and Excitotoxicity"
    desc: 'A chip that never reaches threshold is pruned away ("explodes"). A chip driven far past it dies of overstimulation. Both are real neuroscience and both will happen to you.'
  - icon: "fas fa-atom"
    title: "Funded to Teach"
    desc: "Built on NIH SBIR grants with classroom research at the UGA College of Education. The neuroscience is the subject, not just a theme."

screenshots:
  - src: "/img/projects/nurbits/nurbits-puzzle.jpg"
    caption: "The studio: each band member holds an instrument, and each instrument has a sequence of loops you unlock by solving puzzles"
  - src: "/img/projects/nurbits/nurbits-creative.jpg"
    caption: "Inside a brain: the signal path for one instrument, with effects you earn and can copy between loops"
  - src: "/img/projects/nurbits/nurbits-venue.jpg"
    caption: "Robot customization: parts are unlocked by progress through the songs"
  - src: "/img/projects/nurbits/nurbits-band.jpg"
    caption: "A later puzzle. Same rules, more chips, and a budget to stay under"
---


Nurbits is a music puzzle game about how neurons talk to each other. You are wiring up a robot band, and every chip on the board behaves like a neuron: it has a firing threshold, it sums the signal arriving from the chips wired into it, and when that sum crosses the threshold it fires. Excitatory chips add signal. Inhibitory chips subtract it. Relays pass it on. One stimulus chip starts the signal, and you need to route the signal through to all the correct chips. Note chips play a note when they fire, so a solved puzzle is a piece of the band's song.

I built systems, tools and the asset pipeline on it at Cogent Education (IS3D) in Athens, Georgia, from 2013 until it shipped on Steam, [itch.io](https://cogent.itch.io/nurbits) and classroom tablets in July 2017.

## What is playable here

**This is a recreation of one level, not the original game.** Press play and you get loop **AZ2** of the song *Holo-Horizon* — the square-wave synth part, in tutorial mode, 16 columns by 8 rows at 230 BPM in C major. One of the fifty-odd puzzles in the shipped game.

It is a rebuild in Rust and [Bevy](https://bevy.org/), compiled to WebAssembly, written against the original Unity project's own C# rather than from memory. It restores much of my own work on the core mechanics that drive the puzzle system, and on the audio timing and sample generation.

The original assets, art, music and the name belong to their original creators and rights holders. This is a personal technical and archival exercise by someone who worked on it, not a release.

If you get stuck, **restart** puts the level back exactly as it starts: everything you placed comes off the board and the tray refills.

## Where it came from

Nurbits was built on NIH Small Business Innovation Research grants **R43/R44 OD010798**, *"Nurbits: Playing for Success in Neuroscience"*, administered by the **NIH Office of the Director**. The game released on [Steam](https://store.steampowered.com/app/651010/Nurbits/) on 17 July 2017 and is still on sale there.

The credits, taken straight from the game's own credits screen:

> **Development Team** — Stephen Borden, Jef Freydl, **Brian Ruggieri**, Dominique Edwards, Scott Malo
>
> **Music** — Mike Albanese, Jace Bartet, JoJo Glidewell, Terence Chiyezhan
>
> **Executive Producers** — Tom Robertson, Georgia Hodges, Casey O'Donnell
