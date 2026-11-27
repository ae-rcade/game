// 화면 그리기와 터치 입력. 게임 규칙은 engine.js에 있어요.
import { createGame, WIDTH, HEIGHT, DANGER_Y, DROP_Y, STEP_MS } from './engine.js';

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const BEST_KEY = 'ae-rcade.watermelon.best';

let levels, sprites, game, aimX = WIDTH / 2, aiming = false, effects = [], best = readBest();

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* 저장이 막힌 브라우저 */ }
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function drawPiece(level, x, y, angle = 0) {
  const r = levels[level].radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (sprites[level]) {
    ctx.drawImage(sprites[level], -r, -r, r * 2, r * 2);
  } else {
    // 그림 파일이 없으면 단계 번호가 적힌 원으로 대신해요.
    ctx.fillStyle = '#9CEAFE';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4B3A8C'; ctx.font = `700 ${r}px Galmuri`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(level + 1, 0, 0);
  }
  ctx.restore();
}

function draw() {
  const { state } = game;
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = state.danger > 0 && Math.floor(state.time / 150) % 2 ? '#FF7A9C' : '#E9D3FA';
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(WIDTH, DANGER_Y); ctx.stroke();

  if (!state.over) {
    const r = levels[state.current].radius;
    const x = Math.min(WIDTH - r, Math.max(r, aimX));
    if (aiming) {
      ctx.strokeStyle = '#9CEAFE';
      ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    ctx.globalAlpha = game.canDrop() ? 1 : 0.35;
    drawPiece(state.current, x, DROP_Y);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);

  for (const p of game.pieces) drawPiece(p.level, p.position.x, p.position.y, p.angle);

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
  const src = levels[state.next].image;
  if ($('next').getAttribute('src') !== src) $('next').src = src;
  if (state.over && $('over').hidden) {
    $('final').textContent = state.score;
    $('over').hidden = false;
    $('retry').focus();
  }
}

function start() {
  effects = [];
  game = createGame(levels, { onMerge: (e) => effects.push({ ...e, start: game.state.time }) });
  $('over').hidden = true;
  aimX = WIDTH / 2;
  aiming = false;
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
canvas.addEventListener('pointerdown', (e) => { aiming = true; canvas.setPointerCapture(e.pointerId); point(e); });
canvas.addEventListener('pointermove', point);
canvas.addEventListener('pointerup', (e) => { if (!aiming) return; point(e); aiming = false; game.drop(aimX); });
canvas.addEventListener('pointercancel', () => { aiming = false; });
$('retry').addEventListener('click', start);
$('restart').addEventListener('click', start);

async function init() {
  try {
    if (!window.Matter) throw new Error('물리 라이브러리를 불러오지 못했어요');
    const res = await fetch('characters.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`characters.json: ${res.status}`);
    levels = await res.json();
    sprites = await Promise.all(levels.map((l) => loadImage(l.image)));
  } catch (error) {
    console.error(error);
    $('error').hidden = false;
    return;
  }
  for (const level of levels) {
    const item = document.createElement('li');
    const img = document.createElement('img');
    img.src = level.image;
    img.alt = level.name;
    item.append(img);
    $('order').append(item);
  }
  start();
  new ResizeObserver(resize).observe($('stage'));

  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    // 다른 탭에 다녀와도 한꺼번에 진행되지 않도록 제한
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP_MS) { game.step(); acc -= STEP_MS; }
    draw();
    hud();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

init();
