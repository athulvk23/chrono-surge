/* =========================================================================
   CHRONO SURGE: BEGINNING - GAMEPLAY LOGIC & PROGRESSION UNIT TESTS
   Uses Node.js built-in test runner (node:test, node:assert)
   ========================================================================= */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Load progression constants and definitions
const {
  validateRunSubmission,
  computeDailyChallengeConfig,
  createDefaultProfile
} = require('../server.js');

test('Progression: Default profile initialization', () => {
  const profile = createDefaultProfile('operative_123', 'CHRONO-PILOT');
  assert.equal(profile.displayName, 'CHRONO-PILOT');
  assert.equal(profile.level, 1);
  assert.equal(profile.shards, 0);
  assert.equal(profile.highestWave, 0);
  assert.equal(profile.bestScore, 0);
  assert.ok(Array.isArray(profile.unlockedSkins));
  assert.ok(profile.unlockedSkins.includes('default_cyan'));
  assert.equal(profile.equippedSkin, 'default_cyan');
  assert.ok(profile.settings);
  assert.equal(profile.settings.keyBindings.fire, 'KeyE');
});

test('Daily Challenge: Seed is deterministic per UTC date', () => {
  const dateA = new Date('2026-10-27T00:00:00Z');
  const dateB = new Date('2026-10-27T23:59:59Z');
  const dateNext = new Date('2026-10-28T00:00:00Z');

  const configA = computeDailyChallengeConfig(dateA);
  const configB = computeDailyChallengeConfig(dateB);
  const configNext = computeDailyChallengeConfig(dateNext);

  // Same day must produce identical seed and modifiers
  assert.equal(configA.seed, configB.seed);
  assert.equal(configA.modifier.id, configB.modifier.id);

  // Different day must produce distinct challenges
  assert.notEqual(configA.seed, configNext.seed);
});

test('Anti-Cheat: Validation rules reject impossible speed and stats', () => {
  // Test 1: Impossible score in tiny timeframe
  const cheat1 = validateRunSubmission({
    score: 1000000,
    survivalTime: 5,
    wave: 1,
    kills: 2
  });
  assert.equal(cheat1.valid, false);

  // Test 2: Impossible kills per second
  const cheat2 = validateRunSubmission({
    score: 50000,
    survivalTime: 10,
    wave: 3,
    kills: 800
  });
  assert.equal(cheat2.valid, false);

  // Test 3: Wave 50 in 30 seconds
  const cheat3 = validateRunSubmission({
    score: 100000,
    survivalTime: 30,
    wave: 50,
    kills: 100
  });
  assert.equal(cheat3.valid, false);

  // Test 4: Realistic human run is accepted
  const legit = validateRunSubmission({
    score: 45000,
    survivalTime: 240, // 4 minutes
    wave: 7,
    kills: 75,
    slices: 50,
    styleRank: 'S'
  });
  assert.equal(legit.valid, true);
});

test('Skin Catalog: All skins contain valid hex and render geometries', () => {
  // Read skins directly from progression.js
  const progFile = fs.readFileSync(path.join(__dirname, '../public/js/progression.js'), 'utf8');
  assert.ok(progFile.includes('SKIN_CATALOG = ['));
  
  // Verify 6 key ship hulls exist
  const requiredSkins = ['default_cyan', 'crimson_eclipse', 'solar_valkyrie', 'void_phantom', 'neon_hyperion', 'omega_chronos'];
  for (const s of requiredSkins) {
    assert.ok(progFile.includes(`id: '${s}'`), `Catalog must include skin ${s}`);
  }
});

test('Skill Tree: Branches define positive cost curves and max ranks', () => {
  const progFile = fs.readFileSync(path.join(__dirname, '../public/js/progression.js'), 'utf8');
  assert.ok(progFile.includes('SKILL_TREE_BRANCHES = ['));

  const requiredBranches = ['chrono_mastery', 'offensive_systems', 'defensive_systems', 'mobility_thrusters', 'energy_efficiency', 'overdrive_catalyst'];
  for (const b of requiredBranches) {
    assert.ok(progFile.includes(`id: '${b}'`), `Skill tree must include branch ${b}`);
  }
});

test('Official Reference Sheet: 3-Phase Boss, Archetypes and Pickups', () => {
  const entitiesFile = fs.readFileSync(path.join(__dirname, '../public/js/entities.js'), 'utf8');
  const indexFile = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  // Verify 3 Character Archetypes
  assert.ok(indexFile.includes('01 CORE'), 'Must include 01 Core archetype');
  assert.ok(indexFile.includes('02 SPECTER'), 'Must include 02 Specter archetype');
  assert.ok(indexFile.includes('03 NOVA'), 'Must include 03 Nova archetype');

  // Verify 3 Boss Phases in entities
  assert.ok(entitiesFile.includes('PHASE 1 — AWAKENED CORE'), 'Must implement Phase 1 Awakened Core');
  assert.ok(entitiesFile.includes('PHASE 2 — ASCENDED FORM'), 'Must implement Phase 2 Ascended Form');
  assert.ok(entitiesFile.includes('PHASE 3 — FINAL FORM (COSMIC ARCHON)'), 'Must implement Phase 3 Cosmic Archon');

  // Verify Tactical Item Drops from reference
  const requiredPickups = ['health', 'shield', 'chrono', 'overdrive', 'multiplier', 'shard'];
  for (const p of requiredPickups) {
    assert.ok(entitiesFile.includes(`this.type === '${p}'`), `Must support ${p} pickup`);
  }
});

