# 블랙맘바 서버

Cloudflare Workers + Durable Object. 맵 하나 = `Arena` 객체 하나이고, 이동·먹기·충돌 판정은 모두 서버가 해요.
접속한 사람이 있는 동안에만 게임이 돌고, 모두 나가면 멈춰요(다음에는 새 맵). 아무것도 저장하지 않아요.

## 처음 설정 (Cloudflare 대시보드)

1. **Workers & Pages → Create application → Import a repository**에서 `ae-rcade/game`을 골라요.
2. 설정을 이렇게 넣어요.
   - Project name: `ae-rcade-worm` (`wrangler.jsonc`의 `name`과 같아야 해요)
   - Deploy command: `npx wrangler deploy`
   - Root directory(고급 설정): `games/worm/server`
3. **Deploy**를 누르고, 끝나면 `workers.dev` 주소를 열어 "블랙맘바 서버가 동작 중이에요"가 보이는지 확인해요.
4. 그 Worker의 **Settings → Build → Build watch paths → Include paths**에 넣어요.
   `games/worm/server/*`, `games/worm/rules.js`, `games/worm/world.js`, `games/worm/bots.js`, `games/worm/protocol.js`
5. 서버 주소를 `../config.json`의 `serverUrl`에 넣어요.

## 인원과 무료 플랜 한도

- 동시에 최대 30명(`src/game.js`의 `MAX_PLAYERS`), 사람이 적으면 봇이 12마리까지 채워요.
- 같은 접속 주소에서는 15명까지(`src/index.js`).
- 하루 한도는 계정 전체(다른 게임 서버 포함)가 함께 쓰고, 매일 오전 9시(한국 시간)에 초기화돼요.
  - 받는 메시지: 요청 100,000회 = WebSocket 메시지 약 200만 개.
    한 사람이 방향을 계속 바꾸면 초당 약 5개(`../protocol.js`의 `INPUT_MS` 0.2초)라서,
    모두 합쳐 하루 약 110시간(사람×시간) 이상 할 수 있어요.
  - 실행 시간: 13,000 GB-s = 서버 하나를 약 28시간. 다른 게임의 Durable Object도 여기서 써요.
- 한도를 넘으면 초기화될 때까지 접속이 안 돼요(요금은 나가지 않아요).

## 내 컴퓨터에서 시험

```
npm install
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000
```

저장소 맨 위에서 `python3 -m http.server 8000`을 실행하고, `../config.json`의 `serverUrl`을
`http://localhost:8787`로 바꿔 시험해요(올릴 때는 되돌려요).
