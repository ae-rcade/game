// 지렁이 세계: 이동, 먹기, 충돌. 화면(DOM)을 쓰지 않아서 2단계에서 서버에서도 그대로 실행해요.
import { RULES, KINDS, BASE_COLORS, radiusFor } from './rules.js';

const FOOD_CELL = 80;
const BODY_CELL = 48;
const REACH = 14; // 머리 반지름에 더해 먹이를 먹는 거리
const key = (cx, cy) => (cx + 512) * 1024 + (cy + 512);

// i번째(1부터) 몸 마디의 위치. 머리에서 i*간격만큼 뒤예요.
export function segment(worm, i, out = { x: 0, y: 0 }) {
  const a = worm.trail[i - 1];
  const b = worm.trail[i];
  const t = 1 - worm.carry / RULES.spacing;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  return out;
}

// onFoodAdd·onFoodRemove: 서버가 바뀐 먹이만 보내려고 써요.
export function createWorld({ random = Math.random, onFoodAdd, onFoodRemove } = {}) {
  const worms = new Map();
  const foods = new Map();
  const foodGrid = new Map();
  let bodyGrid = new Map();
  let nextWorm = 1;
  let nextFood = 1;
  let natural = 0;

  const pick = (list) => list[Math.floor(random() * list.length)];

  // ───── 먹이 ─────
  function addFood(x, y, kind, big = false) {
    const food = { id: nextFood++, x, y, kind, big, grow: big ? RULES.dropGrow : RULES.foodGrow };
    foods.set(food.id, food);
    const k = key(Math.floor(x / FOOD_CELL), Math.floor(y / FOOD_CELL));
    let cell = foodGrid.get(k);
    if (!cell) foodGrid.set(k, cell = new Set());
    cell.add(food);
    food.cell = cell;
    if (!big) natural++;
    onFoodAdd?.(food);
    return food;
  }

  function removeFood(food) {
    if (!foods.delete(food.id)) return;
    food.cell.delete(food);
    if (!food.big) natural--;
    onFoodRemove?.(food);
  }

  function eachFoodNear(x, y, range, visit) {
    for (let cx = Math.floor((x - range) / FOOD_CELL); cx <= Math.floor((x + range) / FOOD_CELL); cx++) {
      for (let cy = Math.floor((y - range) / FOOD_CELL); cy <= Math.floor((y + range) / FOOD_CELL); cy++) {
        const cell = foodGrid.get(key(cx, cy));
        if (cell) for (const food of cell) visit(food);
      }
    }
  }

  function refill(limit) {
    for (let i = 0; i < limit && natural < RULES.foodCount; i++) {
      const angle = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * (RULES.mapRadius - 30);
      addFood(Math.cos(angle) * dist, Math.sin(angle) * dist, Math.floor(random() * KINDS.length));
    }
  }

  // ───── 지렁이 ─────
  // 다른 지렁이에게서 가장 먼 자리를 골라요.
  function spawnPoint() {
    let best = null;
    for (let i = 0; i < 24; i++) {
      const angle = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * RULES.mapRadius * 0.72;
      const p = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, space: Infinity };
      for (const w of worms.values()) {
        p.space = Math.min(p.space, Math.hypot(w.x - p.x, w.y - p.y));
        for (let s = 4; s <= w.colors.length; s += 4) {
          p.space = Math.min(p.space, Math.hypot(w.trail[s].x - p.x, w.trail[s].y - p.y));
        }
      }
      if (!best || p.space > best.space) best = p;
    }
    return best;
  }

  function addWorm({ name, bot = false, length = RULES.startLength, limit = RULES.maxLength }) {
    const { x, y } = spawnPoint();
    // 처음에는 맵 가운데 쪽을 향해요.
    const angle = Math.atan2(-y, -x) + (random() - 0.5) * 1.6;
    const color = pick(BASE_COLORS);
    const trail = [];
    for (let i = 0; i <= length; i++) {
      trail.push({ x: x - Math.cos(angle) * RULES.spacing * i, y: y - Math.sin(angle) * RULES.spacing * i });
    }
    const worm = {
      id: nextWorm++, name, bot, color, x, y, angle, target: angle, trail, carry: 0, limit,
      colors: new Array(length).fill(color), pending: [],
      boostLeft: 0, cooldown: 0, shield: RULES.shieldSec, kills: 0, alive: true,
    };
    worms.set(worm.id, worm);
    return worm;
  }

  function steer(worm, angle) {
    if (Number.isFinite(angle)) worm.target = angle;
  }

  function boost(worm) {
    if (!worm.alive || worm.boostLeft > 0 || worm.cooldown > 0) return false;
    worm.boostLeft = RULES.boostSec;
    return true;
  }

  function move(worm, dt) {
    const radius = radiusFor(worm.colors.length);
    const turn = (RULES.turnRate / (1 + (radius - 9) * 0.05)) * dt;
    const diff = Math.atan2(Math.sin(worm.target - worm.angle), Math.cos(worm.target - worm.angle));
    worm.angle += Math.max(-turn, Math.min(turn, diff));

    let speed = RULES.speed;
    if (worm.boostLeft > 0) {
      speed = RULES.boostSpeed;
      worm.boostLeft -= dt;
      if (worm.boostLeft <= 0) {
        worm.boostLeft = 0;
        worm.cooldown = RULES.boostCooldownSec;
      }
    } else if (worm.cooldown > 0) worm.cooldown = Math.max(0, worm.cooldown - dt);
    if (worm.shield > 0) worm.shield = Math.max(0, worm.shield - dt);

    let remain = speed * dt;
    while (remain > 1e-9) {
      const step = Math.min(remain, RULES.spacing - worm.carry);
      worm.x += Math.cos(worm.angle) * step;
      worm.y += Math.sin(worm.angle) * step;
      worm.carry += step;
      remain -= step;
      if (worm.carry >= RULES.spacing - 1e-9) {
        worm.carry = 0;
        worm.trail.unshift({ x: worm.x, y: worm.y });
        // 먹은 만큼 꼬리 끝에 그 먹이 색의 마디가 붙어요.
        if (worm.pending.length) worm.colors.push(worm.pending.shift());
        while (worm.trail.length > worm.colors.length + 1) worm.trail.pop();
      }
    }
  }

  function eat(worm, events) {
    const range = radiusFor(worm.colors.length) + REACH;
    const found = [];
    eachFoodNear(worm.x, worm.y, range, (f) => {
      if (Math.hypot(f.x - worm.x, f.y - worm.y) <= range) found.push(f);
    });
    for (const food of found) {
      removeFood(food);
      const room = Math.max(0, worm.limit - worm.colors.length - worm.pending.length);
      for (let i = 0; i < Math.min(food.grow, room); i++) worm.pending.push(food.kind);
      events.push({ type: 'eat', worm, kind: food.kind, x: food.x, y: food.y });
    }
  }

  // ───── 충돌 ─────
  function indexBodies() {
    bodyGrid = new Map();
    const p = { x: 0, y: 0 };
    for (const worm of worms.values()) {
      const radius = radiusFor(worm.colors.length);
      for (let i = 0; i <= worm.colors.length; i++) {
        if (i === 0) { p.x = worm.x; p.y = worm.y; } else segment(worm, i, p);
        const k = key(Math.floor(p.x / BODY_CELL), Math.floor(p.y / BODY_CELL));
        let cell = bodyGrid.get(k);
        if (!cell) bodyGrid.set(k, cell = []);
        cell.push({ x: p.x, y: p.y, radius, worm });
      }
    }
  }

  // (x, y)에서 반지름 pad 안에 닿는 다른 지렁이를 찾아요.
  function bodyAt(x, y, pad, self, skip) {
    const range = pad + 20;
    for (let cx = Math.floor((x - range) / BODY_CELL); cx <= Math.floor((x + range) / BODY_CELL); cx++) {
      for (let cy = Math.floor((y - range) / BODY_CELL); cy <= Math.floor((y + range) / BODY_CELL); cy++) {
        const cell = bodyGrid.get(key(cx, cy));
        if (!cell) continue;
        for (const part of cell) {
          if (part.worm === self || !part.worm.alive || skip?.(part.worm)) continue;
          const limit = pad + part.radius * 0.85;
          if ((part.x - x) ** 2 + (part.y - y) ** 2 < limit * limit) return part.worm;
        }
      }
    }
    return null;
  }

  function collide(events) {
    const list = [...worms.values()];
    const deaths = new Map(); // 지렁이 → 상대(없으면 null)
    const headOn = new Set(); // 머리끼리 닿은 짝
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.shield > 0 || b.shield > 0) continue;
        const limit = (radiusFor(a.colors.length) + radiusFor(b.colors.length)) * 0.7;
        if (Math.hypot(a.x - b.x, a.y - b.y) >= limit) continue;
        headOn.add(`${a.id}:${b.id}`);
        headOn.add(`${b.id}:${a.id}`);
        // 머리끼리 부딪히면 짧은 쪽이 죽고, 길이가 같으면 둘 다 죽어요.
        if (a.colors.length <= b.colors.length) deaths.set(a, b);
        if (b.colors.length <= a.colors.length) deaths.set(b, a);
      }
    }
    for (const worm of list) {
      if (deaths.has(worm)) continue;
      const radius = radiusFor(worm.colors.length);
      if (Math.hypot(worm.x, worm.y) > RULES.mapRadius - radius * 0.6) {
        deaths.set(worm, null);
        continue;
      }
      if (worm.shield > 0) continue;
      const other = bodyAt(worm.x, worm.y, radius * 0.5, worm, (o) => o.shield > 0 || headOn.has(`${worm.id}:${o.id}`));
      if (other) deaths.set(worm, other);
    }

    for (const [worm, killer] of deaths) {
      if (killer && !deaths.has(killer)) killer.kills++;
      kill(worm);
      // reason: 'wall' 맵 끝, 'head' 머리끼리, 'body' 몸에 닿음
      const reason = !killer ? 'wall' : headOn.has(`${worm.id}:${killer.id}`) ? 'head' : 'body';
      events.push({ type: 'death', worm, killer, reason });
    }
  }

  // 죽은 몸은 그 마디 색의 먹이로 바뀌어요.
  function kill(worm) {
    if (!worms.delete(worm.id)) return;
    worm.alive = false;
    const p = { x: 0, y: 0 };
    const edge = RULES.mapRadius - 20;
    for (let i = 1; i <= worm.colors.length; i += RULES.dropEvery) {
      segment(worm, i, p);
      let x = p.x + (random() - 0.5) * 14;
      let y = p.y + (random() - 0.5) * 14;
      const dist = Math.hypot(x, y);
      if (dist > edge) { x *= edge / dist; y *= edge / dist; }
      addFood(x, y, worm.colors[i - 1], true);
    }
    // 너무 많이 쌓이면 오래된 것부터 치워요.
    for (const food of foods.values()) {
      if (foods.size <= RULES.foodLimit) break;
      if (food.big) removeFood(food);
    }
  }

  function step(dt) {
    const events = [];
    for (const worm of worms.values()) move(worm, dt);
    indexBodies();
    collide(events);
    for (const worm of worms.values()) eat(worm, events);
    refill(4);
    return events;
  }

  refill(RULES.foodCount);

  return {
    worms, foods, addWorm, addFood, removeFood, steer, boost, step, eachFoodNear,
    remove: kill, // 접속이 끊긴 지렁이도 먹이로 바뀌어요.
    blocked: (x, y, pad, self) => bodyAt(x, y, pad, self) !== null,
  };
}
