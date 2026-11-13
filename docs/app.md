# Applicazione web (v0.1 + revisione grafica)

Per le decisioni aggiornate leggere `AGENTS.md` e [Decisioni e attività](decisioni-e-attivita.md). La stampa corrente è A4 verticale, due profili per tavola. Per la prima revisione locale dell’interfaccia e le verifiche aggiuntive vedere [Revisione grafica](revisione-grafica.md). Le sezioni sotto descrivono il flusso originale; le impostazioni sono ora raccolte in una finestra a schede.

[← Torna al README](../README.md)

Percorso: **prova → scenario → calcolo → grafici e tabelle → confronto tra scenari → esportazione**.

## Uso

1. Aprire `index.html` da un server web (anche locale: `python3 -m http.server`) o da GitHub Pages.
2. **Esempio** carica un progetto di dati **sintetici** (CPTU e SPT inventati, marcati come esempio ovunque, anche in stampa e nel CSV).
3. **Prova**: «Nuova prova…» o «Importa / incolla dati…»: incolla da foglio elettronico o carica un CSV; scegliere separatore di colonna, separatore decimale, prima riga, associazione delle colonne e unità. Le celle vuote diventano dati mancanti; le celle non numeriche, le profondità non crescenti e i numeri ambigui (punto con decimale virgola) bloccano l'importazione con l'indicazione di riga e colonna.
4. **Scenario**: metodo compatibile con la prova, M_w, a_max in superficie [g] (forniti dal geologo con la fonte), opzioni del metodo, FS di riferimento (predefinito 1,25: EN 1998-5, § 4.1.4; modificabile tra 1 e 3; riguarda solo la lettura dei risultati e non entra nella firma degli input).
5. **Falda e stratigrafia**: falda di verifica, strati con γ, γ_sat e FC facoltativo.
6. **Calcola**. Se un input cambia, i risultati diventano «non aggiornati» (badge, velo sui grafici, avviso nelle tabelle) fino al ricalcolo; esportazione CSV e stampa richiedono risultati aggiornati.

## Struttura

| File | Ruolo |
|---|---|
| `motore/liquisite.js` | unica fonte dei calcoli (metodi, tensioni, criteri) |
| `app/progetto.js` | formato del progetto, unità, firma degli input, validazione dei file |
| `app/profilo.js` | collegamento prova → tensioni → motore; riepilogo; serie per i grafici; nessuna formula |
| `app/importa.js` | lettura di tabelle e CSV con conversioni esplicite |
| `app/esporta.js` | CSV con protezione dalle formule |
| `app/esempio.js` | progetto di esempio sintetico |
| `app/grafici.js` | profili Chart.js (solo disegno) |
| `app/ui.js` | interfaccia |
| `css/liquisite.css` | stile GeoHub (variabili e componenti ripresi da SismaSite) |

## Formato del progetto (JSON, `versioneFormato` 1)

```
{ formato: 'geohub-liquisite-progetto', versioneFormato: 1,
  progetto: { titolo, sito, autore, note },
  prove: [{ id, nome, tipo: 'CPTE'|'CPTU'|'SPT'|'VS', provenienza, esempio,
            unita: { z: 'm'|'cm', qc: 'MPa'|'kPa', fs: 'kPa'|'MPa', u2: 'kPa'|'MPa', … },
            colonne: ['z', …], dati: [[numero|null, …]], parametri: { CE, CB, CS, sporgenza, senzaRivestimento | ar } }],
  scenari: [{ id, nome, colore, provaId, metodo, Mw, amax, zFalda,
              strati: [{ da, a, gamma, gammaSat, FC|null, descrizione }], opzioni: { Vs12, IcSoglia, CFC, FSrif }, note }],
  provaAttiva, scenarioAttivo,
  risultati: { [scenarioId]: { versioneMotore, firma, calcolatoIl, configurazione, righe, riepilogo } } }
```

I dati della prova sono conservati come inseriti, nelle unità dichiarate; la conversione nelle unità del motore avviene solo al calcolo. All'apertura il file viene validato (formato, versione, tipi di prova, unità, numeri, compatibilità metodo–prova, riferimenti tra scenari e prove). I risultati salvati nel file vengono marcati `origine: 'file'` e mostrati come non aggiornati finché non si ricalcola con il motore corrente.

