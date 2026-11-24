# Changelog

La versione dell'app e quella del motore di calcolo sono distinte: l'app è indicata in alto e nel piè di pagina della stampa insieme al motore.

## Non rilasciata — correzioni dall'audit pre-rilascio (onda 1)

Correzioni di robustezza (classe A del mandato del 24/11/2026): nessuna formula cambia. Motore di innesco (0.3.0), modulo IL (0.2.1) e modulo cedimenti (0.2.0) invariati: FS, IL e cedimento non cambiano. Verifica dei rilievi in `docs/audit-liquisite-1.0.0.md`.

- **Stampa** (rilievi B6.1–B6.3): stampando dal browser (Ctrl+P / Cmd+P o menu) il rapporto si prepara ogni volta (`beforeprint`); prima la pagina era bianca. Con risultati assenti, non aggiornati o con dati da correggere (FS di riferimento, motivazione della Mw) si stampa un foglio «STAMPA NON VALIDA» con il motivo, mai il rapporto. Il rapporto si svuota dopo ogni stampa (`afterprint`), a ogni modifica degli input e a ogni ricalcolo: prima restava in pagina quello dell'ultima stampa e Ctrl+P poteva stampare risultati vecchi. Le tavole dei profili sono sempre le stesse per metodo (verifica, PL, IL e, con CPT, cedimenti), qualunque pannello sia aperto a video; il pulsante «Stampa / PDF» non cambia più scheda. Nuovo controllo nel browser `verifiche/browser/verifica_stampa.mjs` (23 controlli); `verifiche/esegui.mjs --browser` esegue tutti i file `verifiche/browser/verifica_*.mjs`; `npm run test:browser` (usato dal workflow) li esegue tutti con `--solo-browser`.
- **Bozza automatica e avviso in uscita** (rilievo B7): con modifiche non salvate in un file, chiudere o ricaricare la pagina chiede conferma; gli input del progetto (mai i risultati) si copiano nella memoria locale del browser e alla riapertura un riquadro propone di ripristinarli o eliminarli. La bozza passa dalla stessa validazione di un file, si cancella quando il progetto è salvato e non viene sovrascritta finché non si sceglie. Una scheda cancella solo la bozza scritta da lei. Nessun invio in rete. Nuovo controllo nel browser `verifiche/browser/verifica_bozza.mjs` (28 controlli).

## App 1.0.0 — 2026-11-22

Prima versione stabile. Comprende tutto quanto rilasciato fino alla 0.4.2; nessuna funzione nuova. Chiude i punti rimasti incerti con le decisioni di Fabio del 22/11/2026. Motore di innesco invariato (0.3.0): FS, IL e cedimento non cambiano. Formato del file di progetto invariato: i progetti salvati con le versioni precedenti si aprono.

- **Indice LSN tolto**: non è più calcolato né mostrato (riepilogo, tavola, tabelle, stampa, CSV). La definizione originale (van Ballegooy et al. 2014) non è stata letta. Modulo cedimenti 0.2.0: resta il cedimento post-sismico di Zhang et al. (2002). La tavola «Cedimenti e LSN» si chiama ora «Cedimenti»; `docs/cedimenti-lsn.md` diventa `docs/cedimenti.md`.
- **Indice IL, fonte**: si cita Iwasaki, Tokida e Tatsuoka (1981), Eq. 5, pag. 210, letta per intero, con la formula identica in Tatsuoka et al. (1980), Eq. 29a. L'indice è stato proposto dagli stessi autori nel 1978. Modulo IL 0.2.1 (solo il testo della fonte).
- **Cedimento di Zhang et al. (2002)**: chiuso. Equazioni implementate come pubblicate; convenzioni (interpolazione in FS, (qc1N)cs ricondotto a 33–200, tratti non indagati come intervallo) decise e dichiarate.
- **Limiti dei metodi** descritti in `docs/app.md` (Limiti): incertezza di r_d oltre circa 10 m e sensibilità dell'IL alla soglia di Ic, entrambe già segnalate dagli avvisi dell'app; motivazione dell'assenza di classi per l'IL.
- **Documentazione**: prova d'uso del 22/11/2026 in `docs/validazione.md` (10 CPT dell'Emilia 2012, Geyin & Maurer 2021); README senza LSN.
- **Verifiche**: 1067 controlli JavaScript, 3 confronti Python, 54 controlli nel browser.

