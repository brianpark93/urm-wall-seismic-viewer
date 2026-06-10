# URM Wall Seismic Damage Viewer

Interactive web app: select a PGA level → see damage distribution on the wall + mean damage time history.

## Step 1 — Generate data (run once)

```bash
cd web_damage_viewer
python preprocess.py
```

Reads `../raw_data/PGA_X.XXg/damage_parameter_all.csv` + `messag` for each run.  
Writes to `data/geometry.json`, `data/pga_list.json`, `data/PGA_X.XXg.json`.

**Requirements:** `numpy`, `pandas`

## Step 2 — View locally

```bash
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser.

> `file://` does not work — you must serve via HTTP.

## Step 3 — Deploy to GitHub Pages

1. `git init` (if not already a repo)
2. Commit everything including `data/`
3. GitHub → Settings → Pages → Source: `main` branch, `/ (root)` or `/web_damage_viewer` subfolder
4. Access at `https://<user>.github.io/<repo>/web_damage_viewer/`

## Features

| Panel | Description |
|-------|-------------|
| Wall canvas | Each hex element polygon coloured by final CSCM damage (white=0, black=1) |
| Colorbar | Damage scale 0–1 |
| DS badge | Damage state assigned from group mean damage (DS0–DS3) |
| Time history | Mean group damage vs. time: All LW / Base bed-joint / In-band (diagonal) |

## DS Classification

| DS | Condition |
|----|-----------|
| DS0 | mean_dmg_LW = 0 |
| DS1 | mean_dmg_LW > 0 |
| DS2 | mean_dmg_base > 0.4 |
| DS3 | mean_dmg_inband > 0.4 |
