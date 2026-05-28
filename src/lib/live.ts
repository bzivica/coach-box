import type { Udalost, UdalostTyp, Ctvrtina, Kategorie, Zapas } from './types';
import { DEFAULT_DELKA_CTVRTINY_MIN, DEFAULT_POCET_CTVRTIN, formatCtvrtina } from './types';

export interface BoxStat {
  body: number;
  pokusy_2: number;
  dany_2: number;
  pokusy_3: number;
  dany_3: number;
  pokusy_th: number;
  dany_th: number;
  fauly: number;
  doskoky_off: number;
  doskoky_def: number;
  zisky: number;
  ztraty: number;
  asistence: number;
  bloky: number;
  plus_minus: number;
  minuty_ms: number;
  efficiency: number;
}

export function emptyStat(): BoxStat {
  return {
    body: 0,
    pokusy_2: 0, dany_2: 0,
    pokusy_3: 0, dany_3: 0,
    pokusy_th: 0, dany_th: 0,
    fauly: 0,
    doskoky_off: 0, doskoky_def: 0,
    zisky: 0,
    ztraty: 0,
    asistence: 0,
    bloky: 0,
    plus_minus: 0,
    minuty_ms: 0,
    efficiency: 0,
  };
}

export function pristiPoradi(udalosti: Udalost[], ctvrtinaCislo: number): number {
  let max = 0;
  for (const u of udalosti) {
    if (u.ctvrtina_cislo === ctvrtinaCislo && u.poradi > max) max = u.poradi;
  }
  return max + 1;
}

export function bodyZaTyp(typ: UdalostTyp): number {
  if (typ === 'shot_2_made' || typ === 'opp_pts_2' || typ === 'team_pts_2') return 2;
  if (typ === 'shot_3_made' || typ === 'opp_pts_3' || typ === 'team_pts_3') return 3;
  if (typ === 'ft_made' || typ === 'opp_pts_1' || typ === 'team_pts_1') return 1;
  return 0;
}

export function applyToStat(stat: BoxStat, typ: UdalostTyp): void {
  switch (typ) {
    case 'shot_2_made': stat.pokusy_2++; stat.dany_2++; stat.body += 2; break;
    case 'shot_2_miss': stat.pokusy_2++; break;
    case 'shot_3_made': stat.pokusy_3++; stat.dany_3++; stat.body += 3; break;
    case 'shot_3_miss': stat.pokusy_3++; break;
    case 'ft_made': stat.pokusy_th++; stat.dany_th++; stat.body += 1; break;
    case 'ft_miss': stat.pokusy_th++; break;
    case 'foul': stat.fauly++; break;
    case 'reb_off': stat.doskoky_off++; break;
    case 'reb_def': stat.doskoky_def++; break;
    case 'steal': stat.zisky++; break;
    case 'turnover': stat.ztraty++; break;
    case 'assist': stat.asistence++; break;
    case 'block': stat.bloky++; break;
    default: break;
  }
}

export function vypoctiEfficiency(s: BoxStat): number {
  return (
    s.body
    + s.doskoky_off + s.doskoky_def
    + s.asistence + s.zisky + s.bloky
    - (s.pokusy_2 - s.dany_2)
    - (s.pokusy_3 - s.dany_3)
    - (s.pokusy_th - s.dany_th)
    - s.ztraty
  );
}

function jeNasBod(typ: UdalostTyp): number {
  if (typ === 'shot_2_made' || typ === 'team_pts_2') return 2;
  if (typ === 'shot_3_made' || typ === 'team_pts_3') return 3;
  if (typ === 'ft_made' || typ === 'team_pts_1') return 1;
  return 0;
}

function jeSouperBod(typ: UdalostTyp): number {
  if (typ === 'opp_pts_2') return 2;
  if (typ === 'opp_pts_3') return 3;
  if (typ === 'opp_pts_1') return 1;
  return 0;
}

