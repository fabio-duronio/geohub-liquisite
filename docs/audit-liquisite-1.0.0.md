# Verifica dell'audit pre-rilascio su LiquiSite v1.0.0

**Data:** 24/11/2026 · **Codice verificato:** commit `c6784f1` (app 1.0.0, motore 0.3.0, indici 0.2.1, cedimenti 0.2.0) · **Fase:** 1 del mandato del 24/11/2026 — verifica, **nessuna correzione al codice**.

## 1. Come è stata fatta la verifica

- Ogni rilievo è stato **riprodotto** sul codice di `c6784f1`, non accettato sulla parola. Gli script sono:
  - `verifiche/audit/riproduci_audit_1.0.0.mjs` (motore e app in Node, 25 controlli);
  - `verifiche/audit/riproduci_audit_browser.mjs` (stampa, persistenza, flusso, contrasto; 8 controlli in Chromium).

  Ogni controllo descrive il comportamento **atteso dopo la correzione**: oggi deve dare «DIFETTO PRESENTE». Quando un rilievo sarà corretto, il controllo passerà a «ok» e potrà entrare in `npm test` come test di non regressione (prima fallisce, poi passa).
- I valori numerici dell'audit dipendono dai dati usati, che l'audit non riporta per intero: qui si confermano **l'ordine di grandezza e il meccanismo**, con i valori misurati dagli script.
- **Fonti lette in questa sessione:** schede di progetto `claude/liquisite-metodo-bi2014.md` e `claude/liquisite-metodi-cetin-kayen.md` (trascritte il 09–10/11 dalle pagine dei PDF originali). **I PDF originali di B&I 2014 e Cetin 2018 non sono stati riletti**: dove la scheda non basta, il punto è «da leggere sul PDF».
- **Numeri di riga dell'audit:** molti non corrispondono a `c6784f1` (es. `BI.msf` è a `motore/liquisite.js:361`, non 357; `categoriaIL` è a `app/profilo.js:242`, non 86; `@media print` è a `css/liquisite.css:222`, non 760; `verifica_indipendente.py:43`, non 45). Nella tabella si riportano solo le righe ricontrollate.

### Classi d'intervento (dal mandato)
- **A — robustezza:** nessun cambiamento di fisica nel campo di validità (stati, avvisi, validazione, stampa, salvataggio, grafici).
- **B — conformità alla fonte:** una formula o un limite cambia **solo** se la fonte originale lo dice (equazione e pagina nel codice).
- **C — fuori campo:** il limite non è confermabile; non si tocca la formula, il punto si dichiara fuori dal campo della correlazione.
- **D — decisione:** il fatto è confermato, ma la correzione è una scelta di metodo o di interfaccia che spetta a Fabio.

## 2. Sintesi

