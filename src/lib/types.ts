export type Kategorie =
  | 'pripravka'
  | 'U10MIX'
  | 'U11'
  | 'U12'
  | 'U13'
  | 'U14'
  | 'U15B'
  | 'U15'
  | 'U17B'
  | 'U17'
  | 'U19B'
  | 'U19'
  | 'MuziB'
  | 'MuziA';

export const KATEGORIE_PORADI: Kategorie[] = [
  'pripravka',
  'U10MIX',
  'U11',
  'U12',
  'U13',
  'U14',
  'U15B',
  'U15',
  'U17B',
  'U17',
  'U19B',
  'U19',
  'MuziB',
  'MuziA',
];

export const KATEGORIE_LABEL: Record<Kategorie, string> = {
  pripravka: 'Přípravka',
  U10MIX: 'U10 MIX',
  U11: 'U11',
  U12: 'U12',
  U13: 'U13',
  U14: 'U14',
  U15B: 'U15 B',
  U15: 'U15',
  U17B: 'U17 B',
  U17: 'U17',
  U19B: 'U19 B',
  U19: 'U19',
  MuziB: 'Muži B',
  MuziA: 'Muži A',
};

export function kategorieLabel(k: Kategorie): string {
  return KATEGORIE_LABEL[k] ?? k;
}

// Sezona zacina v srpnu (turnaj koncem srpna uz patri do nove sezony a nove kategorie).
// springYear = kalendarni rok, kdy sezona konci (= rok pro vekovou kategorii).
// Cerven 2026 -> sezona 2025/26 -> springYear 2026. Srpen 2026 -> sezona 2026/27 -> springYear 2027.
export function aktualniSezonaSpringYear(ref: Date = new Date()): number {
  const m = ref.getMonth(); // 0-11; srpen = 7
  const y = ref.getFullYear();
  return m >= 7 ? y + 1 : y;
}

// Vekova kategorie z roku narozeni pro danou sezonu. V srpnu se vsem sama posune o stupen vys.
// Musi odpovidat gen.mjs v coach-box-soupiska.
export function kategorieZRocniku(rocnik: number, ref: Date = new Date()): Kategorie {
  const vek = aktualniSezonaSpringYear(ref) - rocnik;
  if (vek <= 10) return 'U10MIX';
  if (vek === 11) return 'U11';
  if (vek === 12) return 'U12';
  if (vek === 13) return 'U13';
  if (vek === 14) return 'U14';
  if (vek === 15) return 'U15';
  if (vek <= 17) return 'U17';
  if (vek <= 19) return 'U19';
  return 'MuziA';
}

export type Pozice = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type SoutezTyp = 'liga' | 'pohar' | 'turnaj' | 'pratelak' | 'jiny';

export type SoutezRegion = 'domaci' | 'regionalni' | 'mezinarodni';

export type ZapasStatus = 'rozehrany' | 'ukonceny' | 'preruseny';

export type NaseStrana = 'home' | 'away';

export type UdalostTyp =
  | 'shot_2_made'
  | 'shot_2_miss'
  | 'shot_3_made'
  | 'shot_3_miss'
  | 'ft_made'
  | 'ft_miss'
  | 'foul'
  | 'reb_off'
  | 'reb_def'
  | 'steal'
  | 'turnover'
  | 'assist'
  | 'block'
  | 'substitution'
  | 'foul_technical_bench'
  | 'oddech_my'
  | 'oddech_opp'
  | 'opp_pts_2'
  | 'opp_pts_3'
  | 'opp_pts_1'
  | 'opp_2_miss'
  | 'opp_3_miss'
  | 'opp_ft_miss'
  | 'opp_foul'
  | 'opp_reb'
  | 'opp_reb_off'
  | 'opp_reb_def'
  | 'opp_turnover'
  | 'opp_steal'
  | 'team_pts_2'
  | 'team_pts_3'
  | 'team_pts_1'
  | 'team_turnover';

export type FoulSubtyp = 'personal' | 'unsportsmanlike' | 'technical';

export function foulSubtypLabel(s: FoulSubtyp): string {
  switch (s) {
    case 'personal': return 'Osobní';
    case 'unsportsmanlike': return 'Nesportovní';
    case 'technical': return 'Technická';
  }
}