function casNaKonciQMs(zapas: Zapas | null | undefined): number {
  const min = zapas?.delka_ctvrtiny_min ?? DEFAULT_DELKA_CTVRTINY_MIN;
  return min * 60 * 1000;
}

interface OnCourtInterval {
  hrac_id: string;
  q: number;
  od_ms: number;
  do_ms: number | null;
}

function buildOnCourtIntervaly(
  hraciIds: string[],
  ctvrtiny: Ctvrtina[],
  udalosti: Udalost[],
  konecQMs: number,
): OnCourtInterval[] {
  const intervaly: OnCourtInterval[] = [];
  const sortedCt = [...ctvrtiny].sort((a, b) => a.cislo - b.cislo);

  for (const ctv of sortedCt) {
    const eventyVQ = udalosti
      .filter((u) => u.ctvrtina_cislo === ctv.cislo && u.typ === 'substitution')
      .sort((a, b) => a.poradi - b.poradi);

    const otevreneOd = new Map<string, number>();
    for (const id of ctv.petice_start) {
      otevreneOd.set(id, 0);
    }

    for (const sub of eventyVQ) {
      const cas = sub.cas_v_q_ms ?? 0;
      if (sub.sub_out_id && otevreneOd.has(sub.sub_out_id)) {
        intervaly.push({
          hrac_id: sub.sub_out_id,
          q: ctv.cislo,
          od_ms: otevreneOd.get(sub.sub_out_id)!,
          do_ms: cas,
        });
        otevreneOd.delete(sub.sub_out_id);
      }
      if (sub.sub_in_id && !otevreneOd.has(sub.sub_in_id)) {
        otevreneOd.set(sub.sub_in_id, cas);
      }
    }

    const konecCtvrtiny = ctv.konec_at ? konecQMs : null;
    for (const [hrac_id, od_ms] of otevreneOd) {
      intervaly.push({ hrac_id, q: ctv.cislo, od_ms, do_ms: konecCtvrtiny });
    }
  }

  for (const id of hraciIds) {
    if (!intervaly.some((iv) => iv.hrac_id === id)) {
      // hráč nikdy nebyl na hřišti — nic
    }
  }

  return intervaly;
}

function onCourtVCaseUdalosti(
  intervaly: OnCourtInterval[],
  q: number,
  cas_v_q_ms: number,
): Set<string> {
  const aktivni = new Set<string>();
  for (const iv of intervaly) {
    if (iv.q !== q) continue;
    const konec = iv.do_ms ?? Number.POSITIVE_INFINITY;
    if (iv.od_ms <= cas_v_q_ms && cas_v_q_ms <= konec) {
      aktivni.add(iv.hrac_id);
    }
  }
  return aktivni;
}

function onCourtPriEventu(
  ctv: Ctvrtina,
  poradiEventu: number,
  udalosti: Udalost[],
): Set<string> {
  const court = new Set(ctv.petice_start);
  const subs = udalosti
    .filter((u) => u.ctvrtina_cislo === ctv.cislo && u.typ === 'substitution' && u.poradi < poradiEventu)
    .sort((a, b) => a.poradi - b.poradi);
  for (const s of subs) {
    if (s.sub_out_id) court.delete(s.sub_out_id);
    if (s.sub_in_id) court.add(s.sub_in_id);
  }
  return court;
}

export function klokByPouzit(udalosti: Udalost[]): boolean {
  for (const u of udalosti) {
    if ((u.cas_v_q_ms ?? 0) > 0) return true;
  }
  return false;
}

export type CasoveOkno = 'cela' | 'prvni_pol' | 'druha_pol';

