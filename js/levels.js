/* -------------------------------------------------------------------------
   Levels : 손으로 구성한 레벨 청사진.
   무작위 미로가 아니라, 직사각형 단위로 직접 배치한 공간이다.
     · park   공원  — 산책로 / 연석 / 잔디 / 연못 / 가로등
     · alley  골목  — 도시 블록. 건물 덩어리 사이의 골목과 뒷길
     · house  실내  — 중앙 복도와 네 개의 방
     · cellar 지하  — 석조 챔버들과 통로, 보일러실
------------------------------------------------------------------------- */

const TT = {
  VOID: 0, WALL: 1, FLOOR: 2, GRASS: 3, WATER: 4, CURB: 5, FENCE: 6, DOOR: 7, WINDOW: 8,
  GATE: 9, GATE_OPEN: 10
};
const TT_NAME = ['void', 'wall', 'floor', 'grass', 'water', 'curb', 'fence', 'door', 'window',
                 'gate', 'gateOpen'];
const TT_WALK = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1];

const LEVEL_DEF = {

  /* ===================== 공원 (도입 연출) ===================== */
  park: {
    theme: 'park', W: 78, H: 18, fill: TT.GRASS, windows: false,
    ops: [
      ['r', 0, 0, 78, 2, TT.WALL],           // 위쪽 담장
      ['r', 0, 16, 78, 2, TT.WALL],          // 아래쪽 담장
      ['r', 0, 0, 1, 18, TT.WALL],
      ['r', 77, 0, 1, 18, TT.WALL],
      ['r', 1, 6, 76, 1, TT.CURB],           // 산책로 연석
      ['r', 1, 11, 76, 1, TT.CURB],
      ['r', 1, 7, 76, 4, TT.FLOOR],          // 산책로
      ['r', 20, 2, 3, 5, TT.FLOOR],          // 위쪽 샛길
      ['r', 20, 6, 3, 1, TT.FLOOR],
      ['r', 55, 12, 3, 4, TT.FLOOR],         // 아래쪽 샛길
      ['r', 55, 11, 3, 1, TT.FLOOR],
      ['r', 30, 12, 14, 4, TT.WATER],        // 연못
      ['r', 29, 13, 1, 2, TT.WATER],
      ['r', 44, 13, 1, 2, TT.WATER],
      ['r', 8, 2, 4, 3, TT.FENCE],           // 잔디밭 울타리 조각
      ['r', 62, 13, 5, 1, TT.FENCE]
    ],
    props: [
      ['lamp', 5, 6], ['lamp', 17, 6], ['lamp', 29, 6], ['lamp', 41, 6],
      ['lamp', 53, 6], ['lamp', 65, 6], ['lamp', 74, 6],
      ['lamp', 11, 11], ['lamp', 26, 11], ['lamp', 48, 11], ['lamp', 70, 11],
      ['tree', 4, 5], ['tree', 14, 4], ['tree', 25, 5], ['tree', 33, 4],
      ['tree', 45, 5], ['tree', 52, 4], ['tree', 60, 5], ['tree', 71, 4],
      ['tree', 6, 15], ['tree', 19, 15], ['tree', 26, 14], ['tree', 50, 15],
      ['tree', 60, 15], ['tree', 68, 14], ['tree', 75, 15],
      ['bench', 8, 12], ['bench', 22, 12], ['bench', 47, 12], ['bench', 64, 12],
      ['bench', 35, 5], ['bench', 58, 5],
      ['bush', 3, 12], ['bush', 12, 13], ['bush', 17, 12], ['bush', 28, 3],
      ['bush', 39, 12], ['bush', 56, 13], ['bush', 66, 12], ['bush', 73, 12],
      ['bush', 21, 3], ['bush', 44, 4], ['bush', 63, 3],
      ['rock', 10, 14], ['rock', 46, 15], ['rock', 29, 15], ['rock', 69, 13]
    ],
    start: [3, 8]
  },

  /* ===================== 골목 (1) =====================
     시작은 오른쪽 아래, 문은 왼쪽 위 뒷골목. 대각선으로 가로지르게 만든다. */
  alley: {
    theme: 'alley', W: 46, H: 32, fill: TT.WALL, windows: true,
    mins: { trace: 2, dread: 2 },        // 절제. 대부분 비어 있다는 것을 먼저 학습시킨다
    title: '하나 · 골 목',
    lines: [
      '고양이가 사라진 골목.',
      '창문은 전부 꺼져 있고, 어느 집도 이쪽을 내다보지 않는다.'
    ],
    ops: [
      // 블록을 둘러싼 길
      ['r', 1, 1, 44, 3, TT.FLOOR],
      ['r', 1, 28, 44, 3, TT.FLOOR],
      ['r', 1, 1, 3, 30, TT.FLOOR],
      ['r', 42, 1, 3, 30, TT.FLOOR],
      // 가로 골목
      ['r', 4, 9, 38, 2, TT.FLOOR],
      ['r', 4, 18, 38, 2, TT.FLOOR],
      // 세로 골목
      ['r', 10, 4, 2, 24, TT.FLOOR],
      ['r', 19, 4, 2, 14, TT.FLOOR],
      ['r', 27, 11, 2, 17, TT.FLOOR],
      ['r', 35, 4, 2, 24, TT.FLOOR],
      // 막다른 뒷길
      ['r', 23, 20, 2, 7, TT.FLOOR],       // 가로 골목(y18) 에서 아래로 파고드는 길
      ['r', 12, 12, 6, 2, TT.FLOOR],       // 세로 골목(x10)에서 갈라지는 뒷길 — 문이 여기 있다
      ['r', 30, 22, 5, 2, TT.FLOOR],
      // 철망으로 막힌 곳
      ['r', 10, 22, 2, 1, TT.FENCE],
      ['r', 35, 14, 2, 1, TT.FENCE],
      ['r', 19, 9, 2, 1, TT.FENCE],
      // 목표 : 뒷골목 막다른 곳의 문
      ['r', 14, 11, 1, 1, TT.DOOR]
    ],
    props: [
      // 목표 문(14,11) 근처에는 등을 두지 않는다 — 빛으로 알려주면 안 된다
      ['lamp', 6, 3, 1], ['lamp', 39, 3, 1], ['lamp', 6, 26, 1], ['lamp', 39, 26, 1],
      ['lamp', 24, 10, 1], ['lamp', 24, 29, 1],
      ['bin', 5, 8, 1], ['bin', 25, 3, 1], ['bin', 41, 17, 1], ['bin', 16, 30, 1],
      ['drum', 8, 10, 1], ['drum', 29, 27, 1], ['drum', 43, 9, 1], ['drum', 2, 20, 1],
      ['crate', 15, 13, 1], ['crate', 24, 26, 1], ['crate', 37, 19, 1], ['crate', 12, 19, 1],
      ['pallet', 17, 12], ['pallet', 33, 23], ['pallet', 22, 2],
      ['sign', 20, 30, 1], ['sign', 44, 24, 1], ['sign', 3, 12, 1]
    ],
    /* 처음부터 그 자리에 서 있는 것 */
    sentries: [[23, 24]],
    /* 무엇을 건드리면 어디에 서는가 — [수색 대상 tx,ty, 나타나는 tx,ty]
       확률도 무작위 위치도 없다. 같은 물건을 열면 언제나 같은 자리에 선다. */
    triggers: [
      [5, 8, 10, 10],
      [2, 20, 2, 26],
      [24, 26, 27, 22],
      [37, 19, 35, 25]
    ],
    start: [43, 29],
    goal: { t: 'door', x: 14, y: 11 }
  },

  /* ===================== 낡은 건물 (2) =====================
     지하로 내려가는 문은 잠겨 있다. 방 하나를 끝까지 뒤져 열쇠를 찾아야 열린다. */
  house: {
    theme: 'house', W: 46, H: 30, fill: TT.WALL, windows: true,
    mins: { trace: 3, dread: 3 },
    title: '둘 · 낡 은  건 물',
    lines: [
      '안쪽은 바깥보다 더 조용했다.',
      '누가 살다 나간 자리에 가구만 그대로 남아 있다.'
    ],
    lock: { need: 1, kind: 'key' },
    keyProps: [[42, 18]],                  // H 창고 방 옷장 안
    ops: [
      // 복도
      ['r', 21, 2, 3, 26, TT.FLOOR],         // 세로 복도
      ['r', 2, 13, 42, 3, TT.FLOOR],         // 가로 복도
      // 여덟 개의 방 (사이 벽은 fill 로 남는다)
      ['r', 2, 2, 9, 10, TT.FLOOR],          // A
      ['r', 12, 2, 8, 10, TT.FLOOR],         // B
      ['r', 26, 2, 9, 10, TT.FLOOR],         // C
      ['r', 36, 2, 8, 10, TT.FLOOR],         // D
      ['r', 2, 17, 9, 11, TT.FLOOR],         // E
      ['r', 12, 17, 8, 11, TT.FLOOR],        // F
      ['r', 26, 17, 9, 11, TT.FLOOR],        // G
      ['r', 36, 17, 8, 11, TT.FLOOR],        // H
      // 방과 방 사이 문
      ['r', 11, 6, 1, 2, TT.FLOOR],
      ['r', 35, 6, 1, 2, TT.FLOOR],
      ['r', 11, 21, 1, 2, TT.FLOOR],
      ['r', 35, 21, 1, 2, TT.FLOOR],
      // 방 ↔ 세로 복도
      ['r', 20, 5, 1, 2, TT.FLOOR],
      ['r', 24, 5, 1, 2, TT.FLOOR],
      ['r', 20, 21, 1, 2, TT.FLOOR],
      ['r', 24, 21, 1, 2, TT.FLOOR],
      // 방 ↔ 가로 복도
      ['r', 5, 12, 2, 1, TT.FLOOR],
      ['r', 15, 12, 2, 1, TT.FLOOR],
      ['r', 29, 12, 2, 1, TT.FLOOR],
      ['r', 39, 12, 2, 1, TT.FLOOR],
      ['r', 5, 16, 2, 1, TT.FLOOR],
      ['r', 15, 16, 2, 1, TT.FLOOR],
      ['r', 29, 16, 2, 1, TT.FLOOR],
      ['r', 37, 16, 2, 1, TT.FLOOR],
      // 목표 : 지하로 내려가는 문 (F 방 안쪽 — 아래 가운데)
      ['r', 13, 16, 1, 1, TT.DOOR]
    ],
    props: [
      // A 침실
      ['bed', 4, 5, 1], ['cabinet', 8, 4, 1], ['chair', 9, 10, 1], ['plant', 3, 11, 1],
      // B 식당
      ['table', 15, 6, 1], ['chair', 13, 8, 1], ['chair', 18, 8, 1], ['shelf', 17, 3, 1],
      // C 서재
      ['shelf', 28, 3, 1], ['table', 31, 8, 1], ['chair', 29, 11, 1], ['cabinet', 33, 5, 1],
      // D 창고
      ['crate', 38, 4, 1], ['crate', 41, 6, 1], ['shelf', 39, 11, 1], ['barrel', 37, 8, 1],
      // E
      ['bed', 4, 20, 1], ['cabinet', 9, 19, 1], ['plant', 3, 27, 1], ['chair', 7, 26, 1],
      // F
      ['table', 15, 21, 1], ['chair', 13, 23, 1], ['chair', 17, 25, 1], ['shelf', 18, 18, 1],
      // G
      ['cabinet', 28, 19, 1], ['bed', 31, 24, 1], ['plant', 33, 20, 1], ['chair', 27, 26, 1],
      // H — 열쇠는 이 방 옷장 안에 있다
      ['shelf', 38, 20, 1], ['crate', 41, 24, 1], ['table', 39, 27, 1],
      ['cabinet', 42, 18, 1],
      // 복도
      ['plant', 22, 4, 1], ['plant', 22, 26, 1], ['chair', 22, 11, 1],
      ['cabinet', 33, 14, 1], ['crate', 10, 14, 1],
      // 숨을 자리 — 방마다 하나씩. 쫓기기 전에 미리 봐 두어야 쓸모가 있다.
      ['locker', 2, 2, 1], ['locker', 26, 10, 1], ['locker', 36, 2, 1],
      ['locker', 2, 17, 1], ['locker', 12, 27, 1], ['locker', 43, 26, 1]
    ],
    sentries: [[30, 7]],
    triggers: [
      [42, 18, 41, 25]         // 열쇠가 든 옷장. 집어 드는 순간 방 안쪽에 선다
    ],
    start: [4, 4],
    goal: { t: 'door', x: 13, y: 16 }
  },

  /* ===================== 지하 (3) =====================
     계단은 오른쪽 위, 고양이는 왼쪽 아래 챔버에 있다.
     그 챔버로 가는 길은 철문 하나뿐이고, 철문의 자물쇠는 세 군데가 잠겨 있다.
     조각 셋을 다 모으기 전에는 어떤 길로도 넘어갈 수 없다. */
  cellar: {
    theme: 'cellar', W: 50, H: 30, fill: TT.WALL, windows: false,
    mins: { trace: 3, dread: 4 },        // 마지막 구간이 가장 조인다
    title: '셋 · 지 하',
    lines: [
      '계단은 아래로만 이어졌다.',
      '천장의 전구가 일정한 간격으로 하나씩 켜져 있다.'
    ],
    lock: { need: 3, kind: 'shard' },
    keyProps: [[12, 4], [23, 25], [37, 18]],   // 챔버1 / 보일러실 / 마지막 방
    ops: [
      ['r', 2, 2, 12, 9, TT.FLOOR],          // 챔버 1
      ['r', 18, 3, 14, 7, TT.FLOOR],         // 챔버 2
      ['r', 36, 2, 12, 10, TT.FLOOR],        // 챔버 3 — 계단이 있는 곳
      ['r', 3, 15, 13, 12, TT.FLOOR],        // 챔버 4 — 철문 너머. 고양이가 여기 있다
      ['r', 20, 14, 12, 13, TT.FLOOR],       // 보일러실
      ['r', 36, 16, 12, 11, TT.FLOOR],       // 마지막 방
      // 통로
      ['r', 14, 6, 4, 2, TT.FLOOR],
      ['r', 32, 5, 4, 2, TT.FLOOR],
      ['r', 24, 10, 3, 4, TT.FLOOR],
      ['r', 40, 12, 3, 4, TT.FLOOR],
      ['r', 16, 19, 4, 2, TT.FLOOR],
      ['r', 32, 20, 4, 2, TT.FLOOR],
      // 챔버 4 로 가는 유일한 길목을 철문으로 막는다
      ['r', 17, 19, 1, 2, TT.GATE],
      // 물 고인 수로
      ['r', 4, 24, 10, 2, TT.WATER],
      ['r', 44, 24, 4, 2, TT.WATER]
    ],
    props: [
      ['stairs', 45, 3, 1],
      // 챔버 4 에는 전구를 하나도 두지 않는다 — 고양이는 손전등으로 직접 찾아야 한다
      ['bulb', 8, 5], ['bulb', 24, 6], ['bulb', 41, 5],
      ['bulb', 21, 22], ['bulb', 24, 17], ['bulb', 29, 23],
      ['bulb', 16, 6], ['bulb', 44, 20], ['bulb', 38, 18],
      ['boiler', 26, 20, 1], ['barrel', 22, 17, 1], ['barrel', 23, 25, 1],
      ['barrel', 5, 9, 1], ['barrel', 46, 8, 1],
      ['crate', 12, 4, 1], ['crate', 19, 8, 1], ['crate', 38, 10, 1],
      ['crate', 6, 17, 1], ['crate', 14, 22, 1], ['crate', 30, 25, 1],
      ['shelf', 44, 4, 1], ['shelf', 12, 16, 1], ['shelf', 37, 18, 1],
      // 숨을 자리
      ['locker', 2, 10, 1], ['locker', 18, 9, 1], ['locker', 36, 11, 1],
      ['locker', 20, 26, 1], ['locker', 47, 17, 1],
      ['pipeV', 2, 6], ['pipeV', 2, 7], ['pipeV', 2, 8],
      ['pipeV', 49, 18], ['pipeV', 49, 19], ['pipeV', 49, 20],
      ['pipeH', 19, 3], ['pipeH', 20, 3], ['pipeH', 21, 3], ['pipeH', 22, 3],
      ['pipeH', 37, 16], ['pipeH', 38, 16], ['pipeH', 39, 16],
      ['puddle', 10, 8], ['puddle', 29, 12], ['puddle', 39, 22], ['puddle', 10, 20]
    ],
    /* 마지막 챔버 안쪽에도 하나 세워 둔다 — 철문을 열고 들어선 직후 */
    sentries: [[29, 16], [12, 18]],
    triggers: [
      [12, 4, 11, 9],          // 조각 하나 → 챔버1 안쪽
      [37, 18, 41, 14],        // 조각 둘 → 통로
      [23, 25, 29, 22]         // 조각 셋 → 보일러실 건너편
    ],
    /* 철문을 여는 소리는 멀리 간다. 열면 반드시 여기에 하나 선다. */
    gateSpawn: [20, 24],
    start: [45, 6],
    goal: { t: 'cat', x: 7, y: 22 }
  }
};

