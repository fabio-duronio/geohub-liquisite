/*
 * GeoHub-LiquiSite — magnitudo di riferimento Mw: proposta dalle zone ZS9
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Livello applicativo, nessuna formula: zona, distanze, Ms_i e Mw proposta vengono dal modulo
 * moduli/zs9.js (v1.2.0, copiato da GeoHub-SismaSite senza modifiche). Qui ci sono solo:
 *  - il controllo delle coordinate del sito inserite nel progetto (gradi decimali, WGS84);
 *  - la lettura dell'esito del modulo per interfaccia e stampa;
 *  - le regole dell'app sulla Mw dello scenario: proposta ZS9 o inserimento manuale, motivazione
 *    sempre obbligatoria (decisione del 21/11/2026), avvisi sotto 5 e sotto 5,5.
 *
 * Le coordinate non entrano nel calcolo del FS se non attraverso la Mw adottata nello scenario.
 *
 * Dati dello scenario: scenario.magnitudo = { origine: 'zs9' | 'manuale', motivazione: testo }.
 * Dati del progetto:   progetto.progetto.lat, .lon (gradi decimali o null), .noteZS9 (testo).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiquiMagnitudo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const num = (v, cifre = 2) => isNum(v) ? v.toFixed(cifre).replace('.', ',') : '–';

  /** Versione del modulo ZS9 con cui è stato verificato questo livello applicativo. */
  const VERSIONE_ZS9 = '1.2.0';
  const ORIGINI = Object.freeze(['zs9', 'manuale']);
  const ETICHETTE_ORIGINE = Object.freeze({ zs9: 'proposta dalle zone ZS9 (coordinate del sito)', manuale: 'inserimento manuale' });

  /** Soglie degli avvisi (valori delle fonti, non formule). */
  const SOGLIE = Object.freeze({
    lineeGuidaLQ: 5,   // Linee guida LQ v1.0, §2.1, pag. 7–8: condizione C3, Mw ≥ 5
    cetin2018: 5.5     // Cetin et al. 2018, SDEE, Eq. 15: campo di KMw 5,5–8,4
  });

  /** Tolleranza nel confronto tra Mw adottata e proposta (i valori della Tab. A1.1 hanno due decimali). */
  const TOLL_MW = 1e-9;

  const TESTI = Object.freeze({
    natura: 'La Mw entra nel calcolo del metodo scelto (coefficiente rd e fattore di scala della magnitudo). Le coordinate del sito non entrano nel calcolo del FS se non attraverso la Mw adottata.',
    fonte: 'Mw,max per zona: Linee guida LQ v1.0 (Commissione tecnica per la microzonazione sismica, 2018), Tab. A1.1, pag. 31 – CC BY 4.0. Zone sismogenetiche: ZS9, Meletti et al. (2004), INGV, doi:10.13127/sh/zs9 – CC BY 4.0.',
    criterio: 'Criterio adottato: interpretazione della regola delle Linee guida LQ, pag. 30. Sito interno a una zona: Mw = Mw,max della zona. Sito esterno: distanza minima R_i da tutte le 36 zone, Ms_i = 1 + 3·log10(R_i), Mw = massima M_i fra le sole zone con Ms_i < M_i; se nessuna zona soddisfa la condizione serve la disaggregazione, che LiquiSite non calcola. Sul confine comune di più zone vale la Mw,max più alta (scelta prudenziale). Criteri applicativi di GeoHub, non trascrizione letterale delle Linee guida.',
    datum: 'Datum dello shapefile ZS9 non dichiarato (manca il file .prj): le coordinate delle zone sono usate senza trasformazione. Se il datum originario fosse ED50, lo scarto rispetto alle coordinate WGS84 del sito sarebbe di circa 100 m: trascurabile alla scala delle zone, da considerare per i siti vicini a un confine.',
    avvertenza: 'Datum dello shapefile ZS9 non dichiarato: l\'appartenenza del sito a una zona, o la sua distanza dalle zone, è un risultato geometrico indicativo, non una determinazione esatta.',
    criticita: [
      'le zone ZS9 sono molto estese e in alcuni settori della penisola la Mw può risultare sovrastimata;',
      'per i siti esterni alle zone (per esempio nelle aree costiere) la disaggregazione può portare a una sottostima;',
      'dei risultati della disaggregazione si usa di norma il valore medio, senza una giustificazione tecnico-scientifica formale.'
    ],
    criticitaFonte: 'Criticità dichiarate dalle Linee guida LQ v1.0, pag. 31–32',
    disaggregazione: 'La disaggregazione della pericolosità sismica non è calcolata da LiquiSite: la Mw va inserita a mano, con la fonte (per esempio disaggregazione INGV, nodo e probabilità di superamento).'
  });

  // ---------------------------------------------------------------------------
  // Coordinate del sito
  // ---------------------------------------------------------------------------

  /**
   * Controllo delle coordinate inserite: presenza, numero, intervallo.
   * Ordine lat/lon e punti fuori dall'Italia sono riconosciuti dal modulo ZS9 (esito 'fuori_dominio').
   * Esito: { stato: 'vuote' | 'incomplete' | 'non_valide' | 'valide', errori: [{ campo, motivo }] }
   */
  function statoCoordinate(lat, lon) {
    const errori = [];
    const assente = (v) => v === null || v === undefined;
    if (assente(lat) && assente(lon)) return { stato: 'vuote', errori };
    const controlla = (v, campo, nome, lim) => {
      if (assente(v)) errori.push({ campo, motivo: nome + ' mancante: servono latitudine e longitudine' });
      else if (!isNum(v)) errori.push({ campo, motivo: nome + ' non valida: inserire gradi decimali (es. 42,3498), non gradi-primi-secondi' });
      else if (Math.abs(v) > lim) errori.push({ campo, motivo: nome + ' fuori intervallo: deve essere compresa tra −' + lim + '° e ' + lim + '°' });
    };
    controlla(lat, 'lat', 'Latitudine', 90);
    controlla(lon, 'lon', 'Longitudine', 180);
    if (!errori.length) return { stato: 'valide', errori };
    return { stato: errori.some(e => /mancante/.test(e.motivo)) && errori.length === 1 ? 'incomplete' : 'non_valide', errori };
  }

  // ---------------------------------------------------------------------------
  // Proposta dal modulo ZS9
  // ---------------------------------------------------------------------------

  /**
   * Mw proposta per le coordinate del progetto.
   * ZS9: modulo moduli/zs9.js; dati: contenuto di dati/zs9-data.json.
   * Esito: { disponibile, mw, esito, titolo, motivo, coordinate, zs9 }
   *  - disponibile: true solo se il modulo restituisce una Mw;
   *  - esito: 'coordinate' (coordinate assenti o non valide) oppure l'esito del modulo;
   *  - zs9: risultato completo del modulo (tabella, avvisi, testi, fonti) o null.
   */
  function proposta(progetto, ZS9, dati) {
    const p = (progetto && progetto.progetto) || {};
    const coordinate = statoCoordinate(p.lat, p.lon);
    const base = { disponibile: false, mw: null, esito: 'coordinate', titolo: '', motivo: '', coordinate, zs9: null };
    if (coordinate.stato === 'vuote') return { ...base, titolo: 'Coordinate del sito non inserite', motivo: 'coordinate del sito non inserite' };
    if (coordinate.stato !== 'valide') return { ...base, titolo: 'Coordinate del sito da correggere', motivo: coordinate.errori.map(e => e.motivo).join('; ') };
    if (!ZS9 || typeof ZS9.valuta !== 'function' || !dati) return { ...base, esito: 'modulo_assente', titolo: 'Modulo ZS9 non disponibile', motivo: 'modulo ZS9 o dati delle zone non caricati' };
    let r;
    try { r = ZS9.valuta(p.lat, p.lon, dati); }
    catch (e) { return { ...base, esito: 'modulo_assente', titolo: 'Dati ZS9 non validi', motivo: e.message }; }
    const out = { ...base, esito: r.esito, zs9: r, mw: isNum(r.mw) ? r.mw : null, disponibile: isNum(r.mw) };
    const zone = (l) => l.join(', ');
    switch (r.esito) {
      case 'dentro_zona':
        out.titolo = 'Sito interno alla zona ' + r.zona + ' (' + r.area_mw + '): Mw = ' + num(r.mw);
        break;
      case 'confine_comune':
        out.titolo = 'Sito sul confine comune delle zone ' + zone(r.zone_contenenti) + ': Mw = ' + num(r.mw) + ', la più alta (zona ' + zone(r.zone_mw) + ')';
        break;
      case 'fuori_zona':
        out.titolo = 'Sito esterno alle zone ZS9 (la più vicina è la ' + r.tabella[0].zona + ' a ' + num(r.tabella[0].r_km) + ' km): Mw = ' + num(r.mw) + ', massima M_i fra le zone con Ms_i < M_i (zona ' + zone(r.zone_mw) + ')';
        break;
      case 'disaggregazione_richiesta':
        out.titolo = 'Sito esterno alle zone ZS9: nessuna zona soddisfa Ms_i < M_i, disaggregazione richiesta';
        out.motivo = 'nessuna zona soddisfa Ms_i < M_i: serve la disaggregazione, che LiquiSite non calcola';
        break;
      case 'fuori_dominio':
        out.titolo = 'Punto fuori dal territorio coperto dalla zonazione ZS9';
        out.motivo = r.avvisi.map(a => a.testo).join(' ');
        break;
      default:
        out.titolo = 'Coordinate non valide per il modulo ZS9';
        out.motivo = r.avvisi.map(a => a.testo).join(' ');
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Mw dello scenario
  // ---------------------------------------------------------------------------

  /** Dati della magnitudo dello scenario, con i valori predefiniti per i file precedenti. */
  function datiMagnitudo(scenario) {
    const m = (scenario && scenario.magnitudo) || {};
    return { origine: ORIGINI.includes(m.origine) ? m.origine : 'manuale', motivazione: typeof m.motivazione === 'string' ? m.motivazione : '' };
  }

  /** La Mw adottata è diversa dalla proposta disponibile? */
  function diversaDallaProposta(scenario, prop) {
    return !!(prop && prop.disponibile && scenario && isNum(scenario.Mw) && Math.abs(scenario.Mw - prop.mw) > TOLL_MW);
  }

  /**
   * Stato della Mw di uno scenario rispetto alla proposta.
   * Esito: { origine, proposta, diversa, motivazioneRichiesta, errori: [{ campo, motivo }], avvisi: [{ codice, testo }] }
   * Gli errori bloccano stampa ed esportazione CSV (come il FS di riferimento non valido); il calcolo
   * resta possibile perché la Mw inserita è comunque un numero valido per il motore.
   */
  function statoMagnitudo(scenario, prop) {
    const d = datiMagnitudo(scenario);
    const errori = [], avvisi = [];
    const diversa = diversaDallaProposta(scenario, prop);
    if (d.origine === 'zs9' && !(prop && prop.disponibile)) {
      errori.push({ campo: 'magnitudo.origine', motivo: 'Proposta ZS9 non disponibile' + (prop && prop.motivo ? ' (' + prop.motivo + ')' : '') + ': inserire coordinate valide del sito oppure scegliere l\'inserimento manuale.' });
    }
    // Motivazione sempre obbligatoria (decisione del 21/11/2026), anche se la Mw coincide con la proposta
    if (!d.motivazione.trim()) {
      errori.push({ campo: 'magnitudo.motivazione', motivo: 'Motivazione della Mw mancante: è obbligatoria' + (diversa ? ' (Mw ' + num(scenario.Mw) + ' diversa dalla proposta ZS9, ' + num(prop.mw) + ')' : '') + '.' });
    }
    const mw = scenario ? scenario.Mw : null;
    if (isNum(mw) && mw < SOGLIE.lineeGuidaLQ) {
      avvisi.push({ codice: 'MW_SOTTO_5', testo: 'Mw < 5: fuori dalle condizioni delle Linee guida LQ (condizione C3, Mw ≥ 5, §2.1, pag. 7–8), riferite alla microzonazione. Le NTC 2018 non hanno un criterio sulla magnitudo (§7.11.3.4.2): l\'avviso non esclude la verifica.' });
    }
    if (isNum(mw) && mw < SOGLIE.cetin2018) {
      avvisi.push({ codice: 'MW_SOTTO_5_5', testo: 'Mw < 5,5: fuori dal campo di Cetin et al. (2018), KMw valido per Mw 5,5–8,4 (Eq. 15).' });
    }
    return { origine: d.origine, proposta: prop && prop.disponibile ? prop.mw : null, diversa, motivazioneRichiesta: true, errori, avvisi };
  }

  /**
   * Applica la proposta allo scenario (origine ZS9, Mw = proposta). Non fa nulla se la proposta non
   * è disponibile. La motivazione già scritta resta.
   */
  function applicaProposta(scenario, prop) {
    if (!scenario || !prop || !prop.disponibile) return false;
    scenario.magnitudo = { ...datiMagnitudo(scenario), origine: 'zs9' };
    scenario.Mw = prop.mw;
    return true;
  }

  /**
   * Allinea gli scenari con origine ZS9 a una nuova proposta (coordinate cambiate): la Mw cambia
   * solo dove era uguale alla proposta precedente o vuota. Un valore scelto dal geologo resta.
   * Restituisce il numero di scenari modificati.
   */
  function allineaScenari(scenari, propPrima, propDopo) {
    let n = 0;
    const mwPrima = propPrima && propPrima.disponibile ? propPrima.mw : null;
    const mwDopo = propDopo && propDopo.disponibile ? propDopo.mw : null;
    for (const s of scenari || []) {
      if (datiMagnitudo(s).origine !== 'zs9') continue;
      const seguiva = s.Mw === null || s.Mw === undefined || (mwPrima !== null && isNum(s.Mw) && Math.abs(s.Mw - mwPrima) <= TOLL_MW);
      if (seguiva && s.Mw !== mwDopo) { s.Mw = mwDopo; n++; }
    }
    return n;
  }

  /** Testo breve sull'origine della Mw, per stampa, CSV e riepiloghi. */
  function testoOrigine(scenario, prop) {
    const d = datiMagnitudo(scenario);
    const st = statoMagnitudo(scenario, prop);
    let t = 'Mw ' + num(scenario.Mw) + ' – ' + ETICHETTE_ORIGINE[d.origine];
    if (prop && prop.disponibile) t += st.diversa ? '; diversa dalla proposta ZS9 (' + num(prop.mw) + ')' : (d.origine === 'zs9' ? '' : '; coincide con la proposta ZS9');
    else if (prop && prop.esito === 'disaggregazione_richiesta') t += '; proposta ZS9 non disponibile (disaggregazione richiesta)';
    if (d.motivazione.trim()) t += '. Motivazione: ' + d.motivazione.trim();
    return t;
  }

  return {
    VERSIONE_ZS9, ORIGINI, ETICHETTE_ORIGINE, SOGLIE, TESTI,
    statoCoordinate, proposta, datiMagnitudo, diversaDallaProposta, statoMagnitudo, applicaProposta, allineaScenari, testoOrigine
  };
});
