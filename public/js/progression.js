/* =========================================================================
   CHRONO SURGE: BEGINNING -PROGRESSION, SKINS, SKILL TREE & CLOUD SYNC
   ========================================================================= */

const SKIN_CATALOG = [
  {
    id: 'default_cyan',
    name: 'CHRONO OPERATIVE',
    subtitle: 'STANDARD ISSUE MK-I',
    primary: '#00f0ff',
    secondary: '#087dff',
    trail: '0, 240, 255',
    hullShape: 'arrowhead',
    cost: 0,
    unlockReq: 'Unlocked by default',
    checkUnlock: () => true
  },
  {
    id: 'crimson_eclipse',
    name: 'CRIMSON ECLIPSE',
    subtitle: 'HIGH-VELOCITY ASSAULT ARMOR',
    primary: '#ff174f',
    secondary: '#ff6a00',
    trail: '255, 23, 79',
    hullShape: 'scythe',
    cost: 150,
    unlockReq: '150 Shards or Reach Wave 5',
    checkUnlock: (p) => p.highestWave >= 5
  },
  {
    id: 'solar_valkyrie',
    name: 'SOLAR VALKYRIE',
    subtitle: 'AUREATE PHOTON FRAME',
    primary: '#ffe600',
    secondary: '#ff9900',
    trail: '255, 230, 0',
    hullShape: 'valkyrie',
    cost: 280,
    unlockReq: '280 Shards or Deflect 25 Bullets',
    checkUnlock: (p) => p.totalDeflects >= 25
  },
  {
    id: 'void_phantom',
    name: 'VOID PHANTOM',
    subtitle: 'DARK MATTER SINGULARITY CHASSIS',
    primary: '#b45cff',
    secondary: '#00f0ff',
    trail: '180, 92, 255',
    hullShape: 'phantom',
    cost: 420,
    unlockReq: '420 Shards or Reach Style Rank SS',
    checkUnlock: (p) => ['SS', 'SSS'].includes(p.maxStyleRank)
  },
  {
    id: 'neon_hyperion',
    name: 'NEON HYPERION',
    subtitle: 'PLASMA EMERALD OVERCLOCK',
    primary: '#00ff88',
    secondary: '#00f0ff',
    trail: '0, 255, 136',
    hullShape: 'hyperion',
    cost: 600,
    unlockReq: '600 Shards or Reach Wave 10',
    checkUnlock: (p) => p.highestWave >= 10
  },
  {
    id: 'omega_chronos',
    name: 'OMEGA ARCHON',
    subtitle: 'TRANSCENDENT TEMPORAL SOVEREIGN',
    primary: '#ffffff',
    secondary: '#ffe600',
    trail: '255, 230, 120',
    hullShape: 'archon',
    cost: 900,
    unlockReq: '900 Shards or Reach Style Rank SSS',
    checkUnlock: (p) => p.maxStyleRank === 'SSS'
  }
];

