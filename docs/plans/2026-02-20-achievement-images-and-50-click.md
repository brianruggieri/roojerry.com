# Achievement Images & 50-Click Achievement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 10-click achievement trigger bug, add a 50-click achievement, replace Font Awesome icons with custom PNG images (white-background removed), and add image-with-FA-fallback rendering to the achievement card system.

**Architecture:** Achievements are defined in `ACHIEVEMENT_DEFS` in `achievements.js` and triggered in `coin-flip.js`. Each achievement def gains an `image` field pointing to a PNG in `static/img/achievements/`. The `createCard()` method renders `<img>` when `image` is present and falls back to `<i class="fa ...">` when it isn't. White backgrounds are stripped from source PNGs using a one-off Node + `sharp` script run locally.

**Tech Stack:** Hugo (static site), vanilla JS, CSS, Node 22 + sharp (image processing only — not a project dependency)

---

## Source Images

The two supplied PNG files are in Downloads (most recent two, timestamped Feb 20 ~6:49–6:51 PM):

- x10 icon: `/Users/brianruggieri/Downloads/ChatGPT Image Feb 20, 2026, 06_49_32 PM.png` *(or 06_49_53 PM — visually confirm which shows x10)*
- x50 icon: `/Users/brianruggieri/Downloads/ChatGPT Image Feb 20, 2026, 06_51_19 PM.png` *(or 06_49_53 PM — the other one)*

Open both files quickly to confirm which is x10 and which is x50 before starting Task 1. The x10 image shows a hand clicking with "x10" label; x50 shows the same with "x50".

---

## Task 1: Strip white backgrounds and place PNGs

**Files:**
- Create: `static/img/achievements/coin-clicker-10.png`
- Create: `static/img/achievements/coin-clicker-50.png`
- Temp: `/tmp/strip-bg/strip.mjs` (not committed)

**Step 1: Create the achievements image directory**

```bash
mkdir -p /Users/brianruggieri/git/roojerry/static/img/achievements
```

**Step 2: Set up temp Node project for sharp**

```bash
mkdir -p /tmp/strip-bg
cd /tmp/strip-bg
source ~/.nvm/nvm.sh && nvm use 22
npm init -y
npm install sharp
```

**Step 3: Write the background-removal script**

Create `/tmp/strip-bg/strip.mjs`:

```js
import sharp from 'sharp';
import { readFileSync } from 'fs';

// Run: node strip.mjs <input.png> <output.png> [threshold]
const [,, input, output, threshold = '30'] = process.argv;
const thresh = parseInt(threshold, 10);

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const buf = Buffer.from(data);

for (let i = 0; i < width * height; i++) {
  const offset = i * channels;
  const r = buf[offset];
  const g = buf[offset + 1];
  const b = buf[offset + 2];
  // White detection: all channels near 255
  if (r > (255 - thresh) && g > (255 - thresh) && b > (255 - thresh)) {
    buf[offset + 3] = 0; // set alpha to transparent
  }
}

await sharp(buf, { raw: { width, height, channels } })
  .png()
  .toFile(output);

console.log(`Done: ${output}`);
```

**Step 4: Run strip on both images**

Confirm which file is x10 vs x50 by opening them (Quick Look: `ql` or `open`). Then:

```bash
cd /tmp/strip-bg
source ~/.nvm/nvm.sh && nvm use 22

# x10 image
node strip.mjs \
  "/Users/brianruggieri/Downloads/ChatGPT Image Feb 20, 2026, 06_49_32 PM.png" \
  "/Users/brianruggieri/git/roojerry/static/img/achievements/coin-clicker-10.png"

# x50 image
node strip.mjs \
  "/Users/brianruggieri/Downloads/ChatGPT Image Feb 20, 2026, 06_51_19 PM.png" \
  "/Users/brianruggieri/git/roojerry/static/img/achievements/coin-clicker-50.png"
```

> If the result has fringing (leftover near-white edge pixels), re-run with a higher threshold (e.g. `50`):
> `node strip.mjs input.png output.png 50`

**Step 5: Verify output**

