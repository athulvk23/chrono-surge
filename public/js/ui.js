/* =========================================================================
   CHRONO SURGE: BEGINNING - META UI (menus, armory, skills, leaderboard,
   profile/auth, settings, toasts). Gameplay input lives in main.js.
   ========================================================================= */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const prog = () => window.progression;

  // ---------- screen manager ----------
  const UI = {
    screenStack: [],
    show(id) {
      const el = $(id);
      if (!el) return;
      el.classList.remove('hidden');
      el.classList.add('active');
      const focusable = el.querySelector('button, input, select');
      if (focusable && !window.matchMedia('(pointer: coarse)').matches) focusable.focus({ preventScroll: true });
    },
    hide(id) {
      const el = $(id);
      if (!el) return;
      el.classList.remove('active');
      el.classList.add('hidden');
    },
    openPanel(id, returnTo = 'screen-title') {
      this.hide(returnTo);
      this.screenStack.push(returnTo);
      this.renderPanel(id);
      this.show(id);
    },
    closePanel(id) {
      this.hide(id);
      const back = this.screenStack.pop() || 'screen-title';
      this.show(back);
      if (back === 'screen-title') refreshAllMetaUI();
    },
    renderPanel(id) {
      if (id === 'screen-armory') renderArmory();
      if (id === 'screen-skills') renderSkills();
      if (id === 'screen-achievements') renderAchievements();
      if (id === 'screen-leaderboard') loadLeaderboard();
      if (id === 'screen-profile') renderProfile();
      if (id === 'screen-settings') renderSettings();
    }
  };
  window.UI = UI;

  // ---------- toasts / banners ----------
  function toast(text, kind = 'info', ms = 2800) {
    const stack = $('toast-stack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = `toast toast-${kind}`;
    t.textContent = text;
    stack.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }
  window.toast = toast;

  window.showBossIntro = function (name) {
    const el = $('boss-intro');
    if (!el) return;
    $('boss-intro-name').textContent = name;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('show'); el.classList.add('hidden'); }, 2600);
  };

  function announceUnlocks(list) {
    for (const u of list || []) {
      if (u.type === 'achievement') toast(`🏆 ${u.item.name} — +${u.item.rewardShards} shards`, 'gold', 3800);
      if (u.type === 'skin') toast(`🎨 Skin unlocked: ${u.item.name}`, 'gold', 3800);
    }
  }
  window.announceUnlocks = announceUnlocks;

  // ---------- sync status pill ----------
  function bindSyncPill() {
    const pill = $('sync-pill');
    const labels = { LOCAL: '● Saved on device', SYNCING: '◌ Syncing…', SYNCED: '● Cloud saved', OFFLINE: '● Offline — saved locally' };
    prog().onStatusChange((status, msg) => {
      pill.className = `sync-pill status-${status.toLowerCase()}`;
      pill.textContent = labels[status] || status;
      pill.title = msg || '';
    });
  }

  // ---------- main menu ----------
  function refreshAllMetaUI() {
    const p = prog().profile;
    $('title-high-score').textContent = (p.bestScore || 0).toLocaleString();
    $('title-best-wave').textContent = p.highestWave || 0;
    $('title-max-style').textContent = p.maxStyleRank || 'D';
    $('title-total-slices').textContent = (p.totalSlices || 0).toLocaleString();
    $('menu-name').textContent = p.displayName;
    $('menu-level').textContent = `Level ${p.level} · ${p.shards.toLocaleString()} shards`;
    const skin = prog().getEquippedSkinDef();
    const av = $('menu-avatar');
    av.style.setProperty('--skin', skin.primary);
    av.style.setProperty('--skin2', skin.secondary);
    document.querySelectorAll('[data-shards]').forEach(el => el.textContent = `${p.shards.toLocaleString()} shards`);
    document.querySelectorAll('.core-card').forEach(c => c.classList.toggle('active', c.dataset.core === p.equippedCore));
    applyDisplaySettings();
  }
  window.refreshAllMetaUI = refreshAllMetaUI;

  // ---------- armory ----------
  let previewSkinId = null;
  function renderArmory() {
    const p = prog().profile;
    previewSkinId = previewSkinId || p.equippedSkin;
    const list = $('skin-list');
    list.innerHTML = '';
    for (const s of window.SKIN_CATALOG) {
      const owned = p.unlockedSkins.includes(s.id);
      const equipped = p.equippedSkin === s.id;
      const canAfford = p.shards >= s.cost;
      const row = document.createElement('div');
      row.className = `skin-row${equipped ? ' equipped' : ''}${previewSkinId === s.id ? ' previewing' : ''}`;
      row.style.setProperty('--skin', s.primary);
      row.innerHTML = `
        <button class="skin-swatch" aria-label="Preview ${esc(s.name)}"></button>
        <div class="skin-meta">
          <div class="skin-name">${esc(s.name)}</div>
          <div class="skin-req">${owned ? (equipped ? 'Equipped' : 'Owned') : esc(s.unlockReq)}</div>
        </div>
        <button class="cyber-btn small ${owned ? 'secondary-btn' : 'primary-btn'}" ${equipped || (!owned && !canAfford) ? 'disabled' : ''}>
          ${equipped ? 'Equipped' : owned ? 'Equip' : `Unlock · ${s.cost}`}
        </button>`;
      row.querySelector('.skin-swatch').onclick = () => { previewSkinId = s.id; renderArmory(); };
      row.querySelector('.skin-meta').onclick = () => { previewSkinId = s.id; renderArmory(); };
      row.querySelector('.cyber-btn').onclick = () => {
        const res = prog().unlockOrEquipSkin(s.id);
        if (!res.ok) { toast(res.reason, 'error'); return; }
        toast(res.action === 'unlocked' ? `Unlocked ${s.name}` : `Equipped ${s.name}`, 'success');
        announceUnlocks(prog().evaluateUnlocks());
        previewSkinId = s.id;
        renderArmory();
        refreshAllMetaUI();
      };
      list.appendChild(row);
    }
    const skin = window.SKIN_CATALOG.find(s => s.id === previewSkinId) || window.SKIN_CATALOG[0];
    $('skin-preview-name').textContent = skin.name;
    $('skin-preview-sub').textContent = skin.subtitle;
    document.querySelectorAll('[data-shards]').forEach(el => el.textContent = `${p.shards.toLocaleString()} shards`);
    startSkinPreview(skin);
  }

  let previewRaf = null;
  function startSkinPreview(skin) {
    cancelAnimationFrame(previewRaf);
    const canvas = $('skin-preview');
    const ctx = canvas.getContext('2d');
    // Render with the real in-game PlayerVessel renderer so the preview matches gameplay.
    const vessel = new PlayerVessel(130, 130, prog().profile.equippedCore);
    vessel.radius = 34;
    const realGetter = prog().getEquippedSkinDef.bind(prog());
    let t = 0;
    const draw = () => {
      if (!$('screen-armory').classList.contains('active')) { prog().getEquippedSkinDef = realGetter; return; }
      t += 0.016;
      ctx.clearRect(0, 0, 260, 260);
      const g = ctx.createRadialGradient(130, 130, 10, 130, 130, 130);
      g.addColorStop(0, skin.primary + '33'); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 260, 260);
      vessel.x = 130 + Math.cos(t * 1.4) * 34;
      vessel.y = 130 + Math.sin(t * 2.1) * 18;
      vessel.trail.unshift({ x: vessel.x, y: vessel.y });
      if (vessel.trail.length > 18) vessel.trail.pop();
      vessel.vx = -Math.sin(t * 1.4) * 60; vessel.vy = Math.cos(t * 2.1) * 40;
      prog().getEquippedSkinDef = () => skin;
      vessel.render(ctx, false, undefined, undefined, 260, 260);
      prog().getEquippedSkinDef = realGetter;
      previewRaf = requestAnimationFrame(draw);
    };
    draw();
  }

  // ---------- skill tree ----------
  function renderSkills() {
    const p = prog().profile;
    const grid = $('skill-grid');
    grid.innerHTML = '';
    for (const b of window.SKILL_TREE_BRANCHES) {
      const rank = p.skillTree[b.id] || 0;
      const maxed = rank >= b.maxRank;
      const cost = maxed ? null : b.costs[rank];
      let locked = false, lockText = '';
      if (b.prereq && (p.skillTree[b.prereq.id] || 0) < b.prereq.rank) {
        locked = true;
        const pre = window.SKILL_TREE_BRANCHES.find(x => x.id === b.prereq.id);
        lockText = `Requires ${pre.name} rank ${b.prereq.rank}`;
      }
      const node = document.createElement('div');
      node.className = `skill-node${maxed ? ' maxed' : ''}${locked ? ' locked' : ''}`;
      const pips = Array.from({ length: b.maxRank }, (_, i) => `<span class="pip${i < rank ? ' on' : ''}"></span>`).join('');
      node.innerHTML = `
        <div class="skill-top"><span class="skill-icon">${b.icon}</span><div><div class="skill-branch">${esc(b.branch)}</div><div class="skill-name">${esc(b.name)}</div></div></div>
        <p class="skill-desc">${esc(b.desc)}</p>
        <div class="skill-pips" aria-label="Rank ${rank} of ${b.maxRank}">${pips}</div>
        <div class="skill-stat">${rank > 0 ? 'Now: ' + esc(b.statFormat(rank)) : 'Not learned'}</div>
        <button class="cyber-btn small ${locked || maxed ? 'secondary-btn' : 'primary-btn'}" ${locked || maxed || p.shards < cost ? 'disabled' : ''}>
          ${maxed ? 'Maxed' : locked ? lockText : `Upgrade · ${cost} shards`}
        </button>`;
      node.querySelector('button').onclick = () => {
        const res = prog().purchaseSkill(b.id);
        if (!res.ok) { toast(res.reason, 'error'); return; }
        toast(`${b.name} → rank ${res.newRank}`, 'success');
        node.classList.add('just-upgraded');
        announceUnlocks(prog().evaluateUnlocks());
        renderSkills();
        refreshAllMetaUI();
      };
      grid.appendChild(node);
    }
    document.querySelectorAll('[data-shards]').forEach(el => el.textContent = `${p.shards.toLocaleString()} shards`);
  }

  // ---------- achievements ----------
  function renderAchievements() {
    const p = prog().profile;
    const grid = $('ach-grid');
    grid.innerHTML = '';
    let done = 0;
    for (const a of window.ACHIEVEMENTS_CATALOG) {
      const got = p.achievements.includes(a.id);
      if (got) done++;
      const el = document.createElement('div');
      el.className = `ach${got ? ' got' : ''}`;
      el.innerHTML = `<span class="ach-icon">${got ? a.icon : '🔒'}</span><div><div class="ach-name">${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div><div class="ach-reward">${got ? 'Unlocked' : `Reward: ${a.rewardShards} shards`}</div></div>`;
      grid.appendChild(el);
    }
    $('ach-count').textContent = `${done} / ${window.ACHIEVEMENTS_CATALOG.length}`;
  }

  // ---------- leaderboard ----------
  const lbState = { mode: 'endless', sortBy: 'score', page: 1, total: 0 };
  async function loadLeaderboard() {
    const body = $('lb-body');
    body.innerHTML = '<div class="lb-state">Accessing verified telemetry…</div>';
    try {
      const qs = new URLSearchParams({ mode: lbState.mode, sortBy: lbState.sortBy, page: lbState.page, limit: 10 });
      const res = await fetch(`/api/leaderboard?${qs}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      lbState.total = data.total;
      $('lb-page').textContent = `Page ${data.page} of ${Math.max(1, Math.ceil(data.total / 10))}`;
      $('lb-prev').disabled = data.page <= 1;
      $('lb-next').disabled = data.page * 10 >= data.total;
      if (!data.entries || !data.entries.length) {
        body.innerHTML = `<div class="lb-state">${lbState.mode === 'daily' ? 'No verified daily runs recorded today. Be the first operative to claim rank 1!' : 'No verified runs yet. Complete a run to claim the first position.'}</div>`;
        return;
      }
      const me = prog().profile.displayName;
      const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      body.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Operative</th><th>Score</th><th>Wave</th><th>Time</th><th>Style</th></tr></thead><tbody>${
        data.entries.map(e => `<tr class="${e.displayName === me ? 'me' : ''}"><td>${e.rank}</td><td><span class="lb-dot" style="--c:${(window.SKIN_CATALOG.find(s => s.id === e.skinId) || {}).primary || '#00f0ff'}"></span>${esc(e.displayName)}</td><td>${e.score.toLocaleString()}</td><td>${e.wave}</td><td>${fmtT(e.survivalTime)}</td><td>${esc(e.styleRank)}</td></tr>`).join('')
      }</tbody></table>`;
    } catch (e) {
      // Direct Supabase Query or Honest Local History Fallback (Zero fake bots)
      let entries = [];
      if (window.ChronoSupabase && window.ChronoSupabase.isConfigured()) {
        try {
          const sbRes = await window.ChronoSupabase.getLeaderboard(lbState.mode, 10);
          if (sbRes && sbRes.entries) entries = sbRes.entries;
        } catch {
          entries = [];
        }
      }

      const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (entries.length > 0) {
        lbState.total = entries.length;
        $('lb-page').textContent = `Page 1 of 1`;
        $('lb-prev').disabled = true;
        $('lb-next').disabled = true;
        const me = prog().profile.displayName;
        body.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Operative</th><th>Score</th><th>Wave</th><th>Time</th><th>Style</th></tr></thead><tbody>${
          entries.map(e => `<tr class="${e.displayName === me ? 'me' : ''}"><td>${e.rank}</td><td><span class="lb-dot" style="--c:${(window.SKIN_CATALOG.find(s => s.id === e.skinId) || {}).primary || '#00f0ff'}"></span>${esc(e.displayName)}</td><td>${e.score.toLocaleString()}</td><td>${e.wave}</td><td>${fmtT(e.survivalTime)}</td><td>${esc(e.styleRank)}</td></tr>`).join('')
        }</tbody></table><div class="lb-state" style="margin-top:8px;font-size:0.75rem;color:#798ba8;">Direct Cloud Database Telemetry Active</div>`;
        return;
      }

      // If no cloud entries, display verified runs recorded locally on this device
      const localRuns = (prog().profile.runHistory || []).filter(r => !lbState.mode || r.mode === lbState.mode);
      if (localRuns.length > 0) {
        const sorted = [...localRuns].sort((a, b) => b.score - a.score).slice(0, 10);
        const me = prog().profile.displayName;
        body.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Operative</th><th>Score</th><th>Wave</th><th>Time</th><th>Style</th></tr></thead><tbody>${
          sorted.map((e, idx) => `<tr class="me"><td>${idx + 1}</td><td><span class="lb-dot" style="--c:${(window.SKIN_CATALOG.find(s => s.id === (prog().profile.equippedSkin || 'default_cyan')) || {}).primary || '#00f0ff'}"></span>${esc(me)}</td><td>${e.score.toLocaleString()}</td><td>${e.wave}</td><td>${fmtT(e.survivalTimeSec || e.survivalTime || 0)}</td><td>${esc(e.styleRank || 'B')}</td></tr>`).join('')
        }</tbody></table><div class="lb-state" style="margin-top:8px;font-size:0.75rem;color:#798ba8;">Local Device Verified Telemetry (Server offline)</div>`;
      } else {
        body.innerHTML = `<div class="lb-state">No verified runs recorded yet. Complete a run to claim the first position.</div>`;
      }
    }
  }

  // ---------- profile & auth tabs ----------
  function setAuthTab(tabName) {
    const tabs = { login: $('tab-auth-login'), register: $('tab-auth-register'), forgot: $('tab-auth-forgot') };
    const panes = { login: $('form-signin'), register: $('form-register'), forgot: $('form-forgot') };
    Object.keys(tabs).forEach(k => {
      if (tabs[k]) tabs[k].classList.toggle('active', k === tabName);
      if (panes[k]) panes[k].classList.toggle('hidden', k !== tabName);
    });
    if ($('auth-error')) $('auth-error').textContent = '';
    if ($('auth-success')) $('auth-success').textContent = '';
  }

  // ---------- profile & auth ----------
  function renderProfile() {
    const p = prog().profile;
    $('profile-name').value = p.displayName;
    const fmtT = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
    const stats = [
      ['Level', p.level], ['XP', p.xp.toLocaleString()], ['Shards', p.shards.toLocaleString()],
      ['Best score', p.bestScore.toLocaleString()], ['Highest wave', p.highestWave], ['Longest survival', fmtT(p.longestSurvivalSec || 0)],
      ['Total kills', p.totalKills.toLocaleString()], ['Deflects', p.totalDeflects.toLocaleString()], ['Runs completed', p.completedRuns],
      ['Achievements', `${p.achievements.length}/${window.ACHIEVEMENTS_CATALOG.length}`], ['Skins owned', p.unlockedSkins.length], ['Player ID', p.playerId]
    ];
    $('profile-stats').innerHTML = stats.map(([k, v]) => `<div class="pstat"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
    const hist = p.runHistory || [];
    $('run-history').innerHTML = hist.length
      ? hist.slice(0, 8).map(r => `<div class="run-row"><span>${new Date(r.timestamp).toLocaleDateString()}</span><span>${esc(r.mode || 'endless')}</span><span>W${r.wave}</span><strong>${r.score.toLocaleString()}</strong></div>`).join('')
      : '<div class="lb-state">No verified runs recorded yet.</div>';

    const signedIn = !!prog().token;
    const badge = $('account-status-badge');
    if (badge) {
      badge.className = signedIn ? 'sync-pill status-cloud' : 'sync-pill status-local';
      badge.textContent = signedIn ? 'CLOUD OPERATIVE' : 'GUEST MODE';
    }

    const formsBox = $('account-forms');
    const signedBox = $('account-signed-in');
    if (formsBox) formsBox.classList.toggle('hidden', signedIn);
    if (signedBox) signedBox.classList.toggle('hidden', !signedIn);

    if (signedIn) {
      const uDisp = $('user-display-name');
      const uId = $('user-account-id');
      if (uDisp) uDisp.textContent = prog().user?.username || prog().profile.displayName || 'Operative';
      if (uId) uId.textContent = prog().user?.id || prog().profile.playerId || '---';
    }

    $('account-status').textContent = signedIn
      ? `Signed in as ${prog().user?.username || 'operative'}. Progress syncs to the cloud after runs and upgrades.`
      : 'Playing as guest. Progress is saved on this device only.';
    
    if ($('auth-error')) $('auth-error').textContent = '';
    if ($('auth-success')) $('auth-success').textContent = '';
  }

  let checkAvailTimer = null;
  function setupCallsignCheck() {
    const regInput = $('reg-user');
    const badge = $('callsign-avail-badge');
    if (!regInput || !badge) return;
    regInput.addEventListener('input', () => {
      clearTimeout(checkAvailTimer);
      const val = regInput.value.trim();
      if (!val) {
        badge.className = 'avail-badge';
        badge.textContent = 'Check availability';
        return;
      }
      if (val.length < 3) {
        badge.className = 'avail-badge warn';
        badge.textContent = 'Min 3 chars';
        return;
      }
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(val)) {
        badge.className = 'avail-badge err';
        badge.textContent = 'Alphanumeric, _ - only';
        return;
      }
      badge.className = 'avail-badge checking';
      badge.textContent = 'Checking…';
      checkAvailTimer = setTimeout(async () => {
        try {
          const res = await prog().checkUsernameAvailability(val);
          if (res.available) {
            badge.className = 'avail-badge avail';
            badge.textContent = '✓ Available';
          } else {
            badge.className = 'avail-badge err';
            badge.textContent = `✗ ${res.reason || 'Unavailable'}`;
          }
        } catch {
          badge.className = 'avail-badge warn';
          badge.textContent = 'Offline check';
        }
      }, 350);
    });
  }

  async function doAuth(kind) {
    const errEl = $('auth-error');
    const succEl = $('auth-success');
    if (errEl) errEl.textContent = '';
    if (succEl) succEl.textContent = '';
    try {
      if (kind === 'login') {
        const u = $('auth-user').value.trim();
        const pw = $('auth-pass').value;
        if (!u || !pw) {
          if (errEl) errEl.textContent = 'Enter your callsign/email and security key.';
          return;
        }
        await prog().loginAccount(u, pw);
        if ($('auth-pass')) $('auth-pass').value = '';
        toast('Cloud profile restored', 'success');
      } else if (kind === 'register') {
        const u = $('reg-user').value.trim();
        const email = $('reg-email').value.trim() || null;
        const pw = $('reg-pass').value;
        if (!u || !pw) {
          if (errEl) errEl.textContent = 'Callsign and security key are required.';
          return;
        }
        if (pw.length < 6) {
          if (errEl) errEl.textContent = 'Security key must be at least 6 characters.';
          return;
        }
        await prog().registerAccount(u, pw, email);
        if ($('reg-pass')) $('reg-pass').value = '';
        toast('Account created — guest progress uploaded', 'success');
      }
      renderProfile();
      refreshAllMetaUI();
    } catch (e) {
      if (errEl) errEl.textContent = e.message || 'Authentication failed. Please verify credentials.';
    }
  }

  async function doForgot() {
    const ident = $('forgot-ident').value.trim();
    const errEl = $('auth-error');
    const succEl = $('auth-success');
    if (errEl) errEl.textContent = '';
    if (succEl) succEl.textContent = '';
    if (!ident) {
      if (errEl) errEl.textContent = 'Enter your callsign or email address.';
      return;
    }
    try {
      const res = await prog().requestPasswordReset(ident);
      if (succEl) succEl.textContent = res.message || 'Recovery dispatched. Check your instructions to reset key.';
      toast('Recovery request dispatched', 'info');
    } catch (e) {
      if (errEl) errEl.textContent = e.message || 'Recovery request failed.';
    }
  }

  async function doGoogleAuth() {
    const errEl = $('auth-error');
    if (errEl) errEl.textContent = '';
    try {
      await prog().loginWithGoogle();
      renderProfile();
      refreshAllMetaUI();
    } catch (e) {
      if (errEl) errEl.textContent = e.message || 'Google authentication failed.';
    }
  }

  // ---------- settings ----------
  const ACTION_LABELS = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', fire: 'Primary pulse', emp: 'EMP repulse', overdrive: 'Overdrive' };
  const DEFAULT_BINDS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', emp: 'Space', overdrive: 'KeyF', fire: 'KeyE' };
  let capturingAction = null;

  function prettyKey(code) {
    return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Space').replace(/^Arrow/, '↑').replace('ShiftLeft', 'L-Shift');
  }

  function renderSettings() {
    const s = prog().profile.settings;
    $('set-master').value = s.masterVolume;
    $('set-music').value = s.musicVolume;
    $('set-sfx').value = s.sfxVolume;
    $('set-muted').checked = s.muted;
    $('set-reduced').checked = s.reducedMotion;
    $('set-contrast').checked = s.highContrast;
    $('set-crt').checked = s.crtEnabled;
    $('set-aim').checked = s.aimAssist;
    $('set-touch').value = s.mobileControlsMode;
    const list = $('keybind-list');
    list.innerHTML = '';
    for (const [action, label] of Object.entries(ACTION_LABELS)) {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      row.innerHTML = `<span>${label}</span><button class="keycap" data-action="${action}">${capturingAction === action ? 'Press a key…' : esc(prettyKey(s.keyBindings[action]))}</button>`;
      row.querySelector('button').onclick = () => { capturingAction = action; renderSettings(); };
      list.appendChild(row);
    }
  }

  function saveSettings() {
    const s = prog().profile.settings;
    s.masterVolume = parseFloat($('set-master').value);
    s.musicVolume = parseFloat($('set-music').value);
    s.sfxVolume = parseFloat($('set-sfx').value);
    s.muted = $('set-muted').checked;
    s.reducedMotion = $('set-reduced').checked;
    s.highContrast = $('set-contrast').checked;
    s.crtEnabled = $('set-crt').checked;
    s.aimAssist = $('set-aim').checked;
    s.mobileControlsMode = $('set-touch').value;
    window.chronoAudio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume, s.muted);
    applyDisplaySettings();
    prog().saveLocalProfile();
    clearTimeout(saveSettings._t);
    saveSettings._t = setTimeout(() => prog().syncToCloud(), 1200);
  }

  function applyDisplaySettings() {
    const s = prog().profile.settings;
    document.body.classList.toggle('reduced-motion', !!s.reducedMotion);
    document.body.classList.toggle('high-contrast', !!s.highContrast);
    $('crt-overlay').classList.toggle('disabled', !s.crtEnabled);
    $('sound-icon').textContent = s.muted ? '🔇' : '🔊';
    if (typeof window.updateTouchControlsVisibility === 'function') window.updateTouchControlsVisibility();
  }
  window.applyDisplaySettings = applyDisplaySettings;

  // Key capture for rebinding (runs before gameplay handlers)
  window.addEventListener('keydown', (e) => {
    if (!capturingAction) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { capturingAction = null; renderSettings(); return; }
    const binds = prog().profile.settings.keyBindings;
    const conflict = Object.entries(binds).find(([a, c]) => c === e.code && a !== capturingAction);
    if (conflict) {
      // Swap so no action is ever left unbound.
      binds[conflict[0]] = binds[capturingAction];
      toast(`Swapped with ${ACTION_LABELS[conflict[0]]}`, 'info');
    }
    binds[capturingAction] = e.code;
    capturingAction = null;
    prog().saveLocalProfile();
    renderSettings();
  }, true);

  // ---------- wiring ----------
  function wire() {
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => UI.openPanel(b.dataset.open)));
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => UI.closePanel(b.closest('.ui-screen').id)));

    document.querySelectorAll('.tab[data-lb-mode]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.tab[data-lb-mode]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      lbState.mode = tab.dataset.lbMode; lbState.sortBy = tab.dataset.lbSort; lbState.page = 1;
      loadLeaderboard();
    }));
    $('lb-prev').onclick = () => { if (lbState.page > 1) { lbState.page--; loadLeaderboard(); } };
    $('lb-next').onclick = () => { if (lbState.page * 10 < lbState.total) { lbState.page++; loadLeaderboard(); } };

    $('btn-save-name').onclick = () => {
      const name = $('profile-name').value.trim().replace(/[<>]/g, '');
      if (name.length < 2) { toast('Callsign needs at least 2 characters', 'error'); return; }
      prog().profile.displayName = name.slice(0, 24).toUpperCase();
      prog().syncToCloud();
      toast('Callsign saved', 'success');
      renderProfile(); refreshAllMetaUI();
    };
    $('btn-login').onclick = () => doAuth('login');
    $('btn-register').onclick = () => doAuth('register');
    $('btn-logout').onclick = () => { prog().logout(); toast('Signed out. Local progress kept on this device.', 'info'); renderProfile(); };

    // Auth Terminal Tabs
    $('tab-auth-login')?.addEventListener('click', () => setAuthTab('login'));
    $('tab-auth-register')?.addEventListener('click', () => setAuthTab('register'));
    $('tab-auth-forgot')?.addEventListener('click', () => setAuthTab('forgot'));

    // Auth Buttons & Guest Continuations
    $('btn-google-auth')?.addEventListener('click', doGoogleAuth);
    $('btn-forgot-submit')?.addEventListener('click', doForgot);
    $('btn-sync-now')?.addEventListener('click', async () => {
      try {
        toast('Synchronizing with cloud…', 'info');
        await prog().syncToCloud();
        toast('Cloud profile synchronized', 'success');
      } catch (e) {
        toast('Sync failed: ' + (e.message || 'offline'), 'error');
      }
    });
    $('btn-continue-guest-1')?.addEventListener('click', () => UI.closePanel('screen-profile'));
    $('btn-continue-guest-2')?.addEventListener('click', () => UI.closePanel('screen-profile'));
    setupCallsignCheck();

    ['set-master', 'set-music', 'set-sfx'].forEach(id => $(id).addEventListener('input', saveSettings));
    ['set-muted', 'set-reduced', 'set-contrast', 'set-crt', 'set-aim', 'set-touch'].forEach(id => $(id).addEventListener('change', saveSettings));
    $('btn-reset-keys').onclick = () => { prog().profile.settings.keyBindings = { ...DEFAULT_BINDS }; prog().saveLocalProfile(); renderSettings(); toast('Controls reset', 'info'); };
    $('btn-fullscreen').onclick = toggleFullscreen;
    $('btn-replay-tutorial')?.addEventListener('click', () => {
      UI.closePanel('screen-settings');
      const titleEl = $('screen-title');
      if (titleEl) {
        titleEl.classList.remove('active');
        titleEl.classList.add('hidden');
      }
      if (window.game && typeof window.game.startNewGame === 'function') {
        window.game.startNewGame(window.game.activeCore || 'vanguard', 'tutorial');
      }
      if (typeof window.updateTouchControlsVisibility === 'function') window.updateTouchControlsVisibility();
    });
    $('btn-export-save').onclick = () => {
      const blob = new Blob([JSON.stringify(prog().profile, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'chrono-surge-beginning-save.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('btn-reset-save').onclick = () => {
      if (!confirm('Reset all local progress on this device? Cloud saves are not affected.')) return;
      localStorage.removeItem('chrono_surge_beginning_save_v2');
      localStorage.removeItem('chrono_surge_beginning_save_v2_bak');
      location.reload();
    };

    bindSyncPill();
    refreshAllMetaUI();
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen || (() => Promise.reject())).call(el)?.catch?.(() => {});
    else document.exitFullscreen().catch(() => {});
  }
  window.toggleFullscreen = toggleFullscreen;

  window.addEventListener('DOMContentLoaded', wire);
})();
