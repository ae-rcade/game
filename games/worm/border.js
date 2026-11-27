// 맵을 둘러싼 검은 독사. 보여 주기만 하며, 죽는 판정은 world.js의 맵 반지름 그대로예요.
import { RULES } from './rules.js';

const LAP_SEC = 160;      // 머리가 맵을 한 바퀴 도는 시간(초). 클수록 느려요.
const WIDTH = 108;        // 몸 굵기
const CENTER = RULES.mapRadius + 2 + WIDTH / 2; // 몸 가운데 선의 반지름
const HEAD_OUT = 22;      // 머리는 몸보다 넓어서 이만큼 바깥에 놓아요.
const TILE = 96;          // 몸 무늬 한 칸의 길이
const DOT = 3;            // 몸의 도트 크기
const HEAD_DOT = 2.5;     // 머리의 도트 크기
const HEAD_BOX = { left: -120, right: 140, top: -100, bottom: 100 };

// 늘 같은 값이 나오는 간단한 난수 (반짝임 위치용)
const noise = (n) => {
  const v = Math.sin(n * 91.73 + 17.1) * 43758.5453;
  return v - Math.floor(v);
};

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// 검은 비닐의 결: 가장자리는 어둡고, 날카로운 광택 줄이 지나가요.
function vinyl(g, top, bottom) {
  const gradient = g.createLinearGradient(0, top, 0, bottom);
  for (const [at, color] of [
    [0, '#07050D'], [0.1, '#2A2240'], [0.2, '#0B0813'], [0.46, '#050409'], [0.6, '#17121F'],
    [0.68, '#575073'], [0.72, '#D9D3F2'], [0.76, '#443D5C'], [0.84, '#0A0811'], [1, '#030206'],
  ]) gradient.addColorStop(at, color);
  return gradient;
}

// 몸 한 칸. 위쪽이 맵 바깥, 아래쪽이 맵 안쪽이에요.
function bodyTile(variant) {
  const w = TILE / DOT;
  const h = WIDTH / DOT;
  const canvas = canvasOf(w, h);
  const g = canvas.getContext('2d');
  g.fillStyle = vinyl(g, 0, h);
  g.fillRect(0, 0, w, h);
  // 비늘
  g.lineWidth = 1;
  for (let row = 0; row * 6 < h; row++) {
    for (let x = (row % 2) * 4 - 8; x < w + 8; x += 8) {
      const y = row * 6 + 1;
      g.strokeStyle = 'rgba(122, 104, 168, .42)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 3); g.lineTo(x, y + 6); g.stroke();
      if (noise(variant * 100 + row * 13 + ((x + 16) % w)) > 0.82) {
        g.fillStyle = 'rgba(214, 205, 255, .55)';
        g.fillRect(x + 2, y + 2, 2, 1);
      }
    }
  }
  // 비닐이 접힌 듯한 빛줄기
  for (let i = 0; i < 4; i++) {
    const x = 3 + noise(variant * 7 + i) * (w - 14);
    const y = 3 + noise(variant * 11 + i + 5) * (h - 10);
    g.strokeStyle = i % 2 ? 'rgba(156, 234, 254, .5)' : 'rgba(255, 255, 255, .45)';
    g.beginPath(); g.moveTo(x, y + 3); g.quadraticCurveTo(x + 5, y - 1, x + 6 + noise(i + variant) * 6, y); g.stroke();
  }
  // 테두리에 비치는 사이트 색 빛
  g.fillStyle = '#C88DDD';
  g.fillRect(0, 0, w, 1);
  g.fillStyle = '#9CEAFE';
  g.fillRect(0, h - 1, w, 1);
  return canvas;
}

