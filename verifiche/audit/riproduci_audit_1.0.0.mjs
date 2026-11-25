// GeoHub-LiquiSite — riproduzione dei rilievi dell'audit pre-rilascio su v1.0.0 (commit c6784f1).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Fase 1 del mandato del 24/11/2026: verifica, nessuna correzione. Ogni controllo descrive il
// comportamento ATTESO dopo la correzione; con il codice della v1.0.0 deve risultare «DIFETTO
// PRESENTE». Quando un rilievo viene corretto, il controllo corrispondente passa a «ok» e può
// entrare in verifiche/esegui.mjs come test di non regressione.
// I rilievi non confermati sono controllati nel verso opposto: «ok» = il rilievo resta smentito.
//
// Uso: node verifiche/audit/riproduci_audit_1.0.0.mjs   (codice di uscita sempre 0: è una diagnosi)
// Non fa parte di `npm test`.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../../motore/liquisite.js');
const P = require('../../app/progetto.js');
const PR = require('../../app/profilo.js');
const IND = require('../../motore/indici.js');
const ES = require('../../app/esclusione.js');
const E = require('../../app/esempio.js');

const esiti = [];
/** id del rilievo; corretto = true se il comportamento è quello atteso dopo la correzione. */
const controlla = (id, descrizione, corretto, misurato) => esiti.push({ id, descrizione, corretto, misurato });
const f = (v, c = 3) => (typeof v === 'number' && Number.isFinite(v)) ? (Math.abs(v) >= 1e6 ? v.toExponential(2) : v.toFixed(c)) : String(v);

const STRATO_UNICO = [{ da: 0, a: 20, gamma: 18, gammaSat: 19 }];
const sisma = { amax: 0.25, Mw: 6.5 };

function provaSpt(dati, strati, zFalda, amax = 0.25) {
  const b = P.nuovaProva('SPT', 'audit');
  b.colonne = ['z', 'N', 'FC']; b.unita.FC = '%'; b.dati = dati;
  b.parametri = { CE: 1, CB: 1, CS: 1, sporgenza: 1, senzaRivestimento: false };
  const s = P.nuovoScenario(b, 'audit', 0);
  Object.assign(s, { metodo: 'bi2014Spt', Mw: 6.5, amax, zFalda, strati });
  return [b, s];
}

// ---------------------------------------------------------------------------
// B1 — CRR oltre il campo delle correlazioni; overflow → 'ignoto'
// ---------------------------------------------------------------------------
{
  const pr = E.progettoEsempio();
  const [cptu] = pr.prove, [s1] = pr.scenari;
  const i = cptu.dati.findIndex(d => Math.abs(d[0] - 3.5) < 1e-9);
  const conQc = (qc) => { const c = P.copia(cptu); c.dati[i][1] = qc; const r = PR.calcolaScenario(c, s1, L); return { r, riga: r.righe[i] }; };
  const a = conQc(28);
  controlla('B1.a', 'esempio CPTU, qc = 28 MPa a 3,50 m: FS non deve essere un numero oltre ogni scala (atteso: stato «fuori campo» dichiarato)',
    !(a.riga.stato === 'calcolato' && a.riga.valori.FS > 1e3), 'stato ' + a.riga.stato + ', CRR ' + f(a.riga.valori?.CRR) + ', FS ' + f(a.riga.valori?.FS));
  const b = conQc(62);
  const t = b.r.cedimenti.tratti.find(x => x.zPunto === 3.5 || (x.da <= 3.5 && 3.5 < x.a));
  controlla('B1.b', 'qc = 62 MPa a 3,50 m (rifiuto): il punto più addensato non deve diventare «ignoto» (F = 1 in IL_max, εv limite in S_max)',
    b.riga.stato !== 'errore_numerico', 'stato ' + b.riga.stato + ' (' + (b.riga.motivo || '') + '); tratto cedimento: ' + (t ? t.categoria + ', εv max ' + f(t.epsMax, 2) + ' %' : '–'));
  const tv = L.tensioni(STRATO_UNICO, 1, 10);
  const k = L.kayen2013Vs({ z: 10, Vs: 800, FC: 0, sv: tv.sv, sve: tv.sve }, sisma, { Vs12: 300 });
  controlla('B1.c', 'Kayen 2013, Vs = 800 m/s a 10 m: CRR non deve essere restituito senza avviso di fuori campo',
    !(k.stato === 'calcolato' && k.avvisi.length === 0), 'CRR15 ' + f(k.CRR15) + ', FS ' + f(k.FS) + ', avvisi ' + k.avvisi.length);
  const ts = L.tensioni(STRATO_UNICO, 1, 6);
  const sp = L.bi2014Spt({ z: 6, N: 60, FC: 5, sv: ts.sv, sve: ts.sve }, sisma, { CE: 1, CB: 1, CS: 1, sporgenza: 1 });
  controlla('B1.d', 'B&I 2014 SPT, N = 60: (N1)60cs oltre il campo, FS non deve superare ogni scala',
    !(sp.stato === 'calcolato' && sp.FS > 1e3), '(N1)60cs ' + f(sp.N160cs, 1) + ', FS ' + f(sp.FS));
}

