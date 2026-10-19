/*
 * De spel-lus: dertig keer per seconde bewegen, schieten, botsen en raken.
 * De server is de scheidsrechter: wat hier gebeurt, is wat er gebeurt.
 */
const { staat, rooms } = require('./staat');
const { TANK_RADIUS, RECOIL_KRACHT, straalVan, BULLET_SPEED, BULLET_LIFE, RESPAWN_MS, klem, klasseVan, regenPerSec, bulletSchadeVan, bulletSnelheidFactor, bulletPierce, herlaadMsVan, snelheidVan, VERSNELLING, WRIJVING, botsschadeVan } = require('./regels');
const { meldFout, elke } = require('./klok');
const { basisVan, inBasis, TEAM_KLEUREN, teamZones, inEigenZone, bewaakRonde, buurVormen, vakNr, bouwVormRaster, vormenRondom, vulVormenAan, nestVan, isVeilig, respawnZwakker, stuurEvent, geefPunten } = require('./wereld');
const { zorgVoorAI, stuurAI } = require('./robots');

let vorigeTick = Date.now();

function startSpellus() {
  elke(1000 / 30, () => {
    const nu = Date.now();
    const dt = Math.min(0.1, (nu - vorigeTick) / 1000);
    vorigeTick = nu;
  
    for (const room of rooms.values()) {
      try { tickRoom(room, nu, dt); } catch (err) { meldFout(`arena ${room.id}`, err); }
    }
  });
}

