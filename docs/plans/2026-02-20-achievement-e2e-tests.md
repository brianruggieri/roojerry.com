# Achievement E2E Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a committed, runnable e2e test suite (`npm test`) for the achievement system using Puppeteer against the live Hugo dev server, establishing the testing pattern for all future achievements.

**Architecture:** `package.json` in the project root defines `npm test` as `node test-achievements.js`. The test script connects to a running Hugo dev server at `localhost:1313`, exercises the `#profileCoin` DOM element, and asserts achievement toast behavior. Each test case is a named async function that throws on failure — a simple, zero-dependency harness that sets the standard for future test files. The existing disturbance test scripts are gitignored throwaway scripts; this suite is committed and permanent.

**Tech Stack:** Node 22 (nvm), Puppeteer 24, Hugo dev server (prerequisite, not managed by test)

**Prerequisites:** Hugo server must be running before `npm test`. Start it with:
```bash
/opt/homebrew/bin/hugo server -D
```

---

## Testing Standards (read before implementing)

Every future achievement test must follow this pattern:

1. **One `runTest(name, fn)` call per behavior** — not one test per achievement, one test per distinct behavior
2. **Assert DOM structure, not just existence** — check `data-achievement-id`, name text, and image `src`
3. **Reset state between tests** — reload the page (`page.reload()`) between test cases that depend on click count
4. **Use `page.evaluate()` to fast-forward counters** — never click 50 times in a test; inject counter state directly
5. **No `waitForTimeout` on assertions** — use `waitForSelector` with a timeout instead; it's faster and less flaky
6. **Exit 1 on any failure** — the test harness must `process.exit(1)` so CI can catch failures

---

## Task 1: Add `package.json` and install Puppeteer

**Files:**
- Create: `package.json`
- Update: `.gitignore`

**Step 1: Create `package.json`**

Create `/Users/brianruggieri/git/roojerry/package.json`:

```json
{
  "name": "roojerry",
  "private": true,
  "scripts": {
    "test": "node test-achievements.js"
  },
  "devDependencies": {
    "puppeteer": "^24.0.0"
  }
}
```

**Step 2: Install puppeteer locally**

```bash
cd /Users/brianruggieri/git/roojerry
source ~/.nvm/nvm.sh && nvm use 22
npm install
```

Expected output ends with: `added N packages` and no errors. Puppeteer will download a local Chromium on first install (~170MB) — this is normal.

**Step 3: Add `node_modules/` to `.gitignore`**

Open `.gitignore` and add after the `# Build output` section:

```
# Node / npm
node_modules/
```

**Step 4: Verify install**

```bash
source ~/.nvm/nvm.sh && nvm use 22
node -e "const p = require('puppeteer'); console.log('puppeteer OK', p.executablePath?.() ?? 'bundled')" 2>/dev/null || node -e "import('puppeteer').then(p => console.log('puppeteer ESM OK'))"
```

Expected: prints `puppeteer OK` without error.

**Step 5: Commit**

```bash
cd /Users/brianruggieri/git/roojerry
git add package.json package-lock.json .gitignore
git commit -m "Add package.json with puppeteer for e2e tests"
```

---

## Task 2: Write the test harness and first test (no toast on load)

**Files:**
- Create: `test-achievements.js`

**Context:** We build the harness first with one test, verify it runs green end-to-end, then add the remaining tests in Task 3. This ensures the scaffolding works before we write all the assertions.

**Step 1: Ensure Hugo server is running**

```bash
# In a separate terminal, if not already running:
/opt/homebrew/bin/hugo server -D
```

Verify: `curl -s http://localhost:1313/ | grep -c "profileCoin"` should print `1`.

**Step 2: Write `test-achievements.js` with harness + first test**

Create `/Users/brianruggieri/git/roojerry/test-achievements.js`:

