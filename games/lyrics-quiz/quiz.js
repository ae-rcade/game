// 화면과 무관한 퀴즈 규칙: 표(CSV) 읽기, 정답 판정, 점수
export const DURATION_MS = 90_000;           // 타임어택 시간
export const COUNTDOWN_MS = 3000;
export const POINTS = [100, 70, 40, 10];     // 가사를 1, 2, 3, 4줄 열었을 때 점수
// 각 줄을 열 수 있을 때까지, 앞 줄을 연 뒤 기다리는 시간. 1번째 줄은 처음부터 보여요.
export const LINE_DELAYS_MS = [0, 0, 3000, 5000];
export const MAX_LINES = LINE_DELAYS_MS.length;

export const pointsFor = (opened) => POINTS[opened - 1];

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// 첫 줄은 열 이름. '제목'과 '가사…' 열이 필요해요. 열 순서는 상관없어요.
export function toQuestions(rows) {
  const header = (rows[0] || []).map((h) => h.replace(/\s/g, ''));
  const title = header.indexOf('제목');
  const alias = header.findIndex((h) => h.startsWith('정답'));
  const artist = header.indexOf('가수');
  const lyrics = header.map((h, i) => (h.startsWith('가사') ? i : -1)).filter((i) => i >= 0);
  if (title < 0 || !lyrics.length) throw new Error('첫 줄에 "제목"과 "가사1" 열 이름이 필요해요.');
  const get = (row, i) => (i < 0 ? '' : String(row[i] ?? '').trim());
  return rows.slice(1).map((row) => ({
    title: get(row, title),
    aliases: get(row, alias).split('|').map((a) => a.trim()).filter(Boolean),
    artist: get(row, artist),
    // 한 칸 안에서 줄을 바꾼 것도 각각 한 줄로 보여줘요.
    lines: lyrics.flatMap((i) => get(row, i).split(/\r?\n/)).map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES),
  })).filter((q) => q.title && q.lines.length);
}

// 대소문자, 띄어쓰기, 문장부호는 무시해요.
export function normalize(text) {
  const base = String(text).normalize('NFC').toLowerCase();
  return base.replace(/[^\p{L}\p{M}\p{N}]/gu, '') || base.replace(/\s/g, '');
}

export function isCorrect(question, input) {
  const typed = normalize(input);
  if (!typed) return false;
  // "제목 (Feat. 누구)"는 괄호를 빼고 써도 정답
  const bare = question.title.replace(/\([^()]*\)|\[[^[\]]*\]/g, '').trim();
  return [question.title, bare, ...question.aliases].some((a) => a && normalize(a) === typed);
}

export function shuffle(list, random = Math.random) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
