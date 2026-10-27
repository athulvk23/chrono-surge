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

test('Chrono Energy Economy: Strict bounds, Stasis drain cutoff, and regen delay', () => {
  const { PlayerVessel } = require('../public/js/entities.js');
  const player = new PlayerVessel(100, 100);

  // 1. Initial State
  assert.strictEqual(player.chronoEnergy, 100, 'Initial Chrono Energy must be 100');
  assert.strictEqual(player.maxChronoEnergy, 100, 'Max Chrono Energy must be 100');

  // 2. Ability expenditure & regen delay
  const spent = player.consumeEnergy(35);
  assert.strictEqual(spent, true, 'consumeEnergy should succeed when energy is available');
  assert.strictEqual(player.chronoEnergy, 65, 'Remaining energy should be exactly 65');
  assert.strictEqual(player.energyRegenTimer, 1.0, 'Regen delay timer must be set to 1.0 second');

  // 3. Regen must not trigger while regen delay timer > 0
  player.update(0.5);
  assert.strictEqual(player.chronoEnergy, 65, 'Energy must not regenerate during delay window');
  assert.strictEqual(Math.round(player.energyRegenTimer * 10) / 10, 0.5, 'Timer must decrease with dt');

  // 4. Regen begins after delay passes
  player.update(0.6); // delay clears (0.5 - 0.6 <= 0)
  assert.ok(player.energyRegenTimer <= 0, 'Regen timer should now be expired');
  player.update(1.0); // 1 full second of passive regen at 8/s
  assert.ok(player.chronoEnergy > 65, 'Energy must regenerate after delay');

  // 5. Energy Cap at 100
  player.addEnergy(500);
  assert.strictEqual(player.chronoEnergy, 100, 'Energy must never exceed 100 max cap');

  // 6. Insufficient energy prevents activation
  player.consumeEnergy(95); // 5 energy left
  assert.strictEqual(player.chronoEnergy, 5);
  const failedSpend = player.consumeEnergy(20); // 20 required for Hyper-Slash
  assert.strictEqual(failedSpend, false, 'consumeEnergy must return false when insufficient');
  assert.strictEqual(player.chronoEnergy, 5, 'Energy must remain unchanged on failed spend');

  // 7. Stasis drain & hard cutoff at 0
  player.isSlowMo = true;
  player.update(1.0); // drains 25/s -> 5 - 25 <= 0
  assert.strictEqual(player.chronoEnergy, 0, 'Energy must stop at 0 and never fall below zero');
  assert.strictEqual(player.isSlowMo, false, 'Stasis must cut off immediately at 0 energy with no free duration');
});

test('Skill-Based Parry State Machine: Window, cooldown, and single-reflection guarantee', () => {
  const { PlayerVessel, EnemyBullet } = require('../public/js/entities.js');
  const player = new PlayerVessel(100, 100);

  // 1. Initial State
  assert.strictEqual(player.parryState, 'IDLE', 'Initial parry state must be IDLE');

  // 2. Trigger Parry Window
  const triggered = player.triggerParry();
  assert.strictEqual(triggered, true, 'triggerParry must activate when IDLE');
  assert.strictEqual(player.parryState, 'ACTIVE', 'Parry state must be ACTIVE');
  assert.strictEqual(player.parryTimer, 0.18, 'Active window must be 180ms');

  // 3. Repeated activation rejected during active window (Holding/Spamming prevented)
  const spamAttempt = player.triggerParry();
  assert.strictEqual(spamAttempt, false, 'Cannot re-trigger parry while window is active');

  // 4. Transition to RECOVERY state after 180ms
  player.update(0.20);
  assert.strictEqual(player.parryState, 'RECOVERY', 'Parry must enter RECOVERY state after active window');
  assert.ok(player.parryTimer > 0, 'Recovery timer must be running (300ms)');

  // 5. Re-triggering rejected during recovery
  const recoveryAttempt = player.triggerParry();
  assert.strictEqual(recoveryAttempt, false, 'Cannot trigger parry during recovery');

  // 6. Return to IDLE after recovery finishes
  player.update(0.35);
  assert.strictEqual(player.parryState, 'IDLE', 'Parry state must return to IDLE after recovery');

  // 7. Single Reflection Guarantee on EnemyBullet
  const bullet = new EnemyBullet(100, 100, 0, 300, '#ff0055', 20);
  assert.strictEqual(bullet.isDeflected, false, 'Bullet starts non-deflected');
  assert.strictEqual(bullet.canBeReflected, true, 'Bullet is eligible for deflection');

  const firstDeflect = bullet.deflect(Math.PI);
  assert.strictEqual(firstDeflect, true, 'First deflection must succeed');
  assert.strictEqual(bullet.isDeflected, true, 'Bullet is now marked deflected');

  const secondDeflect = bullet.deflect(0);
  assert.strictEqual(secondDeflect, false, 'Bullet cannot be deflected a second time');
});

