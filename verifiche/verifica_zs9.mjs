/* verifica_zs9.mjs — SismaSite (GeoHub)
   Test automatici del modulo moduli/zs9.js (v1.2.0) con dati/zs9-data.json.

   Uso:   node verifiche/verifica_zs9.mjs
   Esce con codice 1 se un controllo fallisce.

   Contenuto
   1. Tab. A1.1 (Linee guida LQ v1.0, pag. 31): 36 zone, 8 valori, 923 e 927 = 7,06.
   2. Località di controllo (casi decisi il 12/11/2026 e richiesti il 15/11/2026).
   3. Casi limite: sito su un vertice e su un lato di zona, bordo comune tra due
      zone, latitudine e longitudine invertite, punto fuori dall'Italia,
      coordinate non numeriche, dati non validi.
   4. Proprietà della procedura fuori zona: tabella di 36 righe ordinata,
      Ms_i = 1 + 3·log10(R_i), esito coerente con Ms_i < M_i.
   5. Distanza geodetica: valori di riferimento della formula di Vincenty.
   6. Casi A–G della specifica «Gestione della magnitudo di riferimento Mw»
      (15/11/2026, §10).
*/
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const radice = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ZS9 = require(path.join(radice, 'moduli', 'zs9.js'));
const testoDati = readFileSync(path.join(radice, 'dati', 'zs9-data.json'));
const D = JSON.parse(testoDati);

let n = 0; const errori = [];
function ok(cond, msg) { n++; console.log((cond ? 'OK   ' : 'ERR  ') + msg); if (!cond) errori.push(msg); }
const quasi = (a, b, t) => Math.abs(a - b) <= t;

/* ---------------- 0. File dati ---------------- */
const SHA256_ATTESO = '3a15606a05e51713a2ca66065a53343e39da8b392d061141c5efa9e196ea1dc0';
const sha = createHash('sha256').update(testoDati).digest('hex');
ok(sha === SHA256_ATTESO, 'dati/zs9-data.json: SHA-256 ' + sha);
ok(D.meta.formato === 'geohub-zs9/1' && D.zone.length === 36, 'dati: formato geohub-zs9/1, 36 zone');

/* ---------------- 1. Tab. A1.1 ---------------- */
const ids = Object.keys(ZS9.MW_MAX).map(Number).sort((a, b) => a - b);
ok(ids.length === 36 && ids[0] === 901 && ids[35] === 936, 'Tab. A1.1: copre le 36 zone 901–936');
ok(ZS9.TAB_A1_1.length === 8, 'Tab. A1.1: 8 righe');
ok(ZS9.MW_MAX[923] === 7.06 && ZS9.MW_MAX[927] === 7.06, 'Tab. A1.1: 923 e 927 = 7,06 (riga omessa dalla Tab. 3.1 del volume CNR)');
const attesiTab = { 922: 5.45, 936: 5.45, 928: 5.91, 912: 6.14, 918: 6.37, 919: 6.37, 910: 6.37, 905: 6.60, 930: 6.60, 924: 6.83, 931: 6.83, 929: 7.29, 935: 7.29 };
ok(Object.entries(attesiTab).every(([z, m]) => ZS9.MW_MAX[z] === m), 'Tab. A1.1: valori di controllo per 13 zone');
ok(Object.values(ZS9.MW_MAX).every(m => m > 5), 'Tab. A1.1: tutte le Mw,max > 5');

/* ---------------- 1-bis. Bordi morbidi (App. 2 a ZS9, Fig. 19) ---------------- */
{
  const z = Object.keys(ZS9.BORDO_MORBIDO_KM).map(Number).sort((a, b) => a - b);
  ok(z.length === 36 && z[0] === 901 && z[35] === 936, 'Fig. 19: fascia assegnata a tutte le 36 zone');
  const att = { 918: 0, 923: 0, 927: 0, 922: 1, 912: 3, 930: 3, 914: 5, 924: 5, 910: 8, 911: 8, 905: 10, 935: 10 };
  ok(Object.entries(att).every(([k, v]) => ZS9.BORDO_MORBIDO_KM[k] === v), 'Fig. 19: valori di controllo per 12 zone');
  ok(ZS9.SOGLIA_MINIMA_KM === 0.5, 'Soglia minima convenzionale dell\'avviso: 0,5 km');
}

