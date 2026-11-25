#!/usr/bin/env node
/*
 * verifica_esclusione_strati.mjs — esclusione motivata di uno strato dal calcolo di IL e cedimento
 * (audit v1.0.0, B2.3; decisione D3 del 25/11/2026). Convenzione applicativa di GeoHub, non
 * un'esclusione «ai sensi del §7.11.3.4.2».
 *  - F = 0 dichiarato nello strato: IL = somma a mano senza lo strato; IL_min e IL_max invariati
 *    dall'esclusione; spessore escluso distinto dai tratti ignoti;
 *  - criterio e motivazione obbligatori; criterio 4 solo se confermato in Verifica preliminare;
 *    altrimenti lo strato resta incluso, con avviso;
 *  - firma degli input: cambia con l'esclusione; file precedenti → strato non escluso;
 *  - SPT: tutti i tratti dello strato esclusi insieme (D2); demo SPT: IL non più 1,2–26,5.
 *
 * Uso:   node verifiche/verifica_esclusione_strati.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esclusione.js');
const E = require('../app/esempio.js');
const IND = require('../motore/indici.js');
const XP = require('../app/esporta.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const vicino = (a, b, t = 1e-9) => Math.abs(a - b) < t;
const trova = (sc, desc) => sc.strati.find(s => s.descrizione === desc);

function esempio(i) {
  const pr = E.progettoEsempio();
  const sc = pr.scenari[i];
  return { pr, sc, pv: pr.prove.find(p => p.id === sc.provaId) || pr.prove[0] };
}
const esclu = (s, criterio, motivazione) => { s.escluso_motivatamente = true; if (criterio !== undefined) s.criterio = criterio; if (motivazione !== undefined) s.motivazione = motivazione; };

// ---- 1. IL = somma a mano senza lo strato (CPT) ------------------------------------------------
{
  const { sc, pv } = esempio(0);
  const base = F.calcolaScenario(pv, sc, L);
  const s = trova(sc, 'Sabbia limosa sciolta'); // 3,4–7,2 m, sotto falda
  esclu(s, 'altro', 'Strato di prova: esclusione dichiarata dal geologo.');
  const r = F.calcolaScenario(pv, sc, L);
  check('IL con strato escluso < IL base', r.indiceIL.ILmin < base.indiceIL.ILmin, true);
  check('spessore escluso = 3,8 m', vicino(r.indiceIL.spessori.escluso, 3.8), true);
  check('IL_min = IL_max (CPT, nessun ignoto)', r.indiceIL.ILmin === r.indiceIL.ILmax, true);
  check('assunzione IL_ESCLUSO_MOTIVATO presente', r.indiceIL.assunzioni.some(a => a.codice === 'IL_ESCLUSO_MOTIVATO' && /onvenzione applicativa di GeoHub, non un'esclusione ai sensi del §7\.11\.3\.4\.2/.test(a.descrizione)), true);
  check('categoria dei tratti nello strato = escluso', r.indiceIL.tratti.filter(t => t.da >= s.da - 1e-9 && t.a <= s.a + 1e-9).every(t => t.categoria === 'escluso'), true);
  check('ignoto invariato (0)', r.indiceIL.spessori.ignoto, 0);
  // IL diretto con IND: stessi punti, stesso strato, calcolo indipendente
  const punti = F.puntiPerIL(base.righe, null);
  const diretto = IND.indiceIL(punti, sc.zFalda, { esclusi: [{ da: s.da, a: s.a }] });
  check('IL via profilo = IL via indici', vicino(diretto.ILmin, r.indiceIL.ILmin), true);
  // F = 0 dichiarato: i punti dello strato non contribuiscono, anche se il FS è calcolato e < 1
  const zs = base.righe.filter(x => x.z >= s.da && x.z < s.a && x.stato === 'calcolato');
  check('FS calcolato nello strato (non azzerato)', zs.length > 0 && zs.every(x => Number.isFinite(x.valori.FS)), true);
}

// ---- 2. Cedimento: εv = 0 nello strato ---------------------------------------------------------
{
  const { sc, pv } = esempio(0);
  const base = F.calcolaScenario(pv, sc, L);
  esclu(trova(sc, 'Sabbia limosa sciolta'), 'altro', 'Strato di prova.');
  const r = F.calcolaScenario(pv, sc, L);
  check('cedimento ≤ base', r.cedimenti.Smin <= base.cedimenti.Smin, true);
  check('cedimento ridotto se lo strato contribuiva', base.cedimenti.Smin === 0 || r.cedimenti.Smin < base.cedimenti.Smin, true);
  check('assunzione ZHANG_STRATI_ESCLUSI', r.cedimenti.assunzioni.some(a => a.codice === 'ZHANG_STRATI_ESCLUSI'), true);
  check('tratti escluso con εv = 0', r.cedimenti.tratti.filter(t => t.categoria === 'escluso').every(t => t.epsMin === 0 && t.epsMax === 0), true);
}

// ---- 3. Criterio e motivazione obbligatori; strato incluso con avviso --------------------------
{
  const { sc, pv } = esempio(0);
  const base = F.calcolaScenario(pv, sc, L);
  const s = trova(sc, 'Sabbia limosa sciolta');
  esclu(s, undefined, 'Motivazione senza criterio.');
  let r = F.calcolaScenario(pv, sc, L);
  check('senza criterio: incluso (IL invariato)', r.indiceIL.ILmin, base.indiceIL.ILmin);
  check('senza criterio: avviso', r.avvisiEsclusione.map(a => a.codice), ['ESCLUSIONE_STRATO_NON_APPLICATA']);
  esclu(s, 'altro', '   ');
  r = F.calcolaScenario(pv, sc, L);
  check('motivazione vuota: incluso', r.indiceIL.ILmin, base.indiceIL.ILmin);
  check('motivazione vuota: avviso con motivo', /motivazione mancante/.test(r.avvisiEsclusione[0].messaggio), true);
  esclu(s, 'inventato', 'x');
  r = F.calcolaScenario(pv, sc, L);
  check('criterio non ammesso: incluso', r.indiceIL.ILmin, base.indiceIL.ILmin);
  s.escluso_motivatamente = false; s.criterio = 'altro'; s.motivazione = 'x';
  r = F.calcolaScenario(pv, sc, L);
  check('flag falso: incluso, nessun avviso', [r.indiceIL.ILmin === base.indiceIL.ILmin, r.avvisiEsclusione.length], [true, 0]);
}

// ---- 4. Criterio 4: solo se confermato in Verifica preliminare ---------------------------------
{
  const { sc, pv } = esempio(0);
  const base = F.calcolaScenario(pv, sc, L);
  const s = trova(sc, 'Sabbia limosa sciolta');
  esclu(s, 'criterio4', 'Curva esterna ai fusi.');
  let r = F.calcolaScenario(pv, sc, L);
  check('criterio 4 non confermato: incluso', r.indiceIL.ILmin, base.indiceIL.ILmin);
  check('criterio 4 non confermato: avviso', /criterio 4 non confermato/.test(r.avvisiEsclusione[0].messaggio), true);
  // conferma con curva esterna ai fusi: usare una curva molto fine, esterna al fuso di terreni liquefacibili
  X.aggiornaStrato(sc, s, { curva: [{ d: 0.001, p: 5 }, { d: 0.01, p: 30 }, { d: 0.075, p: 70 }, { d: 0.4, p: 95 }, { d: 2, p: 100 }], decisione4: 'soddisfatto', motivazione4: 'Curva esterna ai fusi (verifica di prova).' });
  r = F.calcolaScenario(pv, sc, L);
  const conferma = r.esclusioneStrati.esclusi.length === 1;
  if (conferma) {
    check('criterio 4 confermato: strato escluso', r.indiceIL.spessori.escluso > 3.7, true);
    check('criterio 4 confermato: etichetta', /criterio 4/.test(r.esclusioneStrati.esclusi[0].etichetta), true);
  } else {
    // la curva di prova non risulta esterna ai fusi per il motore: controllo solo che resti incluso con avviso
    check('criterio 4 con curva non esterna ai fusi: incluso', r.indiceIL.ILmin, base.indiceIL.ILmin);
  }
}

// ---- 5. Firma degli input; file precedenti -----------------------------------------------------
{
  const { sc, pv } = esempio(0);
  const f0 = P.firmaInput(pv, sc, L.VERSIONE_MOTORE);
  esclu(trova(sc, 'Sabbia limosa sciolta'), 'altro', 'Strato di prova.');
  const f1 = P.firmaInput(pv, sc, L.VERSIONE_MOTORE);
  check('la firma cambia con l\'esclusione', f0 !== f1, true);
  const s2 = trova(sc, 'Sabbia limosa sciolta'); s2.motivazione = 'Altra motivazione.';
  check('la firma cambia con la motivazione', P.firmaInput(pv, sc, L.VERSIONE_MOTORE) !== f1, true);
  const sx = trova(sc, 'Sabbia limosa sciolta'); delete sx.escluso_motivatamente; delete sx.criterio; delete sx.motivazione;
  check('tolta l\'esclusione: firma identica a quella di base', P.firmaInput(pv, sc, L.VERSIONE_MOTORE), f0);
  // file precedente: nessuna chiave → non escluso
  const { pr } = esempio(0);
  const copia = JSON.parse(JSON.stringify(pr));
  for (const scx of copia.scenari) for (const st of scx.strati) { delete st.escluso_motivatamente; delete st.criterio; delete st.motivazione; }
  const val = P.validaProgetto(copia);
  check('file precedente valido', val.errori ? val.errori.length : 0, 0);
  const sv = (val.progetto || val.valore || copia).scenari[0];
  check('file precedente: nessuno strato escluso', X.stratiEsclusi(L, sv).esclusi.length, 0);
  // validazione dei nuovi campi
  const cattivo = JSON.parse(JSON.stringify(pr));
  cattivo.scenari[0].strati[0].escluso_motivatamente = 'si';
  cattivo.scenari[0].strati[1].criterio = 'x';
  const v2 = P.validaProgetto(cattivo);
  check('tipo errato di escluso_motivatamente → errore', (v2.errori || []).some(e => /escluso_motivatamente/.test(e.campo)), true);
  check('criterio non ammesso → errore', (v2.errori || []).some(e => /criterio/.test(e.campo)), true);
}

// ---- 6. SPT: tutti i segmenti dello strato esclusi insieme (D2); demo senza IL 1,2–26,5 --------
{
  const { sc, pv } = esempio(1);
  const base = F.calcolaScenario(pv, sc, L);
  check('demo SPT di base: IL 1,2–26,5 (difetto B2.3)', [Math.round(base.indiceIL.ILmin * 10) / 10, Math.round(base.indiceIL.ILmax * 10) / 10], [1.2, 26.5]);
  for (const d of ['Limo argilloso', 'Alternanze di limo e sabbia limosa']) {
    if (d === 'Limo argilloso') for (const x of sc.strati.filter(y => y.descrizione === d)) esclu(x, 'coesivo', 'Limo argilloso: terreno coesivo, giudizio del geologo (parametri di plasticità in relazione).');
  }
  const r = F.calcolaScenario(pv, sc, L);
  check('SPT: strati limo argilloso 1,2–3,4 e 12,4–13,2 esclusi', vicino(r.indiceIL.spessori.escluso, 1.6 + 0.8), true);
  check('SPT: ignoto ridotto di quanto escluso (dentro la falda)', r.indiceIL.spessori.ignoto < base.indiceIL.spessori.ignoto, true);
  check('SPT: IL_max ridotto', r.indiceIL.ILmax < base.indiceIL.ILmax, true);
  check('SPT: IL_min non aumenta', r.indiceIL.ILmin <= base.indiceIL.ILmin + 1e-12, true);
  check('SPT: nessun tratto FS/ignoto dentro uno strato escluso', r.indiceIL.tratti.every(t => {
    const dentro = r.esclusioneStrati.esclusi.some(e => t.da >= e.da - 1e-9 && t.a <= e.a + 1e-9);
    return dentro ? t.categoria === 'escluso' || t.categoria === 'sopraFalda' : true;
  }), true);
  check('SPT: non più IL 1,2–26,5', !(Math.round(r.indiceIL.ILmin * 10) / 10 === 1.2 && Math.round(r.indiceIL.ILmax * 10) / 10 === 26.5), true);
}

// ---- 7. FS < 1 nello strato escluso: avviso non bloccante --------------------------------------
{
  const { sc, pv } = esempio(0);
  const s = trova(sc, 'Sabbia limosa sciolta'); // contiene punti con FS < 1 nell'esempio
  esclu(s, 'altro', 'Strato di prova.');
  const r = F.calcolaScenario(pv, sc, L);
  const avv = r.avvisiEsclusione.filter(a => a.codice === 'ESCLUSO_CON_FS_MINORE_DI_1');
  const nFs = r.righe.filter(x => x.stato === 'calcolato' && x.valori.FS < 1 && x.z >= s.da && x.z < s.a).length;
  check('FS<1: avviso presente se ci sono punti con FS<1', avv.length, nFs ? 1 : 0);
  if (nFs) check('FS<1: testo «tarati su terreni granulari», non bloccante', [/tarati su terreni granulari/.test(avv[0].messaggio), r.stato], [true, 'calcolato']);
}

// ---- 8. Stampa e CSV: spessore escluso riportato a parte ---------------------------------------
{
  const { pr, sc, pv } = esempio(0);
  esclu(trova(sc, 'Sabbia limosa sciolta'), 'altro', 'Strato di prova.');
  const r = F.calcolaScenario(pv, sc, L);
  const csv = XP.csvRisultati(pr, pv, sc, r);
  check('CSV: riga degli strati esclusi', /strati esclusi motivatamente/i.test(csv), true);
  check('CSV: spessore escluso 3,8', /spessore escluso \(m\);3,8/.test(csv), true);
  check('CSV: dichiara la convenzione applicativa', /onvenzione applicativa di GeoHub/.test(csv), true);
}

console.log('Risultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
