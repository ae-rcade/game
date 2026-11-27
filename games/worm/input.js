// 터치 입력: 끌어서 방향 조종, 빠르게 두 번 터치하면 부스트. (컴퓨터 확인용: 마우스, 방향키, 스페이스)
const DEAD_ZONE = 8;   // 이만큼 끌어야 방향이 바뀌어요.
const STICK = 48;      // 손가락이 이보다 멀어지면 기준점이 따라와요. 방향을 빨리 바꿀 수 있어요.
const TAP_MS = 250;    // 한 번 터치로 치는 최대 시간
const TAP_MOVE = 14;
const DOUBLE_MS = 320; // 두 터치 사이 최대 시간
const DOUBLE_DIST = 80;

// 휴대폰(특히 아이폰)은 CSS만으로는 두 번 터치 확대가 막히지 않을 때가 있어 직접 막아요.
export function blockZoom(root) {
  const usable = (target) => target.closest('a, button, input');
  let lastEnd = 0;
  root.addEventListener('touchend', (event) => {
    // 버튼과 입력칸은 그대로 눌리게 두고, 나머지 곳의 빠른 연속 터치만 막아요.
    if (event.timeStamp - lastEnd < 400 && !usable(event.target) && event.cancelable) event.preventDefault();
    lastEnd = event.timeStamp;
  }, { passive: false });
  // 두 손가락 확대(아이폰)
  for (const type of ['gesturestart', 'dblclick']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

export function createInput(element, { onAim, onBoost }) {
  const pointers = new Map();
  let steering = null;
  let lastTap = null;

  const at = (event) => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try { element.setPointerCapture(event.pointerId); } catch { /* 이미 끝난 터치 */ }
    const { x, y } = at(event);
    const now = event.timeStamp;
    const double = lastTap && now - lastTap.time < DOUBLE_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_DIST;
    if (double) {
      lastTap = null;
      onBoost();
    }
    pointers.set(event.pointerId, { x, y, anchorX: x, anchorY: y, startX: x, startY: y, time: now, moved: false, double });
    // 조종하던 손가락이 있으면 그대로 두고, 다른 손가락은 부스트에 쓸 수 있어요.
    steering ??= event.pointerId;
  });

  element.addEventListener('pointermove', (event) => {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    Object.assign(p, at(event));
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > TAP_MOVE) p.moved = true;
    if (event.pointerId !== steering) return;
    const dx = p.x - p.anchorX;
    const dy = p.y - p.anchorY;
    const length = Math.hypot(dx, dy);
    if (length < DEAD_ZONE) return;
    onAim(Math.atan2(dy, dx));
    if (length > STICK) {
      p.anchorX = p.x - (dx / length) * STICK;
      p.anchorY = p.y - (dy / length) * STICK;
    }
  });

  function lift(event) {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    pointers.delete(event.pointerId);
    if (event.type === 'pointerup' && !p.moved && !p.double && event.timeStamp - p.time < TAP_MS) {
      lastTap = { x: p.startX, y: p.startY, time: event.timeStamp };
    }
    if (steering === event.pointerId) steering = pointers.keys().next().value ?? null;
  }
  element.addEventListener('pointerup', lift);
  element.addEventListener('pointercancel', lift);
  // 게임 화면의 터치는 브라우저의 기본 동작(확대, 돋보기, 길게 누르기 메뉴)에 넘기지 않아요.
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    element.addEventListener(type, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  }
  element.addEventListener('contextmenu', (e) => e.preventDefault());

  const arrows = { ArrowRight: 0, ArrowDown: Math.PI / 2, ArrowLeft: Math.PI, ArrowUp: -Math.PI / 2 };
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); onBoost(); }
    else if (event.code in arrows) { event.preventDefault(); onAim(arrows[event.code]); }
  });

  return {
    // 화면에 그릴 손가락 위치
    stick() {
      const p = pointers.get(steering);
      return p && p.moved ? p : null;
    },
    reset() {
      pointers.clear();
      steering = null;
      lastTap = null;
    },
  };
}
