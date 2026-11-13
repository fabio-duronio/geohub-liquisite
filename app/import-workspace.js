/* GeoHub-LiquiSite — importazione a passaggi, nessun calcolo scientifico.
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con termini aggiuntivi NOTICE. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), dlg=$('dlgImporta');
  let step=1;
  const guide=$('guidaImporta'), field=guide.parentElement;
  const grid=document.createElement('div');grid.className='import-entry-grid';
  field.parentElement.insertBefore(grid,field);grid.append(field);grid.append(guide);
  function vai(n){
    step=n;
    for(let i=1;i<=3;i++)$('importStep'+i).hidden=i!==n;
    dlg.querySelectorAll('[data-import-step]').forEach(b=>{
      if(Number(b.dataset.importStep)===n)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    });
    $('imIndietro').disabled=n===1;$('imAvanti').hidden=n===3;$('imApplica').hidden=n!==3;
    $('imAvanti').textContent=n===1?'Avanti · Colonne e unità':'Avanti · Controlla i dati';
    dlg.querySelector('.dlg-body').scrollTop=0;
  }
  dlg.querySelectorAll('[data-import-step]').forEach(b=>b.onclick=()=>vai(Number(b.dataset.importStep)));
  $('imAvanti').onclick=()=>vai(Math.min(3,step+1));
  $('imIndietro').onclick=()=>vai(Math.max(1,step-1));
  dlg.addEventListener('importa:aperto',e=>{
    vai(1);$('imSalvato').hidden=true;
    $('imApplica').textContent='Salva la prova';
    $('dlgTitolo').title=e.detail.riprendi?'Bozza recuperata in questa sessione':'';
    $('imDraftNote').textContent=e.detail.riprendi?'Bozza recuperata. Puoi riprendere le correzioni.':'La bozza resta disponibile se torni ai risultati. Usa «Salva la prova» per applicarla al progetto.';
  });
  dlg.addEventListener('importa:salvato',()=>{
    $('imSalvato').hidden=false;
    $('imSalvato').textContent='Prova salvata nel progetto in memoria. Puoi tornare ai dati o alle colonne e correggere ancora, senza riaprire nulla. Per conservare il progetto dopo la chiusura del browser, usa «Salva progetto» nei risultati.';
    $('imApplica').textContent='Salva le modifiche';
  });
  dlg.addEventListener('input',()=>{$('imSalvato').hidden=true;});
  dlg.addEventListener('change',()=>{$('imSalvato').hidden=true;});
  const note=document.createElement('p');note.id='imDraftNote';note.className='hint draft-note';
  $('importStep1').prepend(note);
  vai(1);
})();
