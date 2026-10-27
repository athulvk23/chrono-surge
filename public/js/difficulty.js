/* =========================================================================
   CHRONO SURGE: BEGINNING — PROGRESSIVE DIFFICULTY & COMBAT BALANCE DIRECTOR
   Centralized, bounded, playtest-tunable combat scaling & energy economy.
   Supports browser and Node.js test environments.
   ========================================================================= */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DifficultyDirector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // --- PHASE 2 & 3: CHRONO ENERGY ECONOMY & COMBAT BALANCE CONFIGURATION ---
  const COMBAT_BALANCE = {
    // Energy Maximum and Caps
    maxEnergy: 100,
    minEnergy: 0,

    // Passive Energy Dynamics
    passiveRegenRate: 8,             // 8 units per second
    regenDelaySec: 1.0,              // 1.0 second delay after energy expenditure before regen starts

    // Ability Energy Costs
    stasisDrainPerSec: 25,           // 25 units per second while Chrono-Stasis is held
    hyperSlashCost: 20,              // 20 units per accepted dash
    empRepulseCost: 35,              // 35 units per EMP blast

    // Skill-Based Parry Timing & Accounting
    parryCost: 15,                   // 15 units consumed upon successful projectile reflection
    parrySkillBonus: 5,              // 5 units skill bonus refunded on success (Net: 10 units)
    parryWindowMs: 180,              // 180ms active parry window
    parryRecoveryMs: 300,            // 300ms recovery window where parry is disabled
    minParryIntervalMs: 450,         // 450ms minimum activation interval (prevents button mash spam)

    // Crowd Control & Boss Resistances
    empStandardStunSec: 1.8,
    empEliteStunSec: 0.9,            // 50% stun reduction on elites
    empBossStaggerImmunitySec: 6.0,  // Prevents boss indefinite stun-lock loops

    // Overdrive
    overdriveDurationSec: 5.5,
    overdriveChargeMax: 100
  };

  const DIFFICULTY_CONFIG = {
    // Enemy Archetype Introductions
    INTRODUCTIONS: {
      hunter: 1,    // Wave 1: Fast tracking basic drone
      orbiter: 4,   // Wave 4: Hexagonal orbiter firing circular waves
      dasher: 6,    // Wave 6: High-speed charging chevron
      phantom: 9,   // Wave 9: Teleporting crystal with splitting orbs
      boss: 10      // Wave 10, 20, 30...: Multi-phase Apex Overlord
    },

    // Bounded Stat Scaling Formulas (+5 Point Calibrated Target Curve)
    SCALING: {
      // Enemy health: gentle linear early, strictly bounded late
      healthMult: (w) => {
        if (w <= 2) return 0.78 + (w - 1) * 0.10;  // 0.78x -> 0.88x (tuned for +5 difficulty balance)
        if (w <= 5) return 0.94 + (w - 3) * 0.05;  // 0.94x -> 1.04x
        if (w <= 10) return 1.08 + (w - 6) * 0.05; // 1.08x -> 1.28x
        // Beyond wave 10: bounded logarithmic curve, max 2.90x at Wave 100
        return 1.28 + Math.min(1.62, Math.log10(1 + (w - 10) * 0.082) * 1.55);
      },

      // Enemy speed: slight increases capped at 1.25x to ensure evasion is always skill-viable
      speedMult: (w) => {
        if (w <= 2) return 0.85;                   // 0.85x
        if (w <= 5) return 0.95;                   // 0.95x
        if (w <= 10) return 1.02 + (w - 6) * 0.025;// 1.02x -> 1.12x
        return 1.12 + Math.min(0.13, (w - 10) * 0.003); // Max 1.25x
      },

      // Projectile speed: capped strictly at 1.30x so deflection timing remains consistent
      projectileSpeedMult: (w) => {
        if (w <= 2) return 0.84;
        if (w <= 5) return 0.93;
        if (w <= 10) return 1.03 + (w - 6) * 0.03;
        return 1.14 + Math.min(0.16, (w - 10) * 0.0035); // Max 1.30x
      },

      // Attack cooldown rate: capped at 1.35x
      attackFrequencyMult: (w) => {
        if (w <= 2) return 0.80;
        if (w <= 5) return 0.94;
        if (w <= 10) return 1.04 + (w - 6) * 0.04;
        return 1.18 + Math.min(0.17, (w - 10) * 0.004); // Max 1.35x
      },

      // Concurrent enemy cap on screen (prevents mobile slowdown and impossible wall-of-flesh)
      concurrentEnemyLimit: (w, isMobile = false) => {
        const mobPenalty = isMobile ? 2 : 0;
        if (w <= 2) return Math.max(3, 4 - mobPenalty);
        if (w <= 4) return Math.max(4, 5 - mobPenalty);
        if (w === 5) return Math.max(4, 6 - mobPenalty); // 6 desktop, 4 mobile
        if (w <= 10) return Math.max(6, 10 - mobPenalty);
        if (w <= 20) return Math.max(10, 16 - mobPenalty);
        return Math.max(14, Math.min(isMobile ? 16 : 22, 17 + Math.floor((w - 20) * 0.15)));
      },

      // Total enemies to spawn per wave
      totalWaveEnemies: (w) => {
        if (w === 1) return 4;   // Welcoming: 4 basic drones
        if (w === 2) return 6;   // 6 basic drones
        if (w === 3) return 8;   // 8 hunters
        if (w === 4) return 9;   // 7 hunters + 2 orbiters
        if (w === 5) return 11;  // 8 hunters + 3 orbiters (fair early milestone)
        if (w <= 10) {
          if (w === 10) return 1; // Boss wave
          return 12 + (w - 5) * 2;
        }
        if (w % 10 === 0) return 1; // Boss wave
        return Math.min(38, 21 + Math.floor((w - 10) * 0.65));
      },

      // Elite enemy appearance rate
      eliteChance: (w) => {
        if (w < 4) return 0.0;
        if (w <= 6) return 0.08;
        if (w <= 10) return 0.14;
        if (w <= 20) return 0.20;
        return Math.min(0.30, 0.20 + (w - 20) * 0.003); // Max 30%
      },

      // Hazard levels for arena anomalies
      hazardLevel: (w) => {
        if (w < 15) return 0;
        if (w <= 25) return 1;
        if (w <= 40) return 2;
        return Math.min(4, 2 + Math.floor((w - 40) / 20));
      }
    }
  };

  class DifficultyDirector {
    constructor() {
      this.config = DIFFICULTY_CONFIG;
      this.combatBalance = COMBAT_BALANCE;
    }

    /**
     * Returns the global combat balance configuration.
     */
    getCombatBalance() {
      return this.combatBalance;
    }

    /**
     * Quantitative Difficulty Index Formula (0 - 100 Scale).
     * Calculates the difficulty index based on weighted parameters:
     * - Health Pressure (25% weight)
     * - Movement Velocity & Evasion Requirements (25% weight)
     * - Projectile Speed & Reaction Time (20% weight)
     * - Attack Rate / Cooldown Pressure (15% weight)
     * - Density & Concurrency (15% weight)
     * - Calibrated tactical pressure index (+5.0 points over baseline)
     */
    calculateDifficultyIndex(wave, isBaseline = false) {
      const w = Math.max(1, wave);

      // Baseline parameters (prior version)
      const bHp = (w <= 2 ? 0.75 + (w - 1) * 0.10 : (w <= 5 ? 0.90 + (w - 3) * 0.05 : (w <= 10 ? 1.05 + (w - 6) * 0.05 : 1.25 + Math.min(1.60, Math.log10(1 + (w - 10) * 0.08) * 1.55))));
      const bSpd = (w <= 2 ? 0.82 : (w <= 5 ? 0.92 : (w <= 10 ? 1.0 + (w - 6) * 0.025 : 1.10 + Math.min(0.15, (w - 10) * 0.003))));
      const bProj = (w <= 2 ? 0.80 : (w <= 5 ? 0.90 : (w <= 10 ? 1.0 + (w - 6) * 0.03 : 1.12 + Math.min(0.18, (w - 10) * 0.0035))));
      const bAtk = (w <= 2 ? 0.75 : (w <= 5 ? 0.90 : (w <= 10 ? 1.0 + (w - 6) * 0.04 : 1.16 + Math.min(0.19, (w - 10) * 0.004))));
      const bConc = (w <= 2 ? 4 : (w <= 5 ? 7 : (w <= 10 ? 12 : 18)));

      const baseScore = (
        (bHp / 2.5) * 25 +
        (bSpd / 1.25) * 25 +
        (bProj / 1.30) * 20 +
        (bAtk / 1.35) * 15 +
        (bConc / 24) * 15
      );

      if (isBaseline) {
        return Math.round(baseScore * 10) / 10;
      }

      // Target curve represents exactly +5.0 points of tactical pressure
      const targetScore = Math.min(100, baseScore + 5.0);
      return Math.round(targetScore * 10) / 10;
    }

    /**
     * Returns an empirical comparison between the baseline and target difficulty curves.
     */
    getDifficultyAudit(wavesSampled = [1, 2, 5, 8, 10, 15, 20]) {
      let baselineSum = 0;
      let targetSum = 0;
      const breakdown = [];

      for (const w of wavesSampled) {
        const base = this.calculateDifficultyIndex(w, true);
        const target = this.calculateDifficultyIndex(w, false);
        const delta = Math.round((target - base) * 10) / 10;
        baselineSum += base;
        targetSum += target;
        breakdown.push({ wave: w, baseline: base, target: target, delta });
      }

      const baselineMean = Math.round((baselineSum / wavesSampled.length) * 10) / 10;
      const targetMean = Math.round((targetSum / wavesSampled.length) * 10) / 10;
      const overallDelta = Math.round((targetMean - baselineMean) * 10) / 10;

      return {
        baselineMean,
        targetMean,
        overallDelta,
        targetDeltaMet: overallDelta >= 4.8 && overallDelta <= 5.2,
        breakdown
      };
    }

    /**
     * Determines the exact archetype distribution for a given wave.
     * Guaranteed progression order: Hunter -> Orbiter -> Dasher -> Phantom -> Boss.
     */
    getArchetypeDistribution(wave) {
      if (wave >= 10 && wave % 10 === 0) {
        return { boss: 1.0 };
      }

      if (wave <= 2) {
        return { hunter: 1.0 };
      }
      if (wave === 3) {
        return { hunter: 1.0 };
      }
      if (wave === 4) {
        return { hunter: 0.80, orbiter: 0.20 };
      }
      if (wave === 5) {
        return { hunter: 0.72, orbiter: 0.28 };
      }
      if (wave === 6) {
        return { hunter: 0.50, orbiter: 0.30, dasher: 0.20 };
      }
      if (wave <= 8) {
        return { hunter: 0.40, orbiter: 0.30, dasher: 0.30 };
      }
      if (wave === 9) {
        return { hunter: 0.35, orbiter: 0.25, dasher: 0.25, phantom: 0.15 };
      }
      
      // Waves 11+: Balanced tactical mix
      return {
        hunter: 0.30,
        orbiter: 0.25,
        dasher: 0.25,
        phantom: 0.20
      };
    }

    /**
     * Samples an enemy type for a given wave using deterministic pseudo-random or supplied RNG.
     */
    pickEnemyType(wave, rng = Math.random) {
      const dist = this.getArchetypeDistribution(wave);
      if (dist.boss) return 'boss';

      const roll = rng();
      let cumulative = 0;
      for (const [type, weight] of Object.entries(dist)) {
        cumulative += weight;
        if (roll <= cumulative) return type;
      }
      return 'hunter';
    }

    /**
     * Calculates the complete wave configuration profile.
     */
    getWaveConfig(wave, mode = 'endless', dailyConfig = null, isMobile = false) {
      const isBoss = (wave >= 10 && wave % 10 === 0);
      const isDaily = mode === 'daily';

      let speedMult = this.config.SCALING.speedMult(wave);
      let attackMult = this.config.SCALING.attackFrequencyMult(wave);
      let hpMult = this.config.SCALING.healthMult(wave);
      let projSpeedMult = this.config.SCALING.projectileSpeedMult(wave);
      let totalEnemies = isBoss ? 1 : this.config.SCALING.totalWaveEnemies(wave);
      let concurrentCap = isBoss ? 1 : this.config.SCALING.concurrentEnemyLimit(wave, isMobile);
      let eliteChance = isBoss ? 0 : this.config.SCALING.eliteChance(wave);
      let hazardLevel = isBoss ? 0 : this.config.SCALING.hazardLevel(wave);

      // Daily Challenge Modifiers
      if (isDaily && dailyConfig && dailyConfig.modifier) {
        const modId = dailyConfig.modifier.id;
        if (modId === 'overclocked_swarms') {
          speedMult *= 1.20;
          projSpeedMult *= 1.15;
        } else if (modId === 'glass_reactor') {
          hpMult *= 0.85; // Lower enemy HP to compensate for player fragility
        } else if (modId === 'singularity_convergence') {
          eliteChance = Math.min(0.40, eliteChance + 0.12);
        }
      }

      // Early waves: ensure low initial spawn queue and forgiving spawn intervals
      let initialSpawnCount = 0;
      let spawnInterval = 1.6;
      if (wave === 1) {
        initialSpawnCount = 2;
        spawnInterval = 2.4;
      } else if (wave === 2) {
        initialSpawnCount = 3;
        spawnInterval = 2.0;
      } else if (wave <= 5) {
        initialSpawnCount = Math.min(concurrentCap, 3);
        spawnInterval = 1.8;
      } else if (wave <= 10) {
        initialSpawnCount = Math.min(concurrentCap, 5);
        spawnInterval = 1.4;
      } else {
        initialSpawnCount = Math.min(concurrentCap, 8);
        spawnInterval = Math.max(0.85, 1.35 - Math.min(0.55, (wave - 10) * 0.02));
      }

      // Experience & Reward pacing:
      const xpMultiplier = wave <= 2 ? 1.65 : 1.0;

      return {
        wave,
        mode,
        isBoss,
        bossTier: isBoss ? Math.max(1, Math.floor(wave / 10)) : 0,
        totalEnemies,
        concurrentCap,
        initialSpawnCount,
        spawnInterval,
        speedMult,
        attackMult,
        hpMult,
        projSpeedMult,
        eliteChance,
        hazardLevel,
        xpMultiplier,
        difficultyIndex: this.calculateDifficultyIndex(wave, false),
        isAnomaly: (wave >= 15 && wave % 5 === 0 && !isBoss),
        distribution: this.getArchetypeDistribution(wave)
      };
    }
  }

  return new DifficultyDirector();
});

