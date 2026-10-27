# CHRONO SURGE // TEST & ACCEPTANCE PLAN

## 1. AUTOMATED TEST SUITE MATRIX (22 PASSING TESTS)

| # | Test Case / Suite | File | Verified Requirement |
| :--- | :--- | :--- | :--- |
| 1 | Progression Profile Defaults | `gameplay.test.js` | Initial save schema integrity |
| 2 | Daily Deterministic Seed | `gameplay.test.js` | UTC seed calculation reproducibility |
| 3 | Anti-Cheat Bounds Validation | `gameplay.test.js` | Impossible speed/score rejection |
| 4 | Skin Catalog Geometry & Colors | `gameplay.test.js` | Visual asset integrity |
| 5 | Skill Tree Cost Curves | `gameplay.test.js` | Monotonic branch costs |
| 6 | 3-Phase Boss & Archetypes | `gameplay.test.js` | Official sci-fi reference compliance |
| 7 | Boss Audio Resilience | `gameplay.test.js` | Phase transition audio error guards |
| 8 | Menu State Clean-Up | `gameplay.test.js` | `returnToTitle()` memory leak prevention |
| 9 | Progressive Difficulty Scaling | `gameplay.test.js` | Archetype sequencing & bounded curves |
| 10 | **Energy Bounds & Stasis Cutoff** | `gameplay.test.js` | 100 max cap, 0 floor, no free stasis |
| 11 | **Regen Delay Timer** | `gameplay.test.js` | 1.0s delay after expenditure before regen |
| 12 | **Skill-Based Parry State Machine** | `gameplay.test.js` | 180ms window, 300ms recovery, 450ms cooldown |
| 13 | **Single-Reflection Guarantee** | `gameplay.test.js` | Projectiles cannot be reflected twice |
| 14 | **EMP Anti-Boss Lockout** | `gameplay.test.js` | Boss 6.0s immunity against stun loops |
| 15 | **+5.0 Point Difficulty Calibration** | `gameplay.test.js` | Verified +5.0 point increase over baseline |
| 16 | **Roguelite Augment Hard Caps** | `gameplay.test.js` | Caps on drain, parry bonus, and glass cannon |
| 17 | Health Check Endpoint | `server.test.js` | Production service uptime |
| 18 | Daily Challenge API | `server.test.js` | Seed & modifier delivery |
| 19 | Leaderboard API Structure | `server.test.js` | Pagination & schema verification |
| 20 | Auth: Register & Login Flow | `server.test.js` | Session token creation & profile sync |
| 21 | Anti-Cheat Server Validation | `server.test.js` | Score / rate cheating rejected |
| 22 | Unique Username Normalization | `server.test.js` | Case-insensitive conflict prevention |

## 2. RUNNING THE AUTOMATED TESTS
```bash
npm test
```
All 22 automated integration tests must exit with code 0 (`0 fail`).
