/* =========================================================
   CHRONO SURGE // OVERDRIVE - ROGUELITE AUGMENT DECK
   ========================================================= */

const AUGMENT_DEFINITIONS = [
  {
    id: 'quantum_echo',
    name: 'QUANTUM ECHO',
    rarity: 'epic',
    icon: '⚡',
    desc: 'Hyper-dashes leave a chronal phantom trail that re-slices enemies for 70% damage after 0.5s.',
    maxTier: 3,
    apply: (player) => {
      player.augments.quantumEcho = (player.augments.quantumEcho || 0) + 1;
    }
  },
  {
    id: 'tesla_arc',
    name: 'TESLA ARC',
    rarity: 'rare',
    icon: '⚡',
    desc: 'Each sliced enemy discharges a chain lightning bolt into up to 3 nearby anomalies.',
    maxTier: 3,
    apply: (player) => {
      player.augments.teslaArc = (player.augments.teslaArc || 0) + 1;
    }
  },
  {
    id: 'singularity_pulse',
    name: 'SINGULARITY CORE',
    rarity: 'epic',
    icon: '🌀',
    desc: 'Dashing spawns a gravitational micro-singularity along your path, pulling anomalies into the blade.',
    maxTier: 2,
    apply: (player) => {
      player.augments.singularity = (player.augments.singularity || 0) + 1;
    }
  },
  {
    id: 'photon_ricochet',
    name: 'PHOTON RICOCHET',
    rarity: 'rare',
    icon: '💠',
    desc: 'Dashing bounces off arena perimeter walls up to 2 times, extending kinetic slice trajectory!',
    maxTier: 2,
    apply: (player) => {
      player.augments.ricochet = (player.augments.ricochet || 0) + 1;
    }
  },
  {
    id: 'chrono_matrix',
    name: 'CHRONO MATRIX',
    rarity: 'common',
    icon: '⏳',
    desc: 'Time-dilation meter drains 40% slower and regenerates 50% faster.',
    maxTier: 3,
    apply: (player) => {
      player.chronoDrainRate *= 0.65;
      player.chronoRechargeRate *= 1.4;
    }
  },
  {
    id: 'shatter_nova',
    name: 'SHATTER NOVA',
    rarity: 'rare',
    icon: '💥',
    desc: 'Deflecting enemy projectiles unleashes an explosive shockwave that clears nearby bullets.',
    maxTier: 3,
    apply: (player) => {
      player.augments.shatterNova = (player.augments.shatterNova || 0) + 1;
    }
  },
  {
    id: 'blade_overclock',
    name: 'BLADE OVERCLOCK',
    rarity: 'common',
    icon: '🗡️',
    desc: '+40% Hyper-slash cutting width and +25% slice damage.',
    maxTier: 3,
    apply: (player) => {
      player.sliceWidth *= 1.35;
      player.sliceDamage *= 1.25;
    }
  },
  {
    id: 'nanite_aegis',
    name: 'NANITE AEGIS',
    rarity: 'common',
    icon: '🛡️',
    desc: 'Instantly repairs 40% shield and permanently increases maximum shield capacity by 25%.',
    maxTier: 4,
    apply: (player) => {
      player.maxHp *= 1.25;
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    }
  },
  {
    id: 'overdrive_surge',
    name: 'OVERDRIVE SURGE',
    rarity: 'legendary',
    icon: '👑',
    desc: 'Reaching Style Rank S triggers Overdrive Mode: +100% score gains and invincible dash frames.',
    maxTier: 1,
    apply: (player) => {
      player.augments.overdriveSurge = true;
    }
  },
  {
    id: 'emp_supercharge',
    name: 'REPULSE OVERLOAD',
    rarity: 'rare',
    icon: '🔮',
    desc: 'EMP Repulse recharge speed +50%, and radius is expanded by 40%.',
    maxTier: 2,
    apply: (player) => {
      player.empRechargeRate *= 1.5;
      player.empRadius *= 1.4;
    }
  },
  {
    id: 'chrono_rewind',
    name: 'TEMPORAL REWIND',
    rarity: 'legendary',
    icon: '🔄',
    desc: 'Fatal damage rewinds the core 2 seconds into the past, granting 3s invulnerability. (Once per run)',
    maxTier: 1,
    apply: (player) => {
      player.augments.hasRewind = true;
      player.augments.rewindAvailable = true;
    }
  }
];

