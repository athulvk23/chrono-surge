# ⚡ CHRONO SURGE: BEGINNING ⚡
*A Fast-Paced Futuristic Arena Action Roguelite with Real-Time Vector Slicing & Time Dilation*

[![Chrono Surge CI](https://github.com/Antigravity/chrono-surge-beginning/actions/workflows/ci.yml/badge.svg)](https://github.com/Antigravity/chrono-surge-beginning/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Platform: Web & Mobile](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20PWA-00f0ff.svg)](#)

---

## 🎮 Overview

In **Chrono Surge: Beginning**, you are a cybernetic combat operative wielding an experimental Chrono-Core capable of manipulating local spacetime. Fight through relentless anomaly swarms, bend time to forecast incoming projectile trajectories, and execute lethal **Hyper-Slashes** across the arena.

Designed from the ground up for seamless play on **both desktop (keyboard/mouse/gamepad) and smartphones/tablets (responsive dual-zone touch controls)**.

---

## 🚀 Key Features

- **Chrono Stasis & Time Dilation**: Hold left click or touch-drag on the arena to dilate time to 12% speed, predicting enemy vectors and lining up devastating multi-target dash cuts.
- **Hyper-Slash Kinetic Combat**: Release time dilation to slice through enemies at lightspeed, deflecting hostile projectiles back at their origin.
- **EMP Repulse**: Trigger an instantaneous high-energy shockwave to dissolve incoming bullet storms and knock back swarming anomalies.
- **Chrono Overdrive Ultimate**: Charge the core to 100% and unleash the Judgement Cut multi-slash ultimate.
- **10-Step Interactive Tutorial**: Complete with live drone targets, progressive skill checks, visual UI highlights, and persistent certification.
- **Full Progression Ecosystem**:
  - **The Armory**: 6 unlockable vessel hulls (`default_cyan`, `crimson_eclipse`, `solar_valkyrie`, `void_phantom`, `neon_hyperion`, `omega_chronos`) rendered with unique 2D geometry and live 3D preview.
  - **Skill Tree**: 6 upgrade branches (`chrono_mastery`, `offensive_systems`, `defensive_systems`, `mobility_thrusters`, `energy_efficiency`, `overdrive_catalyst`) with prerequisite tracking.
  - **Achievements**: 9 distinct combat feats rewarding Chrono Shards.
- **Game Modes**:
  - **Endless Survival**: Scaling waves with boss encounters every 10 waves (Apex Overlords with multi-phase mechanics).
  - **Daily Challenge**: Deterministic global seed based on UTC date with special combat modifiers.
  - **Training Facility**: Replayable interactive combat certification.
- **Full Backend & Global Leaderboards**:
  - Production Node.js HTTP server with atomic JSON database engine (`data/db.json` + `db.json.bak` fallback).
  - JWT token authentication, owner-isolated cloud profile syncing, and anti-cheat validation.
- **Procedural Synth Audio Engine**: Web Audio API synthesizer with dynamic music, sfx, and real-time low-pass bullet-time filters.

---

## 🕹️ Controls

| Action | Desktop (Keyboard/Mouse) | Mobile / Tablet Touch | Gamepad (Xbox / PS) |
|---|---|---|---|
| **Movement** | `W`, `A`, `S`, `D` / Arrow Keys | Left Virtual Joystick | Left Analog Stick |
| **Primary Pulse Cannon** | `E` (or rebindable) | Tap / Hold `[PULSE]` Button | `X` / Square |
| **Time Dilation (Slow-Mo)** | Hold `Left Mouse Button` | Touch & Drag Right Aim Zone | Hold `RT` / `RB` (R2/R1) |
| **Hyper-Slash Dash** | Release `Left Mouse Button` | Release Right Aim Zone | Release `RT` / `RB` |
| **EMP Repulse Shockwave** | `Spacebar` / `Right Mouse Button` | Tap `[EMP]` Button | `A` / Cross or `LT` |
| **Chrono Overdrive** | `F` or `Q` | Tap `[OVERDRIVE]` Button | `Y` / Triangle |
| **Pause / Resume** | `Escape` | Tap `[II]` HUD Button | `Start` / Menu |

*All keyboard controls are fully remappable from **Settings → Control Bindings**.*

---

## 📦 Quick Start & Local Execution

### Prerequisites
- Node.js 18.0.0 or higher.
- Modern web browser (Chrome, Safari, Firefox, Edge).

### 1. Run the Game Server
```bash
# Start the production server
npm start
```
The game will start and bind to `http://localhost:3000`. Open the URL in your browser or on your phone connected to the same local network!

### 2. Run Automated Verification Tests
```bash
npm test
```
Executes all 10 unit and integration tests across gameplay mechanics, progression rules, API endpoints, authentication, and anti-cheat systems.

---

## 📱 Mobile Installation (PWA)

Chrono Surge is a certified Progressive Web App:
- **iOS (Safari)**: Open the game URL, tap the **Share** button, and select **Add to Home Screen**.
- **Android (Chrome)**: Tap the **Menu** (three dots) and select **Install App** or **Add to Home Screen**.

The game will launch in fullscreen borderless mode with dedicated touch controls.

---

## 🛡️ Anti-Cheat & Security

The server verifies all submitted combat runs through strict validation gates:
- Rejection of impossible survival-to-score acceleration.
- Rejection of kill rates exceeding physical combat capabilities ($> 15\text{ kills/sec}$).
- Rate-limiting on authentication and submission endpoints.
- Timing-safe HMAC SHA-256 password hashing with cryptographic per-user salting.
- Strict owner isolation preventing cross-account profile tampering.

---

## 📄 License
MIT License. Antigravity Game Studios © 2026.
