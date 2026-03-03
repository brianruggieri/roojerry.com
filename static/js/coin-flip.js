// Coin Flip + Generative Identity System Integration
// (wired to real DOM structure in nav.html)

const coin = document.getElementById("profileCoin");
const mobileCoin = document.getElementById("mobileCoin");
const frontFace = coin?.querySelector(".coin-front");
const backFace  = coin?.querySelector(".coin-back");

let flipping = false;
let showingReal = true; // front = real, back = generative

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function flipCoin() {
  if (!coin || flipping) return;
  flipping = true;

  // Trigger CSS flip animation (sync both coins)
  coin.classList.toggle("flipped");
  mobileCoin?.classList.toggle("flipped");
  showingReal = !showingReal;

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
  el?.addEventListener("touchend", () => {
    clearTimeout(pressTimer);
  });
});
