// ── Constants ──────────────────────────────────────────────────────────────
const X_RANGE  = [0.0, 2.9];
const Z_RANGE  = [-0.05, 2.35];
const PAD      = { l: 38, r: 8, t: 14, b: 34 };
const THR_LINE = 0.4;

const DS_INFO = [
  { label: 'DS0  No damage',        color: '#D0D0D0' },
  { label: 'DS1  Plastic onset',     color: '#A8D8A8' },
  { label: 'DS2  Base cracking',     color: '#FFD966' },
  { label: 'DS3  Diagonal cracking', color: '#E07070' },
];

const AXIS_COMMON = {
  x: {
    type: 'linear',
    min: 0, max: 10,
    title: { display: true, text: 'Time [s]', font: { size: 10 } },
    ticks: { stepSize: 2, font: { size: 9 } },
    grid: { color: 'rgba(0,0,0,0.5)', lineWidth: 1, borderDash: [4, 4] },
  },
};

// ── State ──────────────────────────────────────────────────────────────────
let geometry  = null;
let histChart = null;
let thetaChart = null;
let bscChart   = null;

// ── Coordinate mapping ─────────────────────────────────────────────────────
function makeXform(canvas) {
  const W = canvas.width  - PAD.l - PAD.r;
  const H = canvas.height - PAD.t - PAD.b;
  return {
    tx: x => PAD.l + (x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0]) * W,
    tz: z => PAD.t + H - (z - Z_RANGE[0]) / (Z_RANGE[1] - Z_RANGE[0]) * H,
  };
}

// ── DS classification ──────────────────────────────────────────────────────
function classifyDS(data) {
  let sLw = 0, sBas = 0, sInb = 0, nLw = 0, nBas = 0, nInb = 0;
  geometry.elements.forEach((e, i) => {
    const d = data.damage[i];
    sLw += d; nLw++;
    if (e.group === 'base')   { sBas += d; nBas++; }
    if (e.group === 'inband') { sInb += d; nInb++; }
  });
  const mLw  = nLw  ? sLw  / nLw  : 0;
  const mBas = nBas ? sBas / nBas : 0;
  const mInb = nInb ? sInb / nInb : 0;
  let ds = 0;
  if (mInb > THR_LINE)       ds = 3;
  else if (mBas > THR_LINE)  ds = 2;
  else if (mLw  > 0)         ds = 1;
  return { ds, mLw, mBas, mInb };
}

// ── Wall rendering ─────────────────────────────────────────────────────────
function renderWall(data) {
  const canvas = document.getElementById('wall-canvas');
  const ctx    = canvas.getContext('2d');
  const { tx, tz } = makeXform(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  geometry.elements.forEach((elem, i) => {
    const d    = data.damage[i];
    const gray = Math.round(255 * (1 - d));
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.beginPath();
    elem.poly.forEach(([x, z], j) => {
      if (j === 0) ctx.moveTo(tx(x), tz(z));
      else         ctx.lineTo(tx(x), tz(z));
    });
    ctx.closePath();
    ctx.fill();
  });

  const diag = geometry.diagonal;
  strokePolyline(ctx, diag.line,     tx, tz, 'rgba(30,100,220,0.80)', 1.6, []);
  strokePolyline(ctx, diag.band_pos, tx, tz, 'rgba(30,100,220,0.40)', 1.0, [5, 4]);
  strokePolyline(ctx, diag.band_neg, tx, tz, 'rgba(30,100,220,0.40)', 1.0, [5, 4]);
  const zb = geometry.z_base_thr;
  strokeLine(ctx, X_RANGE[0], zb, X_RANGE[1], zb, tx, tz,
             'rgba(180,60,60,0.65)', 1.0, [4, 4]);

  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (const xv of [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]) {
    ctx.fillText(xv.toFixed(1), tx(xv), canvas.height - 4);
  }
  ctx.textAlign = 'right';
  for (const zv of [0.0, 0.5, 1.0, 1.5, 2.0]) {
    ctx.fillText(zv.toFixed(1), PAD.l - 4, tz(zv) + 4);
  }
  ctx.textAlign = 'center';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#444';
  ctx.fillText('X [m]', canvas.width / 2, canvas.height);
  ctx.save();
  ctx.translate(10, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Z [m]', 0, 0);
  ctx.restore();
}

function strokePolyline(ctx, pts, tx, tz, color, width, dash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, z], j) => {
    if (j === 0) ctx.moveTo(tx(x), tz(z));
    else         ctx.lineTo(tx(x), tz(z));
  });
  ctx.stroke();
  ctx.restore();
}

