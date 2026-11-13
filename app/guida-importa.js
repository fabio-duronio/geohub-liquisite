/* GeoHub-LiquiSite — guida all'importazione. Nessuna conversione DPSH→SPT.
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con termini aggiuntivi NOTICE. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const diz = {
    z: ['Profondità', 'Distanza dal piano campagna, positiva verso il basso.', 'm'],
    qc: ['Resistenza alla punta', 'Resistenza misurata dal cono; non è il numero di colpi.', 'MPa'],
    fs: ['Attrito laterale locale', 'Resistenza misurata dal manicotto della punta.', 'kPa'],
    u2: ['Pressione interstiziale', 'Pressione misurata dietro la punta CPTu. Non è la profondità della falda.', 'kPa'],
    N: ['Numero di colpi SPT grezzo', 'N misurato sui 30 cm finali della prova SPT standard; non N60 e non colpi DPSH.', 'colpi/30 cm'],
    Vs: ['Velocità delle onde di taglio', 'Velocità assegnata alla profondità di misura.', 'm/s'],
    FC: ['Contenuto di fini', 'Percentuale in massa del materiale fine. Facoltativo nel file: per SPT serve nel file oppure negli strati.', '%']
  };
  const colonne = {CPTE:['z','qc','fs','FC'], CPTU:['z','qc','fs','u2','FC'], SPT:['z','N','FC'], VS:['z','Vs','FC']};
  function aggiorna() {
    const tipo=$('imTipo').value, keys=colonne[tipo]||colonne.CPTU;
    $('guidaImporta').innerHTML = '<h3>Quali dati devo inserire?</h3><p>Usa le misure del rapporto di prova, non risultati già normalizzati. Le sigle significano:</p><div class="table-scroll"><table class="data-table guide-table"><thead><tr><th>Sigla</th><th>Misura richiesta</th><th>Unità iniziale</th></tr></thead><tbody>'+ keys.map(k=>'<tr><td>'+k+'</td><td><b>'+diz[k][0]+'</b><br><span>'+diz[k][1]+'</span></td><td>'+diz[k][2]+'</td></tr>').join('')+'</tbody></table></div>'+ (tipo==='CPTE'?'<p class="hint">CPT a punta elettrica senza misura u2. Non usare questa scelta per assimilare automaticamente una CPT meccanica.</p>':'') +
      ((tipo==='CPTE'||tipo==='CPTU')?'<details class="dpsh-help"><summary>Ho una CPT a punta meccanica (CPTM): posso usarla?</summary><p><b>No, non in questa versione.</b> Il metodo CPT di Boulanger e Idriss (2014) è calibrato su prove con punta elettrica o piezocono. La punta meccanica misura qc e fs con una geometria e una sequenza di avanzamento diverse: i valori non sono equivalenti e l’indice Ic ne risulta alterato.</p><p>Il volume CNR-CentroMS «Pratiche correnti» (2024, § 3.2.1.2) sconsiglia la CPT meccanica per la verifica a liquefazione perché tende a sottostimare la suscettibilità e rimanda, se la si usa, a correzioni proposte in letteratura. Queste correzioni non sono implementate: inserire una CPTM come CPTE produrrebbe risultati non a favore di sicurezza.</p><p>Usa la CPTM per la stratigrafia e come supporto qualitativo; per la verifica servono una CPTU o CPTE, oppure SPT in foro.</p></details>':'') +
      '<details class="dpsh-help"><summary>Ho una DPSH oppure valori N60 già corretti: come procedo?</summary><p><b>Non inserirli nella colonna N SPT.</b> I colpi DPSH non sono automaticamente equivalenti ai colpi SPT. Questo motore usa N SPT grezzo e applica energia, aste, foro, campionatore e normalizzazione: inserire N60 come N può duplicare le correzioni.</p><p>Per una futura procedura DPSH servono almeno: modello dell’attrezzatura, massa e caduta del maglio, geometria del cono, avanzamento per conteggio, aste, dati energetici disponibili e una correlazione documentata e applicabile al terreno. Un eventuale N60 equivalente deve conservare fonte e incertezza.</p><p>I metodi di verifica disponibili sono calibrati su SPT, CPT e Vs: nessuno usa direttamente i colpi DPSH. Il passaggio DPSH→SPT dipende da attrezzatura, energia, terreno e profondità e non ha una formula di validità generale.</p><p>Il percorso DPSH e l’ingresso diretto di N60 non sono supportati in questa versione. Usa la DPSH per la stratigrafia e per individuare i livelli da indagare, e per la verifica una prova SPT originale: non cambiare i coefficienti a tentativi per far accettare i dati.</p></details>';
    const required=LiquiProgetto.TIPI_PROVA[tipo]?.colonne||keys;
    $('imTesto').placeholder=required.join('\t')+'\nIncolla sotto le intestazioni le tue misure, una riga per profondità.\nPuoi usare virgola o punto decimale scegliendo il formato qui sotto.';
    for(const k of keys){const l=document.querySelector('label[for="imM_'+k+'"]');if(l)l.textContent=diz[k][0]+' ('+k+')'+(required.includes(k)?' *':' — facoltativo');}
    if(!$('imTesto').value.trim()) { $('imErrori').innerHTML='<p class="hint">In attesa dei dati: incolla la tabella o scegli un file. L’esempio sintetico non viene inserito automaticamente.</p>'; }
  }
  new MutationObserver(aggiorna).observe($('imMappa'),{childList:true});
  $('imModello').onclick=()=>{
    const keys=LiquiProgetto.TIPI_PROVA[$('imTipo').value].colonne.concat(['FC']);
    const header=[...new Set(keys)].map(k=>k+' ['+diz[k][2]+']').join(';')+'\r\n';
    const url=URL.createObjectURL(new Blob(['\ufeff'+header],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='modello-'+$('imTipo').value.toLowerCase()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('imIntestazioni').onclick=()=>{
    if($('imTesto').value.trim()&&!confirm('Sostituire il testo con le sole intestazioni? I dati presenti nel riquadro verranno rimossi.'))return;
    const keys=LiquiProgetto.TIPI_PROVA[$('imTipo').value].colonne;
    $('imSep').value=';';$('imDec').value=',';
    $('imTesto').value=keys.join(';')+'\n';$('imTesto').dispatchEvent(new Event('input',{bubbles:true}));$('imTesto').focus();
  };
})();
