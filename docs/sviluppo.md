# Sviluppo

Struttura del repository, avvio in locale, formato del progetto e regole per le modifiche.

[← Torna al README](../README.md)

## Struttura del repository

```
index.html          pagina dell'applicazione (nessuna compilazione)
assets/             logo, icone e immagine di anteprima per la condivisione
vendor/             componenti di terze parti con le licenze: Chart.js, caratteri IBM Plex
css/liquisite.css   foglio di stile (identità comune GeoHub)
motore/             calcoli, senza dipendenze dall'interfaccia
  liquisite.js        metodi di innesco, tensioni, criteri di esclusione 1–4
  indici.js           indice IL (Iwasaki)
  cedimenti.js        deformazione volumetrica (Zhang et al. 2002), cedimento
app/                interfaccia: nessuna formula di liquefazione
  progetto.js         formato del progetto, unità, firma degli input, validazione dei file
  profilo.js          collegamento prova → tensioni → motore; riepilogo; serie dei grafici
  esclusione.js       verifica preliminare §7.11.3.4.2 per strato e per sito
  importa.js          lettura di tabelle e CSV con conversioni esplicite
  esporta.js          CSV con protezione dalle formule
  grafici.js          profili, carta di comportamento e fusi (Chart.js, solo disegno)
  esempio.js          progetto di esempio sintetico (dati inventati, seme fisso)
  magnitudo.js        coordinate del sito e Mw dello scenario: proposta ZS9, motivazione, avvisi
  ui.js · workspace.js · import-workspace.js · guida-importa.js
moduli/
  zs9.js              modulo ZS9 v1.2.0 di GeoHub-SismaSite (PR #31), copiato senza modifiche
dati/
  fusi-ntc2018.json   fusi della Fig. 7.11.1 digitalizzati
  fusi-ntc2018.js     stessi dati per il browser (verificati uguali al JSON)
  zs9-data.json       36 zone ZS9 (INGV, CC BY 4.0), copiato da SismaSite (SHA-256 3a15606a…1dc0)
  zs9-data.js         stesso testo per il browser: la CSP non permette di leggere file con fetch
strumenti/
  digitalizza_fusi.py ricava dati/fusi-ntc2018.json dalle immagini del testo ufficiale
  convert_zs9.py      converte lo shapefile ZS9.ZIP in dati/zs9-data.json (da SismaSite, invariato)
  zs9_per_browser.mjs genera dati/zs9-data.js da dati/zs9-data.json
verifiche/          script di controllo (vedi validazione.md) e dati del caso di riferimento
  esegui.mjs          esegue tutte le verifiche e riassume l'esito
  browser/            controllo nel browser con Playwright
docs/               metodo, indici, cedimenti, uso, validazione, sviluppo
.github/            modelli per le segnalazioni; workflow delle verifiche automatiche
package.json        solo per le verifiche (Playwright); l'app non ha dipendenze
README.md · CHANGELOG.md · LICENSE · NOTICE
```

I moduli sono in formato UMD. Funzionano sia nel browser, come script globali (`window.LiquiSite`, `window.LiquiProfilo`, …), sia in Node, con `require`: così le verifiche usano lo stesso codice dell'app.

## Avvio in locale

```bash
git clone https://github.com/fabio-duronio/geohub-liquisite.git
cd geohub-liquisite
python3 -m http.server 8000
```

Apri <http://localhost:8000/>. Non servono compilazione né installazione di dipendenze, e l'app funziona anche senza rete.

**Componenti di terze parti** (in `vendor/`, con le licenze; vedi anche NOTICE):

| Componente | Versione | Licenza | Origine |
|---|---|---|---|
| Chart.js (`vendor/chart.js/chart.umd.js`) | 4.4.4 | MIT | pacchetto npm `chart.js`, file `dist/chart.umd.js` |
| IBM Plex Sans (`vendor/ibm-plex/`) | Fontsource 5.3.0 | SIL OFL 1.1 | pacchetto npm `@fontsource/ibm-plex-sans`: pesi 400–700, latino, latino esteso e greco |
| IBM Plex Mono (`vendor/ibm-plex/`) | Fontsource 5.3.0 | SIL OFL 1.1 | pacchetto npm `@fontsource/ibm-plex-mono`: pesi 400–600, latino e latino esteso |

SHA-256 di `chart.umd.js`: `fed6a739f8d0f0687174de6cd14745fc0fc7809144ab113d22908a26bf0d7fea`. Per aggiornare un componente: sostituire i file con quelli del nuovo pacchetto, aggiornare tabella, NOTICE e parametro `?v=` in `index.html`, ed eseguire tutte le verifiche.

**Content Security Policy** (meta in `index.html`):
- **Script.** Solo dalla pagina stessa: nessuno script o gestore di eventi inline.
- **Risorse.** Caratteri e stili dalla pagina stessa; immagini anche come `data:` e `blob:` (grafici ed esportazioni).
- **Connessioni.** Nessuna connessione di rete.
- **Stili inline.** `style-src` ammette `'unsafe-inline'`, perché l'interfaccia e Chart.js usano attributi `style` e la stampa genera un foglio per intestazione e piè di pagina.

La CSP è una difesa aggiuntiva: la protezione principale resta la validazione del file e l'escape dei valori.

**Pubblicazione**: la cartella si pubblica così com'è su GitHub Pages (branch `main`, radice). Quando cambia un file statico, aggiorna il parametro `?v=` dei riferimenti in `index.html`, così i browser non usano copie vecchie in cache.