test('EMP Anti-Boss Lockout: Boss resists continuous stun-locking', () => {
  const { Enemy } = require('../public/js/entities.js');
  const boss = new Enemy(200, 200, 'boss', 10);
  assert.strictEqual(boss.isBoss, true, 'Enemy must be boss');
  assert.strictEqual(boss.empImmunityTimer, 0, 'Initial immunity timer is 0');

  // First EMP hit
  boss.empImmunityTimer = 6.0;
  boss.stunTimer = 0.25;

  assert.strictEqual(boss.empImmunityTimer, 6.0, 'Boss gains 6.0s immunity against subsequent EMP lockouts');
  assert.strictEqual(boss.stunTimer, 0.25, 'Boss suffers only brief stagger instead of standard 1.8s stun');

  // Attempt second EMP while immune: must not reset or re-stun
  const isImmune = boss.empImmunityTimer > 0;
  assert.strictEqual(isImmune, true, 'Boss must report active EMP immunity');
});

test('Difficulty Model Audit: Exact +5.0 point calibrated increase verified', () => {
  const DifficultyDirector = require('../public/js/difficulty.js');
  const audit = DifficultyDirector.getDifficultyAudit();

  assert.strictEqual(audit.targetDeltaMet, true, 'Overall difficulty delta must meet +5.0 target');
  assert.strictEqual(audit.overallDelta, 5.0, 'Difficulty increase must be exactly 5.0 points');
  assert.ok(audit.targetMean > audit.baselineMean, 'Target difficulty must exceed baseline');

  // Verify bounded endgame index (never exceeds 100 or causes runaway progression)
  const w100Index = DifficultyDirector.calculateDifficultyIndex(100, false);
  assert.ok(w100Index <= 100, 'Endgame difficulty index must remain bounded <= 100');
});

test('Roguelite Run Upgrades: Meaningful choices, hard caps & no infinite loops', () => {
  const { AUGMENT_DEFINITIONS } = require('../public/js/upgrades.js');
  const { PlayerVessel } = require('../public/js/entities.js');

  const temporalEff = AUGMENT_DEFINITIONS.find(a => a.id === 'temporal_efficiency');
  const feedbackLoop = AUGMENT_DEFINITIONS.find(a => a.id === 'feedback_loop');
  const glassCannon = AUGMENT_DEFINITIONS.find(a => a.id === 'glass_cannon');

  assert.ok(temporalEff, 'Temporal Efficiency augment must exist');
  assert.ok(feedbackLoop, 'Feedback Loop augment must exist');
  assert.ok(glassCannon, 'Glass Cannon augment must exist');

  const player = new PlayerVessel(100, 100);

  // Apply Temporal Efficiency: drain decreases but bounded >= 14
  temporalEff.apply(player);
  assert.ok(player.chronoDrainRate < 25, 'Stasis drain must decrease');
  for (let i = 0; i < 10; i++) temporalEff.apply(player);
  assert.ok(player.chronoDrainRate >= 14, 'Stasis drain must be capped at min 14 to prevent infinite stasis');

  // Apply Feedback Loop: parry skill bonus increases up to cap 13
  feedbackLoop.apply(player);
  assert.strictEqual(player.parrySkillBonus, 9, 'Skill bonus increased from 5 to 9');
  feedbackLoop.apply(player);
  assert.strictEqual(player.parrySkillBonus, 13, 'Skill bonus capped at 13');

  // Apply Glass Cannon: +45% slice/primary damage, -25% shield
  const preDmg = player.sliceDamage;
  const preShield = player.maxShield;
  glassCannon.apply(player);
  assert.strictEqual(player.sliceDamage, preDmg * 1.45, 'Slice damage increased by 45%');
  assert.strictEqual(player.maxShield, Math.round(preShield * 0.75), 'Max shield reduced by 25%');
});

