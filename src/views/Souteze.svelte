<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import type { Soutez, SoutezTyp } from '../lib/types';
  import SoutezForm from '../components/SoutezForm.svelte';

  const TYPY: (SoutezTyp | 'vse')[] = ['vse', 'liga', 'pohar', 'turnaj', 'pratelak', 'jiny'];

  let souteze = $state<Soutez[]>([]);
  let filterTyp = $state<SoutezTyp | 'vse'>('vse');
  let filterAktivni = $state<'vse' | 'ano' | 'ne'>('ano');
  let hledat = $state('');

  let zobrazFormular = $state(false);
  let editovany = $state<Soutez | undefined>(undefined);

  onMount(reload);

  async function reload() {
    souteze = await db.souteze.orderBy('nazev').toArray();
  }

  function novy() {
    editovany = undefined;
    zobrazFormular = true;
  }

  function upravit(s: Soutez) {
    editovany = s;
    zobrazFormular = true;
  }

  async function smazat(s: Soutez) {
    if (!confirm(`Smazat soutěž "${s.nazev}"?`)) return;
    await db.souteze.delete(s.id);
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
    souteze.filter((s) => {
      if (filterTyp !== 'vse' && s.typ !== filterTyp) return false;
      if (filterAktivni === 'ano' && !s.aktivni) return false;
      if (filterAktivni === 'ne' && s.aktivni) return false;
      if (hledat && !s.nazev.toLowerCase().includes(hledat.toLowerCase())) return false;
      return true;
    })
  );
</script>

<div class="toolbar">
  <h2>Soutěže ({filtrovani.length}{filtrovani.length !== souteze.length ? ` z ${souteze.length}` : ''})</h2>
  <button class="primary" onclick={novy}>+ Nová soutěž</button>
</div>

<div class="filters">
  <input bind:value={hledat} type="text" placeholder="Hledat název…" />
  <select bind:value={filterTyp}>
    {#each TYPY as t}
      <option value={t}>{t === 'vse' ? 'Všechny typy' : t}</option>
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
    {#if souteze.length === 0}
      Žádné soutěže. Klikni na "Nová soutěž".
    {:else}
      Žádná soutěž neodpovídá filtru.
    {/if}
  </div>
{:else}
  <table>
    <thead>
      <tr>
        <th>Název</th>
        <th>Typ</th>
        <th>Region</th>
        <th>Aktivní</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each filtrovani as s (s.id)}
        <tr class:neaktivni={!s.aktivni}>
          <td class="nazev">{s.nazev}</td>
          <td>{s.typ}</td>
          <td>{s.region ?? '-'}</td>
          <td>{s.aktivni ? '✓' : '-'}</td>
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
  <SoutezForm existing={editovany} onClose={zavri} onSaved={ulozeno} />
{/if}

<style>
  .toolbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
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
  table {
    width: 100%; border-collapse: collapse;
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
  tbody tr.neaktivni { opacity: 0.45; }
  td.nazev { font-weight: 600; color: var(--accent); }
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
    padding: 10px 18px; font-size: 14px;
  }
  button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  button.danger { background: var(--danger); color: var(--accent-fg); }
  button.danger:hover { background: var(--danger-hover); color: var(--accent-fg); }
</style>