function tickRoom(room, nu, dt) {
  /*
   * "Ogen op mij": dan staat ELKE arena stil. Vroeger stonden alleen de tanks
   * van de leerlingen stil, terwijl de robots in hun eigen arena gewoon bleven
   * schieten — wie twee minuten naar de lesgever keek, lag intussen drie keer
   * kapot. De klok van een lopende ronde wacht ook.
   */
  if (staat.bevroren) {
    const ms = Math.round(dt * 1000);
    room.gestartOm += ms;
    if (room.ronde) room.ronde.eind += ms;
    if (room.uitslagTot) room.uitslagTot += ms;
    return;
  }
  bewaakRonde(room, nu);
  /*
   * Op pauze staat de wereld helemaal stil: robots, kogels en vormen bewegen
   * niet meer. Alleen mogelijk in je eigen solo-arena — in de gedeelde arena
   * zou één leerling het spel voor de hele klas stilzetten. De klant zet dit
   * aan met de rode stopknop, zodat je rustig aan je blokken kan werken
   * zonder dat een robot je ondertussen kapot schiet.
   */
  if (room.gepauzeerd) {
    room.gestartOm += Math.round(dt * 1000);   // opwarmtijd loopt niet door
    return;
  }
  // het tijdstip van deze stand van de wereld (gaat mee in elk pakketje)
  room.tickTijd = nu;
  zorgVoorAI(room);
  // vormen bijleggen hoeft geen dertig keer per seconde: om de halve seconde
  // merkt niemand, en zo telt de server niet elke tik de hele arena na
  room.vulTeller = ((room.vulTeller || 0) + 1) % 15;
  if (room.vulTeller === 1) vulVormenAan(room);
  bouwVormRaster(room);   // eerst de vakjes vullen, dan pas rekenen

  for (const v of room.vormen) {
    if (v.weg) continue;
    v.hoek += v.draai * dt;
    // "Polygons will regenerate health if they are left unharmed for at least
    // thirty seconds" (wiki). Zo kan je een dikke vorm niet in tien beurten
    // van een afstandje kapotknabbelen.
    if (v.hp < v.maxHp && nu - (v.laatsteSchade || 0) > 30000) {
      v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.08 * dt);
    }
  }

  /*
   * Crashers bewaken het nest: zien ze een speler in de buurt, dan gaan ze
   * erop af. Raken ze te ver van het nest, dan keren ze terug — zo blijven ze
   * bij de dikke vormen en heeft een beginner er buiten het midden geen last
   * van. (https://diepio.fandom.com/wiki/Crashers)
   */
  /*
   * Crashers moeten het nest écht bewaken: daar liggen de vijfhoeken en alfa's
   * die veruit het meeste opleveren. Met een klein zichtveld kon je er gewoon
   * tussendoor rijden. Ze zien je nu van verder en gaan sneller — je moet ze
   * neerschieten of wegblijven.
   */
  const CRASHER_ZICHT = 620;
  const CRASHER_SNELHEID = 210;
  for (const v of room.vormen) {
    if (v.weg || !v.jaagt) continue;
    const nest = nestVan(room);
    let doelX = nest.x + nest.w / 2, doelY = nest.y + nest.h / 2;
    const verVanNest = Math.hypot(doelX - v.x, doelY - v.y) > Math.max(nest.w, nest.h) * 0.75;
    if (!verVanNest) {
      let dichtst = null, best = CRASHER_ZICHT;
      for (const t of room.tanks.values()) {
        if (nu < t.deadUntil || isVeilig(room, t, nu)) continue;   // ook robots worden aangevallen
        const d = Math.hypot(t.x - v.x, t.y - v.y);
        if (d < best) { best = d; dichtst = t; }
      }
      if (dichtst) { doelX = dichtst.x; doelY = dichtst.y; }
      else { v.vx *= 0.9; v.vy *= 0.9; continue; }   // rustig rondhangen
    }
    const dx = doelX - v.x, dy = doelY - v.y, d = Math.hypot(dx, dy) || 1;
    v.vx += ((dx / d) * CRASHER_SNELHEID - v.vx) * Math.min(1, dt * 2.5);
    v.vy += ((dy / d) * CRASHER_SNELHEID - v.vy) * Math.min(1, dt * 2.5);
    v.x = klem(v.x + v.vx * dt, v.r, room.arena.w - v.r);
    v.y = klem(v.y + v.vy * dt, v.r, room.arena.h - v.r);
  }

  for (const t of room.tanks.values()) {
    if (nu < t.deadUntil) continue;
    if (t.deadUntil !== 0) {
      // respawn-moment
      if (t.ai) { room.tanks.delete(t.id); continue; }
      respawnZwakker(room, t);
    }

    if (t.ai) stuurAI(room, t, nu);

    // bewegen volgens intent: eerst versnellen, dan pas verplaatsen
    const len = Math.hypot(t.intent.mx, t.intent.my);
    const top = snelheidVan(t);
    let doelVx = 0, doelVy = 0;
    if (len > 0.05) {
      // schuin lopen is niet sneller dan recht: de richting wordt genormaliseerd
      const kracht = Math.min(1, len);
      doelVx = (t.intent.mx / len) * top * kracht;
      doelVy = (t.intent.my / len) * top * kracht;
      t.laatsteActie = nu;
    }
    const grip = Math.min(1, dt * (len > 0.05 ? VERSNELLING : WRIJVING));
    t.vx = (t.vx || 0) + (doelVx - (t.vx || 0)) * grip;
    t.vy = (t.vy || 0) + (doelVy - (t.vy || 0)) * grip;
    if (Math.abs(t.vx) < 1 && !doelVx) t.vx = 0;
    if (Math.abs(t.vy) < 1 && !doelVy) t.vy = 0;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    // terugslag van het laatste schot uitwerken (dooft snel uit)
    if (t.rvx || t.rvy) {
      t.x += t.rvx * dt;
      t.y += t.rvy * dt;
      const demping = Math.pow(0.06, dt);   // ~94% weg per seconde
      t.rvx *= demping;
      t.rvy *= demping;
      if (Math.abs(t.rvx) < 1 && Math.abs(t.rvy) < 1) { t.rvx = 0; t.rvy = 0; }
    }
    const straal = straalVan(t);
    t.x = Math.max(straal, Math.min(room.arena.w - straal, t.x));
    t.y = Math.max(straal, Math.min(room.arena.h - straal, t.y));
    t.angle = t.intent.angle;

    // robots kunnen de thuisbasis niet in
    if (t.ai && inBasis(room, t.x, t.y)) {
      const b = basisVan(room);
      const naarRechts = (b.x + b.w) - t.x;
      const naarBoven = t.y - b.y;
      if (naarRechts < naarBoven) t.x = b.x + b.w + straalVan(t);
      else t.y = b.y - straalVan(t);
    }

    // genezen (zoals diep.io): traag passief; maar heb je ~8 sec geen schade
    // gehad, dan schiet de regen in de snelle modus (levensregen-stat telt zwaar
    // mee). In een veilige zone (thuisbasis of eigen teamzone) genees je extra.
    if (!t.ai) {
      /*
       * Genezen werkt overal, niet alleen thuis. Buiten je basis moest je
       * vroeger 20 seconden wachten op één levenspunt — op een grote kaart is
       * teruglopen naar huis dan de enige optie, en dat is saai. Nu geldt:
       * even niet geschoten en niet geraakt, dan begint je tank te herstellen.
       * Hoe hard, dat hangt af van je stat levensregeneratie — met punten erin
       * sta je in seconden weer vol, zonder punten duurt het een minuutje.
       */
      let regen = regenPerSec(t);
      const rustig = nu - t.laatsteSchade > 5000 && nu - (t.laatsteSchot || 0) > 3000;
      if (rustig) regen = regen * 6 + 0.8 + t.stats.levensregen * 0.7;
      const veiligeZone = inBasis(room, t.x, t.y) || inEigenZone(room, t);
      if (veiligeZone) regen += 8;   // thuis blijft het snelst
      if (regen > 0) t.hp = Math.min(t.maxHp, t.hp + regen * dt);
    }

    // Botsen met vormen (zoals diep.io): je duwt ze opzij en je doet elkaar
    // lichaamsschade. Erop inrijden is dus een échte manier om een blokje
    // kapot te maken — en een gevaarlijke, want jij verliest ook levens.
    // Muren blokkeren volledig en doen geen schade.
    const mijnStraal = straalVan(t);
    const dichtbijT = vormenRondom(room, t.x, t.y, buurVormen);
    for (let i = 0; i < dichtbijT.length; i++) {
      const v = dichtbijT[i];
      if (v.weg) continue;
      const dx = t.x - v.x, dy = t.y - v.y;
      const min = mijnStraal + v.r;
      // grof filter eerst: verreweg de meeste vormen liggen niet in de buurt
      const grof = min + 1;
      if (dx > grof || dx < -grof || dy > grof || dy < -grof) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      // 1 px speling: ook wie er tegenaan geduwd blijft staan (bv. klem tegen
      // de rand) blijft schade geven en krijgen — anders stopt het schuren.
      if (d >= min + 1 || d <= 0.01) continue;
      const nx = dx / d, ny = dy / d;

      if (v.blokkeert) { // muur: gewoon terugduwen, geen schade
        if (d < min) { t.x = v.x + nx * min; t.y = v.y + ny * min; }
        continue;
      }

      /*
       * Crashers (de roze driehoekjes) RAMMEN je, ze ontploffen niet.
       * Eerst lieten we ze bij de eerste aanraking verdwijnen met één harde
       * klap; dan voelde het alsof ze door je tank heen vlogen. In diep.io
       * botsen ze echt: ze duwen je opzij en blijven tegen je aan beuken tot
       * jij of zij het niet meer houdt. Ze duwen harder en doen meer pijn dan
       * een gewoon blokje — dat is hun hele bestaansreden als bewaker van het
       * nest. Met tien levens houdt een crasher het maar even vol tegen een
       * tank die terugramt. (https://diepio.fandom.com/wiki/Crashers)
       */
      const ram = v.jaagt ? 2.6 : 1;

      // de vorm wijkt, de tank schuift een beetje terug (de tank wint)
      if (d < min) {
        const overlap = min - d;
        const deelVorm = v.jaagt ? 0.55 : 0.75;   // een crasher laat zich minder wegduwen
        v.x -= nx * overlap * deelVorm;
        v.y -= ny * overlap * deelVorm;
        // vormen mogen het speelveld niet uit geduwd worden
        v.x = klem(v.x, v.r, room.arena.w - v.r);
        v.y = klem(v.y, v.r, room.arena.h - v.r);
        t.x += nx * overlap * (1 - deelVorm);
        t.y += ny * overlap * (1 - deelVorm);
      }

      // schade in beide richtingen
      beschadigTank(room, t, v.botsschade * ram * dt, null, nu, true);
      v.hp -= botsschadeVan(t, 'vorm') * dt;
      v.laatsteSchade = nu;
      v.hitUntil = nu + 150;
      if (v.hp <= 0) {
        v.weg = true;
        toverVormOmTotDrone(room, t, v);
        if (!t.ai) {
          geefPunten(room, t, v.punten);
          stuurEvent(t, 'punten', { n: v.punten, x: Math.round(v.x), y: Math.round(v.y) });
        }
      }
    }

    // schieten
    const kl = klasseVan(t);

    /* Drone-klassen (Opzichter/Overheer) maken vanzelf helpertjes aan tot hun
       maximum. Je hoeft er dus niet voor te schieten — schieten stuurt ze
       alleen wél op je doel af. Zie https://diepio.fandom.com/wiki/Drones */
    /* Welke lopen maken drones? Bij een echte dronetank alle, maar de Hybride
       heeft er maar één achterop (de rest schiet gewone kogels). */
    const droneLopen = kl.munitie === 'drone'
      ? kl.lopen.filter((l) => !l.munitie || l.munitie === 'drone')
      : kl.lopen.filter((l) => l.munitie === 'drone');
    if (droneLopen.length && nu > (kl.munitie === 'drone' ? t.reloadUntil : (t.droneHerlaadTot || 0))) {
      const mijn = room.bullets.filter((b) => b.soort === 'drone' && !b.weg && b.eigenaar === t.id).length;
      if (mijn < (kl.droneMax || 8)) {
        if (kl.munitie === 'drone') t.reloadUntil = nu + herlaadMsVan(t);
        else t.droneHerlaadTot = nu + herlaadMsVan(t) * 2;
        const loop = droneLopen[Math.floor(Math.random() * droneLopen.length)];
        const hoek = t.angle + loop.hoek;
        room.bullets.push({
          id: room.volgendKogelId++, soort: 'drone',
          x: t.x + Math.cos(hoek) * loopLengte(loop), y: t.y + Math.sin(hoek) * loopLengte(loop),
          vx: Math.cos(hoek) * 90, vy: Math.sin(hoek) * 90,
          hoek, eigenaar: t.id, kleur: t.kleur, team: t.team,
          // Necromancer stuurt vierkanten de lucht in, de Fabriek kleine tankjes
          vorm: kl.droneVorm || 'driehoek',
          r: loop.w * 0.42 * (kl.kogelSchaal || 1),
          schade: bulletSchadeVan(t) * 0.55,
          leven: (3 + bulletPierce(t)) * (kl.kogelLeven || 1),
          dood: Infinity,           // drones blijven tot ze kapotgeschoten worden
        });
      }
    }

    /*
     * AUTOMATISCH GESCHUT (Auto 3, Auto 5). Bovenop de tank zit een torentje
     * dat helemaal zelf mikt: het zoekt de dichtstbijzijnde vijand binnen zijn
     * bereik, draait die kant op en schiet op eigen ritme. De speler hoeft er
     * niets voor te doen — dat is het hele idee van deze klasse.
     */
    if (kl.auto) {
      /* Zoek één doel voor alle koepels samen: eerst de dichtstbijzijnde
         vijand, en is die er niet, dan een vorm in de buurt. Alle koepels
         draaien mee en vuren tegelijk — zoals in diep.io. */
      let doel = null, best = kl.auto.bereik;
      for (const ander of room.tanks.values()) {
        if (ander.id === t.id || nu < ander.deadUntil || ander.onzichtbaar) continue;
        if (t.team !== null && t.team !== undefined && ander.team === t.team) continue;
        const d = Math.hypot(ander.x - t.x, ander.y - t.y);
        if (d < best) { best = d; doel = ander; }
      }
      if (!doel) {
        let vBest = kl.auto.bereik * 0.8;
        const buurt = vormenRondom(room, t.x, t.y, buurVormen);
        for (const v of buurt) {
          if (v.weg || v.type === 'muur') continue;
          const d = Math.hypot(v.x - t.x, v.y - t.y);
          if (d < vBest) { vBest = d; doel = v; }
        }
      }
      if (doel) {
        t.autoHoek = Math.atan2(doel.y - t.y, doel.x - t.x);
        if (nu > (t.autoHerlaadTot || 0)) {
          t.autoHerlaadTot = nu + kl.auto.herlaadMs;
          const snelheidA = BULLET_SPEED * bulletSnelheidFactor(t) * (kl.auto.kogelSnelheid || 1);
          const voet = kl.auto.voet || 0;
          // elke koepel vuurt: bij een Auto 3 zijn dat er drie tegelijk
          for (const montage of (kl.torens || [0])) {
            const groei = straalVan(t) / TANK_RADIUS;
            const mx = Math.cos(t.angle + montage) * voet * groei;
            const my = Math.sin(t.angle + montage) * voet * groei;
            room.bullets.push({
              id: room.volgendKogelId++, soort: 'kogel',
              x: t.x + mx + Math.cos(t.autoHoek) * (kl.auto.len + kl.auto.straal) * groei,
              y: t.y + my + Math.sin(t.autoHoek) * (kl.auto.len + kl.auto.straal) * groei,
              vx: Math.cos(t.autoHoek) * snelheidA,
              vy: Math.sin(t.autoHoek) * snelheidA,
              eigenaar: t.id, kleur: t.kleur, team: t.team,
              r: kl.auto.kogelR || kl.auto.w * 0.42 * 1.5,
              schade: bulletSchadeVan(t) * kl.auto.schade,
              leven: 1 + bulletPierce(t),
              dood: nu + BULLET_LIFE,
            });
          }
          t.laatsteSchot = nu;
        }
      } else {
        // geen doel: de koepels kijken weer voor zich uit
        t.autoHoek = t.angle;
      }
    }

    /* Ook een dronetank kan een gewone loop hebben: de Overtrapper heeft naast
       zijn twee dronebays een valstrikwerper achterop. Dit stuk werd voor élke
       dronetank overgeslagen, dus die werper deed helemaal niets. */
    const kogelLopen = kl.lopen.some((l) => (l.munitie || kl.munitie) !== 'drone' && !l.schijn);
    const droneKlasse = kl.munitie === 'drone';
    if (t.intent.shoot && kogelLopen && (droneKlasse || nu > t.reloadUntil)) {
      // bij een dronetank loopt de dronefabriek op t.reloadUntil; die laten we
      // met rust, de losse loop heeft zijn eigen ritme (loop.herlaad)
      if (!droneKlasse) t.reloadUntil = nu + herlaadMsVan(t);
      t.laatsteActie = nu;
      t.laatsteSchot = nu;           // pauzeert het genezen
      /*
       * Terugslag. Een Vernietiger of Annihilator duwt zichzelf flink achteruit
       * bij elk schot — in diep.io gebruik je dat zelfs om vooruit te komen:
       * omdraaien en achteruit "raketten". Zonder dit voelde zo'n kanon als
       * een gewoon geweer. https://diepwiki.io/#/tanks/destroyer
       */
      if (kl.recoil) {
        t.rvx = (t.rvx || 0) - Math.cos(t.angle) * kl.recoil * RECOIL_KRACHT;
        t.rvy = (t.rvy || 0) - Math.sin(t.angle) * kl.recoil * RECOIL_KRACHT;
      }
      if (!t.ai) t.beschermTot = 0; // wie schiet, geeft zijn spawnbescherming op
      const snelheid = BULLET_SPEED * kl.kogelSnelheid * bulletSnelheidFactor(t);
      /*
       * Klassen met kl.afwisselend (Twin, Dubbelflank) vuren om de beurt uit
       * één loop, precies zoals in diep.io: https://diepio.fandom.com/wiki/Twin
       * Zonder dit kwamen er twee kogels tegelijk uit, en dat is een andere
       * tank — dubbel zoveel kogels in de lucht en een heel ander schietritme.
       */
      let teVuren = kl.lopen;
      if (kl.afwisselend && kl.lopen.length > 1) {
        /* Lopen met hetzelfde groepsnummer vuren samen. De Twin heeft twee
           groepen van één loop (links, rechts); de Dubbelflank twee groepen van
           twee (de voor- én achterloop aan dezelfde kant). Zonder groepen zou
           die laatste vier losse schoten na elkaar geven i.p.v. twee paren. */
        const groepen = [...new Set(kl.lopen.map((l, i) => (l.groep === undefined ? i : l.groep)))];
        t.loopBeurt = ((t.loopBeurt || 0) + 1) % groepen.length;
        const nu = groepen[t.loopBeurt];
        teVuren = kl.lopen.filter((l, i) => (l.groep === undefined ? i : l.groep) === nu);
      }
      for (const loop of teVuren) {
        // een dronebay maakt drones, geen kogels — let op: de meeste bays laten
        // munitie leeg en erven 'drone' van de klasse, dus dát moet je testen
        if ((loop.munitie || kl.munitie) === 'drone') continue;
        if (loop.schijn) continue;                // alleen om te zien (de trapjes van de Streamliner)
        /* Een loop mag een eigen ritme hebben. De valstrikwerper achterop de
           Gunner Trapper laadt bijvoorbeeld veel trager dan de loopjes
           vooruit — anders spuwt hij valstrikken alsof het kogels zijn. Bij een
           dronetank is dat verplicht: die heeft geen gedeelde herlaadtijd voor
           kogels, dus zonder eigen timer zou zo'n loop élke tik vuren. */
        if (droneKlasse || loop.herlaad) {
          const sleutel = 'lh' + kl.lopen.indexOf(loop);
          if (nu < (t[sleutel] || 0)) continue;
          t[sleutel] = nu + herlaadMsVan(t) * (loop.herlaad || 1);
        }
        const richting = t.angle + loop.hoek + (kl.spreiding ? (Math.random() - 0.5) * 2 * kl.spreiding : 0);
        const zijHoek = t.angle + loop.hoek + Math.PI / 2;
        room.bullets.push({
          id: room.volgendKogelId++,
          // loop.start telt mee: bij de Jager staat de voorste loop verder
          // naar voren, dus daar hoort de kogel ook uit te komen
          x: t.x + Math.cos(t.angle + loop.hoek) * (loopLengte(loop)) + Math.cos(zijHoek) * loop.zij,
          y: t.y + Math.sin(t.angle + loop.hoek) * (loopLengte(loop)) + Math.sin(zijHoek) * loop.zij,
          vx: Math.cos(richting) * snelheid,
          vy: Math.sin(richting) * snelheid,
          eigenaar: t.id, kleur: t.kleur, team: t.team,
          // Zoals diep.io: een kogel VULT zijn loop. De breedte van het kanon
          // bepaalt dus de grootte — niet je level en niet je upgrades. Zo
          // heeft een robot met hetzelfde kanon even grote kogels als jij.
          // Volgorde klopt met de wiki: gunner < basis < destroyer < annihilator.
          r: loop.w * 0.42 * (kl.kogelSchaal || 1),
          soort: (loop.munitie || kl.munitie) === 'trap' ? 'trap'
            : (loop.munitie || kl.munitie) === 'raket' ? 'raket' : 'kogel',
          // raketten blijven onderweg zelf vuren (Skimmer, Rocketeer)
          raket: (loop.munitie || kl.munitie) === 'raket' ? Object.assign({ vanaf: nu }, kl.raket) : null,
          hoek: richting,
          schade: bulletSchadeVan(t) * (loop.schade || 1),
          /* kogelpantser = "bullet health": hoeveel keer de kogel iets mag raken
             (vorm, tank of vijandelijke kogel) voordat hij verdwijnt. Grote
             kogels (destroyer/annihilator) doorboren van nature meer, en
             klassen met kl.kogelLeven doorboren extra — die vermenigvuldiger
             werd hier vergeten, waardoor de Vernietiger en de Gunner Trapper
             hun doorboorkracht van de wiki niet kregen. */
          leven: (bulletPierce(t) + ((loop.munitie || kl.munitie) === 'trap' ? 3 : 0)
            + (loop.w * 0.42 >= 12 ? 2 : 0)) * (kl.kogelLeven || 1),
          // traps blijven lang liggen (wiki: ~24 sec), kogels leven 3 sec
          dood: nu + ((loop.munitie || kl.munitie) === 'trap' ? (kl.trapLeven || 24000) : BULLET_LIFE),
        });
      }
    }

    // sluiper: onzichtbaar na 2 sec niets doen
    t.onzichtbaar = !!(kl.sluip && nu - t.laatsteActie > 2000);

    // botsschade: elk paar tanks dat elkaar raakt doet lichaamsschade
    // (rammer/stekelbol via klasse-multiplier, gewone tanks via de botsschade-stat)
    for (const ander of room.tanks.values()) {
      if (ander.id === t.id || nu < ander.deadUntil) continue;
      if (Math.hypot(ander.x - t.x, ander.y - t.y) < straalVan(t) + straalVan(ander) + 4) {
        beschadigTank(room, ander, botsschadeVan(t, 'tank') * dt, t, nu, true);
      }
    }
  }

  beperkMunitie(room);
  munitieTegenMunitie(room);

  // kogels bewegen en raken vormen/tanks
  const over = [];
  vulBasisDronesAan(room, nu);

  for (const b of room.bullets) {
    if (b.weg) continue;

    /*
     * RAKETTEN (Skimmer, Rocketeer). Een raket is een dikke trage kogel die
     * onderweg zelf blijft vuren: de Skimmer schiet naar achteren, de
     * Rocketeer gebruikt zijn uitlaat om steeds harder te gaan. Zo zijn ze
     * meer dan alleen een grote kogel.
     */
    if (b.soort === 'raket' && b.raket) {
      if (b.raket.stuw) {
        const sn = Math.hypot(b.vx, b.vy) || 1;
        b.vx += (b.vx / sn) * b.raket.stuw * dt;
        b.vy += (b.vy / sn) * b.raket.stuw * dt;
      }
      if (nu > (b.raketTot || 0)) {
        b.raketTot = nu + b.raket.herlaadMs;
        const achter = Math.atan2(b.vy, b.vx) + Math.PI + (Math.random() - 0.5) * 0.5;
        room.bullets.push({
          id: room.volgendKogelId++, soort: 'kogel',
          x: b.x + Math.cos(achter) * b.r, y: b.y + Math.sin(achter) * b.r,
          vx: Math.cos(achter) * BULLET_SPEED * 0.55,
          vy: Math.sin(achter) * BULLET_SPEED * 0.55,
          eigenaar: b.eigenaar, kleur: b.kleur, team: b.team,
          r: b.r * 0.42, schade: b.schade * b.raket.schade,
          leven: 1, dood: nu + BULLET_LIFE * 0.5,
        });
      }
    }

    /*
     * Basisdrones bewaken de teamzone. Ze cirkelen rustig rond in hun eigen
     * base en schieten eropaf zodra er een vijand te dicht komt; die kan dan
     * alleen ontsnappen door weg te rijden. Precies zoals in diep.io:
     * https://diepio.fandom.com/wiki/Base_Drones
     */
    if (b.soort === 'basisdrone') {
      const zone = teamZones(room).find((z) => z.team === b.team);
      if (!zone) { b.weg = true; continue; }
      const post = basisDronePost(zone, b.post || 0, aantalBasisDrones(zone));
      let doel = null, besteD = BASISDRONE_ZICHT;
      for (const t of room.tanks.values()) {
        if (nu < t.deadUntil || t.team === b.team) continue;
        const d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d < besteD) { besteD = d; doel = t; }
      }
      let doelX, doelY;
      if (doel) { doelX = doel.x; doelY = doel.y; }
      else {
        // rustig rondje draaien rond de eigen post
        const hoek = nu / 1400 + (b.post || 0) * 0.9;
        const straal = Math.min(120, Math.min(zone.w, zone.h) * 0.22);
        doelX = post.x + Math.cos(hoek) * straal;
        doelY = post.y + Math.sin(hoek) * straal;
      }
      // te ver van zijn post? eerst terug — ze mogen niet de hele arena over
      if (Math.hypot(b.x - post.x, b.y - post.y) > BASISDRONE_LOS) { doelX = post.x; doelY = post.y; }
      const dx = doelX - b.x, dy = doelY - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx += ((dx / d) * BASISDRONE_SNELHEID - b.vx) * Math.min(1, dt * 3.4);
      b.vy += ((dy / d) * BASISDRONE_SNELHEID - b.vy) * Math.min(1, dt * 3.4);
      b.hoek = Math.atan2(b.vy, b.vx);
    }

    if (b.soort === 'drone') {
      // Drones zoeken zelf de dichtstbijzijnde vijand; is die er niet, dan
      // cirkelen ze rond hun baas. Schiet hun baas, dan gaan ze op zijn doel af.
      const baas = room.tanks.get(b.eigenaar);
      if (!baas || nu < baas.deadUntil) { b.weg = true; continue; }
      let doelX, doelY;
      if (baas.intent.shoot) {
        /* Klik je, dan verzamelen je drones zich op je muisaanwijzer, precies
           zoals in diep.io (https://diepio.fandom.com/wiki/Overseer). Eerder
           vlogen ze naar een punt 700 px vér in je kijkrichting, waardoor ze
           over je doel heen schoten als dat dichtbij stond. Robots hebben geen
           muis; die mikken op de richting van hun geschut. */
        if (baas.ai) {
          doelX = baas.x + Math.cos(baas.angle) * 700;
          doelY = baas.y + Math.sin(baas.angle) * 700;
        } else {
          doelX = baas.intent.tx;
          doelY = baas.intent.ty;
        }
      } else {
        let best = null, bestD = 620;
        for (const ander of room.tanks.values()) {
          if (ander.id === baas.id || nu < ander.deadUntil) continue;
          if (ander.team !== null && ander.team === baas.team) continue;
          if (isVeilig(room, ander, nu)) continue;
          const d = Math.hypot(ander.x - b.x, ander.y - b.y);
          if (d < bestD) { bestD = d; best = ander; }
        }
        if (best) { doelX = best.x; doelY = best.y; }
        else { // rustig rondcirkelen om de baas
          const a = nu / 900 + (b.id % 12) * 0.52;
          doelX = baas.x + Math.cos(a) * 130;
          doelY = baas.y + Math.sin(a) * 130;
        }
      }
      const dx = doelX - b.x, dy = doelY - b.y, d = Math.hypot(dx, dy) || 1;
      const DRONE_V = 210 + (baas.ai ? 0 : baas.stats.kogelsnelheid * 12);
      b.vx += ((dx / d) * DRONE_V - b.vx) * Math.min(1, dt * 3.2);
      b.vy += ((dy / d) * DRONE_V - b.vy) * Math.min(1, dt * 3.2);
      b.hoek = Math.atan2(b.vy, b.vx);
    } else if (b.soort === 'trap') {
      // Traps vliegen vooruit, remmen snel af en blijven dan liggen.
      b.vx *= Math.pow(0.02, dt);
      b.vy *= Math.pow(0.02, dt);
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.soort === 'drone' || b.soort === 'trap') { // binnen het veld houden
      b.x = klem(b.x, b.r, room.arena.w - b.r);
      b.y = klem(b.y, b.r, room.arena.h - b.r);
    }
    if (nu > b.dood || b.x < 0 || b.x > room.arena.w || b.y < 0 || b.y > room.arena.h) continue;

    // vijandelijke kogels lossen op aan de rand van de thuisbasis
    if (inBasis(room, b.x, b.y)) {
      const schutter = room.tanks.get(b.eigenaar);
      if (schutter && schutter.ai) continue;
    }

    let dood = false;

    // raakt een vorm? (kan er meerdere doorboren zolang er leven over is)
    /* Alleen de vormen uit de vakjes rondom deze kogel; en geen Math.hypot
       (een wortel is duur), maar de kwadraten vergelijken. */
    const dichtbij = vormenRondom(room, b.x, b.y, buurVormen);
    for (let i = 0; i < dichtbij.length; i++) {
      const v = dichtbij[i];
      if (v.weg) continue;
      const vdx = v.x - b.x, vdy = v.y - b.y, vmin = v.r + b.r;
      if (vdx > vmin || vdx < -vmin || vdy > vmin || vdy < -vmin) continue;
      if (vdx * vdx + vdy * vdy < vmin * vmin) {
        v.hp -= b.schade;
        v.laatsteSchade = nu;
        v.hitUntil = nu + 150; // wit flitsje (animatie)
        if (v.hp <= 0) {
          v.weg = true;
          const schutter = room.tanks.get(b.eigenaar);
          toverVormOmTotDrone(room, schutter, v);
          if (schutter && !schutter.ai) {
            geefPunten(room, schutter, v.punten);
            stuurEvent(schutter, 'punten', { n: v.punten, x: Math.round(v.x), y: Math.round(v.y) });
          }
        }
        /* Een drone die tegen een vierkant botst gaat NIET stuk: hij duwt door
           en blijft rondvliegen, net als in diep.io. Alleen kogels en traps
           slijten op vormen. Zonder dit smolt een zwerm weg tegen de polygons
           en waren alle drone-klassen half zo sterk als de rest. */
        if (b.soort !== 'drone' && b.soort !== 'basisdrone') {
          b.leven -= 1;
          if (b.leven <= 0) dood = true;
        }
        break; // hooguit één vorm per tik
      }
    }
    if (dood) continue;

    // raakt een tank? (elke tank hoogstens één keer per kogel)
    const blijftRammen = b.soort === 'drone' || b.soort === 'basisdrone';
    for (const t of room.tanks.values()) {
      if (t.id === b.eigenaar || nu < t.deadUntil) continue;
      /* Munitie van je eigen team vliegt DWARS DOOR je heen. Schade deed het al
         niets (zie beschadigTank), maar de kogel bleef wél in je hangen: hij
         ging stuk op jou en een drone van een teammaat duwde je opzij. Dat
         voelde als "mijn teamgenoten vallen me aan" — en het blokkeerde de
         schoten van je maatje op de vijand. */
      if (b.team !== null && b.team !== undefined && t.team === b.team) continue;
      // Een kogel raakt elke tank hoogstens één keer. Een drone blijft rammen:
      // die mag dezelfde tank opnieuw raken na een korte pauze, anders is hij
      // na één treffer nutteloos.
      const vorige = b.geraakt && b.geraakt.get(t.id);
      if (vorige && (!blijftRammen || nu - vorige < 300)) continue;
      const bmin = straalVan(t) + b.r;
      if (Math.hypot(t.x - b.x, t.y - b.y) < bmin) {
        const schutter = room.tanks.get(b.eigenaar);
        beschadigTank(room, t, b.schade, schutter, nu);
        (b.geraakt || (b.geraakt = new Map())).set(t.id, nu);
        if (!blijftRammen) {            // een kogel gaat op
          b.leven -= 1;
          if (b.leven <= 0) dood = true;
        } else {
          /*
           * Drones BOTSEN: ze vlogen vroeger dwars door je tank heen en deden
           * alleen schade, waardoor het leek alsof ze meteen ontploften. Nu
           * worden ze netjes tegen de rand van je tank gezet en geven ze je
           * een duwtje — je voelt de klap, en zij blijven bestaan om opnieuw
           * aan te vallen.
           */
          const bdx = b.x - t.x, bdy = b.y - t.y;
          const bd = Math.hypot(bdx, bdy) || 1;
          b.x = t.x + (bdx / bd) * bmin;
          b.y = t.y + (bdy / bd) * bmin;
          t.rvx = (t.rvx || 0) - (bdx / bd) * 45;
          t.rvy = (t.rvy || 0) - (bdy / bd) * 45;
        }
        break; // hooguit één tank per tik
      }
    }
    if (!dood) over.push(b);
  }
  room.bullets = over;
  // pas nu de kapotgeschoten vormen echt uit de lijst halen
  ruimKapotteVormenOp(room);
}

