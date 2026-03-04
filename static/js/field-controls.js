(() => {
  const panel = document.getElementById("field-controls");
  if (!panel) return;

  const energy = document.getElementById("dial-energy");
  const spectrum = document.getElementById("dial-spectrum");
  const cluster = document.getElementById("dial-cluster");
  const density = document.getElementById("dial-density");

  function open()   { panel.classList.add("active"); }
  function close()  { panel.classList.remove("active"); }
  function toggle() { panel.classList.toggle("active"); }

  // Right-click the background canvas — the canvas has pointer-events:none so
  // contextmenu fires on whatever element is on top of it. Intercept only when
  // the click isn't on a real interactive element (links, buttons, inputs, images
  // still get their native context menu).
  document.addEventListener("contextmenu", e => {
    if (e.target.closest("a, button, input, textarea, select, img")) return;
    e.preventDefault();
    toggle();
  });

  // Dismiss on Escape or click outside the panel
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") close();
  });

  document.addEventListener("click", e => {
    if (!panel.contains(e.target)) close();
  });

  // Sliders
  energy.addEventListener("input", e => {
    window.FIELD.energy = +e.target.value;
  });

  spectrum.addEventListener("input", e => {
    window.FIELD.spectrum = +e.target.value;
  });

  cluster.addEventListener("input", e => {
    window.FIELD.clusters = +e.target.value;
  });

  density.addEventListener("input", e => {
    window.FIELD.density = +e.target.value;
    // regenerate field
    if (window.createPoints) window.createPoints();
  });

})();
