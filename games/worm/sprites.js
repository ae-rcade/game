// 도트 지렁이 그림을 코드로 만들고, 먹이 그림(images/)을 불러와요.
import { KINDS } from './rules.js';

const mix = (hex, to, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const part = (shift) => Math.round(((n >> shift) & 255) * (1 - amount) + to * amount);
  return `rgb(${part(16)}, ${part(8)}, ${part(0)})`;
};

// 한 칸이 도트 하나인 작은 캔버스에 둥근 마디를 찍어요. 크게 늘려 그리면 도트 모양이 돼요.
function disc(size, { color, edge }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > c) continue;
      let fill = color;
      if (d > c - 1.35) fill = edge;
      else if (dx + dy > c * 0.55) fill = mix(color, 0, 0.12);
      g.fillStyle = fill;
      g.fillRect(x, y, 1, 1);
    }
  }
  const shine = Math.round(size * 0.25);
  g.fillStyle = mix(color, 255, 0.75);
  g.fillRect(shine, shine, 2, 1);
  g.fillRect(shine, shine + 1, 1, 1);
  return canvas;
}

// 오른쪽(각도 0)을 보는 머리. 눈 두 개를 앞쪽에 찍어요.
function head(kind) {
  const canvas = disc(16, kind);
  const g = canvas.getContext('2d');
  for (const y of [3, 9]) {
    g.fillStyle = '#4B3A8C';
    g.fillRect(8, y - 1, 5, 6);
    g.fillRect(7, y, 7, 4);
    g.fillStyle = '#FFFFFF';
    g.fillRect(8, y, 5, 4);
    g.fillStyle = '#241A4A';
    g.fillRect(11, y + 1, 2, 2);
  }
  return canvas;
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  // 같은 이름으로 다시 올린 그림이 바로 반영되도록 저장된 사본을 확인해요.
  fetch(src, { cache: 'no-cache' }).catch(() => {}).finally(() => { img.src = src; });
});

export async function loadSprites() {
  const bodies = KINDS.map((kind) => disc(12, kind));
  const heads = KINDS.map(head);
  // 그림 파일이 없으면 같은 색의 마디 그림으로 대신해요.
  const foods = await Promise.all(KINDS.map(async (_, i) => (await loadImage(`images/food${i + 1}.png`)) || bodies[i]));
  return { bodies, heads, foods };
}
