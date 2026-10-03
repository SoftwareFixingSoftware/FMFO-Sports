/**
 * FMFO Sports — API Client
 * Handles both call styles:
 *   streamAnalysis({query, sport, mode, team}, onChunk)   ← object form
 *   streamAnalysis(promptString, {signal, onText})        ← raw-prompt form
 */
const API = '/api';

const FMFO = {
  async streamAnalysis(first, second) {
    let payload, onChunk, signal;

    if (typeof first === 'string') {
      payload = {
        query: first,
        sport: (second && second.sport) || 'nfl',
        mode: (second && second.mode) || 'Pre-Game Intel',
        team: second && second.team,
      };
      signal = second && second.signal;
      const outerOnText = second && second.onText;
      onChunk = (fullText) => { if (outerOnText) outerOnText({ text: fullText }); };
    } else if (first && typeof first === 'object') {
      payload = {
        query: first.query,
        sport: first.sport,
        mode: first.mode,
        team: first.team,
      };
      onChunk = typeof second === 'function' ? second : (() => {});
    } else {
      throw new Error('streamAnalysis: invalid arguments');
    }

    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (res.status === 403 || res.status === 429) {
      const err = await res.json().catch(() => ({}));
      throw err;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6);
        if (d === '[DONE]') return fullText;
        try {
          const p = JSON.parse(d);
          if (p.error) throw { message: p.error };
          if (p.text) { fullText += p.text; onChunk(fullText); }
        } catch (e) { if (e && e.message) throw e; }
      }
    }
    return fullText;
  },

  async post(endpoint, body) {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
    return res.json();
  },

  async get(endpoint) {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
    return res.json();
  },

  async del(endpoint) {
    await fetch(`${API}${endpoint}`, { method: 'DELETE' });
  },

  async patch(endpoint, body) {
    await fetch(`${API}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  getScores: (lg) => FMFO.get(`/scores/${lg}`),
  getStandings: (lg) => FMFO.get(`/standings/${lg}`),
  getTier: () => FMFO.get('/tier'),
  getTiers: () => FMFO.get('/tiers'),
  getLeaderboard: () => FMFO.get('/leaderboard'),
  getPredictions: () => FMFO.get('/predictions'),
  savePrediction: (d) => FMFO.post('/predictions', d),
  markPrediction: (id, result) => FMFO.patch(`/predictions/${id}`, { result }),
  deletePrediction: (id) => FMFO.del(`/predictions/${id}`),
  getAnalyses: () => FMFO.get('/analyses'),
  saveAnalysis: (d) => FMFO.post('/analyses', d),
  deleteAnalysis: (id) => FMFO.del(`/analyses/${id}`),
  generateContent: (analysis) => FMFO.post('/content', { analysis }),
  health: () => FMFO.get('/health'),
};

window.FMFO = FMFO;