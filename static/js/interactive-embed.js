/* =============================================================
   Interactive Embed — Reusable fullscreen takeover controller
   Manages play/close, iframe lifecycle, fullscreen takeover,
   and hides site chrome (nav, background controls, etc.)
   when the interactive is active.

   Any project with an `interactive` front-matter param gets
   this behavior automatically.
   ============================================================= */

(function () {
  "use strict";

  var previews = document.querySelectorAll(".ie-preview");
  if (!previews.length) return; // no interactive triggers on this page

  var overlay = document.getElementById("ie-overlay");
  var backdrop = overlay && overlay.querySelector(".ie-overlay__backdrop");
  var closeBtn = overlay && overlay.querySelector(".ie-overlay__close");
  var frame = overlay && overlay.querySelector(".ie-overlay__frame");
  var src;
  if (!overlay || !frame) return;

  var isOpen = false;
  var activeOrigin = null;

  /* ── Helpers ── */

  function getPreviewRect() {
    return (activeOrigin || previews[0]).getBoundingClientRect();
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

  function open(trigger) {
    if (isOpen) return;
    isOpen = true;

    activeOrigin = trigger.closest("[data-ie-origin]") || trigger;
    src = trigger.dataset.src;

    var rect = getPreviewRect();

    // Position iframe exactly over the preview
    setFrameRect(rect);

    // Load the iframe src (lazy — only on first open)
    if (!frame.src || frame.src === "about:blank") {
      frame.src = src;
    }

    // Show the overlay container
    overlay.classList.add("is-active");

    // Hide site chrome (nav, bg controls, field controls, etc.)
    document.body.classList.add("ie-fullscreen-active");

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

    // Restore site chrome
    document.body.classList.remove("ie-fullscreen-active");

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

    // Fallback timeout if transitionend doesn't fire (matches slowest CSS transition)
    setTimeout(function () {
      if (isOpen) {
        onEnd();
      }
    }, 1000);
  }

  /* ── Event bindings ── */

  previews.forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(el);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(el);
      }
    });
  });

  closeBtn.addEventListener("click", close);

  // Escape key closes the overlay
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  });
})();
