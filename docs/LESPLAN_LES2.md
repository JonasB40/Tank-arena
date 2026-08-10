# 🛡️ Tank Arena — Lesplan Les 2: live multiplayer & teams (2,5 uur)

**Vertrekpunt:** de leerlingen hebben les 1 gevolgd (besturing, schieten, reacties en upgrades zelf gebouwd). **Resultaat:** tot 10+ leerlingen spelen live samen in één arena, in 2 of 4 teams met veilige teamzones, zichtbaar op de beamer.

## Technische noot (voor de lesgever)

In het oorspronkelijke Scratch-plan zou multiplayer via cloud variables met cijfer-encoding lopen (alles in één getal proppen wegens de limiet van 10 cloud variables). **Op ons eigen platform is dat niet nodig:** de server kent elke speler apart en er is geen spelerslimiet van 10. De encoding-denkoefening houden we wél als leuke klasoefening (zie 1:15), want het idee — meerdere getallen samenpakken in één getal met plaatswaarde — is een mooi rekeninzicht.

**Adminrol:** jij bent de admin. Op de beamerpagina (`/beamer`) staan de teamknoppen **uit / 2 / 4** — jij kiest de teamopzet per sessie, leerlingen niet.

---

## Lesverloop (150 min)

### 0:00–0:10 · Opfrissing

Iedereen opent zijn spel en haalt zijn blokken van les 1 terug met zijn **projectcode** (TANK-XXXX, in het startmenu → "📂 Haal mijn project op"; op hetzelfde toestel staat de code al ingevuld). Daarna "Tegen de computer" en op 🚩 drukken. Snelle quiz: *welke bouwsteen zit waar in jouw programma?* (herhaling van de 4 concepten uit les 1).

### 0:10–0:30 · Van solo naar samen (klassikaal moment!)

- Leg uit: tot nu speelde iedereen in zijn **eigen** arena. Nu gaan we naar **één gedeelde wereld**: jouw computer stuurt continu kleine berichtjes ("ik sta hier, ik kijk daarheen, ik schiet") naar de server, en krijgt de posities van iedereen terug. *Invoer en uitvoer, maar dan over het netwerk!*
- Iedereen kiest in het startmenu onder *meer opties* → **🏆 Les 2 — samen spelen** (of meteen **2 teams** / **4 teams**). Rijden en schieten werkt daar zonder blokken.
- Beamer op `/beamer`: alle tanks samen zichtbaar. **Wauw-moment.** 5 minuten vrij vechten.

### 0:30–0:50 · Je programma aanpassen voor multiplayer

> **In de app:** dit zijn **stap 1 en 2 van les 2**. De leerling kiest in het startmenu onder *meer opties* → **🏆 Les 2 — samen spelen**. Hij krijgt dan een eigen stappenreeks van 6 (*Stap 1/6*), begint automatisch in de gedeelde arena, en alle blokken van les 1 staan al klaar. De vinkjes werken net als in les 1.
>
> **Ook zonder teams is er een veilige thuisbasis**: de gestreepte hoek linksonder in de arena, net als in les 1. Daar kunnen robots niet in en genees je snel. Zet jij op de beamer teams aan, dan nemen de teamzones het over en verdwijnt die gedeelde hoek — anders zou het team dat er toevallig woont gratis kunnen schuilen.
>
> **De robots schalen mee met de klas, niet met de sterkste**: in de gedeelde arena kijkt de server naar het gemiddelde level, en nooit meer dan vier levels boven de zwakste speler. Een leerling die om 14u binnenkomt terwijl de rest al een uur speelt, loopt dus niet meteen tegen level-30-robots aan.
>
> **Rijden en schieten werkt in les 2 meteen**, zonder dat daar blokken voor op het werkblad staan: pijltjes om te rijden, muis om te mikken en te schieten. Dat hebben ze in les 1 geleerd; hier gaat het over tactiek, en hun werkblad blijft leeg voor de nieuwe opdrachten. Bouwt een leerling tóch eigen stuurblokken, dan winnen die — de basisbesturing vult alleen aan wat zijn eigen programma niet doet.

