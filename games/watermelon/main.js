// 진행 흐름, 화면 그리기, 터치 입력. 게임 규칙은 engine.js, 순위 화면은 panel.js에 있어요.
import { createGame, WIDTH, HEIGHT, DANGER_Y, DROP_Y, STEP_MS } from './engine.js';
import { analyze } from './shape.js';
import { MODES, COUNTDOWN_MS } from './modes.js';
import { createRanking } from './ranking.js';
import { createPanel } from './panel.js';

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const bestKey = (mode) => (mode === 'endless' ? 'ae-rcade.watermelon.best' : `ae-rcade.watermelon.best.${mode}`);

let levels, sprites, shapes, thumbs, game, ranking, panel;
let aimX = WIDTH / 2, aiming = false, effects = [], best = 0;
// phase: 'menu' 모드 선택, 'countdown' 시작 대기, 'playing' 진행, 'over' 종료
let phase = 'menu', mode = 'endless', countdown = 0, session = null;

function readBest() {
  try { return Number(localStorage.getItem(bestKey(mode))) || 0; } catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem(bestKey(mode), String(best)); } catch { /* 저장이 막힌 브라우저 */ }
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  // 같은 이름으로 다시 올린 그림이 바로 반영되도록 저장된 사본을 확인해요.
  fetch(src, { cache: 'no-cache' }).catch(() => {}).finally(() => { img.src = src; });
});

// 그림 파일이 없으면 단계 번호가 적힌 원을 대신 만들어요.
function numberBall(number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9CEAFE';
  g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4B3A8C'; g.font = '700 64px Galmuri, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(number, 64, 64);
  return c;
}

function drawPiece(level, x, y, angle = 0, offset = { x: 0, y: 0 }) {
  const r = levels[level].radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const img = sprites[level];
  ctx.translate(offset.x, offset.y);
  if (!shapes[level]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); }
  ctx.imageSmoothingEnabled = img.width > 128; // 작은 픽셀 그림은 또렷하게, 큰 사진은 부드럽게
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
}

function draw() {
  const { state } = game;
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = state.danger > 0 && Math.floor(state.time / 150) % 2 ? '#FF7A9C' : '#E9D3FA';
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(WIDTH, DANGER_Y); ctx.stroke();

  if (!state.over && phase !== 'menu') {
    const r = levels[state.current].radius;
    const x = Math.min(WIDTH - r, Math.max(r, aimX));
    if (aiming) {
      ctx.strokeStyle = '#9CEAFE';
      ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    ctx.globalAlpha = phase === 'playing' && game.canDrop() ? 1 : 0.35;
    drawPiece(state.current, x, DROP_Y);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);

  for (const p of game.pieces) drawPiece(p.level, p.position.x, p.position.y, p.angle, p.offset);

  ctx.textAlign = 'center';
  ctx.font = '700 18px Galmuri';
  for (const e of effects) {
    const t = (state.time - e.start) / 600;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, levels[e.level].radius * (1 + t * 0.5), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`+${e.gained}`, e.x, e.y - t * 30);
  }
  ctx.globalAlpha = 1;
  effects = effects.filter((e) => state.time - e.start < 600);
}

