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

// Vekova kategorie z roku narozeni pro danou sezonu. V zari se vsem sama posune o stupen vys.
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
  | 'opp_foul'
  | 'opp_reb'
  | 'opp_reb_off'
  | 'opp_reb_def'
  | 'opp_turnover'
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
  cislo: number;
  jmeno?: string;
  prijmeni?: string;
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
  petice_soupere_start?: number[];
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
  opp_hrac_cislo?: number;
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