Tegen echte klasgenoten heb je slimmere reacties nodig dan tegen robots.

- **Stap 1 — "Ik zie ze te laat":** `herhaal → als <afstand tot dichtstbijzijnde vijand < 200> dan zeg [pas op!]`. Het waarnemen-blok *afstand tot vijand* werkt nu op échte klasgenoten: hun posities komen van de server. **🔬 Stukmaken:** zet de 200 op 2000 — de halve arena is dan "dichtbij".
- **Stap 2 — "Mijn beloning staat overal apart" *(signalen)*:** `wanneer ik iemand versla → zend signaal [bonus]`, en een ápart stapeltje `wanneer ik signaal [bonus] ontvang → verander teampunten met 50 + geluid + flits`. Dit is Scratch' *bericht*: het ene stapeltje roept, het andere luistert. Zo staat je beloning op één plek en kan je hem straks ook bij een andere gebeurtenis oproepen. **🔬 Stukmaken:** verander de naam in één van de twee blokken — verslaan werkt nog, de beloning blijft weg.

**✅ Test:** speel 2 tegen 2 met je buren en kijk of je reacties afgaan.

### 0:50–1:00 · Pauze

### 1:00–1:15 · Teams aan! (admin-moment)

- Jij klikt op de beamer **Teams: 2** (of 4 bij een grote groep). Iedereen wordt automatisch verdeeld, krijgt zijn **teamkleur** en respawnt in zijn **teamzone** (gestreepte gekleurde zone).
- Leg de regels uit: *in je eigen zone ben je onschendbaar (veilige spawn-zone), teamgenoten kunnen elkaar géén schade doen, en het team met de meeste punten wint.*

De twee opstellingen zijn dezelfde als in diep.io:

| | Teams | Zones | Speelt als |
|---|---|---|---|
| **2 teams** | 🔵 blauw vs 🔴 rood | twee brede stroken, links en rechts | frontlijn: je weet altijd waar de vijand vandaan komt |
| **4 teams** | 🔵 🔴 🟢 🟣 | vier vierkanten in de hoeken | chaos: je kan van drie kanten aangevallen worden |

> In het startmenu staan onder *meer opties* → **Volgende les** drie startknoppen: **Les 2 zonder teams**, **met 2 teams** en **met 4 teams**. De teamkeuze zit dus in de startknop zelf. Zet jij op de beamer om van 2 naar 4, dan ziet iedereen dat meteen in beeld verschijnen — jouw keuze wint altijd.

### 1:15–1:30 · Denkoefening: hoe zou Scratch dit doen? (zonder computer)

Klasgesprek over het encoding-idee: *stel dat je maar één getal mag doorsturen — hoe stop je er dan x (0–999), y (0–999), team (0–3) én score in?* Bouw samen op het bord: `getal = x × 1.000.000 + y × 1.000 + team × 250 + ...` en haal het er weer uit met delen en rest. Koppel terug: *dit is verwerking — en zo werken computers écht als ruimte schaars is.*

### 1:30–1:50 · Stap 3 t/m 6: overleven, je rol kiezen en de stand volgen

De laatste vier stappen in de app bereiden het toernooi voor. Ze introduceren elk één nieuw idee.

- **Stap 3 — "Ik blijf te lang buiten":** twee voorwaarden combineren met {`en`} en {`niet`}: *als ik NIET in mijn basis ben EN mijn levens < 40 → zeg [naar huis!] + flits rood*. Eerste keer dat ze `en`/`niet` echt nodig hebben. **🔬 Stukmaken:** haal `niet` weg — het alarm gaat nu net af als je veilig staat.
- **Stap 4 — "Ik ren te vroeg de zone weer uit":** `wacht tot <mijn levens < 40>` → melden → `wacht tot <mijn levens > 80>` → melden. Nieuw idee: de computer laten wáchten op een voorwaarde in plaats van er telkens naar te vragen. **🔬 Stukmaken:** zet het in de besturingslus — je tank staat stil zolang hij wacht.
- **Stap 5 — "Aanvaller, verdediger of allrounder?":** een als-dan-anders ín een als-dan-anders, zodat het upgrade-plan drie kanten op kan. Laat ze de rollen in hun team verdelen — vier dezelfde rollen verliest meestal van een gemengd team.

