# Uso e limiti dell'applicazione

Percorso: **prova → scenario → calcolo → verifica preliminare, profili e tabelle → confronto tra scenari → stampa ed esportazioni**.

[← Torna al README](../README.md)

## Uso

1. **Demo sintetica** carica un progetto di dati inventati: una successione alluvionale con una CPTU, un sondaggio con SPT e curve granulometriche, e tre scenari. È marcata come esempio ovunque, anche in stampa e nel CSV. Serve a provare il percorso, non a validare un sito.
2. **Prove**: «Nuova prova» o importazione in tre passaggi:
   1. *dati*: si incolla da foglio elettronico o si carica un CSV;
   2. *colonne e unità*: si scelgono separatori, prima riga, associazione delle colonne e unità;
   3. *controllo e salvataggio*.

   Le celle vuote diventano dati mancanti. Bloccano l'importazione, con l'indicazione di riga e colonna: le celle non numeriche, le profondità non crescenti e i numeri ambigui (punto con decimale virgola). La guida spiega sigle e colonne per ogni tipo di prova e offre un modello vuoto.
3. **Scenario**:
   - il metodo, compatibile con la prova;
   - M_w e a_max in superficie [g], forniti dal geologo con la loro fonte;
   - le opzioni del metodo;
   - il FS di riferimento: predefinito 1,25 (EN 1998-5, §4.1.4), modificabile tra 1 e 3.
4. **Stratigrafia**: falda di verifica e strati, con γ, γ_sat, contenuto di fini FC (facoltativo) e descrizione.
5. **Calcola scenario**. Se un input di calcolo cambia, i risultati diventano «non aggiornati» fino al ricalcolo: lo segnalano un'etichetta, un velo sui grafici e un avviso nelle tabelle. Esportazione CSV e stampa richiedono risultati aggiornati.

I campi numerici accettano la virgola o il punto come separatore decimale, non i separatori delle migliaia.

## Risultati

- **Verifica preliminare** (§7.11.3.4.2). Mostra l'albero dei quattro criteri e il dettaglio per strato.
  - Criterio 1: confronto di a_max con 0,1 g.
  - Criterio 2: falda media stagionale, piano campagna sub-orizzontale e fondazioni superficiali.
  - Criterio 3: vale solo per gli strati dichiarati «sabbia pulita». Lo strato è escluso se tutti i punti calcolati sotto falda superano la soglia, con la normalizzazione del metodo scelto e senza lacune di indagine.
  - Criterio 4: la curva granulometrica è disegnata sui fusi della Fig. 7.11.1. L'app propone l'esito, il geologo lo conferma o lo corregge (la motivazione è obbligatoria se diverge dalla proposta).

  La verifica del sito è omessa con i criteri 3 e 4 solo se lo sono tutti gli strati saturi entro 20 m e la stratigrafia descrive l'intero tratto. L'esito non modifica i fattori di sicurezza calcolati.
- **Profili**: tavole preimpostate.
  - *Verifica*: Ic, resistenza normalizzata, CSR/CRR, FS.
  - *Dati e interpretazione*.
  - *Tensioni e coefficienti*.
  - *FS, PL e IL*.
  - *Cedimenti e LSN*: FS, deformazione volumetrica, cedimento cumulato.

  Per le CPT c'è anche la carta di comportamento del terreno (Q–F, zone 2–7 da Ic secondo Robertson & Wride 1998). Le tavole si possono personalizzare. Un clic su un punto seleziona la stessa profondità in tutti i pannelli e nella tabella.
- **Tabelle**: tutte le grandezze, riga per riga, con stato, motivo e lettura del FS rispetto a 1 e al FS di riferimento.
- **Confronto**: fino a 3 scenari, anche su prove diverse (confronto per profondità dal piano campagna). L'app segnala:
  - scenari non aggiornati;
  - metodi con basi di FS e P_L diverse;
  - cambiamenti del dominio dei punti calcolati.

  Nessun risultato viene scelto automaticamente.