const SKILL_TREE_BRANCHES = [
  {
    id: 'chrono_mastery',
    name: 'CHRONO MASTERY',
    branch: 'TEMPORAL CORE',
    icon: '⏳',
    maxRank: 5,
    costs: [50, 100, 180, 300, 450],
    prereq: null,
    desc: 'Improve time manipulation and resource efficiency between combat abilities.',
    currentValue: (r) => r === 0 ? 'Base: 100 max energy, 8.0/s regen, 25.0/s drain' : `${Math.round(100 * (1 + r * 0.08))} max energy, ${(8 * (1 + r * 0.10)).toFixed(1)}/s regen, ${(25 * Math.pow(0.95, r)).toFixed(1)}/s drain`,
    nextValue: (r) => `${Math.round(100 * (1 + (r + 1) * 0.08))} max energy, ${(8 * (1 + (r + 1) * 0.10)).toFixed(1)}/s regen, ${(25 * Math.pow(0.95, r + 1)).toFixed(1)}/s drain`,
    statFormat: (r) => `+${r * 8}% Max / +${r * 10}% Regen / -${Math.round((1 - Math.pow(0.95, r)) * 100)}% Drain`
  },
  {
    id: 'offensive_systems',
    name: 'OFFENSIVE SYSTEMS',
    branch: 'LETHALITY',
    icon: '🗡️',
    maxRank: 5,
    costs: [50, 100, 180, 300, 450],
    prereq: null,
    desc: 'Improve ability damage output and reward aggressive tactical play.',
    currentValue: (r) => r === 0 ? 'Base: 130 slice, 36 pulse, 6% crit' : `${Math.round(130 * (1 + r * 0.05))} slice, ${Math.round(36 * (1 + r * 0.05))} pulse, ${Math.min(25, Math.round((0.06 + r * 0.02) * 100))}% crit`,
    nextValue: (r) => `${Math.round(130 * (1 + (r + 1) * 0.05))} slice, ${Math.round(36 * (1 + (r + 1) * 0.05))} pulse, ${Math.min(25, Math.round((0.06 + (r + 1) * 0.02) * 100))}% crit`,
    statFormat: (r) => `+${r * 5}% Damage / +${r * 2}% Crit`
  },
  {
    id: 'defensive_systems',
    name: 'DEFENSIVE SYSTEMS',
    branch: 'AEGIS MATRIX',
    icon: '🛡️',
    maxRank: 5,
    costs: [50, 100, 180, 300, 450],
    prereq: null,
    desc: 'Increase Hull and Shield capacity with faster recharge and lower delay.',
    currentValue: (r) => r === 0 ? 'Base: 100 Hull, 70 Shield, 11.0/s regen, 2.80s delay' : `${100 + r * 10} Hull, ${Math.round(70 * (1 + r * 0.08))} Shield, ${(11 * (1 + r * 0.12)).toFixed(1)}/s regen, ${Math.max(1.5, 2.8 * Math.pow(0.92, r)).toFixed(2)}s delay`,
    nextValue: (r) => `${100 + (r + 1) * 10} Hull, ${Math.round(70 * (1 + (r + 1) * 0.08))} Shield, ${(11 * (1 + (r + 1) * 0.12)).toFixed(1)}/s regen, ${Math.max(1.5, 2.8 * Math.pow(0.92, r + 1)).toFixed(2)}s delay`,
    statFormat: (r) => `+${r * 8}% Shield / +${r * 10} Hull / +${r * 12}% Regen`
  },
  {
    id: 'mobility_thrusters',
    name: 'MOBILITY THRUSTERS',
    branch: 'KINETIC DRIVE',
    icon: '🚀',
    maxRank: 5,
    costs: [60, 120, 200, 320, 500],
    prereq: { id: 'chrono_mastery', rank: 1 },
    desc: 'Improve vessel movement velocity and Hyper-Slash dash range.',
    currentValue: (r) => r === 0 ? 'Base: 320 speed, 1.00x dash range' : `${Math.round(320 * (1 + r * 0.03))} speed, ${(1.0 + r * 0.04).toFixed(2)}x dash range`,
    nextValue: (r) => `${Math.round(320 * (1 + (r + 1) * 0.03))} speed, ${(1.0 + (r + 1) * 0.04).toFixed(2)}x dash range`,
    statFormat: (r) => `+${r * 3}% Speed / +${r * 4}% Dash Range`
  },
  {
    id: 'energy_efficiency',
    name: 'EMP CAPACITORS',
    branch: 'PULSE REACTOR',
    icon: '🔮',
    maxRank: 5,
    costs: [60, 120, 200, 320, 500],
    prereq: { id: 'defensive_systems', rank: 1 },
    desc: 'Reduce EMP energy cost, accelerate recharge, and expand blast radius.',
    currentValue: (r) => r === 0 ? 'Base: 35 energy cost, 180px radius' : `${Math.max(22, 35 - r * 2.5).toFixed(0)} energy cost, ${Math.round(180 * (1 + r * 0.05))}px radius`,
    nextValue: (r) => `${Math.max(22, 35 - (r + 1) * 2.5).toFixed(0)} energy cost, ${Math.round(180 * (1 + (r + 1) * 0.05))}px radius`,
    statFormat: (r) => `-${(r * 2.5).toFixed(0)} Cost / +${r * 5}% Radius`
  },
  {
    id: 'overdrive_catalyst',
    name: 'OVERDRIVE CATALYST',
    branch: 'ULTIMATE CORE',
    icon: '⚡',
    maxRank: 3,
    costs: [100, 220, 400],
    prereq: { id: 'offensive_systems', rank: 2 },
    desc: 'Accelerate Overdrive charge generation and extend ultimate combat duration.',
    currentValue: (r) => r === 0 ? 'Base: 1.00x charge rate, 4.5s duration' : `${(1 + r * 0.08).toFixed(2)}x charge rate, ${(4.5 + r * 0.3).toFixed(1)}s duration`,
    nextValue: (r) => `${(1 + (r + 1) * 0.08).toFixed(2)}x charge rate, ${(4.5 + (r + 1) * 0.3).toFixed(1)}s duration`,
    statFormat: (r) => `+${r * 8}% Charge / +${(r * 0.3).toFixed(1)}s Duration`
  }
];