export function filtrEventyVOkne(
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[],
  zapasy: Zapas[],
  okno: CasoveOkno,
): Udalost[] {
  if (okno === 'cela') return udalosti;

  const ctMap = new Map<string, Ctvrtina>();
  for (const c of ctvrtiny) ctMap.set(`${c.zapas_id}#${c.cislo}`, c);

  const zapasMap = new Map<string, Zapas>();
  for (const z of zapasy) zapasMap.set(z.id, z);

  return udalosti.filter((u) => {
    if (u.typ === 'substitution') return true;
    if (u.korekce) return false;

    const c = ctMap.get(`${u.zapas_id}#${u.ctvrtina_cislo}`);
    const z = zapasMap.get(u.zapas_id);
    if (!c || !z) return false;

    const delkaQMs = (z.delka_ctvrtiny_min ?? DEFAULT_DELKA_CTVRTINY_MIN) * 60 * 1000;

    let elapsed: number;
    let totalMs: number;

    if ((u.cas_v_q_ms ?? 0) > 0) {
      elapsed = u.cas_v_q_ms!;
      totalMs = delkaQMs;
    } else {
      const konec = c.konec_at ?? c.zacatek_at + delkaQMs;
      elapsed = u.timestamp_at - c.zacatek_at;
      totalMs = Math.max(konec - c.zacatek_at, 1);
    }

    const mid = totalMs / 2;
    if (okno === 'prvni_pol') return elapsed <= mid;
    return elapsed > mid;
  });
}

export function computeBoxscore(
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[] = [],
  hraciIds: string[] = [],
  zapas?: Zapas | null,
): Map<string, BoxStat> {
  const m = new Map<string, BoxStat>();

  const ensureStat = (id: string): BoxStat => {
    let s = m.get(id);
    if (!s) {
      s = emptyStat();
      m.set(id, s);
    }
    return s;
  };

  for (const id of hraciIds) ensureStat(id);

  for (const u of udalosti) {
    if (u.typ === 'substitution') continue;
    if (!u.hrac_id) continue;
    applyToStat(ensureStat(u.hrac_id), u.typ);
  }

  const sortedCt = [...ctvrtiny].sort((a, b) => a.cislo - b.cislo);
  const udalostiPoraz = [...udalosti].sort(
    (a, b) => a.ctvrtina_cislo - b.ctvrtina_cislo || a.poradi - b.poradi,
  );

  for (const u of udalostiPoraz) {
    const nase = jeNasBod(u.typ);
    const souper = jeSouperBod(u.typ);
    if (nase === 0 && souper === 0) continue;
    const ctv = sortedCt.find((c) => c.cislo === u.ctvrtina_cislo);
    if (!ctv) continue;
    const court = onCourtPriEventu(ctv, u.poradi, udalostiPoraz);
    for (const id of court) {
      const s = ensureStat(id);
      s.plus_minus += nase - souper;
    }
  }

  if (ctvrtiny.length > 0 && klokByPouzit(udalosti)) {
    const konecQMs = casNaKonciQMs(zapas);
    const intervaly = buildOnCourtIntervaly(hraciIds, ctvrtiny, udalosti, konecQMs);
    for (const iv of intervaly) {
      const konec = iv.do_ms ?? konecQMs;
      const trvani = Math.max(0, konec - iv.od_ms);
      const s = ensureStat(iv.hrac_id);
      s.minuty_ms += trvani;
    }
  }

  for (const s of m.values()) {
    s.efficiency = vypoctiEfficiency(s);
  }

  return m;
}

export interface TeamTotals extends BoxStat {
  plus_minus: number;
}

export function computeTeamTotals(box: Map<string, BoxStat>): TeamTotals {
  const t = emptyStat();
  let pmCount = 0;
  let pmSum = 0;
  for (const s of box.values()) {
    t.body += s.body;
    t.pokusy_2 += s.pokusy_2; t.dany_2 += s.dany_2;
    t.pokusy_3 += s.pokusy_3; t.dany_3 += s.dany_3;
    t.pokusy_th += s.pokusy_th; t.dany_th += s.dany_th;
    t.fauly += s.fauly;
    t.doskoky_off += s.doskoky_off; t.doskoky_def += s.doskoky_def;
    t.zisky += s.zisky; t.ztraty += s.ztraty;
    t.asistence += s.asistence; t.bloky += s.bloky;
    t.minuty_ms += s.minuty_ms;
    pmSum += s.plus_minus;
    pmCount++;
  }
  t.efficiency = vypoctiEfficiency(t);
  t.plus_minus = pmCount > 0 ? Math.round(pmSum / pmCount) : 0;
  return t;
}