// ---------------------------------------------------------------------------
// B2 — indice IL con prove SPT e Vs
// ---------------------------------------------------------------------------
{
  const strati = [{ da: 0, a: 4, gamma: 18, gammaSat: 19, FC: 90 }, { da: 4, a: 6, gamma: 18, gammaSat: 19, FC: 10 }, { da: 6, a: 20, gamma: 18, gammaSat: 19, FC: 90 }];
  const [b, s] = provaSpt([[5, 4, 10]], strati, 0);
  const r = PR.calcolaScenario(b, s, L);
  const atteso = (1 - r.righe[0].valori.FS) * IND.integralePeso(4, 6);
  controlla('B2.1', 'una sola SPT in una lente 4–6 m con FS < 1: IL_min deve contenere il contributo della lente',
    r.indiceIL.ILmin > 0, 'FS ' + f(r.righe[0].valori.FS, 2) + ', IL_min ' + f(r.indiceIL.ILmin, 2) + ', IL_max ' + f(r.indiceIL.ILmax, 2) + ', spessore FS ' + f(r.indiceIL.spessori.FS, 2) + ' m (contributo della lente intera ' + f(atteso, 2) + ')');

  const st2 = [{ da: 0, a: 3, gamma: 18, gammaSat: 19, FC: 90 }, { da: 3, a: 5, gamma: 18, gammaSat: 19, FC: 10 }, { da: 5, a: 14, gamma: 18, gammaSat: 19, FC: 90 }, { da: 14, a: 18, gamma: 18, gammaSat: 19, FC: 10 }, { da: 18, a: 20, gamma: 18, gammaSat: 19, FC: 90 }];
  const tratto4 = (dati) => { const [b2, s2] = provaSpt(dati, st2, 0); const r2 = PR.calcolaScenario(b2, s2, L); const t = r2.indiceIL.tratti.find(x => x.zPunto === 4); return t ? f(t.da, 2) + '–' + f(t.a, 2) : null; };
  const t1 = tratto4([[4, 6, 10], [16, 8, 10]]), t2 = tratto4([[4, 6, 10], [15, 8, 10], [16, 8, 10], [17, 8, 10]]);
  controlla('B2.2', 'l\'intervallo della SPT a 4 m non deve dipendere dalle prove aggiunte in un altro strato',
    t1 === t2, 'con 2 SPT: ' + t1 + ' m; con 2 SPT in più a 15 e 17 m: ' + t2 + ' m');

  const pr = E.progettoEsempio();
  const r3 = PR.calcolaScenario(pr.prove[1], pr.scenari[1], L);
  controlla('B2.3', 'esempio «S1 SPT»: gli strati di limo argilloso con criterio 4 soddisfatto restano «senza risultato»',
    r3.indiceIL.ILmax - r3.indiceIL.ILmin < 1, 'IL ' + f(r3.indiceIL.ILmin, 2) + '–' + f(r3.indiceIL.ILmax, 2) + ', senza risultato ' + f(r3.indiceIL.spessori.ignoto, 2) + ' m');

  const vs = P.nuovaProva('VS', 'audit'); vs.colonne = ['z', 'Vs']; vs.dati = [[5, 130]];
  const sv = P.nuovoScenario(vs, 'audit', 0);
  Object.assign(sv, { metodo: 'kayen2013Vs', Mw: 6.5, amax: 0.25, zFalda: 1, strati: [{ da: 0, a: 20, gamma: 17, gammaSat: 18, FC: 90 }] }); sv.opzioni.Vs12 = 150;
  const r4 = PR.calcolaScenario(vs, sv, L);
  controlla('B2.4', 'Vs = 130 m/s in uno strato di argilla (FC 90 %): deve esistere un modo per escluderlo motivatamente',
    r4.righe[0].stato !== 'calcolato', 'stato ' + r4.righe[0].stato + ', FS ' + f(r4.righe[0].valori?.FS, 2));
}

