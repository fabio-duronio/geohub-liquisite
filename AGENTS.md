# GeoHub-LiquiSite — istruzioni e contesto per la prosecuzione

Leggere questo file e `docs/decisioni-e-attivita.md` prima di modificare il progetto.

## Stato corrente — v5 pulita (consegna per prosecuzione)
- Questa versione sostituisce v4 e v4.1: NON recuperare da quei pacchetti demo o dati CPT reali.
- L’utente ha chiesto di rimuovere l’integrazione del PDF: era un riferimento per comprendere la restituzione, non una richiesta di costruire un percorso dedicato al sito.
- Rimossi dataset, pulsanti, modulo dedicato CPTM, test basati sulle misure reali e relativi riferimenti nell’app. Nessun PDF, CSV o report del caso è incluso.
- Ripristinata la base funzionale v3, conservando la correzione della navigazione: quattro accessi diretti, nessun menu interno duplicato, titolo della sezione attiva.
- Rimane solo la demo esplicitamente sintetica. Non costituisce validazione scientifica.
- Non chiedere dati mancanti del PDF per poter proseguire il lavoro di interfaccia. Non reintrodurre quel dataset senza nuova richiesta esplicita.
- Leggere il registro per richieste, limiti, storia e priorità; il suo stato corrente prevale sulle note storiche.

## Aggiornamento navigazione (v3 locale)
- Le impostazioni usano viste estese a tutto schermo, non piccoli popup; accessi diretti a Prove, Scenario e Stratigrafia.
- Importazione in tre passaggi, con navigazione persistente. Una sola vista modale aperta alla volta.
- Dopo «Salva la prova» si resta nell’editor per correggere; ulteriori salvataggi aggiornano la stessa prova.
- Bozze in memoria per la sessione, separate tra nuova prova e prove esistenti. Non sopravvivono al refresh: il progetto va esportato in JSON per conservarlo.
- Il motore resta invariato.

## Stato del lavoro
- Repository pubblico di riferimento: https://github.com/fabio-duronio/geohub-liquisite
- Base verificata: commit `1793470`, motore 0.3.0. Riferimento storico: ricontrollare il remoto prima di integrare.
- Questa cartella contiene modifiche LOCALI non pubblicate. Il repository remoto non è stato modificato.
- La prima revisione grafica è descritta in `docs/revisione-grafica.md`; alcune scelte sono state superate dalle osservazioni dell'utente: in particolare **la stampa deve essere A4 verticale**, non orizzontale.
- Il motore è rimasto invariato. Non usare la versione del motore per identificare la versione dell'interfaccia: sono distinte.

## Identità del progetto
LiquiSite è parte della famiglia GeoHub. Riferimento grafico: https://github.com/fabio-duronio/geohub-sismasite . Conservare IBM Plex Sans/Mono, blu, pannelli bianchi, tabelle numeriche e stile sobrio. Non trasformare l'app in una copia estetica di software commerciali.

I software commerciali consultati sono solo riferimenti funzionali per la qualità della restituzione e non vanno citati nel codice né nei testi dell'app: tavole leggibili, profili allineati, colori con legenda, risultati intermedi ed elaborati inseribili in una relazione tecnica.