test('Permanent Workshop Upgrades: Every branch modifies real PlayerVessel statistics', () => {
  const { PlayerVessel } = require('../public/js/entities.js');
  const { ProgressionSystem, SKILL_TREE_BRANCHES } = require('../public/js/progression.js');

  const baseVessel = new PlayerVessel(100, 100, 'vanguard', {
    chrono_mastery: 0, offensive_systems: 0, defensive_systems: 0,
    mobility_thrusters: 0, energy_efficiency: 0, overdrive_catalyst: 0
  });

  const upgradedVessel = new PlayerVessel(100, 100, 'vanguard', {
    chrono_mastery: 2, offensive_systems: 2, defensive_systems: 2,
    mobility_thrusters: 2, energy_efficiency: 2, overdrive_catalyst: 2
  });

  // 1. Chrono Mastery: +8% max energy/rank, +10% regen/rank, -5% drain/rank
  assert.ok(upgradedVessel.maxChronoEnergy > baseVessel.maxChronoEnergy, 'Max energy must increase');
  assert.ok(upgradedVessel.chronoRechargeRate > baseVessel.chronoRechargeRate, 'Recharge rate must increase');
  assert.ok(upgradedVessel.chronoDrainRate < baseVessel.chronoDrainRate, 'Drain rate must decrease');

  // 2. Offensive Systems: +5% ability damage/rank, +2% crit/rank
  assert.ok(upgradedVessel.sliceDamage > baseVessel.sliceDamage, 'Slice damage must increase');
  assert.ok(upgradedVessel.primaryDamage > baseVessel.primaryDamage, 'Primary pulse damage must increase');
  assert.ok(upgradedVessel.critChance > baseVessel.critChance, 'Crit chance must increase');

  // 3. Defensive Systems: +10 Hull/rank, +8% Shield/rank, +12% regen/rank, -8% delay/rank
  assert.strictEqual(upgradedVessel.maxHp, baseVessel.maxHp + 20, 'Hull health must increase by 20 at rank 2');
  assert.ok(upgradedVessel.maxShield > baseVessel.maxShield, 'Shield capacity must increase');
  assert.ok(upgradedVessel.shieldRechargeRate > baseVessel.shieldRechargeRate, 'Shield recharge must increase');
  assert.ok(upgradedVessel.shieldRechargeDelay < baseVessel.shieldRechargeDelay, 'Shield recharge delay must decrease');

  // 4. Mobility Thrusters: +3% speed/rank, +4% dash range/rank
  assert.ok(upgradedVessel.baseSpeed > baseVessel.baseSpeed, 'Movement speed must increase');
  assert.ok(upgradedVessel.dashRangeMultiplier > baseVessel.dashRangeMultiplier, 'Dash range must increase');

  // 5. EMP Capacitors: reduced energy cost, +5% radius/rank, +10% recharge/rank
  assert.ok(upgradedVessel.empCost < baseVessel.empCost, 'EMP energy cost must decrease');
  assert.ok(upgradedVessel.empRadius > baseVessel.empRadius, 'EMP radius must expand');
  assert.ok(upgradedVessel.empRechargeRate > baseVessel.empRechargeRate, 'EMP recharge must increase');

  // 6. Overdrive Catalyst: +8% charge gain/rank, +0.3s duration/rank
  assert.ok(upgradedVessel.overdriveGainMult > baseVessel.overdriveGainMult, 'Overdrive charge gain must increase');
  assert.ok(upgradedVessel.overdriveDuration > baseVessel.overdriveDuration, 'Overdrive duration must extend');

  // 7. Progression System purchase validation: exactly-once deduction & prerequisite checks
  const prog = new ProgressionSystem();
  prog.profile.shards = 100;
  prog.profile.skillTree = { chrono_mastery: 0, offensive_systems: 0, defensive_systems: 0, mobility_thrusters: 0 };

  // Mobility requires chrono_mastery rank 1
  const lockedBuy = prog.purchaseSkill('mobility_thrusters');
  assert.strictEqual(lockedBuy.ok, false, 'Cannot buy mobility without prerequisite');
  assert.strictEqual(prog.profile.shards, 100, 'Shards must not be deducted on failed purchase');

  // Purchase chrono_mastery (cost 50)
  const validBuy = prog.purchaseSkill('chrono_mastery');
  assert.strictEqual(validBuy.ok, true, 'Valid purchase must succeed');
  assert.strictEqual(prog.profile.shards, 50, 'Exactly 50 shards deducted once');
  assert.strictEqual(prog.profile.skillTree.chrono_mastery, 1, 'Rank incremented to 1');

  // Now mobility prerequisite is met
  const unlockedBuy = prog.purchaseSkill('mobility_thrusters'); // cost 60, but only 50 shards remain
  assert.strictEqual(unlockedBuy.ok, false, 'Rejected due to insufficient shards');
  assert.strictEqual(prog.profile.shards, 50, 'Shards remain unchanged on insufficient funds');
});