/*
 * Munitie tegen munitie: vijandelijke kogels schieten elkaar kapot (diep.io).
 *
 * WAAROM EEN RASTER: eerst vergeleken we élk paar munitie met elkaar. Zolang
 * er alleen kogels rondvlogen (die na 3 sec verdwijnen) viel dat niet op, maar
 * traps blijven 24 sec liggen en drones verdwijnen helemaal niet. Met 5 robots
 * die traps leggen kom je zo aan honderden stuks munitie, en dan zijn dat
 * tienduizenden vergelijkingen per tik — waardoor de server vastliep zodra je
 * hoog genoeg kwam om zulke tegenstanders tegen te komen (rond level 30).
 *
 * Nu delen we het veld op in vakjes en vergelijken we alleen munitie die in
 * hetzelfde of een aangrenzend vakje ligt. Dat schaalt lineair mee.
 */
const RASTER = 80;

function munitieTegenMunitie(room) {
  const vakjes = new Map();
  for (const b of room.bullets) {
    if (b.weg) continue;
    const k = vakNr((b.x / RASTER) | 0, (b.y / RASTER) | 0);
    let lijst = vakjes.get(k);
    if (!lijst) vakjes.set(k, (lijst = []));
    lijst.push(b);
  }
  for (const b of room.bullets) {
    if (b.weg) continue;
    const cx = (b.x / RASTER) | 0, cy = (b.y / RASTER) | 0;
    for (let dx = -1; dx <= 1 && !b.weg; dx++) {
      for (let dy = -1; dy <= 1 && !b.weg; dy++) {
        const lijst = vakjes.get(vakNr(cx + dx, cy + dy));
        if (!lijst) continue;
        for (const c of lijst) {
          // elk paar één keer, en twee stilliggende traps doen elkaar niets
          if (c.weg || c.id <= b.id) continue;
          if (b.soort === 'trap' && c.soort === 'trap') continue;
          if (!kogelsVijandig(b, c)) continue;
          if (Math.hypot(b.x - c.x, b.y - c.y) >= b.r + c.r) continue;
          b.leven -= 1; c.leven -= 1;
          if (c.leven <= 0) c.weg = true;
          if (b.leven <= 0) { b.weg = true; break; }
        }
      }
    }
  }
}