```js
#!/usr/bin/env node
// E2E tests for the achievement system.
// Requires Hugo dev server running at localhost:1313.
// Run: npm test
//
// STANDARDS FOR FUTURE ACHIEVEMENT TESTS:
// - One runTest() per distinct behavior (not per achievement)
// - Assert data-achievement-id, name text, and image src — not just existence
// - Reset state between tests with page.reload()
// - Use page.evaluate() to fast-forward click counters, never click 50+ times
// - Use waitForSelector() not waitForTimeout() for assertions
// - Always exit 1 on failure (process.exit(1) in catch)

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:1313';
const COIN_SELECTOR = '#profileCoin';
const TOAST_SELECTOR = '.ani_div';
const PASS = '✅';
const FAIL = '❌';

let passed = 0;
let failed = 0;

async function runTest(name, fn, page) {
  try {
    await fn(page);
    console.log(`${PASS} ${name}`);
    passed++;
  } catch (err) {
    console.error(`${FAIL} ${name}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

/**
 * Click the coin N times, waiting for the flip animation lock to clear between clicks.
 * The coin has a 600ms flip animation; clicking during it is ignored.
 */
async function clickCoin(page, times) {
  for (let i = 0; i < times; i++) {
    await page.click(COIN_SELECTOR);
    await page.waitForFunction(
      () => !window.flipping,
      { timeout: 2000 }
    );
  }
}

/**
 * Assert a toast with the given achievementId appears within timeoutMs.
 * Verifies data-achievement-id attribute, name text, and image src.
 */
async function assertToast(page, { achievementId, name, imageSrc }, timeoutMs = 3000) {
  const selector = `${TOAST_SELECTOR}[data-achievement-id="${achievementId}"]`;
  await page.waitForSelector(selector, { timeout: timeoutMs });

  const result = await page.evaluate((sel, expectedName, expectedImageSrc) => {
    const card = document.querySelector(sel);
    if (!card) return { error: 'Card not found after waitForSelector' };
    const nameEl = card.querySelector('.ach-name');
    const imgEl = card.querySelector('.ach-icon-img');
    return {
      name: nameEl?.textContent?.trim(),
      imageSrc: imgEl?.src ?? null,
    };
  }, selector, name, imageSrc);

  if (result.error) throw new Error(result.error);
  if (result.name !== name) {
    throw new Error(`Expected name "${name}", got "${result.name}"`);
  }
  if (imageSrc && !result.imageSrc?.includes(imageSrc)) {
    throw new Error(`Expected image src to contain "${imageSrc}", got "${result.imageSrc}"`);
  }
}

/**
 * Assert no toast with the given achievementId exists in the DOM.
 */
async function assertNoToast(page, achievementId, waitMs = 800) {
  // Wait a moment to give any spurious toast time to appear
  await new Promise(r => setTimeout(r, waitMs));
  const selector = `${TOAST_SELECTOR}[data-achievement-id="${achievementId}"]`;
  const exists = await page.$(selector);
  if (exists) {
    throw new Error(`Expected no toast for "${achievementId}" but one appeared`);
  }
}

(async () => {
  console.log('🚀 Starting achievement e2e tests...\n');

  // Verify server is up
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.error(`❌ Could not connect to Hugo server at ${BASE_URL}`);
    console.error('   Start it with: /opt/homebrew/bin/hugo server -D');
    await browser.close();
    process.exit(1);
  }

  // --- Test 1: No toast on fresh page load ---
  await runTest('No achievement toast on page load', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await assertNoToast(page, 'coin_clicker');
    await assertNoToast(page, 'coin_clicker_50');
  }, page);

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n🔴 Tests failed.');
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log('\n🏁 All tests passed!');
})();
```

Note: the file uses ES module `import` syntax (`import puppeteer from 'puppeteer'`) because Puppeteer 24 is ESM-first. This requires either `"type": "module"` in `package.json` or the `.mjs` extension. We'll update `package.json` in the next step.

**Step 3: Add `"type": "module"` to `package.json`**

Open `package.json` and add `"type": "module"`:

```json
{
  "name": "roojerry",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node test-achievements.js"
  },
  "devDependencies": {
    "puppeteer": "^24.0.0"
  }
}
```

**Step 4: Run the first test to verify the harness works**

Hugo server must be running. Then:

```bash
cd /Users/brianruggieri/git/roojerry
source ~/.nvm/nvm.sh && nvm use 22
npm test
```

Expected output:
```
🚀 Starting achievement e2e tests...

