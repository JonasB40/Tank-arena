# 🛡️ Tank Arena — Deel 1: van leeg werkblad naar speelbare tank (±90 min)

**Doelgroep:** 8–13 jaar, gemengd niveau · **Toestellen:** Chromebooks (browser) · **Resultaat:** elke leerling heeft zijn tank hélemaal zelf opgebouwd, blok voor blok, en snapt waaróm elk blok er staat.

> Dit is deel 1 van een workshop van 3 uur: **stappen 1 t/m 10** in de app. Na de pauze volgt **[deel 2](LESPLAN_DEEL2.md)** (stappen 11–15: uiterlijk, gebeurtenissen, rekenen, upgrade-plan, salvo) en het teamtoernooi. [LESPLAN_LES2.md](LESPLAN_LES2.md) is iets anders: dat is een losse vervolgsessie voor wie de groep een tweede keer ziet.

---

## Het didactische principe: elke stap begint met een probleem

De leerlingen krijgen **geen voorbeeld om na te bouwen**. Ze starten met een **leeg werkblad** en lopen telkens tegen iets aan dat niet werkt. Dat probleem is de motor van de les:

> **probleem** → *"waarom werkt dit niet?"* → **samen oplossen** → **het werkt!** → **stukmaken** → *"oh, dáárom staat het zo"*

Die laatste stap (bewust stukmaken) is waar het begrip zit. Een kind dat een lus alleen maar *heeft nagebouwd* weet niet wat een lus doet. Een kind dat gezien heeft wat er gebeurt *zonder* lus, weet het wel.

De app begeleidt dit: boven de blokken staat een **stappenpaneel** met het probleem, het doel, een hint-knop en twee vinkjes die automatisch controleren of het gelukt is. Blokken worden in de instructies **in hun eigen categoriekleur** getoond, zodat leerlingen ze meteen terugvinden in de gereedschapskist.

**De gereedschapskist groeit mee.** Bij stap 1 liggen er maar twee blokken klaar; elke stap ontgrendelt precies wat er nodig is. Een leerling kan dus niet verdwalen tussen blokken die hij nog niet kent — en jij hoeft nooit te zeggen "die gebruiken we straks pas". Wat ontgrendeld is blijft staan. Wil iemand vooruit? De schakelaar **🚀 Expert** toont in één klik alles.

**Schermindeling, zoals in Scratch:** blokken links, speelveld rechtsboven, en rechtsonder zie je wélke sprite je programmeert. Met de knopjes ▫ ◻ ⛶ boven het speelveld kies je klein / normaal / volledig scherm — op **klein** is er het meeste plaats om te bouwen. Uitleg over een blok verschijnt alleen als je erop klikt (en verdwijnt vanzelf), zodat er niet permanent extra tekst op het scherm staat.

## De tien problemen

| Stap | Het probleem | Concept | Automatische check |
|---|---|---|---|
| 1 | "Ik druk op 🚩 en er gebeurt niets" | gebeurtenis + sequentie | 🚩-blok met stappen-blok · tank bewoog |
| 2 | "Hij beweegt maar één keertje!" | **herhaling** | herhaal-lus met stappen erin · tank blijft rijden |
| 3 | "Ik kan niet sturen" | **als-dan** + invoer | als-blok met een toets dat laat rijden · rijdt op de toets |
| 4 | "Ik kan maar één kant op" | hetzelfde patroon herhalen | vier als-blokken, elk met een eigen hoek · meerdere richtingen |
| 5 | "Ik schiet de verkeerde kant op" | invoer → verwerking → uitvoer | richt-blok in de lus · geschut draait mee |
| 6 | "Er komt geen kogel uit" | nog een invoer: de muisknop | als `muis ingedrukt?` met schiet · er is geschoten |
| 7 | "Ik hou mijn eigen levens bij" | **variabelen** | een `maak Levens`-blok onder 🚩 · teller is gevuld |
| 8 | "Mijn teller blijft stilstaan" | als-dan met een gebeurtenis uit het spel | als `raak ik een kogel?` met `verander Levens` |
| 9 | "Niet elke kogel doet even veel pijn" | een waarde uit het spel gebruiken | `verander Levens` met `kracht kogel` erin |
| 10 | "Mijn tank roept zelf om hulp" | als-dan mét een waarde | als-blok dat levens vergelijkt · tank riep echt |

**Checkpoints controleren twee dingen:** of de juiste blokstructuur er staat (*heeft hij écht een lus gebruikt?*) én of het in het spel werkt (*rijdt de tank ook echt?*). Een leerling kan dus niet per ongeluk "slagen" met een toevallige oplossing — en jij ziet in het klasoverzicht wie het concept écht toepast.

---

## Wat jij vooraf klaarzet

