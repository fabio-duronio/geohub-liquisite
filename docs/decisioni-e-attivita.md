# Registro delle richieste e delle attività

Questo documento è il riferimento aggiornato per una nuova chat, Claude o un altro sviluppatore. Non sostituisce il contesto generale di GeoHub non presente nei repository: eventuali ulteriori convenzioni della suite devono essere fornite dall'autore.

## Riepilogo delle richieste (aggiornato alla consegna v5)

| Richiesta | Intervento / stato |
|---|---|
| Operare senza perdere parti del progetto | Aggiunto AGENTS.md e questo registro; base pubblica verificata; nessuna pubblicazione |
| Esempio concreto e reale | FATTO (v5.2): nuovo esempio sintetico realistico (successione alluvionale, CPTU a passo 2 cm interrotta a 18,4 m, sondaggio S1 con SPT e FC di laboratorio, tre scenari). Il PDF fornito per la restituzione non va reintrodotto |
| Grafica a schermo intero | Conservata area risultati a tutta larghezza; attende valutazione dell'utente |
| Report verticale | FATTO: A4 verticale, due profili per tavola, intestazione con prova e scenario ripetuta |
| Tabella vuota incomprensibile | FATTO: guida per tipo di prova, significato delle sigle, placeholder, incolla da Excel, modello CSV vuoto e inserimento sole intestazioni |
| Associazione delle colonne poco chiara | FATTO: testo «Controlla a cosa corrisponde ogni colonna del tuo file», esempio Depth→profondità, nomi estesi e unità |
| Collegamento INGV | FATTO: link ufficiale https://esse1-gis.mi.ingv.it/ verificato; separazione tra valore di base e amax al sito; nessuna importazione automatica |
| DPSH, N60, CPT meccanica | Valutato (v5.2): non supportati nel calcolo, per mancanza di metodi calibrati e di conversioni di validità generale; limiti e avvertenze nella guida all'importazione |
| Virgola e campi degli strati tagliati | FATTO: campi decimali testuali con parsing esplicito (virgola o punto, non separatori delle migliaia), tabella più larga e scorrimento contenuto su mobile |
| Comprendere la possibilità di liquefazione | PARZIALE: riepilogo esplicativo dei punti FS<1 e colonna «Lettura del modello»; non è un indice di sito |
| IL/LPI | FATTO (v5.1, locale): IL di Iwasaki et al. (1978) in `motore/indici.js`, fonti LG LQ pag. 9 e CNR 2024 Eq. 3.73–3.74 pag. 36; senza classi; Ic oltre soglia: FS N.A. e F(z) = 0 per convenzione dichiarata; tratti ignoti come intervallo IL_min–IL_max; 51 controlli. APERTO: caso di riferimento pubblicato |
| Effetti post-liquefazione | APERTO: cedimenti e spostamenti laterali richiedono moduli distinti |

## Riferimenti e intenzione dell’utente

Alcuni software commerciali (non citati nel repository) sono stati consultati come riferimento funzionale per semplificare il percorso e rendere leggibili risultati grafici e tabellari; non è richiesto replicarne le funzioni. Mantenere omogeneità con GeoHub/SismaSite. L’utente vuole avanzare senza un interrogatorio sui dati mancanti del sito; chiarimenti necessari uno alla volta.

Il PDF fornito serviva a comprendere formati e restituzione, eventualmente come spunto dimostrativo. L’utente ha poi respinto l’integrazione dedicata e chiesto di ripulire il progetto: tale richiesta prevale. Non includere dati, estrazioni, localizzazione o report del caso nel pacchetto. Un futuro benchmark scientifico richiederà dati e impostazioni tracciabili, ma è un’attività distinta dalla revisione visuale.

## DPSH: percorso da definire prima di scrivere formule

Raccogliere: marca/modello, massa/caduta del maglio, geometria del cono, avanzamento per conteggio (non assumere 20 o 30 cm), aste, energia e calibrazioni disponibili, tipo di terreno e correlazione proposta con fonte e campo di applicazione.

