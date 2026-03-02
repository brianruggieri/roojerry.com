document.querySelectorAll('a[href^="http://"], a[href^="https://"]').forEach(link => {
  if (link.hostname !== location.hostname) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
});
