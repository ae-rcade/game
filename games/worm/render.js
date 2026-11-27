// 맵, 먹이, 지렁이 그리기. 규칙은 바꾸지 않고 세계의 상태를 보여 주기만 해요.
import { RULES, KINDS, radiusFor } from './rules.js';
import { segment } from './world.js';
import { createBorder } from './border.js';

const TILE = 160;
const FOOD_SIZE = 22;
const BIG_FOOD_SIZE = 28;

// 오락실 바닥 무늬: 두 가지 색 칸과 작은 도트 별
function floorTile() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const g = canvas.getContext('2d');
  g.fillStyle = '#35276F';
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle = '#3B2C7A';
  g.fillRect(0, 0, TILE / 2, TILE / 2);
  g.fillRect(TILE / 2, TILE / 2, TILE / 2, TILE / 2);
  g.fillStyle = 'rgba(156, 234, 254, .13)';
  for (const at of [0, TILE / 2]) {
    g.fillRect(at, 0, 2, TILE);
    g.fillRect(0, at, TILE, 2);
  }
  for (const [x, y, color] of [[34, 46, '#9CEAFE'], [118, 22, '#C88DDD'], [132, 118, '#9CEAFE'], [52, 132, '#C88DDD']]) {
    g.fillStyle = color;
    g.globalAlpha = 0.45;
    g.fillRect(x - 1, y - 5, 3, 11);
    g.fillRect(x - 5, y - 1, 11, 3);
  }
  return canvas;
}

export function createRenderer(canvas, sprites) {
  const ctx = canvas.getContext('2d');
  const floor = ctx.createPattern(floorTile(), 'repeat');
  const border = createBorder();
  let width = 1;
  let height = 1;
  let ratio = 1;
  let zoom = null;

  function resize() {
    ratio = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }

  function drawWorm(worm, view, time) {
    const radius = radiusFor(worm.colors.length);
    const p = { x: 0, y: 0 };
    const seen = (x, y) => x > view.left - 30 && x < view.right + 30 && y > view.top - 30 && y < view.bottom + 30;
    ctx.globalAlpha = worm.shield > 0 ? 0.55 + 0.25 * Math.sin(time / 70) : 1;
    ctx.imageSmoothingEnabled = false;
    if (worm.boostLeft > 0) {
      ctx.fillStyle = 'rgba(156, 234, 254, .35)';
      for (let i = worm.colors.length; i >= 0; i -= 3) {
        if (i === 0) { p.x = worm.x; p.y = worm.y; } else segment(worm, i, p);
        if (!seen(p.x, p.y)) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius * 1.55, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = worm.colors.length; i >= 1; i--) {
      segment(worm, i, p);
      if (!seen(p.x, p.y)) continue;
      // 꼬리 끝은 조금 가늘게
      const r = radius * Math.min(1, 0.7 + (worm.colors.length - i) * 0.05);
      ctx.drawImage(sprites.bodies[worm.colors[i - 1]], p.x - r, p.y - r, r * 2, r * 2);
    }
    if (seen(worm.x, worm.y)) {
      const r = radius * 1.18;
      ctx.save();
      ctx.translate(worm.x, worm.y);
      ctx.rotate(worm.angle);
      ctx.drawImage(sprites.heads[worm.color], -r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function draw({ world, focus, player, stick, time, dt }) {
    const radius = focus.worm ? radiusFor(focus.worm.colors.length) : 9;
    const wanted = width / (400 + (radius - 9) * 16);
    zoom = zoom === null ? wanted : zoom + (wanted - zoom) * Math.min(1, dt * 3);
    const view = {
      left: focus.x - width / zoom / 2, right: focus.x + width / zoom / 2,
      top: focus.y - height / zoom / 2, bottom: focus.y + height / zoom / 2,
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 맵 바깥은 검은 뱀이 잘 보이도록 밝은 보라색이에요.
    ctx.fillStyle = '#53399A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = zoom * ratio;
    ctx.setTransform(scale, 0, 0, scale, -view.left * scale, -view.top * scale);

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, RULES.mapRadius, 0, Math.PI * 2); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = floor;
    ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    ctx.restore();

    border.draw(ctx, view, time);

    ctx.imageSmoothingEnabled = true;
    for (const food of world.foods.values()) {
      if (food.x < view.left - 30 || food.x > view.right + 30 || food.y < view.top - 30 || food.y > view.bottom + 30) continue;
      const size = food.big ? BIG_FOOD_SIZE : FOOD_SIZE;
      const y = food.y + Math.sin(time / 260 + food.id) * 1.6;
      if (food.big) {
        ctx.fillStyle = KINDS[food.kind].color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath(); ctx.arc(food.x, y, size * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(sprites.foods[food.kind], food.x - size / 2, y - size / 2, size, size);
    }

    const worms = [...world.worms.values()];
    // 내 지렁이를 맨 위에 그려요.
    for (const worm of worms) if (worm !== player) drawWorm(worm, view, time);
    if (player?.alive) drawWorm(player, view, time);

    ctx.font = `${12 / zoom}px Galmuri, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 / zoom;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#241A4A';
    for (const worm of worms) {
      const y = worm.y - radiusFor(worm.colors.length) - 12;
      ctx.strokeText(worm.name, worm.x, y);
      ctx.fillStyle = worm === player ? '#9CEAFE' : '#FFFFFF';
      ctx.fillText(worm.name, worm.x, y);
    }

    // 끌고 있는 손가락 위치 표시
    if (stick) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(156, 234, 254, .55)';
      ctx.beginPath(); ctx.arc(stick.anchorX, stick.anchorY, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(200, 141, 221, .75)';
      ctx.beginPath(); ctx.arc(stick.x, stick.y, 13, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { resize, draw };
}