function hud() {
  const { state } = game;
  if (state.score > best) { best = state.score; saveBest(); }
  $('score').textContent = state.score;
  $('best').textContent = best;
  const src = thumbs[state.next];
  if ($('next').getAttribute('src') !== src) $('next').src = src;
  $('next').classList.toggle('round', !shapes[state.next]);
  if (MODES[mode].durationMs) {
    const seconds = Math.ceil(state.timeLeft / 1000);
    $('time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('time').classList.toggle('urgent', seconds <= 10);
  }
}

function showCountdown(text) {
  $('countdown').hidden = !text;
  if (text && $('countdown').textContent !== text) $('countdown').textContent = text;
}

function newGame() {
  effects = [];
  aimX = WIDTH / 2;
  aiming = false;
  game = createGame(levels, {
    shapes,
    durationMs: MODES[mode].durationMs,
    onMerge: (e) => effects.push({ ...e, start: game.state.time }),
  });
  best = readBest();
  $('time-box').hidden = !MODES[mode].durationMs;
}

function showMenu() {
  phase = 'menu';
  panel.close();
  showCountdown('');
  newGame();
  $('menu').hidden = false;
}

function start(nextMode = mode) {
  mode = nextMode;
  panel.close();
  $('menu').hidden = true;
  newGame();
  // 랭킹 등록에 쓰는 시작 확인값. 연결에 실패해도 게임은 할 수 있어요.
  session = ranking.start(mode).catch((error) => { console.warn(error); return null; });
  countdown = MODES[mode].durationMs ? COUNTDOWN_MS : 0;
  phase = countdown ? 'countdown' : 'playing';
  showCountdown(countdown ? String(COUNTDOWN_MS / 1000) : '');
}

function finish() {
  phase = 'over';
  aiming = false;
  showCountdown('');
  panel.showResult(mode, { score: game.state.score, reason: game.state.reason, session, rank: null });
}

function resize() {
  const box = $('stage').getBoundingClientRect();
  const scale = Math.min(box.width / WIDTH, box.height / HEIGHT);
  if (scale <= 0) return;
  const w = Math.floor(WIDTH * scale);
  const h = Math.floor(HEIGHT * scale);
  $('field').style.width = `${w}px`;
  $('field').style.height = `${h}px`;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * ratio;
  canvas.height = h * ratio;
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  aimX = ((event.clientX - rect.left) / rect.width) * WIDTH;
}
// 누른 채 좌우로 움직이고, 손을 떼면 떨어져요.
canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing') return;
  aiming = true; canvas.setPointerCapture(e.pointerId); point(e);
});
canvas.addEventListener('pointermove', point);
canvas.addEventListener('pointerup', (e) => { if (!aiming) return; point(e); aiming = false; game.drop(aimX); });
canvas.addEventListener('pointercancel', () => { aiming = false; });

async function init() {
  try {
    if (!window.Matter) throw new Error('물리 라이브러리를 불러오지 못했어요');
    const res = await fetch('characters.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`characters.json: ${res.status}`);
    levels = await res.json();
    ranking = await createRanking();
    const images = await Promise.all(levels.map((l) => loadImage(l.image)));
    const parts = images.map((img, i) => analyze(img || numberBall(i + 1)));
    sprites = parts.map((p) => p.sprite);
    shapes = parts.map((p) => p.parts);
    thumbs = sprites.map((c) => c.toDataURL());
  } catch (error) {
    console.error(error);
    $('error').hidden = false;
    return;
  }
  for (const [i, level] of levels.entries()) {
    const item = document.createElement('li');
    const img = document.createElement('img');
    img.src = thumbs[i];
    img.alt = level.name;
    img.classList.toggle('round', !shapes[i]);
    item.append(img);
    $('order').append(item);
  }
  panel = createPanel(ranking);
  for (const [id, { label }] of Object.entries(MODES)) {
    $(`start-${id}`).querySelector('strong').textContent = label;
    $(`start-${id}`).addEventListener('click', () => start(id));
  }
  $('restart').addEventListener('click', () => start());
  $('retry').addEventListener('click', () => start());
  $('to-menu').addEventListener('click', showMenu);
  $('menu-ranking').addEventListener('click', () => panel.showRanking(mode, '닫기'));
  // 순위를 보는 동안에는 게임과 남은 시간이 멈춰요.
  $('rank').addEventListener('click', () => { aiming = false; panel.showRanking(mode); });
  $('resume').addEventListener('click', () => panel.close());
  $('scope-menu').hidden = ranking.shared;
  showMenu();
  new ResizeObserver(resize).observe($('stage'));

  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    // 다른 탭에 다녀와도 한꺼번에 진행되지 않도록 제한
    const passed = Math.min(100, now - last);
    last = now;
    if (panel.isOpen || phase === 'menu' || phase === 'over') {
      acc = 0;
    } else if (phase === 'countdown') {
      countdown -= passed;
      if (countdown > 0) showCountdown(String(Math.ceil(countdown / 1000)));
      else { phase = 'playing'; showCountdown('START!'); }
    } else {
      acc += passed;
      while (acc >= STEP_MS && !game.state.over) { game.step(); acc -= STEP_MS; }
      if (game.state.time > 600) showCountdown('');
      if (game.state.over) finish();
    }
    draw();
    hud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

init();
