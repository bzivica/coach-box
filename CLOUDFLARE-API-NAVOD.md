# Veřejné API CZ.BASKETBALL pro Coach-Box

GitHub Pages umí hostovat pouze statické soubory. Importní Node server v `server/` proto běží jen při lokálním vývoji a z instalované PWA na telefonu není dosažitelný. Pro synchronizaci odkudkoliv je potřeba jednorázově nasadit Worker do Cloudflare.

## Nasazení API (jednou)
1. Přihlas se na https://dash.cloudflare.com/ a otevři **Workers & Pages**.
2. Vytvoř Worker s názvem `coach-box-cz-basketball-api`.
3. Nahraj obsah `cloudflare-worker/index.js` jako Worker kód a nasaď jej. Alternativně v této složce spusť `npx wrangler deploy` po přihlášení přes `npx wrangler login`.
4. Ověř adresu `https://coach-box-cz-basketball-api.<tvuj-subdomain>.workers.dev/health`; odpověď má obsahovat `{"ok":true,...}`.
5. Při buildu webu nastav proměnnou `VITE_CZ_BASKETBALL_API_URL` na kořenovou URL Workeru (např. `https://coach-box-cz-basketball-api.<tvuj-subdomain>.workers.dev`) a znovu sestav/nasaď web. V GitHub Actions ji lze nastavit jako repository variable se stejným názvem a před `npm run build` ji předat do prostředí kroku Build.

Worker pouze veřejně načítá pevně zadané soupisky Jižních Supů; nepřijímá libovolné cílové URL ani nezapisuje data. Hráči a statistiky zůstávají uložené lokálně v každém zařízení, takže samotná API synchronizace nesynchronizuje databázi mezi zařízeními.
