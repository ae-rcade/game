// 사람이 적을 때 맵을 채우는 컴퓨터 지렁이. 화면(DOM)을 쓰지 않아요.
import { RULES, radiusFor } from './rules.js';

const NAMES = ['말랑', '콩떡', '별사탕', '네온', '오락왕', '꼬물이', '솜사탕', '픽셀', '동전', '조이스틱', '꿈틀', '젤리', '반짝', '미러볼', '버튼', '보너스'];
const TURNS = [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6];
const THINK_SEC = 0.12;

export function createBots(world, { random = Math.random } = {}) {
  const minds = new Map(); // 지렁이 → 생각 상태
  let wait = 0;

  function spawn() {
    const used = new Set([...world.worms.values()].map((w) => w.name));
    const free = NAMES.filter((n) => !used.has(n));
    const name = free[Math.floor(random() * free.length)] || NAMES[0];
    const length = RULES.startLength + Math.floor(random() ** 2 * 50);
    const limit = Math.round(RULES.botMaxLength * (0.4 + random() * 0.6));
    const worm = world.addWorm({ name, bot: true, length: Math.min(length, limit), limit });
    minds.set(worm, { next: random() * THINK_SEC, target: null, wander: worm.angle });
  }

  function safety(worm, angle) {
    const radius = radiusFor(worm.colors.length);
    for (const [i, distance] of [26, 55, 95].entries()) {
      const x = worm.x + Math.cos(angle) * (distance + radius);
      const y = worm.y + Math.sin(angle) * (distance + radius);
      if (Math.hypot(x, y) > RULES.mapRadius - 30 || world.blocked(x, y, radius + 4, worm)) return i;
    }
    return 3;
  }

  function nearestFood(worm) {
    let best = null;
    let bestScore = Infinity;
    world.eachFoodNear(worm.x, worm.y, 200, (f) => {
      const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(f.y - worm.y, f.x - worm.x) - worm.angle),
        Math.cos(Math.atan2(f.y - worm.y, f.x - worm.x) - worm.angle)));
      // 바로 옆의 먹이를 빙빙 돌지 않도록, 앞쪽에 있는 먹이를 더 좋아해요.
      const score = Math.hypot(f.x - worm.x, f.y - worm.y) * (1 + turn) * (f.big ? 0.5 : 1);
      if (score < bestScore) { best = f; bestScore = score; }
    });
    return best;
  }

  function think(worm, mind) {
    const food = nearestFood(worm);
    if (random() < 0.05) mind.wander = random() * Math.PI * 2;
    let goal = food ? Math.atan2(food.y - worm.y, food.x - worm.x) : mind.wander;
    if (Math.hypot(worm.x, worm.y) > RULES.mapRadius * 0.85) goal = Math.atan2(-worm.y, -worm.x);

    let chosen = goal;
    if (safety(worm, goal) < 3) {
      let best = -Infinity;
      for (const turn of TURNS) {
        const angle = worm.angle + turn;
        const score = safety(worm, angle) * 10 - Math.abs(Math.atan2(Math.sin(angle - goal), Math.cos(angle - goal)));
        if (score > best) { best = score; chosen = angle; }
      }
    } else if (random() < 0.008) world.boost(worm);
    world.steer(worm, chosen);
  }

  return {
    update(dt) {
      for (const worm of minds.keys()) if (!worm.alive) minds.delete(worm);
      for (const [worm, mind] of minds) {
        mind.next -= dt;
        if (mind.next > 0) continue;
        mind.next = THINK_SEC;
        think(worm, mind);
      }
      // 비는 자리는 잠깐 뒤에 하나씩 채워요.
      wait -= dt;
      if (wait <= 0 && world.worms.size < RULES.population) {
        spawn();
        wait = 1.5;
      }
    },
    fill() {
      while (world.worms.size < RULES.population) spawn();
    },
  };
}
