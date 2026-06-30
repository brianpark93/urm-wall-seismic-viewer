# URM Wall Seismic Damage Viewer

Interactive web app for exploring the IDA results of an L-shaped unreinforced
masonry (URM) fence wall: select a PGA level and see the resulting damage
distribution on the wall together with the structural response and group-mean
damage time histories.

Open `index.html` (served over HTTP, e.g. via GitHub Pages) — no build step
required, the page reads pre-generated data from the `data/` folder.

## Features

| Panel | Description |
|-------|-------------|
| Wall canvas | Each hex element polygon coloured by final CSCM damage (white=0, black=1) |
| Colorbar | Damage scale 0–1 |
| DS badge | Damage state assigned from group mean damage (DS0–DS4) |
| Drift ratio / BSC charts | Global structural response over time |
| Time history | Mean group damage vs. time: All LW / Base bed-joint / In-band (diagonal) |

## DS Classification

Evaluated hierarchically from DS4 downward, so the highest observable state prevails.

| DS | Label | Condition |
|----|-------|-----------|
| DS0 | No damage | mean_dmg_LW = 0 |
| DS1 | Plastic onset | mean_dmg_LW > 0 |
| DS2 | Base cracking | mean_dmg_base > 0.4 |
| DS3 | Diagonal half | mean_dmg_inband > 0.2 |
| DS4 | Diagonal complete (wall no longer structurally functional) | mean_dmg_inband > 0.4 |
