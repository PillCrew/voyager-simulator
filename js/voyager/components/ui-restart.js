AFRAME.registerComponent('restart-gaze-button', {
      init: function() {
        this.timer = null;
        this.progressRing = this.el.querySelector('.progress-ring');
        this.el.addEventListener('mouseenter', () => {
          this.timer = setTimeout(() => {
            const gameManager = document.querySelector('[game-manager]');
            if (gameManager && gameManager.components['game-manager']) {
              gameManager.components['game-manager'].backToMenu();
            } else {
              location.reload();
            }
          }, 4000);
          if (this.progressRing) {
            this.progressRing.setAttribute('visible', true);
            this.progressRing.setAttribute('animation', {
              property: 'geometry.thetaLength',
              from: 0,
              to: 360,
              dur: 4000,
              easing: 'linear'
            });
          }
        });
        this.el.addEventListener('mouseleave', () => {
          if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
          }
          if (this.progressRing) {
            this.progressRing.removeAttribute('animation');
            this.progressRing.setAttribute('geometry', 'thetaLength', 0);
            this.progressRing.setAttribute('visible', false);
          }
        });
      }
    });
