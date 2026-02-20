// Coin Flip + Generative Identity System Integration
// (wired to real DOM structure in nav.html)

const coin = document.getElementById("profileCoin");
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

  // Trigger CSS flip animation
  coin.classList.toggle("flipped");
  showingReal = !showingReal;

  // Environment sync
  if (window.FIELD) {
    FIELD.energy   = randomRange(0.2, 0.5);
    FIELD.spectrum = randomRange(0.2, 0.8);
    FIELD.clusters = randomRange(0.2, 0.8);
  }

  // Unlock after animation
  setTimeout(() => {
    flipping = false;
  }, 600); // must match CSS transition duration
}

// Click handler (count only real clicks; auto-flips don't increment)
let coinClickCounter = 0;
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

if (coin) {
  coin.addEventListener("click", onCoinClick);
}

// Auto-flip every 3-8 seconds
function scheduleAutoFlip() {
  const delay = randomRange(3000, 8000);
  setTimeout(() => {
    flipCoin();
    scheduleAutoFlip(); // Schedule next flip
  }, delay);
}

// Start auto-flip on page load
scheduleAutoFlip();

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
let pressTimer = null;
coin?.addEventListener("touchstart", () => {
  pressTimer = setTimeout(() => {
    flipCoin();
  }, 500);
});
coin?.addEventListener("touchend", () => {
  clearTimeout(pressTimer);
});
