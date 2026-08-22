# 👩‍🏫 Voorbeeldoplossing (lesgeversgids)

Dit is het **einddoel**: de volledige blokkencode die je samen met de kinderen opbouwt. Zo zie je in één oogopslag wat er nog gebouwd moet worden.

## In het spel bekijken

Open het spel, en klik in het startmenu op **👩‍🏫 Voorbeeldoplossing (lesgever)**. De volledige code verschijnt in de editor. Kies daarna een modus en druk op 🚩 om ze te zien werken. (De knop overschrijft wat er in de editor staat — gebruik hem dus op jouw eigen toestel, niet op dat van een kind met werk erin.)

> ⚠️ Deze knop is bedoeld voor jou als begeleider. Toon ze niet te vroeg aan de kinderen — de bedoeling is dat zíj het opbouwen. Gebruik ze om je voor te bereiden of om als klas te vergelijken op het einde.

## De volledige blokkenstructuur

Het spel bestaat uit **6 losse scripts** (net als in Scratch mogen scripts naast elkaar draaien). Elk script hoort bij een bouwblok uit het lesplan.

### 1 · Besturing — rijden, richten, schieten *(Les 1, bouwblok 1 & 2)*
```
🚩 wanneer op ▶ Speel! wordt geklikt
   zet kleur op [blauw]
   herhaal                              ← HERHALING
      richt het geschut naar de muis            ← INVOER (muis) → UITVOER
      als <toets [pijltje omhoog] ingedrukt?> dan    ← ALS-DAN + INVOER (toets)
         beweeg omhoog
      als <toets [pijltje omlaag] ingedrukt?> dan
         beweeg omlaag
      als <toets [pijltje links] ingedrukt?> dan
         beweeg links
      als <toets [pijltje rechts] ingedrukt?> dan
         beweeg rechts
      als <muis ingedrukt?> dan
         schiet
```

### 2 · Schieten met de spatiebalk *(Les 1, bouwblok 2)*
```
🚩 wanneer toets [spatiebalk] wordt ingedrukt   ← GEBEURTENIS
   schiet
```

### 3 · Reactie als je geraakt wordt — met een teller *(Les 1, bouwblok 3 + Les 2)*
```
🚩 wanneer ik geraakt word                      ← GEBEURTENIS
   flits [wit]
   speel geluid [tik]
   verander [keer geraakt] met 1                ← VARIABELE (tellen)
   als <waarde van [keer geraakt] > 5> dan      ← ALS-DAN + VARIABELE
      zeg [jullie krijgen me niet!]
```

### 4 · Bij een nieuw level: upgrade-keuze tonen *(Les 1, bouwblok 4)*
```
🚩 wanneer ik een level omhoog ga
   speel geluid [tada]
   toon upgrade-keuze                           ← opent het klassevenster (statpunten
                                                  verdeel je met de balken linksonder)
```

### 5 · Bij kapot gaan iets zeggen *(Les 1, bouwblok 3)*
```
🚩 wanneer ik kapot ga
   zeg [ik kom sterker terug!]
```

### 6 · EXPERT — vluchtmodus *(Les 1 uitbreiding / Les 2)*
```
🚩 wanneer op ▶ Speel! wordt geklikt
   herhaal
      als <mijn levens < 30> dan                ← ALS-DAN + WAARNEMEN (levens)
         flits [rood]
         zeg [help!]
      wacht 1 sec.
```

### 7 · EXPERT — automatisch upgrade-plan *(groene Upgrades-categorie)*
```
🚩 wanneer ik een statpunt krijg                ← GEBEURTENIS (bij elk level)
   als <waarde van stat [kogelschade] < 5> dan  ← ALS-DAN + stat uitlezen
      geef 1 statpunt aan [kogelschade]         ← eigen build programmeren!
   anders
      geef 1 statpunt aan [snelheid]
```
*De leerling programmeert zijn eigen upgrade-strategie — een echt algoritme. De server bewaakt de regels (alleen met punten, max 7/7), dus valsspelen kan niet. Handmatig upgraden via de popup of toetsen 1-8 blijft ook gewoon werken.*

