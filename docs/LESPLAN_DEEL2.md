# 🛡️ Tank Arena — Deel 2: van "hij werkt" naar "hij is van mij" (±90 min)

**Vertrekpunt:** deel 1 is klaar (stappen 1–10). Elke leerling heeft een tank die rijdt, richt, schiet, zijn levens telt en om hulp roept. **Resultaat:** die tank krijgt karakter, rekent zelf, kiest zelf zijn upgrades — en gaat het toernooi in.

> Deel 2 zit gewoon in dezelfde app, als stappen **11 t/m 15**. Er is niets extra te installeren. Wie in deel 1 nog niet klaar was, werkt gewoon verder — jouw dashboard toont waar iedereen zit.

---

## Waarom deze vijf stappen

Deel 1 leerde de vier bouwstenen (volgorde, herhaling, keuze, variabele). Deel 2 gaat niet bréder maar dieper: dezelfde bouwstenen, maar nu zet de leerling ze in om **zijn eigen ontwerp** te maken in plaats van een opdracht af te werken.

| Stap | Het probleem | Nieuw concept |
|---|---|---|
| 11 | "Alle tanks zien er hetzelfde uit" | je eigen uiterlijk |
| 12 | "Mijn tank reageert nergens op" | meerdere gebeurtenissen naast elkaar |
| 13 | "Hoe sterk ben ik eigenlijk?" | **rekenen** met variabelen |
| 14 | "Ik moet elke keer zelf kiezen" | **beslisboom** |
| 15 | "Ik sta stil zodra ik schiet" | wachten blokkeert één stapeltje |

**Stap 13 vult een echt gat:** de groene rekenblokken (`+ − × ÷`) kwamen in heel deel 1 niet voor. Hier ontdekken leerlingen dat een variabele niet alleen kán tellen, maar ook de uitkomst van een som kan bewaren.

---

## Lesverloop

### 1:30–1:45 · Pauze

### 1:45–1:52 · Stap 11: geef je tank een eigen kleur

Zacht startpunt na de pauze — iederéén slaagt hier, ook wie in deel 1 achterliep. `zet kleur op […]` komt ónder het 🚩-blok maar bóven de herhaal-lus: de kleur wordt één keer gezet, niet dertig keer per seconde.

**🔬 Stukmaken:** sleep het kleur-blok ín de herhaal-lus. Ziet je tank er anders uit? En waarom is dat zonde van het werk dat de computer doet?

> 💡 Loop even rond en laat ze elkaars tank zien. Dit is het moment waarop het "hun" spel wordt.

### 1:52–2:02 · Stap 12: laat je tank reageren

Ze bouwen twee **losse** stapeltjes: `wanneer ik iemand versla → zeg [gepakt!]` en `wanneer ik kapot ga → flits rood`. **Het inzicht:** je mag zoveel gebeurtenissen naast elkaar zetten als je wil, elk met hun eigen reactie, en ze wachten allemaal rustig op hún moment.

Dat die stapeltjes nergens aan vastzitten voelt voor veel kinderen fout. Benoem het expliciet: elk gebeurtenisblok is de start van een eigen programmaatje, herkenbaar aan de ronde bovenkant.

**🔬 Stukmaken:** laat ze *wanneer ik kapot ga* nabouwen met wat ze al kennen: `herhaal → als <mijn levens = 0> dan flits rood`. Meestal werkt dat niet — je levens springen van 3 naar onder nul en na de respawn meteen weer omhoog, dus dat ene moment van precies 0 mis je bijna altijd. **Dáárom** geeft het spel je een gebeurtenis: die komt gegarandeerd aan.

### 2:02–2:17 · Stap 13: hoe sterk ben ik? *(kernstap)*

Ze maken een variabele `kracht` en berekenen die zelf:
`kracht = (kogelschade × 2) + kogelsnelheid`

**Benoem expliciet** dat dit getal niet bestaat in het spel — zij verzinnen het. Dat is wat programmeurs doen: iets meten wat nog niemand meet.

Het bouwen van een som uit twee rekenblokken (een blok ín een blok) is nieuw en lastig. Bouw het klassikaal voor op de beamer, blokje per blokje.

**🔬 Stukmaken:** verander × 2 in × 10. Het getal springt omhoog — maar je tank is niets sterker geworden. *Een getal dat je zelf verzint, is maar zo slim als jouw formule.*

> ⚠ Aan het begin staat `kracht` op 0, want hun stats zijn nog 0. Dat is juist een mooi startpunt: laat ze eerst een paar polygons kapotschieten en dan opnieuw kijken.

### 2:17–2:29 · Stap 14: je upgrade-plan

`wanneer ik een statpunt krijg` → `als kogelschade < 5 dan geef punt aan kogelschade, anders aan snelheid`.

Hier wordt het statsysteem voor het eerst iets dat ze zélf besturen in plaats van een pop-up die ze wegklikken. Laat twee leerlingen met een verschillend plan tegen elkaar spelen — wiens plan wint?

**🔬 Stukmaken:** zet de 5 op 0. Naar welke stat gaat nu élk punt? Waarom komt de andere kant nooit meer aan de beurt?

### 2:29–2:36 · Stap 15: het salvo

`herhaal 3 keer → schiet + wacht 0,2 sec.` — maar in een **eigen stapeltje**, niet in de besturingslus.

Twee inzichten tegelijk. Het verschil tussen de lussen: de eeuwige lus stopt nooit, de tellus telt af en stopt. En: een `wacht`-blok pauzeert het héle stapeltje waar het in zit. Zet je het salvo in je besturing, dan sta je stil zodra je schiet. Losse stapeltjes draaien wél tegelijk.

