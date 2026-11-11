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
      borderWidth: 1.6, borderDash: s.tratteggio ? [6, 4] : [],
      pointRadius: s.soloPunti ? 4 : 0, pointHoverRadius: 5, pointHitRadius: 6,
      pointStyle: s.stilePunto || 'circle',
      showLine: !s.soloPunti, spanGaps: false, tension: 0
    }));
    const cifre = cfg.cifre ?? 3;
    const fmt = (v) => typeof v === 'number' ? v.toLocaleString('it-IT', { maximumFractionDigits: cifre }) : '–';
    return new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      plugins: [sfondoBianco, linee],
      options: {
        responsive: !cfg.statico, maintainAspectRatio: false, animation: false,
        devicePixelRatio: cfg.statico ? 2 : undefined,
        interaction: { mode: 'nearest', intersect: false, axis: 'y' },
        layout: { padding: { right: 6 } },
        scales: {
          y: { type: 'linear', reverse: true, min: 0, max: cfg.yMax,
            title: { display: true, text: 'z [m]', font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 } } },
          x: { type: cfg.logX ? 'logarithmic' : 'linear', position: 'top', min: cfg.xMin, max: cfg.xMax,
            title: { display: true, text: cfg.etichettaX, font: { family: FONT, size: 11 } },
            grid: { color: '#eef1f4' }, ticks: { font: { family: FONT, size: 10.5 }, maxTicksLimit: 6 } }
        },
        plugins: {
          title: { display: true, text: cfg.titolo, font: { family: FONT, size: 12.5, weight: '600' }, color: '#111827', padding: { bottom: 4 } },
          legend: { display: cfg.serie.length > 1, position: 'bottom', labels: { font: { family: FONT, size: 11 }, boxWidth: 18, boxHeight: 2, usePointStyle: false } },
          tooltip: {
            filter: (it) => it.raw && typeof it.raw.x === 'number',
            callbacks: {
              title: (items) => items.length ? 'z = ' + fmt(items[0].raw.y) + ' m' : '',
              label: (it) => it.dataset.label + ': ' + fmt(it.raw.x)
            }
          },
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

  root.LiquiGrafici = { profilo, selezione, png, immagineStampa };
})(typeof self !== 'undefined' ? self : this);