// ---------------------------------------------------------------------------
// B3 — limiti delle equazioni
// ---------------------------------------------------------------------------
{
  const msf = L._BI.msf(4.5, 2.2);
  controlla('B3.1', 'B&I 2014, MSF con Mw = 4,5 e MSFmax = 2,2: non deve superare MSFmax',
    msf <= 2.2 + 1e-9, 'MSF ' + f(msf, 3));
  const t = L.tensioni(STRATO_UNICO, 0, 0.5);
  const c = L.cetin2018Spt({ z: 0.5, N: 10, FC: 10, sv: t.sv, sve: t.sve }, sisma, { CE: 1, CB: 1, CS: 1, sporgenza: 1 }, { Vs12: 180 });
  controlla('B3.2', 'Cetin 2018, z = 0,5 m con falda al p.c.: Kσ entro 0,8–1,6 (limite registrato nella scheda di progetto, SDEE pag. 706, Eq. 14)',
    c.Ksigma <= 1.6 + 1e-9, 'σ\'v ' + f(t.sve, 2) + ' kPa, Kσ ' + f(c.Ksigma, 3) + ', avvisi ' + c.avvisi.map(a => a.codice).join(', '));
  const t2 = L.tensioni(STRATO_UNICO, 0, 0.1);
  const c2 = L.cetin2018Spt({ z: 0.1, N: 10, FC: 10, sv: t2.sv, sve: t2.sve }, sisma, { CE: 1, CB: 1, CS: 1, sporgenza: 0 }, { Vs12: 180 });
  controlla('B3.3', 'Cetin 2018, aste di 0,10 m: CR e N1,60 non devono essere negativi in un punto «calcolato»',
    !(c2.stato === 'calcolato' && c2.CR < 0), 'stato ' + c2.stato + ', CR ' + f(c2.CR, 3) + ', N1,60 ' + f(c2.N160, 2) + ', FS ' + f(c2.FS, 2));
  const rd0 = L._BI.rd(0.2, 6.5);
  controlla('B3.4', 'B&I 2014, rd a 0,2 m: il rilievo chiede rd ≤ 1 (la scheda letta sul PDF non riporta il limite)',
    true, 'rd ' + f(rd0, 4) + ' (scarto ' + f((rd0 - 1) * 100, 2) + ' %); oltre 20 m il motore non calcola (Z_MAX_APP)');
}

// ---------------------------------------------------------------------------
// B4 — verifica preliminare §7.11.3.4.2
// ---------------------------------------------------------------------------
{
  let [b, s] = provaSpt([[2, 40, 3], [10, 40, 3]], [{ da: 0, a: 20, gamma: 18, gammaSat: 19, FC: 3 }], 0);
  ES.aggiornaStrato(s, s.strati[0], { sabbiaPulita: true });
  let v = ES.valutaEsclusione(L, b, s, PR.calcolaScenario(b, s, L));
  controlla('B4.1', 'strato saturo 0–20 m con due SPT a 2 e 10 m: 10–20 m non indagati, la verifica non può essere omessa',
    v.esito.codice !== 'omessa', 'esito: «' + v.esito.titolo + '»');

  const fitte = []; for (let z = 2; z <= 20; z++) fitte.push([z, 40, 35]);
  [b, s] = provaSpt(fitte, [{ da: 0, a: 20, gamma: 18, gammaSat: 19, FC: 35 }], 1);
  ES.aggiornaStrato(s, s.strati[0], { sabbiaPulita: true });
  v = ES.valutaEsclusione(L, b, s, PR.calcolaScenario(b, s, L));
  controlla('B4.2', 'strato con FC = 35 % dichiarato «sabbia pulita»: serve almeno un avviso di contraddizione',
    v.esito.codice !== 'omessa', 'esito: «' + v.esito.titolo + '»');

  const pr = E.progettoEsempio(); const s2 = pr.scenari[1];
  s2.strati[0].a = 1.25; s2.strati[1].da = 1.25;
  const ds = ES.datiStrato(ES.datiEsclusione(s2), s2.strati[1]);
  controlla('B4.3', 'esempio «S1 SPT», confine 1,20 → 1,25 m: la curva granulometrica dello strato deve restare associata',
    ds.curva !== null, 'curva ' + (ds.curva ? 'presente' : 'assente') + '; voce orfana ancora nel file: ' + s2.esclusione.strati.some(x => x.da === 1.2));
}

