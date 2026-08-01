/* -------------------------------------------------------------------------
   Tiles : 테마별 16x16 타일을 그려 캐시한다.
   같은 (테마, 종류, 이웃마스크, 변형) 조합은 한 번만 그린다.

   mask 비트 : 1=위가 바닥, 2=오른쪽, 4=아래, 8=왼쪽
   아래가 바닥인 벽은 "정면(face)" 을 그린다 — 위에서 내려다보는 화면에
   건물 입면이 살짝 보이는 방식. 이것이 구조물처럼 읽히게 하는 핵심이다.
------------------------------------------------------------------------- */
const Tiles = {
  SZ: 16,
  FACE: 9,             // 정면 높이
  cache: new Map(),

  get(theme, type, mask, variant) {
    const k = theme + type + mask + '_' + variant;
    let t = this.cache.get(k);
    if (t === undefined) { t = this.paint(theme, type, mask, variant); this.cache.set(k, t); }
    return t;
  },

  /* ---- 작은 그리기 도구 ---- */
  mk(v) { const a = new Float32Array(256); if (v) a.fill(v); return a; },
  st(a, x, y, v) { if (x < 0 || y < 0 || x > 15 || y > 15) return; a[x + y * 16] = v; },
  rc(a, x, y, w, h, v) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.st(a, xx, yy, v);
  },
  hl(a, x, y, w, v) { this.rc(a, x, y, w, 1, v); },
  vl(a, x, y, h, v) { this.rc(a, x, y, 1, h, v); },

  rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /* =================================================================== */
  paint(theme, type, mask, variant) {
    const a = this.mk(0);
    const rnd = this.rng(variant * 7919 + type.charCodeAt(0) * 131 + theme.charCodeAt(1) * 17 + mask);
    const th = this.THEME[theme] || this.THEME.alley;

    switch (type) {
      case 'floor':  this.floor(a, rnd, th, mask); break;
      case 'grass':  this.grass(a, rnd, th); break;
      case 'water':  this.water(a, rnd, th, mask); break;
      case 'curb':   this.curb(a, rnd, th, mask); break;
      case 'fence':  this.fence(a, rnd, th, mask); break;
      case 'door':   this.door(a, rnd, th, mask); break;
      case 'gate':   this.gate(a, rnd, th, mask, false); break;
      case 'gateOpen': this.gate(a, rnd, th, mask, true); break;
      case 'window': this.wall(a, rnd, th, mask, true); break;
      default:       this.wall(a, rnd, th, mask, false); break;
    }
    return a;
  },

  /* ---- 테마 팔레트 / 재질 파라미터 ---- */
  THEME: {
    park: {
      floorBase: 0.38, floorSpeck: [0.54, 0.24], floorKind: 'gravel',
      wallKind: 'brick',
      wallBase: 0.46, wallMortar: 0.28, faceBase: 0.68, faceMortar: 0.42,
      cap: 0.92, brickW: 8, brickH: 4
    },
    alley: {
      floorBase: 0.26, floorSpeck: [0.36, 0.16], floorKind: 'asphalt',
      wallKind: 'brick',
      wallBase: 0.46, wallMortar: 0.28, faceBase: 0.66, faceMortar: 0.40,
      cap: 0.88, brickW: 8, brickH: 4
    },
    house: {
      floorBase: 0.32, floorSpeck: [0.40, 0.26], floorKind: 'plank',
      wallKind: 'stripe', baseboard: true,
      wallBase: 0.60, wallMortar: 0.48, faceBase: 0.74, faceMortar: 0.60,
      cap: 0.92, brickW: 16, brickH: 16
    },
    cellar: {
      floorBase: 0.22, floorSpeck: [0.32, 0.12], floorKind: 'concrete',
      wallKind: 'stone',
      wallBase: 0.42, wallMortar: 0.20, faceBase: 0.62, faceMortar: 0.30,
      cap: 0.80, brickW: 6, brickH: 5
    }
  },

  /* ---------------- 바닥 ---------------- */
  floor(a, rnd, th, mask) {
    const b = th.floorBase;
    for (let i = 0; i < 256; i++) a[i] = b + (rnd() - 0.5) * 0.05;

    if (th.floorKind === 'gravel') {
      for (let i = 0; i < 26; i++) {
        const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
        const v = rnd() < 0.55 ? th.floorSpeck[0] : th.floorSpeck[1];
        this.st(a, x, y, v);
        if (rnd() < 0.4) this.st(a, x + 1, y, v);
      }
    } else if (th.floorKind === 'asphalt') {
      for (let i = 0; i < 40; i++) {
        const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
        this.st(a, x, y, rnd() < 0.5 ? th.floorSpeck[0] : th.floorSpeck[1]);
      }
      if (rnd() < 0.35) {                 // 갈라진 틈
        let x = (rnd() * 14) | 0, y = 0;
        while (y < 16) { this.st(a, x, y, 0.06); y++; if (rnd() < 0.4) x += rnd() < 0.5 ? 1 : -1; }
      }
    } else if (th.floorKind === 'plank') {
      // 널을 8px 폭으로 두고 이음새 대비를 낮춘다.
      // 4px + 강한 이음새는 방 전체가 줄무늬로 읽혀 가구를 덮어버린다.
      for (let y = 0; y < 16; y++) {
        const shade = b + ((y >> 3) & 1 ? 0.022 : -0.022);
        for (let x = 0; x < 16; x++) a[x + y * 16] = shade + (rnd() - 0.5) * 0.025;
      }
      for (let y = 0; y < 16; y += 8) this.hl(a, 0, y, 16, b * 0.74);
      if (rnd() < 0.45) {                            // 널 끝단(맞댐)
        const seam = (rnd() * 16) | 0;
        this.vl(a, seam, (rnd() < 0.5 ? 0 : 8), 8, b * 0.78);
      }
    } else {                                // concrete
      for (let i = 0; i < 18; i++) {
        const x = (rnd() * 14) | 0, y = (rnd() * 14) | 0;
        const v = rnd() < 0.5 ? th.floorSpeck[0] : th.floorSpeck[1];
        this.rc(a, x, y, 1 + ((rnd() * 3) | 0), 1 + ((rnd() * 2) | 0), v);
      }
    }

    // 벽에 닿은 쪽은 그림자로 살짝 눌러 준다
    if (!(mask & 1)) for (let x = 0; x < 16; x++) { a[x] *= 0.55; a[x + 16] *= 0.78; }
    if (!(mask & 8)) for (let y = 0; y < 16; y++) { a[y * 16] *= 0.7; }
    if (!(mask & 2)) for (let y = 0; y < 16; y++) { a[15 + y * 16] *= 0.7; }
  },

  /* ---------------- 잔디 ---------------- */
  grass(a, rnd, th) {
    // 잔디는 어두운 대역을 지킨다. 나무·덤불이 이 위에서 떠 보여야 하기 때문.
    for (let i = 0; i < 256; i++) a[i] = 0.13 + (rnd() - 0.5) * 0.04;
    for (let i = 0; i < 34; i++) {                 // 풀 포기
      const x = (rnd() * 16) | 0, y = (rnd() * 15) | 0;
      const v = 0.22 + rnd() * 0.12;
      this.st(a, x, y, v); this.st(a, x, y + 1, v * 0.8);
      if (rnd() < 0.4) this.st(a, x + 1, y + 1, v * 0.7);
    }
  },

  /* ---------------- 물 ---------------- */
  water(a, rnd, th, mask) {
    for (let i = 0; i < 256; i++) a[i] = 0.08 + (rnd() - 0.5) * 0.03;
    for (let y = 1; y < 16; y += 4) {
      const off = (rnd() * 5) | 0, len = 5 + ((rnd() * 7) | 0);
      this.hl(a, off, y, len, 0.42);
      this.hl(a, off + 1, y + 1, Math.max(2, len - 3), 0.22);
    }
    if (!(mask & 1)) this.hl(a, 0, 0, 16, 0.5);      // 물가 반짝임
    if (!(mask & 4)) this.hl(a, 0, 15, 16, 0.34);
  },

  /* ---------------- 연석 ---------------- */
  curb(a, rnd, th, mask) {
    this.rc(a, 0, 0, 16, 16, 0.46);
    for (let i = 0; i < 20; i++) this.st(a, (rnd() * 16) | 0, (rnd() * 16) | 0, 0.52);
    this.hl(a, 0, 0, 16, 0.66);
    this.hl(a, 0, 15, 16, 0.16);
    for (let x = 0; x < 16; x += 8) this.vl(a, x, 0, 16, 0.30);
  },

  /* ---------------- 울타리 ---------------- */
  fence(a, rnd, th, mask) {
    const y0 = 4;
    for (let x = 1; x < 16; x += 3) {
      this.vl(a, x, y0, 11, 0.72);
      this.st(a, x, y0 - 1, 0.86);
      this.vl(a, x + 1, y0, 11, 0.34);
    }
    this.hl(a, 0, y0 + 2, 16, 0.60);
    this.hl(a, 0, y0 + 8, 16, 0.60);
    this.hl(a, 0, 15, 16, 0.05);
  },

  /* ---------------- 문(목표) ---------------- */
  door(a, rnd, th, mask) {
    this.wall(a, rnd, th, mask | 4, false);        // 정면이 있는 벽으로 깔고
    const fy = 16 - this.FACE;
    this.rc(a, 2, fy - 2, 12, 18, 0.10);           // 문틀 안쪽 어둠
    this.rc(a, 2, fy - 2, 12, 1, th.cap);          // 상인방
    this.vl(a, 2, fy - 2, 18, 0.86);
    this.vl(a, 13, fy - 2, 18, 0.86);
    this.rc(a, 4, fy, 8, 16, 0.30);                // 문짝
    this.hl(a, 4, fy + 1, 8, 0.44);
    this.hl(a, 4, fy + 5, 8, 0.44);
    this.rc(a, 5, fy + 2, 6, 3, 0.20);
    this.st(a, 10, fy + 4, 0.95);                  // 손잡이
    this.st(a, 10, fy + 5, 0.72);
  },

  /* ---------------- 철문 ----------------
     통로를 가로막는 쇠창살. 열리면 창살이 양옆으로 접히고 바닥이 드러난다.
     닫혀 있을 때도 살 사이로 건너편이 비쳐야 "지나갈 수 있는 곳" 으로 읽힌다. */
  gate(a, rnd, th, mask, open) {
    // 바닥을 먼저 깔고 그 위에 쇠를 세운다
    this.floor(a, rnd, th, 15);

    const bar = 0.86, dark = 0.02, frame = 0.62;

    if (open) {
      // 접힌 창살 — 양쪽 벽에 붙어 있다
      for (const x of [0, 1, 14, 15]) this.vl(a, x, 0, 16, bar * 0.7);
      this.vl(a, 2, 0, 16, 0.30); this.vl(a, 13, 0, 16, 0.30);
      this.hl(a, 0, 0, 16, frame * 0.5);
      this.hl(a, 0, 15, 16, 0.05);
      return;
    }

    // 문틀
    this.vl(a, 0, 0, 16, frame);
    this.vl(a, 15, 0, 16, frame);
    // 세로 창살 : 살 옆에 그림자를 붙여 두께를 만든다
    for (let x = 2; x < 15; x += 4) {
      this.vl(a, x, 0, 16, bar);
      this.vl(a, x + 1, 0, 16, dark);
    }
    // 가로 띠
    for (const y of [3, 12]) {
      this.hl(a, 0, y, 16, bar * 0.9);
      this.hl(a, 0, y + 1, 16, dark);
    }
    // 자물쇠 — 살 한가운데 걸린 덩어리
    this.rc(a, 6, 6, 4, 5, 0.16);
    this.hl(a, 6, 6, 4, 0.95);
    this.vl(a, 6, 6, 5, 0.72);
    this.rc(a, 7, 4, 2, 2, 0.80);
    this.st(a, 8, 8, 0.04);
    // 녹
    for (let i = 0; i < 14; i++) this.st(a, (rnd() * 16) | 0, (rnd() * 16) | 0, 0.24);
  },

  /* 벽면 한 구간을 재질에 맞춰 칠한다 */
  wallSurface(a, rnd, th, y0, y1, base, line) {
    const kind = th.wallKind || 'brick';
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < 16; x++) {
        let v;
        if (kind === 'stripe') {                       // 벽지 : 가는 세로 줄
          v = (x % 5 === 0) ? line : base;
          if (x % 5 === 1) v = base * 1.08;
        } else if (kind === 'stone') {                 // 거친 석조 : 블록마다 명도가 다르다
          const bxi = ((x + ((y / th.brickH) | 0) * 3) / th.brickW) | 0;
          const byi = (y / th.brickH) | 0;
          const h = ((bxi * 73856093) ^ (byi * 19349663)) >>> 0;
          const bx = ((x + ((y / th.brickH) | 0) * 3) % th.brickW);
          const edge = (y % th.brickH === 0) || (bx === 0);
          v = edge ? line : base * (0.8 + (h % 100) / 250);
        } else {                                       // 벽돌
          const bx = ((x + ((y / th.brickH) | 0) * (th.brickW >> 1)) % th.brickW);
          const edge = (y % th.brickH === 0) || (bx === 0);
          v = edge ? line : base;
        }
        a[x + y * 16] = v + (rnd() - 0.5) * 0.05;
      }
    }
  },

  /* ---------------- 벽 ---------------- */
  wall(a, rnd, th, mask, hasWindow) {
    const faceH = (mask & 4) ? this.FACE : 0;
    const topH = 16 - faceH;

    /* --- 윗면(지붕/벽 상판) --- */
    this.wallSurface(a, rnd, th, 0, topH, th.wallBase, th.wallMortar);
    if (mask & 1) { this.hl(a, 0, 0, 16, th.cap * 0.75); this.hl(a, 0, 1, 16, th.wallBase * 1.15); }
    if (mask & 8) this.vl(a, 0, 0, topH, th.wallBase * 1.25);
    if (mask & 2) this.vl(a, 15, 0, topH, th.wallBase * 0.7);

    if (!faceH) return;

    /* --- 정면(입면) --- */
    this.hl(a, 0, topH - 1, 16, th.cap);              // 처마 / 갓돌
    this.wallSurface(a, rnd, th, topH, 15, th.faceBase, th.faceMortar);
    if (th.baseboard) {                               // 걸레받이
      this.rc(a, 0, 12, 16, 3, th.cap * 0.95);
      this.hl(a, 0, 12, 16, th.cap);
    }
    this.hl(a, 0, 15, 16, 0.03);                      // 바닥 접지 그림자

    if (hasWindow) {
      const wy = topH + 1;
      this.rc(a, 3, wy, 10, 6, 0.06);                 // 창틀 안쪽
      this.rc(a, 4, wy + 1, 8, 4, 0.90);              // 유리
      this.vl(a, 8, wy + 1, 4, 0.10);                 // 창살
      this.hl(a, 4, wy + 2, 8, 0.10);
      this.rc(a, 2, wy - 1, 12, 1, th.cap);           // 인방
      this.rc(a, 2, wy + 6, 12, 1, th.cap * 0.8);     // 창대
      this.st(a, 4, wy + 1, 0.55); this.st(a, 11, wy + 4, 0.55);
    }
  }
};
