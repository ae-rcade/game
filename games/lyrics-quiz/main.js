// 화면 전환: 모드 선택 → 싱글 안내 → 게임 → 결과. 규칙은 quiz.js, 게임 진행은 single.js에 있어요.
import { DURATION_MS, POINTS, LINE_DELAYS_MS, WRONG_PENALTY } from './quiz.js';
import { loadQuestions } from './data.js';
import { createSingle } from './single.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['menu', 'ready', 'play', 'result'];
let view = 'menu', questions = null, request = 0;

function show(next) {
  view = next;
  for (const id of VIEWS) $(id).hidden = id !== next;
}

const single = createSingle({
  onFinish({ reason, score, correct, history, best }) {
    $('result-title').textContent = reason === 'time' ? '시간 종료!' : '모든 문제 완료!';
    $('final').textContent = score;
    $('summary').textContent = `맞힌 문제 ${correct}개 · 내 최고 점수 ${best}점`;
    const marks = { good: '○', bad: '×', skip: '패스', timeout: '시간 종료' };
    $('history').replaceChildren(...history.map(({ title, kind }) => {
      const item = document.createElement('li');
      item.className = kind === 'good' ? 'solved' : '';
      item.textContent = `${marks[kind]} · ${title}`;
      return item;
    }));
    show('result');
    $('result').scrollTop = 0;
  },
});

// 시트를 고친 내용이 반영되도록 안내 화면에 들어올 때마다 다시 불러와요.
async function prepare() {
  const mine = ++request;
  single.stop();
  show('ready');
  questions = null;
  $('start').disabled = true;
  $('reload').hidden = true;
  $('load-message').textContent = '문제를 불러오는 중…';
  try {
    const data = await loadQuestions();
    if (mine !== request) return;
    questions = data.questions;
    $('load-message').textContent = data.sample
      ? `예시 문제 ${questions.length}개 (아직 문제 시트 연결 전)`
      : `문제 ${questions.length}개 준비 완료`;
    $('start').disabled = false;
  } catch (error) {
    console.error(error);
    if (mine !== request) return;
    $('load-message').textContent = error.userMessage || '문제를 불러오지 못했어요.';
    $('reload').hidden = false;
  }
}

function menu() {
  request++;
  single.stop();
  show('menu');
}

$('rule-time').textContent = `${DURATION_MS / 1000}초 동안 최대한 많이 맞혀요`;
$('rule-points').textContent = `2줄까지 ${POINTS[1]}점 · 3줄 ${POINTS[2]}점 · 4줄 ${POINTS[3]}점`;
$('rule-wrong').textContent = `틀리면 -${WRONG_PENALTY}점이고 다음 문제로 넘어가요. 패스는 가사를 모두 연 뒤에 가능해요`;
$('rule-wait').textContent = `처음 2줄은 바로 보여요. 3번째 줄은 문제가 나온 뒤 ${LINE_DELAYS_MS[2] / 1000}초, 4번째 줄은 3번째 줄을 연 뒤 ${LINE_DELAYS_MS[3] / 1000}초 후에 열 수 있어요`;
$('single').addEventListener('click', prepare);
$('reload').addEventListener('click', prepare);
$('start').addEventListener('click', () => { show('play'); single.start(questions); });
$('retry').addEventListener('click', prepare);
for (const button of document.querySelectorAll('[data-menu]')) button.addEventListener('click', menu);
// 위쪽 ◀ 버튼: 모드 선택에서는 게임 목록으로, 그 밖에는 모드 선택으로
$('back').addEventListener('click', (event) => {
  if (view === 'menu') return;
  event.preventDefault();
  menu();
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
show('menu');
