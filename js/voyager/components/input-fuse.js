AFRAME.registerComponent('fuse-cursor', {
      init: function() {
        this.progressRing = document.querySelector('#fuse-progress-ring');
        this.fuseTimeout = 4000;
        this.fuseStartTime = null;
        this.isFusing = false;
        this.hoverSound = null;
        this.clickSound = null;
        this.currentHoveredButton = null;
        this.el.addEventListener('raycaster-intersection', (evt) => {
          const intersected = evt.detail.els[0];
          let isVisible = true;
          let current = intersected;
          while (current) {
            if (current.getAttribute && current.getAttribute('visible') === false) {
              isVisible = false;
              break;
            }
            if (current.object3D && current.object3D.visible === false) {
              isVisible = false;
              break;
            }
            current = current.parentNode;
          }
          if (intersected && intersected.classList.contains('button-interactive') && isVisible) {
            if (this.currentHoveredButton !== intersected) {
              this.playHoverSound();
              this.currentHoveredButton = intersected;
              intersected.setAttribute('animation__hover', {
                property: 'scale',
                to: '1.1 1.1 1.1',
                dur: 150,
                easing: 'easeOutQuad'
              });
              const gameManager = document.querySelector('[game-manager]');
              if (gameManager && gameManager.components['game-manager']) {
                const manager = gameManager.components['game-manager'];
                const isPlaying = this.el.sceneEl.is('playing');
                if (!isPlaying && manager.soundEnabled && manager.menuAudio && manager.menuAudio.paused) {
                  manager.playMenuMusic();
                }
              }
            }
            this.startFuse();
          }
        });
        this.el.addEventListener('raycaster-intersection-cleared', (evt) => {
          if (this.currentHoveredButton) {
            this.currentHoveredButton.setAttribute('animation__hover', {
              property: 'scale',
              to: '1 1 1',
              dur: 150,
              easing: 'easeInQuad'
            });
            this.currentHoveredButton = null;
          }
          this.stopFuse();
        });
      },
      playHoverSound: function() {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 600;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.08);
        } catch (e) {
          dbgWarn('Audio context error:', e);
        }
      },
      playClickSound: function() {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 900;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.06);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.06);
        } catch (e) {
          dbgWarn('Audio context error:', e);
        }
      },
      tick: function(time, timeDelta) {
        if (this.isFusing && this.fuseStartTime) {
          const elapsed = Date.now() - this.fuseStartTime;
          const progress = Math.min(elapsed / this.fuseTimeout, 1);
          const thetaLength = progress * 360;
          if (this.progressRing) {
            const currentTheta = parseFloat(this.progressRing.getAttribute('theta-length') || 0);
            if (Math.abs(currentTheta - thetaLength) > 5) {
               this.progressRing.setAttribute('theta-length', thetaLength);
            }
          }
          if (progress >= 1) {
            this.playClickSound();
            if (this.currentHoveredButton) {
                this.currentHoveredButton.emit('click');
                if (typeof this.currentHoveredButton.click === 'function') {
                    this.currentHoveredButton.click();
                }
            }
            this.stopFuse();
          }
        }
      },
      startFuse: function() {
        if (!this.isFusing) {
          this.isFusing = true;
          this.fuseStartTime = Date.now();
          if (this.progressRing) {
            this.progressRing.setAttribute('theta-length', 0);
            this.progressRing.setAttribute('visible', true);
          }
        }
      },
      playHoverSound: function() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      },
      playClickSound: function() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
      },
      stopFuse: function() {
        this.isFusing = false;
        this.fuseStartTime = null;
        if (this.progressRing) {
          this.progressRing.setAttribute('theta-length', 0);
          this.progressRing.setAttribute('visible', false);
        }
      }
    });
