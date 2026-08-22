/*
 * De les: 15 stappen die élk beginnen met een probleem waar de klas op stuit.
 * Niet "doe dit", maar "kijk, dit werkt niet — hoe lossen we het op?".
 *
 * Per stap:
 *   probleem  — wat de leerling ziet gebeuren (of juist niet)
 *   doel      — wat hij gaat bouwen
 *   hint      — hulp als hij vastloopt
 *   breek     — de variatie/breek-oefening (verschijnt ná de check)
 *   concept   — welk kernconcept hier centraal staat
 *   check     — { structuur(programma), gedrag(waarnemer) } → beide moeten waar zijn
 *
 * In de teksten verwijzen we naar blokken met {{categorie|tekst}}. Die worden
 * getoond in de kleur van hun categorie, zodat leerlingen ze meteen
 * terugvinden in de gereedschapskist.
 */

/* ---------- blokverwijzingen in de kleur van hun categorie ---------- */
const BLOK_KLEUR = {
  geb: ['#FFBF00', '#4a3600'], // Gebeurtenissen
  bew: ['#4C97FF', '#ffffff'], // Beweging
  gev: ['#DB6E9C', '#ffffff'], // Gevecht
  upg: ['#0FBD8C', '#04372a'], // Upgrades
  uit: ['#9966FF', '#ffffff'], // Uiterlijken
  bes: ['#FFAB19', '#4a2f00'], // Besturen
  waa: ['#5CB1D6', '#06283d'], // Waarnemen
  ope: ['#59C059', '#0d3d0d'], // Operators
  vrb: ['#FF8C1A', '#4a2600'], // Variabelen
};

/** Zet {{cat|tekst}} om in een gekleurd blok-chipje. */
function blokHtml(tekst) {
  return String(tekst || '').replace(/\{\{(\w+)\|([^}]+)\}\}/g, (_, cat, t) => {
    const [bg, fg] = BLOK_KLEUR[cat] || ['#8a94ad', '#fff'];
    return `<span class="blok" style="background:${bg};color:${fg}">${t}</span>`;
  });
}

/* ---------- hulpjes om door het programma te zoeken ---------- */

/** Alle commando's in een scriptlijst, ook die binnen lussen en als-blokken. */
function alleCmds(cmds, uit = []) {
  for (const c of cmds || []) {
    uit.push(c);
    if (c.body) alleCmds(c.body, uit);
    if (c.dan) alleCmds(c.dan, uit);
    if (c.anders) alleCmds(c.anders, uit);
  }
  return uit;
}

/** Scripts met een bepaalde trigger. */
const scriptsMet = (p, type) => (p || []).filter((s) => s.trigger.type === type);

/** Alle commando's van alle scripts samen. */
function alleCmdsVanProject(p) {
  const uit = [];
  for (const s of p || []) alleCmds(s.body, uit);
  return uit;
}

/** Rijdt de tank hiermee? "neem stappen" is de Scratch-manier, "beweeg" is
    het oude blok dat we nog herkennen zodat oude projecten blijven kloppen. */
const isRijden = (c) => c.t === 'neemStappen' || c.t === 'beweeg' || c.t === 'beweegStappen';

/**
 * Wat is het EERSTE blok in de herhaal-lus? Voor stap 5 maakt dat uit: richten
 * hoort bovenaan, nog voor de als-blokken.
 */
function eersteInLus(p) {
  for (const s of p || []) {
    for (const c of alleCmds(s.body)) {
      if (c.t === 'forever') return (c.body && c.body[0]) || null;
    }
  }
  return null;
}

/** Zit er een commando van dit type ergens BINNEN een 'forever'-lus? */
function inLus(p, test) {
  for (const s of p || []) {
    for (const c of alleCmds(s.body)) {
      if (c.t === 'forever' && alleCmds(c.body).some(test)) return true;
    }
  }
  return false;
}