export interface TeamUnattributed {
  body: number;
  body_2: number;
  body_3: number;
  body_th: number;
}

export function computeTeamUnattributed(udalosti: Udalost[]): TeamUnattributed {
  const t: TeamUnattributed = { body: 0, body_2: 0, body_3: 0, body_th: 0 };
  for (const u of udalosti) {
    if (u.typ === 'team_pts_2') { t.body_2++; t.body += 2; }
    else if (u.typ === 'team_pts_3') { t.body_3++; t.body += 3; }
    else if (u.typ === 'team_pts_1') { t.body_th++; t.body += 1; }
  }
  return t;
}

export interface OppTotals {
  body: number;
  body_2: number;
  body_3: number;
  body_th: number;
  fauly: number;
  doskoky_off: number;
  doskoky_def: number;
  doskoky_neznamy: number;
}

export function computeOppTotals(udalosti: Udalost[]): OppTotals {
  const t: OppTotals = {
    body: 0, body_2: 0, body_3: 0, body_th: 0,
    fauly: 0, doskoky_off: 0, doskoky_def: 0, doskoky_neznamy: 0,
  };
  for (const u of udalosti) {
    if (u.typ === 'opp_pts_2') { t.body_2++; t.body += 2; }
    else if (u.typ === 'opp_pts_3') { t.body_3++; t.body += 3; }
    else if (u.typ === 'opp_pts_1') { t.body_th++; t.body += 1; }
    else if (u.typ === 'opp_foul') t.fauly++;
    else if (u.typ === 'opp_reb_off') t.doskoky_off++;
    else if (u.typ === 'opp_reb_def') t.doskoky_def++;
    else if (u.typ === 'opp_reb') t.doskoky_neznamy++;
  }
  return t;
}

export function computeSkore(udalosti: Udalost[]): { nase: number; souper: number } {
  let nase = 0;
  let souper = 0;
  for (const u of udalosti) {
    if (u.typ === 'shot_2_made' || u.typ === 'team_pts_2') nase += 2;
    else if (u.typ === 'shot_3_made' || u.typ === 'team_pts_3') nase += 3;
    else if (u.typ === 'ft_made' || u.typ === 'team_pts_1') nase += 1;
    else if (u.typ === 'opp_pts_2') souper += 2;
    else if (u.typ === 'opp_pts_3') souper += 3;
    else if (u.typ === 'opp_pts_1') souper += 1;
  }
  return { nase, souper };
}

export function computeSkorePoCtvrtinach(
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[],
): { q: number; nase: number; souper: number }[] {
  const result: { q: number; nase: number; souper: number }[] = [];
  const sorted = [...ctvrtiny].sort((a, b) => a.cislo - b.cislo);
  for (const c of sorted) {
    let nase = 0;
    let souper = 0;
    for (const u of udalosti) {
      if (u.ctvrtina_cislo !== c.cislo) continue;
      if (u.typ === 'shot_2_made' || u.typ === 'team_pts_2') nase += 2;
      else if (u.typ === 'shot_3_made' || u.typ === 'team_pts_3') nase += 3;
      else if (u.typ === 'ft_made' || u.typ === 'team_pts_1') nase += 1;
      else if (u.typ === 'opp_pts_2') souper += 2;
      else if (u.typ === 'opp_pts_3') souper += 3;
      else if (u.typ === 'opp_pts_1') souper += 1;
    }
    result.push({ q: c.cislo, nase, souper });
  }
  return result;
}

