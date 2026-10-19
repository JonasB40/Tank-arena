/*
 * De computertegenstanders: hoeveel er zijn, hoe sterk, en hoe ze zich gedragen.
 */
const { KLASSEN, TANKS_IN_ARENA, DETECTIE_R, ONTSNAP_R, AGGRO_MS, AI_PROFIELEN, OPWARM_MS, NIVEAUS, robotKlasseVoorLevel, randInt, klem } = require('./regels');
const { wijsTeamToe, buurVormen, vormenRondom, vrijeRobotNaam, nieuweTank, spawnTank, isVeilig } = require('./wereld');

function hoogsteSpelerScore(room) {
  let hoog = 0;
  for (const t of room.tanks.values()) if (!t.ai && t.score > hoog) hoog = t.score;
  return hoog;
}
function hoogsteSpelerLevel(room) {
  let hoog = 1;
  for (const t of room.tanks.values()) if (!t.ai && t.level > hoog) hoog = t.level;
  return hoog;
}

/*
 * In de gedeelde arena zitten leerlingen dóór elkaar: eentje speelt al een uur
 * en staat op level 30, een ander komt net binnen op level 1. Schaalden we de
 * robots op de sterkste speler (zoals in solo), dan liep die nieuwkomer meteen
 * tegen level-30-robots aan en was hij binnen enkele seconden kapot. Daarom
 * kijken we hier naar het GEMIDDELDE, en nooit meer dan een paar levels boven
 * de zwakste speler.
 */
function spelerLevelVoorAI(room) {
  if (room.solo) return hoogsteSpelerLevel(room);
  let som = 0, aantal = 0, laagste = Infinity;
  for (const t of room.tanks.values()) {
    if (t.ai) continue;
    som += t.level; aantal++;
    if (t.level < laagste) laagste = t.level;
  }
  if (!aantal) return 1;
  return Math.max(1, Math.min(Math.round(som / aantal), laagste + 4));
}

/* Idem voor het áántal robots: de score van de sterkste speler mag niet
   bepalen hoe druk het is voor wie net begint. */
function spelerScoreVoorAI(room) {
  if (room.solo) return hoogsteSpelerScore(room);
  let som = 0, aantal = 0;
  for (const t of room.tanks.values()) { if (t.ai) continue; som += t.score; aantal++; }
  return aantal ? som / aantal : 0;
}

function zorgVoorAI(room) {
  const spelers = [...room.tanks.values()].filter((t) => !t.ai).length;
  if (spelers === 0) return;
  /*
   * Rustige start in SOLO: daar bouwt een leerling zijn eerste blokken en moet
   * er niet meteen een robot op hem staan schieten. In de gedeelde arena is het
   * omgekeerd — daar wil je meteen een vol veld, zodat het spel meteen leeft.
   */
  if (room.solo && !process.env.TESTROBOTS && Date.now() - room.gestartOm < OPWARM_MS) return;
  const score = spelerScoreVoorAI(room);
  const n = NIVEAUS[room.niveau] || NIVEAUS.gemiddeld;
  const doel = process.env.TESTROBOTS ? Number(process.env.TESTROBOTS) : (room.solo
    ? Math.min(n.max, 1 + Math.floor(score / n.perScore))
    /*
     * In de gedeelde arena rijden er altijd TANKS_IN_ARENA tanks rond: eerst de
     * echte leerlingen, en de rest vullen we aan met robots. Zo blijft het veld
     * even druk of de klas nu met vier of met twaalf is, en blijven de teams
     * even groot. Zit de klas voltallig binnen, dan verdwijnen de robots vanzelf.
     */
    : Math.max(0, TANKS_IN_ARENA - spelers));
  const huidige = [...room.tanks.values()].filter((t) => t.ai).length;
  for (let i = huidige; i < doel; i++) {
    const t = maakAiTank(room, n);
    room.tanks.set(t.id, t);
  }
  if (!room.solo && huidige > doel) ruimRobotsOp(room, huidige - doel);
}

/*
 * Te veel robots: de klas komt één voor één binnen, en voor elke leerling die
 * er nog niet was reed er een robot. Die bleven staan tot ze toevallig
 * kapotgeschoten werden — met 25 leerlingen reden er zo 36 tanks rond in
 * plaats van 25. Nu verdwijnt het teveel vanzelf, maar alleen robots die ver
 * van elke leerling rijden: niemand ziet een tegenstander zomaar oplossen.
 * In teams nemen we eerst een robot weg uit het team met de meeste tanks.
 */
