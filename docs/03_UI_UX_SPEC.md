# CHRONO SURGE // UI/UX & RESPONSIVE SPECIFICATION

## 1. VISUAL DESIGN LANGUAGE
- **Aesthetic:** Dark cyberpunk arena minimalism with neon vector accents.
- **Color Semantics:**
  - `Electric Cyan (#00f0ff)`: Player identity, Chrono Energy, successful parries, friendly plasma.
  - `Warning Yellow (#ffe600)`: Overdrive energy, shield power, tactical telegraphs, combo callouts.
  - `Crimson Red (#ff0055)`: Hostile anomalies, aggressive projectiles, high threat indicators.
  - `Void Magenta (#a64cff)`: Phase-shifting Phantoms, EMP shockwaves, cosmic singularities.
  - `Dark Carbon (#05060b)`: Primary UI card and terminal backgrounds.

## 2. IN-GAME COMBAT HUD
- **Top Bar:** Wave counter, score display, dynamic Style Rank meter (D, C, B, A, S, SS, SSS), active combo multiplier.
- **Bottom Left Vitals:**
  - Health bar (Cyan / Green).
  - Nanite Shield bar (Blue).
  - Chrono Energy bar (Cyan, 0-100%, dynamic feedback: `READY`, `STASIS`, `PARRY!`, `EXHAUSTED`).
  - EMP Repulse meter (Magenta, charging indicator vs `READY [R-CLICK]`).
  - Overdrive meter (Crimson / Yellow glowing diamond, pulses on 100% ready).
- **Boss Encounter Overlay:** Top-centered boss health bar with multi-phase pip counter and threat level indicator.
- **Active Build Augments:** Right-aligned vertical augment badge list showing active icons and upgrade tiers.

## 3. MOBILE TOUCH CONTROLS
- **Dual-Touch Layout:**
  - Left Zone: Floating virtual dynamic analog joystick for 360-degree vessel maneuvering.
  - Right Zone: Dedicated touch action buttons (`FIRE`, `HYPER-SLASH / PARRY`, `EMP`).
- **Touch Responsiveness:**
  - Hardware accelerated canvas with capped DPR (1.25 on mobile) to eliminate micro-stutters.
  - Viewport-locking metadata (`user-scalable=no, viewport-fit=cover`) preventing accidental swipe-to-scroll or page zoom during heated battles.
