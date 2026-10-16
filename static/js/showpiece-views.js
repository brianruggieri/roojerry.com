/* =============================================================
   Showpiece views — the lead tile's poster is the centre of a
   grid of real renders, each from a slightly different camera
   angle (the teightysix capture suite). Under the pointer the
   tile blends continuously between the four views around it, so
   the pile slides behind the card and the card tips toward you.
   On a phone the device's tilt drives it, or a slow drift where
   the browser will not report tilt without a permission prompt.

   Frames arrive in two tiers. Every other column and row comes
   first, which is enough to move; a hover-capable device then
   fills in the rest, and the blend steps get finer. The steps
   are under a degree once the grid is full, which is what keeps
   the blend from doubling the cards in the pile.

   The poster stays underneath the whole time: nothing changes
   until the first tier has decoded, and reduced motion or
   Save-Data never loads a frame.
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
  // The moving region, in poster pixels: x y w h, then the poster's w h.
  var geo = (media.getAttribute("data-views-crop") || "").split(/\s+/).map(Number);
  if (urls.length !== cols * rows || geo.length !== 6) return;
  var crop = { x: geo[0], y: geo[1], w: geo[2], h: geo[3] };
  var posterW = geo[4];
  var posterH = geo[5];

  var hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var frames = new Array(urls.length);
  // The column and row indices whose frames are all loaded, ascending.
  var haveCols = [];
  var haveRows = [];
  var canvas, ctx, buf, bctx;
  var inView = false;
  // Where we are and where we are heading, both 0..1 across the grid.
  var cur = { u: 0.5, v: 0.5 };
  var target = { u: 0.5, v: 0.5 };
  var raf = 0;
  var lastT = 0;
  var driftT0 = 0;
  var tiltBase = null;
  var tiltLive = false;
  var EASE_MS = 110; // time constant of the chase toward the pointer

  function evens(n) {
    var out = [];
    for (var i = 0; i < n; i += 2) out.push(i);
    if (out[out.length - 1] !== n - 1) out.push(n - 1);
    return out;
  }
  function all(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    return out;
  }

  function load(rs, cs) {
    var jobs = [];
    rs.forEach(function (r) {
      cs.forEach(function (c) {
        var k = r * cols + c;
        if (frames[k]) return;
        var img = new Image();
        img.decoding = "async";
        img.src = urls[k];
        jobs.push((img.decode ? img.decode() : new Promise(function (ok, bad) {
          img.onload = ok;
          img.onerror = bad;
        })).then(function () { frames[k] = img; }));
      });
    });
    return Promise.all(jobs).then(function () {
      haveRows = rs;
      haveCols = cs;
    });
  }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(media.clientWidth * dpr);
    var h = Math.round(media.clientHeight * dpr);
    if (!w || !h) return;
    canvas.width = buf.width = w;
    canvas.height = buf.height = h;
    draw();
  }

  // The crop's rectangle on the canvas, under the poster's object-fit: cover.
  function rect() {
    var s = Math.max(canvas.width / posterW, canvas.height / posterH);
    var ox = (canvas.width - posterW * s) / 2;
    var oy = (canvas.height - posterH * s) / 2;
    return { x: ox + crop.x * s, y: oy + crop.y * s, w: crop.w * s, h: crop.h * s };
  }

  // The two loaded indices either side of p (0..n-1) and how far between.
  function bracket(have, p) {
    var i = 0;
    while (i < have.length - 2 && have[i + 1] <= p) i++;
    var a = have[i];
    var b = have[i + 1];
    return { a: a, b: b, f: Math.min(1, Math.max(0, (p - a) / (b - a))) };
  }

  // Bilinear across the four views around (u, v): each row's pair is a
  // crossfade, then the lower row crossfades over the upper.
  function draw() {
    var x = bracket(haveCols, cur.u * (cols - 1));
    var y = bracket(haveRows, cur.v * (rows - 1));
    var r = rect();
    function put(c, img, alpha) {
      c.globalAlpha = alpha;
      c.drawImage(img, r.x, r.y, r.w, r.h);
    }
    put(ctx, frames[y.a * cols + x.a], 1);
    if (x.f > 0.002) put(ctx, frames[y.a * cols + x.b], x.f);
    if (y.f > 0.002) {
      bctx.clearRect(0, 0, buf.width, buf.height);
      put(bctx, frames[y.b * cols + x.a], 1);
      if (x.f > 0.002) put(bctx, frames[y.b * cols + x.b], x.f);
      ctx.globalAlpha = y.f;
      ctx.drawImage(buf, 0, 0);
    }
  }

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  function tick(t) {
    raf = 0;
    var dt = lastT ? Math.min(t - lastT, 100) : 16;
    lastT = t;
    if (!hover && !tiltLive) {
      // The drift: a slow figure-of-eight around the centre, never to the edges.
      if (!driftT0) driftT0 = t;
      var s = (t - driftT0) / 1000;
      target.u = 0.5 + 0.38 * Math.sin(s * 0.5);
      target.v = 0.5 + 0.3 * Math.sin(s * 1.0);
    }
    var k = 1 - Math.exp(-dt / EASE_MS);
    var du = target.u - cur.u;
    var dv = target.v - cur.v;
    cur.u += du * k;
    cur.v += dv * k;
    draw();
    var moving = Math.abs(du) > 0.0005 || Math.abs(dv) > 0.0005;
    if (inView && (moving || (!hover && !tiltLive))) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }

  function wake() {
    if (!raf && canvas && inView) raf = requestAnimationFrame(tick);
  }

  var filling = false;
  function fill() {
    if (filling) return;
    filling = true;
    load(all(rows), all(cols)).then(settle, function () { /* the coarse tier carries on */ });
  }

  // Blending only reads as motion while the picture moves; at rest a blend
  // is two renders on top of each other. So once the pointer stops, the
  // target eases onto the nearest loaded view, and what sits still is always
  // one real frame.
  var SETTLE_MS = 140;
  var settleTimer = 0;
  function nearestOf(have, p, n) {
    var best = have[0];
    for (var i = 1; i < have.length; i++) {
      if (Math.abs(have[i] - p * (n - 1)) < Math.abs(best - p * (n - 1))) best = have[i];
    }
    return best / (n - 1);
  }
  function settle() {
    target.u = nearestOf(haveCols, target.u, cols);
    target.v = nearestOf(haveRows, target.v, rows);
    wake();
  }

  function onPointer(e) {
    var r = media.getBoundingClientRect();
    target.u = clamp01((e.clientX - r.left) / r.width);
    target.v = clamp01((e.clientY - r.top) / r.height);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
    fill();
    wake();
  }

  function onLeave() {
    clearTimeout(settleTimer);
    target.u = target.v = 0.5;
    wake();
  }

  // Tilt relative to however the phone was held when the first reading came
  // in, so a phone held upright starts at the centre view. About 20 degrees
  // of tilt crosses the grid.
  //
  // The sensor reports many times a second even from a phone lying still, so
  // readings within TILT_JITTER of the last real move are ignored. Without
  // that the settle timer below would be reset forever, and a phone held
  // between two views would show both at once.
  var TILT_JITTER = 0.012;
  var tiltRaw = { u: 0.5, v: 0.5 };
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    if (!tiltBase) {
      // The first reading may arrive after the drift has moved the picture,
      // and it calibrates to the centre, which the jitter guard would then
      // swallow. Hand over explicitly: back to the centre view, settled.
      tiltBase = { g: e.gamma, b: e.beta };
      tiltLive = true;
      tiltRaw.u = target.u = 0.5;
      tiltRaw.v = target.v = 0.5;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SETTLE_MS);
      wake();
      return;
    }
    var u = clamp01(0.5 + (e.gamma - tiltBase.g) / 40);
    var v = clamp01(0.5 + (e.beta - tiltBase.b) / 40);
    if (Math.abs(u - tiltRaw.u) < TILT_JITTER && Math.abs(v - tiltRaw.v) < TILT_JITTER) return;
    tiltRaw.u = target.u = u;
    tiltRaw.v = target.v = v;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
    wake();
  }

  function start() {
    canvas = document.createElement("canvas");
    canvas.className = "exp-showpiece__views";
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");
    buf = document.createElement("canvas");
    bctx = buf.getContext("2d");
    media.appendChild(canvas);
    size();
    // Fade in over the poster only once the first draw is on the canvas.
    requestAnimationFrame(function () { canvas.classList.add("is-ready"); });
    if (window.ResizeObserver) new ResizeObserver(size).observe(media);
    else window.addEventListener("resize", size);
    if (hover) {
      media.addEventListener("pointerenter", fill);
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
      load(evens(rows), evens(cols)).then(start, function () { /* the poster stays */ });
    }
    wake();
  }, { rootMargin: "200px 0px" }).observe(media);
})();
