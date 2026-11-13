# LiquiSite — v5.5, consegna per prosecuzione

v5.1: indice IL di Iwasaki (`motore/indici.js`, `docs/indice-il.md`, `verifiche/verifica_il.mjs`).
v5.2: codice ripulito (nessuna nota interna, nessun nome commerciale), nuovo esempio sintetico realistico, avvertenze su CPT meccanica e DPSH nella guida all'importazione, prove casuali (`verifiche/verifica_casuale.mjs`). In `motore/liquisite.js` sono cambiate solo tre righe di commento: le istruzioni sono identiche alla base. 
v5.3: FS di riferimento di scenario (predefinito 1,25, EN 1998-5) e criterio di verifica in app, stampa e CSV. 
v5.4: verifica preliminare §7.11.3.4.2 in interfaccia e carta di comportamento CPT.
v5.5: cedimento post-sismico da CPT (Zhang et al. 2002) e LSN, con intervalli per i tratti ignoti. Vedere il registro, sezioni V5.1–V5.5.

Questa consegna sostituisce v4/v4.1. Non contiene la demo CPT reale né i dati del PDF. È la base v3 con la correzione della navigazione: Progetto, Prove, Scenario e Stratigrafia aprono ciascuno la propria sezione, senza menu interno duplicato.

## Avvio
Nella cartella eseguire `python3 -m http.server 8080` e aprire `http://localhost:8080`. Sono ancora presenti risorse CDN: non è garantito il funzionamento completamente offline.

## Per chi continua
1. Leggere `AGENTS.md` (istruzioni e vincoli).
2. Leggere `docs/decisioni-e-attivita.md` (richieste, interventi, correzioni e sviluppi aperti).
3. Usare la demo sintetica (dati inventati) per verificare il percorso, non come validazione di un sito.
4. Eseguire `node` su ogni file `verifiche/*.mjs` e `python3 verifiche/verifica_indipendente.py`.

Verifiche ripetute sulla v5.5: 737 controlli JavaScript superati, di cui 24 sul caso di riferimento esterno (più prove casuali con altri semi); confronto indipendente Python/JS concordante su 8.000 casi; regressione Chromium su importazione, bozze, aggiornamento, accessi diretti, calcolo, stampa verticale e mobile. I test non certificano l'uso professionale.

## Contenuto
Codice completo, motore, verifiche, documentazione, licenza e NOTICE. Nessun dataset, PDF, estrazione o elaborato della CPT reale. L'estensione CPTM dedicata è stata ritirata, non solo nascosta.

## Stato
Motore invariato, base pubblica `1793470`. Nessuna pubblicazione remota autorizzata o effettuata. La patch fornita separatamente è cumulativa rispetto a quella base; prima di applicarla a un repository aggiornato confrontare i cambiamenti.

La pulizia riguarda il progetto e questa consegna. I vecchi allegati e pacchetti nella conversazione non sono la versione da riprendere.