const REGULAR_CTVRTINY_PRO_LIMIT = 4;

export function ctvrtinyOdehrane(
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[],
  hracId: string,
): number[] {
  const odehrane = new Set<number>();
  for (const c of ctvrtiny) {
    if (c.cislo > REGULAR_CTVRTINY_PRO_LIMIT) continue;
    if (c.petice_start.includes(hracId)) {
      odehrane.add(c.cislo);
    }
  }
  for (const u of udalosti) {
    if (u.typ !== 'substitution') continue;
    if (u.ctvrtina_cislo > REGULAR_CTVRTINY_PRO_LIMIT) continue;
    if (u.sub_in_id === hracId) {
      odehrane.add(u.ctvrtina_cislo);
    }
  }
  return [...odehrane].sort((a, b) => a - b);
}

const YOUTH_LIMITS: Partial<Record<Kategorie, number>> = {
  U12: 2,
  U13: 2,
  U14: 3,
};

export function limitProKategorii(kategorie: Kategorie): number | null {
  return YOUTH_LIMITS[kategorie] ?? null;
}

export function poruseniLimitu(
  hracId: string,
  ctvrtinaCislo: number,
  zapasKategorie: Kategorie,
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[],
): { kind: 'limit_pocet' | 'limit_q14_zacatek' | null; popis: string } {
  if (ctvrtinaCislo > REGULAR_CTVRTINY_PRO_LIMIT) {
    return { kind: null, popis: '' };
  }
  const limit = limitProKategorii(zapasKategorie);
  if (limit === null) return { kind: null, popis: '' };

  const odehrane = ctvrtinyOdehrane(udalosti, ctvrtiny, hracId);
  const dotekneCislo = odehrane.includes(ctvrtinaCislo) ? odehrane : [...odehrane, ctvrtinaCislo];

  if (dotekneCislo.length > limit) {
    return {
      kind: 'limit_pocet',
      popis: `Hráč by odehrál ${dotekneCislo.length} čtvrtiny, limit kategorie ${zapasKategorie} je ${limit}.`,
    };
  }

  if (zapasKategorie === 'U14') {
    const ms = new Set(dotekneCislo);
    if (ms.has(1) && ms.has(2) && ms.has(3)) {
      return {
        kind: 'limit_q14_zacatek',
        popis: 'U14 pravidlo: hráč nesmí odehrát Q1+Q2+Q3 v řadě (jiné kombinace jsou OK).',
      };
    }
  }

  return { kind: null, popis: '' };
}

export const MAX_FAULU = 5;

export type TimeoutObdobi = '1H' | '2H' | `OT${number}`;

export function timeoutoveObdobi(ctvrtinaCislo: number, pocetCtvrtin: number): TimeoutObdobi {
  if (ctvrtinaCislo > pocetCtvrtin) return `OT${ctvrtinaCislo - pocetCtvrtin}` as TimeoutObdobi;
  const polovina = Math.floor(pocetCtvrtin / 2);
  return ctvrtinaCislo <= polovina ? '1H' : '2H';
}

export function timeoutyPovolene(obdobi: TimeoutObdobi): number {
  if (obdobi.startsWith('OT')) return 1;
  if (obdobi === '1H') return 2;
  return 3;
}

export function timeoutyPouzite(
  udalosti: Udalost[],
  typ: 'oddech_my' | 'oddech_opp',
  obdobi: TimeoutObdobi,
  pocetCtvrtin: number,
): number {
  let n = 0;
  for (const u of udalosti) {
    if (u.typ !== typ) continue;
    if (timeoutoveObdobi(u.ctvrtina_cislo, pocetCtvrtin) === obdobi) n++;
  }
  return n;
}

export function timeoutyCelkem(udalosti: Udalost[], typ: 'oddech_my' | 'oddech_opp'): number {
  let n = 0;
  for (const u of udalosti) {
    if (u.typ === typ) n++;
  }
  return n;
}

