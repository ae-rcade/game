// 싱글 모드: 90초 타임어택
import { DURATION_MS, COUNTDOWN_MS, pointsFor, isCorrect, shuffle } from './quiz.js';

const $ = (id) => document.getElementById(id);
const BEST_KEY = 'ae-rcade.lyrics-quiz.best';

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
const name = (q) => (q.artist ? `${q.title} - ${q.artist}` : q.title);

export function createSingle({ onFinish }) {
  let run = null; // { questions, index, opened, score, correct, history, startsAt, endsAt, timer }

  const question = () => run.questions[run.index];
  const playing = () => run && performance.now() >= run.startsAt;

  function say(text, kind = '') {
    $('feedback').textContent = text;
    $('feedback').className = `feedback ${kind}`;
  }

  function addLine() {
    const item = document.createElement('li');
    item.textContent = question().lines[run.opened];
    $('lines').append(item);
    run.opened++;
    const more = run.opened < question().lines.length;
    $('more').disabled = !more;
    $('more').textContent = more ? `＋ 다음 줄 보기 (맞히면 ${pointsFor(run.opened + 1)}점)` : '마지막 줄까지 열었어요';
    $('worth').textContent = `맞히면 ${pointsFor(run.opened)}점`;
    $('card').scrollTop = $('card').scrollHeight;
  }

  function showQuestion() {
    run.opened = 0;
    $('number').textContent = `문제 ${run.index + 1}`;
    $('lines').replaceChildren();
    $('answer').value = '';
    addLine();
  }

  function status() {
    $('score').textContent = run.score;
    $('correct').textContent = run.correct;
  }

  function advance(solved) {
    run.history.push({ title: name(question()), solved });
    run.index++;
    if (run.index >= run.questions.length) finish('done');
    else showQuestion();
  }

  function finish(reason) {
    clearInterval(run.timer);
    // 시간이 끝났을 때 풀던 문제도 정답 목록에 보여줘요.
    if (reason === 'time') run.history.push({ title: name(question()), solved: false });
    const { score, correct, history } = run;
    const best = Math.max(readBest(), score);
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* 저장이 막힌 브라우저 */ }
    run = null;
    $('answer').blur();
    onFinish({ reason, score, correct, history, best });
  }

  function tick() {
    const now = performance.now();
    const waiting = now < run.startsAt;
    $('countdown').hidden = !waiting;
    $('card').classList.toggle('waiting', waiting);
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
        say(`정답! +${points}점 · ${question().title}`, 'good');
        status();
        advance(true);
      } else {
        say(`"${typed}"은(는) 아니에요`, 'bad');
        $('answer').value = '';
      }
    });
  });
  $('more').addEventListener('click', () => {
    if (playing() && run.opened < question().lines.length) addLine();
  });
  $('pass').addEventListener('click', () => {
    if (!playing()) return;
    say(`패스! 정답은 "${question().title}"`);
    advance(false);
  });
  // 버튼을 눌러도 휴대폰 키보드가 닫히지 않게 해요.
  for (const id of ['more', 'pass', 'submit']) $(id).addEventListener('mousedown', (e) => e.preventDefault());

  return {
    start(questions) {
      this.stop();
      const startsAt = performance.now() + COUNTDOWN_MS;
      run = { questions: shuffle(questions), index: 0, opened: 0, score: 0, correct: 0, history: [], startsAt, endsAt: startsAt + DURATION_MS };
      say('');
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
