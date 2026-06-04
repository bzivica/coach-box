<script lang="ts">
  import { onMount } from 'svelte';
  import { db, newId } from '../lib/db';
  import {
    KATEGORIE_PORADI,
    kategorieLabel,
    muzeHratV,
    souperiZNasichKategorie,
    DEFAULT_DELKA_CTVRTINY_MIN,
    DEFAULT_POCET_CTVRTIN,
    type Zapas,
    type Hrac,
    type Souper,
    type Soutez,
    type Kategorie,
    type NaseStrana,
  } from '../lib/types';
  import Avatar from './Avatar.svelte';

  const CARD_AVATAR_SIZE = 56;
  const MIN_Q_LENGTH = 4;
  const MAX_Q_LENGTH = 15;
  const VAROVANI_LIMIT_PER_GROUP = 4;

  type Props = {
    onClose: () => void;
    onSaved: (zapasId: string) => void;
  };

  let { onClose, onSaved }: Props = $props();

  const today = new Date().toISOString().slice(0, 10);
  const currentSeason = (() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 7 ? `${y}/${(y + 1) % 100}` : `${y - 1}/${y % 100}`;
  })();

  let datum = $state(today);
  let nase_kategorie = $state<Kategorie>('U14');
  let souper_id = $state('');
  let soutez_id = $state('');
  let sezona = $state(currentSeason);
  let nase_strana = $state<NaseStrana>('home');
  let souper_nas_tym = $state(false);
  let souper_nas_kategorie = $state<Kategorie>('U14');
  let nasazeni = $state<string[]>([]);
  let delka_ctvrtiny = $state(String(DEFAULT_DELKA_CTVRTINY_MIN));
  let pocet_ctvrtin = $state(DEFAULT_POCET_CTVRTIN);

  let hraci = $state<Hrac[]>([]);
  let souperi = $state<Souper[]>([]);
  let souteze = $state<Soutez[]>([]);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);

  onMount(async () => {
    hraci = (await db.hraci.toArray()).filter((h) => h.aktivni);
    souperi = await db.souperi.orderBy('nazev').toArray();
    souteze = await db.souteze.toArray();
    souteze = souteze.filter((s) => s.aktivni);
  });

  const filtrovani_souperi = $derived(souperi.filter((s) => s.kategorie === nase_kategorie));
  const vybrana_soutez = $derived(souteze.find((s) => s.id === soutez_id));
  const je_pratelak = $derived(vybrana_soutez?.typ === 'pratelak');
  const souper_nas_kategorie_moznosti = $derived(souperiZNasichKategorie(nase_kategorie));

  $effect(() => {
    if (!souper_nas_kategorie_moznosti.includes(souper_nas_kategorie)) {
      souper_nas_kategorie = nase_kategorie;
    }
  });
  const eligible_hraci = $derived(
    hraci
      .filter((h) => muzeHratV(h.domaci_kategorie, nase_kategorie))
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99))
  );

  const nasazeniHraci = $derived(
    nasazeni
      .map((id) => hraci.find((h) => h.id === id))
      .filter((h): h is Hrac => !!h),
  );

  const breakdownRocnik = $derived.by(() => {
    const map = new Map<string, number>();
    for (const h of nasazeniHraci) {
      const key = h.rocnik_narozeni !== undefined ? String(h.rocnik_narozeni) : 'bez ročníku';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === 'bez ročníku') return 1;
      if (b[0] === 'bez ročníku') return -1;
      return Number(b[0]) - Number(a[0]);
    });
  });

  const breakdownKategorie = $derived.by(() => {
    const map = new Map<Kategorie, number>();
    for (const h of nasazeniHraci) {
      map.set(h.domaci_kategorie, (map.get(h.domaci_kategorie) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => {
      const ai = KATEGORIE_PORADI.indexOf(a[0]);
      const bi = KATEGORIE_PORADI.indexOf(b[0]);
      return bi - ai;
    });
  });

  const dominantniRocnik = $derived.by(() => {
    if (breakdownRocnik.length === 0) return null;
    return breakdownRocnik.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  });

  const dominantniKategorie = $derived.by(() => {
    if (breakdownKategorie.length === 0) return null;
    return breakdownKategorie.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  });

  function toggleHrac(id: string) {
    if (nasazeni.includes(id)) {
      nasazeni = nasazeni.filter((x) => x !== id);
    } else {
      nasazeni = [...nasazeni, id];
    }
  }

  function vybratVse() {
    nasazeni = eligible_hraci.map((h) => h.id);
  }

  function odznacitVse() {
    nasazeni = [];
  }

  async function vytvorNeboNajdiNasSouper(kat: Kategorie): Promise<string> {
    const nazev = `Jižní Supi ${kategorieLabel(kat)}`;
    const nasiHraci = (await db.hraci.toArray())
      .filter((h) => h.aktivni && h.domaci_kategorie === kat)
      .sort((a, b) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99))
      .map((h) => ({ cislo: h.cislo_dresu ?? 0, jmeno: h.jmeno, prijmeni: h.prijmeni }));
    const now = Date.now();
    const existing = (await db.souperi.toArray()).find((s) => s.nazev === nazev && s.kategorie === kat);
    if (existing) {
      await db.souperi.update(existing.id, { hraci_soupere: nasiHraci, updated_at: now });
      return existing.id;
    }
    const id = newId();
    await db.souperi.add({ id, nazev, kategorie: kat, hraci_soupere: nasiHraci, vytvoreno_at: now, updated_at: now });
    return id;
  }

  async function ulozit() {
    chyba = null;
    const interni_pratelak = je_pratelak && souper_nas_tym;
    if (!datum) { chyba = 'Datum je povinný'; return; }
    if (!interni_pratelak && !souper_id) { chyba = 'Vyber soupeře (nebo přidej v sekci Soupeři)'; return; }
    if (!soutez_id) { chyba = 'Vyber soutěž'; return; }
    if (!sezona.trim()) { chyba = 'Sezona je povinná'; return; }
    const delkaParsed = Number(delka_ctvrtiny);
    if (!Number.isFinite(delkaParsed) || delkaParsed < MIN_Q_LENGTH || delkaParsed > MAX_Q_LENGTH) {
      chyba = `Délka čtvrtiny musí být ${MIN_Q_LENGTH}-${MAX_Q_LENGTH} minut`;
      return;
    }
    if (nasazeni.length < 5) { chyba = `Musíš vybrat alespoň 5 hráčů (vybrali jsme ${nasazeni.length})`; return; }

    ukladani = true;
    try {
      const now = Date.now();
      const finalSouperId = interni_pratelak
        ? await vytvorNeboNajdiNasSouper(souper_nas_kategorie)
        : souper_id;
      const zapas: Zapas = {
        id: newId(),
        datum,
        nase_kategorie,
        souper_id: finalSouperId,
        soutez_id,
        sezona: sezona.trim(),
        nase_strana,
        nasazeni_hraci: [...nasazeni],
        delka_ctvrtiny_min: delkaParsed,
        pocet_ctvrtin: je_pratelak ? pocet_ctvrtin : DEFAULT_POCET_CTVRTIN,
        status: 'rozehrany',
        skore_nase: 0,
        skore_souper: 0,
        skore_po_ctvrtinach: [],
        vytvoreno_at: now,
      };
      await db.zapasy.add(zapas);
      onSaved(zapas.id);
    } catch (e) {
      chyba = (e as Error).message ?? 'Chyba při ukládání';
    } finally {
      ukladani = false;
    }
  }
</script>

<div class="modal-bg" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="presentation">
    <h2>Nový zápas</h2>

    <div class="form">
      <div class="row3">
        <label>
          <span>Datum *</span>
          <input bind:value={datum} type="date" />
        </label>
        <label>
          <span>Naše kategorie *</span>
          <select bind:value={nase_kategorie}>
            {#each KATEGORIE_PORADI as k}
              <option value={k}>{kategorieLabel(k)}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Naše strana *</span>
          <select bind:value={nase_strana}>
            <option value="home">Domácí</option>
            <option value="away">Hosté</option>
          </select>
        </label>
      </div>

      <div class="row">
        <label>
          <span>Soupeř *</span>
          <select bind:value={souper_id} disabled={je_pratelak && souper_nas_tym}>
            <option value="">- vyber -</option>
            {#each filtrovani_souperi as s}
              <option value={s.id}>{s.nazev}</option>
            {/each}
          </select>
          {#if je_pratelak && souper_nas_tym}
            <small class="hint-info">Soupeř = náš tým (viz níže).</small>
          {:else if filtrovani_souperi.length === 0}
            <small class="hint">Žádný soupeř v kategorii {kategorieLabel(nase_kategorie)}. Přidej v sekci Soupeři.</small>
          {/if}
        </label>
        <label>
          <span>Soutěž *</span>
          <select bind:value={soutez_id}>
            <option value="">- vyber -</option>
            {#each souteze as s}
              <option value={s.id}>{s.nazev}</option>
            {/each}
          </select>
        </label>
      </div>

      {#if je_pratelak}
        <div class="interni-pratelak">
          <label class="checkbox-row">
            <input type="checkbox" bind:checked={souper_nas_tym} />
            <span>Soupeř je náš tým (interní přátelák)</span>
          </label>
          {#if souper_nas_tym}
            <label>
              <span>Náš tým jako soupeř *</span>
              <select bind:value={souper_nas_kategorie}>
                {#each souper_nas_kategorie_moznosti as k}
                  <option value={k}>Jižní Supi {kategorieLabel(k)}</option>
                {/each}
              </select>
              <small class="hint-info">Soupiska se naplní z našich hráčů kategorie {kategorieLabel(souper_nas_kategorie)} (čísla + jména); v zápase ji upravíš přes „✎ Soupiska". Nabízí se naše kategorie do +2 věkové skupiny výš.</small>
            </label>
          {/if}
        </div>
      {/if}

      <div class="row3">
        <label>
          <span>Sezona *</span>
          <input bind:value={sezona} type="text" placeholder="např. 2025/26" />
        </label>
        <label>
          <span>Délka čtvrtiny (min) *</span>
          <input bind:value={delka_ctvrtiny} type="number" min={MIN_Q_LENGTH} max={MAX_Q_LENGTH} step="1" />
        </label>
        {#if je_pratelak}
          <label>
            <span>Počet čtvrtin (přátelák)</span>
            <select bind:value={pocet_ctvrtin}>
              <option value={3}>3 čtvrtiny</option>
              <option value={4}>4 čtvrtiny</option>
            </select>
          </label>
        {/if}
      </div>

      <div class="roster-section">
        <div class="roster-header">
          <span class="label">Nasazení hráči ({nasazeni.length} vybráno, min. 5) - kategorie {kategorieLabel(nase_kategorie)} a starší</span>
          <div class="roster-buttons">
            <button type="button" class="small" onclick={vybratVse}>Vybrat všechny</button>
            <button type="button" class="small" onclick={odznacitVse}>Odznačit</button>
          </div>
        </div>

        {#if nasazeniHraci.length > 0}
          <div class="breakdown">
            <div class="bd-row">
              <span class="bd-label">Ročníky:</span>
              {#each breakdownRocnik as [rocnik, pocet]}
                <span
                  class="bd-chip"
                  class:dominantni={rocnik === dominantniRocnik}
                  class:varovani={rocnik !== dominantniRocnik && pocet > VAROVANI_LIMIT_PER_GROUP}
                  title={rocnik === dominantniRocnik ? 'Hlavní ročník' : `${pocet > VAROVANI_LIMIT_PER_GROUP ? '⚠ ' : ''}Doplňující ročník`}
                >
                  {rocnik} · {pocet}
                </span>
              {/each}
            </div>
            <div class="bd-row">
              <span class="bd-label">Kategorie:</span>
              {#each breakdownKategorie as [kat, pocet]}
                <span
                  class="bd-chip"
                  class:dominantni={kat === dominantniKategorie}
                  class:varovani={kat !== dominantniKategorie && pocet > VAROVANI_LIMIT_PER_GROUP}
                  title={kat === dominantniKategorie ? 'Hlavní kategorie' : `${pocet > VAROVANI_LIMIT_PER_GROUP ? '⚠ ' : ''}Doplňující kategorie`}
                >
                  {kategorieLabel(kat)} · {pocet}
                </span>
              {/each}
            </div>
            {#if breakdownRocnik.some(([r, p]) => r !== dominantniRocnik && p > VAROVANI_LIMIT_PER_GROUP) || breakdownKategorie.some(([k, p]) => k !== dominantniKategorie && p > VAROVANI_LIMIT_PER_GROUP)}
              <div class="bd-warning">
                ⚠ Vybraná sestava obsahuje skupinu s {VAROVANI_LIMIT_PER_GROUP}+ hráči mimo hlavní ročník/kategorii. Ověřte si limit federace pro tuto soutěž.
              </div>
            {/if}
          </div>
        {/if}

        {#if eligible_hraci.length === 0}
          <div class="empty">Žádní oprávnění hráči pro kategorii {kategorieLabel(nase_kategorie)}.</div>
        {:else}
          <div class="players-grid">
            {#each eligible_hraci as h (h.id)}
              <button
                type="button"
                class="player-card"
                class:selected={nasazeni.includes(h.id)}
                onclick={() => toggleHrac(h.id)}
              >
                <Avatar foto={h.foto} cislo={h.cislo_dresu} size={CARD_AVATAR_SIZE} alt={`${h.jmeno} ${h.prijmeni}`} tmavy={nase_strana === 'away'} />
                <span class="name">{h.prijmeni}</span>
                <span class="meta">{kategorieLabel(h.domaci_kategorie)}{h.pozice ? ` · ${h.pozice}` : ''}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if chyba}
        <div class="chyba">{chyba}</div>
      {/if}

      <div class="buttons">
        <button type="button" onclick={onClose} disabled={ukladani}>Zrušit</button>
        <button type="button" class="primary" onclick={ulozit} disabled={ukladani}>
          {ukladani ? 'Ukládám…' : 'Založit zápas'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-bg {
    position: fixed; inset: 0;
    background: var(--modal-bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
    padding: 16px;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 800px; max-width: 100%;
    max-height: 90vh; overflow-y: auto;
    box-shadow: var(--shadow-strong);
  }
  .modal h2 { font-size: 22px; margin-bottom: 20px; color: var(--accent); }
  .form { display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
  label span { font-weight: 500; }
  input[type="text"], input[type="date"], select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  .hint { color: var(--warn); font-size: 12px; margin-top: 4px; }
  .hint-info { color: var(--text-muted); font-size: 12px; margin-top: 4px; line-height: 1.4; }
  .checkbox-row { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; }
  .checkbox-row input { width: 18px; height: 18px; cursor: pointer; }
  .interni-pratelak {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
  }

  .roster-section {
    background: var(--surface-2);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .roster-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .label { font-size: 13px; color: var(--text-muted); font-weight: 500; }
  .roster-buttons { display: flex; gap: 6px; }
  .empty { color: var(--text-dim); text-align: center; padding: 16px; font-size: 13px; }

  .breakdown {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bd-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .bd-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    min-width: 75px;
  }
  .bd-chip {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    font-family: "Consolas", monospace;
  }
  .bd-chip.dominantni {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  .bd-chip.varovani {
    background: var(--danger-bg);
    color: var(--danger-fg);
    border-color: var(--danger);
  }
  .bd-warning {
    background: var(--danger-bg);
    color: var(--danger-fg);
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    margin-top: 4px;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }
  .player-card {
    background: var(--surface);
    border: 2px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 10px 8px;
    cursor: pointer;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    transition: all 0.1s ease;
  }
  .player-card:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .player-card.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
    color: var(--selected-fg);
  }
  .player-card .name { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .player-card .meta { font-size: 11px; color: var(--text-muted); }
  .player-card.selected .meta { color: var(--selected-fg); opacity: 0.85; }

  .chyba {
    background: var(--danger-bg);
    color: var(--danger-fg);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
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
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
