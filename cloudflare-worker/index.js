const ALLOWED_ORIGIN = 'https://bzivica.github.io';
const TEAM_IDS = [13905, 14459, 13904, 14458, 15435];

function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function decodeEntities(s) {
  return s.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function cleanText(html) {
  return decodeEntities(String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function parsePage(html, pageUrl) {
  const title = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  const headingMatches = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => cleanText(m[1])).filter(Boolean);
  const teamName = headingMatches.find(h => /supi|basket|bk|sokol|slavia|lokomotiv|tygr/i.test(h)) || title.split(/[|–-]/)[0].trim();
  const players = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableHtml = table[1];
    const headerRow = (tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i) || [, ''])[1];
    const headers = [...headerRow.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => cleanText(m[1]).toLowerCase());
    const numberIndex = headers.findIndex(h => /^(číslo dresu|č\. dresu|dres|number|jersey)$/.test(h));
    const nameIndex = headers.findIndex(h => /^(hráč|jméno|hráč\/hráčka|player|name)$/.test(h));
    const yearIndex = headers.findIndex(h => /^(rok narození|ročník|year of birth|birth year|born)$/.test(h));
    if (nameIndex < 0) continue;
    for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => cleanText(m[1]));
      if (cells.length <= nameIndex) continue;
      const jersey = numberIndex >= 0 ? (cells[numberIndex] || '').trim() : '';
      const yearText = yearIndex >= 0 ? (cells[yearIndex] || '').trim() : '';
      const year = /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;
      const name = (cells[nameIndex] || '').trim();
      if ((jersey && !/^\d{1,2}$/.test(jersey)) || !name || !/[A-Za-zÀ-ž]/.test(name)) continue;
      if (/nadregionální|soutěž|kvalifikace|oblastní|přebor|extraliga|liga|turnaj|skupina/i.test(name)) continue;
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length < 2 || parts.length > 4 || !parts.every(part => /^[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*$/.test(part))) continue;
      players.push({ jmeno: parts.slice(0, -1).join(' '), prijmeni: parts.at(-1), ...(year ? { rocnik_narozeni: year } : {}) });
    }
  }
  const unique = [...new Map(players.map(p => [`${p.jmeno.toLocaleLowerCase('cs')}|${p.prijmeni.toLocaleLowerCase('cs')}|${p.rocnik_narozeni ?? ''}`, p])).values()];
  return { teamName, pageTitle: title, sourceUrl: pageUrl, players: unique, playerCount: unique.length };
}
async function loadTeam(id) {
  const target = `https://cz.basketball/tym/${id}?y=2026`;
  const response = await fetch(target, { headers: { 'User-Agent': 'Coach-Box roster sync (public team page)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Tým ${id}: HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > 8_000_000) throw new Error(`Tým ${id}: stránka je nečekaně velká.`);
  return parsePage(html, target);
}
export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/health') return json({ ok: true, service: 'coach-box-cz-basketball-import' }, 200, origin);
    if (url.pathname !== '/api/cz-basketball/jizni-supi-sync' || request.method !== 'GET') return json({ error: 'Endpoint nenalezen.' }, 404, origin);
    try {
      const teams = await Promise.all(TEAM_IDS.map(loadTeam));
      const players = [...new Map(teams.flatMap(t => t.players).map(p => [`${p.jmeno.toLocaleLowerCase('cs')}|${p.prijmeni.toLocaleLowerCase('cs')}|${p.rocnik_narozeni ?? ''}`, p])).values()];
      const withYear = players.filter(p => Number.isInteger(p.rocnik_narozeni)).length;
      if (!players.length || !withYear) throw new Error('Na soupiskách se nepodařilo načíst hráče s rokem narození.');
      return json({ season: '2026/27', teams: teams.map(t => ({ name: t.teamName, url: t.sourceUrl, players: t.playerCount })), players, playerCount: players.length, withYear }, 200, origin);
    } catch (error) {
      return json({ error: `Synchronizace CZ.BASKETBALL se nezdařila: ${error instanceof Error ? error.message : 'neznámá chyba'}` }, 502, origin);
    }
  },
};
