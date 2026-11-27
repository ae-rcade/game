// 가사 맞추기 멀티 서버 (Cloudflare Workers + Durable Objects). 방 하나 = Room 객체 하나예요.
import { DurableObject } from 'cloudflare:workers';
import { CODE_CHARS, CODE_LENGTH, cleanCode, cleanName } from '../../multi/rules.js';
import { reject } from './reject.js';

export { Room } from './room.js';

const REQUESTS_PER_MINUTE = 40; // 같은 접속 주소의 접속 시도 제한 (방 코드를 마구 넣어 보는 것 방지)

export class Gate extends DurableObject {
  recent = new Map(); // 저장하지 않고 메모리에만 둬요.

  allow(address) {
    const now = Date.now();
    if (this.recent.size > 5000) this.recent.clear();
    const entry = this.recent.get(address);
    if (!entry || now - entry.since > 60_000) {
      this.recent.set(address, { since: now, count: 1 });
      return true;
    }
    return ++entry.count <= REQUESTS_PER_MINUTE;
  }
}

const randomCode = () => [...crypto.getRandomValues(new Uint32Array(CODE_LENGTH))]
  .map((n) => CODE_CHARS[n % CODE_CHARS.length]).join('');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.json({ message: 'ae-rcade 가사 맞추기 멀티 서버가 동작 중이에요.' });
    if (url.pathname !== '/ws') return new Response('없는 주소예요.', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket 접속만 받아요.', { status: 426 });

    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (origin && !allowed.includes(origin)) return new Response('허용되지 않은 사이트예요.', { status: 403 });

    const address = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await env.GATE.get(env.GATE.idFromName('gate')).allow(address)) {
      return reject('접속 시도가 너무 많아요. 잠시 후 다시 해 주세요.', { fatal: false });
    }

    const action = url.searchParams.get('action');
    if (!['create', 'join', 'rejoin'].includes(action)) return reject('잘못된 요청이에요.');
    if (action !== 'rejoin' && !cleanName(url.searchParams.get('name'))) return reject('닉네임을 입력해 주세요.');

    const enter = (code) => {
      const target = new URL(url);
      target.searchParams.set('code', code);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(target, request));
    };
    if (action === 'create') {
      // 이미 쓰는 코드가 나오면 다시 뽑아요.
      for (let i = 0; i < 5; i++) {
        const response = await enter(randomCode());
        if (response.status !== 409) return response;
      }
      return reject('방을 만들지 못했어요. 다시 해 주세요.');
    }
    const code = cleanCode(url.searchParams.get('code'));
    if (code.length !== CODE_LENGTH) return reject(`방 코드 ${CODE_LENGTH}자리를 입력해 주세요.`);
    return enter(code);
  },
};