const ACHIEVEMENTS_CATALOG = [
  { id: 'first_blood', name: 'FIRST SEVERANCE', icon: '⚔️', desc: 'Slice your first hostile anomaly in the arena.', rewardShards: 25, check: (p) => p.totalKills >= 1 },
  { id: 'tutorial_grad', name: 'CERTIFIED OPERATIVE', icon: '🎓', desc: 'Complete the interactive Chrono Combat Training.', rewardShards: 60, check: (p) => p.tutorialCompleted },
  { id: 'deflect_master', name: 'MIRROR PROTOCOL', icon: '💠', desc: 'Deflect 15 enemy projectiles with Hyper-Slash.', rewardShards: 50, check: (p) => p.totalDeflects >= 15 },
  { id: 'wave_5', name: 'SECTOR 05 SURVIVOR', icon: '🔥', desc: 'Reach Wave 5 in Endless or Daily Challenge.', rewardShards: 75, check: (p) => p.highestWave >= 5 },
  { id: 'boss_slayer', name: 'APEX ANNIHILATOR', icon: '💀', desc: 'Defeat the Wave 10 Apex Overlord Boss.', rewardShards: 150, check: (p) => p.highestWave >= 10 },
  { id: 'style_s', name: 'SAVAGE VELOCITY', icon: '⚡', desc: 'Achieve Style Rank S or higher.', rewardShards: 90, check: (p) => ['S', 'SS', 'SSS'].includes(p.maxStyleRank) },
  { id: 'style_sss', name: 'SUPERNOVA ASCENDANT', icon: '👑', desc: 'Reach the maximum SSS Style Rank.', rewardShards: 200, check: (p) => p.maxStyleRank === 'SSS' },
  { id: 'centurion', name: 'CENTURION REAPER', icon: '💥', desc: 'Eliminate 100 total hostile anomalies across runs.', rewardShards: 100, check: (p) => p.totalKills >= 100 },
  { id: 'customizer', name: 'ARMORY ARCHITECT', icon: '🎨', desc: 'Unlock a second Chrono Suit skin or upgrade 3 skill ranks.', rewardShards: 80, check: (p) => (p.unlockedSkins && p.unlockedSkins.length >= 2) || Object.values(p.skillTree || {}).reduce((a, b) => a + b, 0) >= 3 }
];

const SAVE_STORAGE_KEY = 'chrono_surge_beginning_save_v2';
const SAVE_BACKUP_KEY = 'chrono_surge_beginning_save_v2_bak';
const safeStorage = (typeof localStorage !== 'undefined' ? localStorage : { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; } });
const AUTH_TOKEN_KEY = 'chrono_surge_beginning_jwt';
const PENDING_RUNS_KEY = 'chrono_surge_beginning_pending_runs';

class ProgressionSystem {
  constructor() {
    this.token = safeStorage.getItem(AUTH_TOKEN_KEY) || null;
    this.user = null;
    this.syncStatus = 'LOCAL'; // 'LOCAL', 'SYNCING', 'SYNCED', 'OFFLINE'
    this.profile = this.loadLocalProfile();
    this.pendingRuns = this.loadPendingRuns();
    this.statusListeners = [];
  }

  onStatusChange(cb) {
    this.statusListeners.push(cb);
  }

  notifyStatus(status, message = '') {
    this.syncStatus = status;
    for (const cb of this.statusListeners) {
      try { cb(status, message, this.profile, this.user); } catch (_) {}
    }
  }

