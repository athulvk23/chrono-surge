/* =========================================================
   CHRONO SURGE: BEGINNING - ENTITIES, SKINS & COMBAT SYSTEM
   ========================================================= */

if (typeof window === 'undefined') {
  global.window = global;
  global.window.chronoAudio = { playPlayerHit() {}, playDeflect() {}, playEnemyShatter() {}, setTimeDilation() {} };
  global.window.particles = { addTrauma() {}, emitSparks() {}, addShockwave() {}, addFloatingText() {}, setChronoActive() {} };
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1));
}

// --- PLAYER VESSEL ---
class PlayerVessel {
  constructor(x, y, coreType = 'vanguard') {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16;
    this.angle = 0;
    this.coreType = coreType;

    const skills = window.progression?.profile?.skillTree || {};
    const chronoRank = skills.chrono_mastery || 0;
    const offRank = skills.offensive_systems || 0;
    const defRank = skills.defensive_systems || 0;
    const mobRank = skills.mobility_thrusters || 0;
    const empRank = skills.energy_efficiency || 0;
    const odRank = skills.overdrive_catalyst || 0;

    // Core statistics + Permanent Skill Tree bonuses
    this.maxHp = 100 + defRank * 10;
    this.hp = this.maxHp;
    this.maxShield = 70 + defRank * 12;
    this.shield = this.maxShield;
    this.shieldRechargeRate = 11 + defRank * 0.8;
    this.baseShieldRegenRate = this.shieldRechargeRate;
    this.shieldRechargeDelay = 2.8;
    this.shieldRechargeTimer = 0;

    this.maxChronoEnergy = 100;
    this.chronoEnergy = 100;
    this.chronoDrainRate = 25 * Math.pow(0.92, chronoRank); // Phase 2: 25 energy/sec default
    this.chronoRechargeRate = 8 * (1 + chronoRank * 0.10);  // Phase 2: 8 energy/sec default
    this.baseChronoRechargeRate = this.chronoRechargeRate;
    this.energyRegenDelay = 1.0;                            // Phase 2: 1.0s delay after expenditure
    this.energyRegenTimer = 0;

    // Ability Energy Costs
    this.hyperSlashCost = 20;                               // 20 energy
    this.empCost = 35;                                      // 35 energy
    this.parryCost = 15;                                    // 15 energy on successful reflection
    this.parrySkillBonus = 5;                               // 5 energy refund on success (Net: 10)

    // Skill-Based Parry Timing State Machine (Phase 3)
    this.parryWindow = 0.18;                                // 180ms active window
    this.parryRecovery = 0.30;                              // 300ms recovery window
    this.minParryInterval = 0.45;                           // 450ms minimum activation interval
    this.parryState = 'IDLE';                               // 'IDLE', 'ACTIVE', 'RECOVERY'
    this.parryTimer = 0;
    this.lastParryTimestamp = -10000;
    this.parryRadius = 75;

    this.maxEmp = 100;
    this.empCharge = 100;
    this.empRadius = 180 * (1 + empRank * 0.06);

    // Chrono Overdrive Ultimate
    this.maxOverdrive = 100;
    this.overdriveCharge = 0;
    this.overdriveGainMult = 1 + odRank * 0.15;
    this.isOverdrive = false;
    this.overdriveTimer = 0;
    this.overdriveDuration = 4.5 + odRank * 0.6;

    // Movement, Primary Pulse & Dash physics
    this.baseSpeed = 320 * (1 + mobRank * 0.06);
    this.sliceWidth = 28;
    this.sliceDamage = 130 * (1 + offRank * 0.08);
    this.baseSliceDamage = this.sliceDamage;
    this.primaryDamage = 36 * (1 + offRank * 0.08);
    this.critChance = 0.06 + offRank * 0.04;
    this.dashRangeMultiplier = 1.0 + mobRank * 0.07;

    // Primary weapon pulse cooldown
    this.fireCooldown = 0;
    this.fireRate = 0.22; // shots per sec interval

    // Core Type custom adjustments
    if (coreType === 'reaper') {
      this.maxHp = Math.round(this.maxHp * 0.8);
      this.hp = this.maxHp;
      this.maxShield = Math.round(this.maxShield * 0.75);
      this.shield = this.maxShield;
      this.dashRangeMultiplier *= 1.4;
      this.sliceWidth = 36;
      this.sliceDamage *= 1.32;
      this.baseSliceDamage = this.sliceDamage;
    } else if (coreType === 'valkyrie') {
      this.empRechargeRate *= 1.35;
      this.baseEmpRechargeRate = this.empRechargeRate;
      this.empRadius *= 1.22;
      this.fireRate = 0.17;
    }

    // Active state flags
    this.isSlowMo = false;
    this.isDashing = false;
    this.dashSegments = [];
    this.dashSegmentIdx = 0;
    this.dashT = 0;
    this.dashSpeed = 3800;

    // Trail history
    this.trail = [];
    this.maxTrail = 16;

    // Augment perks container
    this.augments = {};

    // Invulnerability
    this.invulnerableTimer = 0;
  }