/* ---------------- 2. Località di controllo ---------------- */
/* Coordinate del centro abitato (WGS84, 4 decimali) */
const LOC = [
  ["L'Aquila", 42.3498, 13.3995, 'dentro_zona', 923, 7.06],
  ['Sulmona', 42.0480, 13.9262, 'dentro_zona', 923, 7.06],
  ['Avezzano', 42.0310, 13.4260, 'dentro_zona', 923, 7.06],
  ['Norcia', 42.7925, 13.0930, 'dentro_zona', 923, 7.06],
  ['Teramo', 42.6589, 13.7044, 'dentro_zona', 918, 6.37],
  ['Chieti', 42.3510, 14.1675, 'dentro_zona', 918, 6.37],
  ['Mirandola', 44.8870, 11.0660, 'dentro_zona', 912, 6.14],
  ['Vigarano Mainarda', 44.8410, 11.4960, 'dentro_zona', 912, 6.14],
  ['Pescara', 42.4618, 14.2161, 'fuori_zona', null, 7.06],
  ['Francavilla al Mare', 42.4210, 14.2870, 'fuori_zona', null, 7.06],
  ['Ortona', 42.3550, 14.4030, 'fuori_zona', null, 7.06],
  ['Lanciano', 42.2310, 14.3900, 'fuori_zona', null, 7.06],
  ['Vasto', 42.1120, 14.7080, 'fuori_zona', null, 7.06]
];
for (const [nome, la, lo, esito, zona, mw] of LOC) {
  const r = ZS9.valuta(la, lo, D);
  const tab = esito === 'fuori_zona' ? (r.tabella && r.tabella.length === 36) : r.tabella === null;
  ok(r.esito === esito && r.zona === zona && r.mw === mw && tab,
    `${nome}: ${r.esito}, zona ${r.zona ?? '–'}, Mw ${r.mw}` +
    (r.tabella ? `, zona più vicina ${r.tabella[0].zona} a ${r.tabella[0].r_km.toFixed(2)} km, Mw da ${r.zone_mw.join('/')}` : ''));
}
/* Distanze già registrate il 11/11/2026 (zona 918): Pescara 2,0, Francavilla 5,6, Ortona 11,4 km */
const R918 = (la, lo) => ZS9.valuta(la, lo, D).tabella.find(t => t.zona === 918).r_km;
ok(quasi(R918(42.4618, 14.2161), 2.0, 0.1) && quasi(R918(42.4210, 14.2870), 5.6, 0.1) && quasi(R918(42.3550, 14.4030), 11.4, 0.1),
  'Distanze dalla zona 918 coerenti con le prove dell\'11/11/2026 (2,0 / 5,6 / 11,4 km)');

/* ---------------- 3. Casi limite ---------------- */
// vertici in comune tra zone confinanti
const chiave = (x, y) => x.toFixed(6) + ',' + y.toFixed(6);
const vertici = new Map();
D.zone.forEach(z => z.anelli.forEach(r => { for (let i = 0; i < r.length - 2; i += 2) {
  const k = chiave(r[i], r[i + 1]); if (!vertici.has(k)) vertici.set(k, new Set()); vertici.get(k).add(z.id); } }));
