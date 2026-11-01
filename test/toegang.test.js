/*
 * Welk adres krijgen de leerlingen (servervenster, beamer, QR-code)? Alleen
 * echte netwerkkaarten, wifi en ethernet vooraan. We doen alsof de laptop
 * bepaalde netwerkkaarten heeft door os.networkInterfaces even te vervangen.
 */
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { lanIps } = require('../server/toegang');

const echteFunctie = os.networkInterfaces;
const kaart = (adres) => [{ family: 'IPv4', internal: false, address: adres }];
function laptopMet(kaarten) {
  os.networkInterfaces = () => Object.assign({ Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] }, kaarten);
}

describe('het speeladres voor de leerlingen', () => {
  afterEach(() => { os.networkInterfaces = echteFunctie; });

  it('laat de virtuele kaart van WSL weg, ook als die eerst staat', () => {
    laptopMet({ 'vEthernet (WSL (Hyper-V firewall))': kaart('172.25.192.1'), 'Wi-Fi': kaart('192.168.1.131') });
    assert.deepEqual(lanIps(), ['192.168.1.131']);
  });

  it('VirtualBox, Docker en VPN tellen ook niet mee', () => {
    laptopMet({
      'VirtualBox Host-Only Network': kaart('192.168.56.1'),
      docker0: kaart('172.17.0.1'),
      'Tailscale': kaart('100.101.102.103'),
      Ethernet: kaart('10.0.0.25'),
    });
    assert.deepEqual(lanIps(), ['10.0.0.25']);
  });

  it('wifi én kabel: allebei, en eerst die echte kaarten', () => {
    laptopMet({ 'Netwerkkaart 3': kaart('10.1.2.3'), Ethernet: kaart('10.0.0.25'), 'Wi-Fi': kaart('192.168.1.131') });
    assert.deepEqual(lanIps().slice(0, 2).sort(), ['10.0.0.25', '192.168.1.131']);
    assert.equal(lanIps()[2], '10.1.2.3');
  });

  it('een kaart zonder netwerk (169.254.x.x) valt weg', () => {
    laptopMet({ Ethernet: kaart('169.254.10.20'), 'Wi-Fi': kaart('192.168.1.131') });
    assert.deepEqual(lanIps(), ['192.168.1.131']);
  });

  it('alleen virtuele kaarten? dan toch tonen: beter een adres te veel dan geen', () => {
    laptopMet({ 'vEthernet (Default Switch)': kaart('172.20.0.1') });
    assert.deepEqual(lanIps(), ['172.20.0.1']);
  });
});