/* ---------- de stappen ---------- */
const STAPPEN = [
  {
    nr: 1,
    titel: 'Er gebeurt niets',
    concept: 'Gebeurtenis + sequentie',
    probleem: 'Druk eens op de groene vlag 🚩. Wat gebeurt er met je tank?',
    ontdekking: 'Niets! Een computer doet alleen wat je hem zégt. En hij moet ook weten wannéér hij moet beginnen.',
    doel: 'Sleep {{geb|wanneer op groene vlag wordt geklikt}} op je werkblad, en hang er {{bew|neem 10 stappen}} onder. Klik daarna op de groene vlag boven het speelveld.',
    hint: 'Het 🚩-blok vind je in de gele categorie {{geb|Gebeurtenis}}, het stappen-blok in de blauwe {{bew|Beweging}}.',
    check: {
      // ook waar als het stappen-blok later in een herhaal-lus belandt (stap 2),
      // anders springt dit vinkje weer op rood zodra de leerling verder bouwt
      structuur: (p) => scriptsMet(p, 'start').some((s) => alleCmds(s.body).some(isRijden)),
      structuurTekst: 'een {{geb|🚩-startblok}} met een {{bew|stappen-blok}} eronder',
      // één stapje is maar ~4 px — dát is precies het probleem van stap 2
      gedrag: (w) => w.bewogen > 2 || w.beweegCmds > 0,
      gedragTekst: 'je programma heeft je tank laten bewegen',
    },
    breek: 'Haal het {{geb|🚩-blok}} even weg en druk opnieuw op de vlag. Werkt het nog? Waarom niet?',
  },
  {
    nr: 2,
    titel: 'Hij beweegt maar één keertje',
    concept: 'Herhaling',
    probleem: 'Je tank zet één stapje en staat dan stil. Ook als je opnieuw op 🚩 drukt: één stapje.',
    ontdekking: 'De computer leest je blokken van boven naar beneden, en dan is hij klaar. Wil je dat iets blijft gebeuren, dan moet je het hérhalen.',
    doel: 'Zet je {{bew|neem 10 stappen}} binnenin een {{bes|herhaal}}-blok.',
    hint: '{{bes|herhaal}} vind je in de oranje categorie {{bes|Besturen}}. Sleep je stappen-blok in de opening van het herhaal-blok — je ziet een schaduw waar het in past.',
    check: {
      structuur: (p) => inLus(p, isRijden),
      structuurTekst: 'een {{bes|herhaal}} met daarin je {{bew|stappen-blok}}',
      gedrag: (w) => w.bewogen > 150,
      gedragTekst: 'je tank blijft doorrijden',
    },
    breek: 'Sleep het {{bew|neem 10 stappen}}-blok nu ONDER het {{bes|herhaal-blok}} in plaats van erin. Wat gebeurt er? En waarom?',
  },
  {
    nr: 3,
    titel: 'Ik kan niet sturen',
    concept: 'Als-dan + invoer',
    probleem: 'Je tank rijdt eindeloos in één richting — recht de muur in. Je kan hem niet sturen.',
    ontdekking: 'De tank moet een KEUZE maken: alleen omhoog rijden áls jij de pijltjestoets indrukt. Dat is een als-dan.',
    doel: [
      'Haal je {{bew|neem 10 stappen}} even uit de {{bes|herhaal}} en leg hem opzij.',
      'Sleep een {{bes|als … dan}} in de {{bes|herhaal}} (oranje categorie {{bes|Besturen}}).',
      'Sleep {{waa|toets ↑ ingedrukt?}} in het zeshoekige gaatje van het als-blok (blauwe {{waa|Waarnemen}}).',
      'Zet in de opening van het als-blok: {{bew|richt naar 0 graden}}.',
      'Zet daaronder je {{bew|neem 10 stappen}} terug — óók binnen het als-blok.',
      'Druk op 🚩 en houd het pijltje omhoog ingedrukt.',
    ].join('\n'),
    hint: 'Kijk goed of je stappen-blok écht ín het als-blok zit: het als-blok heeft een opening, en je blokken moeten daarbinnen inspringen. Zit het eronder in plaats van erin, dan rijdt je tank altijd — ook zonder toets.\n\nDe graden zijn dezelfde als in Scratch: 0 is omhoog, 90 is rechts, 180 is omlaag, -90 is links. Klik op het getal om het te veranderen.\n\nWerkt het nog niet? Kijk of je twee stapeltjes hebt staan. Alles hoort onder één 🚩-blok.',
    check: {
      // eerst alléén omhoog: één werkende als-dan is het hele doel van deze stap
      structuur: (p) => alleCmdsVanProject(p)
        .some((c) => c.t === 'als' && c.c && c.c.e === 'toets' && alleCmds(c.dan).some(isRijden)),
      structuurTekst: 'een {{bes|als-blok}} met {{waa|toets ↑ ingedrukt?}} dat je tank laat rijden',
      gedrag: (w) => w.richtingen >= 1,
      gedragTekst: 'je tank rijdt als je op de toets drukt',
    },
    breek: 'Zet het {{bes|als-blok}} eens BUITEN het {{bes|herhaal-blok}}. Werkt die toets dan nog? Waarom niet?',
  },
  {
    nr: 4,
    titel: 'Ik kan maar één kant op',
    concept: 'Hetzelfde patroon herhalen',
    probleem: 'Omhoog rijden lukt! Maar naar beneden, links en rechts gebeurt er nog niets.',
    ontdekking: 'Je hebt het patroon nu één keer gebouwd. De andere drie richtingen werken precies hetzelfde — alleen de toets en het aantal graden verschillen.',
    doel: [
      'Klik met de RECHTERmuisknop op je {{bes|als-blok}} en kies "Dupliceren".',
      'Sleep de kopie in de {{bes|herhaal}}, onder het eerste als-blok.',
      'Verander in de kopie de {{waa|toets}} naar → en de {{bew|graden}} naar 90.',
      'Herhaal dat nog twee keer: ↓ met 180 graden, en ← met -90 graden.',
      'Druk op 🚩 en probeer alle vier de pijltjes uit.',
    ].join('\n'),
    hint: 'Twee dingen veranderen per kopie: eerst de toets in het blauwe blokje, dán het getal bij de graden. Vergeet je het getal, dan rijden twee toetsen dezelfde kant op.\n\nAlle vier de als-blokken horen ONDER elkaar in dezelfde {{bes|herhaal}}, niet in elkaar. Ze mogen elkaar niet insluiten.\n\nDe vier richtingen: ↑ = 0, → = 90, ↓ = 180, ← = -90. Denk aan een klok waarbij 0 bovenaan staat.',
    check: {
      structuur: (p) => {
        const alsBlokken = alleCmdsVanProject(p).filter((c) => c.t === 'als' && c.c && c.c.e === 'toets');
        const richtingen = new Set();
        for (const a of alsBlokken) {
          for (const c of alleCmds(a.dan)) {
            if (c.t === 'richtRij') richtingen.add(JSON.stringify(c.v));  // per hoek
            if (c.t === 'beweeg') richtingen.add(c.r);                    // oude projecten
          }
        }
        return richtingen.size >= 4;
      },
      structuurTekst: 'vier {{bes|als-blokken}} met een {{waa|toets}}, elk met een eigen {{bew|hoek}}',
      gedrag: (w) => w.richtingen >= 3,
      gedragTekst: 'je tank rijdt in meerdere richtingen',
    },
    breek: 'Geef twee als-blokken eens dezelfde {{waa|toets}} maar een andere {{bew|richting}}. Welke kant gaat je tank op? Waarom die?',
  },
  {
    nr: 5,
    titel: 'Ik schiet de verkeerde kant op',
    concept: 'Invoer → verwerking → uitvoer',
    probleem: 'Je geschut wijst altijd dezelfde kant op, ook als de vijand ergens anders staat.',
    ontdekking: 'De computer moet uitrékenen welke kant je geschut op moet: hij leest waar je muis staat (invoer), berekent de hoek (verwerking) en draait het geschut (uitvoer).',
    doel: [
      'Zoek {{bew|richt het geschut naar de muis}} in de blauwe categorie {{bew|Beweging}}.',
      'Sleep het IN je {{bes|herhaal}}, als ALLEREERSTE blok — dus BOVEN je {{bes|als}}-blokken.',
      'Klik op 🚩 en beweeg je muis rond je tank.',
    ].join('\n'),
    /* Kinderen lezen "bovenaan" makkelijk over. Een plaatje van de juiste
       stapel laat in een oogopslag zien waar het blok hoort. */
    voorbeeld: '{{bes|herhaal}}\n    {{bew|richt het geschut naar de muis}}  ← hier! als eerste\n    {{bes|als toets ↑ ingedrukt}} …\n    {{bes|als toets → ingedrukt}} …',
    wijsAan: { categorie: 'Beweging' },
    hint: 'Het blok staat in de blauwe categorie {{bew|Beweging}}, bij de richt-blokken.\n\nSleep het tot het vastklikt ONDER het woord {{bes|herhaal}} en BOVEN je eerste {{bes|als}}-blok. Zie je daar een schaduwlijn verschijnen, dan mag je loslaten.\n\nStaat het buiten de herhaal? Dan richt je tank maar een keer, bij de start.',
    check: {
      /* Streng op de plek: het richt-blok moet het eerste blok in de lus zijn.
         Dat mag, want de tekst hieronder zegt precies wat er nog schort — het
         scheelt een sleepbeweging en ze leren dat volgorde uitmaakt. */
      structuur: (p) => {
        const eerste = eersteInLus(p);
        return !!eerste && (eerste.t === 'richtMuis' || eerste.t === 'richtNaar');
      },
      structuurTekst: (p) => {
        const eerste = eersteInLus(p);
        const goed = !!eerste && (eerste.t === 'richtMuis' || eerste.t === 'richtNaar');
        if (!goed && inLus(p, (c) => c.t === 'richtMuis' || c.t === 'richtNaar')) {
          return 'bijna! je {{bew|richt-blok}} staat in de {{bes|herhaal}}, maar niet bovenaan — sleep het BOVEN je {{bes|als}}-blokken';
        }
        return 'een {{bew|richt-blok}} als EERSTE blok in je {{bes|herhaal}}';
      },
      gedrag: (w) => w.gedraaid > 0.5,
      gedragTekst: 'je geschut draait mee',
    },
    breek: 'Zet het {{bew|richt-blok}} eens BOVEN het {{bes|herhaal-blok}}. Draait je geschut dan nog mee met de muis?',
  },
  {
    nr: 6,
    titel: 'Er komt geen kogel uit',
    concept: 'Nog een invoer: de muisknop',
    probleem: 'Je geschut draait netjes mee met je muis, maar er komt geen kogel uit. Klikken helpt niet.',
    ontdekking: 'Je mikt al met de muis — dan is het ook logisch dat je met de muis schiet. Je tank moet alleen nog kíjken of de knop ingedrukt is, net zoals hij naar de pijltjestoetsen kijkt.',
    doel: [
      'Zet onderaan in je {{bes|herhaal}} een {{bes|als … dan}}-blok.',
      'Sleep {{waa|muis ingedrukt?}} in het zeshoekige gaatje.',
      'Zet {{gev|schiet}} in het als-blok.',
      'Druk op 🚩 en klik met je linkermuisknop op het speelveld.',
    ].join('\n'),
    hint: 'Dit is precies hetzelfde patroon als bij het sturen, alleen kijk je nu naar de muisknop in plaats van naar een toets. {{waa|muis ingedrukt?}} staat bij {{waa|Waarnemen}}, {{gev|schiet}} bij de roze {{gev|Gevecht}}.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'muisknop'
        && alleCmds(c.dan).some((x) => x.t === 'schiet'))
        // een toets-gebeurtenis met schiet telt ook mee (oude projecten)
        || scriptsMet(p, 'toets').some((s) => alleCmds(s.body).some((c) => c.t === 'schiet')),
      structuurTekst: 'een {{bes|als}} {{waa|muis ingedrukt?}} met een {{gev|schiet-blok}}',
      gedrag: (w) => w.geschoten > 0 || w.schietCmds > 0,
      gedragTekst: 'je hebt geschoten',
    },
    breek: 'Er bestaat ook een ándere manier: {{geb|wanneer toets [spatiebalk] wordt ingedrukt}} met {{gev|schiet}} eronder, als los stapeltje. Bouw het er eens bij. Wat is het verschil tussen "kijken of de knop ingedrukt is" en "wachten tot er iets gebeurt"?',
  },
  {
    nr: 7,
    titel: 'Ik hou mijn eigen levens bij',
    concept: 'Variabelen',
    probleem: 'Het spel weet hoeveel levens je hebt, maar jouw programma niet. Jij wil dat getal zélf bijhouden.',
    ontdekking: 'Een variabele is een doosje met een naam waar een getal in zit. Je vult het doosje bij de start, en verandert het onderweg.',
    doel: [
      'Klik links op de oranje bol {{vrb|Variabelen}}. Bovenaan KNIPPERT de knop ➕ Maak een variabele — klik daarop.',
      'Typ als naam: Levens. Klik op OK.',
      'Sleep je nieuwe blok {{vrb|maak Levens}} onder je {{geb|🚩}}-blok, BOVEN de {{bes|herhaal}}.',
      'Sleep {{vrb|max levens}} (onderaan dezelfde categorie) in het witte rondje.',
    ].join('\n'),
    /* "Variabele" is hier een gloednieuw woord en de eerste keer dat ze zelf
       iets moeten aanmaken. Plaatje erbij, en de knop knippert. */
    voorbeeld: '{{geb|wanneer op groene vlag wordt geklikt}}\n    {{vrb|maak Levens}} = {{vrb|max levens}}   ← hier, voor de herhaal\n    {{bes|herhaal}} …',
    wijsAan: { categorie: 'Variabelen', knop: true },
    hint: '➕ Maak een variabele is een echte KNOP, geen blok — je sleept hem niet, je klikt erop. Er komt dan een venster waarin je een naam typt.\n\nNoem hem Levens en klik op OK. Daarna staan er nieuwe oranje blokken in de lade die er eerst niet waren: die heb jij net gemaakt.\n\n{{vrb|max levens}} is iets anders: dat blok houdt het SPEL bij, en staat onderaan dezelfde categorie. Dat sleep je in het witte rondje van je {{vrb|maak Levens}}-blok.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'zetVar'),
      structuurTekst: 'een {{vrb|maak Levens}}-blok onder je {{geb|🚩}}',
      gedrag: (w) => w.zetVarCmds > 0,
      gedragTekst: 'je teller is gevuld',
    },
    breek: 'Zet je {{vrb|maak Levens}}-blok eens BINNEN je {{bes|herhaal}}-lus. Wat blijft je teller nu doen? Waarom hoort dit blok bij de start?',
  },
  {
    nr: 8,
    titel: 'Mijn teller blijft stilstaan',
    concept: 'Als-dan met een gebeurtenis uit het spel',
    probleem: 'Je wordt geraakt, de levensbalk zakt — maar jouw teller blijft gewoon staan.',
    ontdekking: 'Je programma moet zélf kijken of er een kogel binnenkomt. Zolang je dat niet vraagt, weet het van niets.',
    doel: 'Zet in je {{bes|herhaal}}: {{bes|als}} {{waa|raak ik een vijandelijke kogel?}} {{bes|dan}} {{vrb|verander Levens met}} -10.',
    hint: 'Het blok {{waa|raak ik …?}} staat in de blauwe {{waa|Waarnemen}}; kies in het menuutje "een vijandelijke kogel". Typ in het verander-blok gewoon -10 (met een minteken ervoor), dan gaat je teller omláág.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'raakIk'
        && c.c.wat === 'kogel' && alleCmds(c.dan).some((x) => x.t === 'veranderVar')),
      structuurTekst: 'een {{bes|als}} {{waa|raak ik een kogel?}} met een {{vrb|verander Levens}} erin',
      gedrag: () => true,
      gedragTekst: 'klaar om je te laten raken',
    },
    breek: 'Maak van de -10 eens gewoon 10 (zonder minteken). Welke kant gaat je teller nu op als je geraakt wordt?',
  },
  {
    nr: 9,
    titel: 'Niet elke kogel doet even veel pijn',
    concept: 'Een waarde uit het spel gebruiken',
    probleem: 'Jouw teller gaat elke keer 10 omlaag. Maar leg hem eens naast de echte levensbalk: die zakt de ene keer meer dan de andere.',
    ontdekking: 'Een tegenstander die zijn kogelschade heeft geüpgraded doet méér pijn. Een vast getal kan dus nooit kloppen — je hebt het échte getal van díe kogel nodig.',
    doel: 'Vervang de -10 door {{ope|0 − }}{{waa|kracht kogel}}. Laat je daarna raken en vergelijk je teller met de levensbalk.',
    hint: 'Sleep het groene {{ope|−}}-blok in het vakje van je verander-blok. Links typ je 0, rechts hang je {{waa|kracht kogel}} uit {{waa|Waarnemen}}. "0 min iets" is datzelfde getal, maar dan negatief — precies wat je nodig hebt om af te trekken.',
    check: {
      structuur: (p) => {
        const heeftKracht = (e) => !!e && typeof e === 'object'
          && (e.e === 'krachtKogel' || heeftKracht(e.a) || heeftKracht(e.b) || heeftKracht(e.v));
        return alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'raakIk' && c.c.wat === 'kogel'
          && alleCmds(c.dan).some((x) => x.t === 'veranderVar' && heeftKracht(x.v)));
      },
      structuurTekst: 'een {{vrb|verander Levens}} met {{waa|kracht kogel}} erin',
      gedrag: () => true,
      gedragTekst: 'klaar om te vergelijken met de levensbalk',
    },
    breek: 'Rij eens tegen een geel blokje aan in plaats van je te laten beschieten. Je verliest wél echte levens, maar jouw teller beweegt niet. Waarom niet?',
  },
  {
    nr: 10,
    titel: 'Mijn tank roept zelf om hulp',
    concept: 'Als-dan mét een waarde',
    probleem: 'Je merkt pas dat je bijna dood bent als het al te laat is. Niemand waarschuwt je.',
    ontdekking: 'Tot nu toe keek je tank naar toetsen en naar kogels. Maar hij kan ook naar een getal kijken — bijvoorbeeld naar je levens — en zélf beslissen wanneer hij alarm slaat.',
    doel: [
      'Sleep een nieuw {{geb|🚩}}-blok op een lege plek.',
      'Hang er een {{bes|herhaal}} onder.',
      'Zet in de herhaal een {{bes|als … dan}}.',
      'Sleep het groene {{ope|( ) < ( )}} in het zeshoekige gaatje van het als-blok.',
      'Zet {{vrb|mijn levens}} in het linkervakje en typ 30 in het rechtervakje.',
      'Zet in het als-blok: {{uit|zeg [help!]}}.',
    ].join('\n'),
    /* Zes losse stapjes zijn veel om te onthouden. Het plaatje laat de hele
       stapel in een keer zien: wat hangt onder wat, en wat gaat in welk gaatje. */
    voorbeeld: '{{geb|wanneer op groene vlag wordt geklikt}}\n    {{bes|herhaal}}\n        {{bes|als}} ( {{vrb|mijn levens}} {{ope|<}} 30 ) {{bes|dan}}   ← het groene <-blok, met twee vakjes\n            {{uit|zeg [help!]}}',
    wijsAan: { categorie: 'Operators' },
    hint: 'Lees je blokken hardop, dan hoor je of het klopt: "als mijn levens kleiner is dan 30, zeg dan help!".\n\nHet {{ope|<}}-blok staat in de groene {{ope|Operators}}. Het heeft twee lege vakjes en past precies in het zeshoekige gaatje van je {{bes|als}}-blok. Sleep eerst het groene blok in dat gaatje, en vul het daarna pas.\n\n{{vrb|mijn levens}} vind je helemaal onderaan de oranje {{vrb|Variabelen}}, bij de blokken die het spel zelf bijhoudt. Dat is iets anders dan je eigen teller {{vrb|Levens}} van stap 7.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'vergelijk'
        && JSON.stringify(c.c).includes('levens') && alleCmds(c.dan).length > 0),
      structuurTekst: 'een {{bes|als-blok}} dat je {{vrb|levens}} vergelijkt met een getal',
      // pas groen als de tank het écht geroepen heeft toen zijn levens zakten
      gedrag: (w) => w.zegCmds > 0,
      gedragTekst: 'je tank heeft echt om hulp geroepen',
    },
    breek: 'Verander de 30 eens in 200. Roept je tank nu constant om hulp? Waarom?',
  },

  /* ---------- deel 2: van "hij werkt" naar "hij is van mij" ---------- */

  {
    nr: 11,
    titel: 'Alle tanks zien er hetzelfde uit',
    concept: 'Je eigen uiterlijk',
    probleem: 'Zet je tank eens naast die van je buur. Je ziet niet welke van jou is — iedereen rijdt in dezelfde kleur rond.',
    ontdekking: 'Een programma bepaalt niet alleen wat je tank dóet, maar ook hoe hij eruitziet. En dat mag jij kiezen.',
    doel: [
      'Zoek in de paarse categorie {{uit|Uiterlijken}} het blok {{uit|zet kleur op}}.',
      'Hang het onder je {{geb|🚩}}-startblok, boven je {{bes|herhaal}}.',
      'Klik op het kleurvakje en kies jouw kleur. Druk daarna op 🚩.',
    ].join('\n'),
    hint: 'Het blok moet ónder het 🚩-blok maar bóven je herhaal-lus: de kleur wordt één keer gezet bij de start, daarna hoeft dat niet meer. Je ziet je tank meteen veranderen, ook op de minikaart.',
    check: {
      structuur: (p) => scriptsMet(p, 'start').some((s) => alleCmds(s.body).some((c) => c.t === 'kleur')),
      structuurTekst: 'een {{uit|zet kleur}}-blok onder je {{geb|🚩}}',
      gedrag: (w) => w.uiterlijkCmds > 0,
      gedragTekst: 'je tank heeft een eigen kleur gekregen',
    },
    breek: 'Sleep het {{uit|zet kleur}}-blok eens ín je {{bes|herhaal}}-lus. Ziet je tank er anders uit? En waarom is dat zonde van het werk dat de computer doet?',
  },
  {
    nr: 12,
    titel: 'Mijn tank reageert nergens op',
    concept: 'Meerdere gebeurtenissen naast elkaar',
    probleem: 'Je verslaat iemand of je gaat kapot — en je tank doet gewoon verder alsof er niets gebeurd is.',
    ontdekking: 'Je hebt tot nu toe één gebeurtenis gebruikt: de 🚩. Maar je mag er zoveel naast elkaar zetten als je wil, elk met hun eigen reactie. Ze wachten allemaal rustig tot hún moment komt.',
    doel: [
      'Sleep {{geb|wanneer ik iemand versla}} op een lege plek naast je andere blokken.',
      'Hang er {{uit|zeg [gepakt!]}} onder.',
      'Sleep {{geb|wanneer ik kapot ga}} er weer naast.',
      'Hang er {{uit|flits rood}} onder.',
    ].join('\n'),
    hint: 'Deze stapeltjes hangen nergens aan vast — dat hoort zo. Elk gebeurtenisblok is de start van een eigen stapeltje, herkenbaar aan de ronde bovenkant. De blokken staan bij {{geb|Gebeurtenis}} en {{uit|Uiterlijken}}.',
    check: {
      structuur: (p) => {
        const uiterlijk = (c) => ['kleur', 'flits', 'zeg', 'geluid'].includes(c.t);
        // twee losse stapeltjes die elk op een spelgebeurtenis reageren
        return (p || []).filter((s) => ['geraakt', 'versla', 'levelup', 'dood'].includes(s.trigger.type)
          && alleCmds(s.body).some(uiterlijk)).length >= 2;
      },
      structuurTekst: 'twee stapeltjes die elk op een eigen {{geb|gebeurtenis}} reageren',
      gedrag: () => true,
      gedragTekst: 'klaar om uit te proberen in de arena',
    },
    breek: 'Probeer {{geb|wanneer ik kapot ga}} eens ná te bouwen met wat je al kent: {{bes|herhaal}} → {{bes|als}} {{vrb|mijn levens}} {{ope|=}} 0 {{bes|dan}} {{uit|flits rood}}. Werkt dat even goed? Meestal niet — je levens springen van 3 naar onder nul en daarna meteen terug na je respawn, dus dat ene moment van precies 0 mis je bijna altijd. Dáárom geeft het spel je een gebeurtenis: die komt gegarandeerd aan.',
  },
  {
    nr: 13,
    titel: 'Hoe sterk ben ik eigenlijk?',
    concept: 'Rekenen met variabelen',
    probleem: 'Je ziet je levens en je score, maar nergens staat hoe stérk je tank nu is. Dat getal bestaat gewoon niet — het spel houdt het niet bij.',
    ontdekking: 'Dan maak je het zelf! Een variabele hoeft niet alleen te tellen: je kan er ook een uitkomst van een sóm in bewaren. Dat is precies wat een computer de hele dag doet.',
    doel: [
      'Maak een variabele "kracht". Ze verschijnt meteen op je speelveld.',
      'Zet in je {{bes|herhaal}} een {{vrb|maak kracht op ( )}}-blok.',
      'Sleep het groene {{ope|( ) + ( )}} in dat lege vakje.',
      'In het rechtervakje van de plus: {{upg|waarde van stat kogelsnelheid}}.',
      'In het linkervakje van de plus: het groene {{ope|( ) × ( )}}.',
      'Daarin: {{upg|waarde van stat kogelschade}} en het getal 2.',
    ].join('\n'),
    hint: 'Bouw van buiten naar binnen: eerst de plus in het lege vakje, dan pas de keer-som in het linkerdeel van die plus. Zo maak je van kleine sommetjes één grote — net als haakjes in de wiskunde. De rekenblokken staan in de groene {{ope|Operators}}, de stat-blokken in de groene {{upg|Upgrades}}.',
    check: {
      structuur: (p) => {
        const heeftReken = (e) => !!e && typeof e === 'object'
          && (e.e === 'reken' || heeftReken(e.a) || heeftReken(e.b) || heeftReken(e.v));
        return alleCmdsVanProject(p).some((c) => c.t === 'zetVar' && heeftReken(c.v));
      },
      structuurTekst: 'een {{vrb|maak-blok}} met een {{ope|rekensom}} erin',
      gedrag: (w) => w.zetVarCmds > 0,
      gedragTekst: 'je kracht-getal wordt berekend',
    },
    breek: 'Verander de × 2 eens in × 10. Wat gebeurt er met je getal? En klopt je "kracht" dan nog met wat je op het speelveld voelt?',
  },
  {
    nr: 14,
    titel: 'Ik moet elke keer zelf kiezen',
    concept: 'Beslisboom',
    probleem: 'Vanaf nu staan er linksonder acht balkjes in beeld: je statpunten. Elke keer als je een level omhoog gaat, mag je er eentje uitdelen. Middenin een gevecht heb je daar geen tijd voor, en dan klik je maar wat.',
    ontdekking: 'Je kan je keuze op voorhand opschrijven als een regel: "heb ik nog weinig kogelschade? Dan daarin. Zo niet, dan snelheid." De computer volgt die regel voortaan zelf.',
    doel: [
      'Sleep {{geb|wanneer ik een statpunt krijg}} op een lege plek.',
      'Hang er een {{bes|als … dan … anders}} onder. Dat blok heeft twee openingen.',
      'In het zeshoekje: {{ope|( ) < ( )}} met links {{upg|waarde van stat kogelschade}} en rechts het getal 5.',
      'In de bovenste opening (dan): {{upg|geef 1 statpunt aan kogelschade}}.',
      'In de onderste opening (anders): {{upg|geef 1 statpunt aan snelheid}}.',
    ].join('\n'),
    hint: 'Je schrijft hier een plan op: "heb ik nog weinig kogelschade? Steek het punt daar dan in. Zo niet, maak me sneller." Het {{bes|als-dan-anders}}-blok staat bij {{bes|Besturen}}, de statblokken in de groene {{upg|Upgrades}}.',
    check: {
      structuur: (p) => scriptsMet(p, 'statpunt').some((s) => alleCmds(s.body)
        .some((c) => c.t === 'als' && [...alleCmds(c.dan), ...alleCmds(c.anders)].some((x) => x.t === 'geefStat'))),
      structuurTekst: 'een {{geb|statpunt-gebeurtenis}} met een {{bes|als-dan}} die {{upg|statpunten uitdeelt}}',
      gedrag: (w) => w.statCmds > 0,
      gedragTekst: 'je plan heeft zelf een statpunt uitgedeeld',
    },
    breek: 'Zet de 5 eens op 0. Naar welke stat gaat nu élk punt? Waarom komt de andere kant nooit meer aan de beurt?',
  },
  {
    nr: 15,
    titel: 'Ik sta stil zodra ik schiet',
    concept: 'Wachten blokkeert één stapeltje',
    probleem: 'Je wil een salvo van drie kogels. Maar zodra je een {{bes|wacht}}-blok tussen je schoten zet, staat je tank stil terwijl hij schiet — sturen lukt niet meer.',
    ontdekking: 'Een {{bes|wacht}}-blok pauzeert het héle stapeltje waar het in zit, dus ook je stuurblokken eronder. De oplossing: geef het schieten zijn eigen stapeltje. Losse stapeltjes draaien wél tegelijk.',
    doel: [
      'Sleep een nieuw {{geb|wanneer op groene vlag wordt geklikt}} op een lege plek.',
      'Hang er een {{bes|herhaal}} onder.',
      'Verplaats je hele {{bes|als}} {{waa|muis ingedrukt?}}-blok uit je besturing naar dit nieuwe stapeltje.',
      'Zet een {{bes|herhaal ( ) keer}} om het {{gev|schiet}}-blok en typ 3 in het vakje.',
      'Zet onder {{gev|schiet}} een {{bes|wacht 0.2 sec.}} — anders komen de drie kogels tegelijk.',
    ].join('\n'),
    hint: 'Rijden en schieten zijn nu twee aparte programmaatjes die naast elkaar lopen — precies zoals in Scratch. Test het: houd een pijltjestoets én je muisknop ingedrukt. Je moet nu kunnen rijden én schieten tegelijk.',
    check: {
      structuur: (p) => {
        const salvo = (s) => alleCmds(s.body).some((c) => c.t === 'herhaal' && alleCmds(c.body).some((x) => x.t === 'schiet'));
        // het salvo moet in een stapeltje zonder stuurblokken zitten, anders
        // pauzeert het wacht-blok ook je besturing
        return (p || []).some((s) => salvo(s) && !alleCmds(s.body).some(isRijden));
      },
      structuurTekst: 'een {{bes|herhaal ( ) keer}} met {{gev|schiet}}, in een eigen stapeltje zonder stuurblokken',
      gedrag: (w) => w.schietCmds >= 3,
      gedragTekst: 'je hebt een salvo afgevuurd',
    },
    breek: 'Sleep je schiet-stapeltje eens terug ín je besturingslus. Rijd en schiet tegelijk: voel je hoe je tank hapert? Zet het daarna weer apart.',
  },
];

