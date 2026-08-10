# 🌐 Tank Arena online zetten (Render, gratis)

Zo krijg je een vaste URL (bv. `https://stemazing-tanks.onrender.com`) om collega's te laten testen of als thuisspeel-link na de workshop. Duurt ±15 minuten.

## Stap 1 — Zet de map op GitHub

1. Maak op [github.com](https://github.com) een nieuwe repository, bv. `stemazing-tank-arena` (privé mag).
2. In een terminal in de map `tank-arena`:
   ```
   git init
   git add .
   git commit -m "Tank Arena"
   git branch -M main
   git remote add origin https://github.com/JOUWNAAM/stemazing-tank-arena.git
   git push -u origin main
   ```
   De `.gitignore` zorgt dat `node_modules` en de projectcodes-opslag niet meegaan.

## Stap 2 — Maak de Render-service

1. Account op [render.com](https://render.com) (inloggen met GitHub is het makkelijkst).
2. **New → Web Service** → kies je repository.
3. Instellingen:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Instance type:** Free
4. Klik **Deploy**. Na een paar minuten krijg je je vaste URL.

## Stap 3 — Testen

- Open de URL: het startmenu verschijnt, kies "Tegen de computer" en speel even.
- Beamer/scorebord: `https://jouw-url.onrender.com/beamer` (teams werken daar ook).

## Goed om te weten (gratis plan)

- **Slaapstand:** na ±15 min zonder bezoekers valt de server in slaap; de eerste bezoeker wacht dan ±30–60 sec. Voor een workshopdag: open de URL 's ochtends even.
- **Projectcodes zijn daar niet blijvend:** de schijf van het gratis plan wordt gewist bij elke redeploy of herstart. Voor de workshop zelf draai je sowieso lokaal (start.bat) — daar blijven codes wél bewaard in `projecten.json`.
- **Workshop = lokaal:** de online versie is voor thuis/demo. In de klas blijft jouw laptop de server: sneller, geen internet nodig, projectcodes blijven werken tussen les 1 en les 2.
- **Updaten:** nieuwe versie online zetten = gewoon `git add . && git commit -m "update" && git push` — Render deployt automatisch.

---

## Kan dit op mijn one.com-hosting?

**Op de gewone webhosting van one.com: nee.** Die draait Apache met PHP en MariaDB — bedoeld voor websites die bij elke klik een PHP-pagina opbouwen. Tank Arena is iets anders: het is een **programma dat blijft draaien**. Het rekent 30 keer per seconde de hele arena door (robots, kogels, vormen) en houdt via een open verbinding (WebSocket) contact met elke leerling. Daar heb je drie dingen voor nodig die gedeelde webhosting niet geeft:

| Nodig | Waarom |
|---|---|
| **Node.js 18 of hoger** | de server is in JavaScript geschreven (`express` + `socket.io`) |
| **Een proces dat blijft draaien** | de spelwereld leeft in het geheugen; valt het proces stil, dan is de arena weg |
| **WebSockets** | elke leerling houdt een open verbinding voor posities en schoten |

Je kan de map dus niet zomaar met FTP naar one.com kopiëren: er is daar niets dat `node server.js` start.

**Met een VPS van one.com: ja.** Een (unmanaged) Linux-VPS geeft je root-toegang en draait Node.js. Daar zet je het spel op zoals hierboven bij Render: repository klonen, `npm install`, `node server.js`, en een reverse proxy ervoor. Let op dat de *managed* VPS standaard met een PHP-stack komt — daar moet je Node zelf op zetten.

### Hoeveel leerlingen kan dat aan?

Gemeten op deze code: **één spelende leerling in zijn eigen arena kost ongeveer 2% van één processorkern en het geheugen blijft rond de 63 MB.** In les 1 heeft elke leerling zijn éígen arena, dus een klas van 20 komt op grofweg een halve kern. In de gedeelde arena van les 2 zitten ze samen in één wereld en valt het nog lager uit. De server laat maximaal 40 spelers tegelijk toe (`MAX_SPELERS`). Zelfs de kleinste VPS heeft daar genoeg aan; het knelpunt wordt eerder de wifi in het lokaal dan de server.

### Twee dingen om te weten als je hem publiek zet

- **Er is geen slot op de deur.** Iedereen die de URL heeft, kan meedoen en komt in dezelfde gedeelde arena. Prima voor een klas, minder prettig als het adres rondslingert.
- **Projectcodes staan in een bestand** (`projecten.json`) naast de server. Op een VPS blijft dat gewoon staan; op een gratis plan bij Render is het weg na elke herstart.

> **Voor de workshop zelf blijft lokaal de beste keuze:** `start.bat` op jouw laptop, leerlingen op het adres uit de console. Geen internet nodig, de snelste verbinding, en de projectcodes blijven tussen les 1 en les 2 bewaard.
