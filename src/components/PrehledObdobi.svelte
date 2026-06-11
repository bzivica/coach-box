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

  // initialPeriod je jednorazova vychozi hodnota pri otevreni, dalsi vyber ridi uzivatel
  // svelte-ignore state_referenced_locally
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

  // Počet košů soupeře se správným skloňováním (body_2/3/th = počty proměněných košů).
  function kose(n: number): string {
    if (n === 1) return '1 koš';
    if (n >= 2 && n <= 4) return `${n} koše`;
    return `${n} košů`;
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
      { label: '2 body', nas: fmtStrelbaNas(n.dany_2, n.pokusy_2), opp: kose(o.body_2) },
      { label: '3 body', nas: fmtStrelbaNas(n.dany_3, n.pokusy_3), opp: kose(o.body_3) },
      { label: 'Trestné', nas: fmtStrelbaNas(n.dany_th, n.pokusy_th), opp: kose(o.body_th) },
      { label: 'Doskoky úto.', nas: String(n.doskoky_off), opp: String(o.doskoky_off) },
      { label: 'Doskoky obr.', nas: String(n.doskoky_def), opp: String(o.doskoky_def) },
      ...(o.doskoky_neznamy > 0
        ? [{ label: 'Doskoky ?', nas: '-', opp: String(o.doskoky_neznamy) }]
        : []),
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

  // Logo Jižních Supů - zobrazí se u našeho týmu (domácí logo když jsme doma, jinak u hostů).
  const LOGO_SUPI = `${import.meta.env.BASE_URL}logo-jizni-supi.png`;
  const homeJeSupi = $derived(homeJsmeMy);
  const awayJeSupi = $derived(!homeJsmeMy);
</script>

<div class="prehled-overlay" role="dialog" aria-modal="true">
  <div class="prehled">
    <header class="ph-head">
      <div class="ph-team ph-home" class:us={homeJsmeMy}>
        <div class="ph-team-line">
          {#if homeJeSupi}<img class="ph-logo" src={LOGO_SUPI} alt="Jižní Supi" />{/if}
          <span class="ph-team-name">{homeNazev}</span>
        </div>
        <span class="ph-team-tag">Domácí</span>
      </div>
      <div class="ph-score">
        <span class="ph-score-num" class:us={homeJsmeMy} class:them={!homeJsmeMy}>{homeScore}</span>
        <span class="ph-score-colon">:</span>
        <span class="ph-score-num" class:us={!homeJsmeMy} class:them={homeJsmeMy}>{awayScore}</span>
      </div>
      <div class="ph-team ph-away" class:us={!homeJsmeMy}>
        <div class="ph-team-line">
          <span class="ph-team-name">{awayNazev}</span>
          {#if awayJeSupi}<img class="ph-logo" src={LOGO_SUPI} alt="Jižní Supi" />{/if}
        </div>
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
            <th class="ph-th-home" class:us={homeJsmeMy}>
              <span class="ph-th-line">
                {#if homeJeSupi}<img class="ph-logo-sm" src={LOGO_SUPI} alt="Jižní Supi" />{/if}
                <span>{homeNazev}</span>
              </span>
            </th>
            <th class="ph-th-mid"></th>
            <th class="ph-th-away" class:us={!homeJsmeMy}>
              <span class="ph-th-line ph-th-line-right">
                <span>{awayNazev}</span>
                {#if awayJeSupi}<img class="ph-logo-sm" src={LOGO_SUPI} alt="Jižní Supi" />{/if}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each radky as r (r.label)}
            <tr class:hlavni={r.hlavni}>
              <td class="ph-val ph-val-home" class:us={homeJsmeMy} class:them={!homeJsmeMy}>{homeVal(r)}</td>
              <td class="ph-stat-label">{r.label}</td>
              <td class="ph-val ph-val-away" class:us={!homeJsmeMy} class:them={homeJsmeMy}>{awayVal(r)}</td>
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
    background:
      radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%),
      var(--bg);
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
  .ph-team-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ph-logo {
    width: 30px;
    height: 30px;
    object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.25));
  }
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
    gap: 10px;
    padding: 10px 22px;
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, #fff) 0%, var(--surface) 55%, var(--surface-2) 100%);
    box-shadow:
      0 10px 24px -8px rgba(15, 23, 42, 0.35),
      0 2px 4px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.5),
      inset 0 -2px 4px rgba(15, 23, 42, 0.08);
  }
  .ph-score-num {
    font-family: "Consolas", monospace;
    font-size: 46px;
    font-weight: 800;
    line-height: 1;
    color: var(--text);
    min-width: 1.4ch;
    text-align: center;
    text-shadow: 0 1px 1px rgba(15, 23, 42, 0.18);
  }
  .ph-score-num.us { color: var(--us-color); }
  .ph-score-num.them { color: var(--them-color); }
  .ph-score-colon { font-size: 30px; font-weight: 800; color: var(--text-dim); }

  .ph-qstrip {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(3, auto);
    grid-auto-columns: 1fr;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    font-family: "Consolas", monospace;
    box-shadow: 0 6px 16px -8px rgba(15, 23, 42, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4);
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
  .ph-qtot { background: var(--selected-bg); font-weight: 800; color: var(--selected-fg); }

  .ph-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .ph-tab {
    padding: 7px 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, #fff), var(--surface));
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 0.08s, box-shadow 0.12s;
  }
  .ph-tab:hover { transform: translateY(-1px); }
  .ph-tab.active {
    background: linear-gradient(180deg, var(--accent-soft), var(--accent));
    border-color: var(--accent);
    color: #fff;
    box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--accent) 60%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .ph-stats {
    background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, #fff), var(--surface));
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 12px 28px -10px rgba(15, 23, 42, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.5);
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
    padding-bottom: 8px;
  }
  .ph-table th.us { color: var(--us-color); }
  .ph-th-home { text-align: left; }
  .ph-th-away { text-align: right; }
  .ph-th-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .ph-th-line-right { justify-content: flex-end; }
  .ph-logo-sm {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .ph-table td {
    padding: 7px 8px;
    border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }
  /* zebra pro čitelnost zarovnání */
  .ph-table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--text) 4%, transparent); }
  .ph-table tbody tr td:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
  .ph-table tbody tr td:last-child { border-top-right-radius: 6px; border-bottom-right-radius: 6px; }
  .ph-stat-label {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .ph-val {
    font-family: "Consolas", monospace;
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    width: 40%;
  }
  .ph-val.us { color: var(--us-color); }
  .ph-val.them { color: var(--them-color); }
  .ph-val-home { text-align: left; }
  .ph-val-away { text-align: right; }
  .ph-table tr.hlavni td { border-top: none; }
  .ph-table tr.hlavni .ph-val { font-size: 26px; font-weight: 800; text-shadow: 0 1px 1px rgba(15, 23, 42, 0.15); }
  .ph-table tr.hlavni .ph-stat-label { font-size: 13px; color: var(--text); }
  .ph-vedeni td { border-top: 2px solid var(--border); }
  .ph-vedeni .ph-val {
    color: var(--accent);
    font-size: 20px;
    font-weight: 800;
  }
  .ph-vedeni .ph-stat-label { color: var(--accent); font-weight: 800; }
  .ph-note {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }

  .ph-close {
    margin-top: 4px;
    padding: 15px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(180deg, var(--accent-soft), var(--accent));
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 8px 18px -6px color-mix(in srgb, var(--accent) 65%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    transition: transform 0.08s, box-shadow 0.12s, filter 0.12s;
  }
  .ph-close:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .ph-close:active { transform: translateY(1px); box-shadow: 0 3px 8px -4px color-mix(in srgb, var(--accent) 60%, transparent); }

  @media (max-width: 480px) {
    .ph-team-name { font-size: 15px; }
    .ph-score-num { font-size: 34px; }
    .ph-qcell { font-size: 13px; padding: 6px 2px; }
    .ph-qlabel { font-size: 11px; }
    .ph-val { font-size: 15px; }
    .ph-table tr.hlavni .ph-val { font-size: 19px; }
  }
</style>