✅ No achievement toast on page load

1 passed, 0 failed

🏁 All tests passed!
```

If you see `❌ Could not connect to Hugo server`, start it first.

**Step 5: Commit**

```bash
git add test-achievements.js package.json
git commit -m "Add achievement e2e test harness with load test"
```

---

## Task 3: Add remaining test cases

**Files:**
- Modify: `test-achievements.js`

**Context:** Add the four remaining behavioral tests. Each reloads the page to reset session state, then exercises the specific behavior. The `coinClickCounter` fast-forward technique (Task 3, Test 5) is the established pattern for high-count tests — document it clearly as it's the key convention for future contributors.

**Step 1: Replace the test block in `test-achievements.js`**

Find the `// --- Test 1` block and the lines after it (through `browser.close()`). Replace the entire section from `// --- Test 1` to the end of the IIFE with:

```js
  // --- Test 1: No toast on fresh page load ---
  await runTest('No achievement toast on page load', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await assertNoToast(page, 'coin_clicker');
    await assertNoToast(page, 'coin_clicker_50');
  }, page);

  // --- Test 2: No toast before 10 clicks ---
  await runTest('No toast after 9 clicks (threshold not reached)', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await clickCoin(page, 9);
    await assertNoToast(page, 'coin_clicker', 500);
  }, page);

  // --- Test 3: coin_clicker unlocks at exactly 10 clicks ---
  await runTest('coin_clicker unlocks at click 10 with correct name and image', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    await clickCoin(page, 10);
    await assertToast(page, {
      achievementId: 'coin_clicker',
      name: '10 Clicks Hero',
      imageSrc: 'coin-clicker-10.png',
    });
  }, page);

  // --- Test 4: coin_clicker does not re-unlock (deduplication) ---
  await runTest('coin_clicker does not re-unlock on click 11 (dedup)', async (page) => {
    // Continue from previous state — do NOT reload; we need click count at 10 already.
    // Reload and fast-forward instead to keep tests independent.
    await page.reload({ waitUntil: 'networkidle0' });
    // Fast-forward counter to 10, trigger unlock, wait for it to appear and disappear
    await page.evaluate(() => { coinClickCounter = 9; });
    await page.click(COIN_SELECTOR); // click 10 → unlocks
    // Wait for first toast to appear then go away (3s animation)
    await page.waitForSelector(`${TOAST_SELECTOR}[data-achievement-id="coin_clicker"]`, { timeout: 2000 });
    await page.waitForFunction(
      (sel) => !document.querySelector(sel),
      { timeout: 5000 },
      `${TOAST_SELECTOR}[data-achievement-id="coin_clicker"]`
    );
    // Now click again (click 11) — should NOT produce a new toast
    await page.click(COIN_SELECTOR);
    await assertNoToast(page, 'coin_clicker', 600);
  }, page);

  // --- Test 5: coin_clicker_50 unlocks at exactly 50 clicks ---
  // PATTERN: Use page.evaluate() to set coinClickCounter = 49, then click once.
  // Never click 50 times in a test — it's slow and the flip lock adds ~30s of wait.
  // This is the established convention for all high-count achievement tests.
  await runTest('coin_clicker_50 unlocks at click 50 with correct name and image', async (page) => {
    await page.reload({ waitUntil: 'networkidle0' });
    // Fast-forward: set counter to 49, then one real click triggers the achievement
    await page.evaluate(() => { coinClickCounter = 49; });
    await page.click(COIN_SELECTOR);
    await assertToast(page, {
      achievementId: 'coin_clicker_50',
      name: '50 Clicks Legend',
      imageSrc: 'coin-clicker-50.png',
    });
  }, page);

  // --- ADD FUTURE ACHIEVEMENT TESTS HERE ---
  // Pattern:
  //   await runTest('description of behavior', async (page) => {
  //     await page.reload({ waitUntil: 'networkidle0' });
  //     // fast-forward any counters with page.evaluate() if needed
  //     // trigger the behavior
  //     await assertToast(page, { achievementId: 'your_id', name: 'Name', imageSrc: 'your-icon.png' });
  //   }, page);

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n🔴 Tests failed.');
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log('\n🏁 All tests passed!');
```

