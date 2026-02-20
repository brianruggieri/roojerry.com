(() => {
  // Wait for name element and disturbance config to be available
  function initNameDisturbance() {
    const nameEl = document.querySelector("h1");
    if (!nameEl || !window.DISTURBANCE_CONFIG) {
      setTimeout(initNameDisturbance, 100);
      return;
    }

    // Track disturbance state for each letter
    let letterOffsets = {};
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseVelocityX = 0;
    let mouseVelocityY = 0;

    // Get or create offset object for a letter element
    function getLetterOffset(letterEl) {
      const id = letterEl.dataset.id;
      if (!letterOffsets[id]) {
        letterOffsets[id] = {
          offsetX: 0,
          offsetY: 0,
          vx: 0,
          vy: 0
        };
      }
      return letterOffsets[id];
    }

    // Wrap text in individual letter spans
    function wrapLetters() {
      const firstName = "BRIAN";
      const lastName = "RUGGIERI";
      
      nameEl.innerHTML = '';
      
      // Wrap first name (dark color by default)
      firstName.split('').forEach((char, idx) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.dataset.id = `letter-${idx}`;
        span.style.position = 'relative';
        span.style.display = 'inline-block';
        nameEl.appendChild(span);
      });
      
      // Add space
      const space = document.createElement('span');
      space.textContent = ' ';
      space.style.position = 'relative';
      space.style.display = 'inline-block';
      nameEl.appendChild(space);
      
      // Wrap last name in text-primary span for cyan color
      const primarySpan = document.createElement('span');
      primarySpan.className = 'text-primary';
      
      lastName.split('').forEach((char, idx) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.dataset.id = `letter-${firstName.length + 1 + idx}`;
        span.style.position = 'relative';
        span.style.display = 'inline-block';
        primarySpan.appendChild(span);
      });
      
      nameEl.appendChild(primarySpan);
    }

    // Check if letter is within disturbance radius of mouse
    function applyDisturbanceToLetter(letterEl) {
      const offset = getLetterOffset(letterEl);
      const rect = letterEl.getBoundingClientRect();
      
      // Get letter center
      const letterCenterX = rect.left + rect.width / 2;
      const letterCenterY = rect.top + rect.height / 2;
      
      // Distance from mouse
      const dx = letterCenterX - lastMouseX;
      const dy = letterCenterY - lastMouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Apply disturbance if within radius
      if (dist < window.DISTURBANCE_CONFIG.RADIUS) {
        if (dist < 0.1) {
          // Avoid division by zero
          const angle = Math.random() * Math.PI * 2;
          offset.offsetX += Math.cos(angle) * 15;
          offset.offsetY += Math.sin(angle) * 15;
        } else {
          const nx = dx / dist;
          const ny = dy / dist;

          // Distance-based falloff
          const normalizedDist = dist / window.DISTURBANCE_CONFIG.RADIUS;
          const distanceFalloff = Math.max(0, 1 - normalizedDist);
          
          // Speed-based intensity
          const mouseSpeed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);
          const speedFactor = Math.min(
            window.DISTURBANCE_CONFIG.SPEED_MAX,
            window.DISTURBANCE_CONFIG.SPEED_MIN + mouseSpeed * window.DISTURBANCE_CONFIG.SPEED_MULT
          );

          // Calculate force
          const baseForce = window.DISTURBANCE_CONFIG.STRENGTH * window.DISTURBANCE_CONFIG.BASE_FORCE_MULT;
          const totalFalloff = distanceFalloff * speedFactor;
          const pushDistance = baseForce * totalFalloff * 0.6;

          // Apply direct displacement
          offset.offsetX += nx * pushDistance;
          offset.offsetY += ny * pushDistance;
          
          // Set velocity
          offset.vx = nx * baseForce * totalFalloff * 1.2;
          offset.vy = ny * baseForce * totalFalloff * 1.2;
        }
      }

      // Apply damping/decay to offset (gradually return to origin)
      offset.offsetX *= 0.92;
      offset.offsetY *= 0.92;

      // Update letter position
      letterEl.style.transform = `translate(${offset.offsetX.toFixed(1)}px, ${offset.offsetY.toFixed(1)}px)`;
    }

    // Update all letters
    function updateLetters() {
      const letters = nameEl.querySelectorAll('span');
      
      // Expose letter bounding boxes for background field avoidance
      window.LETTER_BOUNDS = [];
      
      letters.forEach((letterEl, idx) => {
        applyDisturbanceToLetter(letterEl);
        
        // Get letter's bounding box and add to LETTER_BOUNDS
        const rect = letterEl.getBoundingClientRect();
        
        window.LETTER_BOUNDS.push({
          left: rect.left + window.scrollX,
          right: rect.right + window.scrollX,
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2 + window.scrollX,
          centerY: rect.top + rect.height / 2 + window.scrollY,
          char: letterEl.textContent
        });
      });
      
      requestAnimationFrame(updateLetters);
    }

    // Track mouse movement
    window.addEventListener('mousemove', (e) => {
      mouseVelocityX = e.clientX - lastMouseX;
      mouseVelocityY = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    // Initialize
    wrapLetters();
    updateLetters();
  }

  initNameDisturbance();
})();