/* ------------------------------------------------------------------ *
   수색
     열어볼 수 있는 물체와, 그 안에서 나오는 것.
     결과는 레벨을 만들 때 위치로 한 번 정해지고 바뀌지 않는다.
     같은 곳을 다시 열어 다른 결과를 뽑을 수 없어야 선택에 무게가 실린다.
 * ------------------------------------------------------------------ */
const SEARCHABLE = new Set(['cabinet', 'crate', 'drum', 'bin', 'barrel', 'shelf', 'bed']);
/* 뚜껑·문이 열리는 것들. 수색 후 속이 비어 보이게 그린다 */
const OPENABLE = new Set(['cabinet', 'crate', 'drum', 'bin', 'barrel']);
/* 사람이 들어갈 수 있는 것들. 사물함(locker)은 뒤질 것이 없고 오직 숨기 위한 자리다. */
const CONTAINER = new Set(['cabinet', 'crate', 'drum', 'bin', 'barrel', 'locker']);

/* 대부분은 비어 있어야 한다. 열 때마다 뭔가 나오면 긴장이 아니라 기대가 된다. */
const OUTCOME_W = [
  ['empty', 55],
  ['trace', 14],
  ['noise', 16],
  ['dread', 15]
];

const FLAVOR = {
  empty: [
    '빈 옷걸이만 남아 있다.',
    '먼지가 두껍게 앉았다. 오래 열리지 않은 것 같다.',
    '아무것도 없다. 아무것도 없다는 것이 조금 이상하다.',
    '누군가 이미 비워 갔다.',
    '바닥에 신문지 몇 장. 날짜는 읽히지 않는다.'
  ],
  trace: [
    '고양이 털 몇 올. 아직 따뜻한 것 같다.',
    '작은 발자국이 안쪽으로 어지럽게 찍혀 있다.',
    '목줄에서 떨어진 고리 하나가 굴러 나왔다.',
    '여기서 한참 웅크리고 있었던 자국이 남아 있다.'
  ],
  noise: [
    '안쪽에서 무언가 무너지는 소리가 났다.',
    '무언가 빠르게 지나갔다. 쥐였을 것이다.',
    '닫는 순간, 안에서 한 번 더 소리가 났다.',
    '뒤쪽에서 뭔가가 넘어졌다. 돌아보니 아무것도 없다.'
  ]
};

