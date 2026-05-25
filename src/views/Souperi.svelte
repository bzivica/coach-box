<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import { KATEGORIE_PORADI, kategorieLabel, type Souper, type Kategorie } from '../lib/types';
  import SouperForm from '../components/SouperForm.svelte';

  let souperi = $state<Souper[]>([]);
  let filterKategorie = $state<Kategorie | 'vse'>('vse');
  let hledat = $state('');

  let zobrazFormular = $state(false);
  let editovany = $state<Souper | undefined>(undefined);

  onMount(reload);

  async function reload() {
    souperi = await db.souperi.orderBy('nazev').toArray();
  }

  function novy() {
    editovany = undefined;
    zobrazFormular = true;
  }

  function upravit(s: Souper) {
    editovany = s;
    zobrazFormular = true;
  }

  async function smazat(s: Souper) {
    if (!confirm(`Smazat soupeře "${s.nazev}" (${kategorieLabel(s.kategorie)})?`)) return;
    await db.souperi.delete(s.id);
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
    souperi.filter((s) => {
      if (filterKategorie !== 'vse' && s.kategorie !== filterKategorie) return false;
      if (hledat && !s.nazev.toLowerCase().includes(hledat.toLowerCase())) return false;
      return true;
    })
  );
</script>

<div class="toolbar">
  <h2>Soupeři ({filtrovani.length}{filtrovani.length !== souperi.length ? ` z ${souperi.length}` : ''})</h2>
  <button class="primary" onclick={novy}>+ Nový soupeř</button>
</div>

<div class="filters">
  <input bind:value={hledat} type="text" placeholder="Hledat název týmu…" />
  <select bind:value={filterKategorie}>
    <option value="vse">Všechny kategorie</option>
    {#each KATEGORIE_PORADI as k}
      <option value={k}>{kategorieLabel(k)}</option>
    {/each}
  </select>
</div>

{#if filtrovani.length === 0}
  <div class="empty">
    {#if souperi.length === 0}
      Žádní soupeři zatím nejsou v evidenci. Klikni na "Nový soupeř".
    {:else}
      Žádný soupeř neodpovídá filtru.
    {/if}
  </div>
{:else}
  <table>
    <thead>
      <tr>
        <th>Název</th>
        <th>Kategorie</th>
        <th>Hráči</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each filtrovani as s (s.id)}
        <tr>
          <td class="nazev">{s.nazev}</td>
          <td>{kategorieLabel(s.kategorie)}</td>
          <td>{s.hraci_soupere?.length ?? 0}</td>
          <td class="actions">
            <button onclick={() => upravit(s)}>Upravit</button>
            <button class="danger" onclick={() => smazat(s)}>Smazat</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if zobrazFormular}
  <SouperForm existing={editovany} onClose={zavri} onSaved={ulozeno} />
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
  td.nazev { font-weight: 600; color: var(--accent); }
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
