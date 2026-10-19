/*
 * Browserbestanden (public/js) inladen in Node, zonder browser. Ze draaien
 * samen in één afgeschermde omgeving, net zoals de <script>-tags op een
 * pagina: wat het ene bestand bovenaan maakt, ziet het volgende ook.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS = path.join(__dirname, '..', 'public', 'js');

/*
 * Blockly houdt van elk blok ook een XML-kopie bij. In de browser maakt het
 * die met het echte document; in Node neemt Blockly daarvoor normaal jsdom
 * mee. Dat is een zwaar pakket (en in een OneDrive-map staat het vaak alleen
 * in de cloud), terwijl Blockly er hier maar een handvol dingen van gebruikt.
 * Dit kleine nagemaakte XML-document volstaat.
 */
class XmlKnoop {
  constructor(naam, tekst) {
    this.nodeName = naam;
    this.tagName = naam;
    this.nodeType = naam === '#text' ? 3 : 1;
    this.data = tekst;
    this.attributen = new Map();
    this.childNodes = [];
    this.parentNode = null;
  }
  get children() { return this.childNodes.filter((k) => k.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get nextSibling() {
    const broers = this.parentNode ? this.parentNode.childNodes : [];
    return broers[broers.indexOf(this) + 1] || null;
  }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map((k) => k.textContent).join(''); }
  set textContent(t) { this.childNodes = [new XmlKnoop('#text', String(t))]; this.childNodes[0].parentNode = this; }
  setAttribute(k, v) { this.attributen.set(k, String(v)); }
  getAttribute(k) { return this.attributen.has(k) ? this.attributen.get(k) : null; }
  hasAttribute(k) { return this.attributen.has(k); }
  removeAttribute(k) { this.attributen.delete(k); }
  appendChild(k) { if (k.parentNode) k.parentNode.removeChild(k); k.parentNode = this; this.childNodes.push(k); return k; }
  insertBefore(k, voor) {
    if (!voor) return this.appendChild(k);
    if (k.parentNode) k.parentNode.removeChild(k);
    k.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(voor), 0, k);
    return k;
  }
  removeChild(k) { this.childNodes = this.childNodes.filter((x) => x !== k); k.parentNode = null; return k; }
  cloneNode(diep) {
    const kopie = new XmlKnoop(this.nodeName, this.data);
    for (const [k, v] of this.attributen) kopie.attributen.set(k, v);
    if (diep) for (const kind of this.childNodes) kopie.appendChild(kind.cloneNode(true));
    return kopie;
  }
}
const XML_DOCUMENT = {
  createElementNS: (ns, naam) => new XmlKnoop(naam),
  createElement: (naam) => new XmlKnoop(naam),
  createTextNode: (tekst) => new XmlKnoop('#text', String(tekst)),
};

let blockly = null;
/* Blockly zelf, zonder de browserlaag (jsdom) die het normaal in Node meeneemt. */
function laadBlockly() {
  if (!blockly) {
    const map = path.join(__dirname, '..', 'node_modules', 'blockly');
    blockly = require(path.join(map, 'blockly_compressed.js'));
    require(path.join(map, 'blocks_compressed.js'));
    // tekst ⇄ XML gebruiken de tests niet: lege stand-ins volstaan
    class GeenParser { parseFromString() { throw new Error('niet nodig in de tests'); } }
    class GeenSerializer { serializeToString() { return ''; } }
    blockly.utils.xml.injectDependencies({ document: XML_DOCUMENT, DOMParser: GeenParser, XMLSerializer: GeenSerializer });
  }
  return blockly;
}

/**
 * Laadt de bestanden (bv. ['blokken.js', 'compiler.js']) in een nieuwe
 * omgeving. `extra` komt erbij als globale namen (bv. een nagemaakt spel).
 */
let blokkenGeregistreerd = false;
function laadBestanden(namen, extra = {}) {
  const omgeving = vm.createContext(Object.assign({ console, Blockly: laadBlockly() }, extra));
  omgeving.window = omgeving;
  for (const naam of namen) {
    // Blockly onthoudt zijn blokken zelf: een tweede keer registreren mag niet
    if (naam === 'blokken.js') {
      if (blokkenGeregistreerd) continue;
      blokkenGeregistreerd = true;
    }
    vm.runInContext(fs.readFileSync(path.join(JS, naam), 'utf8'), omgeving, { filename: naam });
  }
  return omgeving;
}

/** Een werkblad (zoals de editor het bewaart) inladen en omzetten naar een programma. */
function compileer(omgeving, werkblad) {
  const B = omgeving.Blockly;
  const ws = new B.Workspace();
  B.serialization.workspaces.load(werkblad, ws);
  const programma = omgeving.compileerProject(ws);
  ws.dispose();
  return programma;
}

/* Werkbladen bouwen zoals voorbeeld.js het doet. */
const blok = (type, fields, inputs, next) => {
  const o = { type };
  if (fields) o.fields = fields;
  if (inputs) o.inputs = inputs;
  if (next) o.next = { block: next };
  return o;
};
const ketting = (...blokken) => {
  for (let i = 0; i < blokken.length - 1; i++) blokken[i].next = { block: blokken[i + 1] };
  return blokken[0];
};
const stapel = (...blokken) => ({ block: ketting(...blokken) });
const waarde = (b) => ({ block: b });
const getal = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const hoek = (n) => ({ shadow: { type: 'hoek_getal', fields: { NUM: n } } });
const werkblad = (...stapels) => ({
  blocks: { languageVersion: 0, blocks: stapels.map((s, i) => Object.assign({ x: 20, y: 20 + i * 400 }, s)) },
});

module.exports = { laadBestanden, laadBlockly, compileer, blok, ketting, stapel, waarde, getal, hoek, werkblad, JS };
