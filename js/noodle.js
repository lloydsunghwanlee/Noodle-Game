/*
 * 당겨지는 면발 — 실시간으로 형태가 변하는 유연한 튜브 메시
 *  - 당기는 중: 절차적 애니메이션 (구불거림, 팽팽해짐, 떨림)
 *  - 끊어진 뒤: 가벼운 Verlet 로프 시뮬레이션 (젓가락에 남는 조각 + 그릇으로 떨어지는 조각)
 */
(function () {
  const NG = window.NG;
  const V3 = THREE.Vector3;

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---- 갱신 가능한 튜브 ----
  class FlexTube {
    constructor(maxPts, radial, material) {
      this.maxPts = maxPts; this.radial = radial;
      const vc = maxPts * radial;
      this.pos = new Float32Array(vc * 3);
      this.nor = new Float32Array(vc * 3);
      const idx = new Uint32Array((maxPts - 1) * radial * 6);
      let k = 0;
      for (let i = 0; i < maxPts - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
        idx[k++] = a; idx[k++] = b; idx[k++] = c;
        idx[k++] = b; idx[k++] = d; idx[k++] = c;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
      this.geo = g;
      this.mesh = new THREE.Mesh(g, material);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = false;
      this._t = []; this._n = new V3(); this._b = new V3(); this._tmp = new V3();
      for (let i = 0; i < maxPts; i++) this._t.push(new V3());
    }
    update(pts, count, radiusFn) {
      count = Math.min(count, this.maxPts);
      if (count < 2) { this.geo.setDrawRange(0, 0); return; }
      const T = this._t, N = this._n, Bn = this._b, tmp = this._tmp;
      for (let i = 0; i < count; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(count - 1, i + 1)];
        T[i].subVectors(b, a);
        if (T[i].lengthSq() < 1e-12) T[i].set(0, 1, 0);
        T[i].normalize();
      }
      // 초기 법선
      const t0 = T[0];
      if (Math.abs(t0.z) < 0.9) N.set(0, 0, 1); else N.set(1, 0, 0);
      N.addScaledVector(t0, -N.dot(t0)).normalize();
      const R = this.radial, pos = this.pos, nor = this.nor;
      for (let i = 0; i < count; i++) {
        const t = T[i];
        if (i > 0) { N.addScaledVector(t, -N.dot(t)); if (N.lengthSq() < 1e-10) N.set(1, 0, 0); N.normalize(); }
        Bn.crossVectors(t, N);
        const r = radiusFn(i / (count - 1));
        const p = pts[i];
        for (let j = 0; j < R; j++) {
          const th = j / R * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
          const nx = N.x * c + Bn.x * s, ny = N.y * c + Bn.y * s, nz = N.z * c + Bn.z * s;
          const k = (i * R + j) * 3;
          pos[k] = p.x + nx * r; pos[k + 1] = p.y + ny * r; pos[k + 2] = p.z + nz * r;
          nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        }
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.normal.needsUpdate = true;
      this.geo.setDrawRange(0, (count - 1) * R * 6);
    }
  }
  NG.FlexTube = FlexTube;

  // ---- Verlet 로프 ----
  class Rope {
    constructor(points, segLen) {
      this.p = points.map(v => v.clone());
      this.o = points.map(v => v.clone());
      this.seg = segLen;
      this.pinA = null; // 첫 점 고정 위치
      this.pinB = null; // 마지막 점 고정 위치
    }
    kick(fn) { this.o.forEach((o, i) => fn(o, this.p[i], i)); }
    step(dt, env) {
      const g = -6.2 * dt * dt, damp = 0.985;
      const p = this.p, o = this.o, n = p.length;
      for (let i = 0; i < n; i++) {
        const vx = (p[i].x - o[i].x) * damp, vy = (p[i].y - o[i].y) * damp, vz = (p[i].z - o[i].z) * damp;
        o[i].copy(p[i]);
        p[i].x += vx; p[i].y += vy + g; p[i].z += vz;
      }
      for (let it = 0; it < 10; it++) {
        if (this.pinA) p[0].copy(this.pinA);
        if (this.pinB) p[n - 1].copy(this.pinB);
        for (let i = 0; i < n - 1; i++) {
          const a = p[i], b = p[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = (d - this.seg) / d * 0.5;
          const wa = (i === 0 && this.pinA) ? 0 : 1, wb = (i + 1 === n - 1 && this.pinB) ? 0 : 1;
          const s = wa + wb; if (!s) continue;
          a.x += dx * diff * 2 * wa / s; a.y += dy * diff * 2 * wa / s; a.z += dz * diff * 2 * wa / s;
          b.x -= dx * diff * 2 * wb / s; b.y -= dy * diff * 2 * wb / s; b.z -= dz * diff * 2 * wb / s;
        }
        if (env) for (let i = 0; i < n; i++) env.collide(p[i], o[i]);
      }
      if (this.pinA) p[0].copy(this.pinA);
      if (this.pinB) p[n - 1].copy(this.pinB);
    }
  }

  // ---- 당겨지는 면발 ----
  class PulledNoodle {
    constructor(parent) {
      this.mat = new THREE.MeshStandardMaterial({ color: '#F4CB57', roughness: 0.58, metalness: 0 });
      this.main = new FlexTube(320, 8, this.mat);
      this.upper = new FlexTube(60, 8, this.mat);
      this.lower = new FlexTube(260, 8, this.mat);
      parent.add(this.main.mesh, this.upper.mesh, this.lower.mesh);
      this.pts = []; for (let i = 0; i < 320; i++) this.pts.push(new V3());
      this.radius = 0.036;
      this.mode = 'pull';
      this.X = new V3(); this.Z = new V3(); this.dir = new V3();
      this.splash = null;
    }
    setColor(c) { this.mat.color.set(c); }

    reset() {
      this.mode = 'pull';
      this.upper.geo.setDrawRange(0, 0);
      this.lower.geo.setDrawRange(0, 0);
      this.main.mesh.visible = true;
      this.ropeU = this.ropeL = null;
    }

    // 당기는 중 형태 계산
    shape(B, T, tension, t, shakeScale) {
      const D = Math.max(0.05, T.distanceTo(B));
      const dir = this.dir.subVectors(T, B).divideScalar(D);
      const X = this.X.set(0, 0, 1).cross(dir).multiplyScalar(-1);
      if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
      X.normalize();
      const Z = this.Z.crossVectors(X, dir).normalize();
      const taut = smooth(25, 92, tension);
      const amp = 0.042 * (1 - 0.75 * taut);
      const amp2 = 0.09 * (1 - 0.85 * taut);
      const k = Math.max(0, Math.min(1, (tension - 26) / 74));
      const sa = k > 0 ? shakeScale * (0.006 + 0.12 * Math.pow(k, 1.35)) * (0.7 + 0.3 * Math.min(D / 2.5, 1.6)) : 0;
      const w = Math.PI * 2 * (6 + 17 * k);
      const n = Math.max(16, Math.min(this.pts.length, Math.ceil(D / 0.022) + 2));
      const lam = 0.2, lam2 = 1.15;
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1);
        const dTop = (1 - s) * D, dBot = s * D;
        const env = smooth(0, 0.16, dBot) * smooth(0, 0.1, dTop);
        const bell = Math.sin(Math.PI * s);
        const ph = dTop / lam * Math.PI * 2;
        let ox = amp * (Math.sin(ph) + 0.35 * Math.sin(ph * 1.73 + 1.3)) * env + amp2 * Math.sin(dTop / lam2 * Math.PI * 2 + 0.7) * env * bell;
        let oz = amp * 0.45 * Math.sin(ph * 0.37 + 1.1) * env;
        ox += 0.045 * (1 - taut) * Math.sin(t * 1.1 + s * 2.2) * bell;
        if (sa > 0) {
          ox += sa * bell * (Math.sin(w * t + s * 4.0) * 0.75 + Math.sin(1.63 * w * t + s * 9 + 1.0) * 0.32);
          oz += sa * 0.4 * bell * Math.sin(1.31 * w * t + s * 6);
        }
        this.pts[i].copy(B).addScaledVector(dir, dBot).addScaledVector(X, ox).addScaledVector(Z, oz);
      }
      this.count = n;
      return { sa, w };
    }

    updatePull(B, T, tension, t, shakeScale, radiusScale) {
      const r = this.radius * radiusScale;
      const res = this.shape(B, T, tension, t, shakeScale);
      this.main.update(this.pts, this.count, s => r * (s > 0.985 ? 0.8 : 1));
      return res;
    }

    // 면발 끊기: 현재 형태를 두 개의 로프로 분리
    snap(B, T, env) {
      this.mode = 'snap';
      this.main.mesh.visible = false;
      const n = this.count;
      const pts = this.pts.slice(0, n);
      // 길이 누적
      const acc = [0];
      for (let i = 1; i < n; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const L = acc[n - 1];
      const upperLen = Math.max(0.42, Math.min(0.8, L * 0.22));
      const cut = L - upperLen;
      const resample = (a, b, seg) => {
        const out = [];
        const m = Math.max(3, Math.round((b - a) / seg) + 1);
        let j = 0;
        for (let q = 0; q < m; q++) {
          const d = a + (b - a) * q / (m - 1);
          while (j < n - 2 && acc[j + 1] < d) j++;
          const f = (d - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
          out.push(pts[j].clone().lerp(pts[j + 1], Math.min(1, Math.max(0, f))));
        }
        return { out, seg: (b - a) / (m - 1) };
      };
      const lowerSeg = Math.max(0.045, cut / 250);
      const lo = resample(0, cut, lowerSeg);
      const up = resample(cut, L, 0.04);
      // 아래 조각: 아래쪽이 고정, 위쪽 끝이 자유
      this.ropeL = new Rope(lo.out, lo.seg);
      this.ropeL.pinA = lo.out[0].clone();
      // 위 조각: 마지막 점(젓가락)이 고정, 아래 끝이 자유
      this.ropeU = new Rope(up.out, up.seg);
      this.ropeU.pinB = T.clone();
      // 끊기는 순간의 반동
      this.ropeL.kick((o, p, i) => {
        const f = i / (lo.out.length - 1);
        o.x = p.x - (Math.random() - 0.5) * 0.006 * f; o.z = p.z - (Math.random() - 0.5) * 0.006 * f;
        o.y = p.y + 0.002 * f;
      });
      this.ropeU.kick((o, p, i) => { o.x = p.x + 0.004 * (1 - i / up.out.length); });
      this.env = env;
      this.t = 0;
    }

    updateSnap(dt, tip, radiusScale) {
      if (this.mode !== 'snap') return;
      this.t += dt;
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        this.ropeU.pinB.copy(tip);
        this.ropeU.step(h, null);
        this.ropeL.step(h, this.env);
      }
      const r = this.radius * radiusScale;
      const pl = this.ropeL.p, pu = this.ropeU.p;
      this.lower.update(pl, pl.length, s => r * (s > 0.97 ? 0.35 + 0.65 * (1 - s) / 0.03 : 1));
      this.upper.update(pu, pu.length, s => r * (s < 0.08 ? 0.35 + 0.65 * s / 0.08 : 1));
    }
  }
  NG.PulledNoodle = PulledNoodle;

  // ---- 국물 튐 효과 ----
  class Splash {
    constructor(parent) {
      this.max = 36;
      this.mat = new THREE.MeshStandardMaterial({ color: '#E9893F', roughness: 0.35 });
      this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), this.mat, this.max);
      this.mesh.frustumCulled = false;
      this.mesh.count = 0;
      parent.add(this.mesh);
      this.d = [];
      this.o = new THREE.Object3D();
    }
    setColor(c) { this.mat.color.set(c); }
    burst(x, y, z, n, power) {
      for (let i = 0; i < n && this.d.length < this.max; i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 0.9) * power;
        this.d.push({ x, y, z, vx: Math.cos(a) * sp * 0.55, vz: Math.sin(a) * sp * 0.55, vy: (1.2 + Math.random() * 1.1) * power, r: 0.018 + Math.random() * 0.025, floor: y, t: 0 });
      }
    }
    clear() { this.d.length = 0; this.mesh.count = 0; }
    update(dt) {
      let k = 0;
      for (const p of this.d) {
        p.t += dt;
        p.vy -= 7.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < p.floor && p.vy < 0) p.dead = true;
      }
      this.d = this.d.filter(p => !p.dead);
      for (const p of this.d) {
        this.o.position.set(p.x, p.y, p.z);
        this.o.scale.setScalar(p.r);
        this.o.updateMatrix();
        this.mesh.setMatrixAt(k++, this.o.matrix);
      }
      this.mesh.count = k;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  NG.Splash = Splash;
})();
