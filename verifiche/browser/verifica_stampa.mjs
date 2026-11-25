// GeoHub-LiquiSite — controllo nel browser della stampa (audit v1.0.0, rilievi B6.1–B6.3).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Ctrl+P / Cmd+P si simula con gli eventi beforeprint e afterprint, che il browser emette
// prima e dopo la stampa; window.print è disattivata (nessuna finestra di dialogo nei test).
// File serviti da disco, rete esterna bloccata, come in verifica_browser.mjs.
// Uso: node verifiche/browser/verifica_stampa.mjs
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

let ok = 0, ko = 0;
const check = (nome, ottenuto, atteso) => {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
};

let browser;
try { browser = await chromium.launch(); } catch (e) { if (!CHROME) throw e; browser = await chromium.launch({ executablePath: CHROME }); }
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const erroriJS = [], dialoghi = [];
page.on('pageerror', e => erroriJS.push(e.message));
page.on('dialog', d => { dialoghi.push(d.message()); d.accept(); });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin + '/' !== BASE) return route.abort();
  const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
});
await page.goto(BASE);
await page.waitForFunction(() => window.LiquiUI && window.Chart);
await page.evaluate(() => { window.print = () => {}; });

const ctrlP = () => page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const dopoStampa = () => page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
const stampa = () => page.evaluate(() => document.getElementById('stampa').innerText);
const margini = () => page.evaluate(() => (document.getElementById('stileMargini') || {}).textContent || '');
const tavole = () => page.evaluate(() => [...document.querySelectorAll('#stampa .st-grafici figure figcaption')]
  .map(f => f.innerText.split(' – ')[0].trim()).filter(t => !/^Strato/.test(t)));
const chiudi = () => page.evaluate(() => { const b = document.getElementById('closeSettings'); if (b && b.offsetParent) b.click(); });
const TAVOLE_CPT = ['Indice di comportamento', 'Resistenza normalizzata', 'Domanda e resistenza', 'Fattore di sicurezza', 'Probabilità PL', 'Indice IL cumulato', 'Deformazione volumetrica', 'Cedimento cumulato'];

console.log('1. Ctrl+P senza progetto: foglio di avviso, non una pagina bianca');
{
  await ctrlP();
  const t = await stampa();
  check('senza risultati: «STAMPA NON VALIDA»', /STAMPA NON VALIDA/.test(t), true);
  check('senza risultati: motivo riportato', /Calcola lo scenario attivo prima di stampare/.test(t), true);
  await dopoStampa();
  check('afterprint: rapporto svuotato', await stampa(), '');
}

console.log('2. Ctrl+P con risultati aggiornati, senza usare il pulsante (B6.1)');
{
  await page.click('#btnEsempio'); await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  check('nessun rapporto in pagina prima della stampa', await stampa(), '');
  await ctrlP(); await page.waitForTimeout(200);
  const t = await stampa();
  check('rapporto preparato da beforeprint', /GeoHub-LiquiSite – Verifica a liquefazione/.test(t) && /amax 0,260 g/.test(t), true);
  check('nessun avviso di stampa non valida', /STAMPA NON VALIDA/.test(t), false);
  check('margini di pagina con la firma', /firma input [0-9a-f]{8}/.test(await margini()), true);
  check('tavole fisse dell\'esempio CPTU', await tavole(), TAVOLE_CPT);
  check('carta di comportamento in stampa', /Carta di comportamento CPT/.test(t), true);
  await dopoStampa();
  check('afterprint: rapporto e margini svuotati', [await stampa(), await margini()], ['', '']);
}

console.log('3. Dopo una modifica non resta il rapporto vecchio (B6.2)');
{
  await page.evaluate(() => document.getElementById('btnStampa').click()); await page.waitForTimeout(600);
  check('pulsante «Stampa / PDF»: rapporto con amax 0,260 g', /amax 0,260 g/.test(await stampa()), true);
  check('pulsante: la scheda aperta non cambia', await page.evaluate(() => window.LiquiUI.stato.tab), 'profili');
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.fill('#scAmax', '0,35'); await page.waitForTimeout(150);
  await chiudi(); await page.waitForTimeout(150);
  check('modifica di amax: rapporto svuotato subito', await stampa(), '');
  await ctrlP();
  const t = await stampa();
  check('Ctrl+P con risultati non aggiornati: «STAMPA NON VALIDA»', /STAMPA NON VALIDA/.test(t), true);
  check('Ctrl+P con risultati non aggiornati: nessun valore del rapporto vecchio', /amax 0,260 g|Fattore di sicurezza/.test(t), false);
  await dopoStampa();
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  await page.fill('#scAmax', '0,26'); await chiudi(); await page.waitForTimeout(100);
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
}

console.log('4. Tavole indipendenti dalla vista (B6.3)');
{
  await page.click('#tab-profili'); await page.waitForTimeout(200);
  await page.click('[data-preset="cedimenti"]'); await page.waitForTimeout(300);
  await ctrlP(); check('gruppo «Cedimenti» aperto: stesse tavole', await tavole(), TAVOLE_CPT); await dopoStampa();
  await page.click('#tab-tabelle'); await page.waitForTimeout(300);
  await ctrlP(); check('scheda «Tabelle» aperta: stesse tavole', await tavole(), TAVOLE_CPT); await dopoStampa();
  await page.evaluate(() => document.getElementById('btnStampa').click()); await page.waitForTimeout(600);
  check('pulsante dalla scheda «Tabelle»: stesse tavole', await tavole(), TAVOLE_CPT);
  check('pulsante dalla scheda «Tabelle»: la scheda resta aperta', await page.evaluate(() => window.LiquiUI.stato.tab), 'tabelle');
  await dopoStampa();
}

console.log('5. Scenario SPT dell\'esempio');
{
  await page.evaluate(() => { const S = window.LiquiUI.stato; const s = S.pr.scenari[1]; S.pr.provaAttiva = s.provaId; S.pr.scenarioAttivo = s.id; window.LiquiUI.renderTutto(); });
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(400);
  await ctrlP();
  check('SPT: tavole di verifica e IL', await tavole(), ['N SPT (misurato)', 'Resistenza normalizzata', 'Domanda e resistenza', 'Fattore di sicurezza', 'Indice IL cumulato']);
  check('SPT: nessuna carta di comportamento CPT', /Carta di comportamento CPT/.test(await stampa()), false);
  await dopoStampa();
}

check('nessun errore JavaScript', erroriJS, []);
check('nessun dialogo inatteso', dialoghi, []);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
