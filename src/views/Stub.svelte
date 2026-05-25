<script lang="ts">
  type Props = { nazev: string };
  let { nazev }: Props = $props();
</script>

<div class="stub">
  <h2>{nazev}</h2>
  <p>Tato sekce ještě není implementovaná. Přijde brzy.</p>
</div>

<style>
  .stub {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 60px;
    text-align: center;
    color: var(--text-muted);
  }
  .stub h2 { font-size: 22px; margin-bottom: 12px; color: var(--text); }
</style>
