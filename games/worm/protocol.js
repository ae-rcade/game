// 화면과 서버가 주고받는 형식. 양쪽에서 함께 쓰므로 화면 관련 코드는 넣지 않아요.
import { RULES } from './rules.js';

export const TICK_MS = 66;        // 서버가 상태를 보내는 간격(초당 약 15번)
export const DELAY_MS = 140;      // 화면은 이만큼 늦게 보여 주며 사이를 부드럽게 이어요.
export const INPUT_MS = 100;      // 방향은 이 간격보다 자주 보내지 않아요(무료 한도 절약).
export const PING_MS = 10_000;    // 접속 중임을 알리는 간격
const SAMPLE = 3;                 // 처음 보이는 지렁이의 몸은 이 마디마다 한 점만 보내요.

export const BOOSTING = 1;
export const SHIELDED = 2;

const r1 = (v) => Math.round(v * 10) / 10;
export const r2 = (v) => Math.round(v * 100) / 100;

export const packColors = (colors) => colors.map((k) => k.toString(36)).join('');
export const unpackColors = (text) => Array.from(text, (c) => parseInt(c, 36));

export const packFood = (f) => [f.id, r1(f.x), r1(f.y), f.kind, f.big ? 1 : 0];
export const unpackFood = ([id, x, y, kind, big]) => ({ id, x, y, kind, big: big === 1 });

const flags = (w) => (w.boostLeft > 0 ? BOOSTING : 0) | (w.shield > 0 ? SHIELDED : 0);

// 매번 보내는 짧은 형식: [번호, x, y, 방향, 상태, 새로 붙은 마디 색]
export function packMove(worm, grown) {
  const move = [worm.id, r1(worm.x), r1(worm.y), r2(worm.angle), flags(worm)];
  if (grown) move.push(grown);
  return move;
}

// 처음 보이게 된 지렁이는 몸 전체를 보내요.
export function packWorm(worm) {
  const length = worm.colors.length;
  const points = [];
  for (let i = 0; i < length + SAMPLE; i += SAMPLE) {
    const p = worm.trail[Math.min(i, length)];
    points.push(r1(p.x), r1(p.y));
  }
  return {
    i: worm.id, n: worm.name, c: worm.color, x: r1(worm.x), y: r1(worm.y), a: r2(worm.angle), f: flags(worm),
    k: r2(worm.carry), s: packColors(worm.colors), p: points,
  };
}

export function unpackWorm(data) {
  const colors = unpackColors(data.s);
  const trail = [];
  for (let i = 0; i <= colors.length; i++) {
    const low = Math.floor(i / SAMPLE);
    const start = low * SAMPLE;
    const span = Math.min(SAMPLE, colors.length - start);
    const t = span ? (i - start) / span : 0;
    const high = span ? low + 1 : low;
    trail.push({
      x: data.p[low * 2] + (data.p[high * 2] - data.p[low * 2]) * t,
      y: data.p[low * 2 + 1] + (data.p[high * 2 + 1] - data.p[low * 2 + 1]) * t,
    });
  }
  return {
    id: data.i, name: data.n, color: data.c, x: data.x, y: data.y, angle: data.a,
    carry: Math.min(data.k, RULES.spacing), colors, trail, alive: true,
    boostLeft: data.f & BOOSTING ? 1 : 0, shield: data.f & SHIELDED ? 1 : 0,
    from: { x: data.x, y: data.y, angle: data.a },
  };
}
