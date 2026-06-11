<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import {
    KATEGORIE_PORADI,
    kategorieLabel,
    type Zapas,
    type Souper,
    type Soutez,
    type Kategorie,
    type ZapasStatus,
  } from '../lib/types';
  import ZapasSetupForm from '../components/ZapasSetupForm.svelte';
  import ZapasLive from './ZapasLive.svelte';

  const STATUSY: (ZapasStatus | 'vse')[] = ['vse', 'rozehrany', 'ukonceny', 'preruseny'];

  let zapasy = $state<Zapas[]>([]);
  let souperi = $state<Map<string, Souper>>(new Map());
  let souteze = $state<Map<string, Soutez>>(new Map());

  let filterStatus = $state<ZapasStatus | 'vse'>('vse');
  let filterKategorie = $state<Kategorie | 'vse'>('vse');
  let filterSezona = $state('');

  let zobrazSetup = $state(false);
  let liveZapasId = $state<string | null>(null);

  onMount(reload);

  async function reload() {
    const [zList, sList, ligaList] = await Promise.all([
      db.zapasy.orderBy('datum').reverse().toArray(),
      db.souperi.toArray(),
      db.souteze.toArray(),
    ]);
    zapasy = zList;
    souperi = new Map(sList.map((s) => [s.id, s]));
    souteze = new Map(ligaList.map((s) => [s.id, s]));
  }

  async function smazat(z: Zapas) {
    const nazev = `${formatDatum(z.datum)} ${souperi.get(z.souper_id)?.nazev ?? '?'}`;
    if (!confirm(`Smazat zápas ${nazev}?\n\nTato akce smaže i všechny události a čtvrtiny.`)) return;
    await db.transaction('rw', db.zapasy, db.ctvrtiny, db.udalosti, async () => {
      await db.udalosti.where('zapas_id').equals(z.id).delete();
      await db.ctvrtiny.where('zapas_id').equals(z.id).delete();
      await db.zapasy.delete(z.id);
    });
    await reload();
  }

  function pokracovat(z: Zapas) {
    liveZapasId = z.id;
  }

  function zobrazit(z: Zapas) {
    liveZapasId = z.id;
  }

  async function liveBack() {
    liveZapasId = null;
    await reload();
  }

  function formatDatum(d: string): string {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  }

  function novy() {
    zobrazSetup = true;
  }

  async function zalozeno(id: string) {
    zobrazSetup = false;
    await reload();
    liveZapasId = id;
  }

  const filtrovani = $derived(
    zapasy.filter((z) => {
      if (filterStatus !== 'vse' && z.status !== filterStatus) return false;
      if (filterKategorie !== 'vse' && z.nase_kategorie !== filterKategorie) return false;
      if (filterSezona && !z.sezona.toLowerCase().includes(filterSezona.toLowerCase())) return false;
      return true;
    })
  );

  function statusBarva(s: ZapasStatus): string {
    if (s === 'rozehrany') return 'live';
    if (s === 'ukonceny') return 'done';
    return 'aborted';
  }

  function statusPopisek(s: ZapasStatus): string {
    if (s === 'rozehrany') return 'rozehraný';
    if (s === 'ukonceny') return 'ukončený';
    return 'přerušený';
  }
</script>

