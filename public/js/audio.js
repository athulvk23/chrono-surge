/* =========================================================
   CHRONO SURGE: BEGINNING - DYNAMIC PROCEDURAL AUDIO SYNTH
   ========================================================= */

class ChronoAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.filterNode = null;
    this.isMuted = false;
    this.initialized = false;

    this.masterVolume = 0.75;
    this.musicVolume = 0.7;
    this.sfxVolume = 0.85;

    // Music stems & sequencer state
    this.isPlayingMusic = false;
    this.bpm = 132;
    this.step = 0;
    this.currentRank = 'D';
    this.timerId = null;

    // Stem gain nodes
    this.bassGain = null;
    this.drumsGain = null;
    this.arpGain = null;
    this.leadGain = null;

    // Chord progression (Cyberpunk minor synth: Dm - Bb - F - C)
    this.chordFrequencies = [
      [146.83, 174.61, 220.00], // Dm
      [116.54, 146.83, 174.61], // Bb
      [174.61, 220.00, 261.63], // F
      [130.81, 164.81, 196.00]  // C
    ];
    this.currentChordIdx = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output chain with bullet-time lowpass filter
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(18000, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(1.8, this.ctx.currentTime);

      // Real-time FFT Analyser for beat-reactive visual effects
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

      // Connect music stems -> filter -> musicGain -> master -> analyser -> destination
      this.filterNode.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Stem gain busses
      this.bassGain = this.ctx.createGain();
      this.drumsGain = this.ctx.createGain();
      this.arpGain = this.ctx.createGain();
      this.leadGain = this.ctx.createGain();

      this.bassGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.drumsGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.arpGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.leadGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.bassGain.connect(this.filterNode);
      this.drumsGain.connect(this.filterNode);
      this.arpGain.connect(this.filterNode);
      this.leadGain.connect(this.filterNode);

      this.initialized = true;
      this.applySettingsFromProfile();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  applySettingsFromProfile() {
    if (window.progression && window.progression.profile && window.progression.profile.settings) {
      const s = window.progression.profile.settings;
      this.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume, s.muted);
    } else {
      this.setVolumes(this.masterVolume, this.musicVolume, this.sfxVolume, this.isMuted);
    }
  }

  setVolumes(master = this.masterVolume, music = this.musicVolume, sfx = this.sfxVolume, muted = this.isMuted) {
    this.masterVolume = Math.max(0, Math.min(1, Number(master)));
    this.musicVolume = Math.max(0, Math.min(1, Number(music)));
    this.sfxVolume = Math.max(0, Math.min(1, Number(sfx)));
    this.isMuted = Boolean(muted);

    if (this.initialized && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, now, 0.04);
      this.musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.04);
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.04);
    }
  }

  resumeContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setVolumes(this.masterVolume, this.musicVolume, this.sfxVolume, this.isMuted);
    if (window.progression && window.progression.profile) {
      window.progression.profile.settings.muted = this.isMuted;
      window.progression.saveLocalProfile();
    }
    return this.isMuted;
  }

  // --- TIME DILATION FILTER EFFECT (BULLET TIME AUDIO) ---
  setTimeDilation(isSlowMo) {
    if (!this.initialized || !this.filterNode) return;
    const now = this.ctx.currentTime;
    if (isSlowMo) {
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setTargetAtTime(480, now, 0.06);
      this.filterNode.Q.setTargetAtTime(4.5, now, 0.06);
    } else {
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setTargetAtTime(18000, now, 0.08);
      this.filterNode.Q.setTargetAtTime(1.5, now, 0.08);
    }
  }

  // --- PROCEDURAL CYBERPUNK MUSIC SEQUENCER ---
  startMusic() {
    if (this.isPlayingMusic || !this.initialized) return;
    this.isPlayingMusic = true;
    this.step = 0;
    const stepDuration = (60 / this.bpm) / 4; // 16th notes
    let nextStepTime = this.ctx.currentTime + 0.05;

    const schedule = () => {
      if (!this.isPlayingMusic) return;
      while (nextStepTime < this.ctx.currentTime + 0.1) {
        this.playSequencerStep(this.step, nextStepTime);
        this.step = (this.step + 1) % 64;
        if (this.step % 16 === 0) {
          this.currentChordIdx = (this.currentChordIdx + 1) % this.chordFrequencies.length;
        }
        nextStepTime += stepDuration;
      }
      this.timerId = setTimeout(schedule, 25);
    };
    schedule();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.timerId) clearTimeout(this.timerId);
  }

  playSequencerStep(step, time) {
    if (!this.ctx || this.isMuted) return;

    const chord = this.chordFrequencies[this.currentChordIdx];
    const rootFreq = chord[0];

    if (step % 4 === 0 && this.drumsGain.gain.value > 0.05) {
      this.triggerKick(time);
    }
    if ((step % 16 === 4 || step % 16 === 12) && this.drumsGain.gain.value > 0.1) {
      this.triggerSnare(time);
    }
    if (this.drumsGain.gain.value > 0.2) {
      const accent = (step % 2 === 0) ? 0.08 : 0.03;
      this.triggerHiHat(time, accent);
    }
    if (this.bassGain.gain.value > 0.05) {
      const bassPattern = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
      if (bassPattern[step % 16]) {
        const octave = (step % 8 === 4) ? 2 : 1;
        this.triggerBass(time, (rootFreq / 2) * octave);
      }
    }
    if (this.arpGain.gain.value > 0.05) {
      const noteIdx = (step % 4);
      const freq = (noteIdx < 3 ? chord[noteIdx] : chord[1]) * 2;
      this.triggerArp(time, freq);
    }
    if (this.leadGain.gain.value > 0.05 && (step % 8 === 0 || step % 8 === 3 || step % 8 === 6)) {
      const leadNotes = [rootFreq * 4, rootFreq * 4.5, rootFreq * 3, rootFreq * 4];
      this.triggerLead(time, leadNotes[Math.floor(step / 16) % leadNotes.length]);
    }
  }

  // --- DRUM SYNTHESIZERS ---
  triggerKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.drumsGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  triggerSnare(time) {
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.drumsGain);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  triggerHiHat(time, volume) {
    const bufferSize = this.ctx.sampleRate * 0.03;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumsGain);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  // --- MELODIC SYNTHESIZERS ---
  triggerBass(time, freq) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, time);
    filter.frequency.exponentialRampToValueAtTime(150, time + 0.14);
    filter.Q.setValueAtTime(3, time);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassGain);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  triggerArp(time, freq) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(this.arpGain);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  triggerLead(time, freq) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.005, time);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.leadGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.28);
    osc2.stop(time + 0.28);
  }

  // --- ADAPTIVE MUSIC STEMS BY STYLE RANK ---
  updateStyleRank(rank) {
    if (!this.initialized || this.currentRank === rank) return;
    this.currentRank = rank;
    const now = this.ctx.currentTime;
    const ramp = 0.4;

    switch (rank) {
      case 'D':
        this.drumsGain.gain.setTargetAtTime(0.0, now, ramp);
        this.arpGain.gain.setTargetAtTime(0.2, now, ramp);
        this.leadGain.gain.setTargetAtTime(0.0, now, ramp);
        break;
      case 'C':
        this.drumsGain.gain.setTargetAtTime(0.3, now, ramp);
        this.arpGain.gain.setTargetAtTime(0.3, now, ramp);
        this.leadGain.gain.setTargetAtTime(0.0, now, ramp);
        break;
      case 'B':
        this.drumsGain.gain.setTargetAtTime(0.5, now, ramp);
        this.arpGain.gain.setTargetAtTime(0.35, now, ramp);
        this.leadGain.gain.setTargetAtTime(0.0, now, ramp);
        break;
      case 'A':
        this.drumsGain.gain.setTargetAtTime(0.7, now, ramp);
        this.arpGain.gain.setTargetAtTime(0.4, now, ramp);
        this.leadGain.gain.setTargetAtTime(0.15, now, ramp);
        break;
      case 'S':
      case 'SS':
      case 'SSS':
        this.drumsGain.gain.setTargetAtTime(0.85, now, ramp);
        this.arpGain.gain.setTargetAtTime(0.45, now, ramp);
        this.leadGain.gain.setTargetAtTime(0.35, now, ramp);
        break;
    }
  }

  // --- SOUND EFFECTS (SFX) ---
  playPrimaryPulse() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playDashSlice() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playEnemyShatter() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.16);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playDeflect() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    [1200, 1800].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  playComboChord(combo) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
    const noteIdx = Math.min(combo, scale.length - 1);
    const freq = scale[noteIdx];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  playEmpBlast() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.4);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  playLevelUp() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.35, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.3);
    });
  }

  playPlayerHit() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  getBassEnergy() {
    if (!this.initialized || !this.analyser || this.isMuted) return 0;
    this.analyser.getByteFrequencyData(this.analyserData);
    const val = (this.analyserData[0] + this.analyserData[1] + this.analyserData[2]) / 3;
    return val / 255;
  }

  playOverdriveActivate() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
    filter.Q.setValueAtTime(4, now);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.42);
  }

  playOverdriveDetonation(killsCount = 1) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.6);

    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    subOsc.start(now);
    subOsc.stop(now + 0.75);

    for (let i = 0; i < Math.min(5, killsCount); i++) {
      const ping = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();

      ping.type = 'triangle';
      const f = 800 + i * 280;
      ping.frequency.setValueAtTime(f, now + i * 0.04);
      ping.frequency.exponentialRampToValueAtTime(120, now + i * 0.04 + 0.15);

      pingGain.gain.setValueAtTime(0.3, now + i * 0.04);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);

      ping.connect(pingGain);
      pingGain.connect(this.sfxGain);

      ping.start(now + i * 0.04);
      ping.stop(now + i * 0.04 + 0.2);
    }
  }

  playOverdriveDetonate(killsCount = 1) {
    return this.playOverdriveDetonation(killsCount);
  }
}

window.chronoAudio = new ChronoAudioEngine();
