<script lang="ts">
  import { untrack } from 'svelte';
  import { db, newId } from '../lib/db';
  import { KATEGORIE_PORADI, kategorieLabel, vypoctiVek, type Hrac, type Kategorie, type Pozice } from '../lib/types';
  import Avatar from './Avatar.svelte';

  const POZICE_HODNOTY: Pozice[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const FOTO_MAX_PX = 240;
  const FOTO_JPEG_QUALITY = 0.85;
  const FOTO_PREVIEW_PX = 96;
  const VYSKA_MIN_CM = 100;
  const VYSKA_MAX_CM = 230;
  const ROCNIK_MIN = 1990;
  const ROCNIK_MAX = new Date().getFullYear();

  type Props = {
    existing?: Hrac;
    onClose: () => void;
    onSaved: () => void;
  };

  let { existing, onClose, onSaved }: Props = $props();

  const initial = untrack(() => ({
    jmeno: existing?.jmeno ?? '',
    prijmeni: existing?.prijmeni ?? '',
    cislo_dresu: existing?.cislo_dresu !== undefined ? String(existing.cislo_dresu) : '',
    pozice: (existing?.pozice ?? '') as Pozice | '',
    datum_narozeni: existing?.datum_narozeni ?? '',
    rocnik_narozeni: existing?.rocnik_narozeni !== undefined ? String(existing.rocnik_narozeni) : '',
    vyska_cm: existing?.vyska_cm !== undefined ? String(existing.vyska_cm) : '',
    domaci_kategorie: (existing?.domaci_kategorie ?? 'U13') as Kategorie,
    foto: existing?.foto ?? '',
    aktivni: existing?.aktivni ?? true,
  }));

  let jmeno = $state(initial.jmeno);
  let prijmeni = $state(initial.prijmeni);
  let cislo_dresu = $state(initial.cislo_dresu);
  let pozice = $state<Pozice | ''>(initial.pozice);
  let datum_narozeni = $state(initial.datum_narozeni);
  let rocnik_narozeni = $state(initial.rocnik_narozeni);
  let vyska_cm = $state(initial.vyska_cm);
  let domaci_kategorie = $state<Kategorie>(initial.domaci_kategorie);

  $effect(() => {
    if (datum_narozeni && datum_narozeni.length >= 4) {
      const yearFromDate = datum_narozeni.slice(0, 4);
      if (yearFromDate !== rocnik_narozeni) {
        rocnik_narozeni = yearFromDate;
      }
    }
  });

  const aktualniVek = $derived.by(() => {
    const r = Number(rocnik_narozeni);
    if (!Number.isInteger(r) || r < ROCNIK_MIN || r > ROCNIK_MAX) return null;
    return vypoctiVek(r);
  });
  let foto = $state<string>(initial.foto);
  let aktivni = $state(initial.aktivni);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);
  let nahravam = $state(false);

  async function nactiFoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    nahravam = true;
    chyba = null;
    try {
      foto = await fileToResizedDataUrl(file, FOTO_MAX_PX, FOTO_JPEG_QUALITY);
    } catch (err) {
      chyba = `Nepodařilo se načíst foto: ${(err as Error).message}`;
    } finally {
      nahravam = false;
    }
  }

  function smazatFoto() {
    foto = '';
  }

  async function fileToResizedDataUrl(file: File, maxPx: number, quality: number): Promise<string> {
    const blobUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(blobUrl);
      const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxPx);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas není dostupný');
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Obrázek nelze přečíst'));
      img.src = src;
    });
  }

  function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
    if (w <= max && h <= max) return { width: w, height: h };
    const ratio = w / h;
    return ratio >= 1
      ? { width: max, height: Math.round(max / ratio) }
      : { width: Math.round(max * ratio), height: max };
  }

  async function ulozit() {
    chyba = null;

    if (!jmeno.trim()) { chyba = 'Jméno je povinné'; return; }
    if (!prijmeni.trim()) { chyba = 'Příjmení je povinné'; return; }

    let cisloParsed: number | undefined;
    if (cislo_dresu.trim() !== '') {
      const n = Number(cislo_dresu);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        chyba = 'Číslo dresu musí být celé číslo 0–99 (nebo prázdné)';
        return;
      }
      cisloParsed = n;
    }

    let vyskaParsed: number | undefined;
    if (vyska_cm.trim() !== '') {
      const n = Number(vyska_cm);
      if (!Number.isInteger(n) || n < VYSKA_MIN_CM || n > VYSKA_MAX_CM) {
        chyba = `Výška musí být celé číslo ${VYSKA_MIN_CM}–${VYSKA_MAX_CM} cm (nebo prázdné)`;
        return;
      }
      vyskaParsed = n;
    }

    let rocnikParsed: number | undefined;
    if (rocnik_narozeni.trim() !== '') {
      const n = Number(rocnik_narozeni);
      if (!Number.isInteger(n) || n < ROCNIK_MIN || n > ROCNIK_MAX) {
        chyba = `Ročník musí být ${ROCNIK_MIN}–${ROCNIK_MAX}`;
        return;
      }
      rocnikParsed = n;
    }

    ukladani = true;
    try {
      const now = Date.now();
      if (existing) {
        await db.hraci.update(existing.id, {
          jmeno: jmeno.trim(),
          prijmeni: prijmeni.trim(),
          cislo_dresu: cisloParsed,
          pozice: pozice || undefined,
          datum_narozeni: datum_narozeni || undefined,
          rocnik_narozeni: rocnikParsed,
          vyska_cm: vyskaParsed,
          domaci_kategorie,
          foto: foto || undefined,
          aktivni,
          updated_at: now,
        });
      } else {
        const novy: Hrac = {
          id: newId(),
          jmeno: jmeno.trim(),
          prijmeni: prijmeni.trim(),
          cislo_dresu: cisloParsed,
          pozice: pozice || undefined,
          datum_narozeni: datum_narozeni || undefined,
          rocnik_narozeni: rocnikParsed,
          vyska_cm: vyskaParsed,
          domaci_kategorie,
          foto: foto || undefined,
          aktivni,
          vytvoreno_at: now,
          updated_at: now,
        };
        await db.hraci.add(novy);
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
    <h2>{existing ? 'Upravit hráče' : 'Nový hráč'}</h2>

    <div class="form">
      <div class="foto-row">
        <Avatar foto={foto || undefined} cislo={Number(cislo_dresu) || undefined} size={FOTO_PREVIEW_PX} alt={`${jmeno} ${prijmeni}`} />
        <div class="foto-actions">
          <label class="foto-btn">
            {foto ? 'Vyměnit foto' : 'Nahrát foto'}
            <input type="file" accept="image/*" onchange={nactiFoto} hidden disabled={nahravam} />
          </label>
          {#if foto}
            <button type="button" class="danger small" onclick={smazatFoto}>Odstranit</button>
          {/if}
          {#if nahravam}
            <span class="foto-hint">Načítám…</span>
          {:else if !foto && cislo_dresu}
            <span class="foto-hint">Zatím dres s číslem {cislo_dresu}</span>
          {:else if !foto}
            <span class="foto-hint">Bez fotky se ukáže silueta / dres</span>
          {/if}
        </div>
      </div>

      <div class="row">
        <label>
          <span>Jméno *</span>
          <input bind:value={jmeno} type="text" autocomplete="off" />
        </label>
        <label>
          <span>Příjmení *</span>
          <input bind:value={prijmeni} type="text" autocomplete="off" />
        </label>
      </div>

      <div class="row3">
        <label>
          <span>Číslo dresu *</span>
          <input bind:value={cislo_dresu} type="number" min="0" max="99" />
        </label>
        <label>
          <span>Pozice</span>
          <select bind:value={pozice}>
            <option value="">—</option>
            {#each POZICE_HODNOTY as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Výška (cm)</span>
          <input bind:value={vyska_cm} type="number" min={VYSKA_MIN_CM} max={VYSKA_MAX_CM} placeholder="např. 175" />
        </label>
      </div>

      <div class="row3">
        <label>
          <span>Datum narození <small class="opt">(volitelné)</small></span>
          <input bind:value={datum_narozeni} type="date" />
        </label>
        <label>
          <span>Ročník narození {#if aktualniVek !== null}<small class="vek-info">věk: {aktualniVek}</small>{/if}</span>
          <input bind:value={rocnik_narozeni} type="number" min={ROCNIK_MIN} max={ROCNIK_MAX} placeholder="např. 2012" />
        </label>
        <label>
          <span>Domácí kategorie *</span>
          <select bind:value={domaci_kategorie}>
            {#each KATEGORIE_PORADI as k}
              <option value={k}>{kategorieLabel(k)}</option>
            {/each}
          </select>
        </label>
      </div>

      <label class="checkbox">
        <input bind:checked={aktivni} type="checkbox" />
        <span>Aktivní (v soupisce klubu)</span>
      </label>

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
  .modal h2 {
    font-size: 20px;
    margin-bottom: 20px;
    color: var(--accent);
  }
  .form { display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .opt {
    font-weight: 400;
    color: var(--text-dim);
    font-size: 11px;
  }
  .vek-info {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    margin-left: 8px;
  }
  .foto-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    background: var(--surface-2);
    border-radius: 8px;
  }
  .foto-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .foto-btn {
    display: inline-flex;
    align-items: center;
    background: var(--accent);
    color: var(--accent-fg);
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    border: none;
  }
  .foto-btn:hover { background: var(--accent-hover); }
  .foto-hint { color: var(--text-muted); font-size: 12px; }
  button.danger.small { background: var(--danger); color: var(--accent-fg); padding: 6px 12px; font-size: 13px; }
  button.danger.small:hover { background: var(--danger-hover); }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-muted); }
  label span { font-weight: 500; }
  input[type="text"], input[type="number"], input[type="date"], select {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  .checkbox { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; }
  .checkbox input { width: 18px; height: 18px; cursor: pointer; }
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
  button:hover:not(:disabled) { background: var(--border-strong); color: var(--accent-fg); }
  button.primary { background: var(--accent); color: var(--accent-fg); }
  button.primary:hover:not(:disabled) { background: var(--accent-hover); color: var(--accent-fg); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
