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

**Op een iPad of tablet** staan er twee joysticks op het speelveld, zoals in de diep.io-app:

- **Links: rijden.** Hij drukt de pijltjestoetsen voor je in: duw hem omhoog en voor het spel is *pijltje omhoog* ingedrukt (het pijltje licht geel op).
- **Rechts: mikken en schieten ("MIK").** Hij is de muis: het geschut draait de kant op waarin je duwt, en zolang je duwt is `muis ingedrukt?` waar (de joystick kleurt dan rood). Laat je los, dan blijft het geschut die kant op wijzen. Tikken op het speelveld werkt ook als muis.

De blokken zijn dus exact dezelfde als op een chromebook — een kind op een iPad bouwt hetzelfde programma als zijn buur. De knop **spatie** boven de linker joystick is voor de proef van stap 6. Zolang de besturing nog niet gebouwd is (stap 1–2), doen de joysticks niets; net als de pijltjestoetsen en de muis.

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
2. Open op jouw laptop **`http://localhost:3000/lesgever`** — dat is je dashboard. (Op een ander toestel vraagt het de lesgeverscode uit het zwarte venster.)
3. Beamer: **`http://localhost:3000/beamer`** (de arena, voor het slot van de les).
4. Bekijk vooraf de **👩‍🏫 Voorbeeldoplossing** in het startmenu, zodat je het einddoel kent. Zie [OPLOSSING.md](OPLOSSING.md).

### Je lesgeversdashboard tijdens de les

| Functie | Wat het doet |
|---|---|
| **Klasoverzicht** | Per leerling een kaartje: op welke stap, groen = klaar met zijn stap, blauw = bezig, rood = vast (zijn hint "Ik zit vast" staat open), en hoelang er al niets veranderde. **Bovenaan filter je** met één tik: iedereen, ✋ hand op, ⚠ aandacht (hand op, hint open of al 2 minuten stil) of ✅ klaar — met het aantal erbij. Onderaan: *"14/18 klaar met hun stap · 3 vragen aandacht"*. |
| **◀ vorige / volgende ▶** | Zet de héle klas op dezelfde stap. Leerlingen springen automatisch mee. |
| **⏸ Ogen op mij** | Bevriest alle speelvelden met een grijs scherm — ook de robots staan stil, dus niemand wordt intussen kapotgeschoten. Eén klik terug om verder te gaan; de leerlingen drukken dan zelf weer op 🚩. |
| **✋ hulpbalk** | Wie zijn hand opsteekt, staat bovenaan met een piepje, en zijn kaartje wordt geel. Klik **✓ geholpen** (in de balk of op het kaartje zelf) als je langs bent geweest. Geel betekent op het dashboard alleen nog "hand omhoog"; wie gewoon bezig is, heeft een blauwe rand. |
| **voortgang** | Elk kaartje heeft een balkje met één streepje per stap: groen = gehaald, blauw = waar hij nu zit. 💡 op het kaartje = zijn hint staat open. |
| **zijn programma** | Eén regel op elk kaartje: ▶ *programma loopt*, ⏹ *staat uit* (nog niet op de groene vlag gedrukt) of ✏️ *veranderd, niet herstart* (zijn tank doet nog het oude programma), plus 🧩 *2 losse stapeltjes* of 🚩 *geen startblok*. De meeste "hij doet niets!"-vragen zie je zo al vanop je stoel. **✋×3** naast de naam = zo vaak stak hij deze les al zijn hand op (ook in het 📋 rapport). |
| **tik op een kaartje** (of 👁 bekijk) | Opent die leerling, live bijgewerkt. Boven zijn blokken zie je wat hij op zijn scherm leest: **de stap en de opdracht, zijn twee vinkjes** (met dezelfde tekst als bij hem), **zijn hint** als die openstaat, en **welke stappen hij al haalde**. Inklappen met ▾ als je meer plaats nodig hebt voor de blokken. Daaronder de blokken van die leerling in een echte editor. Je kan ze aanpassen (blok bijslepen, variabele maken, …) en met **📤 stuur terug** naar de leerling sturen. Zijn programma start meteen opnieuw met jouw versie, en hij kan met **↩** zijn eigen versie terugzetten. Met 📄 zie je hetzelfde als grote leesbare tekst — ideaal om te projecteren. |
| **live** | De blokken worden elke twee seconden bijgewerkt, één leerling tegelijk. Begin je zelf te slepen, dan stopt het bijwerken tot je terugstuurt. |
| **⏭ volgende** | Opent meteen de volgende leerling die je nodig heeft: eerst de handen (wie het langst wacht), dan wie vastzit of al lang stilstaat. Zo werk je de klas af zonder te zoeken: **⏭ volgende → helpen → ✓ geholpen → ⏭ volgende**. |
| **💬 tip** | Een bericht dat op het scherm van die leerling blijft staan tot hij het wegklikt. Je tip gaat naar de leerling die je bekijkt (met **hele klas** naar iedereen). 💡 vult meteen de hint van zijn stap in. **⚡ snel**: kant-en-klare tips met één tik — "druk op de groene vlag", "je blokken hangen los", "kijk naar je vinkjes", "ik kom zo bij je!"… Wat bij hém past, staat bovenaan in het geel. |
| **🧩 samen vast** | Lopen drie of meer leerlingen op dezelfde stap vast, dan staat onderaan wie. Met **💡 stuur hen de hint** krijgen ze allemaal tegelijk de hint — of je weet dat het tijd is voor een klassikaal woordje uitleg. |
| **iPad** | Rondlopen kan: open het dashboard op een iPad (met de lesgeverscode). De klas staat dan schermvullend; tik je een leerling aan, dan schuiven zijn opdracht en blokken eroverheen. Met **✕** ben je terug bij de klas. |
| **🔊 Geluid klas** | Zet het geluid op alle leerlingenschermen in één keer uit (en weer aan). Ook wie later binnenkomt, blijft stil. |
| **📋 Rapport** | Hoe ver kwam elke leerling, en waar bleef de klas het langst hangen. Onderaan staat hoeveel projecten er bewaard zijn (met de voornamen van de kinderen): aan het eind van een lessenreeks wis je ze daar in één keer. Anders wist de server ze vanzelf na 90 dagen zonder gebruik. |

