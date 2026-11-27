# ae-rcade

가볍게 즐기는 미니게임 오락실. 현재는 모바일 세로 화면용이에요.

## 폴더 구조

```
index.html          시작 화면 + 게임 선택 화면
assets/             메인 화면의 스타일·스크립트·그림·글꼴
shared/theme.css    모든 화면이 함께 쓰는 색상과 기본 틀
games/list.json     게임 표시 순서
games/<게임>/       게임 하나 = 폴더 하나
  meta.json         카드에 보이는 이름·설명·모드·준비 상태
  icon.svg          카드 아이콘
  index.html        게임 화면
  style.css         게임 전용 스타일
  main.js           게임 코드
```

## 관리 방법

- **수정:** 해당 게임 폴더 안의 파일만 고쳐요.
- **추가:** 폴더를 복사해 내용을 바꾸고 `games/list.json`에 폴더 이름을 넣어요.
- **삭제:** `games/list.json`에서 이름을 지우고 폴더를 삭제해요.
- **출시:** `meta.json`의 `ready`를 `true`로 바꾸면 "준비 중" 표시가 사라져요.
- `shared/`와 `games/list.json`은 공통 파일이라 수정할 때 주의해요.
- 정답표, 비밀번호, API 키는 이 저장소(공개)에 올리지 않아요.

## 내 컴퓨터에서 확인

`python3 -m http.server` 실행 후 <http://localhost:8000> 접속.
(파일을 더블클릭해서 열면 게임 목록이 보이지 않아요.)

## 글꼴

[Galmuri](https://github.com/quiple/galmuri) — SIL Open Font License (`assets/fonts/LICENSE-Galmuri.md`)
