# 👩‍🏫 Voorbeeldoplossing (lesgeversgids)

Dit is het **einddoel**: de volledige blokkencode die je samen met de kinderen opbouwt in de 15 stappen van de workshop. Zo zie je in één oogopslag wat er nog gebouwd moet worden.

## In het spel bekijken

Open het spel, typ een naam, klik in het startmenu op **meer opties → 👩‍🏫 Voorbeeldoplossing**. De volledige code verschijnt in de editor. Klik daarna op ▶ Start de les en druk op 🚩 om ze te zien werken. (De knop overschrijft wat er in de editor staat — gebruik hem dus op jouw eigen toestel, niet op dat van een kind met werk erin.)

> ⚠️ Deze knop is bedoeld voor jou als begeleider. Toon ze niet te vroeg aan de kinderen — de bedoeling is dat zíj het opbouwen. Gebruik ze om je voor te bereiden of om als klas te vergelijken op het einde.

> 💡 Wil je één leerling op weg helpen? Dan hoef je de voorbeeldoplossing niet bij hem te laden. Klik op het dashboard bij die leerling op **blokken**: zijn eigen blokken verschijnen rechts, je sleept er zelf iets bij en klikt **📤 stuur terug**. De leerling ziet een melding en kan met één klik zijn eigen versie terugzetten.

## De volledige blokkenstructuur

De voorbeeldoplossing bestaat uit **10 losse stapeltjes** (net als in Scratch mogen stapeltjes naast elkaar draaien). Bij elk stapeltje staat bij welke stap van de les het hoort.

### 1 · Besturing — kleur, richten en rijden *(stap 1–5 en 11)*
```
🚩 wanneer op groene vlag wordt geklikt
   zet kleur op [blauw]                          ← één keer bij de start (stap 11)
   herhaal                                       ← HERHALING (stap 2)
      richt het geschut naar de muis             ← INVOER → UITVOER (stap 5)
      als <toets [pijltje omhoog] ingedrukt?> dan    ← ALS-DAN + INVOER (stap 3)
         richt naar (0) graden
         neem (10) stappen
      als <toets [pijltje rechts] ingedrukt?> dan    ← hetzelfde patroon (stap 4)
         richt naar (90) graden
         neem (10) stappen
      als <toets [pijltje omlaag] ingedrukt?> dan
         richt naar (180) graden
         neem (10) stappen
      als <toets [pijltje links] ingedrukt?> dan
         richt naar (-90) graden
         neem (10) stappen
```
*Graden zoals in Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.*

### 2 · Schieten met de muis, als salvo *(stap 6 en 15)*
```
🚩 wanneer op groene vlag wordt geklikt
   herhaal
      als <muis ingedrukt?> dan
         herhaal (3) keer
            schiet
            wacht (0.2) sec.
```
*Bewust een eigen stapeltje: het wacht-blok pauzeert alleen dít stapeltje, dus je kan blijven rijden terwijl je schiet. Zet je het in de besturingslus, dan hapert je tank (de breek-oefening van stap 15).*

### 3 · Schieten met de spatiebalk *(breek-oefening van stap 6)*
```
🚩 wanneer toets [spatiebalk] wordt ingedrukt   ← GEBEURTENIS
   schiet
```

### 4 · Je eigen levensteller *(stap 7, 8 en 9)*
```
🚩 wanneer op groene vlag wordt geklikt
   maak [Levens] (max levens)                    ← VARIABELE vullen bij de start (stap 7)
   herhaal
      als <raak ik [een vijandelijke kogel]?> dan    (stap 8)
         flits [wit]
         speel geluid [tik]
         verander [Levens] met ((0) − (kracht kogel))   ← echte schade (stap 9)
```

### 5 · Om hulp roepen *(stap 10)*
```
🚩 wanneer op groene vlag wordt geklikt
   herhaal
      als <(mijn levens) < (30)> dan             ← ALS-DAN + een waarde
         flits [rood]
         zeg [help!]
      wacht (1) sec.
```

### 6 · Reacties op gebeurtenissen *(stap 12)*
```
🚩 wanneer ik iemand versla 🏆
   verander [kills] met (1)                      ← tellen met een VARIABELE
   speel geluid [tada]
   zeg [hebbes!]

🚩 wanneer ik kapot ga
   zeg [ik kom sterker terug!]
```
*In de les bouwen de kinderen hier hun eigen versie: bijvoorbeeld `zeg [gepakt!]` en `flits rood`. Elk gebeurtenisblok is de start van een eigen stapeltje.*

### 7 · Bij een nieuw level de keuze tonen *(stap 12, extra)*
```
🚩 wanneer ik een level omhoog ga
   speel geluid [tada]
   toon upgrade-keuze                            ← opent het klassevenster (statpunten
                                                   verdeel je met de balken linksonder)
```

### 8 · Hoe sterk ben ik? *(stap 13)*
```
🚩 wanneer op groene vlag wordt geklikt
   herhaal
      maak [kracht] (((waarde van stat [kogelschade]) × (2)) + (waarde van stat [kogelsnelheid]))
      wacht (1) sec.
```
*REKENEN: een getal dat het spel niet bijhoudt, rekent de leerling zelf uit.*