const comuni = [...vertici.entries()].filter(([, s]) => s.size >= 2);
ok(comuni.length > 0, 'Bordi comuni: ' + comuni.length + ' vertici condivisi da due o più zone');
// vertice condiviso da zone con Mw diverse: deve valere la Mw più alta
const misto = comuni.find(([, s]) => new Set([...s].map(z => ZS9.MW_MAX[z])).size > 1);
{
  const [k, s] = misto; const [lo, la] = k.split(',').map(Number);
  const r = ZS9.valuta(la, lo, D);
  const zz = [...s]; const mMax = Math.max(...zz.map(z => ZS9.MW_MAX[z]));
  ok(r.esito === 'confine_comune' && zz.every(z => r.zone_contenenti.includes(z)) && r.mw === mMax &&
     r.avvisi.some(a => a.codice === 'confine_comune') && r.avvisi.some(a => a.codice === 'vicino_bordo') &&
     zz.every(z => r.prossimita_bordo.some(p => p.zona === z && p.d_km < 0.001)),
     `Caso B – sito su vertice comune alle zone ${zz.join('/')}: zone ${r.zone_contenenti.join('/')}, Mw ${r.mw} (la più alta), avviso di confine comune e avviso di prossimità`);
}
// punto medio di un lato esterno (non condiviso) della zona 923: sul bordo → interno
{
  const z = D.zone.find(q => q.id === 923); const a = z.anelli[0];
  let trovato = null;
  for (let i = 2; i < a.length && !trovato; i += 2) {
    const mx = (a[i - 2] + a[i]) / 2, my = (a[i - 1] + a[i + 1]) / 2;
    const r = ZS9.valuta(my, mx, D);
    if (r.zone_contenenti.length === 1) trovato = r;
  }
  ok(trovato && trovato.esito === 'dentro_zona' && trovato.zona === 923 && trovato.distanza_bordo_km < 0.001 &&
     trovato.avvisi.some(a => a.codice === 'vicino_bordo'),
     'Sito sul lato della zona 923: interno alla zona, distanza dal bordo < 1 m, avviso «vicino al bordo»');
}
// spostamento di 200 m verso l'esterno: fuori zona, avviso
{
  const z = D.zone.find(q => q.id === 918), a = z.anelli[0];
  // Pescara è esterna a 2,07 km: un punto a 0,2 km dal bordo si ottiene sul segmento Pescara–Chieti
  let p = null;
  for (let t = 0; t <= 1; t += 0.0005) {
    const la = 42.4618 + t * (42.3510 - 42.4618), lo = 14.2161 + t * (14.1675 - 14.2161);
    const r = ZS9.valuta(la, lo, D);
    if (r.esito !== 'dentro_zona' && r.distanza_bordo_km < 0.3) { p = r; break; }
  }
  ok(p && p.esito === 'fuori_zona' && p.avvisi.some(x => x.codice === 'vicino_bordo'),
     'Sito esterno a meno di 0,5 km dalla zona 918: fuori zona con avviso «vicino al bordo»' + (p ? ` (R = ${p.distanza_bordo_km.toFixed(3)} km)` : ''));
}
// soglia per zona: sito esterno a circa 4 km da 935 (fascia 10 km) e da 912 (fascia 3 km)
function puntoEsterno(zona, rMin, rMax) {
  const zz = D.zone.find(q => q.id === zona).anelli[0];
  let lo0 = Infinity, lo1 = -Infinity, la0 = Infinity, la1 = -Infinity;
  for (let i = 0; i < zz.length; i += 2) { lo0 = Math.min(lo0, zz[i]); lo1 = Math.max(lo1, zz[i]); la0 = Math.min(la0, zz[i + 1]); la1 = Math.max(la1, zz[i + 1]); }
  for (let la = la0 - 0.1; la <= la1 + 0.1; la += 0.01)
    for (let lo = lo0 - 0.1; lo <= lo1 + 0.1; lo += 0.01) {
      const r = ZS9.valuta(la, lo, D);
      if (r.esito === 'dentro_zona' || !r.tabella) continue;
      const t = r.tabella[0];
      if (t.zona === zona && t.r_km > rMin && t.r_km < rMax && r.tabella[1].r_km > 12) return r;
    }
  return null;
}
{
  const a = puntoEsterno(935, 3.5, 4.5), b = puntoEsterno(912, 3.5, 4.5);
  ok(a && a.avvisi.some(x => x.codice === 'vicino_bordo' && /zona 935/.test(x.testo)),
     'Sito esterno a ' + (a ? a.tabella[0].r_km.toFixed(2) : '?') + ' km dalla zona 935 (fascia 10 km): avviso');
  ok(b && !b.avvisi.some(x => x.codice === 'vicino_bordo'),
     'Sito esterno a ' + (b ? b.tabella[0].r_km.toFixed(2) : '?') + ' km dalla zona 912 (fascia 3 km): nessun avviso');
  const pe = ZS9.valuta(42.4618, 14.2161, D);
  ok(!pe.avvisi.some(x => x.codice === 'vicino_bordo'), 'Pescara a 2,07 km dalla zona 918 (fascia 0, soglia 0,5 km): nessun avviso');
  ok(a && a.mw === ZS9.valuta(a.ingresso.lat, a.ingresso.lon, D).mw && a.esito === 'fuori_zona',
     'L\'avviso non cambia esito né Mw');
}
// latitudine e longitudine invertite
{
  const r = ZS9.valuta(13.3995, 42.3498, D);
  ok(r.esito === 'fuori_dominio' && r.mw === null && r.avvisi.some(a => a.codice === 'coordinate_invertite'),
     'L\'Aquila con lat/lon invertite: fuori dominio, nessuna Mw, avviso «coordinate invertite»');
}
// fuori Italia
{
  const parigi = ZS9.valuta(48.8566, 2.3522, D), tunisi = ZS9.valuta(36.8065, 10.1815, D);
  ok(parigi.esito === 'fuori_dominio' && parigi.mw === null && !parigi.avvisi.some(a => a.codice === 'coordinate_invertite'),
     'Parigi: fuori dominio, nessuna Mw, nessun avviso di inversione');
  // Tunisi è dentro il riquadro di controllo (lo stesso del calcolo di SismaSite):
  // il modulo applica la procedura fuori zona; le zone sono troppo lontane → disaggregazione
  ok(tunisi.esito === 'disaggregazione_richiesta' && tunisi.mw === null && tunisi.tabella.every(t => !t.ammissibile),
     'Tunisi (nel riquadro di controllo): nessuna zona ammissibile, disaggregazione richiesta, nessuna Mw (R minima ' +
     (tunisi.distanza_bordo_km ? tunisi.distanza_bordo_km.toFixed(0) : '–') + ' km)');
}
// dentro il riquadro ma lontano dalle zone (Mar Tirreno centrale): procedura fuori zona applicata
{
  const r = ZS9.valuta(40.0, 11.5, D);
  ok(['fuori_zona', 'disaggregazione_richiesta'].includes(r.esito) && r.tabella.length === 36,
     'Mar Tirreno (40,0; 11,5): ' + r.esito + ', R minima ' + r.distanza_bordo_km.toFixed(1) + ' km, Mw ' + r.mw);
}
// nessuna zona ammissibile → disaggregazione (punto costruito lontano: Sardegna occidentale)
{
  const r = ZS9.valuta(40.0, 8.5, D);
  ok(r.esito === 'disaggregazione_richiesta' && r.mw === null && r.zone_mw.length === 0 &&
     r.tabella.every(t => !t.ammissibile && !t.selezionata) &&
     r.avvisi.some(a => a.codice === 'disaggregazione' && /non è stato possibile determinare una Mw zonale/.test(a.testo)),
     'Caso D – Sardegna (40,0; 8,5): ' + r.esito + ', nessuna Mw, nessuna zona selezionata, segnalazione della disaggregazione' + ' (R minima ' + r.distanza_bordo_km.toFixed(1) + ' km)');
}
// coordinate non valide
ok(ZS9.valuta(NaN, 13, D).esito === 'dati_non_validi', 'Latitudine NaN: dati non validi');
ok(ZS9.valuta('42.35', 13.4, D).esito === 'dati_non_validi', 'Latitudine come testo: dati non validi');
ok(ZS9.valuta(95, 13, D).esito === 'dati_non_validi', 'Latitudine 95°: dati non validi');
ok(ZS9.valuta(null, 13, D).esito === 'dati_non_validi', 'Latitudine nulla: dati non validi');
// dati non validi
let errore = '';
try { ZS9.valuta(42.35, 13.4, { meta: { formato: 'altro' }, zone: [] }); } catch (e) { errore = e.message; }
ok(/formato geohub-zs9\/1/.test(errore), 'File dati con formato errato: errore esplicito');
errore = '';
try { ZS9.valuta(42.35, 13.4, { meta: D.meta, zone: D.zone.slice(0, 35) }); } catch (e) { errore = e.message; }
ok(/36 zone/.test(errore), 'File dati con 35 zone: errore esplicito');

