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

  function boot(tile) {
    if (tile.classList.contains("is-live")) return;
    var slot = tile.querySelector(".exp-tile__slot");
    if (!slot) return;
    var frame = document.createElement("iframe");
    frame.setAttribute("title", tile.getAttribute("aria-label") || "Experiment");
    frame.setAttribute("loading", "lazy");
    frame.src = tile.dataset.liveSrc;
    slot.appendChild(frame);
    tile.classList.add("is-live");
  }

  function unboot(tile) {
    if (!tile.classList.contains("is-live")) return;
    var slot = tile.querySelector(".exp-tile__slot");
    if (slot) slot.innerHTML = "";
    tile.classList.remove("is-live");
  }

  tiles.forEach(function (tile) {
    if (!reduce) {
      tile.addEventListener("mouseenter", function () { boot(tile); });
      tile.addEventListener("focus", function () { boot(tile); });
      tile.addEventListener("touchstart", function () { boot(tile); }, { passive: true });
    } else {
      // Reduced motion: only an explicit click boots the inline toy.
      tile.addEventListener("click", function (e) {
        if (e.target.closest(".exp-tile__expand")) return; // expand = fullscreen
        boot(tile);
      });
    }
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) unboot(entry.target);
      });
    }, { rootMargin: "100px" });
    tiles.forEach(function (tile) { io.observe(tile); });
  }
})();
