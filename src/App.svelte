<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';
  import { seedAll } from './lib/db';
  import Home from './views/Home.svelte';
  import Hraci from './views/Hraci.svelte';
  import Souperi from './views/Souperi.svelte';
  import Souteze from './views/Souteze.svelte';
  import Zapasy from './views/Zapasy.svelte';
  import Statistiky from './views/Statistiky.svelte';
  import Navod from './views/Navod.svelte';

  type View = 'home' | 'hraci' | 'souperi' | 'souteze' | 'zapasy' | 'statistiky' | 'navod';
  type Theme = 'light' | 'dark';

  const THEME_KEY = 'js_theme';

  let view = $state<View>('home');
  let theme = $state<Theme>('light');
  let updateReady = $state(false);
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

  onMount(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    } else {
      theme = 'light';
    }
    seedAll();
    void requestPersistentStorage();

    updateSW = registerSW({
      onNeedRefresh() { updateReady = true; },
      onOfflineReady() { console.log('[pwa] ready to work offline'); },
    });
  });

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;
    try {
      const already = await navigator.storage.persisted();
      if (already) return;
      const granted = await navigator.storage.persist();
      console.log(granted ? '[storage] persistent granted' : '[storage] persistent denied');
    } catch (e) {
      console.warn('[storage] persist request failed:', e);
    }
  }

  function applyUpdate() {
    updateReady = false;
    void updateSW?.(true);
  }

  function dismissUpdate() {
    updateReady = false;
  }

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  });

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }

  const polozky: { id: View; popisek: string }[] = [
    { id: 'home',       popisek: 'Domů' },
    { id: 'hraci',      popisek: 'Hráči' },
    { id: 'souperi',    popisek: 'Soupeři' },
    { id: 'souteze',    popisek: 'Soutěže' },
    { id: 'zapasy',     popisek: 'Zápasy' },
    { id: 'statistiky', popisek: 'Statistiky' },
    { id: 'navod',      popisek: 'Nápověda' },
  ];
</script>

