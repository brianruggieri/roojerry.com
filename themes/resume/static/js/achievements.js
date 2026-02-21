/**
 * Achievement System
 * Extensible, event-driven achievement notifications.
 * 
 * Usage:
 *   ACHIEVEMENTS.unlock('achievement_id');
 * 
 * To add new achievements, extend ACHIEVEMENT_DEFS in this file.
 */

// Individual achievement definitions
// Extend this object to add new achievements.
// Use `image` (path to PNG) for custom art, or `icon` (FA icon name) as fallback.
const ACHIEVEMENT_DEFS = {
  // Snarky meta achievement: clicking the coin 10 times
  coin_clicker: {
    id: 'coin_clicker',
    name: '10 Clicks Hero',
    description: 'Tried clicking the coin 10 times. We saw that coming.',
    image: '/img/achievements/coin-clicker-10.png',
    rarity: 'uncommon'
  },

  // Even snarkier: 50 clicks
  coin_clicker_50: {
    id: 'coin_clicker_50',
    name: '50 Clicks Legend',
    description: 'You clicked 50 times. Are you okay?',
    image: '/img/achievements/coin-clicker-50.png',
    rarity: 'rare'
  }

  // Future achievements:
  // example_achievement: {
  //   id: 'example_achievement',
  //   name: 'Achievement Name',
  //   description: 'Snarky description here',
  //   image: '/img/achievements/example.png', // preferred: custom art
  //   icon: 'fa-icon-name',                   // fallback: Font Awesome
  //   rarity: 'rare' // common | uncommon | rare | epic
  // }
};

const ACHIEVEMENTS = {
  ANIMATION_DURATION: 3000, // 3s to match CSS keyframe
  CONTAINER_ID: 'ach-area',
  
  // Track unlocked achievements per session (could extend to localStorage)
  unlockedIds: new Set(),

  /**
   * Ensure the achievements container exists in the DOM.
   * Returns cached reference if already created.
   */
  getContainer() {
    let container = document.getElementById(this.CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = this.CONTAINER_ID;
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Unlock and display a specific achievement by ID.
   * @param {string} achievementId - The ID of the achievement to unlock
   * @returns {boolean} - true if unlocked, false if already unlocked
   */
  unlock(achievementId) {
    if (this.unlockedIds.has(achievementId)) {
      return false; // Already unlocked
    }

    const achievement = ACHIEVEMENT_DEFS[achievementId];
    if (!achievement) {
      console.warn(`Achievement "${achievementId}" not found in ACHIEVEMENT_DEFS`);
      return false;
    }

    this.unlockedIds.add(achievementId);
    this.display(achievement);
    return true;
  },

  /**
   * Create a single achievement card element.
   */
  createCard(achievement) {
    const { name, description, icon, rarity } = achievement;

    // Main card container
    const card = document.createElement('div');
    card.className = `ani_div grad ach-rarity-${rarity || 'common'}`;
    card.setAttribute('data-achievement-id', achievement.id);

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'ani_icon';
    const iconEl = document.createElement('i');
    iconEl.className = `fa fa-${icon} fa-fw`;
    iconContainer.appendChild(iconEl);

    // Text container
    const textContainer = document.createElement('div');
    textContainer.className = 'ach-text';
    
    // Achievement name (bold) + description (smaller)
    const nameEl = document.createElement('div');
    nameEl.className = 'ach-name';
    nameEl.textContent = name;
    
    const descEl = document.createElement('div');
    descEl.className = 'ach-desc';
    descEl.textContent = description;
    
    textContainer.appendChild(nameEl);
    textContainer.appendChild(descEl);

    // Assemble
    card.appendChild(iconContainer);
    card.appendChild(textContainer);

    return card;
  },

  /**
   * Display an achievement toast.
   * @param {object} achievement - Achievement definition object
   */
  display(achievement) {
    const container = this.getContainer();
    const card = this.createCard(achievement);
    container.appendChild(card);

    // Schedule cleanup after animation completes
    setTimeout(() => card.remove(), this.ANIMATION_DURATION);
  }
};
