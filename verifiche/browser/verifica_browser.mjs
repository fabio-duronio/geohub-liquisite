// GeoHub-LiquiSite — controllo nel browser: apertura di progetti alterati, rendering sicuro,
// FS di riferimento, calcolo ed esportazione. I payload sono innocui: al massimo impostano
// una variabile globale di prova (globalThis.__liquiXSS).
//
// Richiede Playwright con Chromium:  npm install --no-save playwright && npx playwright install chromium
// Uso:  node verifiche/browser/verifica_browser.mjs
// I file dell'app sono serviti da disco tramite intercettazione delle richieste: niente server.
// Le richieste verso l'esterno sono bloccate e contate: l'app deve funzionare senza.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const P = require('../../app/progetto.js');
const E = require('../../app/esempio.js');

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'http://liquisite.test/';
const TIPI = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const PAYLOAD = '"><img src=x onerror="globalThis.__liquiXSS=1">';

let ok = 0, ko = 0;
const check = (nome, ottenuto, atteso) => {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const erroriJS = [], dialoghi = [], esterne = [], csp = [];
page.on('pageerror', e => erroriJS.push(e.message));
page.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
page.on('dialog', d => { dialoghi.push(d.message()); d.accept(); });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin + '/' !== BASE) { if (!/^(data|blob):/.test(url.protocol)) esterne.push(url.href); return route.abort(); }
  const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
});
await page.goto(BASE);
await page.waitForFunction(() => window.LiquiUI && window.Chart);

