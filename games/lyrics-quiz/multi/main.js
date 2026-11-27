// 멀티 모드 화면: 방 만들기/참여하기 → 대기 화면 → 게임 → 순위. 게임 진행과 채점은 서버(../server)가 해요.
import { POINTS, LINE_DELAYS_MS, WRONG_PENALTY } from '../quiz.js';
import { MIN_PLAYERS, MAX_PLAYERS, COUNT, ANSWER_MS, CODE_LENGTH, cleanName, cleanCode, rank } from './rules.js';
import { connect } from './net.js';
import { clearInput } from '../ime.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['menu', 'entry', 'lobby', 'play', 'result'];
const SESSION_KEY = 'ae-rcade.lyrics-quiz.multi.session'; // 새로고침해도 같은 자리로 돌아와요.
const NAME_KEY = 'ae-rcade.lyrics-quiz.multi.name';
const LEVEL_INFO = {
  normal: { name: 'NORMAL', hint: '제목 가림', rule: '가사 속 제목은 ●●●로 가려요' },
  easy: { name: 'EASY', hint: '제목 안 가림', rule: '가사 속 제목은 가리지 않아요' },
};

let view = 'menu', server = '', mode = 'create';
let link = null, you = null, state = null;
let clock = {};      // 남은 시간: 서버가 알려준 값을 이 기기의 시각으로 바꿔 둬요.
let shownQuestion = -1, noticeTimer = 0;

const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
const write = (storage, key, value) => {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, value);
  } catch { /* 저장이 막힌 브라우저 */ }
};
const el = (tag, text = '', className = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
};

function show(next) {
  if (view === next) return;
  view = next;
  for (const id of VIEWS) $(id).hidden = id !== next;
  $(next).scrollTop = 0;
  if (next !== 'play') $('answer').blur();
}

function banner(text) {
  $('banner').textContent = text;
  $('banner').hidden = !text;
}

// ───── 방 들어가기·나가기 ─────
function openEntry(next) {
  mode = next;
  const join = mode === 'join';
  $('entry-title').textContent = join ? '참여하기' : '방 만들기';
  $('enter').textContent = join ? '들어가기' : '방 만들기';
  $('code-field').hidden = !join;
  $('entry-message').textContent = '';
  $('enter').disabled = false;
  show('entry');
}

function enter(params) {
  link?.leave();
  link = connect(server, params, {
    welcome(session) {
      you = session.you;
      write('sessionStorage', SESSION_KEY, JSON.stringify({ code: session.code, token: session.token }));
    },
    state(next) {
      banner('');
      render(next);
    },
    notice(message) {
      banner(message);
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => banner(''), 3000);
    },
    reconnecting() { banner('연결이 끊겼어요. 다시 연결하는 중…'); },
    end(message) {
      const joined = Boolean(state);
      reset();
      // 들어가기 전의 실패는 입력 화면에, 방에서 끊긴 경우는 첫 화면에 알려줘요.
      if (!joined && view === 'entry') {
        $('entry-message').textContent = message;
        $('enter').disabled = false;
      } else {
        $('menu-message').textContent = message;
        show('menu');
      }
    },
  });
}

function reset() {
  link = null;
  you = null;
  state = null;
  shownQuestion = -1;
  clock = {};
  banner('');
  write('sessionStorage', SESSION_KEY, null);
}

function leave() {
  link?.leave();
  reset();
  $('menu-message').textContent = '';
  show('menu');
}

const confirmLeave = () => { if (window.confirm('방에서 나갈까요?')) leave(); };

