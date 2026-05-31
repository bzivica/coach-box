<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { db, newId } from '../lib/db';
  import {
    formatCtvrtina,
    jeOvertime,
    kategorieLabel,
    muzeHratV,
    foulSubtypLabel,
    DEFAULT_DELKA_CTVRTINY_MIN,
    DEFAULT_POCET_CTVRTIN,
    type Zapas,
    type Ctvrtina,
    type Udalost,
    type UdalostTyp,
    type FoulSubtyp,
    type Hrac,
    type Souper,
    type SouperHrac,
    type Soutez,
  } from '../lib/types';
  import {
    computeSkore,
    computeSkorePoCtvrtinach,
    computeBoxscore,
    computeTeamTotals,
    computeOppTotals,
    computeTeamUnattributed,
    formatMinSec,
    klokByPouzit,
    pristiPoradi,
    poruseniLimitu,
    pocetFaulu,
    pocetBenchTech,
    oppFaulyPerCislo,
    oppStatsPerCislo,
    timeoutoveObdobi,
    timeoutyPovolene,
    timeoutyPouzite,
    timeoutyCelkem,
    jeFouledOut,
    MAX_FAULU,
    type BoxStat,
  } from '../lib/live';
  import Avatar from '../components/Avatar.svelte';
  import HracForm from '../components/HracForm.svelte';
  import SkoreVyvojGraf from '../components/SkoreVyvojGraf.svelte';

  const COURT_AVATAR_SIZE = 76;
  const BENCH_AVATAR_SIZE = 48;
  const PICK_AVATAR_SIZE = 64;
  const SUB_AVATAR_SIZE = 64;
  const PC_AVATAR_SIZE = 64;

  type Props = {
    zapasId: string;
    onBack: () => void;
  };

  let { zapasId, onBack }: Props = $props();

  type Mode = 'pickLineup' | 'inProgress' | 'quarterEndPrompt' | 'matchEnd' | 'loading';

  let mode = $state<Mode>('loading');
  let zapas = $state<Zapas | null>(null);
  let ctvrtiny = $state<Ctvrtina[]>([]);
  let udalosti = $state<Udalost[]>([]);
  let hraci = $state<Hrac[]>([]);
  let souper = $state<Souper | null>(null);
  let soutez = $state<Soutez | null>(null);

  let aktualniCtvrtinaCislo = $state(1);
  let onCourt = $state<string[]>([]);
  let selectedPlayer = $state<string | null>(null);

  let subModal = $state(false);
  let subOuts = $state<string[]>([]);
  let subIns = $state<string[]>([]);

  let warning = $state<{ msg: string; onConfirm?: () => void } | null>(null);

  let toasts = $state<{ id: string; msg: string }[]>([]);
  const TOAST_MS = 1800;

  let foulOutPrompt = $state<{ playerId: string } | null>(null);

  let pickLineup = $state<string[]>([]);
  let pickLineupOpp = $state<number[]>([]);
  let selectedOppCislo = $state<number | null>(null);
  let oppOnCourt = $state<number[]>([]);

  let editRosterOpen = $state(false);
  let editRosterAllHraci = $state<Hrac[]>([]);
  let editRosterSelected = $state<string[]>([]);
  let editRosterHracFormOpen = $state(false);
  let editRosterChyba = $state<string | null>(null);

  let foulSubtypePicker = $state<{ playerId: string } | null>(null);
  let oppFoulPicker = $state<FoulSubtyp | null>(null);

  let oppRosterEditOpen = $state(false);
  let oppRosterDraft = $state<SouperHrac[]>([]);
  let oppRosterChyba = $state<string | null>(null);
  let oppRosterBulkOpen = $state(false);
  let oppRosterBulkText = $state('');

  let casZakladnaMs = $state(0);
  let casStartedAt = $state<number | null>(null);
  let ted = $state(Date.now());
  const TICK_MS = 250;

  const klokBezi = $derived(casStartedAt !== null);
  const casVQMs = $derived(casZakladnaMs + (casStartedAt !== null ? ted - casStartedAt : 0));
  const delkaQMs = $derived(((zapas?.delka_ctvrtiny_min ?? DEFAULT_DELKA_CTVRTINY_MIN)) * 60 * 1000);
  const casVZapaseMs = $derived(Math.max(0, aktualniCtvrtinaCislo - 1) * delkaQMs + casVQMs);

  $effect(() => {
    if (!klokBezi) return;
    const id = setInterval(() => { ted = Date.now(); }, TICK_MS);
    return () => clearInterval(id);
  });

  $effect(() => {
    const zakladna = casZakladnaMs;
    const started = casStartedAt;
    if (mode !== 'inProgress') return;
    const cur = ctvrtiny.find((c) => c.cislo === aktualniCtvrtinaCislo && !c.konec_at);
    if (!cur) return;
    void db.ctvrtiny.update(cur.id, { klok_zakladna_ms: zakladna, klok_started_at: started });
  });

  const TIMEOUT_DELKA_MS = 60 * 1000;
  let toBeziDo = $state<number | null>(null);
  let toTyp = $state<'oddech_my' | 'oddech_opp' | null>(null);
  let toTed = $state(Date.now());
  const toZbyvaMs = $derived(toBeziDo === null ? 0 : Math.max(0, toBeziDo - toTed));
  const toDobehl = $derived(toBeziDo !== null && toZbyvaMs === 0);

  $effect(() => {
    if (toBeziDo === null) return;
    const id = setInterval(() => { toTed = Date.now(); }, TICK_MS);
    return () => clearInterval(id);
  });

  function ukoncitOddech() {
    toBeziDo = null;
    toTyp = null;
  }

  function formatCas(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function startKlok() {
    if (klokBezi) return;
    ted = Date.now();
    casStartedAt = ted;
  }

  function pauseKlok() {
    if (!klokBezi || casStartedAt === null) return;
    casZakladnaMs += Date.now() - casStartedAt;
    casStartedAt = null;
  }

  function resetKlok() {
    casStartedAt = null;
    casZakladnaMs = 0;
    ted = Date.now();
  }

  function aktualniCasVQMs(): number {
    return casZakladnaMs + (casStartedAt !== null ? Date.now() - casStartedAt : 0);
  }

  let setTimeModal = $state(false);
  let setTimeInput = $state('');

  let setQModal = $state(false);
  let setQInput = $state('');

  type UndoOp =
    | { kind: 'event'; eventId: string }
    | { kind: 'q-rename'; ctvrtinaId: string; fromCislo: number; toCislo: number }
    | {
        kind: 'q-split';
        oldCtvrtinaId: string;
        newCtvrtinaId: string;
        fromCislo: number;
        toCislo: number;
        prevCasZakladnaMs: number;
        prevCasStartedAt: number | null;
      }
    | { kind: 'set-time'; prevCasZakladnaMs: number; prevCasStartedAt: number | null };

  let undoStack = $state<UndoOp[]>([]);

  function pushUndo(op: UndoOp) {
    undoStack = [...undoStack, op];
  }

  function openSetTime() {
    setTimeInput = formatCas(Math.max(0, delkaQMs - casVQMs));
    setTimeModal = true;
  }

  function parseCas(text: string): number | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isInteger(m) || !Number.isInteger(s)) return null;
    if (m < 0 || s < 0 || s >= 60) return null;
    return (m * 60 + s) * 1000;
  }

  function confirmSetTime() {
    const parsed = parseCas(setTimeInput);
    if (parsed === null) {
      toast('Neplatný formát času. Použij MM:SS, např. 4:23');
      return;
    }
    if (parsed > delkaQMs) {
      toast(`Maximální čas v Q je ${formatCas(delkaQMs)}`);
      return;
    }
    pushUndo({ kind: 'set-time', prevCasZakladnaMs: casZakladnaMs, prevCasStartedAt: casStartedAt });
    casZakladnaMs = delkaQMs - parsed;
    casStartedAt = null;
    ted = Date.now();
    setTimeModal = false;
    toast(`Čas v Q nastaven na ${formatCas(parsed)}`);
  }

  function openSetQ() {
    setQInput = String(aktualniCtvrtinaCislo);
    setQModal = true;
  }

  async function confirmSetQ() {
    if (!zapas) return;
    const parsed = Number(setQInput.trim());
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast('Zadej kladné celé číslo (např. 2)');
      return;
    }
    if (parsed === aktualniCtvrtinaCislo) {
      setQModal = false;
      return;
    }
    const cur = ctvrtiny.find((c) => c.cislo === aktualniCtvrtinaCislo);
    if (!cur) {
      toast('Aktuální čtvrtina nenalezena');
      return;
    }
    if (ctvrtiny.some((c) => c.cislo === parsed && c.id !== cur.id)) {
      toast(`Čtvrtina ${parsed} už existuje — nelze přepsat`);
      return;
    }
    const oldCislo = cur.cislo;
    const maEventy = udalosti.some((u) => u.ctvrtina_cislo === oldCislo);
    try {
      if (!maEventy) {
        await db.ctvrtiny.update(cur.id, { cislo: parsed });
        ctvrtiny = ctvrtiny
          .map((c) => (c.id === cur.id ? { ...c, cislo: parsed } : c))
          .sort((a, b) => a.cislo - b.cislo);
        aktualniCtvrtinaCislo = parsed;
        pushUndo({ kind: 'q-rename', ctvrtinaId: cur.id, fromCislo: oldCislo, toCislo: parsed });
        setQModal = false;
        toast(`Čtvrtina ${oldCislo} → ${formatCtvrtina(parsed, pocetCtvrtin)}`);
        await updateZapasCache();
      } else {
        const now = Date.now();
        const prevCasZakladnaMs = casZakladnaMs;
        const prevCasStartedAt = casStartedAt;
        pauseKlok();
        await db.ctvrtiny.update(cur.id, { konec_at: now });
        const novaCtv: Ctvrtina = {
          id: newId(),
          zapas_id: zapas.id,
          cislo: parsed,
          petice_start: [...onCourt],
          petice_soupere_start: oppOnCourt.length > 0 ? [...oppOnCourt] : undefined,
          zacatek_at: now,
        };
        await db.ctvrtiny.add(novaCtv);
        ctvrtiny = [
          ...ctvrtiny.map((c) => (c.id === cur.id ? { ...c, konec_at: now } : c)),
          novaCtv,
        ].sort((a, b) => a.cislo - b.cislo);
        aktualniCtvrtinaCislo = parsed;
        resetKlok();
        pushUndo({
          kind: 'q-split',
          oldCtvrtinaId: cur.id,
          newCtvrtinaId: novaCtv.id,
          fromCislo: oldCislo,
          toCislo: parsed,
          prevCasZakladnaMs,
          prevCasStartedAt,
        });
        setQModal = false;
        toast(`Q${oldCislo} uzavřena, otevřena ${formatCtvrtina(parsed, pocetCtvrtin)}`);
        await updateZapasCache();
      }
    } catch (e) {
      console.error('confirmSetQ failed:', e);
      toast(`Chyba při změně Q: ${(e as Error).message ?? e}`);
    }
  }

  onMount(loadData);

  async function loadData() {
    mode = 'loading';
    const z = await db.zapasy.get(zapasId);
    if (!z) {
      mode = 'matchEnd';
      return;
    }
    zapas = z;
    ctvrtiny = await db.ctvrtiny.where('zapas_id').equals(zapasId).toArray();
    ctvrtiny.sort((a, b) => a.cislo - b.cislo);
    udalosti = await db.udalosti.where('zapas_id').equals(zapasId).toArray();
    udalosti.sort((a, b) => a.ctvrtina_cislo - b.ctvrtina_cislo || a.poradi - b.poradi);
    hraci = await db.hraci.bulkGet(z.nasazeni_hraci).then((arr) => arr.filter((h): h is Hrac => !!h));
    souper = (await db.souperi.get(z.souper_id)) ?? null;
    soutez = (await db.souteze.get(z.soutez_id)) ?? null;

    if (z.status === 'ukonceny') {
      mode = 'matchEnd';
      return;
    }

    const aktualni = ctvrtiny.find((c) => !c.konec_at);
    if (aktualni) {
      aktualniCtvrtinaCislo = aktualni.cislo;
      onCourt = computeOnCourt(aktualni, udalosti);
      oppOnCourt = [...(aktualni.petice_soupere_start ?? [])];
      casZakladnaMs = aktualni.klok_zakladna_ms ?? 0;
      casStartedAt = aktualni.klok_started_at ?? null;
      ted = Date.now();
      mode = 'inProgress';
    } else {
      const last = ctvrtiny[ctvrtiny.length - 1];
      if (!last) {
        aktualniCtvrtinaCislo = 1;
        mode = 'pickLineup';
      } else {
        const regularniPocet = z.pocet_ctvrtin ?? DEFAULT_POCET_CTVRTIN;
        if (last.cislo >= regularniPocet) {
          const s = computeSkore(udalosti);
          if (s.nase === s.souper) {
            aktualniCtvrtinaCislo = last.cislo + 1;
            mode = 'quarterEndPrompt';
          } else {
            mode = 'quarterEndPrompt';
          }
        } else {
          aktualniCtvrtinaCislo = last.cislo + 1;
          mode = 'pickLineup';
        }
      }
    }
    pickLineup = [];
  }

  function computeOnCourt(ctv: Ctvrtina, allEvents: Udalost[]): string[] {
    const court = new Set(ctv.petice_start);
    const subs = allEvents
      .filter((u) => u.ctvrtina_cislo === ctv.cislo && u.typ === 'substitution')
      .sort((a, b) => a.poradi - b.poradi);
    for (const s of subs) {
      if (s.sub_out_id) court.delete(s.sub_out_id);
      if (s.sub_in_id) court.add(s.sub_in_id);
    }
    return [...court];
  }

  const skore = $derived(computeSkore(udalosti));
  const skorePoCtvrtinach = $derived(computeSkorePoCtvrtinach(udalosti, ctvrtiny));
  const boxscore = $derived(
    computeBoxscore(udalosti, ctvrtiny, zapas?.nasazeni_hraci ?? [], zapas),
  );
  const teamTotals = $derived(computeTeamTotals(boxscore));
  const oppTotals = $derived(computeOppTotals(udalosti));
  const teamUnattributed = $derived(computeTeamUnattributed(udalosti));
  const benchTechCount = $derived(pocetBenchTech(udalosti));
  const oppFaulyPerCisloMap = $derived(oppFaulyPerCislo(udalosti));
  const pocetCtvrtin = $derived(zapas?.pocet_ctvrtin ?? DEFAULT_POCET_CTVRTIN);

  const opponentRoster = $derived.by(() => {
    const all = souper?.hraci_soupere ?? [];
    const seen = new Map<number, typeof all[number]>();
    for (const h of all) {
      const ex = seen.get(h.cislo);
      if (!ex) {
        seen.set(h.cislo, h);
      } else if (!ex.prijmeni && h.prijmeni) {
        seen.set(h.cislo, h);
      }
    }
    return [...seen.values()].sort((a, b) => a.cislo - b.cislo);
  });

  let selectedPeriod = $state<'total' | number>('total');
  const periodUdalosti = $derived(
    selectedPeriod === 'total'
      ? udalosti
      : udalosti.filter((u) => u.ctvrtina_cislo === selectedPeriod),
  );
  const periodCtvrtiny = $derived(
    selectedPeriod === 'total'
      ? ctvrtiny
      : ctvrtiny.filter((c) => c.cislo === selectedPeriod),
  );
  const periodBoxscore = $derived(
    computeBoxscore(periodUdalosti, periodCtvrtiny, zapas?.nasazeni_hraci ?? [], zapas),
  );
  const periodTeamTotals = $derived(computeTeamTotals(periodBoxscore));
  const periodOppTotals = $derived(computeOppTotals(periodUdalosti));
  const periodTeamUnattributed = $derived(computeTeamUnattributed(periodUdalosti));
  const periodOppFaulyPerCisloMap = $derived(oppFaulyPerCislo(periodUdalosti));
  const periodOppStatsPerCisloMap = $derived(oppStatsPerCislo(periodUdalosti));
  const periodOppBezCisla = $derived.by(() => {
    let body = 0, body_2 = 0, body_3 = 0, body_th = 0, fauly = 0, doskoky = 0, doskoky_off = 0, doskoky_def = 0;
    for (const s of periodOppStatsPerCisloMap.values()) {
      body += s.body;
      body_2 += s.body_2;
      body_3 += s.body_3;
      body_th += s.body_th;
      fauly += s.fauly;
      doskoky += s.doskoky;
      doskoky_off += s.doskoky_off;
      doskoky_def += s.doskoky_def;
    }
    const dosTot = periodOppTotals.doskoky_off + periodOppTotals.doskoky_def + periodOppTotals.doskoky_neznamy;
    return {
      body: Math.max(0, periodOppTotals.body - body),
      body_2: Math.max(0, periodOppTotals.body_2 - body_2),
      body_3: Math.max(0, periodOppTotals.body_3 - body_3),
      body_th: Math.max(0, periodOppTotals.body_th - body_th),
      fauly: Math.max(0, periodOppTotals.fauly - fauly),
      doskoky: Math.max(0, dosTot - doskoky),
      doskoky_off: Math.max(0, periodOppTotals.doskoky_off - doskoky_off),
      doskoky_def: Math.max(0, periodOppTotals.doskoky_def - doskoky_def),
    };
  });
  const periodBenchTechCount = $derived(pocetBenchTech(periodUdalosti));
  const periodKlokPouzit = $derived(klokByPouzit(periodUdalosti));
  const dostupneCtvrtiny = $derived(
    [...ctvrtiny].map((c) => c.cislo).sort((a, b) => a - b),
  );

  const toObdobi = $derived(timeoutoveObdobi(aktualniCtvrtinaCislo, pocetCtvrtin));
  const toPovoleno = $derived(timeoutyPovolene(toObdobi));
  const toMyPouzite = $derived(timeoutyPouzite(udalosti, 'oddech_my', toObdobi, pocetCtvrtin));
  const toOppPouzite = $derived(timeoutyPouzite(udalosti, 'oddech_opp', toObdobi, pocetCtvrtin));
  const toMyZbyva = $derived(Math.max(0, toPovoleno - toMyPouzite));
  const toOppZbyva = $derived(Math.max(0, toPovoleno - toOppPouzite));
  const toMyCelkem = $derived(timeoutyCelkem(udalosti, 'oddech_my'));
  const toOppCelkem = $derived(timeoutyCelkem(udalosti, 'oddech_opp'));
  function fmtQ(cislo: number): string {
    return formatCtvrtina(cislo, pocetCtvrtin);
  }
  function jeOT(cislo: number): boolean {
    return jeOvertime(cislo, pocetCtvrtin);
  }
  const klokPouzitVZapase = $derived(klokByPouzit(udalosti));
  const hraciSerazeni = $derived(
    [...hraci].sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99)),
  );

  function formatPlusMinus(n: number): string {
    if (n > 0) return `+${n}`;
    return String(n);
  }

  let prirazovaniOpen = $state(false);
  let vyvojGrafLiveOpen = $state(false);

  const REASSIGN_TYPY: readonly UdalostTyp[] = [
    'shot_2_made', 'shot_3_made', 'ft_made',
    'team_pts_2', 'team_pts_3', 'team_pts_1',
    'turnover', 'team_turnover',
  ];

  const prirazovatelne = $derived(
    periodUdalosti
      .filter((u) => !u.korekce && REASSIGN_TYPY.includes(u.typ))
      .sort((a, b) => a.ctvrtina_cislo - b.ctvrtina_cislo || a.poradi - b.poradi),
  );

  function reassignKategorie(typ: UdalostTyp): '2' | '3' | '1' | 'to' | null {
    if (typ === 'shot_2_made' || typ === 'team_pts_2') return '2';
    if (typ === 'shot_3_made' || typ === 'team_pts_3') return '3';
    if (typ === 'ft_made' || typ === 'team_pts_1') return '1';
    if (typ === 'turnover' || typ === 'team_turnover') return 'to';
    return null;
  }

  function reassignPopis(typ: UdalostTyp): string {
    switch (reassignKategorie(typ)) {
      case '2': return '2 body';
      case '3': return '3 body';
      case '1': return 'trestný (+1)';
      case 'to': return 'ztráta';
      default: return popisAkce(typ);
    }
  }

  async function reassignEvent(ev: Udalost, newPlayerId: string | null) {
    const kat = reassignKategorie(ev.typ);
    if (kat === null) return;
    let novyTyp: UdalostTyp;
    if (kat === 'to') novyTyp = newPlayerId ? 'turnover' : 'team_turnover';
    else if (kat === '2') novyTyp = newPlayerId ? 'shot_2_made' : 'team_pts_2';
    else if (kat === '3') novyTyp = newPlayerId ? 'shot_3_made' : 'team_pts_3';
    else novyTyp = newPlayerId ? 'ft_made' : 'team_pts_1';

    await db.udalosti.update(ev.id, { typ: novyTyp, hrac_id: newPlayerId });
    udalosti = udalosti.map((u) => (u.id === ev.id ? { ...u, typ: novyTyp, hrac_id: newPlayerId } : u));
    await updateZapasCache();
    const kdo = newPlayerId
      ? (() => { const h = hraci.find((x) => x.id === newPlayerId); return h ? `#${h.cislo_dresu ?? '?'} ${h.prijmeni}` : 'hráč'; })()
      : 'bez hráče';
    toast(`${reassignPopis(novyTyp)} → ${kdo}`);
  }

  function statHrace(id: string): BoxStat {
    return periodBoxscore.get(id) ?? {
      body: 0, pokusy_2: 0, dany_2: 0, pokusy_3: 0, dany_3: 0,
      pokusy_th: 0, dany_th: 0, fauly: 0, doskoky_off: 0, doskoky_def: 0,
      zisky: 0, ztraty: 0, asistence: 0, bloky: 0, plus_minus: 0,
      minuty_ms: 0, efficiency: 0,
    };
  }

  const naHristi = $derived(
    onCourt
      .map((id) => hraci.find((h) => h.id === id))
      .filter((h): h is Hrac => !!h)
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99))
  );
  const lavicka = $derived(
    hraci
      .filter((h) => !onCourt.includes(h.id))
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99))
  );

  function toast(msg: string) {
    const id = newId();
    toasts.push({ id, msg });
    setTimeout(() => {
      const idx = toasts.findIndex((t) => t.id === id);
      if (idx >= 0) toasts.splice(idx, 1);
    }, TOAST_MS);
  }

  function selectPlayer(id: string) {
    if (selectedPlayer === id) selectedPlayer = null;
    else selectedPlayer = id;
  }

  async function recordAction(typ: UdalostTyp) {
    if (!selectedPlayer || !zapas) return;
    const hrac = hraci.find((h) => h.id === selectedPlayer);
    if (!hrac) return;

    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ,
      hrac_id: hrac.id,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };

    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });

    const label = popisAkce(typ);
    toast(`#${hrac.cislo_dresu ?? '?'} ${hrac.prijmeni} — ${label}`);

    if (typ === 'foul' && pocetFaulu(udalosti, hrac.id) >= MAX_FAULU) {
      foulOutPrompt = { playerId: hrac.id };
    }

    selectedPlayer = null;
    await updateZapasCache();
  }

  async function recordOpponent(typ: UdalostTyp) {
    if (!zapas) return;
    const cislo = selectedOppCislo ?? undefined;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ,
      hrac_id: null,
      opp_hrac_cislo: cislo,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast(`SOUPEŘ${typeof cislo === 'number' ? ` #${cislo}` : ''} — ${popisAkce(typ)}`);
    selectedOppCislo = null;
    await updateZapasCache();
  }

  const KOREKCE_STRANY = ['my', 'opp'] as const;
  const KOREKCE_BODY = [1, 2, 3] as const;
  type KorekceStrana = (typeof KOREKCE_STRANY)[number];
  type KorekceBody = (typeof KOREKCE_BODY)[number];

  function korekceTyp(strana: KorekceStrana, body: KorekceBody): UdalostTyp {
    if (strana === 'my') {
      if (body === 1) return 'team_pts_1';
      if (body === 2) return 'team_pts_2';
      return 'team_pts_3';
    }
    if (body === 1) return 'opp_pts_1';
    if (body === 2) return 'opp_pts_2';
    return 'opp_pts_3';
  }

  function posledniCtvrtinaCislo(): number {
    if (ctvrtiny.length === 0) return aktualniCtvrtinaCislo;
    return ctvrtiny.reduce((m, c) => (c.cislo > m ? c.cislo : m), ctvrtiny[0].cislo);
  }

  function posledniKorekce(typ: UdalostTyp): Udalost | null {
    let nejnovejsi: Udalost | null = null;
    for (const u of udalosti) {
      if (!u.korekce) continue;
      if (u.typ !== typ) continue;
      if (nejnovejsi === null || u.timestamp_at > nejnovejsi.timestamp_at) {
        nejnovejsi = u;
      }
    }
    return nejnovejsi;
  }

  function korekceLabelStrana(strana: KorekceStrana): string {
    return strana === 'my' ? 'MY' : 'SOUPEŘ';
  }

  async function addKorekce(strana: KorekceStrana, body: KorekceBody) {
    if (!zapas) return;
    const typ = korekceTyp(strana, body);
    const q = posledniCtvrtinaCislo();
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: q,
      poradi: pristiPoradi(udalosti, q),
      typ,
      hrac_id: null,
      timestamp_at: Date.now(),
      korekce: true,
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    toast(`${korekceLabelStrana(strana)} +${body} (korekce)`);
    await updateZapasCache();
  }

  async function removeKorekce(strana: KorekceStrana, body: KorekceBody) {
    if (!zapas) return;
    const typ = korekceTyp(strana, body);
    const ev = posledniKorekce(typ);
    if (!ev) return;
    await db.udalosti.delete(ev.id);
    udalosti = udalosti.filter((u) => u.id !== ev.id);
    toast(`${korekceLabelStrana(strana)} −${body} (korekce zrušena)`);
    await updateZapasCache();
  }

  const korekcePocet = $derived.by(() => {
    const map = new Map<string, number>();
    for (const u of udalosti) {
      if (!u.korekce) continue;
      map.set(u.typ, (map.get(u.typ) ?? 0) + 1);
    }
    return map;
  });

  function maKorekci(strana: KorekceStrana, body: KorekceBody): boolean {
    return (korekcePocet.get(korekceTyp(strana, body)) ?? 0) > 0;
  }

  function openFoulPicker() {
    if (!selectedPlayer) return;
    foulSubtypePicker = { playerId: selectedPlayer };
  }

  async function addFoul(playerId: string, subtyp: FoulSubtyp) {
    if (!zapas) return;
    const hrac = hraci.find((h) => h.id === playerId);
    if (!hrac) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ: 'foul',
      hrac_id: hrac.id,
      foul_subtyp: subtyp,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast(`#${hrac.cislo_dresu ?? '?'} ${hrac.prijmeni} — Faul (${foulSubtypLabel(subtyp)})`);
    if (pocetFaulu(udalosti, hrac.id) >= MAX_FAULU) {
      foulOutPrompt = { playerId: hrac.id };
    }
    selectedPlayer = null;
    await updateZapasCache();
  }

  async function recordFoul(subtyp: FoulSubtyp) {
    const playerId = foulSubtypePicker?.playerId;
    foulSubtypePicker = null;
    if (!playerId) return;
    await addFoul(playerId, subtyp);
  }

  async function recordOddech(typ: 'oddech_my' | 'oddech_opp') {
    if (!zapas) return;
    const obdobi = timeoutoveObdobi(aktualniCtvrtinaCislo, pocetCtvrtin);
    const pouzite = timeoutyPouzite(udalosti, typ, obdobi, pocetCtvrtin);
    const povoleno = timeoutyPovolene(obdobi);
    if (pouzite >= povoleno) {
      warning = { msg: `${typ === 'oddech_my' ? 'Náš tým' : 'Soupeř'} už vyčerpal oddechy pro ${obdobi} (max ${povoleno}).` };
      return;
    }
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ,
      hrac_id: null,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    pauseKlok();
    toTed = Date.now();
    toBeziDo = toTed + TIMEOUT_DELKA_MS;
    toTyp = typ;
    toast(`${typ === 'oddech_my' ? 'MY' : 'SOUPEŘ'} — Oddech (${obdobi}, ${pouzite + 1}/${povoleno})`);
    await updateZapasCache();
  }

  async function recordBenchTech() {
    if (!zapas) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ: 'foul_technical_bench',
      hrac_id: null,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast('Technická chyba — lavička');
    await updateZapasCache();
  }

  async function recordTeamPoints(typ: 'team_pts_2' | 'team_pts_3' | 'team_pts_1') {
    if (!zapas) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ,
      hrac_id: null,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    const b = typ === 'team_pts_2' ? 2 : typ === 'team_pts_3' ? 3 : 1;
    toast(`MY +${b} bez hráče`);
    await updateZapasCache();
  }

  async function recordTeamTurnover() {
    if (!zapas) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ: 'team_turnover',
      hrac_id: null,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast('MY — ztráta (bez hráče)');
    await updateZapasCache();
  }

  function openOppFoul(subtyp: FoulSubtyp) {
    if (subtyp === 'technical') {
      void recordOppFoul(undefined, 'technical');
      return;
    }
    if (selectedOppCislo !== null) {
      void recordOppFoul(selectedOppCislo, subtyp);
      return;
    }
    oppFoulPicker = subtyp;
  }

  function togglePickOpp(cislo: number) {
    if (pickLineupOpp.includes(cislo)) {
      pickLineupOpp = pickLineupOpp.filter((x) => x !== cislo);
    } else {
      if (pickLineupOpp.length >= 5) return;
      pickLineupOpp = [...pickLineupOpp, cislo];
    }
  }

  function selectOppPlayer(cislo: number) {
    selectedOppCislo = selectedOppCislo === cislo ? null : cislo;
  }

  async function recordOppFoul(cislo: number | undefined, subtyp: FoulSubtyp = 'personal') {
    oppFoulPicker = null;
    if (!zapas) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ: 'opp_foul',
      hrac_id: null,
      opp_hrac_cislo: cislo,
      foul_subtyp: subtyp,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast(`SOUPEŘ — Faul (${foulSubtypLabel(subtyp)})${typeof cislo === 'number' ? ` #${cislo}` : ''}`);
    selectedOppCislo = null;
    await updateZapasCache();
  }

  function openOppRosterEdit() {
    if (!souper) return;
    oppRosterDraft = (souper.hraci_soupere ?? []).map((h) => ({ ...h }));
    oppRosterChyba = null;
    oppRosterBulkOpen = false;
    oppRosterBulkText = '';
    oppRosterEditOpen = true;
  }

  function addOppRosterRow() {
    oppRosterDraft = [...oppRosterDraft, { cislo: 0, jmeno: '', prijmeni: '' }];
  }

  function removeOppRosterRow(i: number) {
    oppRosterDraft = oppRosterDraft.filter((_, idx) => idx !== i);
  }

  function parseOppRosterBulk() {
    oppRosterChyba = null;
    const radky = oppRosterBulkText
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (radky.length === 0) { oppRosterChyba = 'Prázdný text'; return; }
    const noviHraci: SouperHrac[] = [];
    for (let i = 0; i < radky.length; i++) {
      const tokeny = radky[i].split(/\s+/);
      const cislo = parseInt(tokeny[0], 10);
      if (isNaN(cislo) || cislo < 0 || cislo > 99) { oppRosterChyba = `Položka ${i + 1}: neplatné číslo "${tokeny[0]}"`; return; }
      const zbytek = tokeny.slice(1);
      let jmeno: string | undefined;
      let prijmeni: string | undefined;
      if (zbytek.length === 1) jmeno = zbytek[0];
      else if (zbytek.length >= 2) {
        prijmeni = zbytek[zbytek.length - 1];
        jmeno = zbytek.slice(0, -1).join(' ');
      }
      noviHraci.push({ cislo, jmeno, prijmeni });
    }
    const existujiciCisla = new Set(oppRosterDraft.map((h) => h.cislo));
    const pridana = noviHraci.filter((h) => !existujiciCisla.has(h.cislo));
    oppRosterDraft = [...oppRosterDraft, ...pridana];
    oppRosterBulkOpen = false;
    oppRosterBulkText = '';
  }

  async function saveOppRoster() {
    if (!souper) return;
    oppRosterChyba = null;
    const cisteni: SouperHrac[] = [];
    const videnaCisla = new Set<number>();
    for (let i = 0; i < oppRosterDraft.length; i++) {
      const h = oppRosterDraft[i];
      const c = typeof h.cislo === 'string' ? parseInt(h.cislo, 10) : h.cislo;
      if (!c && !h.jmeno?.trim() && !h.prijmeni?.trim()) continue;
      if (c === undefined || c === null || isNaN(c as number)) {
        oppRosterChyba = `Řádek ${i + 1}: číslo musí být vyplněné`;
        return;
      }
      if (c < 0 || c > 99) {
        oppRosterChyba = `Řádek ${i + 1}: číslo musí být 0–99`;
        return;
      }
      if (videnaCisla.has(c)) {
        oppRosterChyba = `Číslo #${c} je v soupisce dvakrát`;
        return;
      }
      videnaCisla.add(c);
      cisteni.push({
        cislo: c,
        jmeno: h.jmeno?.trim() || undefined,
        prijmeni: h.prijmeni?.trim() || undefined,
      });
    }
    const now = Date.now();
    await db.souperi.update(souper.id, {
      hraci_soupere: cisteni.length > 0 ? cisteni : undefined,
      updated_at: now,
    });
    souper = { ...souper, hraci_soupere: cisteni.length > 0 ? cisteni : undefined, updated_at: now };
    if (selectedOppCislo !== null && !cisteni.some((h) => h.cislo === selectedOppCislo)) {
      selectedOppCislo = null;
    }
    oppRosterEditOpen = false;
    toast('Soupiska soupeře aktualizována');
  }

  async function updateZapasCache() {
    if (!zapas) return;
    const s = computeSkore(udalosti);
    const perQ = computeSkorePoCtvrtinach(udalosti, ctvrtiny);
    await db.zapasy.update(zapas.id, {
      skore_nase: s.nase,
      skore_souper: s.souper,
      skore_po_ctvrtinach: perQ,
    });
    zapas = { ...zapas, skore_nase: s.nase, skore_souper: s.souper, skore_po_ctvrtinach: perQ };
  }

  function popisAkce(typ: UdalostTyp): string {
    switch (typ) {
      case 'shot_2_made': return '2 body daný (+2)';
      case 'shot_2_miss': return '2 body nedaný';
      case 'shot_3_made': return '3 body daný (+3)';
      case 'shot_3_miss': return '3 body nedaný';
      case 'ft_made': return 'trestný daný (+1)';
      case 'ft_miss': return 'trestný nedaný';
      case 'foul': return 'faul';
      case 'reb_off': return 'doskok útočný';
      case 'reb_def': return 'doskok obranný';
      case 'steal': return 'zisk';
      case 'turnover': return 'ztráta';
      case 'assist': return 'asistence';
      case 'block': return 'blok';
      case 'substitution': return 'střídání';
      case 'opp_pts_2': return '+2 body';
      case 'opp_pts_3': return '+3 body';
      case 'opp_pts_1': return '+1 trestný';
      case 'opp_foul': return '+1 faul';
      case 'opp_reb': return '+ doskok';
      case 'opp_reb_off': return '+ doskok útoč.';
      case 'opp_reb_def': return '+ doskok obr.';
      case 'opp_turnover': return '+1 ztráta';
      case 'foul_technical_bench': return 'technická chyba (lavička)';
      case 'oddech_my': return 'oddech';
      case 'oddech_opp': return 'oddech soupeře';
      case 'team_pts_2': return '+2 body (bez hráče)';
      case 'team_pts_3': return '+3 body (bez hráče)';
      case 'team_pts_1': return '+1 trestný (bez hráče)';
      case 'team_turnover': return 'ztráta (bez hráče)';
    }
  }

  function popisUdalostKratce(ev: Udalost): string {
    const akce = ev.typ === 'foul' && ev.foul_subtyp
      ? `faul (${foulSubtypLabel(ev.foul_subtyp)})`
      : popisAkce(ev.typ);
    if (ev.hrac_id) {
      const h = hraci.find((x) => x.id === ev.hrac_id);
      return h ? `#${h.cislo_dresu ?? '?'} ${h.prijmeni} — ${akce}` : akce;
    }
    if (ev.typ.startsWith('opp_')) {
      const num = typeof ev.opp_hrac_cislo === 'number' ? ` #${ev.opp_hrac_cislo}` : '';
      return `Soupeř${num} — ${akce}`;
    }
    if (ev.typ.startsWith('team_')) return `Tým (bez hráče) — ${akce}`;
    return akce;
  }

  const posledniUndoPopisy = $derived.by<string[]>(() => {
    const out: string[] = [];
    for (let i = undoStack.length - 1; i >= 0 && out.length < 6; i--) {
      const op = undoStack[i];
      if (op.kind === 'event') {
        const ev = udalosti.find((u) => u.id === op.eventId);
        out.push(ev ? popisUdalostKratce(ev) : 'akce');
      } else if (op.kind === 'q-rename') {
        out.push(`přejmenování Q${op.fromCislo} → ${op.toCislo}`);
      } else if (op.kind === 'q-split') {
        out.push('rozdělení čtvrtiny');
      } else if (op.kind === 'set-time') {
        out.push('nastavení času');
      }
    }
    return out;
  });

  function openSub() {
    subOuts = [];
    subIns = [];
    subModal = true;
  }

  function closeSub() {
    subModal = false;
    subOuts = [];
    subIns = [];
  }

  function toggleSubOut(id: string) {
    subOuts = subOuts.includes(id) ? subOuts.filter((x) => x !== id) : [...subOuts, id];
  }

  function toggleSubIn(id: string) {
    subIns = subIns.includes(id) ? subIns.filter((x) => x !== id) : [...subIns, id];
  }

  async function confirmSub() {
    if (!zapas) return;
    if (subOuts.length === 0 || subOuts.length !== subIns.length) return;

    const inHraci = subIns
      .map((id) => hraci.find((h) => h.id === id))
      .filter((h): h is Hrac => !!h);
    if (inHraci.length !== subIns.length) return;

    const vyloucenyIn = inHraci.find((h) => jeFouledOut(udalosti, h.id));
    if (vyloucenyIn) {
      warning = {
        msg: `#${vyloucenyIn.cislo_dresu ?? '?'} ${vyloucenyIn.prijmeni} je vyloučen (5 osobních faulů). Nemůže nastoupit.`,
      };
      return;
    }

    const porusene = soutez?.bez_limitu_mladeze
      ? []
      : inHraci
          .map((h) => ({ h, porus: poruseniLimitu(h.id, aktualniCtvrtinaCislo, zapas!.nase_kategorie, udalosti, ctvrtiny) }))
          .filter((x) => x.porus.kind);

    const doSub = async () => {
      const novaUd: Udalost[] = [];
      const ts = Date.now();
      const casVQ = aktualniCasVQMs();
      for (let i = 0; i < subOuts.length; i++) {
        const out = subOuts[i];
        const inId = subIns[i];
        const ev: Udalost = {
          id: newId(),
          zapas_id: zapas!.id,
          ctvrtina_cislo: aktualniCtvrtinaCislo,
          poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo) + i,
          typ: 'substitution',
          hrac_id: null,
          sub_out_id: out,
          sub_in_id: inId,
          timestamp_at: ts,
          cas_v_q_ms: casVQ,
        };
        novaUd.push(ev);
      }
      await db.udalosti.bulkAdd(novaUd);
      udalosti = [...udalosti, ...novaUd];
      for (const ev of novaUd) pushUndo({ kind: 'event', eventId: ev.id });
      const outSet = new Set(subOuts);
      onCourt = onCourt.filter((id) => !outSet.has(id)).concat(subIns);
      const popis = subOuts
        .map((outId, i) => {
          const outH = hraci.find((h) => h.id === outId);
          const inH = inHraci[i];
          return `#${outH?.cislo_dresu ?? '?'}↔#${inH?.cislo_dresu ?? '?'}`;
        })
        .join(', ');
      closeSub();
      toast(`Střídání: ${popis}`);
      foulOutPrompt = null;
    };

    if (porusene.length > 0) {
      const popis = porusene.map((p) => `#${p.h.cislo_dresu ?? '?'} ${p.h.prijmeni}: ${p.porus.popis}`).join('\n');
      warning = {
        msg: `⚠️ ${popis}\n\nPokračovat = porušit pravidlo.`,
        onConfirm: doSub,
      };
    } else {
      await doSub();
    }
  }

  async function endQuarter() {
    if (!zapas) return;
    const aktualni = ctvrtiny.find((c) => c.cislo === aktualniCtvrtinaCislo);
    if (!aktualni) return;
    pauseKlok();
    await db.ctvrtiny.update(aktualni.id, { konec_at: Date.now() });
    ctvrtiny = ctvrtiny.map((c) => (c.id === aktualni.id ? { ...c, konec_at: Date.now() } : c));

    if (aktualniCtvrtinaCislo >= 4) {
      const s = computeSkore(udalosti);
      if (s.nase === s.souper) {
        aktualniCtvrtinaCislo = aktualniCtvrtinaCislo + 1;
        mode = 'quarterEndPrompt';
      } else {
        mode = 'quarterEndPrompt';
      }
    } else {
      aktualniCtvrtinaCislo = aktualniCtvrtinaCislo + 1;
      pickLineup = [];
      pickLineupOpp = [];
      selectedOppCislo = null;
      mode = 'pickLineup';
    }
    selectedPlayer = null;
  }

  async function otevriEditRoster() {
    if (!zapas) return;
    if (ctvrtiny.length > 0) return;
    editRosterChyba = null;
    const all = await db.hraci.toArray();
    editRosterAllHraci = all
      .filter((h) => h.aktivni && muzeHratV(h.domaci_kategorie, zapas!.nase_kategorie))
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99));
    editRosterSelected = [...zapas.nasazeni_hraci];
    editRosterOpen = true;
  }

  function toggleEditRoster(id: string) {
    if (editRosterSelected.includes(id)) {
      editRosterSelected = editRosterSelected.filter((x) => x !== id);
    } else {
      editRosterSelected = [...editRosterSelected, id];
    }
  }

  async function ulozEditRoster() {
    if (!zapas) return;
    if (editRosterSelected.length < 5) {
      editRosterChyba = 'Minimálně 5 hráčů v soupisce.';
      return;
    }
    await db.zapasy.update(zapas.id, { nasazeni_hraci: [...editRosterSelected] });
    zapas = { ...zapas, nasazeni_hraci: [...editRosterSelected] };
    hraci = await db.hraci.bulkGet(editRosterSelected).then((arr) => arr.filter((h): h is Hrac => !!h));
    pickLineup = pickLineup.filter((id) => editRosterSelected.includes(id));
    editRosterOpen = false;
  }

  async function poNovemHraci() {
    editRosterHracFormOpen = false;
    if (!zapas) return;
    const all = await db.hraci.toArray();
    const eligible = all
      .filter((h) => h.aktivni && muzeHratV(h.domaci_kategorie, zapas!.nase_kategorie))
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99));
    const noviIds = eligible
      .map((h) => h.id)
      .filter((id) => !editRosterAllHraci.some((h) => h.id === id));
    editRosterAllHraci = eligible;
    if (noviIds.length > 0) {
      editRosterSelected = [...editRosterSelected, ...noviIds];
    }
  }

  async function startQuarter() {
    if (pickLineup.length !== 5 || !zapas) {
      warning = { msg: 'Vyber přesně 5 hráčů na hřišti.' };
      return;
    }
    const opp = pickLineupOpp.length === 5 ? [...pickLineupOpp] : undefined;
    const ctv: Ctvrtina = {
      id: newId(),
      zapas_id: zapas.id,
      cislo: aktualniCtvrtinaCislo,
      petice_start: [...pickLineup],
      petice_soupere_start: opp,
      zacatek_at: Date.now(),
    };
    await db.ctvrtiny.add(ctv);
    ctvrtiny = [...ctvrtiny, ctv].sort((a, b) => a.cislo - b.cislo);
    onCourt = [...pickLineup];
    oppOnCourt = opp ?? [];
    pickLineup = [];
    pickLineupOpp = [];
    selectedOppCislo = null;
    undoStack = [];
    resetKlok();
    mode = 'inProgress';
  }

  function togglePick(id: string) {
    if (pickLineup.includes(id)) {
      pickLineup = pickLineup.filter((x) => x !== id);
    } else {
      if (pickLineup.length >= 5) return;
      pickLineup = [...pickLineup, id];
    }
  }

  async function pokracovatOT() {
    pickLineup = [];
    pickLineupOpp = [];
    selectedOppCislo = null;
    mode = 'pickLineup';
  }

  async function ukoncitZapas() {
    if (!zapas) return;
    if (!confirm('Ukončit zápas? Tato akce uzavře zápis.')) return;
    await db.zapasy.update(zapas.id, { status: 'ukonceny', ukonceno_at: Date.now() });
    zapas = { ...zapas, status: 'ukonceny', ukonceno_at: Date.now() };
    mode = 'matchEnd';
  }

  async function undo() {
    if (!zapas || undoStack.length === 0) {
      toast('Není co vrátit');
      return;
    }
    const op = undoStack[undoStack.length - 1];

    if (op.kind === 'event') {
      const ev = udalosti.find((u) => u.id === op.eventId);
      if (!ev) {
        undoStack = undoStack.slice(0, -1);
        return;
      }
      if (ev.ctvrtina_cislo !== aktualniCtvrtinaCislo) {
        toast('Vrátit lze jen událost z aktuální čtvrtiny.');
        return;
      }
      await db.udalosti.delete(ev.id);
      udalosti = udalosti.filter((u) => u.id !== ev.id);
      if (ev.typ === 'substitution' && ev.sub_out_id && ev.sub_in_id) {
        onCourt = onCourt.filter((id) => id !== ev.sub_in_id).concat(ev.sub_out_id);
      }
      undoStack = undoStack.slice(0, -1);
      toast(`Vráceno: ${ev.hrac_id ? popisAkce(ev.typ) : `soupeř ${popisAkce(ev.typ)}`}`);
      await updateZapasCache();
      return;
    }

    if (op.kind === 'q-rename') {
      const ctv = ctvrtiny.find((c) => c.id === op.ctvrtinaId);
      if (!ctv) {
        undoStack = undoStack.slice(0, -1);
        return;
      }
      if (ctvrtiny.some((c) => c.cislo === op.fromCislo && c.id !== ctv.id)) {
        toast(`Čtvrtina ${op.fromCislo} už znova existuje — nelze vrátit`);
        return;
      }
      await db.ctvrtiny.update(ctv.id, { cislo: op.fromCislo });
      ctvrtiny = ctvrtiny
        .map((c) => (c.id === ctv.id ? { ...c, cislo: op.fromCislo } : c))
        .sort((a, b) => a.cislo - b.cislo);
      if (aktualniCtvrtinaCislo === op.toCislo) aktualniCtvrtinaCislo = op.fromCislo;
      undoStack = undoStack.slice(0, -1);
      toast(`Vrácena změna Q (${op.toCislo} → ${op.fromCislo})`);
      await updateZapasCache();
      return;
    }

    if (op.kind === 'q-split') {
      const oldCtv = ctvrtiny.find((c) => c.id === op.oldCtvrtinaId);
      const newCtv = ctvrtiny.find((c) => c.id === op.newCtvrtinaId);
      if (!oldCtv || !newCtv) {
        undoStack = undoStack.slice(0, -1);
        return;
      }
      if (udalosti.some((u) => u.ctvrtina_cislo === op.toCislo)) {
        toast(`V nové Q už jsou eventy — nejdřív je vrať`);
        return;
      }
      await db.ctvrtiny.delete(newCtv.id);
      await db.ctvrtiny.update(oldCtv.id, { konec_at: undefined });
      ctvrtiny = ctvrtiny
        .filter((c) => c.id !== newCtv.id)
        .map((c) => (c.id === oldCtv.id ? { ...c, konec_at: undefined } : c))
        .sort((a, b) => a.cislo - b.cislo);
      aktualniCtvrtinaCislo = op.fromCislo;
      casZakladnaMs = op.prevCasZakladnaMs;
      casStartedAt = op.prevCasStartedAt;
      ted = Date.now();
      undoStack = undoStack.slice(0, -1);
      toast(`Vrácen split Q${op.fromCislo}/${op.toCislo}`);
      await updateZapasCache();
      return;
    }

    if (op.kind === 'set-time') {
      casZakladnaMs = op.prevCasZakladnaMs;
      casStartedAt = op.prevCasStartedAt;
      ted = Date.now();
      undoStack = undoStack.slice(0, -1);
      toast('Vrácena změna času');
      return;
    }
  }

  async function foulOutSub(playerId: string) {
    subOuts = [playerId];
    subIns = [];
    subModal = true;
    foulOutPrompt = null;
  }

  function pocetFauluZobr(id: string): number {
    return pocetFaulu(udalosti, id);
  }

  function ctvrtinyOdehraneCount(id: string): number {
    const regularni = zapas?.pocet_ctvrtin ?? DEFAULT_POCET_CTVRTIN;
    let count = 0;
    for (const c of ctvrtiny) {
      if (c.cislo > regularni) continue;
      if (c.petice_start.includes(id)) count++;
    }
    for (const u of udalosti) {
      if (u.typ !== 'substitution' || u.ctvrtina_cislo > regularni) continue;
      if (u.sub_in_id === id) {
        const c = ctvrtiny.find((ct) => ct.cislo === u.ctvrtina_cislo);
        if (c && !c.petice_start.includes(id)) count++;
      }
    }
    return count;
  }

  const SWIPE_ENABLED = false;
  const SWIPE_DETECT_THRESHOLD_PX = 12;
  const SWIPE_FIRE_THRESHOLD_PX = 40;
  const GESTURE_CANCEL_DRIFT_PX = 12;
  const LONG_PRESS_MS = 250;
  const RADIAL_INNER_RADIUS_PX = 82;
  const RADIAL_OUTER_RADIUS_PX = 162;
  const RADIAL_DEADZONE_PX = 32;
  const RADIAL_RING_BOUNDARY_PX = 122;
  const RADIAL_VIEWBOX_PX = 220;
  const RADIAL_INNER_BAND_RIN = 36;
  const RADIAL_INNER_BAND_ROUT = 118;
  const RADIAL_OUTER_BAND_RIN = 126;
  const RADIAL_OUTER_BAND_ROUT = 200;
  const RADIAL_WEDGE_GAP_DEG = 3;

  type GestureMode = 'idle' | 'swipe' | 'radial';
  interface ActiveGesture {
    pointerId: number;
    playerId: string;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    cardCx: number;
    cardCy: number;
    mode: GestureMode;
    longPressTimer: number | null;
  }

  let activeGesture = $state<ActiveGesture | null>(null);

  type GesturActionTyp =
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

  type SegTone = 'made' | 'miss' | 'foul' | 'reb' | 'pozit' | 'negat';

  function swipeDirectionToTyp(dx: number, dy: number): GesturActionTyp | null {
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg >= -45 && deg < 45) return 'foul';
    if (deg >= 45 && deg < 135) return 'shot_2_miss';
    if (deg >= -135 && deg < -45) return 'shot_2_made';
    return 'reb_def';
  }

  type RadialHit = { ring: 'inner' | 'outer'; idx: number };

  function radialSegmentIndex(dx: number, dy: number): RadialHit | null {
    const dist = Math.hypot(dx, dy);
    if (dist < RADIAL_DEADZONE_PX) return null;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalized = (deg + 90 + 360) % 360;
    if (dist < RADIAL_RING_BOUNDARY_PX) {
      return { ring: 'inner', idx: Math.floor((normalized + 22.5) / 45) % 8 };
    }
    return { ring: 'outer', idx: Math.floor((normalized + 36) / 72) % 5 };
  }

  const RADIAL_INNER_SEGMENTS: { typ: GesturActionTyp; label: string; tone: SegTone }[] = [
    { typ: 'shot_2_made', label: '✓2', tone: 'made' },
    { typ: 'shot_3_made', label: '✓3', tone: 'made' },
    { typ: 'reb_off', label: 'REB-O', tone: 'reb' },
    { typ: 'ft_miss', label: '✗FT', tone: 'miss' },
    { typ: 'shot_2_miss', label: '✗2', tone: 'miss' },
    { typ: 'shot_3_miss', label: '✗3', tone: 'miss' },
    { typ: 'reb_def', label: 'REB-D', tone: 'reb' },
    { typ: 'ft_made', label: '✓FT', tone: 'made' },
  ];

  const RADIAL_OUTER_SEGMENTS: { typ: GesturActionTyp; label: string; tone: SegTone }[] = [
    { typ: 'assist', label: 'AST', tone: 'pozit' },
    { typ: 'steal', label: 'STL', tone: 'pozit' },
    { typ: 'block', label: 'BLK', tone: 'pozit' },
    { typ: 'turnover', label: 'TO', tone: 'negat' },
    { typ: 'foul', label: 'FAUL', tone: 'foul' },
  ];

  async function dispatchGesturAction(playerId: string, typ: GesturActionTyp) {
    if (typ === 'foul') {
      await addFoul(playerId, 'personal');
      return;
    }
    selectedPlayer = playerId;
    await tick();
    await recordAction(typ);
  }

  function gesturePointerDown(e: PointerEvent, playerId: string) {
    if (activeGesture) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const timer = window.setTimeout(() => {
      if (activeGesture && activeGesture.mode === 'idle' && activeGesture.pointerId === e.pointerId) {
        activeGesture = { ...activeGesture, mode: 'radial', longPressTimer: null };
      }
    }, LONG_PRESS_MS);
    activeGesture = {
      pointerId: e.pointerId,
      playerId,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      cardCx: rect.left + rect.width / 2,
      cardCy: rect.top + rect.height / 2,
      mode: 'idle',
      longPressTimer: timer,
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function gesturePointerMove(e: PointerEvent) {
    if (!activeGesture || e.pointerId !== activeGesture.pointerId) return;
    const dx = e.clientX - activeGesture.startX;
    const dy = e.clientY - activeGesture.startY;
    const dist = Math.hypot(dx, dy);
    if (activeGesture.mode === 'idle' && dist >= SWIPE_DETECT_THRESHOLD_PX) {
      if (SWIPE_ENABLED) {
        if (activeGesture.longPressTimer !== null) window.clearTimeout(activeGesture.longPressTimer);
        activeGesture = { ...activeGesture, mode: 'swipe', longPressTimer: null, curX: e.clientX, curY: e.clientY };
        e.preventDefault();
        return;
      }
      if (activeGesture.longPressTimer !== null) window.clearTimeout(activeGesture.longPressTimer);
      const el = e.currentTarget as HTMLElement;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      activeGesture = null;
      return;
    }
    activeGesture = { ...activeGesture, curX: e.clientX, curY: e.clientY };
    if (activeGesture.mode !== 'idle') e.preventDefault();
  }

  function gesturePointerUp(e: PointerEvent) {
    if (!activeGesture || e.pointerId !== activeGesture.pointerId) return;
    const g = activeGesture;
    if (g.longPressTimer !== null) window.clearTimeout(g.longPressTimer);
    const el = e.currentTarget as HTMLElement;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    activeGesture = null;

    const dx = g.curX - g.startX;
    const dy = g.curY - g.startY;
    const dist = Math.hypot(dx, dy);

    if (g.mode === 'idle') {
      selectPlayer(g.playerId);
      return;
    }
    if (g.mode === 'swipe') {
      if (dist < SWIPE_FIRE_THRESHOLD_PX) return;
      const typ = swipeDirectionToTyp(dx, dy);
      if (typ) void dispatchGesturAction(g.playerId, typ);
      return;
    }
    const radialDx = g.curX - g.cardCx;
    const radialDy = g.curY - g.cardCy;
    const hit = radialSegmentIndex(radialDx, radialDy);
    if (hit === null) return;
    const seg = hit.ring === 'inner' ? RADIAL_INNER_SEGMENTS[hit.idx] : RADIAL_OUTER_SEGMENTS[hit.idx];
    if (seg) void dispatchGesturAction(g.playerId, seg.typ);
  }

  function gesturePointerCancel(e: PointerEvent) {
    if (!activeGesture || e.pointerId !== activeGesture.pointerId) return;
    if (activeGesture.longPressTimer !== null) window.clearTimeout(activeGesture.longPressTimer);
    activeGesture = null;
  }

  const swipeActiveDir = $derived.by<GesturActionTyp | null>(() => {
    if (!activeGesture || activeGesture.mode !== 'swipe') return null;
    const dx = activeGesture.curX - activeGesture.startX;
    const dy = activeGesture.curY - activeGesture.startY;
    if (Math.hypot(dx, dy) < SWIPE_FIRE_THRESHOLD_PX / 2) return null;
    return swipeDirectionToTyp(dx, dy);
  });

  const radialActive = $derived.by<RadialHit | null>(() => {
    if (!activeGesture || activeGesture.mode !== 'radial') return null;
    const dx = activeGesture.curX - activeGesture.cardCx;
    const dy = activeGesture.curY - activeGesture.cardCy;
    return radialSegmentIndex(dx, dy);
  });

  const radialActiveSeg = $derived.by<{ typ: GesturActionTyp; label: string; tone: SegTone } | null>(() => {
    if (!radialActive) return null;
    const seg = radialActive.ring === 'inner'
      ? RADIAL_INNER_SEGMENTS[radialActive.idx]
      : RADIAL_OUTER_SEGMENTS[radialActive.idx];
    return seg ?? null;
  });

  function radialInnerSegmentXY(i: number, r: number): { x: number; y: number } {
    const deg = -90 + i * 45;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  }

  function radialOuterSegmentXY(i: number, r: number): { x: number; y: number } {
    const deg = -90 + i * 72;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  }

  function radialWedgePath(centerDeg: number, spanDeg: number, rIn: number, rOut: number): string {
    const half = spanDeg / 2 - RADIAL_WEDGE_GAP_DEG / 2;
    const a0 = ((centerDeg - half) * Math.PI) / 180;
    const a1 = ((centerDeg + half) * Math.PI) / 180;
    const x0o = Math.cos(a0) * rOut, y0o = Math.sin(a0) * rOut;
    const x1o = Math.cos(a1) * rOut, y1o = Math.sin(a1) * rOut;
    const x1i = Math.cos(a1) * rIn, y1i = Math.sin(a1) * rIn;
    const x0i = Math.cos(a0) * rIn, y0i = Math.sin(a0) * rIn;
    return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 0 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 0 0 ${x0i} ${y0i} Z`;
  }

  const ACTION_RADIAL_RADIUS_PX = 110;
  const ACTION_RADIAL_DEADZONE_PX = 28;
  const ACTION_TAP_MAX_DRIFT_PX = 12;

  type ActionGestureTyp =
    | 'shot_2_made' | 'shot_2_miss'
    | 'shot_3_made' | 'shot_3_miss'
    | 'ft_made' | 'ft_miss'
    | 'reb_off' | 'reb_def'
    | 'assist' | 'steal' | 'block'
    | 'turnover' | 'foul';

  interface ActionGesture {
    pointerId: number;
    typ: ActionGestureTyp;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    btnCx: number;
    btnCy: number;
    mode: 'idle' | 'radial';
    longPressTimer: number | null;
  }

  let actionGesture = $state<ActionGesture | null>(null);

  const radialPlayers = $derived(naHristi.slice(0, 5));

  function actionRadialSegmentXY(i: number, n: number, r: number): { x: number; y: number } {
    const deg = -90 + (i * 360) / n;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  }

  function actionRadialSegmentIndex(dx: number, dy: number, n: number): number | null {
    const dist = Math.hypot(dx, dy);
    if (dist < ACTION_RADIAL_DEADZONE_PX) return null;
    if (n <= 0) return null;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalized = (deg + 90 + 360) % 360;
    const segWidth = 360 / n;
    return Math.floor((normalized + segWidth / 2) / segWidth) % n;
  }

  const actionRadialActiveIdx = $derived.by<number | null>(() => {
    if (!actionGesture || actionGesture.mode !== 'radial') return null;
    const dx = actionGesture.curX - actionGesture.btnCx;
    const dy = actionGesture.curY - actionGesture.btnCy;
    return actionRadialSegmentIndex(dx, dy, radialPlayers.length);
  });

  async function dispatchActionWithPlayer(typ: ActionGestureTyp, playerId: string) {
    if (typ === 'foul') {
      await addFoul(playerId, 'personal');
      return;
    }
    selectedPlayer = playerId;
    await tick();
    await recordAction(typ);
  }

  function handleActionTap(typ: ActionGestureTyp) {
    if (!selectedPlayer) return;
    if (typ === 'foul') {
      void addFoul(selectedPlayer, 'personal');
      return;
    }
    void recordAction(typ);
  }

  function actionGesturePointerDown(e: PointerEvent, typ: ActionGestureTyp) {
    if (actionGesture) return;
    if (activeGesture) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const timer = window.setTimeout(() => {
      if (actionGesture && actionGesture.mode === 'idle' && actionGesture.pointerId === e.pointerId) {
        actionGesture = { ...actionGesture, mode: 'radial', longPressTimer: null };
      }
    }, LONG_PRESS_MS);
    actionGesture = {
      pointerId: e.pointerId,
      typ,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      btnCx: rect.left + rect.width / 2,
      btnCy: rect.top + rect.height / 2,
      mode: 'idle',
      longPressTimer: timer,
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function actionGesturePointerMove(e: PointerEvent) {
    if (!actionGesture || e.pointerId !== actionGesture.pointerId) return;
    if (actionGesture.mode === 'idle') {
      const drift = Math.hypot(e.clientX - actionGesture.startX, e.clientY - actionGesture.startY);
      if (drift >= GESTURE_CANCEL_DRIFT_PX) {
        if (actionGesture.longPressTimer !== null) window.clearTimeout(actionGesture.longPressTimer);
        const el = e.currentTarget as HTMLElement;
        try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        actionGesture = null;
        return;
      }
    }
    actionGesture = { ...actionGesture, curX: e.clientX, curY: e.clientY };
    if (actionGesture.mode === 'radial') e.preventDefault();
  }

  function actionGesturePointerUp(e: PointerEvent) {
    if (!actionGesture || e.pointerId !== actionGesture.pointerId) return;
    const g = actionGesture;
    if (g.longPressTimer !== null) window.clearTimeout(g.longPressTimer);
    const el = e.currentTarget as HTMLElement;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    actionGesture = null;

    if (g.mode === 'idle') {
      const drift = Math.hypot(g.curX - g.startX, g.curY - g.startY);
      if (drift > ACTION_TAP_MAX_DRIFT_PX) return;
      handleActionTap(g.typ);
      return;
    }
    const dx = g.curX - g.btnCx;
    const dy = g.curY - g.btnCy;
    const idx = actionRadialSegmentIndex(dx, dy, radialPlayers.length);
    if (idx === null) return;
    const player = radialPlayers[idx];
    if (!player) return;
    void dispatchActionWithPlayer(g.typ, player.id);
  }

  function actionGesturePointerCancel(e: PointerEvent) {
    if (!actionGesture || e.pointerId !== actionGesture.pointerId) return;
    if (actionGesture.longPressTimer !== null) window.clearTimeout(actionGesture.longPressTimer);
    actionGesture = null;
  }
</script>

{#if mode === 'loading' || !zapas || !souper}
  <div class="loading">Načítání…</div>
{:else}
  <div class="live-app">
    <header class="head">
      <button class="back" onclick={onBack}>← Zpět</button>
      <div class="teams">
        {#if zapas.nase_strana === 'home'}
          <span class="us">Jižní Supi ({kategorieLabel(zapas.nase_kategorie)})</span>
          <span class="vs">vs</span>
          <span class="them">{souper.nazev}</span>
        {:else}
          <span class="them">{souper.nazev}</span>
          <span class="vs">vs</span>
          <span class="us">Jižní Supi ({kategorieLabel(zapas.nase_kategorie)})</span>
        {/if}
      </div>
    </header>

    <div class="score-bar">
      <span class="sb-q">{fmtQ(aktualniCtvrtinaCislo)}{jeOT(aktualniCtvrtinaCislo) ? ' • prodl.' : ''}</span>
      <span class="us-score">{skore.nase}</span>
      <span class="sep">:</span>
      <span class="them-score">{skore.souper}</span>
    </div>

    {#if skorePoCtvrtinach.length > 0}
      <div class="quarter-scores">
        {#each skorePoCtvrtinach as qs}
          <div class="qs">
            <span class="qs-label">{fmtQ(qs.q)}</span>
            <span class="qs-score">{qs.nase}:{qs.souper}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if mode === 'pickLineup'}
      <section class="pick-lineup">
        <div class="pick-header">
          <h2>Vyber pětici pro {fmtQ(aktualniCtvrtinaCislo)} ({pickLineup.length}/5)</h2>
          {#if ctvrtiny.length === 0}
            <button class="edit-roster-btn" onclick={otevriEditRoster} title="Upravit nasazení (možné jen před Q1)">
              ✎ Upravit soupisku
            </button>
          {/if}
        </div>
        <div class="players-grid">
          {#each hraci.slice().sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99)) as h (h.id)}
            {@const fouledOut = jeFouledOut(udalosti, h.id)}
            {@const fauly = pocetFauluZobr(h.id)}
            {@const odehrano = ctvrtinyOdehraneCount(h.id)}
            <button
              class="player-card"
              class:selected={pickLineup.includes(h.id)}
              class:disabled={fouledOut}
              disabled={fouledOut}
              onclick={() => togglePick(h.id)}
            >
              <Avatar foto={h.foto} cislo={h.cislo_dresu} size={PICK_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
              <div class="name">{h.prijmeni}</div>
              <div class="meta">
                {kategorieLabel(h.domaci_kategorie)}{h.pozice ? ` · ${h.pozice}` : ''}
                {#if fauly > 0} · F{fauly}{/if}
                {#if odehrano > 0} · {odehrano}Q{/if}
              </div>
              {#if fouledOut}<div class="fouled">VYLOUČEN</div>{/if}
            </button>
          {/each}
        </div>

        <div class="pick-header pick-header-opp">
          <h2>Pětice soupeře ({souper.nazev}) ({pickLineupOpp.length}/5)</h2>
        </div>
        {#if (souper.hraci_soupere?.length ?? 0) === 0}
          <div class="pick-opp-empty">
            Soupeř nemá rozepsanou soupisku. Doplň čísla v sekci <strong>Soupeři</strong> nebo začni bez sledování per-hráč statistik soupeře.
          </div>
        {:else}
          <div class="opp-pick-grid">
            {#each opponentRoster as oh (oh.cislo)}
              <button
                class="opp-pick-card"
                class:selected={pickLineupOpp.includes(oh.cislo)}
                onclick={() => togglePickOpp(oh.cislo)}
              >
                <div class="opp-pick-cislo">#{oh.cislo}</div>
                {#if oh.prijmeni}<div class="opp-pick-name">{oh.prijmeni}</div>{/if}
              </button>
            {/each}
          </div>
        {/if}

        <div class="lineup-buttons">
          <button class="primary big" disabled={pickLineup.length !== 5} onclick={startQuarter}>
            Začít {fmtQ(aktualniCtvrtinaCislo)}
          </button>
        </div>
      </section>

    {:else if mode === 'inProgress'}
      <section class="clock-bar" class:running={klokBezi}>
        <div class="clock-cislo">
          <span class="clock-q">{fmtQ(aktualniCtvrtinaCislo)}</span>
          <span class="clock-display">{formatCas(Math.max(0, delkaQMs - casVQMs))}</span>
          {#if klokBezi}<span class="clock-dot" aria-hidden="true"></span>{/if}
        </div>
        <div class="clock-total">
          <span class="clock-total-label">v zápase</span>
          <span class="clock-total-val">{formatCas(casVZapaseMs)}</span>
          <span class="clock-total-meta">/ {formatCas(pocetCtvrtin * delkaQMs)}</span>
        </div>
        <div class="clock-buttons">
          {#if klokBezi}
            <button class="clock-btn" onclick={pauseKlok} title="Pauza">⏸ Pauza</button>
          {:else}
            <button class="clock-btn primary" onclick={startKlok} title="Start">▶ Start</button>
          {/if}
          <button class="clock-btn ghost" onclick={openSetTime} title="Ručně nastavit čas">✏️ Čas</button>
          <button class="clock-btn ghost" onclick={openSetQ} title="Přejmenovat / split aktuální Q. Pokud v Q jsou akce, vytvoří se nová Q s vybraným číslem a stejnou pěticí; minulé akce zůstanou v původní Q.">✏️ Q</button>
          <button class="clock-btn ghost" onclick={resetKlok} title="Reset na 0:00">↺ Reset</button>
          <button class="clock-btn undo" onclick={undo} title="Smaže poslední zaznamenanou událost v této čtvrtině (faul, koš, doskok, střídání…)" disabled={undoStack.length === 0}>↶ Vrátit poslední</button>
        </div>
        {#if posledniUndoPopisy.length > 0}
          <div class="undo-hint">
            <span class="uh-label">↶ Vrátíš:</span>
            <span class="uh-last">{posledniUndoPopisy[0]}</span>
            {#if posledniUndoPopisy[1]}
              <span class="uh-prev">předtím: {posledniUndoPopisy[1]}</span>
            {/if}
          </div>
        {/if}
      </section>

      <section class="live">
        <div class="actions" class:disabled={!selectedPlayer}>
          <div class="actions-label">
            {#if selectedPlayer}
              {@const sp = hraci.find(h => h.id === selectedPlayer)}
              Akce: #{sp?.cislo_dresu ?? '?'} {sp?.prijmeni}
            {:else}
              Akce našeho hráče (vyber hráče vpravo)
            {/if}
          </div>

          {#snippet aBtn(typ: ActionGestureTyp, label: string, extra: string)}
            <button
              class="action {extra}"
              class:disabled-look={!selectedPlayer}
              class:gesturing={actionGesture?.typ === typ}
              onpointerdown={(e) => actionGesturePointerDown(e, typ)}
              onpointermove={actionGesturePointerMove}
              onpointerup={actionGesturePointerUp}
              onpointercancel={actionGesturePointerCancel}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActionTap(typ); } }}
            >{label}</button>
          {/snippet}

          <div class="action-group pp-only">
            <div class="group-label">ÚTOK</div>
            <div class="group-grid utok">
              {@render aBtn('shot_2_made', '✓ 2 body', 'made')}
              {@render aBtn('shot_3_made', '✓ 3 body', 'made')}
              {@render aBtn('ft_made', '✓ Trestný', 'made')}
              {@render aBtn('shot_2_miss', '✗ 2 body', 'missed')}
              {@render aBtn('shot_3_miss', '✗ 3 body', 'missed')}
              {@render aBtn('ft_miss', '✗ Trestný', 'missed')}
            </div>
          </div>

          <div class="action-group pp-only">
            <div class="group-label">DOSKOK</div>
            <div class="group-grid doskok">
              {@render aBtn('reb_off', 'Útočný', 'reb-off')}
              {@render aBtn('reb_def', 'Obranný', 'reb-def')}
            </div>
          </div>

          <div class="action-group pp-only">
            <div class="group-label">POZITIVNÍ</div>
            <div class="group-grid pozit">
              {@render aBtn('assist', 'Asistence', 'assist')}
              {@render aBtn('steal', 'Zisk', 'steal')}
              {@render aBtn('block', 'Blok', 'block')}
            </div>
          </div>

          <div class="action-group pp-only">
            <div class="group-label">NEGATIVNÍ</div>
            <div class="group-grid negat">
              {@render aBtn('foul', 'Faul', 'foul')}
              {@render aBtn('turnover', 'Ztráta', 'turnover')}
              <button
                class="action foul foul-special action-span-2"
                class:disabled-look={!selectedPlayer}
                onclick={() => { if (selectedPlayer) foulSubtypePicker = { playerId: selectedPlayer }; }}
                title="Nesportovní / technická chyba (běžný faul zapíšeš tlačítkem Faul)"
              >Nesportovní / technická…</button>
            </div>
          </div>

          <div class="action-group">
            <div class="group-label">RYCHLÝ ZÁPIS BEZ HRÁČE (tým, sedí semafor)</div>
            <div class="group-grid utok">
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_2')}>+2 tým</button>
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_3')}>+3 tým</button>
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_1')}>+1 tým</button>
              <button class="action team-pts" onclick={recordTeamTurnover} title="Týmová ztráta bez konkrétního hráče (shot-clock, aut, nejasné). Po zápase lze přiřadit hráči v boxscore.">Ztráta tým</button>
            </div>
          </div>

          <button class="action bench-tech" onclick={recordBenchTech} title="Technická chyba lavičky/trenéra (bez hráče)">Tech. lavička (bez hráče)</button>
        </div>

        <div class="players-col">
          <div class="pc-label">NA HŘIŠTI</div>
          <div class="pc-mobile-hint">Podrž hráče → vyber akci, nebo švihni: ✓2 ↑ · ✗2 ↓ · faul → · doskok ←</div>
          <div class="pc-undo-row">
            <button class="pc-undo-btn" onclick={undo} disabled={undoStack.length === 0} title="Smaže poslední zaznamenanou událost v této čtvrtině">↶ Vrátit</button>
            {#if posledniUndoPopisy.length > 0}
              <ol class="pc-recent-list">
                {#each posledniUndoPopisy.slice(0, 4) as popis}
                  <li>{popis}</li>
                {/each}
              </ol>
            {/if}
          </div>
          <div class="pc-list">
            {#each naHristi as h (h.id)}
              {@const fauly = pocetFauluZobr(h.id)}
              <div
                class="pc-card"
                class:selected={selectedPlayer === h.id}
                class:gesturing={activeGesture?.playerId === h.id}
                role="button"
                tabindex="0"
                onpointerdown={(e) => gesturePointerDown(e, h.id)}
                onpointermove={gesturePointerMove}
                onpointerup={gesturePointerUp}
                onpointercancel={gesturePointerCancel}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(h.id); } }}
              >
                <Avatar foto={h.foto} cislo={h.cislo_dresu} size={PC_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
                <div class="pc-info">
                  <div class="pc-num">#{h.cislo_dresu ?? '?'}</div>
                  <div class="pc-name">{h.prijmeni}</div>
                </div>
                {#if fauly > 0}<div class="pc-fauly">F{fauly}</div>{/if}
                {#if activeGesture?.playerId === h.id && activeGesture.mode === 'swipe'}
                  <div class="swipe-hud" aria-hidden="true">
                    <span class="swipe-dir swipe-up" class:active={swipeActiveDir === 'shot_2_made'}>✓2</span>
                    <span class="swipe-dir swipe-down" class:active={swipeActiveDir === 'shot_2_miss'}>✗2</span>
                    <span class="swipe-dir swipe-right" class:active={swipeActiveDir === 'foul'}>FAUL</span>
                    <span class="swipe-dir swipe-left" class:active={swipeActiveDir === 'reb_def'}>REB-D</span>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          <button class="pc-sub-btn" onclick={openSub} title="Otevři střídání (multi-výběr)">⇄ Střídání</button>
        </div>

        <section class="opponent">
          <div class="opp-label">
            <span>
              SOUPEŘ ({souper.nazev})
              {#if selectedOppCislo !== null}
                — zapíše na #{selectedOppCislo}
              {:else if (souper.hraci_soupere?.length ?? 0) > 0}
                — bez čísla (volitelně vyber)
              {/if}
            </span>
            <button class="opp-roster-edit" onclick={openOppRosterEdit} title="Upravit soupisku soupeře (přidat / opravit číslo)">✎ Soupiska</button>
          </div>
          {#if opponentRoster.length > 0}
            <div class="opp-roster-row">
              {#each opponentRoster as oh (oh.cislo)}
                <button
                  class="opp-roster-chip"
                  class:selected={selectedOppCislo === oh.cislo}
                  onclick={() => selectOppPlayer(oh.cislo)}
                  title={`${oh.jmeno ?? ''} ${oh.prijmeni ?? ''}`.trim() || `#${oh.cislo}`}
                >
                  <span class="orc-cislo">#{oh.cislo}</span>
                  {#if oh.prijmeni}<span class="orc-name">{oh.prijmeni}</span>{/if}
                </button>
              {/each}
              {#if selectedOppCislo !== null}
                <button class="opp-roster-clear" onclick={() => (selectedOppCislo = null)} title="Zrušit výběr">✕ bez hráče</button>
              {/if}
            </div>
          {/if}
          <div class="opp-actions">
            <button class="opp" onclick={() => recordOpponent('opp_pts_2')}>+2 body</button>
            <button class="opp" onclick={() => recordOpponent('opp_pts_3')}>+3 body</button>
            <button class="opp" onclick={() => recordOpponent('opp_pts_1')}>+1 trestný</button>
            <button class="opp" onclick={() => openOppFoul('personal')}>+1 faul…</button>
            <button class="opp" onclick={() => openOppFoul('unsportsmanlike')}>Nesport.…</button>
            <button class="opp" onclick={() => openOppFoul('technical')} title="Technická chyba (i trenér/lavička) — zapíše se bez čísla">Technická</button>
            <button class="opp" onclick={() => recordOpponent('opp_reb_off')}>+ dosk útoč.</button>
            <button class="opp" onclick={() => recordOpponent('opp_reb_def')}>+ dosk obr.</button>
            <button class="opp" onclick={() => recordOpponent('opp_turnover')} title="Ztráta soupeře bez našeho zisku (kroky, aut, ofenzivní faul…)">Ztráta</button>
          </div>
        </section>
      </section>

      <section class="live-totals">
        <div class="lt-row">
          <div class="lt-label us">MY</div>
          {#if klokPouzitVZapase}
            <div class="lt-chip"><span class="lt-l">Min</span><span class="lt-v">{formatMinSec(teamTotals.minuty_ms)}</span></div>
          {/if}
          <div class="lt-chip"><span class="lt-l">PTS</span><span class="lt-v lt-pts">{teamTotals.body + teamUnattributed.body}</span></div>
          <div class="lt-chip"><span class="lt-l">2P</span><span class="lt-v">{teamTotals.dany_2}/{teamTotals.pokusy_2}</span></div>
          <div class="lt-chip"><span class="lt-l">3P</span><span class="lt-v">{teamTotals.dany_3}/{teamTotals.pokusy_3}</span></div>
          <div class="lt-chip"><span class="lt-l">FT</span><span class="lt-v">{teamTotals.dany_th}/{teamTotals.pokusy_th}</span></div>
          {#if teamUnattributed.body > 0}
            <div class="lt-chip" title={`Body bez hráče: 2P=${teamUnattributed.body_2}, 3P=${teamUnattributed.body_3}, FT=${teamUnattributed.body_th}`}>
              <span class="lt-l">Bez hr.</span><span class="lt-v">+{teamUnattributed.body}</span>
            </div>
          {/if}
          <div class="lt-chip"><span class="lt-l">OFF</span><span class="lt-v">{teamTotals.doskoky_off}</span></div>
          <div class="lt-chip"><span class="lt-l">DEF</span><span class="lt-v">{teamTotals.doskoky_def}</span></div>
          <div class="lt-chip"><span class="lt-l">REB</span><span class="lt-v">{teamTotals.doskoky_off + teamTotals.doskoky_def}</span></div>
          <div class="lt-chip"><span class="lt-l">AST</span><span class="lt-v">{teamTotals.asistence}</span></div>
          <div class="lt-chip"><span class="lt-l">STL</span><span class="lt-v">{teamTotals.zisky}</span></div>
          <div class="lt-chip"><span class="lt-l">TO</span><span class="lt-v">{teamTotals.ztraty + teamUnattributed.ztraty}</span></div>
          <div class="lt-chip"><span class="lt-l">BLK</span><span class="lt-v">{teamTotals.bloky}</span></div>
          <div class="lt-chip"><span class="lt-l">PF</span><span class="lt-v">{teamTotals.fauly}</span></div>
          {#if benchTechCount > 0}
            <div class="lt-chip" title="Technické chyby lavičky/trenéra"><span class="lt-l">T. lav.</span><span class="lt-v">{benchTechCount}</span></div>
          {/if}
          <div class="lt-chip to-chip" title={`Oddechy MY — zbývá ${toMyZbyva}/${toPovoleno} v ${toObdobi}, celkem v zápase ${toMyCelkem}`}>
            <span class="lt-l">⏱ TO</span>
            <span class="lt-v">{toMyZbyva}/{toPovoleno}</span>
          </div>
        </div>
        <div class="lt-row">
          <div class="lt-label them">SOUPEŘ</div>
          <div class="lt-chip"><span class="lt-l">PTS</span><span class="lt-v lt-pts">{oppTotals.body}</span></div>
          <div class="lt-chip"><span class="lt-l">2P</span><span class="lt-v">{oppTotals.body_2}</span></div>
          <div class="lt-chip"><span class="lt-l">3P</span><span class="lt-v">{oppTotals.body_3}</span></div>
          <div class="lt-chip"><span class="lt-l">FT</span><span class="lt-v">{oppTotals.body_th}</span></div>
          <div class="lt-chip"><span class="lt-l">OFF</span><span class="lt-v">{oppTotals.doskoky_off}</span></div>
          <div class="lt-chip"><span class="lt-l">DEF</span><span class="lt-v">{oppTotals.doskoky_def}</span></div>
          <div class="lt-chip"><span class="lt-l">REB</span><span class="lt-v">{oppTotals.doskoky_off + oppTotals.doskoky_def + oppTotals.doskoky_neznamy}</span></div>
          <div class="lt-chip"><span class="lt-l">TO</span><span class="lt-v">{oppTotals.ztraty}</span></div>
          <div class="lt-chip"><span class="lt-l">PF</span><span class="lt-v">{oppTotals.fauly}</span></div>
          {#if oppTotals.doskoky_neznamy > 0}
            <div class="lt-chip" title="Doskoky bez určení směru (z dřívějších verzí)"><span class="lt-l">REB?</span><span class="lt-v">{oppTotals.doskoky_neznamy}</span></div>
          {/if}
          <div class="lt-chip to-chip" title={`Oddechy SOUPEŘ — zbývá ${toOppZbyva}/${toPovoleno} v ${toObdobi}, celkem v zápase ${toOppCelkem}`}>
            <span class="lt-l">⏱ TO</span>
            <span class="lt-v">{toOppZbyva}/{toPovoleno}</span>
          </div>
        </div>
        {#if oppFaulyPerCisloMap.size > 0}
          <div class="lt-row opp-fauly-row">
            <div class="lt-label them">PF #</div>
            {#each [...oppFaulyPerCisloMap.entries()].sort((a, b) => a[0] - b[0]) as [cislo, n] (cislo)}
              <div class="lt-chip opp-fa-chip"><span class="lt-l">#{cislo}</span><span class="lt-v">F{n}</span></div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="vyvoj-skore-live">
        <button class="vsl-toggle" onclick={() => (vyvojGrafLiveOpen = !vyvojGrafLiveOpen)}>
          📈 Vývoj skóre <span class="vsl-arrow">{vyvojGrafLiveOpen ? '▲' : '▼'}</span>
        </button>
        {#if vyvojGrafLiveOpen}
          <div class="vsl-body">
            <SkoreVyvojGraf {udalosti} {pocetCtvrtin} />
          </div>
        {/if}
      </section>

      <section class="timeouts">
        <div class="to-info">Oddechy — aktuální období: <strong>{toObdobi}</strong> (max {toPovoleno})</div>
        <div class="to-buttons">
          <button
            class="to-btn us"
            disabled={toMyZbyva === 0}
            onclick={() => recordOddech('oddech_my')}
            title={`MY: použito ${toMyPouzite}/${toPovoleno} v ${toObdobi}. Celkem ${toMyCelkem} v zápase.`}
          >
            <span class="to-team">⏱ MY</span>
            <span class="to-zbyva">Zbývá <strong>{toMyZbyva}</strong> z {toPovoleno}</span>
            <span class="to-celkem">v zápase použito: {toMyCelkem}</span>
          </button>
          <button
            class="to-btn them"
            disabled={toOppZbyva === 0}
            onclick={() => recordOddech('oddech_opp')}
            title={`SOUPEŘ: použito ${toOppPouzite}/${toPovoleno} v ${toObdobi}. Celkem ${toOppCelkem} v zápase.`}
          >
            <span class="to-team">⏱ SOUPEŘ</span>
            <span class="to-zbyva">Zbývá <strong>{toOppZbyva}</strong> z {toPovoleno}</span>
            <span class="to-celkem">v zápase použito: {toOppCelkem}</span>
          </button>
        </div>
      </section>

      {#if lavicka.length > 0}
        <section class="bench-strip">
          <span class="bs-label">ŠATNA</span>
          <span class="bs-list">
            {#each lavicka as h, i (h.id)}
              {@const fouledOut = jeFouledOut(udalosti, h.id)}
              {@const fauly = pocetFauluZobr(h.id)}
              {#if i > 0}<span class="bs-sep">·</span>{/if}
              <span class="bs-item" class:fouled-out={fouledOut} title={`${h.jmeno} ${h.prijmeni}${fouledOut ? ' (vyloučen)' : ''}`}>
                #{h.cislo_dresu ?? '?'} {h.prijmeni}{#if fauly > 0}<span class="bs-f">{fouledOut ? ' DQ' : ` ${fauly}F`}</span>{/if}
              </span>
            {/each}
          </span>
        </section>
      {/if}

      <footer class="foot">
        <button class="primary" onclick={endQuarter}>Konec {fmtQ(aktualniCtvrtinaCislo)}</button>
        <div class="spacer"></div>
        <button class="danger" onclick={ukoncitZapas}>Ukončit zápas</button>
      </footer>

    {:else if mode === 'quarterEndPrompt'}
      <section class="prompt">
        <h2>Konec {fmtQ(ctvrtiny[ctvrtiny.length - 1]?.cislo ?? pocetCtvrtin)}</h2>
        <div class="score-big">{skore.nase} : {skore.souper}</div>
        {#if skore.nase === skore.souper}
          <p class="info">Stav je nerozhodný — můžeš pokračovat do prodloužení.</p>
          <div class="prompt-buttons">
            <button class="primary big" onclick={pokracovatOT}>Pokračovat do {fmtQ(aktualniCtvrtinaCislo)}</button>
            <button class="big" onclick={ukoncitZapas}>Ukončit jako remízu</button>
          </div>
        {:else}
          <p class="info">Zápas je rozhodnutý.</p>
          <div class="prompt-buttons">
            <button class="primary big" onclick={ukoncitZapas}>Ukončit zápas</button>
            <button class="big" onclick={pokracovatOT}>Pokračovat do prodloužení</button>
          </div>
        {/if}
      </section>

    {:else if mode === 'matchEnd'}
      <section class="match-end-banner">
        <div class="me-result-wrap">
          <div class="me-title">Zápas ukončen</div>
          <div
            class="me-pill"
            class:vyhra={skore.nase > skore.souper}
            class:prohra={skore.nase < skore.souper}
            class:remiza={skore.nase === skore.souper}
          >
            {#if skore.nase > skore.souper}Výhra
            {:else if skore.nase < skore.souper}Prohra
            {:else}Remíza
            {/if}
          </div>
        </div>
        <div class="me-score-big">{skore.nase} : {skore.souper}</div>
      </section>

      <section class="score-edit">
        <header class="se-head">
          <h3>Úprava skóre</h3>
          <span class="se-hint">Pokud semafor nesouhlasí, doplň body jako korekci „Bez hráče" v poslední Q.</span>
        </header>
        <div class="se-grid">
          {#each KOREKCE_STRANY as strana (strana)}
            <div class="se-strana" class:opp={strana === 'opp'}>
              <div class="se-label">{korekceLabelStrana(strana)}</div>
              <div class="se-buttons">
                {#each KOREKCE_BODY as body (body)}
                  <button
                    class="se-btn se-plus"
                    type="button"
                    onclick={() => addKorekce(strana, body)}
                  >+{body}</button>
                {/each}
              </div>
              <div class="se-buttons">
                {#each KOREKCE_BODY as body (body)}
                  <button
                    class="se-btn se-minus"
                    type="button"
                    disabled={!maKorekci(strana, body)}
                    onclick={() => removeKorekce(strana, body)}
                  >−{body}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>

      <section class="boxscore">
        <header class="bs-head">
          <h3>Boxscore — My ({kategorieLabel(zapas.nase_kategorie)})</h3>
          <span class="bs-hint">{periodKlokPouzit ? 'Stopky aktivní' : 'Stopky nebyly použité — minuty se nepočítají'}</span>
        </header>
        <div class="period-tabs">
          <button
            class="period-tab"
            class:active={selectedPeriod === 'total'}
            onclick={() => (selectedPeriod = 'total')}
          >Celkem</button>
          {#each dostupneCtvrtiny as q (q)}
            <button
              class="period-tab"
              class:active={selectedPeriod === q}
              onclick={() => (selectedPeriod = q)}
            >{fmtQ(q)}</button>
          {/each}
        </div>
        <div class="bs-scroll">
          <table class="bs-table">
            <thead>
              <tr>
                <th class="th-sticky" colspan="2">Hráč</th>
                <th title="Minuty na hřišti">Min</th>
                <th title="Body">PTS</th>
                <th title="2 body daný/pokus">2P</th>
                <th title="3 body daný/pokus">3P</th>
                <th title="Trestné daný/pokus">FT</th>
                <th title="Doskok útočný">OFF</th>
                <th title="Doskok obranný">DEF</th>
                <th title="Doskoky celkem (OFF+DEF)">REB</th>
                <th title="Asistence">AST</th>
                <th title="Zisky / steals">STL</th>
                <th title="Ztráty / turnovers">TO</th>
                <th title="Bloky">BLK</th>
                <th title="Osobní fauly">PF</th>
                <th title="Plus/minus">+/-</th>
                <th title="Efficiency = PTS + REB + AST + STL + BLK − miss − TO">EFF</th>
              </tr>
            </thead>
            <tbody>
              {#each hraciSerazeni as h (h.id)}
                {@const s = statHrace(h.id)}
                {@const fo = jeFouledOut(udalosti, h.id)}
                <tr class:foulout={fo}>
                  <td class="td-num">{h.cislo_dresu ?? '?'}</td>
                  <td class="td-name">
                    <span class="bs-name">{h.prijmeni} {h.jmeno}</span>
                    {#if fo}<span class="bs-tag-fo">FO</span>{/if}
                  </td>
                  <td class="td-mono">{periodKlokPouzit ? formatMinSec(s.minuty_ms) : '—'}</td>
                  <td class="td-mono td-pts">{s.body}</td>
                  <td class="td-mono">{s.dany_2}/{s.pokusy_2}</td>
                  <td class="td-mono">{s.dany_3}/{s.pokusy_3}</td>
                  <td class="td-mono">{s.dany_th}/{s.pokusy_th}</td>
                  <td class="td-mono">{s.doskoky_off}</td>
                  <td class="td-mono">{s.doskoky_def}</td>
                  <td class="td-mono">{s.doskoky_off + s.doskoky_def}</td>
                  <td class="td-mono">{s.asistence}</td>
                  <td class="td-mono">{s.zisky}</td>
                  <td class="td-mono">{s.ztraty}</td>
                  <td class="td-mono">{s.bloky}</td>
                  <td class="td-mono">{s.fauly}</td>
                  <td class="td-mono td-pm" class:pm-plus={s.plus_minus > 0} class:pm-minus={s.plus_minus < 0}>{formatPlusMinus(s.plus_minus)}</td>
                  <td class="td-mono td-eff">{s.efficiency}</td>
                </tr>
              {/each}
              {#if periodTeamUnattributed.body > 0 || periodTeamUnattributed.ztraty > 0}
                <tr class="row-bez-hrace">
                  <td colspan="2" class="td-name td-bezhrace">Bez hráče</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono td-pts">{periodTeamUnattributed.body}</td>
                  <td class="td-mono" title="2-bodové koše bez hráče">{periodTeamUnattributed.body_2}</td>
                  <td class="td-mono" title="3-bodové koše bez hráče">{periodTeamUnattributed.body_3}</td>
                  <td class="td-mono" title="Trestné body bez hráče">{periodTeamUnattributed.body_th}</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono" title="Týmové ztráty bez hráče">{periodTeamUnattributed.ztraty || '—'}</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                  <td class="td-mono">—</td>
                </tr>
              {/if}
              <tr class="row-total">
                <td colspan="2" class="td-name">TÝM</td>
                <td class="td-mono">{periodKlokPouzit ? formatMinSec(periodTeamTotals.minuty_ms) : '—'}</td>
                <td class="td-mono td-pts">{periodTeamTotals.body + periodTeamUnattributed.body}</td>
                <td class="td-mono">{periodTeamTotals.dany_2}/{periodTeamTotals.pokusy_2}</td>
                <td class="td-mono">{periodTeamTotals.dany_3}/{periodTeamTotals.pokusy_3}</td>
                <td class="td-mono">{periodTeamTotals.dany_th}/{periodTeamTotals.pokusy_th}</td>
                <td class="td-mono">{periodTeamTotals.doskoky_off}</td>
                <td class="td-mono">{periodTeamTotals.doskoky_def}</td>
                <td class="td-mono">{periodTeamTotals.doskoky_off + periodTeamTotals.doskoky_def}</td>
                <td class="td-mono">{periodTeamTotals.asistence}</td>
                <td class="td-mono">{periodTeamTotals.zisky}</td>
                <td class="td-mono">{periodTeamTotals.ztraty + periodTeamUnattributed.ztraty}</td>
                <td class="td-mono">{periodTeamTotals.bloky}</td>
                <td class="td-mono">{periodTeamTotals.fauly}</td>
                <td class="td-mono">—</td>
                <td class="td-mono td-eff">{periodTeamTotals.efficiency}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="vyvoj-skore">
        <header class="vs-head">
          <h3>Vývoj skóre {selectedPeriod === 'total' ? '— celý zápas' : `— ${fmtQ(selectedPeriod)}`}</h3>
        </header>
        <SkoreVyvojGraf udalosti={periodUdalosti} {pocetCtvrtin} />
      </section>

      <section class="prirazeni">
        <button class="prirazeni-toggle" onclick={() => (prirazovaniOpen = !prirazovaniOpen)}>
          ✏️ Opravit / přiřadit akce (kdo dal koš, čí ztráta) <span class="pt-arrow">{prirazovaniOpen ? '▲' : '▼'}</span>
        </button>
        {#if prirazovaniOpen}
          <div class="prirazeni-body">
            <p class="prirazeni-hint">
              Uprav hráče u koše / trestného / ztráty. <strong>„— bez hráče —"</strong> = týmová (nepřičte se nikomu). Body se nemění, jen se přesunou ke správnému hráči.{selectedPeriod === 'total' ? '' : ' (Filtrováno na vybranou čtvrtinu.)'}
            </p>
            {#if prirazovatelne.length === 0}
              <p class="prirazeni-empty">Žádné koše ani ztráty k přiřazení.</p>
            {:else}
              <div class="prirazeni-list">
                {#each prirazovatelne as ev (ev.id)}
                  <div class="prirazeni-row" class:bezhrace={ev.hrac_id === null}>
                    <span class="pr-q">{fmtQ(ev.ctvrtina_cislo)}</span>
                    <span class="pr-akce">{reassignPopis(ev.typ)}</span>
                    <select
                      class="pr-select"
                      value={ev.hrac_id ?? ''}
                      onchange={(e) => reassignEvent(ev, e.currentTarget.value || null)}
                    >
                      <option value="">— bez hráče —</option>
                      {#each hraciSerazeni as h (h.id)}
                        <option value={h.id}>#{h.cislo_dresu ?? '?'} {h.prijmeni}</option>
                      {/each}
                    </select>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <section class="opp-summary">
        <h3>Soupeř — {souper.nazev} {selectedPeriod === 'total' ? '' : `(${fmtQ(selectedPeriod as number)})`}</h3>
        <div class="opp-grid">
          <div class="opp-item"><span class="opp-l">PTS</span><span class="opp-v">{periodOppTotals.body}</span></div>
          <div class="opp-item"><span class="opp-l">2P košů</span><span class="opp-v">{periodOppTotals.body_2}</span></div>
          <div class="opp-item"><span class="opp-l">3P košů</span><span class="opp-v">{periodOppTotals.body_3}</span></div>
          <div class="opp-item"><span class="opp-l">Trestné</span><span class="opp-v">{periodOppTotals.body_th}</span></div>
          <div class="opp-item"><span class="opp-l">Fauly</span><span class="opp-v">{periodOppTotals.fauly}</span></div>
          <div class="opp-item"><span class="opp-l">Doskok OFF</span><span class="opp-v">{periodOppTotals.doskoky_off}</span></div>
          <div class="opp-item"><span class="opp-l">Doskok DEF</span><span class="opp-v">{periodOppTotals.doskoky_def}</span></div>
          <div class="opp-item"><span class="opp-l">Doskoky celkem</span><span class="opp-v">{periodOppTotals.doskoky_off + periodOppTotals.doskoky_def + periodOppTotals.doskoky_neznamy}</span></div>
          <div class="opp-item"><span class="opp-l">Ztráty</span><span class="opp-v">{periodOppTotals.ztraty}</span></div>
          {#if periodOppTotals.doskoky_neznamy > 0}
            <div class="opp-item"><span class="opp-l">Doskok ?</span><span class="opp-v">{periodOppTotals.doskoky_neznamy}</span></div>
          {/if}
        </div>
        {#if periodOppStatsPerCisloMap.size > 0 || periodOppBezCisla.body + periodOppBezCisla.fauly + periodOppBezCisla.doskoky > 0}
          <div class="opp-fauly-summary">
            <div class="opp-fa-title">Statistiky soupeře po hráčích</div>
            <table class="opp-perhrac-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jméno</th>
                  <th class="th-mono" title="Body celkem">PTS</th>
                  <th class="th-mono" title="Body z 2P košů">2P</th>
                  <th class="th-mono" title="Body z 3P košů">3P</th>
                  <th class="th-mono" title="Body z trestných">FT</th>
                  <th class="th-mono" title="Útočný doskok">OFF</th>
                  <th class="th-mono" title="Obranný doskok">DEF</th>
                  <th class="th-mono" title="Doskoky celkem">REB</th>
                  <th class="th-mono" title="Osobní fauly">PF</th>
                </tr>
              </thead>
              <tbody>
                {#each [...periodOppStatsPerCisloMap.entries()].sort((a, b) => b[1].body - a[1].body || a[0] - b[0]) as [cislo, st] (cislo)}
                  {@const oh = souper.hraci_soupere?.find((h) => h.cislo === cislo)}
                  <tr>
                    <td class="td-mono">#{cislo}</td>
                    <td>{oh?.prijmeni ?? ''}</td>
                    <td class="td-mono"><strong>{st.body}</strong></td>
                    <td class="td-mono">{st.body_2}</td>
                    <td class="td-mono">{st.body_3}</td>
                    <td class="td-mono">{st.body_th}</td>
                    <td class="td-mono">{st.doskoky_off}</td>
                    <td class="td-mono">{st.doskoky_def}</td>
                    <td class="td-mono">{st.doskoky}</td>
                    <td class="td-mono">{st.fauly}</td>
                  </tr>
                {/each}
                {#if periodOppBezCisla.body + periodOppBezCisla.fauly + periodOppBezCisla.doskoky > 0}
                  <tr class="opp-bez-cisla">
                    <td class="td-mono">—</td>
                    <td><em>Bez čísla hráče</em></td>
                    <td class="td-mono"><strong>{periodOppBezCisla.body}</strong></td>
                    <td class="td-mono">{periodOppBezCisla.body_2}</td>
                    <td class="td-mono">{periodOppBezCisla.body_3}</td>
                    <td class="td-mono">{periodOppBezCisla.body_th}</td>
                    <td class="td-mono">{periodOppBezCisla.doskoky_off}</td>
                    <td class="td-mono">{periodOppBezCisla.doskoky_def}</td>
                    <td class="td-mono">{periodOppBezCisla.doskoky}</td>
                    <td class="td-mono">{periodOppBezCisla.fauly}</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        {/if}
        {#if periodBenchTechCount > 0}
          <div class="opp-fa-bench">Naše technické chyby lavičky: <strong>{periodBenchTechCount}</strong></div>
        {/if}
      </section>

      <section class="me-actions">
        <button class="primary big" onclick={onBack}>Zpět na seznam zápasů</button>
      </section>
    {/if}

    <div class="toasts">
      {#each toasts as t (t.id)}
        <div class="toast">{t.msg}</div>
      {/each}
    </div>

    {#if subModal}
      <div class="modal-bg" onclick={closeSub} role="presentation">
        <div class="modal sub-modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Střídání — {fmtQ(aktualniCtvrtinaCislo)}</h2>
          <p class="sub-hint">Vyber stejný počet hráčů ven (z hřiště) a dovnitř (z lavičky). Sparování proběhne podle pořadí výběru.</p>
          <div class="sub-counters">
            <span class="sub-counter" class:ok={subOuts.length > 0 && subOuts.length === subIns.length}>
              Ven: <strong>{subOuts.length}</strong>
            </span>
            <span class="sub-counter" class:ok={subIns.length > 0 && subOuts.length === subIns.length}>
              Dovnitř: <strong>{subIns.length}</strong>
            </span>
            {#if subOuts.length !== subIns.length}
              <span class="sub-warn">⚠ Počty se musí rovnat</span>
            {/if}
          </div>
          <div class="sub-grid">
            <div>
              <h3>Ven (z hřiště)</h3>
              <div class="sub-list">
                {#each naHristi as h (h.id)}
                  {@const idx = subOuts.indexOf(h.id)}
                  <button class="sub-card" class:selected={idx >= 0} onclick={() => toggleSubOut(h.id)}>
                    <Avatar foto={h.foto} cislo={h.cislo_dresu} size={SUB_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
                    <span class="name">#{h.cislo_dresu ?? '?'} {h.prijmeni}</span>
                    {#if idx >= 0}<span class="sub-order">{idx + 1}</span>{/if}
                  </button>
                {/each}
              </div>
            </div>
            <div>
              <h3>Dovnitř (z lavičky)</h3>
              <div class="sub-list">
                {#each lavicka as h (h.id)}
                  {@const fouledOut = jeFouledOut(udalosti, h.id)}
                  {@const idx = subIns.indexOf(h.id)}
                  <button
                    class="sub-card"
                    class:selected={idx >= 0}
                    class:disabled={fouledOut}
                    disabled={fouledOut}
                    onclick={() => toggleSubIn(h.id)}
                  >
                    <Avatar foto={h.foto} cislo={h.cislo_dresu} size={SUB_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
                    <span class="name">#{h.cislo_dresu ?? '?'} {h.prijmeni}</span>
                    {#if idx >= 0}<span class="sub-order">{idx + 1}</span>{/if}
                    {#if fouledOut}<span class="fouled-tag">VYLOUČEN</span>{/if}
                  </button>
                {/each}
              </div>
            </div>
          </div>
          <div class="modal-buttons">
            <button onclick={closeSub}>Zrušit</button>
            <button class="primary" disabled={subOuts.length === 0 || subOuts.length !== subIns.length} onclick={confirmSub}>
              {#if subOuts.length > 1}Provést {subOuts.length} střídání{:else}Provést střídání{/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if warning}
      <div class="modal-bg" onclick={() => warning = null} role="presentation">
        <div class="modal warning" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>⚠️ Upozornění</h2>
          <p class="warning-msg">{warning.msg}</p>
          <div class="modal-buttons">
            <button onclick={() => warning = null}>Zrušit</button>
            {#if warning.onConfirm}
              <button class="danger" onclick={() => { warning?.onConfirm?.(); warning = null; }}>Pokračovat (porušit pravidlo)</button>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if setTimeModal}
      <div class="modal-bg" onclick={() => setTimeModal = false} role="presentation">
        <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Nastavit čas v {fmtQ(aktualniCtvrtinaCislo)}</h2>
          <p class="warning-msg">Zadej aktuální čas ve formátu <strong>MM:SS</strong> (např. 4:23). Stopky se nastaví na tuto hodnotu a budou pozastaveny — pak je můžeš znovu spustit tlačítkem Start.</p>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="settime-input"
            bind:value={setTimeInput}
            type="text"
            placeholder="MM:SS"
            inputmode="numeric"
            autofocus
            onkeydown={(e) => e.key === 'Enter' && confirmSetTime()}
          />
          <div class="modal-buttons">
            <button onclick={() => setTimeModal = false}>Zrušit</button>
            <button class="primary" onclick={confirmSetTime}>Nastavit</button>
          </div>
        </div>
      </div>
    {/if}

    {#if setQModal}
      <div class="modal-bg" onclick={() => setQModal = false} role="presentation">
        <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Nastavit číslo čtvrtiny</h2>
          <p class="warning-msg">
            Aktuálně {fmtQ(aktualniCtvrtinaCislo)}. Zadej správné číslo čtvrtiny (např. <strong>2</strong> pro Q2, <strong>{pocetCtvrtin + 1}</strong> pro OT1).
            {#if udalosti.some((u) => u.ctvrtina_cislo === aktualniCtvrtinaCislo)}
              <br /><strong>Pozor:</strong> v této Q už jsou zaznamenané akce — místo přejmenování se aktuální Q uzavře a od teď začne nová Q se stejnou pěticí. Minulé akce zůstanou v {fmtQ(aktualniCtvrtinaCislo)}.
            {:else}
              <br />V této Q ještě nejsou žádné akce, takže se jen přejmenuje.
            {/if}
            <br />Změnu lze vrátit tlačítkem <em>Vrátit poslední akci</em>.
          </p>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="settime-input"
            bind:value={setQInput}
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            autofocus
            onkeydown={(e) => e.key === 'Enter' && confirmSetQ()}
          />
          <div class="modal-buttons">
            <button onclick={() => setQModal = false}>Zrušit</button>
            <button class="primary" onclick={confirmSetQ}>Nastavit</button>
          </div>
        </div>
      </div>
    {/if}

    {#if foulOutPrompt}
      {@const fp = hraci.find(h => h.id === foulOutPrompt!.playerId)}
      <div class="modal-bg" role="presentation">
        <div class="modal warning" role="presentation">
          <h2>🟥 Foul-out (5 osobních faulů)</h2>
          <p class="warning-msg">
            #{fp?.cislo_dresu ?? '?'} {fp?.prijmeni} dosáhl 5 osobních faulů a musí být vystřídán.
            Nemůže pokračovat v zápase.
          </p>
          <div class="modal-buttons">
            <button class="primary" onclick={() => foulOutSub(foulOutPrompt!.playerId)}>Provést střídání</button>
          </div>
        </div>
      </div>
    {/if}

    {#if editRosterOpen && zapas}
      <div class="modal-bg" onclick={() => (editRosterOpen = false)} role="presentation">
        <div class="modal roster-modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <div class="roster-header">
            <h2>Upravit soupisku — {kategorieLabel(zapas.nase_kategorie)}</h2>
            <button class="small" onclick={() => (editRosterHracFormOpen = true)}>+ Nový hráč</button>
          </div>
          <p class="roster-hint">
            Vybráno {editRosterSelected.length} hráčů. Kategorie {kategorieLabel(zapas.nase_kategorie)} a starší. Lze upravovat jen před Q1.
          </p>
          {#if editRosterAllHraci.length === 0}
            <div class="roster-empty">Žádní oprávnění hráči. Klikni "+ Nový hráč".</div>
          {:else}
            <div class="roster-list">
              {#each editRosterAllHraci as h (h.id)}
                <label class="roster-row" class:checked={editRosterSelected.includes(h.id)}>
                  <input
                    type="checkbox"
                    checked={editRosterSelected.includes(h.id)}
                    onchange={() => toggleEditRoster(h.id)}
                  />
                  <Avatar foto={h.foto} cislo={h.cislo_dresu} size={SUB_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
                  <div class="roster-info">
                    <div class="roster-name">#{h.cislo_dresu ?? '?'} {h.jmeno} {h.prijmeni}</div>
                    <div class="roster-meta">{kategorieLabel(h.domaci_kategorie)}{h.pozice ? ` · ${h.pozice}` : ''}</div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
          {#if editRosterChyba}
            <div class="roster-chyba">{editRosterChyba}</div>
          {/if}
          <div class="modal-buttons">
            <button onclick={() => (editRosterOpen = false)}>Zrušit</button>
            <button class="primary" onclick={ulozEditRoster}>Uložit soupisku</button>
          </div>
        </div>
      </div>
    {/if}

    {#if editRosterHracFormOpen}
      <HracForm onClose={() => (editRosterHracFormOpen = false)} onSaved={poNovemHraci} />
    {/if}

    {#if foulSubtypePicker}
      {@const fp = hraci.find((h) => h.id === foulSubtypePicker!.playerId)}
      <div class="modal-bg" onclick={() => (foulSubtypePicker = null)} role="presentation">
        <div class="modal foul-subtyp-modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Typ faulu — #{fp?.cislo_dresu ?? '?'} {fp?.prijmeni}</h2>
          <div class="foul-subtyp-buttons">
            <button class="primary" onclick={() => recordFoul('personal')}>Osobní</button>
            <button onclick={() => recordFoul('unsportsmanlike')}>Nesportovní</button>
            <button onclick={() => recordFoul('technical')}>Technická</button>
          </div>
          <div class="modal-buttons">
            <button onclick={() => (foulSubtypePicker = null)}>Zrušit</button>
          </div>
        </div>
      </div>
    {/if}

    {#if oppFoulPicker && souper}
      <div class="modal-bg" onclick={() => (oppFoulPicker = null)} role="presentation">
        <div class="modal opp-foul-modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Faul soupeře ({foulSubtypLabel(oppFoulPicker)}) — {souper.nazev}</h2>
          {#if souper.hraci_soupere && souper.hraci_soupere.length > 0}
            <p class="roster-hint">Vyber číslo hráče soupeře:</p>
            <div class="opp-numbers-grid">
              {#each souper.hraci_soupere.slice().sort((a, b) => a.cislo - b.cislo) as oh (oh.cislo)}
                {@const aktualni = oppFaulyPerCisloMap.get(oh.cislo) ?? 0}
                <button class="opp-num-btn" onclick={() => recordOppFoul(oh.cislo, oppFoulPicker ?? 'personal')} title={`${oh.jmeno ?? ''} ${oh.prijmeni ?? ''}`.trim() || `#${oh.cislo}`}>
                  <span class="opp-num">#{oh.cislo}</span>
                  {#if oh.prijmeni}<span class="opp-pr">{oh.prijmeni}</span>{/if}
                  {#if aktualni > 0}<span class="opp-fa">F{aktualni}</span>{/if}
                </button>
              {/each}
            </div>
          {:else}
            <p class="roster-hint">Soupiska soupeře není vyplněna.</p>
          {/if}
          <div class="modal-buttons">
            <button onclick={() => recordOppFoul(undefined, oppFoulPicker ?? 'personal')}>Bez určení čísla</button>
            <button onclick={() => (oppFoulPicker = null)}>Zrušit</button>
          </div>
        </div>
      </div>
    {/if}

    {#if oppRosterEditOpen && souper}
      <div class="modal-bg" onclick={() => (oppRosterEditOpen = false)} role="presentation">
        <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Soupiska soupeře — {souper.nazev}</h2>
          <p class="roster-hint">Přidat / upravit / smazat čísla a jména. Změny se uloží k soupeři a propíšou se i do budoucích zápasů.</p>
          <div class="opp-edit-actions">
            <button type="button" class="small" onclick={() => (oppRosterBulkOpen = !oppRosterBulkOpen)}>
              {oppRosterBulkOpen ? '× Zrušit hromadné' : '⎘ Hromadně přidat'}
            </button>
            <button type="button" class="small" onclick={addOppRosterRow}>+ Přidat hráče</button>
          </div>
          {#if oppRosterBulkOpen}
            <div class="opp-bulk">
              <div class="bulk-hint">Čárkou, středníkem nebo enterem oddělená čísla (např. <code>5, 8, 12</code>) nebo <code>číslo jméno [příjmení]</code> per řádek. Přidá k stávajícím (duplicitní čísla přeskočí).</div>
              <textarea bind:value={oppRosterBulkText} rows="5" placeholder="5, 8, 12, 14"></textarea>
              <button type="button" class="primary small" onclick={parseOppRosterBulk}>Přidat</button>
            </div>
          {/if}
          {#if oppRosterDraft.length === 0}
            <div class="roster-empty">Soupiska je prázdná. Klikni "+ Přidat hráče" nebo "⎘ Hromadně přidat".</div>
          {:else}
            <div class="opp-edit-list">
              {#each oppRosterDraft as h, i (i)}
                <div class="opp-edit-row">
                  <input bind:value={h.cislo} type="number" min="0" max="99" placeholder="#" class="opp-edit-num" />
                  <input bind:value={h.jmeno} type="text" placeholder="Jméno (volitelné)" />
                  <input bind:value={h.prijmeni} type="text" placeholder="Příjmení (volitelné)" />
                  <button type="button" class="danger small" onclick={() => removeOppRosterRow(i)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if oppRosterChyba}
            <div class="roster-chyba">{oppRosterChyba}</div>
          {/if}
          <div class="modal-buttons">
            <button onclick={() => (oppRosterEditOpen = false)}>Zrušit</button>
            <button class="primary" onclick={saveOppRoster}>Uložit</button>
          </div>
        </div>
      </div>
    {/if}

    {#if toBeziDo !== null}
      <div class="to-countdown" class:done={toDobehl} role="status" aria-live="polite">
        <div class="toc-label">{toTyp === 'oddech_my' ? '⏱ Oddech — MY' : '⏱ Oddech — SOUPEŘ'}</div>
        <div class="toc-time">{toDobehl ? 'Oddech skončil' : formatCas(toZbyvaMs)}</div>
        <button class="toc-end" onclick={ukoncitOddech}>
          {toDobehl ? 'Zavřít' : '⏹ Konec oddechu'}
        </button>
      </div>
    {/if}

    {#if activeGesture && activeGesture.mode === 'radial'}
      <div class="radial-overlay two-ring" class:has-active={radialActive !== null} style="left: {activeGesture.cardCx}px; top: {activeGesture.cardCy}px;" aria-hidden="true">
        <svg
          class="radial-svg"
          width={RADIAL_VIEWBOX_PX * 2}
          height={RADIAL_VIEWBOX_PX * 2}
          viewBox="{-RADIAL_VIEWBOX_PX} {-RADIAL_VIEWBOX_PX} {RADIAL_VIEWBOX_PX * 2} {RADIAL_VIEWBOX_PX * 2}"
        >
          <defs>
            <radialGradient id="radialGloss" cx="50%" cy="30%" r="68%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.5)" />
              <stop offset="50%" stop-color="rgba(255,255,255,0.1)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0)" />
            </radialGradient>
            <filter id="wedgeShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.5)" />
            </filter>
          </defs>
          <g filter="url(#wedgeShadow)">
            {#each RADIAL_INNER_SEGMENTS as seg, i (seg.typ)}
              <path
                class="wedge tone-{seg.tone}"
                class:active={radialActive?.ring === 'inner' && radialActive.idx === i}
                d={radialWedgePath(-90 + i * 45, 45, RADIAL_INNER_BAND_RIN, RADIAL_INNER_BAND_ROUT)}
              />
            {/each}
            {#each RADIAL_OUTER_SEGMENTS as seg, i (seg.typ)}
              <path
                class="wedge tone-{seg.tone}"
                class:active={radialActive?.ring === 'outer' && radialActive.idx === i}
                d={radialWedgePath(-90 + i * 72, 72, RADIAL_OUTER_BAND_RIN, RADIAL_OUTER_BAND_ROUT)}
              />
            {/each}
          </g>
          <circle cx="0" cy="0" r={RADIAL_OUTER_BAND_ROUT} fill="url(#radialGloss)" pointer-events="none" />
        </svg>
        {#each RADIAL_INNER_SEGMENTS as seg, i (seg.typ)}
          {@const pos = radialInnerSegmentXY(i, RADIAL_INNER_RADIUS_PX)}
          <div
            class="radial-lbl"
            class:active={radialActive?.ring === 'inner' && radialActive.idx === i}
            style="transform: translate({pos.x}px, {pos.y}px);"
          >{seg.label}</div>
        {/each}
        {#each RADIAL_OUTER_SEGMENTS as seg, i (seg.typ)}
          {@const pos = radialOuterSegmentXY(i, RADIAL_OUTER_RADIUS_PX)}
          <div
            class="radial-lbl outer"
            class:active={radialActive?.ring === 'outer' && radialActive.idx === i}
            style="transform: translate({pos.x}px, {pos.y}px);"
          >{seg.label}</div>
        {/each}
        <div class="radial-readout" class:cancel={radialActive === null}>
          {radialActiveSeg ? popisAkce(radialActiveSeg.typ) : '× zrušit'}
        </div>
        <div class="radial-hint">táhni na akci · pusť pro zápis</div>
      </div>
    {/if}

    {#if actionGesture && actionGesture.mode === 'radial'}
      <div class="radial-overlay action-radial" class:has-active={actionRadialActiveIdx !== null} style="left: {actionGesture.btnCx}px; top: {actionGesture.btnCy}px;" aria-hidden="true">
        <div class="radial-hint">táhni na hráče · pusť pro zápis</div>
        {#if radialPlayers.length === 0}
          <div class="radial-empty">žádní hráči na hřišti</div>
        {:else}
          {#each radialPlayers as h, i (h.id)}
            {@const pos = actionRadialSegmentXY(i, radialPlayers.length, ACTION_RADIAL_RADIUS_PX)}
            <div
              class="player-seg"
              class:active={actionRadialActiveIdx === i}
              style="transform: translate({pos.x}px, {pos.y}px);"
            >
              <div class="player-seg-num">#{h.cislo_dresu ?? '?'}</div>
              <div class="player-seg-name">{h.prijmeni}</div>
            </div>
          {/each}
        {/if}
        <div class="radial-center" class:cancel={actionRadialActiveIdx === null}>{actionRadialActiveIdx === null ? '×' : '·'}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .loading {
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
  }

  .live-app {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: calc(100vh - 100px);
  }

  .head {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 18px;
    box-shadow: var(--shadow);
  }
  .back {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
  }
  .back:hover { background: var(--border-strong); color: var(--accent-fg); }
  .teams { font-size: 18px; font-weight: 700; }
  .teams .us { color: var(--us-color); }
  .teams .them { color: var(--them-color); }
  .teams .vs { color: var(--text-muted); margin: 0 8px; }
  .score-bar {
    position: sticky;
    top: 0;
    z-index: 60;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 12px;
    margin: 8px 0;
    padding: 8px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }
  .score-bar .sb-q {
    align-self: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
    background: var(--selected-bg);
    padding: 3px 10px;
    border-radius: 999px;
  }
  .score-bar .us-score { color: var(--us-color); font-size: 34px; font-weight: 800; font-family: "Consolas", monospace; }
  .score-bar .them-score { color: var(--them-color); font-size: 34px; font-weight: 800; font-family: "Consolas", monospace; }
  .score-bar .sep { color: var(--text-muted); font-size: 26px; }

  .undo-hint {
    flex-basis: 100%;
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed var(--border);
    font-size: 13px;
  }
  .undo-hint .uh-label { font-weight: 700; color: var(--warn); white-space: nowrap; }
  .undo-hint .uh-last { font-weight: 700; color: var(--text); }
  .undo-hint .uh-prev { color: var(--text-muted); font-size: 12px; }

  .quarter-scores {
    display: flex;
    gap: 10px;
    padding: 0 4px;
    flex-wrap: wrap;
  }
  .qs {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    display: flex;
    gap: 8px;
  }
  .qs-label { color: var(--text-muted); font-weight: 600; }
  .qs-score { font-family: "Consolas", monospace; font-weight: 700; color: var(--text); }

  .pick-lineup {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    box-shadow: var(--shadow);
  }
  .pick-lineup h2 {
    font-size: 20px;
    margin-bottom: 16px;
    color: var(--accent);
  }
  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  .lineup-buttons {
    display: flex;
    justify-content: center;
  }
  .big {
    padding: 14px 28px !important;
    font-size: 16px !important;
  }

  .live {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) 260px minmax(0, 1fr);
    gap: 12px;
    flex: 1;
  }
  @media (max-width: 1100px) {
    .live {
      grid-template-columns: minmax(0, 1fr) 240px;
    }
    .live > .opponent {
      grid-column: 1 / -1;
      order: 3;
    }
  }
  @media (max-width: 700px) {
    .live {
      grid-template-columns: 1fr;
    }
    .live > .opponent { grid-column: auto; }
  }
  .players-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    box-shadow: var(--shadow);
  }
  .pc-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    text-align: center;
    padding: 4px 0 2px;
  }
  .pc-mobile-hint {
    display: none;
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
    border-radius: 6px;
    padding: 6px 8px;
    text-align: center;
  }
  .pc-undo-row {
    display: none;
    align-items: stretch;
    gap: 8px;
  }
  .pc-undo-btn {
    flex: 0 0 auto;
    align-self: stretch;
    background: var(--surface-2);
    border: 1px solid var(--warn);
    color: var(--warn);
    border-radius: 6px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .pc-undo-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pc-recent-list {
    flex: 1 1 auto;
    min-width: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    justify-content: center;
  }
  .pc-recent-list li {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pc-recent-list li:first-child { color: var(--text); font-weight: 600; }
  .pc-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pc-card {
    background: var(--surface-2);
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.12s ease;
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .pc-card:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .pc-card.gesturing { background: var(--surface-hover); border-color: var(--accent); }
  .pc-card.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
    color: var(--selected-fg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  }
  .pc-info { display: flex; flex-direction: row; align-items: baseline; gap: 8px; flex: 1; min-width: 0; }
  .pc-num { font-family: "Consolas", monospace; font-weight: 800; font-size: 24px; line-height: 1; }
  .pc-name { font-size: 17px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-fauly {
    position: absolute;
    top: 4px;
    right: 8px;
    color: var(--warn);
    font-size: 11px;
    font-weight: 700;
  }
  .pc-sub-btn {
    margin-top: 6px;
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    border-radius: 8px;
    padding: 12px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .pc-sub-btn:hover { background: var(--accent-hover); }

  .bench-strip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    color: var(--text-muted);
  }
  .bs-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .bs-list { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .bs-item { color: var(--text); font-weight: 600; font-family: "Consolas", monospace; font-size: 12px; }
  .bs-item.fouled-out { color: var(--danger); opacity: 0.75; text-decoration: line-through; }
  .bs-f { color: var(--warn); font-weight: 700; margin-left: 2px; }
  .bs-sep { color: var(--text-muted); opacity: 0.5; }
  .player-card {
    background: var(--surface);
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 12px 8px;
    cursor: pointer;
    text-align: center;
    font-family: inherit;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .player-card .name { font-size: 13px; font-weight: 600; }
  .player-card .meta { font-size: 11px; color: var(--text-muted); }
  .player-card.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
    color: var(--selected-fg);
  }
  .player-card.selected .meta { color: var(--selected-fg); opacity: 0.85; }
  .player-card:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .player-card.disabled { opacity: 0.4; cursor: not-allowed; }
  .player-card .fouled {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--danger);
    color: var(--accent-fg);
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 2px;
    font-weight: 700;
  }

  .actions {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: var(--shadow);
  }
  .action-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .group-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 700;
    padding: 2px 2px 0;
  }
  .group-grid {
    display: grid;
    gap: 6px;
  }
  .group-grid.utok {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .group-grid.doskok {
    grid-template-columns: 1fr 1fr;
  }
  .group-grid.pozit {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .group-grid.negat {
    grid-template-columns: 1fr 1fr;
  }
  .bench-tech {
    width: 100%;
    margin-top: 4px;
  }
  .actions.disabled .actions-label {
    color: var(--text-dim);
  }
  .actions-label {
    font-size: 12px;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    text-align: center;
    padding: 8px 0;
  }
  .action {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 14px 14px;
    cursor: pointer;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    text-align: left;
    transition: all 0.1s ease;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }
  .action:disabled,
  .action.disabled-look { opacity: 0.45; cursor: not-allowed; }
  .action:not(:disabled):not(.disabled-look):hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .action.gesturing {
    box-shadow: 0 0 0 3px var(--accent);
    opacity: 1 !important;
    cursor: grabbing;
    touch-action: none;
  }
  .action.made {
    background: var(--success);
    border-color: var(--success);
    color: #ffffff;
    text-align: center;
    font-weight: 700;
  }
  .action.made:not(:disabled):not(.disabled-look):hover { background: var(--success); filter: brightness(1.1); border-color: var(--success); }
  .action.missed {
    background: var(--danger);
    border-color: var(--danger);
    color: #ffffff;
    text-align: center;
    font-weight: 700;
  }
  .action.missed:not(:disabled):not(.disabled-look):hover { background: var(--danger); filter: brightness(1.1); border-color: var(--danger); }
  .action.foul { border-left: 4px solid var(--warn); }
  .action.reb-def { border-left: 4px solid var(--accent-soft); }
  .action.reb-off { border-left: 4px solid #a78bfa; }
  .action.steal { border-left: 4px solid var(--success); }
  .action.turnover { border-left: 4px solid var(--danger); }
  .action.assist { border-left: 4px solid var(--accent); }
  .action.block { border-left: 4px solid #ec4899; }
  .action.team-pts {
    background: var(--surface-2);
    border: 1px dashed var(--accent);
    color: var(--accent);
    font-weight: 700;
    text-align: center;
  }
  .action.team-pts:hover { background: var(--accent); color: var(--accent-fg); border-style: solid; }

  .opponent {
    background: var(--opp-bg);
    border: 1px solid var(--opp-border);
    border-radius: 8px;
    padding: 12px 16px;
  }
  .opp-label {
    font-size: 11px;
    color: var(--them-color);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .opp-roster-edit {
    background: transparent;
    border: 1px solid var(--opp-border);
    color: var(--opp-fg);
    border-radius: 6px;
    padding: 3px 9px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: none;
  }
  .opp-roster-edit:hover { background: var(--opp-btn-hover); }
  .opp-edit-actions {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }
  .opp-edit-actions .small {
    padding: 6px 12px;
    font-size: 13px;
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .opp-edit-actions .small:hover { background: var(--border-strong); color: var(--accent-fg); }
  .opp-bulk {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: 6px;
    margin-bottom: 10px;
  }
  .opp-bulk .bulk-hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .opp-bulk .bulk-hint code {
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .opp-bulk textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: ui-monospace, monospace;
    resize: vertical;
    min-height: 80px;
  }
  .opp-bulk .primary {
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    align-self: flex-start;
  }
  .opp-edit-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 45vh;
    overflow-y: auto;
  }
  .opp-edit-row {
    display: grid;
    grid-template-columns: 70px 1fr 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .opp-edit-row input {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  .opp-edit-num { text-align: center; }
  .opp-edit-row .danger {
    background: var(--danger);
    color: var(--accent-fg);
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
  }
  .opp-edit-row .danger:hover { background: var(--danger-hover); }
  .opp-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .opp {
    background: var(--opp-btn-bg);
    border: 1px solid var(--opp-border);
    color: var(--opp-fg);
    border-radius: 6px;
    padding: 12px 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    text-align: center;
  }
  .opp:hover { background: var(--opp-btn-hover); }

  .opp-roster-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 10px;
    align-items: center;
  }
  .opp-roster-chip {
    background: var(--opp-btn-bg);
    border: 2px solid var(--opp-border);
    color: var(--opp-fg);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    transition: all 0.1s ease;
    font-size: 13px;
  }
  .opp-roster-chip:hover { background: var(--opp-btn-hover); }
  .opp-roster-chip.selected {
    background: var(--them-color);
    color: #ffffff;
    border-color: var(--them-color);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  }
  .orc-cislo { font-family: "Consolas", monospace; font-weight: 800; }
  .orc-name { font-weight: 600; font-size: 12px; opacity: 0.85; }
  .opp-roster-clear {
    background: transparent;
    border: 1px dashed var(--opp-border);
    color: var(--opp-fg);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  .opp-roster-clear:hover { background: var(--opp-btn-hover); }

  .pick-header-opp {
    margin-top: 16px;
  }
  .opp-pick-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
    margin-bottom: 8px;
  }
  .opp-pick-card {
    background: var(--surface-2);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 10px 6px;
    cursor: pointer;
    font-family: inherit;
    color: var(--text);
    text-align: center;
    transition: all 0.1s ease;
  }
  .opp-pick-card:hover {
    background: var(--surface-hover);
  }
  .opp-pick-card.selected {
    background: var(--opp-btn-bg);
    border-color: var(--them-color);
    color: var(--opp-fg);
  }
  .opp-pick-cislo {
    font-size: 18px;
    font-weight: 800;
  }
  .opp-pick-name {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.85;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pick-opp-empty {
    background: var(--surface-2);
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--text-dim);
    font-size: 14px;
    margin-bottom: 8px;
  }

  .opp-perhrac-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 14px;
  }
  .opp-perhrac-table th,
  .opp-perhrac-table td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  .opp-perhrac-table th.th-mono,
  .opp-perhrac-table td.td-mono {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .opp-perhrac-table thead th {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-dim);
  }
  .opp-perhrac-table tr.opp-bez-cisla td {
    color: var(--text-dim);
    border-top: 1px dashed var(--border-strong);
    background: var(--surface-2);
  }

  .foot {
    display: flex;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: var(--shadow);
  }
  .foot button {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }
  .foot button:hover { background: var(--border-strong); color: var(--accent-fg); }
  .foot button.primary { background: var(--accent); color: var(--accent-fg); }
  .foot button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  .foot button.danger { background: var(--danger); color: var(--accent-fg); }
  .foot button.danger:hover { background: var(--danger-hover); color: var(--accent-fg); }
  .foot .spacer { flex: 1; }

  .prompt {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    box-shadow: var(--shadow);
  }
  .prompt h2 { font-size: 24px; color: var(--accent); }
  .score-big {
    font-size: 64px;
    font-weight: 700;
    font-family: "Consolas", monospace;
    color: var(--accent);
  }
  .info { color: var(--text-muted); font-size: 16px; }
  .prompt-buttons { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .prompt-buttons button {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 14px 28px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }
  .prompt-buttons button:hover { background: var(--border-strong); color: var(--accent-fg); }
  .prompt-buttons button.primary { background: var(--accent); color: var(--accent-fg); }
  .prompt-buttons button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }

  .toasts {
    position: fixed;
    top: 70px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 200;
    pointer-events: none;
  }
  .toast {
    background: var(--toast-bg);
    color: var(--toast-fg);
    border-left: 4px solid var(--toast-border);
    padding: 10px 14px;
    border-radius: 4px;
    font-size: 13px;
    max-width: 320px;
    box-shadow: var(--shadow-strong);
    animation: slideIn 0.18s ease;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    min-width: 600px;
    max-width: 92vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-strong);
  }
  .modal.warning { border-color: var(--danger); min-width: 500px; }
  .modal h2 { margin-bottom: 16px; font-size: 20px; color: var(--accent); }
  .modal.warning h2 { color: var(--danger); }
  .warning-msg { white-space: pre-line; color: var(--text); margin-bottom: 16px; line-height: 1.5; }
  .modal-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  .modal-buttons button {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }
  .modal-buttons button:hover { background: var(--border-strong); color: var(--accent-fg); }
  .modal-buttons button.primary { background: var(--accent); color: var(--accent-fg); }
  .modal-buttons button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  .modal-buttons button.danger { background: var(--danger); color: var(--accent-fg); }
  .modal-buttons button.danger:hover { background: var(--danger-hover); color: var(--accent-fg); }
  .modal-buttons button:disabled { opacity: 0.4; cursor: not-allowed; }

  .sub-modal {
    width: 860px;
    max-width: 95vw;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 16px 20px;
  }
  .sub-modal h2 { margin-bottom: 6px; font-size: 18px; }
  .sub-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
  .sub-counters {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .sub-counter {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .sub-counter.ok {
    background: var(--success-bg, var(--accent));
    color: var(--success-fg, var(--accent-fg));
    border-color: var(--success, var(--accent));
  }
  .sub-counter strong { font-family: "Consolas", monospace; font-size: 14px; }
  .sub-warn { font-size: 12px; color: var(--danger); font-weight: 600; }
  .sub-order {
    position: absolute;
    top: 2px;
    right: 4px;
    background: var(--accent);
    color: var(--accent-fg);
    font-family: "Consolas", monospace;
    font-size: 11px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 999px;
    line-height: 1.3;
  }
  .sub-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 6px 0;
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
  }
  .sub-grid > div { display: flex; flex-direction: column; min-height: 0; }
  .sub-grid h3 {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
    position: sticky;
    top: 0;
    background: var(--surface);
    padding-bottom: 4px;
    z-index: 1;
  }
  .sub-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
    align-content: start;
  }
  .sub-card {
    background: var(--surface);
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 6px 4px;
    cursor: pointer;
    text-align: center;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    position: relative;
  }
  .sub-card :global(.avatar) { width: 34px !important; height: 34px !important; }
  .sub-card .name {
    font-size: 12px;
    font-weight: 700;
    font-family: "Consolas", monospace;
    letter-spacing: 0.2px;
    line-height: 1.2;
  }
  .sub-card.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
    color: var(--selected-fg);
  }
  .sub-card.disabled { opacity: 0.4; cursor: not-allowed; }
  .sub-card .fouled-tag {
    font-size: 9px;
    color: var(--danger);
    font-weight: 700;
  }
  .sub-card:hover:not(:disabled) { background: var(--surface-hover); }
  .sub-modal .modal-buttons {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  button.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }
  button.primary:hover:not(:disabled) { background: var(--accent-hover); color: var(--accent-fg); }

  .clock-bar {
    display: flex;
    align-items: center;
    gap: 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    box-shadow: var(--shadow);
    flex-wrap: wrap;
  }
  .clock-bar.running {
    border-color: var(--success);
  }
  .clock-cislo {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .clock-q {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 4px 10px;
    border-radius: 5px;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.5px;
  }
  .clock-display {
    font-family: "Consolas", monospace;
    font-size: 32px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
    min-width: 84px;
  }
  .clock-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 0 var(--success);
    animation: pulse 1.4s ease-out infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.55); }
    70% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
    100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
  }
  .clock-total {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .clock-total-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .clock-total-val {
    font-family: "Consolas", monospace;
    font-weight: 700;
    font-size: 18px;
    color: var(--accent);
  }
  .clock-total-meta {
    font-family: "Consolas", monospace;
    font-size: 13px;
    color: var(--text-muted);
  }
  .clock-buttons {
    display: flex;
    gap: 6px;
    margin-left: auto;
    flex-wrap: wrap;
  }
  .clock-btn {
    background: var(--surface-hover);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .clock-btn:hover { background: var(--border-strong); color: var(--accent-fg); }
  .clock-btn.primary {
    background: var(--success);
    color: #ffffff;
    border-color: var(--success);
  }
  .clock-btn.primary:hover { background: var(--success); filter: brightness(1.1); }
  .clock-btn.ghost {
    background: transparent;
    color: var(--text-muted);
  }
  .clock-btn.ghost:hover { background: var(--surface-hover); color: var(--text); }
  .clock-btn.undo {
    background: var(--warn-bg, var(--surface-hover));
    color: var(--warn-fg, var(--warn));
    border-color: var(--warn);
    font-weight: 700;
  }
  .clock-btn.undo:hover:not(:disabled) { background: var(--warn); color: #ffffff; }
  .clock-btn.undo:disabled { opacity: 0.4; cursor: not-allowed; }

  .settime-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 14px 18px;
    border-radius: 8px;
    font-size: 24px;
    font-family: "Consolas", monospace;
    font-weight: 700;
    text-align: center;
    letter-spacing: 2px;
  }
  .settime-input:focus { outline: none; border-color: var(--accent); }

  .match-end-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 22px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    flex-wrap: wrap;
  }
  .me-result-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .me-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }
  .me-pill {
    padding: 6px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .me-pill.vyhra { background: var(--success-bg); color: var(--success-fg); }
  .me-pill.prohra { background: var(--danger-bg); color: var(--danger-fg); }
  .me-pill.remiza { background: var(--surface-2); color: var(--text-muted); }
  .me-score-big {
    font-family: "Consolas", monospace;
    font-size: 40px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 1px;
  }

  .score-edit {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
    box-shadow: var(--shadow);
  }
  .se-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .se-head h3 {
    font-size: 15px;
    color: var(--accent);
    margin: 0;
  }
  .se-hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .se-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 700px) {
    .se-grid { grid-template-columns: 1fr; }
  }
  .se-strana {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
  }
  .se-strana.opp {
    border-color: var(--warn-border, var(--border));
  }
  .se-label {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }
  .se-buttons {
    display: flex;
    gap: 6px;
  }
  .se-btn {
    flex: 1;
    padding: 8px 0;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-family: "Consolas", monospace;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
  }
  .se-btn:hover:not(:disabled) {
    background: var(--surface-hover, var(--surface));
    border-color: var(--accent);
  }
  .se-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .se-btn.se-plus {
    color: var(--success-fg);
    border-color: var(--success-bg);
  }
  .se-btn.se-minus {
    color: var(--danger-fg);
    border-color: var(--danger-bg);
  }

  .boxscore {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
  }
  .bs-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .bs-head h3 {
    font-size: 16px;
    color: var(--accent);
    font-weight: 700;
  }
  .bs-hint {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }
  .bs-scroll {
    overflow-x: auto;
    margin: 0 -18px;
    padding: 0 18px;
  }
  .bs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 900px;
  }
  .bs-table thead th {
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 8px 6px;
    text-align: center;
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
    cursor: help;
  }
  .bs-table thead th.th-sticky {
    text-align: left;
    padding-left: 10px;
  }
  .bs-table tbody td {
    padding: 8px 6px;
    border-bottom: 1px solid var(--border);
    text-align: center;
    color: var(--text);
  }
  .bs-table tbody tr:hover { background: var(--surface-2); }
  .td-num {
    font-weight: 700;
    color: var(--accent);
    width: 32px;
    text-align: center;
  }
  .td-name {
    text-align: left;
    font-weight: 600;
    padding-left: 4px;
    white-space: nowrap;
  }
  .bs-name { display: inline-block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
  .bs-tag-fo {
    display: inline-block;
    margin-left: 6px;
    background: var(--danger);
    color: #fff;
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 3px;
    font-weight: 700;
    vertical-align: middle;
  }
  .td-mono { font-family: "Consolas", monospace; font-variant-numeric: tabular-nums; }
  .td-pts { font-weight: 700; color: var(--accent); }
  .td-pm.pm-plus { color: var(--success); font-weight: 700; }
  .td-pm.pm-minus { color: var(--danger); font-weight: 700; }
  .td-eff { font-weight: 700; }
  .row-total td {
    background: var(--surface-2);
    border-top: 2px solid var(--border);
    border-bottom: none;
    font-weight: 700;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .row-total .td-name {
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 12px;
  }
  .foulout .td-name { opacity: 0.7; }

  .prirazeni {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .prirazeni-toggle {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    padding: 14px 18px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .prirazeni-toggle:hover { background: var(--surface-hover); }
  .prirazeni-toggle .pt-arrow { color: var(--text-muted); font-size: 12px; }
  .prirazeni-body { padding: 0 18px 16px; }

  .vyvoj-skore {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
  }
  .vs-head {
    margin-bottom: 10px;
  }
  .vs-head h3 {
    font-size: 16px;
    color: var(--accent);
    font-weight: 700;
  }

  .vyvoj-skore-live {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .vsl-toggle {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--accent);
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .vsl-toggle:hover { background: var(--surface-hover); }
  .vsl-arrow { color: var(--text-muted); font-size: 12px; }
  .vsl-body { padding: 0 16px 14px; }
  .prirazeni-hint { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px; }
  .prirazeni-hint strong { color: var(--text); }
  .prirazeni-empty { font-size: 13px; color: var(--text-muted); font-style: italic; }
  .prirazeni-list { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
  .prirazeni-row {
    display: grid;
    grid-template-columns: 44px 1fr minmax(150px, 200px);
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--surface-2);
  }
  .prirazeni-row.bezhrace { border-left: 3px solid var(--warn); }
  .pr-q { font-size: 12px; font-weight: 700; color: var(--text-muted); }
  .pr-akce { font-size: 13px; font-weight: 600; color: var(--text); }
  .pr-select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .pr-select:focus { outline: none; border-color: var(--accent); }

  .opp-summary {
    background: var(--opp-bg);
    border: 1px solid var(--opp-border);
    border-radius: 10px;
    padding: 14px 18px;
  }
  .opp-summary h3 {
    font-size: 14px;
    color: var(--them-color);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .opp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
  }
  .opp-item {
    display: flex;
    flex-direction: column;
    background: var(--opp-btn-bg);
    border-radius: 6px;
    padding: 8px 12px;
    gap: 2px;
  }
  .opp-l {
    font-size: 11px;
    color: var(--opp-fg);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  .opp-v {
    font-family: "Consolas", monospace;
    font-size: 22px;
    font-weight: 700;
    color: var(--opp-fg);
  }

  .me-actions {
    display: flex;
    justify-content: center;
    padding: 8px 0 16px;
  }
  .me-actions button {
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    padding: 14px 36px;
    font-size: 16px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
  }
  .me-actions button:hover { background: var(--accent-hover); }

  .pick-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .edit-roster-btn {
    background: var(--surface-hover);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .edit-roster-btn:hover { background: var(--border-strong); color: var(--accent-fg); }

  .roster-modal { width: 560px; max-width: 92vw; }
  .roster-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .roster-header h2 { margin: 0; font-size: 18px; color: var(--accent); }
  .roster-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .roster-empty {
    padding: 30px;
    text-align: center;
    color: var(--text-muted);
    background: var(--surface-2);
    border-radius: 6px;
  }
  .roster-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px;
    background: var(--bg);
  }
  .roster-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text);
  }
  .roster-row:hover { background: var(--surface-2); }
  .roster-row.checked { background: var(--surface-hover); }
  .roster-row input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
  .roster-info { display: flex; flex-direction: column; gap: 2px; }
  .roster-name { font-weight: 600; }
  .roster-meta { font-size: 12px; color: var(--text-muted); }
  .roster-chyba {
    background: var(--danger-bg);
    color: var(--danger-fg);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    margin-top: 8px;
  }

  .live-totals {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: var(--shadow);
  }
  .lt-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .lt-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 4px 8px;
    border-radius: 4px;
    min-width: 60px;
    text-align: center;
  }
  .lt-label.us { background: var(--accent); color: var(--accent-fg); }
  .lt-label.them { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); }
  .lt-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 13px;
  }
  .lt-l {
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .lt-v {
    color: var(--text);
    font-weight: 700;
    font-family: ui-monospace, monospace;
  }
  .lt-v.lt-pts { color: var(--accent); font-size: 14px; }
  .opp-fauly-row .lt-label.them {
    background: var(--danger-bg, #4a1d1d);
    color: var(--danger-fg, #ffb4b4);
  }
  .opp-fa-chip .lt-v { color: var(--danger-fg, #ffb4b4); }

  .action.bench-tech {
    background: var(--surface-2);
    color: var(--text);
    border: 1px dashed var(--border-strong);
    font-style: italic;
  }
  .action.bench-tech:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--accent-fg);
  }

  .foul-subtyp-modal { width: 420px; max-width: 92vw; }
  .foul-subtyp-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0;
  }
  .foul-subtyp-buttons button {
    padding: 14px 20px;
    font-size: 15px;
    font-weight: 700;
    background: var(--surface-hover);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }
  .foul-subtyp-buttons button.primary {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .foul-subtyp-buttons button:hover:not(.primary) {
    background: var(--border-strong);
    color: var(--accent-fg);
  }
  .foul-subtyp-buttons button.primary:hover { background: var(--accent-hover); }

  .opp-foul-modal { width: 560px; max-width: 92vw; }
  .opp-numbers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
    max-height: 50vh;
    overflow-y: auto;
    margin: 10px 0;
  }
  .opp-num-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    color: var(--text);
    transition: all 0.15s;
  }
  .opp-num-btn:hover {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .opp-num-btn .opp-num { font-size: 18px; font-weight: 800; }
  .opp-num-btn .opp-pr { font-size: 12px; }
  .opp-num-btn .opp-fa {
    font-size: 11px;
    background: var(--danger);
    color: var(--accent-fg);
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 700;
  }

  .opp-fauly-summary {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .opp-fa-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  .opp-fa-bench {
    margin-top: 10px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .period-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0;
  }
  .period-tab {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .period-tab:hover { background: var(--surface-hover); }
  .period-tab.active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }

  .timeouts {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: var(--shadow);
  }
  .to-info {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .to-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .to-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 700;
    border: 1px solid var(--border);
    transition: all 0.15s;
  }
  .to-btn.us {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .to-btn.us:hover:not(:disabled) { background: var(--accent-hover); }
  .to-btn.them {
    background: var(--surface-2);
    color: var(--text);
  }
  .to-btn.them:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--accent-fg);
  }
  .to-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .to-btn .to-team { font-size: 14px; }
  .to-btn .to-zbyva { font-size: 15px; font-weight: 600; }
  .to-btn .to-zbyva strong { font-size: 22px; font-family: ui-monospace, monospace; }
  .to-btn .to-celkem { font-size: 11px; font-weight: 500; opacity: 0.8; }

  .to-countdown {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1800;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    border-radius: 14px;
    background: var(--accent);
    color: #ffffff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.25);
  }
  .to-countdown .toc-label {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .to-countdown .toc-time {
    font-size: 32px;
    font-weight: 800;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-variant-numeric: tabular-nums;
    min-width: 86px;
    text-align: center;
  }
  .to-countdown.done .toc-time {
    font-size: 18px;
    min-width: 0;
  }
  .to-countdown .toc-end {
    background: #ffffff;
    color: var(--accent);
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .to-countdown .toc-end:hover { filter: brightness(0.94); }
  .to-countdown.done {
    background: var(--danger);
    animation: toc-blink 0.7s ease-in-out infinite;
  }
  .to-countdown.done .toc-end { color: var(--danger); }
  @keyframes toc-blink {
    0%, 100% { box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4), 0 0 0 0 rgba(220, 38, 38, 0.6); }
    50% { box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4), 0 0 0 10px rgba(220, 38, 38, 0); }
  }

  .swipe-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }
  .swipe-dir {
    position: absolute;
    background: rgba(15, 23, 42, 0.92);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    padding: 3px 7px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.3px;
    line-height: 1;
    font-family: inherit;
    text-transform: uppercase;
    transition: transform 0.08s ease, background 0.08s ease;
  }
  .swipe-dir.swipe-up { top: -10px; left: 50%; transform: translate(-50%, -100%); }
  .swipe-dir.swipe-down { bottom: -10px; left: 50%; transform: translate(-50%, 100%); }
  .swipe-dir.swipe-left { left: -10px; top: 50%; transform: translate(-100%, -50%); }
  .swipe-dir.swipe-right { right: -10px; top: 50%; transform: translate(100%, -50%); }
  .swipe-dir.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35);
  }
  .swipe-dir.swipe-up.active { transform: translate(-50%, -100%) scale(1.15); }
  .swipe-dir.swipe-down.active { transform: translate(-50%, 100%) scale(1.15); }
  .swipe-dir.swipe-left.active { transform: translate(-100%, -50%) scale(1.15); }
  .swipe-dir.swipe-right.active { transform: translate(100%, -50%) scale(1.15); }

  .radial-overlay {
    position: fixed;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 1500;
    animation: radial-pop 0.13s ease-out;
  }
  @keyframes radial-pop {
    from { opacity: 0; transform: scale(0.82); }
    to { opacity: 1; transform: scale(1); }
  }
  .radial-overlay::before {
    content: '';
    position: absolute;
    left: -140px;
    top: -140px;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(15, 23, 42, 0.55) 0%, rgba(15, 23, 42, 0.0) 70%);
  }
  .radial-overlay.two-ring::before {
    left: -240px;
    top: -240px;
    width: 480px;
    height: 480px;
    background: radial-gradient(circle, rgba(15, 23, 42, 0.42) 0%, rgba(15, 23, 42, 0.2) 46%, rgba(15, 23, 42, 0.0) 74%);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .radial-hint {
    position: absolute;
    left: 50%;
    bottom: -230px;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.9);
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .radial-svg {
    position: absolute;
    left: 0;
    top: 0;
    margin-left: -220px;
    margin-top: -220px;
    overflow: visible;
  }
  .wedge {
    stroke: rgba(255, 255, 255, 0.4);
    stroke-width: 1.5;
    fill-opacity: 1;
    transition: filter 0.08s ease, opacity 0.08s ease, fill-opacity 0.08s ease;
  }
  .wedge.tone-made { fill: var(--success); }
  .wedge.tone-miss { fill: var(--danger); }
  .wedge.tone-foul { fill: var(--warn); }
  .wedge.tone-reb { fill: var(--accent-soft); }
  .wedge.tone-pozit { fill: #7c3aed; }
  .wedge.tone-negat { fill: var(--danger); }
  .wedge.active {
    stroke: #ffffff;
    stroke-width: 3.5;
    fill-opacity: 1;
    filter: brightness(1.2) saturate(1.25) drop-shadow(0 0 9px rgba(255, 255, 255, 0.7));
  }
  .radial-lbl {
    position: absolute;
    left: 0;
    top: 0;
    margin-left: -24px;
    margin-top: -14px;
    width: 48px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.4px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.6);
    transition: scale 0.08s ease;
    pointer-events: none;
  }
  .radial-lbl.outer { font-size: 14px; }
  .radial-lbl.active { scale: 1.22; text-shadow: 0 2px 7px rgba(0, 0, 0, 0.95); }
  .radial-overlay.has-active .radial-lbl:not(.active) { opacity: 0.5; }
  .radial-overlay.has-active .player-seg:not(.active) {
    opacity: 0.42;
    filter: saturate(0.7);
  }
  .radial-readout {
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
    min-width: 56px;
    max-width: 132px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.92);
    border: 2px solid rgba(255, 255, 255, 0.32);
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.15;
    text-align: center;
    pointer-events: none;
  }
  .radial-readout.cancel {
    background: var(--danger);
    border-color: var(--danger);
  }
  .radial-center {
    position: absolute;
    left: 0;
    top: 0;
    margin-left: -16px;
    margin-top: -16px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.85);
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }
  .radial-center.cancel {
    background: var(--danger);
    border-color: var(--danger);
    color: #ffffff;
  }

  .action-radial::before {
    left: -160px;
    top: -160px;
    width: 320px;
    height: 320px;
  }
  .player-seg {
    position: absolute;
    left: 0;
    top: 0;
    margin-left: -38px;
    margin-top: -28px;
    width: 76px;
    height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: #1d4ed8;
    color: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    transition: transform 0.08s ease, background 0.08s ease, box-shadow 0.08s ease;
    padding: 4px 6px;
  }
  .player-seg-num {
    font-size: 17px;
    font-weight: 800;
    line-height: 1;
    color: #ffffff;
  }
  .player-seg-name {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player-seg.active {
    scale: 1.14;
    border-color: #ffffff;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.9), 0 10px 24px rgba(0, 0, 0, 0.5);
    filter: brightness(1.14);
    opacity: 1;
    z-index: 3;
  }
  .player-seg.active .player-seg-num { color: #ffffff; }
  .radial-empty {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translate(-50%, -50%);
    background: rgba(15, 23, 42, 0.9);
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .live-app { gap: 8px; min-height: calc(100vh - 60px); }

    .head {
      grid-template-columns: auto 1fr;
      gap: 6px 8px;
      padding: 6px 10px;
      border-radius: 6px;
    }
    .back { padding: 5px 9px; font-size: 12px; }
    .teams {
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .teams .vs { margin: 0 4px; }
    .score-bar { gap: 8px; padding: 5px 12px; margin: 6px 0; }
    .score-bar .us-score, .score-bar .them-score { font-size: 26px; }
    .score-bar .sep { font-size: 20px; }
    .score-bar .sb-q { font-size: 12px; padding: 2px 8px; }

    .quarter-scores { gap: 4px; padding: 0 2px; }
    .qs { padding: 3px 7px; font-size: 11px; gap: 4px; }

    .clock-bar { padding: 6px 10px; gap: 10px; border-radius: 6px; }
    .clock-cislo { gap: 6px; }
    .clock-q { padding: 3px 7px; font-size: 12px; }
    .clock-display { font-size: 26px; min-width: 70px; }
    .clock-total-label { display: none; }
    .clock-total-meta { display: none; }
    .clock-total-val { font-size: 15px; }
    .clock-buttons { gap: 4px; }
    .clock-btn { padding: 6px 8px; font-size: 11px; border-radius: 5px; }

    .live { grid-template-columns: minmax(0, 1fr) 180px; gap: 8px; }

    .actions { padding: 8px; gap: 4px; border-radius: 6px; }
    .group-label { font-size: 9px; letter-spacing: 0.8px; padding: 1px 1px 0; }
    .group-grid { gap: 4px; }
    .action { padding: 9px 8px; font-size: 12px; border-radius: 5px; text-align: center; }
    .action.bench-tech { padding: 8px; font-size: 12px; }
    .actions-label { font-size: 11px; padding: 4px 0; }

    .players-col { padding: 6px; gap: 5px; border-radius: 6px; }
    .pc-label { font-size: 9px; padding: 2px 0 0; }
    .pc-list { gap: 4px; }
    .pc-card { padding: 5px 7px; gap: 6px; border-radius: 6px; border-width: 1px; }
    .pc-num { font-size: 17px; }
    .pc-name { font-size: 12px; }
    .pc-fauly { top: 2px; right: 4px; font-size: 10px; }
    :global(.pc-card .avatar) { width: 32px !important; height: 32px !important; }
    .pc-sub-btn { padding: 7px 8px; font-size: 12px; }

    .opponent { padding: 8px 10px; border-radius: 6px; }
    .opp-label { font-size: 10px; margin-bottom: 6px; }
    .opp-roster-edit { padding: 2px 7px; font-size: 11px; }
    .opp-roster-row { gap: 4px; margin-bottom: 6px; }
    .opp-roster-chip { padding: 3px 8px; font-size: 12px; border-width: 1px; gap: 4px; }
    .orc-name { font-size: 11px; }
    .opp-roster-clear { padding: 3px 8px; font-size: 11px; }
    .opp-actions { gap: 4px; }
    .opp { padding: 9px 8px; font-size: 12px; }

    .bench-strip { padding: 5px 8px; font-size: 11px; gap: 6px; border-radius: 6px; }
    .bs-label { font-size: 10px; }
    .bs-item { font-size: 11px; }

    .timeouts { padding: 7px 10px; border-radius: 6px; }
    .to-info { font-size: 11px; margin-bottom: 5px; }
    .to-buttons { gap: 6px; }
    .to-btn { padding: 7px 10px; gap: 2px; }
    .to-btn .to-team { font-size: 12px; }
    .to-btn .to-zbyva { font-size: 12px; }
    .to-btn .to-zbyva strong { font-size: 17px; }
    .to-btn .to-celkem { font-size: 10px; }

    .pick-lineup { padding: 12px; border-radius: 6px; }
    .pick-lineup h2 { font-size: 16px; margin-bottom: 10px; }
    .players-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; margin-bottom: 12px; }
    .opp-pick-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; }
    .big { padding: 10px 18px !important; font-size: 14px !important; }
  }

  @media (max-width: 700px) {
    .live { grid-template-columns: 1fr; }
    .live > .opponent { grid-column: auto; }
    .head {
      grid-template-columns: auto 1fr;
    }
    .teams { font-size: 13px; }
    .score-bar .us-score, .score-bar .them-score { font-size: 22px; }
    .clock-bar { gap: 8px; }
    .clock-display { font-size: 22px; min-width: 60px; }
    .clock-btn { padding: 5px 7px; font-size: 10px; }
  }

  /* === TELEFON (na výšku i na šířku) — způsob 2: hráč → akce jako primární ===
     Cíleno na telefon v obou orientacích, ne na tablet:
     na výšku přes šířku, na šířku přes nízkou výšku (tablet má na šířku výšku 768+). */
  @media (max-width: 600px), (max-height: 500px) {
    .live { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .live > .players-col { order: 1; }
    .live > .actions { order: 2; }
    .live > .opponent { order: 3; }

    .actions > .actions-label { display: none; }
    .actions .pp-only { display: none; }
    .actions { padding: 8px; gap: 6px; }
    .action.team-pts, .action.bench-tech { padding: 11px 8px; font-size: 13px; text-align: center; }
    .group-grid.utok { grid-template-columns: 1fr 1fr; }

    .players-col { padding: 8px; gap: 7px; }
    .pc-card { padding: 9px 11px; gap: 10px; }
    :global(.pc-card .avatar) { width: 38px !important; height: 38px !important; }
    .pc-num { font-size: 18px; }
    .pc-name { font-size: 14px; }
    .pc-sub-btn { padding: 11px; font-size: 14px; font-weight: 700; }

    .pc-mobile-hint { display: block; }
    .pc-undo-row { display: flex; }
    .clock-btn.undo { display: none; }
    .undo-hint { display: none; }

    .opponent { padding: 7px 9px; }
    .opp-label { font-size: 9px; }
  }
</style>