const ROBOT_WEG_AFSTAND = 1800;
function ruimRobotsOp(room, teveel) {
  const spelers = [...room.tanks.values()].filter((t) => !t.ai);
  const perTeam = new Map();
  for (const t of room.tanks.values()) if (t.team !== null) perTeam.set(t.team, (perTeam.get(t.team) || 0) + 1);
  const kandidaten = [...room.tanks.values()]
    .filter((r) => r.ai)
    .map((r) => ({ r, d: Math.min(...spelers.map((s) => Math.hypot(s.x - r.x, s.y - r.y))) }))
    .filter((k) => k.d > ROBOT_WEG_AFSTAND);
  for (let i = 0; i < teveel && kandidaten.length; i++) {
    kandidaten.sort((a, b) => ((perTeam.get(b.r.team) || 0) - (perTeam.get(a.r.team) || 0)) || b.d - a.d);
    const { r } = kandidaten.shift();
    room.tanks.delete(r.id);
    if (r.team !== null) perTeam.set(r.team, perTeam.get(r.team) - 1);
  }
}

function maakAiTank(room, n) {
  const p = AI_PROFIELEN[n.profiel] || AI_PROFIELEN.gemiddeld;
  const spelerLvl = spelerLevelVoorAI(room);
  // meestal rond jouw level, soms een sterke "elite" die boven lvl 45 kan gaan
  let lvl, elite = false;
  if (Math.random() < n.eliteKans) {
    elite = true;
    lvl = klem(spelerLvl + randInt(8, 20), 6, 60);
  } else {
    lvl = klem(spelerLvl + randInt(n.spreidLaag, n.spreidHoog), 1, 45);
    /*
     * In de gedeelde arena mag ongeveer een derde van de robots een stuk verder
     * staan: dan rijden er ook Twins, Sluipschutters en Vernietigers rond in
     * plaats van twaalf identieke beginnerstanks. Het gros blijft wél rond het
     * niveau van de klas, zodat een beginner niet meteen afgemaakt wordt.
     */
    if (!room.solo && Math.random() < 0.34) lvl = klem(lvl + randInt(14, 32), 1, 45);
  }
  const t = nieuweTank(`ai-${room.id}-${room.volgendAiId++}`, '🤖 Robot');
  /* Meteen in de lijst zetten: de teamverdeling telt alle tanks, en anders
     zag robot 3 robot 2 nog niet staan — zo kwam je op 7 tegen 5 uit. */
  room.tanks.set(t.id, t);
  t.ai = {
    profiel: n.profiel, elite,
    snelheid: p.snelheid * (elite ? 1.1 : 1),
    hp: Math.round(45 + lvl * 11),           // hoger level = veel taaier (soms niet stuk te schieten)
    schade: Math.round(4 + lvl * 0.45),
    botsschade: Math.min(24, 5 + lvl * 0.25),
    reactieMs: p.reactieMs,
    herlaadMs: p.herlaadMs * (elite ? 0.8 : 1),
    schietAfstand: p.schietAfstand,
    laatsteAim: 0, doelHoek: 0,
    modus: 'roam', aggroTot: 0,
    doelPunt: null, doelPuntTot: 0,
    punten: Math.round((elite ? 60 : 30) + lvl * 10),
  };
  t.level = lvl;
  t.klasse = robotKlasseVoorLevel(lvl);
  if (KLASSEN[t.klasse] && KLASSEN[t.klasse].vorm) t.vorm = KLASSEN[t.klasse].vorm;
  /*
   * In teammodus vecht een robot mee voor een team: hij krijgt de teamkleur en
   * telt mee voor die kant. Zonder dit reden er grijze robots rond die iedereen
   * aanvielen — verwarrend als de rest van het veld rood of blauw is.
   * Het team met de minste robots krijgt de volgende, zodat het eerlijk blijft.
   */
  t.robotNaam = vrijeRobotNaam(room);
  t.naam = `🤖 ${t.robotNaam}${elite ? ' ⭐' : ''}`;
  if (room.teamModus) {
    wijsTeamToe(room, t);
  } else {
    t.kleur = elite ? '#6a1b9a' : p.kleur;
  }
  t.maxHp = t.ai.hp;
  spawnTank(room, t);
  t.hp = t.maxHp;
  return t;
}

