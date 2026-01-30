(() => {
  const canvas = document.getElementById("bg-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w, h, dpr;
  let points = [];
//   let scrollRatio = 0;
  let lastScrollY = window.scrollY;
let scrollVelocity = 0;
let scrollForce = 0;

  let mx = 0.5, my = 0.5;
  let t = 0;

  const CONFIG = {
    POINTS: Math.min(160, Math.floor(window.innerWidth * 0.12)),
    LINK_DIST: 140,
    SPEED: 0.25,
    PARALLAX: 40,
    DEPTH: 1.5,
    BASE_ALPHA: 0.75,
    LINE_ALPHA: 0.45,
    NODE_SIZE: 1.2
  };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createPoints() {
    points = [];
    for (let i = 0; i < CONFIG.POINTS; i++) {
      points.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),          // depth
        vx: rand(-1, 1) * 0.3,
        vy: rand(-1, 1) * 0.3,
        energy: Math.random()
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    t += 0.002;

    // Soft fade
    ctx.fillStyle = "rgba(5,10,20,0.08)";
    ctx.fillRect(0, 0, w, h);

    // Smooth scroll force (inertia)
scrollForce += scrollVelocity * 0.002;
scrollForce *= 0.9; // damping

    // Move points
    for (let p of points) {
      // Flow motion
      p.x += p.vx * CONFIG.SPEED;
      p.y += p.vy * CONFIG.SPEED;

      // Parallax
      p.x += (mx - 0.5) * p.z * 0.2;
      p.y += (my - 0.5) * p.z * 0.2;

      // Scroll parallax (bidirectional)
        p.y -= scrollForce * p.z * 20;

      // Wrap
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
    }

    // Connections
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.LINK_DIST) {
          const alpha = (1 - dist / CONFIG.LINK_DIST) * CONFIG.LINE_ALPHA;
          ctx.strokeStyle = `rgba(120,180,255,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (let p of points) {
      const size = CONFIG.NODE_SIZE + p.z * CONFIG.DEPTH;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,210,255,${CONFIG.BASE_ALPHA + p.z * 0.2})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  // Interaction
  window.addEventListener("mousemove", e => {
    mx = e.clientX / w;
    my = e.clientY / h;
  });

window.addEventListener("scroll", () => {
  const currentScroll = window.scrollY;
  scrollVelocity = currentScroll - lastScrollY;   // + down, - up
  lastScrollY = currentScroll;
});

  window.addEventListener("resize", () => {
    resize();
    createPoints();
  });

  // Init
  resize();
  createPoints();
  draw();
})();