Distinguere rigorosamente:
- colpi DPSH misurati;
- N SPT misurato;
- N60 SPT corretto per energia/attrezzatura secondo la definizione adottata;
- (N1)60 normalizzato per sovraccarico;
- eventuale valore SPT equivalente da correlazione.

Non inserire N60 come N grezzo con i coefficienti predefiniti: si rischiano doppie correzioni. Non applicare un rapporto energetico teorico come conversione universale DPSH-SPT. Prevedere in futuro modalità dedicate e tracciabili, non un'etichetta alternativa della colonna N.

## IL/LPI: prossimo modulo scientifico

Prima dell'implementazione:
1. scegliere e citare la formulazione (per esempio Iwasaki, distinguendola da Sonmez);
2. fissare dominio di profondità e regola di integrazione;
3. stabilire trattamento documentato di sopra falda, strati argillosi, lacune, punti non applicabili e profilo corto;
4. evitare che il tratto sotto la profondità investigata venga assunto sicuro;
5. separare un eventuale integrale parziale dall'indice completo e dalle relative classi;
6. validare con profili analitici semplici e almeno un caso completo di riferimento;
7. solo dopo aggiungere curva cumulata, indice finale, eventuali classi e report.

Il conteggio attuale di punti FS<1 è volutamente esplicativo: dipende dal campionamento e NON è una frazione dello spessore liquefacibile, una probabilità o LPI.

## Prima dell'integrazione su GitHub

Creare un branch. Recuperare eventuali commit più recenti di 1793470 e confrontare i file. Non sovrascrivere modifiche successive. Eseguire le verifiche e controllare la stampa. Questa revisione resta locale fino ad approvazione dell'utente.

## Verifiche della seconda revisione

- 514 controlli JavaScript originali, 6 controlli di coerenza Ic e 12 controlli nuovi per decimali/importazione, tutti superati.
- Confronto Python su 8.000 casi superato.
- Chromium: guida, download del modello vuoto, inserimento intestazioni, importazione reale di una tabella di test, virgola nel campo accelerazione e nei pesi di volume, rifiuto del formato misto 18,7.5, colonna esito, link INGV e contenimento della tabella su mobile.
- Stampa PDF verificata: quattro pagine A4 verticali per la tavola CPT standard (dati/riepilogo; due tavole da due profili; avvisi). Il numero può variare con il contenuto.
- Corretto anche un problema emerso nei test: un file con sole intestazioni non è più accettato come prova con zero misure.
- Motore verificato identico a quello del commit pubblico di base.

## Terza revisione: eliminare i piccoli riquadri e lo scorrimento continuo

Richiesta: passare tra impostazioni, prova e nuova prova era scomodo; correggere un errore richiedeva riaprire la finestra.

Interventi:
- accessi diretti Progetto / Prove / Scenario / Stratigrafia dalla vista risultati;
- editor a tutto schermo con intestazione, navigazione e azioni persistenti;
- apertura dell’importatore chiude prima la vista impostazioni: niente finestre sovrapposte;
- tre passaggi separati: Dati, Colonne e unità, Controllo e salvataggio;
- guida affiancata al testo su desktop, non prima dell’intero modulo;
- Avanti e Indietro non eliminano testo o mappature;
- «Salva la prova» non chiude l’editor: si può tornare a correggere e salvare nuovamente senza creare duplicati;
- tornando ai risultati la bozza è recuperabile nella stessa sessione e nello stesso progetto. Non è un autosalvataggio persistente nel browser.

Verificato in Chromium: una sola finestra aperta, navigazione, recupero bozza nuova, salvataggio ripetuto senza duplicazione, aggiornamento misure, accessi diretti, calcolo della demo, stampa e pulsanti raggiungibili a 390 px. Nessun errore JavaScript nei percorsi provati. Restano validi i test numerici.

Nota storica: a quel punto il PDF non era ancora stato esaminato. Gli sviluppi successivi sono riassunti sotto senza riprodurne i dati.