const Levels = {
  T: 16,
  SEARCHABLE, CONTAINER, OPENABLE, FLAVOR,

  build(name) {
    const D = LEVEL_DEF[name];
    const W = D.W, H = D.H;

    const grid = [];
    for (let y = 0; y < H; y++) grid.push(new Uint8Array(W).fill(D.fill));

    for (const op of D.ops) {
      const [, x, y, w, h, t] = op;
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) grid[yy][xx] = t;
    }

    const map = {
      name, theme: D.theme, grid, W, H, T: this.T,
      blocked: new Uint8Array(W * H),
      props: [],
      title: D.title, lines: D.lines
    };

    /* 건물 입면에 창문을 규칙적으로 낸다 (아래가 바닥이고 위가 벽인 곳) */
    if (D.windows) {
      for (let y = 1; y < H - 1; y++)
        for (let x = 0; x < W; x++) {
          if (grid[y][x] !== TT.WALL) continue;
          if (!TT_WALK[grid[y + 1][x]]) continue;
          if (grid[y - 1][x] !== TT.WALL && grid[y - 1][x] !== TT.WINDOW) continue;
          if ((x * 5 + y * 3) % 3 === 1) grid[y][x] = TT.WINDOW;
        }
    }

    /* 소품 배치 */
    for (const [n, tx, ty, solid] of D.props) {
      const pr = { n, tx, ty, x: tx * this.T + this.T / 2, y: ty * this.T + this.T - 1 };
      if (SEARCHABLE.has(n)) {
        pr.searchable = true;
        pr.searched = false;
        pr.outcome = this.rollOutcome(name, tx, ty);
        pr.flavorIdx = ((tx * 31 + ty * 17) >>> 0);
      }
      map.props.push(pr);
      if (solid) map.blocked[tx + ty * W] = 1;
    }
    map.props.sort((a, b) => a.y - b.y);

    /* 레벨마다 최소치를 보장한다.
       난수에 맡기면 한 스테이지에 공포 반응이 하나도 없는 판이 나온다 — 실제로 나왔다.
       개수는 연출상 정하는 값이라 레벨 청사진에 직접 적는다. */
    /* 열쇠(조각)는 난수에 맡기지 않는다. 반드시 이 소품 안에서 나온다 —
       못 찾으면 진행이 막히는 물건이라 확률로 두면 안 된다. */
    for (const [kx, ky] of (D.keyProps || [])) {
      const pr = map.props.find(p => p.tx === kx && p.ty === ky && p.searchable);
      if (pr) pr.outcome = 'key';
      else console.warn('[level] 열쇠를 넣을 수색 대상이 없다:', name, kx, ky);
    }

    const searchables = map.props.filter(p => p.searchable);
    const mins = D.mins || { trace: 2, dread: 2 };
    this.ensureMin(searchables, 'trace', mins.trace);
    this.ensureMin(searchables, 'dread', mins.dread);
    map.searchTotal = searchables.length;

    /* 그것이 나타나는 자리.
       전부 청사진에 좌표로 적혀 있다 — 확률도, 무작위 위치도, 시간에 맡기는 출현도 없다.
       같은 판을 다시 하면 같은 자리에서 같은 것이 나온다. */
    const pt = ([x, y]) => ({ tx: x, ty: y, x: x * this.T + this.T / 2, y: y * this.T + this.T - 2 });
    const stand = (sx, sy, why) => {
      if (this.solid(map, sx, sy)) console.warn('[level] 설 수 없는 자리:', name, why, sx, sy);
      return pt([sx, sy]);
    };

    map.sentries = (D.sentries || []).map(([x, y]) => stand(x, y, 'sentry'));

    /* 수색 대상 → 나타나는 자리 */
    map.triggers = new Map();
    for (const [px, py, sx, sy] of (D.triggers || [])) {
      const pr = map.props.find(p => p.tx === px && p.ty === py && p.searchable);
      if (!pr) { console.warn('[level] 트리거를 걸 수색 대상이 없다:', name, px, py); continue; }
      map.triggers.set(px + ',' + py, stand(sx, sy, 'trigger ' + px + ',' + py));
    }
    if (D.gateSpawn) map.gateSpawn = stand(D.gateSpawn[0], D.gateSpawn[1], 'gateSpawn');

    /* 철문 : 격자에 찍힌 GATE 칸을 모아 하나의 문으로 다룬다 */
    const gt = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (grid[y][x] === TT.GATE) gt.push([x, y]);
    if (gt.length) {
      let sx = 0, sy = 0;
      for (const [x, y] of gt) { sx += x; sy += y; }
      map.gate = {
        tiles: gt, open: false,
        x: (sx / gt.length) * this.T + this.T / 2,
        y: (sy / gt.length) * this.T + this.T / 2
      };
    }
    if (D.lock) map.lock = { need: D.lock.need, kind: D.lock.kind, have: 0 };

    map.start = { x: D.start[0] * this.T + this.T / 2, y: D.start[1] * this.T + this.T / 2 };
    if (D.goal) {
      map.goal = {
        type: D.goal.t, tx: D.goal.x, ty: D.goal.y,
        x: D.goal.x * this.T + this.T / 2,
        y: D.goal.y * this.T + this.T - 2,
        used: false
      };
      // 고양이는 바닥에 앉으므로 타일 중앙에 둔다
      if (D.goal.t === 'cat') map.goal.y = D.goal.y * this.T + this.T / 2;
    }
    return map;
  },

  /* 위치로 고정되는 결과 추첨.
     직접 짠 해시는 이 정도 표본에서 분포가 눈에 띄게 치우쳐서 검증된 PRNG 를 쓴다. */
  rollOutcome(levelName, tx, ty) {
    const seed = levelName.charCodeAt(0) * 7919 + levelName.length * 131 + tx * 977 + ty * 37;
    const rnd = Tiles.rng(seed);
    rnd(); rnd();                       // 인접한 좌표끼리 상관을 끊는다
    let r = rnd() * 100;
    for (const [k, w] of OUTCOME_W) { if (r < w) return k; r -= w; }
    return 'empty';
  },

  /* 비어 있는 것들 중 일부를 kind 로 바꿔 최소 개수를 채운다.
     한쪽에 몰리지 않도록 간격을 두고 고른다. */
  ensureMin(list, kind, min) {
    let have = list.filter(p => p.outcome === kind).length;
    if (have >= min) return;
    const pool = list.filter(p => p.outcome === 'empty');
    if (!pool.length) return;
    const need = min - have;
    const stride = Math.max(1, Math.floor(pool.length / need));
    for (let i = 0; have < min && i < pool.length; i += stride) {
      pool[i].outcome = kind;
      have++;
    }
  },

  flavor(kind, idx) {
    const pool = FLAVOR[kind];
    return pool ? pool[idx % pool.length] : '';
  },

  /* 철문을 연다. 격자가 바뀌므로 이후의 길찾기·충돌이 전부 따라온다. */
  openGate(map) {
    if (!map.gate || map.gate.open) return false;
    for (const [x, y] of map.gate.tiles) map.grid[y][x] = TT.GATE_OPEN;
    map.gate.open = true;
    return true;
  },

  solid(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return true;
    if (!TT_WALK[map.grid[ty][tx]]) return true;
    return map.blocked[tx + ty * map.W] === 1;
  },

  walkTile(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return false;
    return !!TT_WALK[map.grid[ty][tx]];
  },

  /* 이웃 마스크 : 1=위 2=오른쪽 4=아래 8=왼쪽 이 열린 칸 */
  mask(map, tx, ty) {
    let m = 0;
    if (this.walkTile(map, tx, ty - 1)) m |= 1;
    if (this.walkTile(map, tx + 1, ty)) m |= 2;
    if (this.walkTile(map, tx, ty + 1)) m |= 4;
    if (this.walkTile(map, tx - 1, ty)) m |= 8;
    return m;
  },

  /* 시작점에서 목표까지 실제로 갈 수 있는지 (개발용 검사).
     잠긴 철문은 열 수 있는 것이므로 뚫린 것으로 친다. */
  reachable(map, from, to) {
    const { W, H } = map;
    const shut = (x, y) =>
      map.grid[y][x] === TT.GATE ? map.blocked[x + y * W] === 1 : this.solid(map, x, y);
    const seen = new Uint8Array(W * H);
    const q = [from.x + from.y * W];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0;
      if (Math.abs(x - to.x) + Math.abs(y - to.y) <= 1) return true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = nx + ny * W;
        if (seen[ni] || shut(nx, ny)) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    return false;
  }
};
