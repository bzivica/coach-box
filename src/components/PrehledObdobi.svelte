<script lang="ts">
  import type { Udalost, Ctvrtina } from '../lib/types';
  import { formatCtvrtina, DEFAULT_POCET_CTVRTIN } from '../lib/types';
  import {
    computeSkore,
    computeSkorePoCtvrtinach,
    computeTeamSummary,
    computeOppTotals,
    maxVedeni,
    strelbaProcento,
  } from '../lib/live';

  interface Props {
    udalosti: Udalost[];
    ctvrtiny: Ctvrtina[];
    naseDoma: boolean;
    pocetCtvrtin?: number;
    nasNazev: string;
    souperNazev: string;
    initialPeriod?: string;
    onClose: () => void;
    closeLabel?: string;
  }

  let {
    udalosti,
    ctvrtiny,
    naseDoma,
    pocetCtvrtin = DEFAULT_POCET_CTVRTIN,
    nasNazev,
    souperNazev,
    initialPeriod,
    onClose,
    closeLabel = 'Pokračovat',
  }: Props = $props();

  interface Obdobi {
    key: string;
    label: string;
    quarters: number[];
  }

  const odehraneQ = $derived(
    [...new Set(ctvrtiny.map((c) => c.cislo))].sort((a, b) => a - b),
  );

  const obdobi = $derived.by<Obdobi[]>(() => {
    const out: Obdobi[] = [];
    for (const q of odehraneQ) {
      out.push({ key: `q${q}`, label: formatCtvrtina(q, pocetCtvrtin), quarters: [q] });
    }
    const polovina = Math.floor(pocetCtvrtin / 2);
    const prvni = odehraneQ.filter((q) => q <= polovina);
    const druhy = odehraneQ.filter((q) => q > polovina && q <= pocetCtvrtin);
    if (prvni.length > 1) out.push({ key: 'h1', label: '1. poločas', quarters: prvni });
    if (druhy.length > 1) out.push({ key: 'h2', label: '2. poločas', quarters: druhy });
    if (odehraneQ.length > 1) {
      out.push({ key: 'total', label: 'Celý zápas', quarters: [...odehraneQ] });
    }
    return out;
  });

  let vybrane = $state(initialPeriod ?? 'total');
  const aktivni = $derived(
    obdobi.find((o) => o.key === vybrane) ?? obdobi[obdobi.length - 1],
  );
  const quartersSet = $derived(new Set(aktivni?.quarters ?? odehraneQ));
  const udalostiObdobi = $derived(
    udalosti.filter((u) => quartersSet.has(u.ctvrtina_cislo)),
  );

  // Celkové (kumulativní) skóre do hlavičky + rozpis po čtvrtinách pro strip.
  const skoreCelkem = $derived(computeSkore(udalosti));
  const skorePoQ = $derived(computeSkorePoCtvrtinach(udalosti, ctvrtiny));

  // Statistiky vybraného období.
  const nasSouhrn = $derived(computeTeamSummary(udalostiObdobi));
  const oppSouhrn = $derived(computeOppTotals(udalostiObdobi));
  const vedeni = $derived(maxVedeni(udalostiObdobi));

  // Orientace: domácí vlevo. Mapujeme naše vs. soupeřovy hodnoty na home/away.
  const homeScore = $derived(naseDoma ? skoreCelkem.nase : skoreCelkem.souper);
  const awayScore = $derived(naseDoma ? skoreCelkem.souper : skoreCelkem.nase);
  const homeNazev = $derived(naseDoma ? nasNazev : souperNazev);
  const awayNazev = $derived(naseDoma ? souperNazev : nasNazev);
  const homeJsmeMy = $derived(naseDoma);

  function fmtStrelbaNas(dany: number, pokusy: number): string {
    const p = strelbaProcento(dany, pokusy);
    return `${dany}/${pokusy}${p !== null ? ` (${p}%)` : ''}`;
  }

  // Řádky srovnání. Pro NAŠI stranu plná střelba m/a (%), pro SOUPEŘE jen koše (pokusy neevidujeme).
  interface Radek {
    label: string;
    nas: string;
    opp: string;
    hlavni?: boolean;
  }

  const radky = $derived.by<Radek[]>(() => {
    const o = oppSouhrn;
    const n = nasSouhrn;
    return [
      { label: 'Body', nas: String(n.body), opp: String(o.body), hlavni: true },
      { label: '2 body', nas: fmtStrelbaNas(n.dany_2, n.pokusy_2), opp: `${o.body_2 / 2} košů` },
      { label: '3 body', nas: fmtStrelbaNas(n.dany_3, n.pokusy_3), opp: `${o.body_3 / 3} košů` },
      { label: 'Trestné', nas: fmtStrelbaNas(n.dany_th, n.pokusy_th), opp: `${o.body_th} košů` },
      { label: 'Doskoky', nas: String(n.doskoky_off + n.doskoky_def), opp: String(o.doskoky_off + o.doskoky_def + o.doskoky_neznamy) },
      { label: 'Asistence', nas: String(n.asistence), opp: '-' },
      { label: 'Zisky', nas: String(n.zisky), opp: '-' },
      { label: 'Ztráty', nas: String(n.ztraty), opp: String(o.ztraty) },
      { label: 'Bloky', nas: String(n.bloky), opp: '-' },
      { label: 'Fauly', nas: String(n.fauly), opp: String(o.fauly) },
    ];
  });

  // Hodnota pro home/away sloupec daného řádku.
  function homeVal(r: Radek): string {
    return homeJsmeMy ? r.nas : r.opp;
  }
  function awayVal(r: Radek): string {
    return homeJsmeMy ? r.opp : r.nas;
  }

  const vedeniHome = $derived(naseDoma ? vedeni.nase : vedeni.souper);
  const vedeniAway = $derived(naseDoma ? vedeni.souper : vedeni.nase);
