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

   **Controllo di plausibilità delle unità.** Dopo la lettura, l'app confronta un valore tipico di ogni colonna (la mediana, o il massimo per u2, N e FC) con soglie operative, convertito nell'unità interna, e segnala con un avviso giallo le colonne fuori scala: per esempio qc con mediana oltre 100 MPa (probabili kPa dichiarati MPa) o sotto 0,05 MPa, fs sotto 0,5 kPa (probabili MPa), profondità massima oltre 100 m o sotto 1 m (cm/m scambiati), rapporto fs/qc mediano fuori da 0,05–15 % (unità di qc e fs scambiate fra loro), N oltre 100, Vs sotto 30 o oltre 3000 m/s, FC oltre 100 % o frazione 0–1. L'avviso compare al passaggio 2, accanto alla scelta delle unità, e al passaggio 3. Non blocca il salvataggio, non converte nulla e non entra nel file del progetto: le soglie sono convenzioni dell'app per riconoscere errori di unità, non limiti normativi né campi di validità dei metodi; un caso atipico reale può far scattare l'avviso. Con meno di 3 valori utili non si giudica.
3. **Progetto**: titolo, sito e, facoltative, le coordinate del sito in gradi decimali WGS84. Servono solo alla proposta di M_w (vedi sotto): non entrano nel calcolo del FS se non attraverso la M_w adottata. L'app segnala coordinate mancanti, non numeriche (per esempio in gradi-primi-secondi), fuori intervallo, invertite o fuori dall'Italia.
4. **Scenario**:
   - il metodo, compatibile con la prova;
   - la magnitudo M_w, proposta dalle zone ZS9 oppure inserita a mano (vedi «Magnitudo M_w»);
   - a_max in superficie [g], fornita dal geologo con la sua fonte;
   - le opzioni del metodo;
   - il FS di riferimento: con il campo vuoto vale 1,25 (EN 1998-5, §4.1.4); si può scegliere un valore tra 1 e 3. Un valore fuori intervallo o non numerico non viene sostituito: resta segnalato come errore, e stampa ed esportazione sono bloccate finché non viene corretto.
5. **Stratigrafia**: falda di verifica e strati, con γ, γ_sat, contenuto di fini FC (facoltativo) e descrizione.
6. **Calcola scenario**. Se un input di calcolo cambia, i risultati diventano «non aggiornati» fino al ricalcolo: lo segnalano un'etichetta, un velo sui grafici e un avviso nelle tabelle. Esportazione CSV e stampa richiedono risultati aggiornati.

I campi numerici accettano la virgola o il punto come separatore decimale, non i separatori delle migliaia.

## Magnitudo M_w

Con coordinate valide l'app propone la M_w dalla zonazione sismogenetica ZS9 (modulo `moduli/zs9.js` v1.2.0, lo stesso di GeoHub-SismaSite, copiato senza modifiche):

- **sito interno a una zona**: M_w = M_w,max della zona, dalla Tab. A1.1 delle Linee guida LQ v1.0 (pag. 31), che comprende le zone 923 e 927 (7,06);
- **sito sul confine comune di più zone**: la M_w,max più alta (scelta prudenziale);
- **sito esterno**: distanza minima R_i da tutte le 36 zone, M_s,i = 1 + 3·log₁₀R_i, M_w = massima M_i fra le sole zone con M_s,i < M_i. Il criterio è un'interpretazione della regola delle Linee guida LQ (pag. 30), decisa il 12/11/2026. La tabella completa (zona, R_i, M_s,i, M_i, esito), comprese le zone escluse, è nella scheda «Magnitudo M_w» e in stampa;
- **nessuna zona con M_s,i < M_i**: esito «disaggregazione richiesta». La disaggregazione non è calcolata dall'app: la M_w si inserisce a mano con la fonte.

Nello scenario si sceglie l'origine della M_w:

- **proposta dalle zone ZS9**: la M_w prende il valore proposto. Se cambiano le coordinate, la M_w segue la nuova proposta solo se era uguale alla precedente;
- **inserimento manuale**: il valore resta quello scritto. I progetti salvati con versioni precedenti si aprono così.

In entrambi i casi la M_w resta modificabile. La **motivazione è sempre obbligatoria**, anche quando la M_w coincide con la proposta (decisione del 21/11/2026): finché manca, stampa ed esportazione CSV sono bloccate (il calcolo resta possibile). La stampa riporta l'avvertenza: datum del file ZS9 non dichiarato, appartenenza alla zona geometrica e indicativa. Avvisi: M_w < 5, fuori dalle condizioni delle Linee guida LQ (riferite alla microzonazione; le NTC 2018 non hanno un criterio sulla magnitudo); M_w < 5,5, fuori dal campo di Cetin et al. (2018).

