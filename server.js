const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BAK_FILE = path.join(DATA_DIR, 'db.json.bak');
const JWT_SECRET = process.env.JWT_SECRET || 'chrono-surge-beginning-local-dev-secret-change-in-prod-2026';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

// --- ATOMIC DATABASE ENGINE (JSON + BAK + SCHEMA MIGRATION) ---
const DB_SCHEMA_VERSION = 2;

function createEmptyDb() {
  return {
    version: DB_SCHEMA_VERSION,
    users: {},        // userId -> { id, username, passwordHash, salt, createdAt, profile }
    usernames: {},    // lowercaseUsername -> userId
    sessions: {},     // tokenHash -> { userId, expiresAt }
    leaderboards: {
      endless: [],    // [{ runId, userId, displayName, avatar, score, wave, survivalTime, kills, maxCombo, styleRank, coreType, skinId, timestamp }]
      daily: {}       // dateStr -> [{ ... }]
    },
    processedRuns: {} // runId -> timestamp (idempotency / duplicate reward prevention)
  };
}

function loadDatabase() {
  for (const file of [DB_FILE, DB_BAK_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.version || parsed.version < DB_SCHEMA_VERSION) {
            parsed.version = DB_SCHEMA_VERSION;
            parsed.users = parsed.users || {};
            parsed.usernames = parsed.usernames || {};
            parsed.sessions = parsed.sessions || {};
            parsed.leaderboards = parsed.leaderboards || { endless: [], daily: {} };
            parsed.processedRuns = parsed.processedRuns || {};
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`Warning reading ${file}:`, e.message);
    }
  }
  const initial = createEmptyDb();
  saveDatabase(initial);
  return initial;
}

let db = loadDatabase();

