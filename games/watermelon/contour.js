// 투명도 격자에서 바깥 윤곽을 찾아, 물리 엔진이 쓸 수 있는 볼록 다각형들로 나눠요.
import earcut from './vendor/earcut.js';

const area = (poly) => poly.reduce((sum, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return sum + p.x * q.y - q.x * p.y;
}, 0) / 2;

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

// 칸의 네 모서리 중 어디가 불투명한지(1·2·4·8)에 따라 윤곽선이 지나는 변
const SEGMENTS = [
  [], ['TL'], ['RT'], ['RL'], ['BR'], ['TL', 'BR'], ['BT'], ['BL'],
  ['LB'], ['TB'], ['RT', 'LB'], ['RB'], ['LR'], ['TR'], ['LT'], [],
];

// 마칭 스퀘어: 바깥 윤곽만 돌려줘요(안쪽 구멍은 채워진 것으로 봐요).
export function traceOutlines(alpha, size, threshold, minArea = 6) {
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : alpha(x, y));
  const next = new Map();
  const points = new Map();
  const lerp = (a, b) => (threshold - a) / (b - a);

  for (let y = -1; y < size; y++) {
    for (let x = -1; x < size; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const code = (tl > threshold) + (tr > threshold) * 2 + (br > threshold) * 4 + (bl > threshold) * 8;
      const edge = {
        T: () => [`h${x},${y}`, { x: x + 0.5 + lerp(tl, tr), y: y + 0.5 }],
        R: () => [`v${x + 1},${y}`, { x: x + 1.5, y: y + 0.5 + lerp(tr, br) }],
        B: () => [`h${x},${y + 1}`, { x: x + 0.5 + lerp(bl, br), y: y + 1.5 }],
        L: () => [`v${x},${y}`, { x: x + 0.5, y: y + 0.5 + lerp(tl, bl) }],
      };
      for (const [from, to] of SEGMENTS[code]) {
        const [a, pa] = edge[from]();
        const [b, pb] = edge[to]();
        points.set(a, pa);
        points.set(b, pb);
        next.set(a, b);
      }
    }
  }

  const loops = [];
  while (next.size) {
    let key = next.keys().next().value;
    const loop = [];
    while (next.has(key)) {
      loop.push(points.get(key));
      const following = next.get(key);
      next.delete(key);
      key = following;
    }
    if (area(loop) > minArea) loops.push(loop);
  }
  return loops;
}

// 라머-더글러스-포이커: 윤곽에서 tolerance 이내의 잔점을 줄여요.
function reduce(points, tolerance) {
  if (points.length < 3) return points;
  const a = points[0];
  const b = points.at(-1);
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(cross(a, b, points[i])) / length;
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= tolerance) return [a, b];
  return [...reduce(points.slice(0, index + 1), tolerance).slice(0, -1), ...reduce(points.slice(index), tolerance)];
}

function isSimple(poly) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = poly[i], b = poly[i + 1], c = poly[j], d = poly[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  }
  return true;
}

export function simplify(loop, tolerance) {
  let far = 0;
  loop.forEach((p, i) => {
    if (Math.hypot(p.x - loop[0].x, p.y - loop[0].y) > Math.hypot(loop[far].x - loop[0].x, loop[far].y - loop[0].y)) far = i;
  });
  // 단순화하다 선이 꼬이면 더 촘촘하게 다시 시도해요.
  for (let t = tolerance; t > 0.1; t /= 2) {
    const out = [
      ...reduce(loop.slice(0, far + 1), t).slice(0, -1),
      ...reduce([...loop.slice(far), loop[0]], t).slice(0, -1),
    ];
    if (out.length >= 3 && isSimple(out)) return out;
  }
  return loop;
}

// 삼각형으로 나눈 뒤, 볼록함이 유지되는 이웃끼리 다시 합쳐 조각 수를 줄여요.
export function convexParts(poly) {
  const index = earcut(poly.flatMap((p) => [p.x, p.y]));
  const pieces = [];
  for (let i = 0; i < index.length; i += 3) {
    const tri = index.slice(i, i + 3);
    const signed = area(tri.map((k) => poly[k]));
    if (signed !== 0) pieces.push(signed > 0 ? tri : tri.reverse());
  }
  const convex = (ids) => ids.every((id, i) =>
    cross(poly[id], poly[ids[(i + 1) % ids.length]], poly[ids[(i + 2) % ids.length]]) >= -1e-6);
  const join = (p, q) => {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const j = q.indexOf(b);
      if (j < 0 || q[(j + 1) % q.length] !== a) continue;
      const merged = [
        ...p.map((_, k) => p[(i + 1 + k) % p.length]),              // b … a
        ...q.map((_, k) => q[(j + 2 + k) % q.length]).slice(0, -2), // a, b를 뺀 나머지
      ];
      return convex(merged) ? merged : null;
    }
    return null;
  };
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const merged = join(pieces[i], pieces[j]);
      if (merged) {
        pieces[i] = merged;
        pieces.splice(j, 1);
        j = i;
      }
    }
  }
  return pieces.map((ids) => ids.map((k) => poly[k])).filter((p) => area(p) > 0.3);
}
