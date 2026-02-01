# Achievement System - Extension Guide

## Overview
The achievement system is designed to be extensible. New achievements can be added easily to `ACHIEVEMENT_DEFS` without modifying the core manager logic.

## Current Achievement
- **ID**: `coin_clicker`
- **Name**: "10 Clicks Hero"
- **Description**: "Tried clicking the coin 10 times. We saw that coming."
- **Icon**: `mouse-pointer` (Font Awesome)
- **Rarity**: `uncommon` (Blue border)

## How to Add New Achievements

### 1. Define the Achievement
Add a new entry to `ACHIEVEMENT_DEFS` in `coin-flip.js`:

```javascript
const ACHIEVEMENT_DEFS = {
  coin_clicker: { /* existing */ },
  
  // New achievement
  secret_finder: {
    id: 'secret_finder',
    name: 'Secret Stash',
    description: 'Found something we probably hid well enough.',
    icon: 'treasure-map',
    rarity: 'rare'  // or 'uncommon', 'epic', 'common'
  }
};
```

### 2. Trigger the Achievement
Call `ACHIEVEMENTS.unlock('achievement_id')` from anywhere in your code:

```javascript
// Example: trigger when user scrolls to a specific section
window.addEventListener('scroll', () => {
  if (/* some condition */) {
    ACHIEVEMENTS.unlock('secret_finder');
  }
});
```

### 3. Icon Selection
Use any Font Awesome icon name (without the `fa-` prefix):
- `mouse-pointer` - for click-related
- `star` - for special moments
- `trophy` - for wins
- `skull` - for danger/risky actions
- `treasure-map` - for secrets
- See [Font Awesome 6.6.0](https://fontawesome.com/icons) for more

### 4. Rarity Levels
Each rarity has a distinct border color (Steam-inspired):
- `common` - Gray (#999)
- `uncommon` - Blue (#4169e1) ← current
- `rare` - Purple (#9932cc)
- `epic` - Orange (#ff8c00)

## Features

### Deduplication
Achievements only unlock once per session. Calling `unlock()` multiple times for the same ID will:
- First call: displays toast, returns `true`
- Subsequent calls: silent, returns `false`

To check if unlocked:
```javascript
const wasUnlocked = ACHIEVEMENTS.unlockedIds.has('coin_clicker');
```

### Persistence (Future Enhancement)
Currently achievements are tracked in-session only (`Set`). To make them persistent:

```javascript
// In ACHIEVEMENTS.unlock():
localStorage.setItem(`ach_${achievementId}`, Date.now());

// Modify getContainer() to load persisted achievements on page load
```

## Architecture

```
ACHIEVEMENT_DEFS (object)
  ├─ achievement_id → definition
  ├─ properties: id, name, description, icon, rarity
  └─ extensible: add more as needed

ACHIEVEMENTS (manager object)
  ├─ unlockedIds (Set) - track per-session unlocks
  ├─ getContainer() - DOM container reference
  ├─ unlock(id) - trigger & display
  ├─ createCard(def) - build toast element
  └─ display(def) - show & animate

CSS (achievements.css)
  ├─ #ach-area - fixed container
  ├─ .ani_div.ach-rarity-* - rarity styling
  ├─ @keyframes slideInFromBottom - animation
  └─ .ach-* - text & icon styling
```

## Example: Time-Based Achievement

```javascript
// In ACHIEVEMENT_DEFS:
spent_time: {
  id: 'spent_time',
  name: 'Time Well Spent',
  description: 'Hung around for a while. Respect.',
  icon: 'hourglass-end',
  rarity: 'epic'
}

// In a page initialization:
setTimeout(() => {
  ACHIEVEMENTS.unlock('spent_time');
}, 300000); // 5 minutes
```

## Example: Conditional Achievement

```javascript
// In ACHIEVEMENT_DEFS:
night_owl: {
  id: 'night_owl',
  name: 'Night Owl',
  description: 'Visiting at an ungodly hour. Respect.',
  icon: 'moon',
  rarity: 'uncommon'
}

// Check on page load:
const hour = new Date().getHours();
if (hour >= 22 || hour < 6) {
  ACHIEVEMENTS.unlock('night_owl');
}
```

## Styling Customization

To customize achievement appearance, modify `themes/resume/static/css/achievements.css`:

- **Card size**: `.ani_div { width, height }`
- **Animation speed**: `animation: slideInFromBottom 3s` (change `3s`)
- **Border**: `.ani_div { border-left: 4px solid #999 }`
- **Icon styling**: `.ani_icon i { font-size, color }`
- **Text styling**: `.ach-name, .ach-desc { font-size, color }`
