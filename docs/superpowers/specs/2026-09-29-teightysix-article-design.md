# teightysix: the project page becomes a narrated article

Design spec, 2026-09-29. Approved in chat 2026-09-29 ("go").

## Goal

Replace the structured product page at `/projects/teightysix/` with one long-form
article in Brian's voice that narrates how the project actually happened: a
basement cleanout, a dead end, a two-day detour into 1887, one message that
redirected everything, and a month of threads pulling each other along until a
card you can hold rendered in a browser.

The page stops selling the project and starts telling it. The live link and the
GitHub link stay; the feature grid, the fixed story strip and the terminal
screenshot grid go, because the prose says those things better and currently says
them twice.

## Why this is worth the ceremony

The material is a month of dense work across two repositories — 1,379 commits —
and most of the good detail is in session logs and research docs that no reader
will ever see. Without a written spine the draft will drift toward a feature tour,
which is the thing it is replacing. This spec fixes the beats, the facts, and where
each fact comes from, so the draft can be checked rather than trusted.

## Scope

**Changes**

- `content/projects/teightysix.md` — frontmatter reduced, body becomes the article
- `layouts/projects/article.html` — new, prose-first
- `layouts/shortcodes/fig.html`, `compare.html`, `plate.html` — new
- `layouts/partials/jsonld.html` — emit `Article` for article-layout pages
- `static/css/projects.css` — article typography; reuse existing figure CSS
- `static/img/projects/teightysix/` — new figures (see the manifest)
- `tests/e2e/project-detail.test.js` — retarget the story-strip assertions

**Unchanged**

- `layouts/projects/single.html` and every other project page
- The home page showpiece tile and its link to this page
- `img-compare.js` and `shot-lightbox.js` — reused as-is, both bind by class
- `tests/e2e/showpiece.test.js`, `tests/simulation/project-assets.test.js`

## Voice contract (binding)

The article is Brian writing. The editor's job is sequence, compression and
fact-checking, not register.

1. **His transcript is the source for how things are said.** The 2026-09-29 voice
   dump is the primary voice reference. Keep his idioms and constructions: *junk
   wax*, *side quest*, *I wanted more*, *it deserved a recreation*, *I could have
   stopped early at any one of these points*, *it just kind of came out of the work
   I was doing*. Do not normalise them into house style.
2. **The logs are the source for what is true.** Every number and date in the draft
   traces to the citation table below. Where the record contradicts his memory,
   follow the record and mark the line with an inline HTML comment so he can
   overrule it.
3. **First person throughout.** The current page opens in first person and then the
   narrator disappears for the rest of the page; that is the specific defect this
   rewrite fixes. "I" carries every section.
4. **No em dashes.** The branch has already removed them twice (`c141757`,
   `b996169`). Keep them out.
5. **British spellings stay out.** `teightysix.md` is the only content file on the
   site using *colour / licence / grey / metre*. The article uses US spellings. The
   asset filename `shots/team-colours.webp` is not renamed; it is a path, not prose.
6. **Deslop before handoff.** Run the `deslop` skill over the finished draft. No
   tricolons-as-default, no "it's not just X, it's Y", no manufactured stakes.
7. **This spec's own prose is not the article's.** The beats below describe what
   each section covers and quote source material; they are editorial notes, not draft
   copy. Rules 4 and 5 bind the article, not this document.
8. **The unfinished parts stay in.** The shared pile that never deployed, the
   scanner never bought, the catalog report never sent. The honesty is the reason
   the rest is credible.

## Content rule (inherited, binding)

The 2026-09-25 spec's D13 posture carries over unchanged: invented players on
generated portraits, place names and team colours but never club marks, plus the
Commons-licensed showcase with attribution. Process and tooling frames are allowed.

**This spec adds one constraint the 1887 section forces.**

