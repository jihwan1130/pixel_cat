/* -------------------------------------------------------------------------
   Touch : 휴대폰 가로모드 조작
     왼쪽 절반 — 끌어서 이동 (누른 지점에 스틱이 생긴다)
     오른쪽    — 눌러서 상호작용 (E 와 같다)
   화면이 작으니 작은 버튼을 정확히 누르게 하지 않는다. 영역으로 나눈다.
------------------------------------------------------------------------- */
/* 이름을 Touch 로 두면 DOM 표준 전역 Touch 생성자를 가린다 */
const TouchPad = {
  enabled: false,
  vec: { x: 0, y: 0, m: 0 },
  moveId: null,
  origin: { x: 0, y: 0 },
  cur: { x: 0, y: 0 },
  RADIUS: 54,
  DEAD: 9,
  used: false,
  _fs: false,

  init() {
    // ?touch=1 로 데스크톱에서도 모바일 조작을 켤 수 있다 (확인용)
    const forced = /[?&]touch=1/.test(location.search);
    this.enabled = forced || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!this.enabled) return;

    document.body.classList.add('touch');
    this.layer = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.knob  = document.getElementById('knob');
    this.btn   = document.getElementById('btn-act');
    this.hintRing = document.getElementById('stick-hint');
    this.layer.hidden = false;

    const opt = { passive: false };
    this.layer.addEventListener('touchstart',  e => this.onStart(e),  opt);
    this.layer.addEventListener('touchmove',   e => this.onMove(e),   opt);
    this.layer.addEventListener('touchend',    e => this.onEnd(e),    opt);
    this.layer.addEventListener('touchcancel', e => this.onEnd(e),    opt);

    // 방향이 바뀌면 잡고 있던 스틱을 놓는다
    addEventListener('orientationchange', () => this.release());
    addEventListener('resize', () => this.release());
  },

  /* 오른쪽 절반 또는 액션 버튼 근처인가 */
  isAction(t) {
    const r = this.btn.getBoundingClientRect();
    if (t.clientX > r.left - 24 && t.clientY > r.top - 24) return true;
    return t.clientX > innerWidth * 0.55;
  },

  onStart(e) {
    e.preventDefault();

    // 이 레이어가 화면을 통째로 덮고 있어서 타이틀 화면의 언어 버튼까지 가린다.
    // 버튼 위를 눌렀다면 여기서 먹고, 시작으로는 넘기지 않는다.
    if (I18N.hitTest(e.changedTouches)) return;

    // 오디오는 반드시 제스처 핸들러 안에서 열어야 iOS 가 허용한다.
    // rAF 안에서 여는 경우 컨텍스트가 suspended 로 남는다.
    // (window.Snd 로 접근하면 안 된다 — const 선언은 window 프로퍼티를 만들지 않는다)
    Snd.init();
    this.goFullscreen();
    Input.anyPressed = true;              // 타이틀 화면 진행용

    for (const t of e.changedTouches) {
      if (this.isAction(t)) { this.press(); continue; }
      if (this.moveId !== null) { this.press(); continue; }
      this.moveId = t.identifier;
      this.origin.x = t.clientX; this.origin.y = t.clientY;
      this.cur.x = t.clientX;    this.cur.y = t.clientY;
      this.used = true;
      if (this.hintRing) this.hintRing.classList.add('off');
      this.stick.classList.add('on');
      this.knob.classList.add('on');
      this.sync();
    }
  },

  onMove(e) {
    e.preventDefault();
    if (this.moveId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== this.moveId) continue;
      this.cur.x = t.clientX; this.cur.y = t.clientY;
      this.sync();
    }
  },

  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches)
      if (t.identifier === this.moveId) this.release();
  },

  release() {
    this.moveId = null;
    this.vec.m = 0;
    if (this.stick) { this.stick.classList.remove('on'); this.knob.classList.remove('on'); }
  },

  press() {
    Input._pressed['e'] = true;
    Input.anyPressed = true;
    if (!this.btn) return;
    this.btn.classList.add('press');
    clearTimeout(this._pt);
    this._pt = setTimeout(() => this.btn.classList.remove('press'), 120);
  },

  /* 스틱 벡터와 노브 위치를 갱신한다 */
  sync() {
    const dx = this.cur.x - this.origin.x, dy = this.cur.y - this.origin.y;
    const d = Math.hypot(dx, dy);

    this.stick.style.left = this.origin.x + 'px';
    this.stick.style.top  = this.origin.y + 'px';

    if (d < this.DEAD) {
      this.vec.m = 0;
      this.knob.style.left = this.origin.x + 'px';
      this.knob.style.top  = this.origin.y + 'px';
      return;
    }
    const cl = Math.min(d, this.RADIUS);
    this.vec.x = dx / d;
    this.vec.y = dy / d;
    // 살짝만 밀어도 답답하지 않게 최저 속도를 45% 로 둔다
    this.vec.m = 0.45 + 0.55 * (cl / this.RADIUS);

    this.knob.style.left = (this.origin.x + this.vec.x * cl) + 'px';
    this.knob.style.top  = (this.origin.y + this.vec.y * cl) + 'px';
  },

  goFullscreen() {
    if (this._fs) return;
    this._fs = true;
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 거부되면 그냥 둔다 */ }
  }
};
