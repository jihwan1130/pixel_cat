/* -------------------------------------------------------------------------
   R : 흑백 그레이스케일 픽셀 소프트웨어 렌더러
   Float32 휘도 버퍼에 그린 뒤 광원을 곱하고, 8x8 Bayer 오더드 디더로
   SHADES 단계(기본 5단계)의 회색으로 양자화한다.
   1비트보다 톤이 부드럽지만 여전히 명확한 픽셀 화면이 나온다.
------------------------------------------------------------------------- */
const R = {
  W: 480, H: 270,
  T: 16,                 // 타일 한 변
  SHADES: 6,             // 0, .2, .4, .6, .8, 1 — 1비트보다 부드럽되 여전히 픽셀 화면
  ctx: null,
  lum: null,
  img: null,
  noise: null,
  NW: 256,

  init(canvas, w, h) {
    if (w) { this.W = w; this.H = h; }
    canvas.width = this.W; canvas.height = this.H;
    this.lgrid = null;                 // 해상도가 바뀌면 광량 격자를 다시 만든다
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.lum = new Float32Array(this.W * this.H);
    this.img = this.ctx.createImageData(this.W, this.H);
    const d = this.img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;

    this.noise = new Float32Array(this.NW * this.NW);
    for (let i = 0; i < this.noise.length; i++) this.noise[i] = Math.random();
  },

  n(x, y) {
    return this.noise[((y & (this.NW - 1)) * this.NW) + (x & (this.NW - 1))];
  },

  clear(v = 0) { this.lum.fill(v); },

  /* --- 쓰기 : set 은 덮어쓰기, add 는 밝은 쪽 우선 --- */
  px(x, y, v) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    this.lum[x + y * this.W] = v;
  },
  pxMax(x, y, v) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = x + y * this.W;
    if (v > this.lum[i]) this.lum[i] = v;
  },
  zero(x, y) { this.px(x, y, 0); },

  rect(x, y, w, h, v) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.W, (x + w) | 0), y1 = Math.min(this.H, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * this.W;
      for (let xx = x0; xx < x1; xx++) this.lum[xx + row] = v;
    }
  },

  /* 16x16 타일 캐시를 화면에 그대로 찍는다 */
  blit(tile, sx, sy) {
    const T = this.T;
    sx |= 0; sy |= 0;
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy);
    const x1 = Math.min(this.W, sx + T), y1 = Math.min(this.H, sy + T);
    for (let y = y0; y < y1; y++) {
      const src = (y - sy) * T - sx;
      const dst = y * this.W;
      for (let x = x0; x < x1; x++) this.lum[x + dst] = tile[x + src];
    }
  },

  /* --- 스프라이트 : 문자 → 밝기. '.' 은 투명, 나머지는 덮어쓴다 --- */
  SHADE: { '0': 0, '1': 0.20, '2': 0.40, '3': 0.62, '4': 0.84, '5': 1 },

  sprite(data, x, y, flip = false, mul = 1) {
    const h = data.length, w = data[0].length, S = this.SHADE;
    for (let sy = 0; sy < h; sy++) {
      const row = data[sy];
      for (let sx = 0; sx < w; sx++) {
        const c = row[flip ? (w - 1 - sx) : sx];
        if (c === '.' || c === undefined) continue;
        const v = S[c];
        if (v === undefined) continue;
        this.px(x + sx, y + sy, v * mul);
      }
    }
  },

  /* 소품 버퍼(PBuf)를 앵커 기준으로 그린다. mul 로 전체를 어둡게 할 수 있다. */
  drawProp(p, x, y, mul = 1) {
    const w = p.w, h = p.h, ax = x - p.ax, ay = y - p.ay;
    for (let sy = 0; sy < h; sy++) {
      const row = sy * w;
      for (let sx = 0; sx < w; sx++) {
        if (!p.a[sx + row]) continue;
        this.px(ax + sx, ay + sy, p.lum[sx + row] * mul);
      }
    }
  },

  /* 실루엣 둘레 1px 를 검게 파낸다 — 밝은 벽 앞에서도 형태가 읽히도록 */
  outline(data, x, y, flip = false) {
    const h = data.length, w = data[0].length;
    for (let sy = 0; sy < h; sy++) {
      const row = data[sy];
      for (let sx = 0; sx < w; sx++) {
        const c = row[flip ? (w - 1 - sx) : sx];
        if (c === '.' || c === undefined) continue;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++)
            this.zero(x + sx + ox, y + sy + oy);
      }
    }
  },

  /* --------------------------------------------------------------------
     화면 출력
       lights : [{x, y, r, i}]   r 은 반경(px), i 는 세기
       fade   : 0(암전) ~ 1
  -------------------------------------------------------------------- */
  GS: 4,   // 광량 격자 간격. 빛은 완만하므로 1/4 해상도로 계산해 보간한다.

  present(lights, fade = 1, grain = 0.03, ambient = 0.02) {
    const d = this.img.data, W = this.W, H = this.H;
    const B = U.BAYER8, lum = this.lum;
    const n = lights.length;
    const S = this.SHADES - 1;
    const step = 255 / S;

    /* --- 광량 격자 --- */
    const GS = this.GS;
    if (!this.lgrid) {
      this.gw = Math.ceil(W / GS) + 2;
      this.gh = Math.ceil(H / GS) + 2;
      this.lgrid = new Float32Array(this.gw * this.gh);
    }
    const gw = this.gw, gh = this.gh, g = this.lgrid;

    for (let gy = 0; gy < gh; gy++) {
      const py = gy * GS, row = gy * gw;
      for (let gx = 0; gx < gw; gx++) {
        const px = gx * GS;
        let L = ambient;
        for (let k = 0; k < n; k++) {
          const l = lights[k];
          const dx = px - l.x, dy = (py - l.y) * 1.15;
          const r = l.r;
          const q = (dx * dx + dy * dy) / (r * r);
          if (q < 1) {
            // 중심부는 평탄하게 밝고 바깥에서 급히 떨어진다.
            // 순수 (1-q) 는 가운데 한 점만 최대치라 화면 전체가 회색으로 눌린다.
            let v = (1 - q) * 1.55;
            if (v > 1) v = 1;
            v *= (l.i !== undefined ? l.i : 1);
            if (v > L) L = v;
          }
        }
        g[gx + row] = L;
      }
    }

    let p = 0;
    for (let y = 0; y < H; y++) {
      const brow = (y & 7) << 3;
      const lrow = y * W;
      const gy0 = (y / GS) | 0;
      const ty = (y - gy0 * GS) / GS;
      const r0 = gy0 * gw, r1 = r0 + gw;
      for (let x = 0; x < W; x++, p += 4) {
        const gx0 = (x / GS) | 0;
        const tx = (x - gx0 * GS) / GS;
        const a0 = g[gx0 + r0], a1 = g[gx0 + 1 + r0];
        const b0 = g[gx0 + r1], b1 = g[gx0 + 1 + r1];
        const top = a0 + (a1 - a0) * tx;
        const L = top + ((b0 + (b1 - b0) * tx) - top) * ty;

        let v = lum[lrow + x] * L * fade;
        if (grain > 0) v += (this.n(x * 7 + 3, y * 13) - 0.5) * grain * (0.12 + 0.88 * L) * fade;

        // 아주 어두운 값은 아예 검정으로 눌러버린다.
        // 안 그러면 5단계 디더가 빛이 닿지 않는 곳까지 점무늬로 채워 어둠이 죽는다.
        if (v <= 0.025) { d[p] = d[p + 1] = d[p + 2] = 0; continue; }
        if (v >= 1) { d[p] = d[p + 1] = d[p + 2] = 255; continue; }

        const q = v * S;
        let lo = q | 0;
        if (q - lo > B[brow + (x & 7)]) lo++;
        const c = lo * step;
        d[p] = d[p + 1] = d[p + 2] = c;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
};
