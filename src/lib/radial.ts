import { db } from './db';

// Typy akci dostupne v radialu (podrzeni hrace). Vnitrni kruh = 8, vnejsi = 5.
export type RadialActionTyp =
  | 'shot_2_made'
  | 'shot_2_miss'
  | 'shot_3_made'
  | 'shot_3_miss'
  | 'ft_made'
  | 'ft_miss'
  | 'reb_off'
  | 'reb_def'
  | 'foul'
  | 'assist'
  | 'steal'
  | 'block'
  | 'turnover';

export type RadialTone = 'made' | 'miss' | 'foul' | 'reb' | 'pozit' | 'negat';

export interface RadialSeg {
  typ: RadialActionTyp;
  label: string;
  tone: RadialTone;
}

// Vychozi rozestaveni - poradi je smerodatne (default, ktery se ma zachovat).
export const RADIAL_INNER_DEFAULT: RadialSeg[] = [
  { typ: 'shot_2_made', label: '✓2', tone: 'made' },
  { typ: 'shot_3_made', label: '✓3', tone: 'made' },
  { typ: 'reb_off', label: 'DÚ', tone: 'reb' },
  { typ: 'ft_miss', label: '✗TH', tone: 'miss' },
  { typ: 'shot_2_miss', label: '✗2', tone: 'miss' },
  { typ: 'shot_3_miss', label: '✗3', tone: 'miss' },
  { typ: 'reb_def', label: 'DO', tone: 'reb' },
  { typ: 'ft_made', label: '✓TH', tone: 'made' },
];

export const RADIAL_OUTER_DEFAULT: RadialSeg[] = [
  { typ: 'assist', label: 'ASIST', tone: 'pozit' },
  { typ: 'steal', label: 'ZISK', tone: 'pozit' },
  { typ: 'block', label: 'BLOK', tone: 'pozit' },
  { typ: 'turnover', label: 'ZTRÁTA', tone: 'negat' },
  { typ: 'foul', label: 'FAUL', tone: 'foul' },
];

// Plne ceske nazvy pro konfiguracni rozbalovatka.
export const RADIAL_NAZEV: Record<RadialActionTyp, string> = {
  shot_2_made: 'Dvojka proměněná',
  shot_2_miss: 'Dvojka nedaná',
  shot_3_made: 'Trojka proměněná',
  shot_3_miss: 'Trojka nedaná',
  ft_made: 'Trestný proměněný',
  ft_miss: 'Trestný nedaný',
  reb_off: 'Doskok útočný',
  reb_def: 'Doskok obranný',
  foul: 'Faul (osobní)',
  assist: 'Asistence',
  steal: 'Zisk míče',
  block: 'Blok',
  turnover: 'Ztráta míče',
};

// Smerove sipky odpovidajici poloze segmentu (vnitrni: -90 + i*45, vnejsi: -90 + i*72).
export const RADIAL_INNER_SMERY = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
export const RADIAL_OUTER_SMERY = ['↑', '↗', '↘', '↙', '←'];

export const RADIAL_LAYOUT_KLIC = 'radial_layout';

export interface RadialLayout {
  inner: RadialActionTyp[];
  outer: RadialActionTyp[];
}

export function defaultRadialLayout(): RadialLayout {
  return {
    inner: RADIAL_INNER_DEFAULT.map((s) => s.typ),
    outer: RADIAL_OUTER_DEFAULT.map((s) => s.typ),
  };
}

// Seradi vychozi segmenty podle ulozeneho poradi. Pokud poradi neni platnou
// permutaci (chybna delka / duplicita / neznamy typ), vrati vychozi poradi.
function seradRing(defaults: RadialSeg[], order: RadialActionTyp[] | undefined): RadialSeg[] {
  if (!Array.isArray(order) || order.length !== defaults.length) return defaults;
  const byTyp = new Map(defaults.map((s) => [s.typ, s]));
  const seen = new Set<RadialActionTyp>();
  const result: RadialSeg[] = [];
  for (const t of order) {
    const seg = byTyp.get(t);
    if (!seg || seen.has(t)) return defaults;
    seen.add(t);
    result.push(seg);
  }
  return result;
}

export function resolveRadialSegments(
  layout: RadialLayout | null | undefined,
): { inner: RadialSeg[]; outer: RadialSeg[] } {
  return {
    inner: seradRing(RADIAL_INNER_DEFAULT, layout?.inner),
    outer: seradRing(RADIAL_OUTER_DEFAULT, layout?.outer),
  };
}

export async function loadRadialLayout(): Promise<RadialLayout> {
  const row = await db.nastaveni.get(RADIAL_LAYOUT_KLIC);
  const v = row?.hodnota as Partial<RadialLayout> | undefined;
  const resolved = resolveRadialSegments(
    v && Array.isArray(v.inner) && Array.isArray(v.outer)
      ? { inner: v.inner as RadialActionTyp[], outer: v.outer as RadialActionTyp[] }
      : null,
  );
  return { inner: resolved.inner.map((s) => s.typ), outer: resolved.outer.map((s) => s.typ) };
}

export async function saveRadialLayout(layout: RadialLayout): Promise<void> {
  await db.nastaveni.put({ klic: RADIAL_LAYOUT_KLIC, hodnota: layout });
}