</script>

<div class="prehled-overlay" role="dialog" aria-modal="true">
  <div class="prehled">
    <header class="ph-head">
      <div class="ph-team ph-home" class:us={homeJsmeMy}>
        <span class="ph-team-name">{homeNazev}</span>
        <span class="ph-team-tag">Domácí</span>
      </div>
      <div class="ph-score">
        <span class="ph-score-num">{homeScore}</span>
        <span class="ph-score-colon">:</span>
        <span class="ph-score-num">{awayScore}</span>
      </div>
      <div class="ph-team ph-away" class:us={!homeJsmeMy}>
        <span class="ph-team-name">{awayNazev}</span>
        <span class="ph-team-tag">Hosté</span>
      </div>
    </header>

    {#if skorePoQ.length > 0}
      <div class="ph-qstrip">
        <div class="ph-qcell ph-qhdr"></div>
        {#each skorePoQ as qs (qs.q)}
          <div class="ph-qcell ph-qhdr">{formatCtvrtina(qs.q, pocetCtvrtin)}</div>
        {/each}
        <div class="ph-qcell ph-qhdr ph-qtot">Σ</div>

        <div class="ph-qcell ph-qlabel" class:us={homeJsmeMy}>{homeNazev}</div>
        {#each skorePoQ as qs (qs.q)}
          <div class="ph-qcell">{naseDoma ? qs.nase : qs.souper}</div>
        {/each}
        <div class="ph-qcell ph-qtot">{homeScore}</div>

        <div class="ph-qcell ph-qlabel" class:us={!homeJsmeMy}>{awayNazev}</div>
        {#each skorePoQ as qs (qs.q)}
          <div class="ph-qcell">{naseDoma ? qs.souper : qs.nase}</div>
        {/each}
        <div class="ph-qcell ph-qtot">{awayScore}</div>
      </div>
    {/if}

    {#if obdobi.length > 1}
      <div class="ph-tabs">
        {#each obdobi as o (o.key)}
          <button class="ph-tab" class:active={o.key === aktivni?.key} onclick={() => (vybrane = o.key)}>
            {o.label}
          </button>
        {/each}
      </div>
    {/if}

    <div class="ph-stats">
      <div class="ph-stats-title">
        Statistiky - {aktivni?.label ?? 'Celý zápas'}
      </div>
      <table class="ph-table">
        <thead>
          <tr>
            <th class="ph-th-home" class:us={homeJsmeMy}>{homeNazev}</th>
            <th class="ph-th-mid"></th>
            <th class="ph-th-away" class:us={!homeJsmeMy}>{awayNazev}</th>
          </tr>
        </thead>
        <tbody>
          {#each radky as r (r.label)}
            <tr class:hlavni={r.hlavni}>
              <td class="ph-val ph-val-home">{homeVal(r)}</td>
              <td class="ph-stat-label">{r.label}</td>
              <td class="ph-val ph-val-away">{awayVal(r)}</td>
            </tr>
          {/each}
          <tr class="ph-vedeni">
            <td class="ph-val ph-val-home">{vedeniHome > 0 ? `+${vedeniHome}` : '0'}</td>
            <td class="ph-stat-label">Největší vedení</td>
            <td class="ph-val ph-val-away">{vedeniAway > 0 ? `+${vedeniAway}` : '0'}</td>
          </tr>
        </tbody>
      </table>
      <p class="ph-note">U soupeře evidujeme jen proměněné koše (ne pokusy), proto bez procent střelby.</p>
    </div>

    <button class="ph-close" onclick={onClose}>{closeLabel}</button>
  </div>
</div>

<style>
  .prehled-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--bg);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    padding: 16px;
  }
  .prehled {
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ph-head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    padding: 14px 8px 4px;
  }
  .ph-team {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .ph-home { align-items: flex-start; text-align: left; }
  .ph-away { align-items: flex-end; text-align: right; }
  .ph-team-name {
    font-size: 18px;
    font-weight: 800;
    color: var(--them-color);
    line-height: 1.15;
  }
  .ph-team.us .ph-team-name { color: var(--us-color); }
  .ph-team-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
  }
  .ph-score {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border: 2px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
  }
  .ph-score-num {
    font-family: "Consolas", monospace;
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
    color: var(--text);
    min-width: 1.4ch;
    text-align: center;
  }
  .ph-score-colon { font-size: 30px; font-weight: 800; color: var(--text-muted); }

  .ph-qstrip {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(3, auto);
    grid-auto-columns: 1fr;
    gap: 2px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    font-family: "Consolas", monospace;
  }
  .ph-qcell {
    background: var(--surface);
    padding: 7px 4px;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  .ph-qhdr {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    font-family: inherit;
  }
  .ph-qlabel {
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    text-align: left;
    padding-left: 10px;
    color: var(--them-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ph-qlabel.us { color: var(--us-color); }
  .ph-qtot { background: var(--selected-bg); font-weight: 800; }

  .ph-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .ph-tab {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .ph-tab.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .ph-stats {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
  }
  .ph-stats-title {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    text-align: center;
    margin-bottom: 8px;
  }
  .ph-table { width: 100%; border-collapse: collapse; }
  .ph-table th {
    font-size: 13px;
    font-weight: 800;
    color: var(--them-color);
    padding-bottom: 6px;
  }
  .ph-table th.us { color: var(--us-color); }
  .ph-th-home { text-align: left; }
  .ph-th-away { text-align: right; }
  .ph-table td { padding: 6px 4px; border-top: 1px solid var(--border); }
  .ph-stat-label {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .ph-val {
    font-family: "Consolas", monospace;
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
  }
  .ph-val-home { text-align: left; }
  .ph-val-away { text-align: right; }
  .ph-table tr.hlavni .ph-val { font-size: 22px; font-weight: 800; }
  .ph-vedeni .ph-val { color: var(--accent); }
  .ph-note {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }

  .ph-close {
    margin-top: 4px;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
  }
  .ph-close:hover { filter: brightness(1.08); }

  @media (max-width: 480px) {
    .ph-team-name { font-size: 15px; }
    .ph-score-num { font-size: 34px; }
    .ph-qcell { font-size: 13px; padding: 6px 2px; }
    .ph-qlabel { font-size: 11px; }
    .ph-val { font-size: 15px; }
    .ph-table tr.hlavni .ph-val { font-size: 19px; }
  }
</style>
