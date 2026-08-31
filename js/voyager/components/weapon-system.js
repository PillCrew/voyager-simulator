AFRAME.registerComponent('laser-shooter', {
      init: function() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 1500;
        this.camera = this.el.object3D;
        this.shooting = false;
        this.cooldown = 0;
        this.cooldownTime = 500;
        this.laserBeam = null;
        this.destroyedCount = 0;
        this.isTargeting = false;
        this.lockTimer = 0;
        this.lockDuration = 2000;
        this.currentTarget = null;
        this.isShowingTooFar = false;
        this.crosshairRings = [];
        this.crosshairLines = [];
        this.lockPanel = document.querySelector('#target-lock-panel');
        this.lockText = document.querySelector('#lock-text');
        this.lockBar = document.querySelector('#lock-progress-bar');
        this.tooFarPanel = document.querySelector('#too-far-panel');
        this.distanceText = document.querySelector('#distance-text');
        this.crosshairContainer = document.querySelector('[position="0 0 -1.5"]');
        this.weaponEls = {
          plasma: document.querySelector('#weapon-plasma'),
          laser: document.querySelector('#weapon-laser'),
          railgun: document.querySelector('#weapon-railgun'),
          photon: document.querySelector('#weapon-photon'),
          void: document.querySelector('#weapon-void'),
          omega: document.querySelector('#weapon-omega'),
          solar: document.querySelector('#weapon-solar')
        };
        this.score = 0;
        this.scoreDisplay = null;
        this.scoreLabel = null;
        this.scoreInitialized = false;
        this.explosionPlaylist = [];
        this._gameManagerEl = document.querySelector('[game-manager]');
        this._junkSystemEl = document.querySelector('[space-junk-system]');
        this._crosshairContainer = document.querySelector('[position="0 0 -1.5"]');
        this._raycastTargets = [];
        this._tmpVec = new THREE.Vector3();
        this._frameSkip = 0;
        this._scannerEl = document.querySelector('[scanner]');
        this._scanPanel = document.querySelector('#scan-panel');
        this._crosshairRingsEls = null;
        this._crosshairPlanesEls = null;
      },
      _getGameManager: function() {
        if (this._gameManagerEl && this._gameManagerEl.components && this._gameManagerEl.components['game-manager']) {
          return this._gameManagerEl.components['game-manager'];
        }
        this._gameManagerEl = document.querySelector('[game-manager]');
        return this._gameManagerEl && this._gameManagerEl.components ? this._gameManagerEl.components['game-manager'] : null;
      },
      _getJunkList: function() {
        if (!this._junkSystemEl || !this._junkSystemEl.components || !this._junkSystemEl.components['space-junk-system']) {
          this._junkSystemEl = document.querySelector('[space-junk-system]');
        }
        const system = this._junkSystemEl && this._junkSystemEl.components ? this._junkSystemEl.components['space-junk-system'] : null;
        return system && system.junkObjects ? system.junkObjects : [];
      },
      _findJunkElFromHitObject: function(obj) {
        let cur = obj;
        while (cur) {
          if (cur.userData && cur.userData.junkEl) return cur.userData.junkEl;
          cur = cur.parent;
        }
        return null;
      },
      initScoreElements: function() {
        if (!this.scoreInitialized) {
          this.scoreDisplay = document.querySelector('#score-value');
          this.scoreLabel = document.querySelector('#score-label');
          if (this.scoreDisplay && this.scoreLabel) {
            this.scoreInitialized = true;
          }
        }
      },
      addScore: function(points) {
        if (!points || points <= 0) return;
        this.initScoreElements();
        this.score += points;
        const gameManager = document.querySelector('[game-manager]');
        if (gameManager && gameManager.components['game-manager']) {
            gameManager.components['game-manager'].currentScore = this.score;
        }
        dbgLog('Score added:', points, 'Total:', this.score, 'Display exists:', !!this.scoreDisplay);
        if (!this.comboTimer) this.comboTimer = 0;
        if (!this.comboMultiplier) this.comboMultiplier = 1;
        const now = Date.now();
        if (now - this.comboTimer < 3000) {
          this.comboMultiplier = Math.min(this.comboMultiplier + 0.3, 3);
        } else {
          this.comboMultiplier = 1;
        }
        this.comboTimer = now;
        if (this.scoreDisplay) {
          this.scoreDisplay.setAttribute('value', this.score.toString());
          dbgLog('Score display updated to:', this.score);
          this.scoreDisplay.setAttribute('animation__pulse', {
            property: 'scale',
            from: '1 1 1',
            to: '1.2 1.2 1',
            dur: 150,
            dir: 'alternate',
            easing: 'easeInOutQuad',
            loop: false
          });
          const scoreDisplayEntity = document.querySelector('#score-display');
          if (this.scoreLabel) {
            this.scoreLabel.setAttribute('animation__flash', {
              property: 'color',
              from: '#FFD700',
              to: '#FFFF00',
              dur: 200,
              dir: 'alternate',
              easing: 'easeInOutQuad',
              loop: 2
            });
            this.scoreLabel.setAttribute('animation__pulse', {
              property: 'scale',
              from: '1 1 1',
              to: '1.15 1.15 1',
              dur: 200,
              dir: 'alternate',
              easing: 'easeInOutQuad',
              loop: false
            });
          }
          if (scoreDisplayEntity) {
            scoreDisplayEntity.setAttribute('animation__bigpulse', {
              property: 'scale',
              from: '1 1 1',
              to: '1.1 1.1 1',
              dur: 150,
              dir: 'alternate',
              easing: 'easeOutQuad',
              loop: false
            });
          }
        }
      },
      showLaserBeam: function(hit) {
        const crosshairContainer = this.crosshairContainer;
        let activeWeaponId = this.currentWeaponId || 'weapon-blaster';
        if (!this.currentWeaponId) {
           if (this.weaponEls.plasma && this.weaponEls.plasma.getAttribute('visible')) activeWeaponId = 'weapon-plasma';
           else if (this.weaponEls.laser && this.weaponEls.laser.getAttribute('visible')) activeWeaponId = 'weapon-laser';
           else if (this.weaponEls.railgun && this.weaponEls.railgun.getAttribute('visible')) activeWeaponId = 'weapon-railgun';
        }
        let beamColor = hit ? 0x00ff00 : 0xff0000;
        let glowColor = hit ? 0x88ff88 : 0xff8888;
        let beamWidth = 5;
        let glowWidth = 10;
        let flashColor = '#ffdd44';
        let startZ = -0.5;
        if (activeWeaponId === 'weapon-plasma') {
            beamColor = hit ? 0xff00ff : 0xff0000;
            glowColor = hit ? 0xff88ff : 0xff8888;
            beamWidth = 8;
            glowWidth = 15;
            flashColor = '#ff00ff';
            startZ = -0.55;
        } else if (activeWeaponId === 'weapon-laser') {
            beamColor = hit ? 0x00ff00 : 0xff0000;
            glowColor = hit ? 0x88ff88 : 0xff8888;
            beamWidth = 3;
            glowWidth = 6;
            flashColor = '#00ff00';
            startZ = -0.9;
        } else if (activeWeaponId === 'weapon-railgun') {
            beamColor = 0x00ffff;
            glowColor = 0x88ffff;
            beamWidth = 10;
            glowWidth = 25;
            flashColor = '#00ffff';
            startZ = -1.3;
        } else if (activeWeaponId === 'weapon-photon') {
            beamColor = 0xffffff;
            glowColor = 0x0088ff;
            beamWidth = 6;
            glowWidth = 12;
            flashColor = '#ffffff';
            startZ = -0.8;
        } else if (activeWeaponId === 'weapon-void') {
            beamColor = 0x4b0082;
            glowColor = 0x9400d3;
            beamWidth = 12;
            glowWidth = 20;
            flashColor = '#9400d3';
            startZ = -0.6;
        } else if (activeWeaponId === 'weapon-omega') {
            beamColor = 0xff0000;
            glowColor = 0x550000;
            beamWidth = 15;
            glowWidth = 30;
            flashColor = '#ff0000';
            startZ = -1.0;
        } else if (activeWeaponId === 'weapon-solar') {
            beamColor = 0xffd700;
            glowColor = 0xffaa00;
            beamWidth = 20;
            glowWidth = 40;
            flashColor = '#ffd700';
            startZ = -0.8;
        }
        if (crosshairContainer) {
          const muzzleFlash = document.createElement('a-circle');
          muzzleFlash.setAttribute('radius', '0.4');
          muzzleFlash.setAttribute('material', {
            color: flashColor,
            emissive: flashColor,
            emissiveIntensity: 4,
            transparent: true,
            opacity: 0.9,
            blending: 'additive'
          });
          muzzleFlash.setAttribute('animation__flash', {
            property: 'scale',
            from: '0.1 0.1 0.1',
            to: '3 3 3',
            dur: 100,
            easing: 'easeOutQuad'
          });
          muzzleFlash.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: '0.9',
            to: '0',
            dur: 100,
            easing: 'easeOutQuad'
          });
          crosshairContainer.appendChild(muzzleFlash);
          setTimeout(() => {
            if (muzzleFlash && muzzleFlash.parentNode) {
              muzzleFlash.parentNode.removeChild(muzzleFlash);
            }
          }, 100);
        }
        const laserGeometry = new THREE.BufferGeometry();
        const laserPositions = new Float32Array([
          0, -0.1, startZ,
          0, 0, -300
        ]);
        laserGeometry.setAttribute('position', new THREE.BufferAttribute(laserPositions, 3));
        const laserMaterial = new THREE.LineBasicMaterial({
          color: beamColor,
          transparent: true,
          opacity: 1.0,
          linewidth: beamWidth
        });
        this.laserBeam = new THREE.Line(laserGeometry, laserMaterial);
        this.el.object3D.add(this.laserBeam);
        const glowGeometry = new THREE.BufferGeometry();
        glowGeometry.setAttribute('position', new THREE.BufferAttribute(laserPositions, 3));
        const glowMaterial = new THREE.LineBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.5,
          linewidth: glowWidth
        });
        const glowBeam = new THREE.Line(glowGeometry, glowMaterial);
        this.el.object3D.add(glowBeam);
        if (this.crosshairContainer) {
          this.crosshairContainer.setAttribute('animation__flash', {
            property: 'scale',
            from: '1 1 1',
            to: '1.3 1.3 1.3',
            dur: 100,
            dir: 'alternate',
            loop: 1
          });
        }
        setTimeout(() => {
          if (this.laserBeam) {
            this.el.object3D.remove(this.laserBeam);
            this.laserBeam.geometry.dispose();
            this.laserBeam.material.dispose();
            this.laserBeam = null;
            this.el.object3D.remove(glowBeam);
            glowBeam.geometry.dispose();
            glowBeam.material.dispose();
          }
        }, 150);
      },
      destroyJunk: function(junk, hitPoint, isCombo = false) {
        if (junk.getAttribute('data-destroyed') === 'true') return;
        junk.setAttribute('data-destroyed', 'true');
        this.destroyedCount++;
        const junkCounter = document.querySelector('#junk-counter');
        if (junkCounter) {
          junkCounter.setAttribute('value', `JUNK: ${this.destroyedCount}`);
        }
        let points = 100;
        if (isCombo) {
            points = 300;
            this.showComboEffect(hitPoint, "COMBO!");
        }
        this.addScore(points);
        const junkSystem = document.querySelector('[space-junk-system]');
        if (junkSystem && junkSystem.components['space-junk-system']) {
          const system = junkSystem.components['space-junk-system'];
          const explosionRadius = 45;
          const potentialVictims = [...system.junkObjects];
          potentialVictims.forEach(otherJunk => {
              if (otherJunk !== junk && otherJunk.getAttribute('data-destroyed') !== 'true') {
                  const dist = otherJunk.object3D.position.distanceTo(hitPoint);
                  if (dist < explosionRadius) {
                      setTimeout(() => {
                          this.destroyJunk(otherJunk, otherJunk.object3D.position, true);
                      }, 150);
                  }
              }
          });
          system.destroyedCount++;
          if (this.destroyedCount % 5 === 0) {
            if (this.destroyedCount >= 10) {
              system.maxJunk += 3; // spawn a bit more junk as difficulty ramps
              this.showDifficultyIncrease(`DIFFICULTY UP! ${system.maxJunk} JUNK MAX`);
            } else {
              this.showDifficultyIncrease(`PROGRESS! ${this.destroyedCount} DESTROYED`);
            }
          }
          // Use a larger asteroid interval once player gets past 100 destroyed junk
          const asteroidInterval = this.destroyedCount >= 100 ? 50 : 16;
          if (this.destroyedCount % asteroidInterval === 0) {
            const asteroidSystem = document.querySelector('[asteroid-system]');
            if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
              setTimeout(() => {
                if (asteroidSystem.components['asteroid-system']) {
                    asteroidSystem.components['asteroid-system'].createAsteroid();
                }
              }, 0);
            }
          }
        }
        const gameManager = document.querySelector('[game-manager]').components['game-manager'];
        if (gameManager && gameManager.soundEnabled && !gameManager.isGameOver) {
            setTimeout(() => {
              if (!this.explosionPlaylist || this.explosionPlaylist.length === 0) {
                  this.explosionPlaylist = Array.from({length: 18}, (_, i) => i + 1);
                  for (let i = this.explosionPlaylist.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [this.explosionPlaylist[i], this.explosionPlaylist[j]] = [this.explosionPlaylist[j], this.explosionPlaylist[i]];
                  }
                  if (this.lastExplosionIndex && this.explosionPlaylist[this.explosionPlaylist.length - 1] === this.lastExplosionIndex) {
                      const lastPos = this.explosionPlaylist.length - 1;
                      [this.explosionPlaylist[lastPos], this.explosionPlaylist[0]] = [this.explosionPlaylist[0], this.explosionPlaylist[lastPos]];
                  }
              }
              const randomExplosionIndex = this.explosionPlaylist.pop();
              this.lastExplosionIndex = randomExplosionIndex;
              const explosionAudio = document.querySelector(`#explosion-audio-${randomExplosionIndex}`);
              if (explosionAudio) {
                explosionAudio.currentTime = 0;
                explosionAudio.volume = 0.8;
                explosionAudio.play().catch(err => dbgWarn(`Error playing explosion-audio-${randomExplosionIndex}:`, err));
              }
            }, 200);
        }
        this.createExplosion(hitPoint);
        setTimeout(() => {
          junk.remove();
          const junkSystem = document.querySelector('[space-junk-system]');
          if (junkSystem && junkSystem.components['space-junk-system']) {
            const system = junkSystem.components['space-junk-system'];
            const index = system.junkObjects.indexOf(junk);
            if (index > -1) {
              system.junkObjects.splice(index, 1);
            }
            if (system.junkObjects.length < system.maxJunk) {
              system.createJunk();
            }
          }
        }, 100);
      },
      showComboEffect: function(position, text) {
          const label = document.createElement('a-text');
          label.setAttribute('value', text);
          label.setAttribute('align', 'center');
          label.setAttribute('color', '#FFD700');
          label.setAttribute('scale', '0 0 0');
          label.setAttribute('position', position);
          label.setAttribute('look-at', '[camera]');
          label.setAttribute('animation__pop', {
              property: 'scale',
              to: '15 15 15',
              dur: 300,
              easing: 'easeOutBack'
          });
          label.setAttribute('animation__float', {
              property: 'position',
              to: `${position.x} ${position.y + 10} ${position.z}`,
              dur: 1000,
              easing: 'linear'
          });
          label.setAttribute('animation__fade', {
              property: 'opacity',
              from: 1,
              to: 0,
              delay: 500,
              dur: 500
          });
          this.el.sceneEl.appendChild(label);
          setTimeout(() => label.remove(), 1200);
      },
      createExplosion: function(position) {
          const type = Math.floor(Math.random() * 3);
          switch(type) {
              case 0: this.explosionFlash(position); break;
              case 1: this.explosionSparks(position); break;
              case 2: this.explosionShockwave(position); break;
          }
      },
      explosionFlash: function(position) {
          const flash = document.createElement('a-sphere');
          flash.setAttribute('radius', 0.5);
          flash.setAttribute('position', position);
          flash.setAttribute('material', {
            shader: 'flat',
            color: '#ffaa00',
            transparent: true,
            opacity: 1,
            side: 'double'
          });
          flash.setAttribute('animation__expand', {
            property: 'scale',
            from: '1 1 1',
            to: '10 10 10',
            dur: 220,
            easing: 'easeOutQuad'
          });
          flash.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: 220,
            easing: 'easeOutQuad'
          });
          this.el.sceneEl.appendChild(flash);
          setTimeout(() => {
            if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
          }, 260);
      },
      explosionSparks: function(position) {
          const particleCount = 6;
          for (let i = 0; i < particleCount; i++) {
            const spark = document.createElement('a-sphere');
            const radius = THREE.MathUtils.randFloat(0.1, 0.2);
            const dur = THREE.MathUtils.randInt(300, 500);
            const dir = new THREE.Vector3(
              THREE.MathUtils.randFloatSpread(1),
              THREE.MathUtils.randFloatSpread(1),
              THREE.MathUtils.randFloatSpread(1)
            ).normalize().multiplyScalar(THREE.MathUtils.randFloat(8, 15));
            spark.setAttribute('radius', radius);
            spark.setAttribute('position', position);
            spark.setAttribute('material', {
              shader: 'flat',
              color: '#ffffff',
              transparent: true,
              opacity: 1
            });
            spark.setAttribute('animation__move', {
              property: 'position',
              to: { x: position.x + dir.x, y: position.y + dir.y, z: position.z + dir.z },
              dur,
              easing: 'easeOutCubic'
            });
            spark.setAttribute('animation__fade', {
              property: 'material.opacity',
              from: 1,
              to: 0,
              dur,
              easing: 'easeOutQuad'
            });
            this.el.sceneEl.appendChild(spark);
            setTimeout(() => {
              if (spark && spark.parentNode) spark.parentNode.removeChild(spark);
            }, dur + 80);
          }
      },
      explosionShockwave: function(position) {
          const ring = document.createElement('a-ring');
          ring.setAttribute('radius-inner', 0.1);
          ring.setAttribute('radius-outer', 0.3);
          ring.setAttribute('position', position);
          ring.setAttribute('look-at', '[camera]');
          ring.setAttribute('material', {
            shader: 'flat',
            color: '#00ffff',
            transparent: true,
            opacity: 1,
            side: 'double'
          });
          ring.setAttribute('animation__grow', {
            property: 'scale',
            from: '1 1 1',
            to: '55 55 55',
            dur: 650,
            easing: 'easeOutQuad'
          });
          ring.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: 650,
            easing: 'easeOutQuad'
          });
          this.el.sceneEl.appendChild(ring);
          setTimeout(() => {
            if (ring && ring.parentNode) ring.parentNode.removeChild(ring);
          }, 720);
      },
      showDifficultyIncrease: function(message) {
        const difficultyPanel = document.querySelector('#difficulty-panel');
        const difficultyText = document.querySelector('#difficulty-text');
        if (difficultyPanel && difficultyText) {
          difficultyText.setAttribute('value', message);
          difficultyPanel.setAttribute('visible', 'true');
          setTimeout(() => {
            difficultyPanel.setAttribute('visible', 'false');
          }, 2500);
        }
      },
      explosionRealistic: function(position) {
        const coreFlash = document.createElement('a-sphere');
        coreFlash.setAttribute('radius', 2);
        coreFlash.setAttribute('color', '#ffffff');
        coreFlash.setAttribute('material', {
            shader: 'standard',
            emissive: '#ffffff',
            emissiveIntensity: 15,
            transparent: true,
            opacity: 1
        });
        coreFlash.setAttribute('position', position);
        coreFlash.setAttribute('animation__expand', {
            property: 'scale',
            from: '0.1 0.1 0.1',
            to: '8 8 8',
            dur: 100,
            easing: 'easeOutExpo'
        });
        coreFlash.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: 150,
            easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(coreFlash);
        setTimeout(() => coreFlash.remove(), 200);
        const fireball = document.createElement('a-sphere');
        fireball.setAttribute('radius', 4);
        fireball.setAttribute('color', '#ff4400');
        fireball.setAttribute('material', {
            shader: 'standard',
            emissive: '#ff2200',
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.9,
            roughness: 0.8
        });
        fireball.setAttribute('position', position);
        fireball.setAttribute('animation__expand', {
            property: 'scale',
            from: '0.5 0.5 0.5',
            to: '6 6 6',
            dur: 600,
            easing: 'easeOutQuad'
        });
        fireball.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 0.9,
            to: 0,
            dur: 600,
            easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(fireball);
        setTimeout(() => fireball.remove(), 650);
        const smoke = document.createElement('a-dodecahedron');
        smoke.setAttribute('radius', 5);
        smoke.setAttribute('color', '#222222');
        smoke.setAttribute('material', {
            shader: 'flat',
            transparent: true,
            opacity: 0.8
        });
        smoke.setAttribute('position', position);
        smoke.setAttribute('animation__expand', {
            property: 'scale',
            from: '1 1 1',
            to: '9 9 9',
            dur: 1500,
            easing: 'easeOutCubic'
        });
        smoke.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 0.8,
            to: 0,
            dur: 1500,
            easing: 'easeInQuad'
        });
        smoke.setAttribute('animation__rotate', {
            property: 'rotation',
            to: `${Math.random()*90} ${Math.random()*90} ${Math.random()*90}`,
            dur: 1500,
            easing: 'linear'
        });
        this.el.sceneEl.appendChild(smoke);
        setTimeout(() => smoke.remove(), 1550);
        for (let i = 0; i < 15; i++) {
            const debris = document.createElement('a-entity');
            const size = Math.random() * 0.5 + 0.2;
            debris.setAttribute('geometry', `primitive: box; width: ${size}; height: ${size}; depth: ${size}`);
            debris.setAttribute('material', {
                color: Math.random() > 0.5 ? '#ffaa00' : '#444444',
                emissive: '#ff4400',
                emissiveIntensity: 2
            });
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 20 + Math.random() * 30;
            const dir = {
                x: Math.sin(phi) * Math.cos(theta),
                y: Math.sin(phi) * Math.sin(theta),
                z: Math.cos(phi)
            };
            debris.setAttribute('position', position);
            debris.setAttribute('animation__move', {
                property: 'position',
                to: {
                    x: position.x + dir.x * speed,
                    y: position.y + dir.y * speed,
                    z: position.z + dir.z * speed
                },
                dur: 1000,
                easing: 'easeOutExpo'
            });
            debris.setAttribute('animation__spin', {
                property: 'rotation',
                to: `${Math.random()*720} ${Math.random()*720} ${Math.random()*720}`,
                dur: 1000
            });
            debris.setAttribute('animation__fade', {
                property: 'scale',
                to: '0 0 0',
                dur: 1000,
                easing: 'easeInQuad'
            });
            this.el.sceneEl.appendChild(debris);
            setTimeout(() => debris.remove(), 1050);
        }
      },
      explosionBlackHole: function(position) {
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('radius', 15);
        sphere.setAttribute('position', position);
        sphere.setAttribute('material', {
            shader: 'flat',
            color: '#000000',
            transparent: true,
            opacity: 0.95
        });
        sphere.setAttribute('animation__suck', {
            property: 'scale',
            from: '1 1 1',
            to: '0.01 0.01 0.01',
            dur: 250,
            easing: 'easeInExpo'
        });
        this.el.sceneEl.appendChild(sphere);
        setTimeout(() => {
            if (sphere.parentNode) sphere.remove();
            const shockwave = document.createElement('a-torus');
            shockwave.setAttribute('radius', 20);
            shockwave.setAttribute('radius-tubular', 1.5);
            shockwave.setAttribute('position', position);
            shockwave.setAttribute('rotation', '90 0 0');
            shockwave.setAttribute('material', {
                shader: 'standard',
                color: '#9400D3',
                emissive: '#8A2BE2',
                emissiveIntensity: 4,
                transparent: true,
                opacity: 1
            });
            shockwave.setAttribute('animation__expand', {
                property: 'scale',
                from: '0.1 0.1 0.1',
                to: '3 3 3',
                dur: 500,
                easing: 'easeOutQuad'
            });
            shockwave.setAttribute('animation__fade', {
                property: 'material.opacity',
                from: 1,
                to: 0,
                dur: 500,
                easing: 'easeInQuad'
            });
            this.el.sceneEl.appendChild(shockwave);
            setTimeout(() => { if (shockwave.parentNode) shockwave.remove(); }, 550);
        }, 250);
      },
      explosionDigital: function(position) {
        for (let i = 0; i < 50; i++) {
            const cube = document.createElement('a-box');
            const size = 0.5 + Math.random() * 1.5;
            cube.setAttribute('width', size);
            cube.setAttribute('height', size);
            cube.setAttribute('depth', size);
            cube.setAttribute('position', position);
            cube.setAttribute('material', {
                shader: 'standard',
                color: '#00ff00',
                emissive: '#00ff00',
                emissiveIntensity: 3,
                wireframe: true,
                opacity: 1,
                transparent: true
            });
            const toPos = {
                x: position.x + (Math.random() - 0.5) * 40,
                y: position.y + (Math.random() - 0.5) * 40,
                z: position.z + (Math.random() - 0.5) * 40
            };
            cube.setAttribute('animation__move', {
                property: 'position',
                to: `${toPos.x} ${toPos.y} ${toPos.z}`,
                dur: 1000,
                easing: 'easeOutQuad'
            });
            cube.setAttribute('animation__glitch', {
                property: 'material.opacity',
                from: 1,
                to: 0,
                dur: 1000,
                easing: 'steps(4)'
            });
            this.el.sceneEl.appendChild(cube);
            setTimeout(() => { if (cube.parentNode) cube.remove(); }, 1050);
        }
      },
      explosionNebula: function(position) {
        const colors = ['#FF00FF', '#00FFFF', '#FFD700'];
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('a-sphere');
            cloud.setAttribute('radius', 8);
            cloud.setAttribute('position', position);
            cloud.setAttribute('material', {
                shader: 'standard',
                color: colors[i],
                emissive: colors[i],
                emissiveIntensity: 1,
                transparent: true,
                opacity: 0.6,
                blending: 'additive'
            });
            const scaleTo = 5 + Math.random() * 3;
            cloud.setAttribute('animation__expand', {
                property: 'scale',
                from: '0.1 0.1 0.1',
                to: `${scaleTo} ${scaleTo} ${scaleTo}`,
                dur: 2000,
                easing: 'easeOutCubic'
            });
            cloud.setAttribute('animation__fade', {
                property: 'material.opacity',
                from: 0.6,
                to: 0,
                dur: 2000,
                easing: 'easeInQuad'
            });
            this.el.sceneEl.appendChild(cloud);
            setTimeout(() => { if (cloud.parentNode) cloud.remove(); }, 2050);
        }
      },
      explosionSonic: function(position) {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                const ring = document.createElement('a-ring');
                ring.setAttribute('radius-inner', 0.1);
                ring.setAttribute('radius-outer', 2);
                ring.setAttribute('position', position);
                ring.setAttribute('look-at', '[camera]');
                ring.setAttribute('material', {
                    shader: 'standard',
                    color: '#FFFFFF',
                    emissive: '#FFFFFF',
                    emissiveIntensity: 2,
                    transparent: true,
                    opacity: 0.9,
                    side: 'double'
                });
                ring.setAttribute('animation__expand', {
                    property: 'scale',
                    from: '1 1 1',
                    to: '25 25 25',
                    dur: 800,
                    easing: 'easeOutCubic'
                });
                ring.setAttribute('animation__fade', {
                    property: 'material.opacity',
                    from: 0.9,
                    to: 0,
                    dur: 800,
                    easing: 'easeInQuad'
                });
                this.el.sceneEl.appendChild(ring);
                setTimeout(() => { if (ring.parentNode) ring.remove(); }, 850);
            }, i * 100);
        }
      },
      explosionElectrical: function(position) {
        const flash = document.createElement('a-sphere');
        flash.setAttribute('radius', 6);
        flash.setAttribute('color', '#0088ff');
        flash.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
        flash.setAttribute('position', position);
        flash.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.1 0.1 0.1',
          to: '2.5 2.5 2.5',
          dur: 150,
          easing: 'easeOutQuad'
        });
        flash.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 150,
          easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(flash);
        setTimeout(() => flash.remove(), 200);
        const shockwave = document.createElement('a-ring');
        shockwave.setAttribute('radius-inner', 1);
        shockwave.setAttribute('radius-outer', 2);
        shockwave.setAttribute('color', '#0099ff');
        shockwave.setAttribute('material', 'shader: flat; opacity: 0.9; transparent: true; side: double');
        shockwave.setAttribute('position', position);
        shockwave.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
        shockwave.setAttribute('animation__grow', {
          property: 'scale',
          from: '0.3 0.3 0.3',
          to: '5 5 5',
          dur: 600,
          easing: 'easeOutQuad'
        });
        shockwave.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 0.9,
          to: 0,
          dur: 600,
          easing: 'easeOutQuad'
        });
        this.el.sceneEl.appendChild(shockwave);
        setTimeout(() => shockwave.remove(), 650);
        for (let i = 0; i < 15; i++) {
          const spark = document.createElement('a-sphere');
          spark.setAttribute('radius', THREE.MathUtils.randFloat(0.08, 0.2));
          spark.setAttribute('color', '#00ddff');
          spark.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
          const sparkDir = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(30),
            THREE.MathUtils.randFloatSpread(30),
            THREE.MathUtils.randFloatSpread(30)
          );
          spark.setAttribute('position', position);
          spark.setAttribute('animation__fly', {
            property: 'position',
            to: { x: position.x + sparkDir.x, y: position.y + sparkDir.y, z: position.z + sparkDir.z },
            dur: THREE.MathUtils.randInt(200, 600),
            easing: 'linear'
          });
          spark.setAttribute('animation__dim', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: THREE.MathUtils.randInt(200, 600),
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(spark);
          setTimeout(() => spark.remove(), 650);
        }
      },
      explosionNuclear: function(position) {
        const flash = document.createElement('a-sphere');
        flash.setAttribute('radius', 15);
        flash.setAttribute('color', '#ffffff');
        flash.setAttribute('material', {
          shader: 'standard',
          emissive: '#ffff00',
          emissiveIntensity: 10,
          transparent: true,
          opacity: 1,
          roughness: 0,
          metalness: 1
        });
        flash.setAttribute('position', position);
        flash.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.2 0.2 0.2',
          to: '5 5 5',
          dur: 350,
          easing: 'easeOutCubic'
        });
        flash.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 350,
          easing: 'easeInCubic'
        });
        this.el.sceneEl.appendChild(flash);
        setTimeout(() => flash.remove(), 350);
        const shockwave = document.createElement('a-ring');
        shockwave.setAttribute('radius-inner', 3);
        shockwave.setAttribute('radius-outer', 4);
        shockwave.setAttribute('color', '#ffaa00');
        shockwave.setAttribute('material', 'shader: flat; opacity: 1; transparent: true; side: double');
        shockwave.setAttribute('position', position);
        shockwave.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
        shockwave.setAttribute('animation__grow', {
          property: 'scale',
          from: '1 1 1',
          to: '12 12 12',
          dur: 600,
          easing: 'easeOutQuad'
        });
        shockwave.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 600,
          easing: 'easeOutQuad'
        });
        this.el.sceneEl.appendChild(shockwave);
        setTimeout(() => shockwave.remove(), 650);
        for (let i = 0; i < 10; i++) {
          const particle = document.createElement('a-entity');
          const size = THREE.MathUtils.randFloat(0.6, 1.5);
          particle.setAttribute('geometry', `primitive: sphere; radius: ${size}`);
          const color = '#ffffaa';
          const emissiveIntensity = THREE.MathUtils.randFloat(5, 7);
          particle.setAttribute('material', `shader: flat; opacity: 1.0; color: ${color}; transparent: true`);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = THREE.MathUtils.randFloat(15, 30);
          const direction = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
          );
          particle.setAttribute('position', position);
          particle.setAttribute('animation__move', {
            property: 'position',
            to: { x: position.x + direction.x, y: position.y + direction.y, z: position.z + direction.z },
            dur: THREE.MathUtils.randInt(600, 1200),
            easing: 'easeOutCubic'
          });
          particle.setAttribute('animation__rotate', {
            property: 'rotation',
            to: `${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)}`,
            dur: THREE.MathUtils.randInt(600, 1200),
            easing: 'linear'
          });
          particle.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: THREE.MathUtils.randInt(600, 1200),
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(particle);
          setTimeout(() => particle.remove(), 1300);
        }
        const smoke = document.createElement('a-sphere');
        smoke.setAttribute('radius', 5);
        smoke.setAttribute('color', '#ffaa00');
        smoke.setAttribute('material', 'shader: flat; opacity: 0.7; transparent: true; side: double');
        smoke.setAttribute('position', position);
        smoke.setAttribute('animation__expand', {
          property: 'scale',
          from: '1 1 1',
          to: '10 10 10',
          dur: 1600,
          easing: 'easeOutQuad'
        });
        smoke.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 0.7,
          to: 0,
          dur: 1600,
          easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(smoke);
        setTimeout(() => smoke.remove(), 1650);
      },
      explosionStructural: function(position) {
        const flash = document.createElement('a-sphere');
        flash.setAttribute('radius', 7);
        flash.setAttribute('color', '#dddddd');
        flash.setAttribute('material', {
          shader: 'standard',
          emissive: '#cccccc',
          emissiveIntensity: 4,
          transparent: true,
          opacity: 1,
          roughness: 0.2,
          metalness: 0.8
        });
        flash.setAttribute('position', position);
        flash.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.3 0.3 0.3',
          to: '2.5 2.5 2.5',
          dur: 120,
          easing: 'easeOutCubic'
        });
        flash.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 120,
          easing: 'easeInCubic'
        });
        this.el.sceneEl.appendChild(flash);
        setTimeout(() => flash.remove(), 150);
        const shockwave = document.createElement('a-ring');
        shockwave.setAttribute('radius-inner', 1.5);
        shockwave.setAttribute('radius-outer', 2.5);
        shockwave.setAttribute('color', '#888888');
        shockwave.setAttribute('material', 'shader: flat; opacity: 0.6; transparent: true; side: double');
        shockwave.setAttribute('position', position);
        shockwave.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
        shockwave.setAttribute('animation__grow', {
          property: 'scale',
          from: '0.5 0.5 0.5',
          to: '4 4 4',
          dur: 500,
          easing: 'easeOutQuad'
        });
        shockwave.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 0.6,
          to: 0,
          dur: 500,
          easing: 'easeOutQuad'
        });
        this.el.sceneEl.appendChild(shockwave);
        setTimeout(() => shockwave.remove(), 550);
        for (let i = 0; i < 10; i++) {
          const particle = document.createElement('a-entity');
          const size = THREE.MathUtils.randFloat(0.5, 1.3);
          if (Math.random() < 0.5) {
            particle.setAttribute('geometry', `primitive: box; width: ${size}; height: ${size * 0.3}; depth: ${size * 0.8}`);
          } else {
            particle.setAttribute('geometry', `primitive: tetrahedron; radius: ${size}`);
          }
          const metalColor = ['#999999', '#aaaaaa', '#888888'][Math.floor(Math.random() * 3)];
          particle.setAttribute('material', `shader: flat; opacity: 1.0; color: ${metalColor}; transparent: true`);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = THREE.MathUtils.randFloat(4, 12);
          const direction = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
          );
          particle.setAttribute('position', position);
          particle.setAttribute('animation__move', {
            property: 'position',
            to: { x: position.x + direction.x, y: position.y + direction.y, z: position.z + direction.z },
            dur: THREE.MathUtils.randInt(1200, 2000),
            easing: 'easeInQuad'
          });
          particle.setAttribute('animation__rotate', {
            property: 'rotation',
            to: `${THREE.MathUtils.randInt(180, 540)} ${THREE.MathUtils.randInt(180, 540)} ${THREE.MathUtils.randInt(180, 540)}`,
            dur: THREE.MathUtils.randInt(1200, 2000),
            easing: 'linear'
          });
          particle.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: THREE.MathUtils.randInt(1200, 2000),
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(particle);
          setTimeout(() => particle.remove(), 2100);
        }
      },
      explosionVolatile: function(position) {
        const flash1 = document.createElement('a-sphere');
        flash1.setAttribute('radius', 8);
        flash1.setAttribute('color', '#ff0000');
        flash1.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
        flash1.setAttribute('position', position);
        flash1.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.1 0.1 0.1',
          to: '3 3 3',
          dur: 200,
          easing: 'easeOutQuad'
        });
        flash1.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 200,
          easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(flash1);
        setTimeout(() => flash1.remove(), 250);
        setTimeout(() => {
          const flash2 = document.createElement('a-sphere');
          flash2.setAttribute('radius', 6);
          flash2.setAttribute('color', '#ff6600');
          flash2.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
          flash2.setAttribute('position', { x: position.x + THREE.MathUtils.randFloatSpread(3), y: position.y + THREE.MathUtils.randFloatSpread(3), z: position.z + THREE.MathUtils.randFloatSpread(3) });
          flash2.setAttribute('animation__expand', {
            property: 'scale',
            from: '0.15 0.15 0.15',
            to: '2.5 2.5 2.5',
            dur: 150,
            easing: 'easeOutQuad'
          });
          flash2.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: 150,
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(flash2);
          setTimeout(() => flash2.remove(), 200);
        }, 150);
        for (let w = 0; w < 2; w++) {
          setTimeout(() => {
            const shockwave = document.createElement('a-ring');
            shockwave.setAttribute('radius-inner', 1 + w);
            shockwave.setAttribute('radius-outer', 2 + w);
            shockwave.setAttribute('color', '#ff4400');
            shockwave.setAttribute('material', 'shader: flat; opacity: 0.8; transparent: true; side: double');
            shockwave.setAttribute('position', position);
            shockwave.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
            shockwave.setAttribute('animation__grow', {
              property: 'scale',
              from: '0.5 0.5 0.5',
              to: `${6 + w * 2} ${6 + w * 2} ${6 + w * 2}`,
              dur: 700,
              easing: 'easeOutQuad'
            });
            shockwave.setAttribute('animation__fade', {
              property: 'material.opacity',
              from: 0.8,
              to: 0,
              dur: 700,
              easing: 'easeOutQuad'
            });
            this.el.sceneEl.appendChild(shockwave);
            setTimeout(() => shockwave.remove(), 750);
          }, w * 200);
        }
        for (let wave = 0; wave < 2; wave++) {
          setTimeout(() => {
            for (let i = 0; i < 8; i++) {
              const particle = document.createElement('a-entity');
              const size = THREE.MathUtils.randFloat(0.4, 1.0);
              particle.setAttribute('geometry', `primitive: sphere; radius: ${size}`);
              const colors = ['#ff0000', '#ff6600', '#ffaa00', '#ffff00'];
              const color = colors[Math.floor(Math.random() * colors.length)];
              particle.setAttribute('material', `shader: flat; opacity: 1.0; color: ${color}; transparent: true`);
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              const speed = THREE.MathUtils.randFloat(10, 25);
              const direction = new THREE.Vector3(
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.sin(phi) * Math.sin(theta),
                speed * Math.cos(phi)
              );
              particle.setAttribute('position', position);
              particle.setAttribute('animation__move', {
                property: 'position',
                to: { x: position.x + direction.x, y: position.y + direction.y, z: position.z + direction.z },
                dur: THREE.MathUtils.randInt(800, 1400),
                easing: 'easeOutCubic'
              });
              particle.setAttribute('animation__rotate', {
                property: 'rotation',
                to: `${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)}`,
                dur: THREE.MathUtils.randInt(800, 1400),
                easing: 'linear'
              });
              particle.setAttribute('animation__fade', {
                property: 'material.opacity',
                from: 1,
                to: 0,
                dur: THREE.MathUtils.randInt(800, 1400),
                easing: 'easeInQuad'
              });
              this.el.sceneEl.appendChild(particle);
              setTimeout(() => particle.remove(), 1500);
            }
          }, wave * 300);
        }
      },
      explosionPlasma: function(position) {
        const plasmaFlash = document.createElement('a-sphere');
        plasmaFlash.setAttribute('radius', 13);
        plasmaFlash.setAttribute('color', '#00ddff');
        plasmaFlash.setAttribute('material', {
          shader: 'standard',
          emissive: '#00ccff',
          emissiveIntensity: 12,
          transparent: true,
          opacity: 1,
          roughness: 0,
          metalness: 1
        });
        plasmaFlash.setAttribute('position', position);
        plasmaFlash.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.2 0.2 0.2',
          to: '5 5 5',
          dur: 280,
          easing: 'easeOutCubic'
        });
        plasmaFlash.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 280,
          easing: 'easeInQuad'
        });
        this.el.sceneEl.appendChild(plasmaFlash);
        setTimeout(() => plasmaFlash.remove(), 300);
        for (let arc = 0; arc < 3; arc++) {
          setTimeout(() => {
            const arcGeometry = new THREE.BufferGeometry();
            const arcPoints = [];
            const numPoints = 20;
            arcPoints.push(0, 0, 0);
            for (let i = 1; i < numPoints; i++) {
              const t = i / numPoints;
              const angle = (arc / 8) * Math.PI * 2 + Math.sin(t * Math.PI * 3) * 0.5;
              const radius = t * 25 + Math.sin(t * Math.PI * 6) * 3;
              const height = Math.sin(t * Math.PI) * 8;
              arcPoints.push(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
              );
            }
            arcGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arcPoints), 3));
            const arcMaterial = new THREE.LineBasicMaterial({
              color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 1, 0.7),
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              linewidth: 2
            });
            const arcLine = new THREE.Line(arcGeometry, arcMaterial);
            arcLine.position.copy(position);
            arcLine.userData = {
              startTime: Date.now(),
              duration: THREE.MathUtils.randInt(300, 600),
              rotationSpeed: THREE.MathUtils.randFloat(-5, 5)
            };
            this.el.sceneEl.object3D.add(arcLine);
            setTimeout(() => {
              this.el.sceneEl.object3D.remove(arcLine);
              arcGeometry.dispose();
              arcMaterial.dispose();
            }, 700);
          }, arc * 50);
        }
        for (let orb = 0; orb < 3; orb++) {
          const plasmaOrb = document.createElement('a-sphere');
          plasmaOrb.setAttribute('radius', THREE.MathUtils.randFloat(1.5, 3));
          plasmaOrb.setAttribute('color', '#0088ff');
          plasmaOrb.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
          const angle = (orb / 6) * Math.PI * 2;
          const distance = THREE.MathUtils.randFloat(8, 15);
          plasmaOrb.setAttribute('position', {
            x: position.x + Math.cos(angle) * distance,
            y: position.y + Math.sin(angle) * distance,
            z: position.z + Math.cos(angle * 2) * distance
          });
          plasmaOrb.setAttribute('animation__orbit', {
            property: 'position',
            to: {
              x: position.x + Math.cos(angle + Math.PI * 2) * distance,
              y: position.y + Math.sin(angle + Math.PI * 2) * distance,
              z: position.z + Math.cos((angle + Math.PI * 2) * 2) * distance
            },
            dur: THREE.MathUtils.randInt(600, 1000),
            easing: 'easeInOutQuad'
          });
          plasmaOrb.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: THREE.MathUtils.randInt(600, 1000),
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(plasmaOrb);
          setTimeout(() => plasmaOrb.remove(), 1100);
        }
        for (let ring = 0; ring < 2; ring++) {
          setTimeout(() => {
            const plasmaRing = document.createElement('a-ring');
            plasmaRing.setAttribute('radius-inner', ring * 5 + 2);
            plasmaRing.setAttribute('radius-outer', ring * 5 + 8);
            plasmaRing.setAttribute('color', '#0044aa');
            plasmaRing.setAttribute('material', 'shader: flat; opacity: 0.8; transparent: true; side: double');
            plasmaRing.setAttribute('position', position);
            plasmaRing.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
            plasmaRing.setAttribute('animation__expand', {
              property: 'scale',
              from: '0.5 0.5 0.5',
              to: '3 3 3',
              dur: 800,
              easing: 'easeOutQuad'
            });
            plasmaRing.setAttribute('animation__fade', {
              property: 'material.opacity',
              from: 0.8,
              to: 0,
              dur: 800,
              easing: 'easeOutQuad'
            });
            this.el.sceneEl.appendChild(plasmaRing);
            setTimeout(() => plasmaRing.remove(), 850);
          }, ring * 150);
        }
      },
      explosionFragmentation: function(position) {
        const fragFlash = document.createElement('a-sphere');
        fragFlash.setAttribute('radius', 10);
        fragFlash.setAttribute('color', '#ffaa44');
        fragFlash.setAttribute('material', {
          shader: 'standard',
          emissive: '#ff8800',
          emissiveIntensity: 9,
          transparent: true,
          opacity: 1,
          roughness: 0,
          metalness: 1
        });
        fragFlash.setAttribute('position', position);
        fragFlash.setAttribute('animation__expand', {
          property: 'scale',
          from: '0.3 0.3 0.3',
          to: '3.5 3.5 3.5',
          dur: 180,
          easing: 'easeOutCubic'
        });
        fragFlash.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 180,
          easing: 'easeInCubic'
        });
        this.el.sceneEl.appendChild(fragFlash);
        setTimeout(() => fragFlash.remove(), 220);
        const shockwave = document.createElement('a-ring');
        shockwave.setAttribute('radius-inner', 1.5);
        shockwave.setAttribute('radius-outer', 3);
        shockwave.setAttribute('color', '#ff4400');
        shockwave.setAttribute('material', 'shader: flat; opacity: 1; transparent: true; side: double');
        shockwave.setAttribute('position', position);
        shockwave.setAttribute('rotation', `${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)} ${THREE.MathUtils.randInt(0, 360)}`);
        shockwave.setAttribute('animation__grow', {
          property: 'scale',
          from: '0.8 0.8 0.8',
          to: '6 6 6',
          dur: 400,
          easing: 'easeOutQuad'
        });
        shockwave.setAttribute('animation__fade', {
          property: 'material.opacity',
          from: 1,
          to: 0,
          dur: 400,
          easing: 'easeOutQuad'
        });
        this.el.sceneEl.appendChild(shockwave);
        setTimeout(() => shockwave.remove(), 450);
        const numFragments = THREE.MathUtils.randInt(3, 6);
        for (let frag = 0; frag < numFragments; frag++) {
          setTimeout(() => {
            const fragAngle = (frag / numFragments) * Math.PI * 2;
            const fragDistance = THREE.MathUtils.randFloat(3, 8);
            const fragHeight = THREE.MathUtils.randFloatSpread(4);
            const fragPos = {
              x: position.x + Math.cos(fragAngle) * fragDistance,
              y: position.y + fragHeight,
              z: position.z + Math.sin(fragAngle) * fragDistance
            };
            const fragExplosion = document.createElement('a-sphere');
            fragExplosion.setAttribute('radius', THREE.MathUtils.randFloat(0.8, 2));
            fragExplosion.setAttribute('color', '#ffaa00');
            fragExplosion.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
            fragExplosion.setAttribute('position', fragPos);
            fragExplosion.setAttribute('animation__burst', {
              property: 'scale',
              from: '0.2 0.2 0.2',
              to: '1.5 1.5 1.5',
              dur: 200,
              easing: 'easeOutQuad'
            });
            fragExplosion.setAttribute('animation__fade', {
              property: 'material.opacity',
              from: 1,
              to: 0,
              dur: 200,
              easing: 'easeInQuad'
            });
            this.el.sceneEl.appendChild(fragExplosion);
            setTimeout(() => fragExplosion.remove(), 250);
            for (let spark = 0; spark < 3; spark++) {
              const sparkEntity = document.createElement('a-sphere');
              sparkEntity.setAttribute('radius', 0.1);
              sparkEntity.setAttribute('color', '#ffff00');
              sparkEntity.setAttribute('material', 'shader: flat; opacity: 1; transparent: true');
              const sparkDir = new THREE.Vector3(
                THREE.MathUtils.randFloatSpread(8),
                THREE.MathUtils.randFloatSpread(8),
                THREE.MathUtils.randFloatSpread(8)
              );
              sparkEntity.setAttribute('position', fragPos);
              sparkEntity.setAttribute('animation__spark', {
                property: 'position',
                to: {
                  x: fragPos.x + sparkDir.x,
                  y: fragPos.y + sparkDir.y,
                  z: fragPos.z + sparkDir.z
                },
                dur: THREE.MathUtils.randInt(150, 300),
                easing: 'linear'
              });
              sparkEntity.setAttribute('animation__sparkFade', {
                property: 'material.opacity',
                from: 1,
                to: 0,
                dur: THREE.MathUtils.randInt(150, 300),
                easing: 'easeInQuad'
              });
              this.el.sceneEl.appendChild(sparkEntity);
              setTimeout(() => sparkEntity.remove(), 350);
            }
          }, frag * 30);
        }
        for (let extraFrag = 0; extraFrag < 8; extraFrag++) {
          const particle = document.createElement('a-entity');
          const size = THREE.MathUtils.randFloat(0.3, 0.8);
          if (Math.random() < 0.4) {
            particle.setAttribute('geometry', `primitive: box; width: ${size}; height: ${size * 0.5}; depth: ${size * 0.3}`);
          } else if (Math.random() < 0.7) {
            particle.setAttribute('geometry', `primitive: tetrahedron; radius: ${size}`);
          } else {
            particle.setAttribute('geometry', `primitive: octahedron; radius: ${size}`);
          }
          const fragColors = ['#ff6600', '#ff8800', '#ffaa00', '#ffcc00'];
          const color = fragColors[Math.floor(Math.random() * fragColors.length)];
          particle.setAttribute('material', `shader: flat; opacity: 1.0; color: ${color}; transparent: true`);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = THREE.MathUtils.randFloat(12, 25);
          const direction = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
          );
          particle.setAttribute('position', position);
          particle.setAttribute('animation__move', {
            property: 'position',
            to: { x: position.x + direction.x, y: position.y + direction.y, z: position.z + direction.z },
            dur: THREE.MathUtils.randInt(600, 1200),
            easing: 'easeOutCubic'
          });
          particle.setAttribute('animation__rotate', {
            property: 'rotation',
            to: `${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)} ${THREE.MathUtils.randInt(360, 720)}`,
            dur: THREE.MathUtils.randInt(600, 1200),
            easing: 'linear'
          });
          particle.setAttribute('animation__shrink', {
            property: 'scale',
            from: '1 1 1',
            to: '0.2 0.2 0.2',
            dur: THREE.MathUtils.randInt(800, 1200),
            easing: 'easeInQuad'
          });
          particle.setAttribute('animation__fade', {
            property: 'material.opacity',
            from: 1,
            to: 0,
            dur: THREE.MathUtils.randInt(800, 1200),
            easing: 'easeInQuad'
          });
          this.el.sceneEl.appendChild(particle);
          setTimeout(() => particle.remove(), 1300);
        }
      },
      tick: function(time, deltaTime) {
        const gm = this._getGameManager();
        if (gm && gm.isGameOver) {
          return;
        }
        if (!this.scoreInitialized) {
          this.initScoreElements();
        }
        if (gm) {
          const currentWeapon = gm.currentWeaponId || 'weapon-blaster';
            this.currentWeaponId = currentWeapon;
            if (currentWeapon === 'weapon-railgun') {
                this.lockDuration = 1800;
            } else if (currentWeapon === 'weapon-photon') {
                this.lockDuration = 1700;
            } else if (currentWeapon === 'weapon-void') {
                this.lockDuration = 1600;
            } else if (currentWeapon === 'weapon-omega') {
                this.lockDuration = 1500;
            } else if (currentWeapon === 'weapon-solar') {
                this.lockDuration = 1300;
            } else {
                this.lockDuration = 2000;
            }
        }
        if (this.cooldown > 0) {
          this.cooldown -= deltaTime;
        }
        if (!this.el.sceneEl.is('playing')) return;

        // Heavy work (raycasts + DOM) every other frame for Quest/VR performance
        this._frameSkip++;
        const doHeavy = (this._frameSkip % 2 === 0);
        const effectiveDeltaTime = doHeavy ? (deltaTime * 2) : deltaTime;

        const camera = this.el.components.camera.camera;
        if (!this.cameraWorldQuaternion) {
          this.cameraWorldQuaternion = new THREE.Quaternion();
          this.cameraWorldPosition = new THREE.Vector3();
          this.direction = new THREE.Vector3();
        }
        camera.getWorldQuaternion(this.cameraWorldQuaternion);
        camera.getWorldPosition(this.cameraWorldPosition);
        this.direction.set(0, 0, -1).applyQuaternion(this.cameraWorldQuaternion);

        if (!doHeavy) {
          return;
        }

        this.raycaster.set(this.cameraWorldPosition, this.direction);
        const junkList = this._getJunkList();
        this._raycastTargets.length = 0;
        const far = this.raycaster.far || 1500;
        const farSq = far * far;
        for (let i = 0; i < junkList.length; i++) {
          const junk = junkList[i];
          if (!junk || !junk.parentNode) continue;
          if (junk.dataset.destroyed === 'true') continue;
          if (junk.object3D) {
            this._tmpVec.copy(junk.object3D.position).sub(this.cameraWorldPosition);
            if (this._tmpVec.lengthSq() > farSq) continue;
            if (this._tmpVec.dot(this.direction) <= 0) continue;
            this._raycastTargets.push(junk.object3D);
          }
        }
        let targetedJunk = null;
        let targeting = false;
        let tooFarJunk = null;
        let tooFarDistance = 0;
        if (this._raycastTargets.length > 0) {
          const hits = this.raycaster.intersectObjects(this._raycastTargets, true);
          for (let h = 0; h < hits.length; h++) {
            const hit = hits[h];
            const junk = this._findJunkElFromHitObject(hit.object);
            if (!junk || !junk.parentNode) continue;
            if (junk.getAttribute('data-destroyed') === 'true') continue;
            const distance = hit.distance;
            if (distance < 400) {
              targeting = true;
              targetedJunk = junk;
              break;
            }
            if (!tooFarJunk && distance < 1500) {
              tooFarJunk = junk;
              tooFarDistance = distance;
            }
          }
        }
        const crosshairContainer = this._crosshairContainer || (this._crosshairContainer = document.querySelector('[position="0 0 -1.5"]'));
        if (targeting && targetedJunk) {
          if (this.tooFarPanel) {
            this.tooFarPanel.setAttribute('visible', false);
          }
          if (!this._scanPanel) this._scanPanel = document.querySelector('#scan-panel');
          if (this._scanPanel) this._scanPanel.setAttribute('visible', false);
          if (!this.isTargeting || this.currentTarget !== targetedJunk) {
            this.isTargeting = true;
            this.currentTarget = targetedJunk;
            this.lockTimer = 0;
            const gameManager = this._getGameManager();
            if (gameManager && gameManager.soundEnabled && !gameManager.isGameOver) {
              const loadAudio = document.querySelector('#load-audio');
              if (loadAudio) {
                loadAudio.currentTime = 0;
                loadAudio.volume = 0.6;
                loadAudio.play().catch(err => dbgWarn('Błąd odtwarzania load.mp3:', err));
              }
            }
            if (this.lockPanel) {
              this.lockPanel.setAttribute('visible', true);
            }
            if (crosshairContainer) {
              if (!this._crosshairRingsEls || !this._crosshairPlanesEls) {
                this._crosshairRingsEls = crosshairContainer.querySelectorAll('a-ring, a-circle');
                this._crosshairPlanesEls = crosshairContainer.querySelectorAll('a-plane');
              }
              this._crosshairRingsEls && this._crosshairRingsEls.forEach(ring => ring.setAttribute('color', '#ff0000'));
              this._crosshairPlanesEls && this._crosshairPlanesEls.forEach(plane => plane.setAttribute('color', '#ff0000'));
            }
          } else {
            this.lockTimer += effectiveDeltaTime;
            // if the player has destroyed >=100 junk, speed up locking/firing cadence
            const junkSystem = this._junkSystemEl && this._junkSystemEl.components ? this._junkSystemEl.components['space-junk-system'] : null;
            const currentLockDuration = (junkSystem && junkSystem.destroyedCount >= 100) ? 500 : this.lockDuration;
            const currentCooldownTime = (junkSystem && junkSystem.destroyedCount >= 100) ? 500 : this.cooldownTime;
            const remaining = (currentLockDuration - this.lockTimer) / 1000;
            const progress = (this.lockTimer / currentLockDuration) * 100;
            if (this.lockText) {
              this.lockText.setAttribute('value', `FIRING IN: ${remaining.toFixed(1)}s`);
            }
            if (this.lockBar) {
              const barWidth = (progress / 100) * 0.288;
              this.lockBar.setAttribute('width', barWidth);
              this.lockBar.setAttribute('position', `${-0.144 + barWidth / 2} -0.025 0.003`);
            }
            if (this.lockTimer >= currentLockDuration && this.cooldown <= 0) {
              // pass current cooldown to shootAtTarget via setting a temp property
              this._nextCooldownTime = currentCooldownTime;
              this.shootAtTarget(targetedJunk);
              this.lockTimer = 0;
              this.isTargeting = false;
              this.currentTarget = null;
              if (this.lockPanel) {
                this.lockPanel.setAttribute('visible', false);
              }
            }
          }
        } else {
          if (this.isTargeting) {
            this.isTargeting = false;
            this.currentTarget = null;
            this.lockTimer = 0;
            if (this.lockPanel) {
              this.lockPanel.setAttribute('visible', false);
            }
            if (this.lockBar) {
              this.lockBar.setAttribute('width', 0);
            }
            if (crosshairContainer) {
              if (!this._crosshairRingsEls || !this._crosshairPlanesEls) {
                this._crosshairRingsEls = crosshairContainer.querySelectorAll('a-ring, a-circle');
                this._crosshairPlanesEls = crosshairContainer.querySelectorAll('a-plane');
              }
              this._crosshairRingsEls && this._crosshairRingsEls.forEach(ring => ring.setAttribute('color', '#00ffff'));
              this._crosshairPlanesEls && this._crosshairPlanesEls.forEach(plane => plane.setAttribute('color', '#00ffff'));
            }
          }
        }
        if (tooFarJunk && !targeting && !this.isTargeting) {
          const gm3 = this._getGameManager();
          const isGameOver3 = gm3 && gm3.isGameOver;
          if (this.tooFarPanel && this.distanceText && !isGameOver3) {
            this.tooFarPanel.setAttribute('visible', true);
            this.distanceText.setAttribute('value', `DISTANCE: ${Math.floor(tooFarDistance)}m`);
            this.isShowingTooFar = true;
            const scanPanel = document.querySelector('#scan-panel');
            if (scanPanel) {
              scanPanel.setAttribute('visible', false);
            }
          }
        } else {
          this.isShowingTooFar = false;
          if (!targeting && this.tooFarPanel && !this.isTargeting) {
            if (!this._scannerEl) this._scannerEl = document.querySelector('[scanner]');
            const scannerComponent = this._scannerEl ? this._scannerEl.components.scanner : null;
            if (!scannerComponent || !scannerComponent.isShowingTooFar) {
              this.tooFarPanel.setAttribute('visible', false);
            }
          }
        }
      },
      shootAtTarget: function(junk) {
        const mesh = junk.object3D.children[0];
        if (!mesh) return;
        const intersects = this.raycaster.intersectObject(mesh, true);
        if (intersects.length > 0) {
          const gameManager = document.querySelector('[game-manager]').components['game-manager'];
          if (gameManager && gameManager.soundEnabled && !gameManager.isGameOver) {
            let activeWeaponId = this.currentWeaponId || 'weapon-blaster';
            if (!this.currentWeaponId) {
               const weapons = ['weapon-plasma', 'weapon-laser', 'weapon-railgun', 'weapon-photon', 'weapon-void', 'weapon-omega', 'weapon-solar'];
               for (let w of weapons) {
                   const el = document.querySelector('#' + w);
                   if (el && el.getAttribute('visible')) {
                       activeWeaponId = w;
                       break;
                   }
               }
            }
            let soundId = '#shot-audio-blaster';
            if (activeWeaponId === 'weapon-laser') soundId = '#shot-audio';
            if (activeWeaponId === 'weapon-plasma') soundId = '#shot-audio-plasma';
            if (activeWeaponId === 'weapon-railgun') soundId = '#shot-audio-railgun';
            if (activeWeaponId === 'weapon-photon') soundId = '#shot-audio-photon';
            if (activeWeaponId === 'weapon-void') soundId = '#shot-audio-void';
            if (activeWeaponId === 'weapon-omega') soundId = '#shot-audio-omega';
            if (activeWeaponId === 'weapon-solar') soundId = '#shot-audio-solar';
            const shotAudio = document.querySelector(soundId);
            if (shotAudio) {
              shotAudio.currentTime = 0;
              shotAudio.volume = 0.7;
              shotAudio.play().catch(err => dbgWarn('Błąd odtwarzania dźwięku strzału:', err));
            }
          }
          this.triggerWeaponFlash();
          this.destroyJunk(junk, intersects[0].point);
          this.showLaserBeam(true);
          const cooldownToUse = this._nextCooldownTime || this.cooldownTime;
          this.cooldown = cooldownToUse;
          this._nextCooldownTime = null;
        }
      },
      triggerWeaponFlash: function() {
        let activeWeaponId = this.currentWeaponId || 'weapon-blaster';
        if (!this.currentWeaponId) {
           const weapons = ['weapon-plasma', 'weapon-laser', 'weapon-railgun', 'weapon-photon', 'weapon-void', 'weapon-omega', 'weapon-solar'];
           for (let w of weapons) {
               const el = document.querySelector('#' + w);
               if (el && el.getAttribute('visible')) {
                   activeWeaponId = w;
                   break;
               }
           }
        }
        const weaponEl = document.querySelector('#' + activeWeaponId);
        let flashId = 'flash-blaster';
        if (activeWeaponId === 'weapon-plasma') flashId = 'flash-plasma';
        if (activeWeaponId === 'weapon-laser') flashId = 'flash-laser';
        if (activeWeaponId === 'weapon-railgun') flashId = 'flash-railgun';
        if (activeWeaponId === 'weapon-photon') flashId = 'flash-photon';
        if (activeWeaponId === 'weapon-void') flashId = 'flash-void';
        if (activeWeaponId === 'weapon-omega') flashId = 'flash-omega';
        if (activeWeaponId === 'weapon-solar') flashId = 'flash-solar';
        const flashEl = document.querySelector('#' + flashId);
        const basePos = { x: 0, y: 0, z: 0 };
        if (flashEl) {
          flashEl.setAttribute('visible', true);
          if (weaponEl) {
            weaponEl.removeAttribute('animation__recoil');
            weaponEl.removeAttribute('animation__return');
            let recoilDist = 0.15;
            let recoilDur = 50;
            if (activeWeaponId === 'weapon-laser' || activeWeaponId === 'weapon-solar') {
                recoilDist = 0.25;
                recoilDur = 100;
            } else if (activeWeaponId === 'weapon-railgun' || activeWeaponId === 'weapon-omega') {
                recoilDist = 0.4;
                recoilDur = 150;
            }
            const startPos = {x: 0, y: 0, z: 0};
            weaponEl.setAttribute('animation__recoil', {
              property: 'position',
              from: `${startPos.x} ${startPos.y} ${startPos.z}`,
              to: `${startPos.x} ${startPos.y} ${startPos.z + recoilDist}`,
              dur: recoilDur,
              easing: 'easeOutQuad',
              autoplay: true
            });
            setTimeout(() => {
              weaponEl.setAttribute('animation__return', {
                property: 'position',
                from: `${startPos.x} ${startPos.y} ${startPos.z + recoilDist}`,
                to: `${startPos.x} ${startPos.y} ${startPos.z}`,
                dur: recoilDur * 3,
                easing: 'easeOutQuad',
                autoplay: true
              });
            }, recoilDur);
          }
          setTimeout(() => {
            flashEl.setAttribute('visible', false);
          }, 100);
        }
      }
    });
