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
 *   progetto: { titolo, sito, lat, lon, noteZS9, autore, note },   // lat, lon: gradi decimali WGS84 o null
 *   prove: [Prova], scenari: [Scenario], provaAttiva, scenarioAttivo,
 *   risultati: { [scenarioId]: Risultato }        // solo in memoria: non salvato né ricaricato
 * }
 * Prova: { id, nome, tipo: 'CPTE'|'CPTU'|'SPT'|'VS', provenienza, esempio (bool),
 *          unita: { z, qc?, fs?, u2? }, colonne: [...], dati: [[numero|null, …]],
 *          parametri: { CE, CB, CS, sporgenza, senzaRivestimento, ar } (secondo il tipo) }
 * Scenario: { id, nome, colore, provaId, metodo, Mw, amax, zFalda,
 *             strati: [{ id, da, a, gamma, gammaSat, FC|null, descrizione }],   // id stabile, non entra nel calcolo
 *             opzioni: { Vs12, IcSoglia, CFC, FSrif }, note,
 *             magnitudo: { origine: 'zs9'|'manuale', motivazione } }   // vedi app/magnitudo.js
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
  const VERSIONE_APP = '1.0.0';

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

  /** Origine della Mw dello scenario: proposta dalle zone ZS9 o inserimento manuale (app/magnitudo.js). */
  const ORIGINI_MW = ['zs9', 'manuale'];
  function magnitudoVuota() { return { origine: 'manuale', motivazione: '' }; }

  function nuovoScenario(prova, nome, indice = 0) {
    return {
      id: nuovoId('scen'), nome: nome || 'Scenario ' + (indice + 1), colore: COLORI_SCENARI[indice % COLORI_SCENARI.length],
      provaId: prova ? prova.id : null, metodo: prova ? METODI_PER_TIPO[prova.tipo][0] : null,
      Mw: null, amax: null, zFalda: null,
      strati: [], opzioni: { Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: FS_RIFERIMENTO }, note: '',
      esclusione: esclusioneVuota(), magnitudo: magnitudoVuota()
    };
  }

  function nuovoProgetto() {
    return {
      formato: FORMATO, versioneFormato: VERSIONE_FORMATO,
      progetto: { titolo: '', sito: '', lat: null, lon: null, noteZS9: '', autore: '', note: '' },
      prove: [], scenari: [], provaAttiva: null, scenarioAttivo: null, risultati: {}
    };
  }

  /**
   * Identificativo stabile degli strati e collegamento dei dati della verifica preliminare (audit B4.3).
   * Le voci di scenario.esclusione.strati si collegano allo strato con stratoId: cambiare le quote
   * di uno strato non separa più curva granulometrica, campione e giudizio del geologo.
   * - strati senza id (file precedenti, esempio): id nuovo, messo per primo nell'oggetto;
   * - voci senza stratoId (file precedenti): collegate una sola volta allo strato con le stesse quote
   *   da–a, come avveniva prima; quelle senza strato corrispondente restano come sono.
   * Modifica e restituisce lo scenario.
   */
  function allineaStrati(scenario) {
    if (!scenario || !Array.isArray(scenario.strati)) return scenario;
    const usati = new Set();
    scenario.strati = scenario.strati.map(st => {
      if (typeof st.id === 'string' && RE_ID.test(st.id) && !usati.has(st.id)) { usati.add(st.id); return st; }
      const { id, ...resto } = st;
      const nuovo = { id: nuovoId('strato'), ...resto };
      usati.add(nuovo.id);
      return nuovo;
    });
    const voci = scenario.esclusione && Array.isArray(scenario.esclusione.strati) ? scenario.esclusione.strati : [];
    const collegati = new Set(voci.filter(v => v && v.stratoId).map(v => v.stratoId));
    for (const v of voci) {
      if (!v || v.stratoId) continue;
      const st = scenario.strati.find(x => !collegati.has(x.id) && Math.abs(x.da - v.da) < 1e-6 && Math.abs(x.a - v.a) < 1e-6);
      if (st) { v.stratoId = st.id; collegati.add(st.id); }
    }
    return scenario;
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

  /** Strati senza l'identificativo, che non entra nel calcolo: a parità di input l'identificativo non cambia la firma. */
  function stratiCalcolo(strati) {
    return Array.isArray(strati) ? strati.map(st => { if (!st || typeof st !== 'object') return st; const { id, ...resto } = st; return resto; }) : strati;
  }

  /** Firma degli input da cui dipende un risultato: cambia se cambia qualunque input del calcolo. */
  function firmaInput(prova, scenario, versioneMotore) {
    const s = JSON.stringify({ v: versioneMotore, p: { tipo: prova.tipo, unita: prova.unita, colonne: prova.colonne, dati: prova.dati, parametri: prova.parametri },
      s: { metodo: scenario.metodo, Mw: scenario.Mw, amax: scenario.amax, zFalda: scenario.zFalda, strati: stratiCalcolo(scenario.strati), opzioni: opzioniCalcolo(scenario.opzioni), provaId: scenario.provaId } });
    return sha256(s);
  }

  /**
   * SHA-256 (FIPS 180-4) di una stringa, in forma sincrona e senza dipendenze: restituisce 64 cifre
   * esadecimali. Il testo è codificato in UTF-8. È la funzione di impronta delle firme di calcolo e del
   * rapporto; non è un sigillo di autenticità (chiunque può ricalcolarla).
   */
  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(testo) {
    const dati = new TextEncoder().encode(String(testo));
    const n = dati.length, tot = ((n + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(tot); m.set(dati); m[n] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(tot - 8, Math.floor(n / 0x20000000)); dv.setUint32(tot - 4, (n << 3) >>> 0);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    const rotd = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < tot; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + 4 * i);
      for (let i = 16; i < 64; i++) {
        const s0 = rotd(w[i - 15], 7) ^ rotd(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotd(w[i - 2], 17) ^ rotd(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rotd(e, 6) ^ rotd(e, 11) ^ rotd(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
        const t2 = ((rotd(a, 2) ^ rotd(a, 13) ^ rotd(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    return Array.from(h, x => x.toString(16).padStart(8, '0')).join('');
  }

  /** Forma abbreviata di una firma per i margini di stampa e il piè di pagina: le prime 16 cifre (64 bit). Il CSV riporta la firma intera. */
  function firmaBreve(f) { return typeof f === 'string' ? f.slice(0, 16) : f; }

  /**
   * Firma del rapporto (audit 13.a): distinta dalla firma di calcolo, che non cambia con FS di
   * riferimento e Verifica preliminare perché non cambiano i risultati. Comprende la firma di calcolo,
   * il FS di riferimento, i dati della Verifica preliminare e le versioni dei moduli (motore, indici,
   * cedimenti, ZS9): se uno di questi cambia, cambia il contenuto stampato.
   * versioni: { motore, indici, cedimenti, zs9 } (stringhe).
   */
  function firmaRapporto(prova, scenario, versioni) {
    const v = versioni || {};
    return sha256(JSON.stringify({ c: firmaInput(prova, scenario, v.motore), fsRif: scenario.opzioni ? scenario.opzioni.FSrif : null,
      esclusione: scenario.esclusione || null, v: { motore: v.motore || null, indici: v.indici || null, cedimenti: v.cedimenti || null, zs9: v.zs9 || null } }));
  }

  // ---------------------------------------------------------------------------
  // Validazione di un file di progetto
  // ---------------------------------------------------------------------------
  // Il file è un dato non attendibile: ogni campo è controllato per tipo, i valori enumerati
  // sono confrontati solo con le chiavi proprie delle tabelle (niente proprietà ereditate) e il
  // progetto viene ricostruito con i soli campi noti. I risultati salvati non vengono ricaricati:
  // si ricalcolano dagli input.

  const proprio = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
  const isOggetto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const RE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
  const RE_COLORE = /^#[0-9A-Fa-f]{6}$/;
  const DECISIONI_4 = ['soddisfatto', 'non soddisfatto'];
  /** Parametri della prova ammessi per tipo: n = numero o null, b = booleano. */
  const PARAMETRI_TIPO = Object.freeze({
    SPT: { CE: 'n', CB: 'n', CS: 'n', sporgenza: 'n', senzaRivestimento: 'b' },
    CPTU: { ar: 'n' }, CPTE: {}, VS: {}
  });
  const OPZIONI_SCENARIO = ['Vs12', 'IcSoglia', 'CFC', 'FSrif'];

  /**
   * Controlla un oggetto progetto e, se è valido, ne restituisce una copia normalizzata.
   * Esito: { ok, errori: [{ campo, motivo }], progetto?, avvisi: [testo] }. Non lancia eccezioni.
   */
  function validaProgetto(obj) {
    const errori = [], avvisi = [];
    const err = (campo, motivo) => errori.push({ campo, motivo });
    const testo = (v, campo, obbligatorio) => {
      if (v === undefined || v === null) { if (obbligatorio) err(campo, 'mancante'); return ''; }
      if (typeof v !== 'string') { err(campo, 'deve essere testo'); return ''; }
      return v;
    };
    const numONull = (v, campo) => {
      if (v === undefined || v === null) return null;
      if (!isNum(v)) { err(campo, 'deve essere un numero o vuoto, trovato ' + descrivi(v)); return null; }
      return v;
    };
    const numero = (v, campo) => { if (!isNum(v)) { err(campo, 'deve essere un numero, trovato ' + descrivi(v)); return NaN; } return v; };
    // D3: esclusione motivata dello strato. Le chiavi si scrivono solo se presenti: i file precedenti restano identici
    // (strato non escluso, stessa firma degli input).
    const CRITERI_STRATO = ['criterio4', 'substrato_lapideo', 'coesivo', 'altro'];
    const esclusioneMotivataStrato = (st, cs) => {
      const o = {};
      if (st.escluso_motivatamente !== undefined) {
        if (typeof st.escluso_motivatamente === 'boolean') o.escluso_motivatamente = st.escluso_motivatamente;
        else err(cs + '.escluso_motivatamente', 'deve essere vero o falso');
      }
      if (st.criterio !== undefined && st.criterio !== null) {
        if (typeof st.criterio === 'string' && CRITERI_STRATO.includes(st.criterio)) o.criterio = st.criterio;
        else err(cs + '.criterio', 'criterio non ammesso (' + CRITERI_STRATO.join(', ') + ')');
      }
      if (st.motivazione !== undefined && st.motivazione !== null) {
        if (typeof st.motivazione === 'string') o.motivazione = st.motivazione;
        else err(cs + '.motivazione', 'deve essere un testo');
      }
      return o;
    };
    const boolONull = (v, campo) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== 'boolean') { err(campo, 'deve essere sì/no (true/false), trovato ' + descrivi(v)); return null; }
      return v;
    };
    const id = (v, campo) => {
      if (typeof v !== 'string' || !RE_ID.test(v)) { err(campo, 'identificativo mancante o non valido (lettere, cifre, - _ . :, max 64 caratteri)'); return null; }
      return v;
    };

    if (!isOggetto(obj)) { err('file', 'non è un oggetto JSON'); return { ok: false, errori, avvisi }; }
    if (obj.formato !== FORMATO) err('formato', 'atteso "' + FORMATO + '"');
    if (obj.versioneFormato !== VERSIONE_FORMATO) err('versioneFormato', 'versione ' + descrivi(obj.versioneFormato) + ' non supportata (attesa ' + VERSIONE_FORMATO + ')');
    if (!isOggetto(obj.progetto)) err('progetto', 'mancante o non è un oggetto');
    if (!Array.isArray(obj.prove)) err('prove', 'deve essere un elenco');
    if (!Array.isArray(obj.scenari)) err('scenari', 'deve essere un elenco');
    if (errori.length) return { ok: false, errori, avvisi };

    const out = nuovoProgetto();
    for (const k of ['titolo', 'sito', 'noteZS9', 'autore', 'note']) out.progetto[k] = testo(obj.progetto[k], 'progetto.' + k, false);
    // Coordinate del sito: numeri o vuote. L'intervallo è controllato dall'app (app/magnitudo.js) e
    // segnalato come errore, senza sostituire il valore (come per il FS di riferimento).
    out.progetto.lat = numONull(obj.progetto.lat, 'progetto.lat');
    out.progetto.lon = numONull(obj.progetto.lon, 'progetto.lon');

    const idProve = new Set();
    obj.prove.forEach((p, i) => {
      const c = 'prove[' + i + ']';
      if (!isOggetto(p)) { err(c, 'non è un oggetto'); return; }
      const pid = id(p.id, c + '.id');
      if (pid !== null && idProve.has(pid)) err(c + '.id', 'ripetuto: ' + pid);
      if (pid !== null) idProve.add(pid);
      const nome = testo(p.nome, c + '.nome', true);
      if (!proprio(TIPI_PROVA, p.tipo)) { err(c + '.tipo', 'tipo non riconosciuto: ' + descrivi(p.tipo) + ' (ammessi ' + Object.keys(TIPI_PROVA).join(', ') + ')'); return; }
      const tipo = p.tipo, def = TIPI_PROVA[tipo];
      const ammesse = def.colonne.concat(def.facoltative);
      if (!Array.isArray(p.colonne)) { err(c + '.colonne', 'deve essere un elenco'); return; }
      const colonne = [];
      for (const col of p.colonne) {
        if (!ammesse.includes(col)) { err(c + '.colonne', 'colonna non ammessa per ' + tipo + ': ' + descrivi(col)); continue; }
        if (colonne.includes(col)) { err(c + '.colonne', 'colonna ripetuta: ' + col); continue; }
        colonne.push(col);
      }
      for (const col of def.colonne) if (!colonne.includes(col)) err(c + '.colonne', 'manca la colonna ' + col);
      if (colonne.length !== p.colonne.length) return;
      // Unità: obbligatorie dove esiste più di un'unità ammessa (nessuna conversione sottintesa).
      if (p.unita !== undefined && !isOggetto(p.unita)) { err(c + '.unita', 'deve essere un oggetto'); return; }
      const unita = { z: 'm', FC: '%' };
      for (const col of colonne) {
        const fattori = UNITA[col].fattori, scelte = Object.keys(fattori);
        const u = p.unita ? p.unita[col] : undefined;
        if (u === undefined || u === null) {
          if (scelte.length > 1) err(c + '.unita.' + col, 'unità mancante per la colonna ' + col + ' (ammesse ' + scelte.join(', ') + ')');
          else unita[col] = scelte[0];
        } else if (!proprio(fattori, u)) err(c + '.unita.' + col, 'unità non ammessa: ' + descrivi(u) + ' (ammesse ' + scelte.join(', ') + ')');
        else unita[col] = u;
      }
      if (!Array.isArray(p.dati)) { err(c + '.dati', 'deve essere un elenco'); return; }
      const dati = [];
      p.dati.forEach((r, k) => {
        if (!Array.isArray(r) || r.length !== colonne.length) { err(c + '.dati[' + k + ']', 'numero di valori diverso dalle colonne'); return; }
        dati.push(r.map((v, j) => { if (v !== null && !isNum(v)) { err(c + '.dati[' + k + '][' + j + ']', 'deve essere un numero o null'); return null; } return v; }));
      });
      // Profondità obbligatoria e crescente, come nell'importazione (app/importa.js): nessun riordino in silenzio.
      const iz = colonne.indexOf('z');
      dati.forEach((r, k) => {
        if (r.length !== colonne.length) return;
        if (r[iz] === null) err(c + '.dati[' + k + '][' + iz + ']', 'profondità mancante');
        else if (k > 0 && dati[k - 1].length === colonne.length && dati[k - 1][iz] !== null && !(r[iz] > dati[k - 1][iz]))
          err(c + '.dati[' + k + '][' + iz + ']', 'profondità non crescente (' + r[iz] + ' dopo ' + dati[k - 1][iz] + ')');
      });
      if (p.parametri !== undefined && !isOggetto(p.parametri)) { err(c + '.parametri', 'deve essere un oggetto'); return; }
      const parametri = parametriPredefiniti(tipo);
      for (const [k, t] of Object.entries(PARAMETRI_TIPO[tipo])) {
        if (!p.parametri || !proprio(p.parametri, k)) continue;
        parametri[k] = t === 'b' ? (boolONull(p.parametri[k], c + '.parametri.' + k) ?? false) : numONull(p.parametri[k], c + '.parametri.' + k);
      }
      out.prove.push({ id: pid, nome, tipo, provenienza: testo(p.provenienza, c + '.provenienza', false),
        esempio: boolONull(p.esempio, c + '.esempio') === true, unita, colonne, dati, parametri });
    });

    const idScenari = new Set();
    obj.scenari.forEach((s, i) => {
      const c = 'scenari[' + i + ']';
      if (!isOggetto(s)) { err(c, 'non è un oggetto'); return; }
      const sid = id(s.id, c + '.id');
      if (sid !== null && idScenari.has(sid)) err(c + '.id', 'ripetuto: ' + sid);
      if (sid !== null) idScenari.add(sid);
      const nome = testo(s.nome, c + '.nome', true);
      let colore = COLORI_SCENARI[i % COLORI_SCENARI.length];
      if (s.colore !== undefined && s.colore !== null) {
        if (typeof s.colore !== 'string' || !RE_COLORE.test(s.colore)) err(c + '.colore', 'colore non valido (atteso #RRGGBB)');
        else colore = s.colore;
      }
      if (typeof s.provaId !== 'string' || !idProve.has(s.provaId)) err(c + '.provaId', 'non corrisponde a nessuna prova');
      const prova = out.prove.find(p => p.id === s.provaId);
      if (!proprio(NOMI_METODI, s.metodo)) err(c + '.metodo', 'metodo non riconosciuto: ' + descrivi(s.metodo));
      else if (prova && !METODI_PER_TIPO[prova.tipo].includes(s.metodo)) err(c + '.metodo', 'metodo ' + s.metodo + ' non compatibile con la prova ' + prova.tipo);
      const strati = [];
      if (!Array.isArray(s.strati)) err(c + '.strati', 'deve essere un elenco');
      else s.strati.forEach((st, k) => {
        const cs = c + '.strati[' + k + ']';
        if (!isOggetto(st)) { err(cs, 'non è un oggetto'); return; }
        const sid = st.id === undefined || st.id === null ? null : id(st.id, cs + '.id');
        if (sid !== null && strati.some(x => x.id === sid)) err(cs + '.id', 'identificativo dello strato ripetuto: ' + sid);
        strati.push({ ...(sid !== null ? { id: sid } : {}), da: numero(st.da, cs + '.da'), a: numero(st.a, cs + '.a'), gamma: numero(st.gamma, cs + '.gamma'), gammaSat: numero(st.gammaSat, cs + '.gammaSat'),
          FC: numONull(st.FC, cs + '.FC'), descrizione: testo(st.descrizione, cs + '.descrizione', false),
          ...esclusioneMotivataStrato(st, cs) });
      });
      if (s.opzioni !== undefined && !isOggetto(s.opzioni)) err(c + '.opzioni', 'deve essere un oggetto');
      const opzioni = { Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: FS_RIFERIMENTO };
      for (const k of OPZIONI_SCENARIO) if (isOggetto(s.opzioni) && proprio(s.opzioni, k)) opzioni[k] = numONull(s.opzioni[k], c + '.opzioni.' + k);
      const esclusione = esclusioneVuota();
      if (s.esclusione !== undefined && s.esclusione !== null) {
        const e = s.esclusione, ce = c + '.esclusione';
        if (!isOggetto(e)) err(ce, 'deve essere un oggetto');
        else {
          esclusione.faldaMediaStagionale = numONull(e.faldaMediaStagionale, ce + '.faldaMediaStagionale');
          esclusione.pcSubOrizzontale = boolONull(e.pcSubOrizzontale, ce + '.pcSubOrizzontale');
          esclusione.fondazioniSuperficiali = boolONull(e.fondazioniSuperficiali, ce + '.fondazioniSuperficiali');
          if (e.strati !== undefined && !Array.isArray(e.strati)) err(ce + '.strati', 'deve essere un elenco');
          else (e.strati || []).forEach((x, k) => {
            const cx = ce + '.strati[' + k + ']';
            if (!isOggetto(x)) { err(cx, 'non è un oggetto'); return; }
            let curva = null;
            if (x.curva !== undefined && x.curva !== null) {
              if (!Array.isArray(x.curva) || !x.curva.every(q => Array.isArray(q) && q.length === 2 && isNum(q[0]) && isNum(q[1]))) err(cx + '.curva', 'deve essere un elenco di coppie numeriche [d, p]');
              else curva = x.curva.map(q => [q[0], q[1]]);
            }
            let decisione4 = null;
            if (x.decisione4 !== undefined && x.decisione4 !== null) {
              if (!DECISIONI_4.includes(x.decisione4)) err(cx + '.decisione4', 'valore non ammesso: ' + descrivi(x.decisione4));
              else decisione4 = x.decisione4;
            }
            const stratoId = x.stratoId === undefined || x.stratoId === null ? null : id(x.stratoId, cx + '.stratoId');
            if (stratoId !== null && esclusione.strati.some(v => v.stratoId === stratoId)) err(cx + '.stratoId', 'più voci per lo stesso strato: ' + stratoId);
            esclusione.strati.push({ ...(stratoId !== null ? { stratoId } : {}), da: numero(x.da, cx + '.da'), a: numero(x.a, cx + '.a'), sabbiaPulita: boolONull(x.sabbiaPulita, cx + '.sabbiaPulita'),
              curva, campione: testo(x.campione, cx + '.campione', false), decisione4, motivazione4: testo(x.motivazione4, cx + '.motivazione4', false) });
          });
        }
      }
      // Origine della Mw: assente nei file precedenti alla 0.3.0, dove la Mw era sempre inserita a mano.
      const magnitudo = magnitudoVuota();
      if (s.magnitudo !== undefined && s.magnitudo !== null) {
        const m = s.magnitudo, cm = c + '.magnitudo';
        if (!isOggetto(m)) err(cm, 'deve essere un oggetto');
        else {
          if (m.origine !== undefined && m.origine !== null) {
            if (!ORIGINI_MW.includes(m.origine)) err(cm + '.origine', 'valore non ammesso: ' + descrivi(m.origine) + ' (ammessi ' + ORIGINI_MW.join(', ') + ')');
            else magnitudo.origine = m.origine;
          }
          magnitudo.motivazione = testo(m.motivazione, cm + '.motivazione', false);
        }
      }
      out.scenari.push(allineaStrati({ id: sid, nome, colore, provaId: s.provaId, metodo: s.metodo,
        Mw: numONull(s.Mw, c + '.Mw'), amax: numONull(s.amax, c + '.amax'), zFalda: numONull(s.zFalda, c + '.zFalda'),
        strati, opzioni, note: testo(s.note, c + '.note', false), esclusione, magnitudo }));
    });

    if (errori.length) return { ok: false, errori, avvisi };
    out.provaAttiva = out.prove.some(p => p.id === obj.provaAttiva) ? obj.provaAttiva : (out.prove[0] ? out.prove[0].id : null);
    out.scenarioAttivo = out.scenari.some(s => s.id === obj.scenarioAttivo) ? obj.scenarioAttivo : (out.scenari[0] ? out.scenari[0].id : null);
    if (obj.risultati !== undefined && obj.risultati !== null && !(isOggetto(obj.risultati) && Object.keys(obj.risultati).length === 0))
      avvisi.push('I risultati salvati nel file non sono stati ricaricati: premere «Calcola» per ricalcolarli dagli input.');
    return { ok: true, errori, avvisi, progetto: out };
  }

  /** Descrizione breve e sicura di un valore per i messaggi di errore. */
  function descrivi(v) {
    if (v === undefined) return 'nessun valore';
    if (v === null) return 'null';
    if (typeof v === 'string') return '"' + (v.length > 40 ? v.slice(0, 40) + '…' : v) + '"';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return Array.isArray(v) ? 'un elenco' : 'un oggetto';
  }

  /** Apre un progetto da testo JSON. Non modifica nulla se il file non è valido; non lancia eccezioni. */
  function apriProgetto(testo) {
    let obj;
    try { obj = JSON.parse(testo); } catch (e) { return { ok: false, avvisi: [], errori: [{ campo: 'file', motivo: 'JSON non valido: ' + e.message }] }; }
    try { return validaProgetto(obj); }
    catch (e) { return { ok: false, avvisi: [], errori: [{ campo: 'file', motivo: 'struttura non leggibile (' + e.message + ')' }] }; }
  }

  /** Il file salvato contiene solo gli input: i risultati si ricalcolano all'apertura. */
  function salvaProgetto(progetto) {
    const { risultati, ...input } = progetto;
    return JSON.stringify(input, null, 2);
  }

  return {
    VERSIONE_APP, FORMATO, VERSIONE_FORMATO, FS_RIFERIMENTO, TIPI_PROVA, METODI_PER_TIPO, NOMI_METODI, UNITA, ETICHETTE_COLONNE, COLORI_SCENARI,
    nuovoId, nuovaProva, nuovoScenario, allineaStrati, esclusioneVuota, magnitudoVuota, ORIGINI_MW, nuovoProgetto, duplicaScenario, copia,
    datiInterni, firmaInput, firmaRapporto, firmaBreve, sha256, validaProgetto, apriProgetto, salvaProgetto, parametriPredefiniti, unitaPredefinite
  };
});