/* ------------------------------------------------------------------ */
/* Les 2: live multiplayer & teams — een eigen reeks met eigen nummers  */
/* ------------------------------------------------------------------ */
/*
 * Bewust NIET achter les 1 geplakt: les 2 is een losse vervolgsessie en draait
 * in de gedeelde arena. Een workshopleerling zou anders halverwege in stappen
 * belanden die klasgenoten nodig hebben. Wie les 2 kiest, speelt meteen samen
 * en heeft alle blokken van les 1 al ontgrendeld.
 */
const LES2_STAPPEN = [
  {
    nr: 1,
    titel: 'Ik zie ze te laat',
    concept: 'Waarnemen over het netwerk',
    probleem: 'Rijden en schieten werkt hier meteen — pijltjes om te rijden, muis om te mikken en te schieten. Maar je speelt nu tegen échte klasgenoten: ze komen van alle kanten, en meestal merk je ze pas als je al geraakt bent.',
    ontdekking: 'Je tank kan meten hoe ver de dichtstbijzijnde vijand is. Dat werkt nu op echte spelers — jouw computer krijgt hun posities van de server. Zo kan je jezelf laten waarschuwen.',
    doel: [
      'Sleep een {{geb|🚩}}-blok op een lege plek en hang er een {{bes|herhaal}} onder.',
      'Zet daarin een {{bes|als … dan}} met het groene {{ope|( ) < ( )}}.',
      'Links: {{waa|afstand tot dichtstbijzijnde vijand}}. Rechts: 200.',
      'Zet in het als-blok {{uit|zeg [pas op!]}}.',
    ].join('\n'),
    hint: 'Het blok {{waa|afstand tot dichtstbijzijnde vijand}} staat in de blauwe {{waa|Waarnemen}}, in het keuzelijstje. Klein getal = dichtbij. Test het door naar een klasgenoot toe te rijden.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'vergelijk'
        && JSON.stringify(c.c).includes('afstand') && alleCmds(c.dan).length > 0),
      structuurTekst: 'een {{bes|als-blok}} dat de {{waa|afstand tot een vijand}} vergelijkt',
      gedrag: (w) => w.uiterlijkCmds > 0,
      gedragTekst: 'je tank heeft echt gewaarschuwd',
    },
    breek: 'Zet de 200 eens op 2000. De halve arena is dan "dichtbij" — je tank roept nu onophoudelijk. Waarom is een goede grens zo belangrijk?',
  },
  {
    nr: 2,
    titel: 'Mijn beloning staat overal apart',
    concept: 'Signaal: zenden en ontvangen',
    probleem: 'Je verslaat een klasgenoot en wil dat vieren: punten erbij, een geluidje, een flits. Maar straks wil je diezelfde beloning ook als je een grote vorm kapot schiet. Ga je al die blokken dan overtypen?',
    ontdekking: 'Nee. Je kan een SIGNAAL versturen: één blokje dat roept "bonus!". Elk stapeltje dat naar dat signaal luistert, gaat dan lopen. Zo staat je beloning maar op één plek — en kan je hem overal oproepen.',
    doel: [
      'Maak een nieuwe variabele en noem hem {{vrb|teampunten}} (knop ➕ Maak een variabele).',
      'Sleep {{geb|wanneer ik iemand versla}} op een lege plek.',
      'Hang er {{geb|zend signaal bonus}} onder.',
      'Sleep nu {{geb|wanneer ik signaal bonus ontvang}} op een ándere lege plek.',
      'Hang daaronder: {{vrb|verander teampunten met 50}}, {{uit|speel geluid tada!}} en {{uit|flits geel}}.',
      'Ga een klasgenoot of robot verslaan en kijk naar je tellertje.',
    ].join('\n'),
    hint: 'Dit is precies wat je in Scratch een "bericht" noemt. Let goed op de naam: het signaal dat je zendt en het signaal waar je naar luistert moeten exact hetzelfde heten, anders komt je bericht nergens aan.',
    check: {
      structuur: (p) => {
        const gezonden = new Set(alleCmdsVanProject(p).filter((c) => c.t === 'zendSignaal').map((c) => c.naam));
        // een signaal telt pas als er ook echt iemand naar luistert én iets doet
        return scriptsMet(p, 'signaal').some((s) => gezonden.has(s.trigger.naam) && alleCmds(s.body).length > 0);
      },
      structuurTekst: 'een {{geb|zend signaal}} én een {{geb|wanneer ik signaal … ontvang}} met dezelfde naam',
      gedrag: (w) => w.signaalCmds > 0 && w.ontvangenCmds > 0,
      gedragTekst: 'je signaal is verstuurd én aangekomen',
    },
    breek: 'Verander de naam van het signaal in ÉÉN van de twee blokken. Verslaan werkt nog, maar de beloning blijft weg. Waarom? Zet hem daarna weer gelijk.',
  },
  {
    nr: 3,
    titel: 'Ik blijf te lang buiten',
    concept: 'Twee voorwaarden combineren',
    probleem: 'Je vecht door tot je kapot gaat. Je eigen teamzone is veilig, maar in het heetst van de strijd vergeet je terug te gaan.',
    ontdekking: 'Eén voorwaarde is hier niet genoeg: alarm slaan hoeft alléén als je bijna dood bent ÉN niet veilig staat. Daar bestaan de blokken {{ope|en}} en {{ope|niet}} voor.',
    doel: [
      'Zet in een {{bes|herhaal}} een {{bes|als … dan}}.',
      'Sleep {{ope|( ) en ( )}} in het zeshoekige gaatje.',
      'Links: {{ope|niet}} met daarin {{waa|ben ik in mijn basis?}}',
      'Rechts: {{ope|( ) < ( )}} met {{vrb|mijn levens}} en 40.',
      'In het als-blok: {{uit|zeg [naar huis!]}} en {{uit|flits rood}}.',
    ].join('\n'),
    hint: 'Lees het hardop: "als ik NIET in mijn basis ben EN mijn levens kleiner zijn dan 40, roep dan naar huis". Je tank rijdt niet vanzelf terug — dat doe jij. Het programma waarschuwt alleen.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).some((c) => c.t === 'als' && c.c && c.c.e === 'en'
        && JSON.stringify(c.c).includes('inBasis') && alleCmds(c.dan).length > 0),
      structuurTekst: 'een {{bes|als-blok}} met {{ope|en}} + {{waa|ben ik in mijn basis?}}',
      gedrag: (w) => w.uiterlijkCmds > 0,
      gedragTekst: 'je alarm is echt afgegaan',
    },
    breek: 'Haal het {{ope|niet}}-blok weg. Wanneer roept je tank nu "naar huis"? Precies op het verkeerde moment — namelijk net als je veilig staat.',
  },
  {
    nr: 4,
    titel: 'Ik ren te vroeg de zone weer uit',
    concept: 'Wachten op een voorwaarde',
    probleem: 'Je vlucht naar je teamzone, geneest twee tellen en rijdt er meteen weer uit. Drie seconden later lig je er opnieuw af.',
    ontdekking: 'Tot nu keek je telkens: "is het al zover?" Je kan de computer ook laten wáchten tot iets waar wordt. Zolang dat niet zo is, staat dat stapeltje stil — en de rest van je programma loopt gewoon door.',
    doel: [
      'Sleep een {{geb|🚩}}-blok op een lege plek met een {{bes|herhaal}} eronder.',
      'Zet daarin {{bes|wacht tot}} met {{ope|( ) < ( )}}: {{vrb|mijn levens}} en 40.',
      'Daaronder: {{uit|zeg [ik ga schuilen!]}}.',
      'Daaronder: {{bes|wacht tot}} met {{ope|( ) > ( )}}: {{vrb|mijn levens}} en 80.',
      'En als laatste: {{uit|zeg [ik ben er weer!]}} en {{uit|flits groen}}.',
    ].join('\n'),
    hint: 'Lees je stapeltje hardop: "wacht tot ik bijna dood ben → roep dat je gaat schuilen → wacht tot ik weer sterk ben → roep dat je terug bent". Het blok {{bes|wacht tot}} staat bij {{bes|Besturen}}. Genezen doe je door in je teamzone te blijven staan.',
    check: {
      structuur: (p) => alleCmdsVanProject(p).filter((c) => c.t === 'wachtTot'
        && JSON.stringify(c.c || {}).includes('levens')).length >= 2,
      structuurTekst: 'twee {{bes|wacht tot}}-blokken die naar je {{vrb|levens}} kijken',
      gedrag: (w) => w.uiterlijkCmds > 0,
      gedragTekst: 'je tank heeft echt gemeld dat hij gaat schuilen',
    },
    breek: 'Zet je twee {{bes|wacht tot}}-blokken in dezelfde lus als je besturing. Rijd nu eens rond: je tank staat stil zodra hij staat te wachten. Waarom hoort dit in een eigen stapeltje?',
  },
  {
    nr: 5,
    titel: 'Aanvaller, verdediger of allrounder?',
    concept: 'Een beslisboom in een beslisboom',
    probleem: 'Elk team heeft snelle aanvallers nodig én taaie verdedigers. Met één als-dan-anders kan je maar tussen twee dingen kiezen — en een echte rol vraagt meer.',
    ontdekking: 'Je mag een als-dan-anders in een ándere als-dan-anders zetten. Dan kan je plan drie kanten op: eerst het belangrijkste, daarna de tweede keuze, en anders de rest.',
    doel: [
      'Sleep {{geb|wanneer ik een statpunt krijg}} op een lege plek.',
      'Hang er een {{bes|als … dan … anders}} onder.',
      'Verdediger? Bovenaan: {{ope|waarde van stat kogelpantser < 5}} → {{upg|geef 1 statpunt aan kogelpantser}}.',
      'Zet in het ANDERS-vak nóg een {{bes|als … dan … anders}}.',
      'Daarin: {{ope|waarde van stat max levens < 5}} → {{upg|max levens}}, anders {{upg|snelheid}}.',
      'Aanvaller? Draai de volgorde om: eerst snelheid, dan kogelschade, anders kogelsnelheid.',
    ].join('\n'),
    hint: 'Bouw van buiten naar binnen: eerst het grote als-dan-anders, dan pas het tweede in het onderste vak. Spreek in je team af wie welke rol neemt — vier dezelfde rollen verliest meestal van een gemengd team.',
    check: {
      structuur: (p) => scriptsMet(p, 'statpunt').some((s) => alleCmds(s.body).some((c) => c.t === 'als'
        && [...(c.dan || []), ...(c.anders || [])].some((x) => x.t === 'als'
          && [...alleCmds(x.dan), ...alleCmds(x.anders)].some((y) => y.t === 'geefStat')))),
      structuurTekst: 'een {{bes|als-dan-anders}} met dáárin nog een {{bes|als-dan-anders}} die {{upg|punten uitdeelt}}',
      gedrag: (w) => w.statCmds > 0,
      gedragTekst: 'je plan heeft zelf een statpunt uitgedeeld',
    },
    breek: 'Speel een ronde met het plan van je buur in plaats van je eigen plan. Welk plan wint van welk plan?',
  },
  {
    nr: 6,
    titel: 'Sta ik eigenlijk wel goed?',
    concept: 'Jezelf vergelijken met de klas',
    probleem: 'Je ziet je eigen score staan, maar je hebt geen idee of dat veel of weinig is. Pas op de beamer merk je dat je vierde staat.',
    ontdekking: 'Je tank kan de ranglijst opvragen: hoeveelste je staat, en hoeveel de beste speler heeft. Met die twee getallen kan je zelf uitrekenen hoeveel je achterstaat — en je tank dat laten zeggen.',
    doel: [
      'Maak een variabele en noem hem {{vrb|achterstand}}.',
      'Sleep een {{geb|🚩}}-blok met een {{bes|herhaal}} eronder.',
      'Zet daarin {{vrb|maak achterstand}} = {{ope|( ) − ( )}} met links {{waa|score van de beste speler}} en rechts {{vrb|mijn score}}.',
      'Hang eronder een {{bes|als … dan … anders}} met {{ope|mijn plaats in de ranglijst = 1}}.',
      'In dan: {{uit|zeg [ik sta eerste!]}} · in anders: {{uit|zeg [ik kom eraan!]}}',
      'Sluit af met {{bes|wacht 1 sec.}}, anders roept hij dertig keer per seconde.',
    ].join('\n'),
    hint: 'Plaats 1 is de beste. Speel je alleen, dan sta je natuurlijk meteen eerste — dit blok wordt pas spannend met de hele klas in de arena. Robots tellen niet mee in de ranglijst.',
    check: {
      structuur: (p) => {
        const cmds = alleCmdsVanProject(p);
        const bevat = (e, wat) => !!e && typeof e === 'object'
          && (e.e === wat || bevat(e.a, wat) || bevat(e.b, wat) || bevat(e.v, wat) || bevat(e.c, wat));
        const rekent = cmds.some((c) => (c.t === 'zetVar' || c.t === 'veranderVar') && bevat(c.v, 'besteScore'));
        const kijktNaarPlaats = cmds.some((c) => c.t === 'als' && bevat(c.c, 'mijnPlaats')
          && [...alleCmds(c.dan), ...alleCmds(c.anders)].length > 0);
        return rekent && kijktNaarPlaats;
      },
      structuurTekst: 'een som met {{waa|score van de beste speler}} én een {{bes|als-dan}} op {{waa|mijn plaats}}',
      gedrag: (w) => w.zegCmds > 0,
      gedragTekst: 'je tank heeft zijn stand geroepen',
    },
    breek: 'Haal het {{bes|wacht}}-blok weg. Je tank roept nu onophoudelijk — en je ziet niet eens meer wát hij roept. Waarom is één keer per seconde genoeg?',
  },
];

