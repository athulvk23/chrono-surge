/* =========================================================================
   CHRONO SURGE: BEGINNING -CORE ENGINE, TUTORIAL, DAILY & GAME LOOP
   ========================================================================= */

// Seeded PRNG (Mulberry32) for deterministic Daily Challenge wave generation
function createSeededRandom(seedInt) {
  let a = seedInt >>> 0;
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: '01 // KINETIC DRIFT THRUSTERS',
    instruction: 'Use [W, A, S, D], [Arrow Keys], or the Mobile Left Joystick to maneuver your Chrono Vessel across the arena.',
    highlightId: null,
    targetProgress: 100
  },
  {
    id: 2,
    title: '02 // PRIMARY PULSE CANNON',
    instruction: 'Press [E] or tap the [PULSE] button to fire rapid plasma bolts at the target drone.',
    highlightId: 'btn-touch-fire',
    targetProgress: 2
  },
  {
    id: 3,
    title: '03 // EVADE HOSTILE FIRE',
    instruction: 'Hostile drone firing! Drift out of the projectile trajectory or prepare to deflect it.',
    highlightId: null,
    targetProgress: 100
  },
  {
    id: 4,
    title: '04 // CHRONO-STASIS TIME DILATION',
    instruction: 'Hold [Left Mouse Button] or touch & drag on the arena to dilate time to 12% speed and preview your vector trajectory.',
    highlightId: 'chrono-meter-group',
    targetProgress: 100
  },
  {
    id: 5,
    title: '05 // HYPER-SLASH VECTOR DASH',
    instruction: 'While holding Time Dilation, aim through the target anomaly and [RELEASE] to cleave it at lightspeed!',
    highlightId: null,
    targetProgress: 1
  },
  {
    id: 6,
    title: '06 // EMP REPULSE SHOCKWAVE',
    instruction: 'Press [Right Click], [Spacebar], or tap [EMP] to vaporize nearby projectiles and knock back anomalies.',
    highlightId: 'emp-meter-group',
    targetProgress: 1
  },
  {
    id: 7,
    title: '07 // CHRONO OVERDRIVE ULTIMATE',
    instruction: 'Your Overdrive Core is charged to 100%! Press [F], [Q], or tap [OVERDRIVE] and slice the target to trigger Judgement Cut.',
    highlightId: 'overdrive-meter-group',
    targetProgress: 1
  },
  {
    id: 8,
    title: '08 // QUANTUM XP & AUGMENTS',
    instruction: 'Collect the dropped golden Quantum Orbs and select your first Anomaly Augment upgrade.',
    highlightId: 'hud-right-tray',
    targetProgress: 1
  },
  {
    id: 9,
    title: '09 // SHIELD & HULL TELEMETRY',
    instruction: 'Notice your Shield and Hull meters below. Shield absorbs hits first and regenerates after a brief cooldown. Stay mobile for 2 seconds.',
    highlightId: 'shield-meter-group',
    targetProgress: 100
  },
  {
    id: 10,
    title: '10 // LIVE COMBAT CERTIFICATION',
    instruction: 'Final Trial: Eliminate the incoming 3-drone combat squad using your full Chrono arsenal!',
    highlightId: null,
    targetProgress: 3
  }
];

class ChronoGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.isMobile = !!isTouchDevice;
    this.dpr = this.isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2);

    // Game states: TITLE, BRIEFING, PLAYING, UPGRADE_SELECT, GAMEOVER, PAUSED
    this.state = 'TITLE';
    this.gameMode = 'endless'; // 'endless' | 'tutorial' | 'daily'
    this.dailyConfig = null;
    this.rng = Math.random;

    // Player & entity collections
    this.player = null;
    this.playerProjectiles = [];
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.delayedEchos = [];

    // Progression & scoring
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('chrono_high_score') || '0', 10);
    this.totalSlices = parseInt(localStorage.getItem('chrono_total_slices') || '0', 10);
    this.maxStyleAchieved = localStorage.getItem('chrono_max_style') || 'D';
    this.wave = 1;
    this.waveTimer = 0;
    this.waveTotalEnemies = 1;
    this.isBossWave = false;
    this.bossRef = null;
    this.performanceMode = this.isMobile;
    this.maxActiveBullets = this.isMobile ? 40 : 70;

    // Experience & Leveling
    this.xp = 0;
    this.xpNeeded = 12;
    this.level = 1;

    // Combo & Style system
    this.combo = 0;
    this.comboTimer = 0;
    this.stylePoints = 0;
    this.styleRank = 'D';
    this.styleMultiplier = 1.0;

    // Time dilation engine
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;

    // Input state (Desktop + Mobile Dual-Touch)
    this.mouse = { x: this.width / 2, y: this.height / 2, isDown: false, rmbDown: false };
    this.keys = {};
    this.joyMove = { x: 0, y: 0, active: false };

    // Tutorial state
    this.tutorialStepIdx = 0;
    this.tutorialProgress = 0;
    this.tutorialCompletedInSession = false;

    this.gridOffset = 0;

    // UI element references cached
    this.hud = document.getElementById('hud');
    this.hudScore = document.getElementById('hud-score');
    this.hudWave = document.getElementById('hud-wave');
    this.hudMultiplier = document.getElementById('hud-multiplier');
    this.hudKills = document.getElementById('hud-kills');
    this.hudTime = document.getElementById('hud-time');
    this.waveProgressFill = document.getElementById('wave-progress-fill');
    this.styleRankLetter = document.getElementById('style-rank-letter');
    this.styleRankTitle = document.getElementById('style-rank-title');
    this.styleMeterFill = document.getElementById('style-meter-fill');
    this.comboCallout = document.getElementById('combo-callout');
    this.comboCountEl = document.getElementById('combo-count');
    this.hpFill = document.getElementById('hp-fill');
    this.hpValue = document.getElementById('hp-value');
    this.shieldFill = document.getElementById('shield-fill');
    this.shieldValue = document.getElementById('shield-value');
    this.chronoFill = document.getElementById('chrono-fill');
    this.chronoValue = document.getElementById('chrono-value');
    this.empFill = document.getElementById('emp-fill');
    this.empValue = document.getElementById('emp-value');
    this.overdriveFill = document.getElementById('overdrive-fill');
    this.overdriveValue = document.getElementById('overdrive-value');
    this.overdriveOverlay = document.getElementById('overdrive-overlay');
    this.bossHud = document.getElementById('boss-hud');
    this.bossBarFill = document.getElementById('boss-bar-fill');
    this.bossName = document.getElementById('boss-name');
    this.augmentsList = document.getElementById('augments-list');
    this.buildPowerValue = document.getElementById('build-power-value');
    this.buildPowerPips = document.getElementById('build-power-pips');
    this.upgradeBuildPower = document.getElementById('upgrade-build-power');
    this.upgradeActiveCount = document.getElementById('upgrade-active-count');

    // Tutorial Banner UI
    this.tutorialBanner = document.getElementById('tutorial-banner');
    this.tutorialStepTitle = document.getElementById('tutorial-step-title');
    this.tutorialStepText = document.getElementById('tutorial-step-text');
    this.tutorialStepBar = document.getElementById('tutorial-step-fill');

    // Run stats
    this.runSlices = 0;
    this.runDeflects = 0;
    this.runMaxCombo = 0;
    this.runKills = 0;
    this.survivalTime = 0;
    this.bestWave = parseInt(localStorage.getItem('chrono_best_wave') || '0', 10);
    this.waveState = 'ACTIVE';
    this.intermissionTimer = 0;
    this.waveMutation = 'NONE';
    this.hazards = [];
    this.arenaAttacks = [];
    this.arenaDistortion = 0;

    this.selectedCore = 'vanguard';
    this.lastTime = performance.now();
    window.chronoGame = this;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = this.isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  returnToTitle() {
    this.state = 'TITLE';
    this.isBossWave = false;
    this.bossRef = null;
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.playerProjectiles = [];
    this.delayedEchos = [];
    this.hazards = [];
    this.arenaAttacks = [];
    this.player = null;

    if (window.particles) window.particles.reset();
    if (window.chronoAudio) window.chronoAudio.stopMusic();

    if (this.hud) this.hud.classList.add('hidden');
    if (this.bossHud) this.bossHud.classList.add('hidden');
    if (this.tutorialBanner) this.tutorialBanner.classList.add('hidden');
    this.clearTutorialHighlights();

    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.renderCyberGrid(this.ctx);
    }
  }

  startNewGame(coreType = 'vanguard', mode = 'endless', dailyConfig = null) {
    this.selectedCore = coreType;
    this.gameMode = mode;
    this.dailyConfig = dailyConfig;

    if (mode === 'daily' && dailyConfig && dailyConfig.seed) {
      this.rng = createSeededRandom(dailyConfig.seed);
    } else {
      this.rng = Math.random;
    }

    this.player = new PlayerVessel(this.width / 2, this.height / 2, coreType);
    this.playerProjectiles = [];
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.delayedEchos = [];

    this.score = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.isBossWave = false;
    this.bossRef = null;

    this.xp = 0;
    this.xpNeeded = 10;
    this.level = 1;

    this.combo = 0;
    this.comboTimer = 0;
    this.stylePoints = 0;
    this.styleRank = 'D';
    this.styleMultiplier = 1.0;

    this.runSlices = 0;
    this.runDeflects = 0;
    this.runMaxCombo = 0;
    this.runKills = 0;
    this.survivalTime = 0;
    this.waveState = 'ACTIVE';
    this.intermissionTimer = 0;
    this.waveMutation = 'NONE';
    this.hazards = [];
    this.arenaAttacks = [];
    this.arenaDistortion = 0;

    window.augmentManager.reset();
    window.particles.reset();

    // Apply Daily Challenge Modifier if in Daily Mode
    if (mode === 'daily' && dailyConfig && dailyConfig.modifier) {
      const modId = dailyConfig.modifier.id;
      if (modId === 'glass_reactor') {
        this.player.maxShield = Math.round(this.player.maxShield * 0.7);
        this.player.shield = this.player.maxShield;
        this.player.sliceDamage *= 1.45;
      } else if (modId === 'ricochet_protocol') {
        window.augmentManager.applyAugment('photon_ricochet', this.player);
        window.augmentManager.applyAugment('chrono_matrix', this.player);
      } else if (modId === 'tesla_storm') {
        window.augmentManager.applyAugment('tesla_arc', this.player);
        window.augmentManager.applyAugment('tesla_arc', this.player);
        this.player.empRechargeRate *= 1.4;
      } else if (modId === 'singularity_convergence') {
        window.augmentManager.applyAugment('singularity_pulse', this.player);
      }
      window.particles.addFloatingText(this.width / 2, 130, `DAILY MODIFIER: ${dailyConfig.modifier.name}`, '#ffe600', 20, true);
    }

    this.updateAugmentHUD();

    this.state = 'PLAYING';
    this.hud.classList.remove('hidden');

    window.chronoAudio.resumeContext();
    window.chronoAudio.startMusic();
    window.chronoAudio.updateStyleRank('D');

    if (mode === 'tutorial') {
      this.startTutorialSequence();
    } else {
      if (this.tutorialBanner) this.tutorialBanner.classList.add('hidden');
      this.clearTutorialHighlights();
      this.spawnWaveGroup();
    }
  }

  // --- INTERACTIVE 10-STEP TUTORIAL SYSTEM ---
  startTutorialSequence() {
    this.tutorialStepIdx = 0;
    this.tutorialProgress = 0;
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    if (this.tutorialBanner) this.tutorialBanner.classList.remove('hidden');
    this.setupTutorialStep(0);
  }

  clearTutorialHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  }

  setupTutorialStep(idx) {
    this.tutorialStepIdx = idx;
    this.tutorialProgress = 0;
    this.clearTutorialHighlights();

    if (idx >= TUTORIAL_STEPS.length) {
      this.completeTutorial();
      return;
    }

    const step = TUTORIAL_STEPS[idx];
    if (this.tutorialStepTitle) this.tutorialStepTitle.textContent = step.title;
    if (this.tutorialStepText) this.tutorialStepText.textContent = step.instruction;
    if (this.tutorialStepBar) this.tutorialStepBar.style.width = '0%';

    if (step.highlightId) {
      const el = document.getElementById(step.highlightId);
      if (el) el.classList.add('tutorial-highlight');
    }

    window.chronoAudio.playComboChord(idx + 1);

    // Step-specific live arena setup
    const cx = this.width / 2;
    const cy = this.height / 2;

    if (idx === 1) {
      // Step 2: Spawn target drone for Primary Pulse
      const dummy = new Enemy(cx + 180, cy - 80, 'hunter', 1);
      dummy.isDummy = true;
      dummy.hp = 60;
      dummy.maxHp = 60;
      this.enemies = [dummy];
    } else if (idx === 2) {
      // Step 3: Spawn shooting drone to evade
      const dummy = new Enemy(cx - 200, cy - 60, 'orbiter', 1);
      dummy.isDummy = true;
      dummy.dummyShoots = true;
      dummy.hp = 120;
      this.enemies = [dummy];
    } else if (idx === 4) {
      // Step 5: Hyper-Slash target
      this.enemies = [];
      const dummy = new Enemy(cx + 160, cy, 'hunter', 1);
      dummy.isDummy = true;
      dummy.hp = 90;
      this.enemies = [dummy];
    } else if (idx === 5) {
      // Step 6: EMP Repulse ready
      this.player.empCharge = 100;
      const dummy = new Enemy(this.player.x + 90, this.player.y, 'hunter', 1);
      dummy.isDummy = true;
      dummy.dummyShoots = true;
      this.enemies = [dummy];
    } else if (idx === 6) {
      // Step 7: Overdrive Ultimate charged
      this.player.overdriveCharge = 100;
      const d1 = new Enemy(cx - 120, cy - 50, 'hunter', 1);
      const d2 = new Enemy(cx + 120, cy + 50, 'hunter', 1);
      d1.isDummy = true;
      d2.isDummy = true;
      this.enemies = [d1, d2];
    } else if (idx === 7) {
      // Step 8: Spawn XP orbs to trigger Upgrade Screen
      this.orbs = [];
      for (let i = 0; i < 6; i++) {
        this.orbs.push(new EnergyOrb(this.player.x + (Math.random() - 0.5) * 140, this.player.y + (Math.random() - 0.5) * 140, 2));
      }
    } else if (idx === 9) {
      // Step 10: Live 3-drone combat encounter
      this.enemies = [
        new Enemy(cx - 240, cy - 120, 'hunter', 1),
        new Enemy(cx + 240, cy - 120, 'hunter', 1),
        new Enemy(cx, cy + 180, 'orbiter', 1)
      ];
    }
  }

  advanceTutorialProgress(amount = 1) {
    if (this.gameMode !== 'tutorial' || this.tutorialStepIdx >= TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[this.tutorialStepIdx];
    this.tutorialProgress = Math.min(step.targetProgress, this.tutorialProgress + amount);
    const pct = Math.min(100, (this.tutorialProgress / step.targetProgress) * 100);
    if (this.tutorialStepBar) this.tutorialStepBar.style.width = `${pct}%`;

    if (this.tutorialProgress >= step.targetProgress) {
      window.particles.addFloatingText(this.player.x, this.player.y - 30, 'STEP COMPLETE!', '#00ff88', 18, true);
      this.setupTutorialStep(this.tutorialStepIdx + 1);
    }
  }

  completeTutorial() {
    this.clearTutorialHighlights();
    if (this.tutorialBanner) this.tutorialBanner.classList.add('hidden');
    if (window.progression) {
      window.progression.profile.tutorialCompleted = true;
      window.progression.evaluateUnlocks();
      window.progression.saveLocalProfile();
      window.progression.syncToCloud();
    }
    window.particles.addFloatingText(this.width / 2, this.height / 2, '🎓 TRAINING COMPLETE! LAUNCHING ARENA...', '#00ff88', 26, true);
    this.gameMode = 'endless';
    this.wave = 1;
    this.spawnWaveGroup();
  }

  // --- PRIMARY PULSE CANNON FIRE ---
  firePrimaryWeapon() {
    if (!this.player || this.player.fireCooldown > 0 || this.state !== 'PLAYING') return;
    this.player.fireCooldown = this.player.fireRate;

    // Auto-aim assist toward closest enemy if Aim Assist is enabled or on mobile
    let targetAngle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
    if (window.progression?.profile?.settings?.aimAssist && this.enemies.length > 0 && !this.player.isSlowMo) {
      let closest = null;
      let minD = 520;
      for (const e of this.enemies) {
        if (e.isDead) continue;
        const d = dist(this.player.x, this.player.y, e.x, e.y);
        if (d < minD) {
          minD = d;
          closest = e;
        }
      }
      if (closest) {
        targetAngle = Math.atan2(closest.y - this.player.y, closest.x - this.player.x);
      }
    }

    const skin = window.progression ? window.progression.getEquippedSkinDef() : { primary: '#00f0ff' };
    const isCrit = Math.random() < (this.player.critChance || 0.06);
    const proj = new PlayerProjectile(
      this.player.x + Math.cos(targetAngle) * 18,
      this.player.y + Math.sin(targetAngle) * 18,
      targetAngle,
      this.player.primaryDamage,
      skin.primary,
      isCrit
    );
    this.playerProjectiles.push(proj);
    window.chronoAudio.playPrimaryPulse();

    if (this.gameMode === 'tutorial' && this.tutorialStepIdx === 1) {
      this.advanceTutorialProgress(1);
    }
  }

  firePlayerProjectile() {
    return this.firePrimaryWeapon();
  }

  // --- PROGRESSIVE DIFFICULTY & WAVE DIRECTOR ---
  getWaveProfile() {
    if (window.DifficultyDirector) {
      return window.DifficultyDirector.getWaveConfig(this.wave, this.gameMode, this.dailyConfig, this.isMobile);
    }
    const w = this.wave;
    return {
      wave: w,
      totalEnemies: Math.min(36, 4 + Math.floor(w * 0.8)),
      concurrentCap: Math.min(this.isMobile ? 16 : 22, 5 + Math.floor(w * 0.5)),
      initialSpawnCount: Math.min(4, 2 + Math.floor(w * 0.4)),
      spawnInterval: Math.max(0.9, 2.0 - w * 0.05),
      speedMult: 1.0,
      attackMult: 1.0,
      hpMult: 1.0,
      eliteChance: w < 4 ? 0 : 0.1,
      hazardLevel: w < 15 ? 0 : 1,
      isBoss: w >= 10 && w % 10 === 0,
      bossTier: Math.max(1, Math.floor(w / 10)),
      isAnomaly: w >= 15 && w % 5 === 0 && (w % 10 !== 0)
    };
  }

  spawnAtEdge() {
    let x, y;
    const r1 = this.rng();
    const r2 = this.rng();
    const r3 = this.rng();
    if (r1 < 0.5) {
      x = r2 < 0.5 ? -35 : this.width + 35;
      y = r3 * this.height;
    } else {
      x = r2 * this.width;
      y = r3 < 0.5 ? -35 : this.height + 35;
    }
    return { x, y };
  }

  spawnSingleEnemy(config = this.waveConfig) {
    if (this.pendingSpawns <= 0) return;
    const pos = this.spawnAtEdge();
    let type = 'hunter';
    if (window.DifficultyDirector) {
      type = window.DifficultyDirector.pickEnemyType(this.wave, this.rng);
    } else {
      if (this.wave >= 4 && this.rng() > 0.75) type = 'orbiter';
      if (this.wave >= 6 && this.rng() > 0.85) type = 'dasher';
      if (this.wave >= 9 && this.rng() > 0.90) type = 'phantom';
    }

    const enemy = new Enemy(pos.x, pos.y, type, this.wave);
    enemy.speed *= (config?.speedMult || 1.0);
    enemy.attackSpeedMult = (config?.attackMult || 1.0);
    enemy.hp *= (config?.hpMult || 1.0);
    enemy.maxHp = enemy.hp;

    if (this.rng() < (config?.eliteChance || 0) && !enemy.isBoss) {
      enemy.isElite = true;
      enemy.hp *= 1.65;
      enemy.maxHp = enemy.hp;
      enemy.speed *= 1.15;
      enemy.scoreVal = Math.round(enemy.scoreVal * 2.2);
    }

    this.enemies.push(enemy);
    this.pendingSpawns--;
  }

  updateEnemySpawning(dt) {
    if (this.waveState !== 'ACTIVE' || this.isBossWave || this.pendingSpawns <= 0) return;
    this.spawnTimer = (this.spawnTimer || 0) + dt;
    const interval = this.waveConfig?.spawnInterval || 1.6;
    const cap = this.waveConfig?.concurrentCap || (this.isMobile ? 16 : 22);

    if (this.spawnTimer >= interval && this.enemies.length < cap) {
      this.spawnTimer = 0;
      this.spawnSingleEnemy(this.waveConfig);
    }
  }

  spawnWaveGroup() {
    const config = this.getWaveProfile();
    this.waveConfig = config;
    this.waveState = 'ACTIVE';
    this.isBossWave = config.isBoss;
    this.waveMutation = 'NONE';
    this.hazards = [];
    this.arenaAttacks = [];
    this.arenaDistortion = Math.min(1, Math.max(0, (this.wave - 10) / 35));

    if (config.isBoss) {
      this.bossHud.classList.remove('hidden');
      const bossTier = config.bossTier || Math.max(1, Math.floor(this.wave / 10));
      this.bossName.textContent = `APEX OVERLORD // TIER ${bossTier}`;
      if (this.bossBarFill) this.bossBarFill.style.width = '100%';
      const boss = new Enemy(this.width / 2, -70, 'boss', this.wave);
      boss.hp *= 1 + (bossTier - 1) * 0.22;
      boss.maxHp = boss.hp;
      boss.speed *= 1 + (bossTier - 1) * 0.035;
      this.enemies.push(boss);
      this.bossRef = boss;
      this.waveTotalEnemies = 1;
      this.pendingSpawns = 0;
      window.particles.addFloatingText(this.width / 2, this.height / 2, `⚠ APEX OVERLORD // WAVE ${this.wave} ⚠`, '#ff0055', 28, true);
      window.particles.addTrauma(0.7);
    } else {
      this.bossHud.classList.add('hidden');
      this.bossRef = null;
      this.pendingSpawns = config.totalEnemies;
      this.waveTotalEnemies = config.totalEnemies;
      this.spawnTimer = 0;

      // Spawn initial cluster (e.g. 2 in wave 1, 3 in wave 2)
      const initialCount = Math.min(config.initialSpawnCount || 3, this.pendingSpawns);
      for (let i = 0; i < initialCount; i++) {
        this.spawnSingleEnemy(config);
      }

      // Early welcoming guidance for new players
      if (this.wave === 1 && !window.progression?.profile?.tutorialCompleted) {
        window.particles.addFloatingText(this.width / 2, 130, 'WASD TO MANEUVER // LEFT CLICK TO SLICE', '#00f0ff', 18, true);
      } else if (this.wave === 2 && !window.progression?.profile?.tutorialCompleted) {
        window.particles.addFloatingText(this.width / 2, 130, 'SPACE TO HYPER-SLASH // EARLY AUGMENT INBOUND', '#ffe600', 18, true);
      }
    }

    if (!config.isBoss && config.isAnomaly) {
      const mutations = ['LASER GRID', 'ENERGY MINES', 'VOID FIELDS', 'ROTATING BEAMS', 'BLACK HOLE'];
      this.waveMutation = mutations[Math.floor(this.wave / 5 - 1) % mutations.length];
      this.createHazards(config.hazardLevel);
      window.particles.addFloatingText(this.width / 2, 110, `ARENA MUTATION // ${this.waveMutation}`, '#a64cff', 18, true);
    } else if (!config.isBoss && config.hazardLevel > 0 && this.wave % 3 === 0) {
      this.waveMutation = 'HAZARD SURGE';
      this.createHazards(config.hazardLevel);
    }
    if (config.isBoss) {
      this.createBossArenaPattern(Math.max(1, Math.floor(this.wave / 8)));
    }
  }

  createHazards(level = 1) {
    const count = Math.min(9, 1 + level + Math.floor(this.wave / 12));
    const pattern = ['mine', 'field', 'beam', 'laserGrid', 'slicingWave', 'turret'][Math.floor(this.wave / 5) % 6];
    for (let i = 0; i < count; i++) {
      let kind = pattern;
      if (this.wave < 8) kind = i % 2 ? 'mine' : 'field';
      if (this.wave >= 12 && i % 4 === 0) kind = 'turret';
      const edge = this.spawnAtEdge();
      const h = {
        type: kind,
        x: kind === 'laserGrid' ? this.width * 0.5 : (kind === 'beam' ? this.width * 0.5 : edge.x),
        y: kind === 'laserGrid' ? this.height * 0.5 : (kind === 'beam' ? this.height * 0.5 : edge.y),
        radius: kind === 'field' ? 90 + level * 10 : kind === 'mine' ? 18 + level * 2 : 34 + level * 2,
        angle: this.rng() * Math.PI * 2,
        speed: (0.5 + this.rng() * 0.8) * (1 + level * 0.10),
        pulse: this.rng() * Math.PI * 2,
        cooldown: 0,
        active: 0,
        warning: 0,
        phase: this.rng() * Math.PI * 2,
        length: Math.max(this.width, this.height) * 1.35,
        arm: 0
      };
      if (kind === 'turret') {
        h.x = Math.max(90, Math.min(this.width - 90, edge.x));
        h.y = Math.max(90, Math.min(this.height - 160, edge.y));
        h.cooldown = 0.8 + this.rng() * 1.2;
      }
      if (kind === 'laserGrid') {
        h.warning = 1.25;
        h.active = 0;
        h.cooldown = 0;
        h.arm = 0;
      }
      this.hazards.push(h);
    }
  }

  createBossArenaPattern(tier = 1) {
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    const mk = (type, extra = {}) => this.arenaAttacks.push({
      type, x: centerX, y: centerY, angle: this.rng() * Math.PI * 2,
      timer: 1.2 + this.rng() * 1.2, cooldown: 0, phase: this.rng() * 6.28,
      speed: 0.8 + tier * 0.08, radius: 120 + tier * 20, warning: 0, active: 0, ...extra
    });
    mk('ring', { radius: 100, maxRadius: 520 + tier * 35 });
    mk('spiral', { radius: 0, maxRadius: 500 + tier * 30, bullets: 12 + tier * 2 });
    if (tier >= 2) mk('crossLaser', { width: 18, maxRadius: 900 });
    if (tier >= 3) mk('blackHole', { radius: 80, maxRadius: 280 + tier * 20 });
  }

  beginWaveIntermission() {
    if (this.waveState !== 'ACTIVE') return;
    if (this.gameMode === 'tutorial') {
      if (this.tutorialStepIdx === 9) {
        this.advanceTutorialProgress(3);
      }
      return;
    }

    this.waveState = 'INTERMISSION';
    this.state = 'UPGRADE_SELECT';
    this.intermissionTimer = 0;

    this.hazards = [];
    this.arenaAttacks = [];
    this.arenaDistortion = Math.max(0, this.arenaDistortion * 0.45);

    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.12);
    this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxShield * 0.45);
    this.player.chronoEnergy = this.player.maxChronoEnergy;
    this.player.empCharge = Math.min(this.player.maxEmp, this.player.empCharge + 30);
    this.combo = 0;
    this.comboTimer = 0;
    this.score += 250 + this.wave * 50;
    this.bestWave = Math.max(this.bestWave, this.wave);
    localStorage.setItem('chrono_best_wave', this.bestWave);

    // Autosave checkpoint
    if (window.progression) {
      window.progression.profile.highestWave = Math.max(window.progression.profile.highestWave || 0, this.wave);
      window.progression.profile.bestScore = Math.max(window.progression.profile.bestScore || 0, this.score);
      window.progression.saveLocalProfile();
    }

    this.triggerWaveAugmentScreen();
  }

  startNextWaveAfterAugment() {
    if (this.gameMode === 'tutorial') {
      if (this.tutorialStepIdx === 7) {
        this.advanceTutorialProgress(1);
      }
      return;
    }
    this.wave++;
    this.waveTimer = 0;
    this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxShield * 0.20);
    this.player.chronoEnergy = this.player.maxChronoEnergy;
    this.player.empCharge = Math.min(this.player.maxEmp, this.player.empCharge + 20);
    this.spawnWaveGroup();
  }

  // --- HYPER-SLASH KINETIC SLICE EXECUTION ---
  executeHyperSlash(targetX, targetY) {
    if (!this.player || this.player.isDashing) return;

    // Phase 2: Check & Consume Hyper-Slash Chrono Energy
    if (!this.player.consumeEnergy(this.player.hyperSlashCost)) {
      window.particles?.addFloatingText(this.player.x, this.player.y, `INSUFFICIENT ENERGY (${this.player.hyperSlashCost} REQ)`, '#ff0055', 16, true);
      return;
    }

    const segments = this.player.calculateTrajectory(targetX, targetY, this.width, this.height);
    if (!segments || segments.length === 0) return;

    this.player.isDashing = true;
    this.player.dashSegments = segments;
    this.player.dashSegmentIdx = 0;
    this.player.dashT = 0;

    // Trigger precise active parry timing window during kinetic dash
    this.player.triggerParry();

    window.chronoAudio.playDashSlice();
    window.particles.addTrauma(0.2);

    let slicedCountThisDash = 0;
    const sliceWidth = this.player.sliceWidth;
    const isCrit = Math.random() < (this.player.critChance || 0.06);
    const baseSlice = this.player.sliceDamage * (isCrit ? 1.6 : 1);
    const sliceDamage = baseSlice * (this.player.isSlowMo && this.player.augments.chronoEdge ? 1 + 0.18 * this.player.augments.chronoEdge : 1);
    const skin = window.progression ? window.progression.getEquippedSkinDef() : null;
    const coreColor = skin ? skin.primary : (this.player.coreType === 'reaper' ? '#ff0055' : (this.player.coreType === 'valkyrie' ? '#ffe600' : '#00f0ff'));

    segments.forEach(seg => {
      window.particles.addLaserCut(seg.x1, seg.y1, seg.x2, seg.y2, coreColor, 8);
      const segMidX = (seg.x1 + seg.x2) * 0.5;
      const segMidY = (seg.y1 + seg.y2) * 0.5;
      window.particles.addSlashArc(segMidX, segMidY, Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1), Math.max(80, dist(seg.x1, seg.y1, seg.x2, seg.y2) * 0.32), coreColor, 16);

      const segAngle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);

      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        const d = distToSegment(enemy.x, enemy.y, seg.x1, seg.y1, seg.x2, seg.y2);

        if (d <= enemy.radius + sliceWidth) {
          slicedCountThisDash++;
          this.runSlices++;
          this.totalSlices++;
          localStorage.setItem('chrono_total_slices', this.totalSlices);

          if (this.gameMode === 'tutorial' && this.tutorialStepIdx === 4) {
            this.advanceTutorialProgress(1);
          }

          if (this.player.isOverdrive) {
            enemy.isMarkedByOverdrive = true;
            enemy.overdriveDamageAccum += sliceDamage * 2.2;
            enemy.overdriveSliceAngle = segAngle;
            window.particles.addCrossSlash(enemy.x, enemy.y, enemy.radius * 2, '#ffe600');
            window.particles.triggerHitStop(0.035);
            window.chronoAudio.playComboChord(this.combo + 1);
            window.particles.addFloatingText(enemy.x, enemy.y, 'TAGGED!', '#ffe600', 16, true);
            if (this.gameMode === 'tutorial' && this.tutorialStepIdx === 6) {
              this.advanceTutorialProgress(1);
            }
          } else {
            const isKill = enemy.takeDamage(sliceDamage, segAngle);
            window.particles.addFloatingText(enemy.x, enemy.y, `${isCrit ? 'CRIT ' : ''}-${Math.round(sliceDamage)}`, isCrit ? '#ffe600' : '#ffffff', isCrit ? 17 : 14, isCrit);

            this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + 8 * (this.player.overdriveGainMult || 1));

            if (isKill) {
              this.handleEnemyKill(enemy, segAngle);

              if (this.player.augments.teslaArc) {
                this.triggerTeslaArc(enemy.x, enemy.y, this.player.augments.teslaArc * 40);
              }
            }
          }
        }
      }

      // Skill-Based Bullet Parry / Deflection (Requires active parry timing window)
      if (this.player.parryState === 'ACTIVE') {
        for (const bullet of this.bullets) {
          if (bullet.isDeflected || bullet.canBeReflected === false) continue;
          const d = distToSegment(bullet.x, bullet.y, seg.x1, seg.y1, seg.x2, seg.y2);
          if (d <= bullet.radius + sliceWidth) {
            if (this.player.chronoEnergy >= this.player.parryCost) {
              if (bullet.deflect(segAngle)) {
                // Net cost: parryCost (15) - skillBonus (5) = 10
                this.player.consumeEnergy(this.player.parryCost - this.player.parrySkillBonus);
                this.runDeflects++;
                this.addStylePoints(60);
                this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + 12 * (this.player.overdriveGainMult || 1));
                window.particles.triggerHitStop(0.035);
                window.particles.addFloatingText(bullet.x, bullet.y, 'PARRY! +5 BONUS', '#00f0ff', 15, true);

                if (this.player.augments.shatterNova) {
                  window.particles.addShockwave(bullet.x, bullet.y, 140, '#ffe600', 20);
                }
              }
            } else {
              window.particles.addFloatingText(this.player.x, this.player.y, 'PARRY FAILED // LOW ENERGY', '#ff0055', 14, false);
            }
          }
        }
      }

      // Singularity Core Augment
      if (this.player.augments.singularity) {
        const midX = (seg.x1 + seg.x2) / 2;
        const midY = (seg.y1 + seg.y2) / 2;
        window.particles.addShockwave(midX, midY, 90, '#9d00ff', 15);
        for (const e of this.enemies) {
          if (dist(e.x, e.y, midX, midY) < 180) {
            const pullA = Math.atan2(midY - e.y, midX - e.x);
            e.x += Math.cos(pullA) * 60;
            e.y += Math.sin(pullA) * 60;
          }
        }
      }
    });

    if (this.player.augments.quantumEcho && slicedCountThisDash > 0) {
      this.delayedEchos.push({
        segments: JSON.parse(JSON.stringify(segments)),
        timer: 0.5,
        damage: sliceDamage * 0.7
      });
    }

    if (slicedCountThisDash >= 2) {
      this.player.chronoEnergy = Math.min(this.player.maxChronoEnergy, this.player.chronoEnergy + 15);
    }
  }

  triggerTeslaArc(originX, originY, damage) {
    const nearby = this.enemies
      .filter(e => !e.isDead && dist(originX, originY, e.x, e.y) < 250)
      .slice(0, 3);

    nearby.forEach(e => {
      window.particles.addLaserCut(originX, originY, e.x, e.y, '#ffe600', 3);
      e.takeDamage(damage);
      window.particles.emitSparks(e.x, e.y, 6, '#ffe600', 1);
    });
  }

  handleEnemyKill(enemy, sliceAngle) {
    if (this.player.augments.chronoEdge && this.player.isSlowMo) {
      this.player.chronoEnergy = Math.min(this.player.maxChronoEnergy, this.player.chronoEnergy + 3 * this.player.augments.chronoEdge);
    }
    this.combo++;
    this.runKills++;
    this.comboTimer = 2.5;
    if (this.combo > this.runMaxCombo) this.runMaxCombo = this.combo;

    window.chronoAudio.playComboChord(this.combo);

    const dailyBonus = (this.gameMode === 'daily' && this.dailyConfig?.modifier?.id === 'overclocked_swarms') ? 1.35 : 1.0;
    const pointsGained = Math.round(enemy.scoreVal * this.styleMultiplier * dailyBonus);
    this.score += pointsGained;
    this.addStylePoints(80 + this.combo * 15);

    const orbCount = enemy.isBoss ? 16 : (enemy.type === 'dasher' ? 4 : enemy.type === 'phantom' ? 3 : 2);
    const xpVal = (this.wave <= 2) ? 3 : 1;
    for (let i = 0; i < orbCount; i++) {
      this.orbs.push(new EnergyOrb(enemy.x + (Math.random() - 0.5) * 30, enemy.y + (Math.random() - 0.5) * 30, xpVal, 'xp'));
    }

    // Tactical Item Drops from Official Sci-Fi Reference Sheet
    if (enemy.isBoss) {
      this.orbs.push(new EnergyOrb(enemy.x - 30, enemy.y, 1, 'health'));
      this.orbs.push(new EnergyOrb(enemy.x + 30, enemy.y, 1, 'shield'));
      this.orbs.push(new EnergyOrb(enemy.x, enemy.y - 30, 1, 'overdrive'));
      this.orbs.push(new EnergyOrb(enemy.x, enemy.y + 30, 1, 'shard'));
    } else {
      const dropRoll = Math.random();
      if (dropRoll < 0.05) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'health'));
      else if (dropRoll < 0.10) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'shield'));
      else if (dropRoll < 0.14) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'chrono'));
      else if (dropRoll < 0.17) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'overdrive'));
      else if (dropRoll < 0.20) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'multiplier'));
      else if (dropRoll < 0.23) this.orbs.push(new EnergyOrb(enemy.x, enemy.y, 1, 'shard'));
    }

    if (this.combo >= 2) {
      window.particles.addFloatingText(enemy.x, enemy.y, `x${this.combo} CHAIN!`, '#ffe600', 16, true);
    }
  }

  triggerParry() {
    if (!this.player) return false;
    const p = this.player;
    const ok = p.triggerParry();
    if (!ok) {
      if (p.parryState === 'RECOVERY') {
        window.particles?.addFloatingText(p.x, p.y, 'PARRY RECOVERY', '#798ba8', 14, false);
      }
      return false;
    }

    // Immediately resolve bullets inside parry radius upon activation
    for (const b of this.bullets) {
      if (b.isDeflected || b.canBeReflected === false) continue;
      if (dist(p.x, p.y, b.x, b.y) <= p.parryRadius + b.radius) {
        if (p.chronoEnergy >= p.parryCost) {
          const reflectAngle = Math.atan2(b.y - p.y, b.x - p.x) + Math.PI;
          if (b.deflect(reflectAngle)) {
            // Apply energy accounting: cost 15, return 5 skill bonus (net 10)
            p.consumeEnergy(p.parryCost - p.parrySkillBonus);
            this.runDeflects++;
            this.addStylePoints(75);
            p.overdriveCharge = Math.min(100, p.overdriveCharge + 14 * (p.overdriveGainMult || 1));
            window.particles?.triggerHitStop(0.04);
            window.particles?.addFloatingText(b.x, b.y, 'PARRY! +5 BONUS', '#00f0ff', 16, true);
          }
        } else {
          window.particles?.addFloatingText(p.x, p.y, 'PARRY FAILED // LOW ENERGY', '#ff0055', 14, false);
        }
      }
    }
    return true;
  }

  triggerEmp() {
    if (!this.player) return;
    const p = this.player;

    // Phase 2: Check & Consume EMP Chrono Energy (35 units)
    if (!p.consumeEnergy(p.empCost)) {
      window.particles?.addFloatingText(p.x, p.y, `INSUFFICIENT ENERGY (${p.empCost} REQ)`, '#ff0055', 16, true);
      return;
    }

    window.chronoAudio.playEmpBlast();
    window.particles.addTrauma(0.4);
    window.particles.addShockwave(p.x, p.y, p.empRadius, '#ff00ff', 25);
    window.particles.addEmpField(p.x, p.y, p.empRadius);
    window.particles.emitSparks(p.x, p.y, 34, '#ff00ff', 2.2);
    window.particles.addFloatingText(p.x, p.y, 'EMP BLAST!', '#ff00ff', 20, true);

    if (this.gameMode === 'tutorial' && this.tutorialStepIdx === 5) {
      this.advanceTutorialProgress(1);
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (dist(p.x, p.y, b.x, b.y) <= p.empRadius) {
        window.particles.emitSparks(b.x, b.y, 6, '#ff00ff', 1);
        this.bullets.splice(i, 1);
      }
    }

    for (const e of this.enemies) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d <= p.empRadius) {
        const angle = Math.atan2(e.y - p.y, e.x - p.x);
        if (e.isBoss) {
          // Boss Stun Resistance & Anti-Lockout (Phase 4 & 6)
          if (e.empImmunityTimer > 0) {
            window.particles.addFloatingText(e.x, e.y, 'EMP RESISTED', '#ff0055', 15, true);
          } else {
            e.empImmunityTimer = 6.0; // 6s immunity prevents boss stun locks
            e.stunTimer = 0.25;      // Brief interrupt
            window.particles.addFloatingText(e.x, e.y, 'STAGGERED!', '#ffe600', 16, true);
            e.vx += Math.cos(angle) * 120;
            e.vy += Math.sin(angle) * 120;
          }
        } else if (e.isElite) {
          // Elite: 50% stun reduction
          e.stunTimer = 0.9;
          e.vx += Math.cos(angle) * 220;
          e.vy += Math.sin(angle) * 220;
          if (e.takeDamage(100, angle)) {
            this.handleEnemyKill(e, angle);
          }
        } else {
          // Standard enemies: 1.8s stun
          e.stunTimer = 1.8;
          e.vx += Math.cos(angle) * 350;
          e.vy += Math.sin(angle) * 350;
          if (e.takeDamage(100, angle)) {
            this.handleEnemyKill(e, angle);
          }
        }
      }
    }
  }

  triggerOverdrive() {
    if (!this.player || this.player.isOverdrive) return;
    if (this.player.overdriveCharge < 100) return;

    this.player.isOverdrive = true;
    this.player.overdriveTimer = this.player.overdriveDuration;
    this.player.overdriveCharge = 0;

    this.overdriveOverlay.classList.add('active');
    window.particles.isOverdriveVisuals = true;

    window.chronoAudio.playOverdriveActivate();
    window.particles.addShockwave(this.player.x, this.player.y, 350, '#ffe600', 30);
    window.particles.addEmpField(this.player.x, this.player.y, 350);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      window.particles.addOverdriveSlash(this.player.x, this.player.y, a, 160 + (i % 4) * 42);
    }
    window.particles.emitSparks(this.player.x, this.player.y, 70, '#ff174f', 2.8);
    window.particles.addFloatingText(this.player.x, this.player.y, '⚡ CHRONO OVERDRIVE ⚡', '#ffe600', 30, true);
    window.particles.addTrauma(0.5);
  }

  endOverdriveAndDetonate() {
    this.player.isOverdrive = false;
    this.overdriveOverlay.classList.remove('active');
    window.particles.isOverdriveVisuals = false;

    let detonatedCount = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isMarkedByOverdrive && !enemy.isDead) {
        detonatedCount++;
        enemy.isMarkedByOverdrive = false;
        const isKill = enemy.takeDamage(enemy.overdriveDamageAccum, enemy.overdriveSliceAngle);
        window.particles.addShockwave(enemy.x, enemy.y, 160, '#ffe600', 25);
        window.particles.addOverdriveSlash(enemy.x, enemy.y, enemy.overdriveSliceAngle || 0, enemy.radius * 3.2);
        window.particles.emitDirectionalSparks(enemy.x, enemy.y, enemy.overdriveSliceAngle || 0, Math.PI * 1.2, 34, '#ff174f');
        window.particles.addFloatingText(enemy.x, enemy.y, 'JUDGEMENT CUT!', '#ffe600', 20, true);

        if (isKill) {
          this.handleEnemyKill(enemy, enemy.overdriveSliceAngle);
          this.score += Math.round(enemy.scoreVal * 2.5);
        }
      }
    }

    if (detonatedCount > 0) {
      window.chronoAudio.playOverdriveDetonation(detonatedCount);
      window.particles.triggerHitStop(0.1);
      window.particles.addTrauma(0.7);
      window.particles.addFloatingText(this.player.x, this.player.y - 30, `${detonatedCount}x ANNIHILATION!`, '#ff0055', 26, true);
    }
  }

  addStylePoints(pts) {
    this.stylePoints = Math.min(4000, this.stylePoints + pts);
  }

  updateStyleRank(dt) {
    if (this.stylePoints > 0) {
      this.stylePoints = Math.max(0, this.stylePoints - 45 * dt);
    }

    let newRank = 'D';
    let title = 'DULL';
    let mult = 1.0;
    let rankRatio = 0;

    if (this.stylePoints >= 3200) {
      newRank = 'SSS'; title = 'SUPERNOVA'; mult = 5.0; rankRatio = (this.stylePoints - 3200) / 800;
    } else if (this.stylePoints >= 2400) {
      newRank = 'SS'; title = 'SICK SKILLS'; mult = 4.0; rankRatio = (this.stylePoints - 2400) / 800;
    } else if (this.stylePoints >= 1700) {
      newRank = 'S'; title = 'SAVAGE'; mult = 3.0; rankRatio = (this.stylePoints - 1700) / 700;
    } else if (this.stylePoints >= 1100) {
      newRank = 'A'; title = 'ANARCHY'; mult = 2.4; rankRatio = (this.stylePoints - 1100) / 600;
    } else if (this.stylePoints >= 600) {
      newRank = 'B'; title = 'BRUTAL'; mult = 1.8; rankRatio = (this.stylePoints - 600) / 500;
    } else if (this.stylePoints >= 250) {
      newRank = 'C'; title = 'COOL'; mult = 1.4; rankRatio = (this.stylePoints - 250) / 350;
    } else {
      newRank = 'D'; title = 'DULL'; mult = 1.0; rankRatio = this.stylePoints / 250;
    }

    if (newRank !== this.styleRank) {
      this.styleRank = newRank;
      this.styleRankLetter.className = `style-letter rank-${newRank.toLowerCase()} bump`;
      setTimeout(() => this.styleRankLetter.classList.remove('bump'), 180);
      window.chronoAudio.updateStyleRank(newRank);

      const ranksOrder = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
      if (ranksOrder.indexOf(newRank) > ranksOrder.indexOf(this.maxStyleAchieved)) {
        this.maxStyleAchieved = newRank;
        localStorage.setItem('chrono_max_style', newRank);
      }
    }

    this.styleRankLetter.textContent = this.styleRank;
    this.styleRankTitle.textContent = title;
    this.styleMeterFill.style.width = `${Math.min(100, Math.max(0, rankRatio * 100))}%`;
    this.styleMultiplier = mult;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboCallout.classList.remove('active');
      } else {
        this.comboCallout.classList.add('active');
        this.comboCountEl.textContent = this.combo;
      }
    }
  }

  addXp(amount) {
    this.xp += amount;
    if (this.gameMode === 'tutorial' && this.tutorialStepIdx === 7 && this.xp >= 6) {
      this.xp = 0;
      this.triggerWaveAugmentScreen();
      return;
    }
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.xpNeeded = Math.round(this.xpNeeded * 1.35 + 4);
      this.level++;
      this.score += 100 * this.level;
    }
  }

  triggerWaveAugmentScreen() {
    this.state = 'UPGRADE_SELECT';
    window.chronoAudio.playLevelUp();
    const upgradeScreen = document.getElementById('screen-upgrade');
    const cardsContainer = document.getElementById('cards-container');
    const rerollCount = document.getElementById('reroll-count');
    rerollCount.textContent = window.augmentManager.rerollsRemaining;
    cardsContainer.innerHTML = '';
    this.updateBuildPowerReadout();

    const cards = window.augmentManager.getRandomCards(3);
    if (cards.length === 0) {
      this.startNextWaveAfterAugment();
      upgradeScreen.classList.remove('active');
      upgradeScreen.classList.add('hidden');
      this.state = 'PLAYING';
      return;
    }
    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = `upgrade-card rarity-${card.rarity}`;
      const currentTier = window.augmentManager.activeAugments.get(card.id) || 0;
      cardEl.innerHTML = `
        <div class="card-rarity-pill">${card.rarity}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
        <div class="card-current">${currentTier >= card.maxTier ? `MASTERED // TIER ${currentTier}` : (currentTier > 0 ? `OWNED // TIER ${currentTier}` : 'NEW ANOMALY')}</div>
        <div class="card-tier">NEXT TIER ${(currentTier + 1)} / ${card.maxTier}</div>
      `;
      cardEl.onclick = () => {
        window.augmentManager.applyAugment(card.id, this.player);
        this.updateAugmentHUD();
        upgradeScreen.classList.remove('active');
        upgradeScreen.classList.add('hidden');
        this.startNextWaveAfterAugment();
        this.state = 'PLAYING';
      };
      cardsContainer.appendChild(cardEl);
    });
    upgradeScreen.classList.remove('hidden');
    upgradeScreen.classList.add('active');
  }

  getBuildPower() {
    const weights = { common: 1, rare: 2, epic: 3, legendary: 5 };
    let power = 0;
    window.augmentManager.activeAugments.forEach((tier, augId) => {
      const def = AUGMENT_DEFINITIONS.find(a => a.id === augId);
      if (def) power += (weights[def.rarity] || 1) * tier;
    });
    return power;
  }

  updateBuildPowerReadout() {
    const power = this.getBuildPower();
    const activeCount = window.augmentManager.activeAugments.size;
    if (this.buildPowerValue) this.buildPowerValue.textContent = power.toString().padStart(2, '0');
    if (this.buildPowerPips) {
      this.buildPowerPips.innerHTML = '';
      const pipCount = 8;
      const filled = Math.min(pipCount, Math.ceil(power / 2));
      for (let i = 0; i < pipCount; i++) {
        const pip = document.createElement('span');
        pip.className = `build-power-pip${i < filled ? ' active' : ''}`;
        this.buildPowerPips.appendChild(pip);
      }
    }
    if (this.upgradeBuildPower) this.upgradeBuildPower.textContent = `POWER ${power.toString().padStart(2, '0')}`;
    if (this.upgradeActiveCount) this.upgradeActiveCount.textContent = `${activeCount} ACTIVE`;
  }

  updateAugmentHUD() {
    this.augmentsList.innerHTML = '';
    window.augmentManager.activeAugments.forEach((tier, augId) => {
      const def = AUGMENT_DEFINITIONS.find(a => a.id === augId);
      if (!def) return;
      const item = document.createElement('div');
      item.className = 'hud-aug-item';
      const pips = '●'.repeat(Math.min(tier, 5)) + '○'.repeat(Math.max(0, Math.min(def.maxTier, 3) - tier));
      item.innerHTML = `<span class="hud-aug-icon">${def.icon}</span><span>${def.name}</span><span class="hud-aug-tier">${pips}</span>`;
      this.augmentsList.appendChild(item);
    });
    this.updateBuildPowerReadout();
  }

  async triggerGameOver() {
    this.state = 'GAMEOVER';
    window.chronoAudio.stopMusic();

    let isNewRecord = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('chrono_high_score', this.highScore);
      isNewRecord = true;
    }

    document.getElementById('go-score').textContent = this.score.toLocaleString();
    document.getElementById('go-wave').textContent = `WAVE ${this.wave.toString().padStart(2, '0')}`;
    document.getElementById('go-style').textContent = this.styleRank;
    document.getElementById('go-slices').textContent = this.runSlices;
    document.getElementById('go-deflects').textContent = this.runDeflects;
    document.getElementById('go-combo').textContent = `${this.runMaxCombo}x`;
    const bestWaveEl = document.getElementById('go-best-wave');
    if (bestWaveEl) bestWaveEl.textContent = `WAVE ${Math.max(this.bestWave, this.wave).toString().padStart(2, '0')}`;
    const killsEl = document.getElementById('go-kills');
    if (killsEl) killsEl.textContent = this.runKills.toLocaleString();
    const timeEl = document.getElementById('go-time');
    if (timeEl) {
      const m = Math.floor(this.survivalTime / 60);
      const sec = Math.floor(this.survivalTime % 60);
      timeEl.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
    }

    const newRecEl = document.getElementById('go-new-record');
    if (isNewRecord) newRecEl.classList.remove('hidden');
    else newRecEl.classList.add('hidden');

    this.hud.classList.add('hidden');
    const goScreen = document.getElementById('screen-gameover');
    goScreen.classList.remove('hidden');
    goScreen.classList.add('active');

    // Persist run rewards & submit to leaderboard
    if (window.progression) {
      const res = await window.progression.recordCompletedRun({
        mode: this.gameMode === 'daily' ? 'daily' : 'endless',
        dailySeed: this.dailyConfig?.dateStr || null,
        score: this.score,
        wave: this.wave,
        survivalTime: this.survivalTime,
        kills: this.runKills,
        slices: this.runSlices,
        deflects: this.runDeflects,
        maxCombo: this.runMaxCombo,
        styleRank: this.styleRank,
        coreType: this.selectedCore
      });
      const rewardBanner = document.getElementById('go-rewards-summary');
      if (rewardBanner && res) {
        rewardBanner.textContent = `+${res.shardsEarned} CHRONO SHARDS // +${res.xpEarned} ACCOUNT XP EARNED`;
      }
      if (typeof window.refreshAllMetaUI === 'function') {
        window.refreshAllMetaUI();
      }
    }
  }

  // --- MAIN LOOP UPDATE ---
  update(rawDt) {
    if (window.particles.hitStopTimer > 0) {
      window.particles.hitStopTimer -= rawDt;
      return;
    }

    if (this.state === 'PLAYING') this.survivalTime += rawDt;

    if (this.state === 'UPGRADE_SELECT') {
      window.particles.update(1);
      return;
    }

    if (this.state === 'PLAYING') {
      if (this.player && this.player.isSlowMo && this.player.chronoEnergy > 0) {
        this.targetTimeScale = 0.12;
      } else {
        this.targetTimeScale = 1.0;
      }
    } else {
      this.targetTimeScale = 0.0;
    }

    this.timeScale += (this.targetTimeScale - this.timeScale) * 0.18;
    const dt = rawDt * this.timeScale;

    this.gridOffset = (this.gridOffset + rawDt * 18) % 40;

    if (this.state !== 'PLAYING') return;

    // 1. Update Player
    const moved = this.player.update(dt, this.keys, this.width, this.height, this.joyMove.x, this.joyMove.y);

    // Tutorial progression checks for continuous actions
    if (this.gameMode === 'tutorial') {
      if (this.tutorialStepIdx === 0 && moved) {
        this.advanceTutorialProgress(rawDt * 65);
      } else if (this.tutorialStepIdx === 2) {
        this.advanceTutorialProgress(rawDt * 45);
      } else if (this.tutorialStepIdx === 3 && this.player.isSlowMo) {
        this.advanceTutorialProgress(rawDt * 110);
      } else if (this.tutorialStepIdx === 8) {
        this.advanceTutorialProgress(rawDt * 55);
      }
    }

    // Continuous primary pulse fire if key held
    const fireBind = window.progression?.profile?.settings?.keyBindings?.fire || 'KeyE';
    if (this.keys[fireBind] || this.keys['KeyE']) {
      this.firePrimaryWeapon();
    }

    if (this.player.isOverdrive) {
      this.player.overdriveTimer -= dt;
      if (this.player.overdriveTimer <= 0) {
        this.endOverdriveAndDetonate();
      }
    }

    // 1b. Update Player Primary Projectiles
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.update(rawDt, this.width, this.height);
      for (const e of this.enemies) {
        if (!e.isDead && dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
          const killed = e.takeDamage(p.damage, p.angle);
          window.particles.addFloatingText(e.x, e.y, `-${Math.round(p.damage)}`, p.color, 13, p.isCrit);
          p.life = 0;
          if (killed) {
            this.handleEnemyKill(e, p.angle);
          }
          break;
        }
      }
      if (p.life <= 0) {
        this.playerProjectiles.splice(i, 1);
      }
    }

    // 2. Update Quantum Echos
    for (let i = this.delayedEchos.length - 1; i >= 0; i--) {
      const echo = this.delayedEchos[i];
      echo.timer -= dt;
      if (echo.timer <= 0) {
        echo.segments.forEach(seg => {
          window.particles.addLaserCut(seg.x1, seg.y1, seg.x2, seg.y2, '#ffe600', 4);
          for (const e of this.enemies) {
            if (!e.isDead && distToSegment(e.x, e.y, seg.x1, seg.y1, seg.x2, seg.y2) < e.radius + 20) {
              if (e.takeDamage(echo.damage)) {
                this.handleEnemyKill(e, 0);
              }
            }
          }
        });
        this.delayedEchos.splice(i, 1);
      }
    }

    // 3. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.player.x, this.player.y, this.width, this.height, this.bullets);

      if (!this.player.isDashing && !e.isDead) {
        if (dist(e.x, e.y, this.player.x, this.player.y) < e.radius + this.player.radius) {
          if (this.gameMode === 'tutorial') {
            this.player.shield = Math.max(10, this.player.shield - 10);
          } else {
            const isDead = this.player.takeDamage(25);
            e.takeDamage(30);
            if (isDead) {
              this.triggerGameOver();
              return;
            }
          }
        }
      }

      if (e.isDead) {
        this.enemies.splice(i, 1);
      }
    }

    // 4. Update Bullets
    this.maxActiveBullets = this.isBossWave ? Math.min(52, 38 + Math.floor(this.wave / 20) * 2) : Math.min(70, 42 + Math.floor(this.wave / 8) * 3);
    if (this.bullets.length > this.maxActiveBullets) {
      this.bullets.splice(0, this.bullets.length - this.maxActiveBullets);
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this.width, this.height, this.enemies);

      if (b.isDeflected) {
        for (const e of this.enemies) {
          if (!e.isDead && dist(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
            if (e.takeDamage(b.damage)) {
              this.handleEnemyKill(e, 0);
            }
            b.life = 0;
            break;
          }
        }
      } else {
        // Phase 3: Skill-Based Active Parry Detection
        if (this.player.parryState === 'ACTIVE' && b.canBeReflected !== false && !b.isDeflected) {
          const dToPlayer = dist(b.x, b.y, this.player.x, this.player.y);
          if (dToPlayer <= this.player.parryRadius + b.radius) {
            if (this.player.chronoEnergy >= this.player.parryCost) {
              const reflectAngle = Math.atan2(b.y - this.player.y, b.x - this.player.x) + Math.PI;
              if (b.deflect(reflectAngle)) {
                // Phase 2 Accounting: 15 cost, 5 skill bonus (net 10)
                this.player.consumeEnergy(this.player.parryCost - this.player.parrySkillBonus);
                this.runDeflects++;
                this.addStylePoints(75);
                this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + 14 * (this.player.overdriveGainMult || 1));
                window.particles?.triggerHitStop(0.04);
                window.particles?.addFloatingText(b.x, b.y, 'PARRY! +5 BONUS', '#00f0ff', 16, true);
                continue;
              }
            } else {
              window.particles?.addFloatingText(this.player.x, this.player.y, 'PARRY FAILED // LOW ENERGY', '#ff0055', 14, false);
            }
          }
        }

        if (!this.player.isDashing && dist(b.x, b.y, this.player.x, this.player.y) < b.radius + this.player.radius) {
          b.life = 0;
          if (this.gameMode === 'tutorial') {
            this.player.shield = Math.max(15, this.player.shield - 10);
          } else {
            const isDead = this.player.takeDamage(b.damage);
            if (isDead) {
              this.triggerGameOver();
              return;
            }
          }
        }
      }

      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }

    // 5. Update XP Orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.update(dt, this.player.x, this.player.y);
      if (dist(orb.x, orb.y, this.player.x, this.player.y) < this.player.radius + orb.radius) {
        if (orb.type === 'health') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
          window.particles.addFloatingText(this.player.x, this.player.y - 20, '+25 HP', '#00f0ff', 16, true);
        } else if (orb.type === 'shield') {
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 35);
          window.particles.addFloatingText(this.player.x, this.player.y - 20, '+35 SHIELD', '#087dff', 16, true);
        } else if (orb.type === 'chrono') {
          this.player.chronoEnergy = Math.min(this.player.maxChronoEnergy, this.player.chronoEnergy + 50);
          window.particles.addFloatingText(this.player.x, this.player.y - 20, 'CHRONO SURGE!', '#00f0ff', 16, true);
        } else if (orb.type === 'overdrive') {
          this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + 25);
          window.particles.addFloatingText(this.player.x, this.player.y - 20, 'OVERDRIVE +25%', '#ff0055', 16, true);
        } else if (orb.type === 'multiplier') {
          this.addStylePoints(250);
          window.particles.addFloatingText(this.player.x, this.player.y - 20, 'STYLE BOOST!', '#ffe600', 16, true);
        } else if (orb.type === 'shard') {
          if (window.progression) {
            window.progression.profile.shards = (window.progression.profile.shards || 0) + 15;
            window.progression.saveLocalProfile();
          }
          window.particles.addFloatingText(this.player.x, this.player.y - 20, '+15 SHARDS', '#00f0ff', 16, true);
        } else {
          this.addXp(orb.value);
        }
        this.score += 25;
        this.orbs.splice(i, 1);
      } else if (orb.life <= 0) {
        this.orbs.splice(i, 1);
      }
    }

    // 6. Arena hazards
    this.updateHazards(dt);
    this.updateArenaAttacks(dt);

    // 7. Progressive wave spawning & progression
    this.updateEnemySpawning(dt);
    this.waveTimer += dt;
    if (this.enemies.length === 0 && (!this.pendingSpawns || this.pendingSpawns <= 0) && this.waveState === 'ACTIVE') {
      if (this.gameMode !== 'tutorial' || this.tutorialStepIdx === 9) {
        this.beginWaveIntermission();
      }
    }

    this.performanceMode = this.isMobile || this.isBossWave || this.enemies.length > 24 || this.bullets.length > 28 || !!(window.progression?.profile?.settings?.performanceMode);
    window.particles.maxParticles = this.isMobile ? (this.performanceMode ? 140 : 200) : (this.performanceMode ? 360 : 650);
    window.particles.update(this.timeScale);

    this.updateStyleRank(dt);
    this.syncHUD();
  }

  updateHazards(dt) {
    if (!this.player) return;
    for (const h of this.hazards) {
      h.pulse += dt * 2.5;
      h.cooldown = Math.max(0, h.cooldown - dt);
      if (h.type === 'beam' || h.type === 'crossLaser') h.angle += h.speed * dt;
      if (h.type === 'laserGrid') {
        if (h.warning > 0) h.warning -= dt;
        else h.active += dt;
        h.arm += dt;
        if (h.arm > Math.max(1.8, 3.5 - this.wave * 0.015)) { h.arm = 0; h.warning = 0.9; h.active = 0; }
      }
      if (h.type === 'turret') {
        h.cooldown -= dt;
        if (h.cooldown <= 0) {
          h.cooldown = Math.max(0.55, 1.7 - this.wave * 0.018);
          const a = Math.atan2(this.player.y - h.y, this.player.x - h.x);
          for (let k = -1; k <= 1; k++) {
            const aa = a + k * 0.16;
            this.bullets.push(new EnemyBullet(h.x, h.y, aa, 260 + this.wave * 4, '#ff174f', 9 + this.wave * 0.12));
          }
          window.particles.emitSparks(h.x, h.y, 10, '#ff174f', 1.4);
        }
      }

      let danger = false;
      if (h.type === 'field') {
        danger = dist(this.player.x, this.player.y, h.x, h.y) < h.radius;
      } else if (h.type === 'mine') {
        const d = dist(this.player.x, this.player.y, h.x, h.y);
        if (d < h.radius + this.player.radius) { danger = true; h.pulse += 7; }
      } else if (h.type === 'beam') {
        const ex = h.x + Math.cos(h.angle) * h.length;
        const ey = h.y + Math.sin(h.angle) * h.length;
        danger = distToSegment(this.player.x, this.player.y, h.x, h.y, ex, ey) < 14 + this.player.radius * 0.25;
      } else if (h.type === 'slicingWave') {
        h.radius += (210 + this.wave * 2.5) * dt;
        if (h.radius > h.length) h.radius = 24;
        danger = Math.abs(dist(this.player.x, this.player.y, h.x, h.y) - h.radius) < 20 + this.player.radius;
      } else if (h.type === 'laserGrid') {
        if (h.warning <= 0 && (h.active % 1.0) < 0.72) {
          const cell = Math.min(6, 3 + Math.floor(this.wave / 10));
          const spacingX = this.width / cell, spacingY = this.height / cell;
          const col = Math.floor(this.player.x / spacingX), row = Math.floor(this.player.y / spacingY);
          danger = ((col + row + Math.floor(h.active * 1.3)) % 2 === 0);
        }
      }

      if (danger && h.cooldown <= 0 && !this.player.isDashing && !this.player.isOverdrive) {
        const dead = this.player.takeDamage(8 + this.wave * 0.45);
        h.cooldown = 0.52;
        window.particles.emitSparks(this.player.x, this.player.y, 10, h.type === 'field' ? '#a64cff' : '#ff174f', 1.2);
        if (dead) { this.triggerGameOver(); return; }
      }
    }
  }

  updateArenaAttacks(dt) {
    if (!this.player || !this.arenaAttacks.length) return;
    for (const a of this.arenaAttacks) {
      a.timer -= dt;
      a.phase += dt * a.speed;
      if (a.type === 'ring') {
        a.radius += (240 + this.wave * 5) * dt;
        if (a.radius > a.maxRadius) { a.radius = 90; a.timer = Math.max(1.2, 3.2 - this.wave * 0.02); }
        if (Math.abs(dist(this.player.x, this.player.y, a.x, a.y) - a.radius) < 22 && a.timer < 0) {
          if (!this.player.isDashing && !this.player.isOverdrive) this.player.takeDamage(12 + this.wave * 0.35);
        }
      } else if (a.type === 'spiral' && a.timer <= 0) {
        a.timer = Math.max(0.65, 1.8 - this.wave * 0.012);
        for (let i = 0; i < a.bullets; i++) {
          const ang = a.phase + (i * Math.PI * 2) / a.bullets;
          const speed = 190 + this.wave * 3.5;
          this.bullets.push(new EnemyBullet(a.x, a.y, ang, speed, '#a64cff', 7 + this.wave * 0.08));
        }
      } else if (a.type === 'crossLaser') {
        a.angle += dt * 0.35;
        if (Math.abs(Math.sin(a.phase)) > 0.93 && !this.player.isDashing && !this.player.isOverdrive) {
          const d1 = distToSegment(this.player.x, this.player.y, a.x - Math.cos(a.angle) * a.maxRadius, a.y - Math.sin(a.angle) * a.maxRadius, a.x + Math.cos(a.angle) * a.maxRadius, a.y + Math.sin(a.angle) * a.maxRadius);
          const d2 = distToSegment(this.player.x, this.player.y, a.x - Math.cos(a.angle + Math.PI / 2) * a.maxRadius, a.y - Math.sin(a.angle + Math.PI / 2) * a.maxRadius, a.x + Math.cos(a.angle + Math.PI / 2) * a.maxRadius, a.y + Math.sin(a.angle + Math.PI / 2) * a.maxRadius);
          if (Math.min(d1, d2) < a.width) this.player.takeDamage(16 + this.wave * 0.4);
        }
      } else if (a.type === 'blackHole') {
        const d = dist(this.player.x, this.player.y, a.x, a.y);
        if (d < a.maxRadius && !this.player.isDashing) {
          const pull = (1 - d / a.maxRadius) * (35 + this.wave * 1.2);
          const ang = Math.atan2(a.y - this.player.y, a.x - this.player.x);
          this.player.x += Math.cos(ang) * pull * dt;
          this.player.y += Math.sin(ang) * pull * dt;
          if (d < a.radius && a.timer < 0 && !this.player.isOverdrive) {
            a.timer = 0.8;
            this.player.takeDamage(20 + this.wave * 0.5);
            window.particles.addShockwave(this.player.x, this.player.y, 90, '#8d36ff', 14);
          }
        }
      }
    }
  }

  renderHazards(ctx) {
    const now = performance.now() * 0.001;
    for (const h of this.hazards) {
      const pulse = 0.55 + Math.sin(h.pulse) * 0.2;
      ctx.save();
      if (h.type === 'field') {
        ctx.fillStyle = `rgba(166,76,255,${0.045 + pulse * 0.025})`;
        ctx.strokeStyle = `rgba(166,76,255,${0.35 + pulse * 0.2})`;
        ctx.shadowColor = '#a64cff'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * 0.62, 0, Math.PI * 2); ctx.stroke();
      } else if (h.type === 'mine') {
        ctx.translate(h.x, h.y); ctx.rotate(h.pulse * 0.4);
        ctx.strokeStyle = `rgba(255,230,0,${0.45 + pulse * 0.3})`; ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const r = i % 2 ? 12 : h.radius;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(0, 0, 4 + Math.sin(now * 6) * 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (h.type === 'beam') {
        ctx.strokeStyle = `rgba(255,23,79,${0.2 + pulse * 0.25})`; ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 20; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(h.angle) * h.length, h.y + Math.sin(h.angle) * h.length); ctx.stroke();
        ctx.lineWidth = 8; ctx.globalAlpha = 0.12; ctx.stroke();
      } else if (h.type === 'laserGrid') {
        const cells = Math.min(6, 3 + Math.floor(this.wave / 10));
        const sx = this.width / cells, sy = this.height / cells;
        ctx.strokeStyle = h.warning > 0 ? 'rgba(255,230,0,.22)' : 'rgba(255,23,79,.52)';
        ctx.shadowColor = h.warning > 0 ? '#ffe600' : '#ff174f'; ctx.shadowBlur = 18; ctx.lineWidth = 2;
        for (let x = 0; x <= cells; x++) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, this.height); ctx.stroke(); }
        for (let y = 0; y <= cells; y++) { ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(this.width, y * sy); ctx.stroke(); }
      } else if (h.type === 'slicingWave') {
        ctx.strokeStyle = 'rgba(255,23,79,.68)'; ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 24; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.stroke();
      } else if (h.type === 'turret') {
        ctx.translate(h.x, h.y); ctx.rotate(h.pulse * 0.35); ctx.strokeStyle = 'rgba(255,23,79,.8)'; ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const r = i % 2 ? 15 : 27;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
    for (const a of this.arenaAttacks) {
      ctx.save();
      if (a.type === 'ring') {
        ctx.strokeStyle = 'rgba(255,230,0,.65)'; ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 24; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2); ctx.stroke();
      } else if (a.type === 'crossLaser') {
        ctx.strokeStyle = 'rgba(255,23,79,.72)'; ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 28; ctx.lineWidth = a.width;
        for (let k = 0; k < 2; k++) {
          const ang = a.angle + (k * Math.PI) / 2;
          ctx.beginPath(); ctx.moveTo(a.x - Math.cos(ang) * a.maxRadius, a.y - Math.sin(ang) * a.maxRadius); ctx.lineTo(a.x + Math.cos(ang) * a.maxRadius, a.y + Math.sin(ang) * a.maxRadius); ctx.stroke();
        }
      } else if (a.type === 'blackHole') {
        const pulse = a.radius + Math.sin(a.phase * 3) * 8;
        ctx.fillStyle = 'rgba(10,0,24,.75)'; ctx.strokeStyle = 'rgba(166,76,255,.8)'; ctx.shadowColor = '#8d36ff'; ctx.shadowBlur = 35;
        ctx.beginPath(); ctx.arc(a.x, a.y, pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  syncHUD() {
    this.hudScore.textContent = this.score.toLocaleString();
    this.hudWave.textContent = this.gameMode === 'tutorial' ? 'TRAINING' : `WAVE ${this.wave.toString().padStart(2, '0')}`;
    this.hudMultiplier.textContent = `${this.styleMultiplier.toFixed(1)}x`;
    if (this.hudKills) this.hudKills.textContent = this.runKills.toLocaleString();
    if (this.hudTime) {
      const m = Math.floor(this.survivalTime / 60);
      const s = Math.floor(this.survivalTime % 60);
      this.hudTime.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    if (this.waveProgressFill) {
      const clearedPct = this.waveTotalEnemies > 0
        ? Math.max(0, Math.min(100, ((this.waveTotalEnemies - this.enemies.length) / this.waveTotalEnemies) * 100))
        : 100;
      this.waveProgressFill.style.width = `${clearedPct}%`;
    }

    const shieldPct = Math.max(0, (this.player.shield / this.player.maxShield) * 100);
    if (this.shieldFill) this.shieldFill.style.width = `${shieldPct}%`;
    if (this.shieldValue) this.shieldValue.textContent = `${Math.round(shieldPct)}%`;

    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpValue.textContent = `${Math.round(hpPct)}%`;

    const chronoPct = Math.max(0, (this.player.chronoEnergy / this.player.maxChronoEnergy) * 100);
    this.chronoFill.style.width = `${chronoPct}%`;
    this.chronoValue.textContent = this.player.parryState === 'ACTIVE' ? 'PARRY!' : (this.player.isSlowMo ? 'STASIS' : `${Math.round(chronoPct)}%`);

    const empReady = this.player.chronoEnergy >= this.player.empCost;
    const empPct = Math.min(100, (this.player.chronoEnergy / this.player.empCost) * 100);
    this.empFill.style.width = `${empPct}%`;
    this.empValue.textContent = empReady ? 'READY [R-CLICK]' : `${Math.round(this.player.chronoEnergy)}/35`;

    const odPct = this.player.isOverdrive
      ? Math.max(0, (this.player.overdriveTimer / this.player.overdriveDuration) * 100)
      : Math.min(100, this.player.overdriveCharge);
    this.overdriveFill.style.width = `${odPct}%`;

    if (this.player.isOverdrive) {
      this.overdriveValue.textContent = 'ACTIVE!';
      this.overdriveFill.parentElement.classList.add('overdrive-ready-pulse');
    } else if (odPct >= 100) {
      this.overdriveValue.textContent = 'READY [F]';
      this.overdriveFill.parentElement.classList.add('overdrive-ready-pulse');
    } else {
      this.overdriveValue.textContent = `${Math.round(odPct)}%`;
      this.overdriveFill.parentElement.classList.remove('overdrive-ready-pulse');
    }

    if (this.isBossWave && this.bossRef && !this.bossRef.isDead) {
      const bPct = Math.max(0, (this.bossRef.hp / this.bossRef.maxHp) * 100);
      this.bossBarFill.style.width = `${bPct}%`;
      const bossHpValue = document.getElementById('boss-hp-value');
      const bossPhaseValue = document.getElementById('boss-phase-value');
      if (bossHpValue) bossHpValue.textContent = `${Math.max(0, Math.ceil(this.bossRef.hp)).toLocaleString()} HP`;
      if (bossPhaseValue) bossPhaseValue.textContent = `PHASE ${Math.min(3, (this.bossRef.attackPhase || 0) + 1)} // TIER ${Math.max(1, Math.floor(this.wave / 10))}`;
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    ctx.translate(window.particles.shakeOffsetX, window.particles.shakeOffsetY);
    ctx.clearRect(0, 0, this.width, this.height);

    this.renderCyberGrid(ctx);

    // In TITLE, BRIEFING, or ONBOARDING, only render the ambient cyber grid, never frozen combat leftovers!
    if (this.state === 'TITLE' || this.state === 'BRIEFING' || this.state === 'ONBOARDING') {
      ctx.restore();
      return;
    }

    this.renderHazards(ctx);

    for (const orb of this.orbs) orb.render(ctx);
    for (const p of this.playerProjectiles) p.render(ctx);
    for (const e of this.enemies) e.render(ctx, this.player && this.player.isSlowMo, this.performanceMode);
    for (const b of this.bullets) b.render(ctx);

    if (this.player) {
      this.player.render(ctx, this.player.isSlowMo, this.mouse.x, this.mouse.y, this.width, this.height);
    }

    window.particles.render(ctx, this.width, this.height, this.player ? this.player.x : 0, this.player ? this.player.y : 0);

    this.renderRadar(ctx);
    ctx.restore();
  }

  renderCyberGrid(ctx) {
    ctx.save();
    const bass = window.chronoAudio ? window.chronoAudio.getBassEnergy() : 0;
    const over = this.player && this.player.isOverdrive;
    const w = this.width, h = this.height;

    const wash = ctx.createRadialGradient(w * 0.5, h * 0.48, 20, w * 0.5, h * 0.48, Math.max(w, h) * 0.75);
    wash.addColorStop(0, over ? `rgba(120,0,35,${0.16 + bass * 0.12})` : `rgba(0,75,120,${0.13 + bass * 0.06})`);
    wash.addColorStop(0.65, 'rgba(2,7,17,0.05)');
    wash.addColorStop(1, 'rgba(1,3,8,0.38)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.49;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = -18; i <= 18; i++) {
      const bx = w / 2 + i * (w / 18);
      ctx.strokeStyle = `rgba(0,190,235,${0.045 + (1 - Math.abs(i) / 18) * 0.025})`;
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 18, horizon); ctx.lineTo(bx, h); ctx.stroke();
    }
    for (let j = 0; j < 15; j++) {
      const p = Math.pow(j / 14, 1.7);
      const y = horizon + p * (h - horizon);
      ctx.strokeStyle = `rgba(0,190,235,${0.025 + p * 0.055})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    const edge = over ? '#ff174f' : '#087dff';
    ctx.shadowColor = edge; ctx.shadowBlur = 10 + bass * 12; ctx.strokeStyle = edge; ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h - 8); ctx.lineTo(w, h - 8); ctx.stroke();
    ctx.restore();
  }

  renderRadar(ctx) {
    if (!this.player) return;
    const r = 58, cx = this.width - r - 24, cy = this.height - r - 115;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(3,10,22,0.78)';
    ctx.strokeStyle = 'rgba(0,220,255,0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,190,235,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    const scale = Math.min(r / this.width, r / this.height) * 1.75;
    const dot = (x, y, color, size = 3) => {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(cx + (x - this.player.x) * scale, cy + (y - this.player.y) * scale, size, 0, Math.PI * 2); ctx.fill();
    };
    this.enemies.forEach(e => {
      if (!e.isDead) dot(e.x, e.y, e.isBoss ? '#ff3b72' : (e.type === 'phantom' ? '#a45cff' : e.type === 'orbiter' ? '#ffd42a' : '#ff245c'), e.isBoss ? 5 : 2.5);
    });
    dot(this.player.x, this.player.y, '#6ef4ff', 4);
    ctx.restore();
  }

  loop(currentTime) {
    const rawDt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    try {
      this.update(rawDt);
      this.render();
    } catch (err) {
      console.error('Chrono Surge Game Loop caught error:', err);
    }

    requestAnimationFrame((time) => this.loop(time));
  }
}

window.ChronoGame = ChronoGame;
