/* -------------------------------------------------------------------------
   Props : 소품 스프라이트. 각 소품은 자기 버퍼에 절차적으로 그려 캐시한다.
   앵커는 밑변 가운데(발이 닿는 지점)다.
   light 를 가진 소품(가로등, 전구)은 화면에 광원을 하나 얹는다.
------------------------------------------------------------------------- */

/* 소품 버퍼 : lum + 알파 */
function PBuf(w, h) {
  return {
    w, h,
    lum: new Float32Array(w * h),
    a: new Uint8Array(w * h),
    set(x, y, v) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = x + y * this.w; this.lum[i] = v; this.a[i] = 1;
    },
    rect(x, y, w, h, v) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, v);
    },
    hl(x, y, w, v) { this.rect(x, y, w, 1, v); },
    vl(x, y, h, v) { this.rect(x, y, 1, h, v); },
    /* 타원 채우기 */
    ell(cx, cy, rx, ry, v) {
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++)
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.set(cx + x, cy + y, v);
    },
    /* 이미 칠해진 곳에만 덧칠 */
    over(x, y, v) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = x + y * this.w; if (this.a[i]) this.lum[i] = v;
    },
    /* 실루엣 가장자리를 어둡게 — 배경에서 형태가 떨어져 보이게 한다 */
    rim(v) {
      const { w, h, a } = this;
      const edge = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (!a[x + y * w]) continue;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
              !a[x - 1 + y * w] || !a[x + 1 + y * w] ||
              !a[x + (y - 1) * w] || !a[x + (y + 1) * w]) edge.push(x + y * w);
        }
      for (const i of edge) this.lum[i] = v;
    }
  };
}

