// 멀티 모드 규칙. 화면(multi/main.js)과 서버(server/src)가 함께 써요. 고치면 서버도 다시 배포해야 해요.
// 점수·가사 공개 간격·감점·정답 판정은 싱글과 같은 ../quiz.js를 써요.
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;                 // 시작에 필요한 접속 인원
export const COUNT = { min: 10, max: 20, initial: 10 }; // 문제 수
export const LEVELS = ['normal', 'easy'];     // 난이도: easy는 가사 속 제목을 가리지 않아요
export const ANSWER_MS = 10_000;              // 마지막 가사가 열린 뒤 답할 수 있는 시간
export const REVEAL_MS = 3000;                // 다음 문제 전에 정답을 보여주는 시간
export const SEAT_HOLD_MS = 90_000;           // 대기·결과 화면에서 연결이 끊긴 사람의 자리를 지키는 시간
export const EMPTY_ROOM_MS = 5 * 60_000;      // 모두 끊긴 방을 지우기까지의 시간
export const NAME_MAX = 10;
export const CODE_LENGTH = 4;
export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 헷갈리는 0·O·1·I·L 제외

export const cleanName = (raw) => [...String(raw ?? '').normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim()]
  .slice(0, NAME_MAX).join('').trim();

export const cleanCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, CODE_LENGTH);

// 점수가 높은 순서. 같은 점수는 같은 순위예요(1, 1, 3).
export function rank(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((player) => ({ ...player, rank: 1 + sorted.findIndex((p) => p.score === player.score) }));
}
