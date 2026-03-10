---
title: "Dog Playground"
subtitle: "Interactive"
description: "A drag-to-throw toy playground with a wandering dog on a pan/zoom canvas — complete with physics, multiple dog breeds, and customizable backgrounds."
tagline: "Pick a yard, a pup, and a toy."
tags: ["JavaScript", "Canvas / DOM", "Physics Engine", "Sprite Animation", "Mobile Touch"]
github: "https://github.com/brianruggieri/dog-playground"
releaseIcon: "fas fa-external-link-alt"
releaseLabel: "Open Full Page"
release: "https://brianruggieri.github.io/dog-playground/"
ctaTitle: "Try Dog Playground"
ctaDesc: "Play it right here, or open the full standalone version."
image: "/img/projects/dog-playground/dog-playground-hero.png"
featured: false
year: "2025"
interactive:
  src: "https://brianruggieri.github.io/dog-playground/"
  title: "Dog Playground"

features:
  - icon: "fas fa-paw"
    title: "Throw Toys"
    desc: "Drag to throw balls, frisbees, or bones. Each toy has unique physics — weight, bounce, and damping tuned for a satisfying feel."
  - icon: "fas fa-dog"
    title: "Dog AI"
    desc: "Three breeds with distinct speeds and behavior: Farm Collie, Quick Collie, and Steady Shepherd. They wander, chase, and catch."
  - icon: "fas fa-arrows-alt"
    title: "Pan & Zoom Canvas"
    desc: "A 2400×2400 pixel world you can scroll, pinch-zoom, and drag around — on desktop or mobile."
  - icon: "fas fa-palette"
    title: "Texture Backgrounds"
    desc: "Choose from dirt, grass, gravel, sand, or tile backgrounds — each rendered as a repeating texture with a grid overlay."

screenshots:
  - src: "/img/projects/dog-playground/drag-frisbee.png"
    caption: "Desktop drag line — sand background with frisbee"
  - src: "/img/projects/dog-playground/throw-bone.png"
    caption: "Bone chase on tile"
  - src: "/img/projects/dog-playground/mobile-drag.png"
    caption: "Mobile touch — drag to throw on dirt"
---

Dog Playground is a standalone extraction of the dog wander + throw-toy interaction from the larger GardenCraft project. Everything unrelated — garden beds, plants, AI providers — is stripped away, leaving a focused interactive you can play in seconds.

The architecture is built for extension: dogs and toys are registered through catalogs with customizable sprites, physics profiles, and movement settings. The physics engine handles launch vectors, exponential damping, wall collisions with restitution, and speed-threshold cleanup — all running at 60fps in a requestAnimationFrame loop.