/* ---------------- 4. Procedura fuori zona ---------------- */
{
  let coerente = true;
  for (const [, la, lo, esito] of LOC) {
    if (esito !== 'fuori_zona') continue;
    const r = ZS9.valuta(la, lo, D), t = r.tabella;
    for (let i = 0; i < t.length; i++) {
      if (!quasi(t[i].ms, 1 + 3 * Math.log10(t[i].r_km), 1e-12)) coerente = false;
      if (t[i].ammissibile !== (t[i].ms < t[i].m)) coerente = false;
      if (t[i].selezionata !== (t[i].ammissibile && t[i].m === r.mw)) coerente = false;
      if (t[i].m !== ZS9.MW_MAX[t[i].zona]) coerente = false;
      if (i && t[i].r_km < t[i - 1].r_km) coerente = false;
    }
    if (new Set(t.map(x => x.zona)).size !== 36) coerente = false;
    if (r.mw !== Math.max(...t.filter(x => x.ammissibile).map(x => x.m))) coerente = false;
    if (r.zone_mw.join() !== t.filter(x => x.selezionata).map(x => x.zona).join()) coerente = false;
    if (r.distanza_bordo_km !== t[0].r_km) coerente = false;
  }
  ok(coerente, 'Fuori zona: 36 righe distinte, ordine per R, Ms = 1 + 3·log10 R, «ammissibile» se Ms < M, Mw = massima M fra le sole zone ammissibili, zone selezionate coerenti');
}

