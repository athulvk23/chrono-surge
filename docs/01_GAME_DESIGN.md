# CHRONO SURGE // GAME DESIGN DOCUMENT (GDD)

## 1. VISION & CORE FANTASY
*Chrono Surge* is a fast-paced sci-fi arena survival roguelite built around temporal combat, precision vector maneuvering, resource management, and escalating anomaly threats. The player pilots an agile Chrono-Core combat vessel, manipulating time dilation, reflecting incoming hostile fire, and executing devastating Hyper-Slashes against synthetic extraterrestrial swarms.

## 2. CORE GAMEPLAY LOOP
1. **Sortie Departure:** Select Chrono-Core archetype (Vanguard, Specter, or Nova) and enter the neon cyber-arena.
2. **Kinetic Engagement:** Maneuver using WASD/Arrow keys or analog touch stick. Fire primary plasma pulses to engage distant anomalies.
3. **Temporal Mastery & Counterplay:**
   - Engage **Chrono-Stasis** to dilate time, reveal ballistic trajectories, and calculate slice angles.
   - Execute precision **Skill Parries** against telegraphed enemy fire, redirecting projectiles into enemy hulls.
   - Deploy **EMP Repulse** shockwaves to vaporize bullet clusters and stagger approaching threats.
4. **Finite Energy Economy:** Manage a strict 100-unit Chrono Energy pool. Avoid depletion to prevent being caught vulnerable during intense wave sequences.
5. **Roguelite Augment Selection:** Level up from defeated enemy XP orbs; choose from synergized tactical augments every wave milestone.
6. **Apex Boss Encounters:** Confront the multi-phase Apex Overlord boss every 10 waves (Awakened Core -> Ascended Winged Deity -> Cosmic Archon Singularity).
7. **Performance Review & Permanent Meta-Progression:** Earn Chrono Shards to unlock permanent skill tree enhancements, skins, achievements, and legitimate leaderboard glory.

## 3. PLAYABLE CHRONO-CORE ARCHETYPES
| Core ID | Name | Role & Combat Specialization |
| :--- | :--- | :--- |
| **01 CORE** | **Vanguard** | Balanced frontline operative. Standard 100 HP / 100 Shield, baseline Chrono recovery, reliable combat profile. |
| **02 SPECTER** | **Void Reaper** | High-velocity assassin. 80 HP / 75 Shield (-20% survivability), +40% dash range, +32% slice damage, wider cutting radius. |
| **03 NOVA** | **Pulse Valkyrie** | Area-denial shock specialist. +35% EMP recharge rate, +22% EMP radius, rapid-fire plasma blasters (0.17s cooldown). |

## 4. ANOMALY THREAT ARCHETYPES & COUNTERPLAY
- **Hunter (Wave 1+):** Aggressive tracking drone firing linear plasma bolts. Counter: Sidestep or execute skill parry to reflect bolts back into hunter.
- **Orbiter (Wave 4+):** Medium-range hex drone holding orbital perimeter and charging pulsing ring waves. Counter: Close the distance during telegraph charging window or EMP blast through ring projectiles.
- **Dasher (Wave 6+):** High-speed chevron drone with wind-up charge telegraph. Counter: Wait for dash commitment line, then sidestep and slice from flank.
- **Phantom (Wave 9+):** Phase-shifting crystal that teleports and fires splitting void orbs. Counter: Track shimmer particles to anticipate re-emergence; parry splitting orbs before divergence.
- **Apex Overlord (Wave 10, 20, 30):**
  - *Phase 1:* Quad orbital energy satellites and rotational plasma spray.
  - *Phase 2:* 4 Crystalline deity wings with high-velocity laser sweep.
  - *Phase 3:* Cosmic Archon Singularity pulling the player toward the core while releasing swirling seekers. Features anti-lockout immunity (6s immunity timer between EMP staggers).
