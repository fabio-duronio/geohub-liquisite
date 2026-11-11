#!/usr/bin/env node
/*
 * verifica_robustezza.mjs — regressione su input non validi, casi limite e stati di esito
 * (motore 0.3.0). Non controlla valori scientifici: quelli sono in verifica_motore.mjs.
 *
 * Uso:   node verifiche/verifica_robustezza.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const fusi = require('../dati/fusi-ntc2018.json');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const codici = (r) => (r.errori || []).map(e => e.codice);
const haAvviso = (r, codice) => (r.avvisi || []).some(a => a.codice === codice);

// Punto di base valido (sotto falda) e sisma
const pt = { z: 6, N: 12, FC: 10, sv: 112, sve: 82, qc: 6, fs: 30, Vs: 170 };
const sis = { amax: 0.25, Mw: 6.5 };
const vert = { CE: 1, CB: 1, CS: 1, sporgenza: 1 };

// ---------------------------------------------------------------------------
console.log('1. Criterio 1 — input non validi e soglia');
for (const v of [null, '', -0.1, NaN, Infinity, '0.05', undefined, true]) {
  const r = L.criterio1(v);
  check('criterio1(' + String(v) + '): stato', r.stato, 'input_non_valido');
  check('criterio1(' + String(v) + '): soddisfatto', r.soddisfatto, null);
}
check('criterio1(0)', L.criterio1(0).soddisfatto, true);
check('criterio1(0,0999)', L.criterio1(0.0999).soddisfatto, true);
check('criterio1(0,1)', L.criterio1(0.1).soddisfatto, false);
check('criterio1(0,1001)', L.criterio1(0.1001).soddisfatto, false);

// ---------------------------------------------------------------------------
console.log('2. Criterio 2 — booleani reali e falda');
for (const [args, nome] of [[['20', true, true], 'falda stringa'], [[20, 'false', true], 'p.c. "false"'], [[20, true, 1], 'fondazioni 1'],
  [[null, true, true], 'falda null'], [[-1, true, true], 'falda sopra p.c.'], [[20, true, undefined], 'fondazioni mancanti']]) {
  const r = L.criterio2(...args);
  check('criterio2 ' + nome + ': stato', r.stato, 'input_non_valido');
  check('criterio2 ' + nome + ': soddisfatto', r.soddisfatto, null);
}
check('criterio2 falda 15 m', L.criterio2(15, true, true).soddisfatto, false);
check('criterio2 falda 15,001 m', L.criterio2(15.001, true, true).soddisfatto, true);
check('criterio2 falda 14,999 m', L.criterio2(14.999, true, true).soddisfatto, false);
check('criterio2 p.c. inclinato', L.criterio2(20, false, true).soddisfatto, false);

// ---------------------------------------------------------------------------
console.log('3. Criterio 3 — tipi ammessi e soglie');
for (const tipo of ['CPT', 'cpt', 'DPT', '', null, undefined]) {
  check('criterio3 tipo ' + String(tipo) + ' rifiutato', L.criterio3(tipo, 200, true).stato, 'input_non_valido');
}
check('criterio3 sabbiaPulita "false"', L.criterio3('SPT', 40, 'false').stato, 'input_non_valido');
check('criterio3 valore null', L.criterio3('SPT', null, true).stato, 'input_non_valido');
check('criterio3 valore stringa', L.criterio3('SPT', '40', true).stato, 'input_non_valido');
check('criterio3 SPT 30 (soglia)', L.criterio3('SPT', 30, true).soddisfatto, false);
check('criterio3 SPT 29,99', L.criterio3('SPT', 29.99, true).soddisfatto, false);
check('criterio3 SPT 30,01', L.criterio3('SPT', 30.01, true).soddisfatto, true);
check('criterio3 CPTU 180 (soglia)', L.criterio3('CPTU', 180, true).soddisfatto, false);
check('criterio3 CPTU 180,01', L.criterio3('CPTU', 180.01, true).soddisfatto, true);
check('criterio3 CPTE 179,99', L.criterio3('CPTE', 179.99, true).soddisfatto, false);
check('criterio3: ambito del dato', typeof L.criterio3('SPT', 40, true).ambito, 'string');

// ---------------------------------------------------------------------------
console.log('4. Criterio 4 — curve insufficienti, non valide, attraversamenti');
{
  const r = L.criterio4([[100, 40], [110, 41]], fusi);
  check('caso della revisione: proposta', r.proposta === 'soddisfatto' ? 'soddisfatto' : 'non soddisfatto né soddisfatto', 'non soddisfatto né soddisfatto');
  check('caso della revisione: stato', r.stato, 'dati_insufficienti');
  check('caso della revisione: proposta', r.proposta, 'nessuna proposta');
  check('caso della revisione: copertura', r.copertura.sufficiente, false);
}
check('curva con diametro ripetuto', codici(L.criterio4([[0.1, 10], [0.1, 20], [1, 90]], fusi)), ['DIAMETRO_DUPLICATO']);
check('curva non monotona', codici(L.criterio4([[0.1, 30], [0.2, 20], [1, 90]], fusi)), ['CURVA_NON_MONOTONA']);
check('passante oltre 100', L.criterio4([[0.1, 10], [1, 101]], fusi).stato, 'input_non_valido');
check('diametro nullo', L.criterio4([[0, 10], [1, 90]], fusi).stato, 'input_non_valido');
check('un solo punto', codici(L.criterio4([[1, 50]], fusi)), ['PUNTI_INSUFFICIENTI']);
check('punto in formato errato', L.criterio4([[1, 50], [2]], fusi).stato, 'input_non_valido');
check('stringhe', L.criterio4([['0.1', 10], [1, 90]], fusi).stato, 'input_non_valido');
check('input non valido: nessuna proposta', L.criterio4([[0, 10], [1, 90]], fusi).proposta, 'nessuna proposta');
{
  // Attraversamento tra due punti di passante vicini: da fuori lato fine a fuori lato grosso
  const fa = fusi.a_Uc_minore_3_5;
  const at = (lato, p) => { const t = fa[lato]; for (let i = 0; i < t.length - 1; i++) if (t[i][0] <= p && p <= t[i + 1][0]) return t[i][1] * Math.pow(t[i + 1][1] / t[i][1], (p - t[i][0]) / (t[i + 1][0] - t[i][0])); };
  const curva = [[at('sinistra', 10) / 10, 10], [at('destra', 10.5) * 10, 10.5]];
  const c = L.confrontaFuso(curva, fa);
  check('attraversamento tra 10 e 10,5 %: esito', c.esito, 'tocca');
  check('attraversamento: contato', c.attraversamenti, 1);
}
{
  // Curva esterna (lato fine) ma con copertura solo 30–100 %: niente esclusione
  const r = L.criterio4([[0.0002, 30], [0.0005, 60], [0.001, 100]], fusi);
  check('esterna ma copertura 30–100 %: stato', r.stato, 'dati_insufficienti');
  check('esterna ma copertura 30–100 %: proposta', r.proposta, 'nessuna proposta');
}

// ---------------------------------------------------------------------------
console.log('5. Metodi puntuali — input non validi');
const metodi = {
  bi2014Spt: (p, s) => L.bi2014Spt(p, s, vert),
  bi2014Cpt: (p, s) => L.bi2014Cpt(p, s, { tipo: 'CPTE' }),
  cetin2018Spt: (p, s) => L.cetin2018Spt(p, s, vert, { Vs12: 200 }),
  kayen2013Vs: (p, s) => L.kayen2013Vs(p, s, { Vs12: 200 })
};
for (const [nome, f] of Object.entries(metodi)) {
  check(nome + ' base: calcolato', f(pt, sis).stato, 'calcolato');
  for (const [campo, v] of [['sve', 0], ['sve', -10], ['sve', NaN], ['sve', '82'], ['sv', null], ['z', -1], ['z', undefined]]) {
    const r = f({ ...pt, [campo]: v }, sis);
    check(nome + ' ' + campo + ' = ' + String(v) + ': stato', r.stato, 'input_non_valido');
    check(nome + ' ' + campo + ' = ' + String(v) + ': nessun FS', r.FS, undefined);
  }
  check(nome + ' σ\'v > σv', codici(f({ ...pt, sve: 120 }, sis)), ['INCOERENTE']);
  for (const [campo, v] of [['amax', -0.1], ['amax', '0.2'], ['Mw', 0], ['Mw', -6], ['Mw', NaN], ['Mw', 11]]) {
    check(nome + ' sisma.' + campo + ' = ' + String(v), f(pt, { ...sis, [campo]: v }).stato, 'input_non_valido');
  }
  const r0 = f(pt, { ...sis, amax: 0 });
  check(nome + ' amax = 0: stato', r0.stato, 'non_applicabile');
  check(nome + ' amax = 0: codice', r0.codice, 'AMAX_NULLA');
  check(nome + ' punto null', f(null, sis).stato, 'input_non_valido');
  check(nome + ' sisma null', f(pt, null).stato, 'input_non_valido');
  // sopra falda: u = 0
  const ns = f({ ...pt, sve: pt.sv }, sis);
  check(nome + ' u = 0: stato', ns.stato, 'non_applicabile');
  check(nome + ' u = 0: codice', ns.codice, 'NON_SATURO');
  check(nome + ' u = 0: diagnostica presente', typeof ns.diagnostica, 'object');
  // profondità oltre il limite dell'app
  const p25 = f({ ...pt, z: 25, sv: 480, sve: 280 }, sis);
  check(nome + ' z = 25 m: stato', p25.stato, 'non_applicabile');
  check(nome + ' z = 25 m: codice', p25.codice, 'OLTRE_LIMITE_APP');
}
check('B&I SPT FC 101', L.bi2014Spt({ ...pt, FC: 101 }, sis, vert).stato, 'input_non_valido');
check('B&I SPT FC mancante', L.bi2014Spt({ ...pt, FC: undefined }, sis, vert).stato, 'input_non_valido');
check('B&I SPT N negativo', L.bi2014Spt({ ...pt, N: -1 }, sis, vert).stato, 'input_non_valido');
check('B&I SPT CE mancante', L.bi2014Spt(pt, sis, { CB: 1 }).stato, 'input_non_valido');
check('B&I SPT verticale null', L.bi2014Spt(pt, sis, null).stato, 'input_non_valido');
check('B&I SPT CB 0', L.bi2014Spt(pt, sis, { ...vert, CB: 0 }).stato, 'input_non_valido');
check('B&I SPT CB assente: assunzione', haAvviso(L.bi2014Spt(pt, sis, { CE: 1 }), 'CB_PREDEFINITO'), true);
check('Cetin Vs12 mancante', L.cetin2018Spt(pt, sis, vert, {}).stato, 'input_non_valido');
check('Cetin opz null', L.cetin2018Spt(pt, sis, vert, null).stato, 'input_non_valido');
check('Cetin senzaRivestimento "true"', L.cetin2018Spt(pt, sis, { ...vert, senzaRivestimento: 'true' }, { Vs12: 200 }).stato, 'input_non_valido');
check('Cetin FC 150', L.cetin2018Spt({ ...pt, FC: 150 }, sis, vert, { Vs12: 200 }).stato, 'input_non_valido');
check('Kayen Vs 0', L.kayen2013Vs({ ...pt, Vs: 0 }, sis, { Vs12: 200 }).stato, 'input_non_valido');
check('Kayen FC assente: assunzione', haAvviso(L.kayen2013Vs({ ...pt, FC: undefined }, sis, { Vs12: 200 }), 'FC_ASSENTE'), true);

// ---------------------------------------------------------------------------
console.log('6. CPT/CPTU — tipo, u2, rapporto d\'area, Ic');
check('tipo mancante', L.bi2014Cpt(pt, sis, {}).stato, 'input_non_valido');
check('opz assente', L.bi2014Cpt(pt, sis).stato, 'input_non_valido');
check('tipo CPT (ambiguo)', L.bi2014Cpt(pt, sis, { tipo: 'CPT' }).stato, 'input_non_valido');
check('tipo meccanica', L.bi2014Cpt(pt, sis, { tipo: 'CPTM' }).stato, 'input_non_valido');
check('CPTE con u2', codici(L.bi2014Cpt({ ...pt, u2: 50 }, sis, { tipo: 'CPTE' })), ['INCOERENTE']);
check('CPTE con ar', codici(L.bi2014Cpt(pt, sis, { tipo: 'CPTE', ar: 0.8 })), ['INCOERENTE']);
{
  const r = L.bi2014Cpt(pt, sis, { tipo: 'CPTE' });
  check('CPTE: assunzione qt = qc', r.assunzioni.map(a => a.codice), ['QT_UGUALE_QC']);
}
{
  const r = L.bi2014Cpt(pt, sis, { tipo: 'CPTU' });
  check('CPTU senza u2: stato', r.stato, 'dati_insufficienti');
  check('CPTU senza u2: codice', r.codice, 'U2_MANCANTE');
}
{
  const r = L.bi2014Cpt({ ...pt, u2: 120 }, sis, { tipo: 'CPTU' });
  check('CPTU senza ar: calcolato', r.stato, 'calcolato');
  check('CPTU senza ar: assunzione', r.assunzioni.map(a => a.codice), ['AR_PREDEFINITO']);
  check('CPTU senza ar: avviso', haAvviso(r, 'AR_PREDEFINITO'), true);
  const r2 = L.bi2014Cpt({ ...pt, u2: 120 }, sis, { tipo: 'CPTU', ar: 0.75 });
  check('CPTU con ar: nessuna assunzione', r2.assunzioni.length, 0);
  check('CPTU: qt = qc + (1 − ar)·u2', Math.abs(r2.qt - (6000 + 0.25 * 120)) < 1e-9, true);
}
check('CPTU ar 1,2', L.bi2014Cpt({ ...pt, u2: 120 }, sis, { tipo: 'CPTU', ar: 1.2 }).stato, 'input_non_valido');
check('CPTU u2 stringa', L.bi2014Cpt({ ...pt, u2: '120' }, sis, { tipo: 'CPTU' }).stato, 'input_non_valido');
check('fs = 0: dati insufficienti', L.bi2014Cpt({ ...pt, fs: 0 }, sis, { tipo: 'CPTE' }).stato, 'dati_insufficienti');
check('qc ≤ σv: dati insufficienti', L.bi2014Cpt({ ...pt, qc: 0.05 }, sis, { tipo: 'CPTE' }).stato, 'dati_insufficienti');
{
  // terreno argilloso: qc basso, fs alto
  const r = L.bi2014Cpt({ ...pt, qc: 0.8, fs: 40 }, sis, { tipo: 'CPTE' });
  check('Ic oltre soglia: stato', r.stato, 'non_applicabile');
  check('Ic oltre soglia: codice', r.codice, 'IC_OLTRE_SOGLIA');
  check('Ic oltre soglia: non è esclusione normativa', /Non è un'esclusione/.test(r.motivo), true);
  check('Ic oltre soglia: nessun FS', r.FS, undefined);
}
check('IcSoglia 3,0: avviso', haAvviso(L.bi2014Cpt(pt, sis, { tipo: 'CPTE', IcSoglia: 3.0 }), 'IC_SOGLIA_INSOLITA'), true);

// ---------------------------------------------------------------------------
console.log('7. Profondità — limiti dell\'app e delle fonti');
{
  const p11 = { ...pt, z: 11, sv: 210, sve: 140 };
  check('B&I SPT z 11 m: avviso rd', haAvviso(L.bi2014Spt(p11, sis, vert), 'RD_INCERTO_BI'), true);
  check('B&I CPT z 11 m: avviso rd', haAvviso(L.bi2014Cpt(p11, sis, { tipo: 'CPTE' }), 'RD_INCERTO_BI'), true);
  check('Cetin z 11 m: nessun avviso B&I', haAvviso(L.cetin2018Spt(p11, sis, vert, { Vs12: 200 }), 'RD_INCERTO_BI'), false);
  check('Kayen z 11 m: nessun avviso B&I', haAvviso(L.kayen2013Vs(p11, sis, { Vs12: 200 }), 'RD_INCERTO_BI'), false);
  check('B&I SPT z 9 m: nessun avviso', haAvviso(L.bi2014Spt({ ...pt, z: 9, sv: 170, sve: 115 }, sis, vert), 'RD_INCERTO_BI'), false);
  check('z = 20 m: ancora calcolato', L.bi2014Spt({ ...pt, z: 20, sv: 380, sve: 240 }, sis, vert).stato, 'calcolato');
}

// ---------------------------------------------------------------------------
console.log('8. Convergenza');
{
  const r = L.bi2014Spt(pt, sis, vert);
  check('B&I SPT: convergente', r.convergenza.convergente, true);
  check('B&I SPT: residuo sotto tolleranza', r.convergenza.residuoFinale < r.convergenza.tolleranza, true);
  const n1 = L.bi2014Spt(pt, sis, vert, { maxIterazioni: 1 });
  check('B&I SPT maxIterazioni 1: stato', n1.stato, 'non_convergente');
  check('B&I SPT maxIterazioni 1: nessun FS', n1.FS, undefined);
  const c = L.bi2014Cpt(pt, sis, { tipo: 'CPTE' });
  check('B&I CPT: convergente', c.convergenza.convergente, true);
  check('B&I CPT maxIterazioni 1', L.bi2014Cpt(pt, sis, { tipo: 'CPTE', maxIterazioni: 1 }).stato, 'non_convergente');
  const vr = { ...vert, senzaRivestimento: true };
  delete vr.CS;
  const ce = L.cetin2018Spt(pt, sis, vr, { Vs12: 200 });
  check('Cetin senza rivestimento: convergente', ce.convergenza.convergente, true);
  check('Cetin senza rivestimento maxIterazioni 1', L.cetin2018Spt(pt, sis, vr, { Vs12: 200, maxIterazioni: 1 }).stato, 'non_convergente');
  check('Cetin con rivestimento: nessuna iterazione', L.cetin2018Spt(pt, sis, vert, { Vs12: 200 }).convergenza, null);
  check('maxIterazioni 0 rifiutato', L.bi2014Spt(pt, sis, vert, { maxIterazioni: 0 }).stato, 'input_non_valido');
}

// ---------------------------------------------------------------------------
console.log('9. Kayen oltre 180 kPa — avviso e formula invariata');
{
  const p = (sve) => ({ z: 15, Vs: 220, FC: 0, sv: sve + 120, sve });
  check('σ\'v0 179 kPa: nessun avviso', haAvviso(L.kayen2013Vs(p(179), sis, { Vs12: 200 }), 'SVE_OLTRE_BANCA_DATI'), false);
  check('σ\'v0 181 kPa: avviso', haAvviso(L.kayen2013Vs(p(181), sis, { Vs12: 200 }), 'SVE_OLTRE_BANCA_DATI'), true);
  // la funzione di stato mantiene il termine in ln(σ'v0) anche oltre 180 kPa (Eq. 13–14)
  const r = L.kayen2013Vs(p(250), sis, { Vs12: 200 });
  const A = Math.pow(0.0073 * r.Vs1, 2.8011) - 2.6168 * Math.log(6.5) - 0.0099 * Math.log(250);
  check('σ\'v0 250 kPa: CRR15 con il termine in ln σ\'v0', Math.abs(r.CRR15 - Math.exp((A + 0.4809 * L.PhiInv(0.15)) / 1.946)) < 1e-12, true);
}

// ---------------------------------------------------------------------------
console.log('10. Tensioni');
const strati = [{ da: 0, a: 5, gamma: 18, gammaSat: 19 }, { da: 5, a: 20, gamma: 19, gammaSat: 20 }];
check('profilo valido', L.tensioni(strati, 2, 10).stato, 'calcolato');
check('vuoto tra strati', codici(L.tensioni([{ da: 0, a: 5, gamma: 18, gammaSat: 19 }, { da: 6, a: 20, gamma: 19, gammaSat: 20 }], 2, 10)), ['VUOTO']);
check('sovrapposizione', codici(L.tensioni([{ da: 0, a: 6, gamma: 18, gammaSat: 19 }, { da: 5, a: 20, gamma: 19, gammaSat: 20 }], 2, 10)), ['SOVRAPPOSIZIONE']);
check('primo strato non da 0', codici(L.tensioni([{ da: 1, a: 20, gamma: 18, gammaSat: 19 }], 2, 10)), ['VUOTO']);
check('spessore nullo', codici(L.tensioni([{ da: 0, a: 0, gamma: 18, gammaSat: 19 }, { da: 0, a: 20, gamma: 18, gammaSat: 19 }], 2, 10)), ['SPESSORE_NON_POSITIVO']);
check('gamma nullo', L.tensioni([{ da: 0, a: 20, gamma: 0, gammaSat: 19 }], 2, 10).stato, 'input_non_valido');
check('gamma stringa', L.tensioni([{ da: 0, a: 20, gamma: '18', gammaSat: 19 }], 2, 10).stato, 'input_non_valido');
check('copertura insufficiente', codici(L.tensioni(strati, 2, 25)), ['COPERTURA_INSUFFICIENTE']);
check('falda sopra p.c.', codici(L.tensioni(strati, -0.5, 10)), ['FALDA_SOPRA_PC']);
check('z NaN', L.tensioni(strati, 2, NaN).stato, 'input_non_valido');
check('strati vuoti', L.tensioni([], 2, 10).stato, 'input_non_valido');
check('pesi incoerenti: σ\'v ≤ 0', codici(L.tensioni([{ da: 0, a: 20, gamma: 5, gammaSat: 5 }], 0, 10)), ['SVE_NON_POSITIVA']);
{
  const t = L.tensioni(strati, 2, 10);
  check('σv a 10 m', Math.abs(t.sv - (2 * 18 + 3 * 19 + 5 * 20)) < 1e-9, true);
  check('u a 10 m', Math.abs(t.u - 8 * 9.81) < 1e-9, true);
}

// ---------------------------------------------------------------------------
console.log('11. Nessun NaN come risultato ordinario (campionamento casuale)');
{
  let seme = 12345;
  const rnd = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  const valori = [NaN, Infinity, -Infinity, -1, 0, null, undefined, '', '5', 1e-300, 1e300, 0.5, 5, 50];
  const scegli = () => valori[Math.floor(rnd() * valori.length)];
  let violazioni = 0, casi = 0;
  for (let i = 0; i < 4000; i++) {
    const p = { ...pt };
    const s = { ...sis };
    const k = ['z', 'N', 'FC', 'sv', 'sve', 'qc', 'fs', 'Vs'][Math.floor(rnd() * 8)];
    p[k] = scegli();
    if (rnd() < 0.3) s[rnd() < 0.5 ? 'amax' : 'Mw'] = scegli();
    for (const f of Object.values(metodi)) {
      const r = f(p, s);
      casi++;
      if (r.stato === 'calcolato' && !(Number.isFinite(r.FS) && Number.isFinite(r.CSR))) violazioni++;
      if (!['calcolato', 'input_non_valido', 'dati_insufficienti', 'non_applicabile', 'non_convergente', 'errore_numerico'].includes(r.stato)) violazioni++;
    }
  }
  check('esiti con stato calcolato e FS/CSR non finiti (su ' + casi + ' casi)', violazioni, 0);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
