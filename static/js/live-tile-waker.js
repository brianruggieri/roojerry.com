/* =============================================================
   Live-tile waker — boots a lightweight toy inline inside a
   grid tile on first interaction, and unloads it when the tile
   scrolls out of view. Heavy toys use interactive-embed instead.
   ============================================================= */

(function () {
  "use strict";

  var tiles = document.querySelectorAll(".exp-tile--live[data-live-src]");
  if (!tiles.length) return;

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The toys size their voxel grid by pixel, so a tile-sized viewport yields a
  // few huge cells. Boot the iframe at a fullscreen-sized viewport and scale it
  // down to the tile, so the inline preview matches the fullscreen composition.
  var BASE_W = 1440;

  function fitFrame(slot) {
    var frame = slot.querySelector("iframe");
    if (!frame) return;
    var w = slot.clientWidth;
    if (!w) return;
    frame.style.transform = "scale(" + (w / BASE_W) + ")";
  }

  function unboot(tile) {
    if (!tile.classList.contains("is-live")) return;
    var slot = tile.querySelector(".exp-tile__slot");
    if (slot) slot.innerHTML = ""; // drop the iframe → stops its requestAnimationFrame loop
    tile.classList.remove("is-live");
  }

  // Only ever run ONE inline preview at a time — a voxel toy renders a full
  // 1440×900 canvas every frame, so concurrent previews are the main CPU sink.
  function bootOnly(tile) {
    tiles.forEach(function (t) { if (t !== tile) unboot(t); });
    if (tile.classList.contains("is-live")) return;
    var slot = tile.querySelector(".exp-tile__slot");
    if (!slot) return;
    var frame = document.createElement("iframe");
    frame.setAttribute("title", tile.getAttribute("aria-label") || "Experiment");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.src = tile.dataset.liveSrc;
    slot.appendChild(frame);
    tile.classList.add("is-live");
    fitFrame(slot);
  }

  // Unload shortly after the pointer/focus leaves, so a preview's RAF loop does
  // not keep burning CPU once you've moved on. Cancelled if you return.
  var leaveTimers = new WeakMap();
  function scheduleUnboot(tile) {
    cancelUnboot(tile);
    leaveTimers.set(tile, setTimeout(function () { unboot(tile); }, 400));
  }
  function cancelUnboot(tile) {
    var t = leaveTimers.get(tile);
    if (t) { clearTimeout(t); leaveTimers.delete(tile); }
  }

  tiles.forEach(function (tile) {
    if (!reduce) {
      tile.addEventListener("mouseenter", function () { cancelUnboot(tile); bootOnly(tile); });
      tile.addEventListener("mouseleave", function () { scheduleUnboot(tile); });
      tile.addEventListener("focus", function () { cancelUnboot(tile); bootOnly(tile); });
      tile.addEventListener("blur", function () { scheduleUnboot(tile); });
      tile.addEventListener("touchstart", function () { bootOnly(tile); }, { passive: true });
    } else {
      // Reduced motion: only an explicit click boots the inline toy.
      tile.addEventListener("click", function (e) {
        if (e.target.closest(".exp-tile__expand")) return; // expand = fullscreen
        bootOnly(tile);
      });
    }
    // Keyboard activation: Enter/Space boot inline regardless of reduce preference.
    tile.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        bootOnly(tile);
      }
    });
    // Opening fullscreen takes over with its own iframe — free the inline RAF.
    var expand = tile.querySelector(".exp-tile__expand");
    if (expand) expand.addEventListener("click", function () { unboot(tile); });
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) unboot(entry.target);
      });
    }, { rootMargin: "100px" });
    tiles.forEach(function (tile) { io.observe(tile); });
  }

  // Keep booted previews scaled correctly as the grid reflows.
  window.addEventListener("resize", function () {
    tiles.forEach(function (tile) {
      if (tile.classList.contains("is-live")) {
        var slot = tile.querySelector(".exp-tile__slot");
        if (slot) fitFrame(slot);
      }
    });
  });
})();