// ───── 그리기 ─────
function render(next) {
  const previous = state?.phase;
  state = next;
  const now = performance.now();
  const q = state.question;
  clock = {
    start: state.startsIn === undefined ? null : now + state.startsIn,
    next: q?.nextIn == null ? null : now + q.nextIn,
    end: q ? now + q.endsIn : null,
  };
  if (state.phase === 'lobby' || state.phase === 'loading') {
    shownQuestion = -1;
    if (previous !== state.phase) $('lobby-message').textContent = '';
    show('lobby');
    renderLobby();
  } else if (state.phase === 'result') {
    show('result');
    renderResult();
  } else {
    show('play');
    renderPlay(previous !== state.phase);
    // 게임이 시작되면 입력 칸에 포커스해요(휴대폰은 칸을 눌러야 키보드가 열릴 수 있어요).
    if (previous !== state.phase && state.phase === 'countdown') $('answer').focus({ preventScroll: true });
  }
}

function renderLobby() {
  const host = state.hostId === you;
  const loading = state.phase === 'loading';
  const connected = state.players.filter((p) => p.connected).length;
  $('room-code').textContent = state.code;
  $('members').replaceChildren(...Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const p = state.players[i];
    if (!p) return el('li', '빈자리', 'empty');
    const item = el('li', '', p.id === you ? 'me' : '');
    const tags = [p.id === state.hostId && '방장', p.id === you && '나', !p.connected && '연결 끊김'].filter(Boolean);
    item.append(el('strong', p.name), el('span', tags.join(' · ')));
    return item;
  }));
  $('count').textContent = `${state.count}문제`;
  $('less').hidden = $('more').hidden = !host;
  $('less').disabled = loading || state.count <= COUNT.min;
  $('more').disabled = loading || state.count >= COUNT.max;
  const { name, hint, rule } = LEVEL_INFO[state.level];
  $('level').textContent = `모드: ${name} (${hint})${host ? ' ⇄' : ''}`;
  $('level').classList.toggle('easy', state.level === 'easy');
  $('level').disabled = !host || loading;
  $('tip-level').textContent = rule;
  $('start').hidden = !host;
  $('start').disabled = loading || connected < MIN_PLAYERS;
  const waiting = loading ? '문제를 불러오는 중…'
    : !host ? '방장이 시작하기를 누르면 게임이 시작돼요'
    : connected < MIN_PLAYERS ? `${MIN_PLAYERS}명 이상 모이면 시작할 수 있어요` : '';
  $('start').textContent = loading ? '불러오는 중…' : '▶ 시작하기';
  $('people').textContent = `참가자 ${state.players.length} / ${MAX_PLAYERS}${waiting ? ` · ${waiting}` : ''}`;
}

function renderScoreboard() {
  $('scoreboard').style.setProperty('--players', state.players.length);
  $('scoreboard').replaceChildren(...state.players.map((p) => {
    const won = state.phase === 'reveal' && state.result.winnerId === p.id;
    const mark = p.left ? '나감' : !p.connected ? '끊김' : won ? `+${state.result.points}` : p.locked ? '오답' : '';
    const classes = [p.id === you && 'me', won && 'won', p.locked && 'wrong', !p.connected && 'away'].filter(Boolean);
    const item = el('li', '', classes.join(' '));
    item.append(el('span', p.name), el('strong', String(p.score)), el('em', mark));
    return item;
  }));
}