/*
 * Vangnet tegen opstoppingen: hoeveel munitie mag er per tank en per arena
 * tegelijk in het veld liggen. Traps zijn de grootste boosdoener (24 sec
 * levensduur), dus die krijgen een eigen plafond; de oudste verdwijnt.
 */
const MAX_TRAPS_PER_TANK = 24;
const MAX_MUNITIE_ARENA = 260;

function beperkMunitie(room) {
  const trapsPer = new Map();
  for (const b of room.bullets) {
    if (b.weg || b.soort !== 'trap') continue;
    const lijst = trapsPer.get(b.eigenaar) || [];
    lijst.push(b);
    trapsPer.set(b.eigenaar, lijst);
  }
  for (const lijst of trapsPer.values()) {
    // lijst staat al op leeftijd (oudste eerst, want zo zijn ze toegevoegd)
    for (let i = 0; i < lijst.length - MAX_TRAPS_PER_TANK; i++) lijst[i].weg = true;
  }
  const levend = room.bullets.filter((b) => !b.weg);
  if (levend.length > MAX_MUNITIE_ARENA) {
    // te vol: gooi de oudste NIET-drones weg (drones horen bij hun baas)
    let weg = levend.length - MAX_MUNITIE_ARENA;
    for (const b of levend) {
      if (weg <= 0) break;
      if (b.soort === 'drone') continue;
      b.weg = true; weg--;
    }
  }
}

