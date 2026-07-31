/* -------------------------------------------------------------------------
   R : 1비트 흑백 소프트웨어 렌더러
   Float32 휘도 버퍼에 그린 뒤, 광원 + 8x8 Bayer 디더로 흑/백 두 색만 출력.
------------------------------------------------------------------------- */
const R = {
  W: 320, H: 180,
  ctx: null,
  lum: null,
  img: null,
  noise: null,
  NW: 128,

  init(canvas) {
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.lum = new Float32Array(this.W * this.H);
    this.img = this.ctx.createImageData(this.W, this.H);
    const d = this.img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;

    // 벽 질감용 값 노이즈
    this.noise = new Float32Array(this.NW * this.NW);
    for (let i = 0; i < this.noise.length; i++) this.noise[i] = Math.random();
  },

  n(x, y) {
    return this.noise[((y & (this.NW - 1)) * this.NW) + (x & (this.NW - 1))];
  },

  clear(v = 0) { this.lum.fill(v); },

  px(x, y, v) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = x + y * this.W;
    if (v > this.lum[i]) this.lum[i] = v;
  },

  rect(x, y, w, h, v) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.W, (x + w) | 0), y1 = Math.min(this.H, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * this.W;
      for (let xx = x0; xx < x1; xx++) {
        const i = xx + row;
        if (v > this.lum[i]) this.lum[i] = v;
      }
    }
  },

  frame(x, y, w, h, v) {
    this.rect(x, y, w, 1, v); this.rect(x, y + h - 1, w, 1, v);
    this.rect(x, y, 1, h, v); this.rect(x + w - 1, y, 1, h, v);
  },

  zero(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    this.lum[x + y * this.W] = 0;
  },

  /* 실루엣 둘레 1px 를 검게 파낸다 — 흰 벽 위에서도 캐릭터가 읽히도록 */
  outline(data, x, y, flip = false) {
    const h = data.length, w = data[0].length;
    for (let sy = 0; sy < h; sy++) {
      const row = data[sy];
      for (let sx = 0; sx < w; sx++) {
        if (row[flip ? (w - 1 - sx) : sx] === '.') continue;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++)
            this.zero(x + sx + ox, y + sy + oy);
      }
    }
  },

  /* 스프라이트 : '#' = v, '+' = v*0.45 */
  sprite(data, x, y, v = 1, flip = false) {
    const h = data.length, w = data[0].length;
    for (let sy = 0; sy < h; sy++) {
      const row = data[sy];
      for (let sx = 0; sx < w; sx++) {
        const c = row[flip ? (w - 1 - sx) : sx];
        if (c === '.') continue;
        this.px(x + sx, y + sy, c === '+' ? v * 0.45 : v);
      }
    }
  },

  /* --------------------------------------------------------------------
     화면 출력
       lights : [{x, y, r, i}]
       fade   : 0(암전) ~ 1
       grain  : 필름 그레인 세기
  -------------------------------------------------------------------- */
  present(lights, fade = 1, grain = 0.035, ambient = 0.012) {
    const d = this.img.data, W = this.W, H = this.H;
    const B = U.BAYER8, lum = this.lum;
    const n = lights.length;

    // 광원 파라미터 미리 펼치기
    const lx = new Float32Array(n), ly = new Float32Array(n),
          lr = new Float32Array(n), li = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      lx[k] = lights[k].x; ly[k] = lights[k].y;
      lr[k] = lights[k].r * lights[k].r;
      li[k] = lights[k].i !== undefined ? lights[k].i : 1;
    }

    let p = 0;
    for (let y = 0; y < H; y++) {
      const brow = (y & 7) << 3;
      const lrow = y * W;
      for (let x = 0; x < W; x++, p += 4) {
        let L = ambient;
        for (let k = 0; k < n; k++) {
          const dx = x - lx[k], dy = (y - ly[k]) * 1.18;   // 살짝 세로로 눌린 빛
          const q = (dx * dx + dy * dy) / lr[k];
          if (q < 1) {
            const v = (1 - q) * li[k];
            if (v > L) L = v;
          }
        }
        let v = lum[lrow + x] * L * fade;
        // 필름 그레인. 어두운 영역에서 디더 격자가 규칙적으로 보이는 것도 함께 깨뜨린다.
        if (grain > 0) v += (this.n(x * 7 + 3, y * 13) - 0.5) * grain * (0.3 + 0.7 * L) * fade;
        const c = v > B[brow + (x & 7)] ? 255 : 0;
        d[p] = d[p + 1] = d[p + 2] = c;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  },

  /* --------------------------------------------------------------------
     맵 그리기 (카메라 기준). 벽은 흰 픽셀 덩어리, 바닥은 검정 + 미세 잡티.
  -------------------------------------------------------------------- */
  drawMap(map, cam) {
    const T = map.T;
    const tx0 = Math.max(0, Math.floor(cam.x / T));
    const ty0 = Math.max(0, Math.floor(cam.y / T));
    const tx1 = Math.min(map.W - 1, Math.floor((cam.x + this.W) / T));
    const ty1 = Math.min(map.H - 1, Math.floor((cam.y + this.H) / T));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const sx = tx * T - cam.x, sy = ty * T - cam.y;
        if (map.grid[ty][tx] === 1) {
          // 벽 : 거의 순백 + 벽돌 줄눈(줄눈만 어둡게 두어 형태가 읽히게)
          for (let y = 0; y < T; y++) {
            for (let x = 0; x < T; x++) {
              const wx = tx * T + x, wy = ty * T + y;
              let v = 0.93 + this.n(wx, wy) * 0.09;
              const brickRow = (wy / 4) | 0;
              const off = (brickRow & 1) ? 6 : 0;
              if (wy % 4 === 0 || (wx + off) % 12 === 0) v *= 0.34;
              this.px(sx + x, sy + y, v);
            }
          }
        } else {
          // 바닥 : 거의 검정, 아주 가끔 잡티(빛 바로 앞에서만 보임)
          for (let y = 0; y < T; y += 2) {
            for (let x = 0; x < T; x += 2) {
              const wx = tx * T + x, wy = ty * T + y;
              const nz = this.n(wx * 3, wy * 3);
              if (nz > 0.93) this.px(sx + x + (nz > 0.97 ? 1 : 0), sy + y, 0.20 + nz * 0.22);
            }
          }
        }
      }
    }
  }
};
