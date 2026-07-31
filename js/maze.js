/* -------------------------------------------------------------------------
   미로 생성
     grid[y][x] : 1 = 벽(흰 구조물), 0 = 바닥(검정)
     recursive backtracker → 막다른 길 일부 제거(braid) → 방(room) 몇 개 파기
------------------------------------------------------------------------- */
const Maze = {
  TILE: 12,

  generate(cw, ch, opt = {}) {
    const braid = opt.braid !== undefined ? opt.braid : 0.35;
    const rooms = opt.rooms || 0;

    const W = cw * 2 + 1, H = ch * 2 + 1;
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Uint8Array(W).fill(1));

    /* --- 백트래커 --- */
    const stack = [[1, 1]];
    g[1][1] = 0;
    const D = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const cand = [];
      for (const [dx, dy] of D) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && g[ny][nx] === 1)
          cand.push([nx, ny, x + dx / 2, y + dy / 2]);
      }
      if (!cand.length) { stack.pop(); continue; }
      const [nx, ny, mx, my] = U.choice(cand);
      g[my][mx] = 0; g[ny][nx] = 0;
      stack.push([nx, ny]);
    }

    /* --- braid : 막다른 길을 뚫어 순환로 만들기 --- */
    for (let y = 1; y < H - 1; y += 2) {
      for (let x = 1; x < W - 1; x += 2) {
        if (g[y][x] !== 0) continue;
        const open = D.filter(([dx, dy]) => g[y + dy / 2][x + dx / 2] === 0);
        if (open.length === 1 && U.chance(braid)) {
          const walls = D.filter(([dx, dy]) => {
            const wx = x + dx / 2, wy = y + dy / 2;
            const nx = x + dx, ny = y + dy;
            return nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && g[wy][wx] === 1;
          });
          if (walls.length) {
            const [dx, dy] = U.choice(walls);
            g[y + dy / 2][x + dx / 2] = 0;
          }
        }
      }
    }

    /* --- 방 --- */
    for (let i = 0; i < rooms; i++) {
      const rw = U.randInt(2, 4) * 2 + 1;
      const rh = U.randInt(2, 3) * 2 + 1;
      const rx = U.randInt(1, Math.max(1, cw - Math.ceil(rw / 2))) * 2 - 1;
      const ry = U.randInt(1, Math.max(1, ch - Math.ceil(rh / 2))) * 2 - 1;
      for (let y = ry; y < Math.min(H - 1, ry + rh); y++)
        for (let x = rx; x < Math.min(W - 1, rx + rw); x++)
          g[y][x] = 0;
      // 방 안에 기둥 몇 개
      for (let k = 0; k < U.randInt(0, 2); k++) {
        const px = U.clamp(rx + U.randInt(1, rw - 2), 1, W - 2);
        const py = U.clamp(ry + U.randInt(1, rh - 2), 1, H - 2);
        g[py][px] = 1;
      }
    }

    return { grid: g, W, H, T: this.TILE };
  },

  /* 열린 통로로만 이어진 지점들까지의 거리 (BFS) */
  bfs(map, sx, sy) {
    const { grid, W, H } = map;
    const dm = new Int32Array(W * H).fill(-1);
    const q = [sx + sy * W];
    dm[sx + sy * W] = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0, d = dm[c];
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = nx + ny * W;
        if (grid[ny][nx] === 1 || dm[ni] !== -1) continue;
        dm[ni] = d + 1;
        q.push(ni);
      }
    }
    return dm;
  },

  /* 시작점에서 가장 먼 바닥 타일 */
  farthest(map, sx, sy) {
    const dm = this.bfs(map, sx, sy);
    let best = -1, bx = sx, by = sy;
    for (let y = 1; y < map.H - 1; y++)
      for (let x = 1; x < map.W - 1; x++) {
        const d = dm[x + y * map.W];
        if (d > best) { best = d; bx = x; by = y; }
      }
    return { x: bx, y: by, dist: best };
  },

  solid(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return true;
    return map.grid[ty][tx] === 1;
  }
};
