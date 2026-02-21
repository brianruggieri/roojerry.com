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

  // Map scroll velocity to transition duration
  // Fast scroll → short duration (snappier); slow scroll → longer duration
  // Velocity is pixels/frame (~16ms). Clamp output 1200–3600ms.
  function velocityToDuration(velocity) {
    var v = Math.abs(velocity);
    // At v=0 → 3600ms, at v=50+ → 1200ms
    var ratio = Math.min(v / 50, 1);
    return Math.round(3600 - ratio * 2400);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // About section has scrolled above the viewport — show nav
        var velocity = Math.abs(lastScrollY - prevScrollY);
        var duration = velocityToDuration(velocity);
        console.log('[nav-scroll-reveal] show nav, velocity=' + velocity + ' duration=' + duration + 'ms');
        nav.style.setProperty('--nav-duration', duration + 'ms');
        nav.classList.add('nav-visible');
      } else if (entry.isIntersecting) {
        // About section back in view — slide nav away, velocity-matched
        var velocity = Math.abs(lastScrollY - prevScrollY);
        var duration = velocityToDuration(velocity);
        console.log('[nav-scroll-reveal] hide nav, velocity=' + velocity + ' duration=' + duration + 'ms');
        nav.style.setProperty('--nav-hide-duration', duration + 'ms');
        nav.classList.remove('nav-visible');
      }
    });
  }, { threshold: 0 });

  observer.observe(about);
})();