class AugmentManager {
  constructor() {
    this.activeAugments = new Map(); // id -> tier
    this.rerollsRemaining = 1;
  }

  reset() {
    this.activeAugments.clear();
    this.rerollsRemaining = 1;
  }

  getRandomCards(count = 3) {
    // Endless runs must never run out of choices. Once every anomaly reaches
    // its designed cap, mastered anomalies become repeatable "mastery" picks
    // instead of leaving the player stuck on an empty augment screen.
    let available = AUGMENT_DEFINITIONS.filter(aug => {
      const currentTier = this.activeAugments.get(aug.id) || 0;
      return currentTier < aug.maxTier;
    });

    if (available.length < count) {
      const mastered = AUGMENT_DEFINITIONS.filter(aug => {
        const currentTier = this.activeAugments.get(aug.id) || 0;
        return currentTier >= aug.maxTier;
      });
      available = [...available, ...mastered];
    }

    if (available.length === 0) {
      available = [...AUGMENT_DEFINITIONS];
    }

    if (available.length <= count) {
      return [...available];
    }

    // Weighted random selection by rarity
    const weights = { common: 60, rare: 28, epic: 10, legendary: 2 };
    const selected = [];
    const pool = [...available];

    while (selected.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, item) => sum + (weights[item.rarity] || 20), 0);
      let rand = Math.random() * totalWeight;
      let chosenIdx = 0;

      for (let i = 0; i < pool.length; i++) {
        rand -= weights[pool[i].rarity] || 20;
        if (rand <= 0) {
          chosenIdx = i;
          break;
        }
      }

      selected.push(pool[chosenIdx]);
      pool.splice(chosenIdx, 1);
    }

    return selected;
  }

  applyAugment(augId, player) {
    const def = AUGMENT_DEFINITIONS.find(a => a.id === augId);
    if (!def) return;

    const previousTier = this.activeAugments.get(augId) || 0;
    const currentTier = previousTier + 1;
    this.activeAugments.set(augId, currentTier);

    if (previousTier < def.maxTier) {
      // Normal tier: apply the designed upgrade.
      def.apply(player);
    } else {
      // Endless mastery: do NOT repeatedly multiply the original effect.
      // Instead grant a small universal bonus so late-game choices remain
      // useful without becoming runaway power spikes.
      player.anomalyMastery = (player.anomalyMastery || 0) + 1;
      const mastery = player.anomalyMastery;
      const baseSlice = player.baseSliceDamage || 130;
      const baseEmp = player.baseEmpRechargeRate || 12;
      const baseChrono = player.baseChronoRechargeRate || 18;
      const baseShieldRegen = player.baseShieldRegenRate || 10;
      player.sliceDamage = Math.min(player.sliceDamage * 1.012, baseSlice * 2.2);
      player.empRechargeRate = Math.min(player.empRechargeRate * 1.008, baseEmp * 1.75);
      player.chronoRechargeRate = Math.min(player.chronoRechargeRate * 1.008, baseChrono * 1.65);
      player.shieldRegenRate = Math.min((player.shieldRegenRate || baseShieldRegen) * 1.006, baseShieldRegen * 1.5);
      if (mastery % 5 === 0) {
        player.shield = Math.min(player.maxShield, player.shield + player.maxShield * 0.05);
      }
    }

    return { def, currentTier, mastered: previousTier >= def.maxTier };
  }
}

window.augmentManager = new AugmentManager();
