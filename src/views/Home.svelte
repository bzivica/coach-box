<script lang="ts">
  import { onMount } from 'svelte';
  import { db, exportAll, importReplace, importMerge, type ExportData, type MergeResult } from '../lib/db';

  const AKTIVNI_SEZONA_KLIC = 'aktivni_sezona';

  let pocetHracu = $state(0);
  let pocetSoutezi = $state(0);
  let pocetZapasu = $state(0);
  let pocetSouperu = $state(0);

  let aktivniSezony = $state<string[]>([]);
  let aktivniSezona = $state('');

  let zprava = $state<string | null>(null);
  let zpravaTyp = $state<'ok' | 'err'>('ok');

  const MSG_TIMEOUT_MS = 4000;

  onMount(reload);

  async function reload() {
    pocetHracu = await db.hraci.count();
    pocetSoutezi = await db.souteze.count();
    pocetZapasu = await db.zapasy.count();
    pocetSouperu = await db.souperi.count();
    const zapasy = await db.zapasy.toArray();
    aktivniSezony = [...new Set(zapasy.map((z) => z.sezona))].sort().reverse();
    const row = await db.nastaveni.get(AKTIVNI_SEZONA_KLIC);
    aktivniSezona = typeof row?.hodnota === 'string' ? row.hodnota : '';
  }

  async function ulozAktivniSezonu(s: string) {
    aktivniSezona = s;
    await db.nastaveni.put({ klic: AKTIVNI_SEZONA_KLIC, hodnota: s });
    if (s) {
      showMsg(`Aktivní sezona nastavena na ${s}. Statistiky se nyní defaultně filtrují na tuto sezonu.`);
    } else {
      showMsg('Aktivní sezona zrušena. Statistiky zobrazí vše.');
    }
  }

  function showMsg(text: string, typ: 'ok' | 'err' = 'ok') {
    zprava = text;
    zpravaTyp = typ;
    setTimeout(() => { if (zprava === text) zprava = null; }, MSG_TIMEOUT_MS);
  }

  async function exportData() {
    try {
      const payload = await exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `basket-data-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg(`Export OK: ${payload.data.hraci.length} hráčů, ${payload.data.zapasy.length} zápasů.`);
    } catch (e) {
      showMsg(`Export selhal: ${(e as Error).message}`, 'err');
    }
  }

  async function importData(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    if (!confirm('Import přepíše VŠECHNA existující data v této instanci (hráče, soupeře, soutěže, zápasy).\n\nPokračovat?')) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportData;
      await importReplace(payload);
      await reload();
      showMsg(`Import OK: ${payload.data.hraci.length} hráčů, ${payload.data.zapasy.length} zápasů.`);
    } catch (err) {
      showMsg(`Import selhal: ${(err as Error).message}`, 'err');
    }
  }

  function formatMergeStats(r: MergeResult): string {
    const lines: string[] = [];
    const pridej = (label: string, s: { added: number; updated: number; skipped: number }) => {
      if (s.added || s.updated) {
        const parts = [];
        if (s.added) parts.push(`+${s.added} nových`);
        if (s.updated) parts.push(`${s.updated} aktualizováno`);
        lines.push(`${label}: ${parts.join(', ')}`);
      }
    };
    pridej('Hráči', r.hraci);
    pridej('Soutěže', r.souteze);
    pridej('Soupeři', r.souperi);
    pridej('Zápasy', r.zapasy);
    if (r.ctvrtiny.added) lines.push(`Čtvrtiny: +${r.ctvrtiny.added} nových`);
    if (r.udalosti.added) lines.push(`Události: +${r.udalosti.added} nových`);
    if (r.hraci_duplikaty_smazany) lines.push(`Sloučeno ${r.hraci_duplikaty_smazany} duplicitních hráčů`);
    if (r.zapasy_with_changes) lines.push(`Přepočítáno skóre ${r.zapasy_with_changes} zápasů`);
    return lines.length ? lines.join('; ') : 'Žádné nové změny - všechno už máš.';
  }

  async function importDataMerge(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    if (!confirm('Sloučí data ze souboru s tvými stávajícími:\n\n• Nové entity přidá\n• Stejné hráče/soupeře/zápasy ponechá, případně doplní novější údaje\n• Statistiky přepočítá z událostí (nezdvojí)\n• Tvoje data nepřepíše\n\nPokračovat?')) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportData;
      const result = await importMerge(payload);
      await reload();
      showMsg(`Sloučení OK. ${formatMergeStats(result)}`);
    } catch (err) {
      showMsg(`Sloučení selhalo: ${(err as Error).message}`, 'err');
    }
  }
</script>

<section class="cards">
  <div class="card">
    <div class="num">{pocetHracu}</div>
    <div class="label">Hráčů v evidenci</div>
  </div>
  <div class="card">
    <div class="num">{pocetSouperu}</div>
    <div class="label">Soupeřů</div>
  </div>
  <div class="card">
    <div class="num">{pocetSoutezi}</div>
    <div class="label">Soutěží</div>
  </div>
  <div class="card">
    <div class="num">{pocetZapasu}</div>
    <div class="label">Zápasů</div>
  </div>
</section>

<section class="aktivni-sezona">
  <h2>Aktivní sezona</h2>
  <p class="muted">Pokud nastavíš aktivní sezonu, <strong>Statistiky</strong> se na ni defaultně předfiltrují. Můžeš ji v Statistikách kdykoli ručně přepnout - toto je jen výchozí stav po otevření aplikace.</p>
  <div class="sezona-row">
    <select bind:value={aktivniSezona} onchange={(e) => ulozAktivniSezonu((e.currentTarget as HTMLSelectElement).value)}>
      <option value="">- bez výchozí sezony -</option>
      {#each aktivniSezony as s}
        <option value={s}>{s}</option>
      {/each}
    </select>
    {#if aktivniSezona}
      <span class="sezona-cur">Současná: <strong>{aktivniSezona}</strong></span>
    {/if}
  </div>
</section>

<section class="export-import">
  <h2>Záloha / přenos dat</h2>
  <p class="muted">Data jsou uložená v prohlížeči (IndexedDB). Pro přenos mezi zařízeními nebo zálohu použij Export. Sloučit = doplnit nové z jiného zařízení, ponechat stávající.</p>
  <div class="ei-buttons">
    <button class="primary" onclick={exportData}>📥 Export všech dat (JSON)</button>
    <label class="import-btn merge">
      🔀 Sloučit z JSON
      <input type="file" accept="application/json" onchange={importDataMerge} hidden />
    </label>
    <label class="import-btn">
      📤 Import (přepsat) z JSON
      <input type="file" accept="application/json" onchange={importData} hidden />
    </label>
  </div>
  {#if zprava}
    <div class="msg msg-{zpravaTyp}">{zprava}</div>
  {/if}
</section>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    box-shadow: var(--shadow);
  }
  .num {
    font-size: 36px;
    font-weight: 700;
    color: var(--accent);
  }
  .label {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .aktivni-sezona {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px 24px;
    box-shadow: var(--shadow);
    margin-bottom: 16px;
  }
  .aktivni-sezona h2 {
    font-size: 16px;
    margin-bottom: 8px;
    color: var(--text);
  }
  .sezona-row {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .sezona-row select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 6px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 14px;
    min-width: 220px;
  }
  .sezona-row select:focus { outline: none; border-color: var(--accent); }
  .sezona-cur {
    color: var(--text-muted);
    font-size: 13px;
  }
  .sezona-cur strong { color: var(--accent); }

  .export-import {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px 24px;
    box-shadow: var(--shadow);
  }
  .export-import h2 {
    font-size: 16px;
    margin-bottom: 8px;
    color: var(--text);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin-bottom: 14px;
  }
  .ei-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ei-buttons button,
  .ei-buttons .import-btn {
    background: var(--surface-hover);
    border: none;
    color: var(--text);
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ei-buttons button:hover,
  .ei-buttons .import-btn:hover { background: var(--border-strong); color: var(--accent-fg); }
  .ei-buttons button.primary { background: var(--accent); color: var(--accent-fg); }
  .ei-buttons button.primary:hover { background: var(--accent-hover); color: var(--accent-fg); }
  .ei-buttons .import-btn.merge {
    background: var(--success-bg, var(--surface-hover));
    color: var(--success-fg, var(--text));
    border: 1px solid var(--success, var(--border));
  }
  .ei-buttons .import-btn.merge:hover {
    background: var(--success);
    color: #ffffff;
    border-color: var(--success);
  }
  .msg {
    margin-top: 14px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
  }
  .msg-ok { background: var(--success-bg); color: var(--success-fg); }
  .msg-err { background: var(--danger-bg); color: var(--danger-fg); }
</style>