export function pocetBenchTech(udalosti: Udalost[]): number {
  let n = 0;
  for (const u of udalosti) {
    if (u.typ === 'foul_technical_bench') n++;
  }
  return n;
}

export function oppFaulyPerCislo(udalosti: Udalost[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const u of udalosti) {
    if (u.typ === 'opp_foul' && typeof u.opp_hrac_cislo === 'number') {
      m.set(u.opp_hrac_cislo, (m.get(u.opp_hrac_cislo) ?? 0) + 1);
    }
  }
  return m;
}

export interface OppHracStat {
  body: number;
  body_2: number;
  body_3: number;
  body_th: number;
  fauly: number;
  doskoky: number;
  doskoky_off: number;
  doskoky_def: number;
}

export function oppStatsPerCislo(udalosti: Udalost[]): Map<number, OppHracStat> {
  const m = new Map<number, OppHracStat>();
  const get = (cislo: number): OppHracStat => {
    let s = m.get(cislo);
    if (!s) {
      s = { body: 0, body_2: 0, body_3: 0, body_th: 0, fauly: 0, doskoky: 0, doskoky_off: 0, doskoky_def: 0 };
      m.set(cislo, s);
    }
    return s;
  };
  for (const u of udalosti) {
    if (typeof u.opp_hrac_cislo !== 'number') continue;
    const s = get(u.opp_hrac_cislo);
    if (u.typ === 'opp_pts_2') { s.body += 2; s.body_2 += 2; }
    else if (u.typ === 'opp_pts_3') { s.body += 3; s.body_3 += 3; }
    else if (u.typ === 'opp_pts_1') { s.body += 1; s.body_th += 1; }
    else if (u.typ === 'opp_foul') s.fauly++;
    else if (u.typ === 'opp_reb_off') { s.doskoky++; s.doskoky_off++; }
    else if (u.typ === 'opp_reb_def') { s.doskoky++; s.doskoky_def++; }
    else if (u.typ === 'opp_reb') s.doskoky++;
  }
  return m;
}

export function pocetFaulu(udalosti: Udalost[], hracId: string): number {
  let n = 0;
  for (const u of udalosti) {
    if (u.typ === 'foul' && u.hrac_id === hracId) n++;
  }
  return n;
}

export function jeFouledOut(udalosti: Udalost[], hracId: string): boolean {
  return pocetFaulu(udalosti, hracId) >= MAX_FAULU;
}