function saveDatabase(data = db) {
  try {
    const tmpFile = `${DB_FILE}.tmp.${process.pid}.${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpFile, serialized, 'utf8');
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, DB_BAK_FILE);
      } catch (_) {}
    }
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (e) {
    console.error('Database write error:', e.message);
    return false;
  }
}

// --- CRYPTO & TOKEN HELPERS ---
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const { hash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (_) {
    return false;
  }
}

function issueToken(userId, username) {
  const payload = {
    sub: userId,
    usr: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14 // 14 days
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function extractAuthUser(req) {
  const auth = req.headers['authorization'];
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const claims = verifyToken(token);
  if (!claims || !claims.sub) return null;
  const user = db.users[claims.sub];
  return user || null;
}

// --- RATE LIMITING ---
const rateBuckets = new Map();
function checkRateLimit(ip, bucket = 'api', maxReq = 60, windowMs = 60000) {
  const now = Date.now();
  const key = `${ip}:${bucket}`;
  let entry = rateBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, entry);
  }
  entry.count++;
  return {
    allowed: entry.count <= maxReq,
    remaining: Math.max(0, maxReq - entry.count),
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000)
  };
}

// --- DEFAULT PROFILE & VALIDATION ---
function createDefaultProfile(id, displayName = 'CHRONO OPERATIVE') {
  return {
    version: 2,
    playerId: id,
    displayName: String(displayName).slice(0, 24),
    avatar: 'vanguard',
    level: 1,
    xp: 0,
    shards: 0,
    highestWave: 0,
    bestScore: 0,
    longestSurvivalSec: 0,
    totalKills: 0,
    totalSlices: 0,
    totalDeflects: 0,
    completedRuns: 0,
    maxStyleRank: 'D',
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
      mobileControlsMode: 'auto', // 'auto', 'on', 'off'
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

const VALID_SKINS = new Set([
  'default_cyan',
  'crimson_eclipse',
  'solar_valkyrie',
  'void_phantom',
  'neon_hyperion',
  'omega_chronos'
]);

const SKILL_COSTS = {
  chrono_mastery: [50, 100, 180, 300, 450],
  offensive_systems: [50, 100, 180, 300, 450],
  defensive_systems: [50, 100, 180, 300, 450],
  mobility_thrusters: [60, 120, 200, 320, 500],
  energy_efficiency: [60, 120, 200, 320, 500],
  overdrive_catalyst: [100, 220, 400]
};

function sanitizeAndMergeProfile(existing, incoming) {
  const base = existing ? JSON.parse(JSON.stringify(existing)) : createDefaultProfile(incoming?.playerId || crypto.randomUUID());
  if (!incoming || typeof incoming !== 'object') return base;

  if (typeof incoming.displayName === 'string' && incoming.displayName.trim().length >= 2) {
    base.displayName = incoming.displayName.trim().slice(0, 24).replace(/[<>]/g, '');
  }
  if (typeof incoming.avatar === 'string') {
    base.avatar = incoming.avatar.slice(0, 24);
  }

  // Reconcile progression monotonically (never lose cloud progress unless valid)
  if (Number.isFinite(incoming.level)) base.level = Math.max(base.level, Math.min(999, Math.floor(incoming.level)));
  if (Number.isFinite(incoming.xp)) base.xp = Math.max(base.xp, Math.min(10000000, Math.floor(incoming.xp)));
  if (Number.isFinite(incoming.shards)) base.shards = Math.max(0, Math.min(1000000, Math.floor(incoming.shards)));
  if (Number.isFinite(incoming.highestWave)) base.highestWave = Math.max(base.highestWave, Math.min(1000, Math.floor(incoming.highestWave)));
  if (Number.isFinite(incoming.bestScore)) base.bestScore = Math.max(base.bestScore, Math.min(100000000, Math.floor(incoming.bestScore)));
  if (Number.isFinite(incoming.longestSurvivalSec)) base.longestSurvivalSec = Math.max(base.longestSurvivalSec, Math.min(86400, Math.floor(incoming.longestSurvivalSec)));
  if (Number.isFinite(incoming.totalKills)) base.totalKills = Math.max(base.totalKills, Math.min(10000000, Math.floor(incoming.totalKills)));
  if (Number.isFinite(incoming.totalSlices)) base.totalSlices = Math.max(base.totalSlices, Math.min(10000000, Math.floor(incoming.totalSlices)));
  if (Number.isFinite(incoming.totalDeflects)) base.totalDeflects = Math.max(base.totalDeflects, Math.min(10000000, Math.floor(incoming.totalDeflects)));
  if (Number.isFinite(incoming.completedRuns)) base.completedRuns = Math.max(base.completedRuns, Math.min(1000000, Math.floor(incoming.completedRuns)));

  const ranks = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  if (ranks.includes(incoming.maxStyleRank)) {
    if (ranks.indexOf(incoming.maxStyleRank) > ranks.indexOf(base.maxStyleRank)) {
      base.maxStyleRank = incoming.maxStyleRank;
    }
  }

  if (typeof incoming.tutorialCompleted === 'boolean') {
    base.tutorialCompleted = base.tutorialCompleted || incoming.tutorialCompleted;
  }

  if (['vanguard', 'reaper', 'valkyrie'].includes(incoming.equippedCore)) {
    base.equippedCore = incoming.equippedCore;
  }

  if (Array.isArray(incoming.unlockedSkins)) {
    const mergedSkins = new Set(base.unlockedSkins);
    for (const s of incoming.unlockedSkins) {
      if (VALID_SKINS.has(s)) mergedSkins.add(s);
    }
    base.unlockedSkins = Array.from(mergedSkins);
  }

  if (VALID_SKINS.has(incoming.equippedSkin) && base.unlockedSkins.includes(incoming.equippedSkin)) {
    base.equippedSkin = incoming.equippedSkin;
  }

  if (incoming.skillTree && typeof incoming.skillTree === 'object') {
    for (const [k, maxCostArr] of Object.entries(SKILL_COSTS)) {
      const val = incoming.skillTree[k];
      if (Number.isFinite(val) && val >= 0 && val <= maxCostArr.length) {
        base.skillTree[k] = Math.max(base.skillTree[k] || 0, Math.floor(val));
      }
    }
  }

  if (Array.isArray(incoming.achievements)) {
    const mergedAch = new Set(base.achievements);
    for (const a of incoming.achievements) {
      if (typeof a === 'string' && a.length <= 48) mergedAch.add(a);
    }
    base.achievements = Array.from(mergedAch);
  }

  if (Array.isArray(incoming.runHistory)) {
    const existingIds = new Set((base.runHistory || []).map(r => r.runId));
    for (const r of incoming.runHistory.slice(0, 25)) {
      if (r && typeof r === 'object' && typeof r.runId === 'string' && !existingIds.has(r.runId)) {
        existingIds.add(r.runId);
        base.runHistory.unshift({
          runId: r.runId.slice(0, 48),
          mode: ['endless', 'daily', 'tutorial'].includes(r.mode) ? r.mode : 'endless',
          score: Math.max(0, Math.floor(Number(r.score) || 0)),
          wave: Math.max(1, Math.floor(Number(r.wave) || 1)),
          kills: Math.max(0, Math.floor(Number(r.kills) || 0)),
          survivalTime: Math.max(0, Math.floor(Number(r.survivalTime) || 0)),
          styleRank: ranks.includes(r.styleRank) ? r.styleRank : 'D',
          coreType: ['vanguard', 'reaper', 'valkyrie'].includes(r.coreType) ? r.coreType : 'vanguard',
          timestamp: Number(r.timestamp) || Date.now()
        });
      }
    }
    base.runHistory = base.runHistory.slice(0, 20);
  }

  if (incoming.settings && typeof incoming.settings === 'object') {
    const s = incoming.settings;
    if (Number.isFinite(s.masterVolume)) base.settings.masterVolume = Math.max(0, Math.min(1, Number(s.masterVolume)));
    if (Number.isFinite(s.musicVolume)) base.settings.musicVolume = Math.max(0, Math.min(1, Number(s.musicVolume)));
    if (Number.isFinite(s.sfxVolume)) base.settings.sfxVolume = Math.max(0, Math.min(1, Number(s.sfxVolume)));
    if (typeof s.muted === 'boolean') base.settings.muted = s.muted;
    if (typeof s.crtEnabled === 'boolean') base.settings.crtEnabled = s.crtEnabled;
    if (typeof s.reducedMotion === 'boolean') base.settings.reducedMotion = s.reducedMotion;
    if (typeof s.highContrast === 'boolean') base.settings.highContrast = s.highContrast;
    if (['auto', 'on', 'off'].includes(s.mobileControlsMode)) base.settings.mobileControlsMode = s.mobileControlsMode;
    if (typeof s.aimAssist === 'boolean') base.settings.aimAssist = s.aimAssist;
    if (s.keyBindings && typeof s.keyBindings === 'object') {
      for (const action of ['up', 'down', 'left', 'right', 'emp', 'overdrive', 'fire']) {
        if (typeof s.keyBindings[action] === 'string' && s.keyBindings[action].length <= 20) {
          base.settings.keyBindings[action] = s.keyBindings[action];
        }
      }
    }
  }

  base.updatedAt = Date.now();
  return base;
}

// --- RUN & LEADERBOARD ANTI-CHEAT VALIDATION ---
function validateRunSubmission(run) {
  if (!run || typeof run !== 'object') return { valid: false, reason: 'Invalid payload' };
  const score = Number(run.score);
  const wave = Number(run.wave);
  const survivalTime = Number(run.survivalTime);
  const kills = Number(run.kills);
  const maxCombo = Number(run.maxCombo || 0);

  if (!Number.isFinite(score) || score < 0 || score > 50000000) {
    return { valid: false, reason: 'Score out of bounds' };
  }
  if (!Number.isFinite(wave) || wave < 1 || wave > 500) {
    return { valid: false, reason: 'Wave out of bounds' };
  }
  if (!Number.isFinite(survivalTime) || survivalTime < 1 || survivalTime > 86400) {
    return { valid: false, reason: 'Survival time out of bounds' };
  }
  if (!Number.isFinite(kills) || kills < 0 || kills > 250000) {
    return { valid: false, reason: 'Kills out of bounds' };
  }

  // Plausibility checks:
  // Cannot advance waves faster than 2 seconds per wave
  if (wave > 1 && survivalTime < (wave - 1) * 2.0) {
    return { valid: false, reason: 'Implausible wave progression speed' };
  }
  // Cannot kill more than 15 enemies per second sustained
  if (kills > 20 && (kills / survivalTime) > 15) {
    return { valid: false, reason: 'Implausible kill velocity for elapsed time' };
  }
  // Plausible upper score bound relative to waves & kills
  const maxPlausibleScore = (wave * 25000) + (kills * 3500) + 50000;
  if (score > maxPlausibleScore) {
    return { valid: false, reason: 'Score exceeds plausible combat ceiling for wave/kills' };
  }
  if (maxCombo > kills + 50) {
    return { valid: false, reason: 'Combo exceeds total combat interactions' };
  }

  return {
    valid: true,
    sanitized: {
      runId: typeof run.runId === 'string' ? run.runId.slice(0, 48) : crypto.randomUUID(),
      mode: ['endless', 'daily'].includes(run.mode) ? run.mode : 'endless',
      dailySeed: typeof run.dailySeed === 'string' ? run.dailySeed.slice(0, 16) : getTodaySeedString(),
      displayName: typeof run.displayName === 'string' && run.displayName.trim() ? run.displayName.trim().slice(0, 24).replace(/[<>]/g, '') : 'OPERATIVE',
      avatar: typeof run.avatar === 'string' ? run.avatar.slice(0, 24) : 'vanguard',
      score: Math.floor(score),
      wave: Math.floor(wave),
      survivalTime: Math.floor(survivalTime),
      kills: Math.floor(kills),
      maxCombo: Math.floor(maxCombo),
      styleRank: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'].includes(run.styleRank) ? run.styleRank : 'D',
      coreType: ['vanguard', 'reaper', 'valkyrie'].includes(run.coreType) ? run.coreType : 'vanguard',
      skinId: VALID_SKINS.has(run.skinId) ? run.skinId : 'default_cyan',
      timestamp: Date.now()
    }
  };
}

function getTodaySeedString() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeDailyChallengeConfig(dateInput = getTodaySeedString()) {
  const dateStr = dateInput instanceof Date ? dateInput.toISOString().slice(0, 10) : String(dateInput);
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = Math.abs(hash);
  const cores = ['vanguard', 'reaper', 'valkyrie'];
  const modifiers = [
    { id: 'overclocked_swarms', name: 'OVERCLOCKED SWARMS', desc: 'Enemies move 20% faster, +35% Score & Chrono Shards.' },
    { id: 'glass_reactor', name: 'GLASS REACTOR', desc: 'Max Shield -30%, Hyper-Slash Damage +45%.' },
    { id: 'ricochet_protocol', name: 'RICOCHET PROTOCOL', desc: 'Start with Photon Ricochet Tier 1 and Chrono Matrix Tier 1.' },
    { id: 'tesla_storm', name: 'TESLA STORM', desc: 'Start with Tesla Arc Tier 2; EMP recharges 40% faster.' },
    { id: 'singularity_convergence', name: 'SINGULARITY CONVERGENCE', desc: 'Start with Singularity Core Tier 1; elite enemies spawn earlier.' }
  ];
  return {
    date: dateStr,
    dateStr,
    seed,
    recommendedCore: cores[seed % cores.length],
    modifier: modifiers[seed % modifiers.length]
  };
}

// Seed initial leaderboard records if empty so players have benchmark targets
function ensureSeedLeaderboard() {
  if (db.leaderboards.endless.length === 0) {
    db.leaderboards.endless = [
      {
        runId: 'seed-1',
        userId: 'system-1',
        displayName: 'KAELEN // VANGUARD',
        avatar: 'vanguard',
        score: 48500,
        wave: 16,
        survivalTime: 440,
        kills: 215,
        maxCombo: 28,
        styleRank: 'SSS',
        coreType: 'vanguard',
        skinId: 'omega_chronos',
        timestamp: Date.now() - 3600000 * 5
      },
      {
        runId: 'seed-2',
        userId: 'system-2',
        displayName: 'NYX // VOID REAPER',
        avatar: 'reaper',
        score: 34200,
        wave: 12,
        survivalTime: 310,
        kills: 164,
        maxCombo: 21,
        styleRank: 'SS',
        coreType: 'reaper',
        skinId: 'void_phantom',
        timestamp: Date.now() - 3600000 * 12
      },
      {
        runId: 'seed-3',
        userId: 'system-3',
        displayName: 'SERAPH // VALKYRIE',
        avatar: 'valkyrie',
        score: 22800,
        wave: 10,
        survivalTime: 245,
        kills: 118,
        maxCombo: 16,
        styleRank: 'S',
        coreType: 'valkyrie',
        skinId: 'solar_valkyrie',
        timestamp: Date.now() - 3600000 * 24
      }
    ];
    saveDatabase();
  }
}
ensureSeedLeaderboard();

// --- HTTP JSON HELPER ---
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// --- API ROUTER ---
async function handleApi(req, res) {
  const ip = req.socket.remoteAddress || '127.0.0.1';
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  const limit = checkRateLimit(ip, pathname.startsWith('/api/auth') ? 'auth' : 'api', pathname.startsWith('/api/auth') ? 25 : 120, 60000);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return sendJson(res, 429, { error: 'Too many requests. Please wait briefly and retry.' });
  }

  // 1. Health Check
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'chrono-surge-beginning',
      version: '2.0.0',
      schemaVersion: db.version,
      dailyChallenge: computeDailyChallengeConfig(),
      timestamp: Date.now()
    });
  }

  // 2. Daily Challenge Seed Info
  if (pathname === '/api/daily' && method === 'GET') {
    const dateStr = urlObj.searchParams.get('date') || getTodaySeedString();
    return sendJson(res, 200, computeDailyChallengeConfig(dateStr));
  }

  // 3. Auth: Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!/^[A-Za-z0-9_-]{3,20}$/.test(username)) {
        return sendJson(res, 400, { error: 'Username must be 3-20 characters (letters, numbers, _ or -).' });
      }
      if (password.length < 6 || password.length > 128) {
        return sendJson(res, 400, { error: 'Password must be between 6 and 128 characters.' });
      }

      const lower = username.toLowerCase();
      if (db.usernames[lower]) {
        return sendJson(res, 409, { error: 'Username is already registered.' });
      }

      const userId = crypto.randomUUID();
      const { salt, hash } = hashPassword(password);
      let profile = createDefaultProfile(userId, username.toUpperCase());
      if (body.guestProfile && typeof body.guestProfile === 'object') {
        profile = sanitizeAndMergeProfile(profile, body.guestProfile);
        profile.playerId = userId;
        profile.displayName = username.toUpperCase();
      }

      db.users[userId] = {
        id: userId,
        username,
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
        profile
      };
      db.usernames[lower] = userId;
      saveDatabase();

      const token = issueToken(userId, username);
      return sendJson(res, 201, {
        token,
        user: { id: userId, username },
        profile
      });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Invalid request' });
    }
  }

  // 4. Auth: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const lower = username.toLowerCase();
      const userId = db.usernames[lower];
      const user = userId ? db.users[userId] : null;

      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Invalid operative callsign or security key.' });
      }

      // Optional safe merge of guest progress on login
      if (body.guestProfile && typeof body.guestProfile === 'object') {
        user.profile = sanitizeAndMergeProfile(user.profile, body.guestProfile);
        user.profile.playerId = user.id;
        saveDatabase();
      }

      const token = issueToken(user.id, user.username);
      return sendJson(res, 200, {
        token,
        user: { id: user.id, username: user.username },
        profile: user.profile
      });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Invalid request' });
    }
  }

  // 5. Profile Get & Sync (Requires Auth, enforces owner isolation)
  if (pathname === '/api/profile' && method === 'GET') {
    const user = extractAuthUser(req);
    if (!user) return sendJson(res, 401, { error: 'Authentication required.' });
    return sendJson(res, 200, { user: { id: user.id, username: user.username }, profile: user.profile });
  }

  if (pathname === '/api/profile/sync' && (method === 'POST' || method === 'PUT')) {
    const user = extractAuthUser(req);
    if (!user) return sendJson(res, 401, { error: 'Authentication required for cloud save sync.' });
    try {
      const body = await readJsonBody(req);
      if (body.targetUserId && body.targetUserId !== user.id) {
        return sendJson(res, 403, { error: 'Forbidden: cannot modify another player profile.' });
      }
      user.profile = sanitizeAndMergeProfile(user.profile, body.profile || body);
      user.profile.playerId = user.id;
      saveDatabase();
      return sendJson(res, 200, { ok: true, status: 'synced', profile: user.profile });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Invalid profile data' });
    }
  }

  // 6. Leaderboard Fetch (Supports sorting by score, wave, survivalTime + mode=endless|daily + pagination)
  if (pathname === '/api/leaderboard' && method === 'GET') {
    const mode = urlObj.searchParams.get('mode') === 'daily' ? 'daily' : 'endless';
    const sortBy = ['score', 'wave', 'survivalTime'].includes(urlObj.searchParams.get('sortBy'))
      ? urlObj.searchParams.get('sortBy')
      : 'score';
    const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1', 10));
    const limitCount = Math.min(50, Math.max(5, parseInt(urlObj.searchParams.get('limit') || '20', 10)));
    const dateStr = urlObj.searchParams.get('date') || getTodaySeedString();

    let list = mode === 'daily' ? (db.leaderboards.daily[dateStr] || []) : (db.leaderboards.endless || []);
    list = [...list].sort((a, b) => {
      if (b[sortBy] !== a[sortBy]) return b[sortBy] - a[sortBy];
      if (b.score !== a.score) return b.score - a.score;
      if (b.wave !== a.wave) return b.wave - a.wave;
      return a.timestamp - b.timestamp; // Earlier achiever wins tie
    });

    const total = list.length;
    const offset = (page - 1) * limitCount;
    const entries = list.slice(offset, offset + limitCount).map((item, idx) => ({
      rank: offset + idx + 1,
      displayName: item.displayName,
      avatar: item.avatar,
      score: item.score,
      wave: item.wave,
      survivalTime: item.survivalTime,
      kills: item.kills,
      maxCombo: item.maxCombo,
      styleRank: item.styleRank,
      coreType: item.coreType,
      skinId: item.skinId,
      timestamp: item.timestamp
    }));

    return sendJson(res, 200, {
      mode,
      date: mode === 'daily' ? dateStr : null,
      sortBy,
      page,
      total,
      entries
    });
  }

  // 7. Authoritative Run & Leaderboard Submission
  if (pathname === '/api/runs' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const validation = validateRunSubmission(body);
      if (!validation.valid) {
        return sendJson(res, 400, { error: `Run rejected: ${validation.reason}` });
      }

      const entry = validation.sanitized;
      // Duplicate submission protection
      if (db.processedRuns[entry.runId]) {
        return sendJson(res, 200, { status: 'duplicate_ignored', entry, shardsEarned: 0 });
      }
      db.processedRuns[entry.runId] = Date.now();

      const authUser = extractAuthUser(req);
      if (authUser) {
        entry.userId = authUser.id;
        entry.displayName = authUser.profile.displayName || authUser.username.toUpperCase();
      } else {
        entry.userId = typeof body.playerId === 'string' ? body.playerId.slice(0, 36) : 'guest';
      }

      // Calculate authoritative rewards
      const shardsEarned = Math.floor(entry.wave * 18 + entry.kills * 1.5 + (entry.score / 800));
      const xpEarned = Math.floor(entry.wave * 45 + entry.kills * 4);

      if (authUser) {
        const p = authUser.profile;
        p.shards = (p.shards || 0) + shardsEarned;
        p.xp = (p.xp || 0) + xpEarned;
        p.level = Math.max(p.level || 1, 1 + Math.floor(Math.sqrt(p.xp / 120)));
        p.highestWave = Math.max(p.highestWave || 0, entry.wave);
        p.bestScore = Math.max(p.bestScore || 0, entry.score);
        p.longestSurvivalSec = Math.max(p.longestSurvivalSec || 0, entry.survivalTime);
        p.totalKills = (p.totalKills || 0) + entry.kills;
        p.completedRuns = (p.completedRuns || 0) + 1;
        p.runHistory = [entry, ...(p.runHistory || [])].slice(0, 20);
        p.updatedAt = Date.now();
      }

      if (entry.mode === 'daily') {
        const dateKey = entry.dailySeed || getTodaySeedString();
        if (!db.leaderboards.daily[dateKey]) db.leaderboards.daily[dateKey] = [];
        const list = db.leaderboards.daily[dateKey];
        const existingIdx = list.findIndex(r => r.userId === entry.userId && r.displayName === entry.displayName);
        if (existingIdx >= 0) {
          if (entry.score > list[existingIdx].score) list[existingIdx] = entry;
        } else {
          list.push(entry);
        }
        list.sort((a, b) => b.score - a.score);
        db.leaderboards.daily[dateKey] = list.slice(0, 100);
      } else {
        const list = db.leaderboards.endless;
        const existingIdx = list.findIndex(r => r.userId === entry.userId && r.displayName === entry.displayName);
        if (existingIdx >= 0) {
          if (entry.score > list[existingIdx].score || entry.wave > list[existingIdx].wave) {
            list[existingIdx] = {
              ...entry,
              score: Math.max(entry.score, list[existingIdx].score),
              wave: Math.max(entry.wave, list[existingIdx].wave),
              survivalTime: Math.max(entry.survivalTime, list[existingIdx].survivalTime)
            };
          }
        } else {
          list.push(entry);
        }
        list.sort((a, b) => b.score - a.score);
        db.leaderboards.endless = list.slice(0, 200);
      }

      saveDatabase();
      return sendJson(res, 201, {
        status: 'recorded',
        runId: entry.runId,
        shardsEarned,
        xpEarned,
        entry,
        profile: authUser ? authUser.profile : null
      });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Invalid run submission' });
    }
  }

  return sendJson(res, 404, { error: 'API endpoint not found' });
}

function serveFile(req, res) {
  if (req.url.startsWith('/api/')) {
    return handleApi(req, res);
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/chrono-surge-beginning.html') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Prevent path traversal outside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found - Chrono Surge: Beginning');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

function createAppServer() {
  return http.createServer(serveFile);
}

function startServer(port = PORT) {
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`\n=======================================================`);
    console.log(`  ⚡ CHRONO SURGE: BEGINNING // PRODUCTION SERVER ⚡`);
    console.log(`  Local & Mobile Arena URL: http://localhost:${port}`);
    console.log(`=======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, shifting to ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
  return server;
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = {
  createAppServer,
  startServer,
  validateRunSubmission,
  sanitizeAndMergeProfile,
  computeDailyChallengeConfig,
  createDefaultProfile,
  DB_SCHEMA_VERSION
};
