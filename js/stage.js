/*
 * 3D 무대 — 렌더러, 조명, 카메라 구도, 그릇·젓가락·면발 배치
 */
(function () {
  const NG = window.NG;
  const V3 = THREE.Vector3;
  const M = NG.Models;
  const B = M.BOWL;

  const REGIONS = {
    onboard: { top: 0.33, bottom: 0.76 },
    play:    { top: 0.19, bottom: 0.965 },
    result:  { top: 0.21, bottom: 0.55 },
  };

  class Stage {
    constructor(canvas) {
      this.canvas = canvas;
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.setClearColor(0x000000, 0);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace;

      const s = this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 9 / 16, 0.1, 200);

      // 따뜻하고 부드러운 조명
      s.add(new THREE.HemisphereLight(0xfff5e6, 0xd8b48a, 1.25));
      const key = this.key = new THREE.DirectionalLight(0xfff0dc, 1.7);
      key.position.set(2.5, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -3; key.shadow.camera.right = 3;
      key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 1; key.shadow.camera.far = 14;
      key.shadow.radius = 6;
      key.shadow.bias = -0.0008;
      s.add(key, key.target);
      const fill = new THREE.DirectionalLight(0xffe8d0, 0.45);
      fill.position.set(-4, 2, 3);
      s.add(fill);

      // 그림자만 받는 바닥
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.13 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      s.add(ground);

      this.world = new THREE.Group();
      s.add(this.world);

      this.bowlCache = {};
      this.chop = M.buildChopsticks();
      this.world.add(this.chop);
      this.noodle = new NG.PulledNoodle(this.world);
      this.splash = new NG.Splash(this.world);
      this.steam = new M.Steam(9);
      this.world.add(this.steam.group);

      // 상태
      this.mode = 'onboard';
      this.height = 0;          // 그릇 위로 들어 올린 높이(월드)
      this.tension = 0;
      this.visTension = 0;
      this.shakeScale = 1;
      this.time = 0;
      this.recoil = 0; this.recoilV = 0;
      this.tip = new V3(); this.base = new V3(); this.bottom = new V3();
      this.camState = null;
      this.active = true;

      this.setRamen(NG.RAMEN[0]);
      this.resize();
    }

    setRamen(ramen) {
      this.ramen = ramen;
      if (this.bowl) this.world.remove(this.bowl);
      if (!this.bowlCache[ramen.id]) {
        const g = new THREE.Group();
        g.add(M.buildBowl(ramen.bowl));
        const c = M.buildContents(ramen, 11 + ramen.stars * 17);
        g.add(c);
        g.userData = c.userData;
        this.bowlCache[ramen.id] = g;
      }
      this.bowl = this.bowlCache[ramen.id];
      this.world.add(this.bowl);
      this.noodle.setColor(ramen.noodle);
      this.splash.setColor(ramen.soup ? ramen.broth : ramen.broth);
      this.steam.baseY = this.bowl.userData.surfaceY;
      this.steam.strength = ramen.soup ? 1 : 0.7;
      const ha = this.bowl.userData.heightAt;
      this.bottom.set(0.02, ha(0.02, 0.18) - 0.02, 0.18);
      this.shakeScale = (NG.CONFIG.difficulty[ramen.id] || {}).shakeScale || 1;
      this.resetNoodle();
    }

    resetNoodle() {
      this.noodle.reset();
      this.splash.clear();
      this.height = 0; this.tension = 0; this.visTension = 0;
      this.recoil = 0; this.recoilV = 0;
      this.snapped = false;
      this.camState = null;
    }

    // 면발 끊기
    snap() {
      if (this.snapped) return;
      this.snapped = true;
      const ud = this.bowl.userData;
      const R = ud.innerR, ha = ud.heightAt, r = this.noodle.radius;
      const self = this;
      let lastSplash = -1, splashes = 0;
      const env = {
        collide(p, o) {
          const rr = Math.hypot(p.x, p.z);
          if (p.y < B.rimY + 0.05 && rr > R - 0.05) { const f = (R - 0.05) / rr; p.x *= f; p.z *= f; }
          const fy = ha(p.x, p.z) + r * 0.3;
          if (p.y < fy) {
            const vy = p.y - o.y;
            if (vy < -0.025 && splashes < 4 && self.noodle.t - lastSplash > 0.12) {
              lastSplash = self.noodle.t; splashes++;
              self.splash.burst(p.x, fy, p.z, self.ramen.soup ? 9 : 5, self.ramen.soup ? 1 : 0.75);
            }
            p.y = fy;
            o.x = p.x - (p.x - o.x) * 0.6; o.z = p.z - (p.z - o.z) * 0.6;
          }
        },
      };
      this.noodle.snap(this.bottom, this.tip, env);
      this.recoilV = 1.4;
    }

    computeTip(t) {
      const ud = this.bowl.userData;
      this.base.set(0.16, ud.surfaceY + 0.85, 0.18);
      this.tip.copy(this.base);
      this.tip.y += this.height + this.recoil;
      // 젓가락 떨림
      const k = Math.max(0, Math.min(1, (this.visTension - 26) / 74));
      const sa = k > 0 ? this.shakeScale * (0.004 + 0.05 * Math.pow(k, 1.3)) : 0;
      const w = Math.PI * 2 * (6 + 17 * k);
      this.tip.x += sa * Math.sin(w * t * 1.07 + 0.4) + 0.006 * Math.sin(t * 1.7);
      this.tip.z += sa * 0.4 * Math.sin(w * t * 0.83);
      this.tip.y += sa * 0.25 * Math.sin(w * t * 1.31) + 0.006 * Math.sin(t * 2.3);
      this.chopShake = sa;
      this.chopW = w;
    }

    update(dt) {
      if (!this.active) return;
      const t = this.time += dt;
      // 시각적 긴장도는 부드럽게 따라감
      this.visTension += (this.tension - this.visTension) * (1 - Math.exp(-dt / 0.08));
      // 끊긴 뒤 젓가락 반동 (스프링)
      if (this.snapped) {
        this.recoilV += (-this.recoil * 60 - this.recoilV * 9) * dt;
        this.recoil += this.recoilV * dt;
        this.visTension *= Math.exp(-dt * 6);
      }
      this.computeTip(t);
      // 젓가락 배치
      this.chop.position.copy(this.tip);
      const hold = this.chop.userData.holder;
      hold.rotation.z = -0.86 + this.chopShake * 1.6 * Math.sin(this.chopW * t * 0.91 + 1.2);
      // 집는 동작: 집게처럼 살짝 벌어졌다 닫힘
      const [a, b] = this.chop.userData.sticks;
      const pinch = this.snapped ? 0.03 : 0.0;
      a.rotation.z = -0.03 - pinch; b.rotation.z = 0.03 + pinch;

      // 화면 크기 대비 면발 두께 보정
      const radiusScale = this.camState ? Math.min(1.9, Math.max(1, this.camState.d / 9)) : 1;
      if (this.noodle.mode === 'pull') {
        this.noodle.updatePull(this.bottom, this.tip, this.visTension, t, this.shakeScale, radiusScale);
      } else {
        this.noodle.updateSnap(dt, this.tip, radiusScale);
      }
      this.splash.update(dt);
      this.steam.update(dt);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
    }

    updateCamera(dt) {
      const region = REGIONS[this.mode] || REGIONS.play;
      const fov = this.camera.fov * Math.PI / 180, tn = Math.tan(fov / 2);
      const aspect = this.camera.aspect;
      let maxY = Math.max(this.tip.y + 0.5, B.rimY + 0.75);
      let minY = -0.05;
      const maxH = 8.5;
      if (maxY - minY > maxH) minY = maxY - maxH;
      const H = maxY - minY;
      const frac = region.bottom - region.top;
      const halfW = 1.5;
      // 키가 클수록 카메라 각도를 수평에 가깝게
      const pitch = (22 - 12 * Math.min(1, Math.max(0, (H - 2.2) / 5))) * Math.PI / 180;
      let d = Math.max(H * Math.cos(pitch) * 1.02 / (frac * 2 * tn), (2 * halfW) / (0.9 * 2 * tn * aspect), 4.5);
      const cy = (minY + maxY) / 2;
      const off = ((region.top + region.bottom) / 2 - 0.5) * 2 * d * tn;
      const want = { d, cy, off, pitch };
      if (!this.camState) this.camState = Object.assign({}, want);
      const cs = this.camState, k = 1 - Math.exp(-dt / 0.18);
      for (const key in want) cs[key] += (want[key] - cs[key]) * k;
      const fwd = new V3(0, -Math.sin(cs.pitch), -Math.cos(cs.pitch));
      const up = new V3(0, Math.cos(cs.pitch), -Math.sin(cs.pitch));
      const target = new V3(0.05, cs.cy, 0).addScaledVector(up, cs.off);
      this.camera.position.copy(target).addScaledVector(fwd, -cs.d);
      this.camera.up.copy(up);
      this.camera.lookAt(target);
    }

    setMode(m) { this.mode = m; }

    resize() {
      const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    // 라면 선택 카드용 3D 썸네일
    makeThumbnails(size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      let r;
      try { r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
      catch (e) { return {}; }
      r.setPixelRatio(1); r.setSize(size, size, false);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = true;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff5e6, 0xd8b48a, 1.3));
      const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(2, 6, 4); key.castShadow = true;
      key.shadow.mapSize.set(512, 512); key.shadow.radius = 5;
      key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
      scene.add(key);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.12 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 4.6, 3.9); cam.lookAt(0, 0.45, 0);
      const out = {};
      for (const ramen of NG.RAMEN) {
        const g = new THREE.Group();
        g.add(M.buildBowl(ramen.bowl));
        g.add(M.buildContents(ramen, 11 + ramen.stars * 17));
        scene.add(g);
        r.render(scene, cam);
        out[ramen.id] = c.toDataURL('image/png');
        scene.remove(g);
      }
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
      return out;
    }
  }
  NG.Stage = Stage;
})();
