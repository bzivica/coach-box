<script lang="ts">
  import { onMount } from 'svelte';
  import { db, newId } from '../lib/db';
  import {
    KATEGORIE_PORADI,
    kategorieLabel,
    type Zapas,
    type Udalost,
    type Ctvrtina,
    type Hrac,
    type Soutez,
    type Souper,
    type Kategorie,
  } from '../lib/types';
  import {
    aggregateAcrossMatches,
    computeTeamRecord,
    computeZapasStav,
    formatMinSec,
    klokByPouzit,
    filtrEventyVOkne,
    type CasoveOkno,
  } from '../lib/live';
  import Avatar from '../components/Avatar.svelte';
  import ZapasLive from './ZapasLive.svelte';

  type Tab = 'hraci' | 'tym';

  interface FilterPreset {
    id: string;
    nazev: string;
    sezony: string[];
    souteze: string[];
    kategorie: Kategorie[];
    hraci: string[];
    vytvoreno_at: number;
  }

  const HRAC_AVATAR_SIZE = 32;
  const DECIMALS_PER_GAME = 1;
  const PRESETY_KLIC = 'statistiky_presety';
  const AKTIVNI_SEZONA_KLIC = 'aktivni_sezona';

  let zapasy = $state<Zapas[]>([]);
  let udalosti = $state<Udalost[]>([]);
  let ctvrtiny = $state<Ctvrtina[]>([]);
  let hraci = $state<Hrac[]>([]);
  let souteze = $state<Soutez[]>([]);
  let souperi = $state<Souper[]>([]);

  let selectedSezony = $state<string[]>([]);
  let selectedSouteze = $state<string[]>([]);
  let selectedKategorie = $state<Kategorie[]>([]);
  let selectedHraci = $state<string[]>([]);
  let selectedZapasId = $state<string | null>(null);

  let tab = $state<Tab>('hraci');
  let perGame = $state(false);
  let casoveOkno = $state<CasoveOkno>('cela');
  let liveZapasId = $state<string | null>(null);

  let presety = $state<FilterPreset[]>([]);
  let saveModal = $state(false);
  let saveName = $state('');

  onMount(async () => {
    zapasy = await db.zapasy.toArray();
    udalosti = await db.udalosti.toArray();
    ctvrtiny = await db.ctvrtiny.toArray();
    hraci = await db.hraci.toArray();
    souteze = await db.souteze.toArray();
    souperi = await db.souperi.toArray();
    await nactiPresety();
    await aplikovatAktivniSezonu();
  });

  async function aplikovatAktivniSezonu() {
    const row = await db.nastaveni.get(AKTIVNI_SEZONA_KLIC);
    const aktivni = typeof row?.hodnota === 'string' ? row.hodnota.trim() : '';
    if (!aktivni) return;
    if (selectedSezony.length > 0) return;
    if (!zapasy.some((z) => z.sezona === aktivni)) return;
    selectedSezony = [aktivni];
  }

  async function nactiPresety() {
    const row = await db.nastaveni.get(PRESETY_KLIC);
    if (row && Array.isArray(row.hodnota)) {
      presety = row.hodnota as FilterPreset[];
    } else {
      presety = [];
    }
  }

  async function ulozPresety(list: FilterPreset[]) {
    presety = list;
    await db.nastaveni.put({ klic: PRESETY_KLIC, hodnota: list });
  }

  function otevritUlozit() {
    saveName = '';
    saveModal = true;
  }

  async function potvrditUlozit() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    const novy: FilterPreset = {
      id: newId(),
      nazev: trimmed,
      sezony: [...selectedSezony],
      souteze: [...selectedSouteze],
      kategorie: [...selectedKategorie],
      hraci: [...selectedHraci],
      vytvoreno_at: Date.now(),
    };
    await ulozPresety([...presety, novy]);
    saveModal = false;
  }

  function aplikovatPreset(p: FilterPreset) {
    selectedSezony = [...p.sezony];
    selectedSouteze = [...p.souteze];
    selectedKategorie = [...p.kategorie];
    selectedHraci = [...p.hraci];
  }

  async function smazatPreset(p: FilterPreset) {
    if (!confirm(`Smazat preset "${p.nazev}"?`)) return;
    await ulozPresety(presety.filter((x) => x.id !== p.id));
  }

  function arraysSetEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    const sa = new Set(a);
    for (const x of b) if (!sa.has(x)) return false;
    return true;
  }

  function presetMatchesCurrent(p: FilterPreset): boolean {
    return (
      arraysSetEqual(p.sezony, selectedSezony) &&
      arraysSetEqual(p.souteze, selectedSouteze) &&
      arraysSetEqual(p.kategorie, selectedKategorie) &&
      arraysSetEqual(p.hraci, selectedHraci)
    );
  }

  function maAktivniFiltr(): boolean {
    return (
      selectedSezony.length > 0 ||
      selectedSouteze.length > 0 ||
      selectedKategorie.length > 0 ||
      selectedHraci.length > 0 ||
      selectedZapasId !== null
    );
  }

  function resetFiltry() {
    selectedSezony = [];
    selectedSouteze = [];
    selectedKategorie = [];
    selectedHraci = [];
    selectedZapasId = null;
    casoveOkno = 'cela';
  }

  const allSezony = $derived([...new Set(zapasy.map((z) => z.sezona))].sort().reverse());
  const allKategorie = $derived(
    [...new Set(zapasy.map((z) => z.nase_kategorie))].sort(
      (a, b) => KATEGORIE_PORADI.indexOf(a) - KATEGORIE_PORADI.indexOf(b),
    ),
  );
  const allSouteze = $derived(souteze.filter((s) => zapasy.some((z) => z.soutez_id === s.id)));

  const zapasyDleZakladnichFiltru = $derived(
    zapasy.filter((z) => {
      if (selectedSezony.length > 0 && !selectedSezony.includes(z.sezona)) return false;
      if (selectedSouteze.length > 0 && !selectedSouteze.includes(z.soutez_id)) return false;
      if (selectedKategorie.length > 0 && !selectedKategorie.includes(z.nase_kategorie)) return false;
      return true;
    }),
  );

  const filteredZapasy = $derived(
    selectedZapasId && zapasyDleZakladnichFiltru.some((z) => z.id === selectedZapasId)
      ? zapasyDleZakladnichFiltru.filter((z) => z.id === selectedZapasId)
      : zapasyDleZakladnichFiltru,
  );

  const zapasyProVyber = $derived(
    [...zapasyDleZakladnichFiltru].sort((a, b) => b.datum.localeCompare(a.datum)),
  );

  const zapasIds = $derived(new Set(filteredZapasy.map((z) => z.id)));
  const filteredUd = $derived(udalosti.filter((u) => zapasIds.has(u.zapas_id)));
  const filteredCt = $derived(ctvrtiny.filter((c) => zapasIds.has(c.zapas_id)));

  const windowFilteredUd = $derived(
    filtrEventyVOkne(filteredUd, filteredCt, filteredZapasy, casoveOkno),
  );
  const aggregates = $derived(
    aggregateAcrossMatches(filteredZapasy, windowFilteredUd, filteredCt),
  );
  const finishedZapasy = $derived(filteredZapasy.filter((z) => z.status === 'ukonceny'));
  const teamRecord = $derived(computeTeamRecord(finishedZapasy));
  const klokPouzitFiltr = $derived(klokByPouzit(filteredUd));
  const oknoAktivni = $derived(casoveOkno !== 'cela');
  const stavByZapasId = $derived(
    new Map(zapasyDleZakladnichFiltru.map((z) => [z.id, computeZapasStav(z, ctvrtiny)])),
  );
  const liveCount = $derived(
    filteredZapasy.filter((z) => z.status === 'rozehrany').length,
  );

  const hracByID = $derived(new Map(hraci.map((h) => [h.id, h])));
  const souperByID = $derived(new Map(souperi.map((s) => [s.id, s])));
  const soutezByID = $derived(new Map(souteze.map((s) => [s.id, s])));

  const hraciCandidates = $derived(
    [...aggregates.keys()]
      .map((id) => hracByID.get(id))
      .filter((h): h is Hrac => !!h)
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99)),
  );

  const rows = $derived(
    (() => {
      const ids =
        selectedHraci.length > 0
          ? selectedHraci.filter((id) => aggregates.has(id))
          : [...aggregates.keys()];
      return ids
        .map((id) => ({ h: hracByID.get(id), agg: aggregates.get(id)! }))
        .filter((r): r is { h: Hrac; agg: ReturnType<typeof aggregates.get> & object } => !!r.h)
        .sort((a, b) => (a.h.cislo_dresu ?? 99) - (b.h.cislo_dresu ?? 99));
    })(),
  );

  const sortedZapasy = $derived(
    [...filteredZapasy].sort((a, b) => b.datum.localeCompare(a.datum)),
  );

  const teamAgg = $derived.by(() => {
    let body = 0, pokusy_2 = 0, dany_2 = 0, pokusy_3 = 0, dany_3 = 0;
    let pokusy_th = 0, dany_th = 0, fauly = 0;
    let doskoky_off = 0, doskoky_def = 0;
    let zisky = 0, ztraty = 0, asistence = 0, bloky = 0, minuty_ms = 0;
    for (const agg of aggregates.values()) {
      body += agg.body;
      pokusy_2 += agg.pokusy_2; dany_2 += agg.dany_2;
      pokusy_3 += agg.pokusy_3; dany_3 += agg.dany_3;
      pokusy_th += agg.pokusy_th; dany_th += agg.dany_th;
      fauly += agg.fauly;
      doskoky_off += agg.doskoky_off;
      doskoky_def += agg.doskoky_def;
      zisky += agg.zisky;
      ztraty += agg.ztraty;
      asistence += agg.asistence;
      bloky += agg.bloky;
      minuty_ms += agg.minuty_ms;
    }
    return {
      gp: filteredZapasy.length,
      body, pokusy_2, dany_2, pokusy_3, dany_3, pokusy_th, dany_th,
      fauly, doskoky_off, doskoky_def, zisky, ztraty, asistence, bloky, minuty_ms,
    };
  });

  async function liveBack() {
    liveZapasId = null;
    zapasy = await db.zapasy.toArray();
    udalosti = await db.udalosti.toArray();
    ctvrtiny = await db.ctvrtiny.toArray();
  }

  function toggleSezona(v: string) {
    selectedSezony = selectedSezony.includes(v) ? selectedSezony.filter((x) => x !== v) : [...selectedSezony, v];
  }
  function toggleSoutez(v: string) {
    selectedSouteze = selectedSouteze.includes(v) ? selectedSouteze.filter((x) => x !== v) : [...selectedSouteze, v];
  }
  function toggleKategorie(v: Kategorie) {
    selectedKategorie = selectedKategorie.includes(v) ? selectedKategorie.filter((x) => x !== v) : [...selectedKategorie, v];
  }
  function toggleHrac(v: string) {
    selectedHraci = selectedHraci.includes(v) ? selectedHraci.filter((x) => x !== v) : [...selectedHraci, v];
  }

  function fmtNum(total: number, gp: number, decimals = DECIMALS_PER_GAME): string {
    if (!perGame) return String(total);
    if (gp === 0) return '0';
    return (total / gp).toFixed(decimals);
  }

  function fmtMinutes(total: number, gp: number): string {
    if (oknoAktivni) return '—';
    if (!klokPouzitFiltr) return '—';
    if (!perGame) return formatMinSec(total);
    if (gp === 0) return '0:00';
    return formatMinSec(total / gp);
  }

  function fmtRatio(made: number, att: number, gp: number): string {
    if (perGame && gp > 0) return `${(made / gp).toFixed(1)}/${(att / gp).toFixed(1)}`;
    return `${made}/${att}`;
  }

  function fmtPM(total: number, gp: number): string {
    if (oknoAktivni) return '—';
    if (perGame && gp > 0) {
      const avg = total / gp;
      return (avg > 0 ? '+' : '') + avg.toFixed(1);
    }
    return total > 0 ? `+${total}` : String(total);
  }

  function fmtDatum(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  }

  function fmtDatumKratce(d: string): string {
    const [, m, day] = d.split('-');
    return `${Number(day)}.${Number(m)}.`;
  }

  function otevriZapas(z: Zapas) {
    liveZapasId = z.id;
  }
