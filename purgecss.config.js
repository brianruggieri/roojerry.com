export default {
  content: ['public/**/*.html'],
  css: ['public/css/**/*.css'],
  output: 'public/css',
  safelist: {
    // Bootstrap JS-toggled classes (collapse, dropdowns, tooltips, modal, navbar)
    standard: [
      'active', 'show', 'open', 'fade', 'in', 'out',
      'collapsing', 'collapsed',
      'dropdown-menu',
      'tooltip', 'tooltip-inner', 'bs-tooltip-top', 'bs-tooltip-bottom',
      'bs-tooltip-left', 'bs-tooltip-right',
      'popover', 'popover-body', 'popover-header',
      'navbar-collapse', 'navbar-toggler',
      'modal', 'modal-backdrop', 'modal-open',
      'was-validated',
      'sr-only', 'sr-only-focusable',
      // Coin flip — JS-toggled via coin-flip.js; never appears in static HTML
      'flipped', 'flipping',
      // Nav scroll-reveal — JS-toggled via nav-scroll-reveal.js; never appears in static HTML
      'nav-visible',
    ],
    deep: [
      /^(bd-|bs-)/,
      /tooltip/,
      /popover/,
      /carousel/,
      // Mobile nav hamburger X-morph uses [aria-expanded="true"] selector —
      // Bootstrap JS sets this attribute at runtime, not in static HTML
      /aria-expanded/,
    ],
  },
};