// ---------------------------------------------------------------------------
// B5 — congruenza fisica e unità
// ---------------------------------------------------------------------------
{
  let [b, s] = provaSpt([[8, 15, 10]], [{ da: 0, a: 20, gamma: 22, gammaSat: 15, FC: 10 }], 7.5);
  controlla('B5.1', 'γ = 22 e γsat = 15 kN/m³: lo scenario deve segnalare l\'incoerenza',
    PR.controllaScenario(b, s, L).length > 0, 'errori dello scenario: ' + PR.controllaScenario(b, s, L).length);
  [b, s] = provaSpt([[8, 15, 10]], [{ da: 0, a: 8, gamma: 1.85, gammaSat: 1.98, FC: 10 }], 7.5);
  let r = PR.calcolaScenario(b, s, L);
  const [b2, s2] = provaSpt([[8, 15, 10]], [{ da: 0, a: 8, gamma: 18.5, gammaSat: 19.8, FC: 10 }], 7.5);
  const rOk = PR.calcolaScenario(b2, s2, L);
  controlla('B5.2a', 'γ in g/cm³ (1,85/1,98), stratigrafia fino a 8 m: serve un avviso di unità',
    r.stato !== 'calcolato' || r.righe[0]?.avvisi.some(a => /UNITA|GAMMA/.test(a.codice)), 'σ\'v ' + f(r.righe[0]?.tensioni?.sve, 2) + ' kPa, FS ' + f(r.righe[0]?.valori?.FS, 2) + ' (con kN/m³: FS ' + f(rOk.righe[0]?.valori?.FS, 2) + ')');
  [b, s] = provaSpt([[8, 15, 10]], [{ da: 0, a: 20, gamma: 1.85, gammaSat: 1.98, FC: 10 }], 7.5);
  r = PR.calcolaScenario(b, s, L);
  controlla('B5.2b', 'stesso errore con stratigrafia fino a 20 m: già bloccato dal controllo esistente (rilievo smentito in questo caso)',
    r.stato !== 'calcolato', 'stato ' + r.stato + (r.errori ? ' (' + r.errori[0].codice + ')' : ''));
  [b, s] = provaSpt([[2, 10, 10], [15, 10, 10]], [{ da: 0, a: 3, gamma: 9, gammaSat: 9, FC: 10 }, { da: 3, a: 20, gamma: 22, gammaSat: 22, FC: 10 }], 0);
  r = PR.calcolaScenario(b, s, L);
  controlla('B5.3', 'σ\'v negativa tra 0 e 3 m, positiva a 20 m: lo scenario deve segnalarla',
    PR.controllaScenario(b, s, L).length > 0, 'errori dello scenario: ' + PR.controllaScenario(b, s, L).length + '; punto a 2 m: ' + (r.righe[0] ? r.righe[0].stato + ' (' + r.righe[0].codice + ')' : 'scenario non calcolato (' + r.stato + ')'));
  [b, s] = provaSpt([[8, 15, 10]], [{ da: 0, a: 20, gamma: 18.5, gammaSat: 19.8, FC: 10 }], 7.5, 2.45);
  const avvSc = PR.avvisiScenario ? PR.avvisiScenario(s) : [];
  controlla('B5.4', 'amax = 2,45 (m/s² inserito come g): serve un avviso di plausibilità (non bloccante)',
    avvSc.length > 0 || PR.controllaScenario(b, s, L).length > 0, 'avvisi sui dati: ' + avvSc.length + ', errori dello scenario: ' + PR.controllaScenario(b, s, L).length + ', FS ' + f(PR.calcolaScenario(b, s, L).righe[0]?.valori?.FS, 2));
}

