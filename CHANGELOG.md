# Changelog

La versione dell'app e quella del motore di calcolo sono distinte: l'app è indicata in alto e nel piè di pagina della stampa insieme al motore.

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
