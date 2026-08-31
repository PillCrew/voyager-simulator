document.addEventListener('DOMContentLoaded', function() {
  const adOverlay = document.getElementById('ad-overlay');
  const closeBtn = document.getElementById('ad-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (adOverlay) adOverlay.style.display = 'none';
    });
  }
  const scene = document.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('exit-vr', function() {
      if (adOverlay) adOverlay.style.display = 'block';
    });
    scene.addEventListener('enter-vr', function() {
      if (adOverlay) adOverlay.style.display = 'none';
    });
  }
});
