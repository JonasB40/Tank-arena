/*
 * Tankklassen volgens de diep.io klassenboom (https://diepio.fandom.com/wiki/Tiers).
 * Drie soorten munitie, net als in het echte spel:
 *   kogel — vult zijn loop        (https://diepio.fandom.com/wiki/Bullets)
 *   drone — zoekt zelf vijanden   (https://diepio.fandom.com/wiki/Drones)
 *   trap  — blijft liggen         (https://diepio.fandom.com/wiki/Traps)
 * Smasher-tak = rammen, Stalker = onzichtbaar bij stilstaan.
 * Wordt gedeeld door de server (schieten) en de browser (tekenen).
 *
 * Per klasse:
 *   lopen: [{hoek, zij, len, w, schade?, r?}]  — kanonnen t.o.v. de richthoek
 *   cannon: vorm van het kanon (normaal/sniper/destroyer/machinegeweer/gunner/trapezium)
 *   herlaad/schade/kogelSnelheid: vermenigvuldigers; kogelR: kogelgrootte
 *   spreiding: willekeurige afwijking (machinegeweer-tak)
 *   ram/ramSchade: lichaamsschade i.p.v. schieten; sluip: onzichtbaar bij stilstaan
 *   snelheidBonus: extra beweegsnelheid (achterwaartse "stuwlopen", Smasher-tak)
 */
