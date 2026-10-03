// FMFO Sports — Live Sports Data (ESPN public API)
const ESPN_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports';

const LEAGUE_MAP = {
  nfl: { sport: 'football',   league: 'nfl'   },
  nba: { sport: 'basketball', league: 'nba'   },
  mlb: { sport: 'baseball',   league: 'mlb'   },
  nhl: { sport: 'hockey',     league: 'nhl'   },
  epl: { sport: 'soccer',     league: 'eng.1' },
};

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FMFO-Sports/2.0; +https://formyfansonly.com)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error('ESPN HTTP ' + res.status + ' for ' + url);
  return res.json();
}

function pickName(team) {
  if (!team) return '???';
  return team.abbreviation || team.shortDisplayName || team.name || team.displayName || '???';
}

async function fetchScores(leagueId) {
  const cfg = LEAGUE_MAP[leagueId];
  if (!cfg) throw new Error('Unknown league: ' + leagueId);

  const url = ESPN_BASE + '/' + cfg.sport + '/' + cfg.league + '/scoreboard';
  const raw = await fetchJson(url);

  const upcoming = [];
  const recent = [];
  let week = '';
  if (raw.week && raw.week.number) week = 'Week ' + raw.week.number;

  (raw.events || []).forEach(function (event) {
    const comp = event.competitions && event.competitions[0];
    if (!comp) return;
    const teams = comp.competitors || [];
    const home = teams.find(function (t) { return t.homeAway === 'home'; });
    const away = teams.find(function (t) { return t.homeAway === 'away'; });
    if (!home || !away) return;

    const state  = (comp.status && comp.status.type && comp.status.type.state) || '';
    const detail = (comp.status && comp.status.type &&
                    (comp.status.type.shortDetail || comp.status.type.detail)) || '';
    const hs = parseInt(home.score || '0', 10) || 0;
    const as = parseInt(away.score || '0', 10) || 0;

    let timeStr = '';
    if (event.date) {
      const d = new Date(event.date);
      timeStr = d.toLocaleString('en-US', {
        weekday: 'short', hour: 'numeric', minute: '2-digit',
      });
    }

    const row = {
      home: pickName(home.team),
      away: pickName(away.team),
      homeName: home.team ? (home.team.displayName || home.team.name || '') : '',
      awayName: away.team ? (away.team.displayName || away.team.name || '') : '',
      hs: hs, as: as, note: detail, time: timeStr,
    };

    if (state === 'post') recent.push(row);
    else if (state === 'in') recent.unshift(row);
    else upcoming.push(row);
  });

  return {
    league: leagueId.toUpperCase(),
    week: week,
    upcoming: upcoming,
    recent: recent,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchStandings(leagueId) {
  const cfg = LEAGUE_MAP[leagueId];
  if (!cfg) throw new Error('Unknown league: ' + leagueId);
  try {
    const url = ESPN_BASE + '/' + cfg.sport + '/' + cfg.league + '/standings';
    const raw = await fetchJson(url);
    const standings = [];

    function walk(node, divName) {
      if (!node) return;
      const name = node.name || node.abbreviation || divName || '';
      const entries = node.standings && node.standings.entries ? node.standings.entries : [];
      entries.forEach(function (entry) {
        const stats = {};
        (entry.stats || []).forEach(function (s) { stats[s.name] = s.value; });
        standings.push({
          t: entry.team ? (entry.team.abbreviation || entry.team.shortDisplayName || entry.team.name || '?') : '?',
          d: name || 'League',
          w: stats.wins || 0,
          l: stats.losses || 0,
        });
      });
      (node.children || []).forEach(function (child) { walk(child, name); });
    }

    walk(raw, 'League');
    return { league: leagueId.toUpperCase(), standings: standings, updatedAt: new Date().toISOString() };
  } catch (e) {
    return { league: leagueId.toUpperCase(), standings: [], updatedAt: new Date().toISOString() };
  }
}

module.exports = { fetchScores, fetchStandings };
