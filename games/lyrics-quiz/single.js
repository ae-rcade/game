// 싱글 모드: 150초 타임어택
import {
  DURATION_MS, COUNTDOWN_MS, LINE_DELAYS_MS, FREE_LINES, WRONG_PENALTY, REVEAL_MS, pointsFor, isCorrect, shuffle, pickLines, titleMasker,
} from './quiz.js';

const $ = (id) => document.getElementById(id);
// 최고 점수는 난이도별로 따로 저장해요.
const BEST_KEYS = { normal: 'ae-rcade.lyrics-quiz.best', easy: 'ae-rcade.lyrics-quiz.best.easy' };

function readBest(level) {
  try { return Number(localStorage.getItem(BEST_KEYS[level])) || 0; } catch { return 0; }
}
const name = (q) => (q.artist ? `${q.title} - ${q.artist}` : q.title);

export function createSingle({ onFinish }) {
  let run = null; // { level, questions, index, lines, opened, unlockAt, reveal, score, correct, history, startsAt, endsAt, timer }

  const question = () => run.questions[run.index];
  // 카운트다운 중이거나 정답을 보여주는 동안에는 입력을 받지 않아요.
  const playing = () => run && !run.reveal && performance.now() >= run.startsAt;

  // 다음 줄을 열고, 그다음 줄의 대기 시간을 시작해요.
  function openLine() {
    const box = $('lines').children[run.opened].firstChild;
    box.textContent = run.lines[run.opened];
    run.opened++;
    // 카운트다운 중에 열린 줄은 게임이 시작될 때부터 대기 시간을 세요.
    run.unlockAt = Math.max(performance.now(), run.startsAt) + (LINE_DELAYS_MS[run.opened] || 0);
    $('worth').textContent = `맞히면 ${pointsFor(run.opened)}점`;
    updateLocks();
    box.scrollIntoView({ block: 'nearest' });
  }

  // 아직 가려진 줄의 표시(?, ?(n초))와 패스 가능 여부
  function updateLocks() {
    const wait = Math.ceil((run.unlockAt - performance.now()) / 1000);
    [...$('lines').children].forEach((item, i) => {
      const box = item.firstChild;
      const hidden = i >= run.opened;
      const next = i === run.opened;
      const ready = next && wait <= 0;
      box.className = hidden ? (ready ? 'ready' : 'locked') : 'open';
      box.setAttribute('aria-disabled', !ready); // disabled를 쓰면 누를 때 키보드가 닫힐 수 있어요.
      if (!hidden) { box.removeAttribute('aria-label'); box.removeAttribute('aria-disabled'); return; }
      const text = next && wait > 0 ? `?(${wait}초)` : '?';
      if (box.textContent !== text) box.textContent = text;
      box.setAttribute('aria-label', ready ? `${i + 1}번째 줄 열기` : `${i + 1}번째 줄은 아직 열 수 없어요`);
    });
    // 준비된 줄을 모두 연 뒤에만 패스할 수 있어요.
    $('pass').setAttribute('aria-disabled', run.opened < run.lines.length);
  }

  function showQuestion() {
    run.opened = 0;
    const lines = pickLines(question().lines);
    // easy는 가사 속 제목을 가리지 않아요.
    run.lines = run.level === 'easy' ? lines : lines.map(titleMasker(question()));
    $('number').textContent = `문제 ${run.index + 1}`;
    $('lines').replaceChildren(...run.lines.map((_, i) => {
      const item = document.createElement('li');
      const box = document.createElement('button');
      box.type = 'button';
      box.addEventListener('click', () => {
        if (playing() && i === run.opened && performance.now() >= run.unlockAt) openLine();
      });
      item.append(box);
      return item;
    }));
    $('answer').value = '';
    while (run.opened < Math.min(FREE_LINES, run.lines.length)) openLine();
    $('card').scrollTop = 0;
  }

  function status() {
    $('score').textContent = run.score;
    $('correct').textContent = run.correct;
  }

  // 결과와 정답을 잠깐 보여준 뒤 다음 문제로 넘어가요. kind: 'good' 정답, 'bad' 오답, 'skip' 패스
  function resolve(kind, label) {
    run.history.push({ title: name(question()), kind });
    status();
    $('reveal-label').textContent = label;
    $('reveal-title').textContent = question().title;
    $('reveal').className = `reveal ${kind}`;
    $('reveal').hidden = false;
    $('answer').value = '';
    const now = performance.now();
    run.reveal = { from: now, until: now + REVEAL_MS };
  }

  function next() {
    // 정답을 보여준 시간만큼 남은 시간을 돌려줘요.
    run.endsAt += performance.now() - run.reveal.from;
    run.reveal = null;
    $('reveal').hidden = true;
    run.index++;
    if (run.index >= run.questions.length) finish('done');
    else showQuestion();
  }

  function finish(reason) {
    clearInterval(run.timer);
    // 시간이 끝났을 때 풀던 문제도 정답 목록에 보여줘요.
    if (reason === 'time') run.history.push({ title: name(question()), kind: 'timeout' });
    const { level, score, correct, history } = run;
    const best = Math.max(readBest(level), score);
    try { localStorage.setItem(BEST_KEYS[level], String(best)); } catch { /* 저장이 막힌 브라우저 */ }
    run = null;
    $('reveal').hidden = true;
    $('answer').blur();
    onFinish({ reason, level, score, correct, history, best });
  }

  function tick() {
    const now = performance.now();
    if (run.reveal) {
      if (now >= run.reveal.until) next();
      return;
    }
    const waiting = now < run.startsAt;
    $('countdown').hidden = !waiting;
    $('card').classList.toggle('waiting', waiting);
    updateLocks();
    if (waiting) $('countdown').textContent = Math.ceil((run.startsAt - now) / 1000);
    const seconds = Math.ceil(Math.max(0, run.endsAt - Math.max(now, run.startsAt)) / 1000);
    $('time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('time').classList.toggle('urgent', seconds <= 10);
    if (now >= run.endsAt) finish('time');
  }

  $('form').addEventListener('submit', (event) => {
    event.preventDefault();
    // 한글 입력기가 마지막 글자를 확정한 뒤에 읽어요.
    setTimeout(() => {
      if (!playing()) return;
      if (performance.now() >= run.endsAt) return finish('time');
      const typed = $('answer').value.trim();
      if (!typed) return;
      if (isCorrect(question(), typed)) {
        const points = pointsFor(run.opened);
        run.score += points;
        run.correct++;
        resolve('good', `정답! +${points}점`);
      } else {
        run.score -= WRONG_PENALTY;
        resolve('bad', `오답 -${WRONG_PENALTY}점`);
      }
    });
  });
  $('pass').addEventListener('click', () => {
    if (!playing() || run.opened < run.lines.length) return;
    resolve('skip', '패스');
  });
  // 버튼을 눌러도 휴대폰 키보드가 닫히지 않게 해요.
  for (const id of ['card', 'reveal', 'pass', 'submit']) $(id).addEventListener('mousedown', (e) => e.preventDefault());

  return {
    start(questions, level) {
      this.stop();
      const startsAt = performance.now() + COUNTDOWN_MS;
      run = { level, questions: shuffle(questions), index: 0, opened: 0, score: 0, correct: 0, history: [], startsAt, endsAt: startsAt + DURATION_MS };
      $('reveal').hidden = true;
      status();
      showQuestion();
      run.timer = setInterval(tick, 100);
      tick();
      // 시작 버튼을 누른 순간에 포커스해야 휴대폰 키보드가 열려요.
      $('answer').focus({ preventScroll: true });
    },
    stop() {
      if (run) clearInterval(run.timer);
      run = null;
      $('answer').blur();
    },
  };
}
