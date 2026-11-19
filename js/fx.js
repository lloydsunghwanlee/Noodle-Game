/*
 * 사운드(Web Audio로 직접 합성, 외부 음원 파일 없음) · 햅틱 · 기록 저장
 */
(function () {
  const NG = window.NG;

  // ================= 사운드 =================
  const Sound = NG.Sound = {
    ctx: null, master: null, noise: null,
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.55;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate * 1.5;
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          this.noise = buf;
          this._initTremble();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* 사운드 미지원 */ }
    },
    suspend() { try { this.ctx && this.ctx.suspend(); } catch (e) {} },
    resume() { try { this.ctx && this.ctx.resume(); } catch (e) {} },
    _env(g, t, a, peak, dcy) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
    },
    // 부드러운 후루룩
    slurp(intensity) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(1900 + 500 * intensity, t + 0.22);
      const am = c.createGain();
      const g = c.createGain();
      this._env(g, t, 0.04, 0.09 + 0.06 * intensity, 0.24);
      // 후루룩 느낌의 진폭 떨림
      const lfo = c.createOscillator(); lfo.frequency.value = 22;
      const lg = c.createGain(); lg.gain.value = 0.45;
      am.gain.value = 0.6;
      lfo.connect(lg); lg.connect(am.gain);
      src.connect(bp); bp.connect(am); am.connect(g); g.connect(this.master);
      src.start(t, Math.random()); src.stop(t + 0.32);
      lfo.start(t); lfo.stop(t + 0.32);
    },
    _initTremble() {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 150;
      const am = c.createGain(); am.gain.value = 0;
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 17;
      const lg = c.createGain(); lg.gain.value = 0.5;
      const g = c.createGain(); g.gain.value = 0.5;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      lfo.connect(lg); lg.connect(am.gain);
      o.connect(am); am.connect(lp); lp.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.trem = { o, am, lfo, g };
      this.setTremble(0);
    },
    // 위험 상태 떨림음 (0~1)
    setTremble(level) {
      if (!this.trem) return;
      const t = this.ctx.currentTime;
      this.trem.g.gain.setTargetAtTime(level * 0.11, t, 0.05);
      this.trem.lfo.frequency.setTargetAtTime(12 + level * 14, t, 0.05);
      this.trem.o.frequency.setTargetAtTime(140 + level * 60, t, 0.05);
    },
    // 똑!
    snap() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
      const g = c.createGain(); this._env(g, t, 0.003, 0.5, 0.14);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.2);
      const src = c.createBufferSource(); src.buffer = this.noise;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const g2 = c.createGain(); this._env(g2, t, 0.001, 0.22, 0.035);
      src.connect(hp); hp.connect(g2); g2.connect(this.master);
      src.start(t); src.stop(t + 0.06);
      // 국물 튀는 소리
      const s2 = c.createBufferSource(); s2.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
      const g3 = c.createGain(); this._env(g3, t + 0.3, 0.01, 0.06, 0.2);
      s2.connect(bp); bp.connect(g3); g3.connect(this.master);
      s2.start(t + 0.3, 0.5); s2.stop(t + 0.6);
    },
    // 버튼 터치
    tap() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(720, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.05);
      const g = c.createGain(); this._env(g, t, 0.004, 0.16, 0.08);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.12);
    },
    // 최고 기록
    record() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      [784, 988, 1319].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = c.createGain(); this._env(g, t + i * 0.09, 0.008, 0.2, 0.22);
        o.connect(g); g.connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.35);
      });
    },
    // 시간 종료
    timeup() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      [660, 880].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain(); this._env(g, t + i * 0.12, 0.008, 0.16, 0.25);
        o.connect(g); g.connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.4);
      });
    },
  };

  // ================= 햅틱 =================
  // Android: Vibration API. iOS Safari(18+): 스위치 체크박스 햅틱을 보조로 사용(가능한 경우).
  const Haptics = NG.Haptics = {
    supported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    _ios: null,
    init() {
      if (this.supported) return;
      try {
        const id = 'ng-haptic-switch';
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.id = id; input.setAttribute('switch', '');
        label.appendChild(input);
        document.body.appendChild(label);
        this._ios = label;
      } catch (e) {}
    },
    pulse(ms) {
      try {
        if (this.supported) navigator.vibrate(ms);
        else if (this._ios) this._ios.click();
      } catch (e) {}
    },
    stop() { try { this.supported && navigator.vibrate(0); } catch (e) {} },
  };

  // ================= 기록 저장 =================
  const KEY = 'noodle.best.v1', ONB = 'noodle.onboarded.v1', LAST = 'noodle.last.v1';
  const mem = {};
  const ls = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
    set(k, v) { mem[k] = v; try { window.localStorage.setItem(k, v); } catch (e) {} },
  };
  NG.Store = {
    bests() { try { return JSON.parse(ls.get(KEY) || '{}') || {}; } catch (e) { return {}; } },
    best(id) { const v = this.bests()[id]; return typeof v === 'number' ? v : null; },
    // 기존 기록보다 높으면 저장하고 true 반환
    submit(id, cm) {
      const all = this.bests();
      const prev = typeof all[id] === 'number' ? all[id] : null;
      if (cm > 0 && (prev === null || cm > prev)) { all[id] = cm; ls.set(KEY, JSON.stringify(all)); return true; }
      return false;
    },
    onboarded() { return ls.get(ONB) === '1'; },
    setOnboarded() { ls.set(ONB, '1'); },
    last() { return ls.get(LAST) || 'basic'; },
    setLast(id) { ls.set(LAST, id); },
  };
})();