  createFreshProfile() {
    const legacyScore = parseInt(safeStorage.getItem('chrono_high_score') || '0', 10);
    const legacyWave = parseInt(safeStorage.getItem('chrono_best_wave') || '0', 10);
    const legacySlices = parseInt(safeStorage.getItem('chrono_total_slices') || '0', 10);
    const legacyStyle = safeStorage.getItem('chrono_max_style') || 'D';

    return {
      version: 2,
      playerId: 'op_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
      displayName: 'OPERATIVE-' + Math.floor(100 + Math.random() * 900),
      avatar: 'vanguard',
      level: 1,
      xp: 0,
      shards: 100, // Starter shards so new players can test the skill tree right away
      highestWave: legacyWave,
      bestScore: legacyScore,
      longestSurvivalSec: 0,
      totalKills: 0,
      totalSlices: legacySlices,
      totalDeflects: 0,
      completedRuns: 0,
      maxStyleRank: legacyStyle,
      tutorialCompleted: false,
      equippedCore: 'vanguard',
      equippedSkin: 'default_cyan',
      unlockedSkins: ['default_cyan'],
      skillTree: {
        chrono_mastery: 0,
        offensive_systems: 0,
        defensive_systems: 0,
        mobility_thrusters: 0,
        energy_efficiency: 0,
        overdrive_catalyst: 0
      },
      achievements: [],
      runHistory: [],
      settings: {
        masterVolume: 0.75,
        musicVolume: 0.7,
        sfxVolume: 0.85,
        muted: false,
        crtEnabled: true,
        reducedMotion: false,
        highContrast: false,
        mobileControlsMode: 'auto',
        aimAssist: true,
        keyBindings: {
          up: 'KeyW',
          down: 'KeyS',
          left: 'KeyA',
          right: 'KeyD',
          emp: 'Space',
          overdrive: 'KeyF',
          fire: 'KeyE'
        }
      },
      updatedAt: Date.now()
    };
  }

