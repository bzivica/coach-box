<script lang="ts">
  import { onMount } from 'svelte';
  import { db, najdiDuplicitniHrace, slucDuplicitniHrace, type DuplicitniSkupina } from '../lib/db';
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

  // Slucovani duplikatu
  let dupSkupiny = $state<DuplicitniSkupina[] | null>(null); // null = okno zavrene
  let dupVybrane = $state<Record<number, boolean>>({});
  let dupKeeper = $state<Record<number, string>>({});
  let dupHledam = $state(false);
  let dupBezi = $state(false);

  const dupPocetVybranych = $derived(dupSkupiny ? dupSkupiny.filter((_, i) => dupVybrane[i]).length : 0);

  async function najdiDuplicity() {
    dupHledam = true;
    try {
      const skupiny = await najdiDuplicitniHrace();
      if (skupiny.length === 0) {
        alert('Žádné pravděpodobné duplicity nenalezeny.');
        return;
      }
      dupVybrane = Object.fromEntries(skupiny.map((_, i) => [i, true]));
      dupKeeper = Object.fromEntries(skupiny.map((s, i) => [i, s.navrh_keeper_id]));
      dupSkupiny = skupiny;
    } finally {
      dupHledam = false;
    }
  }

  function zavriDuplicity() {
    if (dupBezi) return;
    dupSkupiny = null;
  }

  async function provedSlouceni() {
    if (!dupSkupiny) return;
    const vstup = dupSkupiny
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => dupVybrane[i])
      .map(({ s, i }) => ({
        keeper_id: dupKeeper[i],
        smazat_ids: s.hraci.map((c) => c.hrac.id).filter((id) => id !== dupKeeper[i]),
      }));
    if (vstup.length === 0) return;
    if (!confirm(`Sloučit ${vstup.length} ${vstup.length === 1 ? 'skupinu' : vstup.length < 5 ? 'skupiny' : 'skupin'} duplikátů? Statistiky se přepojí na ponechané záznamy.`)) return;
    dupBezi = true;
    try {
      const smazano = await slucDuplicitniHrace(vstup);
      dupSkupiny = null;
      await reload();
      alert(`Hotovo - sloučeno ${smazano} duplicitních záznamů.`);
    } finally {
      dupBezi = false;
    }
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
  <div class="toolbar-akce">
    <button onclick={najdiDuplicity} disabled={dupHledam}>{dupHledam ? 'Hledám…' : '🧹 Sloučit duplikáty'}</button>
    <button class="primary" onclick={novy}>+ Nový hráč</button>
  </div>
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
          <td>{h.pozice ?? '-'}</td>
          <td class="td-mono">{vek !== null ? vek : '-'}</td>
          <td class="td-mono">{h.vyska_cm !== undefined ? `${h.vyska_cm} cm` : '-'}</td>
          <td>{kategorieLabel(h.domaci_kategorie)}</td>
          <td>{h.aktivni ? '✓' : '-'}</td>
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

{#if dupSkupiny}
  <div class="modal-bg" onclick={zavriDuplicity} onkeydown={(e) => e.key === 'Escape' && zavriDuplicity()} role="presentation">
    <div class="modal dup-modal" onclick={(e) => e.stopPropagation()} role="presentation">
      <h2>Sloučit duplikáty ({dupSkupiny.length})</h2>
      <p class="dup-hint">
        Zaškrtni skupiny, které se mají sloučit, a v každé označ záznam, který se ponechá.
        Chybějící údaje (číslo dresu, pozice, ročník, foto) se na něj doplní ze smazaných
        a všechny zapsané akce se přepojí - statistiky zůstanou.
      </p>
      <div class="dup-list">
        {#each dupSkupiny as s, i (s.navrh_keeper_id)}
          <div class="dup-skupina" class:vynechana={!dupVybrane[i]}>
            <label class="dup-check">
              <input
                type="checkbox"
                checked={dupVybrane[i]}
                onchange={(e) => (dupVybrane[i] = e.currentTarget.checked)}
              />
              <span>Sloučit</span>
            </label>
            <div class="dup-cleni">
              {#each s.hraci as c (c.hrac.id)}
                <label class="dup-clen" class:keeper={dupKeeper[i] === c.hrac.id}>
                  <input
                    type="radio"
                    name={`dup-keeper-${i}`}
                    checked={dupKeeper[i] === c.hrac.id}
                    onchange={() => (dupKeeper[i] = c.hrac.id)}
                    disabled={!dupVybrane[i]}
                  />
                  <Avatar foto={c.hrac.foto} cislo={c.hrac.cislo_dresu} size={32} alt={`${c.hrac.jmeno} ${c.hrac.prijmeni}`} />
                  <span class="dc-jmeno">{c.hrac.prijmeni} {c.hrac.jmeno}</span>
                  <span class="dc-detail">
                    #{c.hrac.cislo_dresu ?? '-'} · {c.hrac.pozice ?? '-'} · roč. {c.hrac.rocnik_narozeni ?? '-'} ·
                    {kategorieLabel(c.hrac.domaci_kategorie)} · akcí: {c.pocet_akci}
                  </span>
                  {#if dupKeeper[i] === c.hrac.id}
                    <span class="dc-keeper-badge">ponechat</span>
                  {/if}
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <div class="dup-buttons">
        <button type="button" onclick={zavriDuplicity} disabled={dupBezi}>Zavřít</button>
        <button type="button" class="primary" onclick={provedSlouceni} disabled={dupBezi || dupPocetVybranych === 0}>
          {dupBezi ? 'Slučuji…' : `Sloučit vybrané (${dupPocetVybranych})`}
        </button>
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
  }
  .toolbar h2 { font-size: 22px; color: var(--text); }
  .toolbar-akce { display: flex; gap: 8px; align-items: center; }
  .toolbar-akce > button:not(.primary) {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 10px 14px;
    font-size: 14px;
  }

  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    z-index: 100;
  }
  .dup-modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 720px;
    max-width: 94vw;
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-strong);
  }
  .dup-modal h2 { font-size: 20px; margin-bottom: 10px; color: var(--accent); }
  .dup-hint { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5; }
  .dup-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
  .dup-skupina {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--surface-2);
  }
  .dup-skupina.vynechana { opacity: 0.5; }
  .dup-check { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; margin-bottom: 8px; cursor: pointer; }
  .dup-cleni { display: flex; flex-direction: column; gap: 6px; }
  .dup-clen {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    flex-wrap: wrap;
  }
  .dup-clen.keeper { border-color: var(--accent); }
  .dc-jmeno { font-weight: 700; }
  .dc-detail { font-size: 12.5px; color: var(--text-muted); }
  .dc-keeper-badge {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent-fg);
    background: var(--accent);
    border-radius: 4px;
    padding: 2px 8px;
  }
  .dup-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
    flex-shrink: 0;
  }
  .dup-buttons button { padding: 10px 18px; font-size: 14px; }

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
