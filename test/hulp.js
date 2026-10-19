/*
 * Gereedschap voor de tests: een echte server starten (met een eigen,
 * tijdelijk projectbestand — nooit dat van je leerlingen) en ermee verbinden
 * zoals een browser dat doet.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const MAP = path.join(__dirname, '..');
// dezelfde socket.io-client als in de browser; werkt in Node 22+ (ingebouwde WebSocket)
const io = require(path.join(MAP, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

function vrijePoort() {
  return new Promise((ok, fout) => {
    const s = net.createServer();
    s.unref();
    s.on('error', fout);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

/**
 * Start `node server.js` op een vrije poort.
 *   projecten: inhoud voor het projectbestand bij de start (optioneel)
 *   env:       extra omgevingsvariabelen
 * Geeft { poort, map, projectBestand, stop(), herstart(), log() }.
 */
async function startServer({ projecten, env, map } = {}) {
  const werkmap = map || fs.mkdtempSync(path.join(os.tmpdir(), 'tankarena-test-'));
  const projectBestand = path.join(werkmap, 'projecten.json');
  if (projecten) fs.writeFileSync(projectBestand, JSON.stringify(projecten));
  const poort = await vrijePoort();
  let uitvoer = '';
  const kind = spawn(process.execPath, [path.join(MAP, 'server.js')], {
    cwd: MAP,
    env: Object.assign({}, process.env, {
      PORT: String(poort),
      PROJECT_BESTAND: projectBestand,
      LESGEVER_SLEUTEL: 'TESTCODE',
    }, env || {}),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  kind.stdout.on('data', (d) => { uitvoer += d; });
  kind.stderr.on('data', (d) => { uitvoer += d; });

  // wachten tot de server antwoordt
  const tot = Date.now() + 60000;
  for (;;) {
    if (kind.exitCode !== null) throw new Error('server stopte meteen:\n' + uitvoer);
    try {
      const r = await fetch(`http://127.0.0.1:${poort}/info`);
      if (r.ok) break;
    } catch { /* nog niet klaar */ }
    if (Date.now() > tot) { kind.kill(); throw new Error('server startte niet:\n' + uitvoer); }
    await wacht(150);
  }

  const server = {
    poort, map: werkmap, projectBestand,
    log: () => uitvoer,
    stop: () => new Promise((ok) => {
      if (kind.exitCode !== null) return ok();
      kind.once('exit', () => ok());
      kind.kill();
    }),
  };
  return server;
}

/** Verbinden zoals een browser; wacht tot de verbinding er is. Met voorAf
    hang je luisteraars op die al bij het verbinden moeten klaarstaan. */
function verbind(poort, voorAf) {
  const s = io(`http://127.0.0.1:${poort}`, { transports: ['websocket'], forceNew: true, reconnection: false });
  if (voorAf) voorAf(s);
  return new Promise((ok, fout) => {
    const t = setTimeout(() => fout(new Error('geen verbinding')), 10000);
    s.once('connect', () => { clearTimeout(t); ok(s); });
    s.once('connect_error', (e) => { clearTimeout(t); fout(e); });
  });
}

/** Wacht op een bericht dat aan de voorwaarde voldoet. */
function wachtOp(socket, gebeurtenis, voorwaarde = () => true, ms = 6000) {
  return new Promise((ok, fout) => {
    const t = setTimeout(() => {
      socket.off(gebeurtenis, luister);
      fout(new Error(`niets ontvangen: ${gebeurtenis}`));
    }, ms);
    function luister(d) {
      if (!voorwaarde(d)) return;
      clearTimeout(t);
      socket.off(gebeurtenis, luister);
      ok(d);
    }
    socket.on(gebeurtenis, luister);
  });
}

/** Komt er binnen deze tijd géén bericht? (voor "dit mag niet gebeuren") */
async function komtNiet(socket, gebeurtenis, voorwaarde = () => true, ms = 1200) {
  try {
    await wachtOp(socket, gebeurtenis, voorwaarde, ms);
    return false;
  } catch { return true; }
}

/** socket.emit met een antwoord, als promise. */
function vraag(socket, gebeurtenis, data) {
  return new Promise((ok) => socket.emit(gebeurtenis, data, ok));
}

module.exports = { startServer, verbind, wachtOp, komtNiet, vraag, wacht, MAP };
