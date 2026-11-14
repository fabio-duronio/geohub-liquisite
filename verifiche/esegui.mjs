// GeoHub-LiquiSite — esegue tutte le verifiche numeriche e riassume l'esito.
// Uso: node verifiche/esegui.mjs        (aggiungere --browser per il controllo nel browser)
// Esce con codice diverso da zero se una verifica non è superata.
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const CARTELLA = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(CARTELLA, '..');
const conBrowser = process.argv.includes('--browser');

const comandi = fs.readdirSync(CARTELLA).filter(f => /^verifica_.*\.mjs$/.test(f)).sort().map(f => ['node', [path.join(CARTELLA, f)], f]);
const python = ['python3', 'python'].find(p => spawnSync(p, ['--version']).status === 0);
for (const f of fs.readdirSync(CARTELLA).filter(f => /^verifica_.*\.py$/.test(f)).sort()) comandi.push([python, [path.join(CARTELLA, f)], f]);
if (conBrowser) comandi.push(['node', [path.join(CARTELLA, 'browser', 'verifica_browser.mjs')], 'browser/verifica_browser.mjs']);

let falliti = 0, controlli = 0;
for (const [cmd, args, nome] of comandi) {
  if (!cmd) { console.log('✗ ' + nome + ': Python 3 non trovato'); falliti++; continue; }
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: RADICE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const uscita = (r.stdout || '') + (r.stderr || '');
  const ultima = uscita.trim().split('\n').pop() || '';
  const n = (ultima.match(/(\d+) controlli superati/) || [])[1];
  if (n) controlli += Number(n);
  const ok = r.status === 0;
  if (!ok) falliti++;
  console.log((ok ? '✓ ' : '✗ ') + nome.padEnd(30) + ' ' + ultima + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  if (!ok) console.log(uscita.split('\n').filter(l => /ERRORE|Error|non super/i.test(l)).slice(0, 20).join('\n'));
}
console.log('\n' + (falliti ? falliti + ' verifiche non superate' : 'Tutte le verifiche superate') + ' · ' + controlli + ' controlli conteggiati');
process.exit(falliti ? 1 : 0);