// 위에서 본 독사 머리. 오른쪽이 앞, 아래쪽이 맵 안쪽이에요.
function headSprite() {
  const box = HEAD_BOX;
  const canvas = canvasOf((box.right - box.left) / HEAD_DOT, (box.bottom - box.top) / HEAD_DOT);
  const g = canvas.getContext('2d');
  g.scale(1 / HEAD_DOT, 1 / HEAD_DOT);
  g.translate(-box.left, -box.top);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const path = (points) => {
    g.beginPath();
    for (const [kind, ...v] of points) {
      if (kind === 'M') g.moveTo(...v);
      else if (kind === 'L') g.lineTo(...v);
      else if (kind === 'Q') g.quadraticCurveTo(...v);
      else g.bezierCurveTo(...v);
    }
    g.closePath();
  };
  const both = (draw) => { for (const side of [-1, 1]) draw(side); };

  // 세모꼴로 벌어진 턱과 뾰족한 주둥이
  const outline = [['M', -88, -30], ['C', -76, -66, -50, -84, -24, -74], ['C', 6, -62, 34, -48, 72, -38],
    ['Q', 112, -27, 122, 0], ['Q', 112, 27, 72, 38], ['C', 34, 48, 6, 62, -24, 74], ['C', -50, 84, -76, 66, -88, 30],
    ['Q', -70, 0, -88, -30]];
  path(outline);
  // 머리 아래에 그림자를 깔아 몸과 구분해요. (그림자 값은 화면 크기 기준이라 도트 크기로 나눠요.)
  g.shadowColor = 'rgba(0, 0, 0, .95)';
  g.shadowBlur = 34 / HEAD_DOT;
  g.fillStyle = '#000';
  g.fill();
  g.shadowColor = 'transparent';
  const skin = g.createRadialGradient(-10, -12, 8, -5, 0, 120);
  skin.addColorStop(0, '#2B2440');
  skin.addColorStop(0.5, '#100C1B');
  skin.addColorStop(1, '#030206');
  g.fillStyle = skin;
  g.fill();
  g.strokeStyle = '#8D6AC0';
  g.lineWidth = 4;
  g.stroke();

  // 정수리 비늘과 가운데 능선
  g.save();
  path(outline);
  g.clip();
  g.strokeStyle = 'rgba(134, 114, 184, .5)';
  g.lineWidth = 2.5;
  for (let x = -76; x < 20; x += 15) {
    const spread = 54 - Math.max(0, x) * 0.8;
    for (let y = -spread; y <= spread; y += 18) {
      const shift = Math.round((x + 76) / 15) % 2 ? 9 : 0;
      g.beginPath(); g.moveTo(x, y + shift - 7); g.lineTo(x + 9, y + shift); g.lineTo(x, y + shift + 7); g.stroke();
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(196, 180, 240, .75)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-70, 0); g.lineTo(32, 0); g.stroke();

  // 비닐 광택
  g.fillStyle = 'rgba(235, 230, 255, .82)';
  path([['M', -62, -50], ['Q', -34, -70, -2, -54], ['Q', -34, -60, -62, -50]]);
  g.fill();
  path([['M', 54, -24], ['Q', 92, -22, 106, -6], ['Q', 84, -14, 54, -24]]);
  g.fill();
  g.fillStyle = 'rgba(156, 234, 254, .55)';
  path([['M', -58, 56], ['Q', -34, 68, -6, 54], ['Q', -32, 60, -58, 56]]);
  g.fill();

  both((s) => {
    // 눈: 세로로 찢어진 눈동자
    path([['M', 14, s * 37], ['Q', 38, s * 55, 68, s * 25], ['Q', 36, s * 17, 14, s * 37]]);
    const eye = g.createRadialGradient(40, s * 33, 2, 40, s * 33, 28);
    eye.addColorStop(0, '#FFF27A');
    eye.addColorStop(0.45, '#FF9A1F');
    eye.addColorStop(1, '#E50F3C');
    g.fillStyle = eye;
    g.fill();
    g.fillStyle = '#0A0004';
    g.save(); g.translate(41, s * 33); g.rotate(s * -0.5);
    g.beginPath(); g.ellipse(0, 0, 16, 3.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#FFFFFF';
    g.fillRect(31, s * 33 - 5, 5, 5);
    // 눈 위를 덮는 사나운 눈두덩
    path([['M', -6, s * 40], ['L', 22, s * 18], ['L', 78, s * 18], ['L', 66, s * 26], ['Q', 34, s * 24, 16, s * 40]]);
    g.fillStyle = '#17112A';
    g.fill();
    g.strokeStyle = '#B79BE6';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(-6, s * 40); g.lineTo(22, s * 18); g.lineTo(78, s * 18); g.stroke();
    // 콧구멍
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(101, s * 11, 6, 3.5, s * 0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7E68AE';
    g.lineWidth = 2;
    g.stroke();
    // 주둥이 밖으로 휘어 나온 독니
    path([['M', 70, s * 38], ['Q', 112, s * 62, 134, s * 28], ['Q', 108, s * 40, 88, s * 32]]);
    g.fillStyle = '#FFF8E8';
    g.fill();
    g.strokeStyle = '#5A1730';
    g.lineWidth = 2.5;
    g.stroke();
  });
  return canvas;
}

export function createBorder() {
  const tiles = [0, 1, 2].map(bodyTile);
  const head = headSprite();
  const count = Math.round((Math.PI * 2 * CENTER) / TILE / 3) * 3;
  const step = (Math.PI * 2) / count;
  const length = CENTER * step + 2; // 칸 사이에 틈이 보이지 않게 조금 겹쳐요.

  const headAngle = (time) => ((time / 1000 / LAP_SEC) * Math.PI * 2) % (Math.PI * 2);

  // 네 갈래 별 모양 반짝임
  function glint(ctx, x, y, size, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x - size, y - 1, size * 2, 2);
    ctx.fillRect(x - 1, y - size, 2, size * 2);
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.globalAlpha = 1;
  }

  function drawBody(ctx, view, time, turn) {
    const margin = WIDTH;
    for (let i = 0; i < count; i++) {
      const angle = turn + i * step;
      const x = Math.cos(angle) * CENTER;
      const y = Math.sin(angle) * CENTER;
      if (x < view.left - margin || x > view.right + margin || y < view.top - margin || y > view.bottom + margin) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiles[i % 3], -length / 2, -WIDTH / 2, length, WIDTH);
      // 광택 줄을 따라 흘러가는 빛
      const sheen = Math.max(0, Math.sin(i * 0.5 + time / 520)) ** 6;
      if (sheen > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(150, 130, 220, ${sheen * 0.38})`;
        ctx.fillRect(-length / 2, WIDTH * 0.13, length - 2, WIDTH * 0.16);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let n = 0; n < 2; n++) {
        const seed = i * 2 + n;
        const twinkle = Math.max(0, Math.sin(time / (330 + noise(seed) * 300) + noise(seed + 400) * 40)) ** 12;
        if (twinkle < 0.05) continue;
        glint(ctx, (noise(seed + 100) - 0.5) * TILE, (noise(seed + 200) - 0.4) * WIDTH * 0.8,
          5 + noise(seed + 300) * 10 * twinkle, twinkle, n ? '#9CEAFE' : '#FFFFFF');
      }
      ctx.restore();
    }
  }

  function drawHead(ctx, view, time, turn) {
    const radius = CENTER + HEAD_OUT;
    const x = Math.cos(turn) * radius;
    const y = Math.sin(turn) * radius;
    const reach = 230;
    if (x < view.left - reach || x > view.right + reach || y < view.top - reach || y > view.bottom + reach) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn + Math.PI / 2);

    // 날름거리는 갈라진 혀
    const flick = Math.max(0, Math.sin(time / 480)) ** 3;
    if (flick > 0.03) {
      const tip = 118 + 62 * flick;
      const wave = Math.sin(time / 55) * 6 * flick;
      ctx.strokeStyle = '#FF2E63';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(108, 0);
      ctx.quadraticCurveTo((108 + tip) / 2, wave, tip, 0);
      ctx.lineTo(tip + 22 * flick, -13 * flick + wave / 2);
      ctx.moveTo(tip, 0);
      ctx.lineTo(tip + 22 * flick, 13 * flick + wave / 2);
      ctx.stroke();
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(head, HEAD_BOX.left, HEAD_BOX.top, HEAD_BOX.right - HEAD_BOX.left, HEAD_BOX.bottom - HEAD_BOX.top);

    // 천천히 밝아졌다 어두워지는 눈빛
    const pulse = 0.45 + 0.3 * Math.sin(time / 600);
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const glow = ctx.createRadialGradient(41, side * 33, 0, 41, side * 33, 40);
      glow.addColorStop(0, `rgba(255, 40, 60, ${pulse})`);
      glow.addColorStop(1, 'rgba(255, 40, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(1, side * 33 - 40, 80, 80);
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const [gx, gy, offset] of [[-40, -58, 0], [80, -18, 2.1], [-20, 52, 4.2]]) {
      const twinkle = Math.max(0, Math.sin(time / 520 + offset)) ** 10;
      if (twinkle > 0.05) glint(ctx, gx, gy, 6 + 12 * twinkle, twinkle, '#FFFFFF');
    }
    ctx.restore();
  }

  return {
    draw(ctx, view, time) {
      // 맵 안쪽에서만 보고 있으면 그릴 것이 없어요.
      const farthest = Math.hypot(Math.max(Math.abs(view.left), Math.abs(view.right)), Math.max(Math.abs(view.top), Math.abs(view.bottom)));
      if (farthest < RULES.mapRadius - 40) return;
      // 맵 안쪽에 드리운 그림자와 경계선
      ctx.lineWidth = 22;
      ctx.strokeStyle = 'rgba(10, 4, 24, .45)';
      ctx.beginPath(); ctx.arc(0, 0, RULES.mapRadius - 11, 0, Math.PI * 2); ctx.stroke();
      const turn = headAngle(time);
      drawBody(ctx, view, time, turn);
      drawHead(ctx, view, time, turn);
    },
  };
}
