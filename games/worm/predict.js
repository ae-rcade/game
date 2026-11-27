// 내 지렁이는 서버를 기다리지 않고 바로 움직여요. 서버 위치가 오면 차이만큼 조금씩 맞춰요.
import { moveWorm } from './world.js';

const KEEP_MS = 3000;   // 지나온 위치를 기억하는 시간
const SNAP = 120;       // 이보다 많이 어긋나면 바로 옮겨요.
const EASE = 8;         // 작게 어긋나면 초당 이 비율로 맞춰요.
const STEP = 1 / 60;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createPredictor(worm, now) {
  Object.assign(worm, { target: worm.angle, pending: [], boostLeft: 0, cooldown: 0 });
  let past = [{ t: now, x: worm.x, y: worm.y, angle: worm.angle }];
  let last = now;
  const error = { x: 0, y: 0, angle: 0 }; // 아직 맞추지 못한 차이

  // 지금 위치와 기억해 둔 위치를 함께 옮겨요.
  function shift(x, y, angle) {
    worm.x += x;
    worm.y += y;
    worm.angle += angle;
    for (const p of past) {
      p.x += x;
      p.y += y;
      p.angle += angle;
    }
  }

  function at(t) {
    let i = past.length - 1;
    while (i > 0 && past[i - 1].t >= t) i--;
    const b = past[i];
    const a = past[i - 1] ?? b;
    const f = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: a.angle + wrap(b.angle - a.angle) * f };
  }

  return {
    update(time) {
      const dt = Math.max(0, Math.min(0.25, (time - last) / 1000));
      last = time;
      for (let remain = dt; remain > 1e-6; remain -= STEP) moveWorm(worm, Math.min(STEP, remain));
      past.push({ t: time, x: worm.x, y: worm.y, angle: worm.angle });
      while (past.length > 2 && past[0].t < time - KEEP_MS) past.shift();
      const f = Math.min(1, dt * EASE);
      shift(error.x * f, error.y * f, error.angle * f);
      error.x *= 1 - f;
      error.y *= 1 - f;
      error.angle *= 1 - f;
    },
    // 서버 위치(x, y, angle)가 내 화면의 시각 when의 모습이어야 해요.
    correct(when, x, y, angle) {
      if (when < past[0].t) return;
      const mine = at(when);
      error.x = x - mine.x;
      error.y = y - mine.y;
      error.angle = wrap(angle - mine.angle);
      if (Math.hypot(error.x, error.y) < SNAP) return;
      for (const p of worm.trail) {
        p.x += error.x;
        p.y += error.y;
      }
      shift(error.x, error.y, error.angle);
      error.x = error.y = error.angle = 0;
    },
  };
}