| Esito | Rilievi |
|---|---|
| Confermati | B1, B2 (4 punti), B3.1, B3.2, B3.3, B4 (3 punti), B5.1, B5.3, B5.4, B6 (3 punti), B7; §4 punti 1, 2, 3, 5, 6, 7, 13 |
| Confermati in parte | B5.2 (solo con stratigrafia che finisce poco sotto la falda), §4 punti 9, 10, 11, 13 (NOTICE) |
| Non confermati | B3.4 (rd ≤ 1 nell'Eq. 2.14a), §4 punto 4 (cedimenti oltre 20 m), §4 punto 8 (focus perso), «Ksigma negativo» di B5.2 |
| Respinti | §3.1 punto 1 (doppio fuso nella Fig. 7.11.1: verifica sulla G.U. riportata nel mandato) |
| Esclusi dal progetto | §3.2 (confronto con prodotti commerciali), §3.1 punto 5 (funzioni nuove) |
| Non verificati | §4 punto 12 (intestazioni HTTP di GitHub Pages: rete non raggiungibile da qui), parte del punto 11 (ingombro su mobile) |

## 3. Rilievi bloccanti B1–B7

| ID | Affermazione dell'audit | Esito | Fonte | Riproduzione | Classe | Azione proposta |
|---|---|---|---|---|---|---|
| B1.a | CRR oltre il campo delle correlazioni dà FS di 10¹⁰–10²¹² | **Confermato.** qc 28 MPa a 3,50 m nell'esempio CPTU: CRR 1,28·10¹⁰, FS 5,92·10¹⁰. È la forma esponenziale dell'Eq. 2.24 fuori dal suo dominio, non un errore di trascrizione | B&I 2014 Eq. 2.24–2.25, pag. 17 (scheda §5) | `riproduci_audit_1.0.0.mjs` B1.a, B1.d; codice `motore/liquisite.js:460`, `:602–603` | **C** + A | Stato «fuori campo per addensamento» del singolo punto, F = 0 e εv = 0 dichiarati come convenzione. Soglia **da fissare con fonte** (campo dei casi storici): decisione D1 sotto |
| B1.b | Al rifiuto l'overflow porta a `errore_numerico` → «ignoto» → F = 1 in IL_max e εv 5,80 % in S_max | **Confermato.** qc 62 MPa: `errore_numerico`; il tratto diventa «ignoto» con εv massima 5,80 %. Riguarda solo i limiti superiori (IL_max, S_max): IL_min e S_min non cambiano | — | B1.b; `motore/liquisite.js:141–161` (`chiudi`), `app/profilo.js:242–247` | **A** + C | Con la classe C il punto non arriva più all'overflow. In più: overflow intercettato prima di `Math.exp` |
| B1.c | Kayen 2013 con Vs del substrato dà CRR 10²⁷ senza avviso | **Confermato.** Vs 800 m/s: CRR15 8,4·10²⁹, nessun avviso | Kayen 2013 Eq. 14 (scheda B.1); campo della banca dati da leggere (Tab. S1) | B1.c; `motore/liquisite.js:773–777` | **C** | Fuori campo oltre la Vs1 massima della banca dati (valore da leggere sulla Tab. S1) |
| B1.e | Il pannello «03 Domanda e resistenza» non ha `xMax` | **Confermato** | — | `app/ui.js:520` | **A** | `xMax` fisso con la nota «valori oltre scala», come per FS |
| B2.1 | Una sola SPT: IL_min = 0 e spessore nullo | **Confermato.** Lente 4–6 m, FS 0,36: IL_min 0,00, IL_max 100,00, spessore 0,00 m (contributo atteso della lente 9,67). Causa: `passoMediano` di un solo punto è `null` → intervallo [5, 5] | — (convenzione di LiquiSite) | B2.1; `motore/indici.js:76–81`, `:90`, `:98` | **A** | Con un solo punto nello strato, l'intervallo è lo strato (o l'intorno della prova, se si sceglie un limite): decisione D2 |
| B2.2 | L'intervallo di una SPT dipende dalla mediana di tutta la verticale | **Confermato.** SPT a 4 m: 3,00–5,00 m con 2 prove; 3,50–4,50 m se si aggiungono 2 prove a 15 e 17 m | — | B2.2; `motore/indici.js:128–130` | **A** | Passo calcolato dentro lo strato (decisione D2). Cambia l'IL di tutti i sondaggi SPT: va dichiarato nel CHANGELOG |
| B2.3 | Nell'esempio «S1 SPT» gli strati esclusi con il criterio 4 restano «senza risultato» | **Confermato.** IL 1,24–26,58, 4,30 m senza risultato (di cui 2,40 m negli strati di limo con criterio 4 soddisfatto; il resto è non indagato). È il comportamento deciso il 21/11, non un errore di calcolo | Decisione del 21/11/2026 | B2.3 | **D** | Attributo per strato «escluso motivatamente» con F = 0 e motivazione obbligatoria: decisione D3 |
| B2.4 | Con prove Vs un'argilla molle risulta liquefacibile | **Confermato.** Vs 130 m/s, FC 90 %: FS 0,60. Non c'è modo di escludere lo strato | Kayen 2013 è solo confronto | B2.4 | **D** | Come B2.3 |
| B3.1 | MSF non limitato a MSF_max per Mw < 5,25 | **Confermato il fatto numerico:** Mw 4,5 → MSF 2,775 > 2,2. La forma dell'Eq. 2.18 vale MSF_max esattamente a 5,25. **Il tetto non è nella scheda di progetto**: va letto sul PDF (pag. 14, testo e Fig. 2.6) | B&I 2014 Eq. 2.18, pag. 14 — **da leggere** | B3.1; `motore/liquisite.js:361–364`; replicato in `verifiche/verifica_indipendente.py:43` | **B** se il PDF lo conferma, altrimenti **C** (avviso e nessun calcolo sotto 5,25) | Correggere anche `verifica_indipendente.py`, scritto dallo stesso autore |
| B3.2 | Cetin 2018: Kσ non limitato a 1,6 per σ'v < 0,25 atm | **Confermato.** z 0,5 m, falda al p.c.: Kσ 2,829; CRR più alto del 77 % rispetto a σ'v/Pa = 0,25. **La scheda di progetto registra il limite 0,8 ≤ Kσ ≤ 1,6** (SDEE pag. 706, Eq. 14) e il codice emette solo l'avviso `SVE_FUORI_CAMPO` | Cetin et al. 2018, SDEE Eq. 14, pag. 706 (scheda A.4) | B3.2; `motore/liquisite.js:708`, `:719` | **B** | Limitare il termine di tensione in modo che Kσ resti in 0,8–1,6. Prima rileggere l'Eq. 14 per confermare che il limite vale anche nel termine di CRR (Eq. 2), non solo nella normalizzazione (Eq. 48) |
| B3.3 | CR di Cetin negativo per aste corte | **Confermato.** Aste 0,10 m: CR −0,038, N1,60 −0,76, stato «calcolato». CR < 0 per aste sotto 0,118 m | Cetin 2018 MethodsX Tab. 2 (scheda A.3): nessun limite inferiore riportato | B3.3; `motore/liquisite.js:646–649` | **C** | Il limite proposto dall'audit (0,5 m) non ha fonte: fuori campo sotto una lunghezza da decidere (D4) |
| B3.4 | rd > 1 vicino al p.c.: l'Eq. 2.14a prevede min(1, …) | **Non confermato.** La scheda letta sul PDF riporta l'Eq. 2.14a senza limite. Scarto misurato: rd 1,0054 a 0,2 m (+0,54 %). L'«inversione oltre 34 m» non conta: oltre 20 m il motore non calcola. rd di Cetin con V*s,12 alta supera 1 di 6·10⁻⁶ | B&I 2014 Eq. 2.14a, pag. 8 (scheda §1) | B3.4 | — | Nessuna azione |
| B4.1 | La tolleranza 1,5 × passo fa omettere la verifica con 10 m non indagati | **Confermato.** Strato saturo 0–20 m, SPT a 2 e 10 m: tolleranza 12 m, esito «Verifica omessa ai sensi del §7.11.3.4.2, criteri 3–4» | NTC 2018 §7.11.3.4.2 (la copertura è una regola di LiquiSite) | B4.1; `app/esclusione.js:73–79` | **A** | Tolleranza fissa e indipendente dal passo (valore: D5) |
| B4.2 | «Sabbia pulita» accettata con FC 35 % | **Confermato.** Esito «verifica omessa» senza avvisi | NTC 2018 §7.11.3.4.2 punto 3 (le NTC non definiscono FC per «sabbia pulita»: la soglia è una scelta tecnica) | B4.2; `app/esclusione.js:91–92` | **A** | Avviso di contraddizione con FC dello strato o Ic (soglie e blocco/avviso: D5) |
| B4.3 | Le curve granulometriche si perdono cambiando un confine di strato | **Confermato.** Esempio «S1 SPT», confine 1,20 → 1,25 m: curva sparita, voce orfana nel file | — | B4.3; `app/esclusione.js:39–59` | **A** | `id` stabile dello strato e `stratoId` nella voce di esclusione; migrazione dei file esistenti per da–a |
| B5.1 | γ > γsat accettato | **Confermato.** γ 22, γsat 15: nessun errore | — | B5.1; `app/profilo.js:161–190` | **A** | Errore se γsat < γ o γsat ≤ γw |
| B5.2 | γ in g/cm³ raddoppia FS senza avviso | **Confermato in parte.** Con la stratigrafia fino a 8 m e falda a 7,5 m: σ'v 9,96 kPa, FS 1,99 (con kN/m³: 1,02), come nell'audit. Con la stratigrafia fino a 20 m lo stesso errore è **già bloccato** (`SVE_NON_POSITIVA`). Il «Kσ negativo con kg/m³» **non è stato riprodotto** (CN riduce (N1)60cs e Cσ) | — | B5.2a, B5.2b | **A** | Avviso di unità per γ fuori da 11–27 kN/m³ |
| B5.3 | σ'v controllata solo a z_max | **Confermato.** σ'v < 0 tra 0 e 3 m, positiva a 20 m: lo scenario non segnala nulla; il singolo punto a 2 m risulta comunque «input non valido» | — | B5.3; `app/profilo.js:172` | **A** | Controllo a ogni interfaccia |
| B5.4 | amax in m/s² accettata | **Confermato.** amax 2,45: nessun avviso, FS 0,10 | — | B5.4 | **A** | Avviso oltre una soglia di plausibilità (valore: D5) |
| B6.1 | Ctrl+P senza il pulsante dà una pagina bianca | **Confermato.** Risultati calcolati, `#stampa` vuoto (0 caratteri) | — | browser B6.1; `css/liquisite.css:222–227`, `app/ui.js:1246–1252` | **A** | `beforeprint`: rapporto completo, oppure avviso «stampa non valida» se `bloccoUscite` è attivo |
| B6.2 | Dopo una stampa, Ctrl+P stampa risultati vecchi | **Confermato.** amax da 0,26 a 0,35 g (stato «non aggiornato»): `#stampa` riporta ancora «amax 0,260 g» | — | browser B6.2 | **A** | Svuotare `#stampa` a ogni modifica e in `afterprint` |
| B6.3 | Le tavole stampate dipendono dai pannelli aperti | **Confermato.** Gruppo «verifica»: Ic, qc1N, CSR/CRR, FS; gruppo «cedimenti»: FS, εv, S cumulato | — | browser B6.3; `app/ui.js:1323` | **A** | Tavole fisse per metodo, indipendenti dalla vista |
| B7 | Nessun avviso in uscita né bozza locale | **Confermato.** Nessun dialogo `beforeunload`, `localStorage` vuoto | — | browser B7; `app/ui.js:1180–1192` | **A** | `beforeunload` con `modificato()`; bozza dei soli input in `localStorage` (decisione «Salva/Apri» aperta in STATO §8) |

