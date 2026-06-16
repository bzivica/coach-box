<script lang="ts">
  import { onMount } from 'svelte';
  import { db, newId } from '../lib/db';
  import {
    KATEGORIE_PORADI,
    aktualniSezonaSpringYear,
    kategorieLabel,
    hrajeZaKategorii,
    VEKOVA_SKUPINA,
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

  function sezonaZData(d: string): string | null {
    const [y, m] = d.split('-').map(Number);
    if (!y || !m) return null;
    const spring = aktualniSezonaSpringYear(new Date(y, m - 1, 1));
    return `${spring - 1}/${spring % 100}`;
  }

  let datum = $state(today);
  let nase_kategorie = $state<Kategorie>('U14');
  let souper_id = $state('');
  let soutez_id = $state('');
  let sezona = $state(sezonaZData(today) ?? '');
  let sezonaRucne = $state(false);
  let nase_strana = $state<NaseStrana>('home');
  let souper_nas_tym = $state(false);
  let souper_nas_kategorie = $state<Kategorie>('U14');
  let nasazeni = $state<string[]>([]);
  let pridani = $state<string[]>([]); // jednotlivci pridani rucne pres "+ Pridat hrace"
  let hledani = $state('');
  let pickerOtevren = $state(false);
  let delka_ctvrtiny = $state(String(DEFAULT_DELKA_CTVRTINY_MIN));

  let hraci = $state<Hrac[]>([]);
  let souperi = $state<Souper[]>([]);
  let souteze = $state<Soutez[]>([]);
  let zapasy = $state<Zapas[]>([]);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);

  onMount(async () => {
    hraci = (await db.hraci.toArray()).filter((h) => h.aktivni);
    souperi = await db.souperi.orderBy('nazev').toArray();
    souteze = await db.souteze.toArray();
    souteze = souteze.filter((s) => s.aktivni);
    zapasy = await db.zapasy.toArray();
  });

  // Kategorie, ve kterych uz hrac nekdy byl v soupisce zapasu (historie) - pro auto-nabidku.
  const odehraneKategorie = $derived.by(() => {
    const map = new Map<string, Set<Kategorie>>();
    for (const z of zapasy) {
      for (const id of z.nasazeni_hraci) {
        const s = map.get(id) ?? new Set<Kategorie>();
        s.add(z.nase_kategorie);
        map.set(id, s);
      }
    }
    return map;
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

  $effect(() => {
    if (sezonaRucne) return;
    const s = sezonaZData(datum);
    if (s) sezona = s;
  });
  const radDleCisla = (a: Hrac, b: Hrac) => (a.cislo_dresu ?? 99) - (b.cislo_dresu ?? 99);

  // Zakladni nabidka: hraci presne te kategorie + ti s priznakem "obvykle hraje i za" + ti,
  // kdo uz nekdy hrali zapas teto kategorie (historie). Plus rucne pridani jednotlivci.
  const eligible_hraci = $derived(
    hraci
      .filter(
        (h) =>
          hrajeZaKategorii(h, nase_kategorie, odehraneKategorie.get(h.id)) ||
          (pridani.includes(h.id) && VEKOVA_SKUPINA[h.domaci_kategorie] <= VEKOVA_SKUPINA[nase_kategorie]),
      )
      .sort(radDleCisla),
  );

  // Picker "+ Pridat hrace": kdokoli stejne stary nebo mladsi (ne starsi), kdo zatim neni
  // v nabidce a sedi na hledani podle jmena.
  const pridatelni = $derived.by(() => {
    const vMrizce = new Set(eligible_hraci.map((h) => h.id));
    const cilSkupina = VEKOVA_SKUPINA[nase_kategorie];
    const q = hledani.trim().toLocaleLowerCase('cs');
    return hraci
      .filter((h) => !vMrizce.has(h.id))
      .filter((h) => VEKOVA_SKUPINA[h.domaci_kategorie] <= cilSkupina) // stejne stari a mladsi, ne starsi
      .filter((h) => !q || `${h.jmeno} ${h.prijmeni}`.toLocaleLowerCase('cs').includes(q))
      .sort((a, b) => a.prijmeni.localeCompare(b.prijmeni, 'cs'))
      .slice(0, 30);
  });

  function pridejHrace(id: string) {
    if (!pridani.includes(id)) pridani = [...pridani, id];
    if (!nasazeni.includes(id)) nasazeni = [...nasazeni, id];
    hledani = '';
  }

  // Pri zmene kategorie/pohlavi odznac a odeber ty, kdo uz do nabidky nepatri.
  $effect(() => {
    const opravneni = new Set(eligible_hraci.map((h) => h.id));
    const orezN = nasazeni.filter((id) => opravneni.has(id));
    if (orezN.length !== nasazeni.length) nasazeni = orezN;
    const orezP = pridani.filter((id) => opravneni.has(id));
    if (orezP.length !== pridani.length) pridani = orezP;
  });

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
        pocet_ctvrtin: DEFAULT_POCET_CTVRTIN,
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
          <input bind:value={sezona} oninput={() => (sezonaRucne = true)} type="text" placeholder="např. 2025/26" />
        </label>
        <label>
          <span>Délka čtvrtiny (min) *</span>
          <input bind:value={delka_ctvrtiny} type="number" min={MIN_Q_LENGTH} max={MAX_Q_LENGTH} step="1" />
        </label>
      </div>

      <div class="roster-section">
        <div class="roster-header">
          <span class="label">Nasazení hráči ({nasazeni.length} vybráno, min. 5) - kategorie {kategorieLabel(nase_kategorie)}</span>
          <div class="roster-buttons">
            <button type="button" class="small" class:active={pickerOtevren} onclick={() => (pickerOtevren = !pickerOtevren)}>+ Přidat hráče</button>
            <button type="button" class="small" onclick={vybratVse}>Vybrat všechny</button>
            <button type="button" class="small" onclick={odznacitVse}>Odznačit</button>
          </div>
        </div>

        {#if pickerOtevren}
          <div class="picker">
            <input
              class="picker-input"
              type="text"
              bind:value={hledani}
              placeholder="Hledej jméno mladšího hráče…"
              autocomplete="off"
            />
            {#if pridatelni.length === 0}
              <div class="picker-empty">Nikdo k přidání {hledani.trim() ? 'neodpovídá hledání' : '(všichni už jsou v nabídce)'}.</div>
            {:else}
              <div class="picker-list">
                {#each pridatelni as h (h.id)}
                  <button type="button" class="picker-item" onclick={() => pridejHrace(h.id)}>
                    <span class="pi-name">{h.prijmeni} {h.jmeno}</span>
                    <span class="pi-meta">{kategorieLabel(h.domaci_kategorie)}{h.cislo_dresu !== undefined ? ` · #${h.cislo_dresu}` : ''}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

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
    overflow-y: auto;
    z-index: 100;
    padding: 16px;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 800px; max-width: 100%;
    max-height: 90dvh; overflow-y: auto;
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
  button.small.active { background: var(--accent); color: var(--accent-fg); }
  .picker {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .picker-input {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 9px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  .picker-input:focus { outline: none; border-color: var(--accent); }
  .picker-empty { color: var(--text-dim); font-size: 13px; padding: 4px 2px; }
  .picker-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; }
  .picker-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 6px;
    text-align: left;
    font-family: inherit;
  }
  .picker-item:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .pi-name { font-size: 14px; font-weight: 600; }
  .pi-meta { font-size: 12px; color: var(--text-muted); }
  button:hover:not(:disabled) { background: var(--border-strong); color: var(--accent-fg); }
  button.primary { background: var(--accent); color: var(--accent-fg); }
  button.primary:hover:not(:disabled) { background: var(--accent-hover); color: var(--accent-fg); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 600px) {
    .modal-bg { align-items: flex-start; padding: 0; }
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
    .row, .row3 { grid-template-columns: 1fr; }
    .players-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
    .buttons button:not(.small) { flex: 1; padding: 12px; }
  }
</style>
