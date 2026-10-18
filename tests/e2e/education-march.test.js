import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { BASE_URL } from '../helpers/server.js';

const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/#education`, { waitUntil: 'networkidle0' });
  await page.$eval('.uga-march-track', el => el.scrollIntoView({ block: 'center' }));
  assert.equal(await page.$$eval('.uga-march-sprite', els => els.length), 1);
  assert.equal(await page.$eval('.uga-march-track', el => el.getAttribute('aria-hidden')), 'true');
  const sheets = await page.$$eval('.uga-march-sprite', async sprites => Promise.all(sprites.map(async sprite => {
    const image = new Image();
    image.src = getComputedStyle(sprite).backgroundImage.slice(5, -2);
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })));
  assert(sheets.every(([w, h]) => w === 384 && h === 192), 'the drummer pose sheet should decode');

  for (const width of [1440, 1200, 1024, 992, 820, 768, 767, 430, 390, 375, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.waitForFunction(() => {
      const scene = document.querySelector('.uga-march-track');
      return +scene.style.getPropertyValue('--uga-steps') === Math.max(2, Math.round(scene.querySelector('.uga-march-walker').offsetWidth / 20) * 2);
    });
    const result = await page.evaluate(() => {
      const scene = document.querySelector('.uga-march-track');
      const lane = scene.getBoundingClientRect();
      const inside = bounds => bounds.left >= lane.left - 1 && bounds.right <= lane.right + 1 && bounds.top >= lane.top - 1 && bounds.bottom <= lane.bottom + 1;
      const travellers = [...scene.querySelectorAll('.uga-march-walker')].map(walker => {
        const sprite = walker.firstElementChild;
        const animations = walker.getAnimations({ subtree: true });
        const travel = animations.find(a => a.animationName === 'uga-march-travel');
        const duration = travel.effect.getTiming().duration;
        const pose = animations.find(a => a.animationName === 'uga-march-pose').effect.getTiming().duration;
        for (const animation of animations) animation.effect.updateTiming({ delay: 0 });
        const states = [0, pose / 2, duration / 2, duration / 2 + pose / 2, duration].map(time => {
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = time + 1;
          }
          const bounds = sprite.getBoundingClientRect();
          return { x: bounds.left, inside: inside(bounds), pose: getComputedStyle(sprite).backgroundPosition, facing: getComputedStyle(sprite).transform };
        });
        return states;
      });
      const title = document.querySelector('.education-uga h3').getBoundingClientRect();
      const date = document.querySelector('.education-uga .resume-date').getBoundingClientRect();
      const copy = document.querySelector('.uga-heading').nextElementSibling.getBoundingClientRect();
      const titleBlock = document.querySelector('.uga-heading > div').getBoundingClientRect();
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const mobileTitleRow = innerWidth > 767 || (Math.abs(title.top - date.top) < 4 && title.height < 36);
      return { travellers, clearText: ![titleBlock, copy, date].some(rect => overlaps(lane, rect)), mobileTitleRow, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(result.overflow, false, `page overflows at ${width}px`);
    for (const states of result.travellers) {
      assert(states.every(state => state.inside), `traveller leaves scene at ${width}px`);
      assert(states[1].x > states[0].x, 'outbound step moves right');
      assert(states[1].x - states[0].x <= 12, 'stride stays small at every viewport');
      assert(states[3].x < states[2].x, 'return step moves left');
      assert(Math.abs(states[4].x - states[0].x) < 1, 'loop returns to start');
      assert.notEqual(states[0].pose, states[1].pose, 'advance switches feet');
      assert.notEqual(states[0].facing, states[2].facing, 'turn at far end');
    }
    assert(result.clearText, 'march lane must not overlap the title, date, or paragraph');
    assert(result.mobileTitleRow, 'mobile year shares one row with the school title');
  }

  await page.reload({ waitUntil: 'networkidle0' });
  await page.$eval('.uga-march-track', el => el.scrollIntoView({ block: 'center' }));
  const allPaused = () => page.$eval('.uga-march-track', el => el.getAnimations({ subtree: true }).every(a => a.playState === 'paused'));
  const allRunning = () => page.$eval('.uga-march-track', el => el.getAnimations({ subtree: true }).every(a => a.playState === 'running'));
  const sceneVisibility = () => page.$eval('.uga-march-track', el => getComputedStyle(el).visibility);
  await page.waitForFunction(() => document.querySelector('.uga-march-track').getAnimations({ subtree: true }).every(a => a.playState === 'running'));
  assert.equal(await page.$('.uga-march-pause'), null, 'no separate mascot control');
  await page.click('#bgc-play');
  assert(await allPaused());
  assert.equal(await page.evaluate(() => window.FIELD.isPlaying()), false);
  await page.click('#bgc-visible');
  assert.equal(await sceneVisibility(), 'hidden');
  assert(await allPaused());
  await page.waitForFunction(() => !window.FIELD.isVisible());
  await page.click('#bgc-visible');
  assert.equal(await sceneVisibility(), 'visible');
  assert(await allPaused(), 'showing a paused drummer must not resume it');
  await page.click('#bgc-play');
  assert(await allRunning());
  await page.click('#bgc-visible');
  await page.waitForFunction(() => !window.FIELD.isVisible());
  assert.equal(await sceneVisibility(), 'hidden');
  assert(await allPaused());
  await page.click('#bgc-play');
  assert(await allPaused(), 'pause while hidden retains pause intent');
  await page.click('#bgc-play');
  assert(await allRunning(), 'play while hidden resumes both animations');
  assert.equal(await sceneVisibility(), 'visible');
  assert.equal(await page.evaluate(() => window.FIELD.isVisible()), true);
  assert.equal(await page.$eval('#bgc-visible', el => el.getAttribute('aria-label')), 'Hide animations');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('.uga-march-track').getAnimations({ subtree: true }).every(a => a.playState === 'paused'));
  await page.$eval('.uga-march-track', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('.uga-march-track').getAnimations({ subtree: true }).every(a => a.playState === 'running'));

  // Simulate document visibility to check the same handler used when changing tabs.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.$eval('.uga-march-track', el => el.getAnimations({ subtree: true }).every(a => a.playState === 'paused')), true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('.uga-march-track', el => el.getAnimations({ subtree: true }).length), 0);
  await page.click('#bgc-visible');
  assert.equal(await sceneVisibility(), 'hidden', 'hide still works with reduced motion');
  await page.click('#bgc-visible');
  assert.equal(await sceneVisibility(), 'visible');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.$eval('.uga-march-track', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  assert.equal(await page.$eval('.uga-march-track', el => el.getAnimations({ subtree: true }).length), 0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.waitForFunction(() => {
    const animations = document.querySelector('.uga-march-track').getAnimations({ subtree: true });
    return animations.length === 3 && animations.every(a => a.playState === 'running');
  });
  console.log('✓ UGA drummer: asset, eleven viewport sizes, mobile title/year, gait, shared pause/hide, offscreen/hidden, reduced motion');
} finally {
  await browser.close();
}
