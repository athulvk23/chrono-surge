# CHRONO SURGE // DATABASE & API SPECIFICATION

## 1. REST API ENDPOINTS

### Authentication
- `GET /api/auth/username-available?username={callsign}`
  - Rate-limited availability check with normalized validation.
  - Returns: `{ available: boolean, reason?: string, normalized: string }`
- `POST /api/auth/register`
  - Body: `{ username, password, email?, guestProfile? }`
  - Enforces case-insensitive uniqueness and reserved callsign blacklist.
  - Returns: `201 Created` with `{ token, user, profile }`
- `POST /api/auth/login`
  - Body: `{ username, password, guestProfile? }` (Accepts username or email)
  - Returns: `200 OK` with session token.
- `POST /api/auth/forgot-password`
  - Body: `{ emailOrUsername }`
  - Issues 1-hour secure cryptographic token for password recovery.
- `POST /api/auth/reset-password`
  - Body: `{ token, newPassword }`
  - Resets user credentials.

### Telemetry & Progression
- `GET /api/profile` (Bearer Token)
  - Returns authenticated operative profile blob.
- `PUT /api/profile/sync` (Bearer Token)
  - Safely updates player shards, achievements, and unlocked skins.
- `POST /api/runs`
  - Body: `{ displayName, score, wave, survivalTime, kills, slices, deflects, styleRank, mode }`
  - Server-side anti-cheat validation rejects impossible metrics.
- `GET /api/leaderboard?mode={endless|daily}&page={1}&limit={10}`
  - Returns verified real leaderboard entries. Truthful empty state when no runs exist (zero hardcoded bots).

## 2. POSTGRESQL / SUPABASE SCHEMA
See `docs/supabase_schema.sql` for complete schema with Row Level Security (RLS) policies, case-insensitive unique indexes (`idx_profiles_username_lower`), and anti-cheat constraints.
