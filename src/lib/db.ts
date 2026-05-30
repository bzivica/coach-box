import Dexie, { type EntityTable } from 'dexie';
import {
  DEFAULT_DELKA_CTVRTINY_MIN,
  type Hrac,
  type Soutez,
  type Souper,
  type SouperHrac,
  type Zapas,
  type Ctvrtina,
  type Udalost,
  type Nastaveni,
} from './types';
import { computeSkore, computeSkorePoCtvrtinach } from './live';

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
  { cislo: 4,  jmeno: 'Hráč', prijmeni: 'U14-04', kategorie: 'U14', pozice: 'PG' },
  { cislo: 5,  jmeno: 'Hráč', prijmeni: 'U14-05', kategorie: 'U14', pozice: 'PG' },
  { cislo: 6,  jmeno: 'Hráč', prijmeni: 'U14-06', kategorie: 'U14' },
  { cislo: 9,  jmeno: 'Hráč', prijmeni: 'U14-09', kategorie: 'U14' },
  { cislo: 10, jmeno: 'Hráč', prijmeni: 'U14-10', kategorie: 'U14' },
  { cislo: 11, jmeno: 'Hráč', prijmeni: 'U14-11', kategorie: 'U14', pozice: 'PG' },
  { cislo: 12, jmeno: 'Hráč', prijmeni: 'U14-12', kategorie: 'U14' },
  { cislo: 13, jmeno: 'Hráč', prijmeni: 'U14-13', kategorie: 'U14', pozice: 'SF' },
  { cislo: 14, jmeno: 'Hráč', prijmeni: 'U14-14', kategorie: 'U14' },
  { cislo: 15, jmeno: 'Hráč', prijmeni: 'U14-15', kategorie: 'U14', pozice: 'C' },
  { cislo: 17, jmeno: 'Hráč', prijmeni: 'U14-17', kategorie: 'U14' },
  { cislo: 18, jmeno: 'Hráč', prijmeni: 'U14-18', kategorie: 'U14', pozice: 'SF' },
  { cislo: 20, jmeno: 'Hráč', prijmeni: 'U14-20', kategorie: 'U14', pozice: 'SF' },
  { cislo: 21, jmeno: 'Hráč', prijmeni: 'U13-21', kategorie: 'U13', pozice: 'C' },
  { cislo: 22, jmeno: 'Hráč', prijmeni: 'U14-22', kategorie: 'U14', pozice: 'C' },
  { cislo: 23, jmeno: 'Hráč', prijmeni: 'U13-23', kategorie: 'U13', pozice: 'C' },
  { cislo: 4,  jmeno: 'Hráč', prijmeni: 'U15-04', kategorie: 'U15' },
  { cislo: 8,  jmeno: 'Hráč', prijmeni: 'U15-08', kategorie: 'U15' },
  { cislo: 9,  jmeno: 'Hráč', prijmeni: 'U15-09', kategorie: 'U15' },
  { cislo: 13, jmeno: 'Hráč', prijmeni: 'U15-13', kategorie: 'U15' },
  { cislo: 15, jmeno: 'Hráč', prijmeni: 'U15-15', kategorie: 'U15' },
  { cislo: 16, jmeno: 'Hráč', prijmeni: 'U15-16', kategorie: 'U15' },
  { cislo: 19, jmeno: 'Hráč', prijmeni: 'U15-19', kategorie: 'U15' },
  { cislo: 20, jmeno: 'Hráč', prijmeni: 'U15-20', kategorie: 'U15' },
  { cislo: 22, jmeno: 'Hráč', prijmeni: 'U15-22', kategorie: 'U15' },
  { cislo: 23, jmeno: 'Hráč', prijmeni: 'U15-23', kategorie: 'U15' },
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

export interface MergeStat {
  added: number;
  updated: number;
  skipped: number;
}

export interface MergeResult {
  hraci: MergeStat;
  souteze: MergeStat;
  souperi: MergeStat;
  zapasy: MergeStat;
  ctvrtiny: MergeStat;
  udalosti: MergeStat;
  nastaveni: MergeStat;
  zapasy_with_changes: number;
}

function emptyStat(): MergeStat {
  return { added: 0, updated: 0, skipped: 0 };
}

function hracKey(h: Hrac): string {
  return `${h.jmeno}|${h.prijmeni}|${h.cislo_dresu ?? ''}|${h.rocnik_narozeni ?? ''}`;
}

function souperKey(s: Souper): string {
  return `${s.nazev}|${s.kategorie}`;
}

function ctvrtinaKey(c: Ctvrtina): string {
  return `${c.zapas_id}|${c.cislo}`;
}