### 9 · Het upgrade-plan *(stap 14)*
```
🚩 wanneer ik een statpunt krijg ⚡
   als <(waarde van stat [kogelschade]) < (5)> dan
      geef 1 statpunt aan [kogelschade]          ← eigen build programmeren!
   anders
      geef 1 statpunt aan [snelheid]
```
*De leerling programmeert zijn eigen upgrade-strategie — een echt algoritme. De server bewaakt de regels (alleen met punten, max 7/7), dus valsspelen kan niet. Let op: met dit stapeltje worden je statpunten meteen uitgegeven; wil je zelf kiezen, gooi het dan weg.*

## Starter en Expert

> ⭐🚀 **Starter vs Expert:** met de schakelaar boven de blokken kies je hoeveel blokken zichtbaar zijn.
>
> **⭐ Starter groeit mee met de les.** Bij stap 1 staan er maar twee blokken in de lade (`wanneer op groene vlag` en `neem 10 stappen`); elke stap ontgrendelt precies wat je daar nodig hebt. Bij stap 15 zijn het er ruim dertig, plus de oranje variabelen. Zo hoeft een kind van acht niet tussen veertig blokken te zoeken naar dat ene. Wat ontgrendeld is blijft staan, ook als je terugbladert; alleen 🗑 *Alles wissen* zet je terug bij stap 1.
>
> **🚀 Expert toont álles ineens** — ook de blokken van later in de les, de blokken van les 2 (`ben ik in mijn basis?`, `niet`, `wacht tot`, signalen, `score van de beste speler`, `mijn plaats in de ranglijst`) en de extra's die in de les zelf niet voorkomen: `beweeg (n) stappen vooruit/achteruit`, `draai geschut ↻ (n) graden`, `richt het geschut op (n) graden`, `stopwatch`, `willekeurig getal`, `statpunten over` en `toon/verberg variabele`. Gebruik dit voor snelle leerlingen (de opdrachtkaarten hebben vaak blokken van later nodig) en om zelf het einddoel te bekijken.
>
> 🎯 **Auto-aim-tank (mooie expert-uitdaging):** `herhaal → richt het geschut naar [dichtstbijzijnde vijand] → schiet` maakt een tank die helemaal zelf mikt. Combineer met `als <raak ik [een muur]?> dan draai geschut ↻ 90 graden` voor een tank die zelf om obstakels heen rijdt.

> 💡 **Variabelen zoals in Scratch:** in de oranje categorie zit de knop **"Maak een variabele"**. Daarna kies je je variabele uit een dropdown in de blokken *maak … / verander … met / (variabele)*, precies zoals in Scratch, en elke variabele verschijnt automatisch als **live tellertje rechtsboven op het speelveld**.
>
> Onderaan diezelfde oranje categorie staan de **variabelen van het spel**: `mijn levens`, `max levens`, `mijn score`, `mijn level`, je positie. Dat zijn écht variabelen — die getallen veranderen voortdurend terwijl je speelt. Het verschil met je eigen variabelen: **het spel houdt ze bij en jij leest ze af**. Zo kan niemand vals spelen door zijn eigen levens op 999 te zetten. Een mooi klasgesprek: *"welke variabelen mag jij veranderen, en welke houdt het spel bij? Waarom?"*

## En in les 2: signalen

Signalen (Scratch' *"zend bericht"* / *"wanneer ik bericht ontvang"*) zitten bewust niet in deze voorbeeldoplossing: ze zijn verhuisd naar [les 2](LESPLAN_LES2.md), stap 2. Daar ziet het er zo uit:

```
🚩 wanneer ik iemand versla 🏆
   zend signaal [bonus] 📡                       ← SIGNAAL VERSTUREN

🚩 wanneer ik signaal [bonus] ontvang 📡        ← EN ONTVANGEN
   verander [teampunten] met (50)
   speel geluid [tada]
   flits [geel]
```
*Het versla-stapeltje weet alleen dát er iets te vieren valt; wát de beloning is, staat op één plek. Let op: de twee namen moeten exact gelijk zijn, anders komt het bericht nergens aan — dat is meteen de breek-oefening.*

## Waar zitten de kernconcepten?

| Concept | In welk stapeltje |
|---|---|
| 📋 **Sequentie** | Elk stapeltje: blokken onder elkaar, volgorde telt (bv. eerst `richt`, dan de `als`-blokken; `zet kleur` vóór de lus) |
| 🔁 **Herhaling** | 1, 2, 4, 5 en 8: `herhaal`; 2 ook `herhaal 3 keer` |
| ❓ **Selectie (als-dan)** | 1 (toetsen), 2 (muisknop), 4 (kogel), 5 (levens < 30), 9 (als-dan-anders) |
| 🔢 **Variabelen** | 4 (`Levens`), 6 (`kills`), 8 (`kracht`), en de spelvariabelen `mijn levens`, `max levens` |
| ➗ **Rekenen** | 4 (`0 − kracht kogel`), 8 (`kogelschade × 2 + kogelsnelheid`) |
| ↔️ **Invoer/verwerking/uitvoer** | Invoer = toetsen/muis (1, 2, 3) · Verwerking = de als-blokken en sommen · Uitvoer = tank beweegt, schiet, flitst, zegt |

## Wat de kinderen NIET zelf bouwen (dat doet het spel voor hen)

Vormen & muren kapotschieten, robots (3 niveaus + elites), score/XP/levels, de 8 statpunten-upgrades (toets 1-8) en de klassenboom (lvl 15/30/45), respawn-verzwakking, veilige zones/spawnbescherming, multiplayer & teams. Zie [README.md](../README.md) voor de volledige lijst.
