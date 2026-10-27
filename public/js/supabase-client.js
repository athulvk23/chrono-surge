/* =========================================================================
   CHRONO SURGE: BEGINNING — SUPABASE CLIENT & CLOUD PROVIDER INTEGRATION
   Direct, secure PostgreSQL & Auth client for GitHub Pages and production.
   Supports Google OAuth, Email/Password, Unique Username checks & Leaderboards.
   ========================================================================= */

(function () {
  const STORAGE_KEY = 'chrono_supabase_config';
  const RESERVED_NAMES = new Set([
    'admin', 'administrator', 'moderator', 'mod', 'official', 'chronos', 'chrono',
    'system', 'sys', 'root', 'support', 'guest', 'null', 'undefined', 'anonymous',
    'apex', 'operator', 'supernova', 'void', 'valkyrie'
  ]);

  class ChronoSupabaseBridge {
    constructor() {
      this.client = null;
      this.isReady = false;
      this.currentUser = null;
      this.config = this.loadConfig();
      this.init();
    }

    loadConfig() {
      // 1. Check window global config (can be populated by deployment or environment)
      if (window.CHRONO_CONFIG && window.CHRONO_CONFIG.supabaseUrl && window.CHRONO_CONFIG.supabaseKey) {
        return {
          url: window.CHRONO_CONFIG.supabaseUrl,
          key: window.CHRONO_CONFIG.supabaseKey
        };
      }
      // 2. Check localStorage for user/organizer configured Supabase project
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (_) {}
      return null;
    }

    saveConfig(url, key) {
      if (!url || !key) return;
      this.config = { url: url.trim(), key: key.trim() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch (_) {}
      this.init();
    }

    clearConfig() {
      this.config = null;
      this.client = null;
      this.isReady = false;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }

    init() {
      if (!this.config || !this.config.url || !this.config.key) {
        this.isReady = false;
        return;
      }
      if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
          this.client = window.supabase.createClient(this.config.url, this.config.key, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true
            }
          });
          this.isReady = true;
          this.listenAuthState();
        } catch (err) {
          console.warn('[Supabase Bridge] Initialization error:', err.message);
          this.isReady = false;
        }
      }
    }

    listenAuthState() {
      if (!this.client) return;
      this.client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          this.currentUser = session.user;
          if (window.progression) {
            window.progression.handleSupabaseSession(session);
          }
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
        }
      });
    }

    isAvailable() {
      return this.isReady && !!this.client;
    }

    // --- USERNAME VALIDATION & AVAILABILITY ---
    validateUsernameFormat(username) {
      if (!username || typeof username !== 'string') {
        return { valid: false, reason: 'Callsign cannot be empty.' };
      }
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 20) {
        return { valid: false, reason: 'Callsign must be 3 to 20 characters.' };
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, reason: 'Only letters, numbers, hyphens (-) and underscores (_) allowed.' };
      }
      if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
        return { valid: false, reason: 'This callsign is reserved by system protocol.' };
      }
      return { valid: true, clean: trimmed, lower: trimmed.toLowerCase() };
    }

    async checkUsernameAvailable(username) {
      const fmt = this.validateUsernameFormat(username);
      if (!fmt.valid) return { available: false, reason: fmt.reason };

      if (!this.isAvailable()) {
        // Fall back to server API check if Supabase is unconfigured
        try {
          const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(fmt.clean)}`);
          if (res.ok) return await res.json();
        } catch (_) {}
        return { available: true, clean: fmt.clean }; // Local optimistic check
      }

      try {
        const { data, error } = await this.client
          .from('profiles')
          .select('id, username')
          .ilike('username', fmt.lower)
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          return { available: false, reason: 'Callsign is already registered by another operative.' };
        }
        return { available: true, clean: fmt.clean };
      } catch (err) {
        return { available: true, clean: fmt.clean };
      }
    }

    // --- AUTHENTICATION FLOWS ---
    async signUp(email, password, username, guestProfile = null) {
      const fmt = this.validateUsernameFormat(username);
      if (!fmt.valid) throw new Error(fmt.reason);

      if (!this.isAvailable()) {
        throw new Error('Cloud provider not initialized. Use local server authentication.');
      }

      // Check unique username constraint first
      const avail = await this.checkUsernameAvailable(username);
      if (!avail.available) throw new Error(avail.reason);

      const { data, error } = await this.client.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: fmt.clean,
            display_name: fmt.clean.toUpperCase()
          }
        }
      });

      if (error) throw error;
      if (data.user && guestProfile) {
        await this.syncProfile(data.user.id, fmt.clean, guestProfile);
      }
      return data;
    }

    async signInWithPassword(email, password) {
      if (!this.isAvailable()) {
        throw new Error('Cloud provider not initialized.');
      }
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      return data;
    }

    async signInWithGoogle() {
      if (!this.isAvailable()) {
        throw new Error('Google OAuth requires Supabase configuration.');
      }
      const redirectTo = window.location.origin + window.location.pathname;
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo
        }
      });
      if (error) throw error;
      return data;
    }

    async requestPasswordReset(email) {
      if (!this.isAvailable()) {
        throw new Error('Password reset requires Supabase or configured mailer.');
      }
      const redirectTo = window.location.origin + window.location.pathname;
      const { data, error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo
      });
      if (error) throw error;
      return data;
    }

    async signOut() {
      if (this.isAvailable()) {
        await this.client.auth.signOut();
      }
      this.currentUser = null;
    }

    // --- PROFILE & LEADERBOARD SYNC ---
    async syncProfile(userId, username, profileData) {
      if (!this.isAvailable() || !userId) return null;
      try {
        const payload = {
          id: userId,
          username: username,
          display_name: profileData.displayName || username.toUpperCase(),
          level: profileData.level || 1,
          xp: profileData.xp || 0,
          shards: profileData.shards || 0,
          highest_wave: profileData.highestWave || 0,
          best_score: profileData.bestScore || 0,
          longest_survival_sec: profileData.longestSurvivalSec || 0,
          total_kills: profileData.totalKills || 0,
          total_slices: profileData.totalSlices || 0,
          total_deflects: profileData.totalDeflects || 0,
          max_style_rank: profileData.maxStyleRank || 'D',
          tutorial_completed: !!profileData.tutorialCompleted,
          equipped_core: profileData.equippedCore || 'vanguard',
          equipped_skin: profileData.equippedSkin || 'default_cyan',
          unlocked_skins: profileData.unlockedSkins || ['default_cyan'],
          skill_tree: profileData.skillTree || {},
          settings: profileData.settings || {},
          updated_at: new Date().toISOString()
        };

        const { data, error } = await this.client
          .from('profiles')
          .upsert(payload, { onConflict: 'id' })
          .select();

        if (error) console.warn('[Supabase Sync Profile Error]:', error.message);
        return data;
      } catch (err) {
        console.warn('[Supabase Sync Exception]:', err.message);
        return null;
      }
    }

    async fetchLeaderboard(mode = 'endless', sortBy = 'score', page = 1, limit = 10) {
      if (!this.isAvailable()) return null;
      try {
        const offset = (page - 1) * limit;
        let query = this.client
          .from('leaderboard_entries')
          .select('run_id, display_name, avatar, score, wave, survival_time, kills, max_combo, style_rank, core_type, skin_id, created_at', { count: 'exact' })
          .eq('mode', mode);

        if (sortBy === 'wave') {
          query = query.order('wave', { ascending: false }).order('score', { ascending: false });
        } else if (sortBy === 'survivalTime') {
          query = query.order('survival_time', { ascending: false }).order('score', { ascending: false });
        } else {
          query = query.order('score', { ascending: false }).order('wave', { ascending: false });
        }

        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) throw error;

        return {
          mode,
          page,
          total: count || (data ? data.length : 0),
          entries: (data || []).map((row, idx) => ({
            rank: offset + idx + 1,
            displayName: row.display_name,
            avatar: row.avatar,
            score: Number(row.score),
            wave: row.wave,
            survivalTime: row.survival_time,
            kills: row.kills,
            maxCombo: row.max_combo,
            styleRank: row.style_rank,
            coreType: row.core_type,
            skinId: row.skin_id,
            timestamp: new Date(row.created_at).getTime()
          }))
        };
      } catch (err) {
        console.warn('[Supabase Leaderboard Fetch Error]:', err.message);
        return null;
      }
    }

    async submitRun(run) {
      if (!this.isAvailable() || !this.currentUser) return null;
      try {
        const payload = {
          run_id: run.runId,
          user_id: this.currentUser.id,
          mode: run.mode || 'endless',
          daily_seed: run.dailySeed || null,
          display_name: run.displayName,
          avatar: run.avatar || 'vanguard',
          score: run.score,
          wave: run.wave,
          survival_time: run.survivalTime,
          kills: run.kills,
          max_combo: run.maxCombo || 0,
          style_rank: run.styleRank || 'D',
          core_type: run.coreType || 'vanguard',
          skin_id: run.skinId || 'default_cyan'
        };

        const { data, error } = await this.client
          .from('leaderboard_entries')
          .insert(payload)
          .select();

        if (error) console.warn('[Supabase Submit Run Error]:', error.message);
        return data;
      } catch (err) {
        console.warn('[Supabase Submit Run Exception]:', err.message);
        return null;
      }
    }
  }

  window.chronoSupabase = new ChronoSupabaseBridge();
})();
