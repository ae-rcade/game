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
  icon.src = `games/${id}/icon.svg`;
  icon.alt = '';
  const tags = el('div', '', 'tags');
  for (const mode of Array.isArray(meta.modes) ? meta.modes : []) tags.append(el('span', mode));
  link.append(icon, el('strong', meta.title), el('p', meta.description), tags);
  if (!meta.ready) link.append(el('em', '준비 중', 'badge'));

  const item = el('li');
  item.append(link);
  return item;
}

async function loadGames() {
  try {
    const { games } = await readJson('games/list.json');
    const results = await Promise.allSettled(games.map(loadCard));
    results.filter((r) => r.status === 'rejected').forEach((r) => console.warn(r.reason));
    const cards = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!cards.length) throw new Error('표시할 게임이 없어요');
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

window.addEventListener('hashchange', route);
route();
loadGames();