/*
 * De waarnemer: kijkt mee wat er in het spel gebeurt, zodat we niet alleen de
 * blokken maar ook het échte gedrag kunnen controleren.
 */
const waarnemer = {
  bewogen: 0,          // totaal afgelegde afstand sinds de stap begon
  richtingen: 0,       // hoeveel verschillende richtingen er gereden is
  gedraaid: 0,         // hoeveel het geschut gedraaid heeft
  geschoten: 0,        // aantal afgevuurde kogels
  beweegCmds: 0,       // hoe vaak het programma "beweeg" uitvoerde
  schietCmds: 0,       // hoe vaak het programma "schiet" uitvoerde
  zegCmds: 0,          // hoe vaak het programma "zeg" uitvoerde (stap 7)
  uiterlijkCmds: 0,    // zeg/kleur/flits/geluid samen (stap 8)
  zetVarCmds: 0,       // hoe vaak een variabele een waarde kreeg (stap 9)
  statCmds: 0,         // hoe vaak het programma zelf een statpunt gaf (stap 10)
  signaalCmds: 0,      // hoe vaak een signaal is verstuurd (stap 16)
  ontvangenCmds: 0,    // hoe vaak een signaal ook echt een stapeltje startte
  varGebruikt: false,  // is een eigen variabele opgelopen?
  _vorigePos: null,
  _vorigeHoek: null,
  _richtingen: new Set(),
  _vorigeVars: {},
  _startBeweeg: 0,
  _startSchiet: 0,

  herstart() {
    this.bewogen = 0; this.richtingen = 0; this.gedraaid = 0; this.geschoten = 0;
    this.beweegCmds = 0; this.schietCmds = 0; this.zegCmds = 0;
    this.uiterlijkCmds = 0; this.zetVarCmds = 0; this.statCmds = 0;
    this.signaalCmds = 0; this.ontvangenCmds = 0;
    this.varGebruikt = false;
    this._vorigePos = null; this._vorigeHoek = null;
    this._richtingen = new Set(); this._vorigeVars = {};
    this._startBeweeg = (window.runtime && runtime.telBeweeg) || 0;
    this._startSchiet = (window.runtime && runtime.telSchiet) || 0;
    this._startZeg = (window.runtime && runtime.telZeg) || 0;
    this._startUiterlijk = (window.runtime && runtime.telUiterlijk) || 0;
    this._startZetVar = (window.runtime && runtime.telZetVar) || 0;
    this._startStat = (window.runtime && runtime.telStat) || 0;
    this._startSignaal = (window.runtime && runtime.telSignaal) || 0;
    this._startOntvangen = (window.runtime && runtime.telOntvangen) || 0;
  },

  tik(ik, kogelsVanMij, vars) {
    // commando-tellers lopen ook door als de tank (nog) niet zichtbaar is
    if (window.runtime) {
      this.beweegCmds = runtime.telBeweeg - this._startBeweeg;
      this.schietCmds = runtime.telSchiet - this._startSchiet;
      this.zegCmds = runtime.telZeg - this._startZeg;
      this.uiterlijkCmds = runtime.telUiterlijk - this._startUiterlijk;
      this.zetVarCmds = runtime.telZetVar - this._startZetVar;
      this.statCmds = runtime.telStat - this._startStat;
      this.signaalCmds = runtime.telSignaal - this._startSignaal;
      this.ontvangenCmds = runtime.telOntvangen - this._startOntvangen;
    }
    if (!ik) return;
    if (this._vorigePos) {
      const dx = ik.x - this._vorigePos.x, dy = ik.y - this._vorigePos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) {
        this.bewogen += d;
        // grof in 4 richtingen indelen
        const r = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'omlaag' : 'omhoog');
        this._richtingen.add(r);
        this.richtingen = this._richtingen.size;
      }
    }
    if (this._vorigeHoek !== null) {
      const verschil = Math.abs(Math.atan2(Math.sin(ik.angle - this._vorigeHoek), Math.cos(ik.angle - this._vorigeHoek)));
      this.gedraaid += verschil;
    }
    this._vorigePos = { x: ik.x, y: ik.y };
    this._vorigeHoek = ik.angle;
    this.geschoten += kogelsVanMij;

    for (const [naam, waarde] of Object.entries(vars || {})) {
      if (naam in this._vorigeVars && waarde > this._vorigeVars[naam]) this.varGebruikt = true;
      this._vorigeVars[naam] = waarde;
    }
  },
};

window.STAPPEN = STAPPEN;
window.LES2_STAPPEN = LES2_STAPPEN;
// game.js gebruikt deze twee om te zien of de tank al kan rijden
window.alleCmdsVanProject = alleCmdsVanProject;
window.isRijden = isRijden;
window.stapWaarnemer = waarnemer;
window.blokHtml = blokHtml;
