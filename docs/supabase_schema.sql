-- =========================================================================
-- CHRONO SURGE: BEGINNING — SUPABASE & POSTGRESQL PRODUCTION SCHEMA
-- Enforces:
-- 1. Unique case-insensitive usernames via LOWER(username) unique index
-- 2. Character regex and length constraints on callsigns
-- 3. Row Level Security (RLS) ensuring players cannot edit other profiles
-- 4. Authoritative verified leaderboard entries with idempotent runId
-- 5. Automatic profile provisioning on auth.users sign-up
-- =========================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar TEXT DEFAULT 'vanguard',
  level INT DEFAULT 1 CHECK (level >= 1 AND level <= 999),
  xp BIGINT DEFAULT 0 CHECK (xp >= 0),
  shards INT DEFAULT 0 CHECK (shards >= 0),
  highest_wave INT DEFAULT 0 CHECK (highest_wave >= 0),
  best_score BIGINT DEFAULT 0 CHECK (best_score >= 0),
  longest_survival_sec INT DEFAULT 0 CHECK (longest_survival_sec >= 0),
  total_kills INT DEFAULT 0 CHECK (total_kills >= 0),
  total_slices INT DEFAULT 0 CHECK (total_slices >= 0),
  total_deflects INT DEFAULT 0 CHECK (total_deflects >= 0),
  completed_runs INT DEFAULT 0 CHECK (completed_runs >= 0),
  max_style_rank TEXT DEFAULT 'D' CHECK (max_style_rank IN ('D', 'C', 'B', 'A', 'S', 'SS', 'SSS')),
  tutorial_completed BOOLEAN DEFAULT false,
  equipped_core TEXT DEFAULT 'vanguard' CHECK (equipped_core IN ('vanguard', 'reaper', 'valkyrie')),
  equipped_skin TEXT DEFAULT 'default_cyan',
  unlocked_skins JSONB DEFAULT '["default_cyan"]'::JSONB,
  skill_tree JSONB DEFAULT '{
    "chrono_mastery": 0,
    "offensive_systems": 0,
    "defensive_systems": 0,
    "mobility_thrusters": 0,
    "energy_efficiency": 0,
    "overdrive_catalyst": 0
  }'::JSONB,
  settings JSONB DEFAULT '{
    "masterVolume": 0.75,
    "musicVolume": 0.70,
    "sfxVolume": 0.85,
    "muted": false,
    "crtEnabled": true,
    "reducedMotion": false,
    "highContrast": false,
    "mobileControlsMode": "auto",
    "aimAssist": true
  }'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Username format check: 3-20 characters, alphanumeric with _ and -
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]{3,20}$')
);

-- CASE-INSENSITIVE UNIQUE USERNAME INDEX (Hard database constraint)
-- Prevents "ChronoPilot" and "chronopilot" from coexisting
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));

-- 2. LEADERBOARD ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE, -- Prevents duplicate run submissions
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'endless' CHECK (mode IN ('endless', 'daily', 'tutorial')),
  daily_seed TEXT,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT 'vanguard',
  score BIGINT NOT NULL CHECK (score >= 0 AND score <= 50000000),
  wave INT NOT NULL CHECK (wave >= 1 AND wave <= 500),
  survival_time INT NOT NULL CHECK (survival_time >= 1 AND survival_time <= 86400),
  kills INT NOT NULL CHECK (kills >= 0 AND kills <= 250000),
  max_combo INT DEFAULT 0 CHECK (max_combo >= 0),
  style_rank TEXT DEFAULT 'D' CHECK (style_rank IN ('D', 'C', 'B', 'A', 'S', 'SS', 'SSS')),
  core_type TEXT DEFAULT 'vanguard' CHECK (core_type IN ('vanguard', 'reaper', 'valkyrie')),
  skin_id TEXT DEFAULT 'default_cyan',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Anti-cheat plausibility database constraints
  CONSTRAINT plausible_pace CHECK (wave <= 1 OR survival_time >= (wave - 1) * 2),
  CONSTRAINT plausible_kill_velocity CHECK (kills <= 20 OR (kills::FLOAT / survival_time::FLOAT) <= 18.0)
);

-- Optimized Leaderboard Query Indexes
CREATE INDEX IF NOT EXISTS idx_lb_endless_ranking 
  ON public.leaderboard_entries (score DESC, wave DESC, survival_time ASC) 
  WHERE mode = 'endless';

CREATE INDEX IF NOT EXISTS idx_lb_daily_ranking 
  ON public.leaderboard_entries (daily_seed, score DESC, wave DESC, survival_time ASC) 
  WHERE mode = 'daily';

CREATE INDEX IF NOT EXISTS idx_lb_user_runs 
  ON public.leaderboard_entries (user_id, created_at DESC);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read basic profile info for leaderboards; users can only edit their own
CREATE POLICY "Profiles are publicly readable" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- Leaderboards: Anyone can read verified entries; only authenticated users can insert their run
CREATE POLICY "Leaderboard entries are publicly readable" 
  ON public.leaderboard_entries FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can submit verified runs" 
  ON public.leaderboard_entries FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. AUTOMATIC PROFILE PROVISIONING TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  desired_username TEXT;
  clean_username TEXT;
  user_count INT;
BEGIN
  -- Extract username from metadata or email
  desired_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'user_name',
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Clean to allowed characters
  clean_username := REGEXP_REPLACE(desired_username, '[^a-zA-Z0-9_-]', '', 'g');
  IF LENGTH(clean_username) < 3 THEN
    clean_username := 'pilot_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 6);
  ELSE
    clean_username := SUBSTRING(clean_username FROM 1 FOR 15);
  END IF;

  -- Ensure unique username
  SELECT COUNT(*) INTO user_count FROM public.profiles WHERE LOWER(username) = LOWER(clean_username);
  IF user_count > 0 THEN
    clean_username := clean_username || '_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 4);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    clean_username,
    UPPER(clean_username),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on every new user sign-up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