## App 0.4.2 — 2026-11-22

Correzioni emerse dalla prova d'uso su casi reali (CPT dell'Emilia 2012): punto a profondità 0, controllo di plausibilità delle unità e riconoscimento delle unità nelle intestazioni all'importazione. Motore di innesco (0.3.0), modulo IL (0.2.0) e modulo cedimenti (0.1.1) invariati: FS, IL, cedimenti e LSN non cambiano. La 0.4.1 (PR #17) non è stata pubblicata come rilascio a sé: è compresa nella 0.4.2. Parametri ?v= di `index.html` portati a 0.4.2.

- **Punto a profondità 0**: una riga con z = 0 (piano campagna) compariva come «input non valido», perché il motore richiede tensioni maggiori di zero. È un punto sopra la falda di verifica: ora è «non applicabile» con codice NON_SATURO, come gli altri punti sopra falda, senza errore e senza FS. La correzione è nel livello applicativo (`app/profilo.js`); le altre righe, FS, IL, cedimenti e LSN non cambiano. Una profondità negativa resta un errore di input.
- **Avvisi sulle unità**: dopo la lettura, qc, fs, u2, profondità, N, Vs e FC sono confrontati (valore tipico, in unità interna) con soglie operative dell'app; il rapporto fs/qc mediano segnala unità di qc e fs scambiate fra loro. Avviso giallo al passaggio 2 (accanto alla scelta delle unità) e al passaggio 3. Non blocca il salvataggio, non converte nulla, non entra nel file del progetto. Le soglie non sono limiti normativi (`PLAUSIBILITA` in `app/importa.js`, descritte in `docs/app.md`).
- **Unità nelle intestazioni**: `z_m`, `z_cm`, `qc_kPa`, `fs_kPa`, `u2_kPa`, `FC_%` e le unità tra parentesi (`qc [kPa]`, `fs (kPa)`, `Vs [m/s]`) sono lette e proposte nel passaggio «Colonne e unità», con la nota «unità letta dall'intestazione»; maiuscole indifferenti. Prima `qc_kPa` non era associata a nessuna colonna e `qc [kPa]` veniva letta come MPa (valori 1000 volte troppo grandi), segnalata solo dal controllo di plausibilità. Un'unità nota ma non ammessa per la grandezza (`z_kPa`, `qc [m]`) esclude la colonna, da associare a mano; un testo tra parentesi che non è un'unità dell'app (`qc [kg/cm2]`) lascia l'unità predefinita. Una scelta manuale dell'unità resta; se l'unità sparisce dall'intestazione si torna a quella predefinita. Il controllo di plausibilità lavora sull'unità così letta.
- **Verifiche**: nuova sezione 10 in `verifica_profilo.mjs` (6 controlli), nuovo `verifica_unita.mjs` (23 controlli, anche l'assenza di avvisi sull'esempio) e 17 nuovi controlli sulle intestazioni con unità in `verifica_profilo.mjs` (sezione 6); 1071 controlli JavaScript in totale.

## App 0.4.1 — 2026-11-21

Correzione di un'etichetta e completamento dell'esempio sintetico. Motore di innesco (0.3.0), modulo IL (0.2.0) e modulo cedimenti (0.1.1) invariati: FS, IL, cedimenti e LSN non cambiano.

