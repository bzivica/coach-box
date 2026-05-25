# Coach Box — Návod k použití

Webová appka pro live zápis basketbalových zápasů, agregaci statistik a správu klubu (Jižní Supi).
Verze 0.0.6, poslední update 2026-05-25 (po prvním reálném testu — 3-col layout, multi-sub, team-points, plný opp roster).

---

## Část 1: Asistent — Rychlý start (live zápis zápasu)

### Před výhozím tipoffem

1. Trenér už by měl mít založený zápas přes **Zápasy → + Nový zápas** (s vybranou sestavou a délkou Q).
2. Otevři appku, jdi do **Zápasy**, klikni **Pokračovat** u rozehraného zápasu (nebo **Detail** u připraveného).

### Začátek čtvrtiny

1. Klikni na 5 **našich** hráčů na hřišti (jejich karty se podbarví modře).
2. Pokud má soupeř rozepsanou soupisku, vyber 5 čísel soupeře v sekci pod sestavou. Bez výběru se zápis bude evidovat agregátně (bez per-hráč soupeře). *Tahle pětice slouží jen pro úvodní orientaci — v live zápise uvidíš plnou soupisku soupeře.*
3. Klik **Začít Q1**.
4. Volitelně klikni **▶ Start** stopek. Klok **odpočítává dolů** od délky Q (např. `10:00 → 0:00`). Pokud nestihneš pouštět, akce se zapíší i tak, jen minuty se nepočítají.

### Layout live obrazovky

Obrazovka je rozdělená na **3 sloupce vedle sebe**:

- **Vlevo — MY AKCE** — akce sgrupované do bloků:
  - **ÚTOK**: dvě řady × 3 sloupce (`✓ 2 body` / `✓ 3 body` / `✓ Trestný` zelené nahoře, `✗ 2 body` / `✗ 3 body` / `✗ Trestný` červené dole)
  - **DOSKOK**: Útočný / Obranný
  - **POZITIVNÍ**: Asistence / Zisk / Blok
  - **NEGATIVNÍ**: Faul… / Ztráta
  - **RYCHLÝ ZÁPIS BODŮ — BEZ HRÁČE**: `+2 tým` / `+3 tým` / `+1 tým` (modré dashed buttony, nevyžadují výběr hráče)
  - **Tech. lavička** (full width, bez hráče)
