<script lang="ts">
  type Sekce = 'asistent' | 'trener' | 'limity';

  let aktivni = $state<Sekce>('asistent');
</script>

<div class="navod">
  <div class="navod-toolbar">
    <h2>Nápověda</h2>
    <div class="sekce-switcher">
      <button class:active={aktivni === 'asistent'} onclick={() => aktivni = 'asistent'}>Asistent — rychlý start</button>
      <button class:active={aktivni === 'trener'} onclick={() => aktivni = 'trener'}>Trenér — úplný průvodce</button>
      <button class:active={aktivni === 'limity'} onclick={() => aktivni = 'limity'}>Limity & glosář</button>
    </div>
  </div>

  {#if aktivni === 'asistent'}
    <article class="content">
      <h3>Asistent — Rychlý start (live zápis zápasu)</h3>

      <section class="step">
        <h4>1. Před výhozím tipoffem</h4>
        <p>Trenér už by měl mít založený zápas přes <strong>Zápasy → + Nový zápas</strong>. Otevři appku, jdi do <strong>Zápasy</strong>, klikni <strong>Pokračovat</strong> u rozehraného zápasu (nebo <strong>Detail</strong>).</p>
      </section>

      <section class="step">
        <h4>2. Začátek čtvrtiny</h4>
        <ol>
          <li>Klikni na 5 <strong>našich</strong> hráčů na hřišti (karty se podbarví modře).</li>
          <li>Volitelně vyber 5 čísel <strong>soupeře</strong> v sekci pod sestavou (pokud má rozepsanou soupisku v Soupeři). Pokud ne, zápis se zapíše bez per-hráč evidence soupeře. <em>Tahle pětice slouží jen pro úvodní orientaci — v live zápise uvidíš plnou soupisku soupeře.</em></li>
          <li>Klik <strong>Začít Q1</strong>.</li>
          <li>Volitelně klikni <strong>▶ Start</strong> stopek. Stopky odpočítávají od délky Q (např. 10:00 → 0:00). Pokud nestihneš pouštět, akce se zapíší stejně, jen minuty se nepočítají.</li>
        </ol>
      </section>

      <section class="step">
        <h4>3. Layout live obrazovky</h4>
        <p>Obrazovka je rozdělená na 3 sloupce vedle sebe:</p>
        <ul>
          <li><strong>Vlevo — MY AKCE:</strong> akce sgrupované (ÚTOK ✓/✗ ve dvou řadách, DOSKOK, POZITIVNÍ, NEGATIVNÍ), dole <em>Rychlý zápis bez hráče</em> a <em>Tech. lavička</em>.</li>
          <li><strong>Uprostřed — HRÁČI:</strong> 5 svislých karet našich hráčů na hřišti, dole modré tlačítko <strong>⇄ Střídání</strong>.</li>
          <li><strong>Vpravo — SOUPEŘ:</strong> plná soupiska soupeře jako chips (#číslo + příjmení), dole opp akce v 2-col gridu.</li>
        </ul>
        <p>Pod hlavními sloupci: <strong>Live totals</strong> (MY/SOUPEŘ chipy), <strong>Timeouts</strong>, <strong>Šatna strip</strong> (kompaktní řádek bench hráčů), footer s Konec Q / Ukončit zápas.</p>
        <p>Nahoře <strong>clock-bar</strong>: stopky, Start/Pauza, ✏️ Čas, ✏️ Q, ↺ Reset, a <strong>↶ Vrátit poslední</strong> (undo posledních akcí).</p>
      </section>

      <section class="step">
        <h4>4. Během hry</h4>
        <table>
          <thead>
            <tr><th>Akce</th><th>Postup</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Náš hráč skóroval / fauloval / cokoli</td>
              <td>Klik na <strong>hráče uprostřed</strong> (karta zmodrá) → klik na akci vlevo. ÚTOK: horní řada zelená "✓ dal", spodní červená "✗ nedal" (2P / 3P / Trestný). Ostatní skupiny: DOSKOK (off/def), POZITIVNÍ (AST/STL/BLK), NEGATIVNÍ (Faul/Ztráta). <strong>Tip:</strong> všech 13 akcí jde zapsat jediným gestem (na hráči i na akčním tlačítku) — viz krok <em>4b. Rychlé zapisování gesty</em>.</td>
            </tr>
            <tr>
              <td>Náš tým skóroval, ale nevím kdo</td>
              <td>Sekce <strong>RYCHLÝ ZÁPIS BEZ HRÁČE</strong> vlevo dole: <code>+2 tým</code> / <code>+3 tým</code> / <code>+1 tým</code>. Bez výběru hráče. Sedí semafor, ale nezapočítá se k žádnému hráči (v matchEnd jako řádek <em>Bez hráče</em>).</td>
            </tr>
            <tr>
              <td>Soupeř skóroval — víme kdo</td>
              <td>Klik na chip s číslem v opp panelu vpravo (zvýrazní se) → klik na akci (+2 / +3 / +1 / Faul / doskok). Po akci se výběr automaticky resetuje. Nebo klik <strong>✕ bez hráče</strong> pro zrušení výběru.</td>
            </tr>
            <tr>
              <td>Soupeř skóroval — nevíme kdo</td>
              <td>Nechej chip nevybraný → klik přímo na akci. Zapíše obecně bez čísla (v matchEnd jako <em>Bez čísla hráče</em>).</td>
            </tr>
            <tr>
              <td>Střídání (1 nebo víc hráčů)</td>
              <td>Tlačítko <strong>⇄ Střídání</strong> pod hráčským sloupcem → modal: vlevo "Ven" (na hřišti), vpravo "Dovnitř" (lavička). Klikni libovolný počet hráčů na obou stranách (čísla pořadí se ukážou nad chipy). Počty se musí rovnat. <strong>Provést střídání</strong>.</td>
            </tr>
            <tr>
              <td>Omyl (jakákoli akce)</td>
              <td>Klikni <strong>↶ Vrátit poslední</strong> v clock-baru nahoře — vrátí poslední událost, změnu Q čísla i ruční nastavení času.</td>
            </tr>
            <tr>
              <td>Stopky čas</td>
              <td>▶ Start / ⏸ Pauza / ✏️ Čas (zadej zbývající MM:SS) / ↺ Reset</td>
            </tr>
            <tr>
              <td>Špatné číslo Q</td>
              <td>Klik ✏️ <strong>Q</strong> → zadej správné číslo (např. 2 pro Q2, 5 pro OT1). Změna se promítne do všech událostí této Q.</td>
            </tr>
            <tr>
              <td>Oddech (TO)</td>
              <td>Klik tlačítko ⏱ TO (MY / SOUPEŘ) dole. Klok se automaticky pauzne. Pamatuje FIBA pravidla 2/3/1 podle období.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="step">
        <h4>4b. Rychlé zapisování gesty (volitelné, zrychlí většinu akcí)</h4>
        <p>Aplikace nabízí <strong>dva směry gesta</strong>, vyber si který ti sedí (oba fungují souběžně):</p>

        <h5>A) Hráč → akce (gesto na kartě hráče)</h5>
        <p class="warn-inline">⚠ <strong>Swipe je momentálně vypnutý</strong> (kolidoval se scrollem na mobilu). Funguje jen <strong>tap</strong> (= vybrat hráče) a <strong>podržení prstu</strong> (= radial 13 akcí). Tabulka swipe níže je jen pro referenci.</p>
        <p>Na kartě hráče v prostředním sloupci fungují kromě klasického <strong>tapu</strong> (= vybrat hráče) ještě tato gesta:</p>
        <table>
          <thead>
            <tr><th>Gesto</th><th>Akce</th><th>Použití</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Krátké švihnutí ↑</strong></td>
              <td>+2 body daný</td>
              <td rowspan="4">Při tažení se kolem karty objeví 4 popisky (↑✓2, ↓✗2, →FAUL, ←REB-D) — aktivní směr se modře zvýrazní. Pust až za hranicí karty, jinak se akce nezapíše. Nejrychlejší cesta pro 4 nejčastější situace.</td>
            </tr>
            <tr><td><strong>Krátké švihnutí ↓</strong></td><td>2 body NEdaný</td></tr>
            <tr><td><strong>Krátké švihnutí →</strong></td><td>Faul (otevře výběr osobní/nesp./tech.)</td></tr>
            <tr><td><strong>Krátké švihnutí ←</strong></td><td>Doskok obranný (REB-D)</td></tr>
            <tr>
              <td><strong>Podržení prstu (~¼ s) + tažení</strong></td>
              <td>Radial menu — dvě soustředné vrstvy s 13 akcemi</td>
              <td>
                <strong>Vnitřní kruh (8):</strong> ↑✓2, ↗✓3, →FAUL, ↘REB-O, ↓✗2, ↙✗3, ←REB-D, ↖✓FT.<br/>
                <strong>Vnější kruh (5):</strong> AST, STL, BLK, TO, ✗FT — menší tmavší segmenty, dál od středu.<br/>
                Slidneš prstem na požadovaný segment a pustíš = zápis. Vnitřní/vnější se rozlišuje vzdáleností (vnější ≥ 110 px od středu). Ve středu (×) nebo daleko mimo = cancel.
              </td>
            </tr>
          </tbody>
        </table>

        <h5>B) Akce → hráč (gesto na akčním tlačítku vlevo)</h5>
        <p>Pokud máš jasné <em>co se stalo</em>, ale očima ještě hledáš <em>kdo to provedl</em>, jdi opačně:</p>
        <table>
          <thead>
            <tr><th>Gesto</th><th>Akce</th><th>Použití</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Krátký tap na tlačítko</strong></td>
              <td>Zapíše akci na <em>vybraného</em> hráče (klasický flow)</td>
              <td>Funguje jen pokud máš hráče vybraného vpravo. Tlačítka jsou jinak vizuálně ztlumená.</td>
            </tr>
            <tr>
              <td><strong>Podržení tlačítka (~¼ s) + tažení</strong></td>
              <td>Radial menu s <strong>5 hráči na hřišti</strong> (číslo + příjmení)</td>
              <td>Funguje na <strong>všech 13 akcí</strong> (✓2, ✓3, ✓FT, ✗2, ✗3, ✗FT, REB-O, REB-D, AST, STL, BLK, FAUL, TO). Faul navíc otevře výběr subtype. Tažením přes segment hráče a puštěním = zápis bez nutnosti tappnout hráče dopředu.</td>
            </tr>
          </tbody>
        </table>

        <p class="muted-note">
          <strong>Kardinální směry jsou v swipe i v radialu stejné</strong> (↑+2, ↓✗2, →faul, ←REB-D), takže nemusíš přepínat myšlení mezi swipe a radial.<br/>
          Tap na hráče (= výběr) + tap na tlačítko (= zápis) funguje pořád úplně stejně jako bez gest — gesta jsou jen rychlejší alternativa pro toho kdo si zvykne.
        </p>
      </section>

      <section class="step">
        <h4>5. Konec čtvrtiny</h4>
        <p>Klikni <strong>Konec Q1</strong> → stopky se automaticky zapauzují → vyber 5 hráčů pro Q2 → <strong>Začít Q2</strong>. Při přechodu se stopky resetují na 0:00.</p>
      </section>

      <section class="step">
        <h4>6. Konec zápasu</h4>
        <p>Po Q4 (nebo OT) klikni <strong>Ukončit zápas</strong> → potvrď. Pokud Q4 končí remízou, můžeš jít do prodloužení. Po ukončení uvidíš kompletní boxscore.</p>
      </section>

      <section class="step warn">
        <h4>Časté situace</h4>
        <ul>
          <li><strong>Hráč má 5 faulů (vyloučen):</strong> appka automaticky vyvolá modal pro vystřídání.</li>
          <li><strong>Stopky se resetovaly nechtěně:</strong> klikni ✏️ Čas, zadej zbývající čas MM:SS (např. <code>4:23</code>), Enter. Stopky budou pozastavené — pak ▶ Start.</li>
          <li><strong>Špatné číslo Q (zápas ještě bez akcí):</strong> klikni ✏️ Q a zadej správné číslo. Pokud v aktuální Q nejsou žádné akce, jen se přejmenuje.</li>
          <li><strong>Prošvihl jsi konec Q (akce už máš zapsané):</strong> klikni ✏️ Q a zadej číslo nové Q. Aktuální Q se uzavře s dosavadními akcemi, vznikne nová Q se stejnou pěticí a stopkami od 0:00 — od teď zapisuješ do ní. Vrátit přes <strong>↶ Vrátit poslední akci</strong> (jen pokud nová Q ještě nemá akce).</li>
          <li><strong>U14 pravidlo (Q1+Q2+Q3 v řadě zakázáno):</strong> appka varuje při střídání, lze pokračovat (= vědomé porušení).</li>
          <li><strong>Limit čtvrtin (U12/U13: 2, U14: 3):</strong> varování při překročení.</li>
          <li><strong>Hostujeme (Naše strana = H):</strong> dresy hráčů se zobrazí v tmavé variantě (modré tělo, bílé číslo) automaticky podle nastavení zápasu.</li>
        </ul>
      </section>
    </article>
  {:else if aktivni === 'trener'}
    <article class="content">
      <h3>Trenér — Úplný průvodce</h3>

      <section class="step">
        <h4>2.1 Hráči (klubová soupiska)</h4>
        <p><strong>Hráči → + Nový hráč</strong>. Pole:</p>
        <ul>
          <li><strong>Jméno + Příjmení</strong> (povinné)</li>
          <li><strong>Číslo dresu</strong> (0–99)</li>
          <li><strong>Pozice</strong> (PG/SG/SF/PF/C, volitelné)</li>
          <li><strong>Výška</strong> v cm (volitelné, 100–230)</li>
          <li><strong>Datum narození</strong> (volitelné — pokud zadáno, ročník se vyplní automaticky)</li>
          <li><strong>Ročník narození</strong> (čtyřciferný — slouží pro výpočet věku, ten se ukáže jako modrý štítek)</li>
          <li><strong>Domácí kategorie</strong> (povinná — kde hráč hlavně trénuje a hraje)</li>
          <li><strong>Foto</strong> (volitelné, zmenší se na 240×240 JPEG; bez fotky se ukazuje stylizovaný dres s číslem)</li>
          <li><strong>Aktivní</strong> = v soupisce klubu</li>
        </ul>
      </section>

      <section class="step">
        <h4>2.2 Eligibility — kdo smí hrát kterou kategorii</h4>
        <p>Pravidlo: <strong>hráč hraje svou domácí kategorii + všechny starší v obou liniích A i B</strong>.</p>
        <div class="kategorie-poradi">
          Přípravka → U10 MIX → U11 → U12 → U13 → U14 → <strong>U15 B</strong> → U15 → <strong>U17 B</strong> → U17 → <strong>U19 B</strong> → U19 → Muži B → Muži A
        </div>
        <p><strong>Příklad:</strong> Hráč s domácí kategorií <code>U14</code> může hrát U14, U15 B, U15, U17 B, U17, U19 B, U19, Muži B, Muži A.</p>
        <p><strong>U15 B</strong> hráč může hrát U15 B, U15, U17 B…, ale <em>nemůže</em> hrát U14 (mladší).</p>
      </section>

      <section class="step">
        <h4>2.3 Soupeři</h4>
        <p><strong>Soupeři → + Nový soupeř</strong>: Název, Kategorie, soupiska (čísla + jména volitelně).</p>
        <p>Rozepsaná soupiska se používá v live zápase pro per-hráč evidenci (klik na číslo soupeře před akcí). Rychlé doplnění:</p>
        <ul>
          <li><strong>⎘ Hromadně vložit</strong> → textarea s formátem <code>číslo jméno [příjmení]</code> na řádek (samotná čísla bez jmen OK). Přepíše stávající seznam.</li>
          <li><strong>↻ Z posledního zápasu</strong> (jen při úpravě existujícího soupeře) — naskenuje události posledního zápasu s tímto týmem a doplní čísla, která jste atribuoval přes chip select. Užitečné když si nepamatujete přesně koho jste zapisoval.</li>
        </ul>
        <p><strong>Pozor:</strong> v přátelácích se mohou objevit dvě hráčské karty se stejným číslem (např. hráč z mladší kat. + hráč ze starší). U <em>soupeře</em> aplikace deduplikuje podle čísla a v stat zápise se vše agreguje pod jedno číslo. U <em>našich hráčů</em> deduplikace nehrozí, klíčujeme přes interní ID — můžete mít klidně 2× <code>#7</code>.</p>
      </section>

      <section class="step">
        <h4>2.4 Soutěže</h4>
        <p><strong>Soutěže</strong> — předdefinováno: Liga, Extraliga, Nadregionální liga, Pražský přebor, ČEYBL, MČR, Easter Cup, Mezinárodní turnaj, Přátelák. Můžeš přidat / upravit / deaktivovat.</p>
      </section>

      <section class="step">
        <h4>2.5 Založení zápasu</h4>
        <p><strong>Zápasy → + Nový zápas</strong>:</p>
        <ul>
          <li><strong>Datum, Naše kategorie</strong> (úroveň zápasu, ne věkový průměr), <strong>Naše strana</strong> (D/H — určuje světlou/tmavou variantu dresů v live)</li>
          <li><strong>Soupeř</strong> (filtruje se podle shodné kategorie)</li>
          <li><strong>Soutěž, Sezona</strong> (např. <code>2025/26</code>)</li>
          <li><strong>Délka čtvrtiny</strong> — default 10 min, mladší kategorie 8 nebo 6 (rozsah 4–15)</li>
          <li><strong>Počet čtvrtin</strong> — viditelné jen u typu <em>Přátelák</em>, volitelně 3 nebo 4 (pro ligy/poháry/turnaje pevně 4)</li>
          <li><strong>Nasazení hráči</strong> — alespoň 5</li>
        </ul>
        <p>Pod sestavou je <strong>breakdown</strong> (chipy podle ročníku + kategorie). Modrý = hlavní skupina; červený + ⚠ = vedlejší skupina s <code>&gt; 4</code> hráči (varování federačního limitu, neblokuje uložení).</p>
      </section>

      <section class="step">
        <h4>2.6 Statistiky</h4>
        <p>Záložka <strong>Statistiky</strong> agreguje napříč ukončenými zápasy.</p>
        <ul>
          <li><strong>Filtry</strong> (chipy v záhlaví): Sezona, Soutěž, Kategorie, Hráči (jen v tabu Hráči). Prázdný výběr = vše.</li>
          <li><strong>Per game toggle</strong> vpravo nahoře — přepne hodnoty mezi total a Ø na zápas.</li>
          <li><strong>Tab Hráči</strong> — boxscore: GP, Min, PTS, 2P, 3P, FT, OFF, DEF, <strong>REB</strong>, AST, STL, TO, BLK, PF, +/-, EFF. REB = OFF + DEF.</li>
          <li><strong>Tab Tým</strong> — 3 KPI karty (bilance, Ø body dáno, Ø body dostáno) + týmová tabulka stejných sloupců jako Hráči (kromě +/- a EFF) + seznam zápasů s V/P/R.</li>
          <li><strong>Klik na řádek zápasu</strong> v Tým tabu otevře <em>matchEnd</em> view s plným per-Q boxscore a per-hráč staty soupeře. Zpět tlačítkem v levém horním rohu.</li>
        </ul>
      </section>

      <section class="step">
        <h4>2.7 Presety filtrů</h4>
        <p>Bar <strong>Presety</strong> nad filtry:</p>
        <ul>
          <li><strong>+ Uložit</strong> → modal s názvem → uloží aktuální filtry.</li>
          <li>Klik na preset chip → aplikuje uložené filtry.</li>
          <li>× u presetu → smaže (s potvrzením).</li>
          <li>Modrý preset = shoduje se s aktuálním výběrem.</li>
          <li><strong>↺ Vše</strong> → vyčistí všechny filtry.</li>
        </ul>
      </section>

      <section class="step">
        <h4>2.8 Zálohování dat</h4>
        <p><strong>Domů → Záloha / přenos dat</strong>:</p>
        <ul>
          <li><strong>Export</strong> → stáhne <code>basket-data-YYYY-MM-DD.json</code> s celou databází.</li>
          <li><strong>Import</strong> → přepíše VŠECHNA data v této instanci (v tomto prohlížeči/zařízení).</li>
        </ul>
        <p><strong>Workflow přenos trenér ↔ asistent:</strong></p>
        <ol>
          <li>Trenér exportuje JSON na laptopu.</li>
          <li>Předá asistentovi (mail, USB, cloud).</li>
          <li>Asistent importuje na tabletu → má aktuální soupisku a zápasy.</li>
          <li>Po zápase asistent exportuje, trenér importuje zpět.</li>
        </ol>
        <p class="warn-inline">⚠ Data jsou uložena v prohlížeči per zařízení. Vyčištění dat prohlížeče = ztráta. Pravidelně exportuj.</p>
      </section>

      <section class="step">
        <h4>2.9 Témata (světlé / tmavé)</h4>
        <p>🌙 / ☀️ vpravo nahoře. Persistuje v <code>localStorage</code> per prohlížeč. Default = podle systému.</p>
      </section>

      <section class="step">
        <h4>2.10 EFF (efficiency)</h4>
        <p>Standardní NBA formule:</p>
        <pre>EFF = PTS + (OFF + DEF) + AST + STL + BLK
      − (FGA − FGM)   (missed 2P + 3P)
      − (FTA − FTM)   (missed FT)
      − TO            (turnovers)</pre>
      </section>
    </article>
  {:else}
    <article class="content">
      <h3>Limity & poznámky</h3>

      <section class="step warn">
        <ul>
          <li><strong>Stopky a minuty:</strong> pokud asistent stopky nepustil, sloupec <strong>Min</strong> ukáže <code>—</code>. Ostatní staty jsou v pořádku.</li>
          <li><strong>Stopky a refresh stránky:</strong> po obnovení appky se klok resetuje na plnou délku Q (např. 10:00). Použij ✏️ <strong>Čas</strong> v live view.</li>
          <li><strong>Stopky odpočítávají dolů</strong> (od délky Q → 0:00). Celkový čas v zápase pod nimi naopak roste od 0 k <code>počet_Q × délka_Q</code>.</li>
          <li><strong>Overtime:</strong> po poslední Q (Q4 nebo Q3 v přáteláku) nabízí appka prodloužení pokud je remíza, nebo ukončení.</li>
          <li><strong>Pravidla mládeže:</strong>
            <ul>
              <li>U14: hráč nesmí odehrát Q1+Q2+Q3 v řadě</li>
              <li>U14: max. 3 čtvrtiny / hráč</li>
              <li>U12, U13: max. 2 čtvrtiny / hráč</li>
              <li>Appka varuje při porušení (lze pokračovat = vědomé porušení).</li>
            </ul>
          </li>
          <li><strong>Foul-out:</strong> 5 osobních faulů → hráč musí být vystřídán, blokující modal.</li>
          <li><strong>Soupeř — per hráč:</strong> sledují se body, fauly a doskoky per jersey (pokud klikneš na číslo soupeře před akcí). AST/STL/TO/BLK pro soupeřovy hráče se nezapisují.</li>
          <li><strong>Soupeř — bez čísla:</strong> klik na opp akci bez vybrané jersey → zapíše obecně do týmového totálu (v matchEnd jako řádek <em>Bez čísla hráče</em>).</li>
          <li><strong>Soupeř — full roster zobrazený</strong>: V live zápase vidíš všechny opp hráče jako chips (řazené dle čísla), ne jen 5 na hřišti. Soupeřovo střídání nesledujeme (přesah by byl příliš velký) — útoč po číslech které víš.</li>
          <li><strong>Náš tým bez hráče (rychlý zápis):</strong> tlačítka <code>+2 tým</code> / <code>+3 tým</code> / <code>+1 tým</code> v sekci dole vlevo. Body jdou do skóre (sedí semafor), ale ne k žádnému hráči. V matchEnd zvláštní řádek <em>Bez hráče</em> nad TÝM totalem.</li>
          <li><strong>Tmavá sada dresů:</strong> automaticky u zápasů kde <em>Naše strana = H</em> (hosté).</li>
          <li><strong>Undo:</strong> tlačítko <strong>↶ Vrátit poslední</strong> v clock-baru nahoře. Vrátí zaznamenanou událost (koš, faul, střídání, oddech), ruční změnu Q čísla nebo času. Stack se vyčistí na začátku nové Q.</li>
          <li><strong>Bench strip dole:</strong> kompaktní jednořádkový seznam hráčů na lavičce (#5 Černý · #8 Dvořák · …). Bez interakce, jen informace. Pro střídání použijte ⇄ tlačítko.</li>
        </ul>
      </section>

      <section class="step">
        <h4>Zkratky a glosář</h4>
        <table>
          <tbody>
            <tr><th>GP</th><td>Games Played — počet odehraných zápasů (kde hráč byl v soupisce)</td></tr>
            <tr><th>PTS</th><td>Points — body</td></tr>
            <tr><th>2P / 3P / FT</th><td>2-body / 3-body / Free Throw — formát <code>daný/pokus</code></td></tr>
            <tr><th>OFF / DEF</th><td>Offensive / Defensive rebound (doskok útočný / obranný)</td></tr>
            <tr><th>REB</th><td>Total Rebounds — celkem doskoků (OFF + DEF)</td></tr>
            <tr><th>AST</th><td>Assist — asistence (přihrávka na koš)</td></tr>
            <tr><th>STL</th><td>Steal — zisk (ukradl míč soupeři)</td></tr>
            <tr><th>TO</th><td>Turnover — ztráta (ztratil míč)</td></tr>
            <tr><th>BLK</th><td>Block — blok (zablokoval střelu soupeře)</td></tr>
            <tr><th>PF</th><td>Personal Foul — osobní faul</td></tr>
            <tr><th>+/-</th><td>Plus/minus — rozdíl skóre když byl hráč na hřišti</td></tr>
            <tr><th>EFF</th><td>Efficiency — celkový přínos hráče</td></tr>
            <tr><th>MPG / PPG / RPG</th><td>Minutes / Points / Rebounds per game (Ø na zápas)</td></tr>
            <tr><th>DNP</th><td>Did Not Play (= GP započítáno, ale Min 0:00)</td></tr>
            <tr><th>FO</th><td>Fouled Out — vyloučen po 5 osobních faulech</td></tr>
            <tr><th>OT</th><td>Overtime — prodloužení</td></tr>
          </tbody>
        </table>
      </section>
    </article>
  {/if}
</div>

<style>
  .navod {
    max-width: 900px;
    margin: 0 auto;
  }
  .navod-toolbar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }
  .navod-toolbar h2 {
    font-size: 22px;
    color: var(--text);
  }
  .sekce-switcher {
    display: flex;
    gap: 4px;
    border-bottom: 2px solid var(--border);
  }
  .sekce-switcher button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
  }
  .sekce-switcher button:hover { color: var(--text); }
  .sekce-switcher button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .content h3 {
    font-size: 20px;
    color: var(--accent);
    margin-bottom: 4px;
  }
  .content h4 {
    font-size: 15px;
    color: var(--text);
    margin-bottom: 8px;
    font-weight: 700;
  }
  .step h5 {
    font-size: 13px;
    color: var(--accent);
    margin: 14px 0 6px 0;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .step h5:first-of-type { margin-top: 8px; }
  .step {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: var(--shadow);
  }
  .step.warn {
    border-color: var(--warn);
    background: var(--surface);
  }
  .step p, .step li {
    color: var(--text);
    font-size: 14px;
    line-height: 1.55;
  }
  .step p { margin-bottom: 6px; }
  .step ul, .step ol {
    margin-left: 22px;
    margin-bottom: 8px;
  }
  .step li { margin-bottom: 4px; }
  .step ul ul {
    margin-top: 4px;
    margin-bottom: 4px;
  }
  .step code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 13px;
    font-family: "Consolas", monospace;
  }
  .step pre {
    background: var(--surface-2);
    border-radius: 6px;
    padding: 12px 14px;
    font-family: "Consolas", monospace;
    font-size: 13px;
    color: var(--text);
    overflow-x: auto;
    white-space: pre;
    line-height: 1.45;
  }
  .step strong { color: var(--accent); }
  .step em { color: var(--text-muted); font-style: italic; }
  .step table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-top: 4px;
  }
  .step table th {
    background: var(--surface-2);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 11px;
    font-weight: 700;
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .step table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    vertical-align: top;
  }
  .step table tbody th {
    background: transparent;
    color: var(--accent);
    font-family: "Consolas", monospace;
    text-transform: none;
    letter-spacing: 0;
    font-size: 13px;
    padding-right: 16px;
    border-right: 1px solid var(--border);
    white-space: nowrap;
  }
  .kategorie-poradi {
    background: var(--surface-2);
    padding: 12px 14px;
    border-radius: 6px;
    font-family: "Consolas", monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text);
    border-left: 3px solid var(--accent);
  }
  .kategorie-poradi strong { color: var(--accent); }
  .warn-inline {
    color: var(--warn);
    font-weight: 600;
    background: var(--surface-2);
    padding: 8px 12px;
    border-radius: 5px;
    margin-top: 8px;
  }
</style>
