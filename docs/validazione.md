# Validazione

Come sono controllati i calcoli di LiquiSite.

[← Torna al README](../README.md)

La validazione si articola su quattro livelli distinti, più una prova d'uso su dati reali.

- **Valori pubblicati dagli autori.** `verifica_motore.mjs` contiene tre gruppi di confronti:
  - l'esempio numerico completo di Cetin et al. (2018, MethodsX: Tab. 3 ed Eq. 29–54);
  - i valori dichiarati nel testo di Boulanger & Idriss (2014);
  - le letture delle figure di Boulanger & Idriss (2014) e di Kayen et al. (2013).
- **Seconda implementazione indipendente.** Gli script Python ricalcolano senza riusare codice dell'app:
  - `verifica_indipendente.py` copre i quattro metodi di innesco, su 8000 casi casuali;
  - `verifica_cedimenti.py` copre la deformazione volumetrica di Zhang et al. (2002) su 3000 casi, con scarto massimo 9·10⁻¹⁶. Ricalcola anche il cedimento su profili casuali con integrazione numerica a passo 1 mm.
  - L'indice IL è ricontrollato per campionamento fitto su 300 profili casuali, con scarto massimo circa 6·10⁻¹³.
- **Casi analitici e proprietà.** Ecco cosa si controlla:
  - profili con soluzione esatta: IL = 50 per FS 0,5 su 0–20 m; cedimento di uno strato uniforme;
  - criteri di esclusione sulle soglie;
  - input non validi, dati mancanti e vuoti di indagine;
  - coerenza tra tabelle, CSV, grafici e progetto salvato;
  - prove casuali ripetibili (seme fisso).
- **Confronto con un calcolo pubblicato completo** (vedi sotto).

## Caso di riferimento: National Academies (2024), App. G

Fonte: *Pile Design for Downdrag: Examples and Supporting Materials*, Appendice G, Design Example 5 (Blytheville, Arkansas). È una verifica Boulanger & Idriss (2014) da CPTU, Evento 1: a_max 0,10 g, M_w 6,5, falda a 1 ft. Le Tabelle G3–G7 sono trascritte in `verifiche/dati/nasem2024-blytheville.json`; il test è `verifiche/verifica_riferimento.mjs`.

| Confronto | Esito |
|---|---|
| Punto calcolato in dettaglio a 24,93 ft (Tab. G4) | FS 1,090 contro 1,08 pubblicato |
| Profilo intero: 58 righe sotto falda entro 20 m (Tab. G5–G6) | C_N, q_c1N, q_c1Ncs entro lo 0,15 %; r_d, K_σ, MSF, CSR, CRR entro l'arrotondamento della tabella (2 decimali) |

**Note sul confronto.**