In «Progetto» un campo raccoglie le segnalazioni del geologo sulle distanze e sull'applicabilità del modello; compare in stampa.

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
  - metodi con basi di FS e P_L diverse, elencando solo quelle dei metodi presenti;
  - tra scenari della stessa prova, profondità calcolate in uno scenario e non nell'altro (per esempio per una falda diversa), con il nome dello scenario. Tra prove diverse le profondità non coincidono per costruzione e vale l'avviso sulle prove diverse.

  Nessun risultato viene scelto automaticamente.
- **Magnitudo M_w**: coordinate, esito della zonazione ZS9, origine della M_w dello scenario, tabella delle 36 zone per i siti esterni, avvisi di prossimità ai confini, fonte, criterio e limiti.
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
  1. dati e stratigrafia, con la sezione 1.1 sulla magnitudo M_w: coordinate, esito ZS9, M_w adottata e sua origine, motivazione, segnalazioni del geologo, tabella delle 36 zone per i siti esterni, fonte (Linee guida LQ Tab. A1.1; ZS9, Meletti et al. 2004, doi 10.13127/sh/zs9, CC BY 4.0), criterio, datum non dichiarato del file ZS9 e criticità dichiarate dalle Linee guida (pag. 31–32);
  2. verifica preliminare, con le curve granulometriche;
  3. riepilogo, con FS di riferimento, IL, cedimento, LSN e criterio di verifica;
  4. profili;
  5. carta di comportamento (CPT);
  6. avvisi, assunzioni e limiti.

  Con Chrome ed Edge ogni pagina ha un'intestazione (titolo, progetto e scenario) e un piè di pagina (versione dell'app e del motore, firma degli input, numero di pagina). Gli stessi dati, con data e ora del calcolo, chiudono il documento, anche nei browser che non supportano intestazioni e piè di pagina CSS. Non compaiono frasi del tipo «sito sicuro».
- **CSV** (separatore `;`, decimale `,`, UTF-8 con BOM).
  - Intestazione: progetto, prova, scenario, metodo, parametri, origine della M_w, FS di riferimento, esito della verifica preliminare, cedimento e LSN.
  - Righe: una per lettura, con dati convertiti, tensioni e grandezze a precisione piena.
  - Dati mancanti o non calcolati: cella vuota, mai zero. I testi che iniziano con `= + - @` sono preceduti da un apostrofo.
- **PNG** di ogni pannello (titolo, assi, unità, legenda, sfondo bianco).
- **JSON**: salvataggio e riapertura del progetto.
  - Il file contiene solo gli input: dopo l'apertura i risultati si ricalcolano con «Calcola».
  - Un file con dati non validi non viene aperto: l'app elenca gli errori e lascia invariato il progetto corrente.
  - Prima di sostituire un progetto con modifiche non salvate (Nuovo, Demo sintetica, Apri) l'app chiede conferma.
  - Le bozze di importazione restano in memoria solo durante la sessione.

## Limiti

- **Azione sismica.** a_max è inserita dall'utente. M_w è proposta dalle zone ZS9 a partire dalle coordinate del sito, oppure inserita a mano; la disaggregazione della pericolosità sismica non è calcolata.
- **Zonazione ZS9.** Il file delle zone non dichiara il datum: le coordinate sono usate senza trasformazione (scarto di circa 100 m se il datum originario fosse ED50). Le zone sono molto estese e in alcuni settori la M_w può risultare sovrastimata (Linee guida LQ, pag. 31–32).
- **Profondità e prove.**
  - Profondità massima di calcolo: 20 m dal piano campagna.
  - Una prova per scenario; il confronto tra prove è solo per profondità.
- **Prove non supportate nel calcolo**:
  - CPT a punta meccanica: i metodi sono calibrati su punta elettrica e piezocono;
  - prove DPSH: non esiste una conversione in SPT di validità generale.
- **Cedimento e LSN.** Solo con il metodo CPT, per piano campagna sub-orizzontale; nessuno spostamento laterale.
- **Indici.** IL e LSN sono riportati senza classi: il giudizio resta del progettista.
- **Dati e rete.** I dati delle prove e i calcoli restano nel browser: nessun dato del progetto viene inviato a server. La libreria dei grafici (Chart.js) e i caratteri (IBM Plex) sono inclusi nell'app, che non contatta servizi esterni. Una politica di sicurezza dei contenuti (CSP) ammette solo risorse della pagina stessa.
