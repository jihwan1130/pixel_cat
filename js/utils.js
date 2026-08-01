/* 공용 유틸 -------------------------------------------------------------- */
const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },

  /* 8x8 Bayer 오더드 디더 매트릭스 (0..63) — 1비트 흑백 표현의 핵심 */
  BAYER8: new Float32Array([
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ].map(v => (v + 0.5) / 64))
};

/* 키 입력 ---------------------------------------------------------------- */
const Input = {
  down: Object.create(null),
  _pressed: Object.create(null),
  anyPressed: false,

  init() {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.down[k] = true;
      this._pressed[k] = true;
      this.anyPressed = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.down[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.down = Object.create(null); });
  },

  held(...keys) { return keys.some(k => this.down[k]); },
  pressed(...keys) { return keys.some(k => this._pressed[k]); },
  endFrame() { this._pressed = Object.create(null); this.anyPressed = false; }
};

/* 내레이션(타이프라이터) --------------------------------------------------- */
const Narrator = {
  el: null,
  lines: [],
  idx: 0,
  chars: 0,
  hold: 0,
  active: false,
  onDone: null,
  SPEED: 26,          // 초당 글자수
  HOLD_AFTER: 1.7,    // 한 줄 다 쓴 뒤 대기(초)

  init() {
    this.el = document.getElementById('narration');
    this.fel = document.getElementById('flash');
  },

  /* 진행을 막지 않는 한 줄. 수색 결과처럼 흐름을 끊으면 안 되는 문장에 쓴다. */
  flash(text, opt = {}) {
    if (!this.fel) return;
    this.fel.textContent = text;
    this.fel.className = 'on' + (opt.bad ? ' bad' : '');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { this.fel.className = ''; }, (opt.dur || 3.6) * 1000);
  },

  clearFlash() {
    clearTimeout(this._flashT);
    if (this.fel) this.fel.className = '';
  },

  say(lines, onDone) {
    this.lines = Array.isArray(lines) ? lines.slice() : [lines];
    this.idx = 0; this.chars = 0; this.hold = 0;
    this.active = true;
    this.onDone = onDone || null;
    this.el.classList.add('on');
    this.el.textContent = '';
  },

  clear() {
    this.active = false;
    this.lines = [];
    this.el.classList.remove('on');
    this.el.textContent = '';
  },

  /* 현재 줄을 즉시 완성 → 이미 완성됐으면 다음 줄로 */
  advance() {
    if (!this.active) return;
    const line = this.lines[this.idx] || '';
    if (this.chars < line.length) { this.chars = line.length; this.hold = 0; }
    else this._next();
  },

  _next() {
    this.idx++;
    this.chars = 0;
    this.hold = 0;
    if (this.idx >= this.lines.length) {
      const cb = this.onDone;
      this.clear();
      if (cb) cb();
    }
  },

  update(dt) {
    if (!this.active) return;
    const line = this.lines[this.idx] || '';
    if (this.chars < line.length) {
      this.chars = Math.min(line.length, this.chars + this.SPEED * dt);
      const shown = line.slice(0, Math.floor(this.chars));
      this.el.textContent = shown;
    } else {
      this.el.textContent = line;
      this.hold += dt;
      if (this.hold > this.HOLD_AFTER) this._next();
    }
  }
};
