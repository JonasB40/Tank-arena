/*
 * Twee werkbladen die de editor en de les nodig hebben: het lege startblad,
 * en de voorbeeldoplossing voor de lesgever. "npm test" kijkt na dat die
 * voorbeeldoplossing elke stap van les 1 haalt.
 */

/* ------------------------------------------------------------------ */
/* Startpunt: een LEEG werkblad. De leerling bouwt alles zelf op,      */
/* stap voor stap — het eerste probleem ("ik druk op 🚩 en er gebeurt  */
/* niets") is meteen het krachtigste leermoment van de les.            */
/* ------------------------------------------------------------------ */
const SJABLOON = { blocks: { languageVersion: 0, blocks: [] } };

/* ------------------------------------------------------------------ */
/* Voorbeeldoplossing voor de LESGEVER: de volledige blokkencode die   */
/* de kinderen samen opbouwen. Zo zie je in één oogopslag het einddoel */
/* van les 1 (+ een expert-uitbreiding voor les 2).                    */
/* ------------------------------------------------------------------ */
const bBlok = (type, fields, inputs) => {
  const o = { type };
  if (fields) o.fields = fields;
  if (inputs) o.inputs = inputs;
  return o;
};
const bKetting = (arr) => { for (let i = 0; i < arr.length - 1; i++) arr[i].next = { block: arr[i + 1] }; return arr[0]; };
const bStapel = (arr) => ({ block: bKetting(arr) }); // voor statement-inputs en 'next'
const bVal = (blok) => ({ block: blok });            // voor waarde-inputs
const bNum = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const bHoek = (n) => ({ shadow: { type: 'hoek_getal', fields: { NUM: n } } });

// 1) Besturing: rijden met de pijltjes, richten met de muis, schieten met de muisknop
const solBesturing = bBlok('hat_start');
solBesturing.x = 20; solBesturing.y = 20;
solBesturing.next = bStapel([
  bBlok('zet_kleur', { KLEUR: '#3498db' }),
  bBlok('herhaal_continu', null, { DOEN: bStapel([
    bBlok('richt_muis'),
    // sturen op z'n Scratch: eerst een richting kiezen, dan stappen zetten
    ...[['ArrowUp', 0], ['ArrowRight', 90], ['ArrowDown', 180], ['ArrowLeft', -90]].map(([toets, graden]) =>
      bBlok('als_blok', null, {
        COND: bVal(bBlok('toets_ingedrukt', { TOETS: toets })),
        DAN: bStapel([bBlok('richt_rij', null, { HOEK: bHoek(graden) }), bBlok('neem_stappen', null, { N: bNum(10) })]),
      })),
  ]) }),
]);

/* 1b) Schieten staat in een EIGEN stapeltje (stap 15). Zou het salvo in de
   lus hierboven hangen, dan pauzeert het wacht-blok ook je besturing en sta
   je stil zodra je schiet. Losse stapeltjes draaien wél tegelijk. */
const solSchietMuis = bBlok('hat_start');
solSchietMuis.x = 20; solSchietMuis.y = 430;
solSchietMuis.next = bStapel([
  bBlok('herhaal_continu', null, { DOEN: bStapel([
    bBlok('als_blok', null, {
      COND: bVal(bBlok('muis_ingedrukt')),
      DAN: bStapel([bBlok('herhaal_n', null, {
        N: bNum(3),
        DOEN: bStapel([bBlok('schiet_blok'), bBlok('wacht_blok', null, { SEC: bNum(0.2) })]),
      })]),
    }),
  ]) }),
]);

// 2) De andere manier van schieten (breek-oefening bij stap 6): een losse
//    gebeurtenis in plaats van kijken of de knop ingedrukt is.
const solSchiet = bBlok('hat_toets', { TOETS: ' ' });
solSchiet.x = 20; solSchiet.y = 660;
solSchiet.next = bStapel([bBlok('schiet_blok')]);

// 2b) Je eigen "kracht"-getal uitrekenen (stap 10)
const solKracht = bBlok('hat_start');
solKracht.x = 430; solKracht.y = 700;
solKracht.next = bStapel([
  bBlok('herhaal_continu', null, { DOEN: bStapel([
    bBlok('variables_set', { VAR: { id: 'varKracht' } }, {
      VALUE: bVal(bBlok('op_reken', { OP: '+' }, {
        A: bVal(bBlok('op_reken', { OP: '*' }, {
          A: bVal(bBlok('stat_waarde', { STAT: 'kogelschade' })), B: bNum(2),
        })),
        B: bVal(bBlok('stat_waarde', { STAT: 'kogelsnelheid' })),
      })),
    }),
    bBlok('wacht_blok', null, { SEC: bNum(1) }),
  ]) }),
]);

