<script lang="ts">
  import type { Udalost } from '../lib/types';
  import { formatCtvrtina } from '../lib/types';
  import { computeSkoreProgrese, detectSnury } from '../lib/live';

  const {
    udalosti,
    pocetCtvrtin,
  }: { udalosti: Udalost[]; pocetCtvrtin: number } = $props();

  type Rezim = 'cary' | 'naskok';
  let rezim = $state<Rezim>('cary');

  const VIEW_W = 1000;
  const VIEW_H = 360;
  const PAD_LEFT = 46;
  const PAD_RIGHT = 64;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 40;

  const MAX_GRID_LINES = 6;
  const GRID_STEP_KANDIDATI = [2, 5, 10, 15, 20, 25, 50, 100];
  const MIN_MAX_BODY = 4;
  const MIN_MAX_NASKOK = 4;
  const SNURA_MIN_BODY = 6;

  const progrese = $derived(computeSkoreProgrese(udalosti));
  const maPrubeh = $derived(progrese.length > 1);
  const maxKrok = $derived(Math.max(1, progrese.length - 1));

  const plotX0 = PAD_LEFT;
  const plotX1 = VIEW_W - PAD_RIGHT;
  const plotYBottom = VIEW_H - PAD_BOTTOM;
  const plotYTop = PAD_TOP;

  function xScale(krok: number): number {
    return plotX0 + (krok / maxKrok) * (plotX1 - plotX0);
  }
  function niceStep(surovy: number, minimum: number): number {
    const cil = Math.max(surovy, minimum);
    return (
      GRID_STEP_KANDIDATI.find((s) => cil / s <= MAX_GRID_LINES) ??
      GRID_STEP_KANDIDATI[GRID_STEP_KANDIDATI.length - 1]
    );
  }

  const snury = $derived(detectSnury(progrese, SNURA_MIN_BODY));
  function snuraCaraBody(kdo: 'nase' | 'souper', krokOd: number, krokDo: number): string {
    return progrese
      .filter((p) => p.krok >= krokOd && p.krok <= krokDo)
      .map((p) => `${xScale(p.krok)},${yScaleBody(kdo === 'nase' ? p.nase : p.souper)}`)
      .join(' ');
  }

  const surovyMaxBody = $derived(progrese.reduce((m, p) => Math.max(m, p.nase, p.souper), 0));
  const gridStepBody = $derived(niceStep(surovyMaxBody, MIN_MAX_BODY));
  const maxBody = $derived(
    Math.max(gridStepBody, Math.ceil(Math.max(surovyMaxBody, MIN_MAX_BODY) / gridStepBody) * gridStepBody),
  );
  function yScaleBody(v: number): number {
    return plotYBottom - (v / maxBody) * (plotYBottom - plotYTop);
  }

  const surovyMaxNaskok = $derived(progrese.reduce((m, p) => Math.max(m, Math.abs(p.nase - p.souper)), 0));
  const gridStepNaskok = $derived(niceStep(surovyMaxNaskok, MIN_MAX_NASKOK));
  const maxNaskok = $derived(
    Math.max(gridStepNaskok, Math.ceil(Math.max(surovyMaxNaskok, MIN_MAX_NASKOK) / gridStepNaskok) * gridStepNaskok),
  );
  function yScaleNaskok(v: number): number {
    const stred = (plotYBottom + plotYTop) / 2;
    return stred - (v / maxNaskok) * ((plotYBottom - plotYTop) / 2);
  }

  const liniNase = $derived(progrese.map((p) => `${xScale(p.krok)},${yScaleBody(p.nase)}`).join(' '));
  const liniSouper = $derived(progrese.map((p) => `${xScale(p.krok)},${yScaleBody(p.souper)}`).join(' '));

  const naskokArea = $derived.by(() => {
    if (progrese.length === 0) return '';
    const stred = yScaleNaskok(0);
    const body = progrese.map((p) => `L ${xScale(p.krok)},${yScaleNaskok(p.nase - p.souper)}`).join(' ');
    return `M ${xScale(0)},${stred} ${body} L ${xScale(maxKrok)},${stred} Z`;
  });
  const naskokLine = $derived(progrese.map((p) => `${xScale(p.krok)},${yScaleNaskok(p.nase - p.souper)}`).join(' '));

  const gridHodnotyBody = $derived.by(() => {
    const out: number[] = [];
    for (let v = 0; v <= maxBody; v += gridStepBody) out.push(v);
    return out;
  });
  const gridHodnotyNaskok = $derived.by(() => {
    const out: number[] = [];
    for (let v = gridStepNaskok; v <= maxNaskok; v += gridStepNaskok) out.push(v);
    return out;
  });

  const ctvrtinoveSegmenty = $derived.by(() => {
    const segmenty: { cislo: number; krokStart: number; krokEnd: number }[] = [];
    for (const p of progrese) {
      const posledni = segmenty[segmenty.length - 1];
      if (!posledni || posledni.cislo !== p.ctvrtina_cislo) {
        if (posledni) posledni.krokEnd = p.krok;
        segmenty.push({ cislo: p.ctvrtina_cislo, krokStart: p.krok, krokEnd: p.krok });
      }
    }
    if (segmenty.length > 0) segmenty[segmenty.length - 1].krokEnd = maxKrok;
    return segmenty;
  });

  const finalni = $derived(progrese[progrese.length - 1]);