export interface Hrac {
  id: string;
  jmeno: string;
  prijmeni: string;
  cislo_dresu?: number;
  pozice?: Pozice;
  datum_narozeni?: string;
  rocnik_narozeni?: number;
  vyska_cm?: number;
  domaci_kategorie: Kategorie;
  // Kategorie nastavena rucne -> neprepisovat ji automatickym prepoctem z rocniku.
  // Pro hrace, co herne patri do jine (napr. B) kategorie nez dle veku.
  kategorie_rucne?: boolean;
  // Dalsi kategorie, za ktere hrac bezne nastupuje (krome domaci) - rucne nastavitelne.
  // Takovy hrac se pak v zalozeni zapasu te kategorie nabidne v mrizce automaticky.
  obvykle_kategorie?: Kategorie[];
  // Pohlavi ma smysl jen v MIX kategorii (smiseny tym, dnes U10 MIX). Jinde se neresi.
  pohlavi?: 'M' | 'Z';
  foto?: string;
  aktivni: boolean;
  vytvoreno_at: number;
  updated_at: number;
}

export interface Soutez {
  id: string;
  nazev: string;
  typ: SoutezTyp;
  region?: SoutezRegion;
  bez_limitu_mladeze?: boolean;
  aktivni: boolean;
  vytvoreno_at: number;
  updated_at: number;
}

export interface SouperHrac {
  // Cislo dresu soupere je TEXT (ne cislo), aby slo rozlisit "0" a "00" (basketbal je
  // bere jako dva ruzne hrace). Stara data mela number - pri cteni vzdy normalizuj
  // pres normCislo. Prazdny string = nevyplneno.
  cislo: string;
  jmeno?: string;
  prijmeni?: string;
}

// Normalizace cisla dresu soupere na text. Stara data (number) i nova (string) -> string.
// Prazdne/chybejici -> ''. Nepridava ani neubira nuly (zachova "0" vs "00").
export function normCislo(x: unknown): string {
  if (x === null || x === undefined) return '';
  return String(x).trim();
}

// Razeni cisel dresu jako string: nejdriv dle ciselne hodnoty, pak dle delky/textu,
// aby "0" bylo pred "00" a "7" pred "07".
export function cisloSort(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  if (a.length !== b.length) return a.length - b.length;
  return a.localeCompare(b);
}

export interface Souper {
  id: string;
  nazev: string;
  kategorie: Kategorie;
  hraci_soupere?: SouperHrac[];
  vytvoreno_at: number;
  updated_at: number;
}

export interface SkoreCtvrtina {
  q: number;
  nase: number;
  souper: number;
}

export interface Zapas {
  id: string;
  datum: string;
  nase_kategorie: Kategorie;
  souper_id: string;
  soutez_id: string;
  sezona: string;
  nase_strana: NaseStrana;
  nasazeni_hraci: string[];
  delka_ctvrtiny_min: number;
  pocet_ctvrtin?: number;
  status: ZapasStatus;
  // Override hlídání limitu mládeže pro tento zápas.
  // undefined = řídí se nastavením soutěže (bez_limitu_mladeze); true/false = explicitní volba trenéra.
  hlidat_limit_mladeze?: boolean;
  skore_nase: number;
  skore_souper: number;
  skore_po_ctvrtinach: SkoreCtvrtina[];
  vytvoreno_at: number;
  ukonceno_at?: number;
}

export const DEFAULT_DELKA_CTVRTINY_MIN = 10;

export interface Ctvrtina {
  id: string;
  zapas_id: string;
  cislo: number;
  petice_start: string[];
  // Cisla dresu soupere v zakladni petici - TEXT (viz SouperHrac.cislo). Stara data number[].
  petice_soupere_start?: string[];
  zacatek_at: number;
  konec_at?: number;
  klok_zakladna_ms?: number;
  klok_started_at?: number | null;
}

export interface Udalost {
  id: string;
  zapas_id: string;
  ctvrtina_cislo: number;
  poradi: number;
  typ: UdalostTyp;
  hrac_id: string | null;
  sub_out_id?: string;
  sub_in_id?: string;
  foul_subtyp?: FoulSubtyp;
  // Cislo dresu soupere - TEXT (viz SouperHrac.cislo). Stara data number; pri cteni normCislo.
  opp_hrac_cislo?: string;
  timestamp_at: number;
  cas_v_q_ms?: number;
  pozn?: string;
  korekce?: boolean;
}

export interface Nastaveni {
  klic: string;
  hodnota: unknown;
}

export function eligibleKategorie(domaci: Kategorie): Kategorie[] {
  const idx = KATEGORIE_PORADI.indexOf(domaci);
  if (idx < 0) return [];
  return KATEGORIE_PORADI.slice(idx);
}

