// GeoHub-LiquiSite — controllo nel browser del flusso demo e importazione (audit v1.0.0, §4 punti 6 e 9).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// «Demo sintetica» calcola come «Esplora l'esempio»; gli altri scenari dell'esempio si calcolano
// quando si aprono; dopo «Salva la prova» il dialogo si chiude e propone il passaggio allo scenario.
// File serviti da disco, rete esterna bloccata.
// Uso: node verifiche/browser/verifica_flusso.mjs
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


const scegli = (sel, v) => page.evaluate(([s, v]) => { const e = document.getElementById(s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const stato = () => page.evaluate(() => { const U = window.LiquiUI.stato; return { risultati: Object.keys(U.pr.risultati).length, attivo: U.pr.scenarioAttivo, calcolato: !!U.pr.risultati[U.pr.scenarioAttivo] }; });

console.log('1. «Demo sintetica» calcola lo scenario attivo');
{
  await page.click('#btnEsempio'); await page.waitForTimeout(500);
  const s = await stato();
  check('demo: scenario attivo calcolato, gli altri no', [s.risultati, s.calcolato], [1, true]);
  check('demo: tabelle e riepilogo presenti', await page.evaluate(() => document.getElementById('statoCalcolo').textContent.length > 0), true);
}

console.log('2. Gli altri scenari della demo si calcolano quando si aprono');
{
  const ids = await page.evaluate(() => window.LiquiUI.stato.pr.scenari.map(s => [s.id, s.provaId]));
  const attivo = (await stato()).attivo;
  const altro = ids.find(([id, pid]) => id !== attivo && pid === ids.find(([i]) => i === attivo)[1]);
  await scegli('selScenario', altro[0]); await page.waitForTimeout(400);
  check('stessa prova: scenario aperto calcolato', (await stato()).calcolato, true);
  const altraProva = ids.find(([id, pid]) => pid !== ids.find(([i]) => i === attivo)[1]);
  await scegli('selProva', altraProva[1]); await page.waitForTimeout(400);
  check('altra prova: scenario aperto calcolato', (await stato()).calcolato, true);
}

console.log('3. Salva la prova: il dialogo si chiude e propone lo scenario');
{
  await page.evaluate(() => document.getElementById('btnDatiProva').click()); await page.waitForTimeout(300);
  check('dialogo aperto', await page.evaluate(() => document.getElementById('dlgImporta').open), true);
  await page.click('[data-import-step="3"]'); await page.click('#imApplica'); await page.waitForTimeout(500);
  check('dialogo chiuso dopo il salvataggio', await page.evaluate(() => document.getElementById('dlgImporta').open), false);
  check('avviso con il passaggio allo scenario', await page.evaluate(() => { const a = document.getElementById('avvisoProvaSalvata'); return !a.hidden && /salvata nel progetto/.test(a.textContent) && !!document.getElementById('btnVaiScenario'); }), true);
  await page.click('#btnVaiScenario'); await page.waitForTimeout(200);
  check('«Vai allo scenario»: sezione Scenario aperta, avviso chiuso', await page.evaluate(() => [document.getElementById('dlgSettings').open && document.getElementById('secScenario').open, document.getElementById('avvisoProvaSalvata').hidden]), [true, true]);
}

console.log('4. Pannello «Domanda e resistenza» con asse fisso (audit B1.e)');
{
  await page.evaluate(() => { const b = document.getElementById('closeSettings'); if (b && b.offsetParent) b.click(); document.getElementById('tab-profili').click(); }); await page.waitForTimeout(500);
  const asse = await page.evaluate(() => { const c = document.querySelector('[data-track="csrcrr"] canvas'); const ch = c && window.Chart.getChart(c); return ch ? [ch.options.scales.x.min, ch.options.scales.x.max] : null; });
  check('asse x del pannello 03 fisso 0–1', asse, [0, 1]);
}

console.log('5. Testi: FC a 0,075 mm e nota di non omogeneità nel confronto (audit §3.1 punti 2 e 4)');
{
  check('tabella strati: FC passante a 0,075 mm', await page.evaluate(() => document.querySelector('#tabStrati thead').textContent.includes('0,075 mm') && document.getElementById('hintFC').textContent.includes('0,075 mm')), true);
  await page.evaluate(() => { const U = window.LiquiUI.stato; U.confronto = U.pr.scenari.slice(0, 3).map(s => s.id); document.getElementById('tab-confronto').click(); });
  await page.waitForTimeout(600);
  const nota = await page.evaluate(() => document.getElementById('notaConf') ? document.getElementById('notaConf').textContent : '');
  check('confronto tra metodi diversi: nota di non omogeneità', /non sono omogenei/.test(nota), true);
}

check('nessun errore JavaScript', erroriJS, []);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
