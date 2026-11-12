// Procedural flat-six style engine sound made with the Web Audio API.
// No audio files needed. Works after the first user click.

function distortionCurve(amount) {
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.rpm = 0;
    this.state = 'off'; // off | cranking | running | stopping
    this.racing = false;
    this.decel = 0;     // seconds of "pops and bangs" left after a race
    this.target = 0;
    this.onIgnite = null;
    this.onPop = null;
    this.onRaceEnd = null;
    this.idleRpm = 900;
    this.maxRpm = 7500;
    this._crankT = 0;
    this._raceT = 0;
    this._raceDur = 4.5;
    this._t = 0;
  }

  _init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 6;
    this.comp = comp;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1.1;
    this.filter.frequency.value = 800;

    // amplitude chop gives the typical burble / rough idle
    this.chop = ctx.createGain();
    this.chop.gain.value = 0.75;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 12;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0.25;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.chop.gain);
    this.lfo.start();

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(30);
    shaper.oversample = '2x';
    shaper.connect(this.chop);
    this.chop.connect(this.filter);
    this.filter.connect(this.master);

    // harmonics: [type, frequency multiplier, gain]
    const defs = [
      ['sawtooth', 1.0, 0.5],
      ['sawtooth', 2.0, 0.28],
      ['square', 0.5, 0.3],
      ['sawtooth', 1.5, 0.1],
    ];
    this.oscs = defs.map(([type, mult, gain]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = 40 * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(shaper);
      osc.start();
      return { osc, mult };
    });

    // exhaust "air rush" noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 500;
    this.noiseFilter.Q.value = 0.7;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    this.noise.start();

    // tire screech (only audible while drifting)
    this.screechSrc = ctx.createBufferSource();
    this.screechSrc.buffer = buf;
    this.screechSrc.loop = true;
    this.screechBP = ctx.createBiquadFilter();
    this.screechBP.type = 'bandpass';
    this.screechBP.frequency.value = 2300;
    this.screechBP.Q.value = 6;
    const screechHP = ctx.createBiquadFilter();
    screechHP.type = 'highpass';
    screechHP.frequency.value = 900;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.screechSrc.connect(this.screechBP);
    this.screechBP.connect(screechHP);
    screechHP.connect(this.screechGain);
    this.screechGain.connect(this.comp);
    this.screechSrc.start();

    // starter motor whirr
    this.starter = ctx.createOscillator();
    this.starter.type = 'sawtooth';
    this.starter.frequency.value = 120;
    this.starterGain = ctx.createGain();
    this.starterGain.gain.value = 0;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 700;
    this.starter.connect(sf);
    sf.connect(this.starterGain);
    this.starterGain.connect(this.master);
    this.starter.start();
  }

  // --- one-shot bang / pop ---------------------------------------------
  pop(intensity = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900 + Math.random() * 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(f); f.connect(g); g.connect(this.comp);
    src.start(t, Math.random() * 1.5, 0.15);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.7 * intensity, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og); og.connect(this.comp);
    o.start(t); o.stop(t + 0.16);

    if (this.onPop) this.onPop(intensity);
  }

  // --- controls -----------------------------------------------------------
  start() {
    this._init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.state !== 'off') return;
    this.state = 'cranking';
    this._crankT = 0;
    this.racing = false;
    this.rpm = 0;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.5, t, 0.05);
  }

  stop() {
    if (this.state === 'off' || this.state === 'stopping') return;
    this.state = 'stopping';
    this.racing = false;
    this.target = 0;
  }

  race(duration = 4.5) {
    if (this.state !== 'running' || this.racing) return false;
    this.racing = true;
    this._raceT = 0;
    this._raceDur = duration;
    this.decel = 0;
    return true;
  }

  setScreech(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.screechGain.gain.setTargetAtTime(level * 0.2, t, 0.06);
    this.screechBP.frequency.setTargetAtTime(1800 + Math.random() * 1000 + level * 500, t, 0.04);
  }

  // --- per-frame update ---------------------------------------------------
  update(dt) {
    if (!this.ctx || this.state === 'off') return;
    this._t += dt;
    let rise = 5, fall = 2.2;

    if (this.state === 'cranking') {
      this._crankT += dt;
      this.rpm = 190 + 45 * Math.sin(this._crankT * 32);
      if (this._crankT > 1.35) {
        this.state = 'running';
        this.rpm = 1700;
        this.target = this.idleRpm;
        this.pop(1.2);
        if (this.onIgnite) this.onIgnite();
      }
    } else if (this.state === 'running') {
      if (this.racing) {
        this._raceT += dt;
        if (this._raceT < 0.4) {
          this.target = 3500;
        } else if (this._raceT < this._raceDur) {
          // rev limiter bounce
          this.target = 6600 + (Math.sin(this._t * 30) > 0 ? 800 : 0);
          rise = 9; fall = 14;
        } else {
          this.racing = false;
          this.target = this.idleRpm;
          this.decel = 1.4;
          if (this.onRaceEnd) this.onRaceEnd();
        }
      } else {
        this.target = this.idleRpm + (Math.sin(this._t * 3.1) * 25);
      }
      if (this.decel > 0) {
        this.decel -= dt;
        if (Math.random() < dt * 9) this.pop(0.35 + Math.random() * 0.5);
      }
    } else if (this.state === 'stopping') {
      this.target = 0;
      fall = 3.2;
    }

    const k = this.target > this.rpm ? rise : fall;
    if (this.state !== 'cranking') this.rpm += (this.target - this.rpm) * (1 - Math.exp(-k * dt));

    if (this.state === 'stopping' && this.rpm < 120) {
      this.state = 'off';
      this.rpm = 0;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0, t, 0.05);
      this.noiseGain.gain.setTargetAtTime(0, t, 0.05);
      this.starterGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }

    // ---- map the rpm to sound parameters ----
    const ctx = this.ctx, t = ctx.currentTime;
    const rn = Math.min(1.1, this.rpm / this.maxRpm);
    const cranking = this.state === 'cranking';
    const f = Math.max(this.rpm, 1) / 60 * 3; // flat-six: 3 firings per revolution
    const jitter = cranking ? 1 : 1 + (Math.random() - 0.5) * 0.012 * (1.2 - rn);

    for (const { osc, mult } of this.oscs) {
      osc.frequency.setTargetAtTime(Math.max(f * mult * jitter, 1), t, 0.03);
    }
    this.lfo.frequency.setTargetAtTime(Math.max(f * 0.5, 2), t, 0.05);
    this.lfoDepth.gain.setTargetAtTime(cranking ? 0.45 : 0.32 - 0.22 * rn, t, 0.05);
    this.filter.frequency.setTargetAtTime(cranking ? 450 : 260 + this.rpm * 0.95, t, 0.04);
    this.noiseFilter.frequency.setTargetAtTime(400 + this.rpm * 0.7, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(cranking ? 0.02 : 0.03 + 0.28 * rn * rn, t, 0.05);

    const level = cranking ? 0.55 : 0.5 + 0.4 * rn;
    this.master.gain.setTargetAtTime(this.state === 'stopping' ? level * 0.6 : level, t, 0.05);

    this.starterGain.gain.setTargetAtTime(cranking ? 0.07 : 0, t, 0.04);
    if (cranking) this.starter.frequency.setTargetAtTime(110 + this._crankT * 40, t, 0.05);
  }
}