1. Dubbelklik **start.bat**. Schrijf het adres uit de console op het bord.
2. Open op jouw laptop **`http://localhost:3000/lesgever`** — dat is je dashboard.
3. Beamer: **`http://localhost:3000/beamer`** (de arena, voor het slot van de les).
4. Bekijk vooraf de **👩‍🏫 Voorbeeldoplossing** in het startmenu, zodat je het einddoel kent. Zie [OPLOSSING.md](OPLOSSING.md).

### Je lesgeversdashboard tijdens de les

| Functie | Wat het doet |
|---|---|
| **Klasoverzicht** | Per leerling: op welke stap, ✓ klaar / ⏳ bezig / ⚠ zit vast (met hoelang al). Onderaan: *"14/18 klaar — iedereen mee, je kan door!"* |
| **◀ vorige / volgende ▶** | Zet de héle klas op dezelfde stap. Leerlingen springen automatisch mee. |
| **⏸ Ogen op mij** | Bevriest alle speelvelden met een grijs scherm. Eén klik terug om verder te gaan. |
| **toon blokken** | Projecteert de code van die leerling als grote leesbare tekst — ideaal om een goede oplossing óf een leerzame fout te bespreken. |

> ⚠ Vraag altijd toestemming aan het kind voor je zijn code projecteert. Bespreek fouten als *"kijk wat een interessant probleem"*, nooit als *"kijk wat er fout is"*.

---

## Lesverloop (90 min)

### 0:00–0:10 · Intro
- Toon 30 seconden diep.io of de arena op de beamer: *"dit ga je vandaag zélf bouwen."*
- Leerlingen surfen naar het bordadres, **typen hun naam en drukken op Enter** (of klikken ▶ Start de les). Meer hoeven ze niet te doen. Achter "meer opties" zitten robotniveau, projectcode en samen spelen — dat laatste verschijnt pas zodra hun tank kan rijden, zodat niemand met een stilstaande tank in de arena belandt.
- **Belangrijk:** hun werkblad is leeg. Dat is met opzet. *"Jullie krijgen niets voorgekauwd — jullie bouwen alles zelf."*

### 0:10–0:18 · Stap 1: er gebeurt niets
Laat ze eerst op 🚩 drukken. Er gebeurt niets. **Vraag de klas: waarom niet?** Laat ze raden voor je het zegt.

> 💡 De les: een computer doet alléén wat je hem zegt — en hij moet ook weten wannéér hij moet beginnen.

Samen: 🚩-blok + `neem 10 stappen`. ✓ Check springt op groen.

**🔬 Stukmaken:** haal het 🚩-blok weg. Werkt het nog? *Waarom niet?*

### 0:18–0:28 · Stap 2: herhaling
De tank zet één stapje en stopt. **Dit is hét moment voor de herhalingslus.**

Bouw samen: `herhaal` eromheen. Nu blijft hij rijden.

**🔬 Stukmaken:** sleep het stappen-blok *onder* het herhaal-blok in plaats van erin. Wat gebeurt er? Laat twee leerlingen uitleggen aan elkaar wat het verschil is tussen *in* de lus en *onder* de lus.

### 0:28–0:40 · Stap 3: als-dan
De tank rijdt eindeloos de muur in. Je kan niet sturen. → `als <toets ↑ ingedrukt?> dan richt naar 0 graden + neem 10 stappen`.

**Bouw alleen ↑ samen voor.** Eén werkende als-dan is het hele doel van deze stap.

> 💡 De graden zijn dezelfde als in Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.

**🔬 Stukmaken:** zet het als-blok buiten de lus. Werkt die toets nog?

### 0:40–0:50 · Stap 4: de andere drie richtingen
Nu bouwen ze **zelf** verder: hetzelfde patroon, drie keer, met een andere toets en een ander aantal graden. Hier ontstaat het eerste tempoverschil in de klas — gebruik je dashboard om te zien wie klaar is.

> 💡 Wijs op rechtsklikken → *Dupliceren*. Vergeet in de kopie niet **allebei** de dingen te veranderen: de toets én de graden.

**🔬 Stukmaken:** geef twee als-blokken dezelfde toets maar een andere richting. Welke kant gaat hij op? Waarom die?

### 0:50–1:02 · Stap 5 & 6: richten en schieten
Kort achter elkaar — dit gaat vlot omdat ze het patroon nu kennen. Benoem bij stap 5 expliciet: **invoer** (waar staat de muis) → **verwerking** (de computer rekent de hoek uit) → **uitvoer** (het geschut draait).

Stap 6 is hetzelfde patroon als sturen, maar nu met de **linkermuisknop**: `als <muis ingedrukt?> dan schiet`. Je mikt al met de muis, dus schieten met diezelfde muis is logisch.

Bij de 🔬-proef bouwen ze de ándere manier: `wanneer toets [spatiebalk] wordt ingedrukt → schiet` als los stapeltje. **Een toets kan op twee manieren** — kijken óf hij ingedrukt is (in de lus), of wachten tót er iets gebeurt (een gebeurtenis). Beide bestaan ook in Scratch. Rijden moet continu gecheckt worden, schieten hoeft maar één keer per druk.