- **Uprostřed — HRÁČI** — 5 svislých karet s avatarem, číslem a příjmením (větší velikost pro rychlou identifikaci). Dole modré tlačítko **⇄ Střídání** (otevře multi-sub modal).
- **Vpravo — SOUPEŘ** — plná soupiska soupeře jako chips (#číslo + příjmení), dole opp akce v 2-col gridu (+2 / +3 / +1 / Faul / dosk útoč. / dosk obr.).

**Pod hlavními sloupci**:
- **Live totals** — chip strip MY + SOUPEŘ (PTS, 2P, 3P, FT, OFF, DEF, REB, AST, STL, TO, BLK, PF + zbývající TO).
- **Timeouts** — velká MY / SOUPEŘ tlačítka.
- **Bench strip** — kompaktní jednořádkový seznam hráčů na lavičce (`#5 Černý · #8 Dvořák · …`). Bez interakce, jen pro orientaci.
- **Footer** — Konec Q / Ukončit zápas.

**Nahoře — Clock-bar**: stopky, ▶ Start / ⏸ Pauza, ✏️ Čas, ✏️ Q, ↺ Reset, a **↶ Vrátit poslední** (undo).

### Během hry — co dělat

| Akce | Postup |
|---|---|
| **Náš hráč skóroval / fauloval / cokoli** | Klik na **hráče uprostřed** (karta zmodrá) → klik na akci vlevo. |
| **Náš tým skóroval, ale nevím kdo** | Sekce **RYCHLÝ ZÁPIS BODŮ — BEZ HRÁČE** vlevo dole: `+2 tým` / `+3 tým` / `+1 tým`. Bez výběru hráče. Sedí semafor, ale nezapočítá se k žádnému hráči (v matchEnd jako řádek _Bez hráče_). |
| **Soupeř — víme kdo** | Klik na chip s číslem v opp panelu vpravo (zvýrazní se) → klik na akci. Výběr se po akci resetuje. Nebo klik **✕ bez hráče** pro zrušení. |
| **Soupeř — nevíme kdo** | Nechej chip nevybraný → klik přímo na akci. V matchEnd jako _Bez čísla hráče_. |
| **Střídání (1 nebo víc hráčů)** | Tlačítko **⇄ Střídání** pod hráčským sloupcem → modal: vlevo "Ven" (na hřišti), vpravo "Dovnitř" (lavička). Klikni libovolný počet hráčů na obou stranách (čísla pořadí se ukážou nad chipy). Počty se musí rovnat. **Provést střídání**. |
| **Omyl (jakákoli změna)** | Klik **↶ Vrátit poslední** v clock-baru nahoře. Vrátí akci, změnu Q čísla i ruční nastavení času. |
| **Stopky čas** | ▶ Start / ⏸ Pauza / ✏️ Čas (zbývající MM:SS) / ↺ Reset |
| **Špatné číslo Q** | Klik ✏️ **Q** → zadej správné (např. `2` pro Q2, `5` pro OT1). Změna se promítne i do událostí této Q. |
| **Oddech (TO)** | Tlačítka ⏱ TO MY / SOUPEŘ dole. Klok se po kliku automaticky pauzne. FIBA: 2 v 1H, 3 v 2H, 1 v OT. |

### Konec čtvrtiny

- Klikni **Konec Q1** → stopky se automaticky zapauzují → vyber pětice (naše + soupeře) pro Q2 → **Začít Q2**.
- Při přechodu se stopky resetují na plnou délku Q.

### Konec zápasu

- Po Q4 (nebo OT) klikni **Ukončit zápas** → potvrď.
- Pokud Q4 končí remízou, můžeš jít do prodloužení (5. čtvrtina).
- Po ukončení uvidíš kompletní boxscore — Min, PTS, 2P, 3P, FT, OFF, DEF, AST, STL, TO, BLK, PF, +/-, EFF + agregát soupeře.

### Časté situace

- **Hráč má 5 faulů (vyloučen)** — appka automaticky vyvolá modal, který tě nutí ho vystřídat.
- **Stopky se resetovaly nechtěně** — klikni ✏️ Čas, zadej zbývající čas MM:SS (např. `4:23`), Enter. Stopky budou pozastavené — pak ▶ Start.
- **Prošvihl jsi konec/začátek Q** — klikni ✏️ Q a zadej správné číslo. Vrátit lze přes **↶ Vrátit poslední akci**.
- **Hostujeme (Naše strana = H)** — dresy hráčů se zobrazí v tmavé variantě (modré tělo, bílé číslo) automaticky podle nastavení zápasu.
- **Pravidlo U14: hráč nemůže odehrát Q1+Q2+Q3 v řadě** — appka tě varuje při střídání, můžeš pokračovat (porušit) nebo zrušit.
- **Limit čtvrtin pro U12/U13 (2Q), U14 (3Q)** — také varování při střídání.

### Co appka nedělá

- **Neukládá oficiální klubový čas** — stopky v appce jsou jen pro vás (drift ±pár vteřin je v pořádku).
- **Nezapisuje rozhodčí poznámky** — sleduje jen herní akce.
- **Neřeší federační administrativu** (papírovou soupisku, body předem atd.).

---

## Část 2: Trenér — Úplný průvodce

### 2.1 Hráči (klubová soupiska)

**Sekce: Hráči**

Přidání hráče: **+ Nový hráč**. Pole:

- **Jméno + Příjmení** (povinné)
- **Číslo dresu** (0–99, povinné při hraní)
- **Pozice** (PG/SG/SF/PF/C, volitelné)
- **Výška** v cm (volitelné, 100–230)
- **Datum narození** (volitelné — pokud zadáno, ročník se vyplní automaticky)
- **Ročník narození** (čtyřciferný, např. 2012 — slouží pro výpočet věku)
- **Domácí kategorie** (povinná — kde hráč hlavně trénuje a hraje)
- **Foto** (volitelné — upload obrázku, automaticky zmenší na 240×240 JPEG; bez fotky se zobrazuje stylizovaný dres s číslem)
- **Aktivní** (zaškrtnuto = v soupisce klubu)

Tabulka hráčů ukazuje sloupce: Avatar / # / Jméno / Pozice / Věk / Výška / Kategorie / Aktivní.

### 2.2 Eligibility — kdo smí hrát kterou kategorii

Pravidlo: **hráč hraje svou domácí kategorii + všechny starší v obou liniích A i B**.

Pořadí (zleva nejmladší → vpravo nejstarší):
```
Přípravka → U10 MIX → U11 → U12 → U13 → U14 → U15 B → U15 → U17 B → U17 → U19 B → U19 → Muži B → Muži A
```

Hráč s domácí kategorií **U14** může hrát: U14, U15 B, U15, U17 B, U17, U19 B, U19, Muži B, Muži A.

Hráč s domácí kategorií **U15 B** může hrát: U15 B, U15, U17 B, U17, U19 B, U19, Muži B, Muži A — *NEMŮŽE* hrát U14 (mladší).

**Příklad mixu na kvalifikaci U17** (trenér U15):
- Mainstay U15 (rocnik 2011) — domácí kategorie U15
- Mladší U14 (rocnik 2012) — domácí kategorie U14
- Starší doplnění (rocnik 2010 z U17 B) — domácí kategorie U17 B  
Všichni se v lineup picker pro `nase_kategorie = U17` ukážou.

### 2.3 Soupeři

**Sekce: Soupeři → + Nový soupeř**: Název, Kategorie, soupiska (čísla + jména volitelně).

Rozepsaná soupiska se v live zápase používá pro **per-hráč evidenci soupeře** (klik na číslo před akcí). Rychlé doplnění:

- **⎘ Hromadně vložit** → textarea ve formátu `číslo jméno [příjmení]` na řádek. Přepíše stávající seznam. Samotná čísla bez jmen jsou OK.
- **↻ Z posledního zápasu** (jen při úpravě existujícího soupeře) — naskenuje události posledního zápasu s tímto týmem a doplní čísla, která jste atribuoval přes chip select. Užitečné když si nepamatujete přesně koho jste zapisoval.

**Pozor — duplicitní čísla:** v přátelácích se mohou objevit dvě hráčské karty se stejným číslem (např. mladší + starší kat.). U **soupeře** aplikace deduplikuje podle čísla a vše agreguje pod jedno. U **našich hráčů** deduplikace nehrozí, klíčujeme přes interní ID — můžete mít klidně 2× `#7`.

### 2.4 Soutěže

**Sekce: Soutěže** — předdefinováno: Liga, Extraliga, Nadregionální liga, Pražský přebor, ČEYBL, MČR, Easter Cup, Mezinárodní turnaj, Přátelák.

Můžeš přidat / upravit / deaktivovat. Pole: Název, Typ (liga/pohár/turnaj/přátelák/jiný), Region (domácí/regionální/mezinárodní), Aktivní.

### 2.5 Založení zápasu

**Sekce: Zápasy → + Nový zápas**:

| Pole | Co dává |
|---|---|
| Datum | Den zápasu |
| Naše kategorie | Úroveň zápasu (nikoli věkový průměr) — určuje kdo je oprávněn nastoupit |
| Naše strana | D (domácí, světlé dresy) / H (hosté, tmavé dresy) |
| Soupeř | Z předem zadaných (filtruje se podle shodné kategorie) |
| Soutěž | Liga / přebor / turnaj / přátelák |
| Sezona | Formát např. `2025/26` |
| **Délka čtvrtiny** | Default 10 min, mladší kategorie 8 nebo 6. Rozsah 4–15. |
| **Počet čtvrtin** | Viditelné jen u typu _Přátelák_ — volitelně 3 nebo 4. Pro ligy/poháry/turnaje pevně 4. |
| Nasazení hráči | Klik na karty → vybrat alespoň 5 |

Pod sestavou se ukáže **breakdown** vybraných hráčů:

- **Ročníky** (např. `2010 · 4`, `2011 · 8`, `2012 · 3`)
- **Kategorie** (např. `U17 B · 4`, `U15 · 8`, `U14 · 3`)
- Modrý chip = nejpočetnější (hlavní) skupina
- Červený chip = vedlejší skupina s **> 4 hráči** (federační varování)
- Pokud červené, příjde varování — *ověř limit federace pro tuto soutěž*. Neblokuje uložení, jen upozorňuje.

### 2.6 Statistiky (záložka Statistiky)

Agreguje napříč ukončenými zápasy.

**Filtry** (chipy v záhlaví, prázdný výběr = vše):
- Sezona
- Soutěž
- Kategorie
- Hráči (jen v tabu Hráči — pro porovnání 2–3 hráčů)

**Per game toggle** vpravo nahoře — přepne všechny hodnoty mezi celkovým total a průměrem na zápas (PPG, RPG, MPG atd.).

**Tab Hráči** — kompletní boxscore:
- # / Avatar / Jméno / GP (games played) / Min / PTS / 2P / 3P / FT / OFF / DEF / **REB** / AST / STL / TO / BLK / PF / +/- / EFF
- REB = OFF + DEF (celkové doskoky).

**Tab Tým** — 3 KPI karty + tabulka týmových statistik + seznam zápasů:
- KPI: Bilance W–L (–T pokud byly remízy), Body dáno Ø + celkem, Body dostáno Ø + celkem.
- Týmová tabulka: stejné sloupce jako Hráči (GP, Min, PTS, 2P, 3P, FT, OFF, DEF, **REB**, AST, STL, TO, BLK, PF) **kromě +/- a EFF**. Reaguje na per game toggle.
- Seznam zápasů s V/P/R. **Klik na řádek** otevře matchEnd view daného zápasu s plným per-Q boxscore a per-hráč staty soupeře.

### 2.7 Presety filtrů

Bar nad filtry **Presety**:

- **+ Uložit** (aktivní jen když máš nějaký filtr) → modal s názvem → uloží aktuální výběr filtrů.
- Klik na preset chip → aplikuje uložené filtry.
- × u presetu → smaže (s potvrzením).
- Modrý preset = shoduje se s aktuálním filtrem.
- **↺ Vše** → vyčistí všechny filtry.

Příklad: nadefinuj `Liga + Extraliga 2025/26` jako preset, máš jeden klik místo 3 chipů.

### 2.8 Zálohování dat

**Domů → Záloha / přenos dat**:

- **📥 Export všech dat (JSON)** → stáhne `basket-data-YYYY-MM-DD.json` s celou databází.
- **📤 Import z JSON** → po potvrzení **přepíše VŠECHNA data** v této instanci appky (v tomto prohlížeči/zařízení).

Doporučený workflow:

1. Trenér si na hlavním zařízení (laptop) vede klubovou soupisku a všechny zápasy.
2. Před zápasem **Export**, JSON pošle / přenese na tablet/notebook asistenta.
3. Asistent **Import** → má aktuální data, zapisuje zápas.
4. Po zápase asistent **Export**, pošle zpět trenérovi.
5. Trenér **Import** → nové zápasy v databázi.

**Pozor**: data jsou uložena v prohlížeči (IndexedDB) **per zařízení a per prohlížeč**. Vyčištění dat prohlížeče = ztráta. Doporučuji pravidelný export.

### 2.9 Témata (světlé / tmavé)

Tlačítko 🌙 / ☀️ vpravo nahoře — přepíná. Výběr se pamatuje v `localStorage` per prohlížeč. Default = podle systému (prefers-color-scheme).

### 2.10 EFF (efficiency)

Standardní NBA formule:
```
EFF = PTS + (OFF + DEF) + AST + STL + BLK
      − (FGA − FGM)   (missed 2P + 3P)
      − (FTA − FTM)   (missed FT)
      − TO            (turnovers)
```

EFF je univerzální box-stat ukazatel celkového přínosu hráče.

---

## Limity & poznámky

- **Stopky a minuty**: pokud asistent stopky nepustil, sloupec Min ukáže `—` (neaktivní). Ostatní staty jsou v pořádku.
- **Stopky odpočítávají dolů** od délky Q (např. 10:00 → 0:00). Celkový čas v zápase pod nimi naopak roste od 0 k `počet_Q × délka_Q`.
- **Stopky a refresh stránky**: po obnovení appky se klok resetuje na plnou délku Q. Použij ✏️ **Čas** v live view.
- **Overtime**: po poslední Q (Q4 nebo Q3 u přáteláku) nabízí appka pokračování do OT pokud je remíza, nebo ukončení.
- **Pravidla mládeže**:
  - U14: hráč nesmí odehrát Q1+Q2+Q3 v řadě
  - U14: max. 3 čtvrtiny / hráč
  - U12, U13: max. 2 čtvrtiny / hráč
  - Appka varuje při porušení (lze pokračovat = vědomé porušení)
- **Foul-out**: 5 osobních faulů → hráč musí být vystřídán, appka vyvolá blokující modal.
- **Soupeř — per hráč**: body, fauly a doskoky se evidují per jersey, pokud klikneš na číslo soupeře před akcí. AST/STL/TO/BLK pro soupeřovy hráče se nezapisují.
- **Soupeř — obecně (bez čísla)**: klik na opp akci bez vybrané jersey zapíše do týmového totálu (v matchEnd jako řádek _Bez čísla hráče_).
- **Soupeř — full roster**: V live zápase je viditelná celá opp soupiska (chips s čísly), ne jen 5 na hřišti. Soupeřovo střídání nesledujeme.
- **Náš tým — body bez hráče (rychlý zápis)**: tlačítka `+2 tým` / `+3 tým` / `+1 tým` v sekci dole vlevo. Body jdou do skóre (sedí semafor), ale ne k žádnému hráči. V matchEnd zvláštní řádek _Bez hráče_ nad TÝM totalem.
- **Tmavé dresy**: automaticky u zápasů kde Naše strana = H (hosté).
- **Oddechy (TO)**: po kliku TO se stopky automaticky pauzují. FIBA: 2 v 1. poločase, 3 v 2. poločase, 1 v každém OT.
- **Undo (↶ Vrátit poslední)**: v clock-baru nahoře. Vrátí zaznamenanou událost, změnu Q čísla i ruční nastavení času. Stack se vyčistí na začátku nové Q.
- **Bench strip dole**: kompaktní jednořádkový seznam hráčů na lavičce. Bez interakce, jen pro orientaci. Pro střídání použij ⇄ tlačítko v hráčském sloupci.

---

## Zkratky a glosář

| Zkratka | Význam |
|---|---|
| **GP** | Games Played — počet odehraných zápasů (kde hráč byl v soupisce) |
| **PTS** | Points — body |
| **2P / 3P / FT** | 2-body / 3-body / Free Throw (trestný hod) — formát `daný/pokus` |
| **OFF / DEF** | Offensive rebound / Defensive rebound (doskok útočný/obranný) |
| **REB** | Total Rebounds — celkem doskoků (OFF + DEF) |
| **AST** | Assist — asistence (přihrávka na koš) |
| **STL** | Steal — zisk (ukradl míč soupeři) |
| **TO** | Turnover — ztráta (ztratil míč) |
| **BLK** | Block — blok (zablokoval střelu soupeře) |
| **PF** | Personal Foul — osobní faul |
| **+/-** | Plus/minus — rozdíl skóre když byl hráč na hřišti |
| **EFF** | Efficiency — celkový přínos |
| **MPG / PPG / RPG** | Minutes / Points / Rebounds per game (průměr na zápas) |
| **DNP** | Did Not Play (= GP započítáno, ale Min 0:00) |
| **FO** | Fouled Out — vyloučen po 5 osobních faulech |
| **OT** | Overtime — prodloužení |
