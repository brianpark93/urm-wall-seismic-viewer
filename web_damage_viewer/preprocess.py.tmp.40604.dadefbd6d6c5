"""
Generates JSON data files for the web damage viewer.
Run once from this file's directory:

    python preprocess.py

Outputs:
  data/geometry.json      – polygon coords + group labels for all LW elements
  data/pga_list.json      – sorted list of available PGA values
  data/PGA_X.XXg.json     – per-PGA: final damage array + group mean time series
"""
from pathlib import Path
import json, re, sys
import numpy as np
import pandas as pd

HERE    = Path(__file__).parent
ROOT    = HERE.parent
GEO_K   = ROOT / 'geometry' / 'mortar_geometry_only.k'
RAW_DIR = ROOT / 'raw_data'
OUT_DIR = HERE / 'data'
OUT_DIR.mkdir(exist_ok=True)

Y_LW   = 1.84
Z_BASE = 0.03
BAND_HW = 0.20

# ── Parse mortar geometry ─────────────────────────────────────────────────
def parse_k(fp):
    nodes, elems = [], []
    mode = None
    with open(fp, 'r') as f:
        for raw in f:
            line = raw.strip()
            if line.startswith('*'):
                up = line.upper()
                if   up.startswith('*NODE')          : mode = 'node'
                elif up.startswith('*ELEMENT_SOLID') : mode = 'elem'
                else                                 : mode = None
                continue
            if not line or line.startswith('$'): continue
            p = line.split()
            if mode == 'node' and len(p) >= 4:
                try: nodes.append((int(p[0]), float(p[1]), float(p[2]), float(p[3])))
                except ValueError: pass
            elif mode == 'elem' and len(p) >= 10:
                try: elems.append([int(x) for x in p[:10]])
                except ValueError: pass
    nd = pd.DataFrame(nodes, columns=['nid','x','y','z'])
    ed = pd.DataFrame(elems,  columns=['eid','pid','n1','n2','n3','n4','n5','n6','n7','n8'])
    return nd, ed

print('Parsing geometry ...')
nodes_df, elems_df = parse_k(GEO_K)
nxyz = nodes_df.set_index('nid')[['x','y','z']].to_dict('index')
NC   = ['n1','n2','n3','n4','n5','n6','n7','n8']

cents = np.array([
    np.mean([[nxyz[row[c]]['x'], nxyz[row[c]]['y'], nxyz[row[c]]['z']] for c in NC], axis=0)
    for _, row in elems_df.iterrows()
])
elems_df = elems_df.copy()
elems_df[['cx','cy','cz']] = cents

lw_mask    = elems_df['cy'] > Y_LW
base_mask  = lw_mask & (elems_df['cz'] <  Z_BASE)
above_mask = lw_mask & (elems_df['cz'] >= Z_BASE)

lw_elems    = elems_df[lw_mask].copy()
above_elems = elems_df[above_mask].copy()

# diagonal band
x0, x1 = above_elems['cx'].min(), above_elems['cx'].max()
z0, z1 = above_elems['cz'].min(), above_elems['cz'].max()
dc   = np.array([(x0+x1)/2, (z0+z1)/2])
rd   = np.array([x1-x0, z1-z0])
dd   = rd / np.linalg.norm(rd)
perp = np.array([-dd[1], dd[0]])

above_elems = above_elems.copy()
above_elems['in_band'] = above_elems.apply(
    lambda r: abs(np.dot(np.array([r['cx'], r['cz']]) - dc,
                         np.array([-dd[1], dd[0]]))) <= BAND_HW, axis=1)

base_eids   = set(elems_df[base_mask]['eid'])
inband_eids = set(above_elems[above_elems['in_band']]['eid'])

def group_of(eid):
    if eid in base_eids:   return 'base'
    if eid in inband_eids: return 'inband'
    return 'above'

# XZ polygon per element (sorted CCW)
def make_poly(row):
    xz = np.array([[nxyz[row[c]]['x'], nxyz[row[c]]['z']] for c in NC])
    pts = np.unique(np.round(xz, 6), axis=0)
    cx, cz = pts[:,0].mean(), pts[:,1].mean()
    order  = np.argsort(np.arctan2(pts[:,1]-cz, pts[:,0]-cx))
    return [[round(float(v),4) for v in pt] for pt in pts[order]]

print('Building polygons ...')
elements_geo = []
for _, row in lw_elems.iterrows():
    eid = int(row['eid'])
    elements_geo.append({'eid': eid, 'group': group_of(eid), 'poly': make_poly(row)})

