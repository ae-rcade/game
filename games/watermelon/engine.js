// 게임 규칙과 물리. 화면 그리기·입력은 main.js에서 담당해요.
const { Engine, Bodies, Body, Composite, Events } = window.Matter;

export const WIDTH = 360;
export const HEIGHT = 520;
export const DANGER_Y = 86;     // 이 선 위에 오래 쌓이면 게임 끝
export const DROP_Y = 46;
const DROP_LEVELS = 5;          // 떨어뜨릴 수 있는 단계 수(작은 것부터)
const GRACE_MS = 1500;          // 막 떨어뜨린 캐릭터는 위험 판정에서 제외
const LIMIT_MS = 2500;          // 위험선 위에 머물 수 있는 시간
const COOLDOWN_MS = 500;
export const STEP_MS = 1000 / 60;

export function createGame(levels, { random = Math.random, onMerge = () => {} } = {}) {
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
    const body = Bodies.circle(
      Math.min(WIDTH - r, Math.max(r, x)), Math.min(HEIGHT - r, y), r,
      { restitution: 0.12, friction: 0.4, frictionStatic: 0.6, label: 'piece' },
      48,
    );
    Object.assign(body, { level, born: state.time, overTime: 0, merged: false });
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
    for (const { bodyA, bodyB } of event.pairs) {
      if (bodyA.label === 'piece' && bodyB.label === 'piece' && bodyA.level === bodyB.level) {
        pairs.push([bodyA, bodyB]);
      }
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
        const high = state.time - p.born > GRACE_MS && p.position.y - p.circleRadius < DANGER_Y;
        p.overTime = high ? p.overTime + STEP_MS : 0;
        worst = Math.max(worst, p.overTime);
      }
      state.danger = Math.min(1, worst / LIMIT_MS);
      if (state.danger >= 1) state.over = true;
    },
  };
}
