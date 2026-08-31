
AFRAME.registerComponent('star-system', {
  schema: {
    numStars: {type: 'number', default: 600}, 
    size: {type: 'number', default: 5000},
    speed: {type: 'number', default: 0.1}
  },

  init: function () {
    const data = this.data;
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    const starColors = [];

    const color = new THREE.Color();

    for (let i = 0; i < data.numStars; i++) {
      
      const x = THREE.MathUtils.randFloatSpread(data.size * 0.8);
      const y = THREE.MathUtils.randFloatSpread(data.size * 0.8);
      
      const z = THREE.MathUtils.randFloat(-data.size, data.size * 0.3);
      starPositions.push(x, y, z);

      
      const starType = Math.random();
      if (starType < 0.6) {
        
        color.setRGB(1.0, 1.0, THREE.MathUtils.randFloat(0.95, 1.0));
      } else if (starType < 0.75) {
        
        color.setRGB(THREE.MathUtils.randFloat(0.7, 0.9), THREE.MathUtils.randFloat(0.8, 0.95), 1.0);
      } else if (starType < 0.9) {
        
        color.setRGB(1.0, THREE.MathUtils.randFloat(0.9, 1.0), THREE.MathUtils.randFloat(0.7, 0.85));
      } else {
        
        color.setRGB(1.0, THREE.MathUtils.randFloat(0.6, 0.8), THREE.MathUtils.randFloat(0.5, 0.7));
      }
      starColors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

    const starsMaterial = new THREE.PointsMaterial({
      size: 3.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      map: this.createStarTexture()
    });

    this.stars = new THREE.Points(starsGeometry, starsMaterial);
    this.stars.renderOrder = 1; 
    this.el.setObject3D('stars', this.stars);

    this.baseSpeed = this.data.speed;
  },

  setSpeed: function (newSpeed) {
    this.data.speed = newSpeed;
  },

  resetSpeed: function () {
    this.data.speed = this.baseSpeed;
  },

  createStarTexture: function() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  },

  tick: function (time, deltaTime) {
    if (!this.el.sceneEl.is('playing')) return;

    const currentSpeed = this.data.speed;
    if (!currentSpeed) return;

    const dt = Math.min(deltaTime, 50); 
    const positions = this.stars.geometry.attributes.position.array;
    const colors = this.stars.geometry.attributes.color.array;
    const halfSize = this.data.size / 2;
    const respawnDistance = halfSize * 0.7; 
    
    
    if (!this.frameSkip) this.frameSkip = 0;
    this.frameSkip++;
    const shouldUpdate = this.frameSkip % 2 === 0;

    let hasCamera = false;
    if (shouldUpdate) {
      const camera = this.el.sceneEl.camera;
      if (camera) {
        if (!this._cameraDir) this._cameraDir = new THREE.Vector3();
        this._cameraDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        hasCamera = true;
      }
    }

    for (let i = 0; i < positions.length; i += 3) {
      
      positions[i + 2] += currentSpeed * (dt / 16);

      
      if (shouldUpdate && positions[i + 2] > respawnDistance) {
        
        let spawnX, spawnY, spawnZ;
        spawnZ = -halfSize - THREE.MathUtils.randFloat(0, 500);

        // Spawn stars where the user is looking
        if (hasCamera && this._cameraDir.z < -0.2) {
            const t = spawnZ / this._cameraDir.z;
            const centerX = this._cameraDir.x * t;
            const centerY = this._cameraDir.y * t;
            
            // Concentrated spread around gaze direction
            const spread = 2500; 
            spawnX = centerX + THREE.MathUtils.randFloatSpread(spread);
            spawnY = centerY + THREE.MathUtils.randFloatSpread(spread);
        } else {
            spawnX = THREE.MathUtils.randFloatSpread(this.data.size * 0.8);
            spawnY = THREE.MathUtils.randFloatSpread(this.data.size * 0.8);
        }

        positions[i] = spawnX;
        positions[i + 1] = spawnY;
        positions[i + 2] = spawnZ;

        
        if (!this._colorCache) this._colorCache = new THREE.Color();
        const starType = Math.random();
        if (starType < 0.6) {
          this._colorCache.setRGB(1.0, 1.0, THREE.MathUtils.randFloat(0.95, 1.0));
        } else if (starType < 0.75) {
          this._colorCache.setRGB(THREE.MathUtils.randFloat(0.7, 0.9), THREE.MathUtils.randFloat(0.8, 0.95), 1.0);
        } else if (starType < 0.9) {
          this._colorCache.setRGB(1.0, THREE.MathUtils.randFloat(0.9, 1.0), THREE.MathUtils.randFloat(0.7, 0.85));
        } else {
          this._colorCache.setRGB(1.0, THREE.MathUtils.randFloat(0.6, 0.8), THREE.MathUtils.randFloat(0.5, 0.7));
        }
        colors[i] = this._colorCache.r;
        colors[i + 1] = this._colorCache.g;
        colors[i + 2] = this._colorCache.b;
      }
    }

    this.stars.geometry.attributes.position.needsUpdate = true;
    
    
    if (shouldUpdate) this.stars.geometry.attributes.color.needsUpdate = true;
  }
});