`~/git/baseball-cards/baseball-cards/.claude/branches/physical.md` records the rights
split explicitly: current-player cards are personal use only under NIL; 1887 players
are the commercial unlock, being deceased with public-domain source imagery and no
publicity rights. The parent repo contains finished LoRA renders of current MLB
players as 1887 chromolithographs (`cards-out/edwards_ohtani_modal.png`,
`edwards_betts_modal.png`, and nine more).

**Those do not go on the portfolio page.** A published likeness of a current player
generated from MLB's headshot API is exactly the thing the project's own posture
says is personal-use only. Beat 5 uses public-domain 1887 subjects instead — see the
open question at the end, which needs Brian's call before that beat's figures are cut.

## Structure: fourteen beats

Target 3,500 to 4,500 words. Beat headings below are working titles, not final copy.

### 1. The basement

Moving, minimizing, boxes and a binder that have followed him from place to place.
Junk wax by any collector's measure. The count does not matter and the article says
so. *Figures: collage set, wide shot.*

### 2. Cutting them up

Strips cut side to side — a top piece, a middle, a bottom — layered back into the
shape of a card. Around thirty of them over a couple of weeks. Action shots out of
cardboard that was worth nothing. The original idea was pop-up players cut out one
at a time; he did not have the patience for it, and the strips were what happened
instead. Somewhere in that pile he settled on one year's design.
*Figures: cutting in progress, three or four finished collages, one collage beside an
intact 1986 card.*

### 3. A question about scans

2026-08-27. The first message of the whole project, verbatim: *"what gives the
cleanest and highest resolution card scans from late 80s-mid 90s? baseball only"*.
TCDB forbids scraping. The only clean path for that era was to buy a scanner and do
it himself — a modded Fujitsu fi-8170 and fifteen-dollar factory sets. He did not
buy the scanner. **The whole project is what happened instead of buying a scanner.**

### 4. Seventy-five years too early

The Library of Congress Benjamin K. Edwards collection came up as a consolation
prize, logged at the time in exactly those words: *75 years too early for junk wax*.
Then: *"let's build a rate limited card puller for LOC cards"*, then *"what we can
start to do with these cards with ML and vision AI"*, then the real goal — *"a html
dashboard with a browsable, queryable card explorer with richer metadata than LOC's
own catalog."*

By the end of the next day: five archive pullers, a fleet of Haiku agents reading
per-card metadata out of 2,083 fronts, CLIP embeddings, dedupe, and a faceted
dashboard richer than the source catalog. It also found 65 systematic off-by-one
image/record shifts in LOC's own cataloging — a genuine contribution back, written
up and never sent. Sixty-one commits in one day. Include the 429 and the courteous
hour-long backoff. *Figures: a real Edwards card, the dashboard.*

### 5. Two archives animating each other

A FLUX style LoRA trained on public-domain provenance for six dollars on Modal.
PuLID for identity. Then a second agent session, working independently, retargeted
Muybridge's 1887 baseball motion studies onto the cards — real and generated — so
two 1887 archives ended up animating each other through 2026 models. Around fifteen
dollars all in. There was also a cursed-audio branch cutting reels to public-domain
"Take Me Out to the Ball Game," which is the clearest evidence of how far the thing
had drifted from baseball cards in the basement.
*Figures: pending the rights decision below.*

### 6. "1986 topps baseball card scans????"

2026-08-29. His message, verbatim, four question marks included. The answer came
back as a ruling: no 1986 scans enter the repo, on copyright and on the
public-domain sourcing discipline the project had already adopted. So he wrote the
one that redirected everything: *"add an '86-style frame to the card templates. lock
in fonts, teams colors, the look, the feel, the poses, the time, the color, the fade,
the degridation."*

Everything after this descends from that message. The 1887 line was never closed. In
the retrospective's phrasing: *it stopped getting messages.*

The ruling is also why the rest of the project looks the way it does. If no scan can
enter the repo, every fact about the card has to be **measured** and then thrown
away. Measure, don't ingest. That constraint produced the font, the microscope
session and the wear model.

### 7. The type came first

