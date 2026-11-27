// 서버 주소가 없을 때와 시작 전 배경: 이 기기 안에서 혼자(상대는 봇) 돌려요.
import { createWorld } from './world.js';
import { createBots } from './bots.js';

const STEP = 1 / 60;
const TOP = 5;

export function createLocal() {
  const world = createWorld();
  const bots = createBots(world);
  bots.fill();
  let player = null;

  const ranked = () => [...world.worms.values()].sort((a, b) => b.colors.length - a.colors.length || a.id - b.id);

  return {
    world,
    get player() { return player; },
    join(name) { player = world.addWorm({ name }); },
    steer(angle) { if (player?.alive) world.steer(player, angle); },
    boost() { if (player?.alive) world.boost(player); },
    boostState: () => ({ left: player?.boostLeft ?? 0, cooldown: player?.cooldown ?? 0 }),
    // 시간을 진행해요. 내가 죽었으면 그 내용을 돌려줘요.
    update(dt) {
      let death = null;
      for (let remain = dt; remain > 1e-6; remain -= STEP) {
        const step = Math.min(STEP, remain);
        bots.update(step);
        for (const event of world.step(step)) {
          if (event.type !== 'death' || event.worm !== player) continue;
          const length = player.colors.length;
          death = {
            reason: event.reason, killer: event.killer?.name ?? null, length, kills: player.kills,
            rank: 1 + [...world.worms.values()].filter((w) => w.colors.length > length).length,
          };
        }
      }
      return death;
    },
    // 순위표 줄: 상위 5명, 내가 밖이면 내 줄을 덧붙여요.
    ranking() {
      const list = ranked();
      const mine = list.indexOf(player);
      const rows = list.slice(0, TOP).map((w, i) => ({ rank: i + 1, name: w.name, length: w.colors.length, me: w === player }));
      if (mine >= TOP) rows.push({ rank: mine + 1, name: player.name, length: player.colors.length, me: true });
      return rows;
    },
    leader: () => ranked()[0] ?? null,
  };
}