# diagonal overlay lines (50 points)
t_arr = np.linspace(-3, 3, 50)
def line_pts(offset=0):
    return [[round(float(dc[0]+t*dd[0]+offset*perp[0]),4),
             round(float(dc[1]+t*dd[1]+offset*perp[1]),4)] for t in t_arr]

geo = {
    'elements': elements_geo,
    'n_base':   len(base_eids),
    'n_inband': len(inband_eids),
    'z_base_thr': Z_BASE,
    'diagonal': {'line': line_pts(0), 'band_pos': line_pts(+BAND_HW), 'band_neg': line_pts(-BAND_HW)},
}
(OUT_DIR / 'geometry.json').write_text(json.dumps(geo), encoding='utf-8')
print(f'  geometry.json written  ({len(elements_geo):,} LW elements)')

# ── Per-PGA data ──────────────────────────────────────────────────────────
FAIL_RE = re.compile(r'solid element\s+(\d+)\s+failed at time\s+([0-9.E+\-]+)', re.IGNORECASE)

def parse_messag(fp):
    d = {}
    if not fp.exists(): return d
    with open(fp) as f:
        for line in f:
            m = FAIL_RE.search(line)
            if m:
                eid = int(m.group(1))
                if eid not in d: d[eid] = float(m.group(2))
    return d

eid_list     = [e['eid'] for e in elements_geo]
base_eid_l   = [e['eid'] for e in elements_geo if e['group'] == 'base']
inband_eid_l = [e['eid'] for e in elements_geo if e['group'] == 'inband']

pga_folders = sorted(
    [d for d in RAW_DIR.iterdir() if d.is_dir() and d.name.startswith('PGA_')],
    key=lambda p: float(re.search(r'PGA_([0-9.]+)g', p.name).group(1))
)

pga_list = []

for folder in pga_folders:
    pga      = float(re.search(r'PGA_([0-9.]+)g', folder.name).group(1))
    csv_path = folder / 'damage_parameter_all.csv'
    if not csv_path.exists():
        print(f'  SKIP {folder.name}  (no damage_parameter_all.csv)')
        continue

    print(f'  {folder.name} ...', end='  ', flush=True)
    eroded = parse_messag(folder / 'messag')

    # read CSV (header=1 skips LS-DYNA title row)
    df = pd.read_csv(csv_path, header=1, index_col=0)
    valid = {c: int(c) for c in df.columns if str(c).strip().lstrip('-').isdigit()}
    df    = df[list(valid.keys())].rename(columns=valid)
    df.index = df.index.astype(float)

    # eroded correction: t_fail → damage = 1.0 for all t >= t_fail
    for eid, tf in eroded.items():
        if eid in df.columns:
            df.loc[df.index >= tf, eid] = 1.0

    # final damage (array aligned to elements_geo)
    last = df.iloc[-1]
    def safe_dmg(eid):
        v = float(last.get(eid, 0.0))
        return 1.0 if (eid in eroded and v < 1.0) else v

    final_dmg = [round(safe_dmg(e), 4) for e in eid_list]

    # group mean time series
    def grp_mean(eids):
        cols = [e for e in eids if e in df.columns]
        return df[cols].mean(axis=1) if cols else pd.Series(0.0, index=df.index)

    ts_lw     = grp_mean(eid_list)
    ts_base   = grp_mean(base_eid_l)
    ts_inband = grp_mean(inband_eid_l)

    # downsample to ≤300 timesteps
    idx = np.round(np.linspace(0, len(df)-1, min(300, len(df)))).astype(int)

    out = {
        'damage': final_dmg,
        'history': {
            't':      [round(float(v),3) for v in df.index[idx]],
            'lw':     [round(float(v),4) for v in ts_lw.iloc[idx]],
            'base':   [round(float(v),4) for v in ts_base.iloc[idx]],
            'inband': [round(float(v),4) for v in ts_inband.iloc[idx]],
        }
    }
    fname = f'PGA_{pga:.2f}g.json'
    (OUT_DIR / fname).write_text(json.dumps(out), encoding='utf-8')
    pga_list.append(round(pga, 2))
    print(f'eroded={len(eroded)}, steps={len(idx)}')

(OUT_DIR / 'pga_list.json').write_text(json.dumps(sorted(pga_list)), encoding='utf-8')
print(f'\nDone — {len(pga_list)} PGA levels written to {OUT_DIR}')
