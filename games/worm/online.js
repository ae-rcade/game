// 서버에 접속해서 받은 상태를 화면용 세계로 만들어요. 판정은 모두 서버가 해요.
// 내 지렁이와 먹이는 받는 즉시(predict.js), 다른 지렁이는 조금 늦게 부드럽게 보여 줘요.
import { RULES, radiusFor } from './rules.js';
import { REACH } from './world.js';
import { createPredictor } from './predict.js';
import {
  BOOSTING, SHIELDED, DELAY_MS, INPUT_MS, PING_MS, r2, unpackColors, unpackFood, unpackWorm,
} from './protocol.js';

const OPEN_MS = 8000;      // 접속을 기다리는 시간
const SILENT_MS = 6000;    // 이만큼 소식이 없으면 끊긴 것으로 봐요.
const HIDDEN_MS = 10_000;  // 다른 화면에 이만큼 있으면 연결을 닫아요(무료 한도 절약).
const UNEATEN_MS = 1000;   // 먹은 것으로 보였는데 서버 확인이 없으면 다시 보여 줘요.

// 받은 머리 위치까지 몸을 따라가게 해요. 서버(world.js)의 이동과 같은 방식이에요.
export function advance(worm, x, y) {
  let remain = Math.hypot(x - worm.x, y - worm.y);
  if (remain < 1e-6) return;
  const ux = (x - worm.x) / remain;
  const uy = (y - worm.y) / remain;
  while (remain > 1e-9) {
    const step = Math.min(remain, RULES.spacing - worm.carry);
    worm.x += ux * step;
    worm.y += uy * step;
    worm.carry += step;
    remain -= step;
    if (worm.carry >= RULES.spacing - 1e-9) {
      worm.carry = 0;
      worm.trail.unshift({ x: worm.x, y: worm.y });
      while (worm.trail.length > worm.colors.length + 1) worm.trail.pop();
    }
  }
}

const turnToward = (from, to, f) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * f;

