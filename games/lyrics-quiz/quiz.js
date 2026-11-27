// 화면과 무관한 퀴즈 규칙: 표(CSV) 읽기, 정답 판정, 점수
export const DURATION_MS = 150_000;           // 타임어택 시간
export const COUNTDOWN_MS = 3000;
export const POINTS = [100, 100, 60, 20];    // 가사를 1, 2, 3, 4줄 열었을 때 점수
export const FREE_LINES = 2;                 // 문제가 나오자마자 보여주는 줄 수
// 각 줄을 열 수 있을 때까지, 앞 줄이 열린 뒤 기다리는 시간
export const LINE_DELAYS_MS = [0, 0, 5000, 5000];
export const SHOWN_LINES = LINE_DELAYS_MS.length; // 한 문제에서 보여주는 가사 칸 수
export const WRONG_PENALTY = 20;             // 오답 감점
export const REVEAL_MS = 1200;               // 다음 문제 전에 정답을 보여주는 시간 (남은 시간은 멈춰요)

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

// 첫 줄은 열 이름. '제목'과 '가사1' 열이 필요해요.
// '가사1'부터 오른쪽의 칸은 모두 가사예요(열 이름이 비어 있어도 돼요). 한 칸이 가사 한 줄이에요.
// 가수 칸이 '예시 문제'인 행은 건너뛰어요(skipSample).
export function toQuestions(rows, { skipSample = false } = {}) {
  const header = (rows[0] || []).map((h) => h.replace(/\s/g, ''));
  const title = header.indexOf('제목');
  const alias = header.findIndex((h) => h.startsWith('정답'));
  const artist = header.indexOf('가수');
  const first = header.findIndex((h) => h.startsWith('가사'));
  // 가사가 아닌 이름이 붙은 열(예: 메모)은 제외해요.
  const isLyric = (i) => i >= first && i !== title && i !== alias && i !== artist && (!header[i] || header[i].startsWith('가사'));
  if (title < 0 || first < 0) throw new Error('첫 줄에 "제목"과 "가사1" 열 이름이 필요해요.');
  const get = (row, i) => (i < 0 ? '' : String(row[i] ?? '').trim());
  return rows.slice(1).map((row) => ({
    title: get(row, title),
    aliases: get(row, alias).split('|').map((a) => a.trim()).filter(Boolean),
    artist: get(row, artist),
    // 칸 안의 줄바꿈은 그대로 보여줘요.
    lines: row.map((_, i) => (isLyric(i) ? get(row, i).replace(/\r\n?/g, '\n') : '')).filter(Boolean),
  })).filter((q) => q.title && q.lines.length && !(skipSample && q.artist === '예시 문제'));
}

// 노래에서 이어지는 4줄을 무작위로 골라요. 시작 위치를 제한해 항상 4줄이 나와요.
export function pickLines(lines, random = Math.random) {
  const start = Math.floor(random() * Math.max(1, lines.length - SHOWN_LINES + 1));
  return lines.slice(start, start + SHOWN_LINES);
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

// 가사에 들어 있는 정답(제목·다른 표기)을 ●●●로 가려요.
// 대소문자·띄어쓰기·문장부호가 달라도 찾고, 영어는 다른 단어의 일부(예: you → your)는 가리지 않아요.
export const MASK = '●●●';

export function titleMasker(question) {
  const { title, aliases } = question;
  const bare = title.replace(/\([^()]*\)|\[[^[\]]*\]/g, '');
  // "WDA (Whole Different Animal)"처럼 괄호 안이 제목의 다른 이름인 경우. 솔로·버전·피처링 표시는 제외
  const inside = [...title.matchAll(/\(([^()]*)\)/g)].map((m) => m[1])
    .filter((t) => !/solo|ver\b|feat|&/i.test(t));
  // 'Til We …는 Until We …로 부르는 부분도 가려요.
  const until = /^['’]til\b/i.test(title) ? [bare.replace(/^['’]til/i, 'until')] : [];
  const terms = [...new Set([title, bare, ...inside, ...until, ...aliases]
    .map((t) => t.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // 긴 표기부터 가려요.
  const patterns = terms.map((term) => {
    const letters = [...term];
    // 끝의 s와 -ing는 붙어 있어도 같은 말로 봐요 (drama/dramas, flowers/flower, drift/drifting).
    const latin = /\p{Script=Latin}|\p{N}/u.test(term);
    if (latin && letters.length >= 5 && letters.at(-1) === 's') letters.pop();
    const body = letters.join('[^\\p{L}\\p{N}]*') + (latin && term.length >= 4 ? "(?:['’]?s|ing|in['’]?)?" : '');
    // 영어·숫자와 한 글자짜리 표기는 앞뒤가 이어진 단어면 가리지 않아요.
    const edge = latin ? '[\\p{Script=Latin}\\p{N}]' : letters.length < 2 ? '\\p{L}' : null;
    return new RegExp(edge ? `(?<!${edge})${body}(?!${edge})` : body, 'giu');
  });
  // 줄바꿈에 걸친 제목은 줄바꿈을 남기고 가려요.
  const hide = (found) => found.split('\n').map(() => MASK).join('\n');
  return (line) => patterns.reduce((text, pattern) => text.replace(pattern, hide), line.normalize('NFC'));
}

export function shuffle(list, random = Math.random) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
