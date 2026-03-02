(() => {
  /* =============================================================
     Background animation playback controls
     Polls for window.FIELD readiness (bg-field.js is deferred).
     Button icons are injected by JS so state is always in sync.
     ============================================================= */

  const ICONS = {
    pause: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    play:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
    eye:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
    eyeOff:`<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.61 17 4.5 12 4.5c-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zm10.53 10.53l-1.55-1.55c-.22.05-.44.08-.65.08-1.66 0-3-1.34-3-3 0-.22.03-.44.08-.65L5.86 8.13C5.2 8.98 4.83 10.02 4.83 11.17c0 3.85 3.1 6.97 6.95 6.97.97 0 1.89-.21 2.72-.58zm1.43-8.54c.05-.24.08-.49.08-.74 0-1.66-1.34-3-3-3-.25 0-.5.03-.74.08l3.66 3.66z"/></svg>`,
  };

  function init() {
    if (!window.FIELD || typeof window.FIELD.pause !== 'function') {
      setTimeout(init, 50);
      return;
    }

    const playBtn    = document.getElementById('bgc-play');
    const visBtn     = document.getElementById('bgc-visible');
    const resetBtn   = document.getElementById('bgc-reset');
    if (!playBtn || !visBtn || !resetBtn) return;

    /* ── State sync helpers ── */

    function setPlayState(isPlaying) {
      playBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause animation' : 'Play animation');
      playBtn.dataset.tooltip = isPlaying ? 'Pause' : 'Play';
    }

    function setVisState(isVisible) {
      visBtn.innerHTML = isVisible ? ICONS.eye : ICONS.eyeOff;
      visBtn.setAttribute('aria-label', isVisible ? 'Hide background' : 'Show background');
      visBtn.dataset.tooltip = isVisible ? 'Hide' : 'Show';
    }

    /* ── Initial state ── */

    setPlayState(window.FIELD.isPlaying());
    setVisState(window.FIELD.isVisible());

    /* ── Reduced motion: disable play/pause (nothing to pause) ── */

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function syncReducedMotion() {
      if (motionQuery.matches) {
        playBtn.disabled = true;
        playBtn.dataset.tooltip = 'Motion reduced';
      } else {
        playBtn.disabled = false;
        playBtn.dataset.tooltip = window.FIELD.isPlaying() ? 'Pause' : 'Play';
      }
    }

    syncReducedMotion();
    motionQuery.addEventListener('change', syncReducedMotion);

    /* ── Click handlers ── */

    playBtn.addEventListener('click', () => {
      if (window.FIELD.isPlaying()) {
        window.FIELD.pause();
        setPlayState(false);
      } else {
        window.FIELD.play();
        setPlayState(true);
      }
    });

    visBtn.addEventListener('click', () => {
      const nowVisible = window.FIELD.isVisible();
      window.FIELD.setVisible(!nowVisible);
      setVisState(!nowVisible);
    });

    resetBtn.addEventListener('click', () => {
      window.FIELD.reset();
    });
  }

  init();
})();
