# 수박 게임

같은 단계끼리 닿으면 다음 단계로 합쳐져요.
모드는 **시간 무제한**과 **타임어택 90초** 두 가지이고, 모드마다 탑10을 따로 기록해요.
점선 위에 약 1.5초 머무르면 게임 오버예요 (`engine.js`의 `LIMIT_MS`).
탄력은 `engine.js`의 `BOUNCE`에서 조절해요.

## 파일

- `modes.js` 모드 이름·제한 시간(90초)·카운트다운
- `panel.js`, `ranking.js` 순위표·닉네임 등록
- `config.json` 온라인 랭킹 서버 주소
- `server/` 랭킹 서버 (설정 방법은 `server/README.md`)
- `engine.js` 규칙과 물리
- `shape.js`, `contour.js` 그림 윤곽으로 충돌 모양 만들기 (`TOLERANCE`로 세밀함 조절)
- `main.js` 화면과 터치 입력
- `characters.json` 단계별 이름·그림·크기(`radius`)·점수. 위에서부터 작은 순서
- `images/` 캐릭터 그림 (`ball1.png` ~ `ball9.png`, 현재는 임시 캐릭터)
- `vendor/` Matter.js 물리 라이브러리 (MIT), earcut 다각형 분할 (ISC)

## 그림 교체

직접 만든 그림이나 사용 허락을 받은 그림만 올려요 (이 저장소와 사이트는 공개예요).

1. GitHub에서 `games/watermelon/images` 폴더를 열어요.
2. **Add file → Upload files**에서 `ball1.png`(가장 작음) ~ `ball9.png`(가장 큼)를 올려요.
3. **Commit changes**를 누르고 몇 분 뒤 새로고침해요.

- 같은 이름의 파일은 덮어써져요. 이름은 소문자로, 확장자는 `.png`로 맞춰요.
- 권장: 512×512 정도의 투명 배경 PNG.
- 투명 여백은 자동으로 잘라내고, 불투명한 윤곽(바깥 테두리)대로 부딪혀요.
- 귀 사이처럼 파인 부분도 윤곽대로 판정해요. 그림 안쪽의 구멍은 채워진 것으로 봐요.
- 배경이 불투명한 정사각형 사진은 원 모양이 돼요. 파일이 없으면 번호가 적힌 공이 대신 나와요.
- 크기와 점수는 `characters.json`의 `radius`, `score`에서 바꿔요.