- **Sopra falda con Ic oltre soglia**: i punti CPT sopra la falda di verifica con Ic oltre la soglia sono ora indicati «sopra falda» in tabella, intervalli non calcolati, grafici, stampa e CSV, come già nell'indice IL che li classifica per profondità. Prima comparivano come «Ic oltre soglia» (nell'esempio, il tratto 1,2–1,8 m). Il motore controlla Ic prima della saturazione e resta invariato: la nuova etichetta si assegna nel livello applicativo (`app/profilo.js`). Ic resta nel motivo e nella carta di comportamento.
- **Esempio, verifica preliminare**: dati per tutti gli strati saturi entro 20 m. Limi argillosi 1,2–3,4 m e 12,4–13,2 m con curva granulometrica esterna ai fusi (proposta confermata: criterio 4 soddisfatto); alternanze 7,2–8,6 m con curva che tocca il fuso e scelta motivata del geologo (criterio 4 non soddisfatto); riporto senza analisi. Campioni numerati per profondità (S1-C1 … S1-C6). I dati della verifica preliminare valgono anche per il terzo scenario (falda 1,0 m). Esito dell'esempio: due strati esclusi, verifica necessaria per il sito.
- **Verifiche**: nuovi controlli in `verifica_profilo.mjs` (sezione 9) e `verifica_preliminare.mjs`, conteggi aggiornati in `docs/validazione.md` (1025 controlli JavaScript); parametri ?v= di `index.html` portati a 0.4.1.

## App 0.4.0 — 2026-11-21

Decisioni di Fabio del 21/11/2026 per la stabilità. Motore di innesco invariato (0.3.0); modulo IL 0.2.0, modulo cedimenti 0.1.1.

- **Indice IL con prove SPT**: la rappresentatività di ogni prova è limitata allo strato che la contiene; nessuna estensione automatica ad altri strati. Le parti di strati senza prova restano senza risultato (IL come intervallo IL_min–IL_max). Assunzione dichiarata nei risultati. Le CPT non cambiano.
- **Motivazione della M_w sempre obbligatoria**, anche se coincide con la proposta ZS9: finché manca, stampa e CSV sono bloccati. I progetti salvati senza motivazione si aprono, ma vanno completati prima di stampare. L'esempio sintetico ha una motivazione illustrativa.
- **Stampa, sezione 1.1** (e scheda «Magnitudo M_w»): avvertenza su datum ZS9 non dichiarato e appartenenza geometrica indicativa.
- **LSN sperimentale** fino a una validazione indipendente: indicato nell'app, in stampa, nel CSV e nelle assunzioni. Il cedimento di Zhang et al. (2002) non cambia.
- **Documenti**: classi di Youd (2001) e delle Linee guida LQ escluse dalla 1.0; attività aperte: originale di Iwasaki e caso pubblicato con IL, replica di Marina District o Treasure Island per Zhang.
- **Fonti**: formula dell'IL verificata su Iwasaki et al. (1981) e Tatsuoka et al. (1980); l'originale del 1978 non è reperibile. Nuovi confronti indicativi su figure digitalizzate: IL (Iwasaki 1981, Fig. 2 e 3, Tab. 1) e cedimento (Zhang 2002, Fig. 5).
- **Verifiche**: 995 controlli JavaScript, 3 confronti Python, 54 nel browser.

## App 0.3.1 — 2026-11-16

Solo testi dell'interfaccia; calcoli e formato del progetto invariati.

- **Pannello Scenario**: riscritta la nota sotto M_w e a_max. Spiega che a_max è l'accelerazione massima attesa in superficie, in campo libero, nel sito, e non la a_g della mappa di pericolosità (suolo rigido e pianeggiante); con l'approccio semplificato a_max = S·a_g, con S = S_S·S_T (NTC 2018, §3.2.3.2.1; relazione esplicita per a_max nel Cap. 7, per esempio §7.11.3.5.2 [7.11.5] e §7.11.6.2.1 [7.11.8]), altrimenti da risposta sismica locale. Dice che cosa indicare nelle note.
- **Disaggregazione**: la nota cita la disaggregazione accanto al collegamento alle mappe INGV MPS04-S1 (esse1-gis), già presente. Lo stesso collegamento compare ora nel messaggio «disaggregazione richiesta» (pannello Progetto, pannello Scenario, scheda «Magnitudo M_w»). Nessun calcolo automatico (decisione del 16/11/2026).

