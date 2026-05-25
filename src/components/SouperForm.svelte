<script lang="ts">
  import { untrack } from 'svelte';
  import { db, newId } from '../lib/db';
  import { KATEGORIE_PORADI, kategorieLabel, type Souper, type SouperHrac, type Kategorie } from '../lib/types';

  type Props = {
    existing?: Souper;
    onClose: () => void;
    onSaved: () => void;
  };

  let { existing, onClose, onSaved }: Props = $props();

  const initial = untrack(() => ({
    nazev: existing?.nazev ?? '',
    kategorie: (existing?.kategorie ?? 'U13') as Kategorie,
    hraci: (existing?.hraci_soupere ?? []).map((h) => ({ ...h })),
  }));

  let nazev = $state(initial.nazev);
  let kategorie = $state<Kategorie>(initial.kategorie);
  let hraci = $state<SouperHrac[]>(initial.hraci);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);

  let hromadnyVklad = $state(false);
  let hromadnyText = $state('');
  let hromadnyChyba = $state<string | null>(null);

  let nactenoZeZapasuInfo = $state<string | null>(null);

  function pridejHrace() {
    hraci.push({ cislo: 0, jmeno: '', prijmeni: '' });
  }

  function smazHrace(index: number) {
    hraci.splice(index, 1);
  }

  async function nactiCislaZeZapasu() {
    nactenoZeZapasuInfo = null;
    if (!existing) return;
    const zapasy = await db.zapasy
      .toArray()
      .then((arr) => arr.filter((z) => z.souper_id === existing.id));
    if (zapasy.length === 0) {
      nactenoZeZapasuInfo = 'Žádné zápasy s tímto soupeřem.';
      return;
    }
    const posledni = [...zapasy].sort((a, b) => b.datum.localeCompare(a.datum))[0];
    const eventyZapasu = await db.udalosti.where('zapas_id').equals(posledni.id).toArray();
    const nalezenaCisla = new Set<number>();
    for (const u of eventyZapasu) {
      if (typeof u.opp_hrac_cislo === 'number') nalezenaCisla.add(u.opp_hrac_cislo);
    }
    if (nalezenaCisla.size === 0) {
      nactenoZeZapasuInfo = `Zápas ${posledni.datum} — žádná čísla soupeře nebyla atribuována při zápise.`;
      return;
    }
    const stavajici = new Set(hraci.map((h) => h.cislo));
    const noviProPridani = [...nalezenaCisla].filter((c) => !stavajici.has(c)).sort((a, b) => a - b);
    if (noviProPridani.length === 0) {
      nactenoZeZapasuInfo = `Všech ${nalezenaCisla.size} čísel ze zápasu ${posledni.datum} už máte v soupisce.`;
      return;
    }
    hraci = [...hraci, ...noviProPridani.map((c) => ({ cislo: c, jmeno: '', prijmeni: '' }))];
    nactenoZeZapasuInfo = `Přidáno ${noviProPridani.length} nových čísel ze zápasu ${posledni.datum}: ${noviProPridani.map((c) => `#${c}`).join(', ')}. Doplňte jména a uložte.`;
  }

  function parsovatHromadne() {
    hromadnyChyba = null;
    const radky = hromadnyText.split('\n').map((r) => r.trim()).filter((r) => r.length > 0);
    if (radky.length === 0) { hromadnyChyba = 'Prázdný text'; return; }

    const noviHraci: SouperHrac[] = [];
    for (let i = 0; i < radky.length; i++) {
      const tokeny = radky[i].split(/\s+/);
      const cislo = parseInt(tokeny[0], 10);
      if (isNaN(cislo) || cislo < 0 || cislo > 99) { hromadnyChyba = `Řádek ${i + 1}: neplatné číslo "${tokeny[0]}"`; return; }
      const zbytek = tokeny.slice(1);
      let jmeno: string | undefined;
      let prijmeni: string | undefined;
      if (zbytek.length === 1) {
        jmeno = zbytek[0];
      } else if (zbytek.length >= 2) {
        prijmeni = zbytek[zbytek.length - 1];
        jmeno = zbytek.slice(0, -1).join(' ');
      }
      noviHraci.push({ cislo, jmeno, prijmeni });
    }
    hraci = noviHraci;
    hromadnyVklad = false;
    hromadnyText = '';
  }

  async function ulozit() {
    chyba = null;

    if (!nazev.trim()) { chyba = 'Název týmu je povinný'; return; }

    const cisteniHraci: SouperHrac[] = [];
    for (let i = 0; i < hraci.length; i++) {
      const h = hraci[i];
      if (!h.cislo && !h.jmeno?.trim() && !h.prijmeni?.trim()) continue;
      if (h.cislo === undefined || h.cislo === null || isNaN(h.cislo)) {
        chyba = `Řádek ${i + 1}: číslo musí být vyplněné`;
        return;
      }
      if (h.cislo < 0 || h.cislo > 99) {
        chyba = `Řádek ${i + 1}: číslo musí být 0–99`;
        return;
      }
      cisteniHraci.push({
        cislo: h.cislo,
        jmeno: h.jmeno?.trim() || undefined,
        prijmeni: h.prijmeni?.trim() || undefined,
      });
    }

    ukladani = true;
    try {
      const now = Date.now();
      if (existing) {
        await db.souperi.update(existing.id, {
          nazev: nazev.trim(),
          kategorie,
          hraci_soupere: cisteniHraci.length > 0 ? cisteniHraci : undefined,
          updated_at: now,
        });
      } else {
        const novy: Souper = {
          id: newId(),
          nazev: nazev.trim(),
          kategorie,
          hraci_soupere: cisteniHraci.length > 0 ? cisteniHraci : undefined,
          vytvoreno_at: now,
          updated_at: now,
        };
        await db.souperi.add(novy);
      }
      onSaved();
    } catch (e) {
      chyba = (e as Error).message ?? 'Chyba při ukládání';
    } finally {
      ukladani = false;
    }
  }
