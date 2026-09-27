---
title: "teightysix"
subtitle: "a Topps '86 replica suite in WebGPU"
description: "A faithful recreation of the 1986 Topps card design, rendered in the browser with WebGPU: the type, the colour, the print, and forty years of wear."
blurb: "The 1986 Topps design recreated in WebGPU: a reconstructed typeface, a physics pile, and wear you can dial from mint to attic find."
tags: ["TypeScript", "Svelte", "WebGPU", "Three.js", "Rapier", "Cloudflare Workers", "Python"]
statusLabel: "v1.0.0 live"
live: "https://cards.roojerry.com/"
github: "https://github.com/brianruggieri/teightysix"
ctaTitle: "Make one"
ctaDesc: "The bench runs in the browser. Your photograph stays on your machine."
image: "/img/projects/teightysix/hero.png"
poster: "/img/projects/teightysix/poster.webp"
showpiece: true
featured: true
weight: 1
year: "2026"
# Sources for the numbers on this page, all in the teightysix repo under .claude/:
# HANDOFF.md (98/98 parity fixtures, 63% faster render; "M2 (the pile): DONE +
# gate-cleared. Backend (publish Worker, relay DO, snapshots) ... M2a codex
# trust-boundary gate CLEAR"), PLAN-RELEASE.md 0 ("One deploy, Stage 1 only ...
# No D1, no R2, no Durable Objects, no publishing. The pile is local-pile.ts:
# every visitor gets their own reproducible pile from a localStorage seed, and
# nothing is transmitted to make that true"), 4.1 (256 live / 2000 resident) and
# 4.4 (the D13 content posture), PLAN-BACK.md 210 (DREAM_INK vs RED),
# captures/captures.jsonl (0.45 mm cut edge, the 10/4/1 rarity mix, the 233 mm
# pile, the mirrored-S Z; legendary-struck-in-gold: "every black mark outside
# the player picture ... replaced with gold foil"). The pile shot's print number
# is read off the frame itself, which shows PRINT #2001 over the 2,000-card
# local pile.
compare:
  before: "/img/projects/teightysix/press-empty.png"
  after: "/img/projects/teightysix/press-loaded.png"
  beforeLabel: "Empty"
  afterLabel: "Loaded"
  caption: "The press as it opens, and the same bench a moment after a sample photograph goes in."
featureColumns: 3
features:
  - icon: "fas fa-file-code"
    title: "Recipe-driven render"
    desc: "Every card is a small JSON recipe: photo hash, crop, place name, position, wear, age, print strength, seed. The TypeScript and WebGPU engine renders it deterministically, and each engine version locks its output with frozen hashes."
  - icon: "fas fa-layer-group"
    title: "Physics pile"
    desc: "Release the card and it tumbles under Rapier physics into a Three.js pile on the table. 256 cards stay live geometry; the rest bake into the table texture, so frame cost is flat from two thousand cards to ten thousand."
  - icon: "fas fa-sliders-h"
    title: "Measured wear model"
    desc: "The card is a solid with a 0.45 mm cut edge taken from a real 1986 card under a calibrated microscope. Wear, age and print strength are recipe fields, and the corners chip back to tan board as they rise."
  - icon: "fas fa-palette"
    title: "Reconstructed typeface"
    desc: "The 1986 face never shipped as a font. Every glyph was drawn from scans with its own kern table, and the bench sets every name and place in it."
  - icon: "fas fa-columns"
    title: "Period card backs"
    desc: "Each card carries a 1986-style back with a career table, printed in red for the attributed showcase and in deep blue for invented players."
  - icon: "fas fa-trophy"
    title: "Rarity finishes"
    desc: "Rare, holo and legendary finishes are shader passes at 10, 4 and 1 per hundred. Legendary strikes every black mark outside the photograph in gold foil."