// 3) Je eigen levensteller (stap 7 en 8): bij de start vullen, en bij elke
//    treffer precies de kracht van díe kogel eraf halen.
const solLevens = bBlok('hat_start');
solLevens.x = 430; solLevens.y = 20;
solLevens.next = bStapel([
  bBlok('variables_set', { VAR: { id: 'varLevens' } }, { VALUE: bVal(bBlok('waarde_blok', { W: 'maxLevens' })) }),
  bBlok('herhaal_continu', null, { DOEN: bStapel([
    bBlok('als_blok', null, {
      COND: bVal(bBlok('raak_ik', { WAT: 'kogel' })),
      DAN: bStapel([
        bBlok('flits_blok', { KLEUR: '#ffffff' }),
        bBlok('speel_geluid', { GELUID: 'tik' }),
        // levens omlaag: 0 − kracht kogel geeft een negatief getal
        bBlok('math_change', { VAR: { id: 'varLevens' } }, {
          DELTA: bVal(bBlok('op_reken', { OP: '-' }, { A: bNum(0), B: bVal(bBlok('kracht_kogel')) })),
        }),
      ]),
    }),
  ]) }),
]);

// 4) Bij een nieuw level: upgrade-keuze tonen
const solLevel = bBlok('hat_levelup');
solLevel.x = 430; solLevel.y = 260;
solLevel.next = bStapel([bBlok('speel_geluid', { GELUID: 'tada' }), bBlok('toon_upgrade')]);

// 5) Bij kapot gaan: iets zeggen
const solDood = bBlok('hat_dood');
solDood.x = 430; solDood.y = 400;
solDood.next = bStapel([bBlok('zeg_blok', { TEKST: 'ik kom sterker terug!' })]);

// 6) EXPERT (les 2): vluchtmodus — als je weinig levens hebt, roep om hulp
const solVlucht = bBlok('hat_start');
solVlucht.x = 820; solVlucht.y = 20;
solVlucht.next = bStapel([
  bBlok('herhaal_continu', null, { DOEN: bStapel([
    bBlok('als_blok', null, {
      COND: bVal(bBlok('op_vergelijk', { OP: '<' }, { A: bVal(bBlok('waarde_blok', { W: 'levens' })), B: bNum(30) })),
      DAN: bStapel([bBlok('flits_blok', { KLEUR: '#e74c3c' }), bBlok('zeg_blok', { TEKST: 'help!' })]),
    }),
    bBlok('wacht_blok', null, { SEC: bNum(1) }),
  ]) }),
]);

// 7) EXPERT: automatisch upgrade-plan — eerst kogelschade, dan snelheid
const solStatplan = bBlok('hat_statpunt');
solStatplan.x = 820; solStatplan.y = 300;
solStatplan.next = bStapel([
  bBlok('als_anders_blok', null, {
    COND: bVal(bBlok('op_vergelijk', { OP: '<' }, { A: bVal(bBlok('stat_waarde', { STAT: 'kogelschade' })), B: bNum(5) })),
    DAN: bStapel([bBlok('stat_geef', { STAT: 'kogelschade' })]),
    ANDERS: bStapel([bBlok('stat_geef', { STAT: 'snelheid' })]),
  }),
]);

/* 8) Kills tellen met het 🏆-blok. Signalen zitten bewust NIET meer in dit
   voorbeeld: die zijn naar les 2 verhuisd, en de blokken staan dus ook niet
   in de lade van les 1. Een voorbeeld met blokken die de leerling nergens
   kan vinden, is erger dan geen voorbeeld. */
const solVersla = bBlok('hat_versla');
solVersla.x = 820; solVersla.y = 540;
solVersla.next = bStapel([
  bBlok('math_change', { VAR: { id: 'varKills' } }, { DELTA: bNum(1) }),
  bBlok('speel_geluid', { GELUID: 'tada' }),
  bBlok('zeg_blok', { TEKST: 'hebbes!' }),
]);

const VOORBEELD_OPLOSSING = {
  variables: [
    { name: 'kills', id: 'varKills' },
    { name: 'kracht', id: 'varKracht' },
    { name: 'Levens', id: 'varLevens' },
  ],
  blocks: { languageVersion: 0, blocks: [solBesturing, solSchietMuis, solSchiet, solKracht, solLevens, solLevel, solDood, solVlucht, solStatplan, solVersla] },
};

window.SJABLOON = SJABLOON;
window.VOORBEELD_OPLOSSING = VOORBEELD_OPLOSSING;
