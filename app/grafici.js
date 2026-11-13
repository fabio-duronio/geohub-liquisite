/*
 * GeoHub-LiquiSite — profili con Chart.js
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Solo disegno: i valori arrivano già calcolati dal motore (via app/profilo.js).
 * - nessuno smoothing (tension 0); le linee si interrompono tra segmenti;
 * - valori fuori scala non modificati: restano fuori dall'asse e sono contati nella nota;
 * - profondità crescente verso il basso, stessa scala in tutti i pannelli.
 */
(function (root) {
  'use strict';

  const FONT = "'IBM Plex Sans', 'Segoe UI', Arial, sans-serif";

  const sfondoBianco = {
    id: 'sfondoBianco',
    beforeDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
  };

  // Campiture esclusivamente grafiche: FS confrontato con 1 e con il riferimento scelto, non classi normative.
  const campiture = {
    id: 'campiture',
    beforeDatasetsDraw(chart, args, o) {
      const {ctx, chartArea:a, scales:{x,y}} = chart;
      if (!a) return;
      ctx.save(); ctx.beginPath(); ctx.rect(a.left,a.top,a.width,a.height); ctx.clip();
      const fascia = (lo,hi,col) => { ctx.fillStyle=col; const l=x.getPixelForValue(lo), r=x.getPixelForValue(hi); ctx.fillRect(l,a.top,r-l,a.height); };
      if(o.tipo==='FS') { const rif=o.fsRif>1?o.fsRif:1; fascia(0,1,'rgba(197,61,57,.13)'); if(rif>1) fascia(1,rif,'rgba(214,140,40,.12)'); fascia(rif,x.max,'rgba(40,135,113,.055)'); }
      if(o.tipo==='Ic') { fascia(x.min,o.sogliaIc,'rgba(208,165,76,.07)'); fascia(o.sogliaIc,x.max,'rgba(113,125,146,.13)'); }
      // Riempimento laterale dei soli segmenti continui: nessun ponte sui dati mancanti.
      const ds=chart.data.datasets;
      const fillSegment = (pts, base, color) => {
        if(pts.length<2) return;
        ctx.beginPath();ctx.moveTo(base,y.getPixelForValue(pts[0].y));
        for(const p of pts) ctx.lineTo(x.getPixelForValue(p.x),y.getPixelForValue(p.y));
        ctx.lineTo(base,y.getPixelForValue(pts[pts.length-1].y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
      };
      if(['FS','qc','qc1N','PL','Ic'].includes(o.tipo)) {
        const d=ds[ds.length-1];
        if(d && d.showLine) {
          let seg=[];
          const flush=()=>{fillSegment(seg,x.getPixelForValue(x.min),o.tipo==='FS'?'rgba(30,78,140,.10)':'rgba(30,78,140,.12)');seg=[];};
          for(const p of d.data){if(Number.isFinite(p.x)&&Number.isFinite(p.y))seg.push(p);else flush();}flush();
        }
      }
      ctx.restore();
    }
  };

  /** Linee orizzontali (falda, limiti di strato, punto selezionato) e verticali (riferimenti). */
  const linee = {
    id: 'linee',
    afterDatasetsDraw(chart, args, o) {
      const { ctx, chartArea: a, scales: { x, y } } = chart;
      if (!a) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top); ctx.clip();
      const orizzontale = (z, colore, dash, larghezza) => {
        if (typeof z !== 'number') return;
        const py = y.getPixelForValue(z);
        if (py < a.top || py > a.bottom) return;
        ctx.strokeStyle = colore; ctx.lineWidth = larghezza; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      };
      for (const z of o.strati || []) orizzontale(z, '#aab8c8', [], 1);
      if (typeof o.falda === 'number') {
        orizzontale(o.falda, '#2f7dd6', [6, 4], 1.5);
        const py = y.getPixelForValue(o.falda);
        if (py >= a.top && py <= a.bottom) {
          ctx.setLineDash([]); ctx.fillStyle = '#2f7dd6'; ctx.font = '11px ' + FONT;
          ctx.fillText('falda', a.right - 30, py - 4);
        }
      }
      for (const r of o.riferimentiX || []) {
        const px = x.getPixelForValue(r.x);
        if (px < a.left || px > a.right) continue;
        ctx.strokeStyle = '#5f6b7a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#4b5563'; ctx.font = '10.5px ' + FONT;
        ctx.save(); ctx.translate(px + 3, a.top + 4); ctx.rotate(Math.PI / 2); ctx.fillText(r.etichetta, 0, 0); ctx.restore();
      }
      if (typeof o.selezionato === 'number') orizzontale(o.selezionato, '#111827', [2, 2], 1);
      ctx.restore();
    }
  };

  /** Converte i segmenti in un'unica serie con interruzioni (null). */
  function datiConInterruzioni(segmenti) {
    const out = [];
    segmenti.forEach((s, i) => { if (i > 0) out.push({ x: null, y: null }); for (const p of s) out.push(p); });
    return out;
  }

  /**
   * cfg: { titolo, etichettaX, yMax, falda, strati: [z], riferimentiX: [{x, etichetta}],
   *        xMin, xMax, logX, serie: [{ nome, colore, tratteggio, soloPunti, segmenti }],
   *        cifre, onClick(indice), selezionato }
   */
  function profilo(canvas, cfg) {
    const datasets = cfg.serie.map(s => ({
      label: s.nome,
      data: s.soloPunti ? s.segmenti.flat() : datiConInterruzioni(s.segmenti),
      borderColor: s.colore, backgroundColor: s.colore,
      borderWidth: 2, borderDash: s.tratteggio ? [6, 4] : [],
      pointRadius: s.soloPunti ? 4 : 0, pointHoverRadius: 5, pointHitRadius: 6,
      pointStyle: s.stilePunto || 'circle',
      showLine: !s.soloPunti, spanGaps: false, tension: 0,
      segment: cfg.tipoPannello === 'FS' ? { borderColor: c => c.p0.parsed.x < 1 && c.p1.parsed.x < 1 ? '#b53332' : '#1e4e8c' } : undefined
    }));
    const cifre = cfg.cifre ?? 3;
    const fmt = (v) => typeof v === 'number' ? v.toLocaleString('it-IT', { maximumFractionDigits: cifre }) : '–';
    return new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      plugins: [sfondoBianco, campiture, linee, { id:'legendaAllineata', beforeInit(c) { const fit=c.legend.fit.bind(c.legend); c.legend.fit=function(){fit();this.height=48;}; } }],
      options: {
        responsive: !cfg.statico, maintainAspectRatio: false, animation: false,
        devicePixelRatio: cfg.statico ? 2 : undefined,
        interaction: { mode: 'nearest', intersect: false, axis: 'y' },
        layout: { padding: { right: 10, top: 8 } },
        scales: {
          y: { type: 'linear', reverse: true, min: 0, max: cfg.yMax,
            title: { display: true, text: 'z [m]', font: { family: FONT, size: 11 } },
            afterFit: s => { s.width = 42; }, grid: { color: '#e7ecf1' }, ticks: { font: { family: FONT, size: 11 }, stepSize: cfg.yMax <= 20 ? 2 : undefined } },
          x: { type: cfg.logX ? 'logarithmic' : 'linear', position: 'top', min: cfg.xMin, max: cfg.xMax,
            afterFit: s => { s.height = 56; }, title: { display: true, text: cfg.etichettaX, font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 }, maxTicksLimit: 6 } }
        },
        plugins: {
          title: { display: true, text: cfg.titolo, font: { family: FONT, size: 12.5, weight: '600' }, color: '#111827', padding: { bottom: 4 } },
          legend: { display: true, position: 'bottom', labels: { font: { family: FONT, size: 11 }, boxWidth: 16, boxHeight: 2, usePointStyle: false, padding: 10 } },
          tooltip: {
            filter: (it) => it.raw && typeof it.raw.x === 'number',
            callbacks: {
              title: (items) => items.length ? 'z = ' + fmt(items[0].raw.y) + ' m' : '',
              label: (it) => it.dataset.label + ': ' + fmt(it.raw.x)
            }
          },
          campiture: { tipo: cfg.tipoPannello, sogliaIc: cfg.sogliaIc ?? 2.6, fsRif: cfg.fsRif ?? 1 },
          linee: { falda: cfg.falda, strati: cfg.strati, riferimentiX: cfg.riferimentiX, selezionato: cfg.selezionato }
        },
        onClick: (evt, elementi, chart) => {
          if (!cfg.onClick) return;
          const el = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false, axis: 'y' }, false)[0];
          if (!el) return;
          const raw = chart.data.datasets[el.datasetIndex].data[el.index];
          if (raw && typeof raw.indice === 'number') cfg.onClick(raw.indice);
        }
      }
    });
  }

  function selezione(chart, z) {
    chart.options.plugins.linee.selezionato = z;
    chart.update('none');
  }

  /** Immagine PNG del grafico con sfondo bianco (titolo, assi, unità e legenda inclusi). */
  function png(chart) {
    return chart.toBase64Image('image/png', 1);
  }

  /** Immagine PNG di dimensione fissa per la stampa (stessi dati e stessa configurazione). */
  function immagineStampa(cfg, larghezza = 330, altezza = 620) {
    const cv = document.createElement('canvas');
    cv.width = larghezza; cv.height = altezza;
    cv.style.width = larghezza + 'px'; cv.style.height = altezza + 'px';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + larghezza + 'px;height:' + altezza + 'px;';
    box.appendChild(cv); document.body.appendChild(box);
    const ch = profilo(cv, { ...cfg, statico: true, onClick: null });
    const url = ch.toBase64Image('image/png', 1);
    ch.destroy(); box.remove();
    return url;
  }

  // ---------------------------------------------------------------------------
  // Carta di comportamento CPT (Q–F, scale logaritmiche)
  // Limiti delle zone 2–7: curve di Ic costante (Robertson & Wride 1998, Eq. 5 e Tab. 1),
  // cioè circonferenze di centro (log F = −1,22; log Q = 3,47) e raggio Ic.
  // ---------------------------------------------------------------------------
  const F_MIN = 0.1, F_MAX = 10, Q_MIN = 1, Q_MAX = 1000;

  /** Punti della curva Ic = costante nel riquadro della carta. */
  function curvaIc(ic) {
    const out = [];
    for (let i = 0; i <= 240; i++) {
      const lf = Math.log10(F_MIN) + (Math.log10(F_MAX) - Math.log10(F_MIN)) * i / 240;
      const d = ic * ic - (lf + 1.22) ** 2;
      if (d < 0) continue;
      const lq = 3.47 - Math.sqrt(d);
      const Q = 10 ** lq, F = 10 ** lf;
      if (Q >= Q_MIN && Q <= Q_MAX) out.push({ x: F, y: Q });
    }
    return out;
  }

  const etichetteZone = {
    id: 'etichetteZone',
    afterDatasetsDraw(chart, args, o) {
      const { ctx, chartArea: a, scales: { x, y } } = chart;
      ctx.save(); ctx.font = '600 12px ' + FONT; ctx.fillStyle = '#5f6b7a'; ctx.textAlign = 'center';
      for (const z of o.zone || []) {
        // etichetta sulla bisettrice dell'anello tra due curve di Ic, lungo la direzione F = 1 %
        const ic = z.icMedio, lf = Math.log10(1.0), d = ic * ic - (lf + 1.22) ** 2;
        if (d < 0) continue;
        const Q = 10 ** (3.47 - Math.sqrt(d));
        const px = x.getPixelForValue(1.0), py = y.getPixelForValue(Q);
        if (px < a.left || px > a.right || py < a.top || py > a.bottom) continue;
        ctx.fillText(String(z.zona), px, py + 4);
      }
      ctx.restore();
    }
  };

  /**
   * cfg: { punti: [{ Q, F, Ic, gruppo: 'calcolato'|'escluso'|'altro', z, indice }], soglia,
   *        limiti: [1.31, 2.05, 2.60, 2.95, 3.60], zone: [{ zona, icMedio }], statico, onClick }
   */
  function cartaSBT(canvas, cfg) {
    const gruppi = [
      { k: 'calcolato', nome: 'punti verificati (Ic ≤ soglia)', colore: 'rgba(30,78,140,.75)' },
      { k: 'escluso', nome: 'Ic oltre soglia (FS N.A.)', colore: 'rgba(140,150,165,.75)' },
      { k: 'altro', nome: 'sopra falda o non calcolati', colore: 'rgba(214,140,40,.75)' }
    ];
    const datasets = gruppi.map(g => ({
      label: g.nome, data: cfg.punti.filter(p => p.gruppo === g.k).map(p => ({ x: p.F, y: p.Q, z: p.z, indice: p.indice })),
      backgroundColor: g.colore, borderColor: g.colore, pointRadius: 2.2, pointHoverRadius: 4, showLine: false
    })).filter(d => d.data.length);
    for (const ic of cfg.limiti) datasets.push({ label: 'Ic = ' + String(ic).replace('.', ','), data: curvaIc(ic), showLine: true, pointRadius: 0,
      borderColor: '#9aa6b5', borderWidth: 1, fill: false, _limite: true });
    if (typeof cfg.soglia === 'number') datasets.push({ label: 'soglia Ic dello scenario ' + String(cfg.soglia).replace('.', ','), data: curvaIc(cfg.soglia),
      showLine: true, pointRadius: 0, borderColor: '#b53332', borderWidth: 1.5, borderDash: [6, 4], fill: false });
    return new Chart(canvas, {
      type: 'scatter', data: { datasets },
      plugins: [sfondoBianco, etichetteZone],
      options: {
        responsive: !cfg.statico, maintainAspectRatio: false, animation: false,
        devicePixelRatio: cfg.statico ? 2 : undefined,
        scales: {
          x: { type: 'logarithmic', min: F_MIN, max: F_MAX, title: { display: true, text: 'F, rapporto d\'attrito normalizzato [%]', font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 }, callback: v => [0.1, 0.2, 0.5, 1, 2, 5, 10].includes(Number(v.toPrecision(2))) ? String(v).replace('.', ',') : '' } },
          y: { type: 'logarithmic', min: Q_MIN, max: Q_MAX, title: { display: true, text: 'Q, resistenza di punta normalizzata [–]', font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 }, callback: v => [1, 10, 100, 1000].includes(v) ? String(v) : '' } }
        },
        plugins: {
          title: { display: true, text: 'Carta di comportamento CPT (zone 2–7 da Ic)', font: { family: FONT, size: 12.5, weight: '600' }, color: '#111827' },
          legend: { position: 'bottom', labels: { font: { family: FONT, size: 11 }, boxWidth: 12, filter: (it, data) => !data.datasets[it.datasetIndex]._limite } },
          tooltip: { filter: it => !it.dataset._limite && it.raw && typeof it.raw.z === 'number',
            callbacks: { label: it => 'z = ' + it.raw.z.toLocaleString('it-IT') + ' m · Q = ' + it.raw.y.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' · F = ' + it.raw.x.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' %' } },
          etichetteZone: { zone: cfg.zone }
        },
        onClick: (evt, el, chart) => {
          if (!cfg.onClick) return;
          const e = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false)[0];
          if (!e) return;
          const raw = chart.data.datasets[e.datasetIndex].data[e.index];
          if (raw && typeof raw.indice === 'number') cfg.onClick(raw.indice);
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Curva granulometrica sui fusi della Fig. 7.11.1 (NTC 2018)
  // ---------------------------------------------------------------------------
  const CLASSI_GRANULOMETRICHE = [
    { nome: 'argilla', da: 0.0005, a: 0.002 }, { nome: 'limo', da: 0.002, a: 0.06 },
    { nome: 'sabbia', da: 0.06, a: 2 }, { nome: 'ghiaia', da: 2, a: 100 }
  ];
  const bandeGranulometriche = {
    id: 'bandeGranulometriche',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x } } = chart;
      ctx.save(); ctx.font = '600 10.5px ' + FONT; ctx.textAlign = 'center';
      CLASSI_GRANULOMETRICHE.forEach((c, i) => {
        const l = Math.max(a.left, x.getPixelForValue(c.da)), r = Math.min(a.right, x.getPixelForValue(c.a));
        if (r <= l) return;
        ctx.fillStyle = i % 2 ? 'rgba(30,78,140,.035)' : 'rgba(255,255,255,0)'; ctx.fillRect(l, a.top, r - l, a.bottom - a.top);
        ctx.strokeStyle = '#c9d3de'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r, a.top); ctx.lineTo(r, a.bottom); ctx.stroke();
        ctx.fillStyle = '#5f6b7a'; ctx.fillText(c.nome.toUpperCase(), (l + r) / 2, a.top + 13);
      });
      ctx.restore();
    }
  };

  /** cfg: { fusi: [{ nome, sinistra: [[p,d]], destra: [[p,d]], colore }], curva: [[d,p]] | null, statico } */
  function fusoGranulometrico(canvas, cfg) {
    const datasets = [];
    for (const f of cfg.fusi) {
      const contorno = f.sinistra.map(([p, d]) => ({ x: d, y: p })).concat(f.destra.slice().reverse().map(([p, d]) => ({ x: d, y: p })));
      contorno.push(contorno[0]);
      datasets.push({ label: f.nome, data: contorno, showLine: true, pointRadius: 0, borderColor: f.colore, borderWidth: 1.5,
        backgroundColor: f.colore.replace(/[\d.]+\)$/, '0.12)'), fill: 'shape' });
    }
    if (cfg.curva && cfg.curva.length) datasets.push({ label: 'curva del campione', data: cfg.curva.slice().sort((a, b) => a[0] - b[0]).map(([d, p]) => ({ x: d, y: p })),
      showLine: true, pointRadius: 3, borderColor: '#111827', backgroundColor: '#111827', borderWidth: 1.8, fill: false });
    return new Chart(canvas, {
      type: 'scatter', data: { datasets },
      plugins: [sfondoBianco, bandeGranulometriche],
      options: {
        responsive: !cfg.statico, maintainAspectRatio: false, animation: false,
        devicePixelRatio: cfg.statico ? 2 : undefined,
        scales: {
          x: { type: 'logarithmic', min: 0.001, max: 100, title: { display: true, text: 'diametro dei grani d [mm]', font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 }, callback: v => [0.001, 0.01, 0.1, 1, 10, 100].includes(Number(v.toPrecision(1))) ? String(v).replace('.', ',') : '' } },
          y: { min: 0, max: 100, title: { display: true, text: 'passante [%]', font: { family: FONT, size: 11 } }, grid: { color: '#eef1f4' }, ticks: { stepSize: 20, font: { family: FONT, size: 10.5 } } }
        },
        plugins: {
          title: { display: true, text: 'Curva granulometrica e fusi della Fig. 7.11.1 (NTC 2018)', font: { family: FONT, size: 12.5, weight: '600' }, color: '#111827' },
          legend: { position: 'bottom', labels: { font: { family: FONT, size: 11 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: it => 'd = ' + it.raw.x.toLocaleString('it-IT', { maximumSignificantDigits: 3 }) + ' mm · passante ' + it.raw.y.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' %' } }
        }
      }
    });
  }

  /** Immagine PNG di un grafico qualsiasi costruito da una funzione (per la stampa). */
  function immagineDa(costruttore, cfg, larghezza, altezza) {
    const cv = document.createElement('canvas');
    cv.width = larghezza; cv.height = altezza;
    cv.style.width = larghezza + 'px'; cv.style.height = altezza + 'px';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + larghezza + 'px;height:' + altezza + 'px;';
    box.appendChild(cv); document.body.appendChild(box);
    const ch = costruttore(cv, { ...cfg, statico: true, onClick: null });
    const url = ch.toBase64Image('image/png', 1);
    ch.destroy(); box.remove();
    return url;
  }

  root.LiquiGrafici = { profilo, selezione, png, immagineStampa, cartaSBT, fusoGranulometrico, immagineDa };
})(typeof self !== 'undefined' ? self : this);
