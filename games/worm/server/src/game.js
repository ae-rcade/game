// 맵 하나의 진행과 플레이어에게 보낼 내용. Cloudflare 코드는 index.js에만 있어요.
import { RULES, cleanName } from '../../rules.js';
import { createWorld } from '../../world.js';
import { createBots } from '../../bots.js';
import { packColors, packFood, packMove, packWorm, r2 } from '../../protocol.js';

export const MAX_PLAYERS = 30;
const SUBSTEP = 1 / 40;          // 계산은 보내는 간격보다 잘게 해요.
const VIEW = { x: 520, y: 760 }; // 내 머리에서 이 범위 안의 지렁이만 보내요.
const KEEP = 140;                // 보이던 지렁이는 조금 더 멀어질 때까지 계속 보내요.
const RANK_EVERY = 8;            // 순위는 약 0.5초마다
const IDLE_MS = 30_000;          // 아무 소식이 없으면 연결을 닫아요.
const DEAD_IDLE_MS = 60_000;     // 죽은 채(또는 시작하지 않고) 이만큼 지나면 닫아요.
const MESSAGES_PER_SECOND = 40;
const TOP = 5;

// now: 실제 시각(ms). 조종 신호가 두 번의 계산 사이 언제 왔는지 알 때만 써요.
export function createGame({ random, now } = {}) {
  let added = [];
  let removed = [];
  const world = createWorld({
    random,
    onFoodAdd: (food) => added.push(food),
    onFoodRemove: (food) => removed.push(food.id),
  });
  const bots = createBots(world, { random });
  bots.fill();
  added = [];
  const players = new Set();
  const sent = new WeakMap(); // 지렁이 → 지난번까지 보낸 마디 수
  let time = 0;
  let ticks = 0;
  let tickedAt = now?.();

  function connect(send, close) {
    const player = { send, close, worm: null, x: 0, y: 0, known: new Set(), heard: time, downSince: time, death: null, window: time, count: 0, ack: null };
    players.add(player);
    send(JSON.stringify({ t: 'w', f: [...world.foods.values()].map(packFood) }));
    return player;
  }

  function leave(player) {
    if (!players.delete(player)) return;
    if (player.worm?.alive) world.remove(player.worm);
    player.worm = null;
  }

  function kick(player, code, reason) {
    leave(player);
    player.close(code, reason);
  }

  function receive(player, raw) {
    if (!players.has(player)) return;
    if (time - player.window >= 1000) { player.window = time; player.count = 0; }
    if (typeof raw !== 'string' || raw.length > 200 || ++player.count > MESSAGES_PER_SECOND) return kick(player, 4002, 'flood');
    player.heard = time;
    if (raw === 'p') return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message?.t === 'j') {
      const name = cleanName(message.n);
      if (!name || player.worm) return;
      player.worm = world.addWorm({ name });
      player.death = null;
    } else if (!player.worm) {
      return;
    } else if (message?.t === 'a') {
      world.steer(player.worm, message.a);
    } else if (message?.t === 'b') {
      world.boost(player.worm);
    } else {
      return;
    }
    // 어느 신호까지 반영했는지 알려 주면, 화면이 내 지렁이를 미리 움직인 위치와 맞춰 볼 수 있어요.
    if (Number.isInteger(message.s)) {
      const offset = now ? Math.max(0, Math.min(200, now() - tickedAt)) : 0;
      player.ack = [message.s, time + offset];
    }
  }

  const visible = (worm, player, margin) => {
    const near = (p) => Math.abs(p.x - player.x) < VIEW.x + margin && Math.abs(p.y - player.y) < VIEW.y + margin;
    if (near(worm)) return true;
    for (let i = 6; i < worm.trail.length; i += 6) if (near(worm.trail[i])) return true;
    return near(worm.trail[worm.trail.length - 1]);
  };

  function simulate(dt) {
    const owners = new Map();
    for (const player of players) if (player.worm) owners.set(player.worm, player);
    for (let remain = dt; remain > 1e-6; remain -= SUBSTEP) {
      const step = Math.min(SUBSTEP, remain);
      bots.update(step);
      for (const event of world.step(step)) {
        const player = event.type === 'death' && owners.get(event.worm);
        if (!player) continue;
        const length = event.worm.colors.length;
        player.death = {
          reason: event.reason, killer: event.killer?.name ?? null, length, kills: event.worm.kills,
          rank: 1 + [...world.worms.values()].filter((w) => w.colors.length > length).length,
        };
        player.worm = null;
        player.downSince = time;
      }
    }
  }

  function tick(dt) {
    time += dt * 1000;
    tickedAt = now?.();
    ticks++;
    for (const player of players) {
      if (time - player.heard > IDLE_MS || (!player.worm && time - player.downSince > DEAD_IDLE_MS)) kick(player, 4001, 'idle');
    }
    simulate(dt);

    const worms = [...world.worms.values()];
    const moves = new Map();
    for (const worm of worms) {
      const before = sent.get(worm) ?? worm.colors.length;
      sent.set(worm, worm.colors.length);
      moves.set(worm, packMove(worm, packColors(worm.colors.slice(before))));
    }
    const ranked = ticks % RANK_EVERY === 0 ? worms.sort((a, b) => b.colors.length - a.colors.length || a.id - b.id) : null;
    const top = ranked?.slice(0, TOP).map((w) => [w.name, w.colors.length, w.id]);
    const foodAdded = added.map(packFood);
    const foodRemoved = removed;
    added = [];
    removed = [];

    for (const player of players) {
      const { worm } = player;
      if (worm) { player.x = worm.x; player.y = worm.y; }
      const message = { t: 's', m: Math.round(time), u: [] };
      const known = new Set();
      const entered = [];
      for (const [other, move] of moves) {
        const had = player.known.has(other.id);
        if (other !== worm && !visible(other, player, had ? KEEP : 0)) continue;
        known.add(other.id);
        if (had) message.u.push(move);
        else entered.push(packWorm(other));
      }
      const left = [...player.known].filter((id) => !known.has(id));
      player.known = known;
      if (entered.length) message.e = entered;
      if (left.length) message.l = left;
      if (foodAdded.length) message.fa = foodAdded;
      if (foodRemoved.length) message.fr = foodRemoved;
      if (worm) {
        message.y = worm.id;
        message.b = [r2(worm.boostLeft), r2(worm.cooldown)];
        // [마지막으로 반영한 신호 번호, 그 신호가 온 뒤 지난 시간(ms)]
        if (player.ack) message.k = [player.ack[0], Math.round(time - player.ack[1])];
      }
      if (player.death) {
        message.d = player.death;
        player.death = null;
      }
      if (ranked) {
        message.r = { top };
        // 내 순위: [순위, 길이]
        if (worm) message.r.me = [ranked.indexOf(worm) + 1, worm.colors.length];
      }
      player.send(JSON.stringify(message));
    }
  }

  return { connect, receive, leave, tick, world, players, population: RULES.population };
}