const Props = {
  cache: new Map(),

  /* 바닥·벽과 톤이 겹쳐 묻히는 물체들. 실루엣 둘레를 어둡게 따 준다.
     빛을 내는 것(lamp/bulb)과 이어 붙는 것(pipe)·바닥 얼룩(puddle)은 제외. */
  RIMMED: new Set(['bench', 'rock', 'bin', 'drum', 'crate', 'pallet', 'sign', 'table',
                   'chair', 'bed', 'cabinet', 'shelf', 'plant', 'boiler', 'barrel', 'stairs']),

  get(name, variant = 0) {
    const k = name + variant;
    let p = this.cache.get(k);
    if (p === undefined) {
      const fn = this.DEF[name];
      p = fn ? fn(Tiles.rng(variant * 3163 + name.length * 977 + name.charCodeAt(0))) : null;
      if (p && this.RIMMED.has(name)) p.rim(0.04);
      this.cache.set(k, p);
    }
    return p;
  },

  /* 이미 열어본 상자·옷장. 속을 파내고 입구 테두리를 밝혀
     "여기는 봤다" 를 한눈에 알 수 있게 한다. */
  getOpen(name, variant = 0) {
    const k = 'open|' + name + variant;
    let p = this.cache.get(k);
    if (p !== undefined) return p;

    const base = this.get(name, variant);
    if (!base) { this.cache.set(k, null); return null; }

    const w = base.w, h = base.h;
    p = { w, h, ax: base.ax, ay: base.ay, light: base.light,
          lum: Float32Array.from(base.lum), a: Uint8Array.from(base.a) };

    const x0 = 3, x1 = w - 3;
    const y0 = Math.round(h * 0.22), y1 = h - 3;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = x + y * w;
        if (p.a[i]) p.lum[i] = 0.02;
      }
    // 열린 입구의 안쪽 테두리
    for (let x = x0 - 1; x < x1 + 1; x++) {
      const i = x + (y0 - 1) * w;
      if (p.a[i]) p.lum[i] = 0.72;
    }
    for (let y = y0 - 1; y < y1; y++) {
      for (const x of [x0 - 1, x1]) {
        const i = x + y * w;
        if (p.a[i]) p.lum[i] = 0.5;
      }
    }
    this.cache.set(k, p);
    return p;
  },

  DEF: {
    /* ================= 공원 ================= */
    tree(rnd) {
      const b = PBuf(28, 38); b.ax = 14; b.ay = 37;
      // 줄기
      b.rect(12, 22, 4, 16, 0.30);
      b.vl(12, 22, 16, 0.46); b.vl(15, 22, 16, 0.13);
      b.hl(11, 37, 6, 0.05);
      // 가지
      b.set(11, 24, 0.30); b.set(10, 23, 0.30); b.set(16, 25, 0.30); b.set(17, 24, 0.30);
      // 수관 : 한 겹 크게 깔아 어두운 테두리를 만들고, 그 안에 밝은 잎을 채운다
      const blobs = [[14, 12, 13, 10], [8, 15, 7, 6], [20, 15, 7, 6], [14, 6, 9, 6]];
      for (const [cx, cy, rx, ry] of blobs) b.ell(cx, cy, rx + 1, ry + 1, 0.03);
      for (const [cx, cy, rx, ry] of blobs) b.ell(cx, cy, rx, ry, 0.40);
      // 잎 덩어리 : 큰 반점으로 뭉쳐야 노이즈가 아니라 잎으로 읽힌다
      for (let i = 0; i < 40; i++) {
        const x = (rnd() * 28) | 0, y = (rnd() * 23) | 0;
        if (!b.a[x + y * 28]) continue;
        const up = 1 - y / 23;
        const v = rnd() < 0.32 + up * 0.36 ? 0.66 + up * 0.28 : 0.18;
        const r = 1 + ((rnd() * 2) | 0);
        for (let oy = -r; oy <= r; oy++)
          for (let ox = -r; ox <= r; ox++)
            if (ox * ox + oy * oy <= r * r) b.over(x + ox, y + oy, v);
      }
      // 아래쪽 그림자
      for (let x = 0; x < 28; x++) for (let y = 18; y < 23; y++) b.over(x, y, 0.14);
      b.rim(0.03);
      // 줄기는 테두리 처리 뒤에 다시 세워 준다
      b.rect(12, 22, 4, 16, 0.44);
      b.vl(12, 22, 16, 0.62); b.vl(15, 22, 16, 0.16);
      b.hl(11, 37, 6, 0.03);
      return b;
    },

    bush(rnd) {
      const b = PBuf(18, 12); b.ax = 9; b.ay = 11;
      b.ell(9, 7, 9, 6, 0.03);
      b.ell(9, 7, 8, 5, 0.38);
      for (let i = 0; i < 16; i++) {
        const x = (rnd() * 18) | 0, y = (rnd() * 11) | 0;
        if (!b.a[x + y * 18]) continue;
        const v = rnd() < 0.42 ? 0.68 : 0.18;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) b.over(x + ox, y + oy, v);
      }
      b.rim(0.03);
      b.hl(3, 11, 12, 0.03);
      return b;
    },

    bench(rnd) {
      const b = PBuf(30, 18); b.ax = 15; b.ay = 17;
      // 등받이
      b.rect(2, 0, 26, 2, 0.62); b.rect(2, 3, 26, 2, 0.62);
      b.vl(4, 0, 8, 0.44); b.vl(25, 0, 8, 0.44);
      // 좌판
      b.rect(1, 7, 28, 2, 0.72);
      b.rect(1, 10, 28, 2, 0.58);
      b.hl(1, 12, 28, 0.18);
      // 다리
      b.rect(3, 12, 3, 5, 0.40); b.rect(24, 12, 3, 5, 0.40);
      b.hl(2, 17, 26, 0.04);
      return b;
    },

    rock(rnd) {
      const b = PBuf(14, 10); b.ax = 7; b.ay = 9;
      b.ell(7, 6, 6, 4, 0.34);
      for (let i = 0; i < 30; i++) {
        const x = (rnd() * 14) | 0, y = (rnd() * 10) | 0;
        if (b.a[x + y * 14]) b.over(x, y, y < 5 ? 0.52 : 0.20);
      }
      b.hl(2, 9, 10, 0.05);
      return b;
    },

    /* 가로등 : 빛을 낸다 */
    lamp(rnd) {
      const b = PBuf(12, 40); b.ax = 6; b.ay = 39;
      b.rect(5, 8, 2, 30, 0.52);          // 기둥
      b.vl(5, 8, 30, 0.66);
      b.rect(3, 37, 6, 2, 0.40);          // 받침
      b.hl(2, 39, 8, 0.05);
      // 등갓
      b.rect(2, 2, 8, 2, 0.62);
      b.rect(1, 1, 10, 1, 0.44);
      b.rect(3, 4, 6, 4, 1.0);            // 유리
      b.rect(4, 8, 4, 1, 0.80);
      b.set(3, 4, 0.7); b.set(8, 4, 0.7);
      b.light = { dx: 0, dy: -33, r: 62, i: 0.62 };
      return b;
    },

    /* ================= 골목 ================= */
    bin(rnd) {
      const b = PBuf(16, 20); b.ax = 8; b.ay = 19;
      b.rect(2, 4, 12, 15, 0.34);
      b.vl(2, 4, 15, 0.50); b.vl(3, 4, 15, 0.46);
      b.vl(12, 4, 15, 0.18); b.vl(13, 4, 15, 0.14);
      for (let y = 6; y < 19; y += 4) b.hl(2, y, 12, 0.24);
      b.rect(1, 2, 14, 2, 0.56);          // 뚜껑
      b.rect(6, 0, 4, 2, 0.48);           // 손잡이
      b.hl(2, 19, 12, 0.04);
      return b;
    },

    drum(rnd) {
      const b = PBuf(16, 22); b.ax = 8; b.ay = 21;
      b.rect(2, 3, 12, 18, 0.30);
      b.vl(2, 3, 18, 0.46); b.vl(3, 3, 18, 0.42);
      b.vl(13, 3, 18, 0.14);
      b.rect(1, 6, 14, 2, 0.50);          // 밴드
      b.rect(1, 15, 14, 2, 0.50);
      b.rect(2, 1, 12, 2, 0.44);          // 상단
      b.ell(8, 2, 6, 2, 0.40);
      for (let i = 0; i < 20; i++) { const x = (rnd() * 16) | 0, y = 4 + ((rnd() * 16) | 0); b.over(x, y, 0.16); }
      b.hl(2, 21, 12, 0.04);
      return b;
    },

    crate(rnd) {
      const b = PBuf(18, 16); b.ax = 9; b.ay = 15;
      b.rect(1, 1, 16, 14, 0.44);
      b.rect(2, 2, 14, 12, 0.34);
      b.hl(1, 1, 16, 0.60); b.vl(1, 1, 14, 0.56);
      b.hl(1, 14, 16, 0.14); b.vl(16, 1, 14, 0.16);
      for (let i = 0; i < 12; i++) {       // 대각 보강재
        b.set(3 + i, 3 + i, 0.58); b.set(14 - i, 3 + i, 0.58);
      }
      b.hl(1, 15, 16, 0.04);
      return b;
    },

    pallet(rnd) {
      const b = PBuf(22, 10); b.ax = 11; b.ay = 9;
      for (let y = 0; y < 6; y += 2) b.rect(0, y, 22, 1, 0.48);
      b.rect(0, 6, 22, 2, 0.30);
      b.vl(1, 0, 8, 0.56); b.vl(20, 0, 8, 0.56);
      b.hl(0, 9, 22, 0.05);
      return b;
    },

    sign(rnd) {
      const b = PBuf(24, 16); b.ax = 12; b.ay = 15;
      b.rect(0, 0, 3, 3, 0.44);            // 브래킷
      b.rect(2, 1, 20, 1, 0.44);
      b.rect(3, 2, 18, 11, 0.14);          // 판
      b.hl(3, 2, 18, 0.62); b.hl(3, 12, 18, 0.34);
      b.vl(3, 2, 11, 0.50); b.vl(20, 2, 11, 0.30);
      for (let i = 0; i < 3; i++) b.rect(6 + i * 4, 6, 3, 3, 0.78);   // 글자 자국
      return b;
    },

    /* ================= 실내 ================= */
    table(rnd) {
      const b = PBuf(30, 18); b.ax = 15; b.ay = 17;
      b.rect(0, 2, 30, 6, 0.56);           // 상판
      b.hl(0, 2, 30, 0.72);
      b.hl(0, 7, 30, 0.28);
      b.rect(2, 8, 3, 9, 0.34); b.rect(25, 8, 3, 9, 0.34);
      for (let i = 0; i < 40; i++) { const x = (rnd() * 30) | 0; b.over(x, 3 + ((rnd() * 4) | 0), 0.50); }
      b.hl(1, 17, 28, 0.04);
      return b;
    },

    chair(rnd) {
      const b = PBuf(14, 20); b.ax = 7; b.ay = 19;
      b.rect(2, 0, 10, 8, 0.42);           // 등받이
      b.rect(3, 2, 8, 2, 0.20); b.rect(3, 5, 8, 1, 0.20);
      b.rect(1, 9, 12, 3, 0.58);           // 좌판
      b.hl(1, 12, 12, 0.20);
      b.rect(2, 12, 2, 7, 0.34); b.rect(10, 12, 2, 7, 0.34);
      b.hl(1, 19, 12, 0.04);
      return b;
    },

    bed(rnd) {
      const b = PBuf(26, 38); b.ax = 13; b.ay = 37;
      b.rect(1, 0, 24, 4, 0.52);           // 머리판
      b.rect(2, 4, 22, 30, 0.30);          // 프레임
      b.rect(3, 5, 20, 12, 0.74);          // 베개/이불 윗부분
      b.rect(3, 17, 20, 15, 0.46);         // 이불
      for (let y = 19; y < 32; y += 3) b.hl(4, y, 18, 0.34);
      b.hl(3, 16, 20, 0.22);
      b.rect(2, 34, 22, 2, 0.24);
      b.hl(2, 37, 22, 0.04);
      return b;
    },

    cabinet(rnd) {
      const b = PBuf(18, 28); b.ax = 9; b.ay = 27;
      b.rect(0, 0, 18, 26, 0.58);
      b.rect(1, 1, 16, 24, 0.18);
      b.vl(9, 1, 24, 0.05);                // 문 사이
      b.hl(0, 0, 18, 0.76);
      for (let y = 4; y < 24; y += 7) b.hl(1, y, 16, 0.34);
      b.set(7, 13, 0.95); b.set(11, 13, 0.95);   // 손잡이
      b.rect(0, 26, 18, 1, 0.16);
      b.hl(1, 27, 16, 0.04);
      return b;
    },

    shelf(rnd) {
      const b = PBuf(28, 24); b.ax = 14; b.ay = 23;
      b.rect(0, 0, 28, 22, 0.16);
      b.vl(0, 0, 22, 0.50); b.vl(27, 0, 22, 0.50);
      for (let y = 0; y < 22; y += 7) b.hl(0, y, 28, 0.54);
      // 잡동사니
      for (let s = 0; s < 3; s++) {
        const y = s * 7;
        let x = 2 + ((rnd() * 4) | 0);
        while (x < 24) {
          const w = 2 + ((rnd() * 3) | 0), h = 3 + ((rnd() * 3) | 0);
          b.rect(x, y - h, w, h, 0.30 + rnd() * 0.35);
          x += w + 1 + ((rnd() * 3) | 0);
        }
      }
      b.hl(1, 23, 26, 0.04);
      return b;
    },

    plant(rnd) {
      const b = PBuf(16, 24); b.ax = 8; b.ay = 23;
      b.rect(4, 16, 8, 7, 0.42);           // 화분
      b.hl(3, 15, 10, 0.58);
      b.hl(4, 23, 8, 0.05);
      for (let i = 0; i < 9; i++) {        // 잎
        const a2 = -Math.PI / 2 + (i - 4) * 0.28;
        const len = 8 + rnd() * 6;
        for (let t = 0; t < len; t++)
          b.set(8 + Math.cos(a2) * t, 16 + Math.sin(a2) * t, t > len - 3 ? 0.16 : 0.30);
      }
      return b;
    },

    /* ================= 지하 ================= */
    boiler(rnd) {
      const b = PBuf(34, 40); b.ax = 17; b.ay = 39;
      b.rect(4, 6, 26, 32, 0.26);          // 몸통
      b.vl(4, 6, 32, 0.44); b.vl(5, 6, 32, 0.40);
      b.vl(28, 6, 32, 0.12); b.vl(29, 6, 32, 0.10);
      b.ell(17, 7, 13, 4, 0.34);           // 상단 곡면
      for (let y = 12; y < 38; y += 9) b.rect(3, y, 28, 2, 0.46);   // 밴드
      // 배관
      b.rect(8, 0, 3, 7, 0.44); b.rect(23, 0, 3, 7, 0.44);
      b.rect(8, 0, 18, 2, 0.44);
      // 계기판 + 손잡이
      b.ell(17, 22, 4, 4, 0.72);
      b.ell(17, 22, 3, 3, 0.10);
      b.set(17, 22, 0.9); b.set(18, 20, 0.9); b.set(19, 21, 0.9);
      b.rect(11, 30, 12, 5, 0.16);
      b.hl(11, 30, 12, 0.40);
      b.rect(2, 38, 30, 1, 0.12);
      b.hl(3, 39, 28, 0.04);
      return b;
    },

    barrel(rnd) {
      const b = PBuf(16, 20); b.ax = 8; b.ay = 19;
      b.ell(8, 10, 7, 9, 0.28);
      b.vl(2, 6, 9, 0.44); b.vl(3, 5, 11, 0.40);
      b.vl(13, 6, 9, 0.12);
      b.rect(1, 7, 14, 1, 0.48); b.rect(1, 13, 14, 1, 0.48);
      b.ell(8, 2, 6, 2, 0.38);
      b.hl(2, 19, 12, 0.04);
      return b;
    },

    pipeV(rnd) {
      const b = PBuf(10, 16); b.ax = 5; b.ay = 15;
      b.rect(2, 0, 6, 16, 0.30);
      b.vl(2, 0, 16, 0.52); b.vl(3, 0, 16, 0.44);
      b.vl(7, 0, 16, 0.12);
      b.rect(1, 4, 8, 2, 0.46);            // 이음 플랜지
      b.rect(1, 12, 8, 2, 0.46);
      return b;
    },

    pipeH(rnd) {
      const b = PBuf(16, 10); b.ax = 8; b.ay = 9;
      b.rect(0, 2, 16, 6, 0.30);
      b.hl(0, 2, 16, 0.52); b.hl(0, 3, 16, 0.44);
      b.hl(0, 7, 16, 0.12);
      b.rect(4, 1, 2, 8, 0.46);
      b.rect(11, 1, 2, 8, 0.46);
      return b;
    },

    puddle(rnd) {
      const b = PBuf(24, 10); b.ax = 12; b.ay = 9;
      b.ell(12, 5, 11, 4, 0.06);
      for (let i = 0; i < 3; i++) {
        const y = 3 + i * 2, x = 4 + ((rnd() * 6) | 0), w = 6 + ((rnd() * 8) | 0);
        for (let k = 0; k < w; k++) b.over(x + k, y, 0.42);
      }
      return b;
    },

    /* 매달린 전구 : 빛을 낸다 */
    bulb(rnd) {
      const b = PBuf(8, 26); b.ax = 4; b.ay = 25;
      b.vl(4, 0, 17, 0.34);                // 전선
      b.rect(3, 17, 3, 3, 0.46);           // 소켓
      b.ell(4, 23, 3, 3, 1.0);
      b.set(3, 21, 0.7);
      b.light = { dx: 0, dy: -2, r: 58, i: 0.66 };
      return b;
    },

    stairs(rnd) {
      const b = PBuf(34, 26); b.ax = 17; b.ay = 25;
      for (let i = 0; i < 6; i++) {
        const y = i * 4;
        const inset = i;
        b.rect(inset, y, 34 - inset * 2, 3, 0.14 + i * 0.10);
        b.hl(inset, y, 34 - inset * 2, 0.30 + i * 0.11);
        b.hl(inset, y + 3, 34 - inset * 2, 0.05);
      }
      b.vl(0, 0, 26, 0.52); b.vl(33, 0, 26, 0.52);
      return b;
    }
  }
};
