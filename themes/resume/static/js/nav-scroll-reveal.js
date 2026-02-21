(function () {
  'use strict';

  var nav = document.getElementById('sideNav');
  var about = document.getElementById('about');

  if (!nav || !about) return;

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
  // Velocity is pixels/frame (~16ms). Clamp output 200–600ms.
  function velocityToDuration(velocity) {
    var v = Math.abs(velocity);
    // At v=0 → 600ms, at v=50+ → 200ms
    var ratio = Math.min(v / 50, 1);
    return Math.round(600 - ratio * 400);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // About section has scrolled above the viewport — show nav
        var velocity = Math.abs(lastScrollY - prevScrollY);
        var duration = velocityToDuration(velocity);
        nav.style.setProperty('--nav-duration', duration + 'ms');
        nav.classList.add('nav-visible');
      } else if (entry.isIntersecting) {
        // Back at the top — snap nav away instantly
        nav.style.setProperty('--nav-duration', '0ms');
        nav.classList.remove('nav-visible');
        // Reset to no-transition after a tick so future reveals animate
        requestAnimationFrame(function () {
          nav.style.removeProperty('--nav-duration');
        });
      }
    });
  }, { threshold: 0 });

  observer.observe(about);
})();
