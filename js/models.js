/*
 * 3D 모델 — 그릇, 국물, 그릇 속 면발, 토핑, 젓가락, 김
 * 모든 모델은 코드로 절차적으로 생성합니다(외부 3D 파일 없음).
 */
(function () {
  const NG = window.NG;
  const M = {};
  NG.Models = M;

  // ---- 공통 치수 ----
  const B = M.BOWL = {
    rimR: 1.3, rimY: 0.95, baseR: 0.55, baseY: 0.08, thick: 0.065,
    surfaceY: 0.74,     // 국물 높이
    mountY: 0.70,       // 볶음면 소스 높이
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  M.rng = mulberry32;

  function outerAt(u) {
    const a = u * Math.PI / 2;
    return { r: B.baseR + (B.rimR - B.baseR) * Math.sin(a), y: B.baseY + (B.rimY - B.baseY) * (1 - Math.cos(a)) };
  }
  // 그릇 안쪽 반지름 (높이 y 기준)
  M.innerRadiusAt = function (y) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      const p = outerAt(m);
      if (p.y + 0.045 < y) lo = m; else hi = m;
    }
    return outerAt(lo).r - B.thick;
  };

  M.mat = function (color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.72, metalness: 0 }, opts || {}));
  };

  // ---- 그릇 ----
  M.buildBowl = function (style) {
    const pts = [], cols = [];
    const body = new THREE.Color(style.body), band = new THREE.Color(style.band), inner = new THREE.Color(style.inner);
    const push = (r, y, c) => { pts.push(new THREE.Vector2(Math.max(r, 0.0001), y)); cols.push(c); };
    // 굽(바닥)
    push(0.0, 0.0, body); push(0.46, 0.0, body); push(0.52, 0.015, body); push(0.55, 0.06, body);
    // 바깥 벽 + 붉은 띠
    const bandA = 0.64, bandB = 0.80;
    const us = [];
    for (let i = 0; i <= 24; i++) us.push(i / 24);
    us.push(bandA - 0.002, bandA + 0.002, bandB - 0.002, bandB + 0.002);
    us.sort((a, b) => a - b);
    for (const u of us) {
      const p = outerAt(u);
      push(p.r, p.y, (u > bandA && u < bandB) ? band : body);
    }
    // 둥근 테두리
    push(B.rimR + 0.012, B.rimY + 0.018, body);
    push(B.rimR - 0.004, B.rimY + 0.04, body);
    push(B.rimR - 0.04, B.rimY + 0.035, body);
    push(B.rimR - B.thick + 0.002, B.rimY + 0.01, inner);
    // 안쪽 벽
    for (let i = 24; i >= 0; i--) {
      const p = outerAt(i / 24);
      push(p.r - B.thick, p.y + 0.045, inner);
    }
    push(0.0, B.baseY + 0.045, inner);

    const geo = new THREE.LatheGeometry(pts, 64);
    const seg = 64 + 1;
    const colArr = new Float32Array(seg * pts.length * 3);
    for (let i = 0; i < seg; i++) for (let j = 0; j < pts.length; j++) {
      const c = cols[j], k = (i * pts.length + j) * 3;
      colArr[k] = c.r; colArr[k + 1] = c.g; colArr[k + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };

  // 구불구불한 면발 곡선 점 생성
  function crinkle(path, amp, wl, seed) {
    const out = [];
    let dist = 0;
    for (let i = 0; i < path.length; i++) {
      if (i > 0) dist += path[i].distanceTo(path[i - 1]);
      const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
      const t = next.clone().sub(prev).normalize();
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const ph = dist / wl * Math.PI * 2 + seed;
      out.push(path[i].clone().addScaledVector(side, Math.sin(ph) * amp).add(new THREE.Vector3(0, Math.cos(ph * 0.5) * amp * 0.5, 0)));
    }
    return out;
  }

  // ---- 그릇 속 라면 (국물 + 면 + 토핑) ----
  M.buildContents = function (ramen, seed) {
    const g = new THREE.Group();
    const rnd = mulberry32(seed || 7);
    const surfY = ramen.soup ? B.surfaceY : B.mountY;
    const R = M.innerRadiusAt(surfY);

    // 국물 / 소스
    const brothGeo = new THREE.CircleGeometry(R + 0.01, 64);
    brothGeo.rotateX(-Math.PI / 2);
    const brothMat = M.mat(ramen.broth, { roughness: ramen.soup ? 0.38 : 0.6 });
    const broth = new THREE.Mesh(brothGeo, brothMat);
    broth.position.y = surfY;
    broth.receiveShadow = true;
    g.add(broth);

    // 국물 표면의 은은한 기름 방울
    if (ramen.soup) {
      const dropMat = M.mat(ramen.brothDeep, { roughness: 0.3, transparent: true, opacity: 0.55 });
      for (let i = 0; i < 14; i++) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.03 + rnd() * 0.05, 16), dropMat);
        d.rotation.x = -Math.PI / 2;
        const a = rnd() * Math.PI * 2, r = 0.3 + rnd() * (R - 0.4);
        d.position.set(Math.cos(a) * r, surfY + 0.002, Math.sin(a) * r);
        g.add(d);
      }
    }

    // 그릇 속 면발
    const noodleMat = M.mat(ramen.noodle, { roughness: 0.6 });
    const mound = ramen.soup ? 0.05 : 0.32;
    const heightAt = (x, z) => {
      const rr = Math.sqrt(x * x + z * z) / R;
      return surfY + mound * Math.max(0, 1 - rr * rr) + (ramen.soup ? 0.0 : 0.03);
    };
    const count = ramen.soup ? 16 : 30;
    for (let n = 0; n < count; n++) {
      const path = [];
      let a = rnd() * Math.PI * 2, r = rnd() * R * 0.75;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      let dir = rnd() * Math.PI * 2;
      const steps = 14 + Math.floor(rnd() * 10);
      for (let s = 0; s < steps; s++) {
        dir += (rnd() - 0.5) * 1.1;
        x += Math.cos(dir) * 0.11; z += Math.sin(dir) * 0.11;
        const rr = Math.sqrt(x * x + z * z);
        if (rr > R * 0.86) { x *= R * 0.86 / rr; z *= R * 0.86 / rr; dir += Math.PI * 0.6; }
        path.push(new THREE.Vector3(x, heightAt(x, z) + (ramen.soup ? -0.012 + rnd() * 0.02 : rnd() * 0.03), z));
      }
      const pts = crinkle(path, 0.032, 0.16, rnd() * 6);
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 4, 0.034, 6, false), noodleMat);
      tube.castShadow = false; tube.receiveShadow = true;
      g.add(tube);
    }

    const topY = (x, z) => heightAt(x, z) + (ramen.soup ? 0.02 : 0.05);

    // 토핑
    if (ramen.toppings.includes('egg')) {
      const white = M.mat('#FFFDF6', { roughness: 0.5 });
      const yolk = M.mat('#F7A824', { roughness: 0.45 });
      const egg = (x, z, rot) => {
        const eg = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
        dome.rotation.x = Math.PI; dome.scale.set(1, 0.6, 0.78);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32), white);
        cap.rotation.x = -Math.PI / 2; cap.scale.set(1, 0.78, 1);
        const y = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), yolk);
        y.scale.set(1, 0.38, 0.9); y.position.y = 0.012;
        eg.add(dome, cap, y);
        eg.position.set(x, surfY + 0.06, z);
        eg.rotation.y = rot; eg.rotation.z = 0.08;
        dome.castShadow = cap.castShadow = true;
        g.add(eg);
      };
      egg(-0.48, 0.12, 0.4);
      egg(-0.12, 0.5, -0.5);
    }
    const ring = (color, r, tube, n, avoid) => {
      const mat = M.mat(color, { roughness: 0.55 });
      const geo = new THREE.TorusGeometry(r, tube, 6, 16);
      for (let i = 0; i < n; i++) {
        let x, z, tries = 0;
        do {
          const a = rnd() * Math.PI * 2, rr = 0.15 + rnd() * (R - 0.3);
          x = Math.cos(a) * rr; z = Math.sin(a) * rr; tries++;
        } while (avoid && avoid(x, z) && tries < 20);
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = Math.PI / 2 + (rnd() - 0.5) * 0.4;
        m.rotation.y = (rnd() - 0.5) * 0.3;
        m.position.set(x, topY(x, z) + 0.01, z);
        m.castShadow = true;
        g.add(m);
      }
    };
    const avoidEgg = ramen.toppings.includes('egg') ? (x, z) => (Math.hypot(x + 0.48, z - 0.12) < 0.35 || Math.hypot(x + 0.12, z - 0.5) < 0.35) : null;
    if (ramen.toppings.includes('onion')) {
      ring('#5FAE45', 0.055, 0.017, 9, avoidEgg);
      ring('#A5D46A', 0.05, 0.016, 7, avoidEgg);
    }
    if (ramen.toppings.includes('chili')) {
      ring('#E2432A', 0.06, 0.02, 6, null);
      ring('#8D1E12', 0.05, 0.018, 3, null);
    }
    if (ramen.toppings.includes('veggie')) {
      const cols = ['#EDE3C8', '#7DAF4E', '#E8C27A', '#6E9C43'];
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.08), M.mat(cols[i % cols.length], { roughness: 0.6 }));
        const a = rnd() * Math.PI * 2, rr = 0.1 + rnd() * 0.55;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        m.position.set(x, topY(x, z) + 0.02, z);
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        m.castShadow = true;
        g.add(m);
      }
    }
    if (ramen.toppings.includes('seaweed')) {
      const geo = new THREE.BoxGeometry(0.09, 0.006, 0.05);
      const inst = new THREE.InstancedMesh(geo, M.mat('#26301E', { roughness: 0.8 }), 40);
      const o = new THREE.Object3D();
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.55;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        o.position.set(x, topY(x, z) + 0.01, z);
        o.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
        const s = 0.5 + rnd() * 0.8; o.scale.set(s, 1, s);
        o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
      }
      g.add(inst);
    }
    if (ramen.toppings.includes('sesame')) {
      const geo = new THREE.SphereGeometry(1, 8, 6);
      const inst = new THREE.InstancedMesh(geo, M.mat('#F4E4C1', { roughness: 0.5 }), 60);
      const o = new THREE.Object3D();
      for (let i = 0; i < 60; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.75;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        o.position.set(x, topY(x, z) + 0.008, z);
        o.rotation.set(0, rnd() * 3, 0);
        o.scale.set(0.022, 0.011, 0.014);
        o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
      }
      g.add(inst);
    }

    g.userData.surfaceY = surfY;
    g.userData.innerR = R;
    g.userData.heightAt = heightAt;
    return g;
  };

  // ---- 젓가락 ----
  M.buildChopsticks = function () {
    const g = new THREE.Group();
    const len = 3.0;
    const wood = M.mat('#D8A062', { roughness: 0.78 });
    const woodTop = M.mat('#B9824A', { roughness: 0.78 });
    const make = (offX, spread) => {
      const s = new THREE.Group();
      const geo = new THREE.CylinderGeometry(0.036, 0.017, len, 14, 1);
      geo.translate(0, len / 2, 0); // 끝(얇은 쪽)이 원점
      const m = new THREE.Mesh(geo, wood);
      const capGeo = new THREE.CylinderGeometry(0.0365, 0.0365, 0.5, 14, 1);
      capGeo.translate(0, len - 0.25, 0);
      const cap = new THREE.Mesh(capGeo, woodTop);
      s.add(m, cap);
      s.position.x = offX;
      s.rotation.z = -spread * 0.03;
      s.userData.spread = spread;
      return s;
    };
    const a = make(0.032, 1), b = make(-0.032, -1);
    // 오른쪽 위에서 내려오는 방향
    const holder = new THREE.Group();
    holder.add(a, b);
    holder.rotation.z = -0.86;  // 오른쪽으로 기울임
    holder.rotation.x = -0.18;
    g.add(holder);
    g.userData.holder = holder;
    g.userData.sticks = [a, b];
    return g;
  };

  // ---- 김 (스프라이트) ----
  let steamTex = null;
  M.steamTexture = function () {
    if (steamTex) return steamTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    steamTex = new THREE.CanvasTexture(c);
    steamTex.colorSpace = THREE.SRGBColorSpace;
    return steamTex;
  };

  M.Steam = class {
    constructor(count) {
      this.group = new THREE.Group();
      this.items = [];
      const tex = M.steamTexture();
      for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
        const s = new THREE.Sprite(mat);
        this.group.add(s);
        this.items.push({ s, t: Math.random() * 3.5, life: 3.2 + Math.random() * 1.2, x: 0, z: 0, drift: 0 });
      }
      this.baseY = B.surfaceY;
      this.strength = 1;
      this.items.forEach(it => this.respawn(it));
    }
    respawn(it) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.75;
      it.x = Math.cos(a) * r; it.z = Math.sin(a) * r * 0.6; it.drift = (Math.random() - 0.5) * 0.3;
    }
    update(dt) {
      for (const it of this.items) {
        it.t += dt;
        if (it.t > it.life) { it.t = 0; this.respawn(it); }
        const k = it.t / it.life;
        const y = this.baseY + 0.1 + k * 1.5;
        it.s.position.set(it.x + Math.sin(k * 4 + it.drift * 10) * 0.12 + it.drift * k, y, it.z);
        const sc = 0.35 + k * 0.75;
        it.s.scale.set(sc, sc * 1.2, 1);
        it.s.material.opacity = Math.sin(Math.PI * k) * 0.16 * this.strength;
      }
    }
  };
})();