```bash
open /Users/brianruggieri/git/roojerry/static/img/achievements/coin-clicker-10.png
open /Users/brianruggieri/git/roojerry/static/img/achievements/coin-clicker-50.png
```

Both should show the icon art on a transparent (checkerboard) background in Preview.

**Step 6: Commit**

```bash
cd /Users/brianruggieri/git/roojerry
git add static/img/achievements/
git commit -m "Add achievement icon PNGs with transparent backgrounds"
```

---

## Task 2: Update achievement definitions to use `image` field

**Files:**
- Modify: `themes/resume/static/js/achievements.js` (lines 11–31)

**Context:** `ACHIEVEMENT_DEFS` currently has one entry (`coin_clicker`) using `icon: 'mouse-pointer'`. We're replacing `icon` with `image` for these two achievements, and adding `coin_clicker_50`. Future achievements that don't have custom art can still use `icon`.

**Step 1: Replace ACHIEVEMENT_DEFS in achievements.js**

Open `themes/resume/static/js/achievements.js`. Replace lines 11–31 (the `ACHIEVEMENT_DEFS` block and its comment) with:

```js
// Individual achievement definitions
// Extend this object to add new achievements.
// Use `image` (path to PNG) for custom art, or `icon` (FA icon name) as fallback.
const ACHIEVEMENT_DEFS = {
  // Snarky meta achievement: clicking the coin 10 times
  coin_clicker: {
    id: 'coin_clicker',
    name: '10 Clicks Hero',
    description: 'Tried clicking the coin 10 times. We saw that coming.',
    image: '/img/achievements/coin-clicker-10.png',
    rarity: 'uncommon'
  },

  // Even snarkier: 50 clicks
  coin_clicker_50: {
    id: 'coin_clicker_50',
    name: '50 Clicks Legend',
    description: 'You clicked 50 times. Are you okay?',
    image: '/img/achievements/coin-clicker-50.png',
    rarity: 'rare'
  }

  // Future achievements:
  // example_achievement: {
  //   id: 'example_achievement',
  //   name: 'Achievement Name',
  //   description: 'Snarky description here',
  //   image: '/img/achievements/example.png', // preferred: custom art
  //   icon: 'fa-icon-name',                   // fallback: Font Awesome
  //   rarity: 'rare' // common | uncommon | rare | epic
  // }
};
```

**Step 2: No automated test available** (pure JS in a static Hugo site, no test runner). Manual verification happens in Task 4.

**Step 3: Commit**

```bash
cd /Users/brianruggieri/git/roojerry
git add themes/resume/static/js/achievements.js
git commit -m "Update achievement defs: add coin_clicker_50, switch to image field"
```

---

## Task 3: Update `createCard()` to render image with FA fallback

**Files:**
- Modify: `themes/resume/static/js/achievements.js` (lines 78–114, the `createCard` method)

**Context:** `createCard` currently always renders `<i class="fa fa-{icon} fa-fw">`. We need it to render `<img>` when `achievement.image` exists and fall back to `<i>` for older/future definitions that only have `icon`.

**Step 1: Replace the icon-rendering block inside `createCard`**

Find this section in `createCard` (around lines 87–91):

```js
    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'ani_icon';
    const iconEl = document.createElement('i');
    iconEl.className = `fa fa-${icon} fa-fw`;
    iconContainer.appendChild(iconEl);
```

Replace it with:

```js
    // Icon container (image preferred; FA icon as fallback)
    const iconContainer = document.createElement('div');
    iconContainer.className = 'ani_icon';

    if (image) {
      const imgEl = document.createElement('img');
      imgEl.src = image;
      imgEl.alt = name;
      imgEl.className = 'ach-icon-img';
      iconContainer.appendChild(imgEl);
    } else if (icon) {
      const iconEl = document.createElement('i');
      iconEl.className = `fa fa-${icon} fa-fw`;
      iconContainer.appendChild(iconEl);
    }
```

Also update the destructure on the first line of `createCard` to include `image`:

Before:
```js
    const { name, description, icon, rarity } = achievement;
```

After:
```js
    const { name, description, icon, image, rarity } = achievement;
```

**Step 2: Add CSS for `.ach-icon-img`**

