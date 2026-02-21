(function () {
  'use strict';

  var nav = document.getElementById('sideNav');
  var about = document.getElementById('about');

  if (!nav || !about) return;

  // Track scroll velocity via RAF.
  // prevScrollY = position at the frame before lastScrollY was captured.
  // The delta between them approximates pixels/frame (~16ms) at the time of the last scroll event.
  var lastScrollY = window.scrollY;
  var prevScrollY = window.scrollY;
  var rafPending = false;

  function onScroll() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        prevScrollY = lastScrollY;
        lastScrollY = window.scrollY;
        rafPending = false;
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // Show: slow bounce-in. Clamp output 1200–3600ms.
  function showDuration(velocity) {
    var v = Math.abs(velocity);
    var ratio = Math.min(v / 50, 1);
    return Math.round(3600 - ratio * 2400);
  }

  // Hide: ~3x faster than show. Clamp output 400–1200ms.
  function hideDuration(velocity) {
    var v = Math.abs(velocity);
    var ratio = Math.min(v / 50, 1);
    return Math.round(1200 - ratio * 800);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var velocity = Math.abs(lastScrollY - prevScrollY);
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // About section has scrolled above the viewport — show nav with bounce
        nav.style.setProperty('--nav-duration', showDuration(velocity) + 'ms');
        nav.classList.add('nav-visible');
      } else if (entry.isIntersecting) {
        // About section back in view — slide nav away
        nav.style.setProperty('--nav-hide-duration', hideDuration(velocity) + 'ms');
        nav.classList.remove('nav-visible');
      }
    });
  }, { threshold: 0 });

  observer.observe(about);
})();