  loadLocalProfile() {
    for (const key of [SAVE_STORAGE_KEY, SAVE_BACKUP_KEY]) {
      try {
        const raw = safeStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return this.migrateProfile(parsed);
          }
        }
      } catch (e) {
        console.warn('Save slot recovery fallback triggered:', e);
      }
    }
    const fresh = this.createFreshProfile();
    this.saveLocalProfile(fresh);
    return fresh;
  }

  migrateProfile(data) {
    const def = this.createFreshProfile();
    const merged = {
      ...def,
      ...data,
      skillTree: { ...def.skillTree, ...(data.skillTree || {}) },
      settings: {
        ...def.settings,
        ...(data.settings || {}),
        keyBindings: { ...def.settings.keyBindings, ...(data.settings?.keyBindings || {}) }
      }
    };
    if (!Array.isArray(merged.unlockedSkins) || merged.unlockedSkins.length === 0) {
      merged.unlockedSkins = ['default_cyan'];
    }
    if (!Array.isArray(merged.achievements)) merged.achievements = [];
    if (!Array.isArray(merged.runHistory)) merged.runHistory = [];
    merged.version = 2;
    return merged;
  }

  saveLocalProfile(profile = this.profile) {
    if (!profile) return;
    try {
      profile.updatedAt = Date.now();
      this.profile = profile;
      const prev = safeStorage.getItem(SAVE_STORAGE_KEY);
      if (prev) {
        safeStorage.setItem(SAVE_BACKUP_KEY, prev);
      }
      safeStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(profile));
      // Keep legacy keys updated for compatibility
      safeStorage.setItem('chrono_high_score', String(profile.bestScore || 0));
      safeStorage.setItem('chrono_best_wave', String(profile.highestWave || 0));
      safeStorage.setItem('chrono_total_slices', String(profile.totalSlices || 0));
      safeStorage.setItem('chrono_max_style', String(profile.maxStyleRank || 'D'));
      return true;
    } catch (e) {
      console.error('Local save failed:', e);
      return false;
    }
  }

  loadPendingRuns() {
    try {
      const raw = safeStorage.getItem(PENDING_RUNS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  savePendingRuns() {
    try {
      safeStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(this.pendingRuns.slice(0, 15)));
    } catch (_) {}
  }

  // --- ACHIEVEMENTS & SKIN AUTO-UNLOCK EVALUATION ---
  evaluateUnlocks() {
    const newlyUnlocked = [];

    // Check Achievements
    for (const ach of ACHIEVEMENTS_CATALOG) {
      if (!this.profile.achievements.includes(ach.id) && ach.check(this.profile)) {
        this.profile.achievements.push(ach.id);
        this.profile.shards = (this.profile.shards || 0) + ach.rewardShards;
        newlyUnlocked.push({ type: 'achievement', item: ach });
      }
    }

    // Check Milestone Skins
    for (const skin of SKIN_CATALOG) {
      if (!this.profile.unlockedSkins.includes(skin.id) && skin.checkUnlock(this.profile)) {
        this.profile.unlockedSkins.push(skin.id);
        newlyUnlocked.push({ type: 'skin', item: skin });
      }
    }

    if (newlyUnlocked.length > 0) {
      this.saveLocalProfile();
    }
    return newlyUnlocked;
  }

  // --- SKILL TREE UPGRADE ---
  purchaseSkill(skillId) {
    const branch = SKILL_TREE_BRANCHES.find(b => b.id === skillId);
    if (!branch) return { ok: false, reason: 'Invalid skill node.' };

    const curRank = this.profile.skillTree[skillId] || 0;
    if (curRank >= branch.maxRank) {
      return { ok: false, reason: 'Skill already at maximum rank.' };
    }

    if (branch.prereq) {
      const preRank = this.profile.skillTree[branch.prereq.id] || 0;
      if (preRank < branch.prereq.rank) {
        const preBranch = SKILL_TREE_BRANCHES.find(b => b.id === branch.prereq.id);
        return { ok: false, reason: `Requires ${preBranch ? preBranch.name : branch.prereq.id} Rank ${branch.prereq.rank}.` };
      }
    }

    const cost = branch.costs[curRank];
    if ((this.profile.shards || 0) < cost) {
      return { ok: false, reason: `Insufficient Chrono Shards (${cost} required).` };
    }

    this.profile.shards -= cost;
    this.profile.skillTree[skillId] = curRank + 1;
    this.evaluateUnlocks();
    this.saveLocalProfile();
    this.syncToCloud();
    return { ok: true, newRank: curRank + 1, remainingShards: this.profile.shards };
  }

  // --- SKIN UNLOCK & EQUIP ---
  unlockOrEquipSkin(skinId) {
    const skin = SKIN_CATALOG.find(s => s.id === skinId);
    if (!skin) return { ok: false, reason: 'Skin not found.' };

    if (this.profile.unlockedSkins.includes(skinId)) {
      this.profile.equippedSkin = skinId;
      this.saveLocalProfile();
      this.syncToCloud();
      return { ok: true, action: 'equipped', skin };
    }

    if ((this.profile.shards || 0) < skin.cost) {
      return { ok: false, reason: `Requires ${skin.cost} Chrono Shards or milestone: ${skin.unlockReq}` };
    }

    this.profile.shards -= skin.cost;
    this.profile.unlockedSkins.push(skinId);
    this.profile.equippedSkin = skinId;
    this.evaluateUnlocks();
    this.saveLocalProfile();
    this.syncToCloud();
    return { ok: true, action: 'unlocked', skin };
  }

  getEquippedSkinDef() {
    return SKIN_CATALOG.find(s => s.id === this.profile.equippedSkin) || SKIN_CATALOG[0];
  }

  // --- RECORD RUN COMPLETION ---
  async recordCompletedRun(runSummary) {
    const runId = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const shardsEarned = Math.floor(runSummary.wave * 18 + runSummary.kills * 1.5 + (runSummary.score / 800));
    const xpEarned = Math.floor(runSummary.wave * 45 + runSummary.kills * 4);

    this.profile.shards = (this.profile.shards || 0) + shardsEarned;
    this.profile.xp = (this.profile.xp || 0) + xpEarned;
    this.profile.level = Math.max(this.profile.level || 1, 1 + Math.floor(Math.sqrt(this.profile.xp / 120)));
    this.profile.highestWave = Math.max(this.profile.highestWave || 0, runSummary.wave);
    this.profile.bestScore = Math.max(this.profile.bestScore || 0, runSummary.score);
    this.profile.longestSurvivalSec = Math.max(this.profile.longestSurvivalSec || 0, Math.floor(runSummary.survivalTime));
    this.profile.totalKills = (this.profile.totalKills || 0) + runSummary.kills;
    this.profile.totalSlices = (this.profile.totalSlices || 0) + runSummary.slices;
    this.profile.totalDeflects = (this.profile.totalDeflects || 0) + runSummary.deflects;
    this.profile.completedRuns = (this.profile.completedRuns || 0) + 1;

    const ranks = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    if (ranks.indexOf(runSummary.styleRank) > ranks.indexOf(this.profile.maxStyleRank || 'D')) {
      this.profile.maxStyleRank = runSummary.styleRank;
    }

    const entry = {
      runId,
      playerId: this.profile.playerId,
      displayName: this.profile.displayName,
      avatar: this.profile.equippedCore,
      mode: runSummary.mode || 'endless',
      dailySeed: runSummary.dailySeed || null,
      score: Math.floor(runSummary.score),
      wave: runSummary.wave,
      survivalTime: Math.max(1, Math.floor(runSummary.survivalTime)),
      kills: runSummary.kills,
      maxCombo: runSummary.maxCombo,
      styleRank: runSummary.styleRank,
      coreType: runSummary.coreType,
      skinId: this.profile.equippedSkin,
      timestamp: Date.now()
    };

    this.profile.runHistory = [entry, ...(this.profile.runHistory || [])].slice(0, 20);
    const unlockedNow = this.evaluateUnlocks();
    this.saveLocalProfile();

    // Submit to backend leaderboard & cloud save
    try {
      this.notifyStatus('SYNCING', 'Uploading run telemetry...');
      if (window.chronoSupabase?.isAvailable()) {
        window.chronoSupabase.submitRun(entry);
      }
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers,
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile && this.token) {
          this.profile = this.migrateProfile(data.profile);
          this.saveLocalProfile();
        }
        this.notifyStatus(this.token ? 'SYNCED' : 'LOCAL', 'Run verified & recorded on leaderboard');
      } else {
        throw new Error('Server rejected or unavailable');
      }
    } catch (_) {
      // Queue for offline retry
      this.pendingRuns.push(entry);
      this.savePendingRuns();
      this.notifyStatus('OFFLINE', 'Saved locally (queued for cloud sync)');
    }

    return { shardsEarned, xpEarned, unlockedNow, entry };
  }

  // --- CLOUD AUTHENTICATION & SYNC ---
  async checkInitialSession() {
    if (window.chronoSupabase?.isAvailable() && window.chronoSupabase.client) {
      const { data } = await window.chronoSupabase.client.auth.getSession();
      if (data?.session) {
        this.handleSupabaseSession(data.session);
        return;
      }
    }

    if (!this.token) {
      this.notifyStatus('LOCAL', 'Guest local profile active');
      this.flushPendingRuns();
      return;
    }
    try {
      this.notifyStatus('SYNCING', 'Restoring cloud profile...');
      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        await this.syncToCloud();
        await this.flushPendingRuns();
      } else {
        this.logout();
      }
    } catch (_) {
      this.notifyStatus('OFFLINE', 'Offline mode — local profile active');
    }
  }

  async checkUsernameAvailability(username) {
    if (window.chronoSupabase?.isAvailable()) {
      return await window.chronoSupabase.checkUsernameAvailable(username);
    }
    try {
      const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(username.trim())}`);
      if (res.ok) return await res.json();
    } catch (_) {}
    return { available: true, normalized: username.trim() };
  }

  async registerAccount(username, password, email = null) {
    this.notifyStatus('SYNCING', 'Creating Operative Cloud Account...');

    if (window.chronoSupabase?.isAvailable()) {
      const data = await window.chronoSupabase.signUp(email || `${username}@chronosurge.net`, password, username, this.profile);
      this.user = { id: data.user.id, username: username, email: email || data.user.email };
      this.profile.displayName = username.toUpperCase();
      this.saveLocalProfile();
      this.notifyStatus('SYNCED', `Signed in as ${username}`);
      return data;
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, guestProfile: this.profile })
    });
    const data = await res.json();
    if (!res.ok) {
      this.notifyStatus('LOCAL', data.error || 'Registration failed');
      throw new Error(data.error || 'Registration failed');
    }
    this.token = data.token;
    this.user = data.user;
    safeStorage.setItem(AUTH_TOKEN_KEY, this.token);
    this.profile = this.migrateProfile(data.profile);
    this.saveLocalProfile();
    this.notifyStatus('SYNCED', `Signed in as ${this.user.username}`);
    return data;
  }

  async loginAccount(identifier, password) {
    this.notifyStatus('SYNCING', 'Authenticating Operative...');

    if (window.chronoSupabase?.isAvailable()) {
      const data = await window.chronoSupabase.signInWithPassword(identifier, password);
      this.user = { id: data.user.id, username: data.user.user_metadata?.username || identifier, email: data.user.email };
      this.saveLocalProfile();
      this.notifyStatus('SYNCED', `Cloud profile restored: ${this.user.username}`);
      return data;
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password, guestProfile: this.profile })
    });
    const data = await res.json();
    if (!res.ok) {
      this.notifyStatus('LOCAL', data.error || 'Login failed');
      throw new Error(data.error || 'Login failed');
    }
    this.token = data.token;
    this.user = data.user;
    safeStorage.setItem(AUTH_TOKEN_KEY, this.token);
    this.profile = this.migrateProfile(data.profile);
    this.saveLocalProfile();
    this.notifyStatus('SYNCED', `Cloud profile restored: ${this.user.username}`);
    this.flushPendingRuns();
    return data;
  }

  async loginWithGoogle() {
    if (window.chronoSupabase?.isAvailable()) {
      return await window.chronoSupabase.signInWithGoogle();
    }
    throw new Error('Google OAuth requires Supabase configuration in Settings.');
  }

  async requestPasswordReset(emailOrUsername) {
    if (window.chronoSupabase?.isAvailable() && emailOrUsername.includes('@')) {
      return await window.chronoSupabase.requestPasswordReset(emailOrUsername);
    }
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recovery request failed.');
    return data;
  }

  handleSupabaseSession(session) {
    if (!session || !session.user) return;
    const u = session.user;
    this.token = session.access_token;
    this.user = {
      id: u.id,
      username: u.user_metadata?.username || u.email?.split('@')[0] || 'pilot',
      email: u.email
    };
    safeStorage.setItem(AUTH_TOKEN_KEY, this.token);
    this.profile.displayName = this.user.username.toUpperCase();
    this.saveLocalProfile();
    this.notifyStatus('SYNCED', `Google authenticated: ${this.user.username}`);
    if (window.refreshAllMetaUI) window.refreshAllMetaUI();
  }

  logout() {
    if (window.chronoSupabase?.isAvailable()) {
      window.chronoSupabase.signOut();
    }
    this.token = null;
    this.user = null;
    safeStorage.removeItem(AUTH_TOKEN_KEY);
    this.notifyStatus('LOCAL', 'Signed out (Local Guest Mode Active)');
  }

  async syncToCloud() {
    this.saveLocalProfile();
    if (!this.token) {
      this.notifyStatus('LOCAL', 'Saved to local storage');
      return false;
    }
    try {
      this.notifyStatus('SYNCING', 'Syncing with Cloud...');
      const res = await fetch('/api/profile/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ profile: this.profile })
      });
      if (res.ok) {
        const data = await res.json();
        this.profile = this.migrateProfile(data.profile);
        this.saveLocalProfile();
        this.notifyStatus('SYNCED', 'Cloud Save Synchronized');
        return true;
      }
    } catch (_) {
      this.notifyStatus('OFFLINE', 'Cloud unreachable — saved locally');
    }
    return false;
  }

  async flushPendingRuns() {
    if (this.pendingRuns.length === 0) return;
    const remaining = [];
    for (const run of this.pendingRuns) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers,
          body: JSON.stringify(run)
        });
        if (!res.ok && res.status >= 500) {
          remaining.push(run);
        }
      } catch (_) {
        remaining.push(run);
      }
    }
    this.pendingRuns = remaining;
    this.savePendingRuns();
  }
}

if (typeof window !== 'undefined') {
  window.SKIN_CATALOG = SKIN_CATALOG;
  window.SKILL_TREE_BRANCHES = SKILL_TREE_BRANCHES;
  window.ACHIEVEMENTS_CATALOG = ACHIEVEMENTS_CATALOG;
  window.progression = new ProgressionSystem();
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    ProgressionSystem,
    SKILL_TREE_BRANCHES,
    SKIN_CATALOG,
    ACHIEVEMENTS_CATALOG
  };
}
