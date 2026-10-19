/*
 * Verbindingen: wat een browser aan de server kan vragen.
 * Meedoen, rijden en schieten, upgraden, de beamer, en projecten bewaren.
 * Wat met de les te maken heeft, regelt klaslokaal.js.
 */
const { staat, rooms, beamers } = require('./staat');
const { KLASSEN, ARENA, MAX_SPELERS, STAT_LIJST, KLEUREN, VORM_INFO, klem, maxHpVan, statMaxVan, saneNaam, klasseAanbod, klemF } = require('./regels');
const { magLesgeven } = require('./toegang');
const { codeStempel, codeGewijzigdNaStart } = require('./versie');
const { projecten, bewaarProjectenOpSchijf, CODE_VORM, nieuweProjectCode } = require('./projecten');
const { maakRoom, zetTeamModus, lesgeverZetTeams, wijsTeamToe, nieuweTank, spawnTank, vindTank } = require('./wereld');
const { zorgVoorAI } = require('./robots');
const { koppelKlaslokaal } = require('./klaslokaal');

function startVerbindingen() {
  staat.io.on('connection', (socket) => {
    let laatsteActieMsg = 0;
    koppelKlaslokaal(socket);

    socket.on('join', (data) => {
      const totaal = [...rooms.values()].reduce((n, r) => n + [...r.tanks.values()].filter((t) => !t.ai).length, 0);
      if (totaal >= MAX_SPELERS) { socket.emit('vol'); return; }

      verlaatRoom(socket);
      const modus = data && data.modus === 'samen' ? 'samen' : 'solo';
      const roomId = modus === 'solo' ? `solo-${socket.id}` : 'arena';
      const room = rooms.get(roomId) || maakRoom(roomId, modus === 'solo', data && data.niveau);

      const t = nieuweTank(socket.id, saneNaam(data && data.naam));
      t.kleur = KLEUREN[Math.floor(Math.random() * 8)];
      /* Alleen om te testen: start meteen met een bepaalde klasse en een hoog
         level, zodat je niet eerst een half uur moet spelen om te zien of een
         nieuwe klasse klopt. Staat uit zolang de omgevingsvariabele leeg is. */
      if (process.env.TESTSPELERKLASSE && KLASSEN[process.env.TESTSPELERKLASSE]) {
        t.klasse = process.env.TESTSPELERKLASSE;
        if (KLASSEN[t.klasse].vorm) t.vorm = KLASSEN[t.klasse].vorm;
        t.level = Number(process.env.TESTLEVEL) || 30;
        t.maxHp = maxHpVan(t);
        t.hp = t.maxHp;
      }
      room.tanks.set(socket.id, t);
      if (room.teamModus) wijsTeamToe(room, t);
      spawnTank(room, t);
      socket.join(roomId);
      socket.data.roomId = roomId;
      /*
       * De vaste eigenschappen van elke vormsoort (kleur, grootte, max levens)
       * sturen we ÉÉN keer mee. Vroeger stond dat bij elk blokje in elk
       * pakketje: met tachtig vormen in beeld was dat 11 KB, twintig keer per
       * seconde, per leerling. Nu sturen we per vorm alleen nog wat verandert.
       */
      socket.emit('welkom', {
        id: t.nr, arena: room.arena, modus, vormSoorten: VORM_INFO,
        versie: codeStempel(), verouderd: codeGewijzigdNaStart(),
      });
      zorgVoorAI(room);
    });

    /* De blokjes-runtime in de browser stuurt intents: hoe wil de tank bewegen? */
    /*
     * De rode stopknop van de leerling: zet zijn eigen arena op pauze. Alleen in
     * solo — in de gedeelde arena spelen klasgenoten door, en daar mag één
     * leerling het spel niet voor iedereen stilleggen.
     */
    socket.on('pauze', (aan) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.solo) return;
      room.gepauzeerd = !!aan;
    });

    socket.on('intent', (inp) => {
      const t = vindTank(socket);
      if (!t || !inp) return;
      /* Een oneindige hoek (een kind dat "richt op 10^400 graden" bouwt) maakte
         van de terugslag NaN, en dan stond de tank voorgoed nergens meer. */
      const hoek = Number(inp.angle);
      t.intent = {
        mx: klemF(inp.mx, -1, 1), my: klemF(inp.my, -1, 1),
        angle: Number.isFinite(hoek) ? hoek : (t.intent.angle || 0),
        shoot: !!inp.shoot,
        // waar de muis in de wereld staat: drones vliegen daar naartoe
        tx: klem(Number(inp.tx) || t.x, 0, arenaVan(socket).w),
        ty: klem(Number(inp.ty) || t.y, 0, arenaVan(socket).h),
      };
    });

    /* Uiterlijk-blokken: zeg / kleur / flits. */
    socket.on('actie', (a) => {
      const t = vindTank(socket);
      if (!t || !a) return;
      if (Date.now() - laatsteActieMsg < 150) return;
      laatsteActieMsg = Date.now();
      if (a.kleur && KLEUREN.includes(a.kleur)) t.kleur = a.kleur;
      if (a.vorm && ['cirkel', 'driehoek', 'vierkant', 'vijfhoek', 'ster'].includes(a.vorm)) t.vorm = a.vorm;
      if (typeof a.zeg === 'string') { t.sayText = a.zeg.replace(/[<>]/g, '').slice(0, 30); t.sayUntil = Date.now() + 2500; }
      if (a.flits && KLEUREN.includes(a.flits)) { t.flashKleur = a.flits; t.flashUntil = Date.now() + 400; }
    });

    /* Upgrade-popups: klasse kiezen op 15/30/45, statpunten verdelen. */
    socket.on('kiesKlasse', (data) => {
      const t = vindTank(socket);
      if (!t || !data) return;
      // testmodus: dan mag elke klasse, zodat je ze kan uitproberen zonder eerst
      // naar level 45 te moeten spelen (staat uit zonder omgevingsvariabele)
      const magAlles = !!process.env.TESTVRIJEKLASSE && !!KLASSEN[data.klasse];
      if (magAlles || klasseAanbod(t).includes(data.klasse)) {
        /* Je oude drones gaan mee met je oude klasse. Anders hield een leerling
           die van Necromancer naar Manager ging zijn zwerm van achttien, terwijl
           een Manager er maar negen mag hebben — en met een gewone tank vlogen
           er ineens drones rond die nergens meer bij hoorden. */
        const room0 = rooms.get(socket.data.roomId);
        if (room0) for (const b of room0.bullets) if (b.soort === 'drone' && b.eigenaar === t.id) b.weg = true;
        t.klasse = data.klasse;
        // sommige klassen hebben een eigen romp (de Necromancer is een vierkant)
        const kl = KLASSEN[t.klasse];
        if (kl && kl.vorm) t.vorm = kl.vorm;
        t.maxHp = maxHpVan(t);
        t.hp = Math.min(t.hp, t.maxHp);
      }
    });

    socket.on('kiesStat', (data) => {
      const t = vindTank(socket);
      if (!t || !data || t.statPunten <= 0) return;
      const stat = STAT_LIJST.includes(data.stat) ? data.stat : null;
      if (!stat || t.stats[stat] >= statMaxVan(t)) return;
      t.stats[stat]++;
      t.statPunten--;
      const oudMax = t.maxHp;
      t.maxHp = maxHpVan(t);
      if (t.maxHp > oudMax) t.hp += t.maxHp - oudMax; // extra max levens = meteen erbij
    });

    /* De beamer kijkt mee naar de gedeelde arena. Meekijken mag iedereen (het is
       een scorebord); de teamknoppen werken alleen voor de lesgever. */
    socket.on('beamer', (d) => {
      if (!rooms.has('arena')) maakRoom('arena', false);
      socket.join('arena');
      socket.data.isBeamer = true;
      if (magLesgeven(socket, d && d.sleutel)) socket.data.isLesgever = true;
      beamers.add(socket.id);
      // ook de beamer tekent de vormen, dus die heeft de soortentabel nodig
      socket.emit('vormSoorten', VORM_INFO);
      socket.emit('beamerRechten', { teams: !!socket.data.isLesgever });
    });

    /*
     * De browser vertelt hoe groot zijn kijkvenster is (dat verschilt: een
     * sluipschutter zoomt uit, en een chromebook heeft een kleiner scherm).
     * Zo weet de server precies hoeveel wereld hij moet opsturen.
     */
    socket.on('kijk', (d) => {
      const t = vindTank(socket);
      if (!t || !d) return;
      t.kijk = {
        w: Math.max(600, Math.min(6000, Number(d.w) || 2600)),
        h: Math.max(400, Math.min(4000, Number(d.h) || 1600)),
      };
    });

    /* Les 2: de lesgever (via de beamer) kiest 0, 2 of 4 teams. */
    socket.on('zetTeams', (n) => {
      if (!socket.data.isLesgever) return;
      lesgeverZetTeams(Number(n));
    });

    /*
     * Een leerling die in het startmenu "2 teams" of "4 teams" kiest, zet die
     * opstelling aan als er nog niets gekozen is — anders klikt hij op iets dat
     * niets doet en staat hij zonder veilige zone in de arena. Staat er al een
     * opstelling, of heeft de lesgever gekozen, dan blijft die staan: de
     * lesgever heeft altijd het laatste woord.
     */
    socket.on('kiesTeams', (n) => {
      if (![2, 4].includes(n)) return;
      const room = rooms.get(socket.data.roomId);
      if (!room || room.solo || room.teamModus || room.teamsDoorLesgever) return;
      zetTeamModus(room, n);
    });

    /* Project bewaren (autosave vanuit de editor) en terug ophalen. */
    let laatsteBewaar = 0;
    socket.on('bewaarProject', (d, cb) => {
      if (!d || typeof cb !== 'function') return;
      if (Date.now() - laatsteBewaar < 2000) return;
      laatsteBewaar = Date.now();
      const inhoud = JSON.stringify(d.werkruimte || {});
      if (inhoud.length > 200000) return; // te groot = niet bewaren
      const bestaand = typeof d.code === 'string' && CODE_VORM.test(d.code) && projecten[d.code] ? d.code : null;
      /* Eén verbinding maakt hooguit één nieuwe code aan. Zo kan niemand met een
         lusje in de console de schijf volschrijven met duizenden projecten. */
      const code = bestaand || socket.data.projectCode || nieuweProjectCode();
      socket.data.projectCode = code;
      projecten[code] = { naam: saneNaam(d.naam), werkruimte: d.werkruimte, bijgewerkt: Date.now() };
      bewaarProjectenOpSchijf();
      cb({ code });
    });

    let laatsteLaad = 0;
    socket.on('laadProject', (d, cb) => {
      if (typeof cb !== 'function') return;
      // niet eindeloos codes kunnen raden
      if (Date.now() - laatsteLaad < 400) { cb({ ok: false }); return; }
      laatsteLaad = Date.now();
      const code = String((d && d.code) || '').toUpperCase().trim();
      const p = CODE_VORM.test(code) ? projecten[code] : null;
      cb(p ? { ok: true, naam: p.naam, werkruimte: p.werkruimte } : { ok: false });
    });

    socket.on('verlaat', () => verlaatRoom(socket));
    socket.on('disconnect', () => {
      beamers.delete(socket.id);
      verlaatRoom(socket);
    });
  });
}

/* De arena waarin deze socket speelt (voor handlers zonder room-variabele). */
function arenaVan(socket) {
  const room = rooms.get(socket.data.roomId);
  return room ? room.arena : ARENA;
}

function verlaatRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) {
    room.tanks.delete(socket.id);
    const spelersOver = [...room.tanks.values()].some((t) => !t.ai);
    if (!spelersOver && room.id !== 'arena') rooms.delete(roomId);
  }
  socket.leave(roomId);
  socket.data.roomId = null;
}

module.exports = { startVerbindingen };
