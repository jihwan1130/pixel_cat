/* -------------------------------------------------------------------------
   고양이를 찾아서 — 게임 본체
   title → intro(공원 연출) → play(골목 / 낡은 건물 / 지하) → ending → end
------------------------------------------------------------------------- */

const STAGES = ['alley', 'house', 'cellar'];

const Game = {
  state: 'title',
  stageIdx: 0,
  time: 0,
  locked: false,

  map: null,
  player: null,
  cat: null,
  goal: null,
  cam: { x: 0, y: 0 },

  fade: 0,
  _f0: 0, _f1: 0, _fd: 0, _ft: 0,

  tl: [], tlT: 0,
  meowT: 0, creakT: 0, stepDist: 0,

  /* --- 수색 / 불안 --- */
  dread: 0,          // 0~10. UI 로 보여주지 않는다. 소리와 '그것' 의 출현 빈도로만 드러난다.
  traces: 0,         // 찾아낸 고양이 흔적 수 — 엔딩 문장에 반영
  searchT: 0,
  searchTarget: null,
  torchOutT: 0,
  figure: null,
  sentries: [],              // 처음부터 정해진 좌표에 서 있는 것들
  hiding: null,              // { pr, spot } — 상자·옷장 안에 들어가 있는 상태
  flick: 0,                  // 들킨 채 숨어 있을 때의 화면 명멸
  shake: 0,                  // 0~1. 그것이 가까이서 발을 딛을 때만 오른다.

  SPEED: 62,
  STRIDE: 27,                // 이만큼 걸을 때마다 발소리 한 번.
                             // 시간이 아니라 이동 거리로 세야 걷는 속도와 어긋나지 않는다.
  TORCH: 96,
  FIG_SPEED: 0.7,            // 주인공 속도의 배율. 느리지만 쉬지 않는다.
  CREEP_SPEED: 0.30,         // 숨은 자리를 찾아낸 뒤 다가올 때. 느릴수록 길게 조인다.
  CATCH_D: 13,               // 잡히는 거리
  /* --- 그것의 시야 ---
     예전에는 거리 하나(84px)로만 판정했다. 바로 뒤에서 벽 하나 끼고 들어가도
     들켰고, 등 뒤로 들어가도 들켰다. 둘 다 보이는 것과 반대라 플레이어가
     규칙을 학습할 수 없었다 — 운으로 읽힌다.

     손전등과 같은 구조로 바꾼다. 그것이 향한 쪽으로 부채꼴이 열리고,
     그 안에서도 시선이 실제로 닿아야 본다.

       · 부채꼴 밖   — 아무리 가까워도 못 본다. 등 뒤 한 칸도 사각이다.
       · 벽 너머     — 부채꼴 안이어도 못 본다.
       · 사거리 밖   — 어두워서 못 본다.
       · 뚫린 직선   — 위 셋에 걸리지 않으면 본다.

     그래서 벌릴 수 있는 길이 셋이 된다 — 멀어지거나 · 꺾거나 · 등 뒤로 돌거나.
     거리는 여전히 한 축이지만 더 이상 유일한 축이 아니다. */
  FIG_FOV: 37,               // 정면 기준 좌우 각도(도). 74도 부채꼴 — 사람 눈보다 좁다.
  FIG_VIEW_D: 250,           // 이 너머는 어두워서 못 본다. 약 15칸.
                             // 복도 길이(40칸 남짓)보다 훨씬 짧으므로, 뻥 뚫린
                             // 직선이어도 끝까지 보이지는 않는다.
  VIEW_SQUASH: 1.15,         // 렌더러의 광원 감쇠와 같은 종횡비
                             // (figure.html 로 이 구조를 그려 볼 수 있다)
  NEAR_MISS_D: 40,           // 서성이다 이만큼 스치면 문 앞에서 한 번 멈춘다.
                             // 놀라기는 하되 찾아내지는 않는다 — 못 봤으면 못 찾는다.
  WAKE_D: 132,               // 서 있던 것이 이쪽을 알아채는 거리
  GIVEUP_D: 210,             // 이만큼 떨어진 채로 2.5초 버티면 포기한다.
                             // 속도차가 초당 18px 뿐이라 이보다 크면 맵 길이 안에서 따돌릴 수 없다.
  PROWL_T: 9.5,              // 못 본 경우 주변을 서성이는 시간

  el: {},

  /* --------------------------------------------------------------- */
  init() {
    I18N.init();
    TouchPad.init();
    // 휴대폰에서는 내부 해상도를 한 단계 낮춘다.
    // 픽셀당 비용이 큰 렌더러라 화면 크기가 그대로 프레임 시간이 된다.
    if (TouchPad.enabled) R.init(document.getElementById('game'), 416, 234);
    else R.init(document.getElementById('game'));
    Input.init();
    Narrator.init();

    this.el.title = document.getElementById('title-screen');
    this.el.stageTitle = document.getElementById('stage-title');
    this.el.hint = document.getElementById('hint');

    this._perf = { t: 0, n: 0, done: false };

    let last = performance.now();
    this._faults = 0;
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 한 프레임에서 터진 예외가 루프를 끊으면 requestAnimationFrame 이 다시 걸리지 않아
      // 화면이 그대로 굳는다. 게임이 통째로 멈추는 것보다는 그 프레임을 버리는 편이 낫다.
      try {
        this.update(dt);
        this.draw();
        this.trackPerf(dt);
      } catch (e) {
        if (this._faults++ < 5) console.error('[loop] 프레임을 건너뛴다:', e);
      }
      Input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  /* 픽셀당 비용이 큰 렌더러라 느린 기기에서는 그냥 버벅인다.
     처음 3초를 재 보고 못 따라오면 내부 해상도를 한 단계 더 내린다. */
  trackPerf(dt) {
    const p = this._perf;
    if (p.done || this.state === 'title') return;
    if (dt >= 0.049) return;             // 탭이 멈췄던 프레임은 표본에서 뺀다
    p.t += dt; p.n++;
    if (p.n < 180) return;
    p.done = true;
    const avg = p.t / p.n;
    if (avg > 0.026 && R.W > 360) {
      R.init(document.getElementById('game'), 352, 198);
      console.info('[perf] 평균 ' + Math.round(avg * 1000) + 'ms — 내부 해상도를 낮춘다');
    }
  },

  /* ---- 페이드 ---- */
  fadeTo(v, dur) { this._f0 = this.fade; this._f1 = v; this._fd = Math.max(0.001, dur); this._ft = 0; },
  updateFade(dt) {
    if (this._ft >= this._fd) { this.fade = this._f1; return; }
    this._ft += dt;
    const t = U.clamp(this._ft / this._fd, 0, 1);
    this.fade = U.lerp(this._f0, this._f1, t * t * (3 - 2 * t));
  },

  /* ---- 타임라인 ---- */
  setTimeline(events) { this.tl = events.slice().sort((a, b) => a.at - b.at); this.tlT = 0; },
  updateTimeline(dt) {
    if (!this.tl.length) return;
    this.tlT += dt;
    while (this.tl.length && this.tl[0].at <= this.tlT) this.tl.shift().fn();
  },

  /* ---- UI ---- */
  showStageTitle(text, dur = 3.4) {
    this.el.stageTitle.textContent = text;
    this.el.stageTitle.classList.add('on');
    clearTimeout(this._stT);
    this._stT = setTimeout(() => this.el.stageTitle.classList.remove('on'), dur * 1000);
  },
  /* action=true 인 힌트는 대상에서 멀어지면 자동으로 지운다.
     문구로 판별하면 모바일 문구를 바꿀 때마다 깨진다 — 플래그로 둔다. */
  setHint(text, action = false) {
    this._actionHint = !!text && action;
    if (text) { this.el.hint.textContent = text; this.el.hint.classList.add('on'); }
    else { this.el.hint.classList.remove('on'); this.el.hint.textContent = ''; }
  },

  /* =================================================================
     UPDATE
  ================================================================= */
  update(dt) {
    this.time += dt;
    // 발을 딛는 순간 튀어오르고 빠르게 잦아든다. 남아 있으면 지진이 된다.
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 4.5);
    this.updateFade(dt);
    Narrator.update(dt);
    switch (this.state) {
      case 'title':  this.updTitle(dt);  break;
      case 'intro':  this.updIntro(dt);  break;
      case 'play':   this.updPlay(dt);   break;
      case 'jump':   this.updJump(dt);   break;
      case 'dead':   this.updateTimeline(dt); break;
      case 'ending': this.updEnding(dt); break;
      case 'end':    this.updEnd(dt);    break;
    }
  },

  /* ---------------- TITLE ---------------- */
  updTitle() {
    // ← → (또는 A D) 는 언어를 넘기는 키다. 시작으로 치지 않는다.
    if (I18N.cycleByKey()) return;
    if (!Input.anyPressed) return;
    // 판이 시작되면 언어를 잠근다 — 도중에 바뀌면 내레이션이 중간에 갈아 끼워진다
    I18N.locked = true;
    Snd.init();
    Snd.startAmbience();
    this.el.title.classList.add('off');
    setTimeout(() => { this.el.title.style.display = 'none'; }, 1200);
    this.startIntro();
  },

  /* ---------------- INTRO : 공원 ---------------- */
  startIntro() {
    this.state = 'intro';
    this.map = Levels.build('park');
    this.goal = null;

    const s = this.map.start;
    this.player = { x: s.x - 4, y: s.y - 4, w: 8, h: 8, face: 1, walk: 0, speed: 0, moving: false };
    this.cat = { x: s.x + 74, y: s.y + 14, face: -1, run: false, alive: true, anim: 0, speed: 0 };

    this.cam.x = this.player.x - R.W / 2;
    this.cam.y = this.player.y - R.H / 2;
    this.clampCam();

    this.fade = 0;
    this.fadeTo(1, 2.8);
    this.setHint(TXT(TouchPad.enabled ? 'hint.skipTouch' : 'hint.skipKey'));

    const P = this.player, C = this.cat;
    this.setTimeline([
      { at: 0.6,  fn: () => { P.speed = 28; C.speed = 28; } },
      { at: 1.8,  fn: () => Narrator.say([TXT('intro.1')]) },
      { at: 4.8,  fn: () => Narrator.say([TXT('intro.2')]) },
      { at: 8.4,  fn: () => { C.speed = 0; Snd.bell(1.0); } },
      { at: 9.3,  fn: () => { P.speed = 0; } },
      { at: 9.8,  fn: () => Narrator.say([TXT('intro.3')]) },
      { at: 12.4, fn: () => { C.face = -1; Snd.meow(0.1, 0.9); } },
      { at: 13.4, fn: () => Narrator.say([TXT('intro.4')]) },
      { at: 16.0, fn: () => { C.run = true; C.face = 1; C.speed = 132; Snd.meow(0.5, 0.7); } },
      { at: 16.8, fn: () => Narrator.say([TXT('intro.5')]) },
      { at: 19.4, fn: () => { C.alive = false; Snd.bell(0.7); } },
      { at: 20.2, fn: () => { P.speed = 54; } },
      { at: 21.4, fn: () => { P.speed = 0; Narrator.say([TXT('intro.6')]); } },
      { at: 24.6, fn: () => { this.fadeTo(0, 2.4); Narrator.clear(); this.setHint(''); } },
      { at: 27.4, fn: () => this.startStage(0) }
    ]);
  },

  updIntro(dt) {
    if (this.tlT > 1.0 && Input.pressed(' ', 'enter', 'escape', 'e')) {
      Narrator.clear(); this.setHint(''); this.tl = [];
      this.fadeTo(0, 0.5);
      setTimeout(() => this.startStage(0), 560);
      return;
    }
    this.updateTimeline(dt);
    // 타임라인 마지막 이벤트가 startStage 로 넘어가면 이 프레임의 나머지는 무효다.
    // (고양이가 null 로 바뀌어 아래에서 터진다)
    if (this.state !== 'intro') return;

    const P = this.player, C = this.cat;
    if (P.speed > 0) {
      const d = P.speed * dt;
      P.x += d;
      P.walk += dt * 6.5;
      P.moving = true;
      this.footstep(d);
    } else { P.moving = false; this.stepDist = this.STRIDE * 0.7; }
    if (C.speed > 0) { C.x += C.speed * dt; C.anim += dt * 14; }

    this.followCam(P.x + 4, P.y + 4, dt, 5);
  },

  /* ---------------- STAGE ---------------- */
  startStage(i) {
    this.stageIdx = i;
    this.state = 'play';
    this.locked = true;

    this.map = Levels.build(STAGES[i]);
    const m = this.map, T = m.T;

    this.player = { x: m.start.x - 4, y: m.start.y - 4, w: 8, h: 8, face: 1, walk: 0, moving: false };
    this.goal = m.goal;

    if (m.goal.type === 'cat')
      this.cat = { x: m.goal.x, y: m.goal.y, face: 1, run: false, alive: true, anim: 0, speed: 0 };
    else
      this.cat = null;

    if (!Levels.reachable(m, { x: (m.start.x / T) | 0, y: (m.start.y / T) | 0 },
                             { x: m.goal.tx, y: m.goal.ty }))
      console.warn('[level] 목표에 도달할 수 없다:', STAGES[i]);

    this.cam.x = this.player.x - R.W / 2;
    this.cam.y = this.player.y - R.H / 2;
    this.clampCam();

    this.meowT = U.rand(3, 6);
    this.creakT = U.rand(18, 32);
    this.stepDist = this.STRIDE * 0.7;

    // 불안도와 흔적은 스테이지를 넘어 누적된다 — 아래로 갈수록 조여지도록
    this.searchT = 0; this.searchTarget = null;
    this.torchOutT = 0; this.hiding = null; this.shake = 0;
    this.dropFigure(false);
    // 정해진 좌표에 서 있는 것들. 다가가면 깨어난다.
    this.sentries = (m.sentries || []).map(s => ({ x: s.x, y: s.y, glitchSeed: Math.random() }));
    Narrator.clearFlash();

    this.fade = 0;
    this.fadeTo(1, 2.2);
    this.showStageTitle(m.title, 3.6);
    // 문 앞 정적에서 master 를 내려 둔 채로 여기 들어올 수 있다.
    // 판이 시작되는데 소리가 없으면 그때부터 게임이 통째로 무음이 된다.
    Snd.unhush(0.5);
    Snd.setAmbience(1, 3);

    // 잠긴 곳이 있는 판은 무엇을 찾아야 하는지 한 줄로 알려 준다.
    // 열쇠가 있다는 사실 자체를 숨기면 탐색이 아니라 헤매기가 된다.
    const lines = m.lines.slice();
    if (m.lock) lines.push(TXT(m.lock.kind === 'key' ? 'lock.key' : 'lock.shard'));

    setTimeout(() => {
      if (this.state !== 'play') return;
      Narrator.say(lines, () => {
        this.locked = false;
        this.setHint(TXT(TouchPad.enabled ? 'hint.moveTouch' : 'hint.moveKeys'));
        setTimeout(() => this.setHint(''), 4500);
      });
    }, 1700);
  },

  updPlay(dt) {
    const P = this.player;

    if (this.searchT > 0) {
      this.searchT -= dt;
      if (this.searchT <= 0) this.resolveSearch();
    }
    if (this.torchOutT > 0) this.torchOutT -= dt;
    this.updFigure(dt);
    if (this.state !== 'play') return;
    this.updSentries();

    if (this.locked || this.searchT > 0 || this.hiding) {
      if (this.locked && Input.pressed(' ', 'enter', 'e')) Narrator.advance();
      P.moving = false;
      this.stepDist = this.STRIDE * 0.7;
    } else {
      const mv = Input.move();
      if (mv.m > 0) {
        const sp = this.SPEED * mv.m;
        const bx = P.x, by = P.y;
        this.moveAxis(P, mv.x * sp * dt, 0);
        this.moveAxis(P, 0, mv.y * sp * dt);
        if (Math.abs(mv.x) > 0.25) P.face = mv.x > 0 ? 1 : -1;
        P.walk += dt * 7 * mv.m;
        P.moving = true;
        // 벽에 밀려 실제로 움직이지 못하면 발소리도 나지 않는다
        this.footstep(Math.hypot(P.x - bx, P.y - by));
      } else { P.moving = false; this.stepDist = this.STRIDE * 0.7; }
    }
    if (this.state !== 'play') return;

    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.followCam(pcx, pcy, dt, 5);

    /* --- 상호작용 --- */
    const G = this.goal;
    const d = U.dist(pcx, pcy, G.x, G.y);
    const chased = this.figure && this.figure.mode === 'chase';
    let hint = '';

    if (this.hiding) {
      // 들킨 뒤에는 나올 수 없다. 문이 열릴 때까지 안에서 듣고 있어야 한다.
      if (!(this.figure && this.figure.hunt)) {
        hint = TXT('hint.exitHide');
        if (Input.pressed('e')) { this.exitHide(); return; }
      }
    } else if (!this.locked && this.searchT <= 0) {
      const gate = this.map.gate;
      const gd = (gate && !gate.open) ? U.dist(pcx, pcy, gate.x, gate.y) : Infinity;
      const L = this.map.lock;
      const short = L ? L.need - L.have : 0;

      if (gd < 36) {
        if (short > 0) {
          hint = TXT('hint.gateLocked', { have: L.have, need: L.need });
          if (Input.pressed('e')) {
            Snd.rattle();
            Narrator.flash(
              TXT('gate.rattle', { n: short, shard: I18N.plural(short, 'shard', 'shards') }),
              { bad: true, dur: 3.4 });
          }
        } else {
          hint = TXT('hint.gateOpen');
          if (Input.pressed('e')) { this.openGate(); return; }
        }
      } else if (!G.used && d < 30) {
        if (short > 0 && !gate) {
          hint = TXT('hint.doorLocked');
          if (Input.pressed('e')) {
            Snd.rattle();
            Narrator.flash(TXT('door.rattle'), { bad: true, dur: 3.4 });
          }
        } else {
          hint = TXT(G.type === 'door' ? 'hint.door' : 'hint.cat');
          if (Input.pressed('e')) {
            G.used = true;
            this.setHint('');
            if (G.type === 'door') this.enterDoor(); else this.startEnding();
            return;
          }
        }
      } else {
        // 쫓기는 중에는 뒤지는 것보다 숨는 것이 먼저다
        const box = this.nearestHide(pcx, pcy);
        const pr = chased ? null : this.nearestSearchable(pcx, pcy);
        if (pr) {
          hint = 'E — ' + this.searchVerb(pr.n);
          if (Input.pressed('e')) { this.beginSearch(pr); hint = ''; }
        } else if (box) {
          hint = TXT(chased ? 'hint.hideNow' : 'hint.hide');
          if (Input.pressed('e')) { this.tryHide(box); return; }
        }
      }
    }
    if (hint) this.setHint(hint, true);
    else if (this._actionHint) this.setHint('');

    /* 시간이 지났다고 저절로 나타나지는 않는다.
       그것이 나오는 경로는 셋뿐이고 전부 좌표로 정해져 있다 —
       처음부터 서 있던 것(sentries) / 특정 물건을 건드렸을 때(triggers) / 철문을 열었을 때. */

    /* --- 고양이 울음 : 목표 방향으로 패닝 --- */
    this.meowT -= dt;
    if (this.meowT <= 0 && !G.used) {
      this.meowT = U.rand(7.5, 13);
      Snd.meow(U.clamp((G.x - pcx) / 340, -1, 1), U.clamp(1.15 - d / 950, 0.16, 1));
    }

    /* --- 멀리서 문이 여닫히는 소리 --- */
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = U.rand(22, 44);
      if (U.chance(0.6)) Snd.creak(0.30); else Snd.thump(0, 0.4);
    }
  },

  /* 이동한 거리만큼 발소리를 쌓는다. 걸음 폭이 곧 소리 간격이 된다. */
  footstep(moved) {
    if (moved <= 0.02) return;
    this.stepDist += moved;
    if (this.stepDist < this.STRIDE) return;
    this.stepDist -= this.STRIDE;
    Snd.step(this.map ? this.map.theme : 'alley');
  },

  /* ---------------- 철문 ---------------- */
  openGate() {
    if (!Levels.openGate(this.map)) return;
    this.setHint('');
    Snd.gateOpen();
    Narrator.flash(TXT('gate.opened'), { dur: 4.0 });
    this.dreadBy(1);
    // 쇠가 긁히는 소리는 멀리 간다. 정해진 자리에 하나 선다.
    this.spawnAt(this.map.gateSpawn, this.defaultMode());
  },

  /* ---------------- 수색 ---------------- */
  nearestSearchable(pcx, pcy) {
    const T = this.map.T;
    let best = null, bd = 30;
    for (const pr of this.map.props) {
      if (!pr.searchable || pr.searched) continue;
      const d = U.dist(pcx, pcy, pr.tx * T + T / 2, pr.ty * T + T / 2);
      if (d < bd) { bd = d; best = pr; }
    }
    return best;
  },

  searchVerb(n) {
    switch (n) {
      case 'cabinet': return TXT('verb.cabinet');
      case 'bed':     return TXT('verb.bed');
      case 'shelf':   return TXT('verb.shelf');
      case 'bin':     return TXT('verb.bin');
      case 'drum':
      case 'barrel':  return TXT('verb.drum');
      default:        return TXT('verb.crate');
    }
  },

  beginSearch(pr) {
    this.searchTarget = pr;
    this.searchT = 0.9;
    this.setHint('');
    Narrator.clearFlash();
    Snd.rummage();
  },

  resolveSearch() {
    const pr = this.searchTarget;
    this.searchTarget = null;
    if (!pr) return;
    pr.searched = true;

    switch (pr.outcome) {
      case 'trace':
        this.traces++;
        this.dreadBy(-1);
        Narrator.flash(Levels.flavor('trace', pr.flavorIdx));
        // 흔적을 찾으면 고양이가 곧바로 한 번 운다 — 유일한 보상이자 방향 힌트
        setTimeout(() => {
          if (this.state !== 'play') return;
          const G = this.goal, pcx = this.player.x + 4;
          Snd.meow(U.clamp((G.x - pcx) / 340, -1, 1), 0.9);
        }, 750);
        break;

      case 'noise':
        this.dreadBy(0.6);
        Narrator.flash(Levels.flavor('noise', pr.flavorIdx));
        if (U.chance(0.5)) Snd.scurry(); else Snd.thump(0.15, 0.5);
        break;

      case 'key':
        this.takeKey();
        break;

      case 'dread':
        this.dreadBy(2);
        this.dreadEvent(pr);
        break;

      default:
        Narrator.flash(Levels.flavor('empty', pr.flavorIdx));
    }

    // 정해진 물건을 건드렸다면, 뚜껑을 닫고 고개를 들었을 때 정해진 자리에 서 있다.
    // 1라운드에서는 쳐다보기만 하지만, 그 뒤로는 그대로 걸어온다.
    const spot = this.map.triggers.get(pr.tx + ',' + pr.ty);
    if (spot) this.spawnAt(spot, this.defaultMode());
  },

  /* 열쇠 / 열쇠 조각을 손에 넣는다 */
  takeKey() {
    const L = this.map.lock;
    if (L) L.have = Math.min(L.need, L.have + 1);
    this.dreadBy(-0.5);
    Snd.pickup();
    if (!L || L.kind === 'key')
      Narrator.flash(TXT('key.take'), { dur: 4.4 });
    else if (L.have >= L.need)
      Narrator.flash(TXT('key.last', { have: L.have, need: L.need }), { dur: 4.8 });
    else
      Narrator.flash(TXT('key.shard', { have: L.have, need: L.need }), { dur: 4.4 });
  },

  dreadBy(v) {
    this.dread = U.clamp(this.dread + v, 0, 10);
    Snd.setDread(this.dread);
  },

  /* 잘못 연 쪽.
     1라운드에서는 한 번 보여주고 사라지지만, 그 뒤로는 상자에서 걸어 나온다. */
  dreadEvent(pr) {
    const T = this.map.T;
    const kinds = ['figure', 'torch', 'bell', 'deep', 'behind'];
    switch (kinds[(pr.tx * 7 + pr.ty * 13) % kinds.length]) {
      case 'figure': {
        Narrator.flash(TXT('dread.figure'), { bad: true, dur: 4.4 });
        Snd.sting();
        const F = this.figure = this.newFigure(pr.tx * T + T / 2, pr.ty * T + T - 2, 'inside');
        F.t = this.stageIdx === 0 ? 0.6 : 1.1;
        F.becomes = this.stageIdx === 0 ? null : 'chase';
        break;
      }
      case 'torch':
        Narrator.flash(TXT('dread.torch'), { bad: true, dur: 4.4 });
        Snd.thump(0, 0.7);
        this.torchOutT = 2.1;
        break;
      case 'bell':
        Narrator.flash(TXT('dread.bell'), { bad: true, dur: 4.4 });
        Snd.nearBell();
        break;
      case 'deep':
        Narrator.flash(TXT('dread.deep'), { bad: true, dur: 4.4 });
        Snd.sting();
        break;
      default:
        // 소리만 난다. 실제로 무언가 서는 것은 triggers 에 적힌 자리뿐이다.
        Narrator.flash(TXT('dread.behind'), { bad: true, dur: 4.8 });
        Snd.creak(0.7);
    }
  },

  /* ================= 그것 =================
     1라운드 : 'watch' — 서서 바라보기만 한다. 다가가면 사라진다.
     2라운드 이후 : 'chase' — 주인공의 0.7배 속도로 따라온다.
                    상자·옷장에 숨거나 충분히 멀어지면 따돌릴 수 있다.
  ======================================== */
  defaultMode() { return this.stageIdx === 0 ? 'watch' : 'chase'; },

  /* 그것을 치울 때는 반드시 여기를 지난다 — 추격 사운드가 남아 있으면 안 된다 */
  dropFigure(whoosh) {
    if (this.figure && this.figure.mode === 'chase') Snd.stopChase();
    Snd.stopDirge();
    this.figure = null;
    this.chaseProx = 0;
    this.flick = 0;
    if (whoosh) Snd.whoosh();
  },

  /* 그것 하나를 만든다.
     필드 구성은 반드시 여기 한 곳에서만 정한다. 다른 데서 객체 리터럴로 찍어 내면
     필드가 하나씩 빠지고, 그 빠진 필드를 읽는 순간 update() 안에서 예외가 난다.
     그러면 requestAnimationFrame 이 다시 걸리지 않아 화면이 그대로 멈춘다 —
     실제로 옷장에서 나온 그것이 걷기 시작할 때 그렇게 멈췄다. */
  newFigure(x, y, mode) {
    const P = this.player;
    const px = P.x + 4, py = P.y + 4;
    // 나타나는 순간에는 이쪽을 보고 있다. 등을 돌린 채 생겨나면
    // 나타나자마자 사각이 생겨 첫 판정이 우연이 된다.
    const dx = px - x, dy = py - y, dl = Math.hypot(dx, dy) || 1;
    return {
      x, y, mode, becomes: null,
      t: 3.4,                  // 응시 시간. 판마다 달라지면 안 되므로 고정값이다.
      farT: 0, lostT: 0, hunt: null, prowlT: 0, prowlTo: null, missT: 0,
      flow: null, flowT: 0, stepT: 0, stuckT: 0, arriveT: 0,
      scratched: false, hushed: false, knobbed: false,
      dir: { x: dx / dl, y: dy / dl },   // 향하고 있는 쪽. 걸어간 방향을 따라간다.
      lastSeen: { x: px, y: py },
      trail: { x: px, y: py },
      glitchSeed: Math.random()  // 얼굴 지지직 프레임의 위상. 개체마다 어긋나야 한다.
    };
  },

  /* 그것이 (x,y) 를 보고 있는가.
     부채꼴 안인가 → 시선이 닿는가. 순서를 바꾸면 안 된다 —
     각도 검사가 훨씬 싸고, 대부분은 여기서 걸러진다. */
  figSees(F, x, y) {
    const dx = x - F.x, dy = y - F.y;
    const d = Math.hypot(dx, dy);
    if (d > this.FIG_VIEW_D) return false;
    if (d < 1) return true;

    // 화면이 위아래로 눌려 있으므로(렌더러 광원 감쇠와 같은 1.15) 각도도 같은
    // 비율로 펴서 잰다. 방향과 상대 위치를 같은 공간에서 재야 눈에 보이는
    // 부채꼴과 판정이 어긋나지 않는다.
    const dir = F.dir || { x: 1, y: 0 };
    const K = this.VIEW_SQUASH;
    const ax = dx, ay = dy * K;
    const bx = dir.x, by = dir.y * K;
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
    if (cos < Math.cos(this.FIG_FOV * Math.PI / 180)) return false;

    return Levels.sees(this.map, F.x, F.y, x, y);
  },

  /* 얼굴(눈·입) 프레임을 짧고 불규칙한 간격으로 건너뛰며 고른다 —
     몸은 그대로 두고 이목구비만 아날로그 호러식으로 지지직거리게. */
  figGlitchFrame(seed) {
    const n = SPR.FIGURE_FRAMES.length;
    const t = Math.floor(this.time * 9);
    const h = Math.sin((t + seed * 97) * 12.9898) * 43758.5453;
    return Math.floor((h - Math.floor(h)) * n) % n;
  },

  /* 주인공까지의 근접도 0~1. 소리(Snd.figStep)와 같은 기준(300px)을 쓴다 —
     귀로 듣는 거리와 눈으로 보는 일그러짐이 어긋나면 둘 다 가짜로 느껴진다. */
  figProx(F) {
    const P = this.player;
    if (!P) return 0;
    return U.clamp(1 - U.dist(P.x + 4, P.y + 4, F.x, F.y) / 300, 0, 1);
  },

  FIG_H: 32,
  FIG_HEAD: 11,      // 0~10 이 머리와 목, 11 부터가 어깨

  /* 그것을 그릴 줄 배열을 만든다.
     스프라이트에 픽셀을 더 박는 대신 그릴 때 형태를 깨뜨린다 — 17x32 격자에
     눈과 입을 더 그려 넣어 봐야 자글자글해지기만 하고 기괴해지지는 않는다.
     실제로 한 번 그렇게 해 봤고 전부 걷어냈다. 격자를 늘리지 않고 무섭게
     만드는 방법은 해상도가 아니라 형태를 흔드는 쪽에 있다.

       · 가까울수록 키가 자란다. 실루엣이 커지는 것 자체가 위협이다.
       · 머리는 통째로 어긋난다 — 목 위에서 미끄러진 것처럼. 머리까지 띠로
         찢어 봤더니 눈이 뭉개져 그냥 잡음 덩어리가 됐다. 얼굴은 남기고
         자리만 틀어야 '잘못 붙어 있다' 로 읽힌다.
       · 몸은 줄을 세 개씩 묶어 가로로 민다. 줄마다 따로 흔들면 그저
         지직거리는 잡음이고, 묶어야 테이프가 끊긴 것처럼 읽힌다.
         몸통은 세로선이 길어 찢었을 때 잘 읽힌다 — 머리와 반대다. */
  figWarpRows(F, prox) {
    const H = this.FIG_H, HEAD = this.FIG_HEAD, BODY = H - HEAD;
    const seed = F.glitchSeed || 0, t = this.time;

    const grow = 1 + prox * 0.40;
    // 머리가 제 박자로 조금 부풀었다 꺼진다. 크게 주면 눈이 세로로 늘어져
    // 뭉개지므로 아주 얕게만.
    const swell = 1 + prox * 0.20 * (0.5 + 0.5 * Math.sin(t * 2.3 + seed * 19.7));
    const headOut = Math.max(1, Math.round(HEAD * grow * swell));
    const bodyOut = Math.max(1, Math.round(BODY * grow));

    const rows = [];
    for (let i = 0; i < headOut; i++)
      rows.push({ sy: Math.min(HEAD - 1, (i * HEAD / headOut) | 0), dx: 0 });
    for (let i = 0; i < bodyOut; i++)
      rows.push({ sy: HEAD + Math.min(BODY - 1, (i * BODY / bodyOut) | 0), dx: 0 });

    // 머리는 몸보다 느리게(1/6초) 옮겨 붙는다. 몸이 지직거리는 동안
    // 머리만 천천히 미끄러져야 둘이 따로 노는 것으로 보인다.
    const hn = Math.sin(seed * 31.7 + Math.floor(t * 6) * 4.11) * 43758.5453;
    const headDx = Math.round(((hn - Math.floor(hn)) - 0.5) * 2 * prox * 3.4);

    // 어긋난 자리는 한 틱(1/12초) 동안 그대로 붙들려 있어야 한다.
    // 매 프레임 새로 뽑으면 흔들리는 게 아니라 끓어오르는 것처럼 보인다.
    const tick = Math.floor(t * 12);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].sy < HEAD) { rows[i].dx = headDx; continue; }
      const band = (i / 3) | 0;
      const n = Math.sin(band * 7.13 + seed * 31.7 + tick * 2.39) * 43758.5453;
      const r = n - Math.floor(n);
      // 대부분의 띠는 제자리에 둔다. 가끔 크게 어긋나야 고장으로 읽힌다.
      if (r > 0.20 && r < 0.80) continue;
      const amp = 1.7 * (0.4 + prox * 1.6);
      const mag = r < 0.5 ? (0.20 - r) / 0.20 : (r - 0.80) / 0.20;
      rows[i].dx = Math.round((r < 0.5 ? -1 : 1) * amp * (0.5 + mag * 0.5));
    }
    return rows;
  },

  makeFigure(x, y, mode) {
    this.figure = this.newFigure(x, y, mode);
    Snd.breath();
    if (mode === 'chase') Snd.startChase();
    return this.figure;
  },

  /* 청사진에 적힌 좌표에 그것을 세운다.
     이미 하나 나와 있거나 숨어 있는 중이면 세우지 않는다. */
  spawnAt(spot, mode) {
    if (!spot || this.figure || this.hiding || this.locked) return false;
    this.makeFigure(spot.x, spot.y, mode);
    return true;
  },

  /* 처음부터 서 있던 것이 이쪽을 알아챈다 */
  updSentries() {
    if (!this.sentries.length || this.figure || this.hiding || this.locked) return;
    const P = this.player, px = P.x + 4, py = P.y + 4;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (U.dist(px, py, s.x, s.y) > this.WAKE_D) continue;
      this.sentries.splice(i, 1);
      const mode = this.defaultMode();
      this.makeFigure(s.x, s.y, mode);
      if (mode === 'chase')
        Narrator.flash(TXT('fig.wake'), { bad: true, dur: 3.8 });
      return;
    }
  },

  /* 상자 안에 있던 것이 밖으로 걸어 나온다 */
  convertToChase(F) {
    const px = this.player.x + 4, py = this.player.y + 4;
    F.mode = 'chase';
    F.becomes = null;
    F.t = 0; F.farT = 0; F.lostT = 0; F.prowlT = 0; F.prowlTo = null; F.missT = 0;
    F.hunt = null; F.flow = null; F.flowT = 0; F.stepT = 0; F.stuckT = 0; F.arriveT = 0;
    // 뚜껑을 연 사람이 바로 앞에 있다. 지금 이 자리가 곧 마지막으로 본 자리다.
    F.lastSeen = { x: px, y: py };
    F.trail = { x: px, y: py };
    Snd.startChase();
    Narrator.flash(TXT('fig.outOfBox'), { bad: true, dur: 4.0 });
  },

  updFigure(dt) {
    const F = this.figure;
    if (!F) return;
    const P = this.player;
    const px = P.x + 4, py = P.y + 4;

    if (F.mode === 'inside') {
      F.t -= dt;
      if (F.t <= 0) {
        if (F.becomes === 'chase') this.convertToChase(F);
        else this.figure = null;
      }
      return;
    }

    if (F.mode === 'watch') {
      F.t -= dt;
      if (U.dist(px, py, F.x, F.y) < 46) { this.dropFigure(true); return; }
      if (F.t <= 0) this.dropFigure(true);
      return;
    }

    /* ---- 추격 ----
       숨어 있으면 목표가 달라진다.
         · 들킨 경우(hunt)   — 숨은 자리로 곧장, 아주 느리게 다가온다
         · 못 본 경우(prowl) — 마지막으로 본 자리 근처를 서성인다 */
    let target;
    if (this.hiding) target = F.hunt || F.prowlTo || F.trail;
    else target = { x: px, y: py };

    F.flowT -= dt;
    if (F.flowT <= 0) { F.flow = this.buildFlow(target); F.flowT = 0.4; }

    const speed = this.SPEED * (F.hunt ? this.CREEP_SPEED : this.FIG_SPEED);
    const bx = F.x, by = F.y;
    this.flowStep(F, speed, dt);

    /* 향한 쪽은 실제로 걸어간 쪽이다. 한 프레임에 홱 돌지 않게 물린다 —
       모퉁이를 도는 동안 부채꼴이 순간이동하면 숨는 타이밍을 읽을 수 없다. */
    const mvx = F.x - bx, mvy = F.y - by;
    const ml = Math.hypot(mvx, mvy);
    if (ml > 0.01) {
      const k = 1 - Math.pow(0.004, dt);
      F.dir.x += (mvx / ml - F.dir.x) * k;
      F.dir.y += (mvy / ml - F.dir.y) * k;
      const dl = Math.hypot(F.dir.x, F.dir.y) || 1;
      F.dir.x /= dl; F.dir.y /= dl;
    }

    // 갈 길을 못 찾고 굳어버리는 경우가 있다(닿을 수 없는 자리에 선 경우 등).
    // 그대로 두면 화면 어딘가에 영원히 서 있게 되므로 잠시 뒤 사라지게 한다.
    // 숨은 자리 앞에 도착해 멈춰 선 것은 굳은 것이 아니다 — 세지 않는다.
    if (!F.hunt && !this.hiding && Math.hypot(F.x - bx, F.y - by) < 0.05) {
      F.stuckT = (F.stuckT || 0) + dt;
      if (F.stuckT > 3) { this.dropFigure(true); return; }
    } else F.stuckT = 0;

    /* 거리 정보는 전부 소리로 준다 — 심장박동 간격과 발소리 방향 */
    const dist = U.dist(px, py, F.x, F.y);
    this.chaseProx = U.clamp(1 - dist / 240, 0, 1);
    Snd.setChaseIntensity(this.chaseProx);
    F.stepT -= dt;
    if (F.stepT <= 0) {
      // 다가올 때는 걸음이 느려진다. 간격이 벌어지는 것 자체가 신호다.
      // 쫓을 때도 종종걸음이 아니다 — 무거운 것은 천천히 딛는다.
      F.stepT = F.hunt ? U.rand(0.95, 1.20) : U.rand(0.50, 0.60);
      // 거리·방향 계산은 전부 Snd 가 한다. 여기서는 좌표 차이만 넘긴다.
      const near = Snd.figStep(F.x - px, F.y - py, !!F.hunt);
      // 가까이서 딛으면 바닥이 울린다. 소리와 화면이 같은 순간에 흔들려야
      // 무게로 읽힌다 — 따로 놀면 그냥 화면이 떨리는 것으로 보인다.
      if (near > 0.4) this.shake = Math.max(this.shake, (near - 0.4) / 0.6);
    }

    if (this.hiding) { this.updHidden(F, dt, dist); return; }

    F.lastSeen.x = px; F.lastSeen.y = py;
    // '마지막으로 제대로 본 자리' 는 조금 뒤처져 따라온다.
    // 숨는 순간의 위치를 그대로 쓰면 곧장 그 상자 앞으로 걸어와 선다 —
    // 못 보고 놓쳤는데도 매번 정확히 찾아오는 것처럼 보이던 원인이다.
    const k = 1 - Math.pow(0.3, dt);
    F.trail.x += (px - F.trail.x) * k;
    F.trail.y += (py - F.trail.y) * k;

    if (dist < this.CATCH_D) { this.death('caught'); return; }
    if (dist > this.GIVEUP_D) {
      F.farT += dt;
      if (F.farT > 2.5) this.dropFigure(true);
    } else F.farT = 0;
  },

  /* 숨어 있는 동안.
     여기서 갈리는 두 가지가 이 게임에서 가장 긴 시간이다 —
     문틈으로 발소리가 멀어지는 것을 듣거나, 가까워지는 것을 듣거나. */
  updHidden(F, dt, dist) {
    const spot = this.hiding.spot;

    /* --- 들켰다 : 천천히 다가온다. 화면이 그 박자에 맞춰 명멸한다. --- */
    if (F.hunt) {
      const d = U.dist(F.hunt.x, F.hunt.y, F.x, F.y);
      // 숨은 물건 자체가 막힌 칸이라 바로 앞 칸까지밖에 못 온다.
      // 한 칸(16px) 남은 자리를 "도착" 으로 보고, 거기서부터 세 박자를 쌓는다.
      const arrived = d < 30;
      if (!arrived) {
        const near = U.clamp(1 - d / 190, 0, 1);
        // 가까울수록 빠르고 깊게 깜빡인다
        const beat = Math.sin(this.time * (7 + near * 24));
        this.flick = beat > 0 ? Math.pow(beat, 3) * (0.30 + near * 0.62) : 0;
        Snd.setDirge(near);
        return;
      }

      F.arriveT = (F.arriveT || 0) + dt;
      this.doorBeat(F, F.arriveT);
      return;
    }

    /* --- 못 봤다 : 주변을 서성이다 사라진다.
       여기서는 무슨 짓을 해도 찾아내지 못한다. 들어가는 것을 봤느냐 아니냐,
       판정은 그 한 번뿐이다 — 그래야 "얼마나 벌리고 숨을까" 가 실제 선택이 된다. --- */
    this.flick = 0;
    F.lostT += dt;

    // 문 앞을 스쳐 지나간다. 발소리가 멎었다가, 다시 멀어진다.
    F.missT -= dt;
    if (U.dist(spot.x, spot.y, F.x, F.y) < this.NEAR_MISS_D && F.missT <= 0) {
      F.missT = 4.5;
      Snd.breath();
      Narrator.flash(TXT('fig.atDoor'), { bad: true, dur: 3.0 });
    }

    // 마지막으로 제대로 본 자리 언저리를 돌아다닌다
    F.prowlT -= dt;
    if (F.prowlT <= 0 || !F.prowlTo) {
      F.prowlTo = this.prowlPoint(F.trail);
      F.prowlT = U.rand(1.6, 2.8);
      F.flowT = 0;
    }
    if (F.lostT > this.PROWL_T) this.dropFigure(true);
  },

  /* 문 앞에 선 뒤의 세 박자.
     예전에는 도착하고 1.1초 뒤에 그냥 죽었다. 가장 무서워야 할 구간이
     제일 부실했다 — 문 너머에 무언가 서 있다는 사실 자체가 연출인데
     그 시간을 안 준 것이다. 셋으로 쪼갠다.

       1) 긁는다  — 명멸이 가장 빠르고 깊다. 아직 소리가 있다.
       2) 정 적   — 소리도 명멸도 전부 걷어낸다. 손전등은 실오라기만 남는다.
                    여기서 아무 일도 일어나지 않는 것이 이 연출의 전부다.
                    사람은 소리가 커질 때가 아니라 갑자기 사라질 때 숨을 참는다.
       3) 손잡이 — 정적 속에서 딸깍 한 번. 다음이 무엇인지 알려 주는 유일한 신호.

     길이는 전부 고정값이다. 판마다 달라지면 두 번째 판부터 박자를 못 읽는다. */
  DOOR_SCRATCH: 1.05,
  DOOR_HUSH: 1.25,
  DOOR_KNOB: 0.55,

  doorBeat(F, a) {
    const t1 = this.DOOR_SCRATCH, t2 = t1 + this.DOOR_HUSH, t3 = t2 + this.DOOR_KNOB;

    if (a < t1) {
      const beat = Math.sin(this.time * 31);
      this.flick = beat > 0 ? Math.pow(beat, 3) * 0.92 : 0;
      Snd.setDirge(1);
      if (!F.scratched) { F.scratched = true; Snd.scratch(); }
      return;
    }

    if (a < t2) {
      if (!F.hushed) {
        F.hushed = true;
        Snd.stopDirge();
        Snd.hush(0.30);
      }
      this.flick = 0;               // 깜빡임도 멎는다. 화면이 죽은 듯 고요해진다.
      return;
    }

    if (a < t3) {
      if (!F.knobbed) { F.knobbed = true; Snd.unhush(0.01); Snd.knob(); Snd.hush(0.5); }
      this.flick = 0;
      return;
    }

    this.death('found');
  },

  /* 마지막으로 본 자리 주변에서 어슬렁거릴 지점 하나 */
  prowlPoint(from) {
    const m = this.map, T = m.T;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = U.rand(30, 120);
      const tx = ((from.x + Math.cos(a) * r) / T) | 0;
      const ty = ((from.y + Math.sin(a) * r) / T) | 0;
      if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H) continue;
      if (Levels.solid(m, tx, ty)) continue;
      return { x: tx * T + T / 2, y: ty * T + T - 2 };
    }
    return { x: from.x, y: from.y };
  },

  /* 숨은 자리를 들켰다 */
  spotted(F, line) {
    const spot = this.hiding.spot;
    F.hunt = { x: spot.x, y: spot.y };
    F.flowT = 0;
    F.stepT = 0.5;
    Snd.stopChase();
    Snd.startDirge();
    Narrator.flash(line, { bad: true, dur: 4.4 });
  },

  /* 목표 지점까지의 거리장. 타일이 몇 안 되니 매번 새로 만들어도 싸다. */
  buildFlow(target) {
    const map = this.map, W = map.W, H = map.H, T = map.T;
    let tx = U.clamp((target.x / T) | 0, 0, W - 1);
    let ty = U.clamp((target.y / T) | 0, 0, H - 1);

    // 목표 칸이 막혀 있으면(소품이 올라간 칸 등) 가장 가까운 갈 수 있는 칸으로 옮긴다.
    // 여기서 그냥 포기하면 추격자가 그대로 굳어버린다.
    if (Levels.solid(map, tx, ty)) {
      let found = null;
      for (let r = 1; r <= 3 && !found; r++)
        for (let dy = -r; dy <= r && !found; dy++)
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = tx + dx, ny = ty + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            if (!Levels.solid(map, nx, ny)) found = { x: nx, y: ny };
          }
      if (!found) return null;
      tx = found.x; ty = found.y;
    }

    const dist = new Int32Array(W * H).fill(-1);
    const q = [tx + ty * W];
    dist[q[0]] = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0, dv = dist[c];
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = nx + ny * W;
        if (dist[ni] !== -1 || Levels.solid(map, nx, ny)) continue;
        dist[ni] = dv + 1;
        q.push(ni);
      }
    }
    return dist;
  },

  /* 거리장을 따라 다음 칸 중앙으로 한 걸음 */
  flowStep(F, sp, dt) {
    if (!F.flow) return;
    const map = this.map, T = map.T, W = map.W;
    const cx = U.clamp((F.x / T) | 0, 0, map.W - 1);
    const cy = U.clamp(((F.y - 2) / T) | 0, 0, map.H - 1);
    // 자기가 선 칸에 값이 없어도(막힌 칸에 걸쳐 있을 때) 이웃 중 최소값으로 빠져나온다
    const here = F.flow[cx + cy * W];
    let best = here >= 0 ? here : Infinity, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.W || ny >= map.H) continue;
      const v = F.flow[nx + ny * W];
      if (v >= 0 && v < best) { best = v; bx = dx; by = dy; }
    }
    if (!bx && !by) return;

    const tgx = (cx + bx) * T + T / 2, tgy = (cy + by) * T + T - 2;
    const dx = tgx - F.x, dy = tgy - F.y;
    const l = Math.hypot(dx, dy);
    if (l < 0.5) return;
    const step = Math.min(l, sp * dt);
    F.x += dx / l * step;
    F.y += dy / l * step;
  },

  /* ---------------- 숨기 ---------------- */
  nearestHide(pcx, pcy) {
    const T = this.map.T;
    let best = null, bd = 30;
    for (const pr of this.map.props) {
      if (!Levels.CONTAINER.has(pr.n)) continue;
      const d = U.dist(pcx, pcy, pr.tx * T + T / 2, pr.ty * T + T / 2);
      if (d < bd) { bd = d; best = pr; }
    }
    return best;
  },

  tryHide(pr) {
    const T = this.map.T, F = this.figure;
    this.hiding = { pr, spot: { x: pr.tx * T + T / 2, y: pr.ty * T + T - 2 } };
    this.flick = 0;
    this.setHint('');
    Snd.creak(0.45);

    if (F && F.mode === 'chase') {
      F.lostT = 0;
      F.prowlT = 0; F.prowlTo = null;
      if (this.figSees(F, this.player.x + 4, this.player.y + 4)) {
        // 보고 있는 앞에서 들어갔다 — 서두르지 않는다. 어디로 들어갔는지 알고 있으니까.
        this.spotted(F, TXT('fig.sawMe'));
        return;
      }
    }
    Narrator.flash(TXT('hide.enter'), { dur: 2.8 });
  },

  exitHide() {
    const F = this.figure;
    this.hiding = null;
    this.flick = 0;
    this.stepDist = this.STRIDE * 0.7;
    Snd.creak(0.35);
    if (F && F.mode === 'chase' &&
        U.dist(this.player.x + 4, this.player.y + 4, F.x, F.y) < 40) this.death('caught');
  },

  /* ---------------- 죽음 ----------------
     두 가지는 끝맺음이 다르다.
       caught — 쫓기다 따라잡혔다. 어깨에 손이 닿는다. 조용히 끝난다.
       found  — 숨은 문이 밖에서 열렸다. 여기만 놀래킨다.
     같은 연출을 두 곳에 쓰면 둘 다 값이 떨어진다. 놀래키는 것은 한 곳뿐이라
     의미가 있고, 그 한 곳도 앞에 2.85초의 정적을 깔았기 때문에 성립한다. */
  death(kind) {
    if (this.state !== 'play') return;
    const found = kind === 'found';
    this.locked = true;
    this.hiding = null;
    this.searchT = 0;
    this.flick = 0;
    this.setHint('');
    Narrator.clear();
    Narrator.clearFlash();
    Snd.stopChase();
    Snd.stopBells();
    Snd.stopDirge();
    this.chaseProx = 0;

    if (found) { this.startJumpscare(); return; }

    this.state = 'dead';
    Snd.sting();
    Snd.thump(0.15, 0.9);
    Snd.setAmbience(0.25, 1.2);

    // 그것을 눈앞에 세운다
    const P = this.player;
    this.figure = this.newFigure(P.x + 4, P.y + 12, 'inside');
    this.figure.t = 1e9;

    this.setTimeline([
      { at: 0.3, fn: () => Narrator.say([TXT('death.caught')]) },
      { at: 3.0, fn: () => { this.fadeTo(0, 2.0); } },
      { at: 5.4, fn: () => Narrator.say([TXT('death.again')], () => this.restartRun()) }
    ]);
  },

  /* ---------------- 점프스케어 ----------------
     문이 열리고 얼굴이 화면을 가득 채운다. 1.45초.
     이 게임에서 유일하게 화면을 때리는 구간이라 규칙을 몇 개 지킨다.
       · 앞의 정적과 붙어 있을 때만 쓴다. 따로 떼면 그냥 시끄러운 화면이다.
       · 얼굴은 계속 다가온다. 첫 프레임에 제일 크면 그 뒤로는 잦아들기만 한다.
       · 스트로브는 앞의 0.55초만. 계속 뒤집으면 눈이 적응해서 무늬가 된다.
       · 끝나면 통째로 암전. 여운을 화면에 남기지 않고 소리와 문장으로만 남긴다. */
  JUMP_T: 1.45,

  startJumpscare() {
    this.state = 'jump';
    this.jump = { t: 0, seed: Math.random() };
    this.figure = null;
    this.shake = 1;
    this.tl = [];
    Snd.scream();
  },

  updJump(dt) {
    const J = this.jump;
    J.t += dt;
    // 끝까지 흔든다. draw 쪽에서 shake 를 매 프레임 깎으므로 여기서 다시 채운다.
    this.shake = Math.max(this.shake, 1 - (J.t / this.JUMP_T) * 0.45);
    if (J.t >= this.JUMP_T) this.afterJump();
  },

  /* 암전된 채로 문장만 남는다 */
  afterJump() {
    this.state = 'dead';
    this.jump = null;
    this.shake = 0;
    this.fade = 0;
    this.figure = null;
    Snd.setAmbience(0.25, 2.4);
    this.setTimeline([
      { at: 1.1, fn: () => Narrator.say([TXT('death.found')]) },
      { at: 4.4, fn: () => Narrator.say([TXT('death.again')], () => this.restartRun()) }
    ]);
  },

  restartRun() {
    this.dread = 0;
    this.traces = 0;
    this.dropFigure(false);
    Snd.setDread(0);
    Snd.setAmbience(1, 2);
    Snd._scheduleBell(4);      // death 에서 멈춘 종을 다시 돌린다
    this.startStage(0);
  },

  /* 손전등 : 꺼졌다 깜빡이며 돌아오는 구간 / 숨어 있는 동안은 문틈만큼 */
  torchScale() {
    if (this.state === 'dead') return Math.max(0.1, 1 - this.tlT * 0.55);
    if (this.hiding) {
      const F = this.figure;
      if (!F || !F.hunt) return 0.3;
      // 문 앞에 선 뒤로는 문틈이 박자에 맞춰 닫힌다.
      // 정적 구간에서는 거의 아무것도 안 보인다 — 귀만 남는다.
      const a = F.arriveT || 0;
      if (a <= 0) return 0.21;
      const t1 = this.DOOR_SCRATCH, t2 = t1 + this.DOOR_HUSH;
      if (a < t1) return U.lerp(0.21, 0.13, a / t1);
      if (a < t2) return U.lerp(0.13, 0.05, (a - t1) / this.DOOR_HUSH);
      return 0.05;
    }

    let s = 1;
    const t = this.torchOutT;
    if (t > 0) {
      if (t > 0.7) s = 0.15;
      else {
        const p = 1 - t / 0.7;
        const flick = Math.sin(p * Math.PI * 5) > 0 ? 1 : 0.25;
        s = Math.min(1, U.lerp(0.15, 1.05, p) * flick + 0.1);
      }
    }
    // 가까워질수록 시야가 오므라든다. 아주 가까우면 떨린다.
    const prox = this.chaseProx || 0;
    if (prox > 0) {
      s *= U.lerp(1, 0.76, prox);
      if (prox > 0.72) s *= 1 + Math.sin(this.time * 26) * 0.06 * prox;
    }
    return s;
  },

  enterDoor() {
    this.locked = true;
    // 문을 닫으면 따라오지 못한다.
    // 이걸 놓으면 암전되는 2초 동안 움직이지도 못한 채 쫓기던 것에게 잡히고,
    // 이미 예약된 다음 스테이지와 죽음 연출이 동시에 진행된다.
    this.dropFigure(false);
    Snd.creak();
    this.fadeTo(0, 1.8);
    const from = this.stageIdx;
    const go = () => {
      // 그 사이에 판이 바뀌었거나 죽었다면 이 예약은 무효다
      if (this.state !== 'play' || this.stageIdx !== from) return;
      this.startStage(from + 1);
    };
    setTimeout(() => {
      if (this.state !== 'play' || this.stageIdx !== from) return;
      Narrator.say([TXT('door.through')], go);
    }, 2000);
  },

  /* ---------------- ENDING ---------------- */
  startEnding() {
    this.state = 'ending';
    this.locked = true;
    this.setHint('');
    this.dropFigure(false);
    this.torchOutT = 0;
    Narrator.clearFlash();
    const C = this.cat, P = this.player;

    // 흔적을 많이 찾아왔다면 한 줄이 더 붙는다
    const traceLine = this.traces >= 3 ? [TXT('end.traces')] : [];

    this.setTimeline([
      { at: 0.2,  fn: () => Snd.meow(0, 1) },
      { at: 0.8,  fn: () => Narrator.say([TXT('end.1')]) },
      { at: 3.4,  fn: () => Narrator.say([TXT('end.2'), ...traceLine]) },
      { at: 7.0,  fn: () => { P.walkTo = { x: C.x - 18, y: C.y - 4 }; } },
      { at: 9.2,  fn: () => { Snd.stopBells(); Snd.resolve(); Narrator.say([TXT('end.3')]); } },
      { at: 12.6, fn: () => { C.alive = false; Snd.setAmbience(0.45, 4); Narrator.say([TXT('end.4')]); } },
      { at: 16.0, fn: () => { Snd.creak(0.55); Narrator.say([TXT('end.5')]); } },
      { at: 19.5, fn: () => { this.fadeTo(0, 3.0); Snd.setAmbience(0, 4); } },
      { at: 23.0, fn: () => this.showEnd() }
    ]);
  },

  updEnding(dt) {
    this.updateTimeline(dt);
    if (this.state !== 'ending') return;      // showEnd 로 넘어간 프레임
    const P = this.player;
    if (P.walkTo) {
      const dx = P.walkTo.x - P.x, dy = P.walkTo.y - P.y;
      const l = Math.hypot(dx, dy);
      if (l < 1.5) { P.walkTo = null; P.moving = false; }
      else {
        const sp = Math.min(l, 34 * dt);
        P.x += dx / l * sp; P.y += dy / l * sp;
        P.face = dx > 0 ? 1 : -1;
        P.walk += dt * 6;
        P.moving = true;
        this.footstep(sp);
      }
    }
    this.followCam(P.x + 4, P.y + 4, dt, 4);
  },

  showEnd() {
    this.state = 'end';
    Narrator.clear();
    this.el.stageTitle.innerHTML =
      TXT('game.titleSpaced') +
      '<br><span style="font-size:.45em;letter-spacing:.9em;opacity:.6">' + TXT('game.end') + '</span>';
    this.el.stageTitle.classList.add('on');
    clearTimeout(this._stT);
    setTimeout(() => this.setHint(TXT(TouchPad.enabled ? 'hint.restartTouch' : 'hint.restartKey')), 2600);
  },

  updEnd() { if (Input.pressed('r', 'e')) location.reload(); },

  /* ---------------- 이동 / 충돌 ---------------- */
  moveAxis(P, dx, dy) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2) || 1;
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const nx = P.x + sx, ny = P.y + sy;
      if (this.free(nx, ny, P.w, P.h)) { P.x = nx; P.y = ny; } else break;
    }
  },

  free(x, y, w, h) {
    const T = this.map.T;
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (Levels.solid(this.map, tx, ty)) return false;
    return true;
  },

  followCam(cx, cy, dt, k) {
    const a = 1 - Math.pow(0.0015, dt * (k / 5));
    this.cam.x = U.lerp(this.cam.x, cx - R.W / 2, a);
    this.cam.y = U.lerp(this.cam.y, cy - R.H / 2, a);
    this.clampCam();
  },

  clampCam() {
    const mw = this.map.W * this.map.T, mh = this.map.H * this.map.T;
    this.cam.x = mw <= R.W ? (mw - R.W) / 2 : U.clamp(this.cam.x, 0, mw - R.W);
    this.cam.y = mh <= R.H ? (mh - R.H) / 2 : U.clamp(this.cam.y, 0, mh - R.H);
  },

  /* =================================================================
     DRAW
  ================================================================= */
  draw() {
    R.clear(0);
    if (this.state === 'title' || !this.map) { R.present([], 0, 0); return; }
    if (this.state === 'jump') { this.drawJump(); return; }

    // 그것이 가까이서 발을 딛으면 바닥이 울린다. 제곱으로 깎아 딛는 순간만
    // 튀고 곧바로 가라앉게 한다 — 길게 끌면 지진이지 발소리가 아니다.
    let shx = 0, shy = 0;
    if (this.shake > 0) {
      const s = this.shake * this.shake * 2.6;
      shx = Math.round(Math.sin(this.time * 97) * s);
      shy = Math.round(Math.cos(this.time * 131) * s * 0.7);
    }
    const cam = { x: Math.round(this.cam.x) + shx, y: Math.round(this.cam.y) + shy };
    const map = this.map, T = map.T;
    const lights = [];

    /* --- 손전등 : 위치·도달 반경을 먼저 정한다 ---
       그것(대기 중이든 쫓아오는 중이든)은 오직 이 반경 안에 있을 때만 그린다.
       가로등·전구 같은 정적 조명은 바닥·벽을 밝히는 데는 쓰이지만,
       그것의 존재를 미리 드러내는 등대가 되어서는 안 된다. */
    let torchX = 0, torchY = 0, torchR = 0;
    if (this.player) {
      const P = this.player;
      torchX = Math.round(P.x - cam.x) + 4;
      torchY = Math.round(P.y - cam.y) + 2;
      const fl = 1 + Math.sin(this.time * 7.3) * 0.018 + Math.sin(this.time * 21.7) * 0.01;
      const base = this.state === 'intro' ? this.TORCH + 14 : this.TORCH;
      torchR = base * fl * this.torchScale();
      lights.push({ x: torchX, y: torchY, r: torchR, i: 1 });
    }
    const inTorch = (sx, sy) => {
      if (torchR <= 0) return false;
      const dx = sx - torchX, dy = (sy - torchY) * 1.15;   // 렌더러의 광원 감쇠와 같은 종횡비
      return dx * dx + dy * dy < torchR * torchR;
    };

    /* --- 타일 --- */
    const tx0 = Math.max(0, (cam.x / T) | 0);
    const ty0 = Math.max(0, (cam.y / T) | 0);
    const tx1 = Math.min(map.W - 1, ((cam.x + R.W) / T) | 0);
    const ty1 = Math.min(map.H - 1, ((cam.y + R.H) / T) | 0);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = map.grid[ty][tx];
        if (t === TT.VOID) continue;
        const variant = (tx * 7 + ty * 13) & 3;
        const tile = Tiles.get(map.theme, TT_NAME[t], Levels.mask(map, tx, ty), variant);
        R.blit(tile, tx * T - cam.x, ty * T - cam.y);
      }
    }

    /* 목표(문 / 고양이)에는 빛을 주지 않는다.
       등대처럼 비춰 주면 찾는 행위가 사라진다 — 손전등으로 직접 쓸어 찾아야 한다. */

    /* --- 소품 + 캐릭터를 y 순으로 겹쳐 그린다 --- */
    const order = [];
    for (const pr of map.props) {
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      if (sx < -50 || sx > R.W + 50 || sy < -60 || sy > R.H + 60) continue;
      // 전구는 천장에 매달려 있으므로 무엇에도 가리지 않게 마지막에 그린다
      order.push({ y: pr.n === 'bulb' ? 1e9 : pr.y, kind: 'prop', pr, sx, sy });
    }
    if (this.cat && this.cat.alive) order.push({ y: this.cat.y, kind: 'cat' });
    // 숨어 있는 동안은 주인공을 그리지 않는다 — 상자 문이 닫혀 있는 상태
    if (this.player && !this.hiding) order.push({ y: this.player.y + this.player.h, kind: 'man' });
    // 아직 깨어나지 않고 서 있는 것들. 손전등이 실제로 닿을 때만 그린다 —
    // 가로등·전구 같은 정적 조명 반경에 걸렸다고 미리 드러나면 안 된다.
    // 이미 다른 그것이 활동 중일 때도 그리지 않는다 — 어차피 깨어날 수 없다.
    if (!this.figure) {
      for (const s of this.sentries) {
        const sx = s.x - cam.x, sy = s.y - cam.y;
        if (sx < -40 || sx > R.W + 40 || sy < -60 || sy > R.H + 40) continue;
        if (!inTorch(sx, sy)) continue;
        order.push({ y: s.y, kind: 'figure', f: s });
      }
    }
    if (this.figure) {
      const fsx = this.figure.x - cam.x, fsy = this.figure.y - cam.y;
      // 물건 안에서 나타난 경우엔 상자를 연 직후라 늘 손전등 안이다. 그 외에는
      // 실제로 손전등이 닿을 때만 그린다 — 쫓아오는 동안에도 어둠 속에서는 안 보여야 한다.
      if (this.figure.mode === 'inside' || inTorch(fsx, fsy)) {
        order.push({ y: this.figure.mode === 'inside' ? 1e8 : this.figure.y,
                     kind: 'figure', f: this.figure });
      }
    }
    order.sort((a, b) => a.y - b.y);

    for (const o of order) {
      if (o.kind === 'prop') {
        const pr = o.pr;
        const variant = (pr.tx * 3 + pr.ty) & 3;
        const opened = pr.searched && Levels.OPENABLE.has(pr.n);
        const p = opened ? Props.getOpen(pr.n, variant) : Props.get(pr.n, variant);
        if (!p) continue;
        // 이미 뒤진 것은 한 톤 눌러 둔다
        R.drawProp(p, o.sx, o.sy, pr.searched && !opened ? 0.62 : 1);
        if (p.light)
          lights.push({ x: o.sx + p.light.dx, y: o.sy + p.light.dy, r: p.light.r, i: p.light.i });
      } else if (o.kind === 'figure') {
        const F = o.f;
        const fx = Math.round(F.x - cam.x), fy = Math.round(F.y - cam.y);
        const prox = this.figProx(F);
        const frame = SPR.FIGURE_FRAMES[this.figGlitchFrame(F.glitchSeed || 0)];
        const rows = this.figWarpRows(F, prox);
        // 발은 바닥에 붙여 두고 위로 자란다
        const top = fy - (rows.length - 1);

        // 빛을 주지 않는다. 자기 주변을 밝히면 위치를 알려주는 표시등이 된다 —
        // 손전등이 우연히 닿았을 때 비로소 거기 있었다는 것을 알아야 한다.
        // 오히려 반대로, 선 자리의 빛을 먹는다. 손전등을 정면으로 비췄는데도
        // 그 언저리만 어두워진다.
        R.shadowBlob(fx, fy - 12, 20 + prox * 26, 0.30 + prox * 0.35);

        // 잔상 — 한 박자 전의 자기 모습이 옆에 남는다.
        // 가까울 때만. 멀리서까지 번지면 그냥 흐릿한 그림이 된다.
        if (prox > 0.45) {
          const g = ((this.time * 9) | 0) & 1;
          R.spriteRows(frame, fx - 8 + (g ? 3 : -3), top + 1, rows, 0.30);
        }
        R.spriteRows(frame, fx - 8, top, rows);
      } else if (o.kind === 'cat') {
        const C = this.cat;
        const cx = Math.round(C.x - cam.x), cy = Math.round(C.y - cam.y);
        if (C.run) {
          const bob = Math.floor(C.anim) % 2;
          R.outline(SPR.CAT_RUN, cx - 11, cy - 10 + bob, C.face < 0);
          R.sprite(SPR.CAT_RUN, cx - 11, cy - 10 + bob, C.face < 0);
        } else {
          R.outline(SPR.CAT_SIT, cx - 8, cy - 11, C.face < 0);
          R.sprite(SPR.CAT_SIT, cx - 8, cy - 11, C.face < 0);
        }
        // 도입 연출에서만 고양이에게 빛을 준다. 마지막 방에서는 직접 찾아야 한다.
        if (this.state === 'intro') lights.push({ x: cx, y: cy - 3, r: 26, i: 0.5 });
      } else {
        const P = this.player;
        const px = Math.round(P.x - cam.x), py = Math.round(P.y - cam.y);
        const frame = P.moving && (Math.floor(P.walk) % 2) ? SPR.MAN_B : SPR.MAN_A;
        R.outline(frame, px - 2, py - 13, P.face < 0);
        R.sprite(frame, px - 2, py - 13, P.face < 0);
      }
    }

    // ambient 를 아주 조금만 준다. 밝은 재질(건물 입면·갓돌)만 겨우 드러나고
    // 바닥은 crush 임계값 아래라 완전한 검정으로 남는다 — 멀리 구조물 윤곽만 보이는 상태.
    // 들킨 채 숨어 있는 동안에는 화면 전체가 명멸한다.
    R.present(lights, this.fade * (1 - this.flick), 0.032 + this.flick * 0.06, 0.05);
  },

  /* 화면을 가득 채우는 얼굴.
     손전등도 카메라도 쓰지 않는다 — ambient 1 로 넘겨 버퍼를 그대로 띄운다.
     여기서만 게임 화면의 규칙(빛이 닿는 곳만 보인다)이 깨진다. 그것이 요점이다. */
  drawJump() {
    const J = this.jump, t = J.t;
    const p = U.clamp(t / this.JUMP_T, 0, 1);

    // 첫 두 프레임은 순백. 눈이 적응하기 전에 화면을 통째로 갈아치운다.
    if (t < 0.05) { R.clear(1); R.present([], 1, 0, 1); return; }

    // 배경은 밝게 둔다. 얼굴이 검은 덩어리라 뒤가 어두우면 형태가 안 읽힌다.
    R.clear(0.74 + Math.sin(t * 53) * 0.14);

    // 다가온다. 끝에는 화면 밖으로 넘친다. 33x25 격자 기준 sc 14.6 에서 폭이 꽉 찬다.
    const sc = U.lerp(9.5, 18, p * p);
    const seed = J.seed;
    // 줄을 묶어 통째로 민다. 1/24초 동안 붙들어야 흔들림이지 끓어오름이 아니다.
    const tick = Math.floor(t * 24);
    const jitter = dy => {
      const n = Math.sin((((dy / 9) | 0) * 7.13 + tick * 3.7 + seed * 61) * 12.9898) * 43758.5453;
      const r = n - Math.floor(n);
      // 대부분의 띠는 제자리에 둔다. 전부 흔들면 형태가 뭉개져 얼굴이 사라진다.
      if (r > 0.24 && r < 0.76) return 0;
      return Math.round((r - 0.5) * 2 * (10 + p * 26));
    };

    const s = this.shake;
    const cx = R.W / 2 + Math.sin(t * 87) * 14 * s;
    const cy = R.H * 0.52 + Math.cos(t * 113) * 9 * s;
    // fill 0 — 머리 속을 검게 메운다. 안 메우면 윤곽선만 남아 철사 그림이 된다.
    R.spriteZoom(SPR.FACE, cx, cy, sc, jitter, 1, 0);

    if (t < 0.55 && (((t * 26) | 0) & 1)) R.invert();

    R.present([], 1, 0.07 + (1 - p) * 0.06, 1);
  }
};

/* spec.html 은 이 파일을 상수·수치를 읽으려고 불러온다. 거기서는 게임이 돌면 안 된다
   (캔버스도 오디오도 없다). 문서 쪽에서 값을 하나 세워 두면 부팅만 건너뛴다. */
addEventListener('load', () => { if (!window.SPEC_ONLY) Game.init(); });
