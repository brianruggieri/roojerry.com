// Coin Flip — every reveal shows a different face
//
// The two faces have no fixed identity: both draw from one pool of images
// discovered at build time, photographs and illustrations alike. The face that
// is hidden by a flip is immediately reassigned, so the next flip always turns
// up something the viewer has not just seen.

const coin = document.getElementById("profileCoin");
const mobileCoin = document.getElementById("mobileCoin");
const frontFace = coin?.querySelector(".coin-front");
const backFace  = coin?.querySelector(".coin-back");
const mobileFrontFace = mobileCoin?.querySelector(".coin-front");
const mobileBackFace  = mobileCoin?.querySelector(".coin-back");

let flipping = false;
let showingFront = true;

const coinImages = JSON.parse(coin?.dataset?.coinImages || '[]');
// What each face currently wears, so a swap can avoid repeating the other one.
let faceImages = { front: null, back: null };

if (coinImages.length < 2) {
  console.warn('[coin-flip] fewer than 2 coin-face images — repeats are unavoidable.');
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Pick a random image, avoiding any the caller says are already on screen.
 */
function pickRandomImage(...exclude) {
  const taken = exclude.filter(Boolean);
  const pool = coinImages.filter(p => !taken.includes(p));
  const from = pool.length ? pool : coinImages;
  if (!from.length) return null;
  return from[Math.floor(Math.random() * from.length)];
}

/**
 * Update a coin face's background-image with WebP + fallback via image-set().
 */
function setFaceImage(face, imgPath) {
  if (!face || !imgPath) return;
  const webpPath = imgPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const mimeType = /\.jpe?g$/i.test(imgPath) ? 'image/jpeg' : 'image/png';
  face.style.backgroundImage =
    `image-set(url('${webpPath}') type('image/webp'), url('${imgPath}') type('${mimeType}'))`;
}

/** Put an image on one logical face, across both the desktop and mobile coins. */
function dressFace(which, imgPath) {
  if (!imgPath) return;
  faceImages[which] = imgPath;
  if (which === "front") {
    setFaceImage(frontFace, imgPath);
    setFaceImage(mobileFrontFace, imgPath);
  } else {
    setFaceImage(backFace, imgPath);
    setFaceImage(mobileBackFace, imgPath);
  }
}

// Randomise both faces on load, so a reload is not the same coin twice.
if (coinImages.length > 0) {
  dressFace("front", pickRandomImage());
  dressFace("back", pickRandomImage(faceImages.front));
}

function flipCoin() {
  if (!coin || flipping) return;
  flipping = true;

  // Trigger CSS flip animation (sync both coins)
  coin.classList.toggle("flipped");
  mobileCoin?.classList.toggle("flipped");
  showingFront = !showingFront;

  // Environment sync
  if (window.FIELD) {
    FIELD.energy   = randomRange(0.2, 0.5);
    FIELD.spectrum = randomRange(0.2, 0.8);
    FIELD.clusters = randomRange(0.2, 0.8);
  }

  // Unlock after animation; instant when transition is disabled by reduced motion
  const lockDuration = (window.FIELD && window.FIELD.prefersReducedMotion()) ? 0 : 600;
  setTimeout(() => {
    flipping = false;

    // Reassign whichever face just went out of view. Swapping it while hidden
    // means the change is never visible mid-flip, and the next flip reveals an
    // image that is neither the one on screen nor the one just seen.
    if (coinImages.length > 1) {
      const hidden = showingFront ? "back" : "front";
      const visible = showingFront ? "front" : "back";
      dressFace(hidden, pickRandomImage(faceImages[visible], faceImages[hidden]));
    }
  }, lockDuration);
}

// Click handler (count only real clicks; auto-flips don't increment)
// Ignore the synthetic click that follows a long-press on touch devices.
let coinClickCounter = 0;
function onCoinClick(e) {
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  coinClickCounter++;
  flipCoin();

  if (coinClickCounter === 10) {
    ACHIEVEMENTS.unlock('coin_clicker');
  }
  if (coinClickCounter === 50) {
    ACHIEVEMENTS.unlock('coin_clicker_50');
  }
}

if (coin) {
  coin.addEventListener("click", onCoinClick);
}
if (mobileCoin) {
  mobileCoin.addEventListener("click", onCoinClick);
}

// Auto-flip every 3-8 seconds
function scheduleAutoFlip() {
  const delay = randomRange(3000, 8000);
  setTimeout(() => {
    flipCoin();
    scheduleAutoFlip(); // Schedule next flip
  }, delay);
}

// Start auto-flip on page load — skip when reduced motion is preferred
if (!(window.FIELD && window.FIELD.prefersReducedMotion())) {
  scheduleAutoFlip();
}

/* =========================
   Optional UX Enhancements
========================= */

// Spacebar easter egg
window.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    flipCoin();
  }
});

// Hover pulse
coin?.addEventListener("mouseenter", () => {
  if (window.FIELD) {
    FIELD.energy = randomRange(0.25, 0.45);
  }
});

// Mobile long-press
// A flag is set when the long-press timeout fires so that the synthetic
// click event that touch devices generate on touchend is ignored.
let pressTimer = null;
let longPressTriggered = false;
[coin, mobileCoin].forEach(el => {
  el?.addEventListener("touchstart", () => {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      flipCoin();
    }, 500);
  });
  el?.addEventListener("touchend", () => { clearTimeout(pressTimer); });
  el?.addEventListener("touchcancel", () => { clearTimeout(pressTimer); });
  el?.addEventListener("touchmove", () => { clearTimeout(pressTimer); });
});
