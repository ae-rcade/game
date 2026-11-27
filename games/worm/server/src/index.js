// 블랙맘바(지렁이 게임) 서버 (Cloudflare Workers + Durable Objects). 맵 하나 = Arena 객체 하나예요.
import { DurableObject } from 'cloudflare:workers';
import { TICK_MS } from '../../protocol.js';
import { createGame, MAX_PLAYERS } from './game.js';

const PER_ADDRESS = 15;          // 같은 접속 주소(같은 와이파이 등)에서 동시에 접속할 수 있는 수
const CONNECTS_PER_MINUTE = 60;

// 브라우저는 WebSocket 접속 실패의 이유를 알 수 없어서, 일단 연결한 뒤 이유를 보내고 닫아요.
function reject(message) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.send(JSON.stringify({ t: 'x', message }));
  server.close(4000, 'rejected');
  return new Response(null, { status: 101, webSocket: client });
}

// 접속한 사람이 있는 동안에만 게임을 돌려요. 모두 나가면 멈추고 맵은 새로 시작해요.
// 아무것도 저장하지 않아요.
export class Arena extends DurableObject {
  game = null;
  timer = null;
  sockets = new Map(); // 연결 → { player, address }
  recent = new Map();  // 접속 주소 → 최근 접속 횟수

  allow(address) {
    const now = Date.now();
    if (this.recent.size > 2000) this.recent.clear();
    const entry = this.recent.get(address);
    if (!entry || now - entry.since > 60_000) {
      this.recent.set(address, { since: now, count: 1 });
      return true;
    }
    return ++entry.count <= CONNECTS_PER_MINUTE;
  }

  async fetch(request) {
    const address = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!this.allow(address)) return reject('접속 시도가 너무 많아요. 잠시 후 다시 해 주세요.');
    if (this.sockets.size >= MAX_PLAYERS) return reject(`지금은 자리가 가득 찼어요 (최대 ${MAX_PLAYERS}명). 잠시 후 다시 해 주세요.`);
    if ([...this.sockets.values()].filter((s) => s.address === address).length >= PER_ADDRESS) {
      return reject('같은 인터넷에서 접속한 사람이 너무 많아요.');
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.start();
    const player = this.game.connect(
      (data) => { try { server.send(data); } catch { /* 닫힌 연결 */ } },
      (code, reason) => this.drop(server, code, reason),
    );
    this.sockets.set(server, { player, address });
    server.addEventListener('message', (event) => this.game?.receive(player, event.data));
    server.addEventListener('close', () => this.drop(server));
    server.addEventListener('error', () => this.drop(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  drop(socket, code = 1000, reason = 'bye') {
    const entry = this.sockets.get(socket);
    if (entry) {
      this.sockets.delete(socket);
      this.game?.leave(entry.player);
    }
    try { socket.close(code, reason); } catch { /* 이미 닫힘 */ }
    if (!this.sockets.size) this.stop();
  }

  start() {
    if (this.timer !== null) return;
    this.game = createGame();
    let last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.2, (now - last) / 1000) || TICK_MS / 1000;
      last = now;
      try {
        this.game.tick(dt);
      } catch (error) {
        console.error(error);
        for (const socket of [...this.sockets.keys()]) this.drop(socket, 1011, 'error');
      }
    }, TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.game = null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.json({ message: 'ae-rcade 블랙맘바 서버가 동작 중이에요.' });
    if (url.pathname !== '/ws') return new Response('없는 주소예요.', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket 접속만 받아요.', { status: 426 });

    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (origin && !allowed.includes(origin)) return new Response('허용되지 않은 사이트예요.', { status: 403 });

    // 처음 만들어질 때 아시아 태평양 지역에 두도록 부탁해요.
    const arena = env.ARENA.get(env.ARENA.idFromName('arena'), { locationHint: 'apac' });
    return arena.fetch(request);
  },
};