export function formatMinSec(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface PlayerAggregate extends BoxStat {
  gp: number;
}

function emptyAggregate(): PlayerAggregate {
  return { ...emptyStat(), gp: 0 };
}

function addStat(target: BoxStat, src: BoxStat): void {
  target.body += src.body;
  target.pokusy_2 += src.pokusy_2; target.dany_2 += src.dany_2;
  target.pokusy_3 += src.pokusy_3; target.dany_3 += src.dany_3;
  target.pokusy_th += src.pokusy_th; target.dany_th += src.dany_th;
  target.fauly += src.fauly;
  target.doskoky_off += src.doskoky_off;
  target.doskoky_def += src.doskoky_def;
  target.zisky += src.zisky;
  target.ztraty += src.ztraty;
  target.asistence += src.asistence;
  target.bloky += src.bloky;
  target.plus_minus += src.plus_minus;
  target.minuty_ms += src.minuty_ms;
}

export function aggregateAcrossMatches(
  zapasy: Zapas[],
  udalosti: Udalost[],
  ctvrtiny: Ctvrtina[],
): Map<string, PlayerAggregate> {
  const out = new Map<string, PlayerAggregate>();
  const udByZapas = new Map<string, Udalost[]>();
  for (const u of udalosti) {
    let arr = udByZapas.get(u.zapas_id);
    if (!arr) { arr = []; udByZapas.set(u.zapas_id, arr); }
    arr.push(u);
  }
  const ctByZapas = new Map<string, Ctvrtina[]>();
  for (const c of ctvrtiny) {
    let arr = ctByZapas.get(c.zapas_id);
    if (!arr) { arr = []; ctByZapas.set(c.zapas_id, arr); }
    arr.push(c);
  }

  for (const z of zapasy) {
    const u = udByZapas.get(z.id) ?? [];
    const c = ctByZapas.get(z.id) ?? [];
    const box = computeBoxscore(u, c, z.nasazeni_hraci, z);
    for (const id of z.nasazeni_hraci) {
      let agg = out.get(id);
      if (!agg) { agg = emptyAggregate(); out.set(id, agg); }
      agg.gp += 1;
      const stat = box.get(id);
      if (stat) addStat(agg, stat);
    }
  }

  for (const agg of out.values()) {
    agg.efficiency = vypoctiEfficiency(agg);
  }

  return out;
}

export interface TeamRecord {
  gp: number;
  vyhry: number;
  prohry: number;
  remizy: number;
  body_dany: number;
  body_dostane: number;
  prumer_body_dany: number;
  prumer_body_dostane: number;
  marze: number;
}

export function computeTeamRecord(zapasy: Zapas[]): TeamRecord {
  let vyhry = 0, prohry = 0, remizy = 0;
  let bodyDany = 0, bodyDostane = 0;
  for (const z of zapasy) {
    bodyDany += z.skore_nase;
    bodyDostane += z.skore_souper;
    if (z.skore_nase > z.skore_souper) vyhry++;
    else if (z.skore_nase < z.skore_souper) prohry++;
    else remizy++;
  }
  const gp = zapasy.length;
  const prumerDany = gp > 0 ? bodyDany / gp : 0;
  const prumerDostane = gp > 0 ? bodyDostane / gp : 0;
  return {
    gp, vyhry, prohry, remizy,
    body_dany: bodyDany,
    body_dostane: bodyDostane,
    prumer_body_dany: prumerDany,
    prumer_body_dostane: prumerDostane,
    marze: prumerDany - prumerDostane,
  };
}

export type ZapasStavKind =
  | 'ukonceny'
  | 'preruseny'
  | 'pred_zapasem'
  | 'bezi'
  | 'polocas'
  | 'mezi_q';

export interface ZapasStavInfo {
  kind: ZapasStavKind;
  label: string;
  aktualniQ?: number;
  predchoziQ?: number;
}

export function computeZapasStav(zapas: Zapas, ctvrtinyProZapas: Ctvrtina[]): ZapasStavInfo {
  if (zapas.status === 'ukonceny') return { kind: 'ukonceny', label: 'Ukončeno' };
  if (zapas.status === 'preruseny') return { kind: 'preruseny', label: 'Přerušeno' };

  const ct = ctvrtinyProZapas
    .filter((c) => c.zapas_id === zapas.id)
    .sort((a, b) => a.cislo - b.cislo);

  if (ct.length === 0) return { kind: 'pred_zapasem', label: 'Před zápasem' };

  const pocet = zapas.pocet_ctvrtin ?? DEFAULT_POCET_CTVRTIN;
  const last = ct[ct.length - 1];

  if (last.konec_at === undefined) {
    return { kind: 'bezi', label: `BĚŽÍ ${formatCtvrtina(last.cislo, pocet)}`, aktualniQ: last.cislo };
  }

  const predchozi = last.cislo;
  const dalsi = predchozi + 1;
  const polocasPredchozi = Math.floor(pocet / 2);
  if (predchozi === polocasPredchozi && predchozi < pocet) {
    return { kind: 'polocas', label: 'POLOČAS', predchoziQ: predchozi };
  }

  return {
    kind: 'mezi_q',
    label: `MEZI ${formatCtvrtina(predchozi, pocet)}–${formatCtvrtina(dalsi, pocet)}`,
    predchoziQ: predchozi,
  };
}
