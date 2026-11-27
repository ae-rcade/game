// 수박 게임 탑10 랭킹 서버 (Cloudflare Workers + Durable Objects)
import { DurableObject } from 'cloudflare:workers';

// 모드별 최대 플레이 시간(초). id는 ../../modes.js와 같아야 해요.
const MODES = { endless: Infinity, time120: 120 };
const TOP = 10;
const NAME_MAX = 10;
const SESSION_LIFE_MS = 24 * 60 * 60 * 1000;
// 점수 상한 검사: 0.5초마다 한 번 떨어뜨릴 수 있고, 한 번당 점수는 이 값을 넘지 않아요.
// characters.json의 score를 크게 올리면 이 값도 올려야 해요.
const MAX_POINTS_PER_DROP = 60;
const POSTS_PER_MINUTE = 60; // 같은 접속 주소의 과도한 요청 제한

const fail = (status, error) => ({ status, body: { error } });
const ok = (body) => ({ status: 200, body });

const cleanName = (raw) => [...String(raw ?? '').normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim()]
  .slice(0, NAME_MAX).join('').trim();

export class Ranking extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.recent = new Map(); // 요청 횟수 (저장하지 않고 메모리에만 둬요)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, mode TEXT NOT NULL, started INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_started ON sessions (started);
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL UNIQUE, mode TEXT NOT NULL,
        name TEXT NOT NULL, score INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS scores_rank ON scores (mode, score DESC, id);
    `);
    // 한 번만 쓰는 정리: 요청받은 시험 기록 삭제
    this.sql.exec("DELETE FROM scores WHERE mode = 'time120' AND name = 'test_1' AND score = 1099");
  }

  allow(address) {
    const now = Date.now();
    if (this.recent.size > 5000) this.recent.clear();
    const entry = this.recent.get(address);
    if (!entry || now - entry.since > 60_000) {
      this.recent.set(address, { since: now, count: 1 });
      return true;
    }
    return ++entry.count <= POSTS_PER_MINUTE;
  }

  rows(mode) {
    return this.sql.exec(
      'SELECT session, name, score FROM scores WHERE mode = ? ORDER BY score DESC, id LIMIT ?', mode, TOP,
    ).toArray();
  }

  // 다른 사람의 시작 확인값은 밖으로 보내지 않아요.
  result(mode, session) {
    const rows = this.rows(mode);
    const index = rows.findIndex((r) => r.session === session);
    return { scores: rows.map(({ name, score }) => ({ name, score })), rank: index < 0 ? null : index + 1 };
  }

  top(mode) {
    if (!Object.hasOwn(MODES, mode)) return fail(400, '알 수 없는 모드예요.');
    return ok({ scores: this.result(mode).scores });
  }

  start(mode, address) {
    if (!this.allow(address)) return fail(429, '요청이 너무 많아요. 잠시 후 다시 해 주세요.');
    if (!Object.hasOwn(MODES, mode)) return fail(400, '알 수 없는 모드예요.');
    const now = Date.now();
    this.sql.exec('DELETE FROM sessions WHERE started < ?', now - SESSION_LIFE_MS);
    const session = crypto.randomUUID();
    this.sql.exec('INSERT INTO sessions (id, mode, started) VALUES (?, ?, ?)', session, mode, now);
    return ok({ session });
  }

  submit(session, rawName, score, address) {
    if (!this.allow(address)) return fail(429, '요청이 너무 많아요. 잠시 후 다시 해 주세요.');
    const name = cleanName(rawName);
    if (!name) return fail(400, '닉네임을 입력해 주세요.');
    if (typeof session !== 'string' || !Number.isSafeInteger(score) || score <= 0) return fail(400, '잘못된 기록이에요.');

    // 같은 기록을 다시 보내면(응답이 끊긴 경우) 처음 결과를 돌려줘요.
    const saved = this.sql.exec('SELECT mode FROM scores WHERE session = ?', session).toArray()[0];
    if (saved) return ok(this.result(saved.mode, session));

    const run = this.sql.exec('SELECT mode, started FROM sessions WHERE id = ?', session).toArray()[0];
    if (!run) return fail(410, '이 기록은 등록 시간이 지났거나 이미 처리됐어요.');
    const seconds = Math.min((Date.now() - run.started) / 1000, MODES[run.mode]);
    if (score > (Math.floor(seconds * 2) + 2) * MAX_POINTS_PER_DROP) return fail(422, '점수를 확인할 수 없어요.');

    this.sql.exec('DELETE FROM sessions WHERE id = ?', session);
    const { better } = this.sql.exec(
      'SELECT COUNT(*) AS better FROM scores WHERE mode = ? AND score >= ?', run.mode, score,
    ).one();
    if (better < TOP) {
      this.sql.exec(
        'INSERT INTO scores (session, mode, name, score, created) VALUES (?, ?, ?, ?, ?)',
        session, run.mode, name, score, Date.now(),
      );
      this.sql.exec(
        `DELETE FROM scores WHERE mode = ?1 AND id NOT IN
          (SELECT id FROM scores WHERE mode = ?1 ORDER BY score DESC, id LIMIT ?2)`,
        run.mode, TOP,
      );
    }
    return ok(this.result(run.mode, session));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const headers = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    };
    const reply = ({ status, body }) => Response.json(body, { status, headers });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/') return reply(ok({ message: 'ae-rcade 수박 게임 랭킹 서버가 동작 중이에요.' }));

    const ranking = env.RANKING.get(env.RANKING.idFromName('watermelon'));
    if (request.method === 'GET' && url.pathname === '/scores') return reply(await ranking.top(url.searchParams.get('mode')));

    if (request.method === 'POST' && (url.pathname === '/start' || url.pathname === '/scores')) {
      if (origin && !allowed.includes(origin)) return reply(fail(403, '허용되지 않은 사이트예요.'));
      let data;
      try {
        const text = await request.text();
        if (text.length > 1000) return reply(fail(413, '요청이 너무 커요.'));
        data = JSON.parse(text);
      } catch {
        return reply(fail(400, '잘못된 요청이에요.'));
      }
      const address = request.headers.get('CF-Connecting-IP') || 'unknown';
      return reply(url.pathname === '/start'
        ? await ranking.start(data?.mode, address)
        : await ranking.submit(data?.session, data?.name, data?.score, address));
    }
    return reply(fail(404, '없는 주소예요.'));
  },
};