- **Avvisi e assunzioni**: avvisi del metodo e dell'app, valori assunti, criterio di scelta del FS e assunzioni di IL, cedimento e LSN.

## Elaborazione del profilo

Ogni lettura della prova segue queste regole:

- **profondità mancante o non valida** → riga non valida;
- **dato richiesto mancante** (per esempio f_s o N) → dati insufficienti, il metodo non viene applicato;
- **profondità oltre la stratigrafia** → dati insufficienti;
- **punto sopra falda** → metodo non applicabile (terreno non saturo);
- **CPT con Ic oltre la soglia** (2,6 predefinita) → metodo non applicabile al punto. Non è un'esclusione ai sensi del §7.11.3.4.2;
- **contenuto di fini FC**, nell'ordine:
  1. dato della prova («misurato»);
  2. FC dello strato («assegnato dalla stratigrafia»);
  3. regola del metodo: stima da Ic per la CPT; 0 con avviso per V_s; dato obbligatorio per le SPT.

Le profondità non indagate non generano righe: il riepilogo distingue profondità indagata ed estensione analizzata. Un intervallo non calcolato non è mai trattato come sicuro.

## Grafici

- **Disposizione**: profondità crescente verso il basso, stessa scala in tutti i pannelli; falda tratteggiata in blu, limiti degli strati in grigio.
- **CPT e V_s**: linee interrotte su righe non calcolate, dati mancanti e vuoti maggiori di 3 volte il passo mediano.
- **SPT**: punti discreti, mai uniti.
- **CSR e CRR**: sono entrambe a condizioni di sito. Le grandezze normalizzate a M 7,5 e 1 atm sono solo in tabella.
- **Asse FS** da 0 a 3, con FS = 1 come riferimento del modello e linea e fascia del FS di riferimento. I valori oltre la scala non sono modificati: sono contati nella nota del pannello e visibili in tabella.
- **Nessuno smoothing.** Le campiture sono riferimenti grafici, non classi normative o giudizi di sicurezza.

## Stampa ed esportazioni

- **Stampa A4 verticale** (HTML → PDF), con intestazione «GeoHub-LiquiSite – Verifica a liquefazione». Le sezioni sono:
  1. dati e stratigrafia;
  2. verifica preliminare, con le curve granulometriche;
  3. riepilogo, con FS di riferimento, IL, cedimento, LSN e criterio di verifica;
  4. profili;
  5. carta di comportamento (CPT);
  6. avvisi, assunzioni e limiti.

  In fondo a ogni pagina sono riportate la versione dell'app e del motore e la firma degli input. Non compaiono frasi del tipo «sito sicuro».
- **CSV** (separatore `;`, decimale `,`, UTF-8 con BOM).
  - Intestazione: progetto, prova, scenario, metodo, parametri, FS di riferimento, esito della verifica preliminare, cedimento e LSN.
  - Righe: una per lettura, con dati convertiti, tensioni e grandezze a precisione piena.
  - Dati mancanti o non calcolati: cella vuota, mai zero. I testi che iniziano con `= + - @` sono preceduti da un apostrofo.
- **PNG** di ogni pannello (titolo, assi, unità, legenda, sfondo bianco).
- **JSON**: salvataggio e riapertura del progetto. Le bozze di importazione restano in memoria solo durante la sessione.

## Limiti

- **Azione sismica.** a_max e M_w sono inserite dall'utente: l'app non ha un modulo di pericolosità.
- **Profondità e prove.**
  - Profondità massima di calcolo: 20 m dal piano campagna.
  - Una prova per scenario; il confronto tra prove è solo per profondità.
- **Prove non supportate nel calcolo**:
  - CPT a punta meccanica: i metodi sono calibrati su punta elettrica e piezocono;
  - prove DPSH: non esiste una conversione in SPT di validità generale.
- **Cedimento e LSN.** Solo con il metodo CPT, per piano campagna sub-orizzontale; nessuno spostamento laterale.
- **Indici.** IL e LSN sono riportati senza classi: il giudizio resta del progettista.
- **Rete.** Chart.js e i caratteri sono caricati da CDN: senza rete l'app non funziona.
