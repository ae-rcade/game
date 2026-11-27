// 진행 흐름: 닉네임 입력 → 플레이 → 죽으면 바로 다시 시작.
// config.json에 서버 주소가 있으면 여러 명이 함께(online.js), 없으면 혼자(local.js) 해요.
import { RULES, cleanName } from './rules.js';
import { createLocal } from './local.js';
import { createOnline } from './online.js';
import { loadSprites } from './sprites.js';
import { createRenderer } from './render.js';
import { createInput, blockZoom } from './input.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'ae-rcade.worm.name';
const BEST_KEY = 'ae-rcade.worm.best';
const DEATH_DELAY_MS = 900;

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* 저장이 막힌 브라우저 */ } };

blockZoom(document.querySelector('.app'));

async function serverUrl() {
  try {
    const response = await fetch('config.json', { cache: 'no-cache' });
    return String((await response.json()).serverUrl || '').trim();
  } catch (error) {
    console.warn('config.json을 읽지 못해 혼자 하기로 시작해요.', error);
    return '';
  }
}

async function main() {
  const canvas = $('board');
  const [sprites, url] = await Promise.all([loadSprites(), serverUrl()]);
  const renderer = createRenderer(canvas, sprites);
  new ResizeObserver(() => renderer.resize()).observe($('game'));
  renderer.resize();

  const local = createLocal();
  const online = url ? createOnline(url, { onLost: lost }) : null;
  const game = online ?? local; // 내가 플레이하는 곳
  let shown = local;            // 화면에 보여 주는 곳 (서버에 들어가기 전에는 혼자 도는 세계)
  let waiting = false;          // 입장을 기다리는 중
  let playing = false;
  let player = null;
  let name = '';
  let best = Number(read(BEST_KEY)) || 0;
  let resultTimer = 0;
  const focus = { x: 0, y: 0, worm: null }; // 카메라가 보는 곳

  const input = createInput(canvas, {
    onAim: (angle) => { if (playing) game.steer(angle); },
    onBoost: () => { if (playing) game.boost(); },
  });

  function updateHud() {
    $('ranking').replaceChildren(...game.ranking().map((row) => {
      const li = document.createElement('li');
      if (row.me) li.className = 'me';
      for (const text of [row.rank, row.name, row.length]) {
        const span = document.createElement('span');
        span.textContent = text;
        li.append(span);
      }
      return li;
    }));
  }

  function updateBoost() {
    const { left, cooldown } = game.boostState();
    const ready = left <= 0 && cooldown <= 0;
    const fill = left > 0 ? left / RULES.boostSec : 1 - cooldown / RULES.boostCooldownSec;
    $('boost').classList.toggle('ready', ready);
    $('boost').classList.toggle('active', left > 0);
    $('boost-fill').style.transform = `scaleX(${fill})`;
  }

  function setWaiting(value) {
    waiting = value;
    $('enter').disabled = $('again').disabled = value;
  }

  function start() {
    clearTimeout(resultTimer);
    setWaiting(true);
    if (online) $('message').textContent = $('wait').textContent = '서버에 접속하는 중…';
    game.join(name);
  }

  // 내 지렁이가 나타나면 플레이 화면으로 바꿔요.
  function entered() {
    player = game.player;
    shown = game;
    setWaiting(false);
    playing = true;
    input.reset();
    $('message').textContent = $('wait').textContent = '';
    $('menu').hidden = true;
    $('result').hidden = true;
    $('hud').hidden = false;
    updateHud();
  }

  function die({ reason, killer, length, rank, kills }) {
    playing = false;
    input.reset();
    const record = length > best;
    if (record) {
      best = length;
      save(BEST_KEY, String(best));
    }
    $('cause').textContent = reason === 'wall' ? '맵 끝에 닿았어요'
      : `${killer}의 ${reason === 'head' ? '머리' : '몸'}에 부딪혔어요`;
    $('final').textContent = length;
    $('final-rank').textContent = `${rank}위`;
    $('final-kills').textContent = kills;
    $('final-best').textContent = record ? `${best} (새 기록!)` : best;
    // 먹이로 변하는 모습을 잠깐 보여 준 뒤 결과를 띄워요.
    resultTimer = setTimeout(() => {
      $('hud').hidden = true;
      $('result').hidden = false;
      $('again').focus({ preventScroll: true });
    }, DEATH_DELAY_MS);
  }

  // 서버 연결이 끊기면 입장 화면에서 알려 줘요.
  function lost(message) {
    clearTimeout(resultTimer);
    playing = false;
    setWaiting(false);
    input.reset();
    shown = local; // 배경은 다시 구경 화면으로
    player = null;
    focus.worm = null;
    $('wait').textContent = '';
    $('message').textContent = message;
    $('hud').hidden = true;
    $('result').hidden = true;
    $('menu').hidden = false;
  }

  $('join').addEventListener('submit', (event) => {
    event.preventDefault();
    if (waiting) return;
    name = cleanName($('name').value);
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
    start();
  });
  $('again').addEventListener('click', () => {
    document.activeElement?.blur();
    if (!waiting) start();
  });
  $('rename').addEventListener('click', () => {
    setWaiting(false);
    $('result').hidden = true;
    $('menu').hidden = false;
  });

  $('name').value = read(NAME_KEY) || '';
  $('enter').disabled = false;

  // 주소 끝에 ?ping 을 붙이면 서버를 다녀오는 시간을 보여 줘요.
  const pingBox = online && new URLSearchParams(location.search).has('ping') ? document.createElement('div') : null;
  if (pingBox) {
    pingBox.id = 'ping';
    $('game').append(pingBox);
  }

  let last = performance.now();
  let hudWait = 0;
  function frame(now) {
    // 다른 앱에 다녀오면 그동안의 시간은 건너뛰어요.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (online && shown === local) local.update(dt);
    const death = game.update(dt);
    if (waiting && game.player?.alive) entered();
    if (death && playing) die(death);

    // 시작 전에는 가장 긴 지렁이를 구경해요. 죽은 직후에는 그 자리에 머물러요.
    if (playing) focus.worm = player;
    else if (shown === local && !player) focus.worm = focus.worm?.alive ? focus.worm : local.leader();
    if (focus.worm?.alive) { focus.x = focus.worm.x; focus.y = focus.worm.y; }

    renderer.draw({ world: shown.world, focus, player, stick: playing ? input.stick() : null, time: now, dt });
    if (playing) updateBoost();
    hudWait -= dt;
    if (hudWait <= 0 && !$('hud').hidden) {
      hudWait = 0.2;
      updateHud();
      if (pingBox) pingBox.textContent = online.ping === null ? '' : `지연 ${Math.round(online.ping)}ms`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((error) => {
  console.error(error);
  $('error').hidden = false;
});