> ⭐🚀 **Starter vs Expert:** met de schakelaar boven de blokken kies je hoeveel blokken zichtbaar zijn.
>
> **⭐ Starter groeit mee met de les.** Bij stap 1 staan er maar twee blokken in de lade (`wanneer op groene vlag` en `neem 10 stappen`); elke stap ontgrendelt precies wat je daar nodig hebt. Bij stap 16 zijn het er 36. Zo hoeft een kind van acht niet tussen veertig blokken te zoeken naar dat ene. Wat ontgrendeld is blijft staan, ook als je terugbladert; alleen 🗑 *Alles wissen* zet je terug bij stap 1.
>
> **🚀 Expert toont álles ineens** — ook de blokken van later in de les, plus de extra's die in de les zelf niet voorkomen: `beweeg (n) stappen vooruit/achteruit`, `draai geschut ↻ (n) graden`, `richt het geschut op (n) graden`, `wacht tot`, `in mijn basis?`, `stopwatch`, `niet`/`willekeurig getal`, `statpunten over` en `toon/verberg variabele`. Gebruik dit voor snelle leerlingen (de opdrachtkaarten hebben vaak blokken van later nodig) en om zelf het einddoel te bekijken.
>
> 🎯 **Auto-aim-tank (mooie expert-uitdaging):** `herhaal → richt naar [dichtstbijzijnde vijand] → schiet` maakt een tank die helemaal zelf mikt. Combineer met `als <raak ik [muur]?> dan draai geschut ↻ 90 graden` voor een tank die zelf om obstakels heen rijdt.

> 💡 **Variabelen zoals in Scratch:** in de oranje categorie zit de knop **"Maak een variabele"**. Daarna kies je je variabele uit een dropdown in de blokken *maak … / verander … met / (variabele)*, precies zoals in Scratch, en elke variabele verschijnt automatisch als **live tellertje rechtsboven op het speelveld**.
>
> Onderaan diezelfde oranje categorie staan de **variabelen van het spel**: `mijn levens`, `mijn score`, `mijn level`, je positie, je statpunten. Dat zijn écht variabelen — die getallen veranderen voortdurend terwijl je speelt. Het verschil met je eigen variabelen: **het spel houdt ze bij en jij leest ze af**. Zo kan niemand vals spelen door zijn eigen levens op 999 te zetten. Een mooi klasgesprek: *"welke variabelen mag jij veranderen, en welke houdt het spel bij? Waarom?"*

### 8 · Kills tellen en je beloning oproepen *(🏆 + 📡 signaal)*
```
🚩 wanneer ik iemand versla 🏆
   verander [kills] met 1                       ← VARIABELE
   zend signaal [bonus] 📡                      ← SIGNAAL VERSTUREN

🚩 wanneer ik signaal [bonus] ontvang 📡        ← EN ONTVANGEN
   verander [bonuspunten] met 50
   speel geluid [tada]
   flits [geel]
   zeg [hebbes!]
```
*Dit is Scratch' "zend bericht" / "wanneer ik bericht ontvang". Het versla-stapeltje weet alleen dát er iets te vieren valt; wát de beloning is, staat op één plek. Wil je diezelfde beloning later ook bij een andere gebeurtenis, dan zend je gewoon hetzelfde signaal — niets overtypen. Let op: de twee namen moeten exact gelijk zijn, anders komt het bericht nergens aan (dat is meteen de breek-oefening van stap 16).*

## Waar zitten de vier kernconcepten?

| Concept | In welk script |
|---|---|
| 📋 **Sequentie** | Elk script: blokken onder elkaar, volgorde telt (bv. eerst `richt`, dan `als`-blokken) |
| 🔁 **Herhaling** | Script 1 & 6: `herhaal` |
| ❓ **Selectie (als-dan)** | Script 1 (toetsen), 3 (teller > 5), 6 (levens < 30) |
| 🔢 **Variabelen** | Script 3 (`keer geraakt`), en de waarnemen-waarden `mijn levens`, `score`, `level` |
| ↔️ **Invoer/verwerking/uitvoer** | Invoer = toetsen/muis (script 1,2) · Verwerking = de als-blokken en vergelijkingen · Uitvoer = tank beweegt, schiet, flitst, zegt |

## Wat de kinderen NIET zelf bouwen (dat doet het spel voor hen)

Vormen & muren kapotschieten, robots (3 niveaus + elites), score/XP/levels, de 8 statpunten-upgrades (toets 1-8) en de klassenboom (lvl 15/30/45), respawn-verzwakking, veilige zones/spawnbescherming, multiplayer & teams. Zie [README.md](../README.md) voor de volledige lijst.
