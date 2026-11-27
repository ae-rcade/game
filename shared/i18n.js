// 언어 선택(한글 / English). 화면은 한글로 만들고, English를 고르면 보이는 문구를 바꿔 보여 줘요.
// 새 문구를 화면에 넣으면 아래 목록(WORDS 또는 PATTERNS)에도 영어를 넣어 주세요.
// 닉네임, 가사, 노래 제목처럼 사람이 쓴 글은 바꾸지 않아요.
(() => {
  const KEY = 'ae-rcade.lang';
  let lang = 'ko';
  try { if (localStorage.getItem(KEY) === 'en') lang = 'en'; } catch { /* 저장이 막힌 브라우저 */ }

  window.i18n = {
    lang,
    set(next) {
      try { localStorage.setItem(KEY, next); } catch { return; }
      if (next !== lang) location.reload();
    },
  };
  // 다른 화면에서 언어를 바꾼 뒤 뒤로 돌아오면 다시 불러와요.
  window.addEventListener('pageshow', () => {
    let saved = lang;
    try { saved = localStorage.getItem(KEY) === 'en' ? 'en' : 'ko'; } catch { /* 그대로 둬요 */ }
    if (saved !== lang) location.reload();
  });
  if (lang !== 'en') return;

  const WORDS = {
    // 메인
    'ae-rcade — 가볍게 즐기는 미니게임 오락실': 'ae-rcade — a little arcade of mini games',
    '시작 화면으로': 'Back to title',
    '게임 선택': 'Select Game',
    '준비 중': 'Coming Soon',
    '새 게임을 기다려 주세요': 'New games are on the way',
    '게임 목록을 불러오지 못했어요. 새로고침해 주세요.': "Couldn't load the games. Please refresh.",
    '개인': 'Solo', '최대 4인': 'Up to 4', '2인': '2 players', '멀티': 'Online',

    // 공통
    '게임 목록으로': 'Back to games',
    '뒤로': 'Back',
    '모드 선택': 'Select Mode',
    '모드 선택으로': 'Back to modes',
    '닉네임': 'Nickname',
    '점수': 'Score',
    '순위': 'Rank',
    '확인': 'OK',
    '닫기': 'Close',
    '▶ 다시 하기': '▶ Play Again',
    '▶ 계속하기': '▶ Continue',
    '다시 불러오기': 'Reload',
    '게임을 불러오지 못했어요.': "Couldn't load the game.",
    '새로고침해 주세요.': 'Please refresh.',
    '닉네임을 입력해 주세요.': 'Please enter a nickname.',

    // 가사 맞추기
    '가사 맞추기': 'Guess the Lyrics',
    '가사를 보고 노래 제목을 맞혀요': 'Read the lyrics and guess the song',
    '가사 맞추기 · ae-rcade': 'Guess the Lyrics · ae-rcade',
    '가사 맞추기 멀티 · ae-rcade': 'Guess the Lyrics Online · ae-rcade',
    '싱글 모드': 'Single Player',
    '혼자서 타임어택': 'Solo time attack',
    '멀티 모드': 'Multiplayer',
    '최대 4인 · 방 코드로 함께': 'Up to 4 · play with a room code',
    '? 칸을 눌러 가사를 열어요. 적게 볼수록 점수가 높아요': 'Tap ? to reveal lyrics. Fewer lines, more points',
    '▶ 시작': '▶ Start',
    '남은 시간': 'Time',
    '맞힌 문제': 'Solved',
    '패스': 'Pass',
    '노래 제목': 'Song title',
    '내 점수': 'My Score',
    '나온 문제와 정답': 'Questions and answers',
    '제목 가림': 'title hidden',
    '제목 안 가림': 'title shown',
    '가사 속 제목은 ●●●로 가려요': 'Titles in the lyrics are hidden as ●●●',
    '가사 속 제목은 가리지 않아요': 'Titles in the lyrics are not hidden',
    '시간 종료!': "Time's up!",
    '시간 종료': 'Time up',
    '모든 문제 완료!': 'All questions done!',
    '문제를 불러오는 중…': 'Loading questions…',
    '문제를 불러오지 못했어요.': "Couldn't load the questions.",
    '문제를 불러오지 못했어요. 인터넷 연결과 시트의 "웹에 게시" 설정을 확인해 주세요.': 'Couldn\'t load the questions. Check your connection and the sheet\'s "Publish to web" setting.',
    'config.json의 형식이 잘못됐어요.': 'config.json is not valid.',
    'sheetUrl에는 편집 주소가 아니라 "웹에 게시"에서 만든 CSV 주소를 넣어 주세요.': 'sheetUrl must be the CSV link from "Publish to web", not the edit link.',
    '표 대신 웹페이지가 왔어요. 게시 형식을 CSV로 선택해 주세요.': 'Got a web page instead of a table. Publish the sheet as CSV.',
    '시트에 문제가 없어요. 제목과 가사를 한 줄 이상 입력해 주세요.': 'The sheet has no questions. Add at least one title and lyric line.',
    '첫 줄에 "제목"과 "가사1" 열 이름이 필요해요.': 'The first row needs the column names "제목" and "가사1".',

    // 가사 맞추기 멀티
    '방 만들기': 'Create Room',
    '코드를 만들어 친구를 불러요': 'Get a code and invite friends',
    '참여하기': 'Join Room',
    '방 코드 4자리로 들어가요': 'Enter with a 4-character code',
    '최대 10자': 'Up to 10 characters',
    '방 코드': 'Room code',
    '4자리': '4 characters',
    '들어가기': 'Enter',
    '대기 화면': 'Waiting Room',
    '방 코드 (비밀번호)': 'Room code (password)',
    '코드 복사': 'Copy code',
    '문제 수': 'Questions',
    '문제 수 줄이기': 'Fewer questions',
    '문제 수 늘리기': 'More questions',
    '▶ 시작하기': '▶ Start',
    '방 나가기': 'Leave Room',
    '먼저 맞힌 한 사람만 점수를 얻어요': 'Only the first correct answer scores',
    '게임 종료!': 'Game Over!',
    '나온 문제와 맞힌 사람': 'Questions and who solved them',
    '대기 화면으로 (한 판 더)': 'Back to waiting room (play again)',
    '연결이 끊겼어요. 다시 연결하는 중…': 'Disconnected. Reconnecting…',
    '방에서 나갈까요?': 'Leave the room?',
    '빈자리': 'Empty',
    '방장': 'Host', '나': 'Me', '연결 끊김': 'Disconnected',
    '불러오는 중…': 'Loading…',
    '방장이 시작하기를 누르면 게임이 시작돼요': 'The game starts when the host presses Start',
    '나감': 'Left', '끊김': 'Offline', '오답': 'Wrong',
    '모두 오답!': 'Everyone missed!',
    '정답자 없음': 'no one solved it',
    '방장이 대기 화면으로 돌아가면 한 판 더 할 수 있어요': 'You can play again when the host returns to the waiting room',
    '연결하는 중…': 'Connecting…',
    '코드를 복사했어요': 'Code copied',
    '복사하지 못했어요. 코드를 직접 알려 주세요': "Couldn't copy. Please share the code yourself",
    '멀티 서버가 아직 연결되지 않았어요.': 'The multiplayer server is not connected yet.',
    '들어가 있던 방에 다시 연결하는 중…': 'Reconnecting to your room…',
    '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.': "Couldn't connect to the server. Check your connection and try again.",
    '연결이 끊겨 방에서 나왔어요.': 'Connection lost. You left the room.',
    '다른 화면에서 같은 자리로 접속했어요.': 'Your seat was opened on another screen.',
    '접속 시도가 너무 많아요. 잠시 후 다시 해 주세요.': 'Too many attempts. Please try again later.',
    '잘못된 요청이에요.': 'Invalid request.',
    '방을 만들지 못했어요. 다시 해 주세요.': "Couldn't create a room. Please try again.",
    '방이 사라졌어요.': 'The room no longer exists.',
    '방을 찾을 수 없어요. 코드를 확인해 주세요.': 'Room not found. Check the code.',
    '자리가 사라져서 다시 들어갈 수 없어요.': 'Your seat is gone, so you cannot rejoin.',
    '게임이 막 끝난 방이에요. 방장이 대기 화면으로 돌아간 뒤에 들어와 주세요.': 'This game just ended. Join after the host returns to the waiting room.',
    '이미 게임이 진행 중인 방이에요.': 'This game is already in progress.',
    '같은 닉네임이 있어요. 다른 닉네임을 써 주세요.': 'That nickname is taken. Please use another one.',
    '문제를 불러오지 못했어요. 다시 시작해 주세요.': "Couldn't load the questions. Please start again.",

    // 리치 게임
    '리치 게임': 'Lychee Game',
    '리치 게임 · ae-rcade': 'Lychee Game · ae-rcade',
    '같은 캐릭터를 합쳐 가장 큰 캐릭터를 만들어요': 'Merge matching characters into the biggest one',
    '현재 순위 보기': 'View rankings',
    '다시 시작': 'Restart',
    '최고': 'Best',
    '다음': 'Next',
    '다음 캐릭터': 'Next character',
    '게임 판. 누른 채 좌우로 움직이고 손을 떼면 떨어져요.': 'Game board. Hold, slide left or right, and release to drop.',
    '합쳐지는 순서': 'Merge order',
    '점선을 넘을 때까지 자유롭게': 'Play freely until you cross the dotted line',
    '3초 카운트다운 후 90초 동안 최고 점수': 'Highest score in 90 seconds after a 3-second countdown',
    '순위 보기': 'Rankings',
    '지금은 기록이 이 기기에만 저장돼요.': 'Scores are saved on this device only for now.',
    '순위 TOP 10': 'TOP 10',
    '닉네임 (10자 이내)': 'Nickname (max 10)',
    '등록': 'Submit',
    '시간 무제한': 'Endless',
    '타임어택 90초': '90s Time Attack',
    '순위를 불러오는 중…': 'Loading rankings…',
    '그 사이 더 높은 기록이 올라와 탑10에서 밀렸어요.': 'Higher scores came in and pushed yours out of the top 10.',
    '아쉽게도 탑10에는 들지 못했어요.': "Sorry, you didn't make the top 10.",
    '시작할 때 랭킹 서버에 연결하지 못해 이번 기록은 등록할 수 없어요.': "The ranking server couldn't be reached at the start, so this score can't be submitted.",
    '탑10 진입! 닉네임을 등록하세요. 등록하지 않고 나가면 기록이 사라져요.': 'Top 10! Enter a nickname. Your score is lost if you leave without submitting.',
    '순위를 불러오지 못했어요.': "Couldn't load the rankings.",
    '등록하는 중…': 'Submitting…',
    '등록하지 못했어요. 잠시 후 다시 눌러 주세요.': "Couldn't submit. Please try again shortly.",
    '모든 플레이어 기록': 'All players',
    '이 기기에만 저장되는 기록 (온라인 랭킹 연결 전)': 'Saved on this device only (online ranking not connected)',
    '알 수 없는 모드예요.': 'Unknown mode.',
    '요청이 너무 많아요. 잠시 후 다시 해 주세요.': 'Too many requests. Please try again later.',
    '잘못된 기록이에요.': 'Invalid score.',
    '이 기록은 등록 시간이 지났거나 이미 처리됐어요.': 'This score has expired or was already submitted.',
    '점수를 확인할 수 없어요.': "The score couldn't be verified.",
    '허용되지 않은 사이트예요.': 'This site is not allowed.',
    '요청이 너무 커요.': 'The request is too large.',
    '없는 주소예요.': 'Address not found.',

    // 블랙맘바
    '블랙맘바': 'Black Mamba',
    '블랙맘바 · ae-rcade': 'Black Mamba · ae-rcade',
    '먹이를 먹고 가장 길게 살아남아요': 'Eat, grow and become the longest',
    '게임 화면. 끌어서 방향을 정하고, 빠르게 두 번 터치하면 부스트.': 'Game screen. Drag to steer, double-tap quickly to boost.',
    '두 번 터치 · 부스트': 'Double-tap · Boost',
    '▶ 입장하기': '▶ Enter',
    '화면을': '', '끌어서': 'Drag', '방향 조종': 'to steer',
    '두 번 빠르게 터치': 'Double-tap quickly', '하면 부스트': ' to boost',
    '캐릭터를 먹으면 그 색으로 길어져요': 'Eat characters to grow in their color',
    '머리가 다른 지렁이나 맵 끝에 닿으면 끝!': "Don't hit another snake or the edge with your head!",
    '최종 길이': 'Final Length',
    '잡은 수': 'Kills',
    '내 최고': 'My Best',
    '▶ 바로 다시 시작': '▶ Restart Now',
    '닉네임 바꾸기': 'Change nickname',
    '서버에 접속하는 중…': 'Connecting to the server…',
    '맵 끝에 닿았어요': 'You hit the edge of the map',
    '서버 주소가 잘못됐어요.': 'The server address is wrong.',
    '서버와 연결이 끊겼어요. 다시 입장해 주세요.': 'Disconnected from the server. Please enter again.',
    '서버 응답이 없어요. 다시 입장해 주세요.': 'The server is not responding. Please enter again.',
    '다른 화면에 다녀오는 동안 연결이 끊겼어요.': 'Disconnected while you were away.',
    '같은 인터넷에서 접속한 사람이 너무 많아요.': 'Too many players on the same network.',
  };

  // 숫자나 이름이 섞인 문구. t()는 안쪽 문구를 다시 바꿔요.
  const PATTERNS = [
    [/^(\d+)단계$/, (m) => `Level ${m[1]}`],
    [/^(\d+)위$/, (m) => `#${m[1]}`],
    [/^(-?\d+)점$/, (m) => `${m[1]} pts`],
    [/^(\d+)문제$/, (m) => `${m[1]} Qs`],
    [/^(\d+)위에 기록됐어요!$/, (m) => `You're ranked #${m[1]}!`],
    [/^랭킹 서버 응답 (\d+)$/, (m) => `Ranking server error ${m[1]}`],
    [/^응답 (\d+)$/, (m) => `Error ${m[1]}`],
    [/^모드: (\S+) \((.+?)\)( ⇄)?$/, (m, t) => `Mode: ${m[1]} (${t(m[2])})${m[3] || ''}`],
    [/^노래 속 이어지는 가사 4줄을 보고 제목을 직접 입력해요\. (.+)$/, (m, t) => `Read 4 lines in a row from a song and type its title. ${t(m[1])}`],
    [/^(\S+) · 맞힌 문제 (\d+)개 · 내 최고 점수 (\d+)점$/, (m) => `${m[1]} · Solved ${m[2]} · My best ${m[3]} pts`],
    [/^예시 문제 (\d+)개 \(아직 문제 시트 연결 전\)$/, (m) => `${m[1]} sample questions (question sheet not connected yet)`],
    [/^문제 (\d+)개 준비 완료$/, (m) => `${m[1]} questions ready`],
    [/^(\d+)초 동안 최대한 많이 맞혀요$/, (m) => `Solve as many as you can in ${m[1]} seconds`],
    [/^2줄까지 (\d+)점 · 3줄 (\d+)점 · 4줄 (\d+)점$/, (m) => `Up to 2 lines ${m[1]} pts · 3 lines ${m[2]} · 4 lines ${m[3]}`],
    [/^틀리면 -(\d+)점이고 다음 문제로 넘어가요\. 패스는 가사를 모두 연 뒤에 가능해요$/, (m) => `Wrong answer: -${m[1]} pts and next question. You can pass after opening every line`],
    [/^처음 2줄은 바로 보여요\. 3번째 줄은 문제가 나온 뒤 ([\d.]+)초, 4번째 줄은 3번째 줄을 연 뒤 ([\d.]+)초 후에 열 수 있어요$/,
      (m) => `The first 2 lines show at once. Line 3 opens ${m[1]}s into the question, line 4 ${m[2]}s after you open line 3`],
    [/^맞히면 (\d+)점$/, (m) => `Worth ${m[1]} pts`],
    [/^\?\(([\d.]+)초\)$/, (m) => `?(${m[1]}s)`],
    [/^(\d+)번째 줄 열기$/, (m) => `Open line ${m[1]}`],
    [/^(\d+)번째 줄은 아직 열 수 없어요$/, (m) => `Line ${m[1]} can't be opened yet`],
    [/^문제 (\d+)$/, (m) => `Question ${m[1]}`],
    [/^문제 (\d+) \/ (\d+)$/, (m) => `Question ${m[1]} / ${m[2]}`],
    [/^정답! \+(\d+)점$/, (m) => `Correct! +${m[1]} pts`],
    [/^(.+)님 정답! \+(\d+)점$/, (m) => `${m[1]} got it! +${m[2]} pts`],
    [/^오답 -(\d+)점$/, (m) => `Wrong -${m[1]} pts`],
    [/^오답 -(\d+)점 · 이번 문제는 더 답할 수 없어요$/, (m) => `Wrong -${m[1]} pts · no more answers for this question`],
    [/^(패스|시간 종료) · (.*)$/s, (m, t) => `${t(m[1])} · ${m[2]}`],
    [/^(\d+\. .*) · 정답자 없음$/s, (m) => `${m[1]} · no one solved it`],
    [/^참가자 (\d+) \/ (\d+)(?: · (.+))?$/, (m, t) => `Players ${m[1]} / ${m[2]}${m[3] ? ` · ${t(m[3])}` : ''}`],
    [/^(\d+)명 이상 모이면 시작할 수 있어요$/, (m) => `Need at least ${m[1]} players to start`],
    [/^(\d+)명 이상 모여야 시작할 수 있어요\.$/, (m) => `Need at least ${m[1]} players to start.`],
    [/^⏱ (\d+)초$/, (m) => `⏱ ${m[1]}s`],
    [/^(\S+) · (\d+)문제$/, (m) => `${m[1]} · ${m[2]} Qs`],
    [/^맞힌 문제 (\d+)개( · 나감)?$/, (m) => `Solved ${m[1]}${m[2] ? ' · Left' : ''}`],
    [/^((?:방장|나|연결 끊김)(?: · (?:방장|나|연결 끊김))+)$/, (m, t) => m[1].split(' · ').map(t).join(' · ')],
    [/^방 코드 (\d+)자리를 입력해 주세요\.$/, (m) => `Enter the ${m[1]}-character room code.`],
    [/^방이 가득 찼어요 \(최대 (\d+)명\)\.$/, (m) => `The room is full (max ${m[1]}).`],
    [/^3·4번째 줄은 ([\d.]+)초 간격으로 자동으로 열려요\. 4번째 줄이 열리고 ([\d.]+)초가 지나면 다음 문제예요$/,
      (m) => `Lines 3 and 4 open automatically every ${m[1]}s. The next question starts ${m[2]}s after line 4 opens`],
    [/^틀리면 -(\d+)점이고 그 문제는 더 답할 수 없어요$/, (m) => `Wrong answer: -${m[1]} pts and no more answers for that question`],
    [/^(.*)의 (머리|몸)에 부딪혔어요$/s, (m) => `You hit ${m[1]}'s ${m[2] === '머리' ? 'head' : 'body'}`],
    [/^(\d+) \(새 기록!\)$/, (m) => `${m[1]} (New record!)`],
    [/^지금은 자리가 가득 찼어요 \(최대 (\d+)명\)\. 잠시 후 다시 해 주세요\.$/, (m) => `The game is full (max ${m[1]}). Please try again later.`],
  ];

  const translate = (text) => {
    if (Object.hasOwn(WORDS, text)) return WORDS[text];
    for (const [pattern, make] of PATTERNS) {
      const match = pattern.exec(text);
      if (match) return make(match, translate);
    }
    return text;
  };
  const korean = /[가-힣]/;
  // 앞뒤 공백은 그대로 두고 가운데 문구만 바꿔요.
  const convert = (value) => {
    const text = value.trim();
    if (!korean.test(text)) return value;
    const result = translate(text);
    return result === text ? value : value.replace(text, () => result);
  };

  // 사람이 쓴 글이 들어가는 자리
  const USER_TEXT = '#reveal-title, .scoreboard li > span, .members li > strong, .ranking .name, tbody td, #hud .ranking li > span';
  const ATTRIBUTES = ['aria-label', 'placeholder', 'alt', 'title'];

  function textNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.matches(`script, style, textarea, ${USER_TEXT}`)) return;
    // 가사 칸에서는 아직 닫힌 칸의 "?(3초)"만 바꿔요.
    if (parent.closest('#lines') && !node.data.trim().startsWith('?(')) return;
    const next = convert(node.data);
    if (next !== node.data) node.data = next;
  }

  function attributes(node) {
    for (const name of node.matches('meta[name="description"]') ? ['content'] : ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value === null) continue;
      const next = convert(value);
      if (next !== value) node.setAttribute(name, next);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) return textNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    attributes(root);
    for (const child of root.childNodes) walk(child);
  }

  document.documentElement.lang = 'en';
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'childList') change.addedNodes.forEach(walk);
      else if (change.type === 'characterData') textNode(change.target);
      else attributes(change.target);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  document.addEventListener('DOMContentLoaded', () => walk(document.documentElement));

  const ask = window.confirm.bind(window);
  window.confirm = (message) => ask(convert(String(message)));
})();
