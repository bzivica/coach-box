<script lang="ts">
  import { untrack } from 'svelte';
  import { db, newId } from '../lib/db';
  import type { Soutez, SoutezTyp, SoutezRegion } from '../lib/types';

  const TYPY: SoutezTyp[] = ['liga', 'pohar', 'turnaj', 'pratelak', 'jiny'];
  const REGIONY: SoutezRegion[] = ['domaci', 'regionalni', 'mezinarodni'];

  type Props = {
    existing?: Soutez;
    onClose: () => void;
    onSaved: () => void;
  };

  let { existing, onClose, onSaved }: Props = $props();

  const initial = untrack(() => ({
    nazev: existing?.nazev ?? '',
    typ: (existing?.typ ?? 'liga') as SoutezTyp,
    region: (existing?.region ?? '') as SoutezRegion | '',
    bezLimitu: existing?.bez_limitu_mladeze ?? false,
    aktivni: existing?.aktivni ?? true,
  }));

  let nazev = $state(initial.nazev);
  let typ = $state<SoutezTyp>(initial.typ);
  let region = $state<SoutezRegion | ''>(initial.region);
  let bezLimituMladeze = $state(initial.bezLimitu);
  let aktivni = $state(initial.aktivni);

  let chyba = $state<string | null>(null);
  let ukladani = $state(false);

  async function ulozit() {
    chyba = null;
    if (!nazev.trim()) { chyba = 'Název soutěže je povinný'; return; }

    ukladani = true;
    try {
      const now = Date.now();
      if (existing) {
        await db.souteze.update(existing.id, {
          nazev: nazev.trim(),
          typ,
          region: region || undefined,
          bez_limitu_mladeze: bezLimituMladeze || undefined,
          aktivni,
          updated_at: now,
        });
      } else {
        const nova: Soutez = {
          id: newId(),
          nazev: nazev.trim(),
          typ,
          region: region || undefined,
          bez_limitu_mladeze: bezLimituMladeze || undefined,
          aktivni,
          vytvoreno_at: now,
          updated_at: now,
        };
        await db.souteze.add(nova);
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
    <h2>{existing ? 'Upravit soutěž' : 'Nová soutěž'}</h2>

    <div class="form">
      <label>
        <span>Název *</span>
        <input bind:value={nazev} type="text" autocomplete="off" placeholder="např. Pražský přebor" />
      </label>

      <div class="row">
        <label>
          <span>Typ *</span>
          <select bind:value={typ}>
            {#each TYPY as t}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Region</span>
          <select bind:value={region}>
            <option value="">-</option>
            {#each REGIONY as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
        </label>
      </div>

      <label class="checkbox">
        <input bind:checked={bezLimituMladeze} type="checkbox" />
        <span>Neplatí limity mládeže (turnaje, CEYBL apod. - žádné varování na počet čtvrtin ani U14 Q1+Q2+Q3)</span>
      </label>

      <label class="checkbox">
        <input bind:checked={aktivni} type="checkbox" />
        <span>Aktivní</span>
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
    position: fixed; inset: 0;
    background: var(--modal-bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 500px; max-width: 92vw;
    box-shadow: var(--shadow-strong);
  }
  .modal h2 { font-size: 20px; margin-bottom: 20px; color: var(--accent); }
  .form { display: flex; flex-direction: column; gap: 14px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
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
