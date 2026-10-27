# CHRONO SURGE // RELEASE ROADMAP

## CURRENT RELEASE: PLAYTEST READINESS (PHASE 1 COMPLETE)
- **Branch:** `playtest-readiness`
- **Key Deliverables Completed:**
  - Real Authentication Terminal (Guest mode, Google OAuth, Email/Callsign auth, Password reset).
  - Database-enforced unique callsigns with case-insensitive normalization.
  - Chrono Energy Economy (100 cap, 8/s regen, 1.0s delay, 25/s stasis drain, 20 Hyper-Slash, 35 EMP).
  - Skill-Based Parry (180ms window, 300ms recovery, 450ms cooldown, 15 cost, 5 refund).
  - Calibrated Progressive Difficulty Director (+5.0 points internal difficulty index, bounded endgame).
  - Truthful Leaderboard (purged hardcoded bots, genuine run telemetry).
  - Responsive HUD & mobile touch-control parity.
  - 22/22 Automated Integration Tests Passing.

## PHASE 2: CONTROLLED EXTERNAL PLAYTEST (NEXT MILESTONE)
- Distribution of dedicated playtest builds to external testers.
- Collection of telemetry on wave survival distribution, parry success ratios, and augment pick rates.
- Playtest feedback synthesis via `docs/08_PLAYTEST_GUIDE.md`.

## PHASE 3: PRODUCTION MERGE & EXPANSION
- Code review and explicit approval before merging `playtest-readiness` into `main`.
- Deployment of full Supabase backend database migration if external cloud syncing is desired on production URL.
- Public announcement and tournament challenge events.
