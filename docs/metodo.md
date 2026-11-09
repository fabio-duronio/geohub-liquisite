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

Il FS deterministico = 1 corrisponde a P_L ≈ 16 % (pag. 78–80). Strati con I_c oltre la soglia (2,6 di base; 2,4 o 2,8 per l'analisi di sensibilità, pag. 99) sono esclusi come terreni a comportamento argilloso.

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
