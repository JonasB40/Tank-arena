# 🛡️ STEMazing Tank Arena

Een diep.io-geïnspireerd workshopspel voor leerlingen van 8–13 jaar. Leerlingen programmeren hun tank met een **Scratch-achtige blokkeneditor** (zelfde categorieën, kleuren en blokteksten als echt Scratch) en zien hem live reageren op het podium ernaast: bewegen met toetsen, geschut dat naar de muis richt, vormen en muren kapotschieten, levelen, klassen kiezen uit de echte diep.io-upgradeboom en (les 2) live multiplayer met teams.

## Snel starten

1. Zorg dat [Node.js](https://nodejs.org) geïnstalleerd is.
2. Dubbelklik **start.bat** (installeert de eerste keer automatisch de pakketten).
3. De console toont het adres voor de leerlingen, bv. `http://192.168.68.102:3000`.
4. Beamer: `http://localhost:3000/beamer` — hele arena, scorebord, speeladres én de teamknoppen (uit/2/4) voor les 2.
5. **Lesgeversdashboard: `http://localhost:3000/lesgever`** — klasoverzicht (wie is klaar, wie zit vast, welk vinkje nog ontbreekt), leerlingen die ✋ hun hand opsteken, tips sturen naar één leerling of de hele klas, iemand apart een stap vooruit of terug zetten, zijn werkblad opruimen, de klas centraal sturen, ⏸ alles bevriezen, teams instellen, de blokken van een leerling live volgen en 📋 een klasrapport achteraf. Het adres staat ook in het opstartvenster van de server en als knop op de beamer.

Geen internet, geen accounts nodig: alles (ook Blockly) wordt lokaal geserveerd.

**Documenten:** [LESPLAN_LES1.md](docs/LESPLAN_LES1.md) (kern, 2,5u) · [LESPLAN_LES2.md](docs/LESPLAN_LES2.md) (multiplayer + teams, 2,5u) · [VOORBEREIDING.md](docs/VOORBEREIDING.md) (checklist vóór de workshopdag) · [OPLOSSING.md](docs/OPLOSSING.md) (volledige voorbeeldcode voor de lesgever — ook in het spel via de knop **👩‍🏫 Voorbeeldoplossing**).

## Wat de leerling doet vs. wat het platform doet

| Leerling bouwt zelf (blokken) | Platform levert kant-en-klaar |
|---|---|
| **Alles, vanaf een leeg werkblad** — de les bestaat uit 15 stappen die élk beginnen met een probleem dat de leerling zelf oplost (zie [LESPLAN_LES1.md](docs/LESPLAN_LES1.md)) | Polygons diep.io-getrouw (vierkant 10 ptn, driehoek 25, vijfhoek 130, zeldzame zeshoek 1500 en alfa-vijfhoek 3000) + kapotschietbare muren als dekking |
| Besturing, richten, schieten, reacties, tellers, upgrade-strategie | AI-robots: 3 niveaus (makkelijk/gemiddeld/moeilijk) die meeschalen met de spelerscore en zwaardere robots meer punten waard maken |
| Elke stap heeft een **checkpoint** dat blokstructuur én werkend gedrag controleert | Score/XP/levels (steilere curve: level 15 ≈ 1400 XP), respawn als zwakkere tank |
| Upgrade-trigger + tactiek (als-dan, variabelen) | 8 statpunten diep.io-stijl in balken linksonder in beeld (levensregen, max levens, botsschade, kogelpantser, kogelschade, kogelsnelheid, herladen, snelheid — elk tot 7): klik op het plusje of toets 1-8 en speel gewoon door. Punten volgen het echte schema: elk level van 2 t/m 28, daarna om de drie levels tot 45 = **33 punten**, te weinig voor alles (8 × 7 = 56), dus kiezen is verplicht. Klassenboom: basis → lvl 15 → lvl 30 → lvl 45, met drie soorten munitie (kogels, drones, valstrikken) |
| Teamtactiek (les 2) | Multiplayer, teams (2/4, admin kiest), teamzones = veilige spawn-zones, geen friendly fire |

## Architectuur

```
tank-arena/
├── server.js          # autoritaire spelserver: rooms (solo per leerling / gedeelde arena),
│                      # vormen, AI, kogels, XP/levels, upgrades, teams — valideert alles
├── start.bat          # één dubbelklik om te starten
├── package.json       # afhankelijkheden (express + socket.io) en het startcommando
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
    ├── lesgever.html  # dashboard: klasoverzicht, stap sturen, bevriezen, code tonen
    ├── css/
    │   └── style.css
    └── js/
        ├── stappen.js    # de lesstappen (les 1 en les 2) + checkpoint-logica
        ├── editor.js     # Blockly-blokken (NL, Scratch-kleuren) + compiler naar veilig JSON
        ├── runtime.js    # Scratch-achtige interpreter in de browser (hats, forever, wacht,
        │                 # operators, variabelen) → stuurt alleen intents naar de server
        ├── game.js       # podium: tekenen, HUD, startmenu, upgrade-pop-ups
        ├── klassen.js    # diep.io-klassen + upgradeboom (gedeeld met de server)
        ├── tekenen.js    # gedeelde tekenfuncties (tanks, vormen, zones, arena)
        ├── codetekst.js  # programma → leesbare tekst (voor projectie op de beamer)
        └── geluid.js     # korte geluidjes via WebAudio
```

**Veiligheid:** blokken worden nooit ge-evald; de compiler maakt er een JSON-programma van en de runtime interpreteert dat met een stappenbudget. De server valideert élke input (intents geklemd, namen gestript, upgrades alleen als je er recht op hebt) — spelers kunnen niet vals spelen via de console.

## Online zetten (optioneel, thuisspeel-link)

Werkt op elke Node-host (Render/Railway): build `npm install`, start `node server.js`, poort via `process.env.PORT`. Let op: iedereen met de link kan meespelen; er is bewust geen chat en namen zijn beperkt tot 16 tekens.

## Roadmap (fase 3, latere sessies)

De blokkeneditor uitbouwen tot een volwaardige eigen mini-Scratch (meerdere sprites, costumes, generiek podium) waarin het tankspel één "project" is — herbruikbaar voor toekomstige STEMazing-workshops.
