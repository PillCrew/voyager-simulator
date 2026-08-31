AFRAME.registerComponent('weapon-lock', {
      schema: {
        requiredScore: {type: 'number', default: 8000}
      },
      init: function() {
        this.unlocked = false;
        this.checkUnlockStatus();
        window.addEventListener('heyvr_sdk_loaded', () => {
            this.checkUnlockStatus();
        });
      },
      checkUnlockStatus: function() {
        const weaponSelector = document.querySelector('#weapon-selector-panel');
        if (weaponSelector && (weaponSelector.getAttribute('visible') === false || weaponSelector.getAttribute('visible') === 'false')) {
            return;
        }
        const gameManagerEl = document.querySelector('[game-manager]');
        if (gameManagerEl && gameManagerEl.components['game-manager']) {
            const gm = gameManagerEl.components['game-manager'];
            gm.fetchUserHighScore().then(score => {
                const unlocked = score > 0 && score >= this.data.requiredScore;
                this.setUnlockState(unlocked);
            });
        } else {
             this.setUnlockState(false);
        }
      },
      setUnlockState: function(unlocked) {
        this.unlocked = unlocked;
        if (!unlocked) {
          this.el.setAttribute('material', 'color', '#443300');
          this.el.setAttribute('material', 'opacity', 0.5);
          this.el.classList.remove('button-interactive');
          this.el.classList.add('button-disabled');
          const lockText = this.el.querySelector('[id^="lock-text"]');
          if (lockText) lockText.setAttribute('visible', true);
        } else {
          this.el.setAttribute('material', 'color', '#CCAA00');
          this.el.setAttribute('material', 'opacity', 0.8);
          this.el.classList.remove('button-disabled');
          this.el.classList.add('button-interactive');
          const lockText = this.el.querySelector('[id^="lock-text"]');
          if (lockText) lockText.setAttribute('visible', false);
        }
      }
    });
    AFRAME.registerComponent('weapon-selector', {
      schema: {
        weaponId: {type: 'string'}
      },
      init: function() {
        this.el.addEventListener('click', () => {
          const weaponLock = this.el.components['weapon-lock'];
          if (weaponLock && !weaponLock.unlocked) {
            dbgLog('Weapon locked! Required score: ' + (weaponLock.data.requiredScore || 8000));
            return;
          }
          this.selectWeapon();
        });
      },
      selectWeapon: function() {
        const weaponId = this.data.weaponId;
        const allWeapons = ['weapon-blaster', 'weapon-plasma', 'weapon-laser', 'weapon-railgun', 'weapon-photon', 'weapon-void', 'weapon-omega', 'weapon-solar'];
        allWeapons.forEach(id => {
          const el = document.querySelector('#' + id);
          if (el) el.setAttribute('visible', false);
        });
        const selected = document.querySelector('#' + weaponId);
        if (selected) selected.setAttribute('visible', true);
        const gameManager = document.querySelector('[game-manager]');
        if (gameManager && gameManager.components['game-manager']) {
          gameManager.components['game-manager'].currentWeaponId = weaponId;
        }
        const sound = document.querySelector('#menu-click-sound');
        if (sound && sound.components.sound) sound.components.sound.playSound();
      }
    });
    AFRAME.registerComponent('planet-detector', {
      init: function () {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 5000;
        this.camera = this.el.object3D;
        this.cameraWorldQuaternion = new THREE.Quaternion();
        this.cameraWorldPosition = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.namePanel = document.querySelector('#planet-name-hud');
        this.nameDisplay = document.querySelector('#planet-name-hud-text');
        this.typeDisplay = document.querySelector('#planet-type-hud-text');
        this.displayTimer = 0;
        this.displayDuration = 3000;
        this.currentPlanet = null;
        this.isDisplaying = false;
        this._planetsCache = [];
        this._nextPlanetsRefresh = 0;
        this._frameSkip = 0;
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('playing')) return;

        // Reduce CPU load (especially on Quest) without impacting readability
        this._frameSkip++;
        if (this._frameSkip % 2 !== 0) return;

        const gameManager = document.querySelector('[game-manager]');
        if (gameManager && gameManager.components['game-manager'] && gameManager.components['game-manager'].isGameOver) {
          return;
        }
        const camera = this.el.components.camera.camera;
        camera.getWorldQuaternion(this.cameraWorldQuaternion);
        camera.getWorldPosition(this.cameraWorldPosition);
        this.direction.set(0, 0, -1).applyQuaternion(this.cameraWorldQuaternion);
        this.raycaster.set(this.cameraWorldPosition, this.direction);

        if (!this._nextPlanetsRefresh || time >= this._nextPlanetsRefresh || this._planetsCache.length === 0) {
          this._planetsCache = Array.from(document.querySelectorAll('.planet-sphere'));
          this._nextPlanetsRefresh = time + 1500;
        }
        const planets = this._planetsCache;
        let foundPlanet = false;
        let detectedPlanet = null;
        planets.forEach(planet => {
          const mesh = planet.object3D.children[0];
          if (mesh) {
            const intersects = this.raycaster.intersectObject(mesh, true);
            if (intersects.length > 0) {
              detectedPlanet = planet;
              const planetName = planet.getAttribute('data-planet-name');
              const distance = Math.floor(intersects[0].distance);
              if (this.currentPlanet !== planetName) {
                this.currentPlanet = planetName;
                this.nameDisplay.setAttribute('value', planetName.toUpperCase());
                let planetType = 'PLANET';
                if (planetName === 'SUN') planetType = '⭐ STAR';
                else if (planetName === 'EARTH' || planetName === 'MARS' || planetName === 'VENUS' || planetName === 'MERCURY') planetType = '🌍 TERRESTRIAL';
                else if (planetName === 'JUPITER' || planetName === 'SATURN' || planetName === 'URANUS' || planetName === 'NEPTUNE') planetType = '🪐 GAS GIANT';
                else if (planetName === 'PLUTO') planetType = '❄️ DWARF PLANET';
                this.typeDisplay.setAttribute('value', planetType);
                this.namePanel.setAttribute('visible', 'true');
                this.displayTimer = 0;
                this.isDisplaying = true;
              }
              if (gameManager && gameManager.components['game-manager']) {
                  const gm = gameManager.components['game-manager'];
                  if (gm.isCampaign && gm.currentMissionTarget && !gm.missionCompleted) {
                      if (planetName === gm.currentMissionTarget) {
                          gm.missionGazeTime += deltaTime;
                          const hud = document.querySelector('#campaign-message-hud');
                          if (hud && hud.getAttribute('visible') === 'true') {
                              const progressBg = hud.querySelector('#camp-msg-progress-bg');
                              const progressBar = hud.querySelector('#camp-msg-progress');
                              if (progressBg && progressBar) {
                                  progressBg.setAttribute('visible', 'true');
                                  progressBar.setAttribute('visible', 'true');
                                  const progress = Math.min(gm.missionGazeTime / 3000, 1);
                                  progressBar.setAttribute('width', 0.6 * progress);
                                  progressBar.setAttribute('position', `${-0.3 + (0.3 * progress)} -0.1 0.003`);
                              }
                          }
                          if (gm.missionGazeTime >= 3000) {
                              gm.completeMission();
                          }
                      } else {
                          gm.missionGazeTime = 0;
                          const hud = document.querySelector('#campaign-message-hud');
                          if (hud) {
                              const progressBar = hud.querySelector('#camp-msg-progress');
                              if (progressBar) progressBar.setAttribute('width', 0);
                          }
                      }
                  }
              }
              foundPlanet = true;
            }
          }
        });
        if (this.isDisplaying) {
          this.displayTimer += deltaTime;
          if (this.displayTimer >= this.displayDuration) {
            if (!foundPlanet || detectedPlanet === null) {
              this.namePanel.setAttribute('visible', 'false');
              this.isDisplaying = false;
              this.currentPlanet = null;
              this.displayTimer = 0;
            } else {
              this.displayTimer = 0;
            }
          }
        }
        if (!foundPlanet && !this.isDisplaying) {
          this.namePanel.setAttribute('visible', 'false');
          this.currentPlanet = null;
        }
      }
    });
    AFRAME.registerComponent('background-stars', {
      schema: {
        count: {type: 'int', default: 1500},
        maxCount: {type: 'int', default: 2500}
      },
      init: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        this.material = new THREE.ShaderMaterial({
          uniforms: {
            pointTexture: { value: texture }
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float alpha;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              vColor = color;
              vAlpha = alpha;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * (1500.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              vec4 texColor = texture2D(pointTexture, gl_PointCoord);
              float a = texColor.a * vAlpha;
              if (a < 0.01) discard;
              gl_FragColor = vec4(vColor, a) * texColor;
            }
          `,
          blending: THREE.NormalBlending,
          depthWrite: false,
          depthTest: true,
          transparent: true
        });
        this._createdCount = -1;
      },
      update: function(oldData) {
        const desired = Math.max(0, this.data.count | 0);
        const capped = Math.min(desired, Math.max(0, this.data.maxCount | 0));
        if (capped !== this._createdCount) this.createStars(capped);
      },
      createStars: function(count) {
        this._createdCount = count;
        if (this.el.getObject3D('bgstars')) {
          this.el.removeObject3D('bgstars');
        }
        if (!count || count <= 0) return;
        const starsGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(count * 3);
        const starColors = new Float32Array(count * 3);
        const starSizes = new Float32Array(count);
        const starAlphas = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const radius = THREE.MathUtils.randFloat(3500, 4500);
          const theta = Math.random() * Math.PI * 2;
          const u = Math.random();
          const phi = Math.acos(2 * u - 1);
          const x = radius * Math.sin(phi) * Math.cos(theta);
          const y = radius * Math.sin(phi) * Math.sin(theta);
          const z = radius * Math.cos(phi);
          const base = i * 3;
          starPositions[base] = x;
          starPositions[base + 1] = y;
          starPositions[base + 2] = z;
          const colorType = Math.random();
          if (colorType < 0.7) {
            starColors[base] = 1.0;
            starColors[base + 1] = 1.0;
            starColors[base + 2] = 1.0;
          } else if (colorType < 0.9) {
            starColors[base] = 0.8;
            starColors[base + 1] = 0.9;
            starColors[base + 2] = 1.0;
          } else {
            starColors[base] = 1.0;
            starColors[base + 1] = 0.9;
            starColors[base + 2] = 0.8;
          }
          starSizes[i] = THREE.MathUtils.randFloat(2.0, 4.0);
          starAlphas[i] = THREE.MathUtils.randFloat(0.35, 0.85);
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        starsGeometry.setAttribute('alpha', new THREE.BufferAttribute(starAlphas, 1));
        const points = new THREE.Points(starsGeometry, this.material);
        points.renderOrder = 10;
        points.frustumCulled = false;
        this.el.setObject3D('bgstars', points);
      }
    });
    AFRAME.registerComponent('supernovae', {
      init: function() {
        this.supernovae = [];
        this.spawnTimer = 0;
        this.spawnInterval = THREE.MathUtils.randFloat(15000, 25000);
        this.maxSupernovae = 0;
        this._gmEl = null;
        this._novaTexture = this._novaTexture || this._buildRadialTexture();
        this.clearOldSupernovae();
      },
      _buildRadialTexture: function() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const c = size * 0.5;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        if (tex.colorSpace !== undefined && THREE.SRGBColorSpace !== undefined) {
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        tex.needsUpdate = true;
        return tex;
      },
      clearOldSupernovae: function() {
        this.supernovae.forEach(sn => {
          if (sn.mesh && sn.mesh.parent) {
            sn.mesh.parent.remove(sn.mesh);
          }
        });
        this.supernovae = [];
      },
      createSupernova: function() {
        const camera = this.el.sceneEl.camera;
        const cameraPos = camera ? camera.position : new THREE.Vector3(0, 1.6, 0);
        const distance = THREE.MathUtils.randFloat(800, 2500);
        const angle = Math.random() * Math.PI * 2;
        const height = THREE.MathUtils.randFloatSpread(500);
        const pos = new THREE.Vector3(
          Math.cos(angle) * distance,
          height,
          Math.sin(angle) * distance - cameraPos.z - 1500
        );
        const supernovaTypes = [
          {
            name: 'Type Ia',
            color: new THREE.Color(0.9, 0.9, 1.0),
            emissive: new THREE.Color(0.8, 0.8, 1.0),
            intensity: 4.0,
            duration: 3500,
            maxRadius: 80
          },
          {
            name: 'Type II',
            color: new THREE.Color(0.7, 0.8, 1.0),
            emissive: new THREE.Color(0.5, 0.7, 1.0),
            intensity: 5.0,
            duration: 4000,
            maxRadius: 100
          },
          {
            name: 'Red Supergiant',
            color: new THREE.Color(1.0, 0.5, 0.3),
            emissive: new THREE.Color(1.0, 0.4, 0.1),
            intensity: 3.5,
            duration: 5000,
            maxRadius: 120
          },
          {
            name: 'Hypernova',
            color: new THREE.Color(1.0, 0.9, 0.4),
            emissive: new THREE.Color(1.0, 0.8, 0.2),
            intensity: 6.0,
            duration: 6000,
            maxRadius: 150
          }
        ];
        const type = supernovaTypes[Math.floor(Math.random() * supernovaTypes.length)];
        const material = new THREE.SpriteMaterial({
          map: this._novaTexture,
          color: type.color,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(pos);
        sprite.scale.setScalar(10);
        sprite.renderOrder = 70;
        return {
          mesh: sprite,
          material: material,
          type: type,
          startTime: Date.now(),
          duration: type.duration,
          maxRadius: type.maxRadius,
          baseScale: THREE.MathUtils.randFloat(8, 14)
        };
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('playing')) return;
        if (!this._frameSkip) this._frameSkip = 0;
        this._frameSkip++;
        if (this._frameSkip % 3 !== 0) return;
        if (!this._gmEl) this._gmEl = document.querySelector('[game-manager]');
        if (this._gmEl && this._gmEl.components['game-manager'] && this._gmEl.components['game-manager'].isGameOver) {
          return;
        }
        const now = Date.now();
        const dt = Math.min(deltaTime, 50) * 3;
        const camera = this.el.sceneEl.camera;
        for (let i = this.supernovae.length - 1; i >= 0; i--) {
          const sn = this.supernovae[i];
          const elapsed = now - sn.startTime;
          const progress = elapsed / sn.duration;
          if (progress >= 1) {
            this.el.sceneEl.object3D.remove(sn.mesh);
            if (sn.material) sn.material.dispose();
            this.supernovae.splice(i, 1);
            continue;
          }
          const p = Math.min(1, Math.max(0, progress));
          const flash = p < 0.12 ? (0.85 + Math.sin(elapsed * 0.06) * 0.15) : 1.0;
          const fade = p < 0.65 ? 1.0 : Math.max(0, 1 - (p - 0.65) / 0.35);
          const eased = 1 - Math.pow(1 - p, 2);
          const scale = sn.baseScale + eased * sn.maxRadius;
          sn.mesh.scale.set(scale, scale, scale);
          if (sn.material) sn.material.opacity = Math.min(1, flash) * fade;
          if (camera) sn.mesh.quaternion.copy(camera.quaternion);
        }
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval && this.supernovae.length < this.maxSupernovae) {
          this.spawnTimer = 0;
          this.spawnInterval = THREE.MathUtils.randFloat(12000, 22000);
          const sn = this.createSupernova();
          this.supernovae.push(sn);
          this.el.sceneEl.object3D.add(sn.mesh);
        }
      }
    });
    AFRAME.registerComponent('speed-hud', {
      init: function () {
        this.baseSpeed = 12847;
        this.speedVariation = 0;
        this.time = 0;
        this.hudElements = null;
      },
      tick: function (time, deltaTime) {
        if (!this.hudElements) {
          this.hudElements = [
            document.querySelector('#hud-left'),
            document.querySelector('#hud-right'),
            document.querySelector('#hud-top')
          ];
        }
        const gameManager = document.querySelector('[game-manager]');
        const gmComponent = gameManager ? gameManager.components['game-manager'] : null;
        if (gmComponent && (gmComponent.isGameOver || gmComponent.isCampaign)) {
          this.hudElements.forEach(el => {
            if (el) el.setAttribute('visible', false);
          });
          return;
        }
        const isPlaying = this.el.sceneEl.is('playing');
        this.hudElements.forEach(el => {
          if (el) el.setAttribute('visible', isPlaying);
        });
        if (!isPlaying) return;
        this.time += deltaTime;
        if (this.time > 250) {
          this.time = 0;
          this.speedVariation = THREE.MathUtils.randFloat(-50, 50);
          const currentSpeed = (this.baseSpeed + this.speedVariation).toFixed(0);
          const speedText = this.el.querySelector('#speed-value');
          if (speedText) {
            const currentVal = speedText.getAttribute('value');
            const newVal = currentSpeed + ' km/s';
            if (currentVal !== newVal) {
              speedText.setAttribute('value', newVal);
            }
          }
        }
      }
    });
    AFRAME.registerComponent('cosmic-dust', {
      init: function () {
        const count = 600;
        const rangeZ = 4000;
        const halfRangeZ = rangeZ * 0.5;
        const dustGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const alphas = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const base = i * 3;
          positions[base] = THREE.MathUtils.randFloatSpread(4000);
          positions[base + 1] = THREE.MathUtils.randFloatSpread(2000);
          positions[base + 2] = Math.random() * rangeZ;
          alphas[i] = THREE.MathUtils.randFloat(0.1, 0.4);
        }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        dustGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
        const dustMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: 300 },
            uRangeZ: { value: rangeZ },
            uHalfRangeZ: { value: halfRangeZ },
            uSize: { value: 1.5 },
            uColor: { value: new THREE.Color(0xffffff) }
          },
          vertexShader: [
            'uniform float uTime;',
            'uniform float uSpeed;',
            'uniform float uRangeZ;',
            'uniform float uHalfRangeZ;',
            'uniform float uSize;',
            'attribute float aAlpha;',
            'varying float vAlpha;',
            'void main() {',
            '  vec3 pos = position;',
            '  pos.z = mod(pos.z + uTime * uSpeed, uRangeZ) - uHalfRangeZ;',
            '  float dist = length(pos);',
            '  float fade = smoothstep(15.0, 25.0, dist);',
            '  vAlpha = aAlpha * fade;',
            '  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
            '  gl_PointSize = uSize;',
            '  gl_Position = projectionMatrix * mvPosition;',
            '}'
          ].join('\n'),
          fragmentShader: [
            'precision mediump float;',
            'uniform vec3 uColor;',
            'varying float vAlpha;',
            'void main() {',
            '  vec2 c = gl_PointCoord - vec2(0.5);',
            '  float d = dot(c, c);',
            '  float mask = smoothstep(0.25, 0.0, d);',
            '  gl_FragColor = vec4(uColor, vAlpha * mask);',
            '}'
          ].join('\n'),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: THREE.NormalBlending,
          toneMapped: false
        });
        this.dust = new THREE.Points(dustGeometry, dustMaterial);
        this.dust.renderOrder = 100;
        this.dust.frustumCulled = false;
        this.el.setObject3D('dust', this.dust);
        this.baseSpeed = 5;
        this.currentSpeed = 5;
        this.gameManager = null;
      },
      tick: function (time, deltaTime) {
        if (!this.el.sceneEl.is('playing')) return;
        if (!this.timeAccumulator) this.timeAccumulator = 0;
        this.timeAccumulator += deltaTime;
        if (this.timeAccumulator < 33) return;
        this.timeAccumulator = 0;
        if (!this.gameManager) {
          this.gameManager = document.querySelector('[game-manager]');
        }
        if (this.gameManager && this.gameManager.components['game-manager'] && this.gameManager.components['game-manager'].isGameOver) {
          return;
        }
        const camera = this.el.sceneEl.camera;
        if (camera && camera.position) {
          this.dust.position.copy(camera.position);
        } else {
          this.dust.position.set(0, 1.6, 0);
        }
        const mat = this.dust.material;
        if (mat && mat.uniforms) {
          mat.uniforms.uTime.value = time * 0.001;
          mat.uniforms.uSpeed.value = this.currentSpeed * 60;
        }
      }
    });
    AFRAME.registerComponent('speed-lines', {
      schema: {
        count: { type: 'int', default: 80 },
        radius: { type: 'number', default: 1.1 },
        range: { type: 'number', default: 140 },
        speed: { type: 'number', default: 60 },
        color: { type: 'color', default: '#aaddff' },
        opacity: { type: 'number', default: 0.35 }
      },
      init: function () {
        const count = Math.max(0, this.data.count | 0);
        const range = Math.max(1, this.data.range);
        const halfRange = range * 0.5;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 2 * 3);
        const aEnd = new Float32Array(count * 2);
        const aLen = new Float32Array(count * 2);
        const aAlpha = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          const r = this.data.radius * Math.sqrt(Math.random());
          const ang = Math.random() * Math.PI * 2;
          const x = Math.cos(ang) * r;
          const y = Math.sin(ang) * r;
          const z = -Math.random() * range;
          const len = THREE.MathUtils.randFloat(0.6, 2.0);
          const alpha = THREE.MathUtils.randFloat(0.25, 1.0);
          const v0 = i * 2;
          const v1 = v0 + 1;
          const b0 = v0 * 3;
          const b1 = v1 * 3;
          positions[b0] = x;
          positions[b0 + 1] = y;
          positions[b0 + 2] = z;
          positions[b1] = x;
          positions[b1 + 1] = y;
          positions[b1 + 2] = z;
          aEnd[v0] = 0;
          aEnd[v1] = 1;
          aLen[v0] = len;
          aLen[v1] = len;
          aAlpha[v0] = alpha;
          aAlpha[v1] = alpha;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
        geom.setAttribute('aLen', new THREE.BufferAttribute(aLen, 1));
        geom.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: this.data.speed },
            uRange: { value: range },
            uHalfRange: { value: halfRange },
            uColor: { value: new THREE.Color(this.data.color) },
            uOpacity: { value: this.data.opacity }
          },
          vertexShader: [
            'uniform float uTime;',
            'uniform float uSpeed;',
            'uniform float uRange;',
            'uniform float uHalfRange;',
            'attribute float aEnd;',
            'attribute float aLen;',
            'attribute float aAlpha;',
            'varying float vAlpha;',
            'void main() {',
            '  vec3 pos = position;',
            '  float baseZ = mod(pos.z + uTime * uSpeed, uRange) - uRange;',
            '  pos.z = baseZ + aEnd * aLen;',
            '  float zFade = 1.0 - smoothstep(uHalfRange * 0.2, uHalfRange, abs(baseZ));',
            '  vAlpha = aAlpha * zFade;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
            '}',
          ].join('\n'),
          fragmentShader: [
            'precision mediump float;',
            'uniform vec3 uColor;',
            'uniform float uOpacity;',
            'varying float vAlpha;',
            'void main() {',
            '  float a = vAlpha * uOpacity;',
            '  if (a < 0.01) discard;',
            '  gl_FragColor = vec4(uColor, a);',
            '}',
          ].join('\n'),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: THREE.NormalBlending,
          toneMapped: false
        });
        this._lines = new THREE.LineSegments(geom, mat);
        this._lines.frustumCulled = false;
        this._lines.renderOrder = 99;
        this._lines.visible = false;
        this.el.setObject3D('speedLines', this._lines);
        this._starsEl = document.querySelector('#stars');
      },
      tick: function (time) {
        const sceneEl = this.el.sceneEl;
        const lines = this._lines;
        if (!lines || !lines.material || !lines.material.uniforms) return;
        if (!sceneEl.is('playing')) {
          if (lines.visible) lines.visible = false;
          return;
        }
        const gmEl = document.querySelector('[game-manager]');
        const gm = gmEl && gmEl.components ? gmEl.components['game-manager'] : null;
        if (gm && gm.isGameOver) {
          if (lines.visible) lines.visible = false;
          return;
        }
        if (!lines.visible) lines.visible = true;
        let speed = this.data.speed;
        if (this._starsEl && this._starsEl.components && this._starsEl.components['star-system']) {
          const s = this._starsEl.components['star-system'].data;
          if (s && typeof s.speed === 'number') speed = Math.max(0, speed + s.speed * 6);
        }
        lines.material.uniforms.uTime.value = time * 0.001;
        lines.material.uniforms.uSpeed.value = speed;
      }
    });
