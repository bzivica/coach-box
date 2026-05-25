<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import { KATEGORIE_PORADI, kategorieLabel, vypoctiVek, type Hrac, type Kategorie } from '../lib/types';
  import HracForm from '../components/HracForm.svelte';
  import Avatar from '../components/Avatar.svelte';

  const TABLE_AVATAR_SIZE = 40;

  let hraci = $state<Hrac[]>([]);
  let filterKategorie = $state<Kategorie | 'vse'>('vse');
  let filterAktivni = $state<'vse' | 'ano' | 'ne'>('ano');
  let hledat = $state('');

  let zobrazFormular = $state(false);
  let editovany = $state<Hrac | undefined>(undefined);

  onMount(reload);

  async function reload() {
    hraci = await db.hraci.orderBy('prijmeni').toArray();
  }

  function novy() {
    editovany = undefined;
    zobrazFormular = true;
  }

  function upravit(h: Hrac) {
    editovany = h;
    zobrazFormular = true;
  }

  async function smazat(h: Hrac) {
    if (!confirm(`Smazat hráče #${h.cislo_dresu} ${h.jmeno} ${h.prijmeni}?`)) return;
    await db.hraci.delete(h.id);
    await reload();
  }

  function zavri() {
    zobrazFormular = false;
    editovany = undefined;
  }

  async function ulozeno() {
    zavri();
    await reload();
  }

  const filtrovani = $derived(
    hraci.filter((h) => {
      if (filterKategorie !== 'vse' && h.domaci_kategorie !== filterKategorie) return false;
      if (filterAktivni === 'ano' && !h.aktivni) return false;
      if (filterAktivni === 'ne' && h.aktivni) return false;
      if (hledat) {
        const q = hledat.toLowerCase();
        if (!`${h.jmeno} ${h.prijmeni}`.toLowerCase().includes(q) && !String(h.cislo_dresu).includes(q)) return false;
      }
      return true;
    })
  );
</script>

<div class="toolbar">
  <h2>Hráči ({filtrovani.length}{filtrovani.length !== hraci.length ? ` z ${hraci.length}` : ''})</h2>
  <button class="primary" onclick={novy}>+ Nový hráč</button>
</div>

<div class="filters">
  <input bind:value={hledat} type="text" placeholder="Hledat jméno / číslo…" />
  <select bind:value={filterKategorie}>
    <option value="vse">Všechny kategorie</option>
    {#each KATEGORIE_PORADI as k}
      <option value={k}>{kategorieLabel(k)}</option>
    {/each}
  </select>
  <select bind:value={filterAktivni}>
    <option value="ano">Jen aktivní</option>
    <option value="ne">Jen neaktivní</option>
    <option value="vse">Vše</option>
  </select>
</div>

{#if filtrovani.length === 0}
  <div class="empty">
    {#if hraci.length === 0}
      Žádní hráči zatím nejsou v evidenci. Klikni na "Nový hráč".
    {:else}
      Žádný hráč neodpovídá filtru.
    {/if}
  </div>
{:else}
  <table>
    <thead>
      <tr>
        <th class="th-avatar"></th>
        <th>#</th>
        <th>Jméno</th>
        <th>Pozice</th>
        <th>Věk</th>
        <th>Výška</th>
        <th>Kategorie</th>
        <th>Aktivní</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each filtrovani as h (h.id)}
        {@const vek = vypoctiVek(h.rocnik_narozeni)}
        <tr class:neaktivni={!h.aktivni}>
          <td class="td-avatar">
            <Avatar foto={h.foto} cislo={h.cislo_dresu} size={TABLE_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} />
          </td>
          <td class="num">{h.cislo_dresu}</td>
          <td>{h.prijmeni} {h.jmeno}</td>
          <td>{h.pozice ?? '—'}</td>
          <td class="td-mono">{vek !== null ? vek : '—'}</td>
          <td class="td-mono">{h.vyska_cm !== undefined ? `${h.vyska_cm} cm` : '—'}</td>
          <td>{kategorieLabel(h.domaci_kategorie)}</td>
          <td>{h.aktivni ? '✓' : '—'}</td>
          <td class="actions">
            <button onclick={() => upravit(h)}>Upravit</button>
            <button class="danger" onclick={() => smazat(h)}>Smazat</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if zobrazFormular}
  <HracForm existing={editovany} onClose={zavri} onSaved={ulozeno} />
{/if}

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .toolbar h2 { font-size: 22px; color: var(--text); }

  .filters {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
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
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  th, td {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--surface-2);
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--surface-2); }
  tbody tr.neaktivni { opacity: 0.45; }
  td.num { font-weight: 700; color: var(--accent); font-size: 16px; width: 60px; }
  .th-avatar { width: 56px; }
  .td-avatar { width: 56px; padding-right: 0; }
  .td-mono { font-family: "Consolas", monospace; font-variant-numeric: tabular-nums; }
  td.actions { display: flex; gap: 6px; justify-content: flex-end; }

  button {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  button:hover { background: var(--border-strong); color: var(--accent-fg); }
  button.primary {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 10px 18px;
    font-size: 14px;
  }
  button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  button.danger { background: var(--danger); color: var(--accent-fg); }
  button.danger:hover { background: var(--danger-hover); color: var(--accent-fg); }
</style>
