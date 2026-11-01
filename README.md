# 🛡️ STEMazing Tank Arena

Een diep.io-geïnspireerd workshopspel voor leerlingen van 8–13 jaar. Leerlingen programmeren hun tank met een **Scratch-achtige blokkeneditor** (zelfde categorieën, kleuren en blokteksten als echt Scratch) en zien hem live reageren op het podium ernaast: bewegen met toetsen, geschut dat naar de muis richt, vormen en muren kapotschieten, levelen, klassen kiezen uit de echte diep.io-upgradeboom en (les 2) live multiplayer met teams.

## Snel starten

1. Zorg dat [Node.js](https://nodejs.org) geïnstalleerd is.
2. Dubbelklik **start.bat** (installeert de eerste keer automatisch de pakketten).
3. De console toont het adres voor de leerlingen, bv. `http://192.168.68.102:3000`.
4. Beamer: `http://localhost:3000/beamer` — hele arena, scorebord, speeladres én de teamknoppen (uit/2/4) voor les 2.
5. **Lesgeversdashboard: `http://localhost:3000/lesgever`** — klasoverzicht (wie is klaar, wie zit vast, welk vinkje nog ontbreekt), leerlingen die ✋ hun hand opsteken, tips sturen naar één leerling of de hele klas, iemand apart een stap vooruit of terug zetten, zijn werkblad opruimen, de klas centraal sturen, ⏸ alles bevriezen, teams instellen, de blokken van een leerling live bekijken door op zijn kaartje te tikken — met zijn opdracht, vinkjes en behaalde stappen ernaast —, **zijn blokken zelf aanpassen en terugsturen** (de leerling kan met één klik zijn eigen versie terugzetten), 🔊 het geluid van de hele klas uitzetten, een heuvelronde starten en 📋 een klasrapport achteraf. Helpen gaat snel: filters (✋ hand op, ⚠ aandacht, ✅ klaar), **⏭ volgende** opent meteen wie je nodig heeft, elk kaartje zegt of het programma loopt en of er blokken los hangen, **⚡ snelle tips** met één tik, en lopen er drie op dezelfde stap vast, dan stuur je hen samen de hint. Een leerling vertelt bij ✋ meteen waarom (tank doet het niet, snapt de opdracht niet, vindt een blok niet, klaar), en met **📽** zet je een leerling groot op de beamer: zijn blokken en wat hij ziet, om samen een oplossing te bespreken. Het dashboard werkt ook op een iPad om mee rond te lopen. Het adres staat ook in het opstartvenster van de server en als knop op de beamer.
6. **Lesgeverscode:** op de laptop waar de server draait werkt het dashboard zonder code. Open je het op een ánder toestel (tablet, tweede laptop), dan vraagt het de code die in het zwarte servervenster staat. Zo kan een leerling zich niet via de browserconsole als lesgever voordoen.

Geen internet, geen accounts nodig: alles (ook Blockly) wordt lokaal geserveerd.

> **Staat deze map in OneDrive?** Klik dan met de rechtermuisknop op de map `tank-arena` en kies **Altijd op dit apparaat bewaren**. Anders kan OneDrive bestanden uit `node_modules` alleen in de cloud laten staan — en zonder internet in de klas start de server dan niet.

**Zien wat je programma doet.** Druk je op de groene vlag, dan licht elk blok dat uitgevoerd wordt geel op, zoals in Scratch. In een als-blok licht alleen de tak op die echt gekozen wordt (druk op ↑ en je ziet de ↑-tak oplichten). Een stapeltje zonder geel startblok erboven verbleekt, met een ⚠ die zegt waarom het niets doet. Verander je je blokken terwijl het programma loopt, dan knippert de groene vlag: de tank rijdt nog met het oude programma tot je opnieuw start.

**Samen spelen.** In de gedeelde arena krijgt wie achterop raakt een inhaalbonus (vormen ×1,5 tot level 15), draagt de leerling met de meeste punten een 👑 (wie hem verslaat krijgt dubbel), en groeit de arena mee als er meer dan twaalf leerlingen zijn. Een ronde kan gaan om punten of om **🏔 heuvel veroveren**: alleen jouw team op de cirkel in het midden levert punten op. Elke rake treffer geeft een tikje en een ✕ bij je mikpunt; een level omhoog een gouden ring rond je tank.

**Chromebooks én iPads.** Op een tablet zonder toetsenbord verschijnen vanzelf twee joysticks op het speelveld, zoals in de diep.io-app. De linker drukt dezelfde pijltjestoetsen in als een toetsenbord; de rechter is de muis (mikken, en schieten zolang je duwt). Tikken op het speelveld kan ook. De blokken uit de les werken dus ongewijzigd. Met de 🕹️-knop boven het speelveld zet je ze aan of uit (onthouden per toestel). Naast de opdracht staan **🔊 voorlezen** en **A+ grotere letters**, en de beamer toont een **QR-code** zodat een iPad het spel meteen opent. Met **🔧 Test dit toestel** (startmenu → meer opties) kijk je een iPad vooraf na. Te ver ingezoomd? De knop **🔍 Zoom** rechtsboven in het werkblad zet alles terug — al zoomt Safari niet meer per ongeluk in (ook niet bij het aantikken van een getal in een blok). Rechtop werkt ook: blokken boven, speelveld onder.

**Documenten:** [LESPLAN_LES1.md](docs/LESPLAN_LES1.md) (deel 1: stappen 1–10) · [LESPLAN_DEEL2.md](docs/LESPLAN_DEEL2.md) (deel 2: stappen 11–15 + toernooi) · [LESPLAN_LES2.md](docs/LESPLAN_LES2.md) (losse vervolgsessie: multiplayer + teams) · [VOORBEREIDING.md](docs/VOORBEREIDING.md) (checklist vóór de workshopdag) · [OPLOSSING.md](docs/OPLOSSING.md) (volledige voorbeeldcode voor de lesgever — ook in het spel via de knop **👩‍🏫 Voorbeeldoplossing**) · [ONLINE.md](docs/ONLINE.md) (het spel online zetten).

## Wat de leerling doet vs. wat het platform doet

| Leerling bouwt zelf (blokken) | Platform levert kant-en-klaar |
|---|---|
| **Alles, vanaf een leeg werkblad** — de les bestaat uit 15 stappen die élk beginnen met een probleem dat de leerling zelf oplost (zie [LESPLAN_LES1.md](docs/LESPLAN_LES1.md)) | Polygons diep.io-getrouw (vierkant 10 ptn, driehoek 25, vijfhoek 130, zeldzame zeshoek 1500 en alfa-vijfhoek 3000) + kapotschietbare muren als dekking |
| Besturing, richten, schieten, reacties, tellers, upgrade-strategie | AI-robots: 3 niveaus (makkelijk/gemiddeld/moeilijk) die meeschalen met de spelerscore en zwaardere robots meer punten waard maken |
| Elke stap heeft een **checkpoint** dat blokstructuur én werkend gedrag controleert | Score/XP/levels volgens de echte diep.io-tabel (level 15 bij 787 punten ≈ 6 vijfhoeken, level 30 bij 6184, level 45 bij 23 536), respawn als zwakkere tank |
| Upgrade-trigger + tactiek (als-dan, variabelen) | 8 statpunten diep.io-stijl in balken linksonder in beeld (levensregen, max levens, botsschade, kogelpantser, kogelschade, kogelsnelheid, herladen, snelheid — elk tot 7): klik op het plusje of toets 1-8 en speel gewoon door. Punten volgen het echte schema: elk level van 2 t/m 28, daarna om de drie levels tot 45 = **33 punten**, te weinig voor alles (8 × 7 = 56), dus kiezen is verplicht. Klassenboom: basis → lvl 15 → lvl 30 → lvl 45, met drie soorten munitie (kogels, drones, valstrikken) |
| Teamtactiek (les 2) | Multiplayer, teams (2/4, admin kiest), teamzones = veilige spawn-zones, geen friendly fire |

## Architectuur

```
tank-arena/
├── server.js          # start alles: webserver, verbindingen, de spel-lus
├── server/            # de autoritaire spelserver, per onderwerp — valideert alles
│   ├── regels.js         # spelregels en formules uit diep.io (levels, schade, snelheid)
│   ├── wereld.js         # arena's, teams, rondes, vormen, tanks
│   ├── robots.js         # de computertegenstanders
│   ├── spellus.js        # 30x per seconde: bewegen, schieten, botsen, raken
│   ├── verzenden.js      # 20x per seconde de wereld naar elke browser
│   ├── verbindingen.js   # wat een browser kan vragen (meedoen, rijden, bewaren)
│   ├── klaslokaal.js     # het lesgeversdashboard (overzicht, tips, ingrijpen, rapport)
│   ├── projecten.js      # projectcodes bewaren, met bewaartermijn
│   ├── toegang.js        # wie is lesgever (eigen laptop of lesgeverscode)
│   ├── staat.js          # wat alle onderdelen delen
│   └── versie.js, klok.js
├── test/              # "npm test": controleert server, lessen, blokken en pagina's
├── start.bat          # één dubbelklik om te starten
├── package.json       # afhankelijkheden (express, socket.io, Blockly vast op 11.2.2) en de commando's
│
├── docs/              # alles voor de lesgever
│   ├── VOORBEREIDING.md  # checklist vóór de workshopdag
│   ├── LESPLAN_LES1.md   # workshop deel 1: stappen 1-10
│   ├── LESPLAN_DEEL2.md  # workshop deel 2: stappen 11-15 + toernooi
│   ├── LESPLAN_LES2.md   # losse vervolgsessie: multiplayer & teams (6 eigen stappen)
│   ├── OPLOSSING.md      # het einddoel in blokken, met uitleg
│   └── ONLINE.md         # het spel online zetten (Render, VPS, one.com)
│
└── public/            # alles wat de browser laadt
    ├── index.html     # Scratch-layout: stappenpaneel + blokken links, live podium rechts
    ├── beamer.html    # groot scherm: arena, teamstand + spelersranglijst, teamknoppen
    ├── lesgever.html  # dashboard: klasoverzicht, stap sturen, bevriezen, blokken aanpassen
    ├── css/
    │   └── style.css
    └── js/
        ├── stappen.js    # de lesstappen (les 1 en les 2) + checkpoint-logica
        ├── blokken.js    # de blokken zelf (NL, Scratch-kleuren en -teksten)
        ├── compiler.js   # blokken → veilig JSON-programma (+ welke stapeltjes niets doen)
        ├── voorbeeld.js  # het lege startblad en de voorbeeldoplossing
        ├── editor.js     # de blokkeneditor: lade, oplichten, losse stapeltjes, uitleg
        ├── runtime.js    # Scratch-achtige interpreter in de browser (hats, forever, wacht,
        │                 # operators, variabelen) → stuurt alleen intents naar de server
        ├── spel-*.js     # het podium, in deze volgorde geladen: verbinding, menu, invoer,
        │                 # upgrades, tekenen, les, en spel-start (start alles pas als alles er is)
        ├── klassen.js    # diep.io-klassen + upgradeboom (gedeeld met de server)
        ├── tekenen.js    # gedeelde tekenfuncties (tanks, vormen, zones, arena)
        ├── joystick.js   # twee joysticks + spatieknop voor tablets (rijden = pijltjes, mikken = muis)
        ├── codetekst.js  # programma → leesbare tekst (voor projectie op de beamer)
        └── geluid.js     # korte geluidjes via WebAudio
```

**Veiligheid:** blokken worden nooit ge-evald; de compiler maakt er een JSON-programma van en de runtime interpreteert dat met een stappenbudget. De server valideert élke input (intents geklemd, namen gestript, upgrades alleen als je er recht op hebt) — spelers kunnen niet vals spelen via de console. De lesgeversfuncties (bevriezen, berichten, werkbladen overschrijven, teams) werken alleen vanaf de serverlaptop zelf of met de lesgeverscode. Een onverwachte fout legt de server niet meer plat: hij schrijft de fout in het zwarte venster en speelt door.

**Projecten:** de blokken van elke leerling worden automatisch bewaard in `projecten.json` (hooguit om de 1,5 seconde, en nog één keer als je het venster sluit). Een leeg werkblad overschrijft nooit een bestaand project: wie op een toestel komt waar al een project stond, krijgt in het startmenu de knop *"Verder met het project van …"* met de naam erbij.

**Privacy:** in `projecten.json` staan de voornamen van de leerlingen. Een project dat **90 dagen** niet meer gebruikt is, wist de server vanzelf (andere termijn: omgevingsvariabele `PROJECT_BEWAARDAGEN`, `0` = nooit wissen). Aan het eind van een lessenreeks wis je alles in één keer onderaan het 📋 klasrapport op het dashboard.

## Testen

```
npm test
```

Draait in ±50 seconden ruim 85 controles (Node 22 of nieuwer): de server zoals de browsers hem gebruiken (meedoen, rijden, projecten, elk dashboardcommando, bewaartermijn), alle 48 tankklassen in een echte arena, de spelregels, de runtime, en de lessen zelf — de voorbeeldoplossing moet elke stap van les 1 halen, en elk blok moet door compiler én runtime begrepen worden. De tests gebruiken een eigen, tijdelijk projectbestand: je echte `projecten.json` blijft onaangeroerd. Draai ze na elke aanpassing, en zeker vóór een les.

## Online zetten (optioneel, thuisspeel-link)

Werkt op elke Node-host (Render/Railway): build `npm ci`, start `node server.js`, poort via `process.env.PORT`. Zet de omgevingsvariabele `LESGEVER_SLEUTEL` op een zelfgekozen code, anders verzint de server bij elke start een nieuwe (die staat dan in de logs). Let op: iedereen met de link kan meespelen; er is bewust geen chat en namen zijn beperkt tot 16 tekens. Zie [ONLINE.md](docs/ONLINE.md).

## Roadmap (fase 3, latere sessies)

De blokkeneditor uitbouwen tot een volwaardige eigen mini-Scratch (meerdere sprites, costumes, generiek podium) waarin het tankspel één "project" is — herbruikbaar voor toekomstige STEMazing-workshops.
