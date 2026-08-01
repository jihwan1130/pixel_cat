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
  figSpawnT: 0,
  hiding: null,              // { pr, spot } — 상자·옷장 안에 들어가 있는 상태
  flick: 0,                  // 들킨 채 숨어 있을 때의 화면 명멸
  _lastTile: { x: -1, y: -1 },
  moveDir: { x: 1, y: 0 },

  SPEED: 62,
  STRIDE: 27,                // 이만큼 걸을 때마다 발소리 한 번.
                             // 시간이 아니라 이동 거리로 세야 걷는 속도와 어긋나지 않는다.
  TORCH: 96,
  FIG_SPEED: 0.7,            // 주인공 속도의 배율. 느리지만 쉬지 않는다.
  CREEP_SPEED: 0.30,         // 숨은 자리를 찾아낸 뒤 다가올 때. 느릴수록 길게 조인다.
  CATCH_D: 13,               // 잡히는 거리
  SEEN_D: 150,               // 이 안에서 숨으면 들어가는 것을 본다
  HIDE_FIND_D: 52,           // 못 봤어도 이만큼 가까이 지나가면 숨은 자리를 찾아낸다
  WAKE_D: 132,               // 서 있던 것이 이쪽을 알아채는 거리
  GIVEUP_D: 210,             // 이만큼 떨어진 채로 2.5초 버티면 포기한다.
                             // 속도차가 초당 18px 뿐이라 이보다 크면 맵 길이 안에서 따돌릴 수 없다.
  PROWL_T: 9.5,              // 못 본 경우 주변을 서성이는 시간

  el: {},

  /* --------------------------------------------------------------- */
  init() {
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
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      this.trackPerf(dt);
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
    this.updateFade(dt);
    Narrator.update(dt);
    switch (this.state) {
      case 'title':  this.updTitle(dt);  break;
      case 'intro':  this.updIntro(dt);  break;
      case 'play':   this.updPlay(dt);   break;
      case 'dead':   this.updateTimeline(dt); break;
      case 'ending': this.updEnding(dt); break;
      case 'end':    this.updEnd(dt);    break;
    }
  },

  /* ---------------- TITLE ---------------- */
  updTitle() {
    if (!Input.anyPressed) return;
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
    this.setHint(TouchPad.enabled ? 'E — 건너뛰기' : 'SPACE — 건너뛰기');

    const P = this.player, C = this.cat;
    this.setTimeline([
      { at: 0.6,  fn: () => { P.speed = 28; C.speed = 28; } },
      { at: 1.8,  fn: () => Narrator.say(['밤 산책.']) },
      { at: 4.8,  fn: () => Narrator.say(['고양이는 언제나 나보다 세 걸음 앞서 걷는다.']) },
      { at: 8.4,  fn: () => { C.speed = 0; Snd.bell(1.0); } },
      { at: 9.3,  fn: () => { P.speed = 0; } },
      { at: 9.8,  fn: () => Narrator.say(['어딘가 먼 곳에서 종이 울렸다.']) },
      { at: 12.4, fn: () => { C.face = -1; Snd.meow(0.1, 0.9); } },
      { at: 13.4, fn: () => Narrator.say(['고양이가 귀를 세웠다.']) },
      { at: 16.0, fn: () => { C.run = true; C.face = 1; C.speed = 132; Snd.meow(0.5, 0.7); } },
      { at: 16.8, fn: () => Narrator.say(['…그리고 가로등이 닿지 않는 곳으로 뛰어들었다.']) },
      { at: 19.4, fn: () => { C.alive = false; Snd.bell(0.7); } },
      { at: 20.2, fn: () => { P.speed = 54; } },
      { at: 21.4, fn: () => { P.speed = 0; Narrator.say(['나는 빈 목줄만 쥔 채 서 있었다.']); } },
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
    this.torchOutT = 0; this.hiding = null;
    this.dropFigure(false);
    // 정해진 좌표에 서 있는 것들. 다가가면 깨어난다.
    this.sentries = (m.sentries || []).map(s => ({ x: s.x, y: s.y }));
    this._lastTile.x = -1; this._lastTile.y = -1;
    this.figSpawnT = i === 0 ? U.rand(8, 14) : U.rand(20, 32);
    Narrator.clearFlash();

    this.fade = 0;
    this.fadeTo(1, 2.2);
    this.showStageTitle(m.title, 3.6);
    Snd.setAmbience(1, 3);

    // 잠긴 곳이 있는 판은 무엇을 찾아야 하는지 한 줄로 알려 준다.
    // 열쇠가 있다는 사실 자체를 숨기면 탐색이 아니라 헤매기가 된다.
    const lines = m.lines.slice();
    if (m.lock) {
      lines.push(m.lock.kind === 'key'
        ? '아래로 내려가는 문은 잠겨 있었다. 열쇠는 이 안 어딘가에 있을 것이다.'
        : '길을 막은 철문에는 자물쇠가 세 개. 조각을 셋 다 찾아야 한다.');
    }

    setTimeout(() => {
      if (this.state !== 'play') return;
      Narrator.say(lines, () => {
        this.locked = false;
        this.setHint(TouchPad.enabled
          ? '왼쪽을 끌어 이동   ·   E — 뒤지기 / 숨기'
          : 'W A S D — 이동   ·   E — 뒤지기 / 숨기');
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
        this.moveDir.x = mv.x; this.moveDir.y = mv.y;
        P.walk += dt * 7 * mv.m;
        P.moving = true;
        // 벽에 밀려 실제로 움직이지 못하면 발소리도 나지 않는다
        this.footstep(Math.hypot(P.x - bx, P.y - by));
      } else { P.moving = false; this.stepDist = this.STRIDE * 0.7; }
    }
    if (this.state !== 'play') return;

    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.followCam(pcx, pcy, dt, 5);
    this.checkCorner();

    /* --- 상호작용 --- */
    const G = this.goal;
    const d = U.dist(pcx, pcy, G.x, G.y);
    const chased = this.figure && this.figure.mode === 'chase';
    let hint = '';

    if (this.hiding) {
      // 들킨 뒤에는 나올 수 없다. 문이 열릴 때까지 안에서 듣고 있어야 한다.
      if (!(this.figure && this.figure.hunt)) {
        hint = 'E — 나온다';
        if (Input.pressed('e')) { this.exitHide(); return; }
      }
    } else if (!this.locked && this.searchT <= 0) {
      const gate = this.map.gate;
      const gd = (gate && !gate.open) ? U.dist(pcx, pcy, gate.x, gate.y) : Infinity;
      const L = this.map.lock;
      const short = L ? L.need - L.have : 0;

      if (gd < 36) {
        if (short > 0) {
          hint = `철문 — 자물쇠 ${L.have} / ${L.need}`;
          if (Input.pressed('e')) {
            Snd.rattle();
            Narrator.flash(`자물쇠가 꿈쩍도 하지 않는다. 조각이 ${short}개 더 필요하다.`, { bad: true, dur: 3.4 });
          }
        } else {
          hint = 'E — 철문을 연다';
          if (Input.pressed('e')) { this.openGate(); return; }
        }
      } else if (!G.used && d < 30) {
        if (short > 0 && !gate) {
          hint = '잠겨 있다 — 열쇠가 없다';
          if (Input.pressed('e')) {
            Snd.rattle();
            Narrator.flash('손잡이가 돌아가지 않는다. 열쇠는 이 집 어딘가에 있다.', { bad: true, dur: 3.4 });
          }
        } else {
          hint = G.type === 'door' ? 'E — 문을 연다' : 'E — 고양이를 부른다';
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
          hint = chased ? 'E — 숨는다' : 'E — 안에 숨는다';
          if (Input.pressed('e')) { this.tryHide(box); return; }
        }
      }
    }
    if (hint) this.setHint(hint, true);
    else if (this._actionHint) this.setHint('');

    /* --- 출현 : 자리는 언제나 레벨에 박아 둔 lairs 중 하나다 --- */
    this.figSpawnT -= dt;
    if (this.figSpawnT <= 0) {
      if (this.stageIdx === 0) {
        // 나타나기는 하되 드물게. 흔해지면 무서운 것이 아니라 익숙한 것이 된다.
        this.figSpawnT = U.rand(28, 42);
        if (!this.figure && !this.locked && !this.hiding && U.chance(0.35))
          this.spawnFigure('watch', true);
      } else {
        this.figSpawnT = U.rand(32, 50);
        if (!this.figure && !this.locked && !this.hiding && this.dread >= 2 &&
            U.chance(Math.min(0.6, 0.16 + this.dread / 22))) this.spawnFigure('chase', true);
      }
    }

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
    Narrator.flash('빗장이 풀리고, 철문이 안쪽으로 밀려났다.', { dur: 4.0 });
    this.dreadBy(1);
    // 쇠가 긁히는 소리는 멀리 간다. 뭔가가 이쪽으로 온다.
    this.figSpawnT = Math.min(this.figSpawnT, U.rand(5, 10));
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
      case 'cabinet': return '옷장을 연다';
      case 'bed':     return '침대 밑을 본다';
      case 'shelf':   return '선반을 뒤진다';
      case 'bin':     return '쓰레기통을 뒤진다';
      case 'drum':
      case 'barrel':  return '드럼통을 연다';
      default:        return '상자를 연다';
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

    // 무엇이 나왔든, 뚜껑을 닫고 고개를 들면 서 있을 때가 있다.
    // 1라운드에서는 쳐다보기만 하지만, 그 뒤로는 그대로 걸어온다.
    if (this.stageIdx === 0) {
      if (U.chance(0.30)) this.spawnFigure('watch', false, { min: 62, max: 150 });
    } else if (U.chance(0.24)) {
      this.spawnFigure('chase', false, { min: 70, max: 200 });
    }
  },

  /* 열쇠 / 열쇠 조각을 손에 넣는다 */
  takeKey() {
    const L = this.map.lock;
    if (L) L.have = Math.min(L.need, L.have + 1);
    this.dreadBy(-0.5);
    Snd.pickup();
    if (!L || L.kind === 'key')
      Narrator.flash('작은 열쇠 하나. 아래로 내려가는 문의 것이다.', { dur: 4.4 });
    else if (L.have >= L.need)
      Narrator.flash(`마지막 조각. (${L.have} / ${L.need})  이제 철문을 열 수 있다.`, { dur: 4.8 });
    else
      Narrator.flash(`녹슨 열쇠 조각 하나. (${L.have} / ${L.need})`, { dur: 4.4 });
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
      case 'figure':
        Narrator.flash('…안에 누군가 서 있었다.', { bad: true, dur: 4.4 });
        Snd.sting();
        this.figure = {
          x: pr.tx * T + T / 2, y: pr.ty * T + T - 2,
          t: this.stageIdx === 0 ? 0.6 : 1.1, mode: 'inside',
          becomes: this.stageIdx === 0 ? null : 'chase'
        };
        break;
      case 'torch':
        Narrator.flash('여는 순간 손전등이 꺼졌다.', { bad: true, dur: 4.4 });
        Snd.thump(0, 0.7);
        this.torchOutT = 2.1;
        break;
      case 'bell':
        Narrator.flash('종소리가 바로 귀 옆에서 울렸다.', { bad: true, dur: 4.4 });
        Snd.nearBell();
        break;
      case 'deep':
        Narrator.flash('안쪽이, 이 물건의 깊이보다 훨씬 깊다.', { bad: true, dur: 4.4 });
        Snd.sting();
        break;
      default:
        Narrator.flash('뒤에서 문이 닫히는 소리가 났다. 방금 지나온 곳이다.', { bad: true, dur: 4.8 });
        Snd.creak(0.7);
        this.spawnFigure(this.defaultMode(), true);
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

  /* 세울 자리는 레벨에 박아 둔 lairs 중에서만 고른다.
     아무 데서나 튀어나오면 어디가 위험한지 배울 수가 없다 —
     같은 자리에서 반복해 나와야 그 골목을 피해 다니게 된다.
     주인공에게서 실제로 걸어올 수 있는 자리인지도 함께 본다(철문 너머 등). */
  pickLair(minD, maxD, angle, spread) {
    const m = this.map;
    if (!m.lairs || !m.lairs.length) return null;
    const P = this.player, px = P.x + 4, py = P.y + 4;
    const flow = this.buildFlow({ x: px, y: py });
    const inRange = [], any = [];

    for (const l of m.lairs) {
      if (flow && flow[l.tx + l.ty * m.W] < 0) continue;   // 길이 끊긴 자리
      const d = U.dist(px, py, l.x, l.y);
      if (d < minD) continue;
      any.push({ l, d });
      if (d > maxD) continue;
      if (angle !== null && angle !== undefined) {
        let da = Math.atan2(l.y - py, l.x - px) - angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > spread) continue;
      }
      inRange.push(l);
    }
    if (inRange.length) return U.choice(inRange);
    if (!any.length) return null;
    // 조건에 맞는 자리가 없으면 가장 가까운 자리에서 나온다
    any.sort((a, b) => a.d - b.d);
    return any[0].l;
  },

  makeFigure(x, y, mode) {
    const P = this.player;
    this.figure = {
      x, y, mode,
      t: U.rand(2.6, 4.6),
      farT: 0, lostT: 0, hunt: null, prowlT: 0, prowlTo: null,
      flow: null, flowT: 0, stepT: 0,
      lastSeen: { x: P.x + 4, y: P.y + 4 }
    };
    Snd.breath();
    if (mode === 'chase') Snd.startChase();
    return this.figure;
  },

  spawnFigure(mode, behind, opt = {}) {
    if (this.figure) return false;
    const P = this.player;
    const angle = opt.angle !== undefined ? opt.angle
                : behind ? (P.face > 0 ? Math.PI : 0) : null;
    const spread = opt.spread !== undefined ? opt.spread : 1.0;
    const spot = this.pickLair(opt.min || 96, opt.max || 220, angle, spread);
    if (!spot) return false;
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
        Narrator.flash('…서 있던 것이, 이쪽으로 고개를 돌렸다.', { bad: true, dur: 3.8 });
      return;
    }
  },

  /* 상자 안에 있던 것이 밖으로 걸어 나온다 */
  convertToChase(F) {
    F.mode = 'chase';
    F.becomes = null;
    F.t = 0; F.farT = 0; F.lostT = 0; F.prowlT = 0; F.prowlTo = null;
    F.hunt = null; F.flow = null; F.flowT = 0; F.stepT = 0;
    F.lastSeen = { x: this.player.x + 4, y: this.player.y + 4 };
    Snd.startChase();
    Narrator.flash('그것이 상자 밖으로 발을 내디뎠다.', { bad: true, dur: 4.0 });
  },

  /* 모퉁이를 돌자마자 눈앞에 서 있는 순간 */
  checkCorner() {
    const T = this.map.T, P = this.player;
    const tx = ((P.x + 4) / T) | 0, ty = ((P.y + 4) / T) | 0;
    if (tx === this._lastTile.x && ty === this._lastTile.y) return;
    this._lastTile.x = tx; this._lastTile.y = ty;
    if (this.figure || this.hiding || this.locked || !P.moving) return;

    const m = Levels.mask(this.map, tx, ty);
    const up = !!(m & 1), rt = !!(m & 2), dn = !!(m & 4), lf = !!(m & 8);
    const open = (up ? 1 : 0) + (rt ? 1 : 0) + (dn ? 1 : 0) + (lf ? 1 : 0);
    // 갈림길이거나, 세로/가로가 꺾이는 자리
    const corner = open >= 3 || (open === 2 && (up || dn) && (lf || rt));
    if (!corner) return;

    if (!U.chance(this.stageIdx === 0 ? 0.028 : 0.015)) return;
    const ahead = Math.atan2(this.moveDir.y, this.moveDir.x);
    this.spawnFigure(this.defaultMode(), false,
      { angle: ahead, spread: 0.7, min: 64, max: 150 });
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
    if (this.hiding) target = F.hunt || F.prowlTo || F.lastSeen;
    else target = { x: px, y: py };

    F.flowT -= dt;
    if (F.flowT <= 0) { F.flow = this.buildFlow(target); F.flowT = 0.4; }

    const speed = this.SPEED * (F.hunt ? this.CREEP_SPEED : this.FIG_SPEED);
    const bx = F.x, by = F.y;
    this.flowStep(F, speed, dt);

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
      F.stepT = F.hunt ? U.rand(0.95, 1.20) : U.rand(0.44, 0.54);
      Snd.figStep(U.clamp((F.x - px) / 220, -1, 1), U.clamp(1.1 - dist / 300, 0.12, 1));
    }

    if (this.hiding) { this.updHidden(F, dt, dist); return; }

    F.lastSeen.x = px; F.lastSeen.y = py;
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
      // 한 칸(16px) 남은 자리를 "도착" 으로 보고, 거기서 잠깐 서 있게 한다 —
      // 문이 열리기 직전의 그 정적이 이 연출의 전부다.
      const arrived = d < 30;
      if (arrived) F.arriveT = (F.arriveT || 0) + dt;

      const near = arrived ? 1 : U.clamp(1 - d / 190, 0, 1);
      // 가까울수록 빠르고 깊게 깜빡인다
      const beat = Math.sin(this.time * (7 + near * 24));
      this.flick = beat > 0 ? Math.pow(beat, 3) * (0.30 + near * 0.62) : 0;
      Snd.setDirge(near);

      if (F.arriveT > 1.1) this.death('found');
      return;
    }

    /* --- 못 봤다 : 주변을 서성이다 사라진다 --- */
    this.flick = 0;
    F.lostT += dt;

    // 문 앞을 스치면 그제야 알아챈다
    if (U.dist(spot.x, spot.y, F.x, F.y) < this.HIDE_FIND_D) { this.spotted(F, '바로 앞에서 발소리가 멈췄다.'); return; }

    // 마지막으로 본 자리 언저리를 돌아다닌다
    F.prowlT -= dt;
    if (F.prowlT <= 0 || !F.prowlTo) {
      F.prowlTo = this.prowlPoint(F.lastSeen);
      F.prowlT = U.rand(1.6, 2.8);
      F.flowT = 0;
    }
    if (F.lostT > this.PROWL_T) this.dropFigure(true);
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
      const d = U.dist(this.player.x + 4, this.player.y + 4, F.x, F.y);
      if (d < this.SEEN_D) {
        // 보고 있는 앞에서 들어갔다 — 서두르지 않는다. 어디로 들어갔는지 알고 있으니까.
        this.spotted(F, '…들어가는 것을, 봤다.');
        return;
      }
    }
    Narrator.flash('숨을 죽였다.', { dur: 2.8 });
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

  /* ---------------- 죽음 ---------------- */
  death(kind) {
    if (this.state !== 'play') return;
    const found = kind === 'found';
    this.state = 'dead';
    this.locked = true;
    this.hiding = null;
    this.searchT = 0;
    this.flick = 0;
    this.setHint('');
    Narrator.clear();
    Narrator.clearFlash();
    Snd.stopChase();
    Snd.stopBells();
    Snd.sting();
    Snd.thump(0.15, 0.9);
    Snd.setAmbience(0.25, 1.2);
    // 문이 열리는 순간까지는 기괴한 음이 깔려 있다가, 열리면서 끊긴다
    if (found) { Snd.creak(0.9); setTimeout(() => Snd.stopDirge(), 900); }
    else Snd.stopDirge();

    // 그것을 눈앞에 세운다
    const P = this.player;
    this.figure = { x: P.x + 4, y: P.y + 12, mode: 'inside', t: 1e9 };
    this.chaseProx = 0;

    const line = found
      ? '문이, 밖에서 열렸다.'
      : '어깨에 손이 닿았다.';

    this.setTimeline([
      { at: 0.3, fn: () => Narrator.say([line]) },
      { at: 3.0, fn: () => { this.fadeTo(0, 2.0); } },
      { at: 5.4, fn: () => Narrator.say(['다시, 골목이었다.'], () => this.restartRun()) }
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
    // 들킨 뒤에는 문틈마저 좁아진다
    if (this.hiding) return (this.figure && this.figure.hunt) ? 0.21 : 0.3;

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
    Snd.creak();
    this.fadeTo(0, 1.8);
    setTimeout(() => {
      Narrator.say(['문 너머에서, 아주 작게 울음소리가 났다.'],
        () => this.startStage(this.stageIdx + 1));
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
    const traceLine = this.traces >= 3
      ? ['오는 길에 남아 있던 자국들이, 전부 이쪽을 향하고 있었다.']
      : [];

    this.setTimeline([
      { at: 0.2,  fn: () => Snd.meow(0, 1) },
      { at: 0.8,  fn: () => Narrator.say(['…찾았다.']) },
      { at: 3.4,  fn: () => Narrator.say(['고양이는 처음부터 그 자리에 앉아 있었던 것처럼 보였다.', ...traceLine]) },
      { at: 7.0,  fn: () => { P.walkTo = { x: C.x - 18, y: C.y - 4 }; } },
      { at: 9.2,  fn: () => { Snd.stopBells(); Snd.resolve(); Narrator.say(['품에 안자, 종소리가 멎었다.']); } },
      { at: 12.6, fn: () => { C.alive = false; Snd.setAmbience(0.45, 4); Narrator.say(['우리는 왔던 길을 되짚어 걸었다.']); } },
      { at: 16.0, fn: () => { Snd.creak(0.55); Narrator.say(['뒤에서, 문이 하나 조용히 닫혔다.']); } },
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
      '고 양 이 를  찾 아 서<br><span style="font-size:.45em;letter-spacing:.9em;opacity:.6">끝</span>';
    this.el.stageTitle.classList.add('on');
    clearTimeout(this._stT);
    setTimeout(() => this.setHint(TouchPad.enabled ? 'E — 다시 시작' : 'R — 다시 시작'), 2600);
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

    const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    const map = this.map, T = map.T;
    const lights = [];

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
    // 아직 깨어나지 않고 서 있는 것들. 빛을 내지 않으니 손전등이 닿아야 보인다.
    for (const s of this.sentries) {
      const sx = s.x - cam.x, sy = s.y - cam.y;
      if (sx < -40 || sx > R.W + 40 || sy < -60 || sy > R.H + 40) continue;
      order.push({ y: s.y, kind: 'figure', f: s });
    }
    if (this.figure) {
      // 물건 안에서 나타난 경우엔 그 물건에 가리면 안 되므로 맨 나중에
      order.push({ y: this.figure.mode === 'inside' ? 1e8 : this.figure.y,
                   kind: 'figure', f: this.figure });
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
        R.outline(SPR.FIGURE, fx - 6, fy - 31);
        R.sprite(SPR.FIGURE, fx - 6, fy - 31);
        // 빛을 주지 않는다. 자기 주변을 밝히면 위치를 알려주는 표시등이 된다 —
        // 손전등이 우연히 닿았을 때 비로소 거기 있었다는 것을 알아야 한다.
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

    /* --- 손전등 --- */
    if (this.player) {
      const P = this.player;
      const px = Math.round(P.x - cam.x) + 4, py = Math.round(P.y - cam.y) + 2;
      const fl = 1 + Math.sin(this.time * 7.3) * 0.018 + Math.sin(this.time * 21.7) * 0.01;
      const base = this.state === 'intro' ? this.TORCH + 14 : this.TORCH;
      lights.push({ x: px, y: py, r: base * fl * this.torchScale(), i: 1 });
    }

    // ambient 를 아주 조금만 준다. 밝은 재질(건물 입면·갓돌)만 겨우 드러나고
    // 바닥은 crush 임계값 아래라 완전한 검정으로 남는다 — 멀리 구조물 윤곽만 보이는 상태.
    // 들킨 채 숨어 있는 동안에는 화면 전체가 명멸한다.
    R.present(lights, this.fade * (1 - this.flick), 0.032 + this.flick * 0.06, 0.05);
  }
};

addEventListener('load', () => Game.init());
