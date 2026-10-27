# CHRONO SURGE: BEGINNING — TECHNICAL ARCHITECTURE

## 1. System Overview

**Chrono Surge: Beginning** is built with high performance and zero external bundler dependencies, achieving 60+ FPS on both desktop browsers and mobile touch devices.

```
+---------------------------------------------------------------------------------+
|                                 CLIENT TIER                                     |
|                                                                                 |
|  +--------------------+   +-----------------------+   +----------------------+  |
|  |   HTML5 Canvas     |   |   Three.js 3D Arena   |   |   Web Audio Synth    |  |
|  |  (Entities, Slices,|   |  (Volumetric Grid,    |   | (4-Stem Dynamic Bus, |  |
|  |   HUD, Vectors)    |   |   Depth Tunnel)       |   |  Bullet-Time Filter) |  |
|  +---------^----------+   +-----------^-----------+   +----------^-----------+  |
|            |                          |                          |              |
|  +---------+--------------------------+--------------------------+-----------+  |
|  |                             ChronoGame Engine                             |  |
|  |   (State Machine, Wave Director, Particle Budget, Time Dilation Scaler)    |  |
|  +---------^--------------------------^--------------------------^-----------+  |
|            |                          |                          |              |
|  +---------+-----------+  +-----------+-----------+  +-----------+-----------+  |
|  |   Dual Touch Zones  |  |   Keyboard & Mouse    |  | Gamepad API Poller    |  |
|  | (Virtual Joystick,  |  | (WASD, Rebind Binds,  |  | (Twin Stick, Analog   |  |
|  |  Right Aim Vector)  |  |  LMB Time Dilation)   |  |  Triggers, Vibration) |  |
|  +---------------------+  +-----------------------+  +-----------------------+  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                          Progression & Offline Save                       |  |
|  |     (Local Storage Save v2, Atomic Backup, Sync Queue, Skin & Skill Tree) |  |
|  +------------------------------------^--------------------------------------+  |
+---------------------------------------|-----------------------------------------+
                                        | HTTP REST / JSON
+---------------------------------------v-----------------------------------------+
|                                 SERVER TIER                                     |
|                                                                                 |
|  +---------------------+  +-----------------------+  +-----------------------+  |
|  |   Auth Controller   |  |  Anti-Cheat Validator |  | Daily Challenge Seed  |  |
|  | (Timing-safe HMAC,  |  | (Kill velocity bound, |  | (Deterministic PRNG,  |  |
|  |  Owner isolation)   |  |  Score ceilings)      |  |  Modifier Generator)  |  |
|  +----------^----------+  +-----------^-----------+  +-----------^-----------+  |
|             |                         |                          |              |
|  +----------+-------------------------+--------------------------+-----------+  |
|  |                    Atomic JSON Storage Engine (v2)                        |  |
|  |          (In-memory Cache, Write-Ahead Swap, Schema Auto-Migration)       |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 2. Rendering Pipeline

### Dual-Layer Hybrid Rendering
1. **Three.js Background (`#three-arena`)**:
   - Renders a futuristic 3D wireframe tunnel with neon grid lines, depth haze, and rotating anomaly pillars.
   - On mobile/touch devices, dynamically scales down pixel ratio to 1.0 and throttles scenery updates to conserve battery and GPU fillrate.
2. **2D Canvas (`#game-canvas`)**:
   - High-contrast vector rendering for all active combat entities.
   - **Player Vessel**: Renders 6 distinct visual hulls (`arrowhead`, `scythe`, `valkyrie`, `phantom`, `hyperion`, `archon`) with dynamic engine thruster particle trails.
   - **Time Dilation Visuals**: Real-time trajectory prediction raycast, time-dilation stasis ripples, and neon bullet trails.

---

## 3. Audio Architecture

All audio is procedurally synthesized in real time via the native **Web Audio API**:
- **Master Bus**: Master volume attenuation and hard limiting to prevent clipping.
- **Music Bus**: Procedural synth pulse with beat synchronization.
- **SFX Bus**:
  - `playPrimaryPulse()`: High-frequency plasma bolt chirps.
  - `playSlice()`: Swept-sine resonant blade slash with dynamic pitch based on combo rank.
  - `playDeflect()`: Crystal harmonic resonant chime on bullet parry.
  - `playEmp()`: Low-frequency sub-bass detonation with shockwave wash.
  - `playOverdrive()`: Rising siren into Judgement Cut multi-slash crescendo.
- **BiquadFilter Bullet-Time Effect**: When Time Dilation is active, a 380Hz low-pass filter is smoothly swept in, producing a realistic acoustic underwater/stasis effect.

---

## 4. Anti-Cheat Engine

The server validates every completed run submission at `/api/runs`:
1. **Kill Velocity Ceiling**: Rejects runs exceeding 15 kills per second sustained.
2. **Wave Progression Speed**: Minimum elapsed time required per wave ($t \ge 2.0 \times (w - 1)$ seconds).
3. **Plausible Score Formula**: Score cannot exceed $(w \times 25,000) + (k \times 3,500) + 50,000$.
4. **Combo Plausibility**: Maximum combo cannot exceed total combat interactions ($k + 50$).
5. **Idempotency Protection**: Cryptographic run ID deduplication prevents replay exploits.

---

## 5. Mobile & Touch Optimizations

1. **Left-Hand Virtual Joystick**:
   - Clamped analog displacement with dynamic return spring.
   - Integrates seamlessly with `joyMove` vector without conflicting with UI touch events.
2. **Right-Hand Aim & Time Dilation Zone**:
   - Touch drag initiates slow motion; releasing executes Hyper-Slash towards the aimed coordinate.
3. **Dedicated Large Action Targets**:
   - `PULSE` (with auto-fire on hold), `EMP`, and `OVERDRIVE` thumb triggers.
   - Meets accessibility touch target guidelines ($\ge 48\text{px}$).
4. **PWA Standalone Mode**:
   - `manifest.webmanifest` and high-res vector app icon (`icon.svg`) enable home-screen installation on iOS and Android.