/* Botsen twee kogels vijandig? (niet van dezelfde tank of hetzelfde team) */
function kogelsVijandig(a, c) {
  if (a.eigenaar === c.eigenaar) return false;
  if (a.team !== null && a.team !== undefined && a.team === c.team) return false;
  return true;
}

function beschadigTank(room, t, schade, dader, nu, contact) {
  // veilig in basis, eigen teamzone of tijdens spawnbescherming
  if (isVeilig(room, t, nu)) return;
  // teams (les 2): geen schade van teamgenoten
  if (dader && dader.team !== null && dader.team === t.team) return;
  t.hp -= schade;
  t.laatsteSchade = nu; // reset de snelle-regen-timer
  // treffer-flits + gebeurtenis: bij kogels altijd, bij contact hooguit ~2x/sec
  const meld = contact ? (nu - t.contactEvT > 500) : (schade >= 1);
  if (meld) {
    if (contact) t.contactEvT = nu;
    t.flashKleur = '#ff5252'; t.flashUntil = nu + 180;
    t.laatsteActie = nu;
    // de échte schade meesturen: daarmee kan de leerling zelf zijn levens
    // bijhouden, en die schade hángt af van de upgrades van de tegenstander
    stuurEvent(t, 'geraakt', { schade: Math.round(schade * 10) / 10, contact: !!contact });
    // "wanneer ik iemand raak" gaat af bij élke rake treffer (max ~4x/sec)
    if (dader && !dader.ai && dader.id !== t.id && nu - (dader.raakEvT || 0) > 250) {
      dader.raakEvT = nu;
      stuurEvent(dader, 'raak');
    }
  }
  if (t.hp <= 0 && t.deadUntil <= nu) {
    t.deaths++;
    t.deadUntil = nu + RESPAWN_MS;
    // je hoort te weten wie je te pakken had — dat is de helft van de lol
    stuurEvent(t, 'dood', dader && dader.id !== t.id
      ? { door: dader.naam, kleur: dader.kleur }
      : { door: null });
    if (dader && dader.id !== t.id) {
      if (!dader.ai) {
        // zwaardere tank verslaan = meer punten
        const punten = t.ai ? t.ai.punten : Math.max(40, 40 + t.level * 15);
        geefPunten(room, dader, punten);
        stuurEvent(dader, 'punten', { n: punten, x: Math.round(t.x), y: Math.round(t.y) });
        stuurEvent(dader, 'versla'); // 🏆 hat-blok "wanneer ik iemand versla"
      }
      /* Iedereen in de arena ziet wie wie verslaat. Dat maakt van los rondrijden
         een wedstrijd: je hoort erbij, ook als je zelf net niet aan de beurt was. */
      staat.io.to(room.id).emit('kill', {
        dader: dader.naam, daderKleur: dader.kleur,
        slachtoffer: t.naam, slachtofferKleur: t.kleur,
      });
    }
  }
}

