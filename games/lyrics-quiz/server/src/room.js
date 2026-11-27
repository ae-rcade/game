// 방 하나의 상태와 게임 진행. 정답·점수 판정은 모두 서버에서 해요.
// 화면에는 열린 가사만 보내고, 제목은 정답을 공개할 때만 보내요.
// 객체가 잠들어도 이어지도록 상태는 storage에, 시간 진행은 alarm으로 처리해요.
import { DurableObject } from 'cloudflare:workers';
import config from '../../config.json';
import {
  COUNTDOWN_MS, LINE_DELAYS_MS, WRONG_PENALTY, parseCSV, toQuestions, shuffle, pickLines, titleMasker, isCorrect, pointsFor,
} from '../../quiz.js';
import {
  MAX_PLAYERS, MIN_PLAYERS, COUNT, LEVELS, ANSWER_MS, REVEAL_MS, SEAT_HOLD_MS, EMPTY_ROOM_MS, cleanName,
} from '../../multi/rules.js';
import { reject } from './reject.js';

const LOAD_TIMEOUT_MS = 15_000;
// 문제가 나온 뒤 각 줄이 열리는 시각: 0, 0, 5초, 10초
const OPEN_AT = LINE_DELAYS_MS.map((_, i) => LINE_DELAYS_MS.slice(0, i + 1).reduce((a, b) => a + b, 0));

