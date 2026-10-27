/* =========================================================
   CHRONO SURGE // OVERDRIVE - PARTICLE & FX ENGINE
   ========================================================= */

class ParticleEngine {
  constructor() {
    this.particles = [];
    this.shatterFragments = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.laserTrails = [];
    this.crossSlashes = [];
    this.slashArcs = [];
    this.chronoFields = [];
    this.empFields = [];
    this.overdriveSlashes = [];
    this.distortion = 0;
    this.chronoActive = false;

    // Screen shake / trauma system
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Hit-stop freeze frame timer
    this.hitStopTimer = 0;

    // Overdrive mode visuals
    this.isOverdriveVisuals = false;
    this.maxParticles = 650;
  }

  reset() {
    this.particles = [];
    this.shatterFragments = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.laserTrails = [];
    this.crossSlashes = [];
    this.slashArcs = [];
    this.chronoFields = [];
    this.empFields = [];
    this.overdriveSlashes = [];
    this.distortion = 0;
    this.chronoActive = false;
    this.trauma = 0;
    this.hitStopTimer = 0;
    this.isOverdriveVisuals = false;
    this.maxParticles = 650;
  }

  triggerHitStop(duration = 0.04) {
    this.hitStopTimer = duration;
  }

  addCrossSlash(x, y, radius = 40, color = '#ffe600') {
    this.crossSlashes.push({
      x, y, radius, color, life: 1.0, decay: 0.04
    });
  }

