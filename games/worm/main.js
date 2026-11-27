// 진행 흐름: 닉네임 입력 → 플레이 → 죽으면 바로 다시 시작.
// 1단계는 서버 없이 이 기기에서 세계(world.js)를 돌려요.
import { RULES, cleanName } from './rules.js';
import { createWorld } from './world.js';
import { createBots } from './bots.js';
import { loadSprites } from './sprites.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'ae-rcade.worm.name';
const BEST_KEY = 'ae-rcade.worm.best';
const STEP = 1 / 60;
const DEATH_DELAY_MS = 900;

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* 저장이 막힌 브라우저 */ } };

async function main() {
  const world = createWorld();
  const bots = createBots(world);
  bots.fill();

  const canvas = $('board');
  const renderer = createRenderer(canvas, $('minimap'), await loadSprites());
  new ResizeObserver(() => renderer.resize()).observe($('game'));
  renderer.resize();

  let player = null;
  let playing = false;
  let best = Number(read(BEST_KEY)) || 0;
  const focus = { x: 0, y: 0, worm: null }; // 카메라가 보는 곳

  const input = createInput(canvas, {
    onAim: (angle) => { if (playing) world.steer(player, angle); },
    onBoost: () => { if (playing) world.boost(player); },
  });

  const ranked = () => [...world.worms.values()].sort((a, b) => b.colors.length - a.colors.length || a.id - b.id);

  function updateHud() {
    const list = ranked();
    const mine = list.indexOf(player);
    const rows = list.slice(0, 10).map((worm, i) => [i + 1, worm]);
    if (mine >= 10) rows.push([mine + 1, player]);
    $('ranking').replaceChildren(...rows.map(([rank, worm]) => {
      const li = document.createElement('li');
      if (worm === player) li.className = 'me';
      for (const text of [rank, worm.name, worm.colors.length]) {
        const span = document.createElement('span');
        span.textContent = text;
        li.append(span);
      }
      return li;
    }));
    if (player?.alive) $('length').textContent = player.colors.length;
    renderer.drawMinimap(world, player, performance.now());
  }

  function updateBoost() {
    if (!player) return;
    const ready = player.boostLeft <= 0 && player.cooldown <= 0;
    const fill = player.boostLeft > 0 ? player.boostLeft / RULES.boostSec : 1 - player.cooldown / RULES.boostCooldownSec;
    $('boost').classList.toggle('ready', ready);
    $('boost').classList.toggle('active', player.boostLeft > 0);
    $('boost-fill').style.transform = `scaleX(${fill})`;
  }

  function start(name) {
    player = world.addWorm({ name });
    playing = true;
    input.reset();
    $('menu').hidden = true;
    $('result').hidden = true;
    $('hud').hidden = false;
    updateHud();
  }

  function die({ killer, reason }) {
    playing = false;
    input.reset();
    const length = player.colors.length;
    const rank = 1 + [...world.worms.values()].filter((w) => w.colors.length > length).length;
    const record = length > best;
    if (record) {
      best = length;
      save(BEST_KEY, String(best));
    }
    $('cause').textContent = reason === 'wall' ? '맵 끝에 닿았어요'
      : `${killer.name}의 ${reason === 'head' ? '머리' : '몸'}에 부딪혔어요`;
    $('final').textContent = length;
    $('final-rank').textContent = `${rank}위`;
    $('final-kills').textContent = player.kills;
    $('final-best').textContent = record ? `${best} (새 기록!)` : best;
    const dead = player;
    // 먹이로 변하는 모습을 잠깐 보여 준 뒤 결과를 띄워요.
    setTimeout(() => {
      if (player !== dead || playing) return;
      $('hud').hidden = true;
      $('result').hidden = false;
      $('again').focus({ preventScroll: true });
    }, DEATH_DELAY_MS);
  }

  $('join').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = cleanName($('name').value);
    if (!name) {
      $('message').textContent = '닉네임을 입력해 주세요.';
      $('name').focus();
      return;
    }
    $('message').textContent = '';
    save(NAME_KEY, name);
    // 휴대폰 자판을 닫고 화면 위치를 되돌려요.
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    start(name);
  });
  $('again').addEventListener('click', () => {
    document.activeElement?.blur();
    start(player.name);
  });
  $('rename').addEventListener('click', () => {
    $('result').hidden = true;
    $('menu').hidden = false;
  });

  $('name').value = read(NAME_KEY) || '';
  $('enter').disabled = false;

  let last = performance.now();
  let hudWait = 0;
  function frame(now) {
    // 다른 앱에 다녀오면 그동안의 시간은 건너뛰어요.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    for (let remain = dt; remain > 1e-6; remain -= STEP) {
      const step = Math.min(STEP, remain);
      bots.update(step);
      for (const event of world.step(step)) {
        if (event.type === 'death' && event.worm === player && playing) die(event);
      }
    }

    // 시작 전에는 가장 긴 지렁이를 구경해요. 죽은 직후에는 그 자리에 머물러요.
    if (playing) focus.worm = player;
    else if (!player) focus.worm = focus.worm?.alive ? focus.worm : ranked()[0];
    if (focus.worm?.alive) { focus.x = focus.worm.x; focus.y = focus.worm.y; }

    renderer.draw({ world, focus, player, stick: playing ? input.stick() : null, time: now, dt });
    if (playing) updateBoost();
    hudWait -= dt;
    if (hudWait <= 0 && !$('hud').hidden) {
      hudWait = 0.2;
      updateHud();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((error) => {
  console.error(error);
  $('error').hidden = false;
});
