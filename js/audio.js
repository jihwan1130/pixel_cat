/* -------------------------------------------------------------------------
   Snd : Web Audio 절차적 사운드 엔진
   외부 오디오 파일 없이 전부 실시간 합성한다.
     · 저역 드론 + 바람  → 음산한 베이스
     · FM 종소리          → 불규칙하게 울리는 먼 종
     · 문 삐걱(creak)     → 구조물 진입 시
     · 야옹(meow)         → 고양이 방향 유도(패닝)
------------------------------------------------------------------------- */
const Snd = {
  ctx: null,
  master: null,
  conv: null,
  wet: null,
  amb: null,          // 앰비언스 전체 게인
  started: false,
  bellTimer: null,
  _bellScale: [174.6, 207.7, 233.1, 261.6, 311.1, 349.2, 415.3, 466.2],

  /* ---------------- 초기화 ---------------- */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    // 큰 잔향 = 텅 빈 공간감
    this.conv = this.ctx.createConvolver();
    this.conv.buffer = this._impulse(3.8, 2.4);
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.55;
    this.conv.connect(this.wet);
    this.wet.connect(this.master);
  },

  _impulse(dur, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  },

  _noise(dur) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  /* dry / wet 로 동시에 보내기 */
  _out(node, dry, wet) {
    const g = this.ctx.createGain(); g.gain.value = dry;
    node.connect(g); g.connect(this.master);
    const w = this.ctx.createGain(); w.gain.value = wet;
    node.connect(w); w.connect(this.conv);
  },

  /* ---------------- 앰비언스 ---------------- */
  startAmbience() {
    if (this.started) return;
    this.init();
    this.started = true;
    const ctx = this.ctx, t = ctx.currentTime;

    this.amb = ctx.createGain();
    this.amb.gain.setValueAtTime(0, t);
    this.amb.gain.linearRampToValueAtTime(1, t + 6);
    this.amb.connect(this.master);

    // --- 저역 드론 (약간 디튠된 두 톱니) ---
    const dg = ctx.createGain(); dg.gain.value = 0.075;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 5;
    lp.connect(dg); dg.connect(this.amb);

    [48.6, 49.15, 73.2].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.35 : 1;
      o.connect(g); g.connect(lp);
      o.start(t);
    });

    // 필터를 아주 느리게 흔들어 "숨쉬는" 느낌
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    const lfoG = ctx.createGain(); lfoG.gain.value = 70;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(t);

    // --- 바람 / 공기 소음 ---
    const ns = ctx.createBufferSource();
    ns.buffer = this._noise(6); ns.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.035;
    ns.connect(bp); bp.connect(ng); ng.connect(this.amb);
    const nl = ctx.createOscillator(); nl.frequency.value = 0.07;
    const nlg = ctx.createGain(); nlg.gain.value = 260;
    nl.connect(nlg); nlg.connect(bp.frequency); nl.start(t);
    ns.start(t);

    this._scheduleBell(3.5);
  },

  setAmbience(v, time = 2) {
    if (!this.amb) return;
    const t = this.ctx.currentTime;
    this.amb.gain.cancelScheduledValues(t);
    this.amb.gain.setValueAtTime(this.amb.gain.value, t);
    this.amb.gain.linearRampToValueAtTime(v, t + time);
  },

  _scheduleBell(delay) {
    clearTimeout(this.bellTimer);
    this.bellTimer = setTimeout(() => {
      if (!this.started) return;
      this.bell();
      if (U.chance(0.35)) setTimeout(() => this.bell(0.6), U.rand(600, 1400));
      // 불안도가 높을수록 종 간격이 좁아진다
      const d = this.dread || 0;
      this._scheduleBell(U.rand(6.5 - d * 0.45, 14 - d * 0.8));
    }, delay * 1000);
  },

  stopBells() { clearTimeout(this.bellTimer); this.bellTimer = null; },

  /* ---------------- 개별 효과음 ---------------- */

  /* FM 종소리 — 멀리서 울리는 교회 종 느낌 */
  bell(vol = 1, freq = null) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = freq || U.choice(this._bellScale) * (U.chance(0.25) ? 0.5 : 1);
    const dur = U.rand(3.2, 5.5);

    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.76;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.6, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur);
    mod.connect(mg); mg.connect(car.frequency);

    const g = ctx.createGain();
    const peak = 0.16 * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = U.rand(-0.7, 0.7);

    car.connect(g);
    const tail = pan ? (g.connect(pan), pan) : g;
    this._out(tail, 0.35, 0.9);

    car.start(t); mod.start(t);
    car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  },

  /* 문 삐걱 — 피치가 불규칙하게 미끄러지는 톱니 + 마지막 쿵
     vol 을 낮추면 "멀리서 문이 여닫히는" 소리가 된다 */
  creak(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = U.rand(1.3, 1.9);

    const N = 48;
    const curve = new Float32Array(N);
    let base = U.rand(52, 74);
    for (let i = 0; i < N; i++) {
      const p = i / (N - 1);
      curve[i] = base * (1 + p * U.rand(1.2, 2.0)) * (1 + Math.sin(p * 40) * 0.09) * U.rand(0.94, 1.06);
    }

    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueCurveAtTime(curve, t, dur);

    const o2 = ctx.createOscillator(); o2.type = 'square';
    o2.frequency.setValueCurveAtTime(curve.map(v => v * 4.7), t, dur);
    const o2g = ctx.createGain(); o2g.gain.value = 0.12;
    o2.connect(o2g);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 7;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.linearRampToValueAtTime(1400, t + dur);

    const peak = 0.22 * vol;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.25);
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(bp); o2g.connect(bp); bp.connect(g);
    // 멀리서 나는 소리일수록 잔향 비중을 높인다
    this._out(g, 0.55 * vol, 0.7 + (1 - vol) * 0.3);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);

    this.thump(dur + 0.12, vol);
  },

  /* 묵직한 쿵 (문 닫힘 / 저 멀리서 뭔가 떨어짐) */
  thump(delay = 0, vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.3);
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 420;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    ns.connect(nf); nf.connect(ng);

    o.connect(g);
    this._out(g, 0.6, 0.6);
    this._out(ng, 0.6, 0.4);
    o.start(t); o.stop(t + 0.6); ns.start(t);
  },

  /* 야옹 — pan(-1..1) 은 고양이가 있는 방향, vol 은 거리 */
  meow(pan = 0, vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = U.rand(0.45, 0.7);
    const f0 = U.rand(340, 430);

    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.55, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(f0 * 0.72, t + dur);

    // 비브라토
    const vib = ctx.createOscillator(); vib.frequency.value = U.rand(11, 16);
    const vg = ctx.createGain(); vg.gain.value = 14;
    vib.connect(vg); vg.connect(o.frequency); vib.start(t);

    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 820; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1650; f2.Q.value = 8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.07);
    g.gain.setValueAtTime(0.16 * vol, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);

    let tail = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      g.connect(p); tail = p;
    }
    this._out(tail, 0.45, 0.85);
    o.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  },

  /* 발소리 — 터벅터벅.
     저역이 실린 무게 + 신발이 바닥을 끄는 잡음. 잔향을 넉넉히 실어
     빈 공간에서 자기 발소리가 되돌아오게 한다.
     좌우 발을 번갈아 조금씩 다르게 낸다 — 똑같은 소리가 반복되면
     발소리가 아니라 메트로놈으로 들린다. */
  step() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this._foot = !this._foot;
    const heavy = this._foot;

    // 몸무게가 실리는 낮은 쿵
    const o = ctx.createOscillator(); o.type = 'sine';
    const f0 = (heavy ? 104 : 91) * U.rand(0.97, 1.03);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.13);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(heavy ? 0.105 : 0.078, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
    o.connect(og);

    // 신발 바닥이 끌리는 소리
    const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.24);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = U.rand(560, 980); lp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(heavy ? 0.055 : 0.041, t + 0.009);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + U.rand(0.14, 0.21));
    ns.connect(lp); lp.connect(ng);

    this._out(og, 0.55, 0.5);
    this._out(ng, 0.5, 0.55);
    o.start(t); o.stop(t + 0.28);
    ns.start(t);
  },

  /* ---------------- 수색 / 공포 반응 ---------------- */

  /* 뒤지는 소리 : 필터 걸린 잡음이 서너 번 툭툭 */
  rummage() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const taps = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < taps; i++) {
      const t = t0 + i * U.rand(0.13, 0.24);
      const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.2);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = U.rand(700, 2400); f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(U.rand(0.05, 0.1), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + U.rand(0.09, 0.18));
      ns.connect(f); f.connect(g);
      this._out(g, 0.5, 0.4);
      ns.start(t);
    }
  },

  /* 공포 스팅 : 하강하는 저음 + 불협 종 클러스터.
     크게 때리지 않는다. 놀래키는 것이 아니라 바닥이 꺼지는 느낌을 노린다. */
  sting() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 1.5);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.26, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    sub.connect(sg);
    this._out(sg, 0.8, 0.4);
    sub.start(t); sub.stop(t + 1.7);

    // 서로 어긋난 배음 — 종이지만 조율되지 않은 종
    [1, 1.41, 2.07].forEach((r, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 233 * r * (1 + (Math.random() - 0.5) * 0.02);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g);
      this._out(g, 0.3, 1.0);
      o.start(t); o.stop(t + 2.5);
    });
  },

  /* 무언가 빠르게 지나가는 소리 */
  scurry() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < 9; i++) {
      const t = t0 + i * 0.045 + Math.random() * 0.02;
      const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 2600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      ns.connect(f); f.connect(g);
      this._out(g, 0.55, 0.3);
      ns.start(t);
    }
  },

  /* 바로 귀 옆에서 울리는 종 — 잔향 없이 건조하게 */
  nearBell() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = 311.1, dur = 2.6;
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.76;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 3.4, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    this._out(g, 1.0, 0.12);          // 거의 dry — 그래서 가깝게 들린다
    car.start(t); mod.start(t);
    car.stop(t + dur); mod.stop(t + dur);
  },

  /* 아주 낮은 숨소리 — 무언가 나타났다는 유일한 청각 단서 */
  breath() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const ns = ctx.createBufferSource(); ns.buffer = this._noise(1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 340; f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.3);
    ns.connect(f); f.connect(g);
    this._out(g, 0.5, 0.8);
    ns.start(t);
  },

  /* 사라질 때의 바람 */
  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    ns.connect(f); f.connect(g);
    this._out(g, 0.5, 0.7);
    ns.start(t);
  },

  /* ---------------- 추격 ----------------
     빛으로 위치를 알려주지 않기로 했으므로, 거리 정보는 전부 소리로 준다.
     심장박동 간격 = 얼마나 가까운가. 발소리 패닝 = 어느 쪽인가.
  ---------------------------------------- */
  startChase() {
    if (!this.ctx || this.chaseOn) return;
    this.chaseOn = true;
    this.chaseIntensity = 0;
    const ctx = this.ctx, t = ctx.currentTime;

    // 추격이 시작되면 종은 멎는다. 익숙한 소리가 사라지는 것 자체가 신호다.
    this.stopBells();

    this.chaseGain = ctx.createGain();
    this.chaseGain.gain.setValueAtTime(0.0001, t);
    this.chaseGain.gain.linearRampToValueAtTime(1, t + 1.0);
    this.chaseGain.connect(this.master);

    // 바닥에 깔리는 저역
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 36.5;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 36.5 * 1.014;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 100; lp.Q.value = 6;
    const dg = ctx.createGain(); dg.gain.value = 0.09;
    o1.connect(lp); o2.connect(lp); lp.connect(dg); dg.connect(this.chaseGain);
    o1.start(t); o2.start(t);

    // 귀 안쪽에서 나는 것 같은 가는 고음
    const hn = ctx.createBufferSource(); hn.buffer = this._noise(4); hn.loop = true;
    const hb = ctx.createBiquadFilter();
    hb.type = 'bandpass'; hb.frequency.value = 3200; hb.Q.value = 14;
    const hg = ctx.createGain(); hg.gain.value = 0.010;
    hn.connect(hb); hb.connect(hg); hg.connect(this.chaseGain);
    hn.start(t);

    this._chaseNodes = [o1, o2, hn];
    this._chaseLp = lp; this._chaseDrone = dg; this._chaseHiss = hg;
    this._beat();
  },

  _beat() {
    if (!this.chaseOn) return;
    const i = this.chaseIntensity;
    this.heart(0.55 + i * 0.55);
    this.beatTimer = setTimeout(() => this._beat(), U.lerp(1.15, 0.44, i) * 1000);
  },

  /* 두 번 치는 심장 */
  heart(vol) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [0, 0.17].forEach((off, k) => {
      const t = t0 + off;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(74, t);
      o.frequency.exponentialRampToValueAtTime(33, t + 0.17);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.30 * vol * (k ? 0.68 : 1), t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
      o.connect(g);
      this._out(g, 0.9, 0.12);
      o.start(t); o.stop(t + 0.32);
    });
  },

  setChaseIntensity(v) {
    this.chaseIntensity = U.clamp(v, 0, 1);
    if (!this.chaseOn) return;
    const t = this.ctx.currentTime;
    this._chaseDrone.gain.setTargetAtTime(0.09 + this.chaseIntensity * 0.15, t, 0.4);
    this._chaseLp.frequency.setTargetAtTime(95 + this.chaseIntensity * 140, t, 0.4);
    this._chaseHiss.gain.setTargetAtTime(0.010 + this.chaseIntensity * 0.032, t, 0.5);
  },

  stopChase() {
    if (!this.chaseOn) return;
    this.chaseOn = false;
    clearTimeout(this.beatTimer);
    const t = this.ctx.currentTime;
    this.chaseGain.gain.cancelScheduledValues(t);
    this.chaseGain.gain.setValueAtTime(this.chaseGain.gain.value, t);
    this.chaseGain.gain.linearRampToValueAtTime(0.0001, t + 1.3);
    const nodes = this._chaseNodes || [];
    this._chaseNodes = [];
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 1500);
    // 종을 다시 돌린다 — 조용해졌다는 것을 알려주는 것도 연출이다
    if (this.started) this._scheduleBell(U.rand(3, 6));
  },

  /* 그것의 발소리 — 주인공 발소리보다 무겁고 건조하다 */
  figStep(pan, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;

    const ns = ctx.createBufferSource(); ns.buffer = this._noise(0.2);
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 360; nf.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.13 * vol, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(88, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.15 * vol, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    ns.connect(nf); nf.connect(ng); o.connect(og);

    let tail;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      ng.connect(p); og.connect(p);
      tail = p;
    } else {
      tail = ctx.createGain();
      ng.connect(tail); og.connect(tail);
    }
    this._out(tail, 0.75, 0.3);
    ns.start(t); o.start(t); o.stop(t + 0.3);
  },

  /* 불안도가 오르면 종이 잦아지고 드론이 조금 더 눌린다 */
  setDread(v) {
    this.dread = U.clamp(v, 0, 10);
    if (this.amb) this.setAmbience(1 + this.dread * 0.035, 3);
  },

  /* 엔딩용 : 부드럽게 해소되는 화음 */
  resolve() {
    if (!this.ctx) return;
    this.stopBells();
    [261.6, 311.1, 392.0].forEach((f, i) =>
      setTimeout(() => this.bell(0.75, f), i * 850));
  }
};