- **Ic.** L'esempio calcola l'esponente n con l'iterazione di Robertson (2009); LiquiSite usa la regola di Robertson & Wride (1998) adottata da Boulanger & Idriss (2014). Per confrontare la catena di calcolo il test impone il contenuto di fini ricavato dall'Ic pubblicato. Con l'Ic calcolato da LiquiSite il FS cambia di qualche punto percentuale, per esempio 1,13 contro 1,08 a 24,77 ft.
- **Convenzioni dell'esempio non adottate da LiquiSite:**
  - q_c1Ncs limitato a 254 anche fuori dal calcolo dell'esponente m;
  - CRR limitato a 2,0 (LiquiSite non limita il CRR: con q_c1Ncs > 211 dichiara il punto oltre il campo della correlazione; nelle 9 righe dell'esempio con q_c1Ncs > 211 il CRR7,5 pubblicato è al tetto di 2,0);
  - FS posto pari a 2,0 dove Ic ≥ 2,6;
  - peso di volume stimato dalla CPT.
- **Refusi del documento**, senza effetto sui valori numerici:
  - nella Tabella G7 la colonna «FS» contiene il parametro FS_α del metodo dei cedimenti, non il fattore di sicurezza;
  - nella Tabella G5 la colonna «σ'vo» contiene la tensione totale;
  - nelle formule stampate le Eq. 2, 8 e 20 contengono errori di trascrizione.
- **Cedimento.** L'esempio usa Yoshimine et al. (2006), non Zhang et al. (2002): il confronto è solo indicativo. Con Zhang si ottiene circa 1,8 in contro 2,46 in, anche perché sono pubblicate solo le righe a passo 0,984 ft.

## Eseguire le verifiche

Servono Node.js (18 o successivo) e Python 3. Dalla radice del repository:

```bash
node verifiche/esegui.mjs              # verifiche numeriche (Node.js e Python)
npm install && npx playwright install chromium
node verifiche/esegui.mjs --browser    # anche il controllo nel browser
```

Le verifiche numeriche non hanno dipendenze; il controllo nel browser richiede Playwright con Chromium. Ogni script termina con codice di uscita diverso da zero se un controllo non è superato. Lo stesso insieme viene eseguito automaticamente a ogni push e pull request (`.github/workflows/verifiche.yml`).

| Script | Contenuto | Controlli |
|---|---|---|
| `verifica_motore.mjs` | valori pubblicati dagli autori | 123 |
| `verifica_robustezza.mjs` | input non validi, soglie, stati di esito, convergenza | 262 |
| `verifica_esclusione.mjs` | criteri 1–4 e fusi digitalizzati della Fig. 7.11.1 | 33 |
| `verifica_profilo.mjs` | profilo, importazione, unità, CSV, progetto JSON, motivi degli intervalli, etichetta «sopra falda» con Ic oltre soglia, punto a z = 0, unità nelle intestazioni | 139 |
| `verifica_il.mjs` | indice IL: profili analitici, seconda implementazione, falda come confine, limiti di strato per le SPT | 67 |
| `verifica_preliminare.mjs` | verifica preliminare per strato e per sito, carta di comportamento, esempio completo | 57 |
| `verifica_cedimenti.mjs` | equazioni di Zhang et al. (2002), cedimento, assenza dell'LSN, integrazione ferma a 20 m (audit §4 punto 4) | 51 |
| `verifica_riferimento.mjs` | caso pubblicato National Academies (2024) | 26 |
| `verifica_casi_pubblicati.mjs` | confronti indicativi su figure digitalizzate: IL su due profili di Iwasaki et al. (1981), cedimento sul profilo di esempio di Zhang et al. (2002) | 4 |
| `verifica_casuale.mjs` | prove casuali ripetibili (opzioni `--casi`, `--seme`) | 20 |
| `verifica_restituzione.mjs` | coerenza di Ic tra grafici, tabelle e CSV | 6 |
| `verifica_usabilita.mjs` | decimali, intestazioni senza dati, incolla da foglio elettronico | 12 |
| `verifica_unita.mjs` | controllo di plausibilità delle unità all'importazione: avvisi non bloccanti su qc, fs, u2, profondità, N, Vs, FC e sul rapporto fs/qc; nessun falso positivo sull'esempio | 23 |
| `verifica_validazione.mjs` | congruenza dei pesi di volume (γ_sat < γ, γ_sat ≤ γ_w), σ'v positiva a ogni profondità su 400 stratigrafie casuali, avvisi di unità su γ e a_max, profondità dei file di progetto (audit B5, §4 punto 1) | 31 |
| `verifica_strati.mjs` | id stabili degli strati: collegamento dei dati della verifica preliminare dopo un cambio di quota, salvataggio e riapertura, file della 1.0.0 senza id, file alterati, firma indipendente dagli id (audit B4.3) | 27 |
| `verifica_addensamento.mjs` | punti oltre il campo della correlazione per addensamento (B&I 2014, q_c1Ncs > 211, (N₁)₆₀cs > 37): stato e motivo, nessun errore numerico fino al rifiuto, F = 0 e ε_v = 0, grafici, tabelle, CSV, criterio 3 (audit B1); Kayen 2013, Vs1 > 277 m/s (B1.c) | 42 |
| `verifica_copertura.mjs` | criterio 3: tolleranza di copertura fissa (SPT 1,5 m, CPT 0,25 m, limiti esatti, tratti scoperti), «sabbia pulita» contraddetta da FC > 5 % o Ic > 1,775, CSV (audit B4.1–B4.2, decisione D5; letto dell'ultimo strato, §4 punto 3) | 49 |
| `verifica_esclusione_strati.mjs` | esclusione motivata di uno strato da IL e cedimento: IL senza lo strato, F = 0 e εv = 0 dichiarati, criterio e motivazione obbligatori, criterio 4 solo se confermato, firma degli input, file precedenti, SPT per strato intero, avviso FS < 1, CSV (audit B2.3, decisione D3) | 45 |
| `verifica_firma.mjs` | firme SHA-256 (vettori NIST, confronto con Node), firma del rapporto distinta dalla firma di calcolo: FS di riferimento, Verifica preliminare e versioni dei moduli (audit 13.a), CSV | 20 |
| `verifica_grafici.mjs` | etichette dei grafici su contesto simulato: «falda» a destra, riferimenti FS ravvicinati su lati opposti, nomi delle classi granulometriche su fondo bianco (audit §4 punto 10) | 8 |
| `verifica_versioni.mjs` | parametro `?v=` dei file in `index.html` uguale alla versione dell'app (Chart.js: la propria), per evitare copie vecchie in cache | 23 |
| `verifica_sicurezza.mjs` | apertura di progetti alterati (tipi, valori enumerati, proprietà ereditate, ID, risultati), 1500 alterazioni casuali, FS di riferimento senza ripiego | 73 |
| `verifica_zs9.mjs` | modulo ZS9 copiato da SismaSite, con gli stessi casi: località di controllo, casi limite, casi A–G della specifica del 15/11/2026 | 57 |
| `verifica_magnitudo.mjs` | livello applicativo della M_w: impronte dei file copiati, coordinate, proposta per le località di controllo, motivazione sempre obbligatoria, avvisi < 5 e < 5,5, formato del progetto, coordinate fuori dal calcolo, testi di stampa | 96 |
| `verifica_zs9.py` | seconda implementazione della procedura ZS9 (shapely, GeographicLib) su 13 località e 150 punti casuali; script di SismaSite invariato | – |
| `browser/verifica_browser.mjs` | nel browser: file alterati e valori iniettati in memoria senza esecuzione di codice; testo libero in tutte le schede, nel confronto e in stampa; FS di riferimento non valido con stampa e CSV bloccati; conferma per modifiche non salvate; intestazione e piè di pagina di stampa; nessuna richiesta esterna né violazione della CSP; testi del confronto, del riepilogo e della stampa; magnitudo M_w: coordinate, proposta, motivazione sempre obbligatoria con stampa e CSV bloccati, avvertenza sul datum e assenza dell'LSN in stampa, tabella delle 36 zone in app e in stampa | 54 |
| `browser/verifica_strati.mjs` | nel browser: cambio di quota nella tabella degli strati con curva e campione conservati, id degli strati aggiunti (audit B4.3) | 4 |
| `browser/verifica_stampa.mjs` | nel browser: stampa con Ctrl+P (beforeprint/afterprint) senza e con risultati, foglio «STAMPA NON VALIDA», svuotamento dopo modifiche e stampe, tavole indipendenti dalla vista (audit B6) | 23 |
| `browser/verifica_bozza.mjs` | nel browser: avviso in uscita, bozza dei soli input nella memoria locale, ripristino ed eliminazione, bozza alterata validata come un file, memoria locale non disponibile, più schede (audit B7) | 28 |
| `browser/verifica_dati.mjs` | nel browser: avvisi di unità e errori dei pesi di volume accanto ai campi, nella scheda degli avvisi e in stampa (audit B5) | 11 |
| `browser/verifica_flusso.mjs` | nel browser: «Demo sintetica» calcola, scenari dell'esempio calcolati all'apertura, dialogo che si chiude dopo «Salva la prova» con «Vai allo scenario», asse del pannello 03, FC a 0,075 mm, nota di non omogeneità nel confronto (audit §4 punti 6 e 9, B1.e, §3.1) | 12 |

### Conteggi per file (esecuzione del 25/11/2026, `node verifiche/esegui.mjs --browser`)

**JavaScript (Node)**

| File | Controlli | Esito |
|---|---|---|
| `verifica_addensamento.mjs` | 42 | superato |
| `verifica_casi_pubblicati.mjs` | 4 | superato |
| `verifica_casuale.mjs` | 20 | superato |
| `verifica_cedimenti.mjs` | 51 | superato |
| `verifica_copertura.mjs` | 49 | superato |
| `verifica_esclusione.mjs` | 33 | superato |
| `verifica_esclusione_strati.mjs` | 45 | superato |
| `verifica_firma.mjs` | 20 | superato |
| `verifica_grafici.mjs` | 8 | superato |
| `verifica_il.mjs` | 80 | superato |
| `verifica_magnitudo.mjs` | 96 | superato |
| `verifica_motore.mjs` | 142 | superato |
| `verifica_preliminare.mjs` | 57 | superato |
| `verifica_profilo.mjs` | 139 | superato |
| `verifica_restituzione.mjs` | 6 | superato |
| `verifica_riferimento.mjs` | 26 | superato |
| `verifica_robustezza.mjs` | 262 | superato |
| `verifica_sicurezza.mjs` | 73 | superato |
| `verifica_strati.mjs` | 27 | superato |
| `verifica_unita.mjs` | 23 | superato |
| `verifica_usabilita.mjs` | 12 | superato |
| `verifica_validazione.mjs` | 31 | superato |
| `verifica_versioni.mjs` | 23 | superato |
| `verifica_zs9.mjs` | 57 | superato |
| **Totale JavaScript** | **1326** | 24 file, tutti superati |

**Python** (non si sommano ai controlli: sono confronti su casi)

| File | Contenuto | Esito |
|---|---|---|
| `verifica_cedimenti.py` | 3000 casi di εv e 40 profili di S, differenza massima 8,9·10⁻¹⁶ % | superato |
| `verifica_indipendente.py` | 4 metodi × 2000 casi casuali (8000), differenza relativa massima 1,07·10⁻⁷ | superato |
| `verifica_zs9.py` | 20 controlli: SHA-256 dei dati, 36 zone, 13 località, 150 punti casuali (126 esterni, 4536 distanze), scarto massimo 0,00 m | superato |

`verifica_zs9.py` richiede `pip install -r verifiche/requirements.txt` (numpy 2.5.3, pyproj 3.8.0, shapely 2.2.0).

**Browser (Chromium)**

| File | Controlli | Esito |
|---|---|---|
| `browser/verifica_bozza.mjs` | 28 | superato |
| `browser/verifica_browser.mjs` | 54 | superato |
| `browser/verifica_dati.mjs` | 11 | superato |
| `browser/verifica_flusso.mjs` | 12 | superato |
| `browser/verifica_stampa.mjs` | 23 | superato |
| `browser/verifica_strati.mjs` | 4 | superato |
| **Totale browser** | **132** | 6 file, tutti superati |

Totale conteggiato dal programma (JavaScript + browser): **1458**. Nella 1.0.0 erano 1122 JavaScript e 54 nel browser; i controlli aggiunti sono nuovi file e nuove sezioni di file esistenti, non controlli rimossi.

I payload dei test di sicurezza sono innocui: al massimo impostano una variabile di prova.

## Prova d'uso su dati reali (22/11/2026)

Non è una validazione: serve a provare il percorso completo su dati misurati e a trovare errori d'uso. I dati non sono nel repository.

- **Dati**: 10 CPT del sito 185130 (U505–U514), terremoto dell'Emilia del 20/05/2012 (M_w 6,1), dal database di Geyin & Maurer (2021), *CPT-Based Liquefaction Case Histories from Global Earthquakes: A Digital Dataset*, DesignSafe-CI, doi 10.17603/ds2-wftt-mv37, licenza Open Data Commons Attribution.
- **Ipotesi**: strato unico (γ 18, γ_sat 19 kN/m³); contenuto di fini stimato dal metodo; a_max uguale alla PGA del database; qc e fs misurati, senza correzioni.
- **Esiti**: il FS minimo (0,22–0,26) non distingue le prove; IL e spessore con FS < 1 separano le 7 prove con manifestazioni superficiali da U510 e U511 (senza), con l'eccezione di U509 (falda a 2,37 m, IL 35,9, senza manifestazioni). L'IL varia di circa il 40–60 % con la soglia di Ic tra 2,4 e 2,8; i FS minimi cadono oltre 10 m, dove il metodo segnala l'incertezza di r_d.
- **Correzioni emerse**, rilasciate con la 0.4.2: punto a z = 0, controllo di plausibilità delle unità, unità lette dalle intestazioni.
- **Lettura** (decisione del 22/11/2026): la sensibilità alla soglia di Ic e l'incertezza oltre 10 m sono limiti dei metodi, già segnalati dagli avvisi dell'app e descritti in [Uso e limiti](app.md#limiti); non richiedono correzioni.

## Limiti della validazione

I test controllano che le equazioni siano implementate come pubblicate e che l'app le applichi in modo coerente. Non certificano l'idoneità dello strumento per un caso specifico: la scelta dei parametri e l'interpretazione dei risultati restano del professionista.

Stato delle fonti (decisioni del 22/11/2026, versione 1.0):

- **Indice IL**: formula verificata su Iwasaki, Tokida e Tatsuoka (1981), Eq. 5, citata come fonte, e su Tatsuoka et al. (1980), Eq. 29a. I confronti con i casi del 1981 sono indicativi, perché i profili sono digitalizzati da figure.
- **Cedimento** (Zhang et al. 2002): equazioni implementate come pubblicate nell'originale; convenzioni decise e dichiarate ([Cedimenti](cedimenti.md)). Il confronto con le Tabelle 1 e 3 non è possibile, perché l'articolo non pubblica le CPT; resta il confronto indicativo con la Fig. 5.
- **Indice LSN**: non calcolato dalla versione 1.0.