Commit `a349686`, 2026-08-30. The 1986 face never shipped as a font, so it was
traced off team names — which is a corpus of 26 bars and nothing else. Sixty-one
letter observations at first. A second batch of fifteen scans took it to 146 and,
decisively, gave every previously-singleton letter a second print. Measured, not
ingested: the staging directory was ephemeral and nothing entered the repo.

No MLB nickname contains **Q, Z or F**, so there was nothing to trace for any of
them. Each was built from letters that existed: F is the E with its bottom arm cut
away; Q is the O with a wedge tail on the same angle the R's leg and the E's arms
already use; Z is the E's arm thickness top and bottom joined by a diagonal, and the
diagonal had to be fitted to the face's own mean ink coverage of 0.718 because
solving it geometrically produced a band wider than the glyph.

The honest version of the Z is better than the tidy one. The first cut shipped a
*mirrored S, sharpened* — a bench hack, because there was no Z to trace. The finish
pass threw it out and rebuilt it from the E. Both are in the record; the article
tells it as the revision it was. *Figure: `story/alphabet.png`.*

Also here, because it is the colourway thread he mentioned: the team bar can only
be one of five inks. On uncoated stock at the era's screen a tint goes muddy, so only solids
survive, and the ground is black, which kills every low-luminance ink — magenta alone
is 0.24 luminance, cyan-plus-magenta blue is 0.06. The rule that falls out is
*nearest surviving ink to the club's identity, taking the light secondary when the
primary is navy, black or deep green*. That is why the 1986 Braves bar is cyan and
not red, and why the Yankees bar is white.

**Drafting note, screen ruling.** `TOPPS86.md` argues the ink-survival rule against
"~133 lpi", which is an era assumption, while the microscope measured ~122 LPI on the
actual card (cyan at 127). The article must not present both as measurements. Use the
measured number in beat 8 and keep beat 7's argument qualitative, as amended above.

### 8. A kid's microscope

2026-08-31 and 2026-09-01. His daughter's toy USB microscope, a 1986 Topps #152 Mike
Morgan, and a metric tape edge in frame 14 for calibration: 1195 pixels per
millimetre, 0.837 µm per pixel, a field of view 1.6 mm wide. Ninety-six frames swept,
the sharpest per colour cluster kept.

What it measured, on the front: a ~122 LPI screen at 0.208 mm dot pitch, with the
screens sitting at 67.1°, 112.9° and 138.4° in frame rotation. Letters and frame
lines are solid unscreened ink — the rosette is only in the photograph. On the back:
two inks, one spot red flooding the field with a ~50% tint behind the stats at ~127
LPI and ~32° off the tint-box edge, and solid black overprinted with no knockout.

Then the edge, which is the part that changed the 3D card. Caliper median 0.453 mm
over 49 slices, axis found by PCA. Single ply, no core, fibrous throughout. The
front's clay coat is a ~65 µm bright line on one rim and the back's red ink a ~48 µm
skin on the other, and neither wraps around. The cut face is a warm tan, about
(204, 181, 124). Inside the board, luminance varies ±25% at a correlation length of
26 µm along the cut and 20 µm across, with dark recycled specks over 13% of the area
and bleached fibres over 16%.

The stock turned out to be clay-coated newsback — recycled grey-brown furnish with
only the top ply bleached and coated. The cereal-box grade. The measurement doc says
it best and the article should quote it: *the edge you see here is exactly a cereal
box's edge at the same scale.*

The app's card was 0.0004 m thick at the time, about 12% under the real thing.
*Figures: first rosette capture, the cut edge, the straightened edge strip, the 1.5 mm
texture tile.*

### 9. The back, and a mascot with a job

back86 from 2026-09-01: measured geometry, two inks, a career table with real stats
off the MLB Stats API. The detail he loves on the original is the little fact box
they filled when a player's career was too short to fill the table, so he took it
over and retitled it **WHAT THE SABR!?** — live-season sabermetric facts, cycled by
card number.