## V4 e v4.1 — percorso abbandonato e correzione navigazione

L’assistente ha estratto le misure dal PDF e aggiunto una demo reale, un tipo CPTM per sola restituzione e un modulo di profili/report dedicato. Non erano calcoli di liquefazione. Questa scelta non ha risposto all’intento dell’utente: NON è la direzione da riprendere.

L’utente ha inoltre segnalato quattro pulsanti superiori ma il solo Progetto funzionante nella sua esperienza, con un secondo menu interno ridondante. In v4.1 è stato eliminato il menu interno e verificata l’apertura isolata di ogni sezione. Non è stata stabilita con certezza la causa del malfunzionamento osservato dall’utente; sono stati anche versionati i riferimenti alle risorse per evitare cache obsolete. Non confondere test automatici superati con approvazione dell’utente.

## V5 pulita — richiesta finale e consegna

Richiesta: ripulire tutto dai dati della CPT reale e consegnare il progetto completo, AGENTS.md e questo registro, per continuare in un’altra chat o con Claude.

Eseguito: ripristino della base funzionale v3; rimozione dell’intera estensione dedicata al caso, del dataset e dei test dipendenti; conservazione della correzione della navigazione v4.1. Il pacchetto non contiene il PDF originale né estrazioni, immagini o report del caso reale. Rimangono guida, importatore a tre passi, bozze di sessione, risultati estesi, report verticale, gestione decimali e demo sintetica. Motore invariato rispetto alla base 1793470. Nessuna pubblicazione remota.

### Cosa resta aperto e ordine suggerito
1. Far valutare all’utente navigazione e leggibilità a tutto schermo: non considerarle approvate. Evitare altre aggiunte prima di stabilizzare il percorso essenziale.
2. Migliorare la restituzione nello stile della famiglia GeoHub, con i software commerciali consultati come riferimento funzionale e report verticale inseribile in relazione; la valutazione estetica dell’utente resta aperta.
3. Definire e validare IL/LPI, copertura in profondità e trattamento dei punti esclusi prima di aggiungere indici o classi.
4. Definire DPSH/N60 senza conversioni universali o doppie correzioni.
5. Definire separatamente cedimenti e altri effetti post-liquefazione, fonti e benchmark.
6. Validazione scientifica su casi di riferimento, verifiche browser più ampie e dipendenze offline; i test attuali non sono certificazione professionale.
7. Integrazione sul repository solo con autorizzazione e confronto con eventuali commit successivi.

### Come ripartire
Aprire AGENTS.md, questo registro e LEGGIMI-REVISIONE.md. Avviare il server locale, controllare i quattro accessi e la demo sintetica. Le richieste future devono partire da questa versione pulita, non dai pacchetti v4/v4.1. Non sono necessarie le estrazioni del PDF o la conversazione precedente per usare questa consegna.

### Verifiche ripetute sulla consegna pulita
532 controlli JavaScript superati e confronto indipendente Python/JS concordante su 8.000 casi. Regressione Chromium superata su editor, bozze, aggiornamenti, accessi diretti, demo sintetica, stampa e mobile. Dataset e moduli del caso reale assenti.

## V5.1 — verifica della consegna e indice IL (13/11/2026)

Verifica della v5 pulita rispetto al repository (`main` = `1793470`): `motore/liquisite.js`, dati dei fusi e verifiche numeriche identici byte per byte; 532 controlli JavaScript e confronto Python superati; regressione Chromium (quattro accessi, virgola decimale, invalidazione e ricalcolo, tabelle, confronto, CSV, JSON, stampa A4 verticale, importazione a tre passi senza duplicati, mobile 390 px) senza errori. Nessuna traccia della demo CPT reale.

