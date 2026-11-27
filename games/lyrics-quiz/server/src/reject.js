// 브라우저는 WebSocket 접속 실패의 이유를 알 수 없어서, 일단 연결한 뒤 이유를 보내고 닫아요.
export function reject(message, { fatal = true } = {}) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.send(JSON.stringify({ type: 'error', message, fatal }));
  server.close(4000, 'rejected');
  return new Response(null, { status: 101, webSocket: client });
}
