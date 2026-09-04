AFRAME.registerComponent('game-manager', {
      init: function () {
        this.startButton = document.querySelector('#start-button');
        this.soundToggle = document.querySelector('#sound-toggle');
        this.soundToggleText = document.querySelector('#sound-toggle-text');
        this.arButtonContainer = document.getElementById('ar-button-container');
        this.enterArBtn = document.getElementById('enter-ar-btn');
        this.menu = document.querySelector('#menu');
        this.tutorialPanel = document.querySelector('#tutorial-panel');
        this.skipTutorialButton = document.querySelector('#skip-tutorial-button');
        this.player = document.querySelector('#player');
        this.starSystem = document.querySelector('#stars');
        this.backgroundAudio = document.querySelector('#background-audio');
        this.menuAudio = document.querySelector('#menu-audio');
        this._engineLoop = {
          ctx: null,
          gain: null,
          buffer: null,
          source: null,
          loadingPromise: null,
          fallbackToHtmlAudio: false,
          volume: 0.5
        };
        this.vrStarted = false;
        this.tutorialShown = false;
        this.soundEnabled = true;
        this.isGameOver = false;
        this.isCampaign = false;
        this.campaignTimeouts = [];
        this.currentMissionTarget = null;
        this.missionGazeTime = 0;
        this.missionCompleted = false;
        this.arMode = false;
        this.lastSessionMode = null;
        this.userHighScore = 0;
        this.userHighScoreFetched = false;
        this.userHighScorePromise = null;
        const isQuest = navigator.userAgent.includes('Quest');
        const isPico = navigator.userAgent.includes('Pico');
        if ((isQuest || isPico) && this.arButtonContainer) {
             this.arButtonContainer.style.display = 'block';
        }
        if (navigator.xr) {
          navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported && this.arButtonContainer) {
              this.arButtonContainer.style.display = 'block';
            }
          });
        }
        this.startButton.addEventListener('click', this.startGame.bind(this));
        this.campaignButton = document.querySelector('#btn-play-campaign');
        if (this.campaignButton) {
          this.campaignButton.addEventListener('click', this.startCampaign.bind(this));
        }
        this.soundToggle.addEventListener('click', this.toggleSound.bind(this));
        if (this.enterArBtn) {
            this.enterArBtn.addEventListener('click', this.toggleAR.bind(this));
        }
        if (this.skipTutorialButton) {
          this.skipTutorialButton.addEventListener('click', this.skipTutorial.bind(this));
        }
        const backToMenuButton = document.querySelector('#back-to-menu-button');
        if (backToMenuButton) {
          backToMenuButton.addEventListener('click', this.backToMenu.bind(this));
        }
        this.el.sceneEl.addEventListener('enter-vr', () => {
          const session = this.el.sceneEl.xrSession;
          if (session && session.mode) {
            this.lastSessionMode = session.mode;
          } else {
            this.lastSessionMode = this.el.sceneEl.is('ar-mode') ? 'immersive-ar' : 'immersive-vr';
          }
          const isARSession = session && session.mode === 'immersive-ar';
          if (this.el.sceneEl.is('ar-mode') || this.arMode || isARSession) {
            this.el.sceneEl.setAttribute('background', 'color', 'transparent');
            this.el.sceneEl.setAttribute('background', 'transparent', true);
            this.el.sceneEl.removeAttribute('animation');
            const bgStars = document.querySelector('[background-stars]');
            if (bgStars) bgStars.setAttribute('visible', 'false');
            const sky = document.querySelector('a-sky');
            if (sky) sky.setAttribute('visible', 'false');
            const renderer = this.el.sceneEl.renderer;
              if (renderer) {
                renderer.setClearColor(0x000000, 0);
              }
          }
          if (!this.vrStarted) {
            this.vrStarted = true;
            setTimeout(() => {
              this.showMenu();
            }, 500);
          }
        });
        this.el.sceneEl.addEventListener('exit-vr', () => {
          const isPico = navigator.userAgent.includes('Pico');
          const wasAR = this.lastSessionMode === 'immersive-ar' || this.arMode || this.el.sceneEl.is('ar-mode');
          this.lastSessionMode = null;
          if (isPico && wasAR) {
            window.location.reload();
            return;
          }
          if (wasAR) {
            this.restoreEnvironmentAfterARExit();
          }
        });
        const tutorialButton = document.querySelector('#tutorial-button');
        if (tutorialButton) {
          tutorialButton.addEventListener('click', this.showTutorialOnly.bind(this));
        }
        window.addEventListener('heyvr_sdk_loaded', () => {
            this.userHighScoreFetched = false;
            this.userHighScorePromise = null;
            this.checkWeaponUnlocks();
            setTimeout(() => this.checkWeaponUnlocks(), 2000);
            setTimeout(() => this.checkWeaponUnlocks(), 5000);
        });
        if (typeof heyVR !== 'undefined') {
             this.checkWeaponUnlocks();
             setTimeout(() => this.checkWeaponUnlocks(), 2000);
        }

        // Proactively load audio elements to reduce first-play failures on some browsers/devices.
        try {
          if (this.backgroundAudio && typeof this.backgroundAudio.load === 'function') this.backgroundAudio.load();
          if (this.menuAudio && typeof this.menuAudio.load === 'function') this.menuAudio.load();
        } catch (e) {}
      },
      _getEngineAudioUrl: function() {
        if (!this.backgroundAudio) return null;
        const srcEl = this.backgroundAudio.querySelector && this.backgroundAudio.querySelector('source');
        const raw = (srcEl && srcEl.getAttribute('src')) || this.backgroundAudio.getAttribute('src') || this.backgroundAudio.src;
        return raw || null;
      },
      _ensureEngineAudioContext: function() {
        if (this._engineLoop.fallbackToHtmlAudio) return null;
        if (this._engineLoop.ctx) return this._engineLoop.ctx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
          this._engineLoop.fallbackToHtmlAudio = true;
          return null;
        }
        this._engineLoop.ctx = new Ctx();
        this._engineLoop.gain = this._engineLoop.ctx.createGain();
        this._engineLoop.gain.gain.value = 0;
        this._engineLoop.gain.connect(this._engineLoop.ctx.destination);
        return this._engineLoop.ctx;
      },
      _loadEngineBuffer: function() {
        if (this._engineLoop.fallbackToHtmlAudio) return Promise.reject(new Error('WebAudio disabled'));
        if (this._engineLoop.buffer) return Promise.resolve(this._engineLoop.buffer);
        if (this._engineLoop.loadingPromise) return this._engineLoop.loadingPromise;
        const url = this._getEngineAudioUrl();
        if (!url) return Promise.reject(new Error('Missing engine audio URL'));
        const ctx = this._ensureEngineAudioContext();
        if (!ctx) return Promise.reject(new Error('No AudioContext'));
        this._engineLoop.loadingPromise = fetch(url)
          .then(r => {
            if (!r.ok) throw new Error(`Failed to fetch engine audio: ${r.status}`);
            return r.arrayBuffer();
          })
          .then(buf => new Promise((resolve, reject) => {
            const p = ctx.decodeAudioData(buf, resolve, reject);
            if (p && typeof p.then === 'function') p.then(resolve).catch(reject);
          }))
          .then(decoded => {
            this._engineLoop.buffer = decoded;
            return decoded;
          })
          .catch(err => {
            this._engineLoop.fallbackToHtmlAudio = true;
            throw err;
          })
          .finally(() => {
            this._engineLoop.loadingPromise = null;
          });
        return this._engineLoop.loadingPromise;
      },
      _stopEngineLoop: function(immediate) {
        try {
          const ctx = this._engineLoop.ctx;
          const source = this._engineLoop.source;
          const gain = this._engineLoop.gain;
          if (ctx && source && gain) {
            const t = ctx.currentTime;
            try { gain.gain.cancelScheduledValues(t); } catch (e) {}
            if (immediate) {
                try { gain.gain.setValueAtTime(0.0, t); } catch (e) {}
                try { source.stop(t); } catch (e) { try { source.stop(); } catch (e2) {} }
            } else {
                try { gain.gain.setValueAtTime(gain.gain.value, t); } catch (e) {}
                try { gain.gain.linearRampToValueAtTime(0.0, t + 0.05); } catch (e) {}
                try { source.stop(t + 0.06); } catch (e) { try { source.stop(); } catch (e2) {} }
            }
          }
        } catch (e) {
        }
        this._engineLoop.source = null;
        if (this.backgroundAudio) {
          this.backgroundAudio.pause();
          try { this.backgroundAudio.currentTime = 0; } catch (e) {}
        }
      },
      _playEngineLoop: function(volume) {
        this._engineLoop.volume = typeof volume === 'number' ? volume : this._engineLoop.volume;
        if (this.backgroundAudio) {
          this.backgroundAudio.pause();
          try { this.backgroundAudio.currentTime = 0; } catch (e) {}
        }
        if (this._engineLoop.fallbackToHtmlAudio) {
          if (!this.backgroundAudio) return;
          if (this.backgroundAudio.readyState < 2) {
            this.backgroundAudio.addEventListener('canplay', () => this._playEngineLoop(this._engineLoop.volume), { once: true });
            try { this.backgroundAudio.load(); } catch (e) {}
            return;
          }
          this.backgroundAudio.loop = true;
          this.backgroundAudio.volume = this._engineLoop.volume;
          const playPromise = this.backgroundAudio.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
                dbgWarn('Background audio play failed:', err.message || err);
            });
          }
          return;
        }
        const ctx = this._ensureEngineAudioContext();
        if (!ctx) {
          this._engineLoop.fallbackToHtmlAudio = true;
          return this._playEngineLoop(this._engineLoop.volume);
        }
        const resumePromise = (ctx.state === 'suspended') ? ctx.resume().catch(() => {}) : Promise.resolve();
        resumePromise.then(() => this._loadEngineBuffer())
          .then(buffer => {
            if (!buffer) throw new Error('No decoded engine buffer');
            if (!this.soundEnabled) return; 
            this._stopEngineLoop(true);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this._engineLoop.gain);
            this._engineLoop.source = source;
            const t = ctx.currentTime;
            try { this._engineLoop.gain.gain.cancelScheduledValues(t); } catch (e) {}
            try { this._engineLoop.gain.gain.setValueAtTime(0.0, t); } catch (e) {}
            try { this._engineLoop.gain.gain.linearRampToValueAtTime(this._engineLoop.volume, t + 0.5); } catch (e) {}
            source.start(t);
          })
          .catch(err => {
            this._engineLoop.fallbackToHtmlAudio = true;
            dbgWarn('Engine loop WebAudio failed, falling back:', err && (err.message || err));
            this._playEngineLoop(this._engineLoop.volume);
          });
      },
      fetchUserHighScore: function() {
        if (this.userHighScorePromise) {
            return this.userHighScorePromise;
        }
        if (typeof heyVR === 'undefined' || !heyVR.leaderboard || !heyVR.user) {
             this.userHighScore = 0;
             return Promise.resolve(0);
        }
        this.userHighScorePromise = new Promise((resolve, reject) => {
             const checkLogin = (typeof heyVR.user.isLoggedIn === 'function')
                ? Promise.resolve(heyVR.user.isLoggedIn())
                : Promise.resolve(heyVR.user.isLoggedIn);
             checkLogin.then(loggedIn => {
                if (!loggedIn) {
                    this.userHighScore = 0;
                    this.userHighScoreFetched = false;
                    resolve(0);
                    return;
                }
                return heyVR.user.getName().then(username => {
                    return heyVR.leaderboard.getMy('punkty', 1).then(scores => {
                        let cloudScore = 0;
                        if (Array.isArray(scores) && scores.length > 0) {
                            const entry = scores[0];
                            if (entry && entry.user === username) {
                                cloudScore = entry.score || 0;
                            }
                        }
                        this.userHighScore = cloudScore;
                        this.userHighScoreFetched = true;
                        dbgLog('[GameManager] Fetched cloud score: ' + cloudScore);
                        resolve(cloudScore);
                    });
                });
             }).catch(err => {
                 console.warn('Error fetching user score:', err);
                 this.userHighScore = 0;
                 resolve(0);
             }).finally(() => {
                 this.userHighScorePromise = null;
             });
        });
        return this.userHighScorePromise;
      },
      showMenu: function() {
        this.checkWeaponUnlocks();
        const restartBtn = document.querySelector('#restart-button-rear');
        if (restartBtn) {
          restartBtn.setAttribute('visible', false);
          const interactive = restartBtn.querySelector('.button-interactive');
          if (interactive) {
            interactive.classList.remove('button-interactive');
            interactive.classList.add('button-disabled');
          }
        }
        const asteroidSystem = document.querySelector('[asteroid-system]');
        if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
          const astSystem = asteroidSystem.components['asteroid-system'];
          astSystem.asteroids.forEach(asteroid => {
            if (asteroid && asteroid.parentNode) {
              try { asteroid.parentNode.removeChild(asteroid); } catch(e){}
            }
          });
          astSystem.asteroids = [];
          astSystem.spawnTimer = 0;
          astSystem.maxAsteroids = 0;
        }
        const spaceJunkSystem = document.querySelector('[space-junk-system]');
        if (spaceJunkSystem && spaceJunkSystem.components['space-junk-system']) {
          const system = spaceJunkSystem.components['space-junk-system'];
          system.junkObjects.forEach(junk => {
            if (junk && junk.parentNode) {
              try { junk.parentNode.removeChild(junk); } catch(e){}
            }
          });
          system.junkObjects = [];
          system.spawnTimer = 0;
          system.maxJunk = 0;
        }
        if (this.menu) {
          this.menu.setAttribute('visible', 'true');
          const leaderboardPanel = document.querySelector('#leaderboard-panel');
          if (leaderboardPanel) {
            leaderboardPanel.setAttribute('visible', 'true');
          }
          const adPanel = document.querySelector('#ad-panel');
          if (adPanel) {
            adPanel.setAttribute('visible', 'true');
          }
          const weaponSelector = document.querySelector('#weapon-selector-panel');
          if (weaponSelector) {
            weaponSelector.setAttribute('visible', 'true');
            weaponSelector.setAttribute('scale', '1 1 1');
            this.setWeaponSelectorInteractivity(true);
          }
          this.menu.object3D.visible = true;
          this.menu.object3D.layers.set(0);
          if (this.menu.object3D.traverse) {
            this.menu.object3D.traverse(function(child) {
              child.visible = true;
              child.layers.set(0);
            });
          }
          const menuButtons = this.menu.querySelectorAll('.button-disabled');
          menuButtons.forEach(btn => {
            btn.classList.remove('button-disabled');
            btn.classList.add('button-interactive');
            btn.setAttribute('clickable', 'true');
            btn.object3D.visible = true;
            btn.object3D.layers.set(0);
            btn.classList.remove('raycast-ignore');
            btn.classList.add('clickable');
            btn.setAttribute('data-raycastable', 'true');
            if (btn.object3D && btn.object3D.traverse) {
              btn.object3D.traverse(function(child) {
                child.visible = true;
                child.layers.set(0);
                delete child.raycast;
              });
            }
            if (btn.id === 'start-button') {
                btn.setAttribute('material', 'color: #00ff88;');
            } else if (btn.id === 'ar-button') {
                btn.setAttribute('material', 'color: #0088ff;');
            } else if (btn.id === 'exit-button') {
                btn.setAttribute('material', 'color: #ff6600;');
            }
          });
          const soundToggle = document.querySelector('#sound-toggle');
          if (soundToggle) {
            soundToggle.classList.remove('button-disabled');
            soundToggle.classList.add('button-interactive');
          }
        }
        if (this.tutorialPanel) {
          this.tutorialPanel.setAttribute('visible', 'false');
          const tutorialButtons = this.tutorialPanel.querySelectorAll('.button-interactive');
          tutorialButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'false');
          const gameOverButtons = gameOverPanel.querySelectorAll('.button-interactive');
          gameOverButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        this.playMenuMusic();
      },
      showTutorialOnly: function() {
        if (this.tutorialPanel) {
          this.tutorialPanel.setAttribute('visible', 'true');
          const tutorialButtons = this.tutorialPanel.querySelectorAll('.button-disabled');
          tutorialButtons.forEach(btn => {
            btn.classList.remove('button-disabled');
            btn.classList.add('button-interactive');
          });
        }
        if (this.cursor) {
          this.cursor.setAttribute('visible', 'true');
        }
        if (this.menu) {
          this.menu.setAttribute('visible', 'false');
          const menuButtons = this.menu.querySelectorAll('.button-interactive');
          menuButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        if (this.tutorialTimeout) {
          clearTimeout(this.tutorialTimeout);
          this.tutorialTimeout = null;
        }
      },
      skipTutorial: function() {
        if (this.tutorialPanel) {
          this.tutorialPanel.setAttribute('visible', 'false');
          const tutorialButtons = this.tutorialPanel.querySelectorAll('.button-interactive');
          tutorialButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        if (this.menu) {
          this.menu.setAttribute('visible', 'true');
          const leaderboardPanel = document.querySelector('#leaderboard-panel');
          if (leaderboardPanel) {
            leaderboardPanel.setAttribute('visible', 'true');
          }
          const adPanel = document.querySelector('#ad-panel');
          if (adPanel) {
            adPanel.setAttribute('visible', 'true');
          }
          const menuButtons = this.menu.querySelectorAll('.button-disabled');
          menuButtons.forEach(btn => {
            btn.classList.remove('button-disabled');
            btn.classList.add('button-interactive');
          });
          const soundToggle = document.querySelector('#sound-toggle');
          if (soundToggle) {
            soundToggle.classList.remove('button-disabled');
            soundToggle.classList.add('button-interactive');
          }
        }
        this.playMenuMusic();
      },
      checkWeaponUnlocks: function() {
        const weaponBtns = [
            document.querySelector('#btn-weapon-4'),
            document.querySelector('#btn-weapon-5'),
            document.querySelector('#btn-weapon-6'),
            document.querySelector('#btn-weapon-7'),
            document.querySelector('#btn-weapon-8')
        ];
        weaponBtns.forEach(btn => {
            if (btn && btn.components['weapon-lock']) {
                btn.components['weapon-lock'].checkUnlockStatus();
            }
        });
      },
      setWeaponSelectorInteractivity: function(enabled) {
        const panel = document.querySelector('#weapon-selector-panel');
        if (!panel) return;
        const buttons = panel.querySelectorAll('[weapon-selector]');
        buttons.forEach(btn => {
          if (!btn) return;
          if (!enabled) {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled', 'raycast-ignore');
            btn.setAttribute('data-raycastable', 'false');
            return;
          }
          const lock = btn.components && btn.components['weapon-lock'];
          if (lock) {
            lock.checkUnlockStatus();
          } else {
            btn.classList.add('button-interactive');
            btn.classList.remove('button-disabled');
          }
          btn.classList.remove('raycast-ignore');
          btn.setAttribute('data-raycastable', 'true');
        });
        if (enabled) {
          this.checkWeaponUnlocks();
        }
      },
      toggleSound: function() {
        this.soundEnabled = !this.soundEnabled;
        if (this.soundEnabled) {
          this.soundToggleText.setAttribute('value', '[ON] SOUND');
          this.soundToggle.setAttribute('material', 'color', '#0088ff');
          const innerPlane = this.soundToggle.querySelector('a-plane');
          if (innerPlane) {
            innerPlane.setAttribute('material', 'color', '#0088ff');
          }
          if (this.el.sceneEl.is('playing')) {
            this.playGameplayMusic();
          } else {
            this.playMenuMusic();
          }
        } else {
          this.soundToggleText.setAttribute('value', '[OFF] MUTE');
          this.soundToggle.setAttribute('material', 'color', '#ff0000');
          const innerPlane = this.soundToggle.querySelector('a-plane');
          if (innerPlane) {
            innerPlane.setAttribute('material', 'color', '#ff0000');
          }
          if (this.backgroundAudio) {
            this._stopEngineLoop();
          }
          if (this.menuAudio) {
            this.menuAudio.pause();
            try { this.menuAudio.currentTime = 0; } catch (e) {}
          }
        }
      },
      playMenuMusic: function() {
        this._stopEngineLoop();
        if (!this.soundEnabled || !this.menuAudio) return;
        if (this.menuAudio.readyState < 2) {
          this.menuAudio.addEventListener('canplay', () => this.playMenuMusic(), { once: true });
          return;
        }
        this.menuAudio.volume = 0.5;
        try { this.menuAudio.currentTime = 0; } catch (e) {}
        this.menuAudio.play().catch(err => {
          dbgWarn('Menu audio play failed:', err.message || err);
        });
      },
      playGameplayMusic: function() {
        if (this.menuAudio) {
          this.menuAudio.pause();
          try { this.menuAudio.currentTime = 0; } catch (e) {}
        }
        if (!this.soundEnabled || !this.backgroundAudio) return;
        if (this.backgroundAudio.readyState < 2) {
          this.backgroundAudio.addEventListener('canplay', () => this.playGameplayMusic(), { once: true });
          try { this.backgroundAudio.load(); } catch (e) {}
          return;
        }
        this._playEngineLoop(0.5);
      },
      backToMenu: function() {
        this.isCampaign = false;
        if (this.campaignTimeouts) {
            this.campaignTimeouts.forEach(t => clearTimeout(t));
            this.campaignTimeouts = [];
        }
        const blackout = document.getElementById('campaign-blackout');
        if (blackout && blackout.parentNode) blackout.parentNode.removeChild(blackout);
        if (this.player) {
            this.player.removeAttribute('animation__pull');
            this.player.setAttribute('position', '0 1.6 0');
        }
        const dust = document.querySelector('[cosmic-dust]');
        if (dust) dust.setAttribute('visible', 'true');
        const msgHud = document.querySelector('#campaign-message-hud');
        if (msgHud) msgHud.setAttribute('visible', 'false');
        const scene = this.el.sceneEl;
        if (scene.is('playing')) {
          scene.removeState('playing');
        }
        const starSystem = document.querySelector('#stars');
        if (starSystem) {
          starSystem.setAttribute('star-system', 'speed', 0);
        }
        const hudLeft = document.querySelector('#hud-left');
        const hudRight = document.querySelector('#hud-right');
        const hudTop = document.querySelector('#hud-top');
        if (hudLeft) hudLeft.setAttribute('visible', 'false');
        if (hudRight) hudRight.setAttribute('visible', 'false');
        if (hudTop) hudTop.setAttribute('visible', 'false');
        const weaponMount = document.querySelector('#weapon-mount');
        if (weaponMount) weaponMount.setAttribute('visible', 'true');
        const restartBtn = document.querySelector('#restart-button-rear');
        if (restartBtn) {
          restartBtn.setAttribute('visible', false);
          const interactive = restartBtn.querySelector('.button-interactive');
          if (interactive) {
            interactive.classList.remove('button-interactive');
            interactive.classList.add('button-disabled');
          }
        }
        const planetInfo = document.querySelector('#planet-info-panel');
        const scanPanel = document.querySelector('#scan-panel');
        const targetLock = document.querySelector('#target-lock-panel');
        const tooFar = document.querySelector('#too-far-panel');
        const difficultyPanel = document.querySelector('#difficulty-panel');
        const nasaMessage = document.querySelector('#nasa-message-panel');
        const planetNameHud = document.querySelector('#planet-name-hud');
        if (planetInfo) planetInfo.setAttribute('visible', 'false');
        if (scanPanel) scanPanel.setAttribute('visible', 'false');
        if (targetLock) targetLock.setAttribute('visible', 'false');
        if (tooFar) tooFar.setAttribute('visible', 'false');
        if (difficultyPanel) difficultyPanel.setAttribute('visible', 'false');
        if (nasaMessage) nasaMessage.setAttribute('visible', 'false');
        if (planetNameHud) planetNameHud.setAttribute('visible', 'false');
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'false');
          const gameOverButtons = gameOverPanel.querySelectorAll('.button-interactive');
          gameOverButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        if (this.tutorialPanel) {
          this.tutorialPanel.setAttribute('visible', 'false');
          const tutorialButtons = this.tutorialPanel.querySelectorAll('.button-interactive');
          tutorialButtons.forEach(btn => {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          });
        }
        const spaceJunkSystem = document.querySelector('[space-junk-system]');
        if (spaceJunkSystem && spaceJunkSystem.components['space-junk-system']) {
          const system = spaceJunkSystem.components['space-junk-system'];
          if (system.restartTimeout) {
            clearTimeout(system.restartTimeout);
            system.restartTimeout = null;
          }
          if (system.countdownInterval) {
            clearInterval(system.countdownInterval);
            system.countdownInterval = null;
          }
          if (system.clearTimeouts) system.clearTimeouts();
          system.junkObjects.forEach(junk => {
            if (junk && junk.parentNode) {
              try { junk.parentNode.removeChild(junk); } catch(e){}
            }
          });
          system.junkObjects = [];
          const remainingJunk = document.querySelectorAll('.space-junk');
          remainingJunk.forEach(junk => {
            if (junk.parentNode) {
              try { junk.parentNode.removeChild(junk); } catch(e){}
            }
          });
          system.spawnTimer = 0;
          system.maxJunk = 2;
          system.destroyedCount = 0;
          system.escapedCount = 0;
          system.allowedEscapes = 0;
          system.gameOver = false;
          system.gameOverShown = false;
          system.difficultyLevel = 0;
          system.gameStartTime = Date.now();
        }
        const asteroidSystem = document.querySelector('[asteroid-system]');
        if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
          const astSystem = asteroidSystem.components['asteroid-system'];
          astSystem.asteroids.forEach(asteroid => {
            if (asteroid && asteroid.parentNode) {
              try { asteroid.parentNode.removeChild(asteroid); } catch(e){}
            }
          });
          astSystem.asteroids = [];
          astSystem.spawnTimer = 0;
        }
        this.isGameOver = false;
        const menuCursor = document.querySelector('#menu-cursor');
        if (menuCursor) {
          menuCursor.setAttribute('visible', 'true');
          menuCursor.setAttribute('raycaster', 'enabled', true);
        }
        this.showMenu();
      },
      toggleAR: function() {
        this.arMode = !this.arMode;
        const scene = this.el.sceneEl;
        const bgStars = document.querySelector('[background-stars]');
        const sky = document.querySelector('a-sky');
        const skyboxSelection = document.getElementById('skybox-selection-container');
        if (this.arMode) {
          if (this.enterArBtn) {
            this.enterArBtn.innerText = 'EXIT AR';
            this.enterArBtn.style.color = '#ff0000';
          }
          if (bgStars) bgStars.setAttribute('visible', 'false');
          if (sky) sky.setAttribute('visible', 'false');
          if (skyboxSelection) skyboxSelection.setAttribute('visible', 'false');
          scene.setAttribute('background', 'color', 'transparent');
          scene.setAttribute('background', 'transparent', true);
          scene.removeAttribute('animation');
          if (this.arSupported) {
            if (scene.is('vr-mode')) {
              scene.exitVR().then(() => {
                scene.enterAR();
              }).catch(err => {
                console.error('Error exiting VR before AR:', err);
                scene.enterAR();
              });
            } else {
              scene.enterAR();
            }
          } else if (navigator.xr) {
             navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    if (scene.is('vr-mode')) {
                        scene.exitVR().then(() => scene.enterAR());
                    } else {
                        scene.enterAR();
                    }
                } else {
                    dbgWarn('immersive-ar not supported on this device');
                    alert('AR mode is not supported on this device');
                    this.arMode = false;
                }
             });
          } else {
            if (scene.is('vr-mode')) {
              scene.exitVR().then(() => {
                scene.enterAR();
              });
            } else {
              scene.enterAR();
            }
          }
        } else {
          const isPico = navigator.userAgent.includes('Pico');
          if (isPico) {
             window.location.reload();
          } else {
             const scene = this.el.sceneEl;
             this.restoreEnvironmentAfterARExit();
             if (scene && scene.is('vr-mode')) {
               scene.exitVR();
             }
          }
        }
      },
      restoreEnvironmentAfterARExit: function() {
        const scene = this.el.sceneEl;
        const bgStars = document.querySelector('[background-stars]');
        const sky = document.querySelector('a-sky');
        const skyboxSelection = document.getElementById('skybox-selection-container');
        if (bgStars) bgStars.setAttribute('visible', 'true');
        if (sky) sky.setAttribute('visible', 'true');
        if (skyboxSelection) skyboxSelection.setAttribute('visible', 'true');
        if (scene) {
          scene.setAttribute('background', 'color', '#000000');
          scene.setAttribute('animation', "property: background.color; from: #000000; to: #080810; dur: 300000; dir: alternate; loop: true; easing: easeInOutSine");
        }
        if (this.enterArBtn) {
          this.enterArBtn.innerText = 'ENTER AR';
          this.enterArBtn.style.color = '#ffffff';
        }
        this.arMode = false;
      },
      startCampaign: function () {
        this.isCampaign = true;
        this.menu.setAttribute('visible', 'false');
        this.currentMissionTarget = null;
        this.missionGazeTime = 0;
        this.missionCompleted = false;
        if (this.campaignTimeouts) {
            this.campaignTimeouts.forEach(t => clearTimeout(t));
            this.campaignTimeouts = [];
        }
        const msg1Show = setTimeout(() => {
            this.showCampaignMessage(
                "MESSAGE 1 (INCOMING)",
                "PRIORITY: ALPHA",
                "SOURCE: NASA DEEP SPACE NETWORK",
                "VOYAGER, INITIATE PROTOCOL 'PALE BLUE DOT'.\nRE-ORIENT ALL SENSORS. STANDING BY."
            );
            const audio = document.querySelector('#mission-audio-1');
            if (audio) {
                audio.currentTime = 0;
                audio.volume = 0.6;
                audio.play().catch(e => dbgWarn('Audio play failed:', e));
            }
        }, 5000);
        this.campaignTimeouts.push(msg1Show);
        const msg1Hide = setTimeout(() => {
            this.hideCampaignMessage();
        }, 15000);
        this.campaignTimeouts.push(msg1Hide);
        const msg2Show = setTimeout(() => {
            this.showCampaignMessage(
                "MESSAGE 2 (INCOMING)",
                "PRIORITY: ALPHA",
                "SOURCE: NASA DEEP SPACE NETWORK",
                "TARGET ACQUISITION: MERCURY.\nOBSERVE: A SCORCHED CRUST. A WORLD OF EXTREMES.\nA REMINDER OF NATURE'S RAW POWER."
            );
            this.currentMissionTarget = 'Mercury';
            this.missionGazeTime = 0;
            this.missionCompleted = false;
            const audio = document.querySelector('#mission-audio-2');
            if (audio) {
                audio.currentTime = 0;
                audio.volume = 0.6;
                audio.play().catch(e => dbgWarn('Audio play failed:', e));
            }
        }, 20000);
        this.campaignTimeouts.push(msg2Show);
        const restartBtn = document.querySelector('#restart-button-rear');
        if (restartBtn) {
          restartBtn.setAttribute('visible', true);
          const interactive = restartBtn.querySelector('.button-disabled');
          if (interactive) {
            interactive.classList.remove('button-disabled');
            interactive.classList.add('button-interactive');
          }
        }
        const leaderboardPanel = document.querySelector('#leaderboard-panel');
        if (leaderboardPanel) {
          leaderboardPanel.setAttribute('visible', 'false');
        }
        const adPanel = document.querySelector('#ad-panel');
        if (adPanel) {
          adPanel.setAttribute('visible', 'false');
        }
        const menuButtons = this.menu.querySelectorAll('.button-interactive');
        menuButtons.forEach(btn => {
          if (btn.id !== 'sound-toggle') {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          }
        });
        this.playGameplayMusic();
        this.isGameOver = false;
        this.currentScore = 0;
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'false');
          gameOverPanel.object3D.visible = false;
        }
        this.el.sceneEl.addState('playing');
        this.starSystem.setAttribute('star-system', 'speed', 8);
        const spaceJunkSystem = document.querySelector('[space-junk-system]');
        if (spaceJunkSystem && spaceJunkSystem.components['space-junk-system']) {
            const system = spaceJunkSystem.components['space-junk-system'];
            if (system.clearTimeouts) system.clearTimeouts();
            system.junkObjects.forEach(junk => {
              if (junk && junk.parentNode) try { junk.parentNode.removeChild(junk); } catch(e){}
            });
            system.junkObjects = [];
            const remainingJunk = document.querySelectorAll('.space-junk');
            remainingJunk.forEach(junk => {
              if (junk.parentNode) try { junk.parentNode.removeChild(junk); } catch(e){}
            });
            system.spawnTimer = 0;
            system.maxJunk = 0;
            system.destroyedCount = 0;
            system.escapedCount = 0;
            system.allowedEscapes = 0;
            system.gameOver = false;
            system.gameOverShown = false;
            system.difficultyLevel = 0;
            system.gameStartTime = Date.now();
        }
        const asteroidSystem = document.querySelector('[asteroid-system]');
        if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
          const astSystem = asteroidSystem.components['asteroid-system'];
          astSystem.asteroids.forEach(asteroid => {
            if (asteroid && asteroid.parentNode) try { asteroid.parentNode.removeChild(asteroid); } catch(e){}
          });
          astSystem.asteroids = [];
          astSystem.spawnTimer = 0;
          astSystem.maxAsteroids = 0;
          astSystem.initialSpawn = false;
        }
        const hudLeft = document.querySelector('#hud-left');
        const hudRight = document.querySelector('#hud-right');
        const hudTop = document.querySelector('#hud-top');
        if (hudLeft) hudLeft.setAttribute('visible', 'false');
        if (hudRight) hudRight.setAttribute('visible', 'false');
        if (hudTop) hudTop.setAttribute('visible', 'false');
        const weaponMount = document.querySelector('#weapon-mount');
        if (weaponMount) weaponMount.setAttribute('visible', 'false');
        const weaponSelector = document.querySelector('#weapon-selector-panel');
        if (weaponSelector) {
            weaponSelector.setAttribute('visible', 'false');
            weaponSelector.setAttribute('scale', '0 0 0');
        }
        this.setWeaponSelectorInteractivity(false);
        const cursor = document.querySelector('[cursor]');
        if (cursor) {
          cursor.setAttribute('visible', 'false');
        }
        const menuCursor = document.querySelector('#menu-cursor');
        if (menuCursor) {
          menuCursor.setAttribute('visible', 'true');
          menuCursor.setAttribute('raycaster', 'enabled', true);
          menuCursor.setAttribute('material', 'opacity', 0.3);
        }
        const planetNameHud = document.querySelector('#planet-name-hud');
        if (planetNameHud) {
             planetNameHud.setAttribute('position', '0 0.25 -1.5');
             planetNameHud.setAttribute('scale', '1.5 1.5 1.5');
        }
      },
      showCampaignMessage: function(header, priority, source, body) {
        const hud = document.querySelector('#campaign-message-hud');
        if (hud && this.isCampaign) {
            const lines = body.split('\n').length;
            const baseHeight = 0.25;
            const lineHeight = 0.04;
            const dynamicHeight = baseHeight + (lines - 2) * lineHeight;
            const minHeight = 0.3;
            const finalHeight = Math.max(dynamicHeight, minHeight);
            const bg = hud.querySelector('#camp-msg-bg');
            const borderTop = hud.querySelector('#camp-msg-border-top');
            const borderBottom = hud.querySelector('#camp-msg-border-bottom');
            const borderLeft = hud.querySelector('#camp-msg-border-left');
            const borderRight = hud.querySelector('#camp-msg-border-right');
            if (bg) {
                bg.setAttribute('height', finalHeight);
                bg.setAttribute('position', `0 0 0`);
            }
            if (borderTop) borderTop.setAttribute('position', `0 ${finalHeight/2} 0.001`);
            if (borderBottom) borderBottom.setAttribute('position', `0 -${finalHeight/2} 0.001`);
            if (borderLeft) {
                borderLeft.setAttribute('height', finalHeight);
                borderLeft.setAttribute('position', `-0.4 0 0.001`);
            }
            if (borderRight) {
                borderRight.setAttribute('height', finalHeight);
                borderRight.setAttribute('position', `0.4 0 0.001`);
            }
            const headerEl = hud.querySelector('#camp-msg-header');
            if (headerEl) {
                headerEl.setAttribute('value', header);
                if (header === "FINAL TRANSMISSION (INCOMING)" || header === "NEW ORDERS") {
                    headerEl.setAttribute('align', 'center');
                    headerEl.setAttribute('position', '0 0.12 0.002');
                } else {
                    headerEl.setAttribute('align', 'left');
                    headerEl.setAttribute('position', '-0.33 0.09 0.002');
                }
            }
            const divider = hud.querySelector('#camp-msg-divider');
            if (divider) {
                if (header === "FINAL TRANSMISSION (INCOMING)" || header === "NEW ORDERS") {
                    divider.setAttribute('visible', 'false');
                } else {
                    divider.setAttribute('visible', 'true');
                }
            }
            hud.querySelector('#camp-msg-priority').setAttribute('value', priority);
            hud.querySelector('#camp-msg-source').setAttribute('value', source);
            hud.querySelector('#camp-msg-body').setAttribute('value', body);
            hud.setAttribute('visible', 'true');
            const progressBar = hud.querySelector('#camp-msg-progress');
            if (progressBar) {
                progressBar.setAttribute('width', 0);
                progressBar.setAttribute('visible', 'false');
            }
        }
      },
      hideCampaignMessage: function() {
        const hud = document.querySelector('#campaign-message-hud');
        if (hud) {
            hud.setAttribute('visible', 'false');
        }
      },
      completeMission: function() {
        if (this.missionCompleted) return;
        this.missionCompleted = true;
        const completedTarget = this.currentMissionTarget;
        this.currentMissionTarget = null;
        const audio = new Audio('assets/sounds/scancom.mp3');
        audio.volume = 0.7;
        audio.play().catch(e => {});
        const hud = document.querySelector('#campaign-message-hud');
        if (hud) {
            const body = hud.querySelector('#camp-msg-body');
            body.setAttribute('value', 'MISSION ACCOMPLISHED\nDATA UPLOADED.');
            body.setAttribute('color', '#00ff00');
            const hideTimeout = setTimeout(() => {
                if (this.isCampaign) {
                    hud.setAttribute('visible', 'false');
                    body.setAttribute('color', '#ffffff');
                }
            }, 3000);
            this.campaignTimeouts.push(hideTimeout);
        }
        if (completedTarget === 'Mercury') {
             const nextMission = setTimeout(() => {
                this.showCampaignMessage(
                    "MESSAGE 3 (INCOMING)",
                    "PRIORITY: ALPHA",
                    "SOURCE: NASA DEEP SPACE NETWORK",
                    "TARGET: VENUS.\nOBSERVE: A RUNAWAY GREENHOUSE.\nA CAUTIONARY TALE. A SISTER GONE WRONG."
                );
                this.currentMissionTarget = 'Venus';
                this.missionGazeTime = 0;
                this.missionCompleted = false;
                const audio = document.querySelector('#mission-audio-3');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.play().catch(e => {});
                }
             }, 8000);
             this.campaignTimeouts.push(nextMission);
        } else if (completedTarget === 'Venus') {
             const nextMission = setTimeout(() => {
                this.showCampaignMessage(
                    "MESSAGE 4 (INCOMING)",
                    "PRIORITY: ALPHA",
                    "SOURCE: NASA DEEP SPACE NETWORK",
                    "TARGET: MARS.\nOBSERVE: A FROZEN DESERT.\nA DEAD RIVERBED. A WHISPER OF WHAT COULD HAVE BEEN."
                );
                this.currentMissionTarget = 'Mars';
                this.missionGazeTime = 0;
                this.missionCompleted = false;
                const audio = document.querySelector('#mission-audio-4');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.play().catch(e => {});
                }
             }, 8000);
             this.campaignTimeouts.push(nextMission);
        } else if (completedTarget === 'Mars') {
             const nextMission = setTimeout(() => {
                this.showCampaignMessage(
                    "MESSAGE 5 (INCOMING)",
                    "PRIORITY: ALPHA",
                    "SOURCE: NASA DEEP SPACE NETWORK",
                    "TARGET: JUPITER.\nOBSERVE: A GAS GIANT. A COSMIC SENTINEL.\nITS STORM IS LARGER THAN OUR ENTIRE WORLD."
                );
                this.currentMissionTarget = 'Jupiter';
                this.missionGazeTime = 0;
                this.missionCompleted = false;
                const audio = document.querySelector('#mission-audio-5');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.play().catch(e => {});
                }
             }, 8000);
             this.campaignTimeouts.push(nextMission);
        } else if (completedTarget === 'Jupiter') {
             const nextMission = setTimeout(() => {
                this.showCampaignMessage(
                    "MESSAGE 6 (INCOMING)",
                    "PRIORITY: ALPHA",
                    "SOURCE: NASA DEEP SPACE NETWORK",
                    "TARGET: SATURN.\nOBSERVE: A CELESTIAL MARVEL. RINGS OF ICE AND DUST.\nA REMINDER OF THE UNIVERSE'S SUBLIME BEAUTY AND SCALE."
                );
                this.currentMissionTarget = 'Saturn';
                this.missionGazeTime = 0;
                this.missionCompleted = false;
                const audio = document.querySelector('#mission-audio-6');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.play().catch(e => {});
                }
             }, 8000);
             this.campaignTimeouts.push(nextMission);
        } else if (completedTarget === 'Saturn') {
             const nextMission = setTimeout(() => {
                this.showCampaignMessage(
                    "MESSAGE 7 (INCOMING)",
                    "PRIORITY: ALPHA",
                    "SOURCE: NASA DEEP SPACE NETWORK",
                    "FINAL TARGET: EARTH.\nOBSERVE."
                );
                this.currentMissionTarget = 'Earth';
                this.missionGazeTime = 0;
                this.missionCompleted = false;
                const audio = document.querySelector('#mission-audio-61');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.play().catch(e => {});
                }
             }, 8000);
             this.campaignTimeouts.push(nextMission);
        } else if (completedTarget === 'Earth') {
             const finalTransmission = setTimeout(() => {
                this.showCampaignMessage(
                    "FINAL TRANSMISSION (INCOMING)",
                    "",
                    "",
                    "A SINGLE PIXEL IN THE VAST, COSMIC OCEAN.\nEVERYTHING WE'VE EVER KNOWN. EVERY HERO, EVERY KING, EVERY HEARTBREAK AND TRIUMPH... ALL OF IT, HAPPENING ON THAT DUST MOTE.\nWE ARE JUST ANTS, STARING UP AT THE UNIVERSE.\nPROTOCOL COMPLETE.\n\n[END OF TRANSMISSION]"
                );
                this.currentMissionTarget = null;
                this.missionCompleted = true;
                const audio = document.querySelector('#mission-audio-7');
                if (audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.6;
                    audio.onended = () => {
                        this.hideCampaignMessage();
                        const effectTimeout = setTimeout(() => {
                            const dust = document.querySelector('[cosmic-dust]');
                            if (dust) dust.setAttribute('visible', 'false');
                            const sun = document.getElementById('the-sun');
                            const player = document.querySelector('#player');
                            if (sun && player) {
                                const sunPos = sun.getAttribute('position');
                                player.setAttribute('animation__pull', {
                                    property: 'position',
                                    to: `${sunPos.x} ${sunPos.y} ${sunPos.z}`,
                                    dur: 5000,
                                    easing: 'easeInExpo'
                                });
                            }
                        }, 5000);
                        this.campaignTimeouts.push(effectTimeout);
                        const newOrders = setTimeout(() => {
                            this.showCampaignMessage(
                                "NEW ORDERS",
                                "",
                                "",
                                "ORBITAL DEFENSE.\nPRIORITY: OMEGA.\nCLEAN DEBRIS.\nSCAN ASTEROIDS.\nLOOK. LOCK. FIRE."
                            );
                            const camera = document.querySelector('a-camera');
                            if (camera) {
                                const flash = document.createElement('a-plane');
                                flash.setAttribute('position', '0 0 -0.1');
                                flash.setAttribute('width', '5');
                                flash.setAttribute('height', '5');
                                flash.setAttribute('color', 'white');
                                flash.setAttribute('material', 'shader: flat; transparent: true; opacity: 0; depthTest: false');
                                flash.setAttribute('animation', 'property: material.opacity; from: 0; to: 1; dur: 100; dir: alternate; loop: 1');
                                camera.appendChild(flash);
                                const black = document.createElement('a-plane');
                                black.id = 'campaign-blackout';
                                black.setAttribute('position', '0 0 -2.0');
                                black.setAttribute('width', '20');
                                black.setAttribute('height', '20');
                                black.setAttribute('color', 'black');
                                black.setAttribute('material', 'shader: flat; transparent: true; opacity: 0');
                                black.setAttribute('animation', 'property: material.opacity; to: 1; dur: 500; easing: linear');
                                camera.appendChild(black);
                                setTimeout(() => {
                                    if(flash.parentNode) flash.parentNode.removeChild(flash);
                                }, 500);
                            }
                            const audio2 = document.querySelector('#mission-audio-8');
                            if (audio2) {
                                audio2.currentTime = 0;
                                audio2.volume = 0.6;
                                const flashSound = new Audio('assets/sounds/flash.mp3');
                                flashSound.volume = 0.8;
                                flashSound.play().catch(e => {});
                                audio2.onended = () => {
                                    this.backToMenu();
                                };
                                audio2.play().catch(e => {});
                            }
                        }, 10000);
                        this.campaignTimeouts.push(newOrders);
                    };
                    audio.play().catch(e => {});
                }
             }, 10000);
             this.campaignTimeouts.push(finalTransmission);
        }
      },
      startGame: function () {
        this.isCampaign = false;
        if (this.player) {
            this.player.removeAttribute('animation__pull');
            this.player.setAttribute('position', '0 1.6 0');
        }
        const dust = document.querySelector('[cosmic-dust]');
        if (dust) dust.setAttribute('visible', 'true');
        this.menu.setAttribute('visible', 'false');
        const restartBtn = document.querySelector('#restart-button-rear');
        if (restartBtn) {
          restartBtn.setAttribute('visible', true);
          const interactive = restartBtn.querySelector('.button-disabled');
          if (interactive) {
            interactive.classList.remove('button-disabled');
            interactive.classList.add('button-interactive');
          }
        }
        const leaderboardPanel = document.querySelector('#leaderboard-panel');
        if (leaderboardPanel) {
          leaderboardPanel.setAttribute('visible', 'false');
        }
        const adPanel = document.querySelector('#ad-panel');
        if (adPanel) {
          adPanel.setAttribute('visible', 'false');
        }
        const menuButtons = this.menu.querySelectorAll('.button-interactive');
        menuButtons.forEach(btn => {
          if (btn.id !== 'sound-toggle') {
            btn.classList.remove('button-interactive');
            btn.classList.add('button-disabled');
          }
        });
        this.playGameplayMusic();
        this.isGameOver = false;
        this.currentScore = 0;
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'false');
          gameOverPanel.object3D.visible = false;
        }
        this.checkWeaponUnlocks();
        const laserShooterComp = document.querySelector('[laser-shooter]');
        if (laserShooterComp && laserShooterComp.components['laser-shooter']) {
          laserShooterComp.components['laser-shooter'].score = 0;
          const scoreDisplay = document.querySelector('#score-value');
          if (scoreDisplay) {
            scoreDisplay.setAttribute('value', '0');
            scoreDisplay.setAttribute('color', '#00FF00');
          }
        }
        this.el.sceneEl.addState('playing');
        this.starSystem.setAttribute('star-system', 'speed', 8);
        const spaceJunkSystem = document.querySelector('[space-junk-system]');
        if (spaceJunkSystem && spaceJunkSystem.components['space-junk-system']) {
            const system = spaceJunkSystem.components['space-junk-system'];
            if (system.clearTimeouts) system.clearTimeouts();
            system.junkObjects.forEach(junk => {
              if (junk && junk.parentNode) {
                if (junk && junk.parentNode) {
                  try { junk.parentNode.removeChild(junk); } catch(e) { dbgWarn('removeChild junk failed', e); }
                }
              }
            });
            system.junkObjects = [];
            const remainingJunk = document.querySelectorAll('.space-junk');
            remainingJunk.forEach(junk => {
              if (junk.parentNode) {
                if (junk && junk.parentNode) {
                  try { junk.parentNode.removeChild(junk); } catch(e) { dbgWarn('removeChild junk failed', e); }
                }
              }
            });
            system.spawnTimer = 0;
            system.maxJunk = 6; // increase starting max junk to make the game harder from the outset
            // create initial junk to fill up to max immediately
            try {
              for (let i = 0; i < system.maxJunk; i++) {
                system.createJunk();
              }
            } catch (e) {
              // ignore if createJunk isn't ready synchronously
            }
            system.destroyedCount = 0;
            system.escapedCount = 0;
            system.allowedEscapes = 0;
            system.gameOver = false;
            system.gameOverShown = false;
            system.difficultyLevel = 0;
            system.gameStartTime = Date.now();
        }
        const asteroidSystem = document.querySelector('[asteroid-system]');
        if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
          const astSystem = asteroidSystem.components['asteroid-system'];
          astSystem.asteroids.forEach(asteroid => {
            if (asteroid && asteroid.parentNode) {
              if (asteroid && asteroid.parentNode) {
                try { asteroid.parentNode.removeChild(asteroid); } catch(e) { dbgWarn('removeChild asteroid failed', e); }
              }
            }
          });
          astSystem.asteroids = [];
          astSystem.spawnTimer = 0;
          astSystem.maxAsteroids = 0;
          astSystem.initialSpawn = false;
        }
        const junkCounter = document.querySelector('#junk-counter');
        const escapeCounter = document.querySelector('#escape-counter');
        const scanCounter = document.querySelector('#scan-counter');
        if (junkCounter) {
          junkCounter.setAttribute('value', 'JUNK: 0');
        }
        if (escapeCounter) {
          escapeCounter.setAttribute('value', 'PASSES: 0');
          escapeCounter.setAttribute('color', '#ff0000');
        }
        if (scanCounter) {
          scanCounter.setAttribute('value', 'SCANS: 0');
        }
        const scanner = document.querySelector('[scanner]');
        if (scanner && scanner.components.scanner) {
          scanner.components.scanner.scanCount = 0;
          scanner.components.scanner.scanning = false;
          scanner.components.scanner.scanProgress = 0;
          scanner.components.scanner.currentTarget = null;
        }
        const laserShooter = document.querySelector('[laser-shooter]');
        if (laserShooter && laserShooter.components['laser-shooter']) {
          laserShooter.components['laser-shooter'].destroyedCount = 0;
          laserShooter.components['laser-shooter'].isTargeting = false;
          laserShooter.components['laser-shooter'].currentTarget = null;
          laserShooter.components['laser-shooter'].lockTimer = 0;
        }
        const hudLeft = document.querySelector('#hud-left');
        const hudRight = document.querySelector('#hud-right');
        const hudTop = document.querySelector('#hud-top');
        if (hudLeft) hudLeft.setAttribute('visible', 'true');
        if (hudRight) hudRight.setAttribute('visible', 'true');
        if (hudTop) hudTop.setAttribute('visible', 'true');
        const weaponMount = document.querySelector('#weapon-mount');
        if (weaponMount) weaponMount.setAttribute('visible', 'true');
        const weaponSelector = document.querySelector('#weapon-selector-panel');
        if (weaponSelector) {
            weaponSelector.setAttribute('visible', 'false');
            weaponSelector.setAttribute('scale', '0 0 0');
        }
        this.setWeaponSelectorInteractivity(false);
        const cursor = document.querySelector('[cursor]');
        if (cursor) {
          cursor.setAttribute('visible', 'false');
        }
        const menuCursor = document.querySelector('#menu-cursor');
        if (menuCursor) {
          menuCursor.setAttribute('visible', 'true');
          menuCursor.setAttribute('raycaster', 'enabled', true);
          menuCursor.setAttribute('material', 'opacity', 0.3);
        }
        const planetNameHud = document.querySelector('#planet-name-hud');
        if (planetNameHud) {
             planetNameHud.setAttribute('position', '-0.38 -0.05 -1');
             planetNameHud.setAttribute('scale', '1 1 1');
        }
      }
    });