function strokeLine(ctx, x0, z0, x1, z1, tx, tz, color, width, dash) {
  strokePolyline(ctx, [[x0,z0],[x1,z1]], tx, tz, color, width, dash);
}

// ── Colorbar ───────────────────────────────────────────────────────────────
function renderColorbar() {
  const canvas = document.getElementById('colorbar-canvas');
  const ctx    = canvas.getContext('2d');
  const top    = PAD.t, bot = canvas.height - PAD.b;
  const barH   = bot - top;
  const bx = 18, bw = 16;

  const grad = ctx.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0, '#000');
  grad.addColorStop(1, '#fff');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, top, bw, barH);
  ctx.strokeStyle = '#aaa';
  ctx.strokeRect(bx, top, bw, barH);

  ctx.fillStyle = '#555';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  [1.0, 0.75, 0.5, 0.25, 0.0].forEach(v => {
    const y = top + (1 - v) * barH;
    ctx.fillText(v.toFixed(2), bx + bw + 3, y + 3);
    ctx.beginPath();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.8;
    ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y);
    ctx.stroke();
  });
  ctx.save();
  ctx.translate(10, (top + bot) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#666';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('damage', 0, 0);
  ctx.restore();
}

// ── Helper: build Chart.js options for response charts ────────────────────
function respChartOptions(yLabel) {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ...AXIS_COMMON.x },
      y: {
        title: { display: true, text: yLabel, font: { size: 10 } },
        ticks: { font: { size: 9 } },
        grid: { color: 'rgba(0,0,0,0.5)', lineWidth: 1, borderDash: [4, 4] },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => `t = ${parseFloat(items[0].label).toFixed(2)} s`,
          label: item  => ` ${item.dataset.label}: ${item.parsed.y.toFixed(4)}`,
        },
      },
    },
  };
}

// ── Drift ratio and BSC charts ─────────────────────────────────────────────
function renderResponse(data) {
  const r = data.response;

  // θ chart
  const thetaEl = document.getElementById('theta-chart');
  if (r && r.theta && r.theta.length) {
    if (thetaChart) {
      thetaChart.data.labels           = r.t;
      thetaChart.data.datasets[0].data = r.theta;
      thetaChart.update('none');
    } else {
      thetaChart = new Chart(thetaEl.getContext('2d'), {
        type: 'line',
        data: {
          labels: r.t,
          datasets: [{
            label: 'θ [%]',
            data: r.theta,
            borderColor: '#2a7a3a',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
            fill: false,
          }],
        },
        options: respChartOptions('θ [%]'),
      });
    }
    thetaEl.closest('.resp-wrap').classList.remove('no-data');
  } else {
    if (thetaChart) { thetaChart.data.labels = []; thetaChart.data.datasets[0].data = []; thetaChart.update('none'); }
    thetaEl.closest('.resp-wrap').classList.add('no-data');
  }

  // BSC chart
  const bscEl = document.getElementById('bsc-chart');
  if (r && r.bsc && r.bsc.length) {
    if (bscChart) {
      bscChart.data.labels           = r.t;
      bscChart.data.datasets[0].data = r.bsc;
      bscChart.update('none');
    } else {
      bscChart = new Chart(bscEl.getContext('2d'), {
        type: 'line',
        data: {
          labels: r.t,
          datasets: [{
            label: 'BSC',
            data: r.bsc,
            borderColor: '#8b4513',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
            fill: false,
          }],
        },
        options: respChartOptions('BSC'),
      });
    }
    bscEl.closest('.resp-wrap').classList.remove('no-data');
  } else {
    if (bscChart) { bscChart.data.labels = []; bscChart.data.datasets[0].data = []; bscChart.update('none'); }
    bscEl.closest('.resp-wrap').classList.add('no-data');
  }
}

