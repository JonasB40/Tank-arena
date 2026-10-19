/*
 * Wat alle onderdelen van de server samen delen.
 * io: de verbinding met alle browsers (zet server.js bij het starten).
 * bevroren: staat "ogen op mij" aan? Dan staat elke arena stil.
 */

const staat = { io: null, bevroren: false };

/* Alle arena's: 'arena' (samen spelen) en 'solo-<verbinding>' per leerling. */
const rooms = new Map();

/* Welke sockets kijken mee op de beamer? Die krijgen de hele arena te zien. */
const beamers = new Set();

module.exports = { beamers, rooms, staat };
