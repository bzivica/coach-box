<script lang="ts">
  import { untrack } from 'svelte';
  import { db, newId } from '../lib/db';
  import { KATEGORIE_PORADI, kategorieLabel, normCislo, type Souper, type SouperHrac, type Kategorie } from '../lib/types';

  // Cislo dresu = text (jen cislice, 0-99 i napr. "00" / "07"). Prazdne = nevyplneno.
  const CISLO_RE = /^\d{1,3}$/;

  type Props = {
    existing?: Souper;
    onClose: () => void;
    onSaved: () => void;
  };

  let { existing, onClose, onSaved }: Props = $props();

  const initial = untrack(() => ({
    nazev: existing?.nazev ?? '',
    kategorie: (existing?.kategorie ?? 'U13') as Kategorie,
    hraci: (existing?.hraci_soupere ?? []).map((h) => ({ ...h, cislo: normCislo(h.cislo) })),
    zdrojUrl: existing?.zdroj_url ?? '',
  }));

  let nazev = $state(initial.nazev);
  let kategorie = $state<Kategorie>(initial.kategorie);
  let hraci = $state<SouperHrac[]>(initial.hraci);
  let zdrojUrl = $state(initial.zdrojUrl);
  let nacitaniZdroje = $state(false);
  let importInfo = $state<string | null>(null);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);

  let hromadnyVklad = $state(false);
  let hromadnyText = $state('');
  let hromadnyChyba = $state<string | null>(null);

  let nactenoZeZapasuInfo = $state<string | null>(null);

  async function nacistZCzBasketball() {
    chyba = null;
    importInfo = null;
    let url: URL;
    try { url = new URL(zdrojUrl.trim()); } catch { chyba = 'Vlož odkaz na týmovou stránku CZ.BASKETBALL.'; return; }
    if (url.hostname !== 'cz.basketball' && url.hostname !== 'www.cz.basketball') {
      chyba = 'Použij odkaz z webu cz.basketball.'; return;
    }
    if (!/^\/tym\/\d+\/?$/.test(url.pathname)) {
      chyba = 'Odkaz musí vést na stránku konkrétního týmu, například https://cz.basketball/tym/15435?y=2026.'; return;
    }
    nacitaniZdroje = true;
    try {
      let response: Response;
      try {
        response = await fetch(`/api/cz-basketball/team?url=${encodeURIComponent(url.toString())}`);
      } catch {
        throw new Error('Server importu neběží. Zavři Coach-Box a spusť jej znovu příkazem npm run dev v terminálu projektu.');
      }
      let data: { error?: string; teamName?: string; players?: SouperHrac[]; playerCount?: number; sourceUrl?: string };
      try {
        data = await response.json() as typeof data;
      } catch {
        throw new Error(`Server importu vrátil neplatnou odpověď (HTTP ${response.status}). Zkontroluj, že spouštíš Coach-Box příkazem npm run dev a že server importu běží.`);
      }
      if (!response.ok) throw new Error(data.error || `Import se nezdařil (HTTP ${response.status}).`);
      if (!data.players?.length) throw new Error('Na stránce nebyla nalezena žádná rozpoznaná soupiska.');
      if (!nazev.trim() && data.teamName) nazev = data.teamName;
      const merged = [...hraci].map(h => ({ ...h, cislo: normCislo(h.cislo) }));
      let pridano = 0;
      let aktualizovano = 0;
      for (const incoming of data.players) {
        const cislo = normCislo(incoming.cislo);
        const jmeno = incoming.jmeno?.trim() || '';
        const prijmeni = incoming.prijmeni?.trim() || '';
        if (!jmeno && !prijmeni) continue;
        const oldIndex = merged.findIndex(h => cislo ? normCislo(h.cislo) === cislo : (!normCislo(h.cislo) && (h.jmeno || '').trim().toLocaleLowerCase('cs') === jmeno.toLocaleLowerCase('cs') && (h.prijmeni || '').trim().toLocaleLowerCase('cs') === prijmeni.toLocaleLowerCase('cs')));
        if (oldIndex < 0) { merged.push({ ...incoming, cislo }); pridano++; }
        else {
          const old = merged[oldIndex];
          const next = { ...old, cislo: cislo || normCislo(old.cislo), jmeno: jmeno || old.jmeno, prijmeni: prijmeni || old.prijmeni };
          if (next.jmeno !== old.jmeno || next.prijmeni !== old.prijmeni) aktualizovano++;
          merged[oldIndex] = next;
        }
      }
      hraci = merged.sort((a, b) => Number(a.cislo || 999) - Number(b.cislo || 999) || (a.prijmeni || '').localeCompare(b.prijmeni || '', 'cs'));
      zdrojUrl = data.sourceUrl || url.toString();
      if (data.teamName && !nazev.trim()) nazev = data.teamName;
      importInfo = `Načteno ${data.playerCount} hráčů. Nově přidáno: ${pridano}, doplněno jmen u existujících čísel: ${aktualizovano}. Zkontroluj soupisku a potom klikni na Uložit.`;
    } catch (e) {
      chyba = e instanceof Error ? e.message : 'Import se nezdařil.';
    } finally { nacitaniZdroje = false; }
  }

  function pridejHrace() {
    hraci.push({ cislo: '', jmeno: '', prijmeni: '' });
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
    const nalezenaCisla = new Set<string>();
    for (const u of eventyZapasu) {
      const c = normCislo(u.opp_hrac_cislo);
      if (c) nalezenaCisla.add(c);
    }
    if (nalezenaCisla.size === 0) {
      nactenoZeZapasuInfo = `Zápas ${posledni.datum} - žádná čísla soupeře nebyla atribuována při zápise.`;
      return;
    }
    const stavajici = new Set(hraci.map((h) => normCislo(h.cislo)));
    const noviProPridani = [...nalezenaCisla]
      .filter((c) => !stavajici.has(c))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (noviProPridani.length === 0) {
      nactenoZeZapasuInfo = `Všech ${nalezenaCisla.size} čísel ze zápasu ${posledni.datum} už máte v soupisce.`;
      return;
    }
    hraci = [...hraci, ...noviProPridani.map((c) => ({ cislo: c, jmeno: '', prijmeni: '' }))];
    nactenoZeZapasuInfo = `Přidáno ${noviProPridani.length} nových čísel ze zápasu ${posledni.datum}: ${noviProPridani.map((c) => `#${c}`).join(', ')}. Doplňte jména a uložte.`;
  }

  function parsovatHromadne() {
    hromadnyChyba = null;
    const radky = hromadnyText
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (radky.length === 0) { hromadnyChyba = 'Prázdný text'; return; }

    const noviHraci: SouperHrac[] = [];
    for (let i = 0; i < radky.length; i++) {
      const tokeny = radky[i].split(/\s+/);
      const cislo = tokeny[0].trim();
      if (!CISLO_RE.test(cislo)) { hromadnyChyba = `Položka ${i + 1}: neplatné číslo "${tokeny[0]}"`; return; }
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
    const videnaCisla = new Set<string>();
    for (let i = 0; i < hraci.length; i++) {
      const h = hraci[i];
      const c = normCislo(h.cislo);
      if (!c && !h.jmeno?.trim() && !h.prijmeni?.trim()) continue;
      if (!c && !(h.jmeno?.trim() || h.prijmeni?.trim())) continue;
      if (c && !CISLO_RE.test(c)) {
        chyba = `Řádek ${i + 1}: číslo dresu jen číslice (0-99, lze i "00")`;
        return;
      }
      if (c && videnaCisla.has(c)) {
        chyba = `Číslo #${c} je v soupisce dvakrát`;
        return;
      }
      if (c) videnaCisla.add(c);
      cisteniHraci.push({
        cislo: c || '',
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
          zdroj_url: zdrojUrl.trim() || undefined,
          updated_at: now,
        });
      } else {
        const novy: Souper = {
          id: newId(),
          nazev: nazev.trim(),
          kategorie,
          hraci_soupere: cisteniHraci.length > 0 ? cisteniHraci : undefined,
          zdroj_url: zdrojUrl.trim() || undefined,
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

        <div class="import-box">
          <label class="import-label">
            <span>Odkaz na tým CZ.BASKETBALL (české soutěže)</span>
            <input bind:value={zdrojUrl} type="url" placeholder="https://cz.basketball/tym/15435?y=2026" />
          </label>
          <button type="button" class="small" onclick={nacistZCzBasketball} disabled={nacitaniZdroje}>
            {nacitaniZdroje ? 'Načítám…' : '↻ Načíst / aktualizovat soupisku'}
          </button>
          <div class="import-hint">Pro ČEYBL a zahraniční turnaje pokračuj ručním zadáním. Import nejprve zobrazí změny v tomto formuláři; do databáze se uloží až po kliknutí na Uložit.</div>
        </div>
        {#if importInfo}<div class="info">{importInfo}</div>{/if}

        {#if nactenoZeZapasuInfo}
          <div class="info">{nactenoZeZapasuInfo}</div>
        {/if}

        {#if hromadnyVklad}
          <div class="bulk-paste">
            <div class="bulk-hint">Jeden hráč na řádek nebo čárkou oddělené: <code>číslo [jméno] [příjmení]</code>. Stačí jen čísla (např. <code>5, 8, 12</code>). Přepíše stávající seznam.</div>
            <textarea bind:value={hromadnyText} rows="8" placeholder="5, 8, 12, 14&#10;nebo&#10;1 Omer Gušmirovič&#10;2 Matěj Sova"></textarea>
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
              <input bind:value={h.cislo} type="text" inputmode="numeric" maxlength="3" placeholder="#" class="num-input" />
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
    overflow-y: auto;
    z-index: 100;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 600px;
    max-width: 92vw;
    max-height: 90dvh;
    overflow-y: auto;
    box-shadow: var(--shadow-strong);
  }
  .modal h2 { font-size: 20px; margin-bottom: 20px; color: var(--accent); }
  .form { display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
  label span { font-weight: 500; }
  input[type="text"], select {
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

  @media (max-width: 600px) {
    .modal-bg { align-items: flex-start; }
    .modal {
      width: 100%;
      max-width: 100%;
      min-height: 100dvh;
      max-height: none;
      border: none;
      border-radius: 0;
      padding: 16px;
      padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }
    .row { grid-template-columns: 1fr; }
    .player-row { grid-template-columns: 48px 1fr 1fr auto; gap: 6px; }
    .buttons button:not(.small) { flex: 1; padding: 12px; }
  }

  .import-box { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); margin: 10px 0; }
  .import-label { display: grid; gap: 6px; font-size: 12px; color: var(--text-muted); }
  .import-label input { width: 100%; min-width: 0; box-sizing: border-box; }
  .import-hint { font-size: 12px; color: var(--text-muted); line-height: 1.45; }
</style>
