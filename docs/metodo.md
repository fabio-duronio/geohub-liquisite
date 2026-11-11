# Metodo di calcolo

Equazioni implementate nel motore (`motore/liquisite.js`), con la fonte di ciascuna. Tutte sono state lette sulle pagine delle pubblicazioni originali; le pagine indicate sono quelle stampate.

[← Torna al README](../README.md)

## Quadro normativo

- **NTC 2018, §7.11.3.4**: esclusione della verifica (§7.11.3.4.2, quattro criteri, nessun criterio sulla magnitudo); metodo storico-empirico; coefficiente di sicurezza come rapporto tra resistenza disponibile e sollecitazione; **nessun valore minimo** di FS.
- **Circolare n. 7/2019, C7.11.3.4** (S.O. n. 5 alla G.U. n. 35 dell'11/02/2019, pag. 243): verifiche puntuali (CSR e CRR) e globali; con più metodi si adotta il più cautelativo salvo motivazione; valori caratteristici; procedure valide per piano campagna sub-orizzontale; l'adeguatezza del margine è valutata e motivata dal progettista.

## Principio

Ogni metodo è un **blocco chiuso**: usa solo le proprie funzioni (rd, normalizzazione della resistenza, Kσ, MSF o KMw, correzione per i fini). Una correlazione va usata con lo stesso quadro di analisi con cui è stata ricavata (Boulanger & Idriss 2014, pag. 8).

Grandezza comune: CSR = 0,65 · (a_max/g) · (σ_v/σ'_v) · r_d, con a_max in superficie e r_d del metodo.

## Boulanger & Idriss (2014) — SPT

| Grandezza | Formula | Fonte |
|---|---|---|
| N₆₀, (N₁)₆₀ | (N₁)₆₀ = C_N · C_E · C_R · C_B · C_S · N_m; C_E = ER_m/60 %; C_B = C_S = 1 con procedure standard | I&B 2010, Eq. 2.3, pag. 5 |
| C_R | 0,75 / 0,80 / 0,85 / 0,95 / 1,00 per aste < 3 / 3–4 / 4–6 / 6–10 / 10–30 m (aste = sporgenza + profondità) | I&B 2010, pag. 9 (da Youd et al. 2001) |
| r_d | exp[α(z) + β(z)·M]; α = −1,012 − 1,126·sin(z/11,73 + 5,133); β = 0,106 + 0,118·sin(z/11,28 + 5,142) | B&I 2014, Eq. 2.14 |
| C_N | (P_a/σ'_v)^m ≤ 1,7; m = 0,784 − 0,0768·√(N₁)₆₀cs, (N₁)₆₀cs ≤ 46; iterativo | Eq. 2.15a, 2.15c |
| Δ(N₁)₆₀ | exp[1,63 + 9,7/(FC + 0,01) − (15,7/(FC + 0,01))²] | Eq. 2.23 |
| K_σ | 1 − C_σ·ln(σ'_v/P_a) ≤ 1,1; C_σ = 1/(18,9 − 2,55·√(N₁)₆₀cs) ≤ 0,3 | Eq. 2.16a, 2.16c |
| MSF | 1 + (MSF_max − 1)·[e^(−M/4) − e^(−7,5/4)]/[e^(−5,25/4) − e^(−7,5/4)]; MSF_max = 1,09 + ((N₁)₆₀cs/31,5)² ≤ 2,2 | Eq. 2.18, 2.21 |
| CRR (M 7,5; 1 atm) | exp[N/14,1 + (N/126)² − (N/23,6)³ + (N/25,4)⁴ − 2,8], N = (N₁)₆₀cs | Eq. 2.25 |
| FS | CRR · MSF · K_σ / CSR | Eq. 2.7 |

La relazione probabilistica da SPT degli stessi autori (Boulanger & Idriss 2012a) non è inclusa: per questo metodo la PL non è calcolata.

## Boulanger & Idriss (2014) — CPT/CPTU (punta elettrica)

| Grandezza | Formula | Fonte |
|---|---|---|
| q_t | q_c + (1 − a_r)·u₂ | Eq. 2.3 |
| I_c | [(3,47 − log Q)² + (1,22 + log F)²]^0,5; Q = [(q_t − σ_v)/P_a]·(P_a/σ'_v)^n; F = f_s/(q_t − σ_v)·100 | Eq. 2.26–2.28 |
| n | 1,0 se I_c > 2,6; altrimenti 0,5 se I_c ricalcolato ≤ 2,6; 0,75 se I_c oscilla attorno a 2,6 | Robertson & Wride 1998, pag. 449, Fig. 12 |
| FC (se non misurato) | 80·(I_c + C_FC) − 137, tra 0 e 100 % | Eq. 2.30 |
| C_N | (P_a/σ'_v)^m ≤ 1,7; m = 1,338 − 0,249·q_c1Ncs^0,264, q_c1Ncs tra 21 e 254; iterativo | Eq. 2.15a, 2.15b |
| Δq_c1N | (11,9 + q_c1N/14,6)·exp[1,63 − 9,7/(FC + 2) − (15,7/(FC + 2))²] | Eq. 2.22 |
| K_σ | C_σ = 1/(37,3 − 8,27·q_c1Ncs^0,264) ≤ 0,3 | Eq. 2.16b |
| MSF_max | 1,09 + (q_c1Ncs/180)³ ≤ 2,2 | Eq. 2.20 |
| CRR (M 7,5; 1 atm) | exp[q/113 + (q/1000)² − (q/140)³ + (q/137)⁴ − 2,80], q = q_c1Ncs | Eq. 2.24 |
| P_L | Φ{−[q/113 + (q/1000)² − (q/140)³ + (q/137)⁴ − 2,60 − ln(CSR_M=7,5,σ'v=1)]/0,20} | Eq. 5.26, pag. 78 |

Il FS deterministico = 1 corrisponde a P_L ≈ 16 % (pag. 78–80). Con I_c oltre la soglia (2,6 di base; 2,4 o 2,8 per l'analisi di sensibilità, pag. 99) il metodo **non si applica** al punto (stato `non_applicabile`, codice `IC_OLTRE_SOGLIA`): non è un'esclusione ai sensi del §7.11.3.4.2 e non dimostra l'assenza di problemi ciclici nei terreni fini.

Tipo di prova (motore 0.3.0): `CPTE` (punta elettrica senza misura di u, q_t = q_c) o `CPTU` (piezocono, u₂ obbligatoria; a_r = 0,8 se non indicato, segnalato come assunzione). La CPT a punta meccanica non è supportata (sottostima la suscettibilità: volume CNR-CentroMS 2024, pag. 27).

## Cetin et al. (2018) — SPT

| Grandezza | Formula | Fonte |
|---|---|---|
| N₁,₆₀ | N · C_N · C_R · C_S · C_B · C_E; C_N = (P_a/σ'_v)^0,5 ≤ 2,0 | MethodsX, Eq. 6, Tab. 2 |
| C_R | 0,48 + 0,225·ln(d) per d ≤ 10 m; **1,0** per 10–30 m (vedi refusi) | Tab. 2 |
| C_S | 1 + N₁,₆₀/100, tra 1,10 e 1,30, solo per campionatori con alloggiamento per il rivestimento usati senza rivestimento | Tab. 2 |
| r_d | relazione di Cetin & Seed (2004) in funzione di d, M_w, a_max, V*_s,12 | MethodsX Eq. 26–27 |
| P_L | Φ{−[N₁,₆₀(1 + θ₁FC) − θ₆ ln CSR − θ₂ ln M_w − θ₃ ln(σ'_v/P_a) + θ₄FC + θ₅]/σ_ε} | SDEE Eq. 10 |
| CRR (P_L = 50 %) | exp{[N₁,₆₀(1 + θ₁FC) − θ₂ ln M_w − θ₃ ln(σ'_v/P_a) + θ₄FC + θ₅]/θ₆} | SDEE Eq. 11 |
| Coefficienti | θ₁ 0,00167; θ₂ 27,352; θ₃ 3,958; θ₄ 0,089; θ₅ 16,084; θ₆ 11,771; σ_ε 2,95 | SDEE Tab. 7 |

FS = CRR/CSR corrisponde a P_L = 50 %. Limiti dichiarati: FC 5–35 %; K_σ 0,8–1,6 (σ'_v 0,25–1,8 atm); M_w 5,5–8,4; V*_s,12 ≤ 230 m/s nelle analisi di progetto.

## Kayen et al. (2013) — V_s (solo confronto)

| Grandezza | Formula | Fonte |
|---|---|---|
| V_s1 | V_s·(P_a/σ'_v)^0,25, con C_Vs ≤ 1,5 e P_a = 100 kPa | Eq. 2 |
| r_d | Cetin et al. (2004) | Eq. 4 |
| P_L | Φ{−[(0,0073·V_s1)^2,8011 − 1,946 ln CSR − 2,6168 ln M_w − 0,0099 ln σ'_v0 + 0,0028·FC]/0,4809}, σ'_v0 in kPa | Eq. 13 |
| CRR (P_L) | exp{[(0,0073·V_s1)^2,8011 − 2,6168 ln M_w − 0,0099 ln σ'_v0 + 0,0028·FC **+** 0,4809·Φ⁻¹(P_L)]/1,946} | Eq. 14 (segno corretto, vedi refusi) |
| FS | CRR(P_L = 15 %)/CSR | Eq. 16 |

**Tensione efficace oltre 180 kPa.** Le Eq. 13–14 contengono sempre il termine −0,0099·ln σ'_v0. Gli autori presentano CSR* con K_σ fissato a 1 (Eq. 15) perché la banca dati (siti entro 22 m e 180 kPa, media 60,2 kPa) non permette di valutare K_σ oltre 200 kPa (pag. 413–414). Il motore applica le Eq. 13–14 senza modifiche e segnala σ'_v0 > 180 kPa come fuori dalla banca dati (fino alla 0.2.0 l'avviso diceva, impropriamente, «K_σ assunto pari a 1»).

## Refusi delle fonti e scelte adottate

- **Kayen et al. (2013), Eq. 14**: la versione editoriale stampa «− 0,4809·Φ⁻¹(P_L)». Invertendo l'Eq. 13 si ottiene «+», che è coerente con la Fig. 6 degli autori (V_s1 150 → CRR ≈ 0,10; 200 → ≈ 0,22, per P_L 15 %, M_w 7,5, σ'_v0 100 kPa, FC 0). Si usa «+».
- **Cetin et al. (2018), Tab. 2**: per aste di 10–30 m è stampato «C_R = 0,48»; si usa 1,0 (continuità con il primo ramo a 10 m; esempio degli autori, Tab. 3; valore di Youd et al. 2001). Nella stessa tabella la correzione dell'energia è stampata come «C_R = ER/60»: si intende C_E.
- **Boulanger & Idriss (2014), MSF**: si usa la forma esatta (Eq. 2.18); l'Eq. 2.19 ne è la versione con i termini fissi arrotondati.

## Unità

Profondità in m dal piano campagna; tensioni in kPa (γ_w = 9,81 kN/m³, pressione idrostatica); q_c in MPa; f_s e u₂ in kPa; V_s in m/s; a_max in g; FC in %. P_a = 101,325 kPa per Boulanger & Idriss, 101,3 kPa per Cetin et al. (come negli autori), 100 kPa per Kayen et al.

## Validazione

Vedi `verifiche/`:
- `verifica_motore.mjs` — esempio numerico di Cetin et al. (2018, MethodsX: Tab. 3 ed Eq. 29–54), valori dichiarati nel testo di Boulanger & Idriss (2014), letture delle figure di Boulanger & Idriss e di Kayen et al.
- `verifica_indipendente.py` — seconda implementazione dei quattro metodi in Python, confrontata con il motore su 8000 casi casuali.
- `verifica_esclusione.mjs` — criteri 1–4; coerenza dei fusi digitalizzati (U_c dei limiti, monotonia, letture a 26 % di passante); curve costruite interne, esterne e sul limite.
- `verifica_robustezza.mjs` — input non validi, valori sulle soglie, stati di esito, profondità, CPT/CPTU, convergenza, tensioni, campionamento casuale di input errati (motore 0.3.0).

## Esclusione della verifica (NTC 2018 §7.11.3.4.2)

Basta un criterio soddisfatto. L'app scrive «verifica omessa ai sensi del §7.11.3.4.2, criterio n», mai «terreno non liquefacibile», e mostra il margine con cui ogni criterio è soddisfatto.

| # | Criterio | Calcolo |
|---|---|---|
| 1 | a_max in campo libero < 0,1 g | confronto diretto; se non soddisfatto, la Circolare (C7.11.3.4) chiede di approfondire le indagini per gli altri tre criteri |
| 2 | falda media stagionale > 15 m, p.c. sub-orizzontale, fondazioni superficiali | le tre condizioni insieme |
| 3 | sabbie pulite con (N₁)₆₀ > 30 o q_c1N > 180 | normalizzazione del **metodo principale** scelto, dichiarata in stampa (le NTC indicano solo la normalizzazione a 100 kPa); avviso se il valore supera la soglia di meno del 10 % (scelta di LiquiSite) |
| 4 | curva granulometrica esterna ai fusi della Fig. 7.11.1 ((a) U_c < 3,5; (b) U_c > 3,5) | vedi sotto |

### Fusi della Fig. 7.11.1

Il testo ufficiale (D.M. 17/01/2018, S.O. n. 8 alla G.U. n. 42 del 20/02/2018, pag. 280) riporta i fusi solo come immagini (605 × 395 e 605 × 405 pixel). Le coordinate in `dati/fusi-ntc2018.json` sono ricavate con `strumenti/digitalizza_fusi.py`:
- calibrazione sugli assi della figura (decadi del diametro ogni 95 pixel circa; passante dallo 0 al 100 %);
- inseguimento di ciascuna curva dal basso verso l'alto e campionamento a passante intero dal 2 al 98 %;
- risoluzione: 1 pixel ≈ 0,0105 decadi di d e ≈ 0,35 % di passante; spessore delle curve ≈ 3 pixel.

Curva granulometrica (motore 0.3.0): coppie [d mm, passante %] con d > 0, passante tra 0 e 100, almeno 2 punti, nessun diametro ripetuto, passante non decrescente al crescere di d. I dati errati sono rifiutati (`input_non_valido`), mai scartati in silenzio.

Confronto: nel tratto comune di passante (2–98 %) curva e limiti sono spezzate nel piano (passante, log d); si valutano tutti i vertici della curva e tutti i vertici dei limiti che cadono nel tratto, quindi il confronto è esatto (prima della 0.3.0 si campionava solo a passante intero). Un punto è «dentro» o «fuori» dal fuso solo se dista dal limite più della **tolleranza di 0,03 decadi** di d (circa lo spessore della curva nella figura); altrimenti è «sul bordo». Il passaggio da «fuori lato fine» a «fuori lato grosso» è un attraversamento del fuso.
- tutti i punti fuori, dallo stesso lato → l'app propone «criterio soddisfatto», ma solo se la curva copre il passante **almeno dal 10 % al 90 %** (scelta prudenziale di LiquiSite, non requisito normativo); con copertura minore lo stato è `dati_insufficienti` e non si propone l'esclusione;
- almeno un confronto interamente dentro → propone «non soddisfatto»;
- altrimenti la curva tocca o interseca il fuso → **nessuna proposta**.

In ogni caso l'app disegna la curva sui fusi e il geologo **conferma o corregge** l'esito con motivazione. U_c = D₆₀/D₁₀ è interpolato su scala logaritmica; se non è determinabile o vale esattamente 3,5 la curva si confronta con entrambi i fusi e la proposta «soddisfatto» richiede che sia esterna a tutti e due.

## Convenzione dei risultati (motore 0.3.0)

Ogni funzione restituisce un oggetto con `stato`; FS, CRR, CSR e P_L sono utilizzabili solo con `calcolato`.

| Stato | Significato |
|---|---|
| `calcolato` | calcolo riuscito, eventualmente con avvisi |
| `input_non_valido` | dato impossibile o di tipo errato; `errori: [{campo, codice, motivo}]` |
| `dati_insufficienti` | manca un dato necessario (es. u₂ di una CPTU, f_s nullo) o la copertura della curva non basta |
| `non_applicabile` | il metodo o LiquiSite non si applicano al punto: `AMAX_NULLA`, `OLTRE_LIMITE_APP` (z > 20 m), `NON_SATURO` (u = 0, grandezze in `diagnostica`), `IC_OLTRE_SOGLIA` |
| `non_convergente` | iterazione non convergente; dettagli in `convergenza` e `diagnostica` |
| `errore_numerico` | una grandezza calcolata non è un numero finito |

Distinzione tra dato impossibile e dato fuori dal campo di calibrazione: il primo dà `input_non_valido`; il secondo prosegue il calcolo con un avviso `fuori_campo` (es. M_w fuori 5,5–8,4 per Cetin, FC limitato a 5–35 %, σ'_v0 oltre la banca dati di Kayen).

Avvisi: `{codice, tipo, messaggio}` con tipo `fuori_campo` (limite del metodo), `limite_app` (scelta di LiquiSite), `assunzione` (valore predefinito), `nota`.

Profondità: il limite di 20 m è di LiquiSite. L'avviso sull'incertezza di r_d oltre circa 10 m è solo di Boulanger & Idriss (2014, pag. 9) e si applica solo ai due metodi B&I.

Precondizione di saturazione: il punto deve essere sotto la falda di verifica. La posizione rispetto alla falda la stabilisce il livello del profilo (non ancora implementato); il motore controlla solo che u = σ_v − σ'_v sia positiva.

Iterazioni (B&I SPT e CPT, Cetin con campionatore senza rivestimento): arresto quando la variazione assoluta tra due passi è < 10⁻⁹; massimo 100, 200 e 50 passi (modificabile con `opz.maxIterazioni`). Il risultato riporta `convergenza: {convergente, numeroIterazioni, residuoFinale, tolleranza, maxIterazioni}`.

### Migrazione da 0.2.0

- Nessuna eccezione per dati errati: controllare `stato` invece di usare try/catch (resta solo `PhiInv` e `crCetin` fuori dominio, funzioni di servizio).
- `bi2014Cpt`: `opz.tipo` obbligatorio (`'CPTE'` o `'CPTU'`); `u2` con CPTE è un errore; CPTU senza `u2` → `dati_insufficienti`. Gli stati `'escluso'` e `'non calcolabile'` diventano `non_applicabile` (`IC_OLTRE_SOGLIA`) e `dati_insufficienti` (`IC_NON_CALCOLABILE`).
- `bi2014Spt` accetta un quarto argomento `opz` (`maxIterazioni`).
- `tensioni` restituisce `{stato, sv, u, sve}` o `{stato: 'input_non_valido', errori}`; falda sopra il p.c. non supportata.
- Punti sopra falda (u = 0): `non_applicabile`, codice `NON_SATURO`, valori in `diagnostica`.
- `criterio1–4`: campo `stato` (`valutato`, `input_non_valido`, `dati_insufficienti`); con dati non validi `soddisfatto` è `null`. `criterio2` richiede booleani veri. `criterio3` accetta solo `'SPT'`, `'CPTE'`, `'CPTU'` (prima qualunque tipo diverso da `'CPT'` era trattato come SPT).
- `criterio4`, `confrontaFuso`, `coeffUniformita`: la curva viene validata; nuovi campi `copertura` e `attraversamenti`; `coeffUniformita` restituisce anche `stato`.
- Avvisi: oggetti `{codice, tipo, messaggio}` invece di stringhe.
