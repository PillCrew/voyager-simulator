const PUBLISH_DEBUG = false;
    const dbgLog = (...args) => { if (PUBLISH_DEBUG) console.log(...args); };
    const dbgWarn = (...args) => { if (PUBLISH_DEBUG) console.warn(...args); };
    if (typeof window !== 'undefined') {
      window.PUBLISH_DEBUG = PUBLISH_DEBUG;
      window.dbgLog = dbgLog;
      window.dbgWarn = dbgWarn;
    }
    (function installCrashOverlay() {
      if (typeof window === 'undefined') return;
      const DISABLE_OVERLAY = true; // VR: never show red runtime error text
      if (DISABLE_OVERLAY) {
        // Swallow errors without overlay; still log to console for dev
        window.addEventListener('error', (ev) => {
          const details = ev && ev.error ? (ev.error.stack || ev.error.message || String(ev.error)) : (ev && ev.message ? String(ev.message) : 'Unknown error');
          console.error('Uncaught error (overlay disabled):', details);
        });
        window.addEventListener('unhandledrejection', (ev) => {
          const r = ev && ev.reason;
          const details = r ? (r.stack || r.message || String(r)) : 'Unknown rejection';
          console.error('Unhandled promise rejection (overlay disabled):', details);
        });
        return;
      }
      let shown = false;
      const showOnce = (title, details) => {
        try {
          if (shown) return;
          shown = true;
          const msg = `${title}\n${details || ''}`.trim();
          console.error(msg);
          const attach = () => {
            const scene = document.querySelector('a-scene');
            if (!scene) return;
            const textEntity = document.createElement('a-entity');
            textEntity.setAttribute('position', '0 1.7 -2');
            textEntity.setAttribute('scale', '1.4 1.4 1.4');
            textEntity.setAttribute('text', {
              value: `RUNTIME ERROR\n\n${msg}`,
              align: 'center',
              color: 'red',
              width: 2.8,
              wrapCount: 44
            });
            scene.appendChild(textEntity);
          };
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            attach();
            setTimeout(attach, 500);
            setTimeout(attach, 1500);
          } else {
            window.addEventListener('DOMContentLoaded', () => {
              attach();
              setTimeout(attach, 500);
              setTimeout(attach, 1500);
            }, { once: true });
          }
        } catch (e) {
        }
      };
      window.addEventListener('error', (ev) => {
        const details = ev && ev.error ? (ev.error.stack || ev.error.message || String(ev.error)) : (ev && ev.message ? String(ev.message) : 'Unknown error');
        showOnce('Uncaught error', details);
      });
      window.addEventListener('unhandledrejection', (ev) => {
        const r = ev && ev.reason;
        const details = r ? (r.stack || r.message || String(r)) : 'Unknown rejection';
        showOnce('Unhandled promise rejection', details);
      });
    })();
    try {
      if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
        const desc = Object.getOwnPropertyDescriptor(THREE.WebGLRenderer.prototype, 'useLegacyLights');
        if (desc && (desc.get || desc.set)) {
          let _legacyFlag = false;
          Object.defineProperty(THREE.WebGLRenderer.prototype, 'useLegacyLights', {
            configurable: true,
            enumerable: true,
            get() { return _legacyFlag; },
            set(v) { _legacyFlag = !!v; }
          });
        }
      }
    } catch (e) {
    }

    // Suppress annoying "entryType: longtask" warnings
    (function() {
        // 1. Intercept console.warn
        if (typeof console !== 'undefined' && console.warn) {
            const originalWarn = console.warn;
            console.warn = function(...args) {
                const msg = args.map(String).join(' ');
                if ((msg.includes('entryType') && msg.includes('longtask')) || 
                    (msg.includes('Ignorowanie') && msg.includes('longtask'))) {
                    return;
                }
                originalWarn.apply(console, args);
            };
        }

        // 2. Shim PerformanceObserver to filter out unsupported types
        if (typeof PerformanceObserver !== 'undefined') {
            const OriginalPerformanceObserver = PerformanceObserver;
            window.PerformanceObserver = function(callback) {
                const observer = new OriginalPerformanceObserver(callback);
                const originalObserve = observer.observe.bind(observer);
                observer.observe = function(options) {
                    if (options && Array.isArray(options.entryTypes)) {
                        // Filter out 'longtask' if it causes issues
                        const safeTypes = options.entryTypes.filter(t => t !== 'longtask');
                        if (safeTypes.length < options.entryTypes.length) {
                            // If we filtered something, use the safe list
                            // If list becomes empty, don't observe to avoid error
                            if (safeTypes.length === 0) return; 
                            options.entryTypes = safeTypes;
                        }
                    }
                    return originalObserve(options);
                };
                return observer;
            };
            window.PerformanceObserver.supportedEntryTypes = OriginalPerformanceObserver.supportedEntryTypes;
        }
    })();
