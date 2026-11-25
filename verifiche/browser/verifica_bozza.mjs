// GeoHub-LiquiSite — controllo nel browser della bozza locale e dell'avviso in uscita (audit v1.0.0, B7).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Le pagine dello stesso contesto condividono localStorage, come le schede dello stesso browser:
// chiudere e riaprire una pagina equivale a ricaricare l'app. Rete esterna bloccata.
// Uso: node verifiche/browser/verifica_bozza.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'http://liquisite.test/';
const TIPI = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CHROME = ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
const CHIAVE = 'geohub_liquisite_bozza_v1';

let ok = 0, ko = 0;
const check = (nome, ottenuto, atteso) => {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
};

let browser;
try { browser = await chromium.launch(); } catch (e) { if (!CHROME) throw e; browser = await chromium.launch({ executablePath: CHROME }); }
const contesto = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const erroriJS = [], esterne = [];
await contesto.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin + '/' !== BASE) { if (!/^(data|blob):/.test(url.protocol)) esterne.push(url.href); return route.abort(); }
  const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
});

async function apri() {
  const page = await contesto.newPage();
  page.dialoghi = [];
  page.on('pageerror', e => erroriJS.push(e.message));
  page.on('dialog', d => { page.dialoghi.push(d.type() + ': ' + d.message()); d.accept(); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.LiquiUI && window.Chart);
  return page;
}
/** Chiude la pagina come farebbe l'utente (con beforeunload) e restituisce i dialoghi apparsi. */
async function chiudiScheda(page) {
  page.dialoghi.length = 0;
  await page.close({ runBeforeUnload: true });
  await new Promise(r => setTimeout(r, 400));
  return page.dialoghi.map(d => d.split(':')[0]);
}
const bozza = (page) => page.evaluate((k) => localStorage.getItem(k), CHIAVE);
const banner = (page) => page.evaluate(() => { const b = document.getElementById('bozzaBanner'); return b.hidden ? '' : b.innerText; });
const attendi = (page, ms = 700) => page.waitForTimeout(ms);
const chiudiImpostazioni = (page) => page.evaluate(() => { const b = document.getElementById('closeSettings'); if (b && b.offsetParent) b.click(); });
async function cambiaAmax(page, testo) {
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.fill('#scAmax', testo); await page.waitForTimeout(100);
  await chiudiImpostazioni(page);
}

console.log('1. Avvio senza bozza, progetto non modificato');
let page = await apri();
{
  check('nessuna bozza all\'avvio', await bozza(page), null);
  check('nessun banner all\'avvio', await banner(page), '');
  await page.click('#btnEsempio'); await attendi(page);
  check('esempio appena aperto (non modificato): nessuna bozza', await bozza(page), null);
  check('chiusura senza modifiche: nessun avviso', await chiudiScheda(page), []);
}

console.log('2. Modifica: bozza dei soli input e avviso in uscita');
page = await apri();
{
  await page.click('#btnEsempio'); await page.click('#btnQuickCalcola'); await attendi(page, 300);
  await cambiaAmax(page, '0,35'); await attendi(page);
  const b = JSON.parse(await bozza(page));
  const pr = JSON.parse(b.progetto);
  check('bozza salvata dopo la modifica', [b.versione, typeof b.salvataIl, pr.scenari[0].amax], [1, 'string', 0.35]);
  check('bozza senza risultati', Object.prototype.hasOwnProperty.call(pr, 'risultati'), false);
  check('chiusura con modifiche non salvate: avviso del browser', await chiudiScheda(page), ['beforeunload']);
}

console.log('3. Riapertura: banner, scelta in attesa, ripristino');
page = await apri();
{
  check('banner della bozza', /Bozza non salvata del .*Ripristinarlo\?/.test(await banner(page)), true);
  const prima = await bozza(page);
  await page.click('#btnEsempio'); await attendi(page);
  await cambiaAmax(page, '0,15'); await attendi(page);
  check('scelta in attesa: la bozza precedente non viene sovrascritta', await bozza(page), prima);
  await page.click('#bozzaBanner [data-azione="0"]'); await attendi(page, 300);
  check('ripristino: input della bozza', await page.evaluate(() => [window.LiquiUI.stato.pr.scenari[0].amax, window.LiquiUI.stato.pr.scenari.length]), [0.35, 3]);
  check('ripristino: banner chiuso', await banner(page), '');
  check('ripristino: risultati da ricalcolare', await page.evaluate(() => window.LiquiUI.statoRisultato(window.LiquiUI.stato.pr.scenari[0])), 'assente');
  await page.click('#btnQuickCalcola'); await attendi(page, 400);
  check('ripristino: calcolo eseguito', await page.evaluate(() => window.LiquiUI.statoRisultato(window.LiquiUI.stato.pr.scenari[0])), 'aggiornato');
  check('dopo il ripristino la bozza resta finché non si salva in un file', (await bozza(page)) !== null, true);
  const dl = page.waitForEvent('download');
  await page.click('#btnSalva'); await dl; await attendi(page);
  check('«Salva progetto»: bozza cancellata', await bozza(page), null);
  check('dopo il salvataggio: nessun avviso in uscita', await chiudiScheda(page), []);
}

console.log('4. «Elimina la bozza»');
page = await apri();
{
  await page.click('#btnEsempio'); await cambiaAmax(page, '0,30'); await attendi(page);
  await chiudiScheda(page);
  page = await apri();
  await page.click('#bozzaBanner [data-azione="1"]'); await attendi(page);
  check('eliminazione confermata: bozza cancellata e banner chiuso', [await bozza(page), await banner(page)], [null, '']);
  check('eliminazione: richiesta di conferma', page.dialoghi.some(d => /^confirm: Eliminare la bozza/.test(d)), true);
  await chiudiScheda(page);
}

console.log('5. Bozza alterata: stessa validazione di un file');
{
  // bozza scritta da un'altra scheda mentre questa è aperta e non modificata
  const altra = await apri();
  await altra.evaluate((k) => localStorage.setItem(k, JSON.stringify({ versione: 1, salvataIl: '<img src=x onerror="globalThis.__liquiXSS=1">', progetto: '{"formato":"altro"}' })), CHIAVE);
  check('chiusura di una scheda non modificata: nessun avviso', await chiudiScheda(altra), []);
  page = await apri();
  check('la bozza di un\'altra scheda non viene cancellata', (await bozza(page)) !== null, true);
  const testoBanner = await banner(page);
  check('data alterata mostrata come testo', /data non nota/.test(testoBanner) ? true : testoBanner, true);
  await page.click('#bozzaBanner [data-azione="0"]'); await attendi(page, 300);
  check('bozza non valida: messaggio e nessuna apertura', [page.dialoghi.some(d => /^alert: La bozza non è valida/.test(d)), await page.evaluate(() => window.LiquiUI.stato.pr.prove.length)], [true, 0]);
  check('bozza non valida: eliminata', await bozza(page), null);
  check('nessun codice eseguito dalla bozza', await page.evaluate(() => globalThis.__liquiXSS === 1 || document.querySelectorAll('img[src="x"]').length > 0), false);
  await page.close();
}

console.log('6. Memoria locale non disponibile');
{
  page = await apri();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('pieno', 'QuotaExceededError'); }; });
  await page.click('#btnEsempio'); await cambiaAmax(page, '0,31'); await attendi(page);
  check('avviso «Bozza automatica non salvata»', /Bozza automatica non salvata/.test(await banner(page)), true);
  check('l\'avviso in uscita resta', await chiudiScheda(page), ['beforeunload']);
}

check('nessun errore JavaScript', erroriJS, []);
check('nessuna richiesta a servizi esterni', esterne, []);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
