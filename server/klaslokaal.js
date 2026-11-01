/*
 * Het klaslokaal: wat het lesgeversdashboard ziet en kan.
 * Elke leerling meldt om de paar seconden zijn stap en status; de lesgever
 * krijgt elke anderhalve seconde het overzicht, en kan tips sturen, een
 * leerling verder zetten, blokken bekijken en aanpassen, of de klas bevriezen.
 */
const { staat, rooms, beamers } = require('./staat');

/* Waarom steekt een leerling zijn hand op? Hij kiest het zelf bij de knop. */
const HULP_REDENEN = ['werkt-niet', 'snap-niet', 'blok-zoeken', 'klaar', 'iets-anders'];

/* Iets naar elke beamer sturen. */
function naarBeamers(soort, d) {
  for (const id of beamers) staat.io.to(id).emit(soort, d);
}
/* Wie staat er op de beamer, en hoe ver is hij? (null = niemand) */
function spotlightInfo() {
  const s = staat.spotlight;
  const l = s && klas.get(s.id);
  return s ? { id: s.id, naam: l ? l.naam : s.naam, les: l ? l.les : 1, stap: l ? l.stap : 1 } : null;
}
const { klem, saneNaam } = require('./regels');
const { LESGEVER_SLEUTEL, magLesgeven } = require('./toegang');
const { codeGewijzigdNaStart } = require('./versie');
const { BEWAAR_DAGEN, aantalProjecten, wisAlleProjecten } = require('./projecten');
const { maakRoom, startRonde, rondeStand, stopRonde, lesgeverZetTeams, vindTank } = require('./wereld');

/* Wie zit waar in de les? (socket-id → {naam, stap, status}) */
const klas = new Map();
/* Wie volgt wie? (socket-id van de lesgever → socket-id van de leerling) */
const gevolgd = new Map();
/* Live meekijken: de gevolgde leerlingen om hun blokken vragen. */
function vraagGevolgdeBlokkenOp() {
  const leerlingen = new Set();
  for (const [lesgever, id] of gevolgd) {
    if (klas.has(id)) leerlingen.add(id);
    else gevolgd.delete(lesgever);   // weg uit de les: niet blijven vragen
  }
  // de leerling op de beamer: zijn blokken staan daar ook live
  if (staat.spotlight) {
    leerlingen.add(staat.spotlight.id);
    naarBeamers('spotlight', spotlightInfo());   // zijn stap kan intussen veranderd zijn
  }
  for (const id of leerlingen) staat.io.to(id).emit('lesStuur', { type: 'stuurCode' });
}

/*
 * Het klasrapport: hoe ver kwam elke leerling, en hoe lang deed de klas over
 * elke stap? We houden per leerling de hoogste stap bij en wanneer hij die
 * bereikte. Zo kan je na de les zien waar het spaak liep — en waar je de
 * volgende keer meer tijd voor uittrekt.
 */
const rapport = new Map();   // "les|naam" -> { naam, les, maxStap, begonnen, stapTijden }

function noteerVoortgang(naam, les, stap) {
  // les 1 en les 2 apart: stap 3 van les 2 is iets heel anders dan stap 3 van les 1
  const sleutel = `${les}|${naam}`;
  let r = rapport.get(sleutel);
  if (!r) { r = { naam, les, maxStap: stap, begonnen: Date.now(), stapTijden: {}, laatst: Date.now() }; rapport.set(sleutel, r); }
  r.laatst = Date.now();
  if (stap > r.maxStap) r.maxStap = stap;
  if (!r.stapTijden[stap]) r.stapTijden[stap] = Date.now();
}

