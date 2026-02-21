(function () {
  'use strict';

  var nav = document.getElementById('sideNav');
  var about = document.getElementById('about');

  if (!nav || !about) {
    console.warn('[nav-scroll-reveal] missing element:', { nav: !!nav, about: !!about });
    return;
  }

  console.log('[nav-scroll-reveal] init');

  // Track scroll velocity
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

  // Hide: snappier slide-up, roughly half the show duration. Clamp output 400–1200ms.
  function hideDuration(velocity) {
    var v = Math.abs(velocity);
    var ratio = Math.min(v / 50, 1);
    return Math.round(1200 - ratio * 800);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // About section has scrolled above the viewport — show nav
        var velocity = Math.abs(lastScrollY - prevScrollY);
        var duration = showDuration(velocity);
        console.log('[nav-scroll-reveal] show nav, velocity=' + velocity + ' duration=' + duration + 'ms');
        nav.style.setProperty('--nav-duration', duration + 'ms');
        nav.classList.add('nav-visible');
      } else if (entry.isIntersecting) {
        // About section back in view — slide nav away
        var velocity = Math.abs(lastScrollY - prevScrollY);
        var duration = hideDuration(velocity);
        console.log('[nav-scroll-reveal] hide nav, velocity=' + velocity + ' duration=' + duration + 'ms');
        nav.style.setProperty('--nav-hide-duration', duration + 'ms');
        nav.classList.remove('nav-visible');
      }
    });
  }, { threshold: 0 });

  observer.observe(about);
})();