export function muzeHratV(domaci: Kategorie, zapasKategorie: Kategorie): boolean {
  return eligibleKategorie(domaci).includes(zapasKategorie);
}

export const VEKOVA_SKUPINA: Record<Kategorie, number> = {
  pripravka: 0,
  U10MIX: 1,
  U11: 2,
  U12: 3,
  U13: 4,
  U14: 5,
  U15B: 6,
  U15: 6,
  U17B: 7,
  U17: 7,
  U19B: 8,
  U19: 8,
  MuziB: 9,
  MuziA: 9,
};

// Kdo se smi nasadit do zapasu dane kategorie: hraci te same vekove skupiny
// a o `mladsiSkupiny` vekovych skupin niz (starsi se do mladsiho zapasu nenabizeji).
// Vychozi 1 = kategorie zapasu + o jednu skupinu mladsi (napr. U15 -> U15/U15B + U14).
export const ZAPAS_DEFAULT_MLADSI_SKUPINY = 1;

export function muzeHratVZapase(
  domaci: Kategorie,
  zapasKategorie: Kategorie,
  mladsiSkupiny: number = ZAPAS_DEFAULT_MLADSI_SKUPINY,
): boolean {
  const cil = VEKOVA_SKUPINA[zapasKategorie];
  const ag = VEKOVA_SKUPINA[domaci];
  return ag <= cil && ag >= cil - mladsiSkupiny;
}

// MIX kategorie = smiseny tym (kluci i holky dohromady). Dnes U10 MIX; pripadne U11mix
// nektere kluby maji. Mimo MIX se pohlavi v tymu nemicha.
export function jeMixKategorie(k: Kategorie): boolean {
  return k.toUpperCase().includes('MIX');
}

// Patri hrac do zakladni nabidky pro zapas dane kategorie? Porovnava se PRESNA kategorie
// (U14 != U15B != U15 - aby se B hraci nepletli do A nabidky). Ano kdyz: je presne te
// kategorie, nebo ma kategorii ve "obvykle hraje i za", nebo uz nekdy hral zapas teto
// kategorie (mnozina `odehrane` z historie zapasu).
export function hrajeZaKategorii(h: Hrac, zapasKategorie: Kategorie, odehrane?: Set<Kategorie>): boolean {
  if (h.domaci_kategorie === zapasKategorie) return true;
  if ((h.obvykle_kategorie ?? []).includes(zapasKategorie)) return true;
  if (odehrane?.has(zapasKategorie)) return true;
  return false;
}

// Odhad pohlavi z prijmeni (cesky spolehlivy signal): -ova/-a (Novakova, Vesela) = holka,
// jinak kluk. Krestni jmena se zamerne nepouzivaji (prezdivky Vojta/Honza konci na -a).
// Heuristika - cizi nesklonna prijmeni holek se minou, opravi se rucne u hrace.
export function odhadniPohlavi(_jmeno: string, prijmeni: string): 'M' | 'Z' {
  const low = prijmeni.trim().toLocaleLowerCase('cs');
  const bezDiakritiky = low.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (bezDiakritiky.endsWith('ova')) return 'Z';
  if (low.endsWith('á')) return 'Z';
  return 'M';
}

export const SOUPER_NAS_MAX_SKUPINY_NAHORU = 2;

export function souperiZNasichKategorie(
  naseKategorie: Kategorie,
  maxSkupinyNahoru: number = SOUPER_NAS_MAX_SKUPINY_NAHORU,
): Kategorie[] {
  const my = VEKOVA_SKUPINA[naseKategorie];
  return KATEGORIE_PORADI.filter((k) => {
    const ag = VEKOVA_SKUPINA[k];
    return ag >= my && ag <= my + maxSkupinyNahoru;
  });
}

export const DEFAULT_POCET_CTVRTIN = 4;

export function formatCtvrtina(cislo: number, pocetCtvrtin: number = DEFAULT_POCET_CTVRTIN): string {
  if (cislo <= pocetCtvrtin) return `Q${cislo}`;
  return `OT${cislo - pocetCtvrtin}`;
}

export function jeOvertime(cislo: number, pocetCtvrtin: number = DEFAULT_POCET_CTVRTIN): boolean {
  return cislo > pocetCtvrtin;
}

export function vypoctiVek(rocnik?: number, k: Date = new Date()): number | null {
  if (!rocnik) return null;
  return k.getFullYear() - rocnik;
}
