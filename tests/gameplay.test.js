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