function maakRapport() {
  const nu = Date.now();
  const leerlingen = [...rapport.values()].map((r) => {
    const stappen = Object.keys(r.stapTijden).map(Number).sort((a, b) => a - b);
    const duur = {};
    stappen.forEach((nr, i) => {
      const eind = i + 1 < stappen.length ? r.stapTijden[stappen[i + 1]] : r.laatst;
      duur[nr] = Math.max(0, Math.round((eind - r.stapTijden[nr]) / 1000));
    });
    return { naam: r.naam, les: r.les, maxStap: r.maxStap, minuten: Math.round((r.laatst - r.begonnen) / 60000), duur, hulp: r.hulp || 0 };
  }).sort((a, b) => b.les - a.les || b.maxStap - a.maxStap || a.naam.localeCompare(b.naam));
  // gemiddelde tijd per stap over de hele klas ("2-3" = les 2, stap 3)
  const perStap = {};
  for (const l of leerlingen) {
    for (const [nr, sec] of Object.entries(l.duur)) {
      const sleutel = l.les === 2 ? `2-${nr}` : nr;
      (perStap[sleutel] || (perStap[sleutel] = [])).push(sec);
    }
  }
  const gemiddeld = Object.fromEntries(Object.entries(perStap).map(([nr, lijst]) => [
    nr, Math.round(lijst.reduce((a, b) => a + b, 0) / lijst.length),
  ]));
  return { gemaakt: nu, leerlingen, gemiddeld };
}

