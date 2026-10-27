/* =========================================================
   CHRONO SURGE: BEGINNING - INPUT, CONTROLS & LIFECYCLE
   Desktop keyboard/mouse, mobile virtual joystick & touch zones,
   gamepad mapping, mode selectors & onboarding routing.
   ========================================================= */

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new ChronoGame(canvas);
  window.chronoGame = game;

  // Initialize Canvas resolution
  game.resize();
  window.addEventListener('resize', () => game.resize());

  // UI Screens
  const titleScreen = document.getElementById('screen-title');
  const gameoverScreen = document.getElementById('screen-gameover');
  const briefingScreen = document.getElementById('screen-briefing');
  const pauseScreen = document.getElementById('screen-pause');
  const onboardingScreen = document.getElementById('screen-onboarding');
  const crtOverlay = document.getElementById('crt-overlay');
  const touchControls = document.getElementById('touch-controls');

  // Daily chip date indicator on main menu
  const dailyChip = document.getElementById('daily-chip');
  if (dailyChip) {
    const today = new Date();
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    dailyChip.textContent = `${months[today.getUTCMonth()]} ${today.getUTCDate()}`;
  }

  // Check First-Time User Onboarding
  const prog = () => window.progression;
  const isFirstTime = !prog()?.profile?.tutorialCompleted && !localStorage.getItem('chrono_onboarded');
  if (isFirstTime && onboardingScreen) {
    titleScreen.classList.remove('active');
    titleScreen.classList.add('hidden');
    onboardingScreen.classList.remove('hidden');
    onboardingScreen.classList.add('active');
  }

  // Onboarding Buttons
  const btnOnboardTrain = document.getElementById('btn-onboard-train');
  const btnOnboardSkip = document.getElementById('btn-onboard-skip');
  const onboardName = document.getElementById('onboard-name');

  if (btnOnboardTrain) {
    btnOnboardTrain.addEventListener('click', () => {
      const name = (onboardName?.value || '').trim().replace(/[<>]/g, '');
      if (name.length >= 2) {
        prog().profile.displayName = name.slice(0, 24).toUpperCase();
        prog().saveLocalProfile();
      }
      localStorage.setItem('chrono_onboarded', 'true');
      onboardingScreen.classList.remove('active');
      onboardingScreen.classList.add('hidden');
      game.startNewGame(activeCore, 'tutorial');
      updateTouchControlsVisibility();
    });
  }

  if (btnOnboardSkip) {
    btnOnboardSkip.addEventListener('click', () => {
      const name = (onboardName?.value || '').trim().replace(/[<>]/g, '');
      if (name.length >= 2) {
        prog().profile.displayName = name.slice(0, 24).toUpperCase();
        prog().saveLocalProfile();
      }
      localStorage.setItem('chrono_onboarded', 'true');
      onboardingScreen.classList.remove('active');
      onboardingScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
      titleScreen.classList.add('active');
      if (window.refreshAllMetaUI) window.refreshAllMetaUI();
    });
  }

  // Core Vessel Selection
  let activeCore = prog()?.profile?.equippedCore || 'vanguard';
  const coreCards = document.querySelectorAll('.core-card');
  coreCards.forEach(card => {
    card.addEventListener('click', () => {
      coreCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activeCore = card.dataset.core;
      if (prog()) {
        prog().profile.equippedCore = activeCore;
        prog().saveLocalProfile();
      }
      if (window.chronoAudio?.playComboChord) {
        window.chronoAudio.playComboChord(1);
      }
    });
  });

  // Start Endless Button
  const btnStart = document.getElementById('btn-start');
  function openThreatBriefing() {
    titleScreen.classList.remove('active');
    titleScreen.classList.add('hidden');
    briefingScreen.classList.remove('hidden');
    briefingScreen.classList.add('active');
    game.state = 'BRIEFING';
  }

  function deployFromBriefing() {
    briefingScreen.classList.remove('active');
    briefingScreen.classList.add('hidden');
    game.startNewGame(activeCore, 'endless');
    updateTouchControlsVisibility();
  }

  if (btnStart) btnStart.addEventListener('click', openThreatBriefing);

  const btnDeploy = document.getElementById('btn-deploy');
  if (btnDeploy) btnDeploy.addEventListener('click', deployFromBriefing);

  // Daily Challenge Mode
  const btnDaily = document.getElementById('btn-daily');
  if (btnDaily) {
    btnDaily.addEventListener('click', async () => {
      titleScreen.classList.remove('active');
      titleScreen.classList.add('hidden');
      if (window.toast) window.toast('Initiating Daily Challenge…', 'info', 1800);
      try {
        const res = await fetch('/api/daily');
        if (res.ok) {
          const dailyData = await res.json();
          game.startNewGame(activeCore, 'daily', dailyData);
        } else {
          throw new Error('Fallback to local daily seed');
        }
      } catch {
        // Fallback deterministic local date seed
        const todayStr = new Date().toISOString().slice(0, 10);
        let hash = 0;
        for (let i = 0; i < todayStr.length; i++) hash = ((hash << 5) - hash + todayStr.charCodeAt(i)) | 0;
        game.startNewGame(activeCore, 'daily', { seed: Math.abs(hash), date: todayStr, title: 'DAILY CHRONO RUN' });
      }
      updateTouchControlsVisibility();
    });
  }

  // Interactive Training Mode
  const btnTraining = document.getElementById('btn-training');
  if (btnTraining) {
    btnTraining.addEventListener('click', () => {
      titleScreen.classList.remove('active');
      titleScreen.classList.add('hidden');
      game.startNewGame(activeCore, 'tutorial');
      updateTouchControlsVisibility();
    });
  }

  // Tutorial Skip Button
  const btnTutorialSkip = document.getElementById('btn-tutorial-skip');
  if (btnTutorialSkip) {
    btnTutorialSkip.addEventListener('click', () => {
      game.completeTutorial(true);
    });
  }

  // Game Over Restart & Menu Buttons
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      gameoverScreen.classList.remove('active');
      gameoverScreen.classList.add('hidden');
      game.startNewGame(activeCore, game.gameMode || 'endless', game.dailyConfig);
      updateTouchControlsVisibility();
    });
  }

  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      briefingScreen?.classList.remove('active');
      briefingScreen?.classList.add('hidden');
      gameoverScreen.classList.remove('active');
      gameoverScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
      titleScreen.classList.add('active');
      game.state = 'TITLE';
      updateTouchControlsVisibility();
      if (window.refreshAllMetaUI) window.refreshAllMetaUI();
    });
  }

  // Pause Controls
  const btnResume = document.getElementById('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      pauseScreen.classList.remove('active');
      pauseScreen.classList.add('hidden');
      game.state = 'PLAYING';
      updateTouchControlsVisibility();
    });
  }

  const btnPauseMenu = document.getElementById('btn-pause-menu');
  if (btnPauseMenu) {
    btnPauseMenu.addEventListener('click', () => {
      pauseScreen.classList.remove('active');
      pauseScreen.classList.add('hidden');
      titleScreen.classList.remove('hidden');
      titleScreen.classList.add('active');
      game.hud.classList.add('hidden');
      game.state = 'TITLE';
      window.chronoAudio.stopMusic();
      updateTouchControlsVisibility();
      if (window.refreshAllMetaUI) window.refreshAllMetaUI();
    });
  }

  const btnHudPause = document.getElementById('btn-hud-pause');
  if (btnHudPause) {
    btnHudPause.addEventListener('click', () => {
      if (game.state === 'PLAYING') {
        game.state = 'PAUSED';
        pauseScreen.classList.remove('hidden');
        pauseScreen.classList.add('active');
        updateTouchControlsVisibility();
      }
    });
  }

  // Reroll Augments
  const btnReroll = document.getElementById('btn-reroll');
  if (btnReroll) {
    btnReroll.addEventListener('click', () => {
      if (window.augmentManager && window.augmentManager.rerollsRemaining > 0) {
        window.augmentManager.rerollsRemaining--;
        game.triggerWaveAugmentScreen(true);
        window.chronoAudio.playComboChord(2);
      }
    });
  }

  // Floating Toolbar Toggles
  const btnSound = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      const isMuted = window.chronoAudio.toggleMute();
      if (soundIcon) soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  const btnCrt = document.getElementById('btn-crt-toggle');
  if (btnCrt) {
    btnCrt.addEventListener('click', () => {
      crtOverlay.classList.toggle('disabled');
    });
  }

  const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // =========================================================================
  // MOBILE TOUCH CONTROLS (VIRTUAL JOYSTICK & TOUCH AIM ZONE)
  // =========================================================================
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;

  function updateTouchControlsVisibility() {
    if (!touchControls) return;
    const mode = prog()?.profile?.settings?.mobileControlsMode || 'auto';
    const shouldShow = (game.state === 'PLAYING') && (mode === 'always' || (mode === 'auto' && isTouchDevice));
    touchControls.classList.toggle('hidden', !shouldShow);
  }
  window.updateTouchControlsVisibility = updateTouchControlsVisibility;

  // Virtual Joystick on the left
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  let joystickTouchId = null;
  let joyOriginX = 0;
  let joyOriginY = 0;
  const JOY_MAX_RADIUS = 40;

  if (joystickZone && joystickKnob) {
    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.chronoAudio.resumeContext();
      if (joystickTouchId !== null) return;
      const touch = e.changedTouches[0];
      joystickTouchId = touch.identifier;
      const rect = joystickZone.getBoundingClientRect();
      joyOriginX = rect.left + rect.width / 2;
      joyOriginY = rect.top + rect.height / 2;
      updateJoystickPosition(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (joystickTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          e.preventDefault();
          updateJoystickPosition(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }, { passive: false });

    function resetJoystick() {
      joystickTouchId = null;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      game.joyMove.x = 0;
      game.joyMove.y = 0;
      game.joyMove.active = false;
    }

    window.addEventListener('touchend', (e) => {
      if (joystickTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          resetJoystick();
          break;
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      if (joystickTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          resetJoystick();
          break;
        }
      }
    });

    function updateJoystickPosition(clientX, clientY) {
      let dx = clientX - joyOriginX;
      let dy = clientY - joyOriginY;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_MAX_RADIUS) {
        dx = (dx / dist) * JOY_MAX_RADIUS;
        dy = (dy / dist) * JOY_MAX_RADIUS;
      }
      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      game.joyMove.x = dx / JOY_MAX_RADIUS;
      game.joyMove.y = dy / JOY_MAX_RADIUS;
      game.joyMove.active = true;
    }
  }

  // Right-side Aim Zone for Time Dilation & Slashing
  const aimZone = document.getElementById('aim-zone');
  let aimTouchId = null;

  if (aimZone) {
    aimZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.chronoAudio.resumeContext();
      if (game.state !== 'PLAYING') return;
      if (aimTouchId !== null) return;
      const touch = e.changedTouches[0];
      aimTouchId = touch.identifier;
      game.mouse.x = touch.clientX;
      game.mouse.y = touch.clientY;
      game.mouse.isDown = true;

      if (game.player && game.player.chronoEnergy > 5) {
        game.player.isSlowMo = true;
        window.particles.setChronoActive(true, game.player.x, game.player.y);
        window.chronoAudio.setTimeDilation(true);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (aimTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === aimTouchId) {
          game.mouse.x = e.changedTouches[i].clientX;
          game.mouse.y = e.changedTouches[i].clientY;
          break;
        }
      }
    }, { passive: false });

    function releaseAimTouch(touch) {
      aimTouchId = null;
      game.mouse.isDown = false;
      if (game.player && game.player.isSlowMo) {
        game.player.isSlowMo = false;
        window.particles.setChronoActive(false);
        window.chronoAudio.setTimeDilation(false);
        game.executeHyperSlash(touch ? touch.clientX : game.mouse.x, touch ? touch.clientY : game.mouse.y);
      }
    }

    window.addEventListener('touchend', (e) => {
      if (aimTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === aimTouchId) {
          releaseAimTouch(e.changedTouches[i]);
          break;
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      if (aimTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === aimTouchId) {
          releaseAimTouch(e.changedTouches[i]);
          break;
        }
      }
    });
  }

  // Touch Action Buttons (PULSE, EMP, OVERDRIVE)
  const btnTouchFire = document.getElementById('btn-touch-fire');
  const btnTouchEmp = document.getElementById('btn-touch-emp');
  const btnTouchOverdrive = document.getElementById('btn-touch-overdrive');
  let touchFireInterval = null;

  if (btnTouchFire) {
    const fireAction = () => {
      if (game.state === 'PLAYING') game.firePlayerProjectile();
    };
    btnTouchFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.chronoAudio.resumeContext();
      fireAction();
      clearInterval(touchFireInterval);
      touchFireInterval = setInterval(fireAction, 160);
    }, { passive: false });

    btnTouchFire.addEventListener('touchend', () => {
      clearInterval(touchFireInterval);
    });
    btnTouchFire.addEventListener('touchcancel', () => {
      clearInterval(touchFireInterval);
    });
    btnTouchFire.addEventListener('click', (e) => {
      e.preventDefault();
      fireAction();
    });
  }

  if (btnTouchEmp) {
    btnTouchEmp.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.chronoAudio.resumeContext();
      if (game.state === 'PLAYING') game.triggerEmp();
    }, { passive: false });
    btnTouchEmp.addEventListener('click', () => {
      if (game.state === 'PLAYING') game.triggerEmp();
    });
  }

  if (btnTouchOverdrive) {
    btnTouchOverdrive.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.chronoAudio.resumeContext();
      if (game.state === 'PLAYING') game.triggerOverdrive();
    }, { passive: false });
    btnTouchOverdrive.addEventListener('click', () => {
      if (game.state === 'PLAYING') game.triggerOverdrive();
    });
  }

  // =========================================================================
  // MOUSE & POINTER CONTROLS (DESKTOP)
  // =========================================================================
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    game.mouse.x = e.clientX;
    game.mouse.y = e.clientY;
  });

  window.addEventListener('mousedown', (e) => {
    window.chronoAudio.resumeContext();
    if (game.state !== 'PLAYING') return;

    if (e.button === 0) {
      // Left Click: Enter Chrono Stasis (Time Dilation Slow-Mo)
      game.mouse.isDown = true;
      if (game.player && game.player.chronoEnergy > 5) {
        game.player.isSlowMo = true;
        window.particles.setChronoActive(true, game.player.x, game.player.y);
        window.chronoAudio.setTimeDilation(true);
      }
    } else if (e.button === 2) {
      // Right Click: Instant EMP Shockwave
      game.triggerEmp();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (game.state !== 'PLAYING') return;

    if (e.button === 0) {
      game.mouse.isDown = false;
      if (game.player && game.player.isSlowMo) {
        game.player.isSlowMo = false;
        window.particles.setChronoActive(false);
        window.chronoAudio.setTimeDilation(false);
        game.executeHyperSlash(e.clientX, e.clientY);
      }
    }
  });

  // =========================================================================
  // KEYBOARD CONTROLS & REBINDABLE ACTIONS
  // =========================================================================
  window.addEventListener('keydown', (e) => {
    window.chronoAudio.resumeContext();
    game.keys[e.code] = true;

    const binds = prog()?.profile?.settings?.keyBindings || {
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      emp: 'Space', overdrive: 'KeyF', fire: 'KeyE'
    };

    // Enter to start from title or briefing
    if (e.code === 'Enter') {
      if (game.state === 'TITLE') btnStart?.click();
      else if (game.state === 'BRIEFING') btnDeploy?.click();
    }

    // Primary fire action
    if ((e.code === binds.fire || e.code === 'KeyE') && game.state === 'PLAYING') {
      game.firePlayerProjectile();
    }

    // EMP repulse action
    if ((e.code === binds.emp || e.code === 'Space') && game.state === 'PLAYING') {
      game.triggerEmp();
    } else if (e.code === 'Space' && game.state === 'GAMEOVER') {
      btnRestart?.click();
    }

    // Overdrive ultimate action
    if ((e.code === binds.overdrive || e.code === 'KeyF' || e.code === 'KeyQ') && game.state === 'PLAYING') {
      game.triggerOverdrive();
    }

    // Escape for Pause
    if (e.code === 'Escape') {
      if (game.state === 'PLAYING') {
        game.state = 'PAUSED';
        pauseScreen.classList.remove('hidden');
        pauseScreen.classList.add('active');
        updateTouchControlsVisibility();
      } else if (game.state === 'PAUSED') {
        btnResume?.click();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    game.keys[e.code] = false;
  });

  // =========================================================================
  // GAMEPAD LOOP
  // =========================================================================
  function pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (gp && game.state === 'PLAYING' && game.player) {
      // Left stick: Drift thrusters
      const lx = gp.axes[0];
      const ly = gp.axes[1];
      if (Math.abs(lx) > 0.15) game.player.vx += lx * 1400 * 0.016;
      if (Math.abs(ly) > 0.15) game.player.vy += ly * 1400 * 0.016;

      // Right stick: Aim
      const rx = gp.axes[2];
      const ry = gp.axes[3];
      if (Math.hypot(rx, ry) > 0.25) {
        game.mouse.x = game.player.x + rx * 250;
        game.mouse.y = game.player.y + ry * 250;
      }

      // Triggers / Buttons
      // RT (button 7) or RB (button 5): Hyper-Slash Dash
      if (gp.buttons[7]?.pressed || gp.buttons[5]?.pressed) {
        if (!game.player.isSlowMo && game.player.chronoEnergy > 5) {
          game.player.isSlowMo = true;
          window.particles.setChronoActive(true, game.player.x, game.player.y);
          window.chronoAudio.setTimeDilation(true);
        }
      } else if (game.player.isSlowMo) {
        game.player.isSlowMo = false;
        window.particles.setChronoActive(false);
        window.chronoAudio.setTimeDilation(false);
        game.executeHyperSlash(game.mouse.x, game.mouse.y);
      }

      // Primary Pulse: X button (button 2)
      if (gp.buttons[2]?.pressed) {
        game.firePlayerProjectile();
      }

      // LT (button 6) or A button (button 0): EMP Repulse
      if (gp.buttons[0]?.pressed || gp.buttons[6]?.pressed) {
        game.triggerEmp();
      }

      // Y button or Triangle (button 3): Chrono Overdrive Ultimate
      if (gp.buttons[3]?.pressed) {
        game.triggerOverdrive();
      }
    }
    requestAnimationFrame(pollGamepads);
  }
  pollGamepads();

  // Start Animation Loop
  requestAnimationFrame((time) => game.loop(time));
});
