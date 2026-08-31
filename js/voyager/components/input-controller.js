AFRAME.registerComponent('vr-controller', {
      init: function() {
        this.raycaster = new THREE.Raycaster();
        this.leftController = null;
        this.rightController = null;
        this.el.sceneEl.addEventListener('controllerconnected', (evt) => {
          this.onControllerConnected(evt);
        });
      },
      onControllerConnected: function(evt) {
        const controller = evt.detail;
        if (controller.hand === 'left') {
          this.leftController = evt.target;
          this.setupControllerEvents(evt.target, 'left');
        } else if (controller.hand === 'right') {
          this.rightController = evt.target;
          this.setupControllerEvents(evt.target, 'right');
        }
      },
      setupControllerEvents: function(controllerEl, hand) {
        controllerEl.addEventListener('triggerdown', () => {
          this.handleTrigger(hand);
        });
        controllerEl.addEventListener('gripdown', () => {
          this.handleGrip(hand);
        });
        controllerEl.addEventListener('abuttondown', () => {
          this.handleTrigger(hand);
        });
        controllerEl.addEventListener('xbuttondown', () => {
          this.handleTrigger(hand);
        });
      },
      handleTrigger: function(hand) {
        const menu = document.querySelector('#menu');
        const tutorialPanel = document.querySelector('#tutorial-panel');
        const scene = this.el.sceneEl;
        if ((menu && menu.getAttribute('visible')) || (tutorialPanel && tutorialPanel.getAttribute('visible'))) {
          const raycaster = this.el.sceneEl.systems.raycaster;
          return;
        }
        if (scene.is('playing')) {
          const camera = document.querySelector('[scanner]');
          if (camera && camera.components.scanner) {
            camera.components.scanner.activateScanner();
          }
        }
      },
      handleGrip: function(hand) {
        dbgLog('Grip pressed on', hand, 'controller');
        const scene = this.el.sceneEl;
        if (scene.is('playing')) {
          const camera = document.querySelector('[laser-shooter]');
          if (camera && camera.components['laser-shooter']) {
            dbgLog('Shooting from controller');
            camera.components['laser-shooter'].shoot();
          }
        }
      }
    });