## 4. Punti 1–13 del §4 dell'audit

| ID | Affermazione | Esito | Riproduzione | Classe | Azione proposta |
|---|---|---|---|---|---|
| 1 | `apriProgetto` accetta z ripetute o non crescenti | **Confermato.** File aperto; IL e cedimento `input_non_valido` (`PROFONDITA_RIPETUTA`), non `undefined` come scritto nell'audit | 4.1; `app/progetto.js:271–277` | A | Stesso controllo dell'importazione CSV (`app/importa.js:163–168`) |
| 2 | fs = 0 kPa scarta il punto dal FS minimo | **Confermato.** `IC_NON_CALCOLABILE`, il punto diventa «ignoto» | 4.2; `motore/liquisite.js:481` | **D** | La soglia minima di Fr proposta dall'audit non ha fonte: o la si trova, o il punto resta non calcolato con un avviso evidente nel riepilogo (D6) |
| 3 | z = a dell'ultimo strato: incoerenza tra profilo ed esclusione | **Confermato.** 3 punti su 4 nel criterio 3 | 4.3; `app/esclusione.js:69` vs `app/profilo.js:115–122` | A | Stessa regola di appartenenza allo strato |
| 4 | Il cedimento integra fino a 35 m con l'etichetta 0–20 m | **Non confermato.** CPTU fino a 35 m: integrazione fino a 20,00 m, S 12,6 cm come a 20 m | 4.4; `motore/cedimenti.js:41`, `:112` | — | Nessuna |
| 5 | Una nuova prova nasce senza stratigrafia, falda ed esclusione | **Confermato** | `app/ui.js:1158–1160` | D | Copia dei dati di sito da un altro scenario (funzione nuova: fuori da questa release se non approvata) |
| 6 | «Demo sintetica» non calcola, «Esplora l'esempio» sì | **Confermato** | browser 6; `app/ui.js:558`, `:1190` | A | Stesso comportamento dei due pulsanti |
| 7 | Dialogo a sezioni singole; scenari filtrati per prova | **Confermato.** Una sezione per apertura (`app/workspace.js:7–10`); 2 scenari elencati su 3 (`app/ui.js:198`) | browser 7 | D | Interfaccia: onda 3 |
| 8 | Focus perso con Tab in `tabStrati` | **Non confermato.** L'evento è `input`, la tabella non viene ridisegnata; il focus passa a «γ» | browser 8 | — | Nessuna |
| 9 | Attriti: importazione, Mw, confronto, tabelle, etichette | **In parte.** Confermati: il dialogo d'importazione resta aperto (scelta voluta: il testo lo dice), confronto limitato a 3 scenari (`app/ui.js:734`), nessun filtro in «Tabelle», «Calcola» e «Calcola scenario». Non confermati: intestazione fissa in «Tabelle» (c'è e funziona: `css/liquisite.css:149`), etichetta «ev» (è «εv post-liquefazione [%]»). In parte: il pulsante «Usa la proposta» esiste nel pannello Scenario, non nella scheda Magnitudo | browser e codice | D | Onda 3 |
| 10 | Collisioni nei grafici | **In parte.** Confermati: «GHIAIA» coperta dal bordo del fuso, «FS = 1» e «FS rif» sovrapposti con FS rif 1,10, ottava riga della curva tagliata nel campo di testo. Non riprodotto a 1440×900: «falda» tagliata sul bordo destro | catture dello schermo della sessione | A | Onda 3 |
| 11 | Mobile e contrasto | **In parte.** Contrasto `.track-no` 2,87:1 e 2,75:1 (confermato, < 4,5:1). Nessuno sforamento orizzontale a 375 px (concorda con l'audit). Ingombro del 76 % e schede troncate: non misurati | browser 11 | A | Onda 3 |
| 12 | Sicurezza e dipendenze | **Non verificato** per le intestazioni HTTP (GitHub Pages non raggiungibile da qui). Confermati dal codice: CSP via `<meta>` senza `frame-ancestors` (non applicabile via `<meta>`), Chart.js 4.4.4 | `index.html`, `vendor/chart.js/chart.umd.js` | — | Nessuna in questa release; aggiornamento di Chart.js da valutare a parte |
| 13 | Firma input incompleta, versioni dei moduli assenti, NOTICE | **Confermato:** la firma non cambia con FS di riferimento e verifica preliminare (5ff4c981 prima e dopo; esclusione voluta, `app/progetto.js:105`, `:160–175`); versioni di indici, cedimenti e ZS9 assenti in stampa e CSV (`app/ui.js:1342`, `:1358`; `app/esporta.js:49`, `:60`). **In parte per NOTICE:** Zhang 2002 e Iwasaki **sono citati** (righe 75–87, l'audit sbaglia); restano le voci LSN (righe 78–81), tolto dalla 1.0, e Iwasaki 1978 «come riportato» invece di Iwasaki, Tokida e Tatsuoka 1981, fonte della 1.0. Il testo «decisione del 12/11/2026» compare nell'app (`app/magnitudo.js:43`): non è un anacronismo, ma è un testo da appunto interno, vietato dal §2 dello STATO | 13.a | A | Firma di stampa distinta dalla firma di calcolo, con esclusione, FS rif e versioni; NOTICE allineato; testo della Mw riformulato |

## 5. Punti normativi del §3.1

| Punto | Esito | Azione |
|---|---|---|
| 1. Fig. 7.11.1 con due fusi | **Respinto.** Verifica sulla G.U. (S.O. n. 8 alla G.U. n. 42 del 20/02/2018, pag. 280) riportata nel mandato del 24/11: un solo fuso per figura. Non ripetuta in questa sessione | Nessuna: digitalizzare un secondo fuso inventerebbe un limite che la norma non contiene |
| 1. Normalizzazione a 100 kPa nel criterio 3 | Fatto confermato; la scelta di usare la normalizzazione del metodo è la decisione del 10/11 | Nessuna nuova; rafforza l'avviso di B4.2 |
| 2. FC al passante 0,075 mm | **Confermato:** nessun testo dichiara a quale diametro si riferisce FC; il grafico granulometrico pone il confine limo/sabbia a 0,06 mm (`app/grafici.js:271–272`) | A, onda 3: dichiarare in interfaccia, guida e stampa che i metodi sono tarati su FC al passante 0,075 mm, con nota sulla differenza da 0,063 mm |
| 3. Provenienza di a_max | Fatto confermato (la stampa riporta solo il valore) | Onda 3, solo campi descrittivi; nessun calcolo da coordinate (questione aperta in STATO §8) |
| 4. FS non omogenei tra metodi nel confronto | **Confermato:** le note per metodo lo dichiarano (`app/profilo.js`, `notaPL`), il grafico «FS a confronto» no | A, onda 3: nota nel pannello di confronto. Il CRR di Cetin a PL 15 % sarebbe una funzione nuova: non in questa release |
| 5. Funzioni nuove (Atterberg, LSN, LDI, Ishihara, scavi, falda artesiana) | Escluse dal mandato | Versioni future, ciascuna con la fonte letta |

## 6. Decisioni che servono prima della Fase 3 (una alla volta)

| ID | Decisione | Proposta |
|---|---|---|
| D1 | Soglia del «fuori campo per addensamento» (B1) | Leggere sulle fonti il campo dei casi storici (B&I 2014 per qc1Ncs e (N1)60cs; Tab. S1 di Kayen per Vs1) e usare quel limite; nessun tetto numerico a CRR |
| D2 | Intervallo rappresentato da una SPT (B2.1–B2.2) | Partizione dentro lo strato: metà distanza tra le prove dello strato, fino a tetto e letto; con una sola prova, tutto lo strato |
| D3 | Strati esclusi motivatamente (B2.3–B2.4) | Attributo per strato con motivazione obbligatoria (es. criterio 4 soddisfatto e confermato dal geologo); F = 0 dichiarato come per Ic oltre soglia |
| D4 | Lunghezza minima delle aste per Cetin (B3.3) | Fuori campo sotto la lunghezza minima che si trova nella fonte; se non c'è, sotto CR = 0,75 (primo valore della tabella NCEER), da dichiarare come scelta dell'app |
| D5 | Valori delle soglie di robustezza (B4.1, B4.2, B5.2, B5.4) | Tolleranza di copertura fissa; avviso «sabbia pulita» con FC > 5 %; γ fuori 11–27 kN/m³; amax/g > 1: tutti avvisi tranne γsat < γ (errore) |
| D6 | fs = 0 kPa (§4 punto 2) | Nessuna soglia senza fonte: il punto resta non calcolato, ma il riepilogo lo mette in evidenza vicino al FS minimo |

## 7. Ordine di lavoro confermato dalla verifica

1. **Onda 1 (classe A, nessuna formula):** B6, B7, B5, B4.3, più §4 punti 1 e 3. Una PR per famiglia, ciascuna con il controllo corrispondente di questo audit portato in `npm test`.
2. **Onda 2 (motore):** B3.2 (dopo la rilettura dell'Eq. 14), B3.1 (dopo la lettura di pag. 14), B1 come classe C, B3.3, poi B2 e B4.1–B4.2 dopo le decisioni D1–D5.
3. **Onda 3:** grafica, contrasto, testi (FC a 0,075 mm, nota sul confronto, testo della Mw), firma di stampa, NOTICE, provenienza di a_max.

## 8. Stato finale dei rilievi al 25/11/2026 (verso la v1.0.1)

La sezione 2 e le tabelle 3–5 restano come furono scritte il 24/11 (verifica sul codice di `c6784f1`, nessuna correzione). Questa tabella riporta, per ogni punto, lo stato oggi, il controllo che lo prova e, se rinviato, la versione prevista. Stati: **chiuso**, **chiuso in parte**, **rinviato**, **non riprodotto — chiuso senza intervento**. «Controllo» è un file di `verifiche/`; per i punti chiusi senza intervento indica che cosa si è provato.

Le versioni dei rinvii sono **proposte**, da confermare: v1.0.2 è riservata ai metadati di a_max (decisione del 25/11); v1.0.3 è la proposta per le rifiniture di interfaccia.

### Rilievi bloccanti B1–B7

| ID | Stato | Controllo | Versione / nota |
|---|---|---|---|
| B1.a | chiuso | `verifica_addensamento.mjs` (qc1Ncs > 211 e (N1)60cs > 37: «oltre il campo», nessun FS inventato) | 1.0.1 (D1) |
| B1.b | chiuso | `verifica_addensamento.mjs` (punto oltre il campo non arriva all'overflow; IL_max e S_max uguali a quelli con qc 28 MPa, spessore «ignoto» invariato) | 1.0.1 |
| B1.c | chiuso | `verifica_addensamento.mjs` sez. 4 (Vs1 > 277 m/s, confronto stretto), `verifica_indipendente.py` | 1.0.1. Tab. S1 non è nel repository: le cifre ricavate da essa (328,62 m/s e i nomi dei casi) sono tolte da CHANGELOG, metodo.md, messaggio dell'app e commenti (commit dedicato nell'Onda 2). La soglia resta scelta applicativa (CRR7,5 ≈ 2,02); il confronto con il campo della banca dati si rifà solo con la tabella in mano |
| B1.d | chiuso | stesso controllo di B1.a (è la stessa riproduzione) | 1.0.1 |
| B1.e | chiuso | `browser/verifica_flusso.mjs` sez. 4 (asse x del pannello 03 fisso 0–1; la nota «fuori scala» c'era già) | 1.0.1 (dal commit fbe0641) |
| B2.1 | chiuso | `verifica_il.mjs` sez. 11 | 1.0.1 (D2) |
| B2.2 | chiuso | `verifica_il.mjs` sez. 11 | 1.0.1 (D2) |
| B2.3 | chiuso | `verifica_esclusione_strati.mjs` (IL = somma a mano senza lo strato; demo SPT non più 1,24–26,51) | 1.0.1 (D3) |
| B2.4 | chiuso | `verifica_esclusione_strati.mjs` sez. 7b (prova Vs, argilla molle esclusa) | 1.0.1 (D3) |
| B3.1 | chiuso | `verifica_motore.mjs`, `verifica_indipendente.py` (MSF ≤ MSFmax) | 1.0.1 |
| B3.2 | chiuso | `verifica_motore.mjs`, `verifica_indipendente.py` (Kσ in 0,8–1,6) | 1.0.1 |
| B3.3 | chiuso | `verifica_motore.mjs`, `verifica_indipendente.py` (CR ≤ 0 non definito) | 1.0.1 (D4) |
| B3.4 | non riprodotto — chiuso senza intervento | Provato: Eq. 2.14a senza limite nella fonte (B&I 2014, pag. 8); rd 1,0054 a 0,2 m (+0,54 %) misurato con `riproduci_audit_1.0.0.mjs`; oltre 20 m il motore non calcola | — |
| B4.1 | chiuso | `verifica_copertura.mjs` (limiti esatti 1,5 m SPT e 0,25 m CPT) | 1.0.1 (D5) |
| B4.2 | chiuso | `verifica_copertura.mjs` («sabbia pulita» contraddetta da FC > 5 % o Ic > 1,775) | 1.0.1 (D5) |
| B4.3 | chiuso | `verifica_strati.mjs`, `browser/verifica_strati.mjs` | 1.0.1 |
| B5.1 | chiuso | `verifica_validazione.mjs`, `browser/verifica_dati.mjs` | 1.0.1 |
| B5.2 | chiuso in parte | `verifica_validazione.mjs` sez. 3 (avviso di unità per γ fuori 11–27 kN/m³). Il «Kσ negativo con kg/m³» non è stato riprodotto | 1.0.1 |
| B5.3 | chiuso | `verifica_validazione.mjs` sez. 2 (γsat > γw garantisce σ'v > 0 a ogni profondità) | 1.0.1 |
| B5.4 | chiuso | `verifica_validazione.mjs` sez. 3 (avviso per amax > 1 g) | 1.0.1 |
| B6.1 | chiuso | `browser/verifica_stampa.mjs` | 1.0.1 |
| B6.2 | chiuso | `browser/verifica_stampa.mjs` | 1.0.1 |
| B6.3 | chiuso | `browser/verifica_stampa.mjs` (tavole indipendenti dalla vista) | 1.0.1 |
| B7 | chiuso | `browser/verifica_bozza.mjs` | 1.0.1 |

### Punti normativi del §3.1

| Punto | Stato | Controllo | Versione / nota |
|---|---|---|---|
| 1. Doppio fuso nella Fig. 7.11.1 | respinto | G.U. S.O. n. 8 alla G.U. n. 42 del 20/02/2018, pag. 280: un solo fuso per figura; nessuna modifica | — |
| 1b. Normalizzazione a 100 kPa nel criterio 3 | non riprodotto — chiuso senza intervento | è la decisione del 10/11/2026 (registrata nel documento STATO) | — |
| 2. FC al passante 0,075 mm | chiuso | `browser/verifica_flusso.mjs` sez. 5 (tabella e suggerimenti degli strati). Guida e stampa: la nota sulla differenza da 0,063 mm **non è stata aggiunta** | 1.0.1 per l'interfaccia; nota in guida e stampa rinviata a 1.0.3 (proposta) |
| 3. Provenienza di a_max | rinviato | — | 1.0.2 (metadati di a_max, con `schema_version` del CSV) |
| 4. FS non omogenei tra metodi | chiuso | `browser/verifica_flusso.mjs` sez. 5 | 1.0.1 (solo testo; il CRR di Cetin a PL 15 % resta una funzione nuova, non prevista) |
| 5. Funzioni nuove | esclusi dal mandato | — | versioni future, ciascuna con la fonte letta |

### Punti 1–13 del §4

| ID | Stato | Controllo | Versione / nota |
|---|---|---|---|
| 1 | chiuso | `verifica_validazione.mjs` sez. 5 | 1.0.1 |
| 2 | rinviato | — (fs = 0 kPa: la decisione D6 non è stata discussa) | da decidere con D6; non nella 1.0.1 salvo decisione |
| 3 | chiuso | `verifica_copertura.mjs` sez. 2b (letto dell'ultimo strato) | 1.0.1 |
| 4 | non riprodotto — chiuso senza intervento | Provato: CPTU fino a 35 m, integrazione fino a 20,00 m, S uguale a quello a 20 m. Aggiunta una prova di non regressione: `verifica_cedimenti.mjs` sez. 3b | — |
| 5 | rinviato | — (copia di stratigrafia, falda ed esclusione tra scenari: funzione nuova, **non aggiunta**) | 1.0.2, insieme ai metadati di a_max (proposta) |
| 6 | chiuso | `browser/verifica_flusso.mjs` sez. 1–2 | 1.0.1 |
| 7 | rinviato | — (dialogo a sezioni singole, scenari filtrati per prova; il Tab nel dialogo non è confermato: `<dialog>` modale gestisce il focus) | 1.0.3 (proposta) |
| 8 | non riprodotto — chiuso senza intervento | Provato: `riproduci_audit_browser.mjs` punto 8; l'evento è `input`, la tabella non si ridisegna, il focus passa a «γ» | — |
| 9 | chiuso in parte | `browser/verifica_flusso.mjs` sez. 3 (il dialogo si chiude dopo «Salva la prova» e offre «Vai allo scenario»). Non fatti: «Applica Mw» (funzione nuova), confronto oltre 3 scenari, filtro in «Tabelle». Non confermati: intestazione fissa in «Tabelle» (c'è, `css/liquisite.css:149`), etichetta «ev» | 1.0.1 per il dialogo; il resto 1.0.3 (proposta) |
| 10 | chiuso in parte | `verifica_grafici.mjs` (contesto simulato) e schermate nella PR. «falda» tagliata a 1440×900: non riprodotta | 1.0.1 |
| 11 | chiuso in parte | Contrasto `.track-no` portato a 5,0:1 (calcolo nel CHANGELOG). A 375×812 la barra delle schede scorre in orizzontale (681 px su 349) senza segnale di scorrimento e «Confronto» appare tagliato («Conf»): confermato, **rinviato**. Nessuno sforamento orizzontale della pagina | contrasto 1.0.1; barra delle schede 1.0.3 (proposta) |
| 12 | rinviato | non verificabile da qui (intestazioni HTTP di GitHub Pages); da controllare online dopo la pubblicazione | dopo il rilascio |
| 13 | chiuso | `verifica_firma.mjs` (firma SHA-256 del rapporto e di calcolo, vettori NIST, FSrif, versioni dei moduli, CSV); NOTICE e nota interna della Mw: testo (CHANGELOG) | 1.0.1 |

### Controlli: esito del 25/11/2026

Tabella per file nel documento `docs/validazione.md` (sezione «Conteggi per file»).