/*
 * Robotgedrag: rustig rondzwerven en vormen farmen, en pas JAGEN als je
 * dichtbij komt. Raak je ver genoeg weg (of na een tijdje), dan geeft hij op
 * — zo kun je ontsnappen. Dus geen robot die je eeuwig blijft plakken.
 */
function stuurAI(room, t, nu) {
  const a = t.ai;

  /*
   * Wie is de vijand? Een robot mag NOOIT zijn eigen team aanvallen — dat ging
   * mis: in een spel met twee teams schoten blauwe robots op hun eigen blauwe
   * klasgenoten. Zonder teams (les 1, vrij spel) is iedereen behalve andere
   * robots een doelwit.
   *
   * Met teams jaagt hij ook op vijandelijke ROBOTS, anders staan twaalf tanks
   * elkaar te negeren tot er toevallig een leerling langsrijdt. Spelers wegen
   * wel zwaarder: die zoekt hij liever op.
   */
  let speler = null, dSpeler = Infinity;
  const inTeams = t.team !== null && t.team !== undefined;
  for (const ander of room.tanks.values()) {
    if (ander.id === t.id || nu < ander.deadUntil) continue;
    if (inTeams ? ander.team === t.team : ander.ai) continue;
    if (isVeilig(room, ander, nu)) continue; // veilige tanks negeren
    const d = Math.hypot(ander.x - t.x, ander.y - t.y) * (ander.ai ? 1.6 : 1);
    if (d < dSpeler) { dSpeler = d; speler = ander; }
  }
  if (speler) dSpeler = Math.hypot(speler.x - t.x, speler.y - t.y);

  // aggro aan/uit
  if (a.modus !== 'chase') {
    if (speler && dSpeler < DETECTIE_R) { a.modus = 'chase'; a.aggroTot = nu + AGGRO_MS; }
  } else if (!speler || dSpeler > ONTSNAP_R || nu > a.aggroTot) {
    a.modus = 'roam';
  } else if (dSpeler < DETECTIE_R) {
    a.aggroTot = nu + AGGRO_MS; // zolang je dichtbij blijft, blijft hij boos
  }

  if (a.modus === 'chase' && speler) {
    if (nu - a.laatsteAim > a.reactieMs) { a.laatsteAim = nu; a.doelHoek = Math.atan2(speler.y - t.y, speler.x - t.x); }
    const naar = Math.atan2(speler.y - t.y, speler.x - t.x);
    let mx = 0, my = 0;
    if (dSpeler > 300) { mx = Math.cos(naar); my = Math.sin(naar); }
    else if (dSpeler < 160) { mx = -Math.cos(naar); my = -Math.sin(naar); }
    else { mx = Math.cos(naar + Math.PI / 2) * 0.5; my = Math.sin(naar + Math.PI / 2) * 0.5; }
    t.intent = { mx, my, angle: a.doelHoek, shoot: dSpeler < a.schietAfstand };
    return;
  }

  // rustig zwerven en vormen farmen. Alleen de vakjes rondom bekijken: elke
  // robot liep vroeger elke tik álle vormen van de arena af (honderden tot
  // duizenden) om er één in de buurt te vinden. Ligt er niets dichtbij, dan
  // zwerft hij gewoon verder tot hij er wel een tegenkomt.
  let vorm = null, dVorm = Infinity;
  for (const v of vormenRondom(room, t.x, t.y, buurVormen)) {
    if (v.weg || v.type === 'muur') continue;
    const d = Math.hypot(v.x - t.x, v.y - t.y);
    if (d < dVorm) { dVorm = d; vorm = v; }
  }
  if (!a.doelPunt || Math.hypot(a.doelPunt.x - t.x, a.doelPunt.y - t.y) < 60 || nu > a.doelPuntTot) {
    a.doelPunt = vorm && Math.random() < 0.7
      ? { x: vorm.x, y: vorm.y }
      : { x: 200 + Math.random() * (room.arena.w - 400), y: 200 + Math.random() * (room.arena.h - 400) };
    a.doelPuntTot = nu + 4000;
  }
  const naar = Math.atan2(a.doelPunt.y - t.y, a.doelPunt.x - t.x);
  const richt = vorm && dVorm < 260 ? Math.atan2(vorm.y - t.y, vorm.x - t.x) : naar;
  t.intent = { mx: Math.cos(naar) * 0.65, my: Math.sin(naar) * 0.65, angle: richt, shoot: vorm && dVorm < 260 };
}

module.exports = { stuurAI, zorgVoorAI };
