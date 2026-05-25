import Dexie, { type EntityTable } from 'dexie';
import {
  DEFAULT_DELKA_CTVRTINY_MIN,
  type Hrac,
  type Soutez,
  type Souper,
  type Zapas,
  type Ctvrtina,
  type Udalost,
  type Nastaveni,
} from './types';

export class BasketDb extends Dexie {
  hraci!: EntityTable<Hrac, 'id'>;
  souteze!: EntityTable<Soutez, 'id'>;
  souperi!: EntityTable<Souper, 'id'>;
  zapasy!: EntityTable<Zapas, 'id'>;
  ctvrtiny!: EntityTable<Ctvrtina, 'id'>;
  udalosti!: EntityTable<Udalost, 'id'>;
  nastaveni!: EntityTable<Nastaveni, 'klic'>;

  constructor() {
    super('basket_db');

    this.version(1).stores({
      hraci: 'id, domaci_kategorie, aktivni, prijmeni',
      souteze: 'id, typ, aktivni, nazev',
      souperi: 'id, kategorie, nazev',
      zapasy: 'id, datum, souper_id, soutez_id, sezona, status, nase_kategorie',
      ctvrtiny: 'id, zapas_id, [zapas_id+cislo]',
      udalosti: 'id, zapas_id, [zapas_id+ctvrtina_cislo+poradi], hrac_id, typ',
      nastaveni: 'klic',
    });
  }
}

export const db = new BasketDb();

export function newId(): string {
  return crypto.randomUUID();
}