**Versioni**: la versione dell'app (`VERSIONE_APP` in `app/progetto.js`) e quella del motore (`VERSIONE_MOTORE` in `motore/liquisite.js`) sono distinte. La versione del motore entra nella firma degli input: se cambia, i risultati salvati diventano «non aggiornati».

## Formato del progetto (JSON, `versioneFormato` 1)

```
{ formato: 'geohub-liquisite-progetto', versioneFormato: 1,
  progetto: { titolo, sito, lat, lon, noteZS9, autore, note },   // lat, lon: gradi decimali o null
  prove: [{ id, nome, tipo: 'CPTE'|'CPTU'|'SPT'|'VS', provenienza, esempio,
            unita: { z: 'm'|'cm', qc: 'MPa'|'kPa', fs: 'kPa'|'MPa', u2: 'kPa'|'MPa', … },
            colonne: ['z', …], dati: [[numero|null, …]],
            parametri: { CE, CB, CS, sporgenza, senzaRivestimento | ar } }],
  scenari: [{ id, nome, colore, provaId, metodo, Mw, amax, zFalda,
              strati: [{ da, a, gamma, gammaSat, FC|null, descrizione }],
              opzioni: { Vs12, IcSoglia, CFC, FSrif },
              esclusione: { faldaMediaStagionale, pcSubOrizzontale, fondazioniSuperficiali,
                            strati: [{ da, a, sabbiaPulita, curva, campione, decisione4, motivazione4 }] },
              note,
              magnitudo: { origine: 'zs9'|'manuale', motivazione } }],
  provaAttiva, scenarioAttivo }
```

- **Dati della prova.** Sono conservati come inseriti, nelle unità dichiarate; la conversione nelle unità del motore avviene solo al calcolo.
- **Il file è un dato non attendibile.** All'apertura ogni campo è controllato per tipo:
  - numeri (o vuoto) per misure, parametri e opzioni;
  - sì/no per le scelte;
  - testo solo per i campi descrittivi;
  - valori enumerati (tipo di prova, metodo, unità, decisione del criterio 4) confrontati con le sole chiavi proprie delle tabelle;
  - identificativi limitati a lettere, cifre e `- _ . :`, senza ripetizioni;
  - colori nel formato `#RRGGBB`.

  Il progetto viene ricostruito con i soli campi noti. Se un controllo fallisce, l'app elenca gli errori con il campo e il motivo e non tocca il progetto corrente.
- **Unità.** Sono obbligatorie per le colonne che ammettono più di un'unità (z, qc, fs, u2); per le altre (N, Vs, FC) l'unità è unica e viene assunta.
- **Risultati.** Non sono salvati nel file. Quelli presenti in file di versioni precedenti non vengono ricaricati: si ricalcolano dagli input con «Calcola», e l'app lo segnala all'apertura.
- **Progetti precedenti.** I file senza `FSrif` o senza `esclusione` si aprono con i valori predefiniti. I file senza coordinate o senza `magnitudo` (versioni fino alla 0.2.3) si aprono con coordinate vuote e M_w «inserimento manuale», con il valore salvato. Coordinate fuori intervallo restano come sono e sono segnalate dall'app. Un `FSrif` presente ma fuori dall'intervallo 1–3 resta com'è ed è segnalato come errore.
- **Rendering.** Ogni valore inserito nell'HTML passa da `esc()`, compresi gli attributi e i valori calcolati. `verifiche/verifica_sicurezza.mjs` e `verifiche/browser/verifica_browser.mjs` lo controllano con progetti alterati.
- **Firma degli input.** È un'impronta SHA-256 (64 cifre esadecimali, funzione sincrona in `app/progetto.js`, verificata contro i vettori NIST e contro Node) di prova, scenario e versione del motore. In stampa e nei margini compaiono le prime 16 cifre; il CSV riporta la firma intera. Non la modificano nome, note, FS di riferimento, dati della verifica preliminare, coordinate del sito e origine o motivazione della M_w, perché riguardano la lettura dei risultati e non il calcolo. La M_w invece vi entra.

## Regole per le modifiche

- **Formule.** Stanno solo in `motore/`. L'interfaccia non duplica né corregge formule, nemmeno per migliorare un grafico.
- **Metodi.** Ogni metodo è un blocco chiuso, con equazioni lette sulla pubblicazione originale e citate con pagina o numero di equazione.
- **Refusi delle fonti.** Vanno documentati in [Metodo di calcolo](metodo.md#refusi-delle-fonti-e-scelte-adottate) con la scelta adottata.
- **Dati mancanti o non calcolati.** Non diventano mai zero né esclusioni favorevoli. I tratti non indagati sono dati come intervalli (minimo–massimo), mai come sicuri.
- **Conversioni.** Nessuna conversione universale DPSH → SPT; le CPT a punta meccanica non sono supportate.
- **Testi dell'interfaccia.**
  - Nessuna frase del tipo «sito sicuro» o «terreno non liquefacibile»: l'esclusione si scrive «verifica omessa ai sensi del §7.11.3.4.2».
  - Nessuna classe di microzonazione per l'IL.
- **Stampa.** È A4 verticale, pensata come allegato alla relazione.
- **Dati dei file.** Sono sempre non attendibili: nuovi campi del progetto vanno aggiunti a `validaProgetto` con il loro tipo, e ogni valore inserito nell'HTML passa da `esc()`.
- **Dipendenze.** Niente risorse esterne: nuovi componenti vanno in `vendor/` con la licenza.
- **Verifiche.** Ogni modifica al calcolo va accompagnata da verifiche in `verifiche/`. Prima di pubblicare esegui `node verifiche/esegui.mjs --browser` (vedi [Validazione](validazione.md#eseguire-le-verifiche)) e controlla a vista stampa e vista mobile.
