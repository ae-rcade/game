// 그림의 투명 여백을 잘라내고, 불투명한 윤곽을 따라 충돌 모양을 만들어요.
import { traceOutlines, simplify, convexParts } from './contour.js';

const SAMPLE = 160;      // 윤곽을 분석하는 해상도
const TOLERANCE = 0.9;   // 작을수록 윤곽을 세밀하게 따라가지만 계산이 늘어요.
const ALPHA_MIN = 128;   // 이 값보다 흐린 픽셀은 판정에서 제외

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// 반환값
//   sprite: 정사각형 그림
//   parts:  반지름 1 기준의 볼록 다각형 목록. null이면 원으로 판정
export function analyze(image) {
  const side = Math.max(image.width, image.height);
  const probe = canvas(SAMPLE);
  const g = probe.getContext('2d', { willReadFrequently: true });
  const k = SAMPLE / side;
  g.drawImage(image, (SAMPLE - image.width * k) / 2, (SAMPLE - image.height * k) / 2, image.width * k, image.height * k);
  const { data } = g.getImageData(0, 0, SAMPLE, SAMPLE);
  const solid = (x, y) => x >= 0 && y >= 0 && x < SAMPLE && y < SAMPLE && data[(y * SAMPLE + x) * 4 + 3] > ALPHA_MIN;

  const loops = traceOutlines((x, y) => data[(y * SAMPLE + x) * 4 + 3], SAMPLE, ALPHA_MIN);

  // 배경이 불투명한 사진(네 모서리가 모두 채워짐)이나 빈 그림은 원으로 처리해요.
  const full = image.width === image.height
    && [[0, 0], [SAMPLE - 1, 0], [0, SAMPLE - 1], [SAMPLE - 1, SAMPLE - 1]].every(([x, y]) => solid(x, y));
  if (full || loops.length === 0) {
    const crop = Math.min(image.width, image.height);
    const sprite = canvas(Math.min(crop, 512));
    sprite.getContext('2d').drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, 0, 0, sprite.width, sprite.height);
    return { sprite, parts: null };
  }

  const points = loops.flat();
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const reach = Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy)));

  // 가장 먼 윤곽점이 반지름에 닿도록 여백을 잘라낸 정사각형 그림
  const box = (reach * 2) / k;
  const sprite = canvas(Math.max(1, Math.min(Math.round(box), 512)));
  const s = sprite.width / box;
  const originX = (cx - reach - (SAMPLE - image.width * k) / 2) / k;
  const originY = (cy - reach - (SAMPLE - image.height * k) / 2) / k;
  sprite.getContext('2d').drawImage(image, -originX * s, -originY * s, image.width * s, image.height * s);

  const normal = (p) => ({ x: (p.x - cx) / reach, y: (p.y - cy) / reach });
  const parts = loops.flatMap((loop) => convexParts(simplify(loop, TOLERANCE))).map((part) => part.map(normal));
  return { sprite, parts };
}
