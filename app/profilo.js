/*
 * GeoHub-LiquiSite — elaborazione del profilo
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Collega i dati della prova, le tensioni e le funzioni puntuali del motore. Nessuna formula
 * di liquefazione qui: ogni valore numerico viene dal motore (motore/liquisite.js).
 *
 * Gestione esplicita:
 *  - tratti sopra falda: il motore restituisce 'non_applicabile' (NON_SATURO);
 *  - dati mancanti: riga 'dati_insufficienti' (DATO_MANCANTE), il motore non viene chiamato;
 *  - profondità non coperte dalla stratigrafia: riga 'dati_insufficienti' (FUORI_STRATIGRAFIA);
 *  - profondità non indagate: non esistono righe; il riepilogo dichiara l'estensione indagata
 *    e quella analizzata, e i grafici non uniscono i punti attraverso i vuoti;
 *  - SPT: punti discreti, nessun profilo continuo (assunzione dichiarata).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'));
  else root.LiquiProfilo = factory(root.LiquiProgetto);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // ---------------------------------------------------------------------------
  // Grandezze mostrate in tabelle, grafici ed esportazioni (unica definizione)
  // ---------------------------------------------------------------------------
  const G = {
    z: { etichetta: 'z', unita: 'm', cifre: 2 },
    qc: { etichetta: 'qc', unita: 'MPa', cifre: 2 },
    fs: { etichetta: 'fs', unita: 'kPa', cifre: 1 },
    u2: { etichetta: 'u2', unita: 'kPa', cifre: 1 },
    N: { etichetta: 'N SPT', unita: 'colpi/30 cm', cifre: 0 },
    Vs: { etichetta: 'Vs', unita: 'm/s', cifre: 0 },
    FC: { etichetta: 'FC', unita: '%', cifre: 1 },
    sv: { etichetta: 'σv', unita: 'kPa', cifre: 1 },
    u: { etichetta: 'u0', unita: 'kPa', cifre: 1 },
    sve: { etichetta: 'σ\'v', unita: 'kPa', cifre: 1 },
    qt: { etichetta: 'qt', unita: 'kPa', cifre: 0 },
    Q: { etichetta: 'Q', unita: '–', cifre: 1 },
    F: { etichetta: 'F', unita: '%', cifre: 2 },
    n: { etichetta: 'n', unita: '–', cifre: 2 },
    Ic: { etichetta: 'Ic', unita: '–', cifre: 2 },
    CN: { etichetta: 'CN', unita: '–', cifre: 3 },
    qc1N: { etichetta: 'qc1N', unita: '–', cifre: 1 },
    dqc1N: { etichetta: 'Δqc1N', unita: '–', cifre: 1 },
    qc1Ncs: { etichetta: 'qc1Ncs', unita: '–', cifre: 1 },
    lunghezzaAste: { etichetta: 'aste', unita: 'm', cifre: 2 },
    CR: { etichetta: 'CR', unita: '–', cifre: 3 },
    CS: { etichetta: 'CS', unita: '–', cifre: 3 },
    N60: { etichetta: 'N60', unita: '–', cifre: 1 },
    N160: { etichetta: '(N1)60', unita: '–', cifre: 1 },
    dN160: { etichetta: 'Δ(N1)60', unita: '–', cifre: 2 },
    N160cs: { etichetta: '(N1)60cs', unita: '–', cifre: 1 },
    FCusato: { etichetta: 'FC usato', unita: '%', cifre: 1 },
    CVs: { etichetta: 'CVs', unita: '–', cifre: 3 },
    Vs1: { etichetta: 'Vs1', unita: 'm/s', cifre: 1 },
    rd: { etichetta: 'rd', unita: '–', cifre: 3 },
    Csigma: { etichetta: 'Cσ', unita: '–', cifre: 3 },
    Ksigma: { etichetta: 'Kσ', unita: '–', cifre: 3 },
    KMw: { etichetta: 'KMw', unita: '–', cifre: 3 },
    MSFmax: { etichetta: 'MSFmax', unita: '–', cifre: 3 },
    MSF: { etichetta: 'MSF', unita: '–', cifre: 3 },
    DWF: { etichetta: 'DWF', unita: '–', cifre: 3 },
    CSR75: { etichetta: 'CSR M7,5 σ\'1atm', unita: '–', cifre: 3 },
    CSRrif: { etichetta: 'CSR rif.', unita: '–', cifre: 3 },
    CRR75: { etichetta: 'CRR M7,5 σ\'1atm', unita: '–', cifre: 3 },
    CSR: { etichetta: 'CSR (sito)', unita: '–', cifre: 3 },
    CRR: { etichetta: 'CRR (sito)', unita: '–', cifre: 3 },
    CRR15: { etichetta: 'CRR PL15% (sito)', unita: '–', cifre: 3 },
    FS: { etichetta: 'FS', unita: '–', cifre: 2 },
    PL: { etichetta: 'PL', unita: '–', cifre: 3 }
  };

  /** Grandezze per metodo: intermedie e finali. CSR e CRR sono entrambe a condizioni di sito. */
  const METODI = {
    bi2014Cpt: {
      intermedie: ['qt', 'Q', 'F', 'n', 'Ic', 'FCusato', 'CN', 'qc1N', 'dqc1N', 'qc1Ncs', 'rd', 'Csigma', 'Ksigma', 'MSFmax', 'MSF', 'CSR75', 'CRR75'],
      finali: ['CSR', 'CRR', 'FS', 'PL'],
      notaPL: 'PL condizionata di Boulanger & Idriss (2014, Eq. 5.26): FS = 1 corrisponde a PL ≈ 16 %.',
      notaFS: 'FS = CRR/CSR a condizioni di sito (Boulanger & Idriss 2014).',
      continuo: true
    },
    bi2014Spt: {
      intermedie: ['lunghezzaAste', 'CR', 'N60', 'CN', 'N160', 'dN160', 'N160cs', 'rd', 'Csigma', 'Ksigma', 'MSFmax', 'MSF', 'CSR75', 'CRR75'],
      finali: ['CSR', 'CRR', 'FS'],
      notaPL: 'PL non calcolata: la relazione probabilistica da SPT degli stessi autori non è inclusa.',
      notaFS: 'FS = CRR/CSR a condizioni di sito (Boulanger & Idriss 2014).',
      continuo: false
    },
    cetin2018Spt: {
      intermedie: ['lunghezzaAste', 'CR', 'CN', 'CS', 'N160', 'dN160', 'N160cs', 'FCusato', 'rd', 'Ksigma', 'KMw', 'CSRrif'],
      finali: ['CSR', 'CRR', 'FS', 'PL'],
      notaPL: 'PL di Cetin et al. (2018): FS = 1 corrisponde a PL = 50 %.',
      notaFS: 'FS = CRR(PL 50 %)/CSR (Cetin et al. 2018).',
      continuo: false
    },
    kayen2013Vs: {
      intermedie: ['CVs', 'Vs1', 'FCusato', 'rd', 'DWF'],
      finali: ['CSR', 'CRR15', 'FS', 'PL'],
      notaPL: 'PL di Kayen et al. (2013), Eq. 13.',
      notaFS: 'FS = CRR(PL 15 %)/CSR (Kayen et al. 2013, Eq. 16): metodo di solo confronto.',
      continuo: true
    }
  };

  /** Colonne dei dati originali necessarie al metodo (oltre a z). */
  function campiRichiesti(tipo) {
    if (tipo === 'CPTE') return ['qc', 'fs'];
    if (tipo === 'CPTU') return ['qc', 'fs', 'u2'];
    if (tipo === 'SPT') return ['N'];
    return ['Vs'];
  }

  function stratoA(strati, z) {
    const ord = strati.slice().sort((a, b) => a.da - b.da);
    for (let i = 0; i < ord.length; i++) {
      const s = ord[i];
      if (z >= s.da && (z < s.a || (i === ord.length - 1 && z === s.a))) return s;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Controlli dello scenario prima del calcolo
  // ---------------------------------------------------------------------------
  function controllaScenario(prova, scenario, L) {
    const errori = [];
    const err = (campo, codice, motivo) => errori.push({ campo, codice, motivo });
    if (!prova) { err('prova', 'MANCANTE', 'nessuna prova associata allo scenario'); return errori; }
    if (!P.METODI_PER_TIPO[prova.tipo].includes(scenario.metodo)) err('metodo', 'NON_COMPATIBILE', 'metodo non compatibile con la prova ' + prova.tipo);
    if (!isNum(scenario.Mw)) err('Mw', 'MANCANTE', 'magnitudo momento Mw mancante');
    if (!isNum(scenario.amax)) err('amax', 'MANCANTE', 'accelerazione massima in superficie mancante');
    if (!isNum(scenario.zFalda)) err('zFalda', 'MANCANTE', 'profondità della falda mancante');
    if (!Array.isArray(scenario.strati) || scenario.strati.length === 0) err('strati', 'MANCANTE', 'stratigrafia mancante');
    else if (isNum(scenario.zFalda)) {
      const zMax = Math.max(...scenario.strati.map(s => isNum(s.a) ? s.a : 0));
      const t = L.tensioni(scenario.strati, scenario.zFalda, zMax);
      if (t.stato !== L.STATI.CALCOLATO) for (const e of t.errori) err(e.campo, e.codice, e.motivo);
    }
    for (const [i, s] of (scenario.strati || []).entries()) {
      if (s.FC !== null && s.FC !== undefined && !(isNum(s.FC) && s.FC >= 0 && s.FC <= 100)) err('strati[' + i + '].FC', 'FUORI_DOMINIO', 'FC tra 0 e 100 %');
    }
    if ((scenario.metodo === 'cetin2018Spt' || scenario.metodo === 'kayen2013Vs') && !isNum(scenario.opzioni && scenario.opzioni.Vs12)) {
      err('opzioni.Vs12', 'MANCANTE', 'V*s,12 (Vs media nei primi 12 m) richiesta dal metodo');
    }
    if (prova.dati.length === 0) err('prova.dati', 'MANCANTE', 'la prova non contiene dati');
    return errori;
  }

  // ---------------------------------------------------------------------------
  // Calcolo del profilo
  // ---------------------------------------------------------------------------

  /**
   * Calcola tutte le righe della prova con lo scenario. L: motore LiquiSite.
   * Risultato: { stato, errori?, versioneMotore, firma, calcolatoIl, configurazione, righe, riepilogo }
   */
  function calcolaScenario(prova, scenario, L, opz = {}) {
    const base = {
      scenarioId: scenario.id, provaId: prova ? prova.id : null, metodo: scenario.metodo,
      versioneMotore: L.VERSIONE_MOTORE, firma: prova ? P.firmaInput(prova, scenario, L.VERSIONE_MOTORE) : null,
      calcolatoIl: opz.adesso || new Date().toISOString(),
      configurazione: prova ? { prova: { id: prova.id, nome: prova.nome, tipo: prova.tipo, unita: P.copia(prova.unita), parametri: P.copia(prova.parametri) },
        scenario: P.copia(scenario) } : null
    };
    const errori = controllaScenario(prova, scenario, L);
    if (errori.length) return { ...base, stato: 'input_non_valido', errori, righe: [], riepilogo: null };

    const dati = P.datiInterni(prova);
    const richiesti = campiRichiesti(prova.tipo);
    const par = prova.parametri || {};
    const sisma = { amax: scenario.amax, Mw: scenario.Mw };
    const righe = dati.map((d) => calcolaRiga(d, prova, scenario, L, richiesti, par, sisma));
    return { ...base, stato: 'calcolato', righe, riepilogo: riepiloga(righe, prova, scenario) };
  }

  function calcolaRiga(d, prova, scenario, L, richiesti, par, sisma) {
    const riga = { indice: d.indice, z: d.z, ingresso: d, tensioni: null, FC: null, origineFC: null, avvisi: [], assunzioni: [] };
    if (!isNum(d.z) || d.z < 0) return { ...riga, stato: 'input_non_valido', codice: 'Z_NON_VALIDA', motivo: 'profondità mancante o non valida' };
    const mancanti = richiesti.filter(c => d[c] === null);
    if (mancanti.length) return { ...riga, stato: 'dati_insufficienti', codice: 'DATO_MANCANTE', motivo: 'dato mancante: ' + mancanti.join(', ') };
    const nonNum = richiesti.filter(c => !isNum(d[c]));
    if (nonNum.length) return { ...riga, stato: 'input_non_valido', codice: 'DATO_NON_NUMERICO', motivo: 'valore non numerico: ' + nonNum.join(', ') };

    const t = L.tensioni(scenario.strati, scenario.zFalda, d.z);
    if (t.stato !== L.STATI.CALCOLATO) {
      const fuori = t.errori.every(e => e.codice === 'COPERTURA_INSUFFICIENTE');
      return { ...riga, stato: fuori ? 'dati_insufficienti' : 'input_non_valido', codice: fuori ? 'FUORI_STRATIGRAFIA' : 'TENSIONI', motivo: t.errori.map(e => e.motivo).join('; ') };
    }
    riga.tensioni = { sv: t.sv, u: t.u, sve: t.sve };

    // Contenuto di fini: dato della prova, altrimenti stratigrafia, altrimenti regola del metodo
    const strato = stratoA(scenario.strati, d.z);
    if (isNum(d.FC)) { riga.FC = d.FC; riga.origineFC = 'misurato (dato della prova)'; }
    else if (strato && isNum(strato.FC)) {
      riga.FC = strato.FC; riga.origineFC = 'assegnato dalla stratigrafia';
      riga.assunzioni.push({ codice: 'FC_DA_STRATIGRAFIA', descrizione: 'FC = ' + strato.FC + ' % assegnato dallo strato ' + strato.da + '–' + strato.a + ' m.' });
    }

    const punto = { z: d.z, sv: t.sv, sve: t.sve };
    let esito;
    const m = scenario.metodo;
    if (m === 'bi2014Cpt') {
      Object.assign(punto, { qc: d.qc, fs: d.fs });
      if (prova.tipo === 'CPTU') punto.u2 = d.u2;
      if (riga.FC !== null) punto.FC = riga.FC;
      const o = { tipo: prova.tipo, IcSoglia: scenario.opzioni.IcSoglia, CFC: scenario.opzioni.CFC };
      if (prova.tipo === 'CPTU' && isNum(par.ar)) o.ar = par.ar;
      if (!isNum(o.IcSoglia)) delete o.IcSoglia;
      if (!isNum(o.CFC)) delete o.CFC;
      esito = L.bi2014Cpt(punto, sisma, o);
      if (riga.FC === null && esito.origineFC) riga.origineFC = esito.origineFC;
    } else if (m === 'bi2014Spt' || m === 'cetin2018Spt') {
      if (riga.FC === null) return { ...riga, stato: 'dati_insufficienti', codice: 'FC_MANCANTE', motivo: 'FC mancante: indicarlo nella prova o nella stratigrafia (richiesto dal metodo)' };
      Object.assign(punto, { N: d.N, FC: riga.FC });
      const vert = { CE: par.CE, sporgenza: par.sporgenza };
      if (par.CB !== undefined && par.CB !== null) vert.CB = par.CB;
      if (m === 'bi2014Spt') {
        if (par.CS !== undefined && par.CS !== null) vert.CS = par.CS;
        esito = L.bi2014Spt(punto, sisma, vert);
      } else {
        if (par.senzaRivestimento === true) vert.senzaRivestimento = true;
        else if (par.CS !== undefined && par.CS !== null) vert.CS = par.CS;
        esito = L.cetin2018Spt(punto, sisma, vert, { Vs12: scenario.opzioni.Vs12 });
      }
    } else if (m === 'kayen2013Vs') {
      punto.Vs = d.Vs;
      if (riga.FC !== null) punto.FC = riga.FC;
      esito = L.kayen2013Vs(punto, sisma, { Vs12: scenario.opzioni.Vs12 });
    }

    riga.stato = esito.stato;
    riga.avvisi = riga.avvisi.concat(esito.avvisi || []);
    if (esito.assunzioni) riga.assunzioni = riga.assunzioni.concat(esito.assunzioni);
    if (esito.stato === L.STATI.CALCOLATO) {
      const valori = {};
      for (const k of METODI[m].intermedie.concat(METODI[m].finali)) valori[k] = esito[k] === undefined ? null : esito[k];
      if (m === 'bi2014Cpt') valori.FCusato = esito.FC;
      riga.valori = valori;
      if (esito.convergenza) riga.convergenza = esito.convergenza;
    } else {
      riga.codice = esito.codice || (esito.errori && esito.errori[0] && esito.errori[0].codice) || null;
      riga.motivo = esito.motivo || (esito.errori || []).map(e => e.campo + ': ' + e.motivo).join('; ');
      if (esito.errori) riga.errori = esito.errori;
      if (esito.Ic !== undefined) riga.valori = { Ic: esito.Ic, FCusato: esito.FC };
    }
    return riga;
  }

  // ---------------------------------------------------------------------------
  // Riepilogo
  // ---------------------------------------------------------------------------
  /** Motivi brevi per tabelle e grafici (il motivo completo resta in riga.motivo). */
  const MOTIVI_BREVI = {
    NON_SATURO: 'sopra falda (u = 0)', IC_OLTRE_SOGLIA: 'Ic oltre soglia: metodo non applicabile',
    DATO_MANCANTE: 'dato mancante', FC_MANCANTE: 'FC mancante', FUORI_STRATIGRAFIA: 'fuori dalla stratigrafia',
    OLTRE_LIMITE_APP: 'oltre 20 m (limite di LiquiSite)', AMAX_NULLA: 'amax = 0', U2_MANCANTE: 'u2 mancante (CPTU)',
    IC_NON_CALCOLABILE: 'Ic non calcolabile', Z_NON_VALIDA: 'profondità non valida', DATO_NON_NUMERICO: 'valore non numerico'
  };

  const ETICHETTE_STATI = {
    calcolato: 'calcolato', input_non_valido: 'input non valido', dati_insufficienti: 'dati insufficienti',
    non_applicabile: 'non applicabile', non_convergente: 'non convergente', errore_numerico: 'errore numerico'
  };

  function riepiloga(righe, prova, scenario) {
    const zs = righe.filter(r => isNum(r.z)).map(r => r.z);
    const calc = righe.filter(r => r.stato === 'calcolato');
    const conteggi = {};
    for (const r of righe) conteggi[r.stato] = (conteggi[r.stato] || 0) + 1;
    const codici = {};
    for (const r of righe) if (r.stato !== 'calcolato' && r.codice) codici[r.codice] = (codici[r.codice] || 0) + 1;

    let fsMin = null;
    for (const r of calc) if (isNum(r.valori.FS) && (fsMin === null || r.valori.FS < fsMin.FS)) fsMin = { FS: r.valori.FS, z: r.z };

    // intervalli consecutivi non calcolati
    const intervalli = [];
    let cur = null;
    for (const r of righe) {
      if (r.stato !== 'calcolato' && isNum(r.z)) {
        const chiave = r.stato + '|' + (r.codice || '');
        if (cur && cur.chiave === chiave) { cur.a = r.z; cur.n++; }
        else { cur = { chiave, stato: r.stato, codice: r.codice || null, motivo: r.motivo || '', da: r.z, a: r.z, n: 1 }; intervalli.push(cur); }
      } else cur = null;
    }
    intervalli.forEach(i => delete i.chiave);

    const avvisi = {};
    const assunzioni = {};
    for (const r of righe) {
      for (const a of r.avvisi) {
        if (!avvisi[a.codice]) avvisi[a.codice] = { codice: a.codice, tipo: a.tipo, messaggio: a.messaggio, n: 0, zDa: r.z, zA: r.z };
        const x = avvisi[a.codice]; x.n++; x.zA = r.z;
      }
      for (const a of r.assunzioni) {
        if (!assunzioni[a.codice]) assunzioni[a.codice] = { codice: a.codice, descrizione: a.descrizione, n: 0 };
        assunzioni[a.codice].n++;
      }
    }
    const assunzioniProfilo = [];
    if (!METODI[scenario.metodo].continuo) assunzioniProfilo.push({ codice: 'SPT_PUNTI_DISCRETI', descrizione: 'Prova SPT: i risultati valgono alle profondità delle prove e non sono uniti in un profilo continuo.' });

    return {
      punti: righe.length,
      profonditaIndagata: zs.length ? { da: Math.min(...zs), a: Math.max(...zs) } : null,
      estensioneAnalizzata: calc.length ? { da: Math.min(...calc.map(r => r.z)), a: Math.max(...calc.map(r => r.z)) } : null,
      conteggi, codici, fsMin, intervalliNonCalcolati: intervalli,
      avvisi: Object.values(avvisi), assunzioni: Object.values(assunzioni).concat(assunzioniProfilo.map(a => ({ ...a, n: null }))),
      notaFS: METODI[scenario.metodo].notaFS, notaPL: METODI[scenario.metodo].notaPL,
      zCalcolate: calc.map(r => r.z)
    };
  }

  /**
   * Confronto del dominio dei punti calcolati tra due risultati.
   * Restituisce { uguale, soloA, soloB } (profondità).
   */
  function confrontaDominio(rA, rB) {
    const a = new Set((rA.riepilogo ? rA.riepilogo.zCalcolate : []).map(z => z.toFixed(4)));
    const b = new Set((rB.riepilogo ? rB.riepilogo.zCalcolate : []).map(z => z.toFixed(4)));
    const soloA = [...a].filter(z => !b.has(z)).map(Number);
    const soloB = [...b].filter(z => !a.has(z)).map(Number);
    return { uguale: soloA.length === 0 && soloB.length === 0, soloA, soloB };
  }

  /**
   * Serie per i grafici: { punti: [{x, y, indice}], segmenti: [[...]] }.
   * I segmenti si interrompono su righe non calcolate, valori non finiti e vuoti di profondità
   * maggiori di 3 volte il passo mediano. I valori non vengono modificati.
   */
  function serie(risultato, chiave, sorgente = 'valori') {
    const righe = risultato.righe;
    const passi = [];
    for (let i = 1; i < righe.length; i++) if (isNum(righe[i].z) && isNum(righe[i - 1].z)) passi.push(Math.abs(righe[i].z - righe[i - 1].z));
    passi.sort((a, b) => a - b);
    const mediano = passi.length ? passi[Math.floor(passi.length / 2)] : 0;
    const vuotoMax = mediano > 0 ? 3 * mediano : Infinity;
    const punti = [], segmenti = [];
    let seg = [], zPrec = null;
    for (const r of righe) {
      const v = valoreDi(r, chiave, sorgente);
      const valido = isNum(r.z) && isNum(v) && (sorgente !== 'valori' || r.stato === 'calcolato' || (chiave === 'Ic' && r.codice === 'IC_OLTRE_SOGLIA'));
      if (!valido) { if (seg.length) segmenti.push(seg); seg = []; zPrec = null; continue; }
      const p = { x: v, y: r.z, indice: r.indice };
      punti.push(p);
      if (zPrec !== null && Math.abs(r.z - zPrec) > vuotoMax) { segmenti.push(seg); seg = []; }
      seg.push(p);
      zPrec = r.z;
    }
    if (seg.length) segmenti.push(seg);
    return { punti, segmenti };
  }

  function valoreDi(r, chiave, sorgente) {
    if (sorgente === 'ingresso') return r.ingresso ? r.ingresso[chiave] : null;
    if (sorgente === 'tensioni') return r.tensioni ? r.tensioni[chiave] : null;
    return r.valori ? r.valori[chiave] : null;
  }

  return { G, METODI, ETICHETTE_STATI, MOTIVI_BREVI, campiRichiesti, controllaScenario, calcolaScenario, riepiloga, confrontaDominio, serie, stratoA };
});
