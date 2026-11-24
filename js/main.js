/*
 * 화면 흐름 — 온보딩 → 라면 선택 → 게임 플레이 → 결과
 */
(function () {
  const NG = window.NG;
  const $ = s => document.querySelector(s);

  const canvas = $('#gl');
  let stage;
  try { stage = new NG.Stage(canvas); }
  catch (e) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center;font-family:sans-serif">이 기기에서는 3D 그래픽(WebGL)을 사용할 수 없어요.</p>';
    return;
  }
  NG.stage = stage;
  NG.Haptics.init();

  const screens = { onboard: $('#s-onboard'), select: $('#s-select'), play: $('#s-play'), result: $('#s-result') };
  let current = null;
  let selected = NG.ramenById(NG.Store.last());

  const game = new NG.Game(stage, $('#touch'), {
    onScore(cm) { $('#score').textContent = (Math.floor(cm * 10) / 10).toFixed(1); },
    onTime(remain) {
      const s = Math.ceil(remain - 1e-6);
      const txt = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const el = $('#timer');
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('low', remain <= 5);
    },
    onEnd(res) { showResult(res); },
  });
  NG.game = game;

  function show(name) {
    if (current === name) return;
    current = name;
    for (const k in screens) screens[k].classList.toggle('on', k === name);
    canvas.classList.toggle('hide', name === 'select');
    if (name === 'onboard' || name === 'play' || name === 'result') stage.setMode(name);
  }

  // 페이드를 거쳐 전환 (3D 장면을 바꿀 때)
  let fading = false;
  function fadeTo(fn) {
    if (fading) return;
    fading = true;
    const f = $('#fader');
    f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => { f.classList.remove('on'); fading = false; }); }, 300);
  }

  // ---------- 온보딩 ----------
  const OB = [
    '면발을 <em>천천히</em> 위로 당겨보세요!',
    '너무 빠르게 당기면<br>면발이 <em>바들바들</em> 떨려요!',
    '면발이 끊어지기 전에<br>최고 기록에 도전해 보세요!<br>제한 시간은 <em>' + NG.CONFIG.timeLimit + '초</em>예요.',
  ];
  let obPage = 0, obT = 0;
  function setObPage(i, instant) {
    obPage = i; obT = 0;
    const txt = $('#ob-text');
    const apply = () => { txt.innerHTML = OB[i]; txt.classList.remove('fade'); };
    if (instant) apply(); else { txt.classList.add('fade'); setTimeout(apply, 200); }
    document.querySelectorAll('#ob-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    $('#ob-next').textContent = i === OB.length - 1 ? '시작하기' : '다음';
    stage.resetNoodle();
  }
  function openOnboard() {
    game.cancel();
    stage.setRamen(NG.RAMEN[0]);
    setObPage(0, true);
    show('onboard');
  }
  function finishOnboard() {
    NG.Store.setOnboarded();
    openSelect();
  }
  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  // 온보딩용 짧은 3D 연출
  function demo(dt) {
    obT += dt;
    if (obPage === 0) {
      const c = obT % 4.2;
      const h = c < 2.8 ? ease(c / 2.8) : 1 - ease((c - 2.8) / 1.4);
      stage.height = 0.05 + 1.05 * h; stage.tension = 0;
    } else if (obPage === 1) {
      const c = obT % 5;
      if (c < 1.0) { stage.height = 0.1 + 1.1 * ease(c / 1.0); stage.tension = 20 + 70 * c; }
      else if (c < 2.6) { stage.height = 1.2 + 0.15 * (c - 1); stage.tension = 92; }
      else if (c < 3.8) { stage.height = 1.44; stage.tension = 92 - 80 * ease((c - 2.6) / 1.2); }
      else { stage.height = 1.44 - 1.34 * ease((c - 3.8) / 1.2); stage.tension = 10; }
    } else {
      const c = obT % 5.4;
      if (c < 3.6) { stage.height = 0.1 + 2.5 * ease(c / 3.6); stage.tension = 18 + 20 * Math.sin(c * 2.2) ** 2; }
      else if (c < 4.4) { stage.height = 2.6; stage.tension = 10; }
      else { stage.height = 2.6 - 2.5 * ease((c - 4.4) / 1.0); stage.tension = 0; }
    }
  }

  // ---------- 라면 선택 ----------
  let thumbs = null;
  const star = on => `<svg viewBox="0 0 24 24" class="${on ? 'on' : 'off'}"><path d="M12 2.6l2.75 5.9 6.45.75-4.78 4.4 1.27 6.38L12 16.85 6.31 20.03l1.27-6.38L2.8 9.25l6.45-.75z" stroke-linejoin="round"/></svg>`;
  const fmt = v => v === null ? '— cm' : v.toFixed(1) + ' cm';
  function renderCards() {
    if (!thumbs) thumbs = stage.makeThumbnails(192);
    const box = $('#cards');
    box.innerHTML = '';
    for (const r of NG.RAMEN) {
      const b = document.createElement('button');
      b.className = 'card' + (r.id === selected.id ? ' sel' : '');
      b.setAttribute('aria-pressed', r.id === selected.id);
      b.innerHTML = `${thumbs[r.id] ? `<img src="${thumbs[r.id]}" alt="">` : '<span class="thumb"></span>'}
        <span class="mid"><span class="name">${r.name}</span><span class="stars" aria-label="난이도 ${r.stars}">${[1, 2, 3, 4, 5].map(i => star(i <= r.stars)).join('')}</span></span>
        <span class="best"><small>최고 기록</small><b>${fmt(NG.Store.best(r.id))}</b></span>`;
      b.addEventListener('click', () => {
        NG.Sound.unlock(); NG.Sound.tap();
        selected = r; NG.Store.setLast(r.id);
        box.querySelectorAll('.card').forEach(c => { c.classList.remove('sel'); c.setAttribute('aria-pressed', 'false'); });
        b.classList.add('sel'); b.setAttribute('aria-pressed', 'true');
      });
      box.appendChild(b);
    }
  }
  function openSelect() {
    game.cancel();
    renderCards();
    show('select');
  }

  // ---------- 플레이 ----------
  function startGame() {
    fadeTo(() => {
      game.start(selected);
      show('play');
    });
  }

  // ---------- 결과 ----------
  function showResult(r) {
    $('#res-title').textContent = r.reason === 'snap' ? '면발이 끊어졌어요!' : '시간 종료!';
    $('#res-cm').textContent = r.cm.toFixed(1);
    $('#res-name').textContent = r.ramen.name;
    $('#res-best').textContent = fmt(r.best);
    const rec = $('#res-record');
    rec.classList.remove('show', 'none');
    void rec.offsetWidth;
    rec.classList.add(r.isRecord ? 'show' : 'none');
    show('result');
    if (r.isRecord) setTimeout(() => NG.Sound.record(), 300);
  }

  // ---------- 버튼 ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    NG.Sound.unlock(); NG.Sound.tap();
    const act = b.dataset.act;
    if (act === 'skip') finishOnboard();
    else if (act === 'next') { if (obPage < OB.length - 1) setObPage(obPage + 1); else finishOnboard(); }
    else if (act === 'back') openOnboard();
    else if (act === 'start') startGame();
    else if (act === 'retry') { if (current === 'result') startGame(); }
    else if (act === 'pick') { if (current === 'result') openSelect(); }
  });

  // ---------- 루프 ----------
  let last = performance.now(), running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (current === 'onboard') demo(dt);
    if (current === 'play') game.update(dt);
    if (current !== 'select') stage.update(dt);
    requestAnimationFrame(frame);
  }

  // 백그라운드 전환 처리: 시간을 멈추고 돌아오면 이어서 진행
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      game.pauseForBackground();
      NG.Sound.suspend();
    } else if (!running) {
      running = true;
      NG.Sound.resume();
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });
  window.addEventListener('pagehide', () => game.pauseForBackground());

  const onResize = () => stage.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  // 더블탭/핀치 확대 방지
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  // 시작: 최초 실행 시에만 온보딩
  if (NG.Store.onboarded()) openSelect(); else openOnboard();
  requestAnimationFrame(t => { last = t; frame(t); });

  // PWA 서비스 워커 (호스팅 환경에서만)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.NG_NO_SW) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