/*
 * NECROMANCER: een kapotte vorm staat weer op als drone in zijn zwerm. In
 * diep.io is dat zijn hele wezen — hij schiet niet, hij verzamelt. De drone
 * houdt de kleur van de vorm (een geel vierkant blijft geel), met de teamkleur
 * als rand, zodat je van ver ziet van wie de zwerm is.
 * https://diepio.fandom.com/wiki/Necromancer
 */
function toverVormOmTotDrone(room, baas, v) {
  if (!baas || !klasseVan(baas).necro) return;
  if (v.type !== 'vierkant' && v.type !== 'driehoek') return;
  const kl = klasseVan(baas);
  const nu = room.bullets.filter((x) => x.soort === 'drone' && !x.weg && x.eigenaar === baas.id).length;
  if (nu >= (kl.droneMax || 8)) return;
  room.bullets.push({
    id: room.volgendKogelId++, soort: 'drone',
    x: v.x, y: v.y, vx: 0, vy: 0, hoek: v.hoek || 0,
    eigenaar: baas.id, kleur: v.kleur, rand: baas.kleur, team: baas.team,
    vorm: v.type === 'driehoek' ? 'driehoek' : 'vierkant',
    r: Math.max(7, v.r * 0.55),
    schade: bulletSchadeVan(baas) * 0.55,
    leven: (3 + bulletPierce(baas)) * (kl.kogelLeven || 1),
    dood: Infinity,
  });
}

