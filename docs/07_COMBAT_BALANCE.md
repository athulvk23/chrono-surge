# CHRONO SURGE // COMBAT BALANCE REFERENCE

## 1. CHRONO ENERGY ECONOMY VALUES
| Metric | Value | Design Intent |
| :--- | :--- | :--- |
| **Max Capacity** | `100 Units` | Hard ceiling for temporal abilities. |
| **Passive Regen Rate** | `8 Units / sec` | Provides steady recovery without enabling infinite loops. |
| **Regen Delay** | `1.0 Second` | Halts passive regeneration following energy expenditure. |
| **Chrono-Stasis Drain** | `25 Units / sec` | Drains energy while time dilation is active; shuts off at 0. |
| **Hyper-Slash Cost** | `20 Units` | Required to initiate kinetic vector dash. |
| **EMP Repulse Cost** | `35 Units` | High-cost emergency crowd control / bullet purge. |
| **Parry Cost** | `15 Units` | Deducted on successful projectile reflection. |
| **Parry Skill Refund** | `5 Units` | Reward for precision deflection (Net cost: 10 units). |
| **Parry Active Window** | `180 ms` | Tight skill-testing timing window. |
| **Parry Recovery Window** | `300 ms` | Vulnerability state where repeated parry is rejected. |
| **Min Parry Interval** | `450 ms` | Cooldown preventing button mash / macro exploits. |

## 2. DIFFICULTY INDEX CALIBRATION MATRIX
Baseline Mean across sampled waves: **64.6 / 100**
Target Mean across sampled waves: **69.6 / 100**
**Empirical Delta: Exactly +5.0 Points**

| Wave | Baseline Score | Target Score (+5) | Key Threat Drivers |
| :---: | :---: | :---: | :--- |
| **W1** | 47.0 | 52.0 | 100% Hunters, 4 total drones, gentle spawn delay (2.4s) |
| **W2** | 48.0 | 53.0 | 6 Hunters, accelerated XP drops to ensure Early Augment |
| **W5** | 56.6 | 61.6 | Orbiters introduced, circular wave patterns, tight parry requirements |
| **W8** | 68.3 | 73.3 | Chevron Dashers commit to high-speed charges, elite variant chance |
| **W10** | 72.1 | 77.1 | Apex Overlord Phase 1 & 2 encounter, 6s EMP stagger immunity |
| **W15** | 78.9 | 83.9 | Phase-shifting Phantoms, splitting void orbs, anomaly hazards |
| **W20** | 81.4 | 86.4 | Multi-archetype synergy, Cosmic Archon singularity boss tier |
