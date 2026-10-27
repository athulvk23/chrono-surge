# CHRONO SURGE // KNOWN ISSUES & LIMITATIONS

## 1. BACKEND & CLOUD PERSISTENCE
- **Static GitHub Pages Deployment:**
  - The live GitHub Pages deployment operates as a client-side static application.
  - Full cloud registration, Google OAuth, and server-side global leaderboard sync require connecting a Supabase project or hosting `server.js` on a cloud container (e.g. Render, Railway, Fly.io).
  - To support static deployment, the client automatically falls back to verified local device telemetry and direct Supabase client integration if environment keys are supplied.
- **Service-Role Key Security:**
  - Supabase service-role keys and database administrative passwords are intentionally NOT embedded into client-side code or Git history. Only the public anonymous key is used by the frontend client.

## 2. PERFORMANCE & BROWSER DIFFERENCES
- **High Refresh Rate Displays (120Hz / 144Hz):**
  - All physics updates in `game.js` and `entities.js` utilize delta-time (`dt`) dampening to ensure identical bullet velocity and stasis drain across 60Hz, 120Hz, and variable refresh rate screens.
- **Mobile Audio Autoplay Policies:**
  - On iOS Mobile Safari and certain Android Chrome builds, Web Audio requires an initial user interaction (touch or tap) to resume the audio context. Handled gracefully via `resumeContext()` listeners on touch start.
