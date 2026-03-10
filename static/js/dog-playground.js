/* =============================================================
   Dog Playground — Interactive embed controller
   Manages play/close, iframe lifecycle, and fullscreen takeover.
   ============================================================= */

(function () {
  "use strict";

  var preview = document.querySelector(".dp-preview");
  if (!preview) return; // not on a dog-playground page

  var overlay = document.getElementById("dp-overlay");
  var backdrop = overlay && overlay.querySelector(".dp-overlay__backdrop");
  var closeBtn = overlay && overlay.querySelector(".dp-overlay__close");
  var frame = overlay && overlay.querySelector(".dp-overlay__frame");
  var src = preview.dataset.src;
  if (!overlay || !frame || !src) return;

  var isOpen = false;

  /* ── Helpers ── */

  function getPreviewRect() {
    return preview.getBoundingClientRect();
  }

  function setFrameRect(rect) {
    frame.style.top = rect.top + "px";
    frame.style.left = rect.left + "px";
    frame.style.width = rect.width + "px";
    frame.style.height = rect.height + "px";
  }

  function lockScroll() {
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.body.style.overflow = "";
  }

  /* ── Open: play button clicked ── */

  function open() {
    if (isOpen) return;
    isOpen = true;

    var rect = getPreviewRect();

    // Position iframe exactly over the preview
    setFrameRect(rect);

    // Load the iframe src (lazy — only on first open)
    if (!frame.src || frame.src === "about:blank") {
      frame.src = src;
    }

    // Show the overlay container
    overlay.classList.add("is-active");

    // Force layout before expanding
    void overlay.offsetHeight;

    // Expand to fullscreen
    requestAnimationFrame(function () {
      frame.style.top = "0";
      frame.style.left = "0";
      frame.style.width = "100vw";
      frame.style.height = "100vh";
      overlay.classList.add("is-expanded");
    });

    lockScroll();
  }

  /* ── Close: close button clicked ── */

  function close() {
    if (!isOpen) return;

    // Animate back to the preview rect
    var rect = getPreviewRect();
    overlay.classList.remove("is-expanded");

    setFrameRect(rect);

    // Wait for transition, then tear down
    var onEnd = function () {
      frame.removeEventListener("transitionend", onEnd);
      overlay.classList.remove("is-active");
      // Unload iframe to free resources
      frame.src = "about:blank";
      unlockScroll();
      isOpen = false;
    };

    frame.addEventListener("transitionend", onEnd);

    // Fallback timeout if transitionend doesn't fire
    setTimeout(function () {
      if (isOpen) {
        onEnd();
      }
    }, 600);
  }

  /* ── Event bindings ── */

  preview.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  // Escape key closes the overlay
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  });
})();
