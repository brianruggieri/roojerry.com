# teightysix showpiece asset substitutions

What ships in `static/img/projects/teightysix/`, why, and what does not.

## The standard

Decided by the coordinator, Codex review round 1:

> **A frame may ship only if no real person is recognisable at the size the site
> serves it at**, unless the photograph is freely licensed and the card carries
> its credit, which the Commons showcase does by design.

The bench swapped its seed set from real MLB headshots to invented players and
Wikimedia Commons photographs on **2026-09-10** (teightysix `52e10d6` and the
neutral-bench merge). **Every capture dated before that shows the original
real-MLB seed set in the pile or on the bench.** That date is the line: earlier
frames are checked against the standard one at a time and mostly fail it.

`layouts/fit/**` was not touched; it is a generated report template and out of
scope for this work.

## Dropped (faces legible at the shipped size)

All five are pre-migration frames whose bench card or pile shows real players.
Deleted with `git rm`.

| path | source frame | date |
|---|---|---|
| `poster.webp` (old) | `forty-years-and-the-dates-agree.png` | 2026-09-08 |
| `shots/pile-background.webp` | `forty-years-and-the-dates-agree.png` | 2026-09-08 |
| `shots/career-you-chose.webp` | `the-career-you-chose.png` | 2026-09-08 |
| `shots/real-odds.webp` | `realistic-2000.png` | 2026-09-04 |
| `shots/gold-in-the-pile.webp` | `gold-in-the-pile.png` | 2026-09-04 |

`shots/pile-background.webp`'s caption ("The same back at full age and wear,
attic-find board over the live pile") was the page's only aged-back claim and
went with the frame.

## The live set, recaptured 2026-09-25

`scripts/capture-teightysix-press.mjs` drives the deployed bench at
<https://cards.roojerry.com/> (engine 0.4.2). Stage 1 ships the invented set, so
anything captured there is compliant by construction. One session, one MIAMI
card, from empty stock to its print in the pile:

| path | state captured | size |
|---|---|---|
| `press-empty.webp` / `.png` | the press as it opens | 1600x1000 / 420x262 |
| `press-loaded.webp` / `.png` | `button.usesample` loaded, same bench | 1600x1000 / 420x262 |
| `hero.webp` / `.png` | the loaded bench again | 1600x1000 / 420x262 |
| `poster.webp` | the loaded bench, down to the wall tile's size | **1280x800** |
| `shots/back-turned-over.webp` | the BACK plate, D18, career ends MARLINS | 1600x1000 |
| `shots/pile-top-down.webp` | after PRINT: bench dismissed, print #2001 | 1600x1000 |

The previous pair was a different (also compliant) live session; recapturing the
whole live set together is what makes the compare caption "the same bench a
moment after a sample photograph goes in" literally true, and it puts real
originals in `.claude/teightysix-captures/` for the exporter to read.

`showpieceTile.html` declares `width="1280" height="800"`, which is now
`poster.webp`'s real pixel size; `tests/e2e/showpiece.test.js` reads the webp
header and fails if the two ever diverge.

## The screenshot grid: eight entries

| path | source | note |
|---|---|---|
| `shots/position-board.webp` | `pick-a-spot-on-the-field.png` | UI only, no faces |
| `shots/team-colours.webp` | `the-frame-takes-team-colors.jpg` | eight fronts, no photographs |
| `shots/back-turned-over.webp` | live, 2026-09-25 | invented back |
| `shots/pile-top-down.webp` | live, 2026-09-25 | pile at a few pixels a card |
| `shots/picked-card.webp` | `picked-out-of-the-pile.png` (2026-09-11) | Commons showcase card, credit printed on it; cropped `1600x1232+1978+106` from the 4400x1464 original |
| `shots/sixty-licensed.webp` | `sixty-photographs-nobody-had-to-license.png` (2026-09-12) | the Commons board; licensed and credited, so the carve-out applies |
| `shots/cut-corner-ladder.webp` | `wear3d-cut-corner-ladder.png` | macro cross-section |
| `shots/sweep-footprint.webp` | `sweep-delta-legendary-512.png` | a black difference frame |

## The story strip: six entries, unchanged

`story/alphabet`, `story/mascot-bake-off`, `story/three-hands`,
`story/pile-runaway`, `story/pile-fixed`, `story/wrong-uniforms`. The two pile
frames are 10,000 cards at a few pixels each; `wrong-uniforms` is the same
licensed-and-credited Commons board as `sixty-licensed`; the rest carry no
photograph of a real person.

## Pipeline

`scripts/capture-teightysix-press.mjs` writes full-resolution originals to
`.claude/teightysix-captures/` (gitignored) and never touches `static/`.
`scripts/export-teightysix-frames.sh` reads those plus the teightysix repo's
kept captures and writes only into `static/img/projects/teightysix/`, so running
it twice produces the same bytes instead of re-encoding its own output. Its
`webp` helper treats the width argument as a ceiling, so a source narrower than
the target is encoded at its own size rather than upscaled.

Total: **3456 KB** against the 4 MB budget.

## Earlier decisions, kept for the record

### Swap: `the-pile-is-the-background.png` -> `forty-years-and-the-dates-agree.png`

The plan's Task 5 table used `the-pile-is-the-background.png` for both
`poster.webp` and `shots/pile-background.webp`. Its foreground bench card reads
"SHOHEI OHTANI" in large legible type on his real MLB headshot, so it was
replaced with `forty-years-and-the-dates-agree.png` (invented player MARLO
FENN). **Superseded:** the replacement is itself pre-migration, and its pile
shows the real seed set, so both paths are now dropped outright.

### Swap: `twenty-two-cards-of-a-baseball-tarot.png` -> `the-cut-edge-measured-then-rendered.png`

The coordinator decided against the tarot frame: 7-8 of its 22 caption bands
carry the image model's garbled guesses at a real player's name, several legible
as variants of "BETTS", and `captures.jsonl` flags this as an open caveat. The
replacement is a pure macro cross-section of the cut edge at three wear rungs.
`shots/tarot.webp` was replaced by `shots/cut-edge.webp` in `0cdf158`, and
`622e01f` then swapped that for `shots/cut-corner-ladder.webp` (from
`wear3d-cut-corner-ladder.png`), which is what the page carries now. Both
earlier files are gone from the tree.
