# 가사 맞추기 멀티 서버

방, 참가자, 문제 출제와 채점을 담당해요. Cloudflare 무료 요금제를 기준으로 해요.

## 처음 한 번: 연결

1. [Cloudflare 대시보드](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**
2. **Import a repository**에서 `ae-rcade/game` 선택
3. 설정
   - Project name: `ae-rcade-lyrics` (`wrangler.jsonc`의 `name`과 같아야 해요)
   - Root directory: `games/lyrics-quiz/server`
   - Deploy command: `npx wrangler deploy` (기본값)
4. **Deploy** 후 `https://ae-rcade-lyrics.n4kyoung-lee.workers.dev`를 열어 동작 메시지를 확인
   (주소가 다르면 `../config.json`의 `multiUrl`을 고쳐요)
5. **Settings → Build → Build watch paths**의 Include에 아래를 넣어요. 서버가 함께 쓰는 파일이 바뀔 때도 다시 배포돼요.

```
games/lyrics-quiz/server/*
games/lyrics-quiz/quiz.js
games/lyrics-quiz/multi/rules.js
games/lyrics-quiz/config.json
```

## 알아둘 점

- 문제 시트는 `../config.json`의 `sheetUrl`에서 게임을 시작할 때마다 읽어요.
- 화면에는 열린 가사만 보내고 제목은 정답 공개 때 보내요. 다만 시트 주소가 공개라서 부정행위를 완전히 막을 수는 없어요.
- 방 코드는 4자리라서 비밀 보장이 강하지 않아요. 접속 시도는 같은 주소당 1분에 40번으로 제한해요.
- 모두 나가면 방은 바로, 모두 연결이 끊기면 5분 뒤에 지워져요.
- 닉네임 검열 기능은 없어요.

## 내 컴퓨터에서 시험

```
npm install
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000
```

`../config.json`의 `multiUrl`을 잠깐 `http://localhost:8787`로 바꾸고, 저장소 맨 위에서 `python3 -m http.server`를 실행해요.
커밋하기 전에 주소를 되돌려요. 다른 시트로 시험하려면 `--var SHEET_URL:<CSV 주소>`를 덧붙여요.
