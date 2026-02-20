(() => {
  const panel = document.getElementById("field-controls");
  if (!panel) return;

  const energy = document.getElementById("dial-energy");
  const spectrum = document.getElementById("dial-spectrum");
  const cluster = document.getElementById("dial-cluster");
  const density = document.getElementById("dial-density");

  // Toggle easter egg
  window.addEventListener("keydown", e => {
    if (e.key === ".") {
      panel.classList.toggle("active");
    }
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
