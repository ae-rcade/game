# 수박 게임

같은 단계끼리 닿으면 다음 단계로 합쳐져요.
점선 위에 약 1.5초 머무르면 게임 오버예요 (`engine.js`의 `LIMIT_MS`).
탄력은 `engine.js`의 `BOUNCE`에서 조절해요.

## 파일

- `engine.js` 규칙과 물리
- `main.js` 화면과 터치 입력
- `characters.json` 단계별 이름·그림·크기(`radius`)·점수. 위에서부터 작은 순서
- `images/` 캐릭터 그림 (현재 파일은 임시 캐릭터)
- `vendor/` Matter.js 물리 라이브러리 (MIT)

## 그림 교체

직접 만든 그림이나 사용 허락을 받은 그림만 올려요.
정사각형 투명 배경 PNG에 둥근 캐릭터를 가장자리까지 꽉 차게 그리고,
`images/1.png` ~ `images/9.png`를 덮어쓰면 돼요.
파일 이름을 바꾸면 `characters.json`의 `image`도 함께 고쳐요.
