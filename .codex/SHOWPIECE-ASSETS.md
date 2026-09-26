# teightysix showpiece asset substitutions

Task 5 content-check (D13) findings, viewed directly with the Read tool against
`~/git/baseball-cards/teightysix/.claude/captures/kept/`.

## Swap: `the-pile-is-the-background.png` -> `forty-years-and-the-dates-agree.png`

The plan's Task 5 table used `the-pile-is-the-background.png` as the source for
BOTH `poster.webp` and `shots/pile-background.webp`. Viewing it directly shows
the foreground bench card reads "SHOHEI OHTANI" in large, legible type, his real
MLB headshot, and Dodgers colours: a real player rendered from the parent
repo's local content, explicitly disallowed by D13.

Replacement: `forty-years-and-the-dates-agree.png` (1594x1503). Shows the
invented player MARLO FENN (card D41, a DREAM86 back) turned over on the bench,
floating over the same kind of scattered 3D pile. Matches the "press bench
floating over the live pile" concept the plan wanted, with an invented subject.

Affected paths (Worker A: update `content/projects/teightysix.md` frontmatter,
still owned by you):
- `poster.webp` source: `the-pile-is-the-background.png` -> `forty-years-and-the-dates-agree.png` (1280 wide)
- `shots/pile-background.webp` source: `the-pile-is-the-background.png` -> `forty-years-and-the-dates-agree.png` (1440 wide)
- Caption for `shots/pile-background.webp` in the plan's Task 4 draft ("The press bench floating over the live pile") still applies to the new source frame, no change needed.

## Frames checked and passed as-is

All other frames in the Task 5 table were viewed directly and confirmed D13-compliant:
`pick-a-spot-on-the-field.png`, `the-frame-takes-team-colors.jpg`,
`the-career-you-chose.png` (Marlo Fenn), `the-back-before-you-send-it.png` (Marlo Fenn),
`realistic-2000.png`, `wear3d-cut-corner-ladder.png` (macro cross-section, no face),
`an-alphabet-rebuilt-from-nothing.png`, `four-models-drew-baseball-man.png`,
`three-hands-on-the-bat.png` (invented "Meylier, Linn"), `infinite-pile-10k.png`,
`ten-thousand-cards-redeemed.png`, `nobody-wears-the-right-uniform.png` (the
Commons-attributed showcase, explicitly allowed by the spec even though real
player names appear, since these are licensed/credited photographs, not
parent-repo AI renders).

## Flagged, not swapped: `twenty-two-cards-of-a-baseball-tarot.png`

Viewed directly. All 22 illustrated figures are generic invented ballplayers,
not likenesses of any real player (the plan already excluded the sibling frame
`identity-resampled-away.png` for exactly that reason, since it shows Mookie
Betts's real face). However 7-8 of the 22 caption bands show the image model's
own garbled text guesses at a player name, several legible as variants of
"BETTS" (e.g. "B:ETTS, BASEBALL", "Betts, J:aseball."). The source manifest
(`captures.jsonl`) itself flags this as an open, unresolved caveat for public
use: the generation script pins `player = Mookie Betts` for the caption
regardless of the identity flag, so a real name leaks into decorative text even
though no face or likeness does. Kept per the plan's original selection since
the subject of every illustration is invented and D13 is about the rendered
subject, not incidental caption-band noise, but flagging here since the
manifest itself calls the caveat unresolved. Coordinator/Brian may want to
reconsider before the PR ships.
