/* -------------------------------------------------------------------------
   고양이를 찾아서 — 게임 본체
   상태 : title → intro(연출) → play(1,2,3) → ending → end
------------------------------------------------------------------------- */

const STAGES = [
  {
    title: '하나 · 골 목',
    cw: 13, ch: 9, rooms: 1, braid: 0.40,
    lines: [
      '고양이가 사라진 골목.',
      '벽들이 전부 같은 얼굴을 하고 있어서, 몇 번을 돌았는지 알 수 없다.'
    ]
  },
  {
    title: '둘 · 낡 은  건 물',
    cw: 15, ch: 11, rooms: 4, braid: 0.45,
    lines: [
      '안쪽은 바깥보다 더 조용했다.',
      '종소리가, 이제는 벽 안에서 들리는 것 같았다.'
    ]
  },
  {
    title: '셋 · 지 하',
    cw: 17, ch: 12, rooms: 3, braid: 0.50,
    lines: [
      '계단은 아래로만 이어졌다.',
      '여기 어딘가에, 고양이가 앉아 있다.'
    ]
  }
];

const Game = {
  /* ---- 상태 ---- */
  state: 'title',
  stageIdx: 0,
  time: 0,
  locked: false,

  map: null,
  player: null,
  cat: null,
  goal: null,
  cam: { x: 0, y: 0 },
  decor: [],

  fade: 0,
  _f0: 0, _f1: 0, _fd: 0, _ft: 0,

  tl: [],
  tlT: 0,

  meowT: 0,
  creakT: 0,
  stepT: 0,

  el: {},

  /* --------------------------------------------------------------- */
  init() {
    const canvas = document.getElementById('game');
    R.init(canvas);
    Input.init();
    Narrator.init();

    this.el.title = document.getElementById('title-screen');
    this.el.stageTitle = document.getElementById('stage-title');
    this.el.hint = document.getElementById('hint');

    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      Input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
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
  showStageTitle(text, dur = 3.2) {
    this.el.stageTitle.textContent = text;
    this.el.stageTitle.classList.add('on');
    clearTimeout(this._stT);
    this._stT = setTimeout(() => this.el.stageTitle.classList.remove('on'), dur * 1000);
  },
  setHint(text) {
    if (text) { this.el.hint.textContent = text; this.el.hint.classList.add('on'); }
    else this.el.hint.classList.remove('on');
  },

  /* =================================================================
     UPDATE
  ================================================================= */
  update(dt) {
    this.time += dt;
    this.updateFade(dt);
    Narrator.update(dt);

    switch (this.state) {
      case 'title':   this.updTitle(dt);  break;
      case 'intro':   this.updIntro(dt);  break;
      case 'play':    this.updPlay(dt);   break;
      case 'ending':  this.updEnding(dt); break;
      case 'end':     this.updEnd(dt);    break;
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

  /* ---------------- INTRO (연출) ---------------- */
  startIntro() {
    this.state = 'intro';
    this.buildIntroMap();

    this.player = { x: 46, y: 92, vx: 0, vy: 0, face: 1, walk: 0, speed: 0, w: 6, h: 6 };
    this.cat = { x: 108, y: 96, speed: 0, run: false, face: -1, alive: true, anim: 0 };
    this.fade = 0;
    this.fadeTo(1, 2.6);
    this.setHint('SPACE — 건너뛰기');

    const P = this.player, C = this.cat;
    this.setTimeline([
      { at: 0.6, fn: () => { P.speed = 21; C.speed = 21; } },
      { at: 1.6, fn: () => Narrator.say(['밤 산책.']) },
      { at: 4.6, fn: () => Narrator.say(['고양이는 언제나 나보다 세 걸음 앞서 걷는다.']) },
      { at: 8.0, fn: () => { C.speed = 0; Snd.bell(1.0); } },
      { at: 8.9, fn: () => { P.speed = 0; } },
      { at: 9.4, fn: () => Narrator.say(['어딘가 먼 곳에서 종이 울렸다.']) },
      { at: 12.0, fn: () => { C.face = -1; Snd.meow(0.1, 0.9); } },
      { at: 13.0, fn: () => Narrator.say(['고양이가 귀를 세웠다.']) },
      { at: 15.6, fn: () => { C.run = true; C.face = 1; C.speed = 96; Snd.meow(0.5, 0.7); } },
      { at: 16.4, fn: () => Narrator.say(['…그리고 어둠 속으로 뛰어들었다.']) },
      { at: 18.6, fn: () => { C.alive = false; Snd.bell(0.7); } },
      { at: 19.4, fn: () => { P.speed = 40; } },
      { at: 20.4, fn: () => { P.speed = 0; Narrator.say(['나는 빈 목줄만 쥔 채 서 있었다.']); } },
      { at: 23.6, fn: () => { this.fadeTo(0, 2.2); Narrator.clear(); this.setHint(''); } },
      { at: 26.2, fn: () => this.startStage(0) }
    ]);
  },

  buildIntroMap() {
    const cw = 68, ch = 15, T = Maze.TILE;
    const g = [];
    for (let y = 0; y < ch; y++) g.push(new Uint8Array(cw).fill(1));
    // 가로 통로 (3타일 높이)
    for (let x = 1; x < cw - 1; x++)
      for (let y = 6; y <= 8; y++) g[y][x] = 0;
    // 옆으로 난 골목 몇 개
    for (let i = 0; i < 9; i++) {
      const x = U.randInt(6, cw - 8);
      const up = U.chance(0.5);
      const len = U.randInt(2, 4);
      for (let k = 1; k <= len; k++) {
        const y = up ? 6 - k : 8 + k;
        if (y > 0 && y < ch - 1) g[y][x] = 0;
      }
    }
    this.map = { grid: g, W: cw, H: ch, T };

    // 장식 : 천장에 매달린 가로등 / 통로 아래쪽에 선 마른 나무
    this.decor = [];
    for (let x = 4; x < cw - 4; x += U.randInt(6, 10)) {
      if (U.chance(0.55)) this.decor.push({ spr: SPR.LAMP, x: x * T + 4, y: 6 * T + 1, glow: true });
      else this.decor.push({ spr: SPR.TREE, x: x * T + 2, y: 9 * T - 12, glow: false });
    }
  },

  updIntro(dt) {
    // 시작 직후 같은 키 입력이 두 번 잡혀 연출이 건너뛰어지는 것을 막는다
    if (this.tlT > 1.0 && Input.pressed(' ', 'enter', 'escape')) {
      Narrator.clear(); this.setHint(''); this.tl = [];
      this.fadeTo(0, 0.5);
      setTimeout(() => this.startStage(0), 560);
      return;
    }
    this.updateTimeline(dt);

    const P = this.player, C = this.cat;
    if (P.speed > 0) {
      P.x += P.speed * dt;
      P.walk += dt * 7;
      this.stepT -= dt;
      if (this.stepT <= 0) { Snd.step(); this.stepT = 0.46; }
    }
    if (C.speed > 0) { C.x += C.speed * dt; C.anim += dt * 12; }

    this.followCam(P.x, P.y, dt, 6);
  },

  /* ---------------- STAGE ---------------- */
  startStage(i) {
    this.stageIdx = i;
    const S = STAGES[i];
    this.state = 'play';
    this.locked = true;
    this.decor = [];

    this.map = Maze.generate(S.cw, S.ch, { rooms: S.rooms, braid: S.braid });
    const T = this.map.T;

    this.player = { x: T + 3, y: T + 3, face: 1, walk: 0, w: 6, h: 6, moving: false };

    const far = Maze.farthest(this.map, 1, 1);
    const last = (i === STAGES.length - 1);
    this.goal = {
      tx: far.x, ty: far.y,
      x: far.x * T + T / 2,
      y: far.y * T + T / 2,
      type: last ? 'cat' : 'door',
      used: false
    };
    // 다가오는 쪽(왼쪽)을 바라보고 앉아 있다
    if (last) this.cat = { x: this.goal.x, y: this.goal.y, face: 1, alive: true, run: false, anim: 0, speed: 0 };
    else this.cat = null;

    this.cam.x = this.player.x - R.W / 2;
    this.cam.y = this.player.y - R.H / 2;
    this.clampCam();

    this.meowT = U.rand(3, 6);
    this.creakT = U.rand(18, 32);
    this.stepT = 0;

    this.fade = 0;
    this.fadeTo(1, 2.2);
    this.showStageTitle(S.title, 3.4);
    Snd.setAmbience(1, 3);

    setTimeout(() => {
      if (this.state !== 'play') return;
      Narrator.say(S.lines, () => { this.locked = false; this.setHint('W A S D — 이동   ·   E — 상호작용'); setTimeout(() => this.setHint(''), 4000); });
    }, 1600);
  },

  updPlay(dt) {
    const P = this.player, T = this.map.T;

    if (this.locked) {
      if (Input.pressed(' ', 'enter', 'e')) Narrator.advance();
      P.moving = false;
    } else {
      let dx = 0, dy = 0;
      if (Input.held('a', 'arrowleft')) dx -= 1;
      if (Input.held('d', 'arrowright')) dx += 1;
      if (Input.held('w', 'arrowup')) dy -= 1;
      if (Input.held('s', 'arrowdown')) dy += 1;
      if (dx || dy) {
        const l = Math.hypot(dx, dy);
        dx /= l; dy /= l;
        const sp = 46;
        this.moveAxis(P, dx * sp * dt, 0);
        this.moveAxis(P, 0, dy * sp * dt);
        if (dx) P.face = dx > 0 ? 1 : -1;
        P.walk += dt * 7.5;
        P.moving = true;
        this.stepT -= dt;
        if (this.stepT <= 0) { Snd.step(); this.stepT = 0.44; }
      } else {
        P.moving = false;
      }
    }

    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.followCam(pcx, pcy, dt, 5);

    /* --- 목표와의 상호작용 --- */
    const G = this.goal;
    const d = U.dist(pcx, pcy, G.x, G.y);
    if (!this.locked && !G.used) {
      if (d < 16) {
        this.setHint(G.type === 'door' ? 'E — 문을 연다' : 'E — 고양이를 부른다');
        if (Input.pressed('e')) {
          G.used = true;
          this.setHint('');
          if (G.type === 'door') this.enterDoor();
          else this.startEnding();
        }
      } else if (this.el.hint.textContent.startsWith('E —')) {
        this.setHint('');
      }
    }

    /* --- 고양이 울음(방향 유도) --- */
    this.meowT -= dt;
    if (this.meowT <= 0 && !G.used) {
      this.meowT = U.rand(7.5, 13);
      const pan = U.clamp((G.x - pcx) / 260, -1, 1);
      const vol = U.clamp(1.15 - d / 780, 0.16, 1);
      Snd.meow(pan, vol);
    }

    /* --- 멀리서 문이 여닫히는 소리 --- */
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = U.rand(22, 44);
      if (U.chance(0.6)) Snd.creak(0.30);
      else Snd.thump(0, 0.4);
    }
  },

  enterDoor() {
    this.locked = true;
    Snd.creak();
    this.fadeTo(0, 1.8);
    setTimeout(() => {
      Narrator.say(['문 너머에서, 아주 작게 울음소리가 났다.'], () => {
        this.startStage(this.stageIdx + 1);
      });
    }, 2000);
  },

  /* ---------------- ENDING ---------------- */
  startEnding() {
    this.state = 'ending';
    this.locked = true;
    this.setHint('');
    const C = this.cat, P = this.player;

    this.setTimeline([
      { at: 0.2, fn: () => Snd.meow(0, 1) },
      { at: 0.8, fn: () => Narrator.say(['…찾았다.']) },
      { at: 3.4, fn: () => Narrator.say(['고양이는 처음부터 그 자리에 앉아 있었던 것처럼 보였다.']) },
      { at: 7.0, fn: () => { P.walkTo = { x: C.x - 10, y: C.y - 3 }; } },
      { at: 9.0, fn: () => { Snd.stopBells(); Snd.resolve(); Narrator.say(['품에 안자, 종소리가 멎었다.']); } },
      { at: 12.5, fn: () => { C.alive = false; Snd.setAmbience(0.45, 4); Narrator.say(['우리는 왔던 길을 되짚어 걸었다.']); } },
      { at: 16.0, fn: () => { Snd.creak(0.55); Narrator.say(['뒤에서, 문이 하나 조용히 닫혔다.']); } },
      { at: 19.5, fn: () => { this.fadeTo(0, 3.0); Snd.setAmbience(0, 4); } },
      { at: 23.0, fn: () => this.showEnd() }
    ]);
  },

  updEnding(dt) {
    this.updateTimeline(dt);
    const P = this.player;
    if (P.walkTo) {
      const dx = P.walkTo.x - P.x, dy = P.walkTo.y - P.y;
      const l = Math.hypot(dx, dy);
      if (l < 1.2) { P.walkTo = null; P.moving = false; }
      else {
        const sp = Math.min(l, 26 * dt);
        P.x += dx / l * sp; P.y += dy / l * sp;
        P.face = dx > 0 ? 1 : -1;
        P.walk += dt * 6;
        P.moving = true;
        this.stepT -= dt;
        if (this.stepT <= 0) { Snd.step(); this.stepT = 0.5; }
      }
    }
    this.followCam(P.x + 3, P.y + 3, dt, 4);
  },

  showEnd() {
    this.state = 'end';
    Narrator.clear();
    this.el.stageTitle.innerHTML = '고 양 이 를  찾 아 서<br><span style="font-size:.45em;letter-spacing:.9em;opacity:.6">끝</span>';
    this.el.stageTitle.classList.add('on');
    clearTimeout(this._stT);
    setTimeout(() => this.setHint('R — 다시 시작'), 2600);
  },

  updEnd() {
    if (Input.pressed('r')) location.reload();
  },

  /* ---------------- 이동 / 충돌 ---------------- */
  moveAxis(P, dx, dy) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2) || 1;
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const nx = P.x + sx, ny = P.y + sy;
      if (this.free(nx, ny, P.w, P.h)) { P.x = nx; P.y = ny; }
      else break;
    }
  },

  free(x, y, w, h) {
    const T = this.map.T;
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (Maze.solid(this.map, tx, ty)) return false;
    return true;
  },

  followCam(cx, cy, dt, k) {
    const tx = cx - R.W / 2, ty = cy - R.H / 2;
    const a = 1 - Math.pow(0.0015, dt * (k / 5));
    this.cam.x = U.lerp(this.cam.x, tx, a);
    this.cam.y = U.lerp(this.cam.y, ty, a);
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
    if (this.state === 'title') { R.present([], 0, 0); return; }
    if (!this.map) return;

    const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    R.drawMap(this.map, cam);

    const lights = [];

    /* 장식 — 화면 밖은 건너뛴다(광원 수 = present 비용) */
    for (const d of this.decor) {
      const sx = d.x - cam.x, sy = d.y - cam.y;
      if (sx < -60 || sx > R.W + 60) continue;
      R.sprite(d.spr, sx, sy, 1);
      if (d.glow) lights.push({ x: sx + 2, y: sy + 2, r: 46, i: 0.55 });
    }

    /* 목표(문 / 고양이) */
    if (this.goal && this.state !== 'end') {
      const G = this.goal;
      const gx = Math.round(G.x - cam.x), gy = Math.round(G.y - cam.y);
      if (G.type === 'door' && !G.used) {
        const pulse = 0.82 + Math.sin(this.time * 1.6) * 0.16;
        R.sprite(SPR.DOOR, gx - 6, gy - 9, pulse);
        // 멀리서도 아주 희미하게 보이는 등대 역할
        lights.push({ x: gx, y: gy, r: 26 + Math.sin(this.time * 1.1) * 3, i: 0.42 });
      }
    }

    /* 고양이 */
    if (this.cat && this.cat.alive) {
      const C = this.cat;
      const cx = Math.round(C.x - cam.x), cy = Math.round(C.y - cam.y);
      if (C.run) {
        const bob = Math.floor(C.anim) % 2;
        R.outline(SPR.CAT_RUN, cx - 6, cy - 5 + bob, C.face < 0);
        R.sprite(SPR.CAT_RUN, cx - 6, cy - 5 + bob, 1, C.face < 0);
      } else {
        R.outline(SPR.CAT_SIT, cx - 5, cy - 7, C.face < 0);
        R.sprite(SPR.CAT_SIT, cx - 5, cy - 7, 1, C.face < 0);
      }
      // 고양이 주변에 옅은 빛 + 몸에 걸리는 밝은 심지
      // (심지가 없으면 실루엣이 디더 무늬에 먹혀 읽히지 않는다)
      lights.push({ x: cx, y: cy, r: this.state === 'intro' ? 26 : 34, i: 0.5 });
      lights.push({ x: cx, y: cy - 2, r: 13, i: 0.97 });
    }

    /* 주인공 */
    if (this.player) {
      const P = this.player;
      const px = Math.round(P.x - cam.x), py = Math.round(P.y - cam.y);
      const frame = (P.moving || P.speed > 0) && (Math.floor(P.walk) % 2) ? SPR.MAN_B : SPR.MAN_A;
      R.outline(frame, px, py - 2, P.face < 0);
      R.sprite(frame, px, py - 2, 1, P.face < 0);

      // 손전등 : 미세하게 흔들리는 원형 광원
      const fl = 1 + Math.sin(this.time * 7.3) * 0.018 + Math.sin(this.time * 21.7) * 0.01;
      lights.push({ x: px + 3, y: py + 1, r: (this.state === 'intro' ? 62 : 56) * fl, i: 1 });
    }

    R.present(lights, this.fade, 0.05, this.state === 'intro' ? 0.013 : 0.010);
  }
};

addEventListener('load', () => Game.init());
