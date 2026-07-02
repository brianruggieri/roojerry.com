// Screenshot grid lightbox: native <dialog> gives Esc, focus trap, and ::backdrop free.
(() => {
  const boot = () => {
    const dialog = document.querySelector('.shot-lightbox');
    if (!dialog) return;
    const img = dialog.querySelector('img');

    document.querySelectorAll('.gallery-item__zoom').forEach((btn) => {
      btn.addEventListener('click', () => {
        img.src = btn.dataset.full;
        img.alt = btn.getAttribute('aria-label').replace(/^Expand screenshot: /, '');
        dialog.showModal();
      });
    });

    dialog.querySelector('.shot-lightbox__close').addEventListener('click', () => dialog.close());
    // click on the backdrop (outside the image) closes
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => { img.src = ''; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
