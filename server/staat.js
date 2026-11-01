/*
 * Wat alle onderdelen van de server samen delen.
 * io: de verbinding met alle browsers (zet server.js bij het starten).
 * bevroren: staat "ogen op mij" aan? Dan staat elke arena stil.
 * klasStil: heeft de lesgever het geluid van de hele klas uitgezet?
 * spotlight: welke leerling staat er groot op de beamer? ({ id, naam } of null)
 */

const staat = { io: null, bevroren: false, klasStil: false, spotlight: null };

/* Alle arena's: 'arena' (samen spelen) en 'solo-<verbinding>' per leerling. */
const rooms = new Map();

/* Welke sockets kijken mee op de beamer? Die krijgen de hele arena te zien. */
const beamers = new Set();
/* Welk stuk van de arena toont elke beamer nu? (socket-id → {x, y, w, h})
   Zoomt hij in op de actie, dan krijgt hij de vormen dáár, niet een greep
   uit de hele arena. */
const beamerZicht = new Map();

module.exports = { beamers, beamerZicht, rooms, staat };
