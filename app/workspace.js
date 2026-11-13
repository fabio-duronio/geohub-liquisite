/* GeoHub-LiquiSite — workspace: solo interfaccia, nessuna formula di calcolo.
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con termini aggiuntivi NOTICE. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const dlg = $('dlgSettings');
  function sezione(id) {
    dlg.querySelectorAll('details.collapse').forEach(d => { d.hidden = d.id !== id; d.open = d.id === id; });
    $('settingsTitle').textContent = {secProgetto:'Progetto', secProva:'Prove', secScenario:'Scenario e metodo', secStrati:'Stratigrafia e falda'}[id];
  }
  sezione('secScenario');
  $('btnImpostazioni').onclick = () => { sezione('secProgetto'); dlg.showModal(); };
  document.querySelectorAll('[data-open-section]').forEach(b => b.onclick = () => { sezione(b.dataset.openSection); dlg.showModal(); });
  $('closeSettings').onclick = () => dlg.close();
  $('btnQuickCalcola').onclick = () => {
    if ($('btnCalcola').disabled) { sezione('secProva'); dlg.showModal(); return; }
    $('btnCalcola').click();
  };
  $('btnCalcola').addEventListener('click', () => {
    if (dlg.open && $('statoCalcolo').querySelector('.badge-ok')) dlg.close();
  });
  $('btnNuovo').addEventListener('click', () => { sezione('secProva'); });
  // Etichetta del pulsante rapido aggiornata con lo stato del calcolo, senza spostare il focus.
  new MutationObserver(() => {
    const st = $('statoCalcolo');
    $('btnQuickCalcola').textContent = st.querySelector('.badge-stale') ? 'Ricalcola scenario' : 'Calcola scenario';
  }).observe($('statoCalcolo'), { childList: true, subtree: true });
})();