**Step 2: Run the full suite**

```bash
cd /Users/brianruggieri/git/roojerry
source ~/.nvm/nvm.sh && nvm use 22
npm test
```

Expected output:
```
🚀 Starting achievement e2e tests...

✅ No achievement toast on page load
✅ No toast after 9 clicks (threshold not reached)
✅ coin_clicker unlocks at click 10 with correct name and image
✅ coin_clicker does not re-unlock on click 11 (dedup)
✅ coin_clicker_50 unlocks at click 50 with correct name and image

5 passed, 0 failed

🏁 All tests passed!
```

If any test fails, read the error message — it will name the exact assertion that failed and the values it received. Fix the issue and re-run.

**Step 3: Commit**

```bash
git add test-achievements.js
git commit -m "Add full achievement e2e test suite (5 tests)"
```

---

## Task 4: Document the testing standard

**Files:**
- Create: `.claude/TESTING.md`

**Context:** The `.claude/` directory is gitignored and holds agent-facing docs. This note tells future Claude sessions (and you) how to run tests and what the conventions are.

**Step 1: Write `.claude/TESTING.md`**

Create `/Users/brianruggieri/git/roojerry/.claude/TESTING.md`:

```markdown
# Testing

## Running Tests

```bash
# Terminal 1 — start Hugo server (required)
/opt/homebrew/bin/hugo server -D

# Terminal 2 — run e2e suite
source ~/.nvm/nvm.sh && nvm use 22
npm test
```

## Test File

`test-achievements.js` — Puppeteer e2e tests against localhost:1313.

## Conventions

- **One `runTest()` per behavior**, not per achievement
- **Assert structure**: always check `data-achievement-id`, `.ach-name` text, and `.ach-icon-img` src
- **Reset state**: call `page.reload()` at the start of each test
- **Fast-forward counters**: use `page.evaluate(() => { coinClickCounter = N; })` — never click 50 times
- **Use `waitForSelector`** not `waitForTimeout` for assertions
- **`process.exit(1)`** on any failure — CI must be able to catch failures

## Adding Tests for New Achievements

1. Add the achievement def to `themes/resume/static/js/achievements.js`
2. Add the trigger to `themes/resume/static/js/coin-flip.js` (or wherever it fires)
3. Add a `runTest()` block in `test-achievements.js` before the `// ADD FUTURE TESTS` comment
4. Run `npm test` — all 5+ tests must pass before committing
```

**Step 2: Verify `.gitignore` covers `.claude/`**

```bash
grep "\.claude" /Users/brianruggieri/git/roojerry/.gitignore
```

Expected: `.claude/` appears. If not, add it.

**Step 3: No commit needed** — `.claude/` is gitignored. The file is written for agent/session use only.

---

## Task 5: Final verification

**Step 1: Run full suite one more time from clean state**

```bash
cd /Users/brianruggieri/git/roojerry
source ~/.nvm/nvm.sh && nvm use 22
npm test
```

All 5 tests must pass.

**Step 2: Verify git log**

```bash
git log --oneline -5
```

Should show:
```
<hash> Add full achievement e2e test suite (5 tests)
<hash> Add achievement e2e test harness with load test
<hash> Add package.json with puppeteer for e2e tests
<hash> Fix achievement trigger: 10 clicks, add 50-click achievement  (from prior work)
...
```

**Step 3: Verify committed files are correct**

```bash
git show --stat HEAD~2  # package.json + .gitignore commit
git show --stat HEAD~1  # harness commit
git show --stat HEAD    # full suite commit
```

`node_modules/` must NOT appear in any commit.

**Step 4: Stop Hugo server when done**

`Ctrl+C` in the Hugo terminal.