// onLost(message): 연결이 끊기거나 거절됐을 때
export function createOnline(base, { onLost }) {
  const world = { worms: new Map(), foods: new Map() };
  let socket = null;
  let queue = [];       // 아직 보여 주지 않은 상태들
  let clock = null;     // 화면에 보여 주는 서버 시각
  let applied = 0;
  let latest = 0;
  let player = null;
  let rows = [];
  let boost = { left: 0, cooldown: 0 };
  let joining = null;
  let aim = null;
  let sentAim = null;
  let sentAt = 0;
  let timers = [];
  let silent = 0;
  let hidden = 0;
  let seq = 0;            // 보낸 신호 번호
  const sends = new Map(); // 번호 → 보낸 시각
  let predictor = null;   // 내 지렁이를 미리 움직여요. 옛 서버에서는 쓰지 않아요.
  let mineId = null;      // 미리 움직이는 내 지렁이 번호
  let boostSeq = 0;       // 서버 확인을 기다리는 부스트 신호
  let ping = null;        // 서버를 다녀오는 시간(ms)
  const eaten = new Map(); // 먼저 숨긴 먹이: 번호 → { food, at }

  const send = (data) => {
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  };

  // 조종·부스트·입장에는 번호를 붙여, 서버가 어디까지 반영했는지 알 수 있게 해요.
  function command(data) {
    if (!send({ ...data, s: seq + 1 })) return false;
    sends.set(++seq, performance.now());
    return true;
  }

  function forget() {
    predictor = null;
    mineId = null;
    boostSeq = 0;
  }

  function close() {
    timers.forEach(clearTimeout);
    clearTimeout(silent);
    clearTimeout(hidden);
    timers = [];
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = null;
    try { socket.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    socket = null;
    joining = null;
  }

  function lost(message) {
    const expected = joining !== null || player?.alive;
    close();
    // 죽은 뒤나 쉬는 동안 닫힌 것은 알리지 않아요. 다시 시작하면 새로 접속해요.
    if (expected) onLost(message);
  }

  function listen(ms, message) {
    clearTimeout(silent);
    silent = setTimeout(() => lost(message), ms);
  }

  function open() {
    const url = new URL(`${base.replace(/\/+$/, '')}/ws`);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    queue = [];
    clock = null;
    latest = 0;
    try { socket = new WebSocket(url); } catch (error) { console.error(error); return lost('서버 주소가 잘못됐어요.'); }
    const failed = '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.';
    let welcomed = false;
    listen(OPEN_MS, failed);
    socket.onclose = () => lost(welcomed ? '서버와 연결이 끊겼어요. 다시 입장해 주세요.' : failed);
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.t === 'x') return lost(message.message);
      listen(SILENT_MS, '서버 응답이 없어요. 다시 입장해 주세요.');
      if (message.t === 'w') {
        welcomed = true;
        world.worms.clear();
        world.foods.clear();
        eaten.clear();
        sends.clear();
        forget();
        for (const food of message.f) world.foods.set(food[0], unpackFood(food));
        player = null;
        rows = [];
        if (joining !== null) command({ t: 'j', n: joining });
      } else if (message.t === 's') {
        receive(message);
        queue.push(message);
        latest = message.m;
        // 화면이 멈춰 있는 동안 쌓인 것은 바로 반영해요.
        while (queue.length > 120) apply(queue.shift());
      }
    };
    timers.push(setInterval(() => send('p'), PING_MS));
  }

  let pendingDeath = null;

  function grow(worm, grown) {
    worm.colors.push(...unpackColors(grown));
    while (worm.trail.length < worm.colors.length + 1) worm.trail.push({ ...worm.trail[worm.trail.length - 1] });
  }

  // 받자마자 반영하는 것: 먹이, 내 지렁이, 내 죽음
  function receive(state) {
    for (const food of state.fa ?? []) world.foods.set(food[0], unpackFood(food));
    for (const id of state.fr ?? []) {
      world.foods.delete(id);
      eaten.delete(id);
    }
    const now = performance.now();
    if (state.y && state.k) {
      if (state.y !== mineId) {
        const data = state.e?.find((w) => w.i === state.y);
        if (data) {
          mineId = state.y;
          player = unpackWorm(data);
          predictor = createPredictor(player, now);
          world.worms.set(mineId, player);
          joining = null;
          aim = sentAim = null;
        }
      } else if (predictor) {
        const move = state.u.find((m) => m[0] === mineId);
        const [ack, age] = state.k;
        if (move) {
          const [, x, y, angle, flags, grown] = move;
          if (grown) grow(player, grown);
          player.shield = flags & SHIELDED ? 1 : 0;
          const sent = sends.get(ack);
          if (sent !== undefined) {
            ping = Math.max(0, now - sent - age);
            predictor.correct(sent + age, x, y, angle);
            for (const n of sends.keys()) if (n < ack) sends.delete(n);
          }
        }
        if (boostSeq && ack >= boostSeq) {
          boostSeq = 0;
          // 서버가 받아들이지 않은 부스트는 취소해요.
          if (state.b[0] === 0 && age < 500) Object.assign(player, { boostLeft: 0, cooldown: state.b[1] });
        }
      }
    }
    if (state.d && predictor) {
      player.alive = false;
      world.worms.delete(mineId);
      forget();
      pendingDeath = state.d;
    }
  }

  function apply(state) {
    applied = state.m;
    for (const data of state.e ?? []) {
      if (data.i !== mineId && !(player?.id === data.i && !player.alive)) world.worms.set(data.i, unpackWorm(data));
    }
    for (const [id, x, y, angle, flags, grown] of state.u) {
      const worm = world.worms.get(id);
      if (!worm || id === mineId) continue;
      if (grown) grow(worm, grown);
      advance(worm, x, y);
      worm.angle = angle;
      worm.boostLeft = flags & BOOSTING ? 1 : 0;
      worm.shield = flags & SHIELDED ? 1 : 0;
      worm.from = { x, y, angle };
    }
    for (const id of state.l ?? []) {
      if (id === mineId) continue;
      const worm = world.worms.get(id);
      if (worm) worm.alive = false;
      world.worms.delete(id);
    }
    // 아래는 미리 움직이지 않을 때(옛 서버)만 필요해요.
    if (state.y && !state.k) {
      const mine = world.worms.get(state.y);
      if (mine && mine !== player) {
        player = mine;
        joining = null;
        aim = sentAim = null;
      }
    }
    if (state.b && !predictor) boost = { left: state.b[0], cooldown: state.b[1] };
    if (state.r) {
      const mine = state.r.me;
      rows = state.r.top.map(([name, length, id], i) => ({ rank: i + 1, name, length, me: id === state.y }));
      if (mine && mine[0] > rows.length) rows.push({ rank: mine[0], name: player?.name ?? '', length: mine[1], me: true });
    }
    if (state.d && !state.k && player?.alive) {
      player.alive = false;
      pendingDeath = state.d;
    }
  }

  function flushAim() {
    if (aim === null || !player?.alive) return;
    if (sentAim !== null && Math.abs(Math.atan2(Math.sin(aim - sentAim), Math.cos(aim - sentAim))) < 0.04) return;
    const now = performance.now();
    if (now - sentAt < INPUT_MS) return;
    if (command({ t: 'a', a: r2(aim) })) {
      sentAim = aim;
      sentAt = now;
      if (predictor) player.target = r2(aim); // 서버에 보낸 값 그대로 미리 움직여요.
    }
  }

  // 내 머리가 지나간 먹이는 바로 숨겨요. 길어지는 것은 서버가 정해요.
  function hideEaten(now) {
    const range = radiusFor(player.colors.length) + REACH - 2;
    for (const [id, food] of world.foods) {
      if (Math.abs(food.x - player.x) > range || Math.abs(food.y - player.y) > range) continue;
      if (Math.hypot(food.x - player.x, food.y - player.y) > range || eaten.get(id)?.back) continue;
      eaten.set(id, { food, at: now });
      world.foods.delete(id);
    }
    for (const [id, entry] of eaten) {
      if (entry.back || now - entry.at < UNEATEN_MS) continue;
      entry.back = true; // 한 번 되돌린 먹이는 다시 숨기지 않아요.
      world.foods.set(id, entry.food);
    }
  }

  function play(dt) {
    if (clock === null) {
      if (!queue.length) return;
      clock = queue[0].m;
    } else {
      // 최신 상태보다 DELAY_MS 늦은 시각을 따라가요. 시각은 뒤로 가지 않아요.
      const expected = clock + dt * 1000;
      const error = latest - DELAY_MS - expected;
      clock = error > 400 ? latest - DELAY_MS : Math.max(clock, expected + error * Math.min(1, dt * 2));
      clock = Math.min(clock, latest);
    }
    while (queue.length && queue[0].m <= clock) apply(queue.shift());
    const next = queue[0];
    if (!next) return;
    const f = Math.max(0, Math.min(1, (clock - applied) / (next.m - applied)));
    for (const [id, x, y, angle] of next.u) {
      const worm = world.worms.get(id);
      if (!worm || id === mineId) continue;
      const { from } = worm;
      advance(worm, from.x + (x - from.x) * f, from.y + (y - from.y) * f);
      worm.angle = turnToward(from.angle, angle, f);
    }
  }

  function visibility() {
    clearTimeout(hidden);
    if (document.visibilityState === 'hidden') hidden = setTimeout(() => lost('다른 화면에 다녀오는 동안 연결이 끊겼어요.'), HIDDEN_MS);
  }
  globalThis.document?.addEventListener('visibilitychange', visibility);

  return {
    world,
    get player() { return player; },
    get connected() { return socket?.readyState === WebSocket.OPEN; },
    join(name) {
      joining = name;
      player = null;
      forget();
      if (!socket) open();
      else {
        command({ t: 'j', n: name }); // 접속 중이면 환영 메시지를 받은 뒤에 보내요.
        listen(SILENT_MS, '서버 응답이 없어요. 다시 입장해 주세요.');
      }
    },
    steer(angle) { aim = angle; flushAim(); },
    boost() {
      if (!predictor) return void send({ t: 'b' });
      if (player.boostLeft > 0 || player.cooldown > 0) return;
      if (command({ t: 'b' })) {
        boostSeq = seq;
        player.boostLeft = RULES.boostSec;
      }
    },
    boostState: () => (predictor ? { left: player.boostLeft, cooldown: player.cooldown } : boost),
    get ping() { return ping; },
    ranking: () => rows,
    close,
    update(dt) {
      flushAim();
      if (predictor) {
        const now = performance.now();
        predictor.update(now);
        hideEaten(now);
      }
      play(dt);
      const death = pendingDeath;
      pendingDeath = null;
      return death;
    },
  };
}