(function (root) {
  const PI = Math.PI;
  /*
   * In diep.io zijn de lopen fors: ongeveer half zo breed als de romp. Onze
   * eerste versie was veel magerder, waardoor de tanks er pover uitzagen.
   * Deze factor verbreedt alle lopen in één keer — en omdat een kogel zijn
   * loop vult, groeien de kogels netjes mee.
   */
  const LOOP_BREEDTE = 1.5;
  /*
   * De lengte van een loop hoort bij diep.io ongeveer twee keer de straal van
   * de romp te zijn: 1,9x voor de basistank, 2,2x voor de sluipschutter, 2,8x
   * voor de Ranger. Onze sluipschuttertak zat op 2,8 tot 3,4 — die geweren
   * staken als vaarbomen vooruit. De getallen hieronder zijn daarop
   * teruggerekend. (https://diepio.fandom.com/wiki/Sniper)
   */
  const LOOP_LENGTE = 1.22;  // ze staken ook te weinig voorbij de romp uit
  const L = (hoek, zij, len, w, extra) =>
    Object.assign({ hoek, zij, len: len * LOOP_LENGTE, w: w * LOOP_BREEDTE }, extra || {});

  const KLASSEN = {
    /* ---- Tier 1 ---- */
    basis: { naam: 'Basis', tier: 1, cannon: 'normaal', lopen: [L(0, 0, 34, 12)], herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },

    /* ---- Tier 2 (level 15) ---- */
    /* Twin vuurt om de beurt uit de linker- en rechterloop (afwisselend), niet
       twee kogels tegelijk — zie https://diepio.fandom.com/wiki/Twin. Daardoor
       moet hij ook sneller herladen: per schot komt er nu één kogel uit, en
       samen geven die twee lopen ongeveer het dubbele tempo van een basistank
       met wat minder schade per kogel. */
    twin: { naam: 'Twin', tier: 2, cannon: 'normaal', lopen: [L(0, -9, 32, 10), L(0, 9, 32, 10)], afwisselend: true, herlaad: 0.55, schade: 0.7, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    sluipschutter: { naam: 'Sluipschutter', tier: 2, cannon: 'sniper', lopen: [L(0, 0, 40, 12)], herlaad: 1.7, schade: 1.5, kogelSnelheid: 1.6, kogelR: 6, spreiding: 0, zicht: 1.15 },
    /* Wiki: herladen 0,32s (1,88x sneller dan de basistank, niet meer), schade
       0,7x en spreiding +-15 graden. Het was hier te snel EN de kogels waren
       veel te dik: de loop is breed, maar daar komen gewone kogels uit.
       https://diepwiki.io/#/tanks/machine-gun */
    machinegeweer: { naam: 'Machinegeweer', tier: 2, cannon: 'machinegeweer', lopen: [L(0, 0, 34, 18)], herlaad: 0.53, schade: 0.7, kogelSnelheid: 1, kogelSchaal: 0.62, spreiding: 0.26 },
    flankwacht: { naam: 'Flankwacht', tier: 2, cannon: 'normaal', lopen: [L(0, 0, 34, 12), L(PI, 0, 28, 11)], herlaad: 1, schade: 0.85, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },

    /* ---- Tier 3 (level 30) ---- */
    /* De drie lopen stonden bijna tegen elkaar (±20°) en vormden op het scherm
       één brede klomp. In diep.io waaieren ze duidelijk uit, met de middelste
       het langst — daaraan herken je een Triple Shot van een afstand. */
    driedubbel: { naam: 'Driedubbel', tier: 3, cannon: 'normaal', lopen: [L(-0.5, 0, 32, 12), L(0, 0, 34, 12), L(0.5, 0, 32, 12)], herlaad: 1.2, schade: 0.65, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    viertank: { naam: 'Quad-tank', tier: 3, cannon: 'normaal', lopen: [0, PI / 2, PI, -PI / 2].map((h) => L(h, 0, 34, 12)), herlaad: 1.15, schade: 0.6, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    /* Dubbelflank = een Twin die ook naar achter kijkt, dus hij vuurt net als de
       Twin AFWISSELEND: eerst de linkerkant (voor én achter samen), dan de
       rechterkant. Let op de zijkant achteraan: een loop op hoek PI staat
       gespiegeld, dus -9 vooraan hoort visueel bij +9 achteraan — vandaar de
       expliciete groepsnummers in plaats van rekenen met het teken. */
    dubbelflank: {
      naam: 'Dubbelflank', tier: 3, cannon: 'normaal', afwisselend: true,
      lopen: [
        L(0, -10, 34, 11, { groep: 0 }), L(PI, 10, 30, 11, { groep: 0 }),
        L(0, 10, 34, 11, { groep: 1 }), L(PI, -10, 30, 11, { groep: 1 }),
      ],
      herlaad: 0.6, schade: 0.6, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
    },
    /* Jager (Hunter): een breed onderstuk met een smallere, lángere loop erop.
       Het stond omgekeerd — de lange loop was de brede — waardoor je die trap
       niet zag en hij op een gewone sluipschutter leek. */
    jager: {
      naam: 'Jager', tier: 3, cannon: 'sniper',
      /* De twee lopen lagen volledig over elkaar en dat gaf een rommelige naad
         in het midden. Nu staan ze áchter elkaar: een breed onderstuk tegen de
         romp, met daarvoor een smallere loop — de herkenbare trap van Hunter. */
      /* Twee lopen vanaf het midden: eerst de smalle (die steekt er voorbij),
         daarna de brede eroverheen. Samen geven ze de herkenbare trap van de
         Hunter — 95 breed en 110 smal op een romp van 100 in diep.io. */
      lopen: [
        L(0, 0, 40, 12, { schade: 0.6, r: 5 }),
        L(0, 0, 34, 16, { schade: 0.9 }),
      ],
      herlaad: 1.5, schade: 1.2, kogelSnelheid: 1.5, kogelR: 7, spreiding: 0, zicht: 1.15,
    },
    /*
     * Auto 3: drie lopen rondom, én bovenop een torentje dat helemaal ZELF
     * mikt en schiet op wie er in de buurt komt. Je hoeft er niets voor te
     * doen — daarom heet hij "auto". (https://diepio.fandom.com/wiki/Auto_3)
     */
    auto3: {
      naam: 'Auto 3', tier: 3, cannon: 'normaal',
      lopen: [0, (2 * PI) / 3, (4 * PI) / 3].map((h) => L(h, 0, 32, 11)),
      herlaad: 1.25, schade: 0.6, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
      auto: { bereik: 620, herlaadMs: 700, schade: 0.45, len: 20, w: 9, straal: 11 },
    },

    /* Drone- en trap-klassen: schieten geen kogels maar sturen "helpertjes"
       (https://diepio.fandom.com/wiki/Drones) of leggen mijnen die blijven
       liggen (https://diepio.fandom.com/wiki/Traps). */
    opzichter: {
      naam: 'Opzichter (Overseer)', tier: 3, cannon: 'spawner', munitie: 'drone', droneMax: 8,
      /* Een dronefabriek is bij diep.io kort en breed (70 lang, 84 breed op een
         romp van 100): een luik waar de drones uit komen, geen loop. Bij ons
         waren het twee stokjes die langer waren dan breed. */
      lopen: [L(-PI / 2, 0, 24, 25), L(PI / 2, 0, 24, 25)],
      herlaad: 2.4, schade: 1, kogelSnelheid: 1, kogelR: 7, spreiding: 0,
    },
    trapper: {
      naam: 'Valstrikker (Trapper)', tier: 3, cannon: 'launcher', munitie: 'trap',
      /* Kort en stevig, met de trechter duidelijk breder dan de loop — zo
         ziet het eruit als een lanceerbuis en niet als een spies. */
      lopen: [L(0, 0, 28, 13)],
      herlaad: 1.4, schade: 1.3, kogelSnelheid: 0.9, kogelR: 8, spreiding: 0,
    },
    assassin: { naam: 'Assassin', tier: 3, cannon: 'trapezium', lopen: [L(0, 0, 47, 12)], herlaad: 1.9, schade: 1.7, kogelSnelheid: 1.85, kogelR: 6, spreiding: 0, zicht: 1.30 },
    /* Vernietiger: één trage, dikke kogel per 2,4 seconden die 3x zoveel schade
       doet en twee keer zoveel incasseert. De terugslag is enorm (15x) — die
       gebruik je in diep.io om vooruit te komen. https://diepwiki.io/#/tanks/destroyer */
    vernietiger: {
      naam: 'Vernietiger', tier: 3, cannon: 'destroyer', lopen: [L(0, 0, 38, 24)],
      herlaad: 4, schade: 3, kogelLeven: 2, kogelSnelheid: 0.7, kogelSchaal: 1.18, recoil: 15, spreiding: 0,
    },
    /*
     * Gunner: vier evenwijdige lopen, het binnenste paar langer. Ze overlapten
     * elkaar (de randen liepen door elkaar heen) en staken maar tien pixels
     * buiten de romp uit — samen zag dat eruit als één grijze klomp op je tank.
     * Nu liggen ze los van elkaar met een duidelijke tussenruimte en steken ze
     * ver genoeg uit om als vier kanonnen te lezen.
     */
    gunner: {
      naam: 'Gunner', tier: 3, cannon: 'gunner',
      lopen: [L(0, -14, 33, 5.6), L(0, -4.6, 40, 5.6), L(0, 4.6, 40, 5.6), L(0, 14, 33, 5.6)],
      herlaad: 0.5, schade: 0.35, kogelSnelheid: 1.1, kogelR: 4, spreiding: 0.05,
    },
    /* Driehoekstank (Tri-Angle): één gewone loop vooruit, en achter twee
       stuwpijpen die naar achter toe wijder worden. Met dezelfde rechthoek als
       de hoofdloop leken het drie gewone kanonnen. */
    driehoekstank: {
      naam: 'Tri-Angle', tier: 3, cannon: 'normaal',
      lopen: [
        L(0, 0, 34, 12),
        L(PI - 0.62, 0, 27, 10, { schade: 0.25, r: 4, vorm: 'stuw' }),
        L(PI + 0.62, 0, 27, 10, { schade: 0.25, r: 4, vorm: 'stuw' }),
      ],
      herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0, snelheidBonus: 35,
    },
    rammer: { naam: 'Rammer (Smasher)', tier: 3, cannon: 'normaal', lopen: [], herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0, ram: true, ramSchade: 2.5, snelheidBonus: 30 },

    /* ---- Tier 4 (level 45) ---- */
    triplet: { naam: 'Triplet', tier: 4, cannon: 'normaal', lopen: [L(0, -10, 30, 9), L(0, 0, 36, 9), L(0, 10, 30, 9)], herlaad: 0.75, schade: 0.55, kogelSnelheid: 1, kogelR: 5, spreiding: 0 },
    vijfschot: { naam: 'Vijfschot (Penta)', tier: 4, cannon: 'normaal', lopen: [-0.6, -0.3, 0, 0.3, 0.6].map((h) => L(h, 0, h === 0 ? 36 : 30, 10)), herlaad: 1.3, schade: 0.55, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    waaierschot: { naam: 'Waaierschot (Spread)', tier: 4, cannon: 'gunner', lopen: [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2].map((h) => L(h, 0, h === 0 ? 36 : 26, h === 0 ? 11 : 7, h === 0 ? {} : { schade: 0.5, r: 4 })), herlaad: 1.6, schade: 0.6, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    octotank: { naam: 'Octotank', tier: 4, cannon: 'normaal', lopen: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => L((i * PI) / 4, 0, 30, 10)), herlaad: 1.35, schade: 0.5, kogelSnelheid: 1, kogelR: 6, spreiding: 0 },
    drietwin: { naam: 'Drietwin (Triple Twin)', tier: 4, cannon: 'normaal', lopen: [0, (2 * PI) / 3, (4 * PI) / 3].flatMap((h) => [L(h, -8, 30, 9), L(h, 8, 30, 9)]), herlaad: 1.25, schade: 0.55, kogelSnelheid: 1, kogelR: 5, spreiding: 0 },
    ranger: { naam: 'Ranger', tier: 4, cannon: 'trapezium', lopen: [L(0, 0, 50, 12)], herlaad: 2, schade: 1.8, kogelSnelheid: 1.9, kogelR: 6, spreiding: 0, zicht: 1.60 },
    sluiper: { naam: 'Sluiper (Stalker)', tier: 4, cannon: 'sniper', lopen: [L(0, 0, 40, 12)], herlaad: 1.7, schade: 1.5, kogelSnelheid: 1.6, kogelR: 6, spreiding: 0, sluip: true, zicht: 1.15 },
    predator: { naam: 'Predator (Roofdier)', tier: 4, cannon: 'sniper', lopen: [L(0, 0, 32, 16, { schade: 0.5, r: 5 }), L(0, 0, 38, 13, { schade: 0.6 }), L(0, 0, 44, 10, { schade: 0.8 })], herlaad: 1.8, schade: 1.9, kogelSnelheid: 1.7, kogelR: 7, spreiding: 0, zicht: 1.15 },
    /* Annihilator: dezelfde kogel als de Vernietiger, maar uit een nog bredere
       loop en met nog meer terugslag (17x). https://diepwiki.io/#/tanks/annihilator */
    annihilator: {
      naam: 'Annihilator', tier: 4, cannon: 'destroyer', lopen: [L(0, 0, 40, 30)],
      herlaad: 4, schade: 3, kogelLeven: 2, kogelSnelheid: 0.7, kogelSchaal: 1.2, recoil: 17, spreiding: 0,
    },
    sprayer: { naam: 'Sprayer', tier: 4, cannon: 'machinegeweer', lopen: [L(0, 0, 36, 18, { schade: 1 }), L(0, 0, 42, 8, { schade: 0.4, r: 4 })], herlaad: 0.48, schade: 0.6, kogelSnelheid: 1, kogelSchaal: 0.62, spreiding: 0.2 },
    streamliner: { naam: 'Streamliner', tier: 4, cannon: 'gunner', lopen: [L(0, 0, 23, 15), L(0, 0, 27, 13), L(0, 0, 31, 11), L(0, 0, 36, 10), L(0, 0, 40, 9)], herlaad: 0.9, schade: 0.3, kogelSnelheid: 1.4, kogelR: 4, spreiding: 0.03, zicht: 1.15 },
    booster: { naam: 'Booster', tier: 4, cannon: 'normaal', lopen: [L(0, 0, 34, 12), L(PI - 0.5, 0, 24, 8, { schade: 0.2, r: 4 }), L(PI + 0.5, 0, 24, 8, { schade: 0.2, r: 4 }), L(PI - 0.25, 0, 28, 8, { schade: 0.2, r: 4 }), L(PI + 0.25, 0, 28, 8, { schade: 0.2, r: 4 })], herlaad: 1, schade: 0.9, kogelSnelheid: 1, kogelR: 6, spreiding: 0, snelheidBonus: 65 },
    vechter: { naam: 'Vechter (Fighter)', tier: 4, cannon: 'normaal', lopen: [L(0, 0, 34, 12), L(-PI / 2, 0, 30, 10, { schade: 0.6 }), L(PI / 2, 0, 30, 10, { schade: 0.6 }), L(PI - 0.6, 0, 26, 8, { schade: 0.2, r: 4 }), L(PI + 0.6, 0, 26, 8, { schade: 0.2, r: 4 })], herlaad: 1.1, schade: 0.9, kogelSnelheid: 1, kogelR: 6, spreiding: 0, snelheidBonus: 45 },
    overheer: {
      naam: 'Overheer (Overlord)', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 12,
      lopen: [0, PI / 2, PI, -PI / 2].map((h) => L(h, 0, 24, 25)),
      herlaad: 2.1, schade: 1.15, kogelSnelheid: 1.1, kogelR: 7, spreiding: 0,
    },
    /* Auto 5: hetzelfde idee als de Auto 3, maar met vijf lopen. */
    auto5: {
      naam: 'Auto 5', tier: 4, cannon: 'normaal',
      lopen: [0, 1, 2, 3, 4].map((i) => L((i * 2 * PI) / 5, 0, 30, 10)),
      herlaad: 1.35, schade: 0.5, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
      auto: { bereik: 660, herlaadMs: 640, schade: 0.5, len: 20, w: 9, straal: 11 },
    },


    /* ---- Tier 4: de laatste dertien uit de klassenboom van diep.io ----
       Sommige daarvan hebben een eigen kunstje; die staan in het commentaar
       erbij. (https://diepwiki.io/#/tanks) */

    /* Auto Gunner: de vier loopjes van de Gunner én een torentje dat zelf mikt. */
    autogunner: {
      naam: 'Auto Gunner', tier: 4, cannon: 'gunner',
      lopen: [L(0, -14, 40, 8), L(0, -4.6, 49, 8), L(0, 4.6, 49, 8), L(0, 14, 40, 8)],
      herlaad: 0.5, schade: 0.35, kogelSnelheid: 1.2, kogelR: 4, spreiding: 0.05,
      auto: { bereik: 640, herlaadMs: 620, schade: 0.45, len: 20, w: 9, straal: 11 },
    },

    /* Auto Trapper: legt valstrikken én heeft een torentje dat zelf schiet. */
    autotrapper: {
      naam: 'Auto Trapper', tier: 4, cannon: 'launcher', munitie: 'trap',
      lopen: [L(0, 0, 28, 13)],
      herlaad: 1.5, schade: 1.2, kogelSnelheid: 0.9, kogelR: 8, spreiding: 0,
      auto: { bereik: 620, herlaadMs: 700, schade: 0.45, len: 20, w: 9, straal: 11 },
    },

    /* Auto Smasher: rammen én een torentje dat ondertussen zelf schiet. */
    autosmasher: {
      naam: 'Auto Smasher', tier: 4, cannon: 'normaal', lopen: [],
      herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
      ram: true, ramSchade: 3, snelheidBonus: 24,
      auto: { bereik: 600, herlaadMs: 680, schade: 0.5, len: 20, w: 10, straal: 12 },
    },

    /* Landmine: een Rammer die onzichtbaar wordt zodra hij stilstaat. Ga er
       maar eens overheen rijden. */
    landmijn: {
      naam: 'Landmijn (Landmine)', tier: 4, cannon: 'normaal', lopen: [],
      herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
      ram: true, ramSchade: 3.2, snelheidBonus: 18, sluip: true,
    },

    /* Manager: een Opzichter die zelf onzichtbaar wordt. Zijn drones blijven
       wél zichtbaar — die verraden waar hij zit. */
    manager: {
      naam: 'Manager', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 9,
      lopen: [L(-PI / 2, 0, 24, 25), L(PI / 2, 0, 24, 25)],
      herlaad: 2.2, schade: 1.05, kogelSnelheid: 1, kogelR: 7, spreiding: 0, sluip: true,
    },

    /* Necromancer: schiet niet, maar TOVERT kapotte vierkanten om tot zijn
       eigen zwerm. Elk vierkant dat hij stukmaakt wordt een drone. */
    necromancer: {
      naam: 'Necromancer', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 18,
      lopen: [L(-PI / 2, 0, 20, 22), L(PI / 2, 0, 20, 22)],
      herlaad: 3.2, schade: 0.85, kogelSnelheid: 1, kogelR: 7, spreiding: 0,
      necro: true, droneVorm: 'vierkant', vorm: 'vierkant',
    },

    /* Battleship: vier dronebays, dus drones van alle kanten. */
    battleship: {
      naam: 'Battleship', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 12,
      lopen: [PI / 2 - 0.5, PI / 2 + 0.5, -PI / 2 - 0.5, -PI / 2 + 0.5].map((h) => L(h, 0, 20, 18)),
      herlaad: 1.9, schade: 0.75, kogelSnelheid: 1, kogelR: 6, spreiding: 0,
    },

    /* Factory: maakt geen drones maar kleine TANKJES die voor je vechten. */
    fabriek: {
      naam: 'Fabriek (Factory)', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 6,
      lopen: [L(0, 0, 26, 28)],
      herlaad: 2.6, schade: 1.1, kogelSnelheid: 1, kogelR: 9, spreiding: 0,
      droneVorm: 'tank',
    },

    /* Overtrapper: dronebays opzij én een valstrikwerper naar achteren. */
    overtrapper: {
      naam: 'Overtrapper', tier: 4, cannon: 'spawner', munitie: 'drone', droneMax: 6,
      lopen: [
        L(-PI / 2, 0, 22, 22), L(PI / 2, 0, 22, 22),
        L(PI, 0, 26, 13, { munitie: 'trap', vorm: 'launcher' }),
      ],
      herlaad: 2.3, schade: 0.9, kogelSnelheid: 0.9, kogelR: 7, spreiding: 0,
    },

    /* Gunner Trapper: de loopjes van de Gunner vooruit, een valstrik naar achter. */
    gunnertrapper: {
      naam: 'Gunner Trapper', tier: 4, cannon: 'gunner',
      lopen: [
        L(0, -7, 44, 9), L(0, 7, 44, 9),
        L(PI, 0, 26, 13, { munitie: 'trap', vorm: 'launcher' }),
      ],
      herlaad: 0.7, schade: 0.4, kogelSnelheid: 1.15, kogelR: 5, spreiding: 0.05,
    },

    /* Hybrid: het zware kanon van de Vernietiger, met achterop een dronebay. */
    hybride: {
      naam: 'Hybride (Hybrid)', tier: 4, cannon: 'destroyer',
      lopen: [
        L(0, 0, 34, 21),
        L(PI, 0, 20, 20, { munitie: 'drone', vorm: 'spawner' }),
      ],
      herlaad: 4, schade: 3, kogelLeven: 2, kogelSnelheid: 0.7, kogelSchaal: 1.18,
      recoil: 14, spreiding: 0, droneMax: 4,
    },

    /* Skimmer: schiet RAKETTEN die onderweg zelf naar achteren blijven vuren. */
    skimmer: {
      naam: 'Skimmer', tier: 4, cannon: 'destroyer', munitie: 'raket',
      lopen: [L(0, 0, 32, 19)],
      herlaad: 3, schade: 1.6, kogelSnelheid: 0.75, kogelSchaal: 1.05, spreiding: 0,
      raket: { herlaadMs: 190, schade: 0.28, achteruit: true },
    },

    /* Rocketeer: een raket met een stuwmotor — trager op gang, maar hij duwt
       zichzelf steeds harder vooruit. */
    rocketeer: {
      naam: 'Rocketeer', tier: 4, cannon: 'destroyer', munitie: 'raket',
      lopen: [L(0, 0, 30, 22)],
      herlaad: 3.4, schade: 1.9, kogelSnelheid: 0.5, kogelSchaal: 1.15, spreiding: 0,
      raket: { herlaadMs: 150, schade: 0.22, achteruit: true, stuw: 130 },
    },

    dritrapper: {
      naam: 'Drievoudige valstrikker', tier: 4, cannon: 'launcher', munitie: 'trap',
      lopen: [0, (2 * PI) / 3, (4 * PI) / 3].map((h) => L(h, 0, 26, 13)),
      herlaad: 1.6, schade: 1, kogelSnelheid: 0.9, kogelR: 7, spreiding: 0, trapLeven: 10000,
    },
    megatrapper: {
      naam: 'Megavalstrikker', tier: 4, cannon: 'launcher', munitie: 'trap',
      lopen: [L(0, 0, 32, 20)],
      herlaad: 2.6, schade: 2.6, kogelSnelheid: 0.8, kogelR: 13, spreiding: 0,
    },
    stekelbol: { naam: 'Stekelbol (Spike)', tier: 4, cannon: 'normaal', lopen: [], herlaad: 1, schade: 1, kogelSnelheid: 1, kogelR: 6, spreiding: 0, ram: true, ramSchade: 3.5, snelheidBonus: 20, stekels: true },
  };
  /*
   * De upgradeboom (zoals de class tree in diep.io): welke klassen je op
   * level 15/30/45 kan kiezen, afhankelijk van je huidige klasse.
   */
  const UPGRADE_BOOM = {
    basis: { 15: ['twin', 'sluipschutter', 'machinegeweer', 'flankwacht'], 30: ['rammer'] },
    twin: { 30: ['driedubbel', 'viertank', 'dubbelflank'] },
    sluipschutter: { 30: ['jager', 'assassin', 'opzichter', 'trapper'] },
    opzichter: { 45: ['overheer', 'necromancer', 'manager', 'fabriek', 'overtrapper', 'battleship'] },
    trapper: { 45: ['dritrapper', 'megatrapper', 'autotrapper', 'gunnertrapper'] },
    machinegeweer: { 30: ['vernietiger', 'gunner'], 45: ['sprayer'] },
    flankwacht: { 30: ['driehoekstank', 'viertank', 'dubbelflank', 'auto3'] },
    auto3: { 45: ['auto5'] },
    driedubbel: { 45: ['triplet', 'vijfschot', 'waaierschot'] },
    viertank: { 45: ['octotank'] },
    dubbelflank: { 45: ['drietwin'] },
    jager: { 45: ['ranger', 'sluiper', 'streamliner', 'predator'] },
    assassin: { 45: ['ranger', 'sluiper', 'predator'] },
    vernietiger: { 45: ['annihilator', 'hybride', 'skimmer', 'rocketeer'] },
    gunner: { 45: ['streamliner', 'autogunner', 'gunnertrapper'] },
    driehoekstank: { 45: ['booster', 'vechter'] },
    rammer: { 45: ['stekelbol', 'autosmasher', 'landmijn'] },
  };

  /*
   * Hoe ver je van de arena ziet (https://diepio.fandom.com/wiki/Stats).
   * Twee dingen maken je blik ruimer, precies zoals in diep.io:
   *
   *   1. je LEVEL — elk level 1% meer zicht (1,01^level). Als beginner kijk je
   *      dus maar een klein stukje rond je tank; op level 45 zie je ruim
   *      anderhalf keer zoveel veld. Je tank groeit met exact dezelfde factor,
   *      dus hij blijft even groot in beeld: je ziet niet je tank krimpen, je
   *      ziet de wereld groeien. Dat is meteen de beloning van upgraden.
   *   2. je KLASSE — de sluipschuttertak kijkt nog verder (Assassin 1,3x,
   *      Ranger zelfs 1,6x). Dat hoort bij het lange kanon: je schiet ver, dus
   *      je moet ook ver kunnen kijken.
   */
  function zichtVan(klasse, level) {
    const kl = KLASSEN[klasse] || KLASSEN.basis;
    const perLevel = Math.pow(1.01, Math.max(0, (level || 1) - 1));  // lvl 45 = 1,55x
    return (kl.zicht || 1) * perLevel;
  }

  /* Vanaf welk level een tier beschikbaar is. */
  const TIER_LEVEL = { 1: 1, 2: 15, 3: 30, 4: 45 };

  root.KLASSEN = KLASSEN;
  root.UPGRADE_BOOM = UPGRADE_BOOM;
  root.TIER_LEVEL = TIER_LEVEL;
  root.zichtVan = zichtVan;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KLASSEN, UPGRADE_BOOM, TIER_LEVEL, zichtVan };
  }
})(typeof window !== 'undefined' ? window : globalThis);
