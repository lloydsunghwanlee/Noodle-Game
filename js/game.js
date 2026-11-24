/*
 * 게임 로직 — 드래그 입력, 길이 계산, 긴장도, 제한 시간, 종료 판정
 */
(function () {
  const NG = window.NG;
  const C = NG.CONFIG;

  class Game {
    constructor(stage, surface, hooks) {
      this.stage = stage;
      this.surface = surface;   // 터치를 받는 요소
      this.hooks = hooks;       // { onScore(cm), onTime(remainSec), onEnd(result) }
      this.state = 'idle';
      this.gen = 0;
      this._bind();
    }

    _bind() {
      const el = this.surface;
      const opt = { passive: false };
      el.addEventListener('pointerdown', e => this._down(e), opt);
      el.addEventListener('pointermove', e => this._move(e), opt);
      el.addEventListener('pointerup', e => this._up(e), opt);
      el.addEventListener('pointercancel', e => this._up(e), opt);
      el.addEventListener('lostpointercapture', e => this._up(e), opt);
      // iOS에서 스크롤/확대 방지
      el.addEventListener('touchstart', e => e.preventDefault(), opt);
      el.addEventListener('touchmove', e => e.preventDefault(), opt);
    }

    start(ramen) {
      this.gen++;
      this.ramen = ramen;
      this.diff = C.difficulty[ramen.id];
      this.state = 'ready';     // 첫 당김 전: 타이머 대기
      this.length = 0;
      this.tension = 0;
      this.elapsed = 0;
      this.speed = 0;
      this.prevSpeed = 0;
      this.accel = 0;
      this.upAccum = 0;
      this.pointerId = null;
      this.lastY = 0;
      this.slurpAcc = 0;
      this.hapticT = 0;
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.stage.setRamen(ramen);
      this.stage.setMode('play');
      this.hooks.onScore(0);
      this.hooks.onTime && this.hooks.onTime(C.timeLimit);
      NG.Sound.setTremble(0);
    }

    _h() { return this.surface.clientHeight || window.innerHeight || 1; }

    _down(e) {
      e.preventDefault();
      NG.Sound.unlock();
      if (this.state !== 'ready' && this.state !== 'playing') return;
      if (this.pointerId !== null) return;     // 첫 번째 손가락만 사용
      this.pointerId = e.pointerId;
      this.lastY = e.clientY;
      try { this.surface.setPointerCapture(e.pointerId); } catch (_) {}
    }

    _move(e) {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      if (this.state !== 'ready' && this.state !== 'playing') return;
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const dy = this.lastY - ev.clientY; // 위쪽이 양수
        this.lastY = ev.clientY;
        if (dy > 0) {
          this.upAccum += dy;
          if (this.state === 'ready') { this.state = 'playing'; this.elapsed = 0; }
          const cm = dy / this._h() * C.cmPerScreen;
          this.length += cm;
          this.slurpAcc += cm;
        }
      }
      this.hooks.onScore(this.length);
    }

    _up(e) {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
    }

    // 백그라운드 전환: 손가락 상태를 초기화(시간은 update가 멈춰 있으므로 그대로 유지)
    pauseForBackground() {
      this.pointerId = null;
      this.upAccum = 0;
      this.speed = 0;
      NG.Sound.setTremble(0);
      NG.Haptics.stop();
    }

    update(dt) {
      if (this.state !== 'ready' && this.state !== 'playing') return;
      const d = this.diff;
      const H = this._h();
      // 측정 속도 (화면 높이/초)
      const vInst = this.upAccum / H / Math.max(dt, 1e-4);
      this.upAccum = 0;
      const k = 1 - Math.exp(-dt / C.speedSmoothing);
      this.speed += (vInst - this.speed) * k;
      const a = (this.speed - this.prevSpeed) / Math.max(dt, 1e-4);
      this.prevSpeed = this.speed;
      this.accel += (a - this.accel) * (1 - Math.exp(-dt / 0.08));

      if (this.state === 'playing') {
        this.elapsed += dt;
        // 긴장도 계산 (고정 간격 적분으로 프레임레이트 무관)
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          const safe = d.safeSpeed * (1 + d.safeWobble * Math.sin(this.elapsed * Math.PI * 2 * d.wobbleHz + this.wobblePhase));
          const v = this.speed;
          let dT;
          if (v > safe) {
            const ex = (v - safe) / safe;
            dT = Math.min(d.maxRise, d.riseRate * (0.35 + ex * 1.2));
          } else {
            const dragging = this.pointerId !== null && v > 0.03;
            dT = -d.recoverRate * (0.35 + 0.65 * (1 - v / safe)) * (dragging ? 1 : C.idleRecoverBonus);
          }
          if (d.accelSense > 0 && v > safe * 0.45) dT += d.accelSense * Math.max(0, Math.abs(this.accel) - 2.0);
          this.tension = Math.max(0, Math.min(C.stages.snap, this.tension + dT * h));
        }
      }
      this.stage.tension = this.tension;
      this.stage.height = this.length * C.worldPerCm;

      if (this.hooks.onTime) this.hooks.onTime(Math.max(0, C.timeLimit - this.elapsed));
      this._feedback(dt);

      if (this.tension >= C.stages.snap) return this._end('snap');
      if (this.state === 'playing' && this.elapsed >= C.timeLimit) return this._end('timeup');
    }

    _feedback(dt) {
      const T = this.tension, S = C.stages, hp = C.haptics;
      // 후루룩: 약 1.6cm 당길 때마다
      if (this.slurpAcc > 1.6) {
        this.slurpAcc = 0;
        NG.Sound.slurp(Math.min(1, this.speed / 1.2));
      }
      // 떨림음
      NG.Sound.setTremble(T >= S.danger ? 0.35 + 0.65 * (T - S.danger) / (S.snap - S.danger) : (T >= S.caution ? 0.12 * (T - S.caution) / (S.danger - S.caution) : 0));
      // 진동
      this.hapticT -= dt * 1000;
      if (this.hapticT <= 0) {
        if (T >= S.danger) {
          const f = (T - S.danger) / (S.snap - S.danger);
          NG.Haptics.pulse(Math.round(hp.dangerPulseMs[0] + (hp.dangerPulseMs[1] - hp.dangerPulseMs[0]) * f));
          this.hapticT = hp.dangerInterval[0] + (hp.dangerInterval[1] - hp.dangerInterval[0]) * f;
        } else if (T >= S.caution) {
          NG.Haptics.pulse(hp.cautionPulseMs);
          this.hapticT = hp.cautionInterval;
        } else {
          this.hapticT = 0;
        }
      }
    }

    _end(reason) {
      this.state = 'ending';
      this.pointerId = null;
      const gen = this.gen;
      const cm = Math.floor(this.length * 10) / 10;
      NG.Sound.setTremble(0);
      if (reason === 'snap') {
        this.stage.snap();
        NG.Sound.snap();
        NG.Haptics.stop();
        NG.Haptics.pulse(C.haptics.snapPattern);
      } else {
        this.stage.tension = 0;
        NG.Sound.timeup();
      }
      const isRecord = NG.Store.submit(this.ramen.id, cm);
      const best = NG.Store.best(this.ramen.id);
      setTimeout(() => {
        if (gen !== this.gen) return;        // 그 사이 재시작된 경우 무시
        this.state = 'ended';
        this.hooks.onEnd({ reason, cm, best, isRecord, ramen: this.ramen });
      }, reason === 'snap' ? C.snapToResultDelay : C.timeUpToResultDelay);
    }

    cancel() { this.gen++; this.state = 'idle'; this.pointerId = null; NG.Sound.setTremble(0); }
  }
  NG.Game = Game;
})();
