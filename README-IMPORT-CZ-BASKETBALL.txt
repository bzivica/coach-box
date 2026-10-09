COACH-BOX – PRVNÍ ČÁST IMPORTU CZ.BASKETBALL

Toto je sada souborů k překopírování do existující složky projektu.
Nepřepisuje databázi ani nemaže uložené zápasy.

SOUBORY ZKOPÍRUJ DO STEJNĚ POJMENOVANÝCH CEST:
- src/components/SouperForm.svelte
- src/lib/types.ts
- vite.config.ts
- start-coach-box.bat
- server/cz-basketball-server.mjs (nový soubor)

Před kopírováním si pro jistotu zazálohuj původní soubory.
Potom Coach-Box spusť přes start-coach-box.bat. Otevře se okno aplikace a druhé okno pomocného importního serveru. Obě okna nech otevřená.

V sekci Soupeři otevři Nový soupeř/Upravit soupeře, vlož odkaz typu:
https://cz.basketball/tym/15435?y=2026
Klikni na „Načíst / aktualizovat soupisku“, zkontroluj náhled v seznamu hráčů a až potom klikni na Uložit.

Zahraniční turnaje/ČEYBL a týmy mimo české soutěže nadále zadávej ručně.

DŮLEŽITÉ: toto je první testovací etapa. Pomocný server je implementován a kontrola Svelte/TypeScriptu prošla. V tomto pracovním prostředí nešlo navázat síťové spojení s cz.basketball, proto nebylo možné ověřit parsování živé stránky. Pokud se stránka načte, ale soupiska se nerozpozná, nic se neuloží a lze pokračovat ručně. Další krok bude přizpůsobit parser skutečné struktuře stránky po prvním lokálním testu.