- **Stap 6 — "Sta ik eigenlijk wel goed?":** `achterstand = score van de beste speler − mijn score`, plus `als mijn plaats in de ranglijst = 1 dan zeg [ik sta eerste!] anders zeg [ik kom eraan!]`. Twee nieuwe waarnemen-blokken die over de héle klas gaan in plaats van over de eigen tank. Robots tellen niet mee in die ranglijst. **🔬 Stukmaken:** haal het `wacht`-blok weg — hij roept nu dertig keer per seconde en je leest niet eens meer wát hij roept.

> Alle zes de stappen vragen echt nieuw werk: een les-1 project haalt er geen enkele van. Dat is nagemeten, niet gehoopt.

### 1:50–2:10 · 🏆 Het grote teamtoernooi

- Ronde 1 (10 min): teams vechten, de beamer toont bovenaan de **teamstand** in teamkleur (met 👑 bij de leider) en daaronder de spelers. Robots staan er niet tussen. Tussen de rondes: **2 min bouwtijd** om blokken bij te stellen (iteratie!).
- Ronde 2 (10 min): nieuwe tactiek toegestaan — wie bouwt een "verdediger" (blijft bij de zone, pantser 8) en wie een "aanvaller" (snelheid 8, booster)?
- Ronde 3 (10 min): finale. Eventueel wissel je van 2 naar 4 teams voor chaos-plezier.

### 2:10–2:30 · Afsluiting & reflectie

- Winnend team op de beamer, applaus.
- Reflectie per concept: *waar zat vandaag de als-dan? welke variabelen kwamen erbij (team, afstand)? wat was de invoer/uitvoer over het netwerk?*
- Afsluiter: *alles wat jullie in twee lessen deden — volgorde, herhalen, keuzes, onthouden — is precies wat professionele gamemakers doen. Alleen hun spellen zijn groter.*

---

## Wat de app zelf controleert (les 2)

| Stap | Structuurcheck | Gedragscheck |
|---|---|---|
| 1 | een als-blok dat de `afstand tot een vijand` vergelijkt | de tank heeft echt gewaarschuwd |
| 2 | een `zend signaal` én een `wanneer ik signaal … ontvang` met **dezelfde** naam | het signaal is verstuurd én aangekomen |
| 3 | een als-blok met `en` + `ben ik in mijn basis?` | je alarm is echt afgegaan |
| 4 | twee `wacht tot`-blokken die naar je levens kijken | je tank heeft echt gemeld dat hij gaat schuilen |
| 5 | een als-dan-anders mét een tweede erin die statpunten uitdeelt | je plan deelde zelf een punt uit |
| 6 | een som met `score van de beste speler` én een als-dan op `mijn plaats` | je tank heeft zijn stand geroepen |

## Blokkenstructuur les 2 (aanvulling op les 1)

Zeven blokken komen er bij les 2 bij: `ben ik in mijn basis?`, `niet`, `wacht tot`, `zend signaal`, `wanneer ik signaal … ontvang`, `score van de beste speler` en `mijn plaats in de ranglijst`. Die verschijnen automatisch zodra de leerling les 2 kiest — in les 1 blijven ze verborgen. Verder hergebruikt les 2 bewust de blokken van les 1 in een nieuwe context:

```
🚩 wanneer ik geraakt word
   verander [geraakt] met (1)                 ← eigen VARIABELE
   als <waarde van [geraakt] > 5> dan
      zeg [jullie krijgen me niet!]           ← ALS-DAN

herhaal                                ← HERHALING
   als <afstand tot dichtstbijzijnde vijand < 200> dan
      zeg [te dichtbij!]                       ← WAARNEMEN over het netwerk
```

**Kant-en-klaar door het platform:** de volledige netwerklaag (posities/richting/team/score van iedereen), teamtoewijzing, teamkleuren, teamzones met onschendbaarheid, friendly-fire-blokkering, beamer-scorebord, adminknoppen.
**Leerlingen bouwen zelf:** hun tactische reacties en teamstrategie met de blokken die ze al kennen.
