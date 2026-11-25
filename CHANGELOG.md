# Changelog

La versione dell'app e quella del motore di calcolo sono distinte: l'app è indicata in alto e nel piè di pagina della stampa insieme al motore.

## App 1.0.1 — 2026-11-25

Correzioni dall'audit pre-rilascio (mandato del 24/11/2026). **I risultati cambiano in alcuni casi**: motore di innesco 0.3.0 → 0.4.0 (MSF di B&I 2014 limitato a MSFmax, Kσ di Cetin limitato a 0,8–1,6, C_R non definito con aste ≤ 0,118 m, punti oltre il campo per addensamento «non applicabili»); modulo IL 0.2.1 → 0.3.0 (tratti SPT ripartiti dentro lo strato, esclusione motivata di uno strato); modulo cedimenti 0.2.0 → 0.3.0 (εv = 0 oltre il campo per addensamento e negli strati esclusi). La versione dei moduli entra nelle firme: i risultati calcolati con la 1.0.0 risultano «non aggiornati» e vanno ricalcolati. Le correzioni di robustezza (stampa, bozza, controllo dei dati) non cambiano formule. Verifica dei rilievi in `docs/audit-liquisite-1.0.0.md`.

- **Stampa** (rilievi B6.1–B6.3): stampando dal browser (Ctrl+P / Cmd+P o menu) il rapporto si prepara ogni volta (`beforeprint`); prima la pagina era bianca. Con risultati assenti, non aggiornati o con dati da correggere (FS di riferimento, motivazione della Mw) si stampa un foglio «STAMPA NON VALIDA» con il motivo, mai il rapporto. Il rapporto si svuota dopo ogni stampa (`afterprint`), a ogni modifica degli input e a ogni ricalcolo: prima restava in pagina quello dell'ultima stampa e Ctrl+P poteva stampare risultati vecchi. Le tavole dei profili sono sempre le stesse per metodo (verifica, PL, IL e, con CPT, cedimenti), qualunque pannello sia aperto a video; il pulsante «Stampa / PDF» non cambia più scheda. Nuovo controllo nel browser `verifiche/browser/verifica_stampa.mjs` (23 controlli); `verifiche/esegui.mjs --browser` esegue tutti i file `verifiche/browser/verifica_*.mjs`; `npm run test:browser` (usato dal workflow) li esegue tutti con `--solo-browser`.
- **Bozza automatica e avviso in uscita** (rilievo B7): con modifiche non salvate in un file, chiudere o ricaricare la pagina chiede conferma; gli input del progetto (mai i risultati) si copiano nella memoria locale del browser e alla riapertura un riquadro propone di ripristinarli o eliminarli. La bozza passa dalla stessa validazione di un file, si cancella quando il progetto è salvato e non viene sovrascritta finché non si sceglie. Una scheda cancella solo la bozza scritta da lei. Nessun invio in rete. Nuovo controllo nel browser `verifiche/browser/verifica_bozza.mjs` (28 controlli).
- **Controllo dei dati dello scenario** (rilievi B5.1–B5.4): γ_sat minore di γ, o non maggiore di γ_w = 9,81 kN/m³, è ora un errore che impedisce il calcolo; prima era accettato. Con γ_sat > γ_w in ogni strato la tensione efficace è positiva a ogni profondità (controllo prima eseguito solo alla base della stratigrafia). Avvisi di unità, non bloccanti, per γ o γ_sat fuori da 11–27 kN/m³ e per a_max oltre 1 g: accanto ai campi, in «Avvisi e assunzioni», in stampa e nel CSV. Esempio: γ 1,85 e γ_sat 1,98 (g/cm³) con stratigrafia fino a 8 m davano FS 1,99 invece di 1,02 senza alcun messaggio; ora il calcolo è bloccato. Soglie operative dell'app, non normative.
- **File di progetto con profondità ripetute o non crescenti** (audit §4 punto 1): non vengono aperti, come già nell'importazione. Prima si aprivano e indice IL e cedimento risultavano non calcolabili.
- Nuove verifiche: `verifica_validazione.mjs` (31 controlli) e, nel browser, `verifica_dati.mjs` (11 controlli).
- **Identificativo stabile degli strati** (rilievo B4.3): i dati della verifica preliminare (curva granulometrica, campione, giudizio e motivazione del geologo) si collegano allo strato con `stratoId`, non più con le quote da–a. Prima bastava cambiare un confine (1,20 → 1,25 m) per farli sparire da interfaccia e stampa, lasciandoli orfani nel file. I file salvati in precedenza si aprono e si collegano per quote una sola volta, all'apertura. Una voce di uno strato eliminato non si riaggancia a uno strato nuovo con le stesse quote. L'identificativo non entra nel calcolo né nella firma degli input (la firma resta quella della 1.0.0). Formato del file compatibile: campi `id` degli strati e `stratoId` delle voci facoltativi. Nuove verifiche: `verifica_strati.mjs` (27 controlli) e, nel browser, `verifica_strati.mjs` (4); in `verifica_sicurezza.mjs` la motivazione della M_w è riconosciuta come testo libero (mostrata sempre con escape), come la motivazione del criterio 4.

