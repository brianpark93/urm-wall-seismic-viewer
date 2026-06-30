// ── Constants ──────────────────────────────────────────────────────────────
const THR_BASE   = 0.4;   // DS2: base bed-joint
const THR_INBAND_DS3 = 0.2;   // DS3: diagonal initiation
const THR_INBAND_DS4 = 0.4;   // DS4: diagonal propagation
const LW_COLOR = 'rgb(255,255,255)';   // long wall intact
const SW_COLOR = 'rgb(255,255,255)';   // short wall intact

const DS_INFO = [
  { label: 'DS0  No damage',             color: '#D0D0D0' },
  { label: 'DS1  Plastic onset',         color: '#A8D8A8' },
  { label: 'DS2  Base cracking',         color: '#FFD966' },
  { label: 'DS3  Diagonal initiation',   color: '#F0A860' },
  { label: 'DS4  Diagonal propagation',  color: '#E07070' },
];

const GRID_STYLE  = { color: 'rgba(128,128,128,0.5)', lineWidth: 1, borderDash: [4, 4] };
const BORDER_STYLE = { color: '#333' };

const AXIS_COMMON = {
  x: {
    type: 'linear',
    min: 0, max: 10,
    title: { display: true, text: 'Time [s]', font: { size: 10 } },
    ticks: { stepSize: 2, font: { size: 9 } },
    grid: GRID_STYLE,
    border: BORDER_STYLE,
  },
};

// Colorbar padding
const CB_PAD = { t: 14, b: 34 };

// ── State ──────────────────────────────────────────────────────────────────
let geometry   = null;
let histChart  = null;
let thetaChart = null;
let bscChart   = null;

// ── Coordinate mapping (auto-fit to projected bbox) ───────────────────────
function makeXform(canvas) {
  const { xmin, xmax, zmin, zmax } = geometry.bbox;
  const PAD_PX = 20;
  const W = canvas.width  - 2 * PAD_PX;
  const H = canvas.height - 2 * PAD_PX;
  const sx = W / (xmax - xmin);
  const sz = H / (zmax - zmin);
  const s  = Math.min(sx, sz);
  const ox = PAD_PX + (W - s * (xmax - xmin)) / 2;
  const oz = PAD_PX + (H - s * (zmax - zmin)) / 2;
  return {
    tx: xi => ox + (xmax - xi) * s,   // invert_xaxis: map xmax→left, xmin→right
    tz: zi => oz + (zmax - zi) * s,   // screen Y increases downward → flip
  };
}

// ── DS classification (LW elements only) ──────────────────────────────────
function classifyDS(data) {
  let sLw = 0, sBas = 0, sInb = 0, nLw = 0, nBas = 0, nInb = 0;
  geometry.elements.forEach((e, i) => {
    const d = data.damage[i];
    if (e.wall === 'lw')      { sLw  += d; nLw++;  }
    if (e.group === 'base')   { sBas += d; nBas++; }
    if (e.group === 'inband') { sInb += d; nInb++; }
  });
  const mLw  = nLw  ? sLw  / nLw  : 0;
  const mBas = nBas ? sBas / nBas : 0;
  const mInb = nInb ? sInb / nInb : 0;
  let ds = 0;
  if (mInb > THR_INBAND_DS4)      ds = 4;
  else if (mInb > THR_INBAND_DS3) ds = 3;
  else if (mBas > THR_BASE)       ds = 2;
  else if (mLw  > 0)              ds = 1;
  return { ds, mLw, mBas, mInb };
}

// ── Wall rendering ─────────────────────────────────────────────────────────
function renderWall(data) {
  const canvas = document.getElementById('wall-canvas');
  const ctx    = canvas.getContext('2d');
  const { tx, tz } = makeXform(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // elements are pre-sorted back-to-front in geometry.json (painter's algorithm)
  geometry.elements.forEach((elem, i) => {
    const d = data.damage[i];
    if (d < 0.05) {
      ctx.fillStyle = elem.wall === 'lw' ? LW_COLOR : SW_COLOR;
    } else {
      const gray = Math.round(255 * (1 - d));
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    }
    ctx.beginPath();
    elem.poly.forEach(([xi, zi], j) => {
      if (j === 0) ctx.moveTo(tx(xi), tz(zi));
      else         ctx.lineTo(tx(xi), tz(zi));
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
  });

  const diag = geometry.diagonal;
  strokePolyline(ctx, diag.line,     tx, tz, 'rgba(200,0,0,0.85)', 1.6, []);
  strokePolyline(ctx, diag.band_pos, tx, tz, 'rgba(200,0,0,0.50)', 1.0, [5, 4]);
  strokePolyline(ctx, diag.band_neg, tx, tz, 'rgba(200,0,0,0.50)', 1.0, [5, 4]);
}

function strokePolyline(ctx, pts, tx, tz, color, width, dash) {
  if (!pts || pts.length === 0) return;
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

// ── Colorbar ───────────────────────────────────────────────────────────────
function renderColorbar() {
  const canvas = document.getElementById('colorbar-canvas');
  const ctx    = canvas.getContext('2d');
  const top    = CB_PAD.t, bot = canvas.height - CB_PAD.b;
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
        grid: GRID_STYLE,
        border: BORDER_STYLE,
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
  const thrDs3 = h.t.map(() => THR_INBAND_DS3);
  const thrDs4 = h.t.map(() => THR_INBAND_DS4);

  if (histChart) {
    histChart.data.labels            = h.t;
    histChart.data.datasets[0].data  = h.lw;
    histChart.data.datasets[1].data  = h.base;
    histChart.data.datasets[2].data  = h.inband;
    histChart.data.datasets[3].data  = thrDs3;
    histChart.data.datasets[4].data  = thrDs4;
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
        { label: `DS3 threshold (${THR_INBAND_DS3})`, data: thrDs3,
          borderColor: '#3070d0', borderWidth: 1, borderDash: [2, 2],
          pointRadius: 0, fill: false },
        { label: `DS2/DS4 threshold (${THR_INBAND_DS4})`, data: thrDs4,
          borderColor: '#3070d0', borderWidth: 1, borderDash: [4, 4],
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
          grid: GRID_STYLE,
          border: BORDER_STYLE,
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
  const fname = `data/PGA_${pga.toFixed(4)}g.json`;
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
    opt.textContent = parseFloat(pga.toFixed(4)) + ' g';
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
       Error loading data. Run <code>preprocess_ver2.ipynb</code> first, then serve with<br>
       <code>python -m http.server 8000</code> and open <code>localhost:8000</code>.
     </p>`;
});