> 🔦 **Kijken wat de computer doet.** Na een klik op 🚩 licht elk blok dat uitgevoerd wordt geel op, zoals in Scratch. In een als-blok licht alleen de tak op die echt gekozen wordt. Een stapeltje zonder geel startblok erboven wordt bleek. En verandert een kind zijn blokken terwijl het programma loopt, dan knippert de groene vlag: de tank rijdt nog met het oude programma. Gebruik dat bij elke 🔬 Stukmaken: *"Kijk naar je blokken terwijl je tank rijdt. Welke lichten op?"*

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

**🔬 Stukmaken:** haal het 🚩-blok weg. Werkt het nog? *Waarom niet?* (Het stappen-blok wordt meteen bleek. Vraag: *waarom zou het spel het bleek maken?*)

### 0:18–0:28 · Stap 2: herhaling
De tank zet één stapje en stopt. **Dit is hét moment voor de herhalingslus.**

Bouw samen: `herhaal` eromheen. Nu blijft hij rijden.

**🔬 Stukmaken:** sleep het stappen-blok *onder* het herhaal-blok in plaats van erin. Wat gebeurt er? Laat twee leerlingen uitleggen aan elkaar wat het verschil is tussen *in* de lus en *onder* de lus. Na een nieuwe klik op 🚩 zie je het bewijs: het herhaal-blok blijft geel oplichten, het stappen-blok eronder nooit. De lus is nooit klaar.

### 0:28–0:40 · Stap 3: als-dan
De tank rijdt eindeloos de muur in. Je kan niet sturen. → `als <toets ↑ ingedrukt?> dan richt naar 0 graden + neem 10 stappen`.

**Bouw alleen ↑ samen voor.** Eén werkende als-dan is het hele doel van deze stap.

> 💡 De graden zijn dezelfde als in Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.

Laat ze het pijltje ingedrukt houden en naar hun blokken kijken: de blokken ín het als-blok lichten alleen op zolang de toets ingedrukt is. Zo zie je de computer kiezen.

**🔬 Stukmaken:** zet het als-blok buiten de lus. Werkt die toets nog?

### 0:40–0:50 · Stap 4: de andere drie richtingen
Nu bouwen ze **zelf** verder: hetzelfde patroon, drie keer, met een andere toets en een ander aantal graden. Hier ontstaat het eerste tempoverschil in de klas — gebruik je dashboard om te zien wie klaar is.

> 💡 Wijs op rechtsklikken → *Dupliceren* (op een iPad: de vinger even op het blok houden). Vergeet in de kopie niet **allebei** de dingen te veranderen: de toets én de graden.

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
| Eén leerling loopt ver achter | Zijn ⚠-melding staat in je dashboard. Zet de klas niet stil — geef hem de hint-knop en help gericht. Vanachter je eigen scherm kan dat ook: tik op zijn kaartje → aanpassen → **📤 stuur terug**. |
| Halve klas loopt vast op dezelfde stap | ⏸ **Ogen op mij**, en bouw die stap klassikaal voor. |
| Iemand is klaar en gaat spelen | Prima — laat hem, of geef een opdrachtkaart. Spelen is de beloning. |
| Iemand wist per ongeluk blokken | Meteen **Ctrl+Z** zet ze terug. Na 🗑 *Alles wissen* begint hij met een leeg werkblad en haalt hij de vorige stappen snel opnieuw in. |
| Blokken kwijt na verversen | In het startmenu staat **📂 Verder met het project van …** — één klik en alles is terug. Op een ander toestel: **meer opties → projectcode** (💾 TANK-XXXX, staat bovenaan zijn scherm). |
