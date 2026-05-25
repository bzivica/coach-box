<script lang="ts">
  type Props = {
    foto?: string;
    cislo?: number;
    size?: number;
    alt?: string;
    tmavy?: boolean;
  };

  const DEFAULT_SIZE = 40;

  let { foto, cislo, size = DEFAULT_SIZE, alt = '', tmavy = false }: Props = $props();
</script>

<div class="avatar" style="width: {size}px; height: {size}px;">
  {#if foto}
    <img src={foto} {alt} loading="lazy" />
  {:else if cislo !== undefined && cislo !== null}
    <svg viewBox="0 0 100 100" aria-hidden="true" class="jersey" class:dark={tmavy}>
      <path
        class="jersey-body"
        d="M 18 30 L 30 20 L 40 24 Q 50 32 60 24 L 70 20 L 82 30 L 76 46 L 70 44 L 74 86 L 26 86 L 30 44 L 24 46 Z"
      />
      <path
        class="jersey-stripe"
        d="M 24 46 L 30 44 L 26 86 L 22 86 Z"
      />
      <path
        class="jersey-stripe"
        d="M 76 46 L 70 44 L 74 86 L 78 86 Z"
      />
      <text x="50" y="70" text-anchor="middle" class="jersey-num">{cislo}</text>
    </svg>
  {:else}
    <svg viewBox="0 0 100 100" aria-hidden="true" class="silhouette">
      <circle cx="50" cy="36" r="18" />
      <path d="M 18 100 Q 18 64 50 64 Q 82 64 82 100 Z" />
    </svg>
  {/if}
</div>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    background: var(--surface-2);
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .silhouette { fill: var(--text-dim); }
  .jersey-body {
    fill: #ffffff;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .jersey-stripe {
    fill: var(--accent);
  }
  .jersey-num {
    fill: var(--accent);
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 32px;
    font-weight: 900;
    letter-spacing: -1px;
  }
  .jersey.dark .jersey-body {
    fill: var(--accent);
    stroke: #ffffff;
  }
  .jersey.dark .jersey-stripe {
    fill: #ffffff;
  }
  .jersey.dark .jersey-num {
    fill: #ffffff;
  }
</style>