export async function seedSouteze(): Promise<void> {
  const count = await db.souteze.count();
  if (count > 0) return;

  const now = Date.now();
  const seed: Omit<Soutez, 'id'>[] = [
    { nazev: 'Liga', typ: 'liga', region: 'domaci', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Extraliga', typ: 'liga', region: 'domaci', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Nadregionální liga', typ: 'liga', region: 'regionalni', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Pražský přebor', typ: 'liga', region: 'regionalni', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'ČEYBL', typ: 'liga', region: 'mezinarodni', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'MČR', typ: 'pohar', region: 'domaci', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Easter Cup', typ: 'turnaj', region: 'mezinarodni', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Mezinárodní turnaj', typ: 'turnaj', region: 'mezinarodni', aktivni: true, vytvoreno_at: now, updated_at: now },
    { nazev: 'Přátelák', typ: 'pratelak', aktivni: true, vytvoreno_at: now, updated_at: now },
  ];

  await db.souteze.bulkAdd(seed.map((s) => ({ ...s, id: newId() })));
}

type SeedHrac = {
  cislo?: number;
  jmeno: string;
  prijmeni: string;
  kategorie: 'U13' | 'U14' | 'U15';
  pozice?: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
};

const SEED_HRACI: SeedHrac[] = [
  { cislo: 4,  jmeno: 'X',          prijmeni: 'X',        kategorie: 'U14', pozice: 'PG' },
  { cislo: 5,  jmeno: 'X',          prijmeni: 'X',        kategorie: 'U14', pozice: 'PG' },
  { cislo: 6,  jmeno: 'X',       prijmeni: 'X',         kategorie: 'U14' },
  { cislo: 9,  jmeno: 'X',            prijmeni: 'X',     kategorie: 'U14' },
  { cislo: 10, jmeno: 'X',        prijmeni: 'X',       kategorie: 'U14' },
  { cislo: 11, jmeno: 'X',         prijmeni: 'X',     kategorie: 'U14', pozice: 'PG' },
  { cislo: 12, jmeno: 'X', prijmeni: 'X', kategorie: 'U14' },
  { cislo: 13, jmeno: 'X',        prijmeni: 'X',       kategorie: 'U14', pozice: 'SF' },
  { cislo: 14, jmeno: 'X',        prijmeni: 'X',        kategorie: 'U14' },
  { cislo: 15, jmeno: 'X',        prijmeni: 'X',       kategorie: 'U14', pozice: 'C' },
  { cislo: 17, jmeno: 'X',         prijmeni: 'X',      kategorie: 'U14' },
  { cislo: 18, jmeno: 'X',          prijmeni: 'X',       kategorie: 'U14', pozice: 'SF' },
  { cislo: 20, jmeno: 'X',          prijmeni: 'X',     kategorie: 'U14', pozice: 'SF' },
  { cislo: 21, jmeno: 'X',         prijmeni: 'X', kategorie: 'U13', pozice: 'C' },
  { cislo: 22, jmeno: 'X',         prijmeni: 'X',        kategorie: 'U14', pozice: 'C' },
  { cislo: 23, jmeno: 'X',        prijmeni: 'X',        kategorie: 'U13', pozice: 'C' },
  { cislo: 4,  jmeno: 'X',          prijmeni: 'X',        kategorie: 'U15' },
  { cislo: 8,  jmeno: 'X',         prijmeni: 'X',       kategorie: 'U15' },
  { cislo: 9,  jmeno: 'X',          prijmeni: 'X',        kategorie: 'U15' },
  { cislo: 13, jmeno: 'X',           prijmeni: 'X',         kategorie: 'U15' },
  { cislo: 15, jmeno: 'X',          prijmeni: 'X',         kategorie: 'U15' },
  { cislo: 16, jmeno: 'X',          prijmeni: 'X',       kategorie: 'U15' },
  { cislo: 19, jmeno: 'X', prijmeni: 'X',   kategorie: 'U15' },
  { cislo: 20, jmeno: 'X', prijmeni: 'X',      kategorie: 'U15' },
  { cislo: 22, jmeno: 'X',          prijmeni: 'X',        kategorie: 'U15' },
  { cislo: 23, jmeno: 'X',           prijmeni: 'X',       kategorie: 'U15' },
];

export async function seedHraci(): Promise<void> {
  const existing = await db.hraci.toArray();
  const byKey = new Map(existing.map((h) => [`${h.jmeno}|${h.prijmeni}`, h]));
  const now = Date.now();

  for (const s of SEED_HRACI) {
    const key = `${s.jmeno}|${s.prijmeni}`;
    const found = byKey.get(key);

    if (!found) {
      await db.hraci.add({
        id: newId(),
        jmeno: s.jmeno,
        prijmeni: s.prijmeni,
        cislo_dresu: s.cislo,
        pozice: s.pozice,
        domaci_kategorie: s.kategorie,
        aktivni: true,
        vytvoreno_at: now,
        updated_at: now,
      });
    } else if (s.pozice && !found.pozice) {
      await db.hraci.update(found.id, {
        pozice: s.pozice,
        updated_at: now,
      });
    }
  }
}

type LegacyKategorie = 'A' | 'B';
const LEGACY_KATEGORIE_MAP: Record<LegacyKategorie, string> = {
  A: 'MuziA',
  B: 'MuziB',
};

async function migrateLegacyKategorie(): Promise<void> {
  const hraci = await db.hraci.toArray();
  for (const h of hraci) {
    const patch: Partial<Hrac> = {};
    const mapped = LEGACY_KATEGORIE_MAP[h.domaci_kategorie as unknown as LegacyKategorie];
    if (mapped) patch.domaci_kategorie = mapped as never;
    if (h.datum_narozeni && h.rocnik_narozeni === undefined) {
      const r = Number(h.datum_narozeni.slice(0, 4));
      if (Number.isInteger(r) && r >= 1900 && r <= new Date().getFullYear()) {
        patch.rocnik_narozeni = r;
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = Date.now();
      await db.hraci.update(h.id, patch as Partial<Hrac>);
    }
  }

  const souperi = await db.souperi.toArray();
  for (const s of souperi) {
    const mapped = LEGACY_KATEGORIE_MAP[s.kategorie as unknown as LegacyKategorie];
    if (mapped) {
      await db.souperi.update(s.id, { kategorie: mapped as never, updated_at: Date.now() });
    }
  }

  const zapasy = await db.zapasy.toArray();
  for (const z of zapasy) {
    const patch: Partial<Zapas> = {};
    const mapped = LEGACY_KATEGORIE_MAP[z.nase_kategorie as unknown as LegacyKategorie];
    if (mapped) patch.nase_kategorie = mapped as never;
    if (z.delka_ctvrtiny_min === undefined) patch.delka_ctvrtiny_min = DEFAULT_DELKA_CTVRTINY_MIN;
    if (Object.keys(patch).length > 0) {
      await db.zapasy.update(z.id, patch);
    }
  }
}

export async function seedAll(): Promise<void> {
  await migrateLegacyKategorie();
  await seedSouteze();
  await seedHraci();
}

const EXPORT_FORMAT_VERSION = 'v1';

export interface ExportData {
  format_version: string;
  exported_at: string;
  data: {
    hraci: unknown[];
    souteze: unknown[];
    souperi: unknown[];
    zapasy: unknown[];
    ctvrtiny: unknown[];
    udalosti: unknown[];
    nastaveni: unknown[];
  };
}

export async function exportAll(): Promise<ExportData> {
  const [hraci, souteze, souperi, zapasy, ctvrtiny, udalosti, nastaveni] = await Promise.all([
    db.hraci.toArray(),
    db.souteze.toArray(),
    db.souperi.toArray(),
    db.zapasy.toArray(),
    db.ctvrtiny.toArray(),
    db.udalosti.toArray(),
    db.nastaveni.toArray(),
  ]);

  return {
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    data: { hraci, souteze, souperi, zapasy, ctvrtiny, udalosti, nastaveni },
  };
}

export async function importReplace(payload: ExportData): Promise<void> {
  if (payload.format_version !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Nepodporovaná verze exportu: ${payload.format_version}. Očekáváno: ${EXPORT_FORMAT_VERSION}`);
  }

  await db.transaction(
    'rw',
    [db.hraci, db.souteze, db.souperi, db.zapasy, db.ctvrtiny, db.udalosti, db.nastaveni],
    async () => {
      await Promise.all([
        db.hraci.clear(),
        db.souteze.clear(),
        db.souperi.clear(),
        db.zapasy.clear(),
        db.ctvrtiny.clear(),
        db.udalosti.clear(),
        db.nastaveni.clear(),
      ]);

      const { hraci, souteze, souperi, zapasy, ctvrtiny, udalosti, nastaveni } = payload.data;
      await Promise.all([
        hraci.length ? db.hraci.bulkAdd(hraci as never) : Promise.resolve(),
        souteze.length ? db.souteze.bulkAdd(souteze as never) : Promise.resolve(),
        souperi.length ? db.souperi.bulkAdd(souperi as never) : Promise.resolve(),
        zapasy.length ? db.zapasy.bulkAdd(zapasy as never) : Promise.resolve(),
        ctvrtiny.length ? db.ctvrtiny.bulkAdd(ctvrtiny as never) : Promise.resolve(),
        udalosti.length ? db.udalosti.bulkAdd(udalosti as never) : Promise.resolve(),
        nastaveni.length ? db.nastaveni.bulkAdd(nastaveni as never) : Promise.resolve(),
      ]);
    },
  );
}