{#if liveZapasId}
  <ZapasLive zapasId={liveZapasId} onBack={liveBack} />
{:else}
<div class="toolbar">
  <h2>Zápasy ({filtrovani.length}{filtrovani.length !== zapasy.length ? ` z ${zapasy.length}` : ''})</h2>
  <button class="primary" onclick={novy}>+ Nový zápas</button>
</div>

<div class="filters">
  <input bind:value={filterSezona} type="text" placeholder="Sezona (např. 2025/26)…" />
  <select bind:value={filterKategorie}>
    <option value="vse">Všechny kategorie</option>
    {#each KATEGORIE_PORADI as k}
      <option value={k}>{kategorieLabel(k)}</option>
    {/each}
  </select>
  <select bind:value={filterStatus}>
    {#each STATUSY as s}
      <option value={s}>{s === 'vse' ? 'Všechny stavy' : statusPopisek(s)}</option>
    {/each}
  </select>
</div>

{#if filtrovani.length === 0}
  <div class="empty">
    {#if zapasy.length === 0}
      Žádné zápasy zatím nebyly založeny. Klikni na "Nový zápas".
    {:else}
      Žádný zápas neodpovídá filtru.
    {/if}
  </div>
{:else}
  <div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Kat.</th>
        <th>Soupeř</th>
        <th>Soutěž</th>
        <th>Sezona</th>
        <th>Skóre</th>
        <th>Stav</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each filtrovani as z (z.id)}
        <tr>
          <td>{formatDatum(z.datum)}</td>
          <td class="kat">{kategorieLabel(z.nase_kategorie)}</td>
          <td class="souper">
            {souperi.get(z.souper_id)?.nazev ?? '- ?'}
            <span class="strana">({z.nase_strana === 'home' ? 'D' : 'H'})</span>
          </td>
          <td>{souteze.get(z.soutez_id)?.nazev ?? '- ?'}</td>
          <td>{z.sezona}</td>
          <td class="skore">
            {#if z.status === 'rozehrany' && z.skore_nase === 0 && z.skore_souper === 0}
              -
            {:else}
              {z.skore_nase}:{z.skore_souper}
            {/if}
          </td>
          <td>
            <span class="status status-{statusBarva(z.status)}">{statusPopisek(z.status)}</span>
          </td>
          <td class="actions">
            {#if z.status === 'rozehrany'}
              <button class="primary" onclick={() => pokracovat(z)}>Pokračovat</button>
            {:else}
              <button onclick={() => zobrazit(z)}>Detail</button>
            {/if}
            <button class="danger" onclick={() => smazat(z)}>Smazat</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  </div>
{/if}

{#if zobrazSetup}
  <ZapasSetupForm onClose={() => zobrazSetup = false} onSaved={zalozeno} />
{/if}
{/if}

<style>
  .toolbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap; gap: 10px;
  }
  .toolbar h2 { font-size: 22px; color: var(--text); }
  .filters {
    display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
  }
  .filters input, .filters select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  .filters input { flex: 1; min-width: 200px; }
  .empty {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 40px; text-align: center; color: var(--text-muted);
  }
  .table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 8px;
  }
  table {
    width: 100%; min-width: 680px; border-collapse: collapse;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  th, td {
    text-align: left; padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--surface-2);
    font-size: 12px; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 1px;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--surface-2); }
  td.kat { font-weight: 600; color: var(--accent); }
  td.souper { font-weight: 600; }
  td.souper .strana { color: var(--text-muted); font-weight: 400; font-size: 12px; }
  td.skore { font-weight: 700; font-family: "Consolas", monospace; }
  .status {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-live { background: var(--success-bg); color: var(--success-fg); }
  .status-done { background: var(--selected-bg); color: var(--selected-fg); }
  .status-aborted { background: var(--danger-bg); color: var(--danger-fg); }
  td.actions { display: flex; gap: 6px; justify-content: flex-end; }
  button {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 6px 12px;
    font-size: 13px; font-weight: 600;
    border-radius: 4px; cursor: pointer;
    font-family: inherit;
  }
  button:hover { background: var(--border-strong); color: var(--accent-fg); }
  button.primary {
    background: var(--accent); color: var(--accent-fg);
  }
  button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  button.danger { background: var(--danger); color: var(--accent-fg); }
  button.danger:hover { background: var(--danger-hover); color: var(--accent-fg); }

  .toolbar button.primary {
    padding: 10px 18px;
    font-size: 14px;
  }

  @media (max-width: 600px) {
    th, td { padding: 8px 10px; }
  }
</style>
