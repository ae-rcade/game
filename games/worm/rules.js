// 게임 규칙 숫자 모음. 화면과 (2단계부터) 서버가 함께 쓰므로 화면 관련 코드는 넣지 않아요.
export const RULES = {
  mapRadius: 1600,      // 맵 반지름
  spacing: 6,           // 몸 마디 간격
  startLength: 12,      // 시작 길이(마디 수)
  maxLength: 1000,
  speed: 140,           // 초당 이동 거리
  boostSpeed: 280,
  boostSec: 1,          // 부스트 지속 시간
  boostCooldownSec: 3,  // 부스트가 끝난 뒤 다시 쓰기까지
  turnRate: 4.4,        // 초당 회전(라디안). 몸이 굵어질수록 조금 느려져요.
  foodCount: 420,       // 맵에 항상 유지하는 먹이 수
  foodLimit: 900,       // 죽은 지렁이가 남긴 먹이까지 합친 최대 수
  foodGrow: 2,          // 먹이 하나에 늘어나는 길이
  dropEvery: 3,         // 죽으면 몇 마디마다 먹이 하나가 되는지
  dropGrow: 2,
  shieldSec: 2,         // 시작 직후 보호 시간
  botMaxLength: 160,    // 봇은 이보다 길어지지 않아요(시작할 때 조금씩 다르게 정해요).
  population: 12,       // 사람이 적으면 봇을 채워 맞추는 지렁이 수
  nameMax: 10,
};

// 먹이 종류 = 수박 게임 캐릭터 그림 9개와 레몬(images/food1~10.png). color는 먹었을 때 자라는 몸 색이에요.
export const KINDS = [
  { color: '#E2B8FF', edge: '#A866D6' }, // 1 보라
  { color: '#FFFFFF', edge: '#BDB5CF' }, // 2 흰색
  { color: '#B1B3BF', edge: '#66646F' }, // 3 회색
  { color: '#A9DEFF', edge: '#5C93EE' }, // 4 하늘
  { color: '#FFDF5E', edge: '#EFA21F' }, // 5 노랑
  { color: '#FFF4B8', edge: '#DDBE55' }, // 6 크림
  { color: '#FF515D', edge: '#A91228' }, // 7 빨강
  { color: '#A9DEFF', edge: '#5C93EE' }, // 8 하늘(복슬)
  { color: '#FF9FB1', edge: '#D2607C' }, // 9 분홍
  { color: '#CBEA2E', edge: '#7FA000' }, // 10 레몬 연두
];
// 시작 몸 색 후보 (같은 색인 8번은 빼요)
export const BASE_COLORS = [0, 1, 2, 3, 4, 5, 6, 8, 9];

export const radiusFor = (length) => 9 + Math.min(11, Math.sqrt(Math.max(0, length - RULES.startLength)) * 0.55);

export const cleanName = (raw) => [...String(raw ?? '').normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim()]
  .slice(0, RULES.nameMax).join('').trim();
