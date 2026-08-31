AFRAME.registerComponent('skybox-rotator', {
  schema: {
    speedDegPerSec: { default: 0.09 },
    onlyVr: { default: false },
    frameSkip: { type: 'int', default: 3 },
    driftDegPerSec: { default: 0.035 },
    randomizeAxes: { default: true }
  },
  init: function() {
    this._frameSkip = 0;
    this._degToRad = Math.PI / 180;

    // Per-session axis speeds (kept stable after init).
    const yaw = this.data.speedDegPerSec;
    const drift = this.data.driftDegPerSec;
    if (this.data.randomizeAxes) {
      const sgn = () => (Math.random() < 0.5 ? -1 : 1);
      this._yawDeg = yaw * sgn();
      this._pitchDeg = drift * sgn() * (0.6 + Math.random() * 0.8);
      this._rollDeg = drift * sgn() * (0.6 + Math.random() * 0.8);
    } else {
      this._yawDeg = yaw;
      this._pitchDeg = drift;
      this._rollDeg = -drift;
    }
  },
  tick: function(time, deltaTime) {
    const scene = this.el.sceneEl;
    if (!scene) return;
    const isAr = scene.is('ar-mode');
    if (isAr) return;

    if (this.data.onlyVr && !scene.is('vr-mode')) return;
    
    const skip = Math.max(1, (this.data.frameSkip | 0) || 1);
    this._frameSkip++;
    if (this._frameSkip % skip !== 0) return;
    
    const obj = this.el.object3D;
    if (!obj) return;

    // Keep motion stable across PC/VR/Quest by capping dt (prevents jumps on frame drops)
    const dt = Math.min(deltaTime || 0, 50) * 3;

    // Smooth multi-axis drift (gives "different directions" feel while staying cheap)
    const step = (dt / 1000) * this._degToRad;
    obj.rotation.y -= (this._yawDeg * step);
    obj.rotation.x += (this._pitchDeg * step);
    obj.rotation.z += (this._rollDeg * step);
  }
});
AFRAME.registerComponent('planet-system', {
      init: function () {
        this._gameManagerEl = null;
        this.frameSkip = 0;
        this._orbitStartOffset = Math.random() * Math.PI * 2;
        this.planetData = [
          {
            name: 'Sun',
            size: 25,
            texture: 'js/assets/textures/13913_Sun_diff.jpg',
            isSun: true
          },
          {
            name: 'Mercury',
            size: 4.0,
            texture: 'js/assets/textures/Mercury_diff.jpg'
          },
          {
            name: 'Venus',
            size: 5.5,
            texture: 'js/assets/textures/Venus_diff.jpg'
          },
          {
            name: 'Earth',
            size: 6,
            texture: 'js/assets/textures/Earth_diff.jpg'
          },
          {
            name: 'Mars',
            size: 4.5,
            texture: 'js/assets/textures/Mars_diff.jpg'
          },
          {
            name: 'Jupiter',
            size: 18,
            texture: 'js/assets/textures/Jupiter_diff.jpg'
          },
          {
            name: 'Saturn',
            size: 15,
            texture: 'js/assets/textures/Saturn_diff.jpg',
            hasRings: true
          },
          {
            name: 'Uranus',
            size: 8,
            texture: 'js/assets/textures/13907_Uranus_planet_diff.jpg',
            hasRings: true
          },
          {
            name: 'Neptune',
            size: 8,
            texture: 'js/assets/textures/13908_Neptune_planet_diff.jpg'
          },
          {
            name: 'Pluto',
            size: 2.5,
            texture: 'js/assets/textures/Aster.jpg'
          }
        ];
        this.createBackgroundPlanets();
      },
      createSunRayTextureURL: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const cx = 256;
        const cy = 256;
        ctx.clearRect(0, 0, 512, 512);
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 40; i++) {
          ctx.rotate((Math.PI * 2) / 40);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const len = 150 + Math.random() * 100;
          const width = 2 + Math.random() * 10;
          ctx.lineTo(width, len);
          ctx.lineTo(-width, len);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, len);
          grad.addColorStop(0, 'rgba(255, 255, 220, 0.8)');
          grad.addColorStop(0.4, 'rgba(255, 200, 50, 0.4)');
          grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
        ctx.restore();
        const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 100);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        glow.addColorStop(0.5, 'rgba(255, 200, 50, 0.5)');
        glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 100, 0, Math.PI * 2);
        ctx.fill();
        return canvas.toDataURL();
      },
      createBackgroundPlanets: function() {
        this.planets = [];
        this.planetData.forEach((planetData, index) => {
          const bgPlanet = document.createElement('a-entity');
          if (planetData.isSun) {
            bgPlanet.id = 'the-sun';
          }
          const baseAngle = (Math.PI * 2 / this.planetData.length) * index;
          const angle = baseAngle + (this._orbitStartOffset || 0);
          const distance = planetData.isSun ?
            THREE.MathUtils.randFloat(2200, 2800) :
            (planetData.name === 'Jupiter' || planetData.name === 'Saturn' ? THREE.MathUtils.randFloat(3600, 4400) : THREE.MathUtils.randFloat(2600, 3400));
          const elevation = THREE.MathUtils.randFloat(-150, 150);
          bgPlanet.setAttribute('position', {
            x: Math.cos(angle) * distance,
            y: elevation,
            z: Math.sin(angle) * distance
          });
          const scaleMultiplier = planetData.isSun ? 8.0 : 12.0;
          bgPlanet.setAttribute('scale', `${scaleMultiplier} ${scaleMultiplier} ${scaleMultiplier}`);
          bgPlanet.orbitData = {
            angle: angle,
            distance: distance,
            elevation: elevation,
            orbitSpeed: planetData.isSun ? 0.00000025 : THREE.MathUtils.randFloat(0.000001, 0.0000025)
          };
          const bgSphere = document.createElement('a-sphere');
          bgSphere.setAttribute('radius', planetData.size * 0.7);
          bgSphere.setAttribute('segments-width', 12);
          bgSphere.setAttribute('segments-height', 8);
          const materialConfig = planetData.texture ? {
            shader: 'flat',
            src: planetData.texture
          } : {
            shader: 'flat',
            color: planetData.color || '#888888'
          };
          bgSphere.setAttribute('material', materialConfig);
          if (planetData.hasRings) {
            const ring = document.createElement('a-ring');
            const inner = planetData.name === 'Saturn' ? planetData.size * 1.35 : planetData.size * 1.25;
            const outer = planetData.name === 'Saturn' ? planetData.size * 2.4 : planetData.size * 1.85;
            ring.setAttribute('radius-inner', inner);
            ring.setAttribute('radius-outer', outer);
            ring.setAttribute('segments-theta', 32);
            ring.setAttribute('rotation', '75 0 0');
            ring.setAttribute('material', {
              shader: 'flat',
              color: '#d8c8a8',
              transparent: true,
              opacity: 0.65,
              side: 'double',
              depthWrite: false
            });
            bgPlanet.appendChild(ring);
          }
                  bgSphere.classList.add('planet-sphere');
          bgSphere.setAttribute('data-planet-name', planetData.name);
          bgSphere.setAttribute('data-object-type', 'planet');
          bgPlanet.appendChild(bgSphere);
          bgPlanet.object3D.traverse((node) => {
            if (node.isMesh) {
              node.renderOrder = 60;
              node.frustumCulled = false;
            }
          });
          this.el.sceneEl.appendChild(bgPlanet);
          this.planets.push(bgPlanet);
        });
      },
      tick: function(time, deltaTime) {
        if (!this.planets || !this.el.sceneEl.is('playing')) return;
        this.frameSkip++;
        if (this.frameSkip % 3 !== 0) return;
        if (!this._gameManagerEl) {
          this._gameManagerEl = document.querySelector('[game-manager]');
        }
        const gameManager = this._gameManagerEl;
        if (gameManager && gameManager.components['game-manager'] && gameManager.components['game-manager'].isGameOver) {
          return;
        }
        const dt = Math.min(deltaTime, 50) * 3;
        this.planets.forEach(planet => {
          if (planet.orbitData) {
            planet.orbitData.angle += planet.orbitData.orbitSpeed * dt;
            const newX = Math.cos(planet.orbitData.angle) * planet.orbitData.distance;
            const newZ = Math.sin(planet.orbitData.angle) * planet.orbitData.distance;
            planet.object3D.position.set(newX, planet.orbitData.elevation, newZ);
          }
        });
      }
    });
    AFRAME.registerComponent('asteroid-system', {
      init: function () {
        this.asteroids = [];
        this.spawnTimer = 0;
        this.spawnInterval = 12000;
        this.maxAsteroids = 0;
        this.initialSpawn = false;
        this.gameManager = document.querySelector('[game-manager]');
        this.initCache();
      },
      initCache: function() {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load('js/assets/textures/Aster.jpg');
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.cache = {
          geometries: [],
          texture,
          material: new THREE.MeshBasicMaterial({
            map: texture,
            transparent: false,
            side: THREE.FrontSide
          })
        };
        const g1 = new THREE.IcosahedronGeometry(1, 0);
        const g2 = new THREE.DodecahedronGeometry(1, 0);
        this.cache.geometries.push(g1, g2);
      },
      createAsteroid: function() {
        const asteroid = document.createElement('a-entity');
        const side = Math.random() > 0.5 ? 1 : -1;
        const startX = side * THREE.MathUtils.randFloat(60, 150);
        const startY = THREE.MathUtils.randFloat(-60, 60);
        const startZ = THREE.MathUtils.randFloat(-600, -900);
        const drift = THREE.MathUtils.randFloat(-20, 20);
        let endX = startX + drift;
        if (Math.abs(endX) < 40) endX = side * 40;
        const endY = startY + THREE.MathUtils.randFloat(-20, 20);
        const endZ = 100;
        const size = THREE.MathUtils.randFloat(15, 25);
        asteroid.object3D.position.set(startX, startY, startZ);
        const mainGeo = this.cache.geometries[Math.floor(Math.random() * this.cache.geometries.length)];
        // clone material per asteroid to avoid shared-color side effects (prevents staying green)
        const mainMat = this.cache.material.clone();
        const mainMesh = new THREE.Mesh(mainGeo, mainMat);
        mainMesh.scale.set(size, size, size);
        mainMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mainMesh.renderOrder = 3;
        mainMesh.frustumCulled = false;
        asteroid.object3D.add(mainMesh);
        asteroid.classList.add('asteroid');
        asteroid.setAttribute('data-object-type', 'asteroid');
        asteroid.setAttribute('data-scanned', 'false');
        const duration = THREE.MathUtils.randInt(20000, 45000);
        asteroid.setAttribute('asteroid-green-blink', 'intervalMs: 5000; flashMs: 200');
        this.el.sceneEl.appendChild(asteroid);
        this.asteroids.push(asteroid);
        setTimeout(() => {
          asteroid.setAttribute('animation', {
            property: 'position',
            to: { x: endX, y: endY, z: endZ },
            dur: duration,
            easing: 'linear'
          });
        }, 100);
        setTimeout(() => {
          if (asteroid.parentNode) {
            asteroid.remove();
          }
          const index = this.asteroids.indexOf(asteroid);
          if (index > -1) this.asteroids.splice(index, 1);
        }, duration + 2000);
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('playing')) return;
        if (this.gameManager && this.gameManager.components['game-manager'] && this.gameManager.components['game-manager'].isGameOver) {
          return;
        }
        const camera = this.el.sceneEl.camera;
        const cameraPos = camera ? camera.position : new THREE.Vector3(0, 1.6, 0);
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
          const asteroid = this.asteroids[i];
          if (!asteroid.parentNode) {
            this.asteroids.splice(i, 1);
            continue;
          }
          const pos = asteroid.object3D.position;
          const distSq = pos.distanceToSquared(cameraPos);
          if (distSq < 625) {
            const side = Math.random() > 0.5 ? 1 : -1;
            asteroid.setAttribute('position', {
              x: side * THREE.MathUtils.randFloat(120, 200),
              y: THREE.MathUtils.randFloat(-50, 50),
              z: THREE.MathUtils.randFloat(-600, -900)
            });
            continue;
          }
          if (pos.z > 80) {
            asteroid.remove();
            this.asteroids.splice(i, 1);
          }
        }
      }
    });
    AFRAME.registerComponent('look-at', {
      schema: { type: 'selector' },
      init: function () {},
      tick: function () {
        if (this.data) {
          this.el.object3D.lookAt(this.data.object3D.position);
        } else {
          const camera = this.el.sceneEl.camera;
          if (camera) {
            this.el.object3D.lookAt(camera.position);
          }
        }
      }
    });
    AFRAME.registerComponent('junk-red-blink', {
      schema: {
        intervalMs: { type: 'number', default: 5000 },
        flashMs: { type: 'number', default: 200 }
      },
      init: function() {
        this.targetMesh = null;
        this.originalColor = null;
        this._timeoutId = null;
        this._intervalId = null;
        const findMesh = () => {
          if (this.targetMesh) return;
          const obj = this.el.object3D;
          if (!obj) return;
          obj.traverse((child) => {
            if (this.targetMesh) return;
            if (child.isMesh && child.material && child.name !== 'beacon') {
              this.targetMesh = child;
              const mat = child.material;
              const firstMat = Array.isArray(mat) ? mat[0] : mat;
              if (firstMat && firstMat.color) {
                if (firstMat.color.r === 0 && firstMat.color.g === 0 && firstMat.color.b === 0) {
                   this.originalColor = new THREE.Color(1, 1, 1);
                } else {
                   this.originalColor = firstMat.color.clone();
                }
              }
            }
          });
        };
        this.el.sceneEl && this.el.sceneEl.addEventListener('loaded', () => findMesh(), { once: true });
        setTimeout(findMesh, 0);
        const flashOnce = () => {
          if (!this.el || !this.el.parentNode) return;
          findMesh();
          if (!this.targetMesh || !this.targetMesh.material) return;
          const mat = this.targetMesh.material;
          const setColor = (m, color) => {
            if (m && m.color) {
              m.color.copy(color);
              m.needsUpdate = true;
            }
          };
          const red = new THREE.Color('#ff0000');
          if (Array.isArray(mat)) {
            mat.forEach(m => setColor(m, red));
          } else {
            setColor(mat, red);
          }
          this._timeoutId = setTimeout(() => {
            if (!this.targetMesh || !this.targetMesh.material) return;
            const back = this.originalColor || new THREE.Color('#ffffff');
            const mat2 = this.targetMesh.material;
            if (Array.isArray(mat2)) {
              mat2.forEach(m => setColor(m, back));
            } else {
              setColor(mat2, back);
            }
          }, this.data.flashMs);
        };
        const jitter = Math.floor(Math.random() * 1200);
        this._intervalId = setInterval(flashOnce, this.data.intervalMs);
        setTimeout(flashOnce, jitter);
      },
      remove: function() {
        if (this._intervalId) clearInterval(this._intervalId);
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._intervalId = null;
        this._timeoutId = null;
      }
    });
    AFRAME.registerComponent('asteroid-green-blink', {
      schema: {
        intervalMs: { type: 'number', default: 5000 },
        flashMs: { type: 'number', default: 200 }
      },
      init: function() {
        this.targetMesh = null;
        this.originalColor = null;
        this._timeoutId = null;
        this._intervalId = null;
        const findMesh = () => {
          if (this.targetMesh) return;
          const obj = this.el.object3D;
          if (!obj) return;
          obj.traverse((child) => {
            if (this.targetMesh) return;
            if (child.isMesh && child.material) {
              this.targetMesh = child;
              const mat = child.material;
              // store original color(s) per-material so we can reliably restore later
              this._originalColors = [];
              if (Array.isArray(mat)) {
                mat.forEach(m => {
                  this._originalColors.push(m && m.color ? m.color.clone() : null);
                });
              } else {
                this._originalColors.push(mat && mat.color ? mat.color.clone() : null);
              }
            }
          });
        };
        this.el.sceneEl && this.el.sceneEl.addEventListener('loaded', () => findMesh(), { once: true });
        setTimeout(findMesh, 0);
        const flashOnce = () => {
          if (!this.el || !this.el.parentNode) return;
          findMesh();
          if (!this.targetMesh || !this.targetMesh.material) return;
          const mat = this.targetMesh.material;
          const setColor = (m, color) => {
            if (m && m.color) {
              m.color.copy(color);
              m.needsUpdate = true;
            }
          };
          const green = new THREE.Color('#00ff00');
          // ensure we have a backup of original colors for all materials
          if (!this._originalColors || !this._originalColors.length) {
            this._originalColors = [];
            if (Array.isArray(mat)) {
              mat.forEach(m => this._originalColors.push(m && m.color ? m.color.clone() : null));
            } else {
              this._originalColors.push(mat && mat.color ? mat.color.clone() : null);
            }
          }
          if (Array.isArray(mat)) {
            mat.forEach(m => setColor(m, green));
          } else {
            setColor(mat, green);
          }
          this._timeoutId = setTimeout(() => {
            if (!this.targetMesh || !this.targetMesh.material) return;
            const mat2 = this.targetMesh.material;
            if (Array.isArray(mat2)) {
              mat2.forEach((m, idx) => {
                const back = (this._originalColors && this._originalColors[idx]) ? this._originalColors[idx] : null;
                if (back) setColor(m, back);
              });
            } else {
              const back = (this._originalColors && this._originalColors[0]) ? this._originalColors[0] : new THREE.Color('#ffffff');
              setColor(mat2, back);
            }
          }, this.data.flashMs);
        };
        const jitter = Math.floor(Math.random() * 1200);
        this._intervalId = setInterval(flashOnce, this.data.intervalMs);
        setTimeout(flashOnce, jitter);
      },
      remove: function() {
        if (this._intervalId) clearInterval(this._intervalId);
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._intervalId = null;
        this._timeoutId = null;
      }
    });
    AFRAME.registerComponent('space-junk-system', {
      init: function () {
        this.junkObjects = [];
        this.spawnTimer = 0;
        this.spawnInterval = 4500; // faster respawn to keep more junk in play
        this.maxJunk = 4; // slightly more junk by default
        this.baseMaxJunk = this.maxJunk;
        this.maxPossibleJunk = 25; // hard cap for progressive difficulty (increased per request)
        this.progressIncreaseInterval = 20000; // every 20s increase maxJunk
        this._lastProgressIncrease = Date.now();
        this.destroyedCount = 0;
        this.escapedCount = 0;
        this.allowedEscapes = 0;
        this.gameOver = false;
        this.gameOverShown = false;
        this.difficultyLevel = 0;
        this.maxDifficulty = 6;
        this.gameStartTime = Date.now();
        this.timeouts = [];
        this._tmpCamPos = new THREE.Vector3();
        this._tmpCamDir = new THREE.Vector3();
        this._tmpJunkPos = new THREE.Vector3();
        this._tmpToJunk = new THREE.Vector3();
        this._gameManagerEl = null;
        this._escapeCounterEl = null;
        this._frameSkip = 0;
        this.initCache();
      },
      _disableShadows: function(object3D) {
        if (!object3D || typeof object3D.traverse !== 'function') return;
        object3D.traverse(o => {
          if (o && o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });
      },
      _fadeInMaterial: function(material, durationMs, delayMs) {
        if (!material || !material.color) return;
        const targetColor = material.color.clone();
        const startColor = new THREE.Color(0x000000);
        material.color.copy(startColor);
        const duration = Math.max(80, durationMs || 900);
        const delay = Math.max(0, delayMs || 150);
        const startTime = performance.now();
        const step = (now) => {
          if (!material || !material.color) return;
          const elapsed = now - startTime - delay;
          if (elapsed < 0) {
            requestAnimationFrame(step);
            return;
          }
          const t = Math.min(elapsed / duration, 1);
          material.color.copy(startColor).lerp(targetColor, t);
          if (t < 1) {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      },
      _fadeInGroupMaterials: function(group, durationMs, delayMs) {
        if (!group || typeof group.traverse !== 'function') return;
        group.traverse((child) => {
          if (!child || !child.isMesh || !child.material) return;
          if (child.name === 'beacon') return;
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => this._fadeInMaterial(mat, durationMs, delayMs));
          } else {
            this._fadeInMaterial(child.material, durationMs, delayMs);
          }
        });
      },
      clearTimeouts: function() {
        if (this.timeouts) {
          this.timeouts.forEach(id => clearTimeout(id));
          this.timeouts = [];
        }
      },
      initCache: function() {
        this.cache = {
          textureLoader: new THREE.TextureLoader(),
          junkTextureUrls: [
            'js/assets/textures/smieci/AM1.jpg',
            'js/assets/textures/smieci/Am2.jpg',
            'js/assets/textures/smieci/AM3.jpg',
            'js/assets/textures/smieci/Am4.jpg',
            'js/assets/textures/smieci/Am5.jpg',
            'js/assets/textures/smieci/Am6.jpg',
            'js/assets/textures/smieci/Am7.jpg',
            'js/assets/textures/smieci/Am8.jpg',
            'js/assets/textures/smieci/Am9.jpg',
            'js/assets/textures/smieci/Am10.jpg',
            'js/assets/textures/smieci/Am11.jpg',
            'js/assets/textures/smieci/Am12.jpg',
            'js/assets/textures/smieci/AM13.jpg',
            'js/assets/textures/smieci/Am14.jpg',
            'js/assets/textures/smieci/Am15.jpg',
            'js/assets/textures/smieci/Aster.jpg'
          ],
          junkTextureBag: [],
          junkTextureBagIndex: 0,
          junkTextures: new Map(),
          geometries: {
            rocks: [
              new THREE.IcosahedronGeometry(1, 0)
            ],
            boulder: new THREE.DodecahedronGeometry(1, 0),
            beacon: new THREE.SphereGeometry(0.8, 4, 4)
          },
          materials: {
            beacon: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1, transparent: false, opacity: 1 })
          }
        };
      },
      _shuffleInPlace: function(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          const tmp = arr[i];
          arr[i] = arr[j];
          arr[j] = tmp;
        }
        return arr;
      },
      getNextJunkTextureUrl: function() {
        const c = this.cache;
        if (!c || !Array.isArray(c.junkTextureUrls) || c.junkTextureUrls.length === 0) return null;
        if (!Array.isArray(c.junkTextureBag) || c.junkTextureBagIndex >= c.junkTextureBag.length) {
          c.junkTextureBag = c.junkTextureUrls.slice();
          this._shuffleInPlace(c.junkTextureBag);
          c.junkTextureBagIndex = 0;
        }
        const url = c.junkTextureBag[c.junkTextureBagIndex];
        c.junkTextureBagIndex++;
        return url;
      },
      getOrLoadJunkTexture: function(url) {
        if (!this.cache || !this.cache.junkTextures) return null;
        if (this.cache.junkTextures.has(url)) return this.cache.junkTextures.get(url);
        const texture = this.cache.textureLoader.load(url);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        this.cache.junkTextures.set(url, texture);
        return texture;
      },
      createRockJunk: function(group) {
        const c = this.cache;
        const geo = c.geometries.rocks[Math.floor(Math.random() * c.geometries.rocks.length)];
        const texUrl = this.getNextJunkTextureUrl();
        const texture = this.getOrLoadJunkTexture(texUrl);
        const material = new THREE.MeshBasicMaterial({
          map: texture || null,
          transparent: false,
          opacity: 1,
          side: THREE.FrontSide
        });
        const mesh = new THREE.Mesh(geo, material);
  this._disableShadows(mesh);
        const base = THREE.MathUtils.randFloat(14, 20);
        mesh.scale.set(
          base * THREE.MathUtils.randFloat(0.7, 1.6),
          base * THREE.MathUtils.randFloat(0.6, 1.5),
          base * THREE.MathUtils.randFloat(0.7, 1.6)
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
      },
      createLongRockJunk: function(group) {
        const c = this.cache;
        const geo = c.geometries.rocks[0];
        const texUrl = this.getNextJunkTextureUrl();
        const texture = this.getOrLoadJunkTexture(texUrl);
        const material = new THREE.MeshBasicMaterial({
          map: texture || null,
          transparent: false,
          opacity: 1,
          side: THREE.FrontSide
        });
        const mesh = new THREE.Mesh(geo, material);
        this._disableShadows(mesh);
        const base = THREE.MathUtils.randFloat(6, 10);
        mesh.scale.set(
          base * 0.6,
          base * 2.0,
          base * 0.6
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
      },
      createJaggedRockJunk: function(group) {
        const c = this.cache;
        const geo = c.geometries.rocks[0];
        const texUrl = this.getNextJunkTextureUrl();
        const texture = this.getOrLoadJunkTexture(texUrl);
        const material = new THREE.MeshBasicMaterial({
          map: texture || null,
          transparent: false,
          opacity: 1,
          side: THREE.FrontSide
        });
        const mesh = new THREE.Mesh(geo, material);
        this._disableShadows(mesh);
        const base = THREE.MathUtils.randFloat(7, 12);
        mesh.scale.set(
          base * THREE.MathUtils.randFloat(0.8, 1.2),
          base * THREE.MathUtils.randFloat(0.8, 1.2),
          base * THREE.MathUtils.randFloat(0.8, 1.2)
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
      },
      createBoulderJunk: function(group) {
        const c = this.cache;
        const geo = c.geometries.boulder;
        const texUrl = this.getNextJunkTextureUrl();
        const texture = this.getOrLoadJunkTexture(texUrl);
        const material = new THREE.MeshBasicMaterial({
          map: texture || null,
          transparent: false,
          opacity: 1,
          side: THREE.FrontSide
        });
        const mesh = new THREE.Mesh(geo, material);
        this._disableShadows(mesh);
        const base = THREE.MathUtils.randFloat(7, 11);
        mesh.scale.set(base, base, base);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
      },
      createChunkyRockJunk: function(group) {
        const c = this.cache;
        const geo = c.geometries.boulder;
        const texUrl = this.getNextJunkTextureUrl();
        const texture = this.getOrLoadJunkTexture(texUrl);
        const material = new THREE.MeshBasicMaterial({
          map: texture || null,
          transparent: false,
          opacity: 1,
          side: THREE.FrontSide
        });
        const mesh = new THREE.Mesh(geo, material);
        this._disableShadows(mesh);
        const base = THREE.MathUtils.randFloat(8, 13);
        mesh.scale.set(
          base * THREE.MathUtils.randFloat(0.9, 1.3),
          base * THREE.MathUtils.randFloat(0.8, 1.1),
          base * THREE.MathUtils.randFloat(0.9, 1.3)
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
      },
      addBeacon: function(group, position) {
        const beacon = new THREE.Mesh(this.cache.geometries.beacon, this.cache.materials.beacon.clone());
        beacon.position.copy(position);
        beacon.name = 'beacon';
        this._disableShadows(beacon);
        group.add(beacon);
      },
      createJunk: function() {
        const junk = document.createElement('a-entity');
        let startX, startY, startZ;
        let side, distance;
        side = Math.random() > 0.5 ? 1 : -1;
        distance = THREE.MathUtils.randFloat(100, 180);
        startX = side * distance;
        startZ = THREE.MathUtils.randFloat(-600, -900);
        const flightLevels = [40, 55, 70, 85, 100];
        flightLevels.sort(() => Math.random() - 0.5);
        let chosenLevel = null;
        for (let level of flightLevels) {
            let levelFree = true;
            for (let i = 0; i < this.junkObjects.length; i++) {
                const otherJunk = this.junkObjects[i];
                if (otherJunk && otherJunk.object3D && otherJunk.parentNode) {
                    const otherPos = otherJunk.object3D.position;
                    if (Math.abs(otherPos.y - level) < 8) {
                        if (Math.abs(otherPos.z - startZ) < 500) {
                            levelFree = false;
                            break;
                        }
                    }
                }
            }
            if (levelFree) {
                chosenLevel = level;
                break;
            }
        }
        if (chosenLevel === null) {
            chosenLevel = flightLevels[Math.floor(Math.random() * flightLevels.length)];
          startZ -= THREE.MathUtils.randFloat(400, 800);
        }
        startY = chosenLevel + THREE.MathUtils.randFloat(-2, 2);
        // Ensure spawned junk isn't too close to existing junk; require reasonable separation
        const minSeparation = 32; // minimum allowed distance between junk at spawn (increased to reduce overlaps)
        let attempts = 0;
        let placed = false;
        // allow more attempts to find a non-colliding spawn when many objects present
        while (!placed && attempts < 32) {
          let collision = false;
          for (let i = 0; i < this.junkObjects.length; i++) {
            const other = this.junkObjects[i];
            if (!other || !other.object3D) continue;
            const otherPos = other.object3D.position;
            const dx = otherPos.x - startX;
            const dy = otherPos.y - startY;
            const dz = otherPos.z - startZ;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq < (minSeparation * minSeparation)) {
              collision = true;
              break;
            }
          }
          if (!collision) {
            placed = true;
            break;
          }
          // push further back and slightly shift horizontally, then retry
          startZ -= THREE.MathUtils.randFloat(60, 120);
          startX += side * THREE.MathUtils.randFloat(20, 60);
          attempts++;
        }
        junk.object3D.position.set(startX, startY, startZ);
        const group = new THREE.Group();
        const type = Math.random();
        if (type < 0.2) {
          this.createRockJunk(group);
        } else if (type < 0.4) {
          this.createLongRockJunk(group);
        } else if (type < 0.6) {
          this.createJaggedRockJunk(group);
        } else if (type < 0.8) {
          this.createBoulderJunk(group);
        } else {
          this.createChunkyRockJunk(group);
        }
        junk.object3D.add(group);
        junk.object3D.userData.junkEl = junk;
        group.userData.junkEl = junk;
        this._fadeInGroupMaterials(group, 2500, 200);
        junk.object3D.traverse((child) => {
          if (child.isMesh) {
            child.frustumCulled = false;
          }
        });
        group.frustumCulled = false;
        junk.classList.add('space-junk');
        junk.setAttribute('data-object-type', 'junk');
        junk.setAttribute('data-destroyed', 'false');
        junk.setAttribute('junk-red-blink', 'intervalMs: 5000; flashMs: 200');
        // slow down junk overall at start
        let duration = THREE.MathUtils.randInt(52000, 82000); // slower base durations
        const speedRoll = Math.random();
        // inverted mapping with softer “fast” tier to keep everything slower
        if (speedRoll < 0.25) {
          // slowest
          duration = Math.round(duration * THREE.MathUtils.randFloat(1.10, 1.35));
        } else if (speedRoll < 0.60) {
          // medium
          duration = Math.round(duration * THREE.MathUtils.randFloat(1.00, 1.12));
        } else {
          // fastest (still relatively slow)
          duration = Math.round(duration * THREE.MathUtils.randFloat(0.85, 0.95));
        }
        // pre-milestone: up to 50 kills wolniej; then progressively faster at 50/100/125/150/185/200+
        try {
          const dc = this.destroyedCount || 0;
          if (dc < 50) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(1.08, 1.18));
          } else if (dc >= 250) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.48, 0.60));
          } else if (dc >= 200) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.52, 0.65));
          } else if (dc >= 185) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.58, 0.70));
          } else if (dc >= 150) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.64, 0.76));
          } else if (dc >= 125) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.70, 0.82));
          } else if (dc >= 100) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.76, 0.88));
          } else if (dc >= 50) {
            duration = Math.round(duration * THREE.MathUtils.randFloat(0.90, 0.98));
          }
        } catch (e) {}
        // ensure durations don't become too short to be unshootable
        duration = Math.max(duration, 26000);
        // determine end position and ensure it doesn't collide with other planned end targets
        let endX = -side * distance * THREE.MathUtils.randFloat(1.3, 1.8);
        let endYTo = startY + THREE.MathUtils.randFloat(-5, 5);
        let endZ = THREE.MathUtils.randFloat(320, 520);
        const minEndSep = 48; // minimum separation between end targets (increased to avoid overlapping paths)
        let endAttempts = 0;
        // give more retries to find a non-colliding end target when max junk is high
        while (endAttempts < 24) {
          let colliding = false;
          for (let k = 0; k < this.junkObjects.length; k++) {
            const other = this.junkObjects[k];
            if (!other || !other.object3D) continue;
            const mv = other.object3D.userData && other.object3D.userData.move ? other.object3D.userData.move.end : null;
            if (!mv) continue;
            const dx = mv.x - endX;
            const dy = mv.y - endYTo;
            const dz = mv.z - endZ;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 < (minEndSep * minEndSep)) {
              colliding = true;
              break;
            }
          }
          if (!colliding) break;
          // nudge end position away from center and retry
          endX += side * THREE.MathUtils.randFloat(30, 70);
          endYTo += THREE.MathUtils.randFloat(-6, 6);
          endZ += THREE.MathUtils.randFloat(40, 100);
          endAttempts++;
        }
        junk.setAttribute('animation__move', {
          property: 'position',
          to: { x: endX, y: endYTo, z: endZ },
          dur: duration,
          easing: 'linear'
        });
        junk.removeAttribute('animation__spin');
        this.el.sceneEl.appendChild(junk);
        this.junkObjects.push(junk);
        // store movement meta for runtime adjustments (used by the tick separation logic)
        try {
          junk.object3D.userData.move = {
            start: { x: startX, y: startY, z: startZ },
            end: { x: endX, y: endYTo, z: endZ },
            startTime: Date.now(),
            duration: duration
          };
        } catch (e) {}
        const escapeTimeoutId = setTimeout(() => {
          const sceneEl = this.el.sceneEl;
          if (!sceneEl.is('playing')) {
            if (junk && junk.parentNode) { try { junk.parentNode.removeChild(junk); } catch(e){} }
            const index = this.junkObjects.indexOf(junk);
            if (index > -1) this.junkObjects.splice(index, 1);
            return;
          }
          if (junk.getAttribute('data-destroyed') !== 'true') {
            if (this.allowedEscapes > 0) {
              this.allowedEscapes--;
              this.escapedCount++;
              this.updateEscapeCounter();
            } else {
              if (!this.gameOver) {
                this.gameOver = true;
                this.showGameOver();
              }
            }
          }
          if (junk && junk.parentNode) { try { junk.parentNode.removeChild(junk); } catch(e){} }
          const index = this.junkObjects.indexOf(junk);
          if (index > -1) this.junkObjects.splice(index, 1);
        }, duration);
        junk._escapeTimeoutId = escapeTimeoutId;
        this.timeouts.push(escapeTimeoutId);
      },
      updateEscapeCounter: function() {
        const escapeCounter = document.querySelector('#escape-counter');
        if (escapeCounter) {
          escapeCounter.setAttribute('value', `PASSES: ${this.allowedEscapes}`);
          if (this.allowedEscapes === 0) {
            escapeCounter.setAttribute('color', '#ff0000');
          } else if (this.allowedEscapes <= 2) {
            escapeCounter.setAttribute('color', '#ff9900');
          } else {
            escapeCounter.setAttribute('color', '#00ff00');
          }
        }
      },
      showGameOver: function() {
        if (this.gameOverShown) return;
        this.gameOverShown = true;
        this.gameOver = true;
        this.clearTimeouts();
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
        this.junkObjects.forEach(junk => {
          if (junk && junk.parentNode) {
            try { junk.parentNode.removeChild(junk); } catch(e){}
          }
        });
        this.junkObjects = [];
        const remainingJunk = document.querySelectorAll('.space-junk');
        remainingJunk.forEach(junk => {
          if (junk && junk.parentNode) {
            try { junk.parentNode.removeChild(junk); } catch(e){}
          }
        });
        this.spawnTimer = 0;
        this.maxJunk = 0;
        const gameManager = document.querySelector('[game-manager]');
        if (gameManager && gameManager.components['game-manager']) {
          gameManager.components['game-manager'].isGameOver = true;
        }
        const sceneEl = document.querySelector('a-scene');
        if (sceneEl) {
          sceneEl.removeState('playing');
        }
        const tooFarPanel = document.querySelector('#too-far-panel');
        const targetLockPanel = document.querySelector('#target-lock-panel');
        const scanPanel = document.querySelector('#scan-panel');
        const planetInfoPanel = document.querySelector('#planet-info-panel');
        const difficultyPanel = document.querySelector('#difficulty-panel');
        const nasaMessagePanel = document.querySelector('#nasa-message-panel');
        const planetNameHud = document.querySelector('#planet-name-hud');
        if (tooFarPanel) tooFarPanel.setAttribute('visible', false);
        if (targetLockPanel) targetLockPanel.setAttribute('visible', false);
        if (scanPanel) scanPanel.setAttribute('visible', false);
        if (difficultyPanel) difficultyPanel.setAttribute('visible', false);
        if (nasaMessagePanel) nasaMessagePanel.setAttribute('visible', false);
        if (planetNameHud) planetNameHud.setAttribute('visible', false);
        const weaponMount = document.querySelector('#weapon-mount');
        if (weaponMount) weaponMount.setAttribute('visible', true);
        const weaponSelector = document.querySelector('#weapon-selector-panel');
        if (weaponSelector) weaponSelector.setAttribute('visible', 'true');
        const gmEl = document.querySelector('[game-manager]');
        const gmComp = gmEl && gmEl.components ? gmEl.components['game-manager'] : null;
        if (gmComp && typeof gmComp.setWeaponSelectorInteractivity === 'function') {
          gmComp.setWeaponSelectorInteractivity(true);
        }
        const allAudio = document.querySelectorAll('audio');
        allAudio.forEach(audio => {
          if (audio.id !== 'menu-audio') {
            audio.pause();
            audio.currentTime = 0;
          }
        });
        this.maxJunk = 0;
        const menuCursor = document.querySelector('#menu-cursor');
        if (menuCursor) {
          menuCursor.setAttribute('visible', 'true');
          menuCursor.setAttribute('raycaster', 'enabled', true);
        }
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'true');
          const leaderboardPanel = document.querySelector('#leaderboard-panel');
          if (leaderboardPanel) {
            leaderboardPanel.setAttribute('visible', 'true');
          }
          const adPanel = document.querySelector('#ad-panel');
          if (adPanel) {
            adPanel.setAttribute('visible', 'true');
          }
          if (gameOverPanel.object3D) {
            gameOverPanel.object3D.renderOrder = 9999;
          }
          const gameOverButtons = gameOverPanel.querySelectorAll('.button-disabled');
          gameOverButtons.forEach(btn => {
            dbgLog('Aktywuję przycisk Game Over:', btn.id);
            btn.classList.remove('button-disabled');
            btn.classList.add('button-interactive');
            btn.setAttribute('clickable', 'true');
            if (btn.id === 'back-to-menu-button') {
              btn.setAttribute('material', 'color: #0066cc');
            }
          });
          const menu = document.querySelector('#menu');
          if (menu) {
            dbgLog('Ukrywam menu podczas Game Over');
            menu.setAttribute('visible', 'false');
            menu.object3D.visible = false;
            menu.object3D.layers.set(31);
            if (menu.object3D.traverse) {
              menu.object3D.traverse(function(child) {
                child.visible = false;
                child.layers.set(31);
              });
            }
          }
          const menu2 = document.querySelector('#menu');
          if (menu2) {
            const menuButtons = menu2.querySelectorAll('.button-interactive');
            menuButtons.forEach(btn => {
              if (btn.id !== 'sound-toggle' && btn.id !== 'ar-toggle') {
                dbgLog('Blokuję przycisk menu:', btn.id);
                btn.classList.remove('button-interactive');
                btn.classList.add('button-disabled');
                btn.removeAttribute('clickable');
                btn.setAttribute('material', 'color: #333333');
                btn.object3D.visible = false;
                btn.classList.add('raycast-ignore');
                btn.classList.remove('clickable');
                btn.classList.remove('button-interactive');
                btn.removeAttribute('data-raycastable');
                if (btn.object3D) {
                  btn.object3D.visible = false;
                  btn.object3D.layers.set(31);
                  if (btn.object3D.traverse) {
                    btn.object3D.traverse(function(child) {
                      child.visible = false;
                      child.layers.set(31);
                      child.raycast = function() {};
                    });
                  }
                }
              }
            });
          }
          const gameManager = document.querySelector('[game-manager]');
          if (gameManager && gameManager.components['game-manager']) {
            const manager = gameManager.components['game-manager'];
            if (typeof manager.playMenuMusic === 'function') {
              manager.playMenuMusic();
            } else if (manager.soundEnabled && manager.menuAudio) {
              manager.menuAudio.volume = 0.5;
              manager.menuAudio.play().catch(err => dbgWarn('Menu audio play failed:', err));
            }
          }
          const scanner = document.querySelector('[scanner]');
          const scans = scanner && scanner.components.scanner ? scanner.components.scanner.scanCount : 0;
          let finalScore = 0;
          const gameManagerRef = document.querySelector('[game-manager]');
          if (gameManagerRef && gameManagerRef.components['game-manager']) {
            finalScore = gameManagerRef.components['game-manager'].currentScore || 0;
            dbgLog('Pobrano wynik z game-manager:', finalScore);
          }
          if (finalScore === 0) {
            const laserShooter = document.querySelector('[laser-shooter]');
            if (laserShooter && laserShooter.components['laser-shooter']) {
              finalScore = laserShooter.components['laser-shooter'].score;
              dbgLog('Pobrano wynik z laser-shooter (fallback):', finalScore);
            }
          }
          const finalScans = document.querySelector('#final-scans');
          const finalJunk = document.querySelector('#final-junk');
          const finalTime = document.querySelector('#final-time');
          const finalTotalScore = document.querySelector('#final-total-score');
          if (finalScans) {
            finalScans.setAttribute('value', `${scans}`);
          }
          if (finalJunk) {
            finalJunk.setAttribute('value', `${this.destroyedCount}`);
          }
          if (finalTime) {
            const timeSeconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(timeSeconds / 60);
            const seconds = timeSeconds % 60;
            finalTime.setAttribute('value', `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
          }
          if (finalTotalScore) {
            finalTotalScore.setAttribute('value', finalScore.toLocaleString());
            finalTotalScore.setAttribute('color', '#00ff88');
            const leaderboardPanel = document.querySelector('[leaderboard-system]');
            if (leaderboardPanel && leaderboardPanel.components['leaderboard-system']) {
              leaderboardPanel.components['leaderboard-system'].submitScore(finalScore);
            }
          }
          const countdownText = document.querySelector('#restart-countdown');
          let countdown = 35;
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
          }
          this.countdownInterval = setInterval(() => {
            countdown--;
            if (countdownText) {
              countdownText.setAttribute('value', `${countdown} ${countdown === 1 ? 'second' : 'seconds'}`);
            }
            if (countdown <= 0) {
              clearInterval(this.countdownInterval);
              this.countdownInterval = null;
            }
          }, 1000);
        }
        this.junkObjects.forEach(junk => {
          junk.object3D.traverse((node) => {
            if (node.material) {
              const startOpacity = node.material.opacity;
              const fadeOutDuration = 1000;
              const startTime = Date.now();
              const fadeOut = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / fadeOutDuration, 1);
                node.material.opacity = startOpacity * (1 - progress);
                if (progress < 1) {
                  requestAnimationFrame(fadeOut);
                } else {
                  junk.remove();
                }
              };
              fadeOut();
            }
          });
        });
        this.junkObjects = [];
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
        }
        this.restartTimeout = setTimeout(() => {
          this.restartGame();
          this.restartTimeout = null;
        }, 35000);
      },
      restartGame: function() {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        if (this.restartTimeout) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = null;
        }
        this.junkObjects = [];
        this.spawnTimer = 0;
        this.maxJunk = 2;
        this.destroyedCount = 0;
        this.escapedCount = 0;
        this.allowedEscapes = 0;
        this.gameOver = false;
        this.gameOverShown = false;
        this.difficultyLevel = 0;
        this.gameStartTime = Date.now();
        const gameOverPanel = document.querySelector('#game-over-panel');
        if (gameOverPanel) {
          gameOverPanel.setAttribute('visible', 'false');
          gameOverPanel.object3D.visible = false;
        }
        dbgLog('Przywracam przyciski menu po restarcie');
        const menu = document.querySelector('#menu');
        if (menu) {
          const disabledButtons = menu.querySelectorAll('.button-disabled');
          disabledButtons.forEach(btn => {
            if (btn.id !== 'sound-toggle' && btn.id !== 'ar-toggle') {
              dbgLog('Przywracam przycisk:', btn.id);
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
                btn.setAttribute('material', 'color: #00ff88');
              } else if (btn.id === 'ar-button') {
                btn.setAttribute('material', 'color: #0088ff');
              } else if (btn.id === 'exit-button') {
                btn.setAttribute('material', 'color: #ff6600');
              }
            }
          });
        }
        const gameManager = document.querySelector('[game-manager]');
        if (gameManager && gameManager.components['game-manager']) {
          gameManager.components['game-manager'].startGame();
        }
        const junkCounter = document.querySelector('#junk-counter');
        const escapeCounter = document.querySelector('#escape-counter');
        if (junkCounter) {
          junkCounter.setAttribute('value', 'JUNK: 0');
        }
        if (escapeCounter) {
          escapeCounter.setAttribute('value', 'PASSES: 0');
          escapeCounter.setAttribute('color', '#ff0000');
        }
        const scanner = document.querySelector('[scanner]');
        if (scanner && scanner.components.scanner) {
          scanner.components.scanner.scanCount = 0;
          const scanCounterEl = document.querySelector('#scan-counter');
          if (scanCounterEl) {
            scanCounterEl.setAttribute('value', 'SCANS: 0');
          }
        }
        const laserShooter = document.querySelector('[laser-shooter]');
        if (laserShooter && laserShooter.components['laser-shooter']) {
          laserShooter.components['laser-shooter'].destroyedCount = 0;
        }
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('playing') || this.gameOver) return;
        this._frameSkip++;
        if (this._frameSkip % 2 !== 0) return;
        if (!this._gameManagerEl) {
          this._gameManagerEl = document.querySelector('[game-manager]');
        }
        const gm = this._gameManagerEl && this._gameManagerEl.components ? this._gameManagerEl.components['game-manager'] : null;
        if (gm && (gm.isGameOver || gm.isCampaign)) {
          return; // no spawns or movement when campaign UI is running
        }
        const camera = this.el.sceneEl.camera;
        if (!camera) return;
        camera.getWorldPosition(this._tmpCamPos);
        for (let i = this.junkObjects.length - 1; i >= 0; i--) {
          const junk = this.junkObjects[i];
          if (!junk || junk.dataset.destroyed === 'true') continue;
          junk.object3D.getWorldPosition(this._tmpJunkPos);
          this._tmpToJunk.subVectors(this._tmpJunkPos, this._tmpCamPos);
          const distSq = this._tmpToJunk.lengthSq();
          if (distSq < 25 * 25) {
            const side = Math.random() > 0.5 ? 1 : -1;
            junk.setAttribute('position', {
              x: side * THREE.MathUtils.randFloat(100, 180),
              y: THREE.MathUtils.randFloat(-40, 40),
              z: THREE.MathUtils.randFloat(-600, -900)
            });
          }
          // separation during flight: allow slightly closer traffic so game feels denser
          const sepMin = 44; // separation threshold during flight (increased to avoid mid-flight overlaps)
          for (let j = i - 1; j >= 0; j--) {
            const other = this.junkObjects[j];
            if (!other || other.dataset.destroyed === 'true') continue;
            other.object3D.getWorldPosition(this._tmpOtherPos || (this._tmpOtherPos = new THREE.Vector3()));
            const dx = this._tmpJunkPos.x - this._tmpOtherPos.x;
            const dy = this._tmpJunkPos.y - this._tmpOtherPos.y;
            const dz = this._tmpJunkPos.z - this._tmpOtherPos.z;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 > 0 && d2 < (sepMin * sepMin)) {
              const d = Math.sqrt(d2) || 0.001;
              const nx = dx / d;
              const ny = dy / d;
              const nz = dz / d;
              const push = (sepMin - d) * 0.9; // stronger push

              // immediate small nudge to current positions
              const newPosA = {
                x: junk.object3D.position.x + nx * push,
                y: junk.object3D.position.y + ny * push,
                z: junk.object3D.position.z + nz * push
              };
              const newPosB = {
                x: other.object3D.position.x - nx * push,
                y: other.object3D.position.y - ny * push,
                z: other.object3D.position.z - nz * push
              };
              try {
                junk.setAttribute('position', newPosA);
                other.setAttribute('position', newPosB);
              } catch (e) {}

              // adjust their future end targets so they don't cross paths
              const now = Date.now();
              const adjustEnd = (entity, sign) => {
                try {
                  const mv = entity.object3D.userData && entity.object3D.userData.move ? entity.object3D.userData.move : null;
                  if (!mv) return;
                  const remaining = Math.max((mv.startTime + mv.duration) - now, 120);
                  mv.end.x += nx * push * 1.2 * sign;
                  mv.end.y += ny * push * 0.7 * sign;
                  mv.startTime = now;
                  mv.duration = Math.round(remaining);
                  // reapply animation towards the updated end position with remaining duration
                  try { entity.removeAttribute('animation__move'); } catch(e) {}
                  try {
                    entity.setAttribute('animation__move', {
                      property: 'position',
                      to: { x: mv.end.x, y: mv.end.y, z: mv.end.z },
                      dur: mv.duration,
                      easing: 'linear'
                    });
                  } catch(e) {}
                } catch (e) {}
              };
              adjustEnd(junk, 1);
              adjustEnd(other, -1);
            }
          }
        }
        this.spawnTimer += deltaTime;
        // progressive difficulty: gradually allow more junk over time (capped)
        try {
          const now = Date.now();
          if (now - this._lastProgressIncrease > this.progressIncreaseInterval && this.maxJunk < this.maxPossibleJunk) {
            this.maxJunk += 1;
            this._lastProgressIncrease = now;
            const difficultyPanel = document.querySelector('#difficulty-panel');
            if (difficultyPanel) {
              const difficultyText = document.querySelector('#difficulty-text');
              if (difficultyText) {
                difficultyText.setAttribute('value', `DIFFICULTY UP! ${this.maxJunk} JUNK MAX`);
                difficultyPanel.setAttribute('visible', 'true');
                setTimeout(() => { if (difficultyPanel) difficultyPanel.setAttribute('visible', false); }, 1800);
              }
            }
          }
        } catch (e) {}
        if (this.spawnTimer > this.spawnInterval && this.junkObjects.length < this.maxJunk) {
          this.spawnTimer = 0;
          this.createJunk();
        }
      }
    });