### 1:02–1:20 · Stap 7, 8 & 9: je eigen levensteller *(het hart van de les)*
Drie kleine stappen die samen één ding opbouwen. Ze volgen elkaar snel op — laat ze doorwerken en loop rond.

- **Stap 7:** een variabele = een doosje met een naam waar een getal in zit. Ze maken `Levens` en vullen hem bij de start met `max levens`. Het tellertje verschijnt meteen live op hun speelveld.
- **Stap 8:** de teller staat stil. → `als <raak ik een vijandelijke kogel?> dan verander Levens met -10`. Een vást getal, bewust nog geen som.
- **Stap 9:** leg de teller naast de echte levensbalk — het klopt niet. Een tegenstander die zijn kogelschade upgradde doet méér pijn. De -10 wordt `0 − kracht kogel`.

**🔬 Stukmaken (stap 7, de klassieke bug):** zet het `maak Levens`-blok ín de herhaal-lus. De teller staat nu constant op max en beweegt nooit. *Dit is een fout die echte programmeurs óók maken.*

> ⚠ De teller is hún eigen getal, náást de echte levensbalk van het spel. Het spel blijft de boekhouder — zo kan niemand zijn levens op 999 zetten. Mooi klasgesprek.

### 1:20–1:30 · Stap 10: je tank roept om hulp
Alles samen: `herhaal → als <mijn levens < 30> dan zeg [help!]`, in een eigen stapeltje. Dit is de zwaarste bouwopdracht van deel 1. Wie hem af heeft vóór de pauze mag al vrij spelen — dat is de beloning.

**🔬 Stukmaken:** verander de 30 in 200. Roept hij nu constant? Waarom?

### 1:30–1:45 · Pauze

Daarna: **[deel 2](LESPLAN_DEEL2.md)** — stappen 11 t/m 15 en het teamtoernooi. De opdrachtkaarten hieronder gebruik je doorheen beide delen voor wie snel klaar is.

---

## Opdrachtkaarten (zelfstandig, na het instructiemoment)

> ⚠ Zet bij deze kaarten de schakelaar op **🚀 Expert**. In ⭐ Starter zie je alleen de blokken die de klas tot hier gezien heeft, en verschillende kaarten hebben blokken van later nodig (`wanneer ik iemand versla`, `flits`, `draai geschut`). Eén klik terug op ⭐ Starter en het overzicht is er weer.

> **⭐ KAART 1 — Zeg iets slims**
> Laat je tank iets roepen wanneer je iemand verslaat. *(🏆-blok + zeg)*

> **⭐ KAART 2 — Tel je overwinningen**
> Maak een variabele `kills` en laat hem oplopen. Zet het tellertje op je scherm.

> **⭐⭐ KAART 3 — Noodknop**
> Onder de 20 levens: flits rood én roep om hulp. Test het door je expres te laten raken.

> **⭐⭐ KAART 7 — Het thuisalarm**
> Linksonder in de arena ligt je **veilige zone**: daar raken vijandelijke kogels je niet en genees je snel.
> Bouw een alarm: `herhaal → als <niet <ben ik in mijn basis?>> en <mijn levens < 40> dan zeg [naar huis!] + flits rood`.
> *Let op: je tank rijdt niet vanzelf naar huis — dat doe jíj. Het programma waarschuwt je alleen.*

> **⭐⭐ KAART 4 — De draaitank** *(Expert)*
> Laat je geschut vanzelf ronddraaien met `draai geschut ↻ 15 graden` in een lus. Kan je zo toch nog raak schieten?

> **⭐⭐⭐ KAART 5 — Auto-aim** *(Expert)*
> `herhaal → richt naar [dichtstbijzijnde vijand] → schiet`. Je tank mikt nu helemaal zelf!
> *Let op: als je er bovenop rijdt, mis je. Waarom? Los het op met `als <raak ik [vijand]?> dan beweeg achteruit`.*

> **⭐⭐⭐ KAART 6 — Slim upgraden** *(Expert)*
> `wanneer ik een statpunt krijg → als kogelschade < 5 dan geef punt aan kogelschade, anders aan snelheid`. Jouw tank kiest nu zelf zijn build.

---

## Als het misloopt

| Situatie | Wat je doet |
|---|---|
| Eén leerling loopt ver achter | Zijn ⚠-melding staat in je dashboard. Zet de klas niet stil — geef hem de hint-knop en help gericht. |
| Halve klas loopt vast op dezelfde stap | ⏸ **Ogen op mij**, en bouw die stap klassikaal voor. |
| Iemand is klaar en gaat spelen | Prima — laat hem, of geef een opdrachtkaart. Spelen is de beloning. |
| Iemand wist per ongeluk alles | 🗑 Begin opnieuw geeft een leeg werkblad; hij haalt de vorige stappen snel terug in. |
| Blokken kwijt na verversen | Zijn **projectcode** (💾 TANK-XXXX) staat bovenaan — daarmee komt alles terug. |
