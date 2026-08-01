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
  meowT: 0, creakT: 0, stepT: 0,

  SPEED: 62,
  TORCH: 96,

  el: {},

  /* --------------------------------------------------------------- */
  init() {
    R.init(document.getElementById('game'));
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
  showStageTitle(text, dur = 3.4) {
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
      case 'title':  this.updTitle(dt);  break;
      case 'intro':  this.updIntro(dt);  break;
      case 'play':   this.updPlay(dt);   break;
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
    this.setHint('SPACE — 건너뛰기');

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
      P.walk += dt * 6.5;
      P.moving = true;
      this.stepT -= dt;
      if (this.stepT <= 0) { Snd.step(); this.stepT = 0.46; }
    } else P.moving = false;
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
    this.stepT = 0;

    this.fade = 0;
    this.fadeTo(1, 2.2);
    this.showStageTitle(m.title, 3.6);
    Snd.setAmbience(1, 3);

    setTimeout(() => {
      if (this.state !== 'play') return;
      Narrator.say(m.lines, () => {
        this.locked = false;
        this.setHint('W A S D — 이동   ·   E — 상호작용');
        setTimeout(() => this.setHint(''), 4000);
      });
    }, 1700);
  },

  updPlay(dt) {
    const P = this.player;

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
        this.moveAxis(P, dx / l * this.SPEED * dt, 0);
        this.moveAxis(P, 0, dy / l * this.SPEED * dt);
        if (dx) P.face = dx > 0 ? 1 : -1;
        P.walk += dt * 7;
        P.moving = true;
        this.stepT -= dt;
        if (this.stepT <= 0) { Snd.step(); this.stepT = 0.42; }
      } else P.moving = false;
    }

    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.followCam(pcx, pcy, dt, 5);

    /* --- 목표 --- */
    const G = this.goal;
    const d = U.dist(pcx, pcy, G.x, G.y);
    if (!this.locked && !G.used) {
      if (d < 30) {
        this.setHint(G.type === 'door' ? 'E — 문을 연다' : 'E — 고양이를 부른다');
        if (Input.pressed('e')) {
          G.used = true;
          this.setHint('');
          if (G.type === 'door') this.enterDoor(); else this.startEnding();
        }
      } else if (this.el.hint.textContent.startsWith('E —')) this.setHint('');
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
    const C = this.cat, P = this.player;

    this.setTimeline([
      { at: 0.2,  fn: () => Snd.meow(0, 1) },
      { at: 0.8,  fn: () => Narrator.say(['…찾았다.']) },
      { at: 3.4,  fn: () => Narrator.say(['고양이는 처음부터 그 자리에 앉아 있었던 것처럼 보였다.']) },
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
        this.stepT -= dt;
        if (this.stepT <= 0) { Snd.step(); this.stepT = 0.5; }
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
    setTimeout(() => this.setHint('R — 다시 시작'), 2600);
  },

  updEnd() { if (Input.pressed('r')) location.reload(); },

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

    /* --- 목표 문에 은은한 빛 --- */
    const G = this.goal;
    if (G && G.type === 'door' && !G.used) {
      lights.push({
        x: G.x - cam.x, y: G.y - cam.y + 4,
        r: 40 + Math.sin(this.time * 1.1) * 4, i: 0.5
      });
    }

    /* --- 소품 + 캐릭터를 y 순으로 겹쳐 그린다 --- */
    const order = [];
    for (const pr of map.props) {
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      if (sx < -50 || sx > R.W + 50 || sy < -60 || sy > R.H + 60) continue;
      // 전구는 천장에 매달려 있으므로 무엇에도 가리지 않게 마지막에 그린다
      order.push({ y: pr.n === 'bulb' ? 1e9 : pr.y, kind: 'prop', pr, sx, sy });
    }
    if (this.cat && this.cat.alive) order.push({ y: this.cat.y, kind: 'cat' });
    if (this.player) order.push({ y: this.player.y + this.player.h, kind: 'man' });
    order.sort((a, b) => a.y - b.y);

    for (const o of order) {
      if (o.kind === 'prop') {
        const p = Props.get(o.pr.n, (o.pr.tx * 3 + o.pr.ty) & 3);
        if (!p) continue;
        R.drawProp(p, o.sx, o.sy);
        if (p.light)
          lights.push({ x: o.sx + p.light.dx, y: o.sy + p.light.dy, r: p.light.r, i: p.light.i });
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
        lights.push({ x: cx, y: cy - 3, r: 22, i: 0.9 });
        lights.push({ x: cx, y: cy - 3, r: 46, i: 0.45 });
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
      lights.push({ x: px, y: py, r: (this.state === 'intro' ? this.TORCH + 14 : this.TORCH) * fl, i: 1 });
    }

    // ambient 를 아주 조금만 준다. 밝은 재질(건물 입면·갓돌)만 겨우 드러나고
    // 바닥은 crush 임계값 아래라 완전한 검정으로 남는다 — 멀리 구조물 윤곽만 보이는 상태.
    R.present(lights, this.fade, 0.032, 0.05);
  }
};

addEventListener('load', () => Game.init());
