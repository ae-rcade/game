// 정답 칸 비우기. 아이폰 한글 키보드는 조합 중이던 마지막 글자를 기억하고 있어서, value만 지우면
// 다음 글자를 칠 때 그 글자가 다시 나와요. 잠깐 보이지 않는 칸으로 포커스를 옮겨 조합을 끝낸 뒤 비워요.
// 같은 순간에 되돌아오므로 키보드는 열린 채로 있어요.
let spare = null;

export function clearInput(input) {
  if (document.activeElement !== input) {
    input.value = '';
    return;
  }
  if (!spare) {
    spare = document.createElement('input');
    spare.type = 'text';
    spare.tabIndex = -1;
    spare.setAttribute('aria-hidden', 'true');
    spare.setAttribute('autocomplete', 'off');
    spare.setAttribute('autocorrect', 'off');
    spare.setAttribute('autocapitalize', 'off');
    // 글자 크기가 16px보다 작으면 아이폰이 화면을 확대해요.
    spare.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none;font-size:16px';
  }
  input.after(spare);
  spare.focus({ preventScroll: true });
  input.value = '';
  spare.value = '';
  input.focus({ preventScroll: true });
  spare.remove();
}
