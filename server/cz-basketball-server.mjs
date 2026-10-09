import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.COACH_BOX_IMPORT_PORT || 4179);
const ALLOWED_HOSTS = new Set(['cz.basketball', 'www.cz.basketball']);
// Soupisky Jižních Supů pro sezonu 2026/27 (oficiální ID týmů na CZ.BASKETBALL).
const JIZNI_SUPI_TEAMS = [13905, 14459, 13904, 14458, 15435];

function cleanText(html) {
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim());
}
function decodeEntities(s) {
  return s.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function parsePage(html, pageUrl) {
  const title = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]);
  const headingMatches = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => cleanText(m[1])).filter(Boolean);
  const teamName = headingMatches.find(h => /supi|basket|bk|sokol|slavia|lokomotiv|tygr/i.test(h)) || title.split(/[|–-]/)[0].trim();
  const players = [];

  // Importujeme pouze tabulku, která výslovně obsahuje sloupec čísla dresu.
  // Číslování řádků statistické tabulky (# 1, 2, 3...) není číslo dresu.
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableHtml = table[1];
    const headerRow = (tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i) || [,''])[1];
    const headers = [...headerRow.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => cleanText(m[1]).toLowerCase());
    // Číslo dresu je volitelné. Sloupec '#' nebo pořadí řádku nikdy nepovažujeme za číslo dresu.
    const numberIndex = headers.findIndex(h => /^(číslo dresu|č\. dresu|dres|number|jersey)$/.test(h));
    const nameIndex = headers.findIndex(h => /^(hráč|jméno|hráč\/hráčka|player|name)$/.test(h));
    const birthYearIndex = headers.findIndex(h => /^(rok narození|ročník|year of birth|birth year|born)$/.test(h));
    if (nameIndex < 0) continue;

    for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => cleanText(m[1]));
      if (cells.length <= nameIndex || (numberIndex >= 0 && cells.length <= numberIndex)) continue;
      const cislo = numberIndex >= 0 ? cells[numberIndex].trim() : '';
      const rocnikText = birthYearIndex >= 0 ? (cells[birthYearIndex] || '').trim() : '';
      const rocnik = /^\d{4}$/.test(rocnikText) ? Number(rocnikText) : undefined;
      const name = cells[nameIndex].trim();
      if ((cislo && !/^\d{1,2}$/.test(cislo)) || !name || !/[A-Za-zÀ-ž]/.test(name)) continue;
      if (/nadregionální|soutěž|kvalifikace|oblastní|přebor|extraliga|liga|turnaj|skupina/i.test(name)) continue;
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length < 2 || parts.length > 4) continue;
      if (!parts.every(part => /^[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*$/.test(part))) continue;
      players.push({ cislo, jmeno: parts.slice(0, -1).join(' '), prijmeni: parts.at(-1), ...(rocnik ? { rocnik_narozeni: rocnik } : {}) });
    }
  }
  const unique = [...new Map(players.map(p => [`${p.jmeno.toLocaleLowerCase('cs')}|${p.prijmeni.toLocaleLowerCase('cs')}`, p])).values()];
  return { teamName, pageTitle: title, sourceUrl: pageUrl, players: unique, playerCount: unique.length };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, service: 'coach-box-cz-basketball-import' }));
  }
  if (url.pathname === '/api/cz-basketball/jizni-supi-sync' && req.method === 'GET') {
    try {
      const results = await Promise.all(JIZNI_SUPI_TEAMS.map(async (id) => {
        const target = new URL(`https://cz.basketball/tym/${id}?y=2026`);
        const response = await fetch(target, { headers: { 'User-Agent': 'Coach-Box roster sync (public team page)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Tým ${id}: HTTP ${response.status}`);
        const html = await response.text();
        if (html.length > 8_000_000) throw new Error(`Tým ${id}: stránka je nečekaně velká.`);
        return parsePage(html, target.toString());
      }));
      const players = [...new Map(results.flatMap(r => r.players).map(p => [`${p.jmeno.toLocaleLowerCase('cs')}|${p.prijmeni.toLocaleLowerCase('cs')}|${p.rocnik_narozeni ?? ''}`, p])).values()];
      const withYear = players.filter(p => Number.isInteger(p.rocnik_narozeni)).length;
      if (!players.length || !withYear) throw new Error('Na soupiskách se nepodařilo načíst hráče s rokem narození.');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ season: '2026/27', teams: results.map(r => ({ name: r.teamName, url: r.sourceUrl, players: r.playerCount })), players, playerCount: players.length, withYear }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: `Synchronizace CZ.BASKETBALL se nezdařila: ${e instanceof Error ? e.message : 'neznámá chyba'}` }));
    }
  }
  if (url.pathname !== '/api/cz-basketball/team' || req.method !== 'GET') {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Endpoint nenalezen.' }));
  }
  let target;
  try { target = new URL(url.searchParams.get('url') || ''); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Zadej platnou adresu týmové stránky CZ.BASKETBALL.' }));
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname) || !/^\/tym\/\d+\/?$/.test(target.pathname)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Povolená je pouze adresa https://cz.basketball/tym/ID (volitelně s parametrem sezóny ?y=2026).' }));
  }
  try {
    const response = await fetch(target, { headers: { 'User-Agent': 'Coach-Box roster import (public team page)', 'Accept': 'text/html' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`CZ.BASKETBALL vrátil HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length > 8_000_000) throw new Error('Stránka je nečekaně velká.');
    const parsed = parsePage(html, target.toString());
    if (!parsed.playerCount) {
      res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Stránku se podařilo načíst, ale nepodařilo se najít tabulku se jmény hráčů. Čísla dresů nejsou povinná.', pageTitle: parsed.pageTitle, sourceUrl: parsed.sourceUrl, players: [] }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(parsed));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Načtení CZ.BASKETBALL se nezdařilo: ${e instanceof Error ? e.message : 'neznámá chyba'}` }));
  }
});
server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    // Další instance Coach-Boxu může už import API provozovat na tomto portu.
    // Neukončujeme proto celý vývojový server; běžící instance zůstává dostupná.
    console.warn(`[Coach-Box] Port ${PORT} je už obsazený. Import API pravděpodobně běží v jiné instanci; pokračuji bez druhého serveru.`);
    process.exit(0);
  }
  console.error('[Coach-Box] Chyba import serveru:', error);
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => console.log(`Coach-Box import API běží na http://127.0.0.1:${PORT}`));