/* ---------------- 6. Casi della specifica (§10) ---------------- */
// Caso A – sito interno: zona e Mw da Tab. A1.1, nessuna tabella
{
  const r = ZS9.valuta(42.3498, 13.3995, D);
  ok(r.esito === 'dentro_zona' && r.zona === 923 && r.mw === 7.06 && r.tabella === null && r.zone_mw.join() === '923',
     'Caso A – L\'Aquila: zona 923 per appartenenza geometrica, Mw 7,06 (Tab. A1.1)');
}
// Caso B generalizzato – vertice comune a tre o più zone (se presente nei dati)
{
  const tre = comuni.find(([, s]) => s.size >= 3);
  if (tre) {
    const [k, s] = tre; const [lo, la] = k.split(',').map(Number); const r = ZS9.valuta(la, lo, D);
    const zz = [...s];
    ok(r.esito === 'confine_comune' && zz.every(z => r.zone_contenenti.includes(z)) && r.mw === Math.max(...zz.map(z => ZS9.MW_MAX[z])),
       `Caso B (tre o più zone) – vertice comune a ${zz.join('/')}: Mw ${r.mw}, la più alta`);
  } else ok(true, 'Caso B (tre o più zone): nessun vertice comune a tre zone nei dati');
}
// Caso C – disuguaglianza stretta
ok(ZS9.zonaAmmissibile(6.37, 6.37) === false && ZS9.zonaAmmissibile(6.369999, 6.37) === true,
   'Caso C – test Ms_i < M_i con disuguaglianza stretta (Ms = M → non ammissibile)');