</script>

{#if liveZapasId}
  <ZapasLive zapasId={liveZapasId} onBack={liveBack} />
{:else}
<div class="toolbar">
  <h2>
    Statistiky ({filteredZapasy.length}{filteredZapasy.length !== zapasy.length ? ` z ${zapasy.length}` : ''} {filteredZapasy.length === 1 ? 'zápas' : 'zápasy'}{#if liveCount > 0}, <span class="live-hint">{liveCount} právě běží</span>{/if})
  </h2>
  <label class="pergame-toggle">
    <input type="checkbox" bind:checked={perGame} />
    <span>Per game (průměr na zápas)</span>
  </label>
</div>

{#if zapasy.length === 0}
  <div class="empty">
    Žádné ukončené zápasy. Po skončení prvního zápasu se zde objeví statistiky.
  </div>
{:else}
  <section class="presets">
    <span class="preset-label">Presety</span>
    <div class="preset-chips">
      {#each presety as p (p.id)}
        {@const active = presetMatchesCurrent(p)}
        <span class="preset-wrap" class:on={active}>
          <button class="preset-chip" class:on={active} onclick={() => aplikovatPreset(p)} title="Aplikovat">
            {p.nazev}
          </button>
          <button class="preset-x" onclick={() => smazatPreset(p)} title="Smazat preset">×</button>
        </span>
      {/each}
      {#if presety.length === 0}
        <span class="preset-hint">Vyber filtry a klikni "+ Uložit" pro vytvoření prvního presetu</span>
      {/if}
    </div>
    <div class="preset-actions">
      {#if maAktivniFiltr()}
        <button class="preset-reset" onclick={resetFiltry} title="Vyčistit všechny filtry">↺ Vše</button>
      {/if}
      <button class="preset-save" onclick={otevritUlozit} disabled={!maAktivniFiltr()} title={maAktivniFiltr() ? 'Uložit aktuální filtr jako preset' : 'Nejdřív vyber nějaký filtr'}>
        + Uložit
      </button>
    </div>
  </section>

  <section class="filters">
    <div class="filter-group">
      <span class="fg-label">Sezona</span>
      <div class="chips">
        {#each allSezony as s}
          <button class="chip" class:on={selectedSezony.includes(s)} onclick={() => toggleSezona(s)}>{s}</button>
        {/each}
        {#if selectedSezony.length > 0}
          <button class="chip clear" onclick={() => selectedSezony = []}>× zrušit výběr</button>
        {/if}
      </div>
    </div>

    <div class="filter-group">
      <span class="fg-label">Soutěž</span>
      <div class="chips">
        {#each allSouteze as s}
          <button class="chip" class:on={selectedSouteze.includes(s.id)} onclick={() => toggleSoutez(s.id)}>{s.nazev}</button>
        {/each}
        {#if selectedSouteze.length > 0}
          <button class="chip clear" onclick={() => selectedSouteze = []}>× zrušit výběr</button>
        {/if}
      </div>
    </div>

    <div class="filter-group">
      <span class="fg-label">Kategorie</span>
      <div class="chips">
        {#each allKategorie as k}
          <button class="chip" class:on={selectedKategorie.includes(k)} onclick={() => toggleKategorie(k)}>{kategorieLabel(k)}</button>
        {/each}
        {#if selectedKategorie.length > 0}
          <button class="chip clear" onclick={() => selectedKategorie = []}>× zrušit výběr</button>
        {/if}
      </div>
    </div>

    <div class="filter-group">
      <span class="fg-label">Zápas</span>
      <select
        class="zapas-select"
        value={selectedZapasId ?? ''}
        disabled={zapasyProVyber.length === 0}
        onchange={(e) => (selectedZapasId = e.currentTarget.value || null)}
      >
        <option value="">— součet za celý filtr ({zapasyProVyber.length} {zapasyProVyber.length === 1 ? 'zápas' : 'zápasů'}) —</option>
        {#each zapasyProVyber as z (z.id)}
          {@const stav = stavByZapasId.get(z.id)}
          {@const live = stav && stav.kind !== 'ukonceny' && stav.kind !== 'preruseny'}
          <option value={z.id}>
            {fmtDatumKratce(z.datum)} · {souperByID.get(z.souper_id)?.nazev ?? '?'} ({z.nase_strana === 'home' ? 'D' : 'H'}) · {z.skore_nase}:{z.skore_souper}{live ? ' · ▶ běží' : ''}
          </option>
        {/each}
      </select>
      {#if selectedZapasId}
        <button class="chip clear" onclick={() => selectedZapasId = null}>× zrušit výběr</button>
      {/if}
      <p class="okno-hint">
        Bez výběru = součet za celou kategorii/soutěž dle filtrů. Vyber jeden zápas (i právě běžící) pro statistiky jen z něj.
      </p>
    </div>

    <div class="filter-group">
      <span class="fg-label">Část čtvrtiny</span>
      <div class="chips">
        <button class="chip" class:on={casoveOkno === 'cela'} onclick={() => casoveOkno = 'cela'}>Celá Q</button>
        <button class="chip" class:on={casoveOkno === 'prvni_pol'} onclick={() => casoveOkno = 'prvni_pol'}>1. polovina Q</button>
        <button class="chip" class:on={casoveOkno === 'druha_pol'} onclick={() => casoveOkno = 'druha_pol'}>2. polovina Q</button>
      </div>
      <p class="okno-hint">
        Počítat statistiky jen z první nebo druhé poloviny každé čtvrtiny (podle stopek) - např. jak hrajeme na začátku vs. na konci čtvrtin. „Celá Q" = celá čtvrtina (běžné nastavení).
        {#if oknoAktivni}
          <br>Pro Q bez stopek se půlka odhaduje z reálného času (zahrnuje pauzy). Min a +/- jsou v tomto režimu „—". Korekce skóre po zápase se nezapočítávají.
        {/if}
      </p>
    </div>

    {#if tab === 'hraci'}
      <div class="filter-group">
        <span class="fg-label">Hráči (porovnání)</span>
        <div class="chips chips-hraci">
          {#each hraciCandidates as h}
            <button class="chip chip-hrac" class:on={selectedHraci.includes(h.id)} onclick={() => toggleHrac(h.id)}>
              <span class="chip-num">#{h.cislo_dresu ?? '?'}</span>
              <span class="chip-name">{h.prijmeni}</span>
            </button>
          {/each}
          {#if selectedHraci.length > 0}
            <button class="chip clear" onclick={() => selectedHraci = []}>× zrušit výběr</button>
          {/if}
        </div>
      </div>
    {/if}
  </section>

  <section class="tabs">
    <button class:active={tab === 'hraci'} onclick={() => tab = 'hraci'}>Hráči ({hraciCandidates.length})</button>
    <button class:active={tab === 'tym'} onclick={() => tab = 'tym'}>Tým</button>
  </section>

  {#if filteredZapasy.length === 0}
    <div class="empty">Žádný zápas neodpovídá filtru.</div>
  {:else if tab === 'hraci'}
    <section class="boxscore">
      <div class="bs-scroll">
        <table class="bs-table">
          <thead>
            <tr>
              <th class="th-sticky" colspan="2">Hráč</th>
              <th title="Games played">GP</th>
              <th title={perGame ? 'Min na zápas' : 'Celkem minut'}>Min</th>
              <th title={perGame ? 'PPG (body/zápas)' : 'Celkem bodů'}>PTS</th>
              <th>2P</th>
              <th>3P</th>
              <th>FT</th>
              <th title="Doskok útočný">OFF</th>
              <th title="Doskok obranný">DEF</th>
              <th title="Doskoky celkem (OFF+DEF)">REB</th>
              <th title="Asistence">AST</th>
              <th title="Zisky">STL</th>
              <th title="Ztráty">TO</th>
              <th title="Bloky">BLK</th>
              <th title="Osobní fauly">PF</th>
              <th title="Plus/minus">+/-</th>
              <th title="Efficiency">EFF</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.h.id)}
              <tr>
                <td class="td-avatar"><Avatar foto={r.h.foto} cislo={r.h.cislo_dresu} size={HRAC_AVATAR_SIZE} alt={`${r.h.jmeno} ${r.h.prijmeni}`} /></td>
                <td class="td-name">
                  <div class="bs-name">{r.h.prijmeni} {r.h.jmeno}</div>
                  <div class="bs-meta">#{r.h.cislo_dresu ?? '?'} · {kategorieLabel(r.h.domaci_kategorie)}{r.h.pozice ? ` · ${r.h.pozice}` : ''}</div>
                </td>
                <td class="td-mono">{r.agg.gp}</td>
                <td class="td-mono">{fmtMinutes(r.agg.minuty_ms, r.agg.gp)}</td>
                <td class="td-mono td-pts">{fmtNum(r.agg.body, r.agg.gp)}</td>
                <td class="td-mono">{fmtRatio(r.agg.dany_2, r.agg.pokusy_2, r.agg.gp)}</td>
                <td class="td-mono">{fmtRatio(r.agg.dany_3, r.agg.pokusy_3, r.agg.gp)}</td>
                <td class="td-mono">{fmtRatio(r.agg.dany_th, r.agg.pokusy_th, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.doskoky_off, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.doskoky_def, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.doskoky_off + r.agg.doskoky_def, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.asistence, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.zisky, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.ztraty, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.bloky, r.agg.gp)}</td>
                <td class="td-mono">{fmtNum(r.agg.fauly, r.agg.gp)}</td>
                <td class="td-mono td-pm" class:pm-plus={!oknoAktivni && r.agg.plus_minus > 0} class:pm-minus={!oknoAktivni && r.agg.plus_minus < 0}>{fmtPM(r.agg.plus_minus, r.agg.gp)}</td>
                <td class="td-mono td-eff">{fmtNum(r.agg.efficiency, r.agg.gp)}</td>
              </tr>
            {/each}
            {#if rows.length === 0}
              <tr><td colspan="18" class="empty-row">Žádný hráč v této kombinaci filtrů.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </section>
  {:else}
    <section class="tym-tab">
      <div class="tym-cards">
        <div class="tym-card">
          <div class="tym-card-l">Bilance</div>
          <div class="tym-card-v big">{teamRecord.vyhry} <span class="sep">–</span> {teamRecord.prohry}{#if teamRecord.remizy > 0}<span class="sep">–</span> {teamRecord.remizy}{/if}</div>
          <div class="tym-card-meta">{teamRecord.gp} {teamRecord.gp === 1 ? 'zápas' : 'zápasů'}</div>
        </div>
        <div class="tym-card">
          <div class="tym-card-l">Body dáno (Ø)</div>
          <div class="tym-card-v big">{teamRecord.prumer_body_dany.toFixed(1)}</div>
          <div class="tym-card-meta">celkem {teamRecord.body_dany}</div>
        </div>
        <div class="tym-card">
          <div class="tym-card-l">Body dostáno (Ø)</div>
          <div class="tym-card-v big">{teamRecord.prumer_body_dostane.toFixed(1)}</div>
          <div class="tym-card-meta">celkem {teamRecord.body_dostane}</div>
        </div>
      </div>

      <section class="boxscore tym-totals">
        <h3>Týmové statistiky</h3>
        <div class="bs-scroll">
          <table class="bs-table">
            <thead>
              <tr>
                <th title="Games played">GP</th>
                <th title={perGame ? 'Min na zápas' : 'Celkem minut'}>Min</th>
                <th title={perGame ? 'PPG (body/zápas)' : 'Celkem bodů'}>PTS</th>
                <th>2P</th>
                <th>3P</th>
                <th>FT</th>
                <th title="Doskok útočný">OFF</th>
                <th title="Doskok obranný">DEF</th>
                <th title="Doskoky celkem (OFF+DEF)">REB</th>
                <th title="Asistence">AST</th>
                <th title="Zisky">STL</th>
                <th title="Ztráty">TO</th>
                <th title="Bloky">BLK</th>
                <th title="Osobní fauly">PF</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="td-mono">{teamAgg.gp}</td>
                <td class="td-mono">{fmtMinutes(teamAgg.minuty_ms, teamAgg.gp)}</td>
                <td class="td-mono td-pts">{fmtNum(teamAgg.body, teamAgg.gp)}</td>
                <td class="td-mono">{fmtRatio(teamAgg.dany_2, teamAgg.pokusy_2, teamAgg.gp)}</td>
                <td class="td-mono">{fmtRatio(teamAgg.dany_3, teamAgg.pokusy_3, teamAgg.gp)}</td>
                <td class="td-mono">{fmtRatio(teamAgg.dany_th, teamAgg.pokusy_th, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.doskoky_off, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.doskoky_def, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.doskoky_off + teamAgg.doskoky_def, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.asistence, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.zisky, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.ztraty, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.bloky, teamAgg.gp)}</td>
                <td class="td-mono">{fmtNum(teamAgg.fauly, teamAgg.gp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="zapasy-list">
        <h3>Zápasy</h3>
        <table class="bs-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Kat.</th>
              <th>Soupeř</th>
              <th>Soutěž</th>
              <th>Sezona</th>
              <th>Skóre</th>
              <th>Výsledek</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedZapasy as z (z.id)}
              {@const vyhra = z.skore_nase > z.skore_souper}
              {@const prohra = z.skore_nase < z.skore_souper}
              {@const stav = stavByZapasId.get(z.id)}
              {@const live = stav && stav.kind !== 'ukonceny' && stav.kind !== 'preruseny'}
              <tr class="zapas-row" class:row-live={live} class:row-preruseny={stav?.kind === 'preruseny'} onclick={() => otevriZapas(z)} title="Otevřít detail zápasu">
                <td>{fmtDatum(z.datum)}</td>
                <td class="td-mono">{kategorieLabel(z.nase_kategorie)}</td>
                <td class="td-name">{souperByID.get(z.souper_id)?.nazev ?? '— ?'} <span class="strana">({z.nase_strana === 'home' ? 'D' : 'H'})</span></td>
                <td>{soutezByID.get(z.soutez_id)?.nazev ?? '— ?'}</td>
                <td class="td-mono">{z.sezona}</td>
                <td class="td-mono td-pts">{z.skore_nase}:{z.skore_souper}</td>
                <td>
                  {#if stav && stav.kind === 'ukonceny'}
                    {#if vyhra}
                      <span class="result-pill v">V</span>
                    {:else if prohra}
                      <span class="result-pill p">P</span>
                    {:else}
                      <span class="result-pill r">R</span>
                    {/if}
                  {:else if stav}
                    <span class="stav-badge stav-{stav.kind}">
                      {#if stav.kind === 'bezi'}<span class="dot"></span>{/if}
                      {stav.label}
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
{/if}
{/if}

{#if saveModal}
  <div class="modal-bg" onclick={() => saveModal = false} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
      <h2>Uložit preset filtrů</h2>
      <p class="modal-hint">Zadej název presetu. Aktuální výběr filtrů se uloží pod tímto názvem.</p>
      <div class="preset-summary">
        {#if selectedSezony.length > 0}<span class="ps-chip">Sezona: {selectedSezony.join(', ')}</span>{/if}
        {#if selectedSouteze.length > 0}<span class="ps-chip">Soutěž: {selectedSouteze.map(id => soutezByID.get(id)?.nazev ?? '?').join(', ')}</span>{/if}
        {#if selectedKategorie.length > 0}<span class="ps-chip">Kat.: {selectedKategorie.map(kategorieLabel).join(', ')}</span>{/if}
        {#if selectedHraci.length > 0}<span class="ps-chip">Hráči: {selectedHraci.length}</span>{/if}
      </div>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="preset-input"
        bind:value={saveName}
        type="text"
        placeholder="např. Liga + Extraliga 2025/26"
        autofocus
        onkeydown={(e) => e.key === 'Enter' && potvrditUlozit()}
      />
      <div class="modal-buttons">
        <button onclick={() => saveModal = false}>Zrušit</button>
        <button class="primary" disabled={!saveName.trim()} onclick={potvrditUlozit}>Uložit</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .toolbar h2 { font-size: 22px; color: var(--text); }
  .pergame-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
  }
  .pergame-toggle input { width: 16px; height: 16px; cursor: pointer; }

  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
  }

  .filters {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: var(--shadow);
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .fg-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    min-width: 130px;
  }
  .okno-hint {
    flex-basis: 100%;
    margin: 4px 0 0 130px;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.45;
  }
  @media (max-width: 700px) {
    .okno-hint { margin-left: 0; }
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
  }
  .chip {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.1s ease;
  }
  .chip:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .chip.on {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .chip.clear {
    background: transparent;
    border-color: var(--danger);
    color: var(--danger);
  }
  .chip.clear:hover { background: var(--danger-bg); }
  .chip-hrac {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .chip-num {
    font-family: "Consolas", monospace;
    opacity: 0.85;
  }
  .zapas-select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 7px 12px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    max-width: 100%;
    min-width: 260px;
  }
  .zapas-select:hover:not(:disabled) { border-color: var(--border-strong); }
  .zapas-select:focus { outline: none; border-color: var(--accent); }
  .zapas-select:disabled { opacity: 0.5; cursor: not-allowed; }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--border);
  }
  .tabs button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
  }
  .tabs button:hover { color: var(--text); }
  .tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .boxscore {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
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
    min-width: 1100px;
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
  .td-avatar { width: 40px; padding-left: 6px; padding-right: 0; }
  .td-name {
    text-align: left;
    font-weight: 600;
    padding-left: 6px;
    white-space: nowrap;
  }
  .bs-name { font-weight: 600; }
  .bs-meta { font-size: 11px; color: var(--text-muted); font-weight: 400; }
  .td-mono { font-family: "Consolas", monospace; font-variant-numeric: tabular-nums; }
  .td-pts { font-weight: 700; color: var(--accent); }
  .td-pm.pm-plus { color: var(--success); font-weight: 700; }
  .td-pm.pm-minus { color: var(--danger); font-weight: 700; }
  .td-eff { font-weight: 700; }
  .empty-row {
    text-align: center !important;
    color: var(--text-muted);
    padding: 24px !important;
    font-style: italic;
  }

  .tym-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .tym-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .tym-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
  }
  .tym-card-l {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .tym-card-v.big {
    font-family: "Consolas", monospace;
    font-size: 36px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  .tym-card-v .sep { color: var(--text-muted); margin: 0 4px; }
  .tym-card-meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 6px;
  }

  .zapasy-list {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
  }
  .zapasy-list h3 {
    font-size: 15px;
    color: var(--accent);
    margin-bottom: 12px;
    font-weight: 700;
  }
  .zapasy-list .bs-table { min-width: auto; }
  .zapasy-list .strana { color: var(--text-muted); font-weight: 400; font-size: 12px; }
  .zapas-row {
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .zapas-row:hover {
    background: var(--surface-hover);
  }

  .tym-totals {
    margin-top: 16px;
    margin-bottom: 16px;
  }
  .tym-totals h3 {
    font-size: 15px;
    color: var(--accent);
    margin-bottom: 12px;
    font-weight: 700;
  }

  .result-pill {
    display: inline-block;
    width: 26px;
    height: 26px;
    line-height: 26px;
    text-align: center;
    border-radius: 50%;
    font-weight: 700;
    font-size: 12px;
  }
  .result-pill.v { background: var(--success-bg); color: var(--success-fg); }
  .result-pill.p { background: var(--danger-bg); color: var(--danger-fg); }
  .result-pill.r { background: var(--surface-2); color: var(--text-muted); }

  .live-hint {
    color: #ea580c;
    font-weight: 700;
    font-size: 0.85em;
  }
  .zapas-row.row-live td:first-child {
    border-left: 3px solid #ea580c;
  }
  .zapas-row.row-preruseny td:first-child {
    border-left: 3px solid var(--text-muted);
  }
  .stav-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .stav-badge.stav-bezi {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fdba74;
  }
  .stav-badge.stav-polocas {
    background: #fef9c3;
    color: #854d0e;
    border: 1px solid #fde047;
  }
  .stav-badge.stav-mezi_q {
    background: #fef9c3;
    color: #854d0e;
    border: 1px solid #fde047;
  }
  .stav-badge.stav-pred_zapasem {
    background: var(--surface-2);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .stav-badge.stav-preruseny {
    background: var(--surface-2);
    color: var(--text-muted);
    border: 1px dashed var(--border-strong);
  }
  .stav-badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ea580c;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.15); }
  }

  .presets {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: var(--shadow);
  }
  .preset-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    min-width: 60px;
  }
  .preset-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    align-items: center;
  }
  .preset-wrap {
    display: inline-flex;
    align-items: stretch;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface-2);
    transition: all 0.1s ease;
  }
  .preset-wrap.on {
    border-color: var(--accent);
    background: var(--accent);
  }
  .preset-chip {
    background: transparent;
    border: none;
    color: var(--text);
    padding: 6px 12px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .preset-chip.on { color: var(--accent-fg); }
  .preset-x {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 6px 10px 6px 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }
  .preset-x:hover { color: var(--danger); }
  .preset-wrap.on .preset-x { color: rgba(255, 255, 255, 0.7); }
  .preset-wrap.on .preset-x:hover { color: #ffe0e0; }
  .preset-hint {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
  .preset-actions {
    display: flex;
    gap: 6px;
  }
  .preset-save, .preset-reset {
    background: var(--surface-hover);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 14px;
    border-radius: 999px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .preset-save:hover:not(:disabled), .preset-reset:hover {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .preset-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 500px;
    max-width: 92vw;
    box-shadow: var(--shadow-strong);
  }
  .modal h2 { font-size: 18px; color: var(--accent); margin-bottom: 8px; }
  .modal-hint {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  .preset-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .ps-chip {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .preset-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 12px 14px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  .preset-input:focus { outline: none; border-color: var(--accent); }
  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }
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
  .modal-buttons button.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .modal-buttons button.primary:hover:not(:disabled) { background: var(--accent-hover); }
  .modal-buttons button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