## App 0.3.0 — 2026-11-16

**Magnitudo M_w proposta dalle zone sismogenetiche ZS9.** Motore di calcolo invariato (0.3.0): la M_w entra nel calcolo come prima.

- **Coordinate del sito** nel pannello Progetto, in gradi decimali WGS84, con controllo di valori non numerici, intervallo, ordine lat/lon e punti fuori dall'Italia. Non entrano nel calcolo del FS se non attraverso la M_w.
- **Proposta di M_w** dal modulo ZS9 v1.2.0 di GeoHub-SismaSite (PR #31), copiato senza modifiche con i dati delle 36 zone (stessa impronta SHA-256) e le sue verifiche. Sito interno: M_w,max della zona (Linee guida LQ, Tab. A1.1). Sito esterno: tabella completa delle 36 zone (R_i, M_s,i, M_i, esito), comprese le zone escluse, in app e in stampa. Nessuna zona con M_s,i < M_i: «disaggregazione richiesta», con inserimento manuale (la disaggregazione non è implementata).
- **Scenario**: M_w proposta oppure inserita a mano, sempre modificabile; motivazione obbligatoria se diversa dalla proposta, altrimenti stampa e CSV sono bloccati. Avvisi per M_w < 5 (condizioni delle Linee guida LQ) e < 5,5 (campo di Cetin 2018).
- **Scheda «Magnitudo M_w»** e **sezione 1.1 della stampa**: esito, M_w adottata e origine, motivazione, segnalazioni del geologo, fonte, criterio («interpretazione della regola delle Linee guida LQ, pag. 30»), datum non dichiarato del file ZS9 e criticità delle Linee guida (pag. 31–32).
- **CSV**: riga con l'origine della M_w.
- **Formato del progetto**: nuovi campi facoltativi `progetto.lat`, `progetto.lon`, `progetto.noteZS9` e `scenari[].magnitudo`. I file precedenti si aprono con M_w «inserimento manuale».
- **Verifiche**: `verifica_zs9.mjs` e `verifica_zs9.py` di SismaSite (invariati), nuovo `verifica_magnitudo.mjs` (91 controlli), 17 nuovi controlli nel browser. Il workflow installa pyproj, shapely e numpy per la verifica Python.

## App 0.2.3 — compresa nella 0.3.0

Nessuna release dedicata: le modifiche sotto sono state pubblicate con la 0.3.0.

Revisione completa dei testi mostrati dall'app (tutte le schede, il confronto, le impostazioni, la stampa e il CSV) e correzione degli errori trovati. Formule invariate.

**Errore di calcolo corretto**
- **Indice IL e cedimento.** Con la falda di verifica esattamente su una lettura della prova, il punto non saturo si estendeva per metà passo sotto la falda. Il risultato era un tratto «senza risultato» fittizio di 1 cm, che trasformava IL e cedimento in intervalli (es. IL «tra 9,4 e 9,5» invece di 9,39).
  - Ora la falda fa da confine tra i due punti consecutivi.
  - Lo scenario principale dell'esempio non cambia (IL 7,14).
  - Aggiornate allo stesso criterio anche le implementazioni indipendenti usate nelle verifiche.

**Confronto**
- **Avviso sul «dominio dei punti calcolati».**
  - Ora compare solo tra scenari della stessa prova; tra prove diverse le profondità non coincidono per costruzione.
  - Indica per nome lo scenario con le profondità in più. Prima scriveva «nel primo» o «nel secondo» con riferimenti invertiti rispetto all'ordine dei nomi, e suggeriva sempre «la falda diversa».
- **Avviso sui metodi diversi.** Elenca solo le basi dei metodi presenti.
- **Nota delle falde.** I nomi degli scenari sono ora tra virgolette.

**Testi e coerenza**
- **Intervalli non calcolati.** Il motivo vale per tutto il tratto e riporta l'intervallo di Ic (es. «Ic 2,61–2,95 > soglia 2,6 … in questo tratto»), non più il valore del primo punto. Il motivo breve non dice più «escluso», per non confonderlo con l'esclusione del §7.11.3.4.2.
- **Numeri con la virgola decimale** nei messaggi del motore e dell'indice IL (prima, ad esempio, «Ic = 2.62», «3.19 m»). Nel motore cambiano solo i testi: i valori calcolati sono identici.
- **Riepilogo.** Il numero di intervalli non calcolati è indicato sotto «Punti calcolati», non più sotto «Avvisi».
- **Criterio 3.** I punti con Ic oltre la soglia sono distinti dai dati mancanti (prima «78 senza valore»).
- **Tabelle.** «1 ≤ FS < 1,25» invece di «FS < 1,25» per il margine inferiore al riferimento.
- **Stampa.**
  - Motivi in chiaro al posto dei codici interni negli intervalli non calcolati.
  - Didascalie delle tavole con i soli elementi presenti.
  - Nome dell'app uniforme nei margini di pagina.
  - Nessuna maiuscola dopo i due punti nelle assunzioni.
- **Unità e suggerimenti.**
  - L'unità in metri non viene più resa «M» dal maiuscoletto.
  - Unità di γsat nella tabella degli strati.
  - Suggerimento su CE riscritto.
- **CSV.** Versione dell'app nella prima riga.

## App 0.2.2 — 2026-11-14

Esempio sintetico più realistico e omogeneo. Motore, formule e interfaccia invariati.
- **Strato argilloso a metà profilo.** Al posto dell'argilla limosa di 3,4 m (12,4–15,8 m, dove il metodo CPT non si applica), un limo argilloso di 0,8 m (12,4–13,2 m).
- **Strato profondo.** Al posto della ghiaia sabbiosa, poco credibile con la CPT e fuori dalla taratura del metodo, una sabbia da media a densa (13,2–20 m). La CPTU arriva a 20 m: IL e cedimento risultano completi, non più intervalli.
- **Densità coerenti con le descrizioni.**
  - Sabbia media mediamente addensata: qc1Ncs circa 120–140.
  - Sabbia da media a densa: qc1Ncs circa 130–150.
  - Nessun FS oltre la scala del grafico, né nel profilo né nel Confronto (prima 24 valori oltre 3).
- **SPT** coerenti con la CPTU.
- **Verifica preliminare.**
  - Tre curve granulometriche, tutte interne ai fusi, come è proprio delle sabbie; nessuno strato escluso.
  - L'esclusione con il criterio 4 resta verificata nei test con una variante dedicata.
- **Verifiche aggiornate.** I casi di prova interrotta usano una copia dell'esempio troncata a 18,4 m. Nuovo controllo: nessun FS fuori scala nell'esempio.

## App 0.2.1 — 2026-11-14

Consolidamento dopo un audit del codice. Motore e formule invariati: a parità di input nessun risultato cambia.

**Apertura dei progetti**
- Il file JSON è trattato come dato non attendibile e ricostruito con i soli campi noti:
  - ogni campo è controllato per tipo;
  - tipi di prova, metodi e unità si confrontano con le sole chiavi proprie delle tabelle;
  - ID e colori hanno un formato fisso; gli ID degli scenari sono univoci;
  - le unità sono obbligatorie dove ne esiste più di una.
- Errori elencati con campo e motivo, senza eccezioni. Il progetto corrente viene sostituito solo dopo la validazione completa.
- I risultati non sono più salvati nel file né ricaricati: si ricalcolano con «Calcola», e l'app lo segnala all'apertura.
- Conferma prima di sostituire un progetto con modifiche non salvate (Nuovo, Demo sintetica, Apri).
- Escape di tutti i valori inseriti nell'HTML, attributi compresi. Corretti più percorsi di iniezione: opzioni e parametri nei campi, conteggi e testi dei risultati, nomi degli scenari nel Confronto.

**FS di riferimento**
- Un valore esplicito non valido (es. 4, oppure testo) non viene più sostituito con 1,25: l'errore compare sotto il campo e nel riepilogo, e stampa ed esportazione restano bloccate fino alla correzione.
- 1,25 si applica solo con il campo vuoto o per i progetti precedenti senza il campo.

**Stampa e testi**
- Intestazione e piè di pagina su ogni pagina (Chrome, Edge): titolo, progetto, scenario, versioni, firma degli input, numero di pagina. A4 verticale.
- Chiarito che gli intervalli di IL, cedimento e LSN sono limiti convenzionali del modello, non intervalli di confidenza né massimi fisici garantiti.

**Tecnica**
- Chart.js 4.4.4 e caratteri IBM Plex inclusi in `vendor/` con le licenze: nessuna richiesta a servizi esterni, l'app funziona anche senza rete.
- Content Security Policy come difesa aggiuntiva.
- CSS: un solo `@page` e un solo blocco di stampa; tolte regole obsolete e sovrascritte (interfaccia invariata, verificata pixel per pixel).
- Verifiche:
  - `verifica_sicurezza.mjs` e controllo nel browser con Playwright;
  - `verifiche/esegui.mjs` esegue tutto con un solo comando;
  - workflow GitHub Actions a ogni push e pull request.

## App 0.2.0 — 2026-11-14

Motore invariato (0.3.0): nessun FS cambia rispetto alla 0.1.0 a parità di input.

**Verifica preliminare (NTC 2018 §7.11.3.4.2)**
- Nuova scheda iniziale con i dati del sito (falda media stagionale, piano campagna sub-orizzontale, fondazioni superficiali), l'albero dei criteri e il dettaglio per strato.
- Criterio 3 per strato: solo per gli strati dichiarati «sabbia pulita», con tutti i punti saturi sopra soglia e senza lacune di indagine.
- Criterio 4 per strato: curva granulometrica disegnata sui fusi della Fig. 7.11.1, esito proposto dall'app e confermato dal geologo, con motivazione se diverso.
- Il sito è escluso con i criteri 3–4 solo se lo sono tutti gli strati saturi entro 20 m e la stratigrafia descrive l'intero tratto. L'esito è riportato in stampa e nel CSV e non modifica i FS.

**Nuovi risultati**
- FS di riferimento di scenario, predefinito 1,25 (EN 1998-5, §4.1.4), modificabile tra 1 e 3.
  - Compare come linea e fascia nel grafico FS, nel riepilogo, nelle tabelle, in stampa e nel CSV, con il testo del criterio di verifica.
  - Non entra nella firma degli input.
- Indice IL (Iwasaki et al. 1978), senza classi. Con copertura incompleta di 0–20 m è dato come intervallo IL_min–IL_max.
- Cedimento post-sismico e LSN da CPT con le equazioni originali di Zhang et al. (2002). I tratti non indagati sono dati come intervalli; l'LSN è riportato anche su 0–10 m.
- Carta di comportamento del terreno (Robertson & Wride 1998) nella scheda Profili e in stampa.

**Interfaccia e stampa**
- Risultati a tutta larghezza e tavole preimpostate (Verifica; Dati e interpretazione; Tensioni e coefficienti; FS, PL e IL; Cedimenti e LSN).
- Impostazioni in viste a tutto schermo con accessi diretti a Progetto, Prove, Scenario e Stratigrafia.
- Importazione in tre passaggi con guida per tipo di prova e modello vuoto.
- Virgola decimale nei campi.
- Stampa A4 verticale come allegato alla relazione, con versione dell'app e del motore nel piè di pagina.
- Nuovo esempio sintetico realistico: successione alluvionale con CPTU interrotta per rifiuto, sondaggio con SPT e curve granulometriche, tre scenari.
- La guida all'importazione spiega perché CPT a punta meccanica e prove DPSH non sono calcolate.

**Validazione**
- Confronto con un calcolo pubblicato completo (National Academies 2024, App. G): 58 righe entro l'arrotondamento della tabella.
- Seconda implementazione Python per cedimento e LSN.
- Prove casuali ripetibili.
- In totale 737 controlli JavaScript.

**Repository**
- README riscritto; nuovi documenti `docs/validazione.md` e `docs/sviluppo.md`.
- Immagine di anteprima per i social, logo e icone in `assets/`.
- Modelli per le segnalazioni in `.github/`.
- NOTICE con le fonti dei nuovi moduli.

## App 0.1.0 — 2026-11-11

Prima applicazione web.
- Prova, scenario e calcolo del profilo, con stati espliciti per sopra falda, dati mancanti, profondità fuori stratigrafia e profondità non indagate.
- Profili affiancati e tabelle delle grandezze originali, intermedie e finali.
- Confronto di 2–3 scenari.
- Esportazioni JSON, CSV e PNG; stampa HTML/PDF.

## Motore 0.3.0 — 2026-11-11

- Validazione centralizzata degli input, senza conversioni implicite né eccezioni per dati errati.
- Stati di esito comuni e avvisi strutturati `{codice, tipo, messaggio}`.
- Criterio 4: confronto esatto sui vertici della curva e copertura minima 10–90 % per proporre l'esclusione.
- CPT: tipo CPTE/CPTU obbligatorio. Profondità massima 20 m. Convergenza esposta nei risultati.
- Kayen et al. (2013): l'avviso oltre 180 kPa è stato riallineato al testo (pag. 413–414); prima diceva, impropriamente, «K_σ assunto pari a 1». La formula non cambia.

**Migrazione da 0.2.0** (per chi usa il motore direttamente)

- Nessuna eccezione per dati errati: controllare `stato` invece di usare try/catch (resta solo `PhiInv` e `crCetin` fuori dominio, funzioni di servizio).
- `bi2014Cpt`: `opz.tipo` obbligatorio (`'CPTE'` o `'CPTU'`); `u2` con CPTE è un errore; CPTU senza `u2` → `dati_insufficienti`. Gli stati `'escluso'` e `'non calcolabile'` diventano `non_applicabile` (`IC_OLTRE_SOGLIA`) e `dati_insufficienti` (`IC_NON_CALCOLABILE`).
- `bi2014Spt` accetta un quarto argomento `opz` (`maxIterazioni`).
- `tensioni` restituisce `{stato, sv, u, sve}` o `{stato: 'input_non_valido', errori}`; falda sopra il p.c. non supportata.
- Punti sopra falda (u = 0): `non_applicabile`, codice `NON_SATURO`, valori in `diagnostica`.
- `criterio1–4`: campo `stato` (`valutato`, `input_non_valido`, `dati_insufficienti`); con dati non validi `soddisfatto` è `null`. `criterio2` richiede booleani veri. `criterio3` accetta solo `'SPT'`, `'CPTE'`, `'CPTU'` (prima qualunque tipo diverso da `'CPT'` era trattato come SPT).
- `criterio4`, `confrontaFuso`, `coeffUniformita`: la curva viene validata; nuovi campi `copertura` e `attraversamenti`; `coeffUniformita` restituisce anche `stato`.
- Avvisi: oggetti `{codice, tipo, messaggio}` invece di stringhe.

## Motore 0.2.0 — 2026-11-09

- Criteri 1–4 del §7.11.3.4.2 con esito e margine.
- Fusi della Fig. 7.11.1 digitalizzati dall'immagine ufficiale (`dati/fusi-ntc2018.json`, `strumenti/digitalizza_fusi.py`).

## Motore 0.1.0 — 2026-11-09

- Quattro metodi semplificati, ciascuno come blocco chiuso, con equazioni lette sulle pubblicazioni originali:
  - Boulanger & Idriss (2014) da SPT e CPT;
  - Cetin et al. (2018) da SPT;
  - Kayen et al. (2013) da V_s.
- Verifiche sui valori pubblicati dagli autori e seconda implementazione indipendente in Python.