The mascot was a four-pose line-art brief run through four image models and judged by
eye at the 12 mm a card-back mascot actually prints at. Then a 70-frame library, and
then the part worth the section: the poses stopped being a lottery and became an
**earned deal**, a ladder where a pose has to be justified by what the player
actually did. A fielder earns a fielding pose from the same feed the stats come from.
Rung 3 refuses rung 1's vocabulary. Replacement-level gets a cardboard standee
missing the ball. Brian's own eye cut 15 poses from the pool.
*Figures: `story/mascot-bake-off.png`, a rendered back.*

### 10. Nobody is in the right uniform

The licensing thread, told as constraint rather than disclaimer. The bench opens on
place names instead of club nicknames. Kits are named in colours, never in clubs.
Generated players are blocked against every name in the corpus. Sixty fronts rebuilt
on freely licensed photographs meant forty photographers and a team name that almost
never matches the jersey under it, so fifty of the sixty carry the photographer, the
licence and the Commons link printed along the bottom margin of the card itself.

And the frame that set the policy: a chromolithograph good enough to pass for a
Library of Congress scan, except the batter grips the bat with three hands. Two of two
for mark-making, two of two for palette, zero on composition — and that one render
rejected the whole batting pose. A person looks at every frame before it ships.
*Figures: `story/three-hands.png`, `story/wrong-uniforms.png`.*

### 11. Off the page and onto a table

2026-08-31, four days after the parent repo: the app starts. TypeScript, Svelte,
WebGPU, Three.js, Rapier. The point was that he wanted more than a 2D card
generator. The card becomes a solid on a glass table. Let go of it and it falls,
tumbles under physics and settles face up.

Two details worth keeping. The card faces are held byte-exact against the Python
renderer — unlit materials, tone mapping off, proven to ±1/255 — because a card whose
colour drifts under scene lighting is not the card. And the first time anything in the
app turned a card over, the back came up mirror-reversed and blown out to white: it
had been painted on a lit material aimed at the front face for months and nobody
could see it. *Figures: `press-loaded`, the mint/worn compare slider.*

### 12. Ten thousand cards and one bad column

Ten thousand cards at 256 live geometry, six draw calls, 120 fps, flat cost — and a
1.5 metre shredded spire floating above its own table. Both readings in one frame:
the performance work was right and the geometry was out of envelope. Then the fix,
same scene, same camera, the pile down to 233 mm lying on the table, cost readouts
unmoved. *Figure: `story/pile-runaway.png` and `story/pile-fixed.png` as a plate.*

Rarities land here too, as the thing he admits was unnecessary and kept anyway: rare,
holo and legendary at 10, 4 and 1 per hundred, with legendary striking every black
mark outside the photograph in gold foil, and a ceremony on the strike that flares the
lamp and dims the room.

### 13. Shipping it

Cloudflare, which he had never set up before, and a separate DNS for the app. Release
1.0.0 on 2026-09-25, bound to cards.roojerry.com. Then the unglamorous days: a
fallback for machines with no WebGPU, Lighthouse to 100, mobile performance so a
phone is not asked to carry a heavy 3D scene.

### 14. Still on the bench

The shared pile — publish Worker, relay Durable Object, snapshots — is built, tested,
gate-cleared and not deployed, and the thing standing in front of it is moderation,
not engineering. Today every visitor gets their own pile, rebuilt from a seed in the
browser and sent nowhere, which is true because the deploy is static.

Then the honest list. The junk-wax scanner was never bought; the corpus that started
all of this is still in the basement. The LOC catalog report was never sent. The 1887
line is parked, not lost, and everything it built is still on disk.

And the close: there is a file in the parent repo called `.claude/branches/writeup.md`,
written on day two, 2026-08-28. Its mission line reads *"the public story of this
project — blog post."* It is one of ten branch briefs from that week. The
retrospective's fate table lists its outcome as **zero commits**. This article is that
branch, finally.

## Citation table

Every number in the draft resolves here. Paths are relative to the repo named.

