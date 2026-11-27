// 게임 모드. id는 랭킹 서버(server/src/index.js)의 MODES와 같아야 해요.
export const MODES = {
  endless: { label: '시간 무제한', durationMs: 0 },
  time90: { label: '타임어택 90초', durationMs: 90_000 },
};
export const COUNTDOWN_MS = 3000; // 타임어택 시작 전 카운트다운
