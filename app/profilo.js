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
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'), require('../motore/indici.js'), require('../motore/cedimenti.js'));
  else root.LiquiProfilo = factory(root.LiquiProgetto, root.LiquiIndici, root.LiquiCedimenti);
})(typeof self !== 'undefined' ? self : this, function (P, IND, CED) {
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
    epsV: { etichetta: 'εv post-liquefazione', unita: '%', cifre: 3 },
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
  // Fattore di sicurezza di riferimento e controlli dello scenario
  // ---------------------------------------------------------------------------
  /** FS di riferimento dello scenario (predefinito: P.FS_RIFERIMENTO). */
  function fsRiferimento(scenario) {
    const v = scenario && scenario.opzioni && scenario.opzioni.FSrif;
    return isNum(v) && v >= 1 && v <= 3 ? v : P.FS_RIFERIMENTO;
  }

  /** Criterio di verifica e scelta del coefficiente di sicurezza: testo riportato in app, stampa e CSV. */
  function criterioFS(scenario) {
    const v = fsRiferimento(scenario);
    return 'Le NTC 2018 (§ 7.11.3.4) non stabiliscono un valore numerico minimo del coefficiente di sicurezza nei confronti della liquefazione; ' +
      'la Circolare 21/01/2019 n. 7 (§ C7.11.3.4) demanda al progettista la valutazione e la motivazione dell\'adeguatezza del margine di sicurezza adottato. ' +
      'Come riferimento tecnico si considera l\'Eurocodice 8, Parte 5 (EN 1998-5, § 4.1.4), che raccomanda FS = 1,25, come illustrato anche nella pubblicazione JRC ' +
      '«Eurocode 8: Seismic Design of Buildings – Worked Examples» (2012, § 4.5). ' +
      (v === P.FS_RIFERIMENTO ? 'Il valore 1,25, riferito al rapporto CRR/CSR, è assunto quale riferimento' : 'In questo scenario il progettista ha adottato FS di riferimento = ' + String(v).replace('.', ',') + ', riferito al rapporto CRR/CSR') +
      ', ferma restando la responsabilità del progettista di verificarne l\'adeguatezza in relazione alle caratteristiche geotecniche del deposito e all\'azione sismica di progetto. ' +
      'FS = 1 resta l\'uguaglianza tra domanda e resistenza del modello.';
  }

  /** Controlli dello scenario prima del calcolo: elenco degli errori (vuoto se valido). */
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
    const fsRif = scenario.opzioni && scenario.opzioni.FSrif;
    if (fsRif !== undefined && fsRif !== null && !(isNum(fsRif) && fsRif >= 1 && fsRif <= 3)) err('opzioni.FSrif', 'FUORI_DOMINIO', 'FS di riferimento tra 1 e 3');
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
    const indiceIL = IND ? IND.indiceIL(puntiPerIL(righe), scenario.zFalda) : null;
    // cedimento post-sismico e LSN: metodo da CPT (Zhang et al. 2002), solo con il metodo CPT
    let cedimenti = null;
    if (CED && scenario.metodo === 'bi2014Cpt') {
      cedimenti = CED.cedimentoLSN(puntiPerCedimenti(righe), scenario.zFalda);
      if (cedimenti.stato === 'calcolato') {
        const perZ = new Map();
        for (const t of cedimenti.tratti) if (t.categoria === 'FS') perZ.set(t.zPunto, t.epsMin);
        for (const r of righe) if (perZ.has(r.z) && r.stato === 'calcolato' && r.valori) r.valori.epsV = perZ.get(r.z);
      }
    }
    return { ...base, stato: 'calcolato', righe, riepilogo: riepiloga(righe, prova, scenario), indiceIL, cedimenti };
  }

  /**
   * Categorie dei punti per l'indice IL (motore/indici.js):
   *  calcolato con FS → 'FS'; sopra falda (NON_SATURO) → 'sopraFalda';
   *  Ic oltre soglia → 'argilloso'; tutto il resto (dati mancanti, non validi, fuori
   *  stratigrafia, non convergenti, oltre il limite dell'app) → 'ignoto'.
   * Le righe senza profondità valida non entrano.
   */
  function puntiPerIL(righe) {
    return righe.filter(r => isNum(r.z) && r.z >= 0).map(r => {
      if (r.stato === 'calcolato' && r.valori && isNum(r.valori.FS) && r.valori.FS >= 0) return { z: r.z, categoria: 'FS', FS: r.valori.FS };
      if (r.stato === 'non_applicabile' && r.codice === 'NON_SATURO') return { z: r.z, categoria: 'sopraFalda' };
      if (r.stato === 'non_applicabile' && r.codice === 'IC_OLTRE_SOGLIA') return { z: r.z, categoria: 'argilloso' };
      return { z: r.z, categoria: 'ignoto' };
    });
  }

  /** Punti per il cedimento: come per IL, con (qc1N)cs dei punti calcolati. */
  function puntiPerCedimenti(righe) {
    return righe.filter(r => isNum(r.z) && r.z >= 0).map(r => {
      const p = puntiPerIL([r])[0];
      if (p.categoria === 'FS') {
        if (r.valori && isNum(r.valori.qc1Ncs) && r.valori.qc1Ncs > 0) p.qc1Ncs = r.valori.qc1Ncs;
        else return { z: r.z, categoria: 'ignoto' };
      }
      return p;
    });
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

    if (m === 'bi2014Cpt') {
      // grandezze per la carta di comportamento: anche sopra falda e con Ic oltre soglia
      const src = esito.stato === L.STATI.CALCOLATO ? esito : (esito.diagnostica || esito);
      if (isNum(src.Q) && isNum(src.F) && isNum(src.Ic) && src.Q > 0 && src.F > 0) riga.sbt = { Q: src.Q, F: src.F, Ic: src.Ic, zona: zonaSBT(src.Ic) };
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
    NON_SATURO: 'sopra falda (u = 0)', IC_OLTRE_SOGLIA: 'escluso: comportamento argilloso (Ic oltre soglia), FS N.A.',
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

  /**
   * Zone di comportamento da Ic: Robertson & Wride (1998), Tabella 1, pag. 450 (da Robertson
   * 1990). Ic non si applica alle zone 1, 8 e 9, che quindi non sono rappresentate.
   */
  const ZONE_SBT = [
    { zona: 7, icDa: 0, icA: 1.31, nome: 'sabbia ghiaiosa – sabbia densa' },
    { zona: 6, icDa: 1.31, icA: 2.05, nome: 'sabbia pulita – sabbia limosa' },
    { zona: 5, icDa: 2.05, icA: 2.60, nome: 'sabbia limosa – limo sabbioso' },
    { zona: 4, icDa: 2.60, icA: 2.95, nome: 'limo argilloso – argilla limosa' },
    { zona: 3, icDa: 2.95, icA: 3.60, nome: 'argilla limosa – argilla' },
    { zona: 2, icDa: 3.60, icA: Infinity, nome: 'terreni organici – torbe' }
  ];
  function zonaSBT(Ic) {
    if (!isNum(Ic)) return null;
    const z = ZONE_SBT.find(x => Ic >= x.icDa && Ic < x.icA);
    return z ? z.zona : null;
  }

  /**
   * Valore da mostrare in tabelle e CSV. Ic resta valido anche quando impedisce l'applicazione
   * del metodo di innesco (coerenza con il grafico Ic); i FS non applicabili non vengono esposti.
   */
  function valoreRisultato(r, chiave) {
    const ammesso = r.stato === 'calcolato' || (chiave === 'Ic' && r.codice === 'IC_OLTRE_SOGLIA');
    const v = ammesso && r.valori ? r.valori[chiave] : null;
    return isNum(v) ? v : null;
  }

  function valoreDi(r, chiave, sorgente) {
    if (sorgente === 'ingresso') return r.ingresso ? r.ingresso[chiave] : null;
    if (sorgente === 'tensioni') return r.tensioni ? r.tensioni[chiave] : null;
    return r.valori ? r.valori[chiave] : null;
  }

  return { G, METODI, ETICHETTE_STATI, MOTIVI_BREVI, ZONE_SBT, zonaSBT, fsRiferimento, criterioFS, campiRichiesti, controllaScenario, calcolaScenario, riepiloga, confrontaDominio, serie, stratoA, valoreRisultato, puntiPerIL };
});
