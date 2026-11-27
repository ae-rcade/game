// 그림의 투명 여백을 잘라내고, 불투명한 윤곽을 따라 충돌 모양을 만들어요.
const SAMPLE = 128;      // 윤곽을 분석하는 해상도
const ALPHA_MIN = 128;   // 이 값보다 흐린 픽셀은 판정에서 제외

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// 점들을 모두 감싸는 가장 바깥 테두리(볼록 껍질)
function convexHull(points) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(points), ...half([...points].reverse())];
}

// 반환값
//   sprite: 정사각형 그림
//   hull:   반지름 1 기준의 윤곽 좌표. null이면 원으로 판정
export function analyze(image) {
  const side = Math.max(image.width, image.height);
  const probe = canvas(SAMPLE);
  const g = probe.getContext('2d', { willReadFrequently: true });
  const k = SAMPLE / side;
  g.drawImage(image, (SAMPLE - image.width * k) / 2, (SAMPLE - image.height * k) / 2, image.width * k, image.height * k);
  const { data } = g.getImageData(0, 0, SAMPLE, SAMPLE);
  const solid = (x, y) => x >= 0 && y >= 0 && x < SAMPLE && y < SAMPLE && data[(y * SAMPLE + x) * 4 + 3] > ALPHA_MIN;

  const edges = [];
  for (let y = 0; y < SAMPLE; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < SAMPLE; x++) {
      if (!solid(x, y)) continue;
      if (left < 0) left = x;
      right = x;
    }
    if (left >= 0) edges.push({ x: left, y }, { x: right + 1, y }, { x: left, y: y + 1 }, { x: right + 1, y: y + 1 });
  }

  // 배경이 불투명한 사진(네 모서리가 모두 채워짐)이나 빈 그림은 원으로 처리해요.
  const full = image.width === image.height
    && [[0, 0], [SAMPLE - 1, 0], [0, SAMPLE - 1], [SAMPLE - 1, SAMPLE - 1]].every(([x, y]) => solid(x, y));
  if (full || edges.length === 0) {
    const crop = Math.min(image.width, image.height);
    const sprite = canvas(Math.min(crop, 512));
    sprite.getContext('2d').drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, sprite.width, sprite.height);
    return { sprite, hull: null };
  }

  const xs = edges.map((p) => p.x);
  const ys = edges.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const points = convexHull(edges);
  const reach = Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy)));

  // 가장 먼 윤곽점이 반지름에 닿도록 여백을 잘라낸 정사각형 그림
  const box = (reach * 2) / k;
  const sprite = canvas(Math.max(1, Math.min(Math.round(box), 512)));
  const s = sprite.width / box;
  const originX = (cx - reach - (SAMPLE - image.width * k) / 2) / k;
  const originY = (cy - reach - (SAMPLE - image.height * k) / 2) / k;
  sprite.getContext('2d').drawImage(image, -originX * s, -originY * s, image.width * s, image.height * s);

  return { sprite, hull: points.map((p) => ({ x: (p.x - cx) / reach, y: (p.y - cy) / reach })) };
}