  addTrauma(amount) {
    if (window.progression?.profile?.settings?.reducedMotion) {
      this.trauma = Math.min(0.15, this.trauma + amount * 0.15);
      return;
    }
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setChronoActive(active, x = 0, y = 0) {
    this.chronoActive = !!active;
    if (active) {
      this.chronoFields.push({ x, y, radius: 40, life: 1, decay: 0.035 });
      this.distortion = Math.max(this.distortion, 0.75);
    }
  }

  addSlashArc(x, y, angle, radius = 110, color = '#00f0ff', width = 14) {
    this.slashArcs.push({ x, y, angle, radius, color, width, life: 1, decay: 0.055, spin: (Math.random() > .5 ? 1 : -1) * 0.05 });
  }

  addEmpField(x, y, radius = 220) {
    this.empFields.push({ x, y, radius: 10, maxRadius: radius, life: 1, decay: 0.035, rings: 3 });
    this.distortion = Math.max(this.distortion, 1);
  }

  addOverdriveSlash(x, y, angle, radius = 260) {
    this.overdriveSlashes.push({ x, y, angle, radius, life: 1, decay: 0.032, width: 20 });
  }

  // --- STANDARD PARTICLES (SPARKS, SMOKE, GLOW MOTES) ---
  emitSparks(x, y, count = 12, color = '#00f0ff', speedMultiplier = 1) {
    const allowed = Math.max(0, Math.min(count, this.maxParticles - this.particles.length));
    for (let i = 0; i < allowed; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 6 + 2) * speedMultiplier;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
        size: Math.random() * 3 + 1.5,
        color: color,
        type: 'spark'
      });
    }
  }

  emitDirectionalSparks(x, y, baseAngle, spread = Math.PI / 3, count = 15, color = '#ff0055') {
    const allowed = Math.max(0, Math.min(count, this.maxParticles - this.particles.length));
    for (let i = 0; i < allowed; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = Math.random() * 9 + 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02,
        size: Math.random() * 4 + 2,
        color: color,
        type: 'spark'
      });
    }
  }

  // --- LASER CUT TRAIL RIBBON ---
  addLaserCut(x1, y1, x2, y2, color = '#00f0ff', width = 6) {
    this.laserTrails.push({
      x1, y1, x2, y2,
      width,
      life: 1.0,
      decay: 0.045,
      color
    });
  }

  // --- SHATTERED POLYGON FRAGMENTS ---
  // When an enemy is sliced, we spawn actual fractured geometric halves
  addShatterFragments(x, y, radius, color, sliceAngle) {
    const normalAngle = sliceAngle + Math.PI / 2;
    // Two halves flying in opposite normal directions
    [-1, 1].forEach((dir) => {
      const speed = Math.random() * 5 + 4;
      this.shatterFragments.push({
        x,
        y,
        vx: Math.cos(normalAngle) * speed * dir + (Math.random() - 0.5) * 2,
        vy: Math.sin(normalAngle) * speed * dir + (Math.random() - 0.5) * 2,
        angle: sliceAngle,
        angularVelocity: (Math.random() * 0.15 + 0.05) * dir,
        radius: radius * 0.9,
        life: 1.0,
        decay: 0.025,
        color: color,
        side: dir
      });
    });
  }

  // --- EXPANDING SHOCKWAVES ---
  addShockwave(x, y, maxRadius = 120, color = '#00f0ff', duration = 25) {
    this.shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius,
      growth: maxRadius / duration,
      life: 1.0,
      decay: 1 / duration,
      color
    });
  }

  emitRingShockwave(x, y, maxRadius = 140, color = '#a64cff') {
    this.addShockwave(x, y, maxRadius, color, 30);
  }

  addGravitySpark(centerX, centerY, color = '#e0aaff') {
    if (this.particles.length >= this.maxParticles) return;
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 80;
    this.particles.push({
      x: centerX + Math.cos(a) * r,
      y: centerY + Math.sin(a) * r,
      vx: -Math.cos(a) * 4.5,
      vy: -Math.sin(a) * 4.5,
      color,
      size: 3,
      alpha: 0.8,
      decay: 0.04
    });
  }

  // --- FLOATING COMBAT TEXT ---
  addFloatingText(x, y, text, color = '#ffe600', size = 16, isCrit = false) {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 10,
      text,
      color,
      size: isCrit ? size * 1.3 : size,
      life: 1.0,
      decay: 0.022,
      vy: isCrit ? -2.5 : -1.8,
      isCrit
    });
  }

  // --- UPDATE ENGINE ---
  update(timeScale = 1.0) {
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
    // 1. Screen shake trauma decay
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 0.03 * timeScale);
      const shakePower = Math.pow(this.trauma, 2) * 16;
      this.shakeOffsetX = (Math.random() * 2 - 1) * shakePower;
      this.shakeOffsetY = (Math.random() * 2 - 1) * shakePower;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // 2. Standard particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * timeScale;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Laser trails
    for (let i = this.laserTrails.length - 1; i >= 0; i--) {
      const t = this.laserTrails[i];
      t.life -= t.decay * timeScale;
      if (t.life <= 0) {
        this.laserTrails.splice(i, 1);
      }
    }

    // 4. Shatter fragments
    for (let i = this.shatterFragments.length - 1; i >= 0; i--) {
      const f = this.shatterFragments[i];
      f.x += f.vx * timeScale;
      f.y += f.vy * timeScale;
      f.vx *= 0.97;
      f.vy *= 0.97;
      f.angle += f.angularVelocity * timeScale;
      f.life -= f.decay * timeScale;
      if (f.life <= 0) {
        this.shatterFragments.splice(i, 1);
      }
    }

    // 5. Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.growth * timeScale;
      sw.life -= sw.decay * timeScale;
      if (sw.life <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 6. Cross Slashes
    for (let i = this.crossSlashes.length - 1; i >= 0; i--) {
      const cs = this.crossSlashes[i];
      cs.life -= cs.decay * timeScale;
      if (cs.life <= 0) {
        this.crossSlashes.splice(i, 1);
      }
    }

    // 7. Ability VFX
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const a = this.slashArcs[i];
      a.life -= a.decay * timeScale; a.angle += a.spin * timeScale; a.radius += 3.5 * timeScale;
      if (a.life <= 0) this.slashArcs.splice(i, 1);
    }
    for (let i = this.chronoFields.length - 1; i >= 0; i--) {
      const f = this.chronoFields[i];
      f.life -= f.decay * timeScale; f.radius += 2.5 * timeScale;
      if (f.life <= 0) this.chronoFields.splice(i, 1);
    }
    for (let i = this.empFields.length - 1; i >= 0; i--) {
      const f = this.empFields[i];
      f.life -= f.decay * timeScale; f.radius += (f.maxRadius / 18) * timeScale;
      if (f.life <= 0 || f.radius >= f.maxRadius) this.empFields.splice(i, 1);
    }
    for (let i = this.overdriveSlashes.length - 1; i >= 0; i--) {
      const a = this.overdriveSlashes[i];
      a.life -= a.decay * timeScale; a.angle += 0.018 * timeScale; a.radius += 5 * timeScale;
      if (a.life <= 0) this.overdriveSlashes.splice(i, 1);
    }
    this.distortion = Math.max(0, this.distortion - 0.035 * timeScale);

    // 8. Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * timeScale;
      ft.life -= ft.decay * timeScale;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // --- RENDER PASS ---
  render(ctx, width, height, playerX, playerY) {
    // 0. Radial Speed Lines if in Overdrive
    if (this.isOverdriveVisuals && width && height) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = playerX || width / 2;
      const cy = playerY || height / 2;
      const linesCount = 28;
      ctx.strokeStyle = 'rgba(255, 230, 0, 0.45)';
      ctx.lineWidth = 2;
      for (let i = 0; i < linesCount; i++) {
        const angle = (i / linesCount) * Math.PI * 2 + (Date.now() * 0.005);
        const innerR = 70 + Math.random() * 50;
        const outerR = Math.max(width, height);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Draw Laser Trails
    for (const t of this.laserTrails) {
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.width * t.life;
      ctx.globalAlpha = t.life;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();

      // Core white-hot laser center
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (t.width * 0.4) * t.life;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }

    // 2. Draw Cross Slashes (Judgement Cut Markers)
    for (const cs of this.crossSlashes) {
      ctx.save();
      ctx.translate(cs.x, cs.y);
      ctx.globalAlpha = cs.life;
      ctx.strokeStyle = cs.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-cs.radius, -cs.radius);
      ctx.lineTo(cs.radius, cs.radius);
      ctx.moveTo(cs.radius, -cs.radius);
      ctx.lineTo(-cs.radius, cs.radius);
      ctx.stroke();

      // Glowing center diamond
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }

    // 3. Draw Shatter Fragments
    for (const f of this.shatterFragments) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.globalAlpha = f.life;
      ctx.strokeStyle = f.color;
      ctx.fillStyle = f.color + '33'; // translucent fill
      ctx.lineWidth = 2;

      ctx.beginPath();
      // Draw semicircle / half-polygon
      ctx.arc(0, 0, f.radius, (f.side > 0 ? 0 : Math.PI), (f.side > 0 ? Math.PI : Math.PI * 2));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Standard Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Draw Shockwaves
    for (const sw of this.shockwaves) {
      ctx.globalAlpha = sw.life;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * sw.life;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // 5. Draw cinematic ability effects
    if (this.chronoActive && playerX != null) {
      ctx.save();
      ctx.translate(playerX, playerY);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#00dfff';
      ctx.shadowColor = '#00dfff';
      ctx.shadowBlur = 24;
      for (let i = 0; i < 3; i++) {
        const r = 34 + i * 24 + Math.sin(Date.now() * 0.006 + i) * 5;
        ctx.lineWidth = 2 + i;
        ctx.beginPath();
        ctx.arc(0, 0, r, Date.now() * 0.0012 + i, Date.now() * 0.0012 + i + Math.PI * 1.55);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const f of this.chronoFields) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = f.life * 0.55;
      ctx.strokeStyle = '#00eaff'; ctx.shadowColor = '#00eaff'; ctx.shadowBlur = 20;
      ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(0, 0, f.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    for (const a of this.slashArcs) {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle); ctx.globalAlpha = a.life;
      ctx.strokeStyle = a.color; ctx.shadowColor = a.color; ctx.shadowBlur = 28; ctx.lineCap = 'round';
      ctx.lineWidth = a.width * a.life;
      ctx.beginPath(); ctx.arc(0, 0, a.radius, -0.72, 0.72); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, a.width * 0.22) * a.life;
      ctx.beginPath(); ctx.arc(0, 0, a.radius, -0.68, 0.68); ctx.stroke();
      ctx.restore();
    }

    for (const f of this.empFields) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = f.life;
      ctx.strokeStyle = '#b000ff'; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 32;
      for (let r = 0; r < f.rings; r++) {
        const rr = f.radius - r * 18;
        if (rr <= 0) continue;
        ctx.lineWidth = 3 - r * 0.5; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    for (const a of this.overdriveSlashes) {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle); ctx.globalAlpha = a.life;
      ctx.strokeStyle = '#ff174f'; ctx.shadowColor = '#ff174f'; ctx.shadowBlur = 38; ctx.lineCap = 'round';
      ctx.lineWidth = a.width * a.life; ctx.beginPath(); ctx.arc(0, 0, a.radius, -0.92, 0.92); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * a.life; ctx.beginPath(); ctx.arc(0, 0, a.radius, -0.86, 0.86); ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Floating Texts (Normal composite for crisp typography)
    ctx.save();
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `${ft.isCrit ? '900' : '700'} ${ft.size}px Orbitron, Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.isCrit ? 15 : 6;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}

window.particles = new ParticleEngine();