const online = (p) => !p.left && p.goneAt === null;
const opened = (room, now) => room.questions[room.index].lines.filter((_, i) => room.startedAt + OPEN_AT[i] <= now).length;
const endsAt = (room) => room.startedAt + OPEN_AT[room.questions[room.index].lines.length - 1] + ANSWER_MS;
const send = (ws, data) => { try { ws.send(JSON.stringify(data)); } catch { /* 닫힌 연결 */ } };

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    // 연결 확인(ping)은 객체를 깨우지 않고 바로 답해요.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }

  // ───── 접속 ─────
  async fetch(request) {
    const params = new URL(request.url).searchParams;
    const action = params.get('action');
    const now = Date.now();
    if (this.room) await this.advance(now);
    if (action === 'create' && this.room) return new Response(null, { status: 409 });

    let player;
    if (action === 'create') {
      this.room = { code: params.get('code'), phase: 'lobby', count: COUNT.initial, level: 'normal', players: [], hostId: null, history: [], emptyAt: null };
      player = this.addPlayer(cleanName(params.get('name')));
    } else if (!this.room) {
      return reject(action === 'rejoin' ? '방이 사라졌어요.' : '방을 찾을 수 없어요. 코드를 확인해 주세요.');
    } else {
      // 비어 있던 방에 누가 들어오면, 끊긴 사람들의 자리 유지 시간을 지금부터 다시 세요.
      if (!this.room.players.some(online)) {
        for (const p of this.room.players) if (!p.left) p.goneAt = now;
      }
      if (action === 'rejoin') {
        player = this.room.players.find((p) => !p.left && p.token === params.get('token'));
        if (!player) return reject('자리가 사라져서 다시 들어갈 수 없어요.');
      } else {
        const name = cleanName(params.get('name'));
        if (this.room.phase === 'result') return reject('게임이 막 끝난 방이에요. 방장이 대기 화면으로 돌아간 뒤에 들어와 주세요.');
        if (this.room.phase !== 'lobby') return reject('이미 게임이 진행 중인 방이에요.');
        const same = this.room.players.find((p) => p.name === name);
        if (same && online(same)) return reject('같은 닉네임이 있어요. 다른 닉네임을 써 주세요.');
        if (!same && this.room.players.length >= MAX_PLAYERS) return reject(`방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).`);
        // 끊긴 사람과 같은 닉네임으로 다시 들어오면 그 자리를 이어받아요.
        if (same) {
          this.detach(same.id);
          this.room.players = this.room.players.filter((p) => p !== same);
        }
        player = this.addPlayer(name);
        if (same && this.room.hostId === same.id) this.room.hostId = player.id;
      }
    }

    this.detach(player.id, { type: 'replaced' }); // 같은 사람의 이전 연결은 닫아요.
    player.goneAt = null;
    this.room.emptyAt = null;
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [player.id]);
    server.serializeAttachment({ id: player.id });
    send(server, { type: 'welcome', you: player.id, token: player.token, code: this.room.code });
    await this.commit();
    return new Response(null, { status: 101, webSocket: client });
  }

  addPlayer(name) {
    const player = { id: crypto.randomUUID(), token: crypto.randomUUID(), name, score: 0, correct: 0, locked: false, left: false, goneAt: null };
    this.room.players.push(player);
    this.room.hostId ??= player.id;
    return player;
  }

  // 이 사람의 연결을 떼어 내요. 떼어 낸 연결의 닫힘 이벤트는 무시돼요.
  detach(id, notice) {
    for (const ws of this.ctx.getWebSockets(id)) {
      if (!ws.deserializeAttachment()?.id) continue;
      ws.serializeAttachment({});
      if (notice) send(ws, notice);
      try { ws.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    }
  }

  // ───── 메시지 ─────
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 600) return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const id = ws.deserializeAttachment()?.id;
    if (!id || !this.room) return;
    const now = Date.now();
    await this.advance(now); // 알람보다 메시지가 먼저 오면 시간부터 진행해요.
    const room = this.room;
    const player = room?.players.find((p) => p.id === id && !p.left);
    if (!player) return;
    const host = room.hostId === player.id;

    if (message?.type === 'count' && host && room.phase === 'lobby') {
      const value = message.value;
      if (Number.isInteger(value) && value >= COUNT.min && value <= COUNT.max) room.count = value;
    } else if (message?.type === 'level' && host && room.phase === 'lobby') {
      if (LEVELS.includes(message.value)) room.level = message.value;
    } else if (message?.type === 'start' && host && room.phase === 'lobby') {
      if (room.players.filter(online).length < MIN_PLAYERS) {
        send(ws, { type: 'error', message: `${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요.` });
        return;
      }
      return this.begin();
    } else if (message?.type === 'answer' && room.phase === 'question' && message.index === room.index && !player.locked) {
      const typed = String(message.text ?? '').slice(0, 100).trim();
      if (!typed) return;
      // 메시지는 한 번에 하나씩 처리되므로, 서버에 먼저 도착한 정답만 점수를 받아요.
      if (isCorrect(room.questions[room.index], typed)) {
        const points = pointsFor(opened(room, now));
        player.score += points;
        player.correct++;
        this.reveal('good', now, player, points);
      } else {
        player.score -= WRONG_PENALTY;
        player.locked = true; // 틀리면 이번 문제는 더 답할 수 없어요.
        this.endIfAllLocked(now);
      }
    } else if (message?.type === 'again' && host && room.phase === 'result') {
      this.toLobby();
    } else if (message?.type === 'leave') {
      this.detach(player.id);
      player.left = true;
      player.goneAt = now;
      if (room.phase === 'lobby' || room.phase === 'loading') room.players = room.players.filter((p) => p !== player);
      if (!room.players.some((p) => !p.left)) return this.destroy();
      if (!room.players.some(online)) room.emptyAt = now;
      this.endIfAllLocked(now);
    } else return;
    await this.commit();
  }

  async webSocketClose(ws) { await this.dropped(ws); }
  async webSocketError(ws) { await this.dropped(ws); }

  async dropped(ws) {
    const id = ws.deserializeAttachment()?.id;
    try { ws.close(1000, 'bye'); } catch { /* 이미 닫힘 */ }
    const player = this.room?.players.find((p) => p.id === id && !p.left);
    if (!player) return;
    if (this.ctx.getWebSockets(id).some((other) => other !== ws && other.readyState === 1)) return;
    const now = Date.now();
    player.goneAt = now;
    if (!this.room.players.some(online)) this.room.emptyAt = now;
    this.endIfAllLocked(now);
    await this.commit();
  }

  // ───── 게임 진행 ─────
  async loadQuestions(count, level) {
    // SHEET_URL 변수는 내 컴퓨터에서 시험할 때만 써요.
    const url = this.env.SHEET_URL || String(config.sheetUrl || '').trim();
    if (!url) throw new Error('config.json에 문제 시트 주소가 없어요.');
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    const text = await response.text();
    if (!response.ok || /^\s*</.test(text)) throw new Error(`문제 시트 응답 오류 ${response.status}`);
    const all = toQuestions(parseCSV(text), { skipSample: !this.env.SHEET_URL });
    if (!all.length) throw new Error('시트에 문제가 없어요.');
    return shuffle(all).slice(0, count).map((q) => ({
      title: q.title,
      aliases: q.aliases,
      // easy는 가사 속 제목을 가리지 않아요.
      lines: level === 'easy' ? pickLines(q.lines) : pickLines(q.lines).map(titleMasker(q)),
    }));
  }

  async begin() {
    const loadId = crypto.randomUUID();
    Object.assign(this.room, { phase: 'loading', loadId, until: Date.now() + LOAD_TIMEOUT_MS });
    await this.commit();
    let questions = null;
    try {
      questions = await this.loadQuestions(this.room.count, this.room.level);
    } catch (error) {
      console.error(error);
    }
    // 불러오는 동안 방이 사라졌거나 취소됐으면 그만둬요.
    if (this.room?.phase !== 'loading' || this.room.loadId !== loadId) return;
    if (!questions) return this.loadFailed();
    for (const p of this.room.players) Object.assign(p, { score: 0, correct: 0, locked: false });
    Object.assign(this.room, { phase: 'countdown', questions, index: 0, history: [], until: Date.now() + COUNTDOWN_MS });
    await this.commit();
  }

  async loadFailed() {
    this.room.phase = 'lobby';
    for (const ws of this.ctx.getWebSockets()) send(ws, { type: 'error', message: '문제를 불러오지 못했어요. 다시 시작해 주세요.' });
    await this.commit();
  }

  showQuestion(index, startedAt) {
    for (const p of this.room.players) p.locked = false;
    Object.assign(this.room, { phase: 'question', index, startedAt, result: null });
  }

  // kind: 'good' 누군가 정답, 'bad' 모두 오답, 'timeout' 시간 종료
  reveal(kind, now, winner, points) {
    const { title } = this.room.questions[this.room.index];
    const result = { kind, title, winnerId: winner?.id ?? null, winner: winner?.name ?? null, points: points ?? 0 };
    this.room.history.push({ title, winner: result.winner });
    Object.assign(this.room, { phase: 'reveal', result, shown: opened(this.room, now), until: now + REVEAL_MS });
  }

  endIfAllLocked(now) {
    if (this.room.phase !== 'question') return;
    const active = this.room.players.filter(online);
    if (active.length && active.every((p) => p.locked)) this.reveal('bad', now);
  }

  toLobby() {
    this.room.players = this.room.players.filter((p) => !p.left);
    for (const p of this.room.players) Object.assign(p, { score: 0, correct: 0, locked: false });
    Object.assign(this.room, { phase: 'lobby', questions: null, history: [], result: null });
  }

  // 지금 시각까지 지난 일을 처리해요.
  async advance(now) {
    const room = this.room;
    if (!room) return;
    if (!room.players.some(online) && room.emptyAt !== null && now >= room.emptyAt + EMPTY_ROOM_MS) return this.destroy();
    // 대기·결과 화면에서 오래 끊긴 사람은 내보내요(남은 사람이 있을 때만).
    if ((room.phase === 'lobby' || room.phase === 'result') && room.players.some(online)) {
      const expired = room.players.filter((p) => !p.left && p.goneAt !== null && now >= p.goneAt + SEAT_HOLD_MS);
      for (const p of expired) p.left = true;
      if (room.phase === 'lobby') room.players = room.players.filter((p) => !p.left);
    }
    if (room.phase === 'loading' && now >= room.until) room.phase = 'lobby';
    if (room.phase === 'countdown' && now >= room.until) this.showQuestion(0, now);
    else if (room.phase === 'question' && now >= endsAt(room)) this.reveal('timeout', now);
    else if (room.phase === 'reveal' && now >= room.until) {
      if (room.index + 1 < room.questions.length) this.showQuestion(room.index + 1, now);
      else room.phase = 'result';
    }
  }

  async alarm() {
    if (!this.room) return;
    await this.advance(Date.now());
    await this.commit();
  }

  async destroy() {
    for (const ws of this.ctx.getWebSockets()) {
      ws.serializeAttachment({});
      try { ws.close(1000, 'closed'); } catch { /* 이미 닫힘 */ }
    }
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  // ───── 저장·전송·다음 알람 ─────
  view(now) {
    const room = this.room;
    const view = {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      count: room.count,
      level: room.level,
      players: room.players.map((p) => ({
        id: p.id, name: p.name, score: p.score, correct: p.correct, locked: p.locked, left: p.left, connected: online(p),
      })),
    };
    if (room.phase === 'countdown') view.startsIn = room.until - now;
    if (room.phase === 'question' || room.phase === 'reveal') {
      const { lines } = room.questions[room.index];
      const count = room.phase === 'question' ? opened(room, now) : room.shown;
      const next = room.phase === 'question' && count < lines.length;
      view.question = {
        index: room.index,
        total: room.questions.length,
        slots: lines.length,
        lines: lines.slice(0, count),
        worth: pointsFor(count),
        nextIn: next ? room.startedAt + OPEN_AT[count] - now : null,
        endsIn: room.phase === 'question' ? endsAt(room) - now : 0,
      };
    }
    if (room.phase === 'reveal') view.result = room.result;
    if (room.phase === 'result') view.history = room.history;
    return view;
  }

  nextAlarm(now) {
    const room = this.room;
    const times = [];
    if (['loading', 'countdown', 'reveal'].includes(room.phase)) times.push(room.until);
    if (room.phase === 'question') {
      times.push(endsAt(room));
      const count = opened(room, now);
      if (count < room.questions[room.index].lines.length) times.push(room.startedAt + OPEN_AT[count]);
    }
    if (!room.players.some(online)) times.push((room.emptyAt ?? now) + EMPTY_ROOM_MS);
    else if (room.phase === 'lobby' || room.phase === 'result') {
      for (const p of room.players) if (!p.left && p.goneAt !== null) times.push(p.goneAt + SEAT_HOLD_MS);
    }
    return times.length ? Math.max(now + 20, Math.min(...times)) : null;
  }

  async commit() {
    const room = this.room;
    if (!room) return;
    // 방장이 나갔으면 접속 중인 다음 사람이 방장이 돼요.
    if (!room.players.some((p) => p.id === room.hostId && !p.left)) {
      room.hostId = (room.players.find(online) || room.players.find((p) => !p.left))?.id ?? null;
    }
    const now = Date.now();
    const alarm = this.nextAlarm(now);
    const message = { type: 'state', state: this.view(now) };
    await this.ctx.storage.put('room', room);
    if (alarm === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(alarm);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.id) send(ws, message);
    }
  }
}
