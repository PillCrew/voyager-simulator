AFRAME.registerComponent('vr-performance', {
      schema: {
        emulateQuestOnDesktop: { default: true },
        desktopPixelRatio: { default: 1.5 },
        questFramebufferScaleFactor: { default: 1.0 },
        questFoveation: { default: 0 }
      },
      init: function() {
        this.fpsCounter = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.lowFpsThreshold = 60;
        this.qualityReductionFactor = 0.9;
        this._onResize = () => this.applyDesktopQuestEmulation();
        this._onRenderStart = () => this.applyDesktopQuestEmulation();
        this.optimizeForVR();
        this.reduceParticleEffects();
        window.addEventListener('resize', this._onResize);
        this.el.sceneEl.addEventListener('renderstart', this._onRenderStart);
        this.el.sceneEl.addEventListener('enter-vr', () => {
           setTimeout(() => {
             this.optimizeForVR();
           }, 1000);
        });
        this.el.sceneEl.addEventListener('exit-vr', () => {
          setTimeout(() => {
            this.applyDesktopQuestEmulation();
          }, 100);
        });
      },
      remove: function() {
        window.removeEventListener('resize', this._onResize);
        if (this.el && this.el.sceneEl) {
          this.el.sceneEl.removeEventListener('renderstart', this._onRenderStart);
        }
      },
      applyDesktopQuestEmulation: function() {
        if (!this.data.emulateQuestOnDesktop) return;
        if (AFRAME.utils.device.isMobile()) return;
        const scene = this.el.sceneEl;
        if (!scene || scene.is('vr-mode')) return;
        const renderer = scene.renderer;
        if (!renderer) return;
        this.applySharedRendererProfile(renderer);
        const targetPixelRatio = Math.max(0.25, Math.min(this.data.desktopPixelRatio, 2.0));
        renderer.setPixelRatio(targetPixelRatio);
      },
      applySharedRendererProfile: function(renderer) {
        try {
          if (typeof renderer.toneMapping !== 'undefined' && typeof THREE !== 'undefined') {
            renderer.toneMapping = THREE.NoToneMapping;
          }
          if (typeof renderer.toneMappingExposure !== 'undefined') {
            renderer.toneMappingExposure = 1.0;
          }
          if (typeof renderer.outputColorSpace !== 'undefined' && typeof THREE !== 'undefined' && THREE.SRGBColorSpace) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
          } else if (typeof renderer.outputEncoding !== 'undefined' && typeof THREE !== 'undefined' && THREE.sRGBEncoding) {
            renderer.outputEncoding = THREE.sRGBEncoding;
          }
          if (typeof renderer.dithering !== 'undefined') {
            renderer.dithering = false;
          }
        } catch (e) {
        }
      },
      optimizeForVR: function() {
        const renderer = this.el.sceneEl.renderer;
        if (renderer) {
          this.applySharedRendererProfile(renderer);
          const devicePixelRatio = window.devicePixelRatio || 1;
          const isDesktopQuestEmulation =
            this.data.emulateQuestOnDesktop &&
            !AFRAME.utils.device.isMobile() &&
            !this.el.sceneEl.is('vr-mode');
          const optimalPixelRatio = isDesktopQuestEmulation
            ? this.data.desktopPixelRatio
            : (AFRAME.utils.device.isMobile() ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2.0));
          renderer.setPixelRatio(optimalPixelRatio);
          renderer.shadowMap.enabled = false;
          renderer.shadowMap.autoUpdate = false;
          if (renderer.xr) {
             renderer.xr.enabled = true;
             try {
                const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
                const isQuest3 = /Quest 3/i.test(ua);
                const isQuest = /Quest/i.test(ua);
                let desiredScale;
                if (this.data.questFramebufferScaleFactor > 0 && this.data.questFramebufferScaleFactor !== 1.0) {
                  desiredScale = this.data.questFramebufferScaleFactor;
                } else if (isQuest3) {
                  desiredScale = 1.2;
                } else if (isQuest) {
                  desiredScale = 0.9;
                } else {
                  desiredScale = 0.8;
                }
                const scaleFactor = Math.max(0.25, Math.min(desiredScale, 2.0));
                if (typeof renderer.xr.setFramebufferScaleFactor === 'function') {
                  renderer.xr.setFramebufferScaleFactor(scaleFactor);
                  dbgLog('XR Framebuffer Scale Factor set to:', scaleFactor);
                }
                const desiredFoveation = isQuest ? this.data.questFoveation : 1.0;
                const foveation = Math.max(0.0, Math.min(desiredFoveation, 1.0));
                if (typeof renderer.xr.setFoveation === 'function') {
                  renderer.xr.setFoveation(foveation);
                  dbgLog('XR Foveation set to:', foveation);
                }
             } catch(e) {
                dbgLog('Could not set XR framebuffer scale factor');
             }
          }
          dbgLog('Renderer optimized for PERFORMANCE - pixel ratio:', optimalPixelRatio);
        }
        const camera = this.el.sceneEl.camera;
        if (camera) {
          camera.near = 0.1;
          camera.far = 8000;
          camera.updateProjectionMatrix();
        }
      },
      reduceParticleEffects: function() {
        const bgStars = document.querySelector('[background-stars]');
        if (bgStars) {
          const comp = bgStars.components && bgStars.components['background-stars'];
          const currentCount = (comp && comp.data && comp.data.count) ? comp.data.count : 0;
          const capped = Math.min(currentCount || 1500, 1200);
          bgStars.setAttribute('background-stars', 'count', capped);
        }
        const supernovae = document.querySelector('[supernovae]');
        if (supernovae && supernovae.components && supernovae.components.supernovae) {
          const sn = supernovae.components.supernovae;
          sn.spawnInterval = Math.max(sn.spawnInterval, 30000);
          sn.maxSupernovae = 1;
        }
        const dust = document.querySelector('[cosmic-dust]');
        if (dust) dust.setAttribute('visible', false);
      },
      tick: function(time, deltaTime) {
        if (!this.el.sceneEl.is('vr-mode')) return;
        this.frameCount++;
        if (time - this.lastTime >= 1000) {
          this.fpsCounter = this.frameCount;
          this.frameCount = 0;
          this.lastTime = time;
          if (this.fpsCounter < 45) {
            this.reduceQuality();
          }
        }
      },
      reduceQuality: function() {
        const renderer = this.el.sceneEl.renderer;
        if (renderer) {
          const currentPixelRatio = renderer.getPixelRatio();
          const newPixelRatio = Math.max(currentPixelRatio * this.qualityReductionFactor, 0.5);
          if (newPixelRatio < currentPixelRatio) {
            renderer.setPixelRatio(newPixelRatio);
            dbgLog('Reduced pixel ratio to', newPixelRatio, 'due to low FPS:', this.fpsCounter);
          }
        }
        if (this.fpsCounter < 45) {
          this.emergencyParticleReduction();
        }
      },
      emergencyParticleReduction: function() {
        const renderer = this.el.sceneEl.renderer;
        if (renderer) {
          const currentPixelRatio = renderer.getPixelRatio();
          const newPixelRatio = Math.max(currentPixelRatio * 0.8, 0.4);
          if (newPixelRatio < currentPixelRatio) {
            renderer.setPixelRatio(newPixelRatio);
            dbgLog('Emergency pixel ratio cut to', newPixelRatio);
          }
        }
        const bgStars = document.querySelector('[background-stars]');
        if (bgStars) {
          bgStars.setAttribute('background-stars', 'count', 600);
        }
        const supernovae = document.querySelector('[supernovae]');
        if (supernovae && supernovae.components && supernovae.components.supernovae) {
          const sn = supernovae.components.supernovae;
          sn.spawnInterval = 60000;
          sn.maxSupernovae = 0;
          sn.clearOldSupernovae && sn.clearOldSupernovae();
        }
        const dust = document.querySelector('[cosmic-dust]');
        if (dust) dust.setAttribute('visible', false);
      }
    });