screenshotsGrid: true
screenshots:
  - src: "/img/projects/teightysix/shots/position-board.webp"
    caption: "The position control is a chalked field with nine lamp plates"
  - src: "/img/projects/teightysix/shots/team-colours.webp"
    caption: "Eight fronts in eight clubs' two-colour schemes"
  - src: "/img/projects/teightysix/shots/back-turned-over.webp"
    caption: "The back, turned over on the bench"
  - src: "/img/projects/teightysix/shots/pile-top-down.webp"
    caption: "The bench clears and the card lands in the pile on your own table"
  - src: "/img/projects/teightysix/shots/picked-card.webp"
    fit: "contain"
    caption: "A card lifted out of the pile and turned over, with its Commons credit"
  - src: "/img/projects/teightysix/shots/sixty-licensed.webp"
    fit: "contain"
    caption: "The sixty-card showcase on freely licensed photographs"
  - src: "/img/projects/teightysix/shots/cut-corner-ladder.webp"
    caption: "One bottom-right cut, mint to attic find"
  - src: "/img/projects/teightysix/shots/sweep-footprint.webp"
    caption: "The glint sweep's footprint: a difference frame of the pass crossing an all-legendary pile"
story:
  - src: "/img/projects/teightysix/story/alphabet.png"
    title: "The typeface came first"
    text: "The 1986 type was never a font. The parent project drew the full cut from scans, A to Z in two heavy rows, and built a kern table from the same reference corpus. Every name the bench sets goes through it. The Z is a mirrored S, sharpened, because the 26-bar reference set never gave the reconstruction a Z to trace."
  - src: "/img/projects/teightysix/story/mascot-bake-off.png"
    title: "Four models drew the mascot"
    text: "One four-pose line-art brief, four image models, a row each, judged by eye at the 12 mm a card-back mascot actually prints at. gpt-image-2 stayed on model in all four poses. FLUX shrank the character to a postage stamp, Qwen bled grey backgrounds into the swing, and Playground drew a full-colour boy instead. The winner seeded the 76-pose library the backs draw from."
  - src: "/img/projects/teightysix/story/three-hands.png"
    title: "Three hands on the bat"
    text: "A chromolithograph card that would pass for a Library of Congress scan, except the batter grips his bat with three hands. It took 2 of 2 for mark-making and for palette, then a zero on composition, and that one render rejected the whole batting pose. Frames like it are why the public set is invented players on generated portraits with a person looking at each one before it ships."
  - src: "/img/projects/teightysix/story/pile-runaway.png"
    title: "Ten thousand cards, one bad column"
    text: "Ten thousand cards at 256 live, six draw calls, 120 fps, and a 1.5 metre shredded spire floating over its own table. The cost was flat and the geometry was out of envelope. The frame stayed in the record because it carries both readings at once."
  - src: "/img/projects/teightysix/story/pile-fixed.png"
    title: "The same scene, fixed"
    text: "Same ten thousand cards, same camera. Saturating the mound field brought the pile down to 233 millimetres lying on the table where the column used to float, and the cost readouts beside it did not move."
  - src: "/img/projects/teightysix/story/wrong-uniforms.png"
    title: "Nobody is in the right uniform"
    text: "Sixty fronts rebuilt on freely licensed photographs, laid out in one sheet. Forty photographers, and the team name across the top almost never matches the jersey under it. Fifty of the sixty need a printed credit, so the photographer, the licence and the Commons link run along the bottom margin of the card itself."
---

It has been forty years since the 1986 Topps set, and the cards I pulled out of the basement are junk wax by any collector's measure. I could not get over how tight the design still is: the heavy condensed type, the two-colour team bar, the way the photo sits in its keyline. It deserved a recreation, so this is one. An art project, not a serious product, born of a childhood interest and turned toward recycling forty-year-old cardboard into something new.

The whole card is a small JSON recipe. Drop in a photograph, type a name, pick a place name and a spot on the field, then turn the knobs for wear, age and print strength. The TypeScript and WebGPU engine redraws it while you drag, and it turns over to a period back with a career table.

The card is a 3D solid on a glass table. Let go of it and it drops into the pile, tumbles under physics and settles face up. That pile is yours alone: the deploy is static, so every visitor gets their own, rebuilt from a seed kept in the browser and sent nowhere. 256 cards stay real geometry and the rest bake into the table at low resolution.

Wear comes from a measurement. A real 1986 card went under a calibrated microscope, so this one has a 0.45 mm cut edge whose corners chip back to tan board as you raise the knob. No font of the 1986 face existed, so it was drawn from scans with its own kerning. The Z is a mirrored S, because the reference sheet never gave one to trace.

The public set is invented players on generated portraits, plus a showcase of Commons-licensed photographs with the credit printed on the card. Your own photograph stays in your browser. The shared pile behind it, with its publish Worker, relay and snapshots, is built and tested and not yet deployed.
