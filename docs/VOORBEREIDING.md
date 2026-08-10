# ✅ Tank Arena — Voorbereidingschecklist (vóór de workshopdag)

Omdat we ons eigen platform gebruiken (geen scratch.mit.edu), vervalt het geregel met Scratch-accounts en cloud variables volledig. Wat er wél moet gebeuren:

## Minstens enkele dagen vooraf

- [ ] **Node.js op je laptop** — staat het er? Dubbelklik `start.bat`; zie je "STEMazing Tank Arena draait!" dan is alles goed. Foutmelding "poort al in gebruik"? Sluit het andere zwarte venster.
- [ ] **Proefdraai op je eigen netwerk:** start de server, open op een tweede toestel (gsm werkt ook) het adres uit de console (bv. `http://192.168.x.x:3000`). Kies "Tegen de computer", druk 🚩, rij rond, schiet een vorm kapot.
- [ ] **Beamerpagina testen:** open `http://localhost:3000/beamer` — zie je de arena, het scorebord en de teamknoppen (uit/2/4)?
- [ ] **Teams testen met 2 toestellen:** beide "Tegen klasgenoten", op de beamer "Teams: 2" klikken → krijgen beide tanks een teamkleur en een zone?

## Op de locatie (vooraf te checken, niet op de dag zelf ontdekken!)

- [ ] **Zit jouw laptop op hetzelfde wifi-netwerk als de Chromebooks?** Dit is dé kritieke voorwaarde: leerlingen surfen rechtstreeks naar jouw laptop. Gasten-wifi's blokkeren soms onderling verkeer ("client isolation") — test dit ter plaatse met één Chromebook.
  - *Plan B als het netwerk blokkeert:* maak een hotspot met jouw gsm of een reiservouter en laat laptop + Chromebooks daarop aansluiten. Er is géén internet nodig — alles draait lokaal.
- [ ] **Wifi-belastingstest:** sluit 5+ toestellen tegelijk aan en laat ze samen spelen ("Tegen klasgenoten"). Ons verkeer is licht (kleine berichtjes, 20×/sec), maar zwakke accesspoints kunnen bij 15+ toestellen haperen.
- [ ] **Chromebooks:** browser opent gewoon het IP-adres, niets te installeren. Check wel of een schoolfilter lokale IP-adressen niet blokkeert.
- [ ] **Windows-firewall:** vraagt Windows bij de eerste start om toegang voor Node.js? Vink "privénetwerken" aan en sta toe — anders kunnen de Chromebooks de server niet bereiken.

## De dag zelf (ochtendritueel, 10 min)

- [ ] Laptop aan het stroomnet + wifi, `start.bat` dubbelklikken.
- [ ] Adres uit de console groot op het bord schrijven.
- [ ] Beamer op `/beamer` (die toont het speeladres ook groot in beeld).
- [ ] Zelf 1 minuut proefspelen vanaf een Chromebook van de klas.
- [ ] Teams op **uit** laten staan voor les 1.

## Reserve-scenario's

| Probleem | Oplossing |
|---|---|
| Wifi valt weg tijdens de les | Gsm-hotspot starten; iedereen verbindt opnieuw; server draait gewoon door |
| "Poort al in gebruik" bij start | Ander zwart venster zoeken en sluiten, of laptop herstarten |
| Eén Chromebook doet raar | Pagina verversen (F5) — de leerling kiest opnieuw zijn modus, blokken van het sjabloon staan er weer |
| Leerling wist per ongeluk zijn blokken | Sjabloon komt terug bij verversen; opgebouwde score is wel weg (leerzaam momentje 😉) |
| Te weinig tijd in les 1 | Bouwblok 4 (upgrades) inkorten: alleen `wanneer ik level omhoog ga → toon upgrade-keuze`, expertdeel schrappen |

## Wat NIET meer hoeft (t.o.v. het oorspronkelijke Scratch-plan)

- ~~Scratch-accounts aanmaken per leerling of per Chromebook~~
- ~~Cloud-variable-toegang testen met een bevestigd account~~
- ~~TurboWarp-alternatief onderzoeken~~
- ~~Internettoegang regelen~~ (alles draait lokaal op jouw laptop)
