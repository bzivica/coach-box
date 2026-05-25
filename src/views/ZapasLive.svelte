<script lang="ts">
  import { onMount } from 'svelte';
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
  let oppFoulPicker = $state(false);

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
    let body = 0, fauly = 0, doskoky = 0;
    for (const s of periodOppStatsPerCisloMap.values()) {
      body += s.body;
      fauly += s.fauly;
      doskoky += s.doskoky;
    }
    const dosTot = periodOppTotals.doskoky_off + periodOppTotals.doskoky_def + periodOppTotals.doskoky_neznamy;
    return {
      body: Math.max(0, periodOppTotals.body - body),
      fauly: Math.max(0, periodOppTotals.fauly - fauly),
      doskoky: Math.max(0, dosTot - doskoky),
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

  function openFoulPicker() {
    if (!selectedPlayer) return;
    foulSubtypePicker = { playerId: selectedPlayer };
  }

  async function recordFoul(subtyp: FoulSubtyp) {
    const playerId = foulSubtypePicker?.playerId;
    foulSubtypePicker = null;
    if (!playerId || !zapas) return;
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

  function openOppFoulPicker() {
    if (selectedOppCislo !== null) {
      void recordOppFoul(selectedOppCislo);
      return;
    }
    oppFoulPicker = true;
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

  async function recordOppFoul(cislo?: number) {
    oppFoulPicker = false;
    if (!zapas) return;
    const ev: Udalost = {
      id: newId(),
      zapas_id: zapas.id,
      ctvrtina_cislo: aktualniCtvrtinaCislo,
      poradi: pristiPoradi(udalosti, aktualniCtvrtinaCislo),
      typ: 'opp_foul',
      hrac_id: null,
      opp_hrac_cislo: cislo,
      timestamp_at: Date.now(),
      cas_v_q_ms: aktualniCasVQMs(),
    };
    await db.udalosti.add(ev);
    udalosti = [...udalosti, ev];
    pushUndo({ kind: 'event', eventId: ev.id });
    toast(`SOUPEŘ — Faul${typeof cislo === 'number' ? ` #${cislo}` : ''}`);
    selectedOppCislo = null;
    await updateZapasCache();
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
      case 'foul_technical_bench': return 'technická chyba (lavička)';
      case 'oddech_my': return 'oddech';
      case 'oddech_opp': return 'oddech soupeře';
      case 'team_pts_2': return '+2 body (bez hráče)';
      case 'team_pts_3': return '+3 body (bez hráče)';
      case 'team_pts_1': return '+1 trestný (bez hráče)';
    }
  }

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

    const porusene = inHraci
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
</script>

{#if mode === 'loading' || !zapas || !souper}
  <div class="loading">Načítání…</div>
{:else}
  <div class="live-app">
    <header class="head">
      <button class="back" onclick={onBack}>← Zpět</button>
      <div class="teams">
        {#if zapas.nase_strana === 'home'}
          <span class="us">My ({kategorieLabel(zapas.nase_kategorie)})</span>
          <span class="vs">vs</span>
          <span class="them">{souper.nazev}</span>
        {:else}
          <span class="them">{souper.nazev}</span>
          <span class="vs">vs</span>
          <span class="us">My ({kategorieLabel(zapas.nase_kategorie)})</span>
        {/if}
      </div>
      <div class="quarter">{fmtQ(aktualniCtvrtinaCislo)}{jeOT(aktualniCtvrtinaCislo) ? ' (prodloužení)' : ''}</div>
      <div class="score">
        <span class="us-score">{skore.nase}</span>
        <span class="sep">:</span>
        <span class="them-score">{skore.souper}</span>
      </div>
    </header>

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

          <div class="action-group">
            <div class="group-label">ÚTOK</div>
            <div class="group-grid utok">
              <button class="action made" disabled={!selectedPlayer} onclick={() => recordAction('shot_2_made')}>✓ 2 body</button>
              <button class="action made" disabled={!selectedPlayer} onclick={() => recordAction('shot_3_made')}>✓ 3 body</button>
              <button class="action made" disabled={!selectedPlayer} onclick={() => recordAction('ft_made')}>✓ Trestný</button>
              <button class="action missed" disabled={!selectedPlayer} onclick={() => recordAction('shot_2_miss')}>✗ 2 body</button>
              <button class="action missed" disabled={!selectedPlayer} onclick={() => recordAction('shot_3_miss')}>✗ 3 body</button>
              <button class="action missed" disabled={!selectedPlayer} onclick={() => recordAction('ft_miss')}>✗ Trestný</button>
            </div>
          </div>

          <div class="action-group">
            <div class="group-label">DOSKOK</div>
            <div class="group-grid doskok">
              <button class="action reb-off" disabled={!selectedPlayer} onclick={() => recordAction('reb_off')}>Útočný</button>
              <button class="action reb-def" disabled={!selectedPlayer} onclick={() => recordAction('reb_def')}>Obranný</button>
            </div>
          </div>

          <div class="action-group">
            <div class="group-label">POZITIVNÍ</div>
            <div class="group-grid pozit">
              <button class="action assist" disabled={!selectedPlayer} onclick={() => recordAction('assist')}>Asistence</button>
              <button class="action steal" disabled={!selectedPlayer} onclick={() => recordAction('steal')}>Zisk</button>
              <button class="action block" disabled={!selectedPlayer} onclick={() => recordAction('block')}>Blok</button>
            </div>
          </div>

          <div class="action-group">
            <div class="group-label">NEGATIVNÍ</div>
            <div class="group-grid negat">
              <button class="action foul" disabled={!selectedPlayer} onclick={openFoulPicker}>Faul…</button>
              <button class="action turnover" disabled={!selectedPlayer} onclick={() => recordAction('turnover')}>Ztráta</button>
            </div>
          </div>

          <div class="action-group">
            <div class="group-label">RYCHLÝ ZÁPIS BODŮ — BEZ HRÁČE (sedí semafor)</div>
            <div class="group-grid utok">
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_2')}>+2 tým</button>
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_3')}>+3 tým</button>
              <button class="action team-pts" onclick={() => recordTeamPoints('team_pts_1')}>+1 tým</button>
            </div>
          </div>

          <button class="action bench-tech" onclick={recordBenchTech} title="Technická chyba lavičky/trenéra (bez hráče)">Tech. lavička (bez hráče)</button>
        </div>

        <div class="players-col">
          <div class="pc-label">NA HŘIŠTI</div>
          <div class="pc-list">
            {#each naHristi as h (h.id)}
              {@const fauly = pocetFauluZobr(h.id)}
              <button
                class="pc-card"
                class:selected={selectedPlayer === h.id}
                onclick={() => selectPlayer(h.id)}
              >
                <Avatar foto={h.foto} cislo={h.cislo_dresu} size={PC_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={zapas?.nase_strana === 'away'} />
                <div class="pc-info">
                  <div class="pc-num">#{h.cislo_dresu ?? '?'}</div>
                  <div class="pc-name">{h.prijmeni}</div>
                </div>
                {#if fauly > 0}<div class="pc-fauly">F{fauly}</div>{/if}
              </button>
            {/each}
          </div>
          <button class="pc-sub-btn" onclick={openSub} title="Otevři střídání (multi-výběr)">⇄ Střídání</button>
        </div>

        <section class="opponent">
          <div class="opp-label">
            SOUPEŘ ({souper.nazev})
            {#if selectedOppCislo !== null}
              — zapíše na #{selectedOppCislo}
            {:else if (souper.hraci_soupere?.length ?? 0) > 0}
              — bez čísla (volitelně vyber)
            {/if}
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
            <button class="opp" onclick={openOppFoulPicker}>+1 faul…</button>
            <button class="opp" onclick={() => recordOpponent('opp_reb_off')}>+ dosk útoč.</button>
            <button class="opp" onclick={() => recordOpponent('opp_reb_def')}>+ dosk obr.</button>
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
          <div class="lt-chip"><span class="lt-l">TO</span><span class="lt-v">{teamTotals.ztraty}</span></div>
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
              {#if periodTeamUnattributed.body > 0}
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
                  <td class="td-mono">—</td>
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
                <td class="td-mono">{periodTeamTotals.ztraty}</td>
                <td class="td-mono">{periodTeamTotals.bloky}</td>
                <td class="td-mono">{periodTeamTotals.fauly}</td>
                <td class="td-mono">—</td>
                <td class="td-mono td-eff">{periodTeamTotals.efficiency}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
                  <th class="th-mono">PTS</th>
                  <th class="th-mono">PF</th>
                  <th class="th-mono">REB</th>
                </tr>
              </thead>
              <tbody>
                {#each [...periodOppStatsPerCisloMap.entries()].sort((a, b) => a[0] - b[0]) as [cislo, st] (cislo)}
                  {@const oh = souper.hraci_soupere?.find((h) => h.cislo === cislo)}
                  <tr>
                    <td class="td-mono">#{cislo}</td>
                    <td>{oh?.prijmeni ?? ''}</td>
                    <td class="td-mono">{st.body}</td>
                    <td class="td-mono">{st.fauly}</td>
                    <td class="td-mono">{st.doskoky}</td>
                  </tr>
                {/each}
                {#if periodOppBezCisla.body + periodOppBezCisla.fauly + periodOppBezCisla.doskoky > 0}
                  <tr class="opp-bez-cisla">
                    <td class="td-mono">—</td>
                    <td><em>Bez čísla hráče</em></td>
                    <td class="td-mono">{periodOppBezCisla.body}</td>
                    <td class="td-mono">{periodOppBezCisla.fauly}</td>
                    <td class="td-mono">{periodOppBezCisla.doskoky}</td>
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
                  <Avatar foto={h.foto} cislo={h.cislo_dresu} size={SUB_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} />
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
      <div class="modal-bg" onclick={() => (oppFoulPicker = false)} role="presentation">
        <div class="modal opp-foul-modal" onclick={(e) => e.stopPropagation()} role="presentation">
          <h2>Faul soupeře — {souper.nazev}</h2>
          {#if souper.hraci_soupere && souper.hraci_soupere.length > 0}
            <p class="roster-hint">Vyber číslo hráče soupeře:</p>
            <div class="opp-numbers-grid">
              {#each souper.hraci_soupere.slice().sort((a, b) => a.cislo - b.cislo) as oh (oh.cislo)}
                {@const aktualni = oppFaulyPerCisloMap.get(oh.cislo) ?? 0}
                <button class="opp-num-btn" onclick={() => recordOppFoul(oh.cislo)} title={`${oh.jmeno ?? ''} ${oh.prijmeni ?? ''}`.trim() || `#${oh.cislo}`}>
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
            <button onclick={() => recordOppFoul(undefined)}>Bez určení čísla</button>
            <button onclick={() => (oppFoulPicker = false)}>Zrušit</button>
          </div>
        </div>
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
    grid-template-columns: auto 1fr auto auto;
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
  .quarter {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 8px 18px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 18px;
  }
  .score {
    font-size: 32px;
    font-weight: 700;
    font-family: "Consolas", monospace;
  }
  .score .us-score { color: var(--us-color); }
  .score .them-score { color: var(--them-color); }
  .score .sep { color: var(--text-muted); margin: 0 8px; }

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
  }
  .pc-card:hover { background: var(--surface-hover); border-color: var(--border-strong); }
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
  }
  .action:disabled { opacity: 0.35; cursor: not-allowed; }
  .action:not(:disabled):hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .action.made {
    background: var(--success);
    border-color: var(--success);
    color: #ffffff;
    text-align: center;
    font-weight: 700;
  }
  .action.made:not(:disabled):hover { background: var(--success); filter: brightness(1.1); border-color: var(--success); }
  .action.missed {
    background: var(--danger);
    border-color: var(--danger);
    color: #ffffff;
    text-align: center;
    font-weight: 700;
  }
  .action.missed:not(:disabled):hover { background: var(--danger); filter: brightness(1.1); border-color: var(--danger); }
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
  }
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

  .sub-modal { width: 720px; max-width: 92vw; }
  .sub-hint { font-size: 13px; color: var(--text-muted); margin-bottom: 10px; }
  .sub-counters {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .sub-counter {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
  }
  .sub-counter.ok {
    background: var(--success-bg, var(--accent));
    color: var(--success-fg, var(--accent-fg));
    border-color: var(--success, var(--accent));
  }
  .sub-counter strong { font-family: "Consolas", monospace; font-size: 16px; }
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
  .sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
  .sub-grid h3 {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .sub-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .sub-card {
    background: var(--surface);
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 12px 8px;
    cursor: pointer;
    text-align: center;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    position: relative;
  }
  .sub-card .name {
    font-size: 16px;
    font-weight: 700;
    font-family: "Consolas", monospace;
    letter-spacing: 0.3px;
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
</style>
