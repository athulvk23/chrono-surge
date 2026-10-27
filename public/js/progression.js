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
    desc: '-7% Time Dilation drain and +8% Chrono recharge speed per rank.',
    statFormat: (r) => `-${r * 7}% Drain / +${r * 8}% Regen`
  },
  {
    id: 'offensive_systems',
    name: 'OFFENSIVE SYSTEMS',
    branch: 'LETHALITY',
    icon: '🗡️',
    maxRank: 5,
    costs: [50, 100, 180, 300, 450],
    prereq: null,
    desc: '+8% Hyper-Slash & Primary Pulse damage and +4% Critical Strike chance per rank.',
    statFormat: (r) => `+${r * 8}% Damage / +${r * 4}% Crit`
  },
  {
    id: 'defensive_systems',
    name: 'DEFENSIVE SYSTEMS',
    branch: 'AEGIS MATRIX',
    icon: '🛡️',
    maxRank: 5,
    costs: [50, 100, 180, 300, 450],
    prereq: null,
    desc: '+12 Max Shield & +10 Max Hull Health per rank.',
    statFormat: (r) => `+${r * 12} Shield / +${r * 10} Hull`
  },
  {
    id: 'mobility_thrusters',
    name: 'MOBILITY THRUSTERS',
    branch: 'KINETIC DRIVE',
    icon: '🚀',
    maxRank: 5,
    costs: [60, 120, 200, 320, 500],
    prereq: { id: 'chrono_mastery', rank: 1 },
    desc: '+6% Movement speed and +7% Hyper-Slash Dash range per rank.',
    statFormat: (r) => `+${r * 6}% Speed / +${r * 7}% Dash Range`
  },
  {
    id: 'energy_efficiency',
    name: 'EMP CAPACITORS',
    branch: 'PULSE REACTOR',
    icon: '🔮',
    maxRank: 5,
    costs: [60, 120, 200, 320, 500],
    prereq: { id: 'defensive_systems', rank: 1 },
    desc: '+9% EMP Repulse recharge speed and +6% EMP blast radius per rank.',
    statFormat: (r) => `+${r * 9}% EMP Regen / +${r * 6}% Radius`
  },
  {
    id: 'overdrive_catalyst',
    name: 'OVERDRIVE CATALYST',
    branch: 'ULTIMATE CORE',
    icon: '⚡',
    maxRank: 3,
    costs: [100, 220, 400],
    prereq: { id: 'offensive_systems', rank: 2 },
    desc: '+15% Overdrive charge gain and +0.6s Overdrive duration per rank.',
    statFormat: (r) => `+${r * 15}% Charge / +${(r * 0.6).toFixed(1)}s Duration`
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
const AUTH_TOKEN_KEY = 'chrono_surge_beginning_jwt';
const PENDING_RUNS_KEY = 'chrono_surge_beginning_pending_runs';

class ProgressionSystem {
  constructor() {
    this.token = localStorage.getItem(AUTH_TOKEN_KEY) || null;
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
    const legacyScore = parseInt(localStorage.getItem('chrono_high_score') || '0', 10);
    const legacyWave = parseInt(localStorage.getItem('chrono_best_wave') || '0', 10);
    const legacySlices = parseInt(localStorage.getItem('chrono_total_slices') || '0', 10);
    const legacyStyle = localStorage.getItem('chrono_max_style') || 'D';

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
        const raw = localStorage.getItem(key);
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
    try {
      this.profile.updatedAt = Date.now();
      const prev = localStorage.getItem(SAVE_STORAGE_KEY);
      if (prev) {
        localStorage.setItem(SAVE_BACKUP_KEY, prev);
      }
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(profile));
      // Keep legacy keys updated for compatibility
      localStorage.setItem('chrono_high_score', String(profile.bestScore || 0));
      localStorage.setItem('chrono_best_wave', String(profile.highestWave || 0));
      localStorage.setItem('chrono_total_slices', String(profile.totalSlices || 0));
      localStorage.setItem('chrono_max_style', String(profile.maxStyleRank || 'D'));
      return true;
    } catch (e) {
      console.error('Local save failed:', e);
      return false;
    }
  }

  loadPendingRuns() {
    try {
      const raw = localStorage.getItem(PENDING_RUNS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  savePendingRuns() {
    try {
      localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(this.pendingRuns.slice(0, 15)));
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
        this.notifyStatus(this.token ? 'SYNCED' : 'LOCAL', 'Run recorded on leaderboard');
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
        // Reconcile local & cloud safely
        await this.syncToCloud();
        await this.flushPendingRuns();
      } else {
        this.logout();
      }
    } catch (_) {
      this.notifyStatus('OFFLINE', 'Offline mode — local profile active');
    }
  }

  async registerAccount(username, password) {
    this.notifyStatus('SYNCING', 'Creating Operative Cloud Account...');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, guestProfile: this.profile })
    });
    const data = await res.json();
    if (!res.ok) {
      this.notifyStatus('LOCAL', data.error || 'Registration failed');
      throw new Error(data.error || 'Registration failed');
    }
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem(AUTH_TOKEN_KEY, this.token);
    this.profile = this.migrateProfile(data.profile);
    this.saveLocalProfile();
    this.notifyStatus('SYNCED', `Signed in as ${this.user.username}`);
    return data;
  }

  async loginAccount(username, password) {
    this.notifyStatus('SYNCING', 'Authenticating Operative...');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, guestProfile: this.profile })
    });
    const data = await res.json();
    if (!res.ok) {
      this.notifyStatus('LOCAL', data.error || 'Login failed');
      throw new Error(data.error || 'Login failed');
    }
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem(AUTH_TOKEN_KEY, this.token);
    this.profile = this.migrateProfile(data.profile);
    this.saveLocalProfile();
    this.notifyStatus('SYNCED', `Cloud profile restored: ${this.user.username}`);
    this.flushPendingRuns();
    return data;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.notifyStatus('LOCAL', 'Signed out (Local Guest Mode)');
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

window.SKIN_CATALOG = SKIN_CATALOG;
window.SKILL_TREE_BRANCHES = SKILL_TREE_BRANCHES;
window.ACHIEVEMENTS_CATALOG = ACHIEVEMENTS_CATALOG;
window.progression = new ProgressionSystem();
