// Wait for disturbance config to be available
function initDisturbanceControls() {
  if (!window.DISTURBANCE_CONFIG) {
    setTimeout(initDisturbanceControls, 100);
    return;
  }

  const controls = {
    radius: document.getElementById('radius-slider'),
    strength: document.getElementById('strength-slider'),
    forceMult: document.getElementById('force-mult-slider'),
    speedMult: document.getElementById('speed-mult-slider'),
    connectionResist: document.getElementById('connection-resist-slider'),
    connectionMin: document.getElementById('connection-min-slider')
  };

  const values = {
    radius: document.getElementById('radius-value'),
    strength: document.getElementById('strength-value'),
    forceMult: document.getElementById('force-mult-value'),
    speedMult: document.getElementById('speed-mult-value'),
    connectionResist: document.getElementById('connection-resist-value'),
    connectionMin: document.getElementById('connection-min-value')
  };

  const defaults = {
    RADIUS: 100,
    STRENGTH: 35,
    BASE_FORCE_MULT: 0.10,
    SPEED_MULT: 0.1,
    CONNECTION_RESISTANCE: 0.05,
    CONNECTION_MIN: 0.30
  };

  // Update value display and config on slider change
  controls.radius.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.radius.textContent = val;
    window.DISTURBANCE_CONFIG.RADIUS = val;
  });

  controls.strength.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.strength.textContent = val;
    window.DISTURBANCE_CONFIG.STRENGTH = val;
  });

  controls.forceMult.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.forceMult.textContent = val.toFixed(2);
    window.DISTURBANCE_CONFIG.BASE_FORCE_MULT = val;
  });

  controls.speedMult.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.speedMult.textContent = val.toFixed(2);
    window.DISTURBANCE_CONFIG.SPEED_MULT = val;
  });

  controls.connectionResist.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.connectionResist.textContent = val.toFixed(2);
    window.DISTURBANCE_CONFIG.CONNECTION_RESISTANCE = val;
  });

  controls.connectionMin.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    values.connectionMin.textContent = val.toFixed(2);
    window.DISTURBANCE_CONFIG.CONNECTION_MIN = val;
  });

  // Reset button
  document.getElementById('disturbance-reset').addEventListener('click', () => {
    controls.radius.value = defaults.RADIUS;
    controls.strength.value = defaults.STRENGTH;
    controls.forceMult.value = defaults.BASE_FORCE_MULT;
    controls.speedMult.value = defaults.SPEED_MULT;
    controls.connectionResist.value = defaults.CONNECTION_RESISTANCE;
    controls.connectionMin.value = defaults.CONNECTION_MIN;

    values.radius.textContent = defaults.RADIUS;
    values.strength.textContent = defaults.STRENGTH;
    values.forceMult.textContent = defaults.BASE_FORCE_MULT.toFixed(2);
    values.speedMult.textContent = defaults.SPEED_MULT.toFixed(2);
    values.connectionResist.textContent = defaults.CONNECTION_RESISTANCE.toFixed(2);
    values.connectionMin.textContent = defaults.CONNECTION_MIN.toFixed(2);

    Object.assign(window.DISTURBANCE_CONFIG, defaults);
  });

  // Toggle panel visibility
  document.getElementById('disturbance-toggle').addEventListener('click', (e) => {
    const panel = document.getElementById('disturbance-panel');
    const button = e.target;
    panel.classList.toggle('collapsed');
    button.textContent = panel.classList.contains('collapsed') ? '+' : '−';
  });
}

initDisturbanceControls();

// Press 'd' to toggle panel visibility (dev use)
window.addEventListener('keydown', (e) => {
  if (e.key === 'd' && !e.target.matches('input, textarea')) {
    document.getElementById('disturbance-panel').classList.toggle('hidden');
  }
});