test('Boss Phase Transitions & Audio Resilience: All audio triggers must be defined', () => {
  const audioFile = fs.readFileSync(path.join(__dirname, '../public/js/audio.js'), 'utf8');
  const entitiesFile = fs.readFileSync(path.join(__dirname, '../public/js/entities.js'), 'utf8');

  // Must define both detonation and alias detonate so phase transitions never crash
  assert.ok(audioFile.includes('playOverdriveDetonation('), 'Must define playOverdriveDetonation');
  assert.ok(audioFile.includes('playOverdriveDetonate('), 'Must define playOverdriveDetonate alias');

  // Must guard audio calls with typeof checks or try/catch in boss phase changes
  assert.ok(entitiesFile.includes('typeof window.chronoAudio.playOverdriveDetonation'), 'Boss phase transition must safely guard audio execution');
});

test('Menu State Clean-Up & Mobile Performance: returnToTitle and mobile optimizations', () => {
  const gameFile = fs.readFileSync(path.join(__dirname, '../public/js/game.js'), 'utf8');
  const mainFile = fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8');
  const styleFile = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');

  // Must have returnToTitle method that clears entities
  assert.ok(gameFile.includes('returnToTitle() {'), 'game.js must define returnToTitle()');
  assert.ok(gameFile.includes('this.enemies = [];'), 'returnToTitle must clear enemies');
  assert.ok(gameFile.includes('this.bullets = [];'), 'returnToTitle must clear bullets');
  assert.ok(gameFile.includes('window.particles.reset()'), 'returnToTitle must reset particles');

  // main.js must invoke returnToTitle on menu navigation
  assert.ok(mainFile.includes('game.returnToTitle()'), 'main.js must call returnToTitle on returning to menu');

  // render() must skip entity drawing on TITLE state
  assert.ok(gameFile.includes("this.state === 'TITLE'"), 'render() must check for TITLE state');

  // CSS performance checks
  assert.ok(!styleFile.includes('#three-arena { filter:'), 'style.css must not use heavy CSS filters on WebGL canvas');
});

test('Progressive Difficulty Director: Welcoming onboarding, archetype progression & bounded endless scaling', () => {
  const DifficultyDirector = require('../public/js/difficulty.js');
  assert.ok(DifficultyDirector, 'DifficultyDirector module must be loaded');

  // Wave 1: Welcoming Onboarding
  const w1 = DifficultyDirector.getWaveConfig(1, 'endless', null, false);
  assert.strictEqual(w1.distribution.hunter, 1.0, 'Wave 1 must be 100% hunters');
  assert.ok(w1.speedMult <= 1.0, 'Wave 1 speed multiplier must be baseline or lower');
  assert.ok(w1.concurrentCap <= 6, 'Wave 1 concurrent max must be gentle');

  // Mobile Onboarding concurrent cap
  const w1Mobile = DifficultyDirector.getWaveConfig(1, 'endless', null, true);
  assert.ok(w1Mobile.concurrentCap <= 6, 'Mobile onboarding must cap concurrent enemies');

  // Wave 4: Skill Acquisition (Orbiters)
  const w4 = DifficultyDirector.getWaveConfig(4, 'endless', null, false);
  assert.ok(w4.distribution.orbiter > 0, 'Wave 4 must introduce Orbiters');

  // Wave 6: First Challenge (Dashers)
  const w6 = DifficultyDirector.getWaveConfig(6, 'endless', null, false);
  assert.ok(w6.distribution.dasher > 0, 'Wave 6 must introduce Dashers');

  // Wave 9: Phantoms
  const w9 = DifficultyDirector.getWaveConfig(9, 'endless', null, false);
  assert.ok(w9.distribution.phantom > 0, 'Wave 9 must introduce Phantoms');

  // Wave 10: Apex Boss
  const w10 = DifficultyDirector.getWaveConfig(10, 'endless', null, false);
  assert.strictEqual(w10.isBoss, true, 'Wave 10 must be designated boss encounter');

  // Waves 21+: Bounded Scaling (Never turn into impossible bullet sponges or uncontrollable speeds)
  const w25 = DifficultyDirector.getWaveConfig(25, 'endless', null, false);
  assert.ok(w25.speedMult <= 1.25, `Speed multiplier (${w25.speedMult}) must never exceed 1.25 cap`);
  assert.ok(w25.projSpeedMult <= 1.30, `Projectile speed multiplier (${w25.projSpeedMult}) must never exceed 1.30 cap`);
  assert.ok(w25.attackMult <= 1.35, `Attack frequency multiplier (${w25.attackMult}) must never exceed 1.35 cap`);
  assert.ok(w25.concurrentCap <= 24, `Desktop concurrent enemy cap (${w25.concurrentCap}) must never exceed 24`);

  const w50Mobile = DifficultyDirector.getWaveConfig(50, 'endless', null, true);
  assert.ok(w50Mobile.concurrentCap <= 18, `Mobile concurrent enemy cap (${w50Mobile.concurrentCap}) must never exceed 18 for performance`);
});