## Decisioni vincolanti dell'utente
1. Lavorare localmente e mostrare anteprima, senza pubblicare senza approvazione.
2. Mantenere risultati a tutta larghezza; evitare la lunga colonna di pannelli a sinistra.
3. Report finale A4 VERTICALE, destinato a una relazione tecnica. Le tavole a video possono restare affiancate.
4. Importazione comprensibile a un geologo senza conoscenze informatiche: nomi estesi, unità, modello, spiegazione dei dati e delle colonne.
5. Supportare virgola decimale nei campi ed evitare numeri tagliati nella stratigrafia.
6. Collegare INGV oltre a SismaSite, senza confondere pericolosità di base con amax di sito.
7. Il caso sintetico è stato giudicato poco rappresentativo; il PDF fornito era un riferimento di restituzione. L’ultima richiesta è rimuovere i suoi dati e la demo dedicata. Un eventuale nuovo benchmark va concordato: non è prerequisito per migliorare la UI.
8. Studiare DPSH/N60: **non implementare una conversione universale DPSH→SPT**. Il motore corrente riceve N SPT grezzo, non N60 pre-corretto.
9. FS di riferimento modificabile, predefinito 1,25 (EN 1998-5, § 4.1.4; JRC 2012, § 4.5), con il criterio di verifica dichiarato in stampa: le NTC 2018 non fissano un minimo e il margine è valutato e motivato dal progettista. L'IL resta riferito a FS ≤ 1.
10. Rendere chiaro l'esito locale, senza confonderlo con un giudizio globale di sicurezza. IL è ora calcolato (Iwasaki et al. 1978, citato da LG LQ e CNR 2024; senza classi; Ic oltre soglia: FS N.A. e F(z) = 0 per convenzione operativa dichiarata): resta aperto un caso di riferimento.

## Architettura
- `motore/liquisite.js`: formule e controlli puntuali (invariato, versione 0.3.0).
- `motore/indici.js`: indice IL di Iwasaki (modulo separato, vedi `docs/indice-il.md`).
- `motore/cedimenti.js`: deformazione volumetrica di Zhang et al. (2002), cedimento e LSN, con le convenzioni approvate dall'utente (vedi `docs/cedimenti-lsn.md`).
- `app/profilo.js`: collegamento dei dati al motore, serie e riepilogo.
- `app/progetto.js`: struttura, unità, firma e validazione progetto.
- `app/importa.js`: parsing numerico e importazione.
- `app/ui.js`: eventi, tabella, tavole e stampa.
- `app/grafici.js`: solo rappresentazione Chart.js.
- `app/workspace.js`: finestra di configurazione e azioni principali.
- `app/guida-importa.js`: guida, modelli vuoti e spiegazioni (anche limiti di CPT meccanica e DPSH).
- `app/esempio.js`: progetto di esempio sintetico (dati inventati, seme fisso).
- `app/esclusione.js`: verifica preliminare §7.11.3.4.2 per strato e per sito (usa `criterio1`–`criterio4` del motore; nessuna formula nuova). `dati/fusi-ntc2018.js` è la copia per il browser di `dati/fusi-ntc2018.json` (stesso contenuto, verificato).
- `app/esporta.js`: CSV.

## Disciplina di modifica
- Non duplicare formule nell'interfaccia e non cambiare formule per migliorare i grafici.
- IL (Iwasaki) è implementato in `motore/indici.js` con tratti ignoti mai considerati sicuri (intervallo IL_min–IL_max) e senza classi. Cedimento da CPT (Zhang et al. 2002) e LSN implementati in `motore/cedimenti.js` con intervallo min–max per i tratti ignoti e senza classi; solo con il metodo CPT. Non inventare risultati per lateral spreading: non è implementato.
- PL è una probabilità puntuale del metodo, non LPI/IL.
- Non convertire dati mancanti in zero o esclusioni positive.
- Tabelle, CSV e grafici devono essere coerenti. Ic oltre soglia è visualizzabile, ma non esiste un FS valido per quel punto.
- Non considerare gli intervalli non investigati come sicuri.
- Le dipendenze CDN sono ancora presenti: non dichiarare supporto offline completo.

## Verifiche
Eseguire tutti gli script `verifiche/*.mjs` (comprese `verifica_casuale.mjs`, prove casuali con seme fisso, e `verifica_preliminare.mjs`) e `python3 verifiche/verifica_indipendente.py` e `python3 verifiche/verifica_cedimenti.py`. Controllare inoltre in browser: importazione, virgola decimale, invalidazione/ricalcolo, dialoghi, confronto, CSV/JSON/PNG e stampa A4 verticale, desktop e mobile.

La concordanza dei test non certifica il software per l'uso professionale. Manca una validazione completa su casi reali di riferimento.