function zapasKey(z: Zapas): string {
  return `${z.datum}|${z.souper_id}|${z.nase_kategorie}`;
}

function unionSouperHraci(a: SouperHrac[], b: SouperHrac[]): SouperHrac[] {
  const byCislo = new Map<number, SouperHrac>();
  for (const h of a) byCislo.set(h.cislo, h);
  for (const h of b) {
    const existing = byCislo.get(h.cislo);
    if (!existing) {
      byCislo.set(h.cislo, h);
    } else {
      const incomingNamed = h.prijmeni || h.jmeno;
      const existingNamed = existing.prijmeni || existing.jmeno;
      if (incomingNamed && !existingNamed) byCislo.set(h.cislo, h);
    }
  }
  return Array.from(byCislo.values()).sort((x, y) => x.cislo - y.cislo);
}

const STATUS_PRIORITA: Record<Zapas['status'], number> = {
  rozehrany: 1,
  preruseny: 1,
  ukonceny: 2,
};

export async function importMerge(payload: ExportData): Promise<MergeResult> {
  if (payload.format_version !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Nepodporovaná verze exportu: ${payload.format_version}. Očekáváno: ${EXPORT_FORMAT_VERSION}`);
  }

  const result: MergeResult = {
    hraci: emptyStat(),
    souteze: emptyStat(),
    souperi: emptyStat(),
    zapasy: emptyStat(),
    ctvrtiny: emptyStat(),
    udalosti: emptyStat(),
    nastaveni: emptyStat(),
    zapasy_with_changes: 0,
  };

  const incoming = payload.data as {
    hraci: Hrac[];
    souteze: Soutez[];
    souperi: Souper[];
    zapasy: Zapas[];
    ctvrtiny: Ctvrtina[];
    udalosti: Udalost[];
    nastaveni: Nastaveni[];
  };

  const zapasyDotcene = new Set<string>();

  await db.transaction(
    'rw',
    [db.hraci, db.souteze, db.souperi, db.zapasy, db.ctvrtiny, db.udalosti, db.nastaveni],
    async () => {
      const soutezIdMap = new Map<string, string>();
      const hracIdMap = new Map<string, string>();
      const souperIdMap = new Map<string, string>();
      const zapasIdMap = new Map<string, string>();

      const existingSouteze = await db.souteze.toArray();
      const souteziByNazev = new Map(existingSouteze.map((s) => [s.nazev, s]));
      for (const s of incoming.souteze) {
        const existing = souteziByNazev.get(s.nazev);
        if (existing) {
          soutezIdMap.set(s.id, existing.id);
          if (s.updated_at > existing.updated_at) {
            await db.souteze.update(existing.id, {
              typ: s.typ,
              region: s.region,
              aktivni: s.aktivni,
              updated_at: s.updated_at,
            });
            result.souteze.updated++;
          } else {
            result.souteze.skipped++;
          }
        } else {
          soutezIdMap.set(s.id, s.id);
          await db.souteze.add(s);
          result.souteze.added++;
        }
      }

      const existingHraci = await db.hraci.toArray();
      const hraciByKey = new Map(existingHraci.map((h) => [hracKey(h), h]));
      for (const h of incoming.hraci) {
        const existing = hraciByKey.get(hracKey(h));
        if (existing) {
          hracIdMap.set(h.id, existing.id);
          if (h.updated_at > existing.updated_at) {
            await db.hraci.update(existing.id, {
              pozice: h.pozice ?? existing.pozice,
              datum_narozeni: h.datum_narozeni ?? existing.datum_narozeni,
              vyska_cm: h.vyska_cm ?? existing.vyska_cm,
              domaci_kategorie: h.domaci_kategorie,
              foto: h.foto ?? existing.foto,
              aktivni: h.aktivni,
              updated_at: h.updated_at,
            });
            result.hraci.updated++;
          } else {
            result.hraci.skipped++;
          }
        } else {
          hracIdMap.set(h.id, h.id);
          await db.hraci.add(h);
          result.hraci.added++;
        }
      }

      const existingSouperi = await db.souperi.toArray();
      const souperiByKey = new Map(existingSouperi.map((s) => [souperKey(s), s]));
      for (const s of incoming.souperi) {
        const existing = souperiByKey.get(souperKey(s));
        if (existing) {
          souperIdMap.set(s.id, existing.id);
          const mergedRoster = unionSouperHraci(existing.hraci_soupere ?? [], s.hraci_soupere ?? []);
          const rosterGrew = mergedRoster.length > (existing.hraci_soupere?.length ?? 0);
          const isNewer = s.updated_at > existing.updated_at;
          if (isNewer || rosterGrew) {
            await db.souperi.update(existing.id, {
              hraci_soupere: mergedRoster,
              updated_at: Math.max(s.updated_at, existing.updated_at),
            });
            result.souperi.updated++;
          } else {
            result.souperi.skipped++;
          }
        } else {
          souperIdMap.set(s.id, s.id);
          await db.souperi.add(s);
          result.souperi.added++;
        }
      }

      const existingZapasy = await db.zapasy.toArray();
      const zapasyByKey = new Map(existingZapasy.map((z) => [zapasKey(z), z]));
      for (const z of incoming.zapasy) {
        const remapped: Zapas = {
          ...z,
          souper_id: souperIdMap.get(z.souper_id) ?? z.souper_id,
          soutez_id: soutezIdMap.get(z.soutez_id) ?? z.soutez_id,
          nasazeni_hraci: z.nasazeni_hraci.map((hid) => hracIdMap.get(hid) ?? hid),
        };
        const existing = zapasyByKey.get(zapasKey(remapped));
        if (existing) {
          zapasIdMap.set(z.id, existing.id);
          zapasyDotcene.add(existing.id);
          const incomingPrio = STATUS_PRIORITA[remapped.status];
          const existingPrio = STATUS_PRIORITA[existing.status];
          if (incomingPrio > existingPrio) {
            await db.zapasy.update(existing.id, {
              status: remapped.status,
              ukonceno_at: remapped.ukonceno_at ?? existing.ukonceno_at,
            });
            result.zapasy.updated++;
          } else {
            result.zapasy.skipped++;
          }
        } else {
          zapasIdMap.set(z.id, z.id);
          await db.zapasy.add(remapped);
          zapasyDotcene.add(z.id);
          result.zapasy.added++;
        }
      }

      const existingCtvrtiny = await db.ctvrtiny.toArray();
      const ctvrtinyByKey = new Map(existingCtvrtiny.map((c) => [ctvrtinaKey(c), c]));
      for (const c of incoming.ctvrtiny) {
        const remapped: Ctvrtina = {
          ...c,
          zapas_id: zapasIdMap.get(c.zapas_id) ?? c.zapas_id,
          petice_start: c.petice_start.map((hid) => hracIdMap.get(hid) ?? hid),
        };
        const existing = ctvrtinyByKey.get(ctvrtinaKey(remapped));
        if (existing) {
          if (!existing.konec_at && remapped.konec_at) {
            await db.ctvrtiny.update(existing.id, { konec_at: remapped.konec_at });
          }
          result.ctvrtiny.skipped++;
        } else {
          await db.ctvrtiny.add(remapped);
          result.ctvrtiny.added++;
        }
      }

      const existingUdalostiIds = new Set(
        (await db.udalosti.toCollection().primaryKeys()) as string[],
      );
      for (const u of incoming.udalosti) {
        if (existingUdalostiIds.has(u.id)) {
          result.udalosti.skipped++;
          continue;
        }
        const remapped: Udalost = {
          ...u,
          zapas_id: zapasIdMap.get(u.zapas_id) ?? u.zapas_id,
          hrac_id: u.hrac_id ? (hracIdMap.get(u.hrac_id) ?? u.hrac_id) : null,
          sub_out_id: u.sub_out_id ? (hracIdMap.get(u.sub_out_id) ?? u.sub_out_id) : undefined,
          sub_in_id: u.sub_in_id ? (hracIdMap.get(u.sub_in_id) ?? u.sub_in_id) : undefined,
        };
        await db.udalosti.add(remapped);
        zapasyDotcene.add(remapped.zapas_id);
        result.udalosti.added++;
      }

      const existingNastaveniKeys = new Set((await db.nastaveni.toArray()).map((n) => n.klic));
      for (const n of incoming.nastaveni) {
        if (existingNastaveniKeys.has(n.klic)) {
          result.nastaveni.skipped++;
        } else {
          await db.nastaveni.add(n);
          result.nastaveni.added++;
        }
      }

      for (const zid of zapasyDotcene) {
        const zUdalosti = await db.udalosti.where('zapas_id').equals(zid).toArray();
        const zCtvrtiny = await db.ctvrtiny.where('zapas_id').equals(zid).toArray();
        const s = computeSkore(zUdalosti);
        const perQ = computeSkorePoCtvrtinach(zUdalosti, zCtvrtiny);
        await db.zapasy.update(zid, {
          skore_nase: s.nase,
          skore_souper: s.souper,
          skore_po_ctvrtinach: perQ,
        });
      }
    },
  );

  result.zapasy_with_changes = zapasyDotcene.size;
  return result;
}
