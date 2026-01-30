document.addEventListener('DOMContentLoaded', function() {
  const coin = document.getElementById('profileCoin');
  
  if (!coin) {
    console.log('Profile coin element not found');
    return;
  }
  
  console.log('Coin flip initialized');
  
  let flipTimeout;
  
  // Function to get random delay between 2-8 seconds
  function getRandomDelay() {
    return Math.random() * 6000 + 2000; // 2000-8000ms
  }
  
  // Function to flip the coin
  function performFlip() {
    // Add flipping class to disable clicks during animation
    coin.classList.add('flipping');
    
    console.log('Flipping coin');
    
    // Toggle the flipped class
    coin.classList.toggle('flipped');
    
    // Remove flipping class after animation completes
    flipTimeout = setTimeout(function() {
      coin.classList.remove('flipping');
      // Schedule next automatic flip
      flipTimeout = setTimeout(performFlip, getRandomDelay());
    }, 650); // Slightly longer than animation duration
  }
  
  // Click handler for manual flip
  coin.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(flipTimeout);
    console.log('Manual flip triggered');
    performFlip();
  });
  
  // Start the automatic flipping immediately, then at random intervals
  console.log('Starting automatic flipping');
  performFlip();
});