// ---------------------------------------------------------------------------
// §4 — punti 1–4 e 13
// ---------------------------------------------------------------------------
{
  const pr = E.progettoEsempio();
  pr.prove[0].dati.splice(100, 0, P.copia(pr.prove[0].dati[100]));
  const ap = P.apriProgetto(JSON.stringify(pr));
  const r = ap.ok ? PR.calcolaScenario(ap.progetto.prove[0], ap.progetto.scenari[0], L) : null;
  controlla('4.1', 'file .json con una profondità ripetuta: deve essere rifiutato all\'apertura',
    !ap.ok, 'apertura ' + (ap.ok ? 'accettata' : 'rifiutata') + (r ? '; IL ' + r.indiceIL.stato + ' (' + (r.indiceIL.errori?.[0]?.codice || '') + '), cedimento ' + r.cedimenti.stato : ''));

  const t = L.tensioni(STRATO_UNICO, 1, 5);
  const c = L.bi2014Cpt({ z: 5, qc: 1.2, fs: 0, sv: t.sv, sve: t.sve }, sisma, { tipo: 'CPTE' });
  controlla('4.2', 'CPT con fs = 0 kPa in sabbia sciolta: il punto non deve sparire dal FS minimo',
    c.stato === 'calcolato', 'stato ' + c.stato + ' (' + c.codice + ')');

  const [b, s] = provaSpt([[5, 40, 3], [10, 40, 3], [15, 40, 3], [20, 40, 3]], [{ da: 0, a: 20, gamma: 18, gammaSat: 19, FC: 3 }], 1);
  ES.aggiornaStrato(s, s.strati[0], { sabbiaPulita: true });
  const v = ES.valutaEsclusione(L, b, s, PR.calcolaScenario(b, s, L));
  controlla('4.3', 'prova a z = 20,00 m nell\'ultimo strato 0–20 m: deve entrare nel criterio 3 come nel calcolo',
    v.strati[0].c3.punti === 4, 'punti nel criterio 3: ' + v.strati[0].c3.punti + ' su 4 calcolati');

  const pr4 = E.progettoEsempio(); const cp = pr4.prove[0];
  for (let z = 20.02; z <= 35; z += 0.02) cp.dati.push([Math.round(z * 100) / 100, 8, 40, 300]);
  pr4.scenari[0].strati[pr4.scenari[0].strati.length - 1].a = 35;
  const r4 = PR.calcolaScenario(cp, pr4.scenari[0], L);
  const zMax = Math.max(...r4.cedimenti.tratti.map(x => x.a));
  controlla('4.4', 'CPTU fino a 35 m: il cedimento deve fermarsi a 20 m (rilievo dell\'audit: integra fino a 35 m)',
    zMax <= 20, 'ultimo tratto integrato a ' + f(zMax, 2) + ' m; S ' + f(r4.cedimenti.Smin * 100, 1) + ' cm');

  const base = E.progettoEsempio(); const sc = base.scenari[0], pv = base.prove[0];
  const f0 = P.firmaInput(pv, sc, L.VERSIONE_MOTORE);
  sc.opzioni.FSrif = 1.0; sc.esclusione.strati[1].decisione4 = 'non soddisfatto';
  controlla('13.a', 'firma input: deve cambiare se cambiano FS di riferimento o la verifica preliminare',
    P.firmaInput(pv, sc, L.VERSIONE_MOTORE) !== f0, 'firma prima ' + f0 + ', dopo ' + P.firmaInput(pv, sc, L.VERSIONE_MOTORE));
}

// ---------------------------------------------------------------------------
const larg = Math.max(...esiti.map(e => e.id.length));
for (const e of esiti) console.log((e.corretto ? 'ok              ' : 'DIFETTO PRESENTE') + '  ' + e.id.padEnd(larg) + '  ' + e.descrizione + '\n' + ' '.repeat(18 + larg) + '→ ' + e.misurato);
const n = esiti.filter(e => !e.corretto).length;
console.log('\n' + n + ' difetti presenti su ' + esiti.length + ' controlli (motore ' + L.VERSIONE_MOTORE + ', app ' + P.VERSIONE_APP + ').');