/* Klasoverzicht naar de lesgever(s) sturen. */
function stuurKlasoverzicht() {
  const nu = Date.now();
  const lijst = [...klas.entries()]
    .filter(([, l]) => nu - l.bijgewerkt < 15000)
    .map(([id, l]) => ({
      id, naam: l.naam, les: l.les || 1, stap: l.stap, status: l.status,
      blokken: l.blokken || 0, stilMs: l.stilMs || 0,
      minuten: Math.floor((nu - l.sinds) / 60000),
      checkS: !!l.checkS, checkG: !!l.checkG, code: l.code || '',
      // welke stappen heeft hij al gehaald? (zo zie je of hij voor of achter zit)
      gehaald: l.gehaald || [], hint: !!l.hint,
      // wat valt er op aan zijn programma? (losse stapeltjes, geen startblok, staat het uit?)
      los: l.los || 0, geenStart: !!l.geenStart, draait: !!l.draait, verouderd: !!l.verouderd,
      lvl: l.lvl || 0, punten: l.punten || 0, hp: l.hp || 0, klasse: l.klasse, speelt: !!l.speelt,
      hulp: !!l.hulp, hulpMin: l.hulp && l.hulpSinds ? Math.floor((nu - l.hulpSinds) / 60000) : 0,
      hulpKeer: l.hulpKeer || 0,   // hoe vaak stak hij al zijn hand op?
      hulpReden: l.hulp ? l.hulpReden || null : null,   // en waarom nu?
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  const arena = rooms.get('arena');
  staat.io.to('lesgevers').emit('klasoverzicht', {
    leerlingen: lijst,
    bevroren: staat.bevroren,
    klasStil: staat.klasStil,   // heeft de lesgever het geluid van de klas uitgezet?
    spotlight: staat.spotlight ? staat.spotlight.id : null,   // wie staat er op de beamer?
    teamModus: arena ? arena.teamModus : 0,
    inArena: arena ? [...arena.tanks.values()].filter((t) => !t.ai).length : 0,
    // loopt er een ronde? dan de klok en de tussenstand mee
    ronde: arena && arena.ronde
      ? { over: Math.max(0, Math.round((arena.ronde.eind - nu) / 1000)),
          doel: arena.ronde.doel, soort: arena.ronde.soort, teams: rondeStand(arena).teams,
          heuvel: arena.heuvelStand || null }
      : null,
    verouderd: codeGewijzigdNaStart(),   // code aangepast sinds het starten?
    // hoeveel projecten (met namen van kinderen) staan er bewaard, en hoe lang?
    projecten: { aantal: aantalProjecten(), bewaarDagen: BEWAAR_DAGEN },
  });
}

/* De berichten van één browser die met de les te maken hebben. */
function koppelKlaslokaal(socket) {
  /* Wie binnenkomt terwijl de lesgever "ogen op mij" heeft aangezet (of zijn
     pagina ververst), hoort ook meteen stil te staan. */
  if (staat.bevroren) socket.emit('lesStuur', { type: 'bevries', aan: true });
  if (staat.klasStil) socket.emit('lesStuur', { type: 'geluid', aan: false });

  /* ---------------- de les: klasoverzicht voor de lesgever ---------------- */
  socket.on('lesStatus', (d) => {
    if (!d) return;
    const oud = klas.get(socket.id) || {};
    // een stapnummer dat geen getal is, werd NaN en bleef dan zo in het rapport staan
    const stap = klem(Math.round(Number(d.stap)) || 1, 1, 20);
    /* Les 2 heeft eigen stappen met eigen nummers (1-6). Zonder dit stond een
       les-2-leerling op het dashboard als "stap 3" van les 1. */
    const les = d.les === 2 ? 2 : 1;
    const t = vindTank(socket);
    klas.set(socket.id, {
      naam: saneNaam(d.naam),
      les,
      stap,
      status: ['bezig', 'klaar', 'vast'].includes(d.status) ? d.status : 'bezig',
      // hoeveel blokken staan er, en hoe lang is er al niets veranderd?
      blokken: klem(Number(d.blokken) || 0, 0, 999),
      stilMs: klem(Number(d.stilMs) || 0, 0, 99 * 60000),
      /* Welke van de twee vinkjes staat al groen? Daarmee zie je als lesgever
         meteen of het aan de blokken ligt (structuur) of aan het uitproberen
         (gedrag) — je weet wat je moet zeggen nog voor je bij de tafel bent. */
      checkS: !!d.checkS,
      checkG: !!d.checkG,
      // de stappen die hij al haalde (getallen 1-20), en of zijn hint openstaat
      gehaald: Array.isArray(d.gehaald)
        ? [...new Set(d.gehaald.slice(0, 40).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 20))].sort((a, b) => a - b)
        : [],
      hint: !!d.hint,
      /* Wat valt er op aan zijn programma? Zijn toestel kijkt het na: hoeveel
         stapeltjes hangen los, staat er nergens een startblok, loopt het
         programma, en is het veranderd zonder opnieuw te starten? De meeste
         "hij doet niets!"-vragen zijn precies een van die vier. */
      los: klem(Math.round(Number(d.los)) || 0, 0, 99),
      geenStart: !!d.geenStart,
      draait: !!d.draait,
      verouderd: !!d.verouderd,
      code: String(d.code || '').slice(0, 12),
      // hoe staat hij ervoor in het spel zelf?
      lvl: t ? t.level : 0,
      punten: t ? t.score : 0,
      hp: t ? Math.round((t.hp / t.maxHp) * 100) : 0,
      klasse: t ? t.klasse : null,
      speelt: !!t,
      hulp: !!oud.hulp,
      hulpSinds: oud.hulpSinds || 0,
      hulpKeer: oud.hulpKeer || 0,
      hulpReden: oud.hulpReden || null,
      sinds: oud.stap === stap && oud.les === les ? oud.sinds || Date.now() : Date.now(),
      bijgewerkt: Date.now(),
    });
    // voor het klasrapport achteraf: hoe ver kwam iedereen, en wanneer?
    noteerVoortgang(saneNaam(d.naam), les, stap);
  });

  /* De leerling steekt zijn hand op (of doet hem weer omlaag). */
  socket.on('hulpVraag', (d) => {
    const l = klas.get(socket.id);
    if (!l) return;
    /* Vroeger alleen aan/uit; nu ook waarom ({ aan, reden }). Een oude
       browser die nog true/false stuurt, werkt gewoon verder. */
    const aan = d && typeof d === 'object' ? !!d.aan : !!d;
    l.hulpReden = aan && d && HULP_REDENEN.includes(d.reden) ? d.reden : null;
    if (aan && !l.hulp) {
      /* Tellen hoe vaak: wie om het kwartier zijn hand opsteekt, heeft meer
         nodig dan een tip — dat zie je op zijn kaartje en in het rapport. */
      l.hulpKeer = (l.hulpKeer || 0) + 1;
      const r = rapport.get(`${l.les}|${l.naam}`);
      if (r) r.hulp = (r.hulp || 0) + 1;
    }
    // nog eens "hand op" terwijl hij al omhoog was: de wachttijd loopt gewoon door
    l.hulpSinds = aan ? (l.hulp && l.hulpSinds) || Date.now() : 0;
    l.hulp = !!aan;
  });

  /* De lesgever kijkt mee en stuurt de klas — maar alleen met de juiste code
     (of vanaf de laptop zelf). Zie magLesgeven bovenaan. */
  let foutePogingen = 0;
  socket.on('lesgever', (d) => {
    if (foutePogingen >= 8) { socket.emit('lesgeverToegang', { ok: false, teVeel: true }); return; }
    if (!magLesgeven(socket, d && d.sleutel)) {
      foutePogingen++;
      socket.emit('lesgeverToegang', { ok: false });
      return;
    }
    socket.data.isLesgever = true;
    socket.join('lesgevers');
    // de code meesturen, zodat je ziet wat je op een ander toestel moet typen
    socket.emit('lesgeverToegang', { ok: true, sleutel: LESGEVER_SLEUTEL });
  });

  socket.on('lesCommando', (d) => {
    if (!socket.data.isLesgever || !d) return;
    if (d.type === 'stap' && Number.isFinite(d.stap)) {
      // voor welke les? een les-2-leerling springt niet mee met de stappen van les 1
      staat.io.emit('lesStuur', { type: 'stap', stap: klem(d.stap, 1, 20), les: d.les === 2 ? 2 : 1 });
    } else if (d.type === 'bevries') {
      staat.bevroren = !!d.aan;
      staat.io.emit('lesStuur', { type: 'bevries', aan: staat.bevroren });
    } else if (d.type === 'geluid') {
      /* Vijfentwintig laptops die bij elk schot "pew" doen: de lesgever zet het
         geluid van de hele klas in één keer uit (en weer aan). */
      staat.klasStil = !d.aan;
      staat.io.emit('lesStuur', { type: 'geluid', aan: !staat.klasStil });
    } else if (d.type === 'toonCode') {
      staat.io.to(d.id).emit('lesStuur', { type: 'stuurCode' }); // vraag de leerling zijn blokken
    } else if (d.type === 'volg') {
      /* Live meekijken: zolang dit aanstaat vragen we de blokken elke 2 sec op.
         Eén leerling per lesgever. Vroeger bleef de vorige leerling óók
         gevolgd als je een nieuwe koos, en sprong het werkblad om de twee
         seconden heen en weer tussen die twee — je aanpassingen incluis. */
      if (d.aan && typeof d.id === 'string') gevolgd.set(socket.id, d.id);
      else gevolgd.delete(socket.id);
    } else if (d.type === 'bericht') {
      /* Een tip sturen vanachter je eigen scherm: naar één leerling of naar de
         hele klas. Precies waarvoor de lesgever anders door het lokaal moet. */
      const tekst = String(d.tekst || '').slice(0, 300);
      if (!tekst) return;
      const pakket = { type: 'bericht', tekst, aan: d.id ? 'jou' : 'klas' };
      if (d.id) staat.io.to(d.id).emit('lesStuur', pakket);
      else staat.io.emit('lesStuur', pakket);
    } else if (d.type === 'stapVoor' && Number.isFinite(d.stap) && d.id) {
      // één leerling verzetten zonder de rest mee te sleuren
      staat.io.to(d.id).emit('lesStuur', { type: 'stap', stap: klem(d.stap, 1, 20), alleenJij: true });
    } else if (d.type === 'zetWerkruimte' && d.id && d.werkruimte) {
      // de lesgever grijpt in: zijn versie van de blokken gaat naar de leerling
      if (JSON.stringify(d.werkruimte).length < 200000) {
        staat.io.to(d.id).emit('lesStuur', { type: 'werkruimte', werkruimte: d.werkruimte });
      }
    } else if (d.type === 'opruimen' && d.id) {
      staat.io.to(d.id).emit('lesStuur', { type: 'opruimen' });
    } else if (d.type === 'hulpKlaar' && d.id) {
      const l = klas.get(d.id);
      if (l) { l.hulp = false; l.hulpSinds = 0; l.hulpReden = null; }
      staat.io.to(d.id).emit('lesStuur', { type: 'hulpKlaar' });
    } else if (d.type === 'beamer') {
      /* Een leerling groot op de beamer: zijn tank (wat hij ziet) en zijn
         blokken, zodat de klas samen kijkt hoe hij het oploste. id = null zet
         de beamer terug op de arena. */
      const id = typeof d.id === 'string' && klas.has(d.id) ? d.id : null;
      staat.spotlight = id ? { id, naam: klas.get(id).naam } : null;
      naarBeamers('spotlight', spotlightInfo());
      if (id) staat.io.to(id).emit('lesStuur', { type: 'stuurCode' });
    } else if (d.type === 'teams' && [0, 2, 4].includes(Number(d.n))) {
      lesgeverZetTeams(Number(d.n));
    } else if (d.type === 'naarArena') {
      staat.io.emit('lesStuur', { type: 'naarArena', teams: [0, 2, 4].includes(Number(d.teams)) ? Number(d.teams) : 0 });
    } else if (d.type === 'ronde') {
      if (!rooms.has('arena')) maakRoom('arena', false);
      startRonde(rooms.get('arena'), Number(d.minuten) || 10, Number(d.doel) || 0, d.soort === 'heuvel' ? 'heuvel' : 'punten');
    } else if (d.type === 'rondeStop') {
      const arena = rooms.get('arena');
      if (arena && arena.ronde) stopRonde(arena, 'lesgever');
      else if (arena) { arena.uitslagTot = 0; arena.gepauzeerd = false; }
    } else if (d.type === 'rapport') {
      socket.emit('klasrapport', maakRapport());
    } else if (d.type === 'wisProjecten' && d.bevestig === 'WIS') {
      /* Alle projectcodes en hun blokken weg, bv. aan het eind van een
         lessenreeks. Alleen met de bevestiging die het dashboard meestuurt. */
      socket.emit('projectenGewist', { aantal: wisAlleProjecten() });
    }
  });

  /* Leerling stuurt zijn blokken door zodat de lesgever ze kan projecteren. */
  socket.on('mijnCode', (d) => {
    const code = {
      id: socket.id,
      naam: saneNaam(d && d.naam),
      tekst: String((d && d.tekst) || '').slice(0, 4000),
      // het hele werkblad, zodat de lesgever dezelfde blokken ziet als de leerling
      werkruimte: d && d.werkruimte && JSON.stringify(d.werkruimte).length < 200000 ? d.werkruimte : null,
    };
    staat.io.to('lesgevers').emit('leerlingCode', code);
    // staat hij op de beamer? dan daar ook
    if (staat.spotlight && staat.spotlight.id === socket.id) naarBeamers('spotlightCode', code);
  });

  socket.on('disconnect', () => {
    klas.delete(socket.id);
    gevolgd.delete(socket.id);
    // wie op de beamer stond en weggaat: de beamer gaat terug naar de arena
    if (staat.spotlight && staat.spotlight.id === socket.id) {
      staat.spotlight = null;
      naarBeamers('spotlight', null);
    }
  });
}

/* Klaar om te starten: live meekijken en het klasoverzicht beginnen te lopen. */
function startKlaslokaal() {
  setInterval(vraagGevolgdeBlokkenOp, 2000);
  setInterval(stuurKlasoverzicht, 1500);
}

module.exports = { koppelKlaslokaal, startKlaslokaal };
