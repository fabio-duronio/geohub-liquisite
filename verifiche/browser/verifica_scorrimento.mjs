// GeoHub-LiquiSite — controllo nel browser dello scorrimento con una vista a tutto schermo aperta (v1.0.2, punto 5).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Con Progetto, Prove, Scenario o Stratigrafia aperti la pagina sotto non deve scorrere con la rotella
// (la barra laterale della pagina sarebbe visibile e il contenuto fermo); alla chiusura la posizione
// della pagina precedente è intatta. Anche per il dialogo di importazione.
// File serviti da disco, rete esterna bloccata.
// Uso: node verifiche/browser/verifica_scorrimento.mjs
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
for (const [larghezza, altezza] of [[1440, 900], [375, 812]]) {
  const page = await browser.newPage({ viewport: { width: larghezza, height: altezza } });
  const erroriJS = [];
  page.on('pageerror', e => erroriJS.push(e.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin + '/' !== BASE) return route.abort();
    const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.LiquiUI && window.Chart);
  await page.click('text=Demo sintetica');
  await page.waitForTimeout(500);
  const sfondoAlto = await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 200);
  check(larghezza + ' pagina più alta della finestra (prerequisito)', sfondoAlto, true);
  await page.evaluate(() => window.scrollTo(0, 120));
  const prima = await page.evaluate(() => Math.round(document.scrollingElement.scrollTop));
  check(larghezza + ' posizione di partenza', prima, 120);

  const viste = [['Progetto', '#btnImpostazioni'], ['Prove', '[data-open-section=secProva]'], ['Scenario', '[data-open-section=secScenario]'], ['Stratigrafia', '[data-open-section=secStrati]']];
  for (const [nome, sel] of viste) {
    await page.evaluate(s => document.querySelector(s).click(), sel); // click da script: Playwright porterebbe il pulsante in vista scorrendo la pagina
    await page.waitForTimeout(300);
    await page.mouse.move(larghezza / 2, altezza / 2);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(250);
    const dopo = await page.evaluate(() => Math.round(document.scrollingElement.scrollTop));
    check(larghezza + ' ' + nome + ': la pagina sotto non scorre con la rotella', dopo, 120);
    await page.evaluate(() => document.getElementById('dlgSettings').close());
    await page.waitForTimeout(200);
    const chiusa = await page.evaluate(() => Math.round(document.scrollingElement.scrollTop));
    check(larghezza + ' ' + nome + ': alla chiusura la posizione è intatta', chiusa, 120);
    const libera = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    check(larghezza + ' ' + nome + ': alla chiusura la pagina torna scorrevole', libera === 'hidden', false);
  }
  check(larghezza + ' errori JavaScript', erroriJS, []);
  await page.close();
}
await browser.close();
console.log('verifica_scorrimento: ' + ok + ' controlli superati' + (ko ? ', ' + ko + ' NON superati' : ''));
process.exit(ko ? 1 : 0);