| Claim | Source |
| --- | --- |
| 1,379 commits; parent 2026-08-27 → 09-25 (406); app 2026-08-31 → 09-28 (973) | `git log` both repos |
| First message, TCDB, fi-8170, "75 years too early" | parent `.claude/branches/RETRO-2026-09-07-early-days.md` beat 1, session `77e16219` |
| Puller quotes, dashboard goal, the day-two inventory | same, beat 2 |
| 2,083 fronts; $6 LoRA on Modal; ~$15 all in; the 429 backoff | parent `.claude/branches/writeup.md` |
| 754 mismatches, 65 off-by-one record shifts | parent `loc_catalog_diff.md` |
| Muybridge retarget, independent session | parent `retarget.py`, session `4bb0e8d7`; RETRO beat 2 |
| Pivot message and the no-scans ruling, 2026-08-29 | RETRO beat 4, session `51ce0530` |
| "It stopped getting messages" | RETRO beat 4, verbatim |
| Plate86 first cut, 26-bar corpus, mirrored-S Z | parent commit `a349686` (2026-08-30); app `.claude/captures/captures.jsonl`, label "An alphabet, rebuilt" |
| 61 → 146 letter observations; the fifteen second-batch scans | parent `.claude/design/TOPPS86.md`, finish pass |
| Q/Z/F construction; ink coverage 0.718; arms 0.29 cap, gap 0.42 | parent `.claude/design/TOPPS86.md`, "The missing three" |
| Five surviving inks; magenta 0.24, C+M 0.06; Braves cyan, Yankees white | parent `.claude/design/TOPPS86.md`, team-bar section |
| Two traced cuts retired, Plate86-Type shipped | parent commit `58e0aaf` (2026-09-01) |
| Microscope rig, #152 Mike Morgan, 1195 px/mm, 96-frame sweep | `~/Pictures/camera/microscope/README.txt` |
| 122 LPI, 0.208 mm pitch, angles 67.1/112.9/138.4; solid graphics | same, front analysis; `morgan86_print_analysis.json` |
| Back: spot red flood, ~50% tint at ~127 LPI, ~32°, black no knockout | same, back section; `morgan86b_back_analysis.json` |
| Caliper median 0.453 mm over 49 PCA slices; skins 65/48 µm; cut face (204,181,124); texture stats; CCNB; the cereal-box line | parent `.claude/research/card-edges/MEASURED.md` (2026-09-06) |
| `CARD_THICKNESS_M = 0.0004`, ~12% under | same, "Handed to teightysix" |
| back86 measured geometry and inks | parent `.claude/design/BACK86.md`; commits 2026-09-01/02 |
| WHAT THE SABR!? box and its fact pool | parent commits 2026-09-07 |
| Mascot bake-off, four models, judged at 12 mm | app `.claude/captures/captures.jsonl` |
| 70 frames, deal of 58, pool locked at 43, Brian's 15 exclusions | parent commits 2026-09-08 |
| Earned deal: rungs 0–4, rung 3 refuses rung 1, cardboard standee | parent `.claude/design/MASCOT_DEAL.md`; commits 2026-09-08/09 |
| Place names not nicknames; kit named in colours | parent commits 2026-09-12 |
| D13 posture | app `.claude/PLAN-RELEASE.md` §4.4 |
| NIL split; 1887 as the commercial unlock | parent `.claude/branches/physical.md` |
| Three hands: 2/2 mark-making, 2/2 palette, 0 composition | app `.claude/captures/captures.jsonl` |
| 60 fronts, 40 photographers, 50 need credit | app `.claude/captures/captures.jsonl` |
| App start, stack, M1 gate passed 2026-09-09 | app `.claude/ROADMAP.md`; commits 2026-08-31 |
| Byte-exact faces, unlit + NoToneMapping, ±1/255; CPU −63% | app `.claude/run-reports/GLASS.md`, `ENGPERF.md` |
| First flip came up mirror-reversed and blown to white | app `.claude/captures/captures.jsonl`, "The back reads" |
| 256 live / 2000 resident; local-pile seed, nothing transmitted | app `.claude/PLAN-RELEASE.md` §4.1, §0 |
| 10,000 cards, 6 draw calls, 120 fps, 1.5 m spire, 233 mm fixed | app `.claude/captures/captures.jsonl` |
| Rarity 10/4/1; legendary gold foil; the strike ceremony | app `.claude/PLAN-BACK.md` 210; `PLAN-FANFARE.md`; commits 2026-09-13 |
| WebGPU fallback and the Sonoma finding | app commit 2026-09-10 |
| Release 1.0.0 binds cards.roojerry.com | app commit 2026-09-25 |
| Lighthouse 100; mobile perf | app PR #30 (2026-09-27), PRs #33/#36 (2026-09-28) |
| Publish Worker / relay DO / snapshots built, gate-cleared, undeployed | app `.claude/HANDOFF.md`; `PLAN-RELEASE.md` §0 |
| 1887 corpus still on disk | RETRO, "What is still on disk" |
| writeup.md, day two, zero commits | parent `.claude/branches/writeup.md`; RETRO fate table |

