/*
 * GeoHub-LiquiSite — verifica preliminare: esclusione della verifica a liquefazione
 * (NTC 2018 §7.11.3.4.2; Circolare 21/01/2019 n. 7, C7.11.3.4).
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Raccoglie i dati dello scenario e i risultati del calcolo e chiama i criteri del motore
 * (criterio1–criterio4). Nessuna formula nuova. Regole di LiquiSite, dichiarate nei risultati:
 *  - basta un criterio soddisfatto (testo delle NTC); l'esito si scrive «verifica omessa ai
 *    sensi del §7.11.3.4.2», mai «terreno non liquefacibile»;
 *  - criteri 3 e 4 riguardano i depositi: si valutano per strato; lo strato è escluso solo se
 *    il geologo lo dichiara sabbia pulita e TUTTI i punti calcolati sotto falda superano la
 *    soglia (criterio 3), oppure se il geologo conferma la curva esterna ai fusi (criterio 4);
 *  - la verifica del sito è omessa con i criteri 3–4 solo se lo sono tutti gli strati che
 *    intersecano il tratto saturo fino a 20 m, e la stratigrafia lo descrive per intero;
 *  - l'esito non modifica i fattori di sicurezza calcolati.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../dati/fusi-ntc2018.json'));
  else root.LiquiEsclusione = factory(root.LiquiFusi);
})(typeof self !== 'undefined' ? self : this, function (FUSI) {
  'use strict';

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const Z_LIMITE = 20;
  const EPS = 1e-6;
  /**
   * Criteri di screening applicativi di LiquiSite (decisione D5 del 25/11/2026), non tolleranze né
   * prescrizioni delle NTC 2018. Distanza massima tra due prove consecutive, tra il tetto saturo dello
   * strato e la prima prova, tra l'ultima prova e il letto (m). Fissa: non dipende dal passo.
   */
  const TOLLERANZA_COPERTURA = Object.freeze({ SPT: 1.5, CPTE: 0.25, CPTU: 0.25 });
  /**
   * «Sabbia pulita»: FC massimo ammesso (%) e Ic massimo ammesso quando FC non è misurato. FC = 5 %
   * corrisponde a Ic = 1,775 con B&I 2014, Eq. 2.30 (FC = 80·(Ic + C_FC) − 137, C_FC = 0: valore
   * centrale della stima, l'incertezza di ±0,29 su Ic non è considerata). Scelte applicative.
   */
  const SABBIA_PULITA_MAX = Object.freeze({ FC: 5, Ic: 1.775 });

  /** Dati della verifica preliminare di uno scenario, con i valori predefiniti. */
  function datiEsclusione(scenario) {
    const e = scenario && scenario.esclusione && typeof scenario.esclusione === 'object' ? scenario.esclusione : {};
    return {
      faldaMediaStagionale: isNum(e.faldaMediaStagionale) ? e.faldaMediaStagionale : null,
      pcSubOrizzontale: typeof e.pcSubOrizzontale === 'boolean' ? e.pcSubOrizzontale : null,
      fondazioniSuperficiali: typeof e.fondazioniSuperficiali === 'boolean' ? e.fondazioniSuperficiali : null,
      strati: Array.isArray(e.strati) ? e.strati : []
    };
  }

  /**
   * Voce della verifica preliminare di uno strato: prima per id stabile (stratoId), così il cambio
   * delle quote non la separa; altrimenti, solo tra le voci senza stratoId (file precedenti non ancora
   * allineati, dati costruiti a mano), per quote da–a come nella versione 1.0.0. Una voce con stratoId
   * di uno strato eliminato non si riaggancia a uno strato nuovo con le stesse quote.
   */
  function voceStrato(voci, s) {
    const perId = s && typeof s.id === 'string' && s.id ? voci.find(x => x && x.stratoId === s.id) : null;
    return perId || voci.find(x => x && !x.stratoId && Math.abs(x.da - s.da) < EPS && Math.abs(x.a - s.a) < EPS) || null;
  }

  /** Dati della verifica preliminare di uno strato; vuoti se assenti. */
  function datiStrato(dati, s) {
    const v = voceStrato(dati.strati, s);
    return {
      sabbiaPulita: v && typeof v.sabbiaPulita === 'boolean' ? v.sabbiaPulita : null,
      curva: v && Array.isArray(v.curva) ? v.curva : null,
      campione: v && typeof v.campione === 'string' ? v.campione : '',
      decisione4: v && (v.decisione4 === 'soddisfatto' || v.decisione4 === 'non soddisfatto') ? v.decisione4 : null,
      motivazione4: v && typeof v.motivazione4 === 'string' ? v.motivazione4 : ''
    };
  }

  /** Crea o aggiorna la voce di uno strato nello scenario (usata dall'interfaccia). Le quote della voce seguono lo strato. */
  function aggiornaStrato(scenario, s, modifiche) {
    if (!scenario.esclusione || typeof scenario.esclusione !== 'object') scenario.esclusione = {};
    const e = scenario.esclusione;
    if (!Array.isArray(e.strati)) e.strati = [];
    let v = voceStrato(e.strati, s);
    if (!v) { v = s.id ? { stratoId: s.id, da: s.da, a: s.a } : { da: s.da, a: s.a }; e.strati.push(v); }
    Object.assign(v, modifiche, { da: s.da, a: s.a });
    if (s.id && !v.stratoId) v.stratoId = s.id; // voce trovata per quote: da ora collegata per id
    return v;
  }

  /** Grandezza del criterio 3 per metodo: la normalizzazione del metodo scelto. */
  const GRANDEZZA_C3 = { bi2014Cpt: 'qc1N', bi2014Spt: 'N160', cetin2018Spt: 'N160' };

  const fmtIt = (v, c = 1) => v.toFixed(c).replace('.', ',');

  function criterio3Strato(L, prova, scenario, risultato, s, ds) {
    const chiave = GRANDEZZA_C3[scenario.metodo];
    if (!chiave) return { stato: 'non_applicabile', soddisfatto: null, motivo: 'criterio definito per SPT e CPT: non si applica a questa prova' };
    if (!risultato || risultato.stato !== 'calcolato') return { stato: 'dati_insufficienti', soddisfatto: null, motivo: 'calcolo non eseguito' };
    const zDa = Math.max(s.da, scenario.zFalda), zA = Math.min(s.a, Z_LIMITE);
    const righe = risultato.righe.filter(r => isNum(r.z) && r.z >= s.da - EPS && r.z < s.a - EPS && r.z > scenario.zFalda + EPS && r.z <= Z_LIMITE + EPS);
    if (zA <= zDa) return { stato: 'non_pertinente', soddisfatto: null, motivo: 'strato sopra la falda di verifica o oltre 20 m' };
    if (!righe.length) return { stato: 'dati_insufficienti', soddisfatto: null, motivo: 'nessun punto della prova nello strato saturo' };
    // copertura (D5): tolleranza fissa per tipo di prova; basta un intervallo oltre tolleranza
    // (strettamente maggiore) perché il criterio 3 non sia soddisfatto per lo strato. Gli estremi sono
    // il tratto saturo dello strato (da max(tetto, falda) a min(letto, 20 m)).
    const tol = TOLLERANZA_COPERTURA[prova.tipo] !== undefined ? TOLLERANZA_COPERTURA[prova.tipo] : TOLLERANZA_COPERTURA.SPT;
    const zsS = righe.map(r => r.z).sort((x, y) => x - y);
    const trattiScoperti = [];
    const intervallo = (da, a) => { if (a - da > tol + EPS) trattiScoperti.push({ da, a }); };
    intervallo(zDa, zsS[0]);
    for (let i = 1; i < zsS.length; i++) intervallo(zsS[i - 1], zsS[i]);
    intervallo(zsS[zsS.length - 1], zA);
    const lacuna = trattiScoperti.length > 0;
    // anche i punti oltre il campo per addensamento hanno la resistenza normalizzata (audit B1)
    const valori = righe.map(r => ((r.stato === 'calcolato' || r.codice === 'OLTRE_CAMPO_ADDENSAMENTO') && r.valori && isNum(r.valori[chiave])) ? r.valori[chiave] : null);
    const mancanti = valori.filter(v => v === null).length;
    // punti senza valore perché Ic supera la soglia (metodo non applicabile), distinti dai dati mancanti
    const conIcOltre = righe.filter((r, i) => valori[i] === null && r.codice === 'IC_OLTRE_SOGLIA').length;
    const noti = valori.filter(v => v !== null);
    const tipo = prova.tipo === 'SPT' ? 'SPT' : prova.tipo;
    const soglia = L.SOGLIE_CRITERIO3 ? L.SOGLIE_CRITERIO3[tipo].soglia : (tipo === 'SPT' ? 30 : 180);
    const grandezza = tipo === 'SPT' ? '(N1)60' : 'qc1N';
    const minimo = noti.length ? Math.min(...noti) : null;
    const sopra = noti.filter(v => v > soglia).length;
    const base = { grandezza, soglia, punti: righe.length, mancanti, conIcOltre, sopraSoglia: sopra, minimo, sabbiaPulita: ds.sabbiaPulita };
    if (ds.sabbiaPulita === null) return { ...base, stato: 'dati_insufficienti', soddisfatto: null, motivo: 'indicare se lo strato è costituito da sabbie pulite' };
    if (ds.sabbiaPulita === false) return { ...base, stato: 'valutato', soddisfatto: false, motivo: 'lo strato non è dichiarato sabbia pulita' };
    // «sabbia pulita» contraddetta dai dati (D5): nessuna deroga, vale per ogni punto saturo dello strato.
    // FC noto (dato della prova o della stratigrafia): FC > 5 %. FC non noto, solo CPT: Ic > 1,775.
    const fcNoti = righe.map(r => isNum(r.FC) ? r.FC : null);
    const icPunti = righe.map(r => (r.valori && isNum(r.valori.Ic)) ? r.valori.Ic : (r.sbt && isNum(r.sbt.Ic) ? r.sbt.Ic : null));
    const viola = righe.map((r, i) => fcNoti[i] !== null ? fcNoti[i] > SABBIA_PULITA_MAX.FC : (prova.tipo !== 'SPT' && icPunti[i] !== null && icPunti[i] > SABBIA_PULITA_MAX.Ic));
    const nViola = viola.filter(Boolean).length;
    const fcMax = Math.max(...fcNoti.filter(v => v !== null), -Infinity), icMax = Math.max(...icPunti.filter((v, i) => v !== null && fcNoti[i] === null), -Infinity);
    const contraddizione = nViola ? {
      punti: nViola, fcMax: fcMax === -Infinity ? null : fcMax, icMax: icMax === -Infinity ? null : icMax,
      messaggio: 'La dichiarazione «sabbia pulita» è contraddetta dai dati (' + [
        fcMax > SABBIA_PULITA_MAX.FC ? 'FC fino a ' + fmtIt(fcMax) + ' % > ' + SABBIA_PULITA_MAX.FC + ' %' : '',
        icMax > SABBIA_PULITA_MAX.Ic ? 'Ic fino a ' + fmtIt(icMax, 3) + ' > ' + fmtIt(SABBIA_PULITA_MAX.Ic, 3) + ', FC ≈ 5 % da B&I 2014, Eq. 2.30' : ''
      ].filter(Boolean).join('; ') + ', in ' + nViola + (nViola === 1 ? ' punto' : ' punti') + ' saturi): criterio 3 non soddisfatto, senza deroga. Se la parte pulita è distinta, dividere lo strato. Criterio di screening di LiquiSite, non una prescrizione delle NTC.'
    } : null;
    if (lacuna || contraddizione) return { ...base, stato: 'valutato', soddisfatto: false, tolleranza: tol, trattiScoperti, contraddizione,
      motivo: [
        lacuna ? 'prove non sufficienti a descrivere il tratto saturo dello strato (' + zDa.toFixed(2).replace('.', ',') + '–' + zA.toFixed(2).replace('.', ',') + ' m): ' + trattiScoperti.length + (trattiScoperti.length === 1 ? ' tratto' : ' tratti') + ' con distanza tra prove oltre ' + fmtIt(tol, 2) + ' m (' + trattiScoperti.map(t => fmtIt(t.da, 2) + '–' + fmtIt(t.a, 2) + ' m').join(', ') + '), non considerati sicuri; tolleranza fissa di LiquiSite, non una prescrizione delle NTC' : '',
        contraddizione ? contraddizione.messaggio : ''
      ].filter(Boolean).join(' · ') };
    if (mancanti) return { ...base, stato: 'dati_insufficienti', soddisfatto: null, motivo: [
      conIcOltre ? conIcOltre + (conIcOltre === 1 ? ' punto' : ' punti') + ' con Ic oltre la soglia (comportamento non da sabbia pulita)' : '',
      mancanti - conIcOltre ? (mancanti - conIcOltre) + (mancanti - conIcOltre === 1 ? ' punto' : ' punti') + ' senza ' + grandezza + ' calcolato' : ''
    ].filter(Boolean).join(' e ') + ': lo strato non è descritto per intero come sabbia pulita' };
    // ogni punto passa dal criterio del motore: stessa regola e stessi avvisi
    const esiti = noti.map(v => L.criterio3(tipo, v, true));
    const soddisfatto = esiti.every(x => x.soddisfatto === true);
    const deboli = esiti.filter(x => (x.avvisi || []).some(a => a.codice === 'MARGINE_DEBOLE')).length;
    return { ...base, stato: 'valutato', soddisfatto, deboli,
      motivo: soddisfatto ? 'tutti i ' + noti.length + ' punti oltre la soglia' + (deboli ? ' (' + deboli + ' con margine inferiore al 10 %)' : '')
        : (noti.length - sopra) + (noti.length - sopra === 1 ? ' punto' : ' punti') + ' su ' + noti.length + ' non ' + (noti.length - sopra === 1 ? 'supera' : 'superano') + ' la soglia' };
  }

  function criterio4Strato(L, ds) {
    if (!ds.curva || ds.curva.length === 0) return { stato: 'dati_insufficienti', soddisfatto: null, proposta: 'nessuna proposta', motivo: 'nessuna curva granulometrica' };
    const c = L.criterio4(ds.curva, FUSI);
    const base = { motore: c, proposta: c.proposta, decisione: ds.decisione4, motivazione: ds.motivazione4 };
    if (c.stato === 'input_non_valido') return { ...base, stato: 'input_non_valido', soddisfatto: null, motivo: (c.errori || []).map(e => e.motivo).join('; ') };
    if (!ds.decisione4) return { ...base, stato: 'da_confermare', soddisfatto: null, motivo: 'proposta: ' + c.proposta + ' — da confermare dal geologo' };
    const diverge = ds.decisione4 !== c.proposta;
    if (diverge && !ds.motivazione4.trim()) return { ...base, stato: 'da_confermare', soddisfatto: null, motivo: 'scelta diversa dalla proposta: serve la motivazione' };
    return { ...base, stato: 'valutato', soddisfatto: ds.decisione4 === 'soddisfatto',
      motivo: (ds.decisione4 === 'soddisfatto' ? 'curva esterna ai fusi' : 'curva non esterna ai fusi') + (diverge ? ' (scelta motivata del geologo)' : ' (proposta confermata)') };
  }

  /**
   * Valutazione completa per uno scenario.
   * Restituisce { criteri: {c1, c2}, strati: [...], esito: { codice, titolo, testo }, conteggi, note }.
   */
  function valutaEsclusione(L, prova, scenario, risultato) {
    const dati = datiEsclusione(scenario);
    const c1 = isNum(scenario.amax) ? L.criterio1(scenario.amax) : { criterio: 1, stato: 'dati_insufficienti', soddisfatto: null };
    const c2 = (dati.faldaMediaStagionale !== null && dati.pcSubOrizzontale !== null && dati.fondazioniSuperficiali !== null)
      ? L.criterio2(dati.faldaMediaStagionale, dati.pcSubOrizzontale, dati.fondazioniSuperficiali)
      : { criterio: 2, stato: 'dati_insufficienti', soddisfatto: null,
        motivo: 'indicare falda media stagionale, piano campagna sub-orizzontale e tipo di fondazioni' };

    const zF = isNum(scenario.zFalda) ? scenario.zFalda : 0;
    const strati = (scenario.strati || []).filter(s => isNum(s.da) && isNum(s.a)).map((s, i) => {
      const ds = datiStrato(dati, s);
      const pertinente = s.a > zF + EPS && s.da < Z_LIMITE - EPS;
      const c3 = criterio3Strato(L, prova, scenario, risultato, s, ds);
      const c4 = criterio4Strato(L, ds);
      let esito;
      if (!pertinente) esito = 'non_pertinente';
      else if (c3.soddisfatto === true || c4.soddisfatto === true) esito = 'escluso';
      else if (c3.soddisfatto === false && c4.soddisfatto === false) esito = 'non_escluso';
      else esito = 'non_dimostrato';
      return { indice: i, da: s.da, a: s.a, descrizione: s.descrizione || '', pertinente, dati: ds, c3, c4, esito,
        criteriEscludenti: [c3.soddisfatto === true ? 3 : null, c4.soddisfatto === true ? 4 : null].filter(Boolean) };
    });

    // copertura del tratto saturo fino a 20 m da parte della stratigrafia
    const zA = Z_LIMITE;
    const pert = strati.filter(s => s.pertinente).sort((a, b) => a.da - b.da);
    let coperto = zF >= zA, cursore = zF;
    for (const s of pert) { if (s.da > cursore + EPS) break; cursore = Math.max(cursore, s.a); }
    coperto = coperto || cursore >= zA - EPS;

    const conteggi = {
      criteriSoddisfatti: [c1, c2].filter(c => c.soddisfatto === true).length,
      stratiPertinenti: pert.length,
      stratiEsclusi: pert.filter(s => s.esito === 'escluso').length,
      stratiNonEsclusi: pert.filter(s => s.esito === 'non_escluso').length,
      stratiNonDimostrati: pert.filter(s => s.esito === 'non_dimostrato').length
    };

    let esito;
    if (c1.soddisfatto === true) esito = { codice: 'omessa', criterio: 1, titolo: 'Verifica omessa ai sensi del §7.11.3.4.2, criterio 1',
      testo: 'amax attesa al piano campagna in campo libero minore di 0,1 g.' };
    else if (c2.soddisfatto === true) esito = { codice: 'omessa', criterio: 2, titolo: 'Verifica omessa ai sensi del §7.11.3.4.2, criterio 2',
      testo: 'Falda media stagionale oltre 15 m dal piano campagna, piano campagna sub-orizzontale, fondazioni superficiali.' };
    else if (pert.length && coperto && conteggi.stratiEsclusi === pert.length) esito = { codice: 'omessa', criterio: '3–4', titolo: 'Verifica omessa ai sensi del §7.11.3.4.2, criteri 3–4',
      testo: 'Tutti gli strati saturi entro 20 m soddisfano il criterio 3 o il criterio 4.' };
    else if (conteggi.stratiEsclusi) esito = { codice: 'parziale', titolo: 'Esclusione non dimostrata per il sito',
      testo: conteggi.stratiEsclusi + ' strati su ' + pert.length + ' soddisfano il criterio 3 o 4; per gli altri la verifica resta necessaria.' };
    else esito = { codice: 'non_dimostrata', titolo: 'Esclusione non dimostrata', testo: 'Nessun criterio consente di omettere la verifica.' };

    const trattiScoperti = strati.filter(x => x.pertinente && x.c3.trattiScoperti && x.c3.trattiScoperti.length)
      .flatMap(x => x.c3.trattiScoperti.map(t => ({ ...t, strato: x.da + '–' + x.a })));
    const note = [];
    if (trattiScoperti.length) note.push('Tratti saturi non coperti da prove (distanza oltre la tolleranza di ' + fmtIt(TOLLERANZA_COPERTURA[prova.tipo] !== undefined ? TOLLERANZA_COPERTURA[prova.tipo] : TOLLERANZA_COPERTURA.SPT, 2) + ' m, criterio di LiquiSite): ' + trattiScoperti.map(t => fmtIt(t.da, 2) + '–' + fmtIt(t.a, 2) + ' m').join(', ') + '. Non sono considerati sicuri.');
    if (c1.soddisfatto === false) note.push('amax ≥ 0,1 g: le indagini devono consentire di valutare gli altri tre criteri (Circolare 7/2019, C7.11.3.4).');
    if (!coperto && pert.length) note.push('La stratigrafia non descrive tutto il tratto saturo fino a 20 m: i criteri 3–4 non possono escludere l\'intero sito.');
    note.push('L\'esito della verifica preliminare non modifica i fattori di sicurezza calcolati.');
    return { criteri: { c1, c2 }, strati, esito, conteggi, coperto, trattiScoperti, note, falda: zF, zLimite: Z_LIMITE };
  }

  /** Testo «d [mm]; p [%]» per riga → curva [[d, p], …]; decimali con virgola o punto. */
  function leggiCurva(testo) {
    const righe = String(testo || '').split(/\r?\n/).map(r => r.trim()).filter(r => r !== '');
    const curva = [], errori = [];
    righe.forEach((r, i) => {
      const parti = r.split(/[;\t]|\s+/).filter(Boolean);
      if (parti.length !== 2) { errori.push('riga ' + (i + 1) + ': servono due valori, diametro e passante'); return; }
      const [d, p] = parti.map(x => Number(x.replace(',', '.')));
      if (!isNum(d) || !isNum(p)) { errori.push('riga ' + (i + 1) + ': valore non numerico'); return; }
      curva.push([d, p]);
    });
    return { curva, errori };
  }

  function testoCurva(curva) {
    return (curva || []).map(([d, p]) => String(d).replace('.', ',') + '; ' + String(p).replace('.', ',')).join('\n');
  }

  /** Testo dei tratti non coperti, per CSV e stampa; vuoto se non ce ne sono. */
  function testoTrattiScoperti(v) {
    return v && v.trattiScoperti && v.trattiScoperti.length
      ? 'Tratti saturi non coperti da prove, non considerati sicuri: ' + v.trattiScoperti.map(t => 'strato ' + fmtIt(Number(t.strato.split('–')[0]), 2) + '–' + fmtIt(Number(t.strato.split('–')[1]), 2) + ' m, tratto ' + fmtIt(t.da, 2) + '–' + fmtIt(t.a, 2) + ' m').join('; ') + '.' : '';
  }

  return { datiEsclusione, datiStrato, aggiornaStrato, valutaEsclusione, leggiCurva, testoCurva, testoTrattiScoperti, FUSI, Z_LIMITE, TOLLERANZA_COPERTURA, SABBIA_PULITA_MAX };
});
