---
title: "teightysix"
subtitle: "make a 1986 baseball card"
description: "Drop in a photograph and it comes back a 1986-style baseball card, drawn in your browser and byte-exact to the Python press it was ported from."
blurb: "A 1986-style card press in the browser: WebGPU render, a 3D pile, wear you can dial, and a typeface rebuilt from scans."
tags: ["TypeScript", "Svelte", "WebGPU", "Three.js", "Rapier", "Cloudflare Workers", "Python parity"]
statusLabel: "1.0.0 live at cards.roojerry.com"
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
# HANDOFF.md (98/98 parity fixtures, 63% faster render), PLAN-RELEASE.md 4.1
# (256 live / 2000 resident) and 4.4 (the D13 content posture), PLAN-BACK.md 210
# (DREAM_INK vs RED), captures/captures.jsonl (0.45 mm cut edge, the 10/4/1
# rarity mix, the 233 mm pile, the mirrored-S Z).
compare:
  before: "/img/projects/teightysix/press-empty.png"
  after: "/img/projects/teightysix/press-loaded.png"
  beforeLabel: "Empty"
  afterLabel: "Loaded"
  caption: "The press as it opens, and the same bench a moment after a sample photograph goes in."
featureColumns: 3
features:
  - icon: "fas fa-file-code"
    title: "Byte-exact to the Python press"
    desc: "The TypeScript and WebGPU engine reproduces the parent pipeline's output pixel for pixel. 98 of 98 parity fixtures match, and self-hashes are frozen per engine version."
  - icon: "fas fa-layer-group"
    title: "A pile that is really there"
    desc: "Published cards fall into a shared 3D scene, tumble under Rapier physics and settle face up. 256 cards stay live geometry and the rest bake into the table."
  - icon: "fas fa-sliders-h"
    title: "Wear you can dial"
    desc: "Wear, age, print strength and miscut are recipe fields. The card is a solid with a measured 0.45 mm cut edge, and the corners chip back to board as you turn the knob."
  - icon: "fas fa-palette"
    title: "An alphabet rebuilt"
    desc: "The 1986 type never existed as a font. The parent project drew it glyph by glyph from scans, with its own kern table, and the bench sets every name in it."
  - icon: "fas fa-columns"
    title: "The back turns over"
    desc: "Every card carries a period back with a career table. Invented players get a blended career in deep blue ink; the attributed showcase carries its real record in red."
  - icon: "fas fa-trophy"
    title: "Foil at real odds"
    desc: "Rare, holo and legendary finishes land at 10, 4 and 1 per hundred publishes. Legendary strikes every black mark on the front in gold."
screenshotsGrid: true
screenshots:
  - src: "/img/projects/teightysix/shots/position-board.webp"
    caption: "The position control is a chalked field with nine lamp plates"
  - src: "/img/projects/teightysix/shots/team-colours.webp"
    caption: "Eight fronts in eight clubs' two-colour schemes"
  - src: "/img/projects/teightysix/shots/career-you-chose.webp"
    caption: "An invented back with a career picked from the bench's chips"
  - src: "/img/projects/teightysix/shots/gold-in-the-pile.webp"
    caption: "A pile rigged all legendary: gold bars and gilded keylines on every live card"
  - src: "/img/projects/teightysix/shots/pile-background.webp"
    caption: "The same back at full age and wear, attic-find board over the live pile"
  - src: "/img/projects/teightysix/shots/real-odds.webp"
    caption: "Two thousand cards at the shipped rarity mix"
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

You drop in a photograph, type a name, pick a place name and a spot on the field, then turn the knobs for wear, age, print strength and miscut. The card redraws while you drag. Turn it over and a period back is waiting, career table and all.

The render is the part I care about most. teightysix ports a Python pipeline I wrote for my own printing, and the browser has to agree with it byte for byte. 98 of 98 parity fixtures match, and every engine version freezes a self-hash, so a faster render that shifts one pixel fails the gate.

The card is a 3D object on a glass table. Let go of it and it drops into a shared pile, tumbles under physics and settles face up. 256 cards stay real geometry and the rest bake into the table at low resolution, so the frame cost is the same at two thousand cards as at ten thousand.

Wear comes from a measurement. The parent project put a real 1986 card under a calibrated microscope, so this one is a solid with a 0.45 mm cut edge whose corners chip back to tan board as you raise the knob.

No font of the 1986 face existed, so it was drawn from scans with its own kerning. The Z is a mirrored S, because the reference sheet never gave one to trace.

The public set is invented players on generated portraits, plus a showcase of Commons-licensed photographs with the credit printed on the card. Stage 1 is static, so your photograph stays in your browser, and the publish backend is still ahead of me.
