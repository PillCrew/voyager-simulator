window.onload = function() {
      if (window.location.protocol === 'file:') {
        alert('ERROR: You launched the game directly from a file!\n\nBrowsers BLOCK textures in this mode (CORS error).\n\nYou must run "start_server.bat" and visit http://localhost:8000');
        setTimeout(() => {
          const scene = document.querySelector('a-scene');
          const text = document.createElement('a-text');
          text.setAttribute('value', 'LAUNCH VIA\nstart_server.bat\n(CORS Error)');
          text.setAttribute('position', '0 1.6 -2');
          text.setAttribute('align', 'center');
          text.setAttribute('color', 'red');
          text.setAttribute('scale', '2 2 2');
          text.setAttribute('look-at', '[camera]');
          scene.appendChild(text);
        }, 1000);
      }
    };
