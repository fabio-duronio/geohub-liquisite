/*
 * GeoHub-LiquiSite — formato del progetto, unità e validazione dei file
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Nessuna formula di calcolo: qui ci sono solo struttura dei dati, conversioni di unità
 * dichiarate esplicitamente e controlli di coerenza dei file JSON.
 *
 * Progetto (serializzabile):
 * {
 *   formato: 'geohub-liquisite-progetto', versioneFormato: 1,
 *   progetto: { titolo, sito, autore, note },
 *   prove: [Prova], scenari: [Scenario], provaAttiva, scenarioAttivo,
 *   risultati: { [scenarioId]: Risultato }        // facoltativo
 * }
 * Prova: { id, nome, tipo: 'CPTE'|'CPTU'|'SPT'|'VS', provenienza, esempio (bool),
 *          unita: { z, qc?, fs?, u2? }, colonne: [...], dati: [[numero|null, …]],
 *          parametri: { CE, CB, CS, sporgenza, senzaRivestimento, ar } (secondo il tipo) }
 * Scenario: { id, nome, colore, provaId, metodo, Mw, amax, zFalda,
 *             strati: [{ da, a, gamma, gammaSat, FC|null, descrizione }],
 *             opzioni: { Vs12, IcSoglia, CFC, FSrif }, note }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiquiProgetto = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMATO = 'geohub-liquisite-progetto';
  const VERSIONE_FORMATO = 1;

  const TIPI_PROVA = Object.freeze({
    CPTE: { etichetta: 'CPT a punta elettrica (senza u)', colonne: ['z', 'qc', 'fs'], facoltative: ['FC'] },
    CPTU: { etichetta: 'CPTU (piezocono)', colonne: ['z', 'qc', 'fs', 'u2'], facoltative: ['FC'] },
    SPT: { etichetta: 'SPT', colonne: ['z', 'N'], facoltative: ['FC'] },
    VS: { etichetta: 'Vs (onde di taglio)', colonne: ['z', 'Vs'], facoltative: ['FC'] }
  });

  /** Metodi compatibili con ciascun tipo di prova. */
  const METODI_PER_TIPO = Object.freeze({
    CPTE: ['bi2014Cpt'], CPTU: ['bi2014Cpt'],
    SPT: ['bi2014Spt', 'cetin2018Spt'],
    VS: ['kayen2013Vs']
  });

  const NOMI_METODI = Object.freeze({
    bi2014Cpt: 'Boulanger & Idriss (2014) — CPT',
    bi2014Spt: 'Boulanger & Idriss (2014) — SPT',
    cetin2018Spt: 'Cetin et al. (2018) — SPT',
    kayen2013Vs: 'Kayen et al. (2013) — Vs (solo confronto)'
  });

  /** Unità ammesse per colonna e fattore verso l'unità interna del motore. */
  const UNITA = Object.freeze({
    z: { interna: 'm', fattori: { m: 1, cm: 0.01 } },
    qc: { interna: 'MPa', fattori: { MPa: 1, kPa: 0.001 } },
    fs: { interna: 'kPa', fattori: { kPa: 1, MPa: 1000 } },
    u2: { interna: 'kPa', fattori: { kPa: 1, MPa: 1000 } },
    N: { interna: 'colpi/30 cm', fattori: { 'colpi/30 cm': 1 } },
    Vs: { interna: 'm/s', fattori: { 'm/s': 1 } },
    FC: { interna: '%', fattori: { '%': 1 } }
  });

  const ETICHETTE_COLONNE = Object.freeze({
    z: 'Profondità', qc: 'qc', fs: 'fs', u2: 'u2', N: 'N SPT', Vs: 'Vs', FC: 'FC'
  });

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /** FS di riferimento predefinito: valore raccomandato da EN 1998-5, § 4.1.4 (modificabile dal progettista). */
  const FS_RIFERIMENTO = 1.25;

  /** Versione dell'applicazione (distinta da quella del motore di calcolo). */
  const VERSIONE_APP = '0.2.0';

  let contatore = 0;
  function nuovoId(prefisso) {
    contatore++;
    return prefisso + '-' + Date.now().toString(36) + '-' + contatore.toString(36);
  }

  function unitaPredefinite(tipo) {
    const u = { z: 'm', FC: '%' };
    for (const c of TIPI_PROVA[tipo].colonne) if (c !== 'z') u[c] = UNITA[c].interna;
    return u;
  }

  function parametriPredefiniti(tipo) {
    if (tipo === 'SPT') return { CE: 1, CB: 1, CS: 1, sporgenza: 1, senzaRivestimento: false };
    if (tipo === 'CPTU') return { ar: 0.8 };
    return {};
  }

  function nuovaProva(tipo, nome) {
    if (!TIPI_PROVA[tipo]) throw new Error('tipo di prova non riconosciuto: ' + tipo);
    return {
      id: nuovoId('prova'), nome: nome || 'Prova ' + tipo, tipo, provenienza: '', esempio: false,
      unita: unitaPredefinite(tipo), colonne: TIPI_PROVA[tipo].colonne.slice(), dati: [],
      parametri: parametriPredefiniti(tipo)
    };
  }

  const COLORI_SCENARI = ['#1e4e8c', '#9a4410', '#1f6b45', '#6b3fa0'];

  /** Dati della verifica preliminare (§7.11.3.4.2): non entrano nel calcolo né nella firma. */
  function esclusioneVuota() {
    return { faldaMediaStagionale: null, pcSubOrizzontale: null, fondazioniSuperficiali: null, strati: [] };
  }

  function nuovoScenario(prova, nome, indice = 0) {
    return {
      id: nuovoId('scen'), nome: nome || 'Scenario ' + (indice + 1), colore: COLORI_SCENARI[indice % COLORI_SCENARI.length],
      provaId: prova ? prova.id : null, metodo: prova ? METODI_PER_TIPO[prova.tipo][0] : null,
      Mw: null, amax: null, zFalda: null,
      strati: [], opzioni: { Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: FS_RIFERIMENTO }, note: '',
      esclusione: esclusioneVuota()
    };
  }

  function nuovoProgetto() {
    return {
      formato: FORMATO, versioneFormato: VERSIONE_FORMATO,
      progetto: { titolo: '', sito: '', autore: '', note: '' },
      prove: [], scenari: [], provaAttiva: null, scenarioAttivo: null, risultati: {}
    };
  }

  /** Copia profonda di dati serializzabili. */
  const copia = (x) => JSON.parse(JSON.stringify(x));

  function duplicaScenario(scenario, indice) {
    const s = copia(scenario);
    s.id = nuovoId('scen');
    s.nome = scenario.nome + ' (copia)';
    s.colore = COLORI_SCENARI[indice % COLORI_SCENARI.length];
    return s;
  }

  /**
   * Converte i dati della prova nelle unità interne del motore.
   * Restituisce righe { indice, z, qc, fs, u2, N, Vs, FC } con null per i dati mancanti.
   */
  function datiInterni(prova) {
    return prova.dati.map((riga, indice) => {
      const r = { indice };
      prova.colonne.forEach((col, j) => {
        const v = riga[j];
        if (v === null || v === undefined) { r[col] = null; return; }
        const f = UNITA[col].fattori[prova.unita[col] || UNITA[col].interna];
        r[col] = isNum(v) ? v * f : NaN;
      });
      return r;
    });
  }

  /** Opzioni che entrano nel calcolo: FSrif riguarda solo la lettura dei risultati, non il calcolo. */
  function opzioniCalcolo(opzioni) {
    if (!opzioni || typeof opzioni !== 'object') return opzioni;
    const { FSrif, ...resto } = opzioni;
    return resto;
  }

  /** Firma degli input da cui dipende un risultato: cambia se cambia qualunque input del calcolo. */
  function firmaInput(prova, scenario, versioneMotore) {
    const s = JSON.stringify({ v: versioneMotore, p: { tipo: prova.tipo, unita: prova.unita, colonne: prova.colonne, dati: prova.dati, parametri: prova.parametri },
      s: { metodo: scenario.metodo, Mw: scenario.Mw, amax: scenario.amax, zFalda: scenario.zFalda, strati: scenario.strati, opzioni: opzioniCalcolo(scenario.opzioni), provaId: scenario.provaId } });
    // FNV-1a a 32 bit: basta per riconoscere un cambiamento, non è una firma di sicurezza
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  // ---------------------------------------------------------------------------
  // Validazione di un file di progetto
  // ---------------------------------------------------------------------------

  function validaProgetto(obj) {
    const errori = [];
    const err = (campo, motivo) => errori.push({ campo, motivo });
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { err('file', 'non è un oggetto JSON'); return { ok: false, errori }; }
    if (obj.formato !== FORMATO) err('formato', 'atteso "' + FORMATO + '"');
    if (obj.versioneFormato !== VERSIONE_FORMATO) err('versioneFormato', 'versione ' + JSON.stringify(obj.versioneFormato) + ' non supportata (attesa ' + VERSIONE_FORMATO + ')');
    if (!obj.progetto || typeof obj.progetto !== 'object') err('progetto', 'mancante');
    else for (const k of ['titolo', 'sito', 'autore', 'note']) if (obj.progetto[k] !== undefined && typeof obj.progetto[k] !== 'string') err('progetto.' + k, 'deve essere testo');
    if (!Array.isArray(obj.prove)) err('prove', 'deve essere un elenco');
    if (!Array.isArray(obj.scenari)) err('scenari', 'deve essere un elenco');
    if (errori.length) return { ok: false, errori };

    const idProve = new Set();
    obj.prove.forEach((p, i) => {
      const c = 'prove[' + i + ']';
      if (!p || typeof p !== 'object') { err(c, 'non è un oggetto'); return; }
      if (typeof p.id !== 'string' || !p.id) err(c + '.id', 'mancante');
      else if (idProve.has(p.id)) err(c + '.id', 'ripetuto');
      else idProve.add(p.id);
      if (typeof p.nome !== 'string') err(c + '.nome', 'deve essere testo');
      if (!TIPI_PROVA[p.tipo]) { err(c + '.tipo', 'tipo non riconosciuto: ' + JSON.stringify(p.tipo)); return; }
      if (!Array.isArray(p.colonne)) { err(c + '.colonne', 'deve essere un elenco'); return; }
      for (const col of TIPI_PROVA[p.tipo].colonne) if (!p.colonne.includes(col)) err(c + '.colonne', 'manca la colonna ' + col);
      for (const col of p.colonne) {
        if (!UNITA[col]) { err(c + '.colonne', 'colonna non riconosciuta: ' + col); continue; }
        const u = p.unita && p.unita[col];
        if (u !== undefined && UNITA[col].fattori[u] === undefined) err(c + '.unita.' + col, 'unità non ammessa: ' + JSON.stringify(u));
      }
      if (!Array.isArray(p.dati)) { err(c + '.dati', 'deve essere un elenco'); return; }
      p.dati.forEach((r, k) => {
        if (!Array.isArray(r) || r.length !== p.colonne.length) { err(c + '.dati[' + k + ']', 'numero di valori diverso dalle colonne'); return; }
        r.forEach((v, j) => { if (v !== null && !isNum(v)) err(c + '.dati[' + k + '][' + j + ']', 'deve essere un numero o null'); });
      });
      if (p.parametri !== undefined && (p.parametri === null || typeof p.parametri !== 'object')) err(c + '.parametri', 'deve essere un oggetto');
    });
    obj.scenari.forEach((s, i) => {
      const c = 'scenari[' + i + ']';
      if (!s || typeof s !== 'object') { err(c, 'non è un oggetto'); return; }
      if (typeof s.id !== 'string' || !s.id) err(c + '.id', 'mancante');
      if (!idProve.has(s.provaId)) err(c + '.provaId', 'non corrisponde a nessuna prova');
      const prova = obj.prove.find(p => p && p.id === s.provaId);
      if (prova && TIPI_PROVA[prova.tipo] && !METODI_PER_TIPO[prova.tipo].includes(s.metodo)) err(c + '.metodo', 'metodo ' + JSON.stringify(s.metodo) + ' non compatibile con la prova ' + prova.tipo);
      for (const k of ['Mw', 'amax', 'zFalda']) if (s[k] !== null && s[k] !== undefined && !isNum(s[k])) err(c + '.' + k, 'deve essere un numero o null');
      if (!Array.isArray(s.strati)) err(c + '.strati', 'deve essere un elenco');
      else s.strati.forEach((st, k) => {
        for (const kk of ['da', 'a', 'gamma', 'gammaSat']) if (!isNum(st && st[kk])) err(c + '.strati[' + k + '].' + kk, 'deve essere un numero');
        if (st && st.FC !== null && st.FC !== undefined && !isNum(st.FC)) err(c + '.strati[' + k + '].FC', 'deve essere un numero o null');
      });
      if (s.opzioni !== undefined && (s.opzioni === null || typeof s.opzioni !== 'object')) err(c + '.opzioni', 'deve essere un oggetto');
      if (s.esclusione !== undefined) {
        const e = s.esclusione;
        if (e === null || typeof e !== 'object' || Array.isArray(e)) err(c + '.esclusione', 'deve essere un oggetto');
        else {
          if (e.faldaMediaStagionale !== null && e.faldaMediaStagionale !== undefined && !isNum(e.faldaMediaStagionale)) err(c + '.esclusione.faldaMediaStagionale', 'deve essere un numero o null');
          if (e.strati !== undefined && !Array.isArray(e.strati)) err(c + '.esclusione.strati', 'deve essere un elenco');
          else (e.strati || []).forEach((x, k) => {
            if (!x || !isNum(x.da) || !isNum(x.a)) err(c + '.esclusione.strati[' + k + ']', 'servono da e a numerici');
            else if (x.curva !== undefined && x.curva !== null && !Array.isArray(x.curva)) err(c + '.esclusione.strati[' + k + '].curva', 'deve essere un elenco [d, p]');
          });
        }
      }
    });
    if (obj.risultati !== undefined && (obj.risultati === null || typeof obj.risultati !== 'object' || Array.isArray(obj.risultati))) err('risultati', 'deve essere un oggetto');
    return { ok: errori.length === 0, errori };
  }

  /**
   * Apre un progetto da testo JSON. I risultati salvati nel file vengono conservati ma
   * marcati con origine 'file': l'interfaccia li tratta come non aggiornati fino al ricalcolo.
   */
  function apriProgetto(testo) {
    let obj;
    try { obj = JSON.parse(testo); } catch (e) { return { ok: false, errori: [{ campo: 'file', motivo: 'JSON non valido: ' + e.message }] }; }
    const v = validaProgetto(obj);
    if (!v.ok) return v;
    obj.risultati = obj.risultati || {};
    for (const k of Object.keys(obj.risultati)) obj.risultati[k].origine = 'file';
    if (!obj.prove.some(p => p.id === obj.provaAttiva)) obj.provaAttiva = obj.prove[0] ? obj.prove[0].id : null;
    if (!obj.scenari.some(s => s.id === obj.scenarioAttivo)) obj.scenarioAttivo = obj.scenari[0] ? obj.scenari[0].id : null;
    for (const s of obj.scenari) {
      s.opzioni = Object.assign({ Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: FS_RIFERIMENTO }, s.opzioni || {});
      s.esclusione = Object.assign(esclusioneVuota(), s.esclusione || {});
    }
    for (const p of obj.prove) p.parametri = Object.assign(parametriPredefiniti(p.tipo), p.parametri || {});
    return { ok: true, errori: [], progetto: obj };
  }

  function salvaProgetto(progetto) {
    return JSON.stringify(progetto, null, 2);
  }

  return {
    VERSIONE_APP, FORMATO, VERSIONE_FORMATO, FS_RIFERIMENTO, TIPI_PROVA, METODI_PER_TIPO, NOMI_METODI, UNITA, ETICHETTE_COLONNE, COLORI_SCENARI,
    nuovoId, nuovaProva, nuovoScenario, esclusioneVuota, nuovoProgetto, duplicaScenario, copia,
    datiInterni, firmaInput, validaProgetto, apriProgetto, salvaProgetto, parametriPredefiniti, unitaPredefinite
  };
});