/* Kapotgeschoten vormen worden gemarkeerd en pas na de lussen opgeruimd:
   tijdens het rekenen mag de lijst niet onder je handen veranderen. */
function ruimKapotteVormenOp(room) {
  if (room.vormen.some((v) => v.weg)) room.vormen = room.vormen.filter((v) => !v.weg);
}

/* Hoe ver steekt deze loop uit vanaf het midden van de tank? */
function loopLengte(loop) { return (loop.start || 0) + loop.len; }

/*
 * Basisdrones: de bewakers van elke teamzone.
 * In diep.io zijn dat er 12 per base bij 4 teams en 30 in totaal bij 2 teams.
 * Wij houden het bewust wat rustiger — met twaalf leerlingen is het anders een
 * wolk van stipjes — maar het effect is hetzelfde: in een vijandelijke base
 * blijven rondhangen lukt niet meer.
 */
const BASISDRONE_ZICHT = 520;      // vanaf hier duiken ze op een vijand af
const BASISDRONE_LOS = 1100;       // verder dan dit van hun post: eerst terug
const BASISDRONE_SNELHEID = 260;   // sneller dan een tank, je ontkomt er niet aan

/* Hoeveel bewakers heeft deze zone nodig? Een lange strook (2 teams) heeft er
   meer nodig dan een hoekvierkant (4 teams), anders kan je er gewoon omheen. */
