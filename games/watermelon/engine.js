// 게임 규칙과 물리. 화면 그리기·입력은 main.js에서 담당해요.
const { Engine, Bodies, Body, Composite, Events, Vertices } = window.Matter;

export const WIDTH = 360;
export const HEIGHT = 520;
export const DANGER_Y = 86;     // 이 선 위에 오래 쌓이면 게임 끝
export const DROP_Y = 46;
const DROP_LEVELS = 5;          // 떨어뜨릴 수 있는 단계 수(작은 것부터)
const GRACE_MS = 1500;          // 막 떨어뜨린 캐릭터는 위험 판정에서 제외
const LIMIT_MS = 1500;          // 위험선 위에 머물 수 있는 시간
const COOLDOWN_MS = 500;
// 탄력 조절: restitution이 클수록(0~1) 더 통통 튀어요.
const BOUNCE = { restitution: 0.6, friction: 0.15, frictionStatic: 0.3, frictionAir: 0.008 };
export const STEP_MS = 1000 / 60;

// shapes[단계]는 반지름 1 기준의 볼록 다각형 목록이에요. 없으면 원으로 판정해요.
export function createGame(levels, { shapes = [], random = Math.random, onMerge = () => {} } = {}) {
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const wall = (x, y, w, h) => Bodies.rectangle(x, y, w, h, { isStatic: true, label: 'wall' });
  Composite.add(engine.world, [
    wall(WIDTH / 2, HEIGHT + 50, WIDTH + 200, 100),
    wall(-50, HEIGHT / 2 - 200, 100, HEIGHT + 600),
    wall(WIDTH + 50, HEIGHT / 2 - 200, 100, HEIGHT + 600),
  ]);

  const pieces = new Set();
  const pairs = [];
  const pick = () => Math.floor(random() * Math.min(DROP_LEVELS, levels.length));
  const state = { score: 0, over: false, time: 0, readyAt: 0, current: pick(), next: pick(), danger: 0 };

  function add(level, x, y) {
    const r = levels[level].radius;
    const px = Math.min(WIDTH - r, Math.max(r, x));
    const py = Math.min(HEIGHT - r, y);
    const options = { ...BOUNCE, label: 'piece' };
    let body;
    // offset: 물리 중심에서 본 그림 중심의 위치
    let offset = { x: 0, y: 0 };
    if (shapes[level]) {
      // 오목한 모양은 볼록 조각 여러 개를 하나의 몸체로 묶어요.
      const parts = shapes[level].map((polygon) => {
        const vertices = Vertices.clockwiseSort(polygon.map((p) => ({ x: p.x * r, y: p.y * r })));
        return Body.create({ ...options, position: Vertices.centre(vertices), vertices });
      });
      body = parts.length === 1 ? parts[0] : Body.create({ ...options, parts });
      const centre = { x: body.position.x, y: body.position.y }; // 그림 중심 기준 무게중심
      offset = { x: -centre.x, y: -centre.y };
      Body.setPosition(body, { x: px + centre.x, y: py + centre.y });
    } else {
      body = Bodies.circle(px, py, r, options, 48);
    }
    Object.assign(body, { level, radius: r, offset, born: state.time, overTime: 0, merged: false });
    pieces.add(body);
    Composite.add(engine.world, body);
    return body;
  }

  function remove(body) {
    body.merged = true;
    pieces.delete(body);
    Composite.remove(engine.world, body);
  }

  const collect = (event) => {
    for (const pair of event.pairs) {
      // 조각끼리 닿으면 그 조각이 속한 몸체(parent)를 비교해요.
      const a = pair.bodyA.parent;
      const b = pair.bodyB.parent;
      if (a !== b && a.label === 'piece' && b.label === 'piece' && a.level === b.level) pairs.push([a, b]);
    }
  };
  Events.on(engine, 'collisionStart', collect);
  Events.on(engine, 'collisionActive', collect);

  function merge() {
    for (const [a, b] of pairs.splice(0)) {
      if (a.merged || b.merged) continue;
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      const velocity = { x: (a.velocity.x + b.velocity.x) / 2, y: (a.velocity.y + b.velocity.y) / 2 };
      const level = a.level;
      remove(a);
      remove(b);
      const top = level === levels.length - 1;
      if (!top) Body.setVelocity(add(level + 1, x, y), velocity);
      // 마지막 단계 두 개가 만나면 둘 다 사라지고 보너스 점수
      const gained = top ? levels[level].score * 3 : levels[level + 1].score;
      state.score += gained;
      onMerge({ x, y, level: top ? level : level + 1, gained });
    }
  }

  // 꽉 눌린 캐릭터가 벽이나 바닥을 뚫고 나가면 안으로 되돌려요.
  function keepInside(p) {
    const half = p.radius / 2;
    const x = Math.min(WIDTH - half, Math.max(half, p.position.x));
    const y = Math.min(HEIGHT - half, p.position.y);
    if (x === p.position.x && y === p.position.y) return;
    Body.setPosition(p, { x, y });
    Body.setVelocity(p, { x: 0, y: 0 });
  }

  return {
    state,
    pieces,
    add,
    canDrop: () => !state.over && state.time >= state.readyAt,
    drop(x) {
      if (!this.canDrop()) return false;
      add(state.current, x, DROP_Y);
      state.current = state.next;
      state.next = pick();
      state.readyAt = state.time + COOLDOWN_MS;
      return true;
    },
    step() {
      if (state.over) return;
      state.time += STEP_MS;
      Engine.update(engine, STEP_MS);
      merge();
      let worst = 0;
      for (const p of pieces) {
        keepInside(p);
        const top = Math.min(...p.vertices.map((v) => v.y));
        const high = state.time - p.born > GRACE_MS && top < DANGER_Y;
        p.overTime = high ? p.overTime + STEP_MS : 0;
        worst = Math.max(worst, p.overTime);
      }
      state.danger = Math.min(1, worst / LIMIT_MS);
      if (state.danger >= 1) state.over = true;
    },
  };
}
