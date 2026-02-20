(() => {
  window.FIELD = window.FIELD || {};
  const canvas = document.getElementById("bg-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;
  let points = [];

  let active = (document.documentElement.dataset.bgMode || "canvas") === "canvas";
  let running = false;

  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;
  let scrollForce = 0;
  let scrollTimeout = null;

  let mx = 0.5, my = 0.5;
  let t = 0;

  // Mouse disturbance field state
  let mouseWorldX = 0;
  let mouseWorldY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let mouseVelocityX = 0;
  let mouseVelocityY = 0;
  let isMouseActive = false;
  let mouseInactivityTimeout = null;

  /* =========================
     CONFIGURATION
  ========================= */

  const CONFIG = {
    POINTS: Math.min(160, Math.floor(window.innerWidth * 0.12)),
    LINK_DIST: 140,
    SPEED: 0.25,
    DEPTH: 1.5,
    BASE_ALPHA: 0.7,
    LINE_ALPHA: 0.35,
    NODE_SIZE: 1.2
  };

  // Disturbance field config - exposed for real-time tweaking
  const DISTURBANCE = {
    RADIUS: 100,       // pixels; influence zone size
    STRENGTH: 35,      // base force magnitude
    BASE_FORCE_MULT: 0.10, // multiplier for base force
    SPEED_MIN: 0.5,    // speed factor minimum (at stillness)
    SPEED_MAX: 1.5,    // speed factor maximum (at fast movement)
    SPEED_MULT: 0.1,   // how much mouse speed affects the disturbance
    CONNECTION_RESISTANCE: 0.05, // how much each connection reduces force
    CONNECTION_MIN: 0.30 // minimum force even with many connections
  };

  // Expose to window for real-time tweaking
  window.DISTURBANCE_CONFIG = DISTURBANCE;

  /* =========================
     GLOBAL FIELD CONTROLS
     normalized 0–1
  ========================= */

  window.FIELD = window.FIELD || {};
  window.FIELD.energy = window.FIELD.energy ?? 0.35; // motion intensity (narrow range)
  window.FIELD.spectrum = window.FIELD.spectrum ?? 0.3; // mood selector
  window.FIELD.clusters = window.FIELD.clusters ?? 0.4; // structural separation
  window.FIELD.density = window.FIELD.density ?? CONFIG.POINTS;

  /* =========================
     COLOR MOODS
     Aligned with color palette
  ========================= */

  const MOODS = [
    { h: 200, s: 30, l: 60 }, // Light Cyan (8BBAC1)
    { h: 195, s: 45, l: 50 }, // Mid Cyan/Teal
    { h: 188, s: 35, l: 48 }, // Teal (3085A4)
    { h: 85, s: 60, l: 52 }   // Green (89C45A)
  ];

  /* =========================
     Helpers
  ========================= */

  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (c1, c2, t) => ({
    h: lerp(c1.h, c2.h, t),
    s: lerp(c1.s, c2.s, t),
    l: lerp(c1.l, c2.l, t)
  });
  const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

  /* =========================
     Canvas / Points
  ========================= */

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

  function createPoints() {
    points = new Array(window.FIELD.density);
    for (let i = 0; i < window.FIELD.density; i++) {
      points[i] = {
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        vx: rand(-1, 1) * 0.3,
        vy: rand(-1, 1) * 0.3,
        cluster: Math.floor(Math.random() * 6)
      };
    }
  }

  window.createPoints = createPoints;

  /* =========================
     Disturbance Field Physics
  ========================= */

  let disturbanceTestCount = 0;
  
  function countConnections(point) {
    // Count how many nearby particles this one is connected to
    let connectionCount = 0;
    const linkDist = CONFIG.LINK_DIST;
    
    for (let i = 0; i < points.length; i++) {
      const other = points[i];
      if (other === point) continue;
      
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < linkDist) {
        connectionCount++;
      }
    }
    return connectionCount;
  }

  function applyDisturbanceFromSource(point, sourceX, sourceY, intensity = 1.0) {
    // Apply disturbance from a specific point source (mouse or letter)
    const dx = point.x - sourceX;
    const dy = point.y - sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only apply force if within radius
    if (dist < DISTURBANCE.RADIUS) {
      if (dist < 0.1) {
        // Push away in random direction if exactly at source
        const angle = Math.random() * Math.PI * 2;
        point.x += Math.cos(angle) * 10 * intensity;
        point.y += Math.sin(angle) * 10 * intensity;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;

        // Linear falloff by distance
        const normalizedDist = dist / DISTURBANCE.RADIUS;
        const distanceFalloff = Math.max(0, 1 - normalizedDist);
        
        // Speed-based falloff: faster mouse = stronger disturbance
        const mouseSpeed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);
        const speedFactor = Math.min(DISTURBANCE.SPEED_MAX, DISTURBANCE.SPEED_MIN + mouseSpeed * DISTURBANCE.SPEED_MULT);
        
        // Connection-based reduction
        const connectionCount = countConnections(point);
        const connectionResistance = Math.max(DISTURBANCE.CONNECTION_MIN, 1 - connectionCount * DISTURBANCE.CONNECTION_RESISTANCE);
        
        // Calculate force
        const baseForce = DISTURBANCE.STRENGTH * DISTURBANCE.BASE_FORCE_MULT;
        const totalFalloff = distanceFalloff * speedFactor * connectionResistance * intensity;
        
        // DIRECT DISPLACEMENT
        const pushDistance = baseForce * totalFalloff * 0.6;
        point.x += nx * pushDistance;
        point.y += ny * pushDistance;
        
        // Momentum
        point.vx = nx * baseForce * totalFalloff * 1.2;
        point.vy = ny * baseForce * totalFalloff * 1.2;
      }
    }
  }

  function avoidLetterBounds(point) {
    // Check if particle is inside or near letter bounding boxes
    if (!window.LETTER_BOUNDS || window.LETTER_BOUNDS.length === 0) {
      return; // No letter bounds available yet
    }

    for (const bounds of window.LETTER_BOUNDS) {
      // Add padding around letter bounds for influence zone
      const padding = 8;
      const expandedBounds = {
        left: bounds.left - padding,
        right: bounds.right + padding,
        top: bounds.top - padding,
        bottom: bounds.bottom + padding
      };

      // Check if particle is in the expanded bounding box
      if (point.x > expandedBounds.left && point.x < expandedBounds.right &&
          point.y > expandedBounds.top && point.y < expandedBounds.bottom) {
        
        // Calculate nearest edge and push particle away
        const distLeft = point.x - expandedBounds.left;
        const distRight = expandedBounds.right - point.x;
        const distTop = point.y - expandedBounds.top;
        const distBottom = expandedBounds.bottom - point.y;

        // Find the closest edge
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        
        // Push away from nearest edge
        let pushX = 0, pushY = 0;
        const pushForce = 1.2;

        if (minDist === distLeft) {
          pushX = -pushForce; // Push left
        } else if (minDist === distRight) {
          pushX = pushForce; // Push right
        } else if (minDist === distTop) {
          pushY = -pushForce; // Push up
        } else if (minDist === distBottom) {
          pushY = pushForce; // Push down
        }

        // Apply push
        point.x += pushX;
        point.y += pushY;
        point.vx += pushX;
        point.vy += pushY;
      }
    }
  }

  // Generic element disturbance - applies to any element with bounding box
  function applyElementDisturbance(point) {
    // Query all elements marked for disturbance OR all resume items
    const disturbanceElements = document.querySelectorAll('[data-particle-disturbance]');
    
    if (disturbanceElements.length === 0) return;

    // Convert canvas-relative point to document-space coordinates
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const pointWorldX = point.x + scrollX;
    const pointWorldY = point.y + scrollY;

    for (const element of disturbanceElements) {
      const rect = element.getBoundingClientRect();
      
      // Get current scroll position
      const elemScrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const elemScrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Convert viewport-relative to world space (with scroll offset)
      const bounds = {
        left: rect.left + elemScrollX,
        right: rect.right + elemScrollX,
        top: rect.top + elemScrollY,
        bottom: rect.bottom + elemScrollY
      };

      // Get padding from data attribute or use defaults based on element type
      let padding = 8;
      let pushForce = 0.3;
      
      if (element.dataset.particleDisturbancePadding !== undefined) {
        padding = parseInt(element.dataset.particleDisturbancePadding, 10);
      } else if (element.classList.contains('resume-item')) {
        padding = 12;  // Slightly larger padding for resume items
      }
      
      if (element.dataset.particleDisturbanceForce !== undefined) {
        pushForce = parseFloat(element.dataset.particleDisturbanceForce);
      } else if (element.classList.contains('resume-item')) {
        pushForce = 0.25;  // Slightly gentler for resume items
      }

      const expandedBounds = {
        left: bounds.left - padding,
        right: bounds.right + padding,
        top: bounds.top - padding,
        bottom: bounds.bottom + padding
      };

      // Check if particle is near or inside the expanded bounding box
      if (pointWorldX > expandedBounds.left && pointWorldX < expandedBounds.right &&
          pointWorldY > expandedBounds.top && pointWorldY < expandedBounds.bottom) {
        
        // Calculate distance to each edge
        const distLeft = pointWorldX - expandedBounds.left;
        const distRight = expandedBounds.right - pointWorldX;
        const distTop = pointWorldY - expandedBounds.top;
        const distBottom = expandedBounds.bottom - pointWorldY;

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        
        // Determine push direction based on nearest edge
        let pushX = 0, pushY = 0;

        if (minDist === distLeft) {
          pushX = -pushForce;
        } else if (minDist === distRight) {
          pushX = pushForce;
        } else if (minDist === distTop) {
          pushY = -pushForce;
        } else if (minDist === distBottom) {
          pushY = pushForce;
        }

        // Apply push with bounce effect - particles bounce off the element
        point.x += pushX;
        point.y += pushY;
        // Bounce: preserve existing velocity direction but add repulsion
        // This creates a bouncy, scattered effect instead of clustering
        const bounceStrength = 0.8;  // How much the push contributes to bounce
        point.vx = point.vx * 0.92 + pushX * bounceStrength;
        point.vy = point.vy * 0.92 + pushY * bounceStrength;
      } else {
        // Particle is outside bounds - check if moving toward element and apply preventative force
        // Find closest point on element to particle
        const closestX = Math.max(expandedBounds.left, Math.min(pointWorldX, expandedBounds.right));
        const closestY = Math.max(expandedBounds.top, Math.min(pointWorldY, expandedBounds.bottom));
        
        const dx = closestX - pointWorldX;
        const dy = closestY - pointWorldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Only apply if particle is reasonably close (within influence radius)
        if (dist < 60 && dist > 0) {
          // Check if particle is moving toward element
          const velDotProduct = point.vx * dx + point.vy * dy;
          
          if (velDotProduct > 0) {
            // Particle is moving toward element - apply repulsive force
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Falloff: stronger when closer
            const distanceFalloff = Math.max(0, 1 - (dist / 60));
            const repelForce = pushForce * distanceFalloff * 0.35;  // Increased preventative force to keep particles further away
            
            // Apply repulsion to push particle away
            point.vx += -nx * repelForce;
            point.vy += -ny * repelForce;
          }
        }
      }
    }
  }
  
  function applyDisturbanceForce(point) {
    // Apply disturbance from page elements (always, independent of mouse)
    applyElementDisturbance(point);

    // Apply disturbance from mouse (only if mouse is active)
    if (!isMouseActive) return;
    applyDisturbanceFromSource(point, mouseWorldX, mouseWorldY, 1.0);
  }

  /* =========================
     Physics / Update
  ========================= */

  function updatePhysics(energy) {
    const speed = CONFIG.SPEED;
    const baseMx = mx - 0.5;
    const baseMy = my - 0.5;
    const sf = scrollForce; // local alias

    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      // Apply mouse disturbance field FIRST (before position updates)
      applyDisturbanceForce(p);

      // Base velocity
      p.x += p.vx * speed * energy;
      p.y += p.vy * speed * energy;

      // Mouse parallax (subtle)
      p.x += baseMx * p.z * (0.15 + energy * 0.25);
      p.y += baseMy * p.z * (0.15 + energy * 0.25);

      // Scroll parallax (controlled)
      p.y -= sf * p.z * (12 + energy * 25);
      p.x += sf * p.z * (2 + energy * 6);

      // Wrap edges
      if (p.x < 0) p.x = w;
      else if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      else if (p.y > h) p.y = 0;
    }
  }

  /* =========================
     Rendering helpers
  ========================= */

  function drawBackground() {
    ctx.fillStyle = "rgba(5,10,20,0.08)";
    ctx.fillRect(0, 0, w, h);
  }

  function drawConnections(mood, clusterScale) {
    const linkDist = CONFIG.LINK_DIST;
    const lineAlpha = CONFIG.LINE_ALPHA;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const p2 = points[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const sameCluster = p1.cluster === p2.cluster;
        const clusterBias = lerp(1.0, sameCluster ? 1.6 : 0.7, clusterScale);

        if (dist < linkDist * clusterBias) {
          const alpha = (1 - dist / (linkDist * clusterBias)) * lineAlpha;
          const hue = mood.h + p1.z * 18 + Math.sin(t + p1.x * 0.002) * 4;

          ctx.strokeStyle = hsl(hue, mood.s, mood.l, alpha);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
  }

  function drawNodes(mood, clusterScale) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const size = CONFIG.NODE_SIZE + p.z * CONFIG.DEPTH;
      const clusterHueOffset = (p.cluster - 2.5) * 12 * clusterScale;

      const hue = mood.h + clusterHueOffset + p.z * 18 + Math.cos(t + p.y * 0.002) * 3;
      const light = mood.l + p.z * 18;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = hsl(hue, mood.s, light, CONFIG.BASE_ALPHA + p.z * 0.25);
      ctx.fill();
    }
  }

  /* =========================
     Main loop
  ========================= */

  function draw() {
    if (!active) {
      running = false;
      return;
    }
    ctx.clearRect(0, 0, w, h);
    t += 0.002;

    drawBackground();

    // Scroll physics (decay)
    scrollForce += scrollVelocity * 0.002;
    scrollForce *= 0.9;

    // Mood interpolation
    const moodIndex = clamp(window.FIELD.spectrum, 0, 1) * (MOODS.length - 1);
    const i0 = Math.floor(moodIndex);
    const i1 = Math.min(i0 + 1, MOODS.length - 1);
    const mix = moodIndex - i0;
    const mood = lerpColor(MOODS[i0], MOODS[i1], mix);

    const energy = 0.4 + window.FIELD.energy * 0.8; // bounded
    const clusterScale = clamp(window.FIELD.clusters, 0, 1);

    updatePhysics(energy);
    drawConnections(mood, clusterScale);
    drawNodes(mood, clusterScale);

    requestAnimationFrame(draw);
  }

  /* =========================
     Interaction
  ========================= */

  // Attach listeners with a small delay to ensure DOM is ready
  setTimeout(() => {
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX / w;
      my = e.clientY / h;

      // Calculate mouse velocity for disturbance intensity
      mouseVelocityX = e.clientX - mouseWorldX;
      mouseVelocityY = e.clientY - mouseWorldY;
      const mouseSpeed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);

      // Update world coordinates for disturbance field
      mouseWorldX = e.clientX;
      mouseWorldY = e.clientY;

      // Mark mouse as active and reset inactivity timer
      isMouseActive = true;
      
      if (mouseInactivityTimeout) clearTimeout(mouseInactivityTimeout);

      // Deactivate disturbance after 1s of no mouse movement
      mouseInactivityTimeout = setTimeout(() => {
        isMouseActive = false;
        mouseInactivityTimeout = null;
      }, 1000);
    });
  }, 100);

  window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;
    scrollVelocity = currentScroll - lastScrollY;
    lastScrollY = currentScroll;

    // Clear existing timeout
    if (scrollTimeout) clearTimeout(scrollTimeout);

    // Reset scroll velocity after 100ms of no scrolling
    scrollTimeout = setTimeout(() => {
      scrollVelocity = 0;
      scrollTimeout = null;
    }, 100);
  });

  window.addEventListener("resize", () => {
    resize();
    createPoints();
  });

  window.addEventListener("bg-mode-change", (e) => {
    active = e.detail.mode === "canvas";
    if (active && !running) {
      requestAnimationFrame(draw);
      running = true;
    }
  });

  /* =========================
     Init
  ========================= */

  resize();
  createPoints();
  if (active && !running) {
    running = true;
    requestAnimationFrame(draw);
  }
  
  // Helper function for tweaking
  window.DISTURBANCE_HELP = () => {
    console.log(`
🎮 DISTURBANCE FIELD - Real-time Controls
========================================
Try these in the console:

MOUSE DISTURBANCE:
window.DISTURBANCE_CONFIG.RADIUS = 30        // Influence zone size (pixels)
window.DISTURBANCE_CONFIG.STRENGTH = 100     // Force magnitude (0-200+)
window.DISTURBANCE_CONFIG.BASE_FORCE_MULT = 0.5  // Force reduction (0-1)
window.DISTURBANCE_CONFIG.SPEED_MIN = 0.3    // Minimum speed factor
window.DISTURBANCE_CONFIG.SPEED_MAX = 2.0    // Maximum speed factor
window.DISTURBANCE_CONFIG.SPEED_MULT = 0.15  // Speed sensitivity
window.DISTURBANCE_CONFIG.CONNECTION_RESISTANCE = 0.15  // Connection effect
window.DISTURBANCE_CONFIG.CONNECTION_MIN = 0.2  // Minimum force with connections

ELEMENT DISTURBANCE:
Add data-particle-disturbance attribute to any element to make particles avoid it:
<div data-particle-disturbance 
     data-particle-disturbance-padding="8"
     data-particle-disturbance-force="1.2">
  Content here
</div>

Attributes:
- data-particle-disturbance: Enables avoidance (required)
- data-particle-disturbance-padding: Influence zone around element (default: 8px)
- data-particle-disturbance-force: Push force magnitude (default: 1.2)

Examples:
- Increase radius: window.DISTURBANCE_CONFIG.RADIUS = 50
- More aggressive: window.DISTURBANCE_CONFIG.BASE_FORCE_MULT = 0.5
- React more to speed: window.DISTURBANCE_CONFIG.SPEED_MULT = 0.25

Current config:
    `);
    console.table(window.DISTURBANCE_CONFIG);
  };
  
  console.log(`✅ Disturbance field ready. Type: window.DISTURBANCE_HELP()`);
  draw();
})();
