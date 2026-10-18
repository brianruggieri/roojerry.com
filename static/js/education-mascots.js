(() => {
  const scene = document.querySelector('.uga-march-track');
  if (!scene) return;

  let visible = false;
  const sync = () => {
    if (visible && !document.hidden) scene.style.removeProperty('--uga-play-state');
    else scene.style.setProperty('--uga-play-state', 'paused');
  };
  sync();

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(scene);
  document.addEventListener('visibilitychange', sync);

  // An even step count keeps both feet in phase at each turn, at about 10px per step.
  new ResizeObserver(() => {
    const distance = scene.querySelector('.uga-march-walker').offsetWidth;
    scene.style.setProperty('--uga-steps', Math.max(2, Math.round(distance / 20) * 2));
  }).observe(scene);
})();
