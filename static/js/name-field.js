(() => {
  window.FIELD = window.FIELD || {};

  const nameCanvas = document.getElementById("name-field");
  if (!nameCanvas) return;

  const ctx = nameCanvas.getContext("2d");

  let w, h, dpr;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;

    nameCanvas.width = w * dpr;
    nameCanvas.height = h * dpr;
    nameCanvas.style.width = w + "px";
    nameCanvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildMask();
  }

  function getNameEl() {
    return document.querySelector("h1");
  }

  function rebuildMask() {
    const el = getNameEl();
    if (!el) return;

    FIELD.nameMask = [];
    FIELD.nameStrength = 0.4;

    ctx.clearRect(0, 0, w, h);

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    ctx.font = `${style.fontWeight} ${rect.height}px ${style.fontFamily}`;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";

    ctx.fillText(
      el.innerText.toUpperCase(),
      rect.left,
      rect.top
    );

    const img = ctx.getImageData(0, 0, w * dpr, h * dpr);
    const d = img.data;

    // sample pixels with proper DPR scaling
    for (let y = 0; y < h * dpr; y += 6) {
      for (let x = 0; x < w * dpr; x += 6) {
        const a = d[(y * w * dpr + x) * 4 + 3];
        if (a > 20) {
          // Convert back to viewport coordinates
          FIELD.nameMask.push({ 
            x: x / dpr, 
            y: y / dpr 
          });
        }
      }
    }

    console.log("[name-field] mask points:", FIELD.nameMask.length);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", rebuildMask);

  resize();
})();
