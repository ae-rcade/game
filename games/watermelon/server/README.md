# 수박 게임 랭킹 서버

모든 플레이어가 같은 탑10을 보도록 기록을 저장해요. Cloudflare 무료 요금제를 기준으로 해요.

## 처음 한 번: 연결

1. [Cloudflare 대시보드](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**
2. 기존 Git 저장소 가져오기(**Import a repository**)에서 GitHub 연결, `ae-rcade/game` 선택
3. 설정
   - Project name: `ae-rcade-watermelon` (`wrangler.jsonc`의 `name`과 같아야 해요)
   - Root directory: `games/watermelon/server` (고급 설정 안에 있을 수 있어요)
   - Deploy command: `npx wrangler deploy` (기본값)
4. **Deploy** 후 `https://ae-rcade-watermelon.<내 주소>.workers.dev` 형태의 주소를 열어 동작 메시지를 확인
5. `games/watermelon/config.json`의 `rankingUrl`에 그 주소를 넣고 커밋

```json
{ "rankingUrl": "https://ae-rcade-watermelon.<내 주소>.workers.dev" }
```

## 알아둘 점

- 저장소의 `main`이 바뀌면 자동으로 다시 배포돼요. 대시보드의 **Build watch paths**를
  `games/watermelon/server/*`로 하면 이 폴더가 바뀔 때만 배포해요.
- 점수는 브라우저에서 계산하므로 조작을 완전히 막을 수는 없어요. 서버는 시작 확인값, 플레이 시간 대비 점수 상한,
  요청 횟수만 검사해요.
- 닉네임 검열 기능은 없어요.
- 이 저장소는 공개라서 비밀번호나 API 키를 넣지 않아요.

## 내 컴퓨터에서 시험

```
npm install
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000
```
