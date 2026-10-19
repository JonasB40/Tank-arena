/*
 * Alles is geladen: nu pas de lussen starten en verbinden met de server.
 * Zo komt geen enkel bericht of beeldje aan bij code die er nog niet is.
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

setInterval(spelTik, 1000 / 30);   // muis, HUD en de vinkjes van de les
requestAnimationFrame(teken);      // het speelveld, zo vaak als het scherm ververst
toonStartInstructie();
document.getElementById('naam').focus(); // cursor staat meteen klaar in het naamveld
socket.connect();