Open `themes/resume/static/css/achievements.css`. After the `.ani_icon i` rule (around line 78–81), add:

```css
.ach-icon-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  display: block;
}
```

This sizes the custom PNG to fit the 68×68px icon container (with some padding on each side).

**Step 3: Commit**

```bash
cd /Users/brianruggieri/git/roojerry
git add themes/resume/static/js/achievements.js themes/resume/static/css/achievements.css
git commit -m "Support image field in achievement cards with FA icon fallback"
```

---

## Task 4: Fix click trigger and add 50-click trigger

**Files:**
- Modify: `themes/resume/static/js/coin-flip.js` (lines 38–48)

**Context:** Line 44 currently reads `if (coinClickCounter >= 1)` — this fires on the very first click instead of the 10th. We fix it to `=== 10` and add `=== 50`.

**Step 1: Replace the click handler body**

Find this block in `coin-flip.js` (lines 38–48):

```js
function onCoinClick(e) {
  // increment click counter for user clicks
  coinClickCounter = (coinClickCounter || 0) + 1;
  flipCoin();

  // When user clicks the coin 10 times, trigger the achievement
  if (coinClickCounter >= 1) {
    ACHIEVEMENTS.unlock('coin_clicker');
    // coinClickCounter = 0;
  }
}
```

Replace with:

```js
function onCoinClick(e) {
  coinClickCounter++;
  flipCoin();

  if (coinClickCounter === 10) {
    ACHIEVEMENTS.unlock('coin_clicker');
  }
  if (coinClickCounter === 50) {
    ACHIEVEMENTS.unlock('coin_clicker_50');
  }
}
```

Notes:
- `===` means each fires exactly once — no need to reset the counter.
- Remove the stale comment and dead `coinClickCounter = 0` line.
- `coinClickCounter` is initialized to `0` on line 37, so `(coinClickCounter || 0) + 1` simplifies to `++`.

**Step 2: Commit**

```bash
cd /Users/brianruggieri/git/roojerry
git add themes/resume/static/js/coin-flip.js
git commit -m "Fix achievement trigger: 10 clicks, add 50-click achievement"
```

---

## Task 5: Manual verification

Hugo is a static site with no test runner. Verify in the browser.

**Step 1: Build and serve locally**

```bash
cd /Users/brianruggieri/git/roojerry
hugo server -D
```

Open `http://localhost:1313` in a browser.

**Step 2: Verify 10-click achievement**

1. Open the browser console (`Cmd+Option+J`)
2. Click the profile coin in the nav **9 times** — no achievement toast should appear
3. Click a **10th time** — the "10 Clicks Hero" achievement toast should slide up from the bottom-right with the custom icon image
4. Click an 11th time — no toast (already unlocked for session)

**Step 3: Force-test the 50-click achievement via console**

Rather than clicking 50 times manually:

```js
// In browser console:
ACHIEVEMENTS.unlock('coin_clicker_50')
```

This should display the "50 Clicks Legend" toast with the x50 icon. Verify the image renders correctly (no white box, transparent background shows the dark card behind it).

**Step 4: Verify FA fallback still works**

In the browser console:

```js
// Temporarily test fallback with a def that uses icon, not image
ACHIEVEMENTS.display({
  id: 'test_fallback',
  name: 'Fallback Test',
  description: 'Should show FA icon',
  icon: 'star',
  rarity: 'common'
})
```

A toast should appear with a Font Awesome star icon (not broken).

**Step 5: Check for visual fringing on PNG icons**

If white fringe is visible around the icon art inside the dark card, go back to Task 1 Step 4 and re-run `strip.mjs` with a higher threshold (try `40` or `50`).

---

## Task 6: Final commit and cleanup

**Step 1: Verify git log looks clean**

```bash
cd /Users/brianruggieri/git/roojerry
git log --oneline -6
```

Should show four commits from this work (Tasks 1–4).

**Step 2: Clean up temp strip-bg directory**

```bash
rm -rf /tmp/strip-bg
```

**Step 3: Done**

No deploy step needed — the GitHub Actions workflow auto-deploys on push to main. If you want to deploy now:

```bash
git push origin main
```

(Per repo conventions, confirm before pushing to main.)