**🔬 Stukmaken:** sleep het schiet-stapeltje terug ín de besturingslus. Rijd en schiet tegelijk: voel je hoe de tank hapert?

### 2:36–2:52 · 🏆 Het teamtoernooi

- Iedereen kiest in het startmenu onder *meer opties* → **🧑‍🤝‍🧑 Tegen klasgenoten**. Die knop verschijnt pas als hun tank kan rijden, dus wie stap 4 haalde kan mee. Jij zet op de beamer (`/beamer`) **Teams: 2** (of 4 bij een grote groep).
- **Ronde 1** (5 min) — vechten, live scorebord op de beamer.
- **⏸ Ogen op mij + 2 min bouwtijd.** *"Wat ging er mis? Pas één ding aan."* Dit is het belangrijkste moment van het toernooi: itereren op je eigen ontwerp.
- **Ronde 2** (5 min) — finale.

### 2:52–3:00 · Afsluiting

Winnend team op de beamer, applaus. Daarna kort per concept: *waar zat vandaag de herhaling? Welke som heb jij verzonnen? Wat was jouw upgrade-plan — en werkte het?*

Afsluiter: *alles wat jullie vandaag deden — volgorde, herhalen, keuzes, onthouden, rekenen — is precies wat professionele gamemakers doen. Alleen hun spellen zijn groter.*

---

## Wat de app zelf controleert

| Stap | Structuurcheck | Gedragscheck |
|---|---|---|
| 11 | een `zet kleur`-blok onder je 🚩 | de tank heeft een eigen kleur gekregen |
| 12 | twee stapeltjes die elk op een eigen gebeurtenis reageren | *(geen — uitproberen in de arena)* |
| 13 | een `maak`-blok met een rekensom erin | het getal wordt berekend |
| 14 | statpunt-gebeurtenis met een als-dan die punten uitdeelt | het plan deelde zelf een punt uit |
| 15 | `herhaal ( ) keer` met `schiet` erin, in een stapeltje **zonder** stuurblokken | er is een salvo afgevuurd |

> Stap 14's gedragsvinkje wordt pas groen bij een echte levelup. Wie snel klaar is maar nog geen level omhoog ging: laat hem polygons schieten — dat is meteen goede oefening.

---

## Als je tijd tekort komt

Schrap in deze volgorde: **stap 15** (leuk maar het minst essentieel) → **stap 11** (kan ook thuis/als opdrachtkaart). **Stap 13 en 14 zijn de inhoudelijke kern van deel 2** — die hou je erin. Het toernooi schrap je nooit; dat is de beloning waar ze drie uur voor gewerkt hebben.

> Deel 2 heeft nu vijf stappen in 50 minuten en een toernooi van 16. Signalen zijn bewust naar [les 2](LESPLAN_LES2.md) verhuisd: daar hebben ze de ruimte, en deel 2 was met zes stappen te vol.

## ⭐⭐ Bonusopdracht — word een andere tank *(vanaf level 15)*

Net als in diep.io verandert je tank van vorm zodra je sterk genoeg bent. Maar hier klik je dat niet weg in een pop-up: **je programmeert het zelf.**

```
herhaal
   als <mijn level ⬆️  >  14> dan
      verander uiterlijk naar [Sluipschutter ▾]
```

> ⚠ **Let op de 14, niet de 15.** Er bestaat geen "groter dan of gelijk aan"-blok, alleen `>`. En `level > 15` is pas waar vanaf level 16 — wie precies 15 is, zou dan niets zien gebeuren. Dit is een prachtig klassikaal moment: laat ze eerst 15 invullen, laat het misgaan, en vraag waarom. Zo'n foutje van eentje heet een *off-by-one* en is een van de meest gemaakte fouten in de programmeerwereld.

De vier vormen en wat ze doen:

| Vorm | Kanon | Goed voor |
|---|---|---|
| **Twin** | twee lopen | veel kogels, breed vuren |
| **Sluipschutter** | één lange loop | ver en hard schieten |
| **Machinegeweer** | brede loop | heel snel vuren, wel minder schade |
| **Flankwacht** | voor én achter | wie je achtervolgt, krijgt ook wat |

> 💡 Dit is jullie versie van Scratch' *"verander uiterlijk naar …"*. Het blok staat in de paarse categorie **Uiterlijken**.

**Waarom dit een sterke opdracht is:** het gebruikt de variabele `mijn level` én een operator (`>`) in één als-dan — precies de combinatie uit stap 10 en 13, maar nu met een beloning die ze meteen zíen. En omdat het pas vanaf level 15 werkt, moeten ze eerst vormen kapotschieten: level 15 kost ±1400 punten, ongeveer 11 vijfhoeken.

**🔬 Stukmaken:** zet de 14 op 1. Verandert je tank nu meteen? *(Nee — het spel laat het pas toe vanaf level 15, hoe je het ook programmeert. De computer mag niet alles wat jij vraagt.)* Dat is een mooi gespreksmoment over waarom een spel niet alles vertrouwt wat jouw programma vraagt.

## Voor wie snel klaar is

De opdrachtkaarten uit [LESPLAN_LES1.md](LESPLAN_LES1.md) staan nog open, en met 🚀 **Expert** aan komen er extra blokken bij (auto-aim, `raak ik …?`, `wacht tot`). Kaart 5 en 6 sluiten perfect aan op stap 14.
