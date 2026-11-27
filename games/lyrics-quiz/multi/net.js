// 서버 연결. 휴대폰에서 다른 앱에 다녀오는 등 연결이 끊기면 같은 자리로 다시 접속해요.
const PING_MS = 8000;       // 연결 확인 간격
const SILENT_MS = 20_000;   // 이만큼 아무 응답이 없으면 다시 접속
const OPEN_MS = 8000;       // 접속 대기 시간
const GIVE_UP_MS = 3 * 60_000;
const RETRY_MS = [500, 1000, 2000, 3000, 5000];

// params: { action: 'create' | 'join' | 'rejoin', name, code, token }
// handlers: welcome(session), state(state), notice(message), reconnecting(), end(message)
export function connect(base, params, handlers) {
  let ws = null, session = params.token ? { code: params.code, token: params.token } : null;
  let ended = false, heard = 0, tries = 0, lostAt = null, retryTimer = 0, probeTimer = 0;

  function end(message) {
    if (ended) return;
    ended = true;
    cleanup();
    handlers.end(message);
  }

  function drop() {
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    try { ws.close(); } catch { /* 이미 닫힘 */ }
    ws = null;
  }

  function retry() {
    drop();
    clearTimeout(probeTimer);
    if (ended) return;
    // 방에 들어가기 전에 실패하면 다시 시도하지 않아요.
    if (!session) return end('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.');
    lostAt ??= Date.now();
    if (Date.now() - lostAt > GIVE_UP_MS) return end('연결이 끊겨 방에서 나왔어요.');
    handlers.reconnecting();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(open, RETRY_MS[Math.min(tries++, RETRY_MS.length - 1)]);
  }

  function open() {
    drop();
    clearTimeout(retryTimer);
    const url = new URL(`${base}/ws`);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    const query = session ? { action: 'rejoin', ...session } : params;
    for (const [key, value] of Object.entries(query)) if (value) url.searchParams.set(key, value);
    heard = Date.now();
    let welcomed = false;
    try { ws = new WebSocket(url); } catch (error) { console.error(error); return retry(); }
    ws.onclose = retry;
    ws.onmessage = ({ data }) => {
      heard = Date.now();
      if (data === 'pong') return clearTimeout(probeTimer);
      const message = JSON.parse(data);
      if (message.type === 'welcome') {
        welcomed = true;
        tries = 0;
        lostAt = null;
        session = { code: message.code, token: message.token };
        handlers.welcome({ ...session, you: message.you });
      } else if (message.type === 'state') {
        clearTimeout(probeTimer);
        handlers.state(message.state);
      } else if (message.type === 'replaced') {
        end('다른 화면에서 같은 자리로 접속했어요.');
      } else if (message.type === 'error') {
        if (message.fatal) end(message.message);
        else if (welcomed) handlers.notice(message.message);
        else if (!session) end(message.message);
        // 다시 접속하는 중의 일시적인 거절은 닫힌 뒤 재시도해요.
      }
    };
  }

  const pinger = setInterval(() => {
    if (!ws) return;
    if (ws.readyState === WebSocket.CONNECTING) {
      if (Date.now() - heard > OPEN_MS) retry();
    } else if (ws.readyState === WebSocket.OPEN) {
      if (Date.now() - heard > SILENT_MS) retry();
      else if (Date.now() - heard >= PING_MS) ws.send('ping');
    }
  }, 2000);

  // 화면으로 돌아오거나 인터넷이 다시 연결되면 바로 확인해요.
  function check() {
    if (ended || document.visibilityState === 'hidden') return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (session && ws?.readyState !== WebSocket.CONNECTING) { lostAt = null; open(); }
      return;
    }
    ws.send('ping');
    clearTimeout(probeTimer);
    probeTimer = setTimeout(retry, 3000);
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('online', check);

  function cleanup() {
    clearInterval(pinger);
    clearTimeout(retryTimer);
    clearTimeout(probeTimer);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('online', check);
    drop();
  }

  open();
  return {
    // 연결되어 있을 때만 보내요. 보냈으면 true
    send(message) {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(message));
      return true;
    },
    leave() {
      if (ended) return;
      this.send({ type: 'leave' });
      ended = true;
      cleanup();
    },
  };
}