const iniettato = () => page.evaluate(() => ({ flag: globalThis.__liquiXSS === 1, img: document.querySelectorAll('img[src="x"]').length }));
const apriFile = async (obj) => {
  dialoghi.length = 0;
  await page.setInputFiles('#fileApri', { name: 'progetto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
  await page.waitForTimeout(300);
};
const titolo = () => page.evaluate(() => window.LiquiUI.stato.pr.progetto.titolo);
const tutteLeSchede = async () => {
  for (const t of ['esclusione', 'profili', 'tabelle', 'confronto', 'avvisi']) { await page.click('#tab-' + t); await page.waitForTimeout(150); }
};
const base = () => JSON.parse(P.salvaProgetto(E.progettoEsempio()));
// Le impostazioni si aprono a tutto schermo: si chiudono prima di usare la barra in alto.
const chiudi = () => page.evaluate(() => { const b = document.getElementById('closeSettings'); if (b && b.offsetParent) b.click(); });
const fsRif = async (testo) => {
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(100);
  await page.fill('#scFsRif', testo); await page.waitForTimeout(100);
  const st = await page.evaluate(() => ({ valore: window.LiquiUI.stato.pr.scenari[0].opzioni.FSrif, invalido: document.getElementById('scFsRif').getAttribute('aria-invalid'), errore: !document.getElementById('scFsRifErr').hidden }));
  await chiudi(); await page.waitForTimeout(100);
  return st;
};

console.log('1. Apertura di progetti alterati');
{
  await page.click('#btnEsempio');
  const prima = await titolo();
  const a = base(); a.scenari[0].opzioni.CFC = PAYLOAD; a.progetto.titolo = 'alterato';
  await apriFile(a);
  check('opzione testuale: file rifiutato con errore leggibile', dialoghi.some(m => m.includes('non è stato aperto') && m.includes('opzioni.CFC')), true);
  check('opzione testuale: progetto corrente invariato', await titolo(), prima);
  const b = base(); b.prove[0].tipo = 'constructor';
  await apriFile(b);
  check('tipo «constructor»: rifiutato senza eccezioni', [dialoghi.some(m => m.includes('prove[0].tipo')), erroriJS.length], [true, 0]);
  const c = base(); c.progetto.titolo = 'con risultati alterati';
  c.risultati = { [c.scenari[0].id]: { stato: 'calcolato', riepilogo: { punti: PAYLOAD, conteggi: { calcolato: PAYLOAD }, avvisi: [], intervalliNonCalcolati: [] }, righe: [] } };
  await apriFile(c);
  check('risultati alterati: progetto aperto, risultati scartati con avviso', [await titolo(), dialoghi.some(m => m.includes('non sono stati ricaricati'))], ['con risultati alterati', true]);
  check('risultati alterati: nessuna iniezione', await iniettato(), { flag: false, img: 0 });
}

console.log('2. Testo libero con payload in tutte le schede, nel confronto e nella stampa');
{
  const a = base();
  a.progetto.titolo = PAYLOAD; a.progetto.sito = PAYLOAD; a.progetto.autore = PAYLOAD; a.progetto.note = PAYLOAD;
  for (const p of a.prove) { p.nome = PAYLOAD + p.id; p.provenienza = PAYLOAD; }
  for (const s of a.scenari) { s.nome = PAYLOAD + s.id; s.note = PAYLOAD; s.strati.forEach(st => { st.descrizione = PAYLOAD; }); s.esclusione.strati.forEach(x => { x.campione = PAYLOAD; x.motivazione4 = PAYLOAD; }); }
  // salto della conferma: il progetto corrente non ha modifiche
  await apriFile(a);
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  await tutteLeSchede();
  // confronto con due scenari della stessa prova e falde diverse (avviso sul dominio con i nomi)
  await page.click('#tab-confronto');
  await page.evaluate(() => { const S = window.LiquiUI.stato; S.confronto = [S.pr.scenari[0].id, S.pr.scenari[2].id]; window.LiquiUI.renderTutto(); });
  await page.evaluate(() => { const S = window.LiquiUI.stato; for (const s of [S.pr.scenari[0], S.pr.scenari[2]]) window.LiquiUI.calcola(s); S.pr.scenarioAttivo = S.pr.scenari[0].id; window.LiquiUI.renderTutto(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#btnStampa'); await page.waitForTimeout(600);
  check('testo libero: nessuna iniezione', await iniettato(), { flag: false, img: 0 });
  const margini = await page.evaluate(() => { const st = document.getElementById('stileMargini'); const r = window.LiquiUI.stato.pr.risultati[window.LiquiUI.stato.pr.scenarioAttivo]; return st ? [st.textContent.includes('firma input ' + r.firma), /@bottom-right\{content:"pagina " counter\(page\) " di " counter\(pages\)/.test(st.textContent), st.sheet ? st.sheet.cssRules.length : 0] : null; });
  check('stampa: intestazione e piè di pagina ripetuti con firma e numero di pagina', margini, [true, true, 1]);
  check('testo libero: mostrato come testo', await page.evaluate((p) => document.body.textContent.includes(p), PAYLOAD), true);
}

console.log('3. Seconda difesa: valori alterati iniettati in memoria, aggirando la validazione');
{
  await page.evaluate((p) => {
    const S = window.LiquiUI.stato, sc = S.pr.scenari[0];
    S.pr.scenarioAttivo = sc.id;
    sc.opzioni.CFC = p; sc.opzioni.IcSoglia = p; sc.opzioni.Vs12 = p; sc.Mw = p;
    S.pr.prove.forEach(pv => { Object.keys(pv.parametri).forEach(k => { pv.parametri[k] = p; }); });
    S.pr.risultati[sc.id] = { stato: 'calcolato', versioneMotore: p, firma: p, righe: [],
      riepilogo: { punti: p, conteggi: { calcolato: p }, avvisi: [{ codice: p, tipo: p, n: p, zDa: 0, zA: 1, messaggio: p }], intervalliNonCalcolati: [{ da: 0, a: 1, n: p, stato: p, motivo: p }], assunzioni: [], fsMin: null, profonditaIndagata: null, estensioneAnalizzata: null } };
    try { window.LiquiUI.renderTutto(); } catch (e) { /* un errore di rendering non è un'iniezione */ }
  }, PAYLOAD);
  for (const t of ['esclusione', 'profili', 'tabelle', 'avvisi']) { try { await page.click('#tab-' + t, { timeout: 2000 }); } catch (e) { } await page.waitForTimeout(100); }
  await page.evaluate(() => { const d = document.querySelector('[data-open-section="secScenario"]'); if (d) d.click(); const p = document.querySelector('[data-open-section="secProva"]'); if (p) p.click(); });
  await page.waitForTimeout(200);
  await chiudi();
  if (process.env.DEBUG) console.log(await page.evaluate(() => [...document.querySelectorAll('img[src="x"]')].map(i => { let e = i; for (let k = 0; k < 3 && e.parentElement; k++) e = e.parentElement; return (e.id || e.className) + ' :: ' + e.outerHTML.slice(0, 300); })));
  check('valori alterati in memoria: nessuna iniezione', await iniettato(), { flag: false, img: 0 });
  check('opzione alterata mostrata come valore del campo', await page.evaluate((p) => { const el = document.getElementById('scCfc'); return el ? el.value === p : null; }, PAYLOAD), true);
}

console.log('3b. Seconda difesa: risultato vero con ogni testo sostituito dal payload');
{
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#btnEsempio'); await page.waitForTimeout(200);
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  const n = await page.evaluate((p) => {
    const S = window.LiquiUI.stato, sc = S.pr.scenari[0], r = S.pr.risultati[sc.id];
    let k = 0;
    const altera = (o) => { if (Array.isArray(o)) o.forEach((v, i) => { if (typeof v === 'string') { o[i] = p; k++; } else altera(v); });
      else if (o && typeof o === 'object') for (const c of Object.keys(o)) { if (['stato', 'versioneMotore', 'firma'].includes(c) && o === r) continue; if (typeof o[c] === 'string') { o[c] = p; k++; } else altera(o[c]); } };
    altera(r);
    window.LiquiUI.renderTutto();
    return k;
  }, PAYLOAD);
  for (const t of ['esclusione', 'profili', 'tabelle', 'confronto', 'avvisi']) { await page.click('#tab-' + t); await page.waitForTimeout(150); }
  for (const st of ['originali', 'intermedi', 'finali']) await page.evaluate((x) => { const b = document.querySelector('[data-sub="' + x + '"]'); if (b) b.click(); }, st);
  await page.click('#tab-tabelle'); await page.waitForTimeout(100);
  await page.evaluate(() => { window.print = () => {}; }); await page.click('#btnStampa'); await page.waitForTimeout(500);
  check('testi del risultato sostituiti (' + n + ')', n > 100, true);
  if (process.env.DEBUG) console.log([...new Set(await page.evaluate(() => [...document.querySelectorAll('img[src="x"]')].map(i => { const e = i.parentElement; return e.tagName + '.' + e.className + ' < ' + (e.parentElement ? e.parentElement.tagName + '.' + e.parentElement.className + '#' + e.parentElement.id : '') + ' :: ' + e.outerHTML.replace(/"&gt;&lt;img[^&]*&gt;/g, 'P').slice(0, 160); })))].join('\n'));
  check('risultato con testi alterati: nessuna iniezione', await iniettato(), { flag: false, img: 0 });
  erroriJS.length = 0; // gli errori di rendering su dati volutamente corrotti non sono oggetto di questo controllo
}

console.log('4. FS di riferimento, calcolo ed esportazione');
{
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#btnEsempio'); await page.waitForTimeout(200);
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  const scarica = async () => { const d = page.waitForEvent('download', { timeout: 1500 }).catch(() => null); await page.click('#btnCsv'); return d; };
  const d1 = await scarica();
  check('CSV con FS di riferimento valido', d1 !== null, true);
  if (d1) { const testo = fs.readFileSync(await d1.path(), 'utf8'); check('CSV: righe di intestazione e dati', /FS di riferimento;1,25/.test(testo) && /z \[m\]/.test(testo), true); }
  const stato = await fsRif('4');
  check('FS rif 4: valore conservato, campo segnalato', stato, { valore: 4, invalido: 'true', errore: true });
  dialoghi.length = 0;
  check('FS rif 4: CSV bloccato', await scarica(), null);
  check('FS rif 4: motivo mostrato', dialoghi.some(m => m.includes('FS di riferimento non valido')), true);
  dialoghi.length = 0;
  await page.click('#btnStampa'); await page.waitForTimeout(200);
  check('FS rif 4: stampa bloccata', dialoghi.some(m => m.includes('FS di riferimento non valido')), true);
  check('FS rif 4: riepilogo con errore e senza 1,25', await page.evaluate(() => { const t = document.getElementById('riepilogo').textContent; return t.includes('FS di riferimento da correggere') && !t.includes('FS di riferimento 1,25'); }), true);
  const vuoto = await fsRif('');
  check('campo vuoto: 1,25 e CSV di nuovo consentito', [vuoto.valore, vuoto.invalido, (await scarica()) !== null], [null, null, true]);
  await fsRif('abc');
  dialoghi.length = 0;
  await page.click('#btnSalva'); await page.waitForTimeout(150);
  check('FS rif non numerico: salvataggio bloccato con motivo', dialoghi.some(m => m.includes('non numerico')), true);
}

console.log('4b. Testi del confronto, del riepilogo e della stampa');
{
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#btnEsempio'); await page.waitForTimeout(200);
  await page.evaluate(() => { const S = window.LiquiUI.stato; for (const s of S.pr.scenari) window.LiquiUI.calcola(s); S.confronto = S.pr.scenari.map(s => s.id); window.LiquiUI.renderTutto(); });
  await page.click('#tab-confronto'); await page.waitForTimeout(400);
  const avvisi = await page.evaluate(() => [...document.querySelectorAll('#pan-confronto .alert')].map(a => a.textContent));
  const dominio = avvisi.filter(t => t.includes('punti calcolati diversi'));
  check('confronto: dominio segnalato solo tra scenari della stessa prova, con il nome esplicito', [dominio.length, /11 profondità hanno un FS solo in «SLV – falda alta 1,0 m»/.test(dominio[0] || '')], [1, true]);
  check('confronto: basi solo dei metodi presenti', avvisi.some(t => t.includes('B&I 2014 SPT: PL non calcolata') && !t.includes('Cetin') && !t.includes('Kayen')), true);
  await page.click('#tab-profili'); await page.waitForTimeout(200);
  const kpi = await page.evaluate(() => document.getElementById('riepilogo').innerText);
  check('riepilogo: intervalli non calcolati sotto i punti calcolati, non sotto gli avvisi', /non calcolati in 6 intervalli/.test(kpi) && !/Avvisi\s*\n?\s*1\s*\n?\s*6 intervalli/.test(kpi), true);
  await page.evaluate(() => { window.print = () => {}; }); await page.click('#btnStampa'); await page.waitForTimeout(500);
  const stampa = await page.evaluate(() => document.getElementById('stampa').innerText);
  check('stampa: nessun codice interno negli intervalli', /NON_SATURO|IC_OLTRE_SOGLIA/.test(stampa), false);
  check('stampa: nome dell\'app coerente nei margini', await page.evaluate(() => /"GeoHub-LiquiSite \d+\.\d+\.\d+/.test(document.getElementById('stileMargini').textContent)), true);
}

console.log('4c. Magnitudo Mw dalle zone ZS9: coordinate, proposta, motivazione, stampa');
{
  await page.evaluate(() => { window.confirm = () => true; window.print = () => {}; });
  await page.click('#btnEsempio'); await page.waitForTimeout(200);
  const coordinate = async (lat, lon) => {
    await page.click('#btnImpostazioni'); await page.waitForTimeout(100);
    await page.evaluate(() => { document.getElementById('secProgetto').open = true; });
    await page.fill('#prLat', lat); await page.fill('#prLon', lon); await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({ testo: document.getElementById('prZs9').textContent, errore: document.getElementById('prCoordErr').hidden ? '' : document.getElementById('prCoordErr').textContent }));
    await chiudi(); await page.waitForTimeout(100);
    return r;
  };
  const scen = () => page.evaluate(() => { const S = window.LiquiUI.stato.pr; const s = S.scenari.find(x => x.id === S.scenarioAttivo); return { Mw: s.Mw, origine: s.magnitudo.origine }; });
  check('esempio: Mw manuale, nessuna proposta', await scen(), { Mw: 6.1, origine: 'manuale' });
  check('coordinate in gradi-primi-secondi: errore', /gradi decimali/.test((await coordinate('42°21\'', '13,3995')).errore), true);
  check('lat/lon invertite: segnalate, nessuna Mw', /invertite/.test((await coordinate('13,3995', '42,3498')).testo), true);
  check('Sardegna: disaggregazione richiesta, con collegamento alle mappe INGV', await (async () => { const r = await coordinate('40,0', '8,5'); return /disaggregazione richiesta/.test(r.testo) && await page.evaluate(() => !!document.querySelector('#prZs9 a[href="https://esse1-gis.mi.ingv.it/"]')); })(), true);
  check('L\'Aquila: zona 923, Mw 7,06', /zona 923.*Mw = 7,06/.test((await coordinate('42,3498', '13,3995')).testo), true);
  check('scenario manuale: Mw invariata dalle coordinate', await scen(), { Mw: 6.1, origine: 'manuale' });
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.check('input[name="scMwOrig"][value="zs9"]'); await page.waitForTimeout(150);
  check('scelta «proposta ZS9»: Mw 7,06 applicata', await scen(), { Mw: 7.06, origine: 'zs9' });
  await page.fill('#scMwMot', ''); await page.waitForTimeout(150);
  check('Mw uguale alla proposta senza motivazione: obbligatoria segnalata', [await page.getAttribute('#scMwMot', 'aria-invalid'), /Motivazione della Mw mancante: è obbligatoria/.test(await page.textContent('#scMwMsg'))], ['true', true]);
  await page.fill('#scMw', '6,8'); await page.waitForTimeout(150);
  check('Mw diversa: motivazione obbligatoria segnalata', [await page.getAttribute('#scMwMot', 'aria-invalid'), /Motivazione della Mw mancante: è obbligatoria/.test(await page.textContent('#scMwMsg'))], ['true', true]);
  await chiudi(); await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  dialoghi.length = 0;
  await page.click('#btnStampa'); await page.waitForTimeout(200);
  check('Mw diversa senza motivazione: stampa bloccata', dialoghi.some(m => m.includes('Motivazione della Mw mancante')), true);
  dialoghi.length = 0;
  const d = page.waitForEvent('download', { timeout: 1500 }).catch(() => null); await page.click('#btnCsv');
  check('Mw diversa senza motivazione: CSV bloccato', [await d, dialoghi.some(m => m.includes('Motivazione della Mw mancante'))], [null, true]);
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.fill('#scMwMot', 'Valore da disaggregazione INGV del nodo più vicino'); await page.waitForTimeout(100);
  await chiudi();
  dialoghi.length = 0;
  await page.click('#btnStampa'); await page.waitForTimeout(500);
  let stampa = await page.evaluate(() => document.getElementById('stampa').innerText);
  check('con motivazione: stampa consentita, sezione 1.1 con motivazione', [dialoghi.length, /1\.1 Magnitudo di riferimento/.test(stampa), stampa.includes('Valore da disaggregazione INGV del nodo più vicino')], [0, true, true]);
  check('stampa: fonte, criterio, datum, criticità', ['Tab. A1.1, pag. 31', 'doi:10.13127/sh/zs9', 'CC BY 4.0', 'interpretazione della regola delle Linee guida LQ, pag. 30', 'circa 100 m', 'pag. 31–32'].every(t => stampa.includes(t)), true);
  check('stampa: avvertenza su datum non dichiarato e appartenenza geometrica indicativa', /Avvertenza\s*Datum dello shapefile ZS9 non dichiarato: .*risultato geometrico indicativo/.test(stampa), true);
  check('stampa: nessun LSN (escluso dalla 1.0)', /LSN/.test(stampa), false);
  // Pescara: sito esterno, tabella completa in app e in stampa; lo scenario la segue solo se seguiva la proposta
  await coordinate('42,4618', '14,2161');
  check('coordinate cambiate: Mw scelta dal geologo invariata', await scen(), { Mw: 6.8, origine: 'zs9' });
  await page.click('#tab-magnitudo'); await page.waitForTimeout(300);
  check('scheda Magnitudo: tabella delle 36 zone', await page.locator('#pan-magnitudo table.zs9-tab tbody tr').count(), 36);
  check('scheda Magnitudo: zone escluse e selezionate', await page.evaluate(() => { const t = document.querySelector('#pan-magnitudo table.zs9-tab').innerText; return /esclusa/.test(t) && document.querySelectorAll('#pan-magnitudo tr.zs9-mw').length; }), 2);
  await page.click('#tab-profili'); await page.waitForTimeout(200);
  await page.click('#btnStampa'); await page.waitForTimeout(500);
  check('stampa (Pescara): tabella delle 36 zone', await page.evaluate(() => [...document.querySelectorAll('#stampa table')].some(t => t.querySelectorAll('tbody tr').length === 36 && /esclusa/.test(t.innerText))), true);
  // nuovo scenario con coordinate valide: proposta applicata
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.click('#btnNuovoScenario'); await page.waitForTimeout(200);
  check('nuovo scenario: proposta ZS9 applicata', await scen(), { Mw: 7.06, origine: 'zs9' });
  await page.fill('#scMw', '4,9'); await page.waitForTimeout(150);
  check('Mw 4,9: avvisi Linee guida LQ e Cetin 2018', await page.evaluate(() => { const t = document.getElementById('scMwMsg').textContent; return [/Mw < 5:/.test(t), /Mw < 5,5:/.test(t)]; }), [true, true]);
  await chiudi();
  // la sezione successiva parte dall'esempio appena aperto, come prima di questa sezione
  await page.click('#btnEsempio'); await page.waitForTimeout(200);
}

console.log('5. Modifiche non salvate');
{
  let chiesto = 0;
  await page.evaluate(() => { window.__conferme = 0; window.confirm = () => { window.__conferme++; return false; }; });
  await fsRif('1.3');
  await page.click('#btnEsempio'); await page.waitForTimeout(100);
  chiesto = await page.evaluate(() => window.__conferme);
  check('modifica non salvata: conferma richiesta e rifiutata', [chiesto, await page.evaluate(() => window.LiquiUI.stato.pr.scenari[0].opzioni.FSrif)], [1, 1.3]);
  await page.click('#btnApri'); await page.waitForTimeout(100);
  check('apertura di un altro file: conferma richiesta', await page.evaluate(() => window.__conferme), 2);
  const d = page.waitForEvent('download', { timeout: 1500 }).catch(() => null);
  await page.click('#btnSalva'); await d;
  await page.click('#btnEsempio'); await page.waitForTimeout(100);
  check('dopo il salvataggio: nessuna conferma', await page.evaluate(() => window.__conferme), 2);
}

check('nessun errore JavaScript', erroriJS, []);
check('nessuna richiesta a servizi esterni', esterne, []);
check('nessuna violazione della Content Security Policy', csp, []);
check('caratteri locali caricati', await page.evaluate(async () => { await document.fonts.ready; return ['400 14px "IBM Plex Sans"', '600 14px "IBM Plex Sans"', '400 14px "IBM Plex Mono"'].every(f => document.fonts.check(f)); }), true);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