function aantalBasisDrones(zone) {
  return Math.round(6 + Math.min(6, Math.max(zone.w, zone.h) / 700));
}

/*
 * De vaste post van bewaker i: netjes verspreid over de zone, in paren links
 * en rechts van het midden — precies zoals de wiki het beschrijft voor 2 teams
 * ("spread evenly in pairs all across the base"). Eerst cirkelden ze allemaal
 * rond het midden van de zone; bij een strook van 3400 hoog kon je daar met
 * gemak omheen rijden en stond de halve base onbewaakt.
 */
function basisDronePost(zone, i, totaal) {
  const langsY = zone.h >= zone.w;
  const deel = (i + 0.5) / totaal;
  const zij = i % 2 === 0 ? 0.34 : 0.66;
  return langsY
    ? { x: zone.x + zone.w * zij, y: zone.y + zone.h * deel }
    : { x: zone.x + zone.w * deel, y: zone.y + zone.h * zij };
}

function vulBasisDronesAan(room, nu) {
  if (!room.teamModus) return;
  for (const zone of teamZones(room)) {
    const totaal = aantalBasisDrones(zone);
    const mijne = room.bullets.filter((b) => !b.weg && b.soort === 'basisdrone' && b.team === zone.team);
    const bezet = new Set(mijne.map((b) => b.post));
    for (let i = 0; i < totaal; i++) {
      if (bezet.has(i)) continue;
      const p = basisDronePost(zone, i, totaal);
      room.bullets.push({
        id: room.volgendKogelId++, soort: 'basisdrone',
        x: p.x, y: p.y, vx: 0, vy: 0, hoek: Math.random() * Math.PI * 2,
        eigenaar: null, team: zone.team, post: i, kleur: TEAM_KLEUREN[zone.team],
        r: 11, schade: 7, leven: 6,
        dood: Infinity,   // ze blijven tot ze kapotgeschoten worden
      });
    }
  }
}

module.exports = { startSpellus, tickRoom };