## Figure manifest

**Already on the site, reused inline**

`story/alphabet`, `story/mascot-bake-off`, `story/three-hands`,
`story/wrong-uniforms`, `story/pile-runaway`, `story/pile-fixed`,
`compare-mint` / `compare-worn`, `press-loaded`, and from `shots/`:
`back-turned-over`, `pile-top-down`, `picked-card`, `cut-corner-ladder`. Available but not
placed by this spec: `position-board`, `team-colours`, `sixty-licensed`,
`sweep-footprint`. The drafter may place any of them where a beat earns it. The files
stay on disk and in `project-assets.test.js` either way; nothing is deleted.

**To shoot (Brian, sourcing)**

Collages: one wide shot of the boxes and binder; cutting in progress with strips
laid out; three or four finished collages square and flat in even light; one
collage beside an intact 1986 card in the same frame. Phone is fine.

**To convert from the parent repo**

| Target | Source |
| --- | --- |
| `micro/rosette.webp` | `~/Pictures/camera/microscope/morgan86_01_rosette-first-capture.png` |
| `micro/cut-edge.webp` | `morgan86b_07_card-edge.png` |
| `micro/edge-strip.webp` | parent `.claude/research/card-edges/morgan86b_07_edge-strip-straight.png` |
| `micro/edge-texture.webp` | parent `.claude/research/card-edges/edge-texture-tile_1.5mm.png` |
| `loc/edwards-card.webp` | one public-domain card from parent `loc-cards/` |
| `loc/dashboard.webp` | a dashboard capture, or a screenshot of `imgdash.py` output |
| `loc/muybridge-plate.webp` | parent `muybridge/plate_274.jpg` or similar |

Each lands as webp plus a png or jpg sibling, matching what
`tests/simulation/project-assets.test.js` already asserts. Long edge 1800 px for
figures, as the existing shots use.

## Layout and shortcodes

**`layouts/projects/article.html`**, selected by `layout: article` in frontmatter,
which Hugo resolves for pages in `content/projects/`. Structure:

1. `partial "breadcrumbs"`
2. Compact header: status pill, `h1` title, subtitle, Open the bench / GitHub links
3. `.article-body` wrapping `.Content` in full
4. The existing CTA block
5. One `.shot-lightbox` dialog, so `shot-lightbox.js` has its target

**Shortcodes.** None exist yet; `layouts/shortcodes/` is new.

- `fig.html` — `src`, `alt`, `caption`, optional `fit`. Emits `<figure>` with a
  `<picture>` (webp source plus fallback) and a `.gallery-item__zoom` button
  carrying `data-full`, which is what `shot-lightbox.js` binds.
- `compare.html` — `before`, `after`, `beforeLabel`, `afterLabel`, `caption`,
  optional `portrait`. Emits the existing `.img-compare` markup verbatim so
  `img-compare.js` picks it up with no change.
- `plate.html` — a paired or tripled row of figures for the runaway/fixed pair and
  the bake-off rows. Reuses `.story-strip` CSS.