// Caso C – Mw dalle sole zone ammissibili: il massimo fra tutte le 36 zone sarebbe 7,29
{
  const r = ZS9.valuta(42.4618, 14.2161, D);
  const tutte = Math.max(...r.tabella.map(t => t.m));
  ok(r.mw === 7.06 && tutte === 7.29 && !r.tabella.find(t => t.m === 7.29).ammissibile,
     'Caso C – Pescara: Mw 7,06 dalle zone ammissibili (la massima fra tutte le zone, 7,29, è esclusa dal test)');
}
// Caso E – avviso solo informativo: stessa Mw con e senza avviso, campi completi
{
  const a = ZS9.valuta(38.0, 15.35, D);
  const p = a.prossimita_bordo[0];
  ok(a.esito === 'dentro_zona' && a.zona === 929 && a.mw === 7.29 && p && p.zona === 932 &&
     p.fascia_km === 5 && p.soglia_km === 5 && p.d_km < 5 && /soglia applicata 5 km/.test(a.avvisi.find(x => x.codice === 'vicino_bordo').testo),
     'Caso E – sito nella zona 929 a ' + (p ? p.d_km.toFixed(2) : '?') + ' km dalla 932: avviso con zona, distanza, fascia 5 km e soglia applicata 5 km; zona e Mw invariate');
  const b = ZS9.valuta(42.3550, 14.4030, D);   // Ortona: nessun confine entro soglia
  ok(b.prossimita_bordo.length === 0 && !b.avvisi.some(x => x.codice === 'vicino_bordo'), 'Caso E – Ortona: nessun confine entro la soglia, nessun avviso');
  const soglie = Object.keys(ZS9.BORDO_MORBIDO_KM).every(z => Math.max(ZS9.BORDO_MORBIDO_KM[z], 0.5) >= 0.5);
  ok(soglie, 'Caso E – soglia = max(w_i; 0,5 km) per tutte le zone (fascia 0 → 0,5 km)');
}
// Caso F – zone 923 e 927
ok(ZS9.MW_MAX[923] === 7.06 && ZS9.MW_MAX[927] === 7.06 && D.zone.some(z => z.id === 923) && D.zone.some(z => z.id === 927),
   'Caso F – zone 923 e 927 presenti nei dati e nella tabella, Mw,max 7,06');
// Caso G – datum non dichiarato: segnalato in ogni valutazione, senza dichiararlo WGS84
{
  const casi = [[42.3498, 13.3995], [42.4618, 14.2161], [40.0, 8.5]].map(([a, b]) => ZS9.valuta(a, b, D));
  ok(casi.every(r => r.incertezze_dati.some(x => x.codice === 'datum_non_dichiarato' && /non è dichiarato/.test(x.testo) && /senza assumere che il datum originario sia WGS84/.test(x.testo))),
     'Caso G – datum del file ZS9 non dichiarato: incertezza segnalata in ogni esito, nessuna assunzione di WGS84');
  ok(!/0,5 km.*datum|datum.*0,5 km/.test(ZS9.TESTI.dato) && /non è una misura dell'incertezza del datum/.test(ZS9.TESTI.bordi),
     'Caso G – la soglia di 0,5 km non è presentata come misura dell\'incertezza del datum');
}

/* ---------------- 5. Geodesia ---------------- */
/* Riferimenti: distanze sull'ellissoide WGS84 calcolate con GeographicLib
   (Karney 2013, pyproj.Geod), vedi verifiche/verifica_zs9.py */
const G = [[42.3498, 13.3995, 42.4618, 14.2161, 68.3656], [45.0, 7.0, 37.5, 15.0, 1068.1569], [42.0, 13.0, 42.0, 13.0, 0]];
for (const [a, b, c, d, km] of G) {
  const v = ZS9.distanzaGeodetica(a, b, c, d) / 1000;
  ok(quasi(v, km, 0.0005), `Vincenty (${a}, ${b}) → (${c}, ${d}): ${v.toFixed(4)} km (riferimento ${km})`);
}

console.log(`\n${n - errori.length}/${n} controlli superati.`);
if (errori.length) process.exit(1);