Indice IL (punto 3 dell'ordine suggerito):
1. formula di Iwasaki et al. (1978), citata dalle fonti consultate integralmente: Linee guida MS-LQ (2018, pag. 9) e volume CNR-CentroMS (2024, Eq. 3.73–3.74, pag. 36). Si citano le fonti consultate mantenendo l'attribuzione originaria (non è un errore metodologico né bibliografico);
2. dominio 0–20 m; ogni punto rappresenta l'intervallo fino a metà distanza dai vicini; integrale del peso esatto;
3. sopra falda contributo nullo; Ic oltre soglia (CNR 2024, §3.2.1.2, pag. 32) = FS_L N.A., non calcolato; contributo F(z) = 0 come **convenzione operativa di calcolo** dichiarata, che non equivale a un FS nullo né alla condizione FS > 1 della definizione di F(z); dati mancanti, non calcolati e profondità non indagate = tratti ignoti;
4. tratti ignoti mai sicuri: IL_min (contributo nullo) e IL_max (contributo massimo); «completo» solo senza tratti ignoti;
5. nessuna classe;
6. validazione: profili analitici e seconda implementazione per campionamento; manca un caso completo di riferimento pubblicato;
7. interfaccia: riquadro nel riepilogo, pannello «Indice IL cumulato» (vista «FS, PL e IL»), sezione in «Avvisi e assunzioni», riga nel CSV, riepilogo e avvisi in stampa.

Motore `liquisite.js` invariato. Nessuna pubblicazione remota.

## V5.2 — pulizia, esempio realistico, prove casuali

- Codice ripulito: nessuna nota interna o data di decisione nei commenti, nessun nome di azienda o prodotto commerciale nel codice e nei testi dell'app; parametri di versione dei file statici uniformati; una variabile inutilizzata rimossa (controllo statico senza errori).
- Nuovo esempio sintetico (`app/esempio.js`): successione alluvionale inventata con falda a 1,8 m; CPTU a passo 2 cm da 0,6 m a 18,4 m (rifiuto in ghiaia), generata con seme fisso, rumore correlato e media mobile del cono, u2 con sovrappressioni nelle argille; sondaggio S1 con SPT nei livelli granulari e FC per campione; tre scenari (CPTU falda 1,8 m, SPT, CPTU falda 1,0 m) per il confronto. Le verifiche che usavano lacune e letture mancanti dell'esempio precedente ora le costruiscono su una copia.
- CPT meccanica e DPSH: valutato che non ha senso calcolarle con i metodi disponibili (B&I 2014 calibrato su punta elettrica/piezocono; CNR 2024 §3.2.1.2 sconsiglia la CPT meccanica; nessuna conversione DPSH→SPT di validità generale). Aggiunti limiti e avvertenze nella guida all'importazione; nessun nuovo tipo di prova.
- Prove casuali: `verifiche/verifica_casuale.mjs` (profili, scenari e testi d'importazione generati con seme fisso; proprietà invarianti su stati, FS, IL, CSV e salvataggio). Prova casuale dell'interfaccia in Chromium (clic e digitazioni a caso) senza errori JavaScript.
- Nota tecnica: sopra falda, se Ic supera la soglia, il motore restituisce IC_OLTRE_SOGLIA prima di NON_SATURO; nessun effetto numerico (l'indice IL assegna comunque «sopra falda» in base alla profondità).

## V5.3 — criterio di verifica e FS di riferimento

Formulazione dell'utente, riportata in app, stampa e CSV (`criterioFS` in `app/profilo.js`): le NTC 2018 (§ 7.11.3.4) non stabiliscono un FS minimo; la Circolare 7/2019 (§ C7.11.3.4) demanda al progettista valutazione e motivazione del margine; riferimento tecnico EN 1998-5, § 4.1.4, valore raccomandato 1,25, illustrato anche in JRC «Eurocode 8: Seismic Design of Buildings – Worked Examples» (EUR 25204 EN, 2012, § 4.5); il valore, riferito a CRR/CSR, resta responsabilità del progettista.
- Opzione di scenario `FSrif` (predefinito 1,25, ammesso 1–3): linea e fascia ambra nel grafico FS, conteggio dei punti tra 1 e FSrif nel riepilogo, lettura in tabella, riga in stampa, intestazione CSV. Progetti salvati senza `FSrif` riaperti con 1,25.
- FSrif non entra nella firma degli input: cambia la lettura, non il calcolo; i risultati restano aggiornati.
- L'indice IL resta definito su FS ≤ 1 (Iwasaki), indipendente da FSrif.

## V5.4 — verifica preliminare in interfaccia e carta di comportamento CPT

- Nuova scheda «Verifica preliminare» (§7.11.3.4.2): dati di sito (falda media stagionale, p.c. sub-orizzontale, fondazioni superficiali), albero dei criteri, dettaglio per strato, curva granulometrica sui fusi della Fig. 7.11.1. Logica in `app/esclusione.js`, criteri del motore.
- Regole dichiarate: criteri 3–4 per strato; criterio 3 solo se lo strato è dichiarato sabbia pulita e tutti i punti saturi superano la soglia, con la normalizzazione del metodo, senza lacune di indagine nello strato; criterio 4 solo con la conferma del geologo (motivazione obbligatoria se diversa dalla proposta), copertura 10–90 % senza estrapolazione; sito escluso con i criteri 3–4 solo se lo sono tutti gli strati saturi entro 20 m e la stratigrafia descrive tutto il tratto. L'esito non modifica i FS e non entra nella firma degli input.
- Dati salvati nel progetto (`scenario.esclusione`), validati all'apertura; progetti precedenti aperti con dati vuoti. Stampa: nuova sezione 2 con tabelle e curve; CSV: riga di intestazione con l'esito.
- Carta di comportamento CPT (Q–F) nella scheda Profili e in stampa: zone 2–7 da Ic secondo Robertson e Wride (1998), Tab. 1, pag. 450 (verificato sul PDF); zone 1, 8, 9 non rappresentate. Q e F sono quelli del calcolo (stessa procedura per n).
- Esempio: curve granulometriche per la sabbia limosa (interna al fuso) e per la ghiaia sabbiosa (esterna, confermata); lo strato 15,8–20 m diventa «ghiaia sabbiosa».
- Nuove verifiche: `verifica_preliminare.mjs`; `verifica_casuale.mjs` controlla anche che non ci siano esclusioni senza criterio soddisfatto.
- Cedimenti e LSN: letti per intero Zhang, Robertson e Brachman (2002) e l'Appendice A «Assessment of Liquefaction Vulnerability in Christchurch» (Tonkin & Taylor, ottobre 2015, documento fornito dall'utente). Da decidere prima del codice:
  - Zhang dà le equazioni solo per FS ≤ 0,5; 0,6; …; 1,3; 2,0 (Appendice A del 2002, Eq. A1–A14) e per 33 ≤ (qc1N)cs ≤ 200: interpolazione tra le curve e valori fuori campo non sono specificati;
  - Eq. A14 stampata «33 ≤ (qc1N)cs ≤ 20»: refuso evidente per 200;
  - le curve sono ricavate con (qc1N)cs e FS di Robertson e Wride (1998); l'Appendice A le applica con B&I 2014 (prassi MBIE 2014): combinazione da dichiarare;
  - LSN = 1000·∫ εv/z dz senza limite superiore scritto; gli studi di Christchurch usano i primi 10 m; εv come decimale (confermato dalla guida MBIE-NZGS, Modulo 3, nota 7).

## V5.5 — cedimento post-sismico da CPT e LSN

- `motore/cedimenti.js`: εv di Zhang et al. (2002, App. A, Eq. A1–A14), cedimento S (Eq. 1) e LSN (Tonkin & Taylor 2015, App. A, §A4.3.5), con le convenzioni formulate dall'utente il 13/11/2026: interpolazione lineare in FS (≤ 0,5 curva limite, ≥ 2,0 zero); (qc1N)cs ricondotto a 33–200 con avviso (sotto 33 non cautelativo); εv = 0 per Ic oltre soglia e sopra falda; tratti ignoti come intervalli (contributo nullo / deformazione limite 5,80 %); 0–20 m e LSN anche 0–10 m. Dettagli in `docs/cedimenti-lsn.md`.
- Interfaccia: riquadro nel riepilogo, tavola «Cedimenti e LSN» (FS, εv, cedimento cumulato con limite superiore), colonna εv in tabella e CSV, righe di intestazione CSV, righe in stampa e assunzioni dichiarate. Solo con il metodo CPT.
- Verifiche: `verifica_cedimenti.mjs` (50 controlli) e `verifica_cedimenti.py` (seconda implementazione, εv su 3000 casi, S e LSN con integrazione numerica a 1 mm); `verifica_casuale.mjs` controlla limiti e coerenza su profili casuali.
- Aperto: un caso pubblicato completo per il confronto numerico del cedimento.

## Caso di riferimento esterno (14/11/2026)

- Fonte, letta sul PDF fornito dall'utente (43 pagine; la parte sulla liquefazione per intero, la parte sui pali solo scorsa perché estranea): National Academies (2024), *Pile Design for Downdrag: Examples and Supporting Materials*, App. G, Design Example 5 (Blytheville, AR). B&I 2014 da CPT; cedimento con Yoshimine et al. (2006) e non con Zhang (2002).
- Dati estratti in `verifiche/dati/nasem2024-blytheville.json` (Tabelle G3, G5, G6, G7, Evento 1: amax 0,1 g, Mw 6,5; falda a 1 ft). Test: `verifiche/verifica_riferimento.mjs`.
- Esito: punto dettagliato a 24,93 ft (Tabella G4) entro l'1–1,5 % (FS 1,090 contro 1,08); profilo intero, 58 righe sotto falda entro 20 m: CN, qc1N, (qc1N)cs entro lo 0,15 %; rd, Kσ, MSF, CSR, CRR entro l'arrotondamento della tabella (2 decimali).
- Per isolare la catena si impone FC = 80·Ic − 137 con l'Ic pubblicato: l'esempio calcola n con l'iterazione di Robertson (2009), il motore con la regola di Robertson e Wride (1998) adottata da B&I 2014. Con l'Ic del motore il FS cambia di qualche punto percentuale (es. 1,13 contro 1,08 a 24,77 ft).
- Differenze di convenzione dell'esempio, non adottate: (qc1N)cs limitato a 254 anche fuori dall'esponente m; CRR7,5 limitato a 2,0; FSL = 2,0 per Ic ≥ 2,6; peso di volume stimato dalla CPT (Robertson e Cabal 2015).
- Refusi e incongruenze del documento: nella Tabella G7 la colonna «FS» contiene FSα (Eq. 24; es. 0,89 per (qc1N)cs = 85, e valori negativi in profondità), non FSL; nella Tabella G5 la colonna «σ'vo» contiene la tensione totale; nelle formule stampate Eq. 2 «0,34» per 3,47, Eq. 8 «1,57» per 15,7, Eq. 20 «− 1,118» per + 0,118 (i calcoli numerici usano i valori corretti).
- Cedimento, solo indicativo: Zhang 2002 con FS e (qc1N)cs pubblicati, sulle righe riportate ogni 0,984 ft, dà circa 1,8 in contro 2,46 in dell'esempio con Yoshimine 2006 (metodo diverso, dati al passo pieno di 0,164 ft non pubblicati).

### Ordine suggerito aggiornato
1. Valutazione dell'utente di navigazione, leggibilità, del riquadro IL e del nuovo esempio.
2. Restituzione nello stile GeoHub (valutazione estetica aperta).
3. IL: caso di riferimento pubblicato, rappresentatività delle SPT; lettura del testo completo di Iwasaki, Arakawa e Tokida (1984), Soil Dyn. Earthq. Eng. 3(1), 49–58 (segnalato dall'autore; testo completo non reperito).
4. DPSH/N60 senza conversioni universali.
5. Effetti post-liquefazione con fonti e benchmark.
6. Validazione su casi di riferimento e dipendenze offline.
7. Integrazione sul repository solo con autorizzazione.