  update(dt, keys = {}, width = 1200, height = 800, joyMoveX = 0, joyMoveY = 0) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    if (this.shieldRechargeTimer > 0) {
      this.shieldRechargeTimer -= dt;
    } else if (this.shield < this.maxShield && !this.isDashing) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRechargeRate * dt);
    }

    // Dash execution (Relativistic speed cut)
    if (this.isDashing) {
      if (this.dashSegments.length > 0) {
        const seg = this.dashSegments[this.dashSegmentIdx];
        const segDist = dist(seg.x1, seg.y1, seg.x2, seg.y2);
        const segDuration = Math.max(0.04, segDist / this.dashSpeed);

        this.dashT += dt / segDuration;
        if (this.dashT >= 1.0) {
          this.x = seg.x2;
          this.y = seg.y2;
          this.dashSegmentIdx++;
          this.dashT = 0;

          if (this.dashSegmentIdx >= this.dashSegments.length) {
            this.isDashing = false;
            this.dashSegments = [];
          }
        } else {
          this.x = seg.x1 + (seg.x2 - seg.x1) * this.dashT;
          this.y = seg.y1 + (seg.y2 - seg.y1) * this.dashT;
        }
      } else {
        this.isDashing = false;
      }
      return false;
    }

    // Custom keybindings + Arrow keys + Mobile virtual joystick
    const binds = window.progression?.profile?.settings?.keyBindings || {
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD'
    };

    let moveX = joyMoveX;
    let moveY = joyMoveY;
    if (keys[binds.up] || keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
    if (keys[binds.down] || keys['KeyS'] || keys['ArrowDown']) moveY += 1;
    if (keys[binds.left] || keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys[binds.right] || keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    const mag = Math.hypot(moveX, moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    const accel = this.baseSpeed * 4.5;
    this.vx += moveX * accel * dt;
    this.vy += moveY * accel * dt;

    this.vx *= Math.pow(0.85, dt * 60);
    this.vy *= Math.pow(0.85, dt * 60);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const pad = this.radius + 8;
    this.x = Math.max(pad, Math.min(width - pad, this.x));
    this.y = Math.max(pad, Math.min(height - pad, this.y));

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.pop();

    // Chrono Energy & Stasis Dynamics (Phase 2)
    if (this.isSlowMo) {
      this.chronoEnergy = Math.max(0, this.chronoEnergy - this.chronoDrainRate * dt);
      this.energyRegenTimer = this.energyRegenDelay;
      if (this.chronoEnergy <= 0) {
        this.chronoEnergy = 0;
        this.isSlowMo = false;
        if (window.chronoAudio) window.chronoAudio.setTimeDilation(false);
        if (window.particles) window.particles.setChronoActive(false);
      }
    } else if (this.energyRegenTimer > 0) {
      this.energyRegenTimer -= dt;
    } else {
      this.chronoEnergy = Math.min(this.maxChronoEnergy, this.chronoEnergy + this.chronoRechargeRate * dt);
    }

    // Skill-based Parry Timing Window State Machine (Phase 3)
    if (this.parryState === 'ACTIVE') {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) {
        this.parryState = 'RECOVERY';
        this.parryTimer = this.parryRecovery;
      }
    } else if (this.parryState === 'RECOVERY') {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) {
        this.parryState = 'IDLE';
        this.parryTimer = 0;
      }
    }

    // Synchronize EMP display charge with unified Chrono Energy
    this.empCharge = (this.chronoEnergy / this.maxChronoEnergy) * 100;
    return mag > 0.1;
  }

  consumeEnergy(amount) {
    if (amount <= 0) return true;
    if (this.chronoEnergy < amount) return false;
    this.chronoEnergy = Math.max(0, this.chronoEnergy - amount);
    this.energyRegenTimer = this.energyRegenDelay;
    return true;
  }

  addEnergy(amount) {
    if (amount <= 0) return;
    this.chronoEnergy = Math.min(this.maxChronoEnergy, Math.max(0, this.chronoEnergy + amount));
  }

  triggerParry() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - this.lastParryTimestamp < this.minParryInterval * 1000) return false;
    if (this.parryState !== 'IDLE') return false;

    this.parryState = 'ACTIVE';
    this.parryTimer = this.parryWindow;
    this.lastParryTimestamp = now;

    if (window.chronoAudio && typeof window.chronoAudio.playDeflect === 'function') {
      window.chronoAudio.playDeflect();
    }
    if (window.particles && typeof window.particles.addShockwave === 'function') {
      window.particles.addShockwave(this.x, this.y, this.parryRadius, '#00f0ff', 14);
    }
    return true;
  }

  calculateTrajectory(aimX, aimY, width, height) {
    const angle = Math.atan2(aimY - this.y, aimX - this.x);
    const maxDist = 340 * this.dashRangeMultiplier;
    const reqDist = Math.min(maxDist, dist(this.x, this.y, aimX, aimY));

    let startX = this.x;
    let startY = this.y;
    let curAngle = angle;
    let remainingDist = Math.max(60, reqDist);

    const segments = [];
    const maxBounces = (this.augments.ricochet || 0);

    for (let b = 0; b <= maxBounces; b++) {
      let targetX = startX + Math.cos(curAngle) * remainingDist;
      let targetY = startY + Math.sin(curAngle) * remainingDist;

      const pad = this.radius + 10;
      let hitWall = false;

      if (targetX < pad) {
        targetX = pad;
        hitWall = true;
      } else if (targetX > width - pad) {
        targetX = width - pad;
        hitWall = true;
      }

      if (targetY < pad) {
        targetY = pad;
        hitWall = true;
      } else if (targetY > height - pad) {
        targetY = height - pad;
        hitWall = true;
      }

      segments.push({ x1: startX, y1: startY, x2: targetX, y2: targetY });

      if (hitWall && b < maxBounces) {
        const segLen = dist(startX, startY, targetX, targetY);
        remainingDist -= segLen;
        if (remainingDist <= 10) break;

        if (targetX === pad || targetX === width - pad) {
          curAngle = Math.PI - curAngle;
        }
        if (targetY === pad || targetY === height - pad) {
          curAngle = -curAngle;
        }
        startX = targetX;
        startY = targetY;
      } else {
        break;
      }
    }

    return segments;
  }

  takeDamage(amount) {
    if (this.invulnerableTimer > 0) return false;
    if (this.isDashing && this.augments.overdriveSurge) return false;

    let remaining = Math.max(0, amount);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    this.shieldRechargeTimer = this.shieldRechargeDelay;
    if (remaining > 0) this.hp -= remaining;

    this.invulnerableTimer = 0.6;
    window.chronoAudio.playPlayerHit();
    window.particles.addTrauma(0.5);

    if (this.hp <= 0 && this.augments.hasRewind && this.augments.rewindAvailable) {
      this.augments.rewindAvailable = false;
      this.hp = this.maxHp * 0.5;
      this.shield = this.maxShield * 0.35;
      this.shieldRechargeTimer = this.shieldRechargeDelay;
      this.invulnerableTimer = 2.5;
      window.particles.addShockwave(this.x, this.y, 250, '#ffe600', 35);
      window.particles.addFloatingText(this.x, this.y, 'TEMPORAL REWIND!', '#ffe600', 22, true);
      return false;
    }

    return this.hp <= 0;
  }

  render(ctx, isSlowMo, aimX, aimY, width, height) {
    ctx.save();

    const skin = window.progression ? window.progression.getEquippedSkinDef() : {
      primary: this.coreType === 'reaper' ? '#ff0055' : (this.coreType === 'valkyrie' ? '#ffe600' : '#00f0ff'),
      secondary: '#087dff',
      trail: this.coreType === 'reaper' ? '255, 0, 85' : (this.coreType === 'valkyrie' ? '255, 230, 0' : '0, 240, 255'),
      hullShape: 'arrowhead'
    };

    // 1. Draw ribbon trail with equipped skin color
    if (this.trail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = `rgba(${skin.trail}, 0.36)`;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 2. Draw Aim Trajectory & Bounce Forecast if Slow-Mo active
    if (isSlowMo && aimX !== undefined) {
      const segments = this.calculateTrajectory(aimX, aimY, width, height);

      segments.forEach((seg, idx) => {
        ctx.save();
        ctx.strokeStyle = idx === 0 ? skin.primary : '#ffe600';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);

        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = idx === 0 ? skin.primary : '#ffe600';
        ctx.beginPath();
        ctx.arc(seg.x2, seg.y2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = idx === 0 ? skin.primary : '#ffe600';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(seg.x2, seg.y2, 10 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }

    // 3. Draw Player Core Ship
    ctx.translate(this.x, this.y);

    // Active Skill Parry Barrier Visual (Phase 3)
    if (this.parryState === 'ACTIVE') {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.parryRadius * (1 - (this.parryTimer / this.parryWindow) * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      ctx.restore();
    }

    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const coreGlow = skin.primary;
    ctx.shadowColor = coreGlow;
    ctx.shadowBlur = 18;

    if (aimX !== undefined && (isSlowMo || Math.hypot(this.vx, this.vy) <= 10)) {
      this.angle = Math.atan2(aimY - this.y, aimX - this.x);
    } else if (Math.hypot(this.vx, this.vy) > 10) {
      this.angle = Math.atan2(this.vy, this.vx);
    }
    ctx.rotate(this.angle);

    // Layered energy halo & orbital satellites
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = coreGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.05 + Math.sin(Date.now() * 0.008) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    const satCount = skin.hullShape === 'archon' ? 6 : (skin.hullShape === 'phantom' ? 4 : 3);
    for (let i = 0; i < satCount; i++) {
      const a = (i * Math.PI * 2) / satCount + Date.now() * 0.0018;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.9, 0);
      ctx.lineTo(this.radius * 2.65, -3);
      ctx.lineTo(this.radius * 2.85, 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Hull Geometry based on Official Sci-Fi Reference Sheet:
    // 01 CORE (3-blade Tri-Spiral Shuriken), 02 SPECTER (Twin Dagger Stealth), 03 NOVA (6-point Sunburst Crystal)
    ctx.fillStyle = '#060d1a';
    ctx.strokeStyle = coreGlow;
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    if (skin.hullShape === 'scythe') {
      // 02 SPECTER / VOID REAPER — Aerodynamic twin dagger-blades + needle nose
      ctx.moveTo(this.radius * 1.65, 0);
      ctx.lineTo(this.radius * 0.4, -this.radius * 0.35);
      ctx.lineTo(-this.radius * 0.3, -this.radius * 1.35);
      ctx.lineTo(-this.radius * 1.15, -this.radius * 0.75);
      ctx.lineTo(-this.radius * 0.45, 0);
      ctx.lineTo(-this.radius * 1.15, this.radius * 0.75);
      ctx.lineTo(-this.radius * 0.3, this.radius * 1.35);
      ctx.lineTo(this.radius * 0.4, this.radius * 0.35);
    } else if (skin.hullShape === 'valkyrie') {
      // 03 NOVA / PULSE VALKYRIE — 6-point Radiant Sunburst Crystalline Star
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const r = (i % 2 === 0) ? this.radius * 1.55 : this.radius * 0.55;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
    } else if (skin.hullShape === 'phantom') {
      // Diamond Void Stealth Hull
      ctx.moveTo(this.radius * 1.45, 0);
      ctx.lineTo(0, -this.radius * 1.05);
      ctx.lineTo(-this.radius * 1.1, -this.radius * 0.4);
      ctx.lineTo(-this.radius * 0.65, 0);
      ctx.lineTo(-this.radius * 1.1, this.radius * 0.4);
      ctx.lineTo(0, this.radius * 1.05);
    } else if (skin.hullShape === 'archon') {
      // Sovereign Crown Chassis
      ctx.moveTo(this.radius * 1.6, 0);
      ctx.lineTo(this.radius * 0.3, -this.radius * 0.6);
      ctx.lineTo(-this.radius * 0.2, -this.radius * 1.3);
      ctx.lineTo(-this.radius * 1.0, -this.radius * 0.5);
      ctx.lineTo(-this.radius * 0.5, 0);
      ctx.lineTo(-this.radius * 1.0, this.radius * 0.5);
      ctx.lineTo(-this.radius * 0.2, this.radius * 1.3);
      ctx.lineTo(this.radius * 0.3, this.radius * 0.6);
    } else {
      // 01 CORE / VANGUARD (Default) — 3-Blade Curved Tri-Spiral Shuriken Star
      for (let i = 0; i < 3; i++) {
        const baseAngle = (i * Math.PI * 2) / 3;
        const tipX = Math.cos(baseAngle) * this.radius * 1.55;
        const tipY = Math.sin(baseAngle) * this.radius * 1.55;
        const curveX = Math.cos(baseAngle + 0.55) * this.radius * 0.85;
        const curveY = Math.sin(baseAngle + 0.55) * this.radius * 0.85;
        const notchX = Math.cos(baseAngle + (Math.PI / 3)) * this.radius * 0.42;
        const notchY = Math.sin(baseAngle + (Math.PI / 3)) * this.radius * 0.42;
        if (i === 0) ctx.moveTo(tipX, tipY);
        else ctx.lineTo(tipX, tipY);
        ctx.quadraticCurveTo(curveX, curveY, notchX, notchY);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner glowing core ring & central crystal
    ctx.strokeStyle = skin.secondary || '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// --- PLAYER PRIMARY PULSE PROJECTILE ---
class PlayerProjectile {
  constructor(x, y, angle, damage = 36, color = '#00f0ff', isCrit = false) {
    this.x = x;
    this.y = y;
    const speed = 980;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.radius = isCrit ? 6 : 4.5;
    this.damage = isCrit ? damage * 1.75 : damage;
    this.color = isCrit ? '#ffe600' : color;
    this.isCrit = isCrit;
    this.life = 1.4;
  }

  update(dt, width, height) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.x < -30 || this.x > width + 30 || this.y < -30 || this.y > height + 30) {
      this.life = 0;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -3.5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -1.2, 8, 2.4);
    ctx.restore();
  }
}

// --- HOSTILE ANOMALIES (ENEMIES) ---
class Enemy {
  constructor(x, y, type = 'hunter', wave = 1) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.type = type;
    this.wave = wave;
    this.angle = Math.random() * Math.PI * 2;
    this.trail = [];
    this.maxTrail = 9;
    this.isDead = false;
    this.isBoss = false;
    this.isElite = false;
    this.stunTimer = 0;
    this.empImmunityTimer = 0;

    this.isMarkedByOverdrive = false;
    this.overdriveDamageAccum = 0;
    this.overdriveSliceAngle = 0;

    switch (type) {
      case 'hunter':
      case 'glider':
        this.type = 'hunter';
        this.radius = 14;
        this.hp = 70 + wave * 10;
        this.maxHp = this.hp;
        this.speed = 170 + Math.min(80, wave * 5);
        this.color = '#ff0055';
        this.scoreVal = 100;
        break;

      case 'orbiter':
      case 'sniper':
        this.type = 'orbiter';
        this.radius = 18;
        this.hp = 110 + wave * 15;
        this.maxHp = this.hp;
        this.speed = 90;
        this.color = '#ffe600';
        this.scoreVal = 200;
        this.chargeTimer = 0;
        this.chargeDuration = 2.2;
        this.isTelegraphing = false;
        break;

      case 'dasher':
      case 'juggernaut':
        this.type = 'dasher';
        this.radius = 28;
        this.hp = 320 + wave * 45;
        this.maxHp = this.hp;
        this.speed = 70;
        this.color = '#ff0055';
        this.scoreVal = 350;
        this.shootTimer = 0;
        break;

      case 'phantom':
        this.radius = 20;
        this.hp = 125 + wave * 18;
        this.maxHp = this.hp;
        this.speed = 130 + Math.min(100, wave * 4);
        this.color = '#a64cff';
        this.scoreVal = 300;
        this.teleportTimer = 1.8 + Math.random() * 1.2;
        this.burstTimer = 0.8;
        break;

      case 'boss':
        this.isBoss = true;
        this.radius = 52;
        this.hp = 2400 + wave * 600;
        this.maxHp = this.hp;
        this.speed = 85;
        this.color = '#ff0055';
        this.scoreVal = 5000;
        this.attackPhase = 0;
        this.phaseTimer = 0;
        this.laserAngle = 0;
        break;
    }
  }

  update(dt, playerX, playerY, width, height, bullets) {
    if (this.isDummy) {
      this.angle += dt * 1.2;
      this.shootTimer = (this.shootTimer || 0) + dt;
      if (this.shootTimer > 1.8 && this.dummyShoots) {
        const toPlayerAngle = Math.atan2(playerY - this.y, playerX - this.x);
        const b = new EnemyBullet(this.x, this.y, toPlayerAngle, 320, '#ff174f', 10);
        bullets.push(b);
        this.shootTimer = 0;
      }
      return;
    }

    if (this.empImmunityTimer > 0) this.empImmunityTimer -= dt;
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.vx *= Math.pow(0.85, dt * 60);
      this.vy *= Math.pow(0.85, dt * 60);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }

    const toPlayerDist = dist(this.x, this.y, playerX, playerY);
    const toPlayerAngle = Math.atan2(playerY - this.y, playerX - this.x);

    switch (this.type) {
      case 'hunter':
        this.vx += Math.cos(toPlayerAngle) * this.speed * 4 * dt;
        this.vy += Math.sin(toPlayerAngle) * this.speed * 4 * dt;
        this.vx *= Math.pow(0.9, dt * 60);
        this.vy *= Math.pow(0.9, dt * 60);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle = toPlayerAngle;
        this.shootTimer = (this.shootTimer || 0) + dt;
        if (this.shootTimer > Math.max(1.05, 1.65 - this.wave * 0.018)) {
          const b = new EnemyBullet(this.x + Math.cos(toPlayerAngle) * this.radius, this.y + Math.sin(toPlayerAngle) * this.radius, toPlayerAngle, 470, '#ff174f', 18);
          b.type = 'basic';
          b.radius = 5;
          bullets.push(b);
          window.particles.emitSparks(this.x, this.y, 5, '#ff174f', 1.1);
          this.shootTimer = 0;
        }
        break;

      case 'orbiter':
        const idealDist = 280;
        if (toPlayerDist < idealDist - 30) {
          this.vx = -Math.cos(toPlayerAngle) * this.speed;
          this.vy = -Math.sin(toPlayerAngle) * this.speed;
        } else if (toPlayerDist > idealDist + 50) {
          this.vx = Math.cos(toPlayerAngle) * this.speed;
          this.vy = Math.sin(toPlayerAngle) * this.speed;
        } else {
          this.vx = Math.cos(toPlayerAngle + Math.PI / 2) * this.speed;
          this.vy = Math.sin(toPlayerAngle + Math.PI / 2) * this.speed;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle = toPlayerAngle;

        this.chargeTimer += dt;
        if (this.chargeTimer >= this.chargeDuration) {
          const wave = new EnemyBullet(this.x, this.y, toPlayerAngle, 300, this.color, 28);
          wave.type = 'wave';
          wave.radius = 9;
          wave.wavePhase = 0;
          wave.life = 4.5;
          bullets.push(wave);
          const bolt = new EnemyBullet(this.x, this.y, toPlayerAngle + Math.PI, 220, '#ffe600', 12);
          bolt.type = 'orb';
          bolt.radius = 6;
          bolt.life = 2.2;
          bullets.push(bolt);
          this.chargeTimer = 0;
          window.particles.emitSparks(this.x, this.y, 12, this.color, 1.5);
        }
        break;

      case 'dasher':
        this.chargeTimer = (this.chargeTimer || 0) + dt;
        if (!this.isCharging && this.chargeTimer > 2.4) {
          this.isCharging = true;
          this.chargeTimer = 0;
          this.chargeAngle = toPlayerAngle;
        }
        if (this.isCharging) {
          this.vx = Math.cos(this.chargeAngle) * 650;
          this.vy = Math.sin(this.chargeAngle) * 650;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.angle = this.chargeAngle;
          if (this.chargeTimer > 0.55) {
            this.isCharging = false;
            this.chargeTimer = 0;
            const seeker = new EnemyBullet(this.x, this.y, this.chargeAngle, 255, '#ff174f', 30);
            seeker.type = 'seeker';
            seeker.radius = 8;
            seeker.homing = true;
            seeker.turnRate = 2.8;
            seeker.life = 4.5;
            bullets.push(seeker);
          }
        } else {
          this.vx *= 0.92;
          this.vy *= 0.92;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.angle = toPlayerAngle;
        }
        break;

      case 'phantom':
        this.teleportTimer -= dt;
        this.burstTimer -= dt;
        this.angle += dt * 0.9;
        if (this.teleportTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          const rr = 220 + Math.random() * 160;
          this.x = Math.max(this.radius, Math.min(width - this.radius, playerX + Math.cos(a) * rr));
          this.y = Math.max(this.radius, Math.min(height - this.radius, playerY + Math.sin(a) * rr));
          window.particles.addShockwave(this.x, this.y, 55, '#a64cff', 4);
          this.teleportTimer = 2.0 + Math.random() * 1.5;
        }
        if (this.burstTimer <= 0) {
          [-0.28, 0, 0.28].forEach(o => {
            const b = new EnemyBullet(this.x, this.y, toPlayerAngle + o, 300, '#a64cff', 16);
            b.type = 'orb';
            b.radius = 8;
            b.splitTimer = 0.7;
            bullets.push(b);
          });
          this.burstTimer = 1.9;
        }
        break;

      case 'boss':
        this.phaseTimer += dt;
        this.laserAngle += 1.05 * dt;

        // Dynamic 3-Phase transitions based on Boss Health (Reference Sheet: Awakened Core -> Ascended Form -> Final Form)
        const hpRatio = this.hp / this.maxHp;
        const targetPhase = hpRatio > 0.66 ? 0 : (hpRatio > 0.33 ? 1 : 2);
        if (targetPhase !== this.attackPhase) {
          this.attackPhase = targetPhase;
          this.phaseTimer = 0;
          if (window.particles) {
            window.particles.addTrauma(0.65);
            window.particles.emitRingShockwave(this.x, this.y, 160, this.attackPhase === 2 ? '#ff0077' : '#a64cff');
          }
          if (window.chronoAudio) {
            try {
              if (typeof window.chronoAudio.playOverdriveDetonation === 'function') {
                window.chronoAudio.playOverdriveDetonation(3);
              } else if (typeof window.chronoAudio.playOverdriveDetonate === 'function') {
                window.chronoAudio.playOverdriveDetonate(3);
              }
            } catch (audioErr) {
              console.warn('Audio play error on boss transition:', audioErr);
            }
          }
        }

        // Tracking movement towards arena center / player
        const bossSpeed = this.speed * (this.attackPhase === 2 ? 0.85 : 0.65);
        this.x += Math.cos(toPlayerAngle) * bossSpeed * dt;
        this.y += Math.sin(toPlayerAngle) * bossSpeed * dt;

        // Attack cycle within current phase
        // PHASE 1 — AWAKENED CORE: Laser Sweeps, Spiral Orbs & Minions
        if (this.attackPhase === 0) {
          const tick = Math.floor(this.phaseTimer * 10);
          if (tick % 16 === 0 && tick !== this.lastBossTick) {
            this.lastBossTick = tick;
            // Radial bullet sweep
            const count = 10;
            for (let i = 0; i < count; i++) {
              const bAngle = (i / count) * Math.PI * 2 + this.laserAngle;
              bullets.push(new EnemyBullet(this.x, this.y, bAngle, 220, '#ff174f', 16));
            }
          }
          if (tick % 8 === 0 && tick !== this.lastBossTick2) {
            this.lastBossTick2 = tick;
            // Spiral orbs
            const orbAngle = this.laserAngle * 2.2;
            const b = new EnemyBullet(this.x, this.y, orbAngle, 240, '#a64cff', 18);
            b.type = 'orb';
            bullets.push(b);
          }
        }

        // PHASE 2 — ASCENDED FORM: Spike Rings, Cross Lasers & Slicing Waves
        if (this.attackPhase === 1) {
          const tick = Math.floor(this.phaseTimer * 10);
          if (tick % 12 === 0 && tick !== this.lastBossTick) {
            this.lastBossTick = tick;
            // Slicing crescent waves
            for (let k = -1; k <= 1; k++) {
              const b = new EnemyBullet(this.x, this.y, toPlayerAngle + k * 0.28, 380, '#ffe600', 20);
              b.type = 'wave';
              b.radius = 7;
              bullets.push(b);
            }
          }
          if (tick % 24 === 0 && tick !== this.lastBossTick2) {
            this.lastBossTick2 = tick;
            // Cardinal 4-way cross laser barrage
            for (let c = 0; c < 4; c++) {
              const ca = this.laserAngle + (c * Math.PI) / 2;
              const b = new EnemyBullet(this.x, this.y, ca, 280, '#d9a7ff', 18);
              b.type = 'orb';
              bullets.push(b);
            }
          }
        }

        // PHASE 3 — FINAL FORM (COSMIC ARCHON): Black Hole Vortex & Orbital Screen-Wide Lasers
        if (this.attackPhase === 2) {
          const tick = Math.floor(this.phaseTimer * 12);
          // Gravitational pull towards boss (Black Hole Singularity)
          const p = window.chronoGame && window.chronoGame.player;
          if (p && dist(p.x, p.y, this.x, this.y) < 650) {
            const pullAngle = Math.atan2(this.y - p.y, this.x - p.x);
            p.vx += Math.cos(pullAngle) * 220 * dt;
            p.vy += Math.sin(pullAngle) * 220 * dt;
            if (Math.random() < 0.25 && window.particles) {
              window.particles.addGravitySpark(this.x, this.y, '#e0aaff');
            }
          }

          if (tick % 5 === 0 && tick !== this.lastBossTick) {
            this.lastBossTick = tick;
            // Screen-wide swirling homing void seekers
            for (let s = 0; s < 2; s++) {
              const sa = this.laserAngle * 1.8 + s * Math.PI;
              const b = new EnemyBullet(this.x, this.y, sa, 260, '#ff0055', 22);
              b.type = 'seeker';
              b.homing = true;
              b.turnRate = 0.85;
              b.life = 4.5;
              bullets.push(b);
            }
          }
        }
        break;
    }

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.pop();

    this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));
  }

  takeDamage(amount, sliceAngle) {
    this.hp -= amount;
    window.particles.emitSparks(this.x, this.y, 8, this.color, 1.2);
    if (this.hp <= 0) {
      this.isDead = true;
      window.particles.addShatterFragments(this.x, this.y, this.radius, this.color, sliceAngle || this.angle);
      window.particles.emitDirectionalSparks(this.x, this.y, sliceAngle || this.angle, Math.PI / 2, 20, this.color);
      window.chronoAudio.playEnemyShatter();
      return true;
    }
    return false;
  }

  render(ctx, chronoMode = false, performanceMode = false) {
    ctx.save();
    const originalColor = this.color;
    if (chronoMode) {
      this.color = this.type === 'hunter' ? '#ff7a45' :
        this.type === 'orbiter' ? '#ffd166' :
        this.type === 'dasher' ? '#ff3d71' :
        this.type === 'phantom' ? '#c77dff' : '#ff5a7d';
    }

    if (this.trail && this.trail.length > 2) {
      const rgb = this.color === '#ffe600' ? '255,230,0' : (this.color === '#a64cff' ? '166,76,255' : '255,0,85');
      ctx.lineCap = 'round';
      const trailStep = performanceMode ? 2 : 1;
      for (let i = this.trail.length - 1; i > 0; i -= trailStep) {
        const a = (1 - i / this.trail.length) * 0.42;
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.lineWidth = Math.max(1, this.radius * (1 - i / this.trail.length) * 0.32);
        ctx.beginPath();
        ctx.moveTo(this.trail[i].x, this.trail[i].y);
        ctx.lineTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.stroke();
      }
    }

    ctx.translate(this.x, this.y);

    if (this.type === 'orbiter' && this.chargeTimer > 0.8) {
      const chargeRatio = (this.chargeTimer - 0.8) / (this.chargeDuration - 0.8);
      ctx.save();
      ctx.rotate(this.angle);
      ctx.strokeStyle = `rgba(255, 230, 0, ${0.2 + chargeRatio * 0.6})`;
      ctx.lineWidth = 1 + chargeRatio * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(800, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#0a0d18';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = performanceMode ? 8 : 22;

    ctx.globalAlpha = performanceMode ? 0.09 : 0.16;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    switch (this.type) {
      case 'hunter':
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.45, 0);
        ctx.lineTo(-this.radius * 0.55, -this.radius * 0.92);
        ctx.lineTo(-this.radius * 0.25, -this.radius * 0.18);
        ctx.lineTo(-this.radius * 1.0, -this.radius * 0.42);
        ctx.lineTo(-this.radius * 0.62, 0);
        ctx.lineTo(-this.radius * 1.0, this.radius * 0.42);
        ctx.lineTo(-this.radius * 0.25, this.radius * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'orbiter':
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const r = this.radius * (i % 2 ? 0.84 : 1);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff3a0';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'dasher':
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.55, 0);
        ctx.lineTo(this.radius * 0.25, -this.radius * 0.28);
        ctx.lineTo(this.radius * 0.45, -this.radius * 1.0);
        ctx.lineTo(-this.radius * 0.2, -this.radius * 0.38);
        ctx.lineTo(-this.radius * 1.05, -this.radius * 0.75);
        ctx.lineTo(-this.radius * 0.48, 0);
        ctx.lineTo(-this.radius * 1.05, this.radius * 0.75);
        ctx.lineTo(-this.radius * 0.2, this.radius * 0.38);
        ctx.lineTo(this.radius * 0.45, this.radius * 1.0);
        ctx.lineTo(this.radius * 0.25, this.radius * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ff9db8';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        if (this.isCharging) {
          const pulse = 0.65 + 0.35 * Math.sin(Date.now() * 0.025);
          ctx.save();
          ctx.strokeStyle = `rgba(255,23,79,${pulse})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.beginPath();
          ctx.moveTo(-this.radius * 1.8, 0);
          ctx.lineTo(this.radius * 16, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        break;
      case 'phantom':
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 4;
          const r = i % 2 ? this.radius * 0.5 : this.radius * 1.25;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f4dfff';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'boss':
        // Official Sci-Fi Reference Sheet: 3-Phase Boss Silhouettes
        if (this.attackPhase === 0) {
          // PHASE 1 — AWAKENED CORE: Fractured crystalline violet cluster + central pulsing eye
          ctx.strokeStyle = '#a64cff';
          ctx.lineWidth = 3;
          for (let layer = 0; layer < 2; layer++) {
            const rr = this.radius * (1 + layer * 0.28);
            ctx.rotate(layer * 0.35 + Date.now() * 0.0008);
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const r = i % 2 ? rr * 0.62 : rr;
              const x = Math.cos(a) * r;
              const y = Math.sin(a) * r;
              i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          // Glowing violet eye
          ctx.fillStyle = '#d9a7ff';
          ctx.beginPath();
          ctx.arc(0, 0, 16 + Math.sin(Date.now() * 0.008) * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.attackPhase === 1) {
          // PHASE 2 — ASCENDED FORM: Winged Crystalline Deity with 4 spreading energy wings
          ctx.strokeStyle = '#d9a7ff';
          ctx.lineWidth = 3;
          // 4 Spreading Crystal Wings
          for (let w = -1; w <= 1; w += 2) {
            // Upper Wing
            ctx.beginPath();
            ctx.moveTo(0, -this.radius * 0.3);
            ctx.lineTo(w * this.radius * 1.8, -this.radius * 1.4);
            ctx.lineTo(w * this.radius * 1.3, -this.radius * 0.4);
            ctx.lineTo(w * this.radius * 1.7, 0);
            ctx.lineTo(0, this.radius * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Lower Wing
            ctx.beginPath();
            ctx.moveTo(0, this.radius * 0.2);
            ctx.lineTo(w * this.radius * 1.4, this.radius * 1.2);
            ctx.lineTo(w * this.radius * 0.8, this.radius * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          // Central Core Chasis & Crown
          ctx.beginPath();
          ctx.moveTo(0, -this.radius * 1.5);
          ctx.lineTo(this.radius * 0.5, -this.radius * 0.2);
          ctx.lineTo(0, this.radius * 1.2);
          ctx.lineTo(-this.radius * 0.5, -this.radius * 0.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ff3388';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // PHASE 3 — FINAL FORM (COSMIC ARCHON): Celestial Crown, Floating Halo Ring & 6 Grand Crystal Wings
          // Floating Cosmic Halo Ring
          ctx.save();
          ctx.strokeStyle = '#ff0077';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([12, 8]);
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 1.95, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // 6 Multi-tier Wing Spans
          ctx.strokeStyle = '#e0aaff';
          ctx.lineWidth = 3.2;
          for (let w = -1; w <= 1; w += 2) {
            ctx.beginPath();
            ctx.moveTo(0, -this.radius * 0.5);
            ctx.lineTo(w * this.radius * 2.2, -this.radius * 1.6);
            ctx.lineTo(w * this.radius * 1.6, -this.radius * 0.6);
            ctx.lineTo(w * this.radius * 2.0, 0);
            ctx.lineTo(w * this.radius * 1.5, this.radius * 0.8);
            ctx.lineTo(w * this.radius * 1.8, this.radius * 1.5);
            ctx.lineTo(0, this.radius * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          // Celestial Crown & Singularity Core
          ctx.beginPath();
          ctx.moveTo(0, -this.radius * 1.85);
          ctx.lineTo(this.radius * 0.6, -this.radius * 0.4);
          ctx.lineTo(this.radius * 0.3, this.radius * 1.35);
          ctx.lineTo(0, this.radius * 0.9);
          ctx.lineTo(-this.radius * 0.3, this.radius * 1.35);
          ctx.lineTo(-this.radius * 0.6, -this.radius * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Swirling Dark Matter Singularity
          ctx.fillStyle = '#ff0055';
          ctx.shadowColor = '#ff0077';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }

    if (this.isMarkedByOverdrive) {
      ctx.save();
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 15;

      const tagR = this.radius * 1.5;
      const spin = Date.now() * 0.006;
      ctx.rotate(spin);

      ctx.beginPath();
      ctx.moveTo(0, -tagR);
      ctx.lineTo(tagR, 0);
      ctx.lineTo(0, tagR);
      ctx.lineTo(-tagR, 0);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ff0055';
      ctx.font = '900 12px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', 0, -tagR - 6);
      ctx.restore();
    }

    this.color = originalColor;
    ctx.restore();
  }
}

// --- ENEMY BULLETS & DEFLECTION SYSTEM ---
class EnemyBullet {
  constructor(x, y, angle, speed, color = '#ff0055', damage = 20) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 4.2;
    this.color = color;
    this.damage = damage;
    this.isDeflected = false;
    this.canBeReflected = true; // Reflection eligibility declaration
    this.life = 6.0;
    this.trail = [];
    this.type = 'basic';
    this.age = 0;
    this.wavePhase = 0;
    this.homing = false;
    this.turnRate = 0;
    this.splitTimer = 0;
  }

  update(dt, width, height, enemies) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.pop();

    if (this.isDeflected) {
      this.color = '#00f0ff';
      let closest = null;
      let minD = 400;
      for (const e of enemies) {
        if (e.isDead) continue;
        const d = dist(this.x, this.y, e.x, e.y);
        if (d < minD) {
          minD = d;
          closest = e;
        }
      }
      if (closest) {
        const homeAngle = Math.atan2(closest.y - this.y, closest.x - this.x);
        const curSpeed = Math.hypot(this.vx, this.vy);
        this.vx += Math.cos(homeAngle) * 900 * dt;
        this.vy += Math.sin(homeAngle) * 900 * dt;
        const newSpeed = Math.hypot(this.vx, this.vy);
        this.vx = (this.vx / newSpeed) * curSpeed;
        this.vy = (this.vy / newSpeed) * curSpeed;
      }
    }

    this.age += dt;

    if (!this.isDeflected && this.homing) {
      const p = window.chronoGame && window.chronoGame.player;
      if (p && this.turnRate > 0) {
        const desired = Math.atan2(p.y - this.y, p.x - this.x);
        let current = Math.atan2(this.vy, this.vx);
        let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
        delta = Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, delta));
        current += delta;
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(current) * speed;
        this.vy = Math.sin(current) * speed;
      }
    }

    if (!this.isDeflected && this.type === 'orb' && this.splitTimer > 0) {
      this.splitTimer -= dt;
      if (this.splitTimer <= 0) {
        this.splitTimer = -1;
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(this.vy, this.vx) + i * 0.38;
          const child = new EnemyBullet(this.x, this.y, a, 360, '#c15cff', 12);
          child.type = 'orb-child';
          child.radius = 4;
          child.life = 2.8;
          if (window.chronoGame && window.chronoGame.bullets) window.chronoGame.bullets.push(child);
        }
      }
    }

    if (this.x < -40 || this.x > width + 40 || this.y < -40 || this.y > height + 40) {
      this.life = 0;
    }
  }

  deflect(dashAngle) {
    if (this.isDeflected || this.canBeReflected === false) return false;
    this.isDeflected = true;
    this.damage *= 2.5;
    const speed = Math.hypot(this.vx, this.vy) * 1.5;
    this.vx = Math.cos(dashAngle) * speed;
    this.vy = Math.sin(dashAngle) * speed;
    if (window.chronoAudio && typeof window.chronoAudio.playDeflect === 'function') {
      window.chronoAudio.playDeflect();
    }
    if (window.particles && typeof window.particles.emitSparks === 'function') {
      window.particles.emitSparks(this.x, this.y, 10, '#00f0ff', 1.8);
    }
    return true;
  }

  render(ctx) {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    if (this.trail && this.trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.trail.length - 1; i > 0; i--) {
        const a = (1 - i / this.trail.length) * 0.7;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = Math.max(0.8, this.radius * (1 - i / this.trail.length) * 0.75);
        ctx.beginPath();
        ctx.moveTo(this.trail[i].x - this.x, this.trail[i].y - this.y);
        ctx.lineTo(this.trail[i - 1].x - this.x, this.trail[i - 1].y - this.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    if (this.type === 'wave') {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.22 + 0.22 * i;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-i * 9, 0, 10 + i * 6, -Math.PI * 0.72, Math.PI * 0.72);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath();
      ctx.arc(5, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'seeker') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#180a19';
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'orb' || this.type === 'orb-child') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.radius * 1.8, 0);
      ctx.lineTo(-this.radius * 0.8, -this.radius * 0.65);
      ctx.lineTo(-this.radius * 0.3, 0);
      ctx.lineTo(-this.radius * 0.8, this.radius * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.radius * 0.2, 0, this.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --- COMBAT PICKUPS & XP COLLECTIBLES (Official Sci-Fi Reference Sheet) ---
class EnergyOrb {
  constructor(x, y, value = 1, type = 'xp') {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 60;
    this.vy = (Math.random() - 0.5) * 60;
    this.radius = type === 'xp' ? 5.5 : 8.5;
    this.value = value;
    this.type = type;
    this.life = 18;
  }

  update(dt, playerX, playerY) {
    const d = dist(this.x, this.y, playerX, playerY);
    if (d < 240) {
      const pull = (1 - d / 240) * 850;
      const angle = Math.atan2(playerY - this.y, playerX - this.x);
      this.vx += Math.cos(angle) * pull * dt;
      this.vy += Math.sin(angle) * pull * dt;
    }

    this.vx *= 0.94;
    this.vy *= 0.94;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'health') {
      // Health: Cyan Medical Cross
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#00f0ff';
      const w = 3.5, l = 9;
      ctx.fillRect(-w / 2, -l / 2, w, l);
      ctx.fillRect(-l / 2, -w / 2, l, w);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2, -l / 2, w, l);
      ctx.strokeRect(-l / 2, -w / 2, l, w);
    } else if (this.type === 'shield') {
      // Shield: Concentric Azure Barrier Sphere
      ctx.shadowColor = '#087dff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#087dff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(8, 125, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'chrono') {
      // Chrono Charge: Cyan Stopwatch Dial
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      // Dial needle
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const na = Date.now() * 0.006;
      ctx.lineTo(Math.cos(na) * 5, Math.sin(na) * 5);
      ctx.stroke();
    } else if (this.type === 'overdrive') {
      // Overdrive: Crimson Energy Diamond
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'multiplier') {
      // Multiplier: Golden 4-point Star
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 ? 3.5 : 8;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'shard') {
      // Shard: Isometric Glowing Cyan 3D Cube
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.6;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -3.5);
      ctx.lineTo(6, 3.5);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 3.5);
      ctx.lineTo(-6, -3.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(0, 7);
      ctx.moveTo(0, 0); ctx.lineTo(6, -3.5);
      ctx.moveTo(0, 0); ctx.lineTo(-6, -3.5);
      ctx.stroke();
    } else {
      // XP: Quantum Radiant Orb
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    PlayerVessel,
    Enemy,
    EnemyBullet,
    PlayerProjectile,
    EnergyOrb
  };
}