**CSS.** New `.article-body` block in `projects.css`: measure capped around 68ch,
figures allowed to break wider than the measure, generous section spacing, and a
pull-quote style for the two quoted messages and the cereal-box line. Bump the
cache-buster.

**Frontmatter after the rewrite.** Keep `title`, `subtitle`, `description`,
`blurb`, `tags`, `statusLabel`, `live`, `github`, `ctaTitle`, `ctaDesc`, `image`,
`poster`, `showpiece`, `featured`, `weight`, `year`, and add `layout: article` plus
`date` for the `Article` schema. Remove `features`, `featureColumns`,
`screenshots`, `screenshotsGrid`, `story`, `compare` — all of it moves into the body.

`single.html` renders a `tagline` param in quotes under the title and
`teightysix.md` has never set one. Carry that slot into `article.html` and fill it,
using the existing `description` line, which is the best thesis sentence anyone has
written for this page: *the type, the color, the print, and forty years of wear.*
(US spelling, per the voice contract.)

`date` is the article's publication date, set when the branch ships, not the
project's start date. `year: "2026"` stays as the project's year.

## JSON-LD

`jsonld.html` currently emits `CreativeWork` for project pages. For a page with
`layout: article`, emit `Article` instead: `headline`, `description`, `image`,
`datePublished` from `date`, `author` as the site Person, `mainEntityOfPage`. Keep
the existing `CreativeWork` branch for every other project page.

## Tests

- **`tests/e2e/project-detail.test.js`** currently parses the frontmatter `story:`
  list and asserts the rendered strip matches it in order. The list is going away.
  Retarget it at the article: assert the page renders `layout: article`'s body, that
  every `<figure>` has a non-empty caption and a resolvable `src`, and that the
  fixture-driven negative case still fails when a figure is broken. Keep the
  throwaway-fixture pattern from the existing file so the test can still fail.
- **`tests/simulation/project-assets.test.js`** — extend its path list to the new
  `micro/` and `loc/` figures. No structural change.
- **`tests/e2e/showpiece.test.js`** — should pass untouched. Verify, do not edit.
- Full `npm test` green before the branch is considered done.

## Out of scope

- A `/writing/` section, an index of posts, or RSS. One article, on its existing URL.
- Any change to the live app at cards.roojerry.com.
- Republishing or re-exporting the app's capture pipeline.
- Retouching or regenerating any existing figure.
- A Lighthouse run. The page gains prose and a few figures; check it after deploy,
  and note the site's standing rule that local runs on this machine are
  contention-dominated and only PageSpeed Insights is authoritative.

## Rights decision for beat 5 (settled 2026-09-29)

**Option 2: process frames only.** No finished render of a current MLB player is
published on this page. The modern-player results are described in prose; the
figures are public-domain subjects and process artefacts.

The figures this resolves to are better than the option it replaces, because the
project already ran its evaluation on a public-domain historical set:

| Figure | Source | What it shows |
| --- | --- | --- |
| `loc/dorgan-1887.webp` | parent `p2l-eval/hist_gt/dorgan_2.jpg` | The real Old Judge chromolithograph, "DORGAN. RIGHT FIELD. N.Y." Public domain, LOC Edwards collection. Ground truth. |
| `loc/dorgan-model.webp` | parent `p2l-out/kontext_v2_1000_g4/dorgan_2.png` | The model's attempt on the same sitter at step 1000, guidance 4. Style learned, identity gone, and the caption rendered as `EG JOULS / ORSU-DNOHA.L`. |

The pair carries the whole finding in one look, and the gibberish caption is the
reason the pipeline stopped asking FLUX for text and started compositing clean
caption type (parent commit, 2026-08-28: "Composite clean caption type onto cards
instead of asking FLUX for text").

**Excluded by this decision:** every `cards-out/edwards_*_modal.png`, and every sheet
under `.codex/p2l-resample/contact_sheets/` whose filename is a current player. Any
composite sheet considered later must be opened and checked for modern faces before
it is published.
