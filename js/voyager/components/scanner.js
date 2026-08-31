AFRAME.registerComponent('scanner', {
      init: function() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 1500;
        this.camera = this.el.object3D;
        this.scanning = false;
        this.scanProgress = 0;
        this.currentTarget = null;
        this.currentTargetId = null;
        this.scanDuration = 3000;
        this.lostTargetTimer = 0;
        this.lostTargetTolerance = 500;
        this.scanCount = 0;
        this.isShowingTooFar = false;
        this._tmpCamQuat = new THREE.Quaternion();
        this._tmpCamPos = new THREE.Vector3();
        this._tmpDir = new THREE.Vector3();
        this._tmpAstPos = new THREE.Vector3();
        this._tmpToAst = new THREE.Vector3();
        this._intersects = [];
        this._raycastTargets = [];
        this._hitDistances = new Map();
        this._frameSkip = 0;
        this._gmEl = document.querySelector('[game-manager]');
        this._laserEl = document.querySelector('[laser-shooter]');
        this._asteroidSystemEl = document.querySelector('[asteroid-system]');
        this.scanBar = document.querySelector('#scan-progress-bar');
        this.scanText = document.querySelector('#scan-text');
        this.scanStatus = document.querySelector('#scan-status');
        this.scanPanel = document.querySelector('#scan-panel');
        this.tooFarPanel = document.querySelector('#too-far-panel');
        this.lockPanel = document.querySelector('#target-lock-panel');
        this.distanceText = document.querySelector('#distance-text');
        this.scannerAudio = document.querySelector('#scanner-audio');
      },
      _getGameManager: function() {
        if (this._gmEl && this._gmEl.components && this._gmEl.components['game-manager']) {
          return this._gmEl.components['game-manager'];
        }
        this._gmEl = document.querySelector('[game-manager]');
        return this._gmEl && this._gmEl.components ? this._gmEl.components['game-manager'] : null;
      },
      _getLaser: function() {
        if (this._laserEl && this._laserEl.components && this._laserEl.components['laser-shooter']) {
          return this._laserEl.components['laser-shooter'];
        }
        this._laserEl = document.querySelector('[laser-shooter]');
        return this._laserEl && this._laserEl.components ? this._laserEl.components['laser-shooter'] : null;
      },
      _getAsteroids: function() {
        if (!this._asteroidSystemEl || !this._asteroidSystemEl.components || !this._asteroidSystemEl.components['asteroid-system']) {
          this._asteroidSystemEl = document.querySelector('[asteroid-system]');
        }
        const sys = this._asteroidSystemEl && this._asteroidSystemEl.components ? this._asteroidSystemEl.components['asteroid-system'] : null;
        return sys && Array.isArray(sys.asteroids) ? sys.asteroids : [];
      },
      _findAsteroidElFromHitObject: function(obj) {
        let cur = obj;
        while (cur) {
          if (cur.userData && cur.userData.scannerAsteroidEl) return cur.userData.scannerAsteroidEl;
          cur = cur.parent;
        }
        return null;
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('playing')) return;
        this._frameSkip++;
        if (this._frameSkip % 2 !== 0) return;
        const gm = this._getGameManager();
        if (gm && gm.isGameOver) {
          return;
        }
        const camera = this.el.components.camera.camera;
        if (!camera) return;
        camera.getWorldQuaternion(this._tmpCamQuat);
        camera.getWorldPosition(this._tmpCamPos);
        this._tmpDir.set(0, 0, -1).applyQuaternion(this._tmpCamQuat);
        this.raycaster.set(this._tmpCamPos, this._tmpDir);
        const asteroids = this._getAsteroids();

        // Build raycast targets with cheap culling first
        this._raycastTargets.length = 0;
        for (let i = 0; i < asteroids.length; i++) {
          const asteroid = asteroids[i];
          if (!asteroid || !asteroid.object3D) continue;

          asteroid.object3D.getWorldPosition(this._tmpAstPos);
          this._tmpToAst.copy(this._tmpAstPos).sub(this._tmpCamPos);
          const approxDist = this._tmpToAst.length();
          if (approxDist > this.raycaster.far) continue;
          if (this._tmpToAst.dot(this._tmpDir) <= 0) continue;

          // Mark root so we can map hit.object -> asteroid quickly
          asteroid.object3D.userData.scannerAsteroidEl = asteroid;
          this._raycastTargets.push(asteroid.object3D);
        }

        // Single raycast for all candidates
        this._intersects.length = 0;
        if (this._raycastTargets.length > 0) {
          this.raycaster.intersectObjects(this._raycastTargets, true, this._intersects);
        }

        // Map closest hit distance per asteroid (intersects are sorted by distance)
        this._hitDistances.clear();
        for (let h = 0; h < this._intersects.length; h++) {
          const hit = this._intersects[h];
          const asteroidEl = this._findAsteroidElFromHitObject(hit.object);
          if (!asteroidEl) continue;
          if (!this._hitDistances.has(asteroidEl)) {
            this._hitDistances.set(asteroidEl, hit.distance);
          }
        }

        let targetFound = false;
        let currentlyPointingAt = null;
        let tooFarTarget = null;
        let tooFarDistance = 0;
        for (let i = 0; i < asteroids.length; i++) {
          const asteroid = asteroids[i];
          if (!asteroid) continue;
          if (!this._hitDistances.has(asteroid)) continue;
          const distance = this._hitDistances.get(asteroid);
          if (asteroid.getAttribute('data-scanned') !== 'true') {
            if (distance < 400) {
              targetFound = true;
              currentlyPointingAt = asteroid;
              if (this.tooFarPanel && this.tooFarPanel.getAttribute('visible')) {
                this.tooFarPanel.setAttribute('visible', false);
              }
              if (this.lockPanel && this.lockPanel.getAttribute('visible')) {
                this.lockPanel.setAttribute('visible', false);
              }
              if (this.currentTarget === asteroid) {
                this.lostTargetTimer = 0;
                if (this.scanning) {
                  this.scanProgress += deltaTime * 2;
                  const progress = Math.min(this.scanProgress / this.scanDuration, 1);
                  this.scanBar.setAttribute('width', 0.288 * progress);
                  this.scanBar.setAttribute('position', `${-0.144 + (0.288 * progress / 2)} -0.025 0.003`);
                  this.scanText.setAttribute('value', `PROGRESS: ${Math.floor(progress * 100)}%`);
                  if (progress >= 1) {
                    this.completeScan(asteroid);
                  }
                }
              } else {
                this.startScan(asteroid);
              }
            } else if (distance < 1500) {
              tooFarTarget = asteroid;
              tooFarDistance = distance;
            }
          } else {
            if (distance < 1500 && distance >= 400) {
              tooFarTarget = asteroid;
              tooFarDistance = distance;
            }
          }
        }
        const isGameOver2 = gm && gm.isGameOver;
        const laserComponent = this._getLaser();
        const isLaserTargeting = laserComponent && laserComponent.isTargeting;
        const isLaserShowingTooFar = laserComponent && laserComponent.isShowingTooFar;
        if (tooFarTarget && !targetFound && !this.scanning && !isLaserTargeting && !isGameOver2) {
          if (this.tooFarPanel && this.distanceText) {
            this.tooFarPanel.setAttribute('visible', true);
            this.distanceText.setAttribute('value', `DISTANCE: ${Math.floor(tooFarDistance)}m`);
            this.isShowingTooFar = true;
            if (this.lockPanel && this.lockPanel.getAttribute('visible')) {
              this.lockPanel.setAttribute('visible', false);
            }
          }
        } else {
          this.isShowingTooFar = false;
          if ((!targetFound || !tooFarTarget || this.scanning || isLaserTargeting) && this.tooFarPanel) {
            if (!isLaserShowingTooFar) {
              this.tooFarPanel.setAttribute('visible', false);
            }
          }
        }
        if (!targetFound && this.scanning && this.currentTarget) {
          this.lostTargetTimer += deltaTime;
          if (this.lostTargetTimer > this.lostTargetTolerance) {
            this.cancelScan();
          }
        }
        if (targetFound && currentlyPointingAt && currentlyPointingAt !== this.currentTarget) {
          if (this.scanning) {
            this.startScan(currentlyPointingAt);
          }
        }
      },
      startScan: function(asteroid) {
        this.scanning = true;
        this.currentTarget = asteroid;
        this.scanProgress = 0;
        this.lostTargetTimer = 0;
        this.scanPanel.setAttribute('visible', true);
        this.scanStatus.setAttribute('visible', false);
        const gameManager = document.querySelector('[game-manager]').components['game-manager'];
        if (gameManager && gameManager.soundEnabled && !gameManager.isGameOver && this.scannerAudio) {
          this.scannerAudio.currentTime = 0;
          this.scannerAudio.volume = 0.6;
          this.scannerAudio.play().catch(err => dbgWarn('Błąd odtwarzania dźwięku skanera:', err));
        }
      },
      cancelScan: function() {
        this.scanning = false;
        this.currentTarget = null;
        this.scanProgress = 0;
        this.lostTargetTimer = 0;
        this.scanPanel.setAttribute('visible', false);
        this.scanBar.setAttribute('width', 0);
        if (this.scannerAudio) {
          this.scannerAudio.pause();
          this.scannerAudio.currentTime = 0;
        }
      },
      completeScan: function(asteroid) {
        asteroid.setAttribute('data-scanned', 'true');
        this.scanCount++;
        const scanCounterEl = document.querySelector('#scan-counter');
        if (scanCounterEl) {
          scanCounterEl.setAttribute('value', `SCANS: ${this.scanCount}`);
        }
        const junkSystem = document.querySelector('[space-junk-system]');
        if (junkSystem && junkSystem.components['space-junk-system']) {
          const system = junkSystem.components['space-junk-system'];
          system.allowedEscapes += 3; // scans grant 3 passes now
          system.updateEscapeCounter();
        }
        const laserShooter = document.querySelector('[laser-shooter]');
        if (laserShooter && laserShooter.components['laser-shooter']) {
          laserShooter.components['laser-shooter'].addScore(500);
        }
        const nasaPanel = document.querySelector('#nasa-message-panel');
        nasaPanel.setAttribute('visible', true);
        if (this.scannerAudio) {
          this.scannerAudio.pause();
          this.scannerAudio.currentTime = 0;
        }
        const gameManager = document.querySelector('[game-manager]').components['game-manager'];
        if (gameManager && gameManager.soundEnabled && !gameManager.isGameOver) {
          const scanCompleteAudio = document.querySelector('#scan-complete-audio');
          if (scanCompleteAudio) {
            scanCompleteAudio.currentTime = 0;
            scanCompleteAudio.volume = 0.7;
            scanCompleteAudio.play().catch(err => dbgWarn('Błąd odtwarzania scancom.mp3:', err));
          }
        }
        this.scanning = false;
        this.currentTarget = null;
        this.scanProgress = 0;
        if (asteroid.parentNode) {
          asteroid.remove();
        }
        const asteroidSystem = document.querySelector('[asteroid-system]');
        if (asteroidSystem && asteroidSystem.components['asteroid-system']) {
          const astSystem = asteroidSystem.components['asteroid-system'];
          const index = astSystem.asteroids.indexOf(asteroid);
          if (index > -1) {
            astSystem.asteroids.splice(index, 1);
          }
        }
        setTimeout(() => {
          nasaPanel.setAttribute('visible', false);
          this.scanPanel.setAttribute('visible', false);
          this.scanBar.setAttribute('width', 0);
        }, 2500);
      }
    });
