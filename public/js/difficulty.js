/* =========================================================================
   CHRONO SURGE: BEGINNING — PROGRESSIVE DIFFICULTY DIRECTOR
   Centralized, bounded, playtest-tunable combat scaling system.
   Supports browser and Node.js test environments.
   ========================================================================= */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DifficultyDirector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const DIFFICULTY_CONFIG = {
    // Enemy Archetype Introductions
    INTRODUCTIONS: {
      hunter: 1,    // Wave 1: Fast tracking basic drone
      orbiter: 4,   // Wave 4: Hexagonal orbiter firing circular waves
      dasher: 6,    // Wave 6: High-speed charging chevron
      phantom: 9,   // Wave 9: Teleporting crystal with splitting orbs
      boss: 10      // Wave 10, 20, 30...: Multi-phase Apex Overlord
    },

    // Bounded Stat Scaling Formulas
    SCALING: {
      // Enemy health: gentle linear early, strictly bounded late
      healthMult: (w) => {
        if (w <= 2) return 0.75 + (w - 1) * 0.10; // 0.75x -> 0.85x
        if (w <= 5) return 0.90 + (w - 3) * 0.05; // 0.90x -> 1.00x
        if (w <= 10) return 1.05 + (w - 6) * 0.05; // 1.05x -> 1.25x
        // Beyond wave 10: bounded logarithmic curve, max 2.85x at Wave 100
        return 1.25 + Math.min(1.60, Math.log10(1 + (w - 10) * 0.08) * 1.55);
      },

      // Enemy speed: slight increases capped at 1.25x to ensure evasion is always skill-viable
      speedMult: (w) => {
        if (w <= 2) return 0.82;
        if (w <= 5) return 0.92;
        if (w <= 10) return 1.0 + (w - 6) * 0.025; // 1.0x -> 1.10x
        return 1.10 + Math.min(0.15, (w - 10) * 0.003); // Max 1.25x
      },

      // Projectile speed: capped strictly at 1.30x so deflection timing remains consistent
      projectileSpeedMult: (w) => {
        if (w <= 2) return 0.80;
        if (w <= 5) return 0.90;
        if (w <= 10) return 1.0 + (w - 6) * 0.03;
        return 1.12 + Math.min(0.18, (w - 10) * 0.0035); // Max 1.30x
      },

      // Attack cooldown rate: capped at 1.35x
      attackFrequencyMult: (w) => {
        if (w <= 2) return 0.75;
        if (w <= 5) return 0.90;
        if (w <= 10) return 1.0 + (w - 6) * 0.04;
        return 1.16 + Math.min(0.19, (w - 10) * 0.004); // Max 1.35x
      },

      // Concurrent enemy cap on screen (prevents mobile slowdown and impossible wall-of-flesh)
      concurrentEnemyLimit: (w, isMobile = false) => {
        const mobPenalty = isMobile ? 4 : 0;
        if (w <= 2) return Math.max(3, 4 - mobPenalty);
        if (w <= 5) return Math.max(5, 7 - mobPenalty);
        if (w <= 10) return Math.max(8, 12 - mobPenalty);
        if (w <= 20) return Math.max(12, 18 - mobPenalty);
        return Math.max(16, Math.min(isMobile ? 18 : 24, 18 + Math.floor((w - 20) * 0.15)));
      },

      // Total enemies to spawn per wave
      totalWaveEnemies: (w) => {
        if (w === 1) return 3;   // Ultra-welcoming: 3 basic drones
        if (w === 2) return 5;   // 5 basic drones
        if (w === 3) return 8;   // 8 hunters
        if (w === 4) return 10;  // 8 hunters + 2 orbiters
        if (w === 5) return 12;  // 8 hunters + 4 orbiters
        if (w <= 10) {
          if (w === 10) return 1; // Boss wave
          return 12 + (w - 5) * 2; // 14, 16, 18, 20
        }
        if (w % 10 === 0) return 1; // Boss wave
        // Endless scaling capped at 38 enemies per wave
        return Math.min(38, 20 + Math.floor((w - 10) * 0.65));
      },

      // Elite enemy appearance rate
      eliteChance: (w) => {
        if (w < 4) return 0.0;
        if (w <= 6) return 0.06;
        if (w <= 10) return 0.12;
        if (w <= 20) return 0.18;
        return Math.min(0.28, 0.18 + (w - 20) * 0.003); // Max 28%
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
        return { hunter: 0.65, orbiter: 0.35 };
      }
      if (wave === 6) {
        return { hunter: 0.50, orbiter: 0.30, dasher: 0.20 };
      }
      if (wave <= 8) {
        return { hunter: 0.45, orbiter: 0.30, dasher: 0.25 };
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
          hpMult *= 0.85; // Slightly lower enemy HP to compensate for player fragility
        } else if (modId === 'singularity_convergence') {
          eliteChance = Math.min(0.40, eliteChance + 0.12);
        }
      }

      // Early waves: ensure low initial spawn queue and forgiving spawn intervals
      let initialSpawnCount = 0;
      let spawnInterval = 1.6;
      if (wave === 1) {
        initialSpawnCount = 2; // Spawn 2, then remaining 1 after delay
        spawnInterval = 2.4;
      } else if (wave === 2) {
        initialSpawnCount = 3;
        spawnInterval = 2.0;
      } else if (wave <= 5) {
        initialSpawnCount = Math.min(concurrentCap, 4);
        spawnInterval = 1.7;
      } else if (wave <= 10) {
        initialSpawnCount = Math.min(concurrentCap, 6);
        spawnInterval = 1.4;
      } else {
        initialSpawnCount = Math.min(concurrentCap, 8);
        spawnInterval = Math.max(0.85, 1.4 - Math.min(0.55, (wave - 10) * 0.02));
      }

      // Experience & Reward pacing:
      // In Waves 1-2, kill XP is calibrated so player reaches Level 2 by the end of Wave 1 or early Wave 2!
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
        isAnomaly: (wave >= 15 && wave % 5 === 0 && !isBoss),
        distribution: this.getArchetypeDistribution(wave)
      };
    }
  }

  return new DifficultyDirector();
});
