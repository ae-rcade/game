// 시작 화면 ↔ 게임 선택 화면 전환과 게임 카드 생성.
// 게임 하나의 파일이 없거나 잘못돼도 그 카드만 빠지고 나머지는 정상 표시돼요.
const title = document.getElementById('title');
const lobby = document.getElementById('games');
const grid = document.getElementById('game-grid');

async function readJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function loadCard(id) {
  const meta = await readJson(`games/${id}/meta.json`);
  if (typeof meta.title !== 'string') throw new Error(`${id}: title 없음`);

  const link = el('a', '', 'card');
  link.href = `games/${id}/index.html`;
  const icon = el('img');
  // meta.json에 icon이 있으면 그 그림을, 없으면 icon.svg를 써요(게임 폴더 기준 경로).
  icon.src = `games/${id}/${meta.icon || 'icon.svg'}`;
  icon.alt = '';
  const tags = el('div', '', 'tags');
  for (const mode of Array.isArray(meta.modes) ? meta.modes : []) tags.append(el('span', mode));
  link.append(icon, el('strong', meta.title), el('p', meta.description), tags);

  const item = el('li');
  item.append(link);
  return { item, ready: meta.ready === true };
}

// 아직 열지 않은 게임들 대신 보여 주는 칸
function comingSoon() {
  const box = el('div', '', 'card soon');
  box.append(el('span', '?'), el('strong', '준비 중'), el('p', '새 게임을 기다려 주세요'));
  const item = el('li');
  item.append(box);
  return item;
}

async function loadGames() {
  try {
    const { games } = await readJson('games/list.json');
    const results = await Promise.allSettled(games.map(loadCard));
    results.filter((r) => r.status === 'rejected').forEach((r) => console.warn(r.reason));
    const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const cards = loaded.filter((c) => c.ready).map((c) => c.item);
    if (!cards.length) throw new Error('표시할 게임이 없어요');
    if (cards.length < loaded.length) cards.push(comingSoon());
    grid.replaceChildren(...cards);
  } catch (error) {
    console.error(error);
    grid.replaceChildren(el('li', '게임 목록을 불러오지 못했어요. 새로고침해 주세요.', 'notice'));
  }
}

function route() {
  const showLobby = location.hash === '#games';
  title.hidden = showLobby;
  lobby.hidden = !showLobby;
  if (showLobby) lobby.querySelector('h2').focus({ preventScroll: true });
}

// 링크로 처음 들어오면 주소에 #games가 있어도 시작 화면부터 보여 줘요.
// 게임에서 돌아온 경우(뒤로가기 포함)와 새로고침은 게임 선택 화면을 유지해요.
const arrival = performance.getEntriesByType('navigation')[0]?.type;
const fromGame = document.referrer.startsWith(new URL('games/', location.href).href);
if (location.hash === '#games' && arrival === 'navigate' && !fromGame) {
  history.replaceState(null, '', location.pathname + location.search);
}

// 언어 선택 (shared/i18n.js)
for (const button of document.querySelectorAll('.lang button')) {
  button.setAttribute('aria-pressed', button.dataset.lang === window.i18n.lang);
  button.addEventListener('click', () => window.i18n.set(button.dataset.lang));
}

window.addEventListener('hashchange', route);
route();
loadGames();
