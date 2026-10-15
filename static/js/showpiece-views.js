/* =============================================================
   Showpiece views — the lead tile's poster is the centre of a
   grid of real renders, each from a slightly different camera
   angle (scripts/capture-teightysix-views.mjs). Under the pointer
   the tile steps to the nearest view with a short crossfade, so the pile
   slides behind the card and the card tips toward you. On a
   phone the device's tilt drives it, or a slow drift where the
   browser will not report tilt without a permission prompt.

   The poster stays underneath the whole time: nothing changes
   until every view has decoded, and reduced motion or Save-Data
   never loads the grid at all.
   ============================================================= */

(function () {
  "use strict";

  var media = document.querySelector(".exp-showpiece__media[data-views]");
  if (!media || !window.IntersectionObserver) return;

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData) return;

  var urls = media.getAttribute("data-views").split(/\s+/);
  var cols = +media.getAttribute("data-views-cols");
  var rows = +media.getAttribute("data-views-rows");
  if (urls.length !== cols * rows) return;

  var hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var frames = [];
  var canvas, ctx;
  var inView = false;
  // Where we are and where we are heading, both 0..1 across the grid.
  var cur = { u: 0.5, v: 0.5 };
  var target = { u: 0.5, v: 0.5 };
  var raf = 0;
  var driftT0 = 0;
  var tiltBase = null;
  var tiltLive = false;

  function load() {
    return Promise.all(urls.map(function (src) {
      var img = new Image();
      img.decoding = "async";
      img.src = src;
      return (img.decode ? img.decode() : new Promise(function (ok, bad) {
        img.onload = ok;
        img.onerror = bad;
      })).then(function () { return img; });
    }));
  }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(media.clientWidth * dpr);
    var h = Math.round(media.clientHeight * dpr);
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    shown = -1; // a resize clears the canvas; repaint without a fade
    draw();
  }

  // object-fit: cover, the same crop the poster <img> gets.
  function cover(c, img, alpha) {
    var s = Math.max(c.canvas.width / img.naturalWidth, c.canvas.height / img.naturalHeight);
    var w = img.naturalWidth * s;
    var h = img.naturalHeight * s;
    c.globalAlpha = alpha;
    c.drawImage(img, (c.canvas.width - w) / 2, (c.canvas.height - h) / 2, w, h);
  }

  // Always a real frame, never a mix of two at rest: blending neighbours
  // doubled every card in the pile. When the nearest view changes, the new
  // one fades in over the last for FADE_MS, which reads as motion.
  var FADE_MS = 140;
  var shown = -1;
  var prev = -1;
  var fadeT0 = 0;

  function nearest() {
    var c = Math.round(cur.u * (cols - 1));
    var r = Math.round(cur.v * (rows - 1));
    return r * cols + c;
  }

  // Returns true while a crossfade is still running.
  function draw(t) {
    t = t || performance.now();
    var want = nearest();
    if (want !== shown) {
      prev = shown < 0 ? want : shown;
      shown = want;
      fadeT0 = t;
    }
    var k = Math.min(1, (t - fadeT0) / FADE_MS);
    if (k < 1) cover(ctx, frames[prev], 1);
    cover(ctx, frames[shown], k < 1 ? k : 1);
    return k < 1;
  }

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  function tick(t) {
    raf = 0;
    if (!hover && !tiltLive) {
      // The drift: a slow figure-of-eight around the centre, never to the edges.
      if (!driftT0) driftT0 = t;
      var s = (t - driftT0) / 1000;
      target.u = 0.5 + 0.38 * Math.sin(s * 0.55);
      target.v = 0.5 + 0.3 * Math.sin(s * 1.1);
    }
    var du = target.u - cur.u;
    var dv = target.v - cur.v;
    cur.u += du * 0.12;
    cur.v += dv * 0.12;
    var fading = draw(t);
    var moving = fading || Math.abs(du) > 0.001 || Math.abs(dv) > 0.001;
    if (inView && (moving || !hover)) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (!raf && canvas && inView) raf = requestAnimationFrame(tick);
  }

  function onPointer(e) {
    var r = media.getBoundingClientRect();
    target.u = clamp01((e.clientX - r.left) / r.width);
    target.v = clamp01((e.clientY - r.top) / r.height);
    wake();
  }

  function onLeave() {
    target.u = target.v = 0.5;
    wake();
  }

  // Tilt relative to however the phone was held when the first reading came
  // in, so a phone held upright starts at the centre view. About 20 degrees
  // of tilt crosses the grid.
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    if (!tiltBase) tiltBase = { g: e.gamma, b: e.beta };
    tiltLive = true;
    target.u = clamp01(0.5 + (e.gamma - tiltBase.g) / 40);
    target.v = clamp01(0.5 + (e.beta - tiltBase.b) / 40);
    wake();
  }

  function start(imgs) {
    frames = imgs;
    canvas = document.createElement("canvas");
    canvas.className = "exp-showpiece__views";
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");
    media.appendChild(canvas);
    size();
    // Fade in over the poster only once the first draw is on the canvas.
    requestAnimationFrame(function () { canvas.classList.add("is-ready"); });
    if (window.ResizeObserver) new ResizeObserver(size).observe(media);
    else window.addEventListener("resize", size);
    if (hover) {
      media.addEventListener("pointermove", onPointer);
      media.addEventListener("pointerleave", onLeave);
    } else if (window.DeviceOrientationEvent &&
               typeof DeviceOrientationEvent.requestPermission !== "function") {
      // iOS asks permission for this; elsewhere it simply arrives, or never
      // does on a device without the sensor, and the drift carries on.
      window.addEventListener("deviceorientation", onTilt);
    }
    wake();
  }

  var started = false;
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView && !started) {
      started = true;
      load().then(start, function () { /* the poster stays; nothing to undo */ });
    }
    wake();
  }, { rootMargin: "200px 0px" }).observe(media);
})();