function renderPlay(entered) {
  renderScoreboard();
  const q = state.question;
  const counting = state.phase === 'countdown';
  $('card').classList.toggle('waiting', counting);
  $('countdown').hidden = !counting;
  const revealed = state.phase === 'reveal';
  $('reveal').hidden = !revealed;
  if (q) {
    if (shownQuestion !== q.index) {
      shownQuestion = q.index;
      $('lines').replaceChildren(...Array.from({ length: q.slots }, () => {
        const item = document.createElement('li');
        item.append(el('p', '?', 'locked'));
        return item;
      }));
      clearInput($('answer'));
      $('card').scrollTop = 0;
    }
    $('number').textContent = `문제 ${q.index + 1} / ${q.total}`;
    $('worth').textContent = `맞히면 ${q.worth}점`;
    q.lines.forEach((line, i) => {
      const box = $('lines').children[i].firstChild;
      if (box.className === 'open') return;
      box.className = 'open';
      box.textContent = line;
      box.scrollIntoView({ block: 'nearest' });
    });
  } else {
    $('number').textContent = $('worth').textContent = $('time').textContent = '';
    $('lines').replaceChildren();
    shownQuestion = -1;
  }
  if (revealed) {
    const { kind, title, winnerId, winner, points } = state.result;
    const mine = winnerId === you;
    $('reveal-label').textContent = kind === 'good' ? `${mine ? '정답!' : `${winner}님 정답!`} +${points}점`
      : kind === 'bad' ? '모두 오답!' : '시간 종료!';
    $('reveal-title').textContent = title;
    $('reveal').className = `reveal ${kind === 'good' && mine ? 'good' : kind === 'good' ? 'other' : 'bad'}`;
    if (entered) clearInput($('answer'));
  }
  const locked = state.phase === 'question' && state.players.find((p) => p.id === you)?.locked;
  $('hint').textContent = locked ? `오답 -${WRONG_PENALTY}점 · 이번 문제는 더 답할 수 없어요` : '';
  $('submit').setAttribute('aria-disabled', state.phase !== 'question' || Boolean(locked));
  tick();
}

// 남은 시간 표시만 이 기기에서 갱신해요.
function tick() {
  if (view !== 'play' || !state) return;
  const now = performance.now();
  const left = (until) => Math.max(0, Math.ceil((until - now) / 1000));
  if (state.phase === 'countdown') $('countdown').textContent = Math.max(1, left(clock.start));
  if (state.phase !== 'question') { $('time').textContent = ''; return; }
  const seconds = left(clock.end);
  $('time').textContent = `⏱ ${seconds}초`;
  $('time').classList.toggle('urgent', seconds <= 5);
  [...$('lines').children].forEach((item, i) => {
    const box = item.firstChild;
    if (i < state.question.lines.length) return;
    const text = i === state.question.lines.length && clock.next ? `?(${Math.max(1, left(clock.next))}초)` : '?';
    if (box.textContent !== text) box.textContent = text;
  });
}

function renderResult() {
  const host = state.hostId === you;
  $('result-level').textContent = `${LEVEL_INFO[state.level].name} · ${state.history.length}문제`;
  $('ranking').replaceChildren(...rank(state.players).map((p) => {
    const item = el('li', '', [p.id === you && 'me', p.rank === 1 && 'first'].filter(Boolean).join(' '));
    const name = el('span', p.name, 'name');
    name.append(el('small', `맞힌 문제 ${p.correct}개${p.left ? ' · 나감' : ''}`));
    item.append(el('b', `${p.rank}위`), name, el('strong', `${p.score}점`));
    return item;
  }));
  $('history').replaceChildren(...state.history.map(({ title, winner }, i) => (
    el('li', `${i + 1}. ${title} · ${winner ?? '정답자 없음'}`, winner ? 'solved' : '')
  )));
  $('again').hidden = !host;
  $('result-message').textContent = host ? '' : '방장이 대기 화면으로 돌아가면 한 판 더 할 수 있어요';
}