</script>

<div class="modal-bg" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
    <h2>{existing ? 'Upravit soupeře' : 'Nový soupeř'}</h2>

    <div class="form">
      <div class="row">
        <label class="flex2">
          <span>Název týmu *</span>
          <input bind:value={nazev} type="text" autocomplete="off" placeholder="např. SOKOL" />
        </label>
        <label>
          <span>Kategorie *</span>
          <select bind:value={kategorie}>
            {#each KATEGORIE_PORADI as k}
              <option value={k}>{kategorieLabel(k)}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="players-section">
        <div class="players-header">
          <span class="label">Soupiska soupeře (volitelné)</span>
          <div class="header-actions">
            {#if existing}
              <button type="button" class="small" onclick={nactiCislaZeZapasu} title="Doplnit čísla zaznamenaná v posledním zápase s tímto soupeřem">↻ Z posledního zápasu</button>
            {/if}
            <button type="button" class="small" onclick={() => (hromadnyVklad = !hromadnyVklad)}>
              {hromadnyVklad ? '× Zrušit' : '⎘ Hromadně vložit'}
            </button>
            <button type="button" class="small" onclick={pridejHrace}>+ Přidat hráče</button>
          </div>
        </div>

        {#if nactenoZeZapasuInfo}
          <div class="info">{nactenoZeZapasuInfo}</div>
        {/if}

        {#if hromadnyVklad}
          <div class="bulk-paste">
            <div class="bulk-hint">Jeden hráč na řádek: <code>číslo jméno [příjmení]</code>. Přepíše stávající seznam.</div>
            <textarea bind:value={hromadnyText} rows="8" placeholder="1 Omer Gušmirovič&#10;2 Matěj Sova&#10;..."></textarea>
            {#if hromadnyChyba}
              <div class="chyba">{hromadnyChyba}</div>
            {/if}
            <button type="button" class="primary small" onclick={parsovatHromadne}>Parsovat a nahradit</button>
          </div>
        {/if}

        {#if hraci.length === 0}
          <div class="empty">Žádní hráči soupeře. Klikni "+ Přidat hráče" nebo nech prázdné.</div>
        {:else}
          {#each hraci as h, i (i)}
            <div class="player-row">
              <input bind:value={h.cislo} type="number" min="0" max="99" placeholder="#" class="num-input" />
              <input bind:value={h.jmeno} type="text" placeholder="Jméno (volitelné)" />
              <input bind:value={h.prijmeni} type="text" placeholder="Příjmení (volitelné)" />
              <button type="button" class="danger small" onclick={() => smazHrace(i)}>×</button>
            </div>
          {/each}
        {/if}
      </div>

      {#if chyba}
        <div class="chyba">{chyba}</div>
      {/if}

      <div class="buttons">
        <button type="button" onclick={onClose} disabled={ukladani}>Zrušit</button>
        <button type="button" class="primary" onclick={ulozit} disabled={ukladani}>
          {ukladani ? 'Ukládám…' : 'Uložit'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 600px;
    max-width: 92vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-strong);
  }
  .modal h2 { font-size: 20px; margin-bottom: 20px; color: var(--accent); }
  .form { display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
  label span { font-weight: 500; }
  input[type="text"], input[type="number"], select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent); }

  .players-section {
    background: var(--surface-2);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .players-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-actions {
    display: flex;
    gap: 8px;
  }
  .bulk-paste {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: 6px;
  }
  .bulk-hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .bulk-hint code {
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: ui-monospace, monospace;
    resize: vertical;
    min-height: 100px;
  }
  textarea:focus { outline: none; border-color: var(--accent); }
  .label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
  }
  .empty {
    font-size: 13px;
    color: var(--text-dim);
    padding: 8px 0;
    text-align: center;
  }
  .player-row {
    display: grid;
    grid-template-columns: 70px 1fr 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .num-input { text-align: center; }

  .chyba {
    background: var(--danger-bg);
    color: var(--danger-fg);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
  }
  .info {
    background: var(--surface-2);
    border: 1px solid var(--accent);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  .buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
  button {
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
  button.small { padding: 6px 12px; font-size: 13px; }
  button:hover:not(:disabled) { background: var(--border-strong); color: var(--accent-fg); }
  button.primary { background: var(--accent); color: var(--accent-fg); }
  button.primary:hover:not(:disabled) { background: var(--accent-hover); color: var(--accent-fg); }
  button.danger { background: var(--danger); color: var(--accent-fg); }
  button.danger:hover:not(:disabled) { background: var(--danger-hover); color: var(--accent-fg); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
