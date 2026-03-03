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
    ],
    deep: [
      /^(bd-|bs-)/,
      /tooltip/,
      /popover/,
      /carousel/,
    ],
  },
};