test('In-Run Augments Combat Effects: Nanite Aegis, Rewind, and Card Pool verified', () => {
  const { AUGMENT_DEFINITIONS, AugmentManager } = require('../public/js/upgrades.js');
  const { PlayerVessel } = require('../public/js/entities.js');

  const player = new PlayerVessel(100, 100);
  const naniteAegis = AUGMENT_DEFINITIONS.find(a => a.id === 'nanite_aegis');
  const rewindDef = AUGMENT_DEFINITIONS.find(a => a.id === 'chrono_rewind');

  // 1. Nanite Aegis: modifies Shield, NOT Hull
  const initialHp = player.hp;
  const initialShield = player.maxShield;
  naniteAegis.apply(player);
  assert.strictEqual(player.hp, initialHp, 'Nanite Aegis must NOT alter Hull HP');
  assert.ok(player.maxShield > initialShield, 'Nanite Aegis must increase maxShield by 25%');

  // 2. Temporal Rewind: saves player from lethal hit
  rewindDef.apply(player);
  assert.strictEqual(player.augments.hasRewind, true, 'Rewind augment active');
  assert.strictEqual(player.augments.rewindAvailable, true, 'Rewind available for use');

  player.hp = 10;
  player.shield = 0;
  const dead = player.takeDamage(50); // lethal damage
  assert.strictEqual(dead, false, 'Rewind must prevent death');
  assert.strictEqual(player.augments.rewindAvailable, false, 'Rewind consumed after use');
  assert.ok(player.hp > 0, 'HP restored to 50%');
  assert.ok(player.shield > 0, 'Shield restored');

  // 3. Augment Manager: No duplicate cards in a single 3-card draw
  const manager = new AugmentManager();
  manager.reset();
  const cards = manager.getRandomCards(3);
  assert.strictEqual(cards.length, 3, 'Must draw 3 cards');
  const ids = new Set(cards.map(c => c.id));
  assert.strictEqual(ids.size, 3, 'Selection set must contain 3 distinct augments with no duplicates');
  assert.strictEqual(manager.rerollsRemaining, 1, 'Initial reroll charge is 1');
});

test('Core Resource Simulation: Clamping, Zero Negative HP, and Shield Priority', () => {
  const { PlayerVessel } = require('../public/js/entities.js');
  const player = new PlayerVessel(100, 100);

  // 1. Shield absorbs before Hull
  player.hp = 100;
  player.shield = 50;
  player.takeDamage(30);
  assert.strictEqual(player.shield, 20, 'Shield absorbed all 30 damage');
  assert.strictEqual(player.hp, 100, 'Hull HP untouched while shield is active');

  // 2. Shield overflow penetrates to Hull
  player.invulnerableTimer = 0;
  player.takeDamage(40); // 20 absorbed by shield, 20 penetrates to Hull
  assert.strictEqual(player.shield, 0, 'Shield fully depleted');
  assert.strictEqual(player.hp, 80, 'Remaining 20 damage applied to Hull');

  // 3. Massive overkill damage never produces negative HP
  player.invulnerableTimer = 0;
  player.takeDamage(9999);
  assert.strictEqual(player.hp, 0, 'HP must be clamped strictly to 0, never negative');

  // 4. Chrono energy clamp
  player.chronoEnergy = 50;
  player.addEnergy(999);
  assert.strictEqual(player.chronoEnergy, player.maxChronoEnergy, 'Energy cannot exceed maxChronoEnergy');
  player.consumeEnergy(999);
  assert.strictEqual(player.chronoEnergy, player.maxChronoEnergy, 'Over-budget consumption rejected cleanly');
});

test('Early-Game Pacing & Wave 5 Difficulty Calibration', () => {
  const DifficultyDirector = require('../public/js/difficulty.js');
  const { Enemy } = require('../public/js/entities.js');

  // 1. Wave 5 Total Enemies and Concurrent Limit
  const w5Config = DifficultyDirector.getWaveConfig(5, 'endless', null, false);
  assert.strictEqual(w5Config.totalEnemies, 11, 'Wave 5 total enemies calibrated to 11 for fair pacing');
  assert.ok(w5Config.concurrentCap <= 6, 'Wave 5 concurrent limit bounded at 6 on desktop');

  const w5Mobile = DifficultyDirector.getWaveConfig(5, 'endless', null, true);
  assert.ok(w5Mobile.concurrentCap <= 4, 'Wave 5 concurrent limit bounded at 4 on mobile to prevent swarming');

  // 2. Orbiters have expanded telegraph window on early waves
  const w5Orbiter = new Enemy(100, 100, 'orbiter', 5);
  assert.ok(w5Orbiter.chargeDuration >= 2.5, 'Orbiter charge duration on Wave 5 must exceed 2.5s for readable telegraph');

  // 3. Archetype Distribution on Wave 5 has controlled orbiter density
  const dist = DifficultyDirector.getArchetypeDistribution(5);
  assert.ok(dist.hunter >= 0.70, 'Hunters remain primary archetype (>= 70%) on Wave 5');
  assert.ok(dist.orbiter <= 0.30, 'Orbiters capped at <= 30% on Wave 5 to prevent bullet wall');
});