**Firma degli input**: impronta (FNV-1a) di prova, scenario e versione del motore. Nome e note non la modificano.

## Elaborazione del profilo

Per ogni lettura della prova:
- profondità mancante o non valida → `input_non_valido`;
- dato richiesto mancante (es. f_s, N) → `dati_insufficienti` (DATO_MANCANTE), il motore non viene chiamato;
- profondità oltre la stratigrafia → `dati_insufficienti` (FUORI_STRATIGRAFIA);
- tensioni dal motore (`tensioni`), poi il metodo puntuale del motore;
- sopra falda → `non_applicabile` (NON_SATURO, dal motore);
- FC: dato della prova se presente («misurato»), altrimenti FC dello strato («assegnato dalla stratigrafia», assunzione dichiarata), altrimenti regola del metodo (B&I CPT: stima da I_c; Kayen: 0 con avviso; metodi SPT: dato richiesto → FC_MANCANTE).

Le profondità non indagate non generano righe: il riepilogo distingue profondità indagata ed estensione analizzata. Un intervallo non calcolato non è mai trattato come sicuro.

## Grafici

- Profili affiancati con profondità crescente verso il basso e stessa scala; falda (tratteggio blu) e limiti degli strati (grigio).
- CPT e V_s: linee interrotte su righe non calcolate, dati mancanti e vuoti maggiori di 3 volte il passo mediano. SPT: punti discreti, mai uniti.
- CSR e CRR sono entrambe **a condizioni di sito** (CSR tratteggiata, CRR continua); le grandezze normalizzate a M 7,5 e 1 atm sono solo in tabella.
- FS = 1 è indicato come «riferimento del modello». Asse FS 0–3: i valori oltre la scala non vengono modificati, sono contati nella nota del pannello e visibili in tabella.
- Nessuno smoothing. Fasce FS < 1 / FS ≥ 1 come riferimento del modello, non classi normative o giudizi di sicurezza.
- Clic su un punto: selezione della riga, linea sulla stessa profondità in tutti i pannelli, dettaglio e collegamento alla tabella.

## Confronto tra scenari

«Duplica» crea una variante; nel confronto si scelgono fino a 3 scenari (anche su prove diverse: confronto per profondità dal p.c., senza quote). Il ricalcolo usa tensioni e tutte le grandezze dipendenti. L'app segnala scenari non aggiornati, metodi con basi di FS e P_L diverse e i cambiamenti del dominio dei punti calcolati (es. falda diversa). Nessun risultato viene scelto automaticamente.

## Esportazioni

- **CSV** (separatore `;`, decimale `,`, UTF-8 con BOM): intestazione con progetto, prova, scenario, metodo, parametri, versione del motore e firma; una riga per lettura con dati convertiti, tensioni, grandezze intermedie e finali a precisione piena, stato, codice, motivo, avvisi e assunzioni. Dati mancanti o non calcolati = cella vuota (mai zero). I testi che iniziano con `= + - @` vengono preceduti da un apostrofo.
- **JSON**: salvataggio e riapertura del progetto.
- **PNG** di ogni pannello (titolo, assi, unità, legenda, sfondo bianco).
- **Stampa HTML → PDF**: dati, stratigrafia, riepilogo, profili, avvisi, assunzioni e limiti, versione del motore e firma. Intestazione «GeoHub-LiquiSite – Verifica a liquefazione». Nessuna frase del tipo «sito sicuro».

## Verifiche

`node verifiche/verifica_profilo.mjs`: coincidenza riga per riga con il motore (CPTU, SPT B&I, SPT Cetin, V_s Kayen), intervalli, controlli dello scenario, firma, dominio, serie dei grafici, importazione e unità, CSV, JSON.

## Limiti noti (v0.1)

- a_max e M_w sono inserite dall'utente: nessun modulo di pericolosità (la proposta di M_w dalle zone ZS9 è rinviata).
- Una prova attiva alla volta; il confronto tra prove è solo per profondità.
- Indice IL (Iwasaki): calcolato senza classi, con intervallo IL_min–IL_max se la copertura 0–20 m è incompleta (vedi [Indice IL](indice-il.md)).
- Non calcolati: cedimenti, spostamenti laterali, sezioni.
- Criteri di esclusione (motore) non ancora presenti nell'interfaccia.
- Chart.js 4.4.4 e i caratteri sono caricati da CDN: senza rete l'app non funziona.
