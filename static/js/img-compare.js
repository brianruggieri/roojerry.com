// Before/after image comparison slider.
// Native range input drives a CSS var; clip-path reveals the top image.
// No per-frame layout — clip-path only repaints. Keyboard + click-to-set come free from the input.
(() => {
  const init = (root) => {
    const frame = root.querySelector('.img-compare__frame');
    const range = root.querySelector('.img-compare__range');
    if (!frame || !range) return;
    const set = () => frame.style.setProperty('--pos', range.value + '%');
    range.addEventListener('input', set);
    set();
  };
  const boot = () => document.querySelectorAll('.img-compare').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
