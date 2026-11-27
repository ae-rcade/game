// 순위표와 결과 화면 (닉네임 등록 포함)
import { MODES } from './modes.js';
import { TOP, cleanName, qualifies } from './ranking.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'ae-rcade.watermelon.name';

export function createPanel(ranking) {
  let token = 0;      // 화면이 바뀐 뒤 늦게 도착한 응답은 버려요.
  let view = null;    // { mode, result }

  function table(scores, mine) {
    $('rows').replaceChildren(...Array.from({ length: TOP }, (_, i) => {
      const row = document.createElement('tr');
      if (mine === i + 1) row.className = 'mine';
      for (const text of [i + 1, scores[i]?.name ?? '-', scores[i]?.score ?? '-']) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }));
  }

  function message(text, retry = false) {
    $('message').textContent = text;
    $('reload').hidden = !retry;
  }

  async function load() {
    const mine = ++token;
    const { mode, result } = view;
    $('form').hidden = true;
    table([]);
    message('순위를 불러오는 중…');
    try {
      const scores = await ranking.top(mode);
      if (mine !== token) return;
      table(scores, result?.rank);
      message('');
      if (!result) return;
      if (result.rank) message(`${result.rank}위에 기록됐어요!`);
      else if (result.score <= 0) message('');
      else if (result.done) message('그 사이 더 높은 기록이 올라와 탑10에서 밀렸어요.');
      else if (!qualifies(scores, result.score)) message('아쉽게도 탑10에는 들지 못했어요.');
      else {
        const session = await result.session;
        if (mine !== token) return;
        if (!session) {
          message('시작할 때 랭킹 서버에 연결하지 못해 이번 기록은 등록할 수 없어요.');
        } else {
          message('탑10 진입! 닉네임을 등록하세요. 등록하지 않고 나가면 기록이 사라져요.');
          $('form').hidden = false;
          $('submit').disabled = false;
        }
      }
    } catch (error) {
      console.error(error);
      if (mine === token) message('순위를 불러오지 못했어요.', true);
    }
  }

  function selectTab(mode) {
    view.mode = mode;
    for (const button of $('tabs').children) button.setAttribute('aria-pressed', button.dataset.mode === mode);
    load();
  }

  for (const [id, { label }] of Object.entries(MODES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mode = id;
    button.textContent = label;
    button.addEventListener('click', () => selectTab(id));
    $('tabs').append(button);
  }
  $('reload').addEventListener('click', load);

  $('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { mode, result } = view;
    const name = cleanName($('name').value);
    if (!name) { message('닉네임을 입력해 주세요.'); return; }
    const mine = token;
    $('submit').disabled = true;
    message('등록하는 중…');
    try {
      const { scores, rank } = await ranking.submit(mode, await result.session, name, result.score);
      result.rank = rank;
      result.done = true;
      try { localStorage.setItem(NAME_KEY, name); } catch { /* 다음에 다시 입력 */ }
      if (mine !== token) return;
      $('form').hidden = true;
      table(scores, rank);
      message(rank ? `${rank}위에 기록됐어요!` : '그 사이 더 높은 기록이 올라와 탑10에서 밀렸어요.');
    } catch (error) {
      console.error(error);
      if (mine !== token) return;
      $('submit').disabled = false;
      message(error.userMessage || '등록하지 못했어요. 잠시 후 다시 눌러 주세요.');
    }
  });

  function open(mode, result, closeLabel) {
    view = { mode, result };
    $('panel').hidden = false;
    $('panel').scrollTop = 0;
    $('panel-title').textContent = !result ? '순위 TOP 10' : result.reason === 'time' ? '시간 종료!' : 'GAME OVER';
    $('my-result').hidden = !result;
    if (result) {
      $('final').textContent = result.score;
      $('final-mode').textContent = MODES[mode].label;
      try { $('name').value = localStorage.getItem(NAME_KEY) || ''; } catch { $('name').value = ''; }
    }
    $('tabs').hidden = Boolean(result);
    $('scope').textContent = ranking.shared ? '모든 플레이어 기록' : '이 기기에만 저장되는 기록 (온라인 랭킹 연결 전)';
    $('resume').hidden = Boolean(result);
    if (closeLabel) $('resume').textContent = closeLabel;
    $('to-menu').hidden = closeLabel === '닫기'; // 모드 선택 화면에서 연 순위표에는 '닫기'만
    $('retry').hidden = !result;
    selectTab(mode);
  }

  return {
    showRanking: (mode, closeLabel = '▶ 계속하기') => open(mode, null, closeLabel),
    showResult: (mode, result) => open(mode, result),
    close() { token++; $('panel').hidden = true; },
    get isOpen() { return !$('panel').hidden; },
  };
}