// ── Damage time history chart ──────────────────────────────────────────────
function renderHistory(data) {
  const h = data.history;
  const thrData = h.t.map(() => THR_LINE);

  if (histChart) {
    histChart.data.labels            = h.t;
    histChart.data.datasets[0].data  = h.lw;
    histChart.data.datasets[1].data  = h.base;
    histChart.data.datasets[2].data  = h.inband;
    histChart.data.datasets[3].data  = thrData;
    histChart.update('none');
    return;
  }

  const ctx2 = document.getElementById('history-chart').getContext('2d');
  histChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: h.t,
      datasets: [
        { label: 'All LW',         data: h.lw,
          borderColor: '#333', borderWidth: 2, pointRadius: 0,
          tension: 0.15, fill: false },
        { label: 'Base bed-joint', data: h.base,
          borderColor: '#E07C00', borderWidth: 2, borderDash: [6, 3],
          pointRadius: 0, tension: 0.15, fill: false },
        { label: 'In-band',        data: h.inband,
          borderColor: '#C0392B', borderWidth: 2, borderDash: [3, 3],
          pointRadius: 0, tension: 0.15, fill: false },
        { label: `Threshold (${THR_LINE})`, data: thrData,
          borderColor: '#bbb', borderWidth: 1, borderDash: [4, 4],
          pointRadius: 0, fill: false },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ...AXIS_COMMON.x,
          title: { display: true, text: 'Time [s]', font: { size: 11 } },
          ticks: { stepSize: 2, font: { size: 10 } },
        },
        y: {
          min: 0, max: 1.0,
          title: { display: true, text: 'Mean damage', font: { size: 11 } },
          ticks: { stepSize: 0.2, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.5)', lineWidth: 1, borderDash: [4, 4] },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 22, font: { size: 10.5 } } },
        tooltip: {
          callbacks: {
            title: items => `t = ${parseFloat(items[0].label).toFixed(2)} s`,
            label: item  => ` ${item.dataset.label}: ${item.parsed.y.toFixed(4)}`,
          },
        },
      },
    },
  });
}

// ── DS badge + stats + truncation warning ──────────────────────────────────
function updateUI(data) {
  const { ds, mLw, mBas, mInb } = classifyDS(data);
  const info  = DS_INFO[ds] || DS_INFO[0];
  const badge = document.getElementById('ds-badge');
  const stats = document.getElementById('stats');
  badge.textContent      = info.label;
  badge.style.background = info.color;
  stats.textContent = `LW=${mLw.toFixed(3)}  base=${mBas.toFixed(3)}  in-band=${mInb.toFixed(3)}`;

  const warn = document.getElementById('trunc-warning');
  if (data.truncated) {
    document.getElementById('trunc-tend').textContent = data.t_end.toFixed(1);
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
}

// ── Load & render one PGA ──────────────────────────────────────────────────
async function loadPGA(pga) {
  document.getElementById('loading').style.display = 'inline';
  const fname = `data/PGA_${pga.toFixed(2)}g.json`;
  const data  = await fetch(fname).then(r => r.json());
  renderWall(data);
  renderResponse(data);
  renderHistory(data);
  updateUI(data);
  document.getElementById('loading').style.display = 'none';
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function init() {
  [geometry] = await Promise.all([
    fetch('data/geometry.json').then(r => r.json()),
  ]);
  const pga_list = await fetch('data/pga_list.json').then(r => r.json());

  const sel = document.getElementById('pga-select');
  pga_list.forEach(pga => {
    const opt = document.createElement('option');
    opt.value       = pga;
    opt.textContent = pga.toFixed(2) + ' g';
    sel.appendChild(opt);
  });
  sel.addEventListener('change', e => loadPGA(parseFloat(e.target.value)));

  renderColorbar();
  await loadPGA(pga_list[0]);
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML +=
    `<p style="color:red;padding:20px">
       Error loading data. Run <code>preprocess.py</code> first, then serve with<br>
       <code>python -m http.server 8000</code> and open <code>localhost:8000</code>.
     </p>`;
});