</script>

<div class="svg-graf">
  <div class="rezim-prepinac">
    <button class:active={rezim === 'cary'} onclick={() => (rezim = 'cary')}>Čáry</button>
    <button class:active={rezim === 'naskok'} onclick={() => (rezim = 'naskok')}>Náskok</button>
  </div>

  {#if !maPrubeh}
    <p class="prazdno">Zatím žádné body, graf se objeví po prvním koši.</p>
  {:else}
    <svg viewBox="0 0 {VIEW_W} {VIEW_H}" preserveAspectRatio="none" role="img" aria-label="Vývoj skóre v čase">
      {#each snury as s (s.krokOd)}
        <rect
          class="snura-pruh {s.kdo === 'nase' ? 'us' : 'them'}"
          x={xScale(s.krokOd)}
          y={plotYTop}
          width={Math.max(2, xScale(s.krokDo) - xScale(s.krokOd))}
          height={plotYBottom - plotYTop}
        />
      {/each}

      {#each ctvrtinoveSegmenty as seg, i (seg.cislo)}
        {#if i > 0}
          <line class="ctvrtina-cara" x1={xScale(seg.krokStart)} x2={xScale(seg.krokStart)} y1={plotYTop} y2={plotYBottom} />
        {/if}
        <text class="ctvrtina-label" x={(xScale(seg.krokStart) + xScale(seg.krokEnd)) / 2} y={plotYTop - 8} text-anchor="middle">
          {formatCtvrtina(seg.cislo, pocetCtvrtin)}
        </text>
      {/each}

      {#if rezim === 'cary'}
        {#each gridHodnotyBody as v (v)}
          <line class="grid" x1={plotX0} x2={plotX1} y1={yScaleBody(v)} y2={yScaleBody(v)} />
          <text class="osa-y" x={plotX0 - 8} y={yScaleBody(v) + 4} text-anchor="end">{v}</text>
        {/each}
        <line class="osa" x1={plotX0} x2={plotX1} y1={plotYBottom} y2={plotYBottom} />

        <polyline class="cara-souper" points={liniSouper} />
        <polyline class="cara-nase" points={liniNase} />

        {#each snury as s (s.krokOd)}
          <polyline class="snura-cara {s.kdo === 'nase' ? 'us' : 'them'}" points={snuraCaraBody(s.kdo, s.krokOd, s.krokDo)} />
          <text
            class="snura-label {s.kdo === 'nase' ? 'us' : 'them'}"
            x={(xScale(s.krokOd) + xScale(s.krokDo)) / 2}
            y={plotYTop + 16}
            text-anchor="middle"
          >{s.body}-0</text>
        {/each}

        <circle class="bod-souper" cx={xScale(finalni.krok)} cy={yScaleBody(finalni.souper)} r="5" />
        <circle class="bod-nase" cx={xScale(finalni.krok)} cy={yScaleBody(finalni.nase)} r="5" />
        <text class="hodnota-nase" x={xScale(finalni.krok) + 10} y={yScaleBody(finalni.nase) + 4}>{finalni.nase}</text>
        <text class="hodnota-souper" x={xScale(finalni.krok) + 10} y={yScaleBody(finalni.souper) + 4}>{finalni.souper}</text>
      {:else}
        {#each gridHodnotyNaskok as v (v)}
          <line class="grid" x1={plotX0} x2={plotX1} y1={yScaleNaskok(v)} y2={yScaleNaskok(v)} />
          <line class="grid" x1={plotX0} x2={plotX1} y1={yScaleNaskok(-v)} y2={yScaleNaskok(-v)} />
          <text class="osa-y" x={plotX0 - 8} y={yScaleNaskok(v) + 4} text-anchor="end">+{v}</text>
          <text class="osa-y" x={plotX0 - 8} y={yScaleNaskok(-v) + 4} text-anchor="end">−{v}</text>
        {/each}

        <path class="naskok-plocha" d={naskokArea} clip-path="url(#klipNad)" />
        <path class="naskok-plocha them" d={naskokArea} clip-path="url(#klipPod)" />
        <polyline class="naskok-cara" points={naskokLine} />
        <line class="osa nula" x1={plotX0} x2={plotX1} y1={yScaleNaskok(0)} y2={yScaleNaskok(0)} />
        <text class="osa-y nula" x={plotX0 - 8} y={yScaleNaskok(0) + 4} text-anchor="end">0</text>

        {#each snury as s (s.krokOd)}
          <text
            class="snura-label {s.kdo === 'nase' ? 'us' : 'them'}"
            x={(xScale(s.krokOd) + xScale(s.krokDo)) / 2}
            y={plotYTop + 16}
            text-anchor="middle"
          >{s.body}-0</text>
        {/each}

        <clipPath id="klipNad"><rect x={plotX0} y={plotYTop} width={plotX1 - plotX0} height={yScaleNaskok(0) - plotYTop} /></clipPath>
        <clipPath id="klipPod"><rect x={plotX0} y={yScaleNaskok(0)} width={plotX1 - plotX0} height={plotYBottom - yScaleNaskok(0)} /></clipPath>
      {/if}
    </svg>

    <div class="legenda">
      {#if rezim === 'cary'}
        <span class="leg-item"><span class="leg-swatch us"></span>MY <strong>{finalni.nase}</strong></span>
        <span class="leg-item"><span class="leg-swatch them"></span>Soupeř <strong>{finalni.souper}</strong></span>
      {:else}
        <span class="leg-item"><span class="leg-swatch us"></span>nad 0 = vedeme MY</span>
        <span class="leg-item"><span class="leg-swatch them"></span>pod 0 = vede soupeř</span>
        <span class="leg-item">náskok <strong>{finalni.nase - finalni.souper > 0 ? '+' : ''}{finalni.nase - finalni.souper}</strong></span>
      {/if}
      {#if snury.length > 0}
        <span class="leg-item leg-snura">▮ šňůra ({SNURA_MIN_BODY}+ bodů v řadě)</span>
      {/if}
      <span class="leg-osa-x">osa X = pořadí košů v čase</span>
    </div>
  {/if}
</div>

<style>
  .svg-graf {
    width: 100%;
  }
  .rezim-prepinac {
    display: inline-flex;
    gap: 2px;
    margin-bottom: 8px;
    background: var(--surface-hover);
    border-radius: 8px;
    padding: 2px;
  }
  .rezim-prepinac button {
    border: none;
    background: transparent;
    color: var(--text-dim);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .rezim-prepinac button.active {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .prazdno {
    color: var(--text-dim);
    font-size: 0.9rem;
    text-align: center;
    padding: 1.5rem 0;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
    opacity: 0.5;
  }
  .osa {
    stroke: var(--border);
    stroke-width: 2;
  }
  .osa.nula {
    stroke: var(--text-dim);
    stroke-width: 2;
  }
  .osa-y {
    fill: var(--text-dim);
    font-size: 16px;
  }
  .osa-y.nula {
    font-weight: 700;
    fill: var(--text);
  }
  .ctvrtina-cara {
    stroke: var(--text-dim);
    stroke-width: 1.5;
    stroke-dasharray: 4 5;
    opacity: 0.7;
  }
  .ctvrtina-label {
    fill: var(--text-dim);
    font-size: 17px;
    font-weight: 600;
  }
  .cara-nase {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .cara-souper {
    fill: none;
    stroke: var(--danger);
    stroke-width: 3.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .bod-nase { fill: var(--accent); }
  .bod-souper { fill: var(--danger); }
  .hodnota-nase {
    fill: var(--accent);
    font-size: 20px;
    font-weight: 700;
  }
  .hodnota-souper {
    fill: var(--danger);
    font-size: 20px;
    font-weight: 700;
  }

  .snura-pruh {
    opacity: 0.14;
  }
  .snura-pruh.us { fill: var(--accent); }
  .snura-pruh.them { fill: var(--danger); }
  .snura-cara {
    fill: none;
    stroke-width: 6;
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: 0.85;
  }
  .snura-cara.us { stroke: var(--accent); }
  .snura-cara.them { stroke: var(--danger); }
  .snura-label {
    font-size: 17px;
    font-weight: 800;
  }
  .snura-label.us { fill: var(--accent); }
  .snura-label.them { fill: var(--danger); }

  .naskok-plocha {
    fill: var(--accent);
    opacity: 0.28;
  }
  .naskok-plocha.them {
    fill: var(--danger);
  }
  .naskok-cara {
    fill: none;
    stroke: var(--text);
    stroke-width: 2;
    stroke-linejoin: round;
    opacity: 0.55;
  }

  .legenda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--text);
  }
  .leg-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .leg-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    display: inline-block;
  }
  .leg-swatch.us { background: var(--accent); }
  .leg-swatch.them { background: var(--danger); }
  .leg-snura { color: var(--text-dim); }
  .leg-osa-x {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 0.78rem;
  }
</style>
