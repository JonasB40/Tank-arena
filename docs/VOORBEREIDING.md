# ✅ Tank Arena — Voorbereidingschecklist (vóór de workshopdag)

Omdat we ons eigen platform gebruiken (geen scratch.mit.edu), vervalt het geregel met Scratch-accounts en cloud variables volledig. Wat er wél moet gebeuren:

## Minstens enkele dagen vooraf

- [ ] **Staat de map in OneDrive?** Klik met de rechtermuisknop op de map `tank-arena` → **Altijd op dit apparaat bewaren**. OneDrive laat anders bestanden die lang niet gebruikt zijn alleen in de cloud staan — en zonder internet in de klas start de server dan niet.
- [ ] **Node.js op je laptop** — staat het er? Dubbelklik `start.bat`; zie je "STEMazing Tank Arena draait!" dan is alles goed. Foutmelding "poort al in gebruik"? Sluit het andere zwarte venster.
- [ ] **Proefdraai op je eigen netwerk:** start de server, open op een tweede toestel (gsm werkt ook) het adres uit de console (bv. `http://192.168.x.x:3000`). Typ een naam, open **meer opties → 👩‍🏫 Voorbeeldoplossing**, klik ▶ Start de les en druk op 🚩. Rij rond met de pijltjes en schiet een vorm kapot. *(Het werkblad van een leerling begint leeg — zonder blokken doet de vlag niets, dat is de bedoeling van stap 1.)*
- [ ] **Dashboard testen:** open `http://localhost:3000/lesgever` op je laptop. Zie je je testleerling? Klik bij hem op **blokken**, sleep er een blok bij en klik **📤 stuur terug** — verschijnt de melding op het testtoestel?
- [ ] **Iets aangepast aan de code?** Typ `npm test` in een opdrachtvenster in de map. Na ±35 seconden moet er `fail 0` staan.
- [ ] **Beamerpagina testen:** open `http://localhost:3000/beamer` — zie je de arena, het scorebord en de teamknoppen (uit/2/4)?
- [ ] **Teams testen met 2 toestellen:** kies op beide **meer opties → 🏆 Les 2 — samen spelen**, en klik op de beamer "Teams: 2" → krijgen beide tanks een teamkleur en een zone?

## Op de locatie (vooraf te checken, niet op de dag zelf ontdekken!)

- [ ] **Zit jouw laptop op hetzelfde wifi-netwerk als de Chromebooks?** Dit is dé kritieke voorwaarde: leerlingen surfen rechtstreeks naar jouw laptop. Gasten-wifi's blokkeren soms onderling verkeer ("client isolation") — test dit ter plaatse met één Chromebook.
  - *Plan B als het netwerk blokkeert:* maak een hotspot met jouw gsm of een reisrouter en laat laptop + Chromebooks daarop aansluiten. Er is géén internet nodig — alles draait lokaal.
- [ ] **Wifi-belastingstest:** sluit 5+ toestellen tegelijk aan en laat ze samen spelen (Les 2 — samen spelen). Elke leerling krijgt twintig keer per seconde een gecomprimeerd pakketje van een paar KB; een volle klas van 25 in de arena komt samen op zo'n 10–15 Mbit/s. Dat kan elk degelijk accesspoint aan, maar een oud of overvol exemplaar kan haperen — dan zie je tanks verspringen.
- [ ] **Chromebooks:** browser opent gewoon het IP-adres, niets te installeren. Check wel of een schoolfilter lokale IP-adressen niet blokkeert.
- [ ] **iPads:** open het adres in Safari. Liggend werkt het best (blokken links, speelveld rechts). Zonder toetsenbord verschijnen er vanzelf **twee joysticks** op het speelveld: links rijden (met een knop **spatie** erboven), rechts mikken en schieten. Test één iPad vooraf: laad de voorbeeldoplossing, druk op 🚩 — rijdt de tank met de linker joystick, en mikt en schiet hij met de rechter? Heeft de iPad toch een toetsenbord en muis, dan zet je de joysticks uit met de 🕹️-knop boven het speelveld.
- [ ] **Windows-firewall:** vraagt Windows bij de eerste start om toegang voor Node.js? Vink "privénetwerken" aan en sta toe — anders kunnen de Chromebooks de server niet bereiken.

## De dag zelf (ochtendritueel, 10 min)

- [ ] Laptop aan het stroomnet + wifi, `start.bat` dubbelklikken.
- [ ] Adres uit de console groot op het bord schrijven.
- [ ] Beamer op `/beamer` (die toont het speeladres ook groot in beeld).
- [ ] Dashboard op `/lesgever`. Wil je het op een tablet of tweede toestel open hebben? Dan vraagt het de **lesgeverscode** uit het zwarte venster.
- [ ] Zelf 1 minuut proefspelen vanaf een Chromebook van de klas.
- [ ] Teams op **uit** laten staan voor les 1.
- [ ] **Na de les:** sluit het zwarte venster pas als de leerlingen klaar zijn. De server schrijft de projecten nog weg bij het sluiten, maar wie nog aan het bouwen is, verliest de laatste seconden.
- [ ] **Aan het eind van een lessenreeks:** dashboard → **📋 Rapport** → onderaan **🗑 Alle projecten nu wissen**. In de projecten staan de voornamen van de kinderen. Vergeet je het, dan wist de server een project vanzelf als het 90 dagen niet meer gebruikt is.

## Reserve-scenario's

| Probleem | Oplossing |
|---|---|
| Wifi valt weg tijdens de les | Gsm-hotspot starten; iedereen verbindt opnieuw; server draait gewoon door |
| "Poort al in gebruik" bij start | Ander zwart venster zoeken en sluiten, of laptop herstarten |
| Eén Chromebook doet raar | Pagina verversen (F5). Het werkblad is dan leeg, maar in het startmenu staat de knop **📂 Verder met het project van …** — één klik en alle blokken zijn terug. Daarna ▶ Start de les en de leerling klikt snel door de stappen die hij al had. |
| Leerling wist per ongeluk blokken | Meteen **Ctrl+Z**: dat zet ze terug. Was het 🗑 *Alles wissen*, dan is het bewaarde project na een paar seconden ook leeg — het kind bouwt de vorige stappen dan snel opnieuw op. |
| Leerling loopt vast op één blok | Dashboard → **blokken** bij die leerling, zelf het blok op zijn plek slepen, **📤 stuur terug**. De leerling kan met **↩** zijn eigen versie terugzetten. |
| Het dashboard vraagt een code | Je zit niet op de laptop van de server. Typ de lesgeverscode uit het zwarte venster. |
| Te weinig tijd | In deel 2 eerst stap 15 schrappen, dan stap 11 (zie [LESPLAN_DEEL2.md](LESPLAN_DEEL2.md)). Stap 13 en 14 en het toernooi houd je erin. |

## Wat NIET meer hoeft (t.o.v. het oorspronkelijke Scratch-plan)

- ~~Scratch-accounts aanmaken per leerling of per Chromebook~~
- ~~Cloud-variable-toegang testen met een bevestigd account~~
- ~~TurboWarp-alternatief onderzoeken~~
- ~~Internettoegang regelen~~ (alles draait lokaal op jouw laptop)