<main>
  {#if updateReady}
    <div class="update-toast" role="status">
      <span class="update-text">🔄 Nová verze Coach Box je dostupná</span>
      <button class="update-btn" onclick={applyUpdate}>Aktualizovat</button>
      <button class="update-dismiss" onclick={dismissUpdate} title="Zavřít — verze se nainstaluje při dalším spuštění">✕</button>
    </div>
  {/if}
  <header>
    <div class="brand">
      <div class="brand-title">
        <div class="club-logo" title="Jižní Supi">
          <img src="{import.meta.env.BASE_URL}logo-jizni-supi.png" alt="Jižní Supi" />
        </div>
        <div class="brand-text">
          <h1>Jižní Supi <span class="brand-sep">—</span> <span class="app-name">Coach Box</span></h1>
          <span class="version">v0.0.32</span>
        </div>
      </div>
      <button class="theme-toggle" onclick={toggleTheme} title={theme === 'light' ? 'Přepnout na tmavé téma' : 'Přepnout na světlé téma'}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
    <nav>
      {#each polozky as p}
        <button class:active={view === p.id} onclick={() => view = p.id}>
          {p.popisek}
        </button>
      {/each}
    </nav>
  </header>

  <section class="content">
    {#if view === 'home'}
      <Home />
    {:else if view === 'hraci'}
      <Hraci />
    {:else if view === 'souperi'}
      <Souperi />
    {:else if view === 'souteze'}
      <Souteze />
    {:else if view === 'zapasy'}
      <Zapasy />
    {:else if view === 'statistiky'}
      <Statistiky />
    {:else if view === 'navod'}
      <Navod />
    {/if}
  </section>
</main>

<style>
  :global(:root[data-theme="light"]) {
    --bg: #f5f7fa;
    --surface: #ffffff;
    --surface-2: #eef2f8;
    --surface-hover: #e2e8f0;
    --border: #cbd5e1;
    --border-strong: #94a3b8;
    --text: #0f172a;
    --text-muted: #64748b;
    --text-dim: #94a3b8;
    --accent: #1e3a8a;
    --accent-hover: #1e40af;
    --accent-soft: #3b82f6;
    --accent-fg: #ffffff;
    --selected-bg: #dbeafe;
    --selected-border: #1e3a8a;
    --selected-fg: #1e3a8a;
    --danger: #dc2626;
    --danger-hover: #b91c1c;
    --danger-bg: #fee2e2;
    --danger-fg: #991b1b;
    --success: #16a34a;
    --success-bg: #dcfce7;
    --success-fg: #166534;
    --warn: #d97706;
    --us-color: #16a34a;
    --them-color: #ea580c;
    --opp-bg: #fff7ed;
    --opp-border: #fdba74;
    --opp-fg: #9a3412;
    --opp-btn-bg: #ffedd5;
    --opp-btn-hover: #fed7aa;
    --modal-bg: rgba(15, 23, 42, 0.55);
    --shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    --shadow-strong: 0 10px 30px rgba(15, 23, 42, 0.18);
    --toast-bg: #1e3a8a;
    --toast-fg: #ffffff;
    --toast-border: #16a34a;
  }

  :global(:root[data-theme="dark"]) {
    --bg: #0f172a;
    --surface: #1e293b;
    --surface-2: #172033;
    --surface-hover: #334155;
    --border: #334155;
    --border-strong: #475569;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --accent: #3b82f6;
    --accent-hover: #60a5fa;
    --accent-soft: #60a5fa;
    --accent-fg: #ffffff;
    --selected-bg: #1e3a8a;
    --selected-border: #3b82f6;
    --selected-fg: #ffffff;
    --danger: #b91c1c;
    --danger-hover: #991b1b;
    --danger-bg: #7f1d1d;
    --danger-fg: #fed7aa;
    --success: #16a34a;
    --success-bg: #14532d;
    --success-fg: #bbf7d0;
    --warn: #f59e0b;
    --us-color: #4ade80;
    --them-color: #fb923c;
    --opp-bg: #2d2522;
    --opp-border: #5a3a2a;
    --opp-fg: #fed7aa;
    --opp-btn-bg: #3a2a22;
    --opp-btn-hover: #4a342a;
    --modal-bg: rgba(0, 0, 0, 0.65);
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    --shadow-strong: 0 10px 30px rgba(0, 0, 0, 0.5);
    --toast-bg: #1e293b;
    --toast-fg: #e2e8f0;
    --toast-border: #4ade80;
  }

  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    transition: background 0.15s ease, color 0.15s ease;
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }

  .update-toast {
    position: sticky;
    top: 8px;
    z-index: 2000;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--accent);
    color: var(--accent-fg);
    padding: 10px 14px;
    border-radius: 8px;
    box-shadow: var(--shadow-strong);
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }
  .update-text { flex: 1; }
  .update-btn {
    background: #ffffff;
    color: var(--accent);
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .update-btn:hover { filter: brightness(0.95); }
  .update-dismiss {
    background: transparent;
    color: var(--accent-fg);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 6px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .update-dismiss:hover { background: rgba(255, 255, 255, 0.12); }

  header {
    margin-bottom: 28px;
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }
  .brand-title {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .club-logo {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 2px solid var(--accent);
    flex-shrink: 0;
  }
  .club-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 4px;
    background: var(--accent);
  }
  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .brand h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.2px;
    line-height: 1.15;
  }
  .brand-sep {
    color: var(--text-muted);
    font-weight: 400;
  }
  .app-name {
    color: var(--text);
  }
  .version {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }
  .theme-toggle {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    width: 40px;
    height: 40px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    transition: background 0.12s ease;
  }
  .theme-toggle:hover { background: var(--surface-hover); }

  nav {
    display: flex;
    gap: 4px;
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 4px;
    box-shadow: var(--shadow);
  }
  nav button {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.78);
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    flex: 1;
    transition: background 0.12s ease, color 0.12s ease;
  }
  nav button:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
  nav button.active {
    background: #ffffff;
    color: var(--accent);
  }

  @media (max-width: 900px) {
    main { padding: 8px; }
    header { margin-bottom: 12px; }
    .brand { margin-bottom: 10px; gap: 8px; }
    .brand-title { gap: 8px; }
    .club-logo { width: 36px; height: 36px; }
    .brand h1 { font-size: 17px; }
    .brand-sep { display: none; }
    .app-name { font-size: 14px; font-weight: 600; }
    .version { font-size: 10px; }
    .theme-toggle { width: 34px; height: 34px; font-size: 15px; border-radius: 6px; }
    nav { gap: 2px; padding: 2px; border-radius: 6px; overflow-x: auto; }
    nav button { padding: 8px 10px; font-size: 12px; white-space: nowrap; flex: 0 0 auto; }
  }
  @media (max-width: 600px) {
    main { padding: 6px; }
    .brand h1 { font-size: 15px; }
    .app-name { font-size: 13px; }
  }
</style>