### Correzioni conformi alla fonte (onda 2)

- **MSF di Boulanger & Idriss 2014 limitato a MSF_max** (rilievo B3.1, motore): l'Eq. 2.18 era applicata senza limite e sotto M_w = 5,25 superava MSF_max (M_w 4,5 e MSF_max 2,2: 2,776 invece di 2,2). Il rapporto definisce MSF_max come il valore massimo che l'MSF può assumere per un terremoto di piccola magnitudo, assegnato a M = 5,25 (App. A, pag. 117, 126 e 127; §2.5, pag. 12); le curve della Fig. 2.6 (pag. 14) sono costanti sotto M = 5,25. Effetto: per M_w < 5,25 FS e CRR al sito scendono (cautelativo), fino a −21 % a seconda di M_w e MSF_max (con MSF_max 1,1 / 1,8 / 2,2: M_w 5,0 −1,3 % / −6,2 % / −7,6 %; M_w 4,5 −4,2 % / −17,6 % / −20,7 %). Per M_w ≥ 5,25 nessun cambiamento. Corretta anche `verifiche/verifica_indipendente.py`, che replicava l'errore e quindi non poteva intercettarlo; i suoi casi casuali B&I ora comprendono M_w 4,0–7,8. Nuovi controlli in `verifica_motore.mjs` (7), che falliscono sul motore precedente. Versione del motore da aggiornare al rilascio.
- **Punti oltre il campo della correlazione per addensamento** (rilievi B1.a, B1.b, B1.d, B1.e; classe C, nessuna formula modificata): con Boulanger & Idriss 2014, q_c1Ncs > 211 (CPT) o (N1)60cs > 37 (SPT), il punto è dichiarato non liquefacibile per addensamento (`non_applicabile`, codice `OLTRE_CAMPO_ADDENSAMENTO`): niente CRR, FS e P_L; F = 0 nell'indice IL ed ε_v = 0 nel cedimento, con spessore e assunzione dichiarati. Soglie scelte da LiquiSite (approvate il 25/11/2026), non indicate dagli autori: sono i valori a cui gli autori limitano C_σ (Eq. 2.16); alla soglia CRR7,5 = 3,72 (CPT) e 1,75 (SPT). Prima: FS fino a 10²¹² in tabella e nel grafico (asse fino a 1,5·10¹⁰) e, al rifiuto, overflow numerico che rendeva il livello più addensato «senza risultato» (F = 1 nell'IL massimo, ε_v 5,80 % nel cedimento massimo). La resistenza normalizzata di questi punti resta in tabella, nei grafici e nel criterio 3 della verifica preliminare. Pannello «Domanda e resistenza» con asse fino a 1,0 e nota dei valori fuori scala. `verifica_riferimento.mjs` controlla anche che nelle 9 righe dell'esempio pubblicato con q_c1Ncs > 211 il CRR7,5 sia al tetto di 2,0 usato dagli estensori; `verifica_indipendente.py` applica la stessa soglia. Nuova verifica `verifica_addensamento.mjs` (30 controlli). Versioni dei moduli IL e cedimenti da aggiornare al rilascio.
- **Kayen et al. (2013), V_s: soglia di addensamento** (rilievo B1.c, motore; classe C, nessuna formula modificata). Introdotta la soglia V_s1 > 277 m/s (dopo C_Vs ≤ 1,5): il punto è dichiarato non liquefacibile per addensamento (`non_applicabile`, codice `OLTRE_CAMPO_ADDENSAMENTO`, stesso stato di Boulanger & Idriss 2014), senza CRR, FS e P_L; F = 0 nell'indice IL, dichiarato e con spessore a parte. La soglia corrisponde a CRR7,5 ≈ 2,0 ed è una scelta applicativa di LiquiSite, non un limite pubblicato dagli autori. Il campo dei casi della banca dati degli autori (Tabella S1) non è documentato nel repository e non è citato come giustificazione: la soglia resta una scelta applicativa, da rivedere quando la tabella sarà disponibile. Prima: V_s 800 m/s dava CRR ≈ 8,4·10²⁹ e FS senza alcun avviso. Confronto stretto (277,00 si calcola, 277,01 no); FC e σ'_v0 spostano la soglia di circa 1 m/s. Nuovi controlli in `verifica_addensamento.mjs` (12; 42 in tutto); `verifica_indipendente.py` allineata. Versione del motore da aggiornare al rilascio.
- **K_σ di Cetin et al. 2018 limitato a 0,8–1,6** (rilievo B3.2, motore): il limite dell'Eq. 14 (SDEE, pag. 706, letto sull'immagine della pagina) era solo segnalato con un avviso; nel CRR e nella P_L (Eq. 10–11) il termine −θ₃ ln(σ'_v/P_a), pari a θ₆ ln K_σ, restava libero. Ora si usa K_σ limitato, come nel percorso «per parti» degli autori (Eq. 13–15), con l'avviso `KSIGMA_LIMITATO`. Effetto: nei primi metri sotto la falda (σ'_v < 0,247 atm, circa 25 kPa) CRR e FS scendono, cautelativo (a 0,5 m con falda al p.c. K_σ passa da 2,83 a 1,6: FS −43 %); oltre σ'_v ≈ 1,94 atm (circa 197 kPa) K_σ sale a 0,8, come prescritto dagli autori. Corretta anche `verifica_indipendente.py`, che replicava l'errore. Nuovi controlli in `verifica_motore.mjs` (7).
- **C_R di Cetin et al. 2018 con aste troppo corte** (rilievo B3.3, motore; classe C, decisione D4 del 25/11/2026): la Tab. 2 di MethodsX (pag. 1562, letta sull'immagine) dà C_R = 0,48 + 0,225·ln(d) senza lunghezza minima delle aste. Per d ≤ 0,118 m la formula dà C_R ≤ 0 e il motore restituiva N1,60 negativo come «calcolato»; ora il punto è «non applicabile» (codice `CR_NON_DEFINITO`) con un motivo che chiede la sporgenza delle aste. Nessuna altra soglia: sopra 0,118 m la formula resta come pubblicata (C_R basso abbassa N1,60 e il FS, effetto cautelativo). Il limite «aste ≥ 0,5 m, C_R ≥ 0,50» proposto dall'audit non è nella fonte. Nuovi controlli in `verifica_motore.mjs` (5); `verifica_indipendente.py` allineata.
- **Verifica preliminare, criterio 3: copertura delle prove e «sabbia pulita»** (rilievi B4.1–B4.2, `app/esclusione.js`; classe A, decisione D5 del 25/11/2026). Sono criteri di screening applicativi di LiquiSite, non tolleranze né prescrizioni delle NTC 2018. **Copertura:** prima la tolleranza era 1,5 volte il passo mediano della prova (strato saturo 0–20 m con SPT a 2 e 10 m: tolleranza 12 m, esito «verifica omessa ai sensi del §7.11.3.4.2, criteri 3–4» con 10 m non indagati). Ora è fissa e indipendente dal passo: 1,5 m per le SPT e 0,25 m per le CPT, tra il tetto saturo dello strato e la prima prova, tra ogni coppia di prove consecutive e tra l'ultima prova e il letto (o 20 m). Basta un intervallo strettamente oltre tolleranza perché il criterio 3 non sia soddisfatto per lo strato; i tratti scoperti sono identificati (nell'esempio: 0–2, 2–10 e 10–20 m) e riportati a parte in verifica preliminare, stampa e CSV, senza essere considerati sicuri. Prima il criterio restava «dati insufficienti»: ora è «non soddisfatto». **Sabbia pulita:** se la dichiarazione è contraddetta dai dati il criterio 3 non è soddisfatto, senza deroga, con un messaggio che suggerisce di dividere lo strato: con FC noto (dato della prova o della stratigrafia) FC > 5 % non è ammessa; con CPT senza FC misurato non è ammessa se Ic > 1,775 in almeno un punto saturo (FC ≈ 5 % da B&I 2014, Eq. 2.30 con C_FC = 0; valore centrale della stima di FC da Ic, l'incertezza di ±0,29 su Ic non è considerata); con CPT e FC misurato prevale il FC misurato; con SPT senza FC misurato nessun controllo. Prima: «sabbia pulita» con FC 35 % dava «verifica omessa» senza alcun avviso. Il criterio 4 e gli altri criteri non cambiano; l'esito della verifica preliminare non modifica FS, IL e cedimento. Nuova verifica `verifica_copertura.mjs` (46 controlli); in `verifica_preliminare.mjs` due controlli aggiornati alla nuova regola (prima «dati insufficienti»).
- **Demo sintetica e salvataggio della prova: comportamento coerente** (audit §4 punti 6 e 9, `app/ui.js`, `index.html`). «Demo sintetica» e «Esplora l'esempio» sono lo stesso comando e calcolano subito lo scenario attivo (prima la demo apriva il progetto senza risultati); gli altri scenari dell'esempio si calcolano quando si aprono (cambio di scenario o di prova), solo per le prove dichiarate di esempio. Dopo «Salva la prova» (o «Salva le modifiche») il dialogo di importazione si chiude e compare un avviso con il pulsante «Vai allo scenario», che apre la sezione Scenario come il pulsante «Scenario»; prima il dialogo restava aperto. Nessuna funzione nuova: «Applica Mw» e la copia di stratigrafia e falda tra scenari (punto 5) restano fuori, rinviate. Nuovo `browser/verifica_flusso.mjs` (9 controlli, falliscono sul codice precedente). Punto 4 (cedimento oltre 20 m): non riprodotto, il calcolo si ferma già a 20,00 m; aggiunti 3 controlli di non regressione in `verifica_cedimenti.mjs` (51).
- **Confronto tra scenari: nota sui FS non omogenei** (audit §3.1 punto 4, `app/ui.js`). Quando il confronto mette insieme metodi diversi, la nota sotto il grafico dichiara che i FS non sono omogenei (ogni metodo ha la propria definizione di FS, riportata nella nota) e che il confronto è puntuale, non un giudizio di sicurezza. Solo testo: nessun calcolo nuovo (il CRR di Cetin a PL 15 % resterebbe una funzione nuova e non è aggiunto).
- **Controlli: dipendenze Python fissate** (`verifiche/requirements.txt`: numpy 2.5.3, pyproj 3.8.0, shapely 2.2.0). `verifica_zs9.py` (13 località e 150 punti casuali, confronto con il modulo ZS9 di SismaSite) si esegue con `pip install -r verifiche/requirements.txt`; il 25/11/2026: superata.
- **Grafici e interfaccia** (rilievi §4 punto 10 e accessibilità, `app/grafici.js`, `app/ui.js`, `css/liquisite.css`, `index.html`). Nel confronto, «FS = 1» e «FS rif 1,10» non si sovrappongono più: con riferimenti più vicini di 16 px la seconda etichetta passa sull'altro lato della linea. «falda» è allineata al bordo destro del grafico, sotto la linea se questa è vicina al bordo superiore. Nel grafico dei fusi granulometrici i nomi delle classi (compreso «GHIAIA») sono disegnati dopo i fusi, su fondo bianco, e omessi se la banda è troppo stretta. Il campo di testo della curva granulometrica mostra 10 righe (l'ottava era tagliata). Il numero d'ordine dei grafici (`.track-no`) passa da #8294a9 a #5b6b80: contrasto 5,0:1 su #f3f6fa, prima 2,9:1 (soglia AA 4,5:1). FC è indicato come «passante a 0,075 mm» nella tabella degli strati e nei suggerimenti. Nuovo `verifica_grafici.mjs` (8 controlli, contesto simulato, senza browser). Non riprodotti o non confermati, nessuna modifica: «falda» tagliata a 1440×900, tab nel dialog, intestazione fissa.
- **Cancello di versione del file di progetto**: un file con `versioneFormato` maggiore di quello che l'app legge (1) non si apre e il messaggio dice «File creato con una versione più recente di LiquiSite: aggiorna l'app». Prima il messaggio era un generico «dati non validi». Serve perché le versioni successive aggiungeranno campi: una versione che non li conosce li perderebbe in silenzio al salvataggio successivo. Il progetto corrente non viene modificato. Test in `verifica_profilo.mjs` (6 controlli nuovi; più 1 sulla coincidenza di ?v= con la versione dell'app: 146 in tutto).
- **Firma del rapporto e versioni dei moduli in stampa e CSV** (rilievo 13.a, `app/progetto.js`, `app/ui.js`, `app/esporta.js`). La firma degli input (di calcolo) non cambia con il FS di riferimento e con la Verifica preliminare, perché non cambiano i risultati. Le due firme sono ora impronte SHA-256 (prima FNV-1a a 32 bit, 8 cifre): in stampa e nei margini le prime 16 cifre, con la dicitura «SHA-256: primi 16 caratteri di 64; firma completa nel CSV», nel CSV la firma intera. Le firme non sono salvate nei file di progetto, che si ricalcolano all'apertura: nessun file precedente è toccato. Si aggiunge una firma del rapporto, distinta, che comprende la firma di calcolo, il FS di riferimento, i dati della Verifica preliminare e le versioni di motore, indici, cedimenti e ZS9. Compare nel piè di pagina della stampa, nei margini di pagina e nel CSV, insieme alle versioni dei moduli (prima assenti). Nuovo `verifica_firma.mjs` (20 controlli, tra cui i vettori NIST di SHA-256 e il confronto con Node su 13 lunghezze di testo).
- **NOTICE e testo della Mw** (rilievo 13.a): tolte le voci dell'indice LSN (non calcolato dalla 1.0); la fonte dell'indice IL è ora Iwasaki, Tokida e Tatsuoka (1981), Eq. 5, pag. 210, con Tatsuoka et al. (1980), Eq. 29a, pag. 107, e le Linee guida LQ e CNR-CentroMS (2024) come fonti che lo riportano; Tonkin & Taylor (2015) resta per l'uso delle curve di Zhang et al. con B&I 2014. Nel testo del criterio della Mw (`app/magnitudo.js`) tolto il riferimento interno «decisione del 12/11/2026»: resta «criteri applicativi di GeoHub».
- **Verifica preliminare, criterio 3: prova al letto dell'ultimo strato** (audit §4 punto 3, `app/esclusione.js`; classe A). Una prova a z = letto dell'ultimo strato (per esempio a 20,00 m) era scartata dal criterio 3 perché il filtro usava z < a; con una sola prova a quella quota lo strato risultava «nessun punto» e il criterio non valutabile. Ora il letto dell'ultimo strato appartiene all'ultimo strato, come nell'assegnazione delle prove agli strati per l'IL; per gli strati intermedi z = a resta dello strato sotto. Nessuna formula cambia. Tre controlli in `verifica_copertura.mjs` (49).
- **Esclusione motivata di uno strato da IL e cedimento** (rilievo B2.3, `app/esclusione.js`, `app/profilo.js`, `motore/indici.js`, `motore/cedimenti.js`; decisione D3 del 25/11/2026). Funzione nuova, opzionale, spenta nei file precedenti (strato non escluso, stessa firma degli input). Per ogni strato si può dichiarare `escluso_motivatamente` con un criterio (criterio 4 di Fig. 7.11.1 confermato nella Verifica preliminare per quello strato; substrato lapideo; terreno coesivo, giudizio del geologo con i parametri di plasticità in motivazione; altro) e una motivazione non vuota. Nello strato escluso F = 0 è dichiarato nell'IL, anche dove ci sono prove (IL_min e IL_max non cambiano per questi tratti, nuova categoria distinta dai tratti senza risultato), εv = 0 nel cedimento, e lo spessore escluso è riportato a parte (schermata, stampa, CSV). Con le prove SPT lo strato è escluso per intero (tutti i tratti della partizione D2). Il FS resta calcolato ma è mostrato come «non considerato»; con FS < 1 compare un avviso non bloccante («metodi tarati su terreni granulari»). Senza criterio, senza motivazione o con il criterio 4 non confermato lo strato resta incluso, con avviso. È una convenzione applicativa di GeoHub, non un'esclusione «ai sensi del §7.11.3.4.2»; nessun autore/data; il controllo di completezza verifica solo la presenza. Esempio «S1 SPT» con i limi argillosi esclusi (coesivo): non più IL 1,24–26,51. Nuovo `verifica_esclusione_strati.mjs` (45 controlli; sul codice precedente non si esegue: manca la funzione).
- **Indice IL con prove SPT: tratto rappresentato da ogni prova** (rilievi B2.1–B2.2, `motore/indici.js`; classe A, decisione D2 del 25/11/2026). **Cambia l'IL di tutti i sondaggi SPT.** Prima l'intervallo di ogni prova era metà del passo mediano di tutta la verticale, tagliato ai limiti dello strato: con una sola prova nello strato l'intervallo era nullo (lente 4–6 m con FS 0,36: IL_min 0,00, spessore 0,00 m) e l'intervallo di una prova cambiava aggiungendo prove in altri strati (prova a 4 m: 3,00–5,00 m con 2 prove, 3,50–4,50 m con 2 prove in più a 15 e 17 m). Ora le prove dello stesso strato si dividono lo strato a metà distanza tra prove consecutive (o alla falda, se cade tra due prove), dal tetto al letto; con una sola prova l'intervallo è lo strato intero; le prove di altri strati non contano. Stessi casi: IL_min 9,67 e spessore 2,00 m; prova a 4 m sempre 3,00–5,00 m. Esempio «S1 SPT»: IL da 1,24–26,58 a 1,24–26,51 (la prova a 18,5 m, FS 1,54, copre ora fino al letto dello strato a 20 m; tratti senza risultato da 4,30 a 3,80 m). Prove CPT e V_s invariate. Nuovi controlli in `verifica_il.mjs` (13; un controllo della regola precedente sostituito); in `verifica_casuale.mjs` il punto reso ignoto conserva i limiti dello strato.

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
