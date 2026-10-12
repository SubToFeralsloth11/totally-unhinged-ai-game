// All sound is synthesised with WebAudio: no asset files. GERALD speaks with the
// browser's speech synthesiser when available, otherwise in robot babble.
import { rand, pick } from './util.js';

const SCALE = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic-ish

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('unhinged.muted') === '1';
    this.voice = localStorage.getItem('unhinged.voice') !== '0';
    this.tempo = 118;
    this.disco = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('unhinged.muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.muted) speechSynthesis?.cancel();
    return this.muted;
  }

  toggleVoice() {
    this.voice = !this.voice;
    localStorage.setItem('unhinged.voice', this.voice ? '1' : '0');
    if (!this.voice) speechSynthesis?.cancel();
    return this.voice;
  }

  tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, at = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, { vol = 0.3, at = 0, filter = 1200, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest ?? this.master);
    src.start(t);
    src.stop(t + dur);
  }

  sfx(name) {
    switch (name) {
      case 'shoot':
        return this.tone(rand(700, 900), 0.07, { vol: 0.06, slide: -400 });
      case 'hit':
        return this.tone(220, 0.06, { type: 'triangle', vol: 0.12, slide: -100 });
      case 'explode':
        return this.noiseBurst(0.35, { vol: 0.35, filter: 900 });
      case 'hurt':
        this.tone(160, 0.25, { type: 'sawtooth', vol: 0.25, slide: -120 });
        return this.noiseBurst(0.15, { vol: 0.2 });
      case 'quack':
        this.tone(520, 0.09, { type: 'sawtooth', vol: 0.15, slide: -250 });
        return this.tone(480, 0.1, { type: 'sawtooth', vol: 0.12, slide: -260, at: 0.1 });
      case 'pickup':
        [0, 4, 7, 12].forEach((s, i) => this.tone(523 * 2 ** (s / 12), 0.1, { vol: 0.1, at: i * 0.05 }));
        return;
      case 'dash':
        return this.noiseBurst(0.18, { vol: 0.15, filter: 3000 });
      case 'glitch':
        for (let i = 0; i < 8; i++) this.tone(rand(80, 2000), 0.04, { vol: 0.08, at: i * 0.03, type: pick(['square', 'sawtooth']) });
        return;
      case 'announce':
        this.tone(880, 0.12, { vol: 0.12 });
        return this.tone(1320, 0.18, { vol: 0.12, at: 0.12 });
      case 'boss':
        for (let i = 0; i < 4; i++) this.tone(55 * (i + 1), 1.2, { type: 'sawtooth', vol: 0.15, at: i * 0.25, slide: -20 });
        return;
    }
  }

  // GERALD's voice. Speech synthesis with a random personality per line, else babble.
  speak(text, { glitch = false } = {}) {
    if (this.muted || !text) return;
    if (this.voice && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = glitch ? rand(0, 0.3) : rand(0.6, 1.6);
      u.rate = glitch ? 0.8 : rand(1, 1.25);
      u.volume = 0.9;
      speechSynthesis.speak(u);
      return;
    }
    this.babble(text);
  }

  babble(text) {
    if (!this.ctx) return;
    const chars = text.slice(0, 80).replace(/\s+/g, '');
    for (let i = 0; i < chars.length; i += 2) {
      const code = chars.charCodeAt(i);
      this.tone(180 + (code % 24) * 22, 0.05, { vol: 0.05, at: i * 0.028, type: 'square' });
    }
  }

  // --- procedural music ----------------------------------------------------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  schedule() {
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const at = this.nextNoteTime - this.ctx.currentTime;
      const s = this.step % 16;
      const root = [45, 45, 41, 43][Math.floor(this.step / 16) % 4];
      const hz = (n) => 440 * 2 ** ((n - 69) / 12);
      if (s % 4 === 0) this.tone(55, 0.18, { type: 'sine', vol: 0.5, slide: -30, at, dest: this.musicGain });
      if (s % 2 === 0) this.tone(hz(root), 0.14, { type: 'sawtooth', vol: 0.2, at, dest: this.musicGain });
      if (s % 3 === 0 || s === 14) this.tone(hz(root + 24 + pick(SCALE)), 0.09, { vol: 0.08, at, dest: this.musicGain });
      if (this.disco || s % 4 === 2) this.noiseBurst(0.04, { vol: 0.12, filter: 8000, at, dest: this.musicGain });
      if (s === 4 || s === 12) this.noiseBurst(0.12, { vol: 0.25, filter: 2500, at, dest: this.musicGain });
      this.step++;
      this.nextNoteTime += 60 / this.tempo / 4;
    }
  }
}
