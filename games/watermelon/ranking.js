// 탑10 기록. config.json에 rankingUrl이 있으면 온라인(모두 공유), 없으면 이 기기에만 저장해요.
export const TOP = 10;
export const NAME_MAX = 10;

export const cleanName = (raw) => [...raw.normalize('NFC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim()]
  .slice(0, NAME_MAX).join('').trim();

export const qualifies = (list, score) => score > 0 && (list.length < TOP || score > list[TOP - 1].score);

function online(base) {
  async function call(path, body) {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw Object.assign(new Error(`랭킹 서버 응답 ${res.status}`), { userMessage: data?.error });
    }
    return data;
  }
  return {
    shared: true,
    start: async (mode) => (await call('/start', { mode })).session,
    top: async (mode) => (await call(`/scores?mode=${mode}`)).scores,
    submit: (mode, session, name, score) => call('/scores', { session, name, score }),
  };
}

function local() {
  const KEY = 'ae-rcade.watermelon.ranking';
  let memory = {}; // 저장이 막힌 브라우저에서는 창을 닫기 전까지만 기억해요.
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || memory; } catch { return memory; }
  };
  return {
    shared: false,
    start: async () => 'local',
    top: async (mode) => read()[mode] || [],
    submit: async (mode, session, name, score) => {
      const all = read();
      const entry = { name, score };
      // 같은 점수는 먼저 등록한 기록이 위에 있어요.
      const scores = [...(all[mode] || []), entry].sort((a, b) => b.score - a.score).slice(0, TOP);
      memory = { ...all, [mode]: scores };
      try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* 메모리에만 보관 */ }
      const index = scores.indexOf(entry);
      return { scores, rank: index < 0 ? null : index + 1 };
    },
  };
}

export async function createRanking() {
  let url = '';
  try {
    const res = await fetch('config.json', { cache: 'no-cache' });
    url = String((await res.json()).rankingUrl || '').trim().replace(/\/+$/, '');
  } catch (error) {
    console.warn('config.json을 읽지 못해 이 기기 기록을 사용해요.', error);
  }
  return url ? online(url) : local();
}
