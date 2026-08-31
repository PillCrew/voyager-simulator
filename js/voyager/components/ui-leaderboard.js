AFRAME.registerComponent('leaderboard-system', {
      schema: {
        leaderboardId: {type: 'string', default: 'default'}
      },
      init: function() {
        this.topCount = 8;
        this.scoresContainer = this.el.querySelector('.scores-container');
        this.userScoreContainer = this.el.querySelector('.user-score-container');
        this._minRefreshIntervalMs = 8000;
        this._inFlight = false;
        this._lastRefreshAt = 0;
        this._refreshTimer = null;
        this._backoffMs = 0;
        this._backoffUntil = 0;
        this._onSdkLoaded = () => this.scheduleRefresh(0);
        window.addEventListener('heyvr_sdk_loaded', this._onSdkLoaded);
        this._onComponentChanged = (evt) => {
          if (!evt || !evt.detail || evt.detail.name !== 'visible') return;
          const vis = this.el.getAttribute('visible');
          if (vis !== false && vis !== 'false') {
            this.scheduleRefresh(0);
          }
        };
        this.el.addEventListener('componentchanged', this._onComponentChanged);
        this.scheduleRefresh(0);
      },
      remove: function() {
        if (this._refreshTimer) {
          clearTimeout(this._refreshTimer);
          this._refreshTimer = null;
        }
        if (this._onSdkLoaded) {
          window.removeEventListener('heyvr_sdk_loaded', this._onSdkLoaded);
        }
        if (this._onComponentChanged) {
          this.el.removeEventListener('componentchanged', this._onComponentChanged);
        }
      },
      scheduleRefresh: function(delayMs) {
        const d = Math.max(0, delayMs || 0);
        if (this._refreshTimer) {
          clearTimeout(this._refreshTimer);
          this._refreshTimer = null;
        }
        this._refreshTimer = setTimeout(() => {
          this._refreshTimer = null;
          this.refreshScores();
        }, d);
      },
      _applyBackoff: function() {
        const now = Date.now();
        const next = this._backoffMs ? Math.min(this._backoffMs * 2, 5 * 60 * 1000) : 15000;
        this._backoffMs = next;
        this._backoffUntil = now + next;
        this.scheduleRefresh(next);
      },
      _getStatusCode: function(err) {
        return (
          (err && err.status && (err.status.code || err.status.status)) ||
          (err && err.status && typeof err.status === 'number' ? err.status : null) ||
          (err && err.response && err.response.status) ||
          (err && err.code) ||
          null
        );
      },
      refreshScores: function() {
        const visible = this.el.getAttribute('visible');
        if (visible === false || visible === 'false') {
          this.scheduleRefresh(30000);
          return;
        }
        const now = Date.now();
        if (this._inFlight) {
          this.scheduleRefresh(this._minRefreshIntervalMs);
          return;
        }
        if (now < this._backoffUntil) {
          this.scheduleRefresh(this._backoffUntil - now);
          return;
        }
        if (now - this._lastRefreshAt < this._minRefreshIntervalMs) {
          this.scheduleRefresh(this._minRefreshIntervalMs - (now - this._lastRefreshAt));
          return;
        }
        this._inFlight = true;
        if (typeof heyVR !== 'undefined' && heyVR.leaderboard) {
          const topPromise = heyVR.leaderboard
            .get(this.data.leaderboardId, this.topCount, 1)
            .then(scores => {
              this._backoffMs = 0;
              this._backoffUntil = 0;
              if (Array.isArray(scores)) {
                this.updateDisplay(scores);
              } else {
                dbgWarn('Unexpected response format:', scores);
                this.updateDisplay([]);
              }
            })
            .catch(err => {
              const code = this._getStatusCode(err);
              if (code === 429) {
                dbgWarn('Leaderboard rate limited (top). Backing off.');
                this._applyBackoff();
                return;
              }
              console.error('Leaderboard error:', err);
              this.showError();
            });
          const userPromise = (heyVR.user)
            ? (() => {
                const checkLogin = (typeof heyVR.user.isLoggedIn === 'function')
                  ? Promise.resolve(heyVR.user.isLoggedIn())
                  : Promise.resolve(heyVR.user.isLoggedIn);
                return checkLogin
                  .then(loggedIn => loggedIn ? heyVR.user.getName() : null)
                  .then(username => {
                    if (!username) {
                      this.updateUserDisplay([], null);
                      return;
                    }
                    return heyVR.leaderboard.getMy(this.data.leaderboardId, 1)
                      .then(scores => this.updateUserDisplay(scores, username))
                      .catch(err => {
                        const code = this._getStatusCode(err);
                        if (code === 429) {
                          dbgWarn('Leaderboard rate limited (me). Backing off.');
                          this._applyBackoff();
                          return;
                        }
                        dbgWarn('User score fetch error', err);
                        this.updateUserDisplay([], null);
                      });
                  })
                  .catch(err => {
                    const code = this._getStatusCode(err);
                    if (code === 429) {
                      dbgWarn('Leaderboard rate limited (user). Backing off.');
                      this._applyBackoff();
                      return;
                    }
                    dbgWarn('User score fetch error', err);
                    this.updateUserDisplay([], null);
                  });
              })()
            : Promise.resolve();
          Promise.allSettled([topPromise, userPromise]).finally(() => {
            this._inFlight = false;
            this._lastRefreshAt = Date.now();
            if (this._backoffUntil && Date.now() < this._backoffUntil) {
              this.scheduleRefresh(this._backoffUntil - Date.now());
            } else {
              this.scheduleRefresh(30000);
            }
          });
        } else {
          dbgLog('HeyVR SDK not loaded or leaderboard not available');
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
             this.updateDisplay([
               {rank: 1, user: 'DEV_TEST', score: 9999, created_at: new Date().toISOString()},
               {rank: 2, user: 'PLAYER_1', score: 5000, created_at: new Date().toISOString()},
               {rank: 3, user: 'VOYAGER', score: 2500, created_at: new Date().toISOString()},
               {rank: 4, user: 'TEST_4', score: 2000, created_at: new Date().toISOString()},
               {rank: 5, user: 'TEST_5', score: 1500, created_at: new Date().toISOString()},
               {rank: 6, user: 'TEST_6', score: 1000, created_at: new Date().toISOString()},
               {rank: 7, user: 'TEST_7', score: 500, created_at: new Date().toISOString()},
               {rank: 8, user: 'TEST_8', score: 250, created_at: new Date().toISOString()}
             ]);
             const localScore = parseInt(localStorage.getItem('voyager_best_score_' + this.data.leaderboardId) || '0');
             this.updateUserDisplay([{rank: '?', user: 'YOU', score: localScore}], 'YOU');
          }
          this._inFlight = false;
          this._lastRefreshAt = Date.now();
          this.scheduleRefresh(30000);
        }
      },
      updateUserDisplay: function(scores, currentUserName) {
         if (!this.userScoreContainer) return;
         while(this.userScoreContainer.firstChild) {
            this.userScoreContainer.removeChild(this.userScoreContainer.firstChild);
         }
         let entry = null;
         if (Array.isArray(scores) && scores.length > 0) {
            const candidate = scores[0];
            if (currentUserName && candidate.user === currentUserName) {
                entry = candidate;
            } else if (currentUserName) {
            dbgLog(`[Leaderboard] User mismatch in getMy(). Candidate: ${candidate.user}, Me: ${currentUserName}. Assuming unranked.`);
            }
         }
         if (!entry) {
            entry = {rank: '-', user: 'YOU', score: 0};
         }
         const bg = document.createElement('a-plane');
         bg.setAttribute('width', '2.8');
         bg.setAttribute('height', '0.4');
         bg.setAttribute('color', '#004488');
         bg.setAttribute('opacity', '0.5');
         this.userScoreContainer.appendChild(bg);
         const rankText = document.createElement('a-text');
         rankText.setAttribute('value', `#${(entry.score > 0 ? entry.rank : '-') || '-'}`);
         rankText.setAttribute('position', `-1.2 0 0.01`);
         rankText.setAttribute('color', '#ffdd00');
         rankText.setAttribute('width', '2.5');
         this.userScoreContainer.appendChild(rankText);
         const nameText = document.createElement('a-text');
         nameText.setAttribute('value', 'YOU');
         nameText.setAttribute('position', `-0.8 0 0.01`);
         nameText.setAttribute('color', '#ffffff');
         nameText.setAttribute('width', '2.5');
         this.userScoreContainer.appendChild(nameText);
         const scoreText = document.createElement('a-text');
         scoreText.setAttribute('value', (entry.score || 0).toLocaleString());
         scoreText.setAttribute('position', `1.2 0 0.01`);
         scoreText.setAttribute('align', 'right');
         scoreText.setAttribute('color', '#00ffaa');
         scoreText.setAttribute('width', '2.5');
         this.userScoreContainer.appendChild(scoreText);
      },
      updateDisplay: function(scores) {
        while(this.scoresContainer.firstChild) {
          this.scoresContainer.removeChild(this.scoresContainer.firstChild);
        }
        if (!scores || !Array.isArray(scores) || scores.length === 0) {
          const noScores = document.createElement('a-text');
          noScores.setAttribute('value', 'No scores yet');
          noScores.setAttribute('align', 'center');
          noScores.setAttribute('position', '0 0 0');
          noScores.setAttribute('width', '3');
          this.scoresContainer.appendChild(noScores);
          return;
        }
        const topCount = this.topCount || 8;
        for (let index = 0; index < topCount; index++) {
          const entry = (scores && scores[index]) ? scores[index] : null;
          const rankNumber = entry && typeof entry.rank === 'number' ? entry.rank : (index + 1);
          const yPos = 0.8 - (index * 0.35);
          const rankText = document.createElement('a-text');
          rankText.setAttribute('value', `#${rankNumber}`);
          rankText.setAttribute('position', `-1.2 ${yPos} 0`);
          rankText.setAttribute('color', rankNumber === 1 ? '#ffdd00' : rankNumber === 2 ? '#c0c0c0' : rankNumber === 3 ? '#cd7f32' : '#ffffff');
          rankText.setAttribute('width', '2.5');
          this.scoresContainer.appendChild(rankText);
          let userName = (entry && entry.user) ? entry.user : '---';
          if (userName.length > 12) {
            userName = userName.substring(0, 10) + '..';
          }
          const nameText = document.createElement('a-text');
          nameText.setAttribute('value', userName);
          nameText.setAttribute('position', `-0.8 ${yPos} 0`);
          nameText.setAttribute('color', '#ffffff');
          nameText.setAttribute('width', '2.5');
          this.scoresContainer.appendChild(nameText);
          const scoreText = document.createElement('a-text');
          scoreText.setAttribute('value', entry && typeof entry.score === 'number' ? entry.score.toLocaleString() : '-');
          scoreText.setAttribute('position', `1.2 ${yPos} 0`);
          scoreText.setAttribute('align', 'right');
          scoreText.setAttribute('color', '#00ffaa');
          scoreText.setAttribute('width', '2.5');
          this.scoresContainer.appendChild(scoreText);
        }
      },
      showError: function() {
        while(this.scoresContainer.firstChild) {
          this.scoresContainer.removeChild(this.scoresContainer.firstChild);
        }
        const errorText = document.createElement('a-text');
        errorText.setAttribute('value', 'Connection Error');
        errorText.setAttribute('align', 'center');
        errorText.setAttribute('color', '#ff0000');
        errorText.setAttribute('width', '3');
        this.scoresContainer.appendChild(errorText);
      },
      submitScore: function(score) {
        if (typeof heyVR !== 'undefined' && heyVR.leaderboard) {
          const intScore = Math.max(1, Math.floor(score));
          if (heyVR.user && heyVR.user.isLoggedIn && !heyVR.user.isLoggedIn()) {
            dbgWarn('User not logged in - cannot submit score');
            this.refreshScores();
            return;
          }
          localStorage.setItem('voyager_best_score_' + this.data.leaderboardId, intScore);
          heyVR.leaderboard.postScore(this.data.leaderboardId, intScore).then((response) => {
            setTimeout(() => {
              this.refreshScores();
            }, 500);
          }).catch(err => {
            console.error('Score submission error:', err);
            if (PUBLISH_DEBUG) {
              console.error('Error details:', {
                leaderboardId: this.data.leaderboardId,
                score: intScore,
                errorMessage: err.message || err,
                errorStatus: err.status || 'unknown',
                userLoggedIn: heyVR.user ? heyVR.user.isLoggedIn() : 'unknown'
              });
            }
            this.refreshScores();
          });
        } else {
          dbgLog('HeyVR SDK not available - Score submitted (mock):', score);
        }
      }
    });