// ───── 입력 ─────
$('to-create').addEventListener('click', () => openEntry('create'));
$('to-join').addEventListener('click', () => openEntry('join'));
$('code-input').addEventListener('input', (event) => {
  // 한글 입력 중에는 건드리지 않아요.
  if (!event.isComposing) event.target.value = cleanCode(event.target.value);
});
$('entry-form').addEventListener('submit', (event) => {
  event.preventDefault();
  setTimeout(() => {
    if ($('enter').disabled) return;
    const name = cleanName($('nickname').value);
    const code = cleanCode($('code-input').value);
    if (!name) { $('entry-message').textContent = '닉네임을 입력해 주세요.'; return; }
    if (mode === 'join' && code.length !== CODE_LENGTH) { $('entry-message').textContent = `방 코드 ${CODE_LENGTH}자리를 입력해 주세요.`; return; }
    write('localStorage', NAME_KEY, name);
    $('entry-message').textContent = '연결하는 중…';
    $('enter').disabled = true;
    document.activeElement?.blur();
    enter(mode === 'join' ? { action: 'join', name, code } : { action: 'create', name });
  });
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.code);
    $('lobby-message').textContent = '코드를 복사했어요';
  } catch {
    $('lobby-message').textContent = '복사하지 못했어요. 코드를 직접 알려 주세요';
  }
});
const setCount = (step) => link?.send({ type: 'count', value: state.count + step });
$('less').addEventListener('click', () => setCount(-1));
$('more').addEventListener('click', () => setCount(1));
$('level').addEventListener('click', () => link?.send({ type: 'level', value: state.level === 'easy' ? 'normal' : 'easy' }));
$('start').addEventListener('click', () => link?.send({ type: 'start' }));
$('again').addEventListener('click', () => link?.send({ type: 'again' }));
for (const button of document.querySelectorAll('[data-leave]')) button.addEventListener('click', confirmLeave);

$('form').addEventListener('submit', (event) => {
  event.preventDefault();
  // 한글 입력기가 마지막 글자를 확정한 뒤에 읽어요.
  setTimeout(() => {
    if (state?.phase !== 'question' || state.players.find((p) => p.id === you)?.locked) return;
    const text = $('answer').value.trim();
    if (text && link?.send({ type: 'answer', index: state.question.index, text })) clearInput($('answer'));
  });
});
// 버튼을 눌러도 휴대폰 키보드가 닫히지 않게 해요.
for (const id of ['card', 'reveal', 'submit', 'scoreboard']) $(id).addEventListener('mousedown', (e) => e.preventDefault());

// 위쪽 ◀ 버튼: 첫 화면에서는 모드 선택으로, 방 안에서는 확인 후 나가기
$('back').addEventListener('click', (event) => {
  if (view === 'menu') return;
  event.preventDefault();
  if (view === 'entry') leave();
  else confirmLeave();
});

// 휴대폰 키보드가 열리면 보이는 높이에 화면을 맞춰요.
const viewport = window.visualViewport;
if (viewport) {
  const fit = () => {
    if (viewport.scale > 1.01) return; // 확대해서 볼 때는 그대로 둬요.
    document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`);
    document.querySelector('.app').classList.toggle('compact', viewport.height < 520);
    window.scrollTo(0, 0);
  };
  viewport.addEventListener('resize', fit);
  fit();
}

$('tip-points').textContent = `2줄까지 ${POINTS[1]}점 · 3줄 ${POINTS[2]}점 · 4줄 ${POINTS[3]}점`;
$('tip-lines').textContent = `3·4번째 줄은 ${LINE_DELAYS_MS[2] / 1000}초 간격으로 자동으로 열려요. 4번째 줄이 열리고 ${ANSWER_MS / 1000}초가 지나면 다음 문제예요`;
$('tip-wrong').textContent = `틀리면 -${WRONG_PENALTY}점이고 그 문제는 더 답할 수 없어요`;
$('nickname').value = read('localStorage', NAME_KEY) || '';
setInterval(tick, 100);

async function boot() {
  try {
    const response = await fetch('../config.json', { cache: 'no-store' });
    server = String((await response.json()).multiUrl || '').trim().replace(/\/+$/, '');
  } catch (error) {
    console.error(error);
  }
  if (!server) {
    $('menu-message').textContent = '멀티 서버가 아직 연결되지 않았어요.';
    return;
  }
  $('to-create').disabled = $('to-join').disabled = false;
  let saved = null;
  try { saved = JSON.parse(read('sessionStorage', SESSION_KEY)); } catch { /* 잘못 저장된 값 */ }
  if (saved?.code && saved?.token) {
    $('menu-message').textContent = '들어가 있던 방에 다시 연결하는 중…';
    enter({ action: 'rejoin', code: saved.code, token: saved.token });
  }
}
boot();
