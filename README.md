# Sketch Duel

A doodle-guessing duel against a neural network. Two modes:

1. **You draw, the AI guesses.** You get a word and a timer. A small neural net watches the canvas and names its three most likely answers.
2. **The AI draws, you guess.** The canvas replays a real human drawing from Google's QuickDraw dataset, stroke by stroke. The earlier you guess, the more points you score.

Everything runs **entirely in the browser**. There is no backend, no API call, and no drawing ever leaves the device. The production build is plain static files.

**Live:** https://draw.gitignore.space

## Quick start

```bash
npm install
npm run data:all   # download the dataset and train the model (~90 min, once)
npm run verify     # check the produced artifacts
npm run dev        # http://localhost:3000
```

`data:all` writes two artifacts into the repository, after which no internet access is needed:

- `public/model/model.bin` + `model.json` — the classifier weights (~300 KB);
- `public/replay/*.json` — 50 human drawings per category for mode 2 (~2 MB).

## How it works

```
shared/
  sketch.js       stroke rasterisation to 28x28 — ONE implementation for training and browser
  model.js        MLP runtime: int8 dequantisation + forward pass
  categories.js   100 categories with Russian labels and difficulty tiers
scripts/
  fetch-data.mjs  pulls QuickDraw slices over HTTP Range, builds the dataset and the replays
  train.mjs       trains the MLP in plain JS, exports int8 weights
  verify.mjs      checks the artifacts using the exact runtime the browser executes
app/
  components/SketchPad.vue      drawing canvas (pointer events, undo, smoothing)
  components/ReplayCanvas.vue   stroke player
  composables/                  model loading, replay loading, difficulty settings
  pages/                        index, draw (mode 1), guess (mode 2)
```

### Shared preprocessing

The most common reason a model like this "feels stupid" is a mismatch between how drawings were prepared during training and how they are prepared in production. Here `shared/sketch.js` is called both by `fetch-data.mjs` and by the browser, so the mismatch is impossible by construction.

Rasterisation: normalise by bounding box preserving aspect ratio → draw into 112×112 with a soft pen and max blending → average 4×4 blocks down to 28×28. The pipeline is invariant to scale, translation and device pixel ratio.

### The model

An MLP of `784 → 256 → 128 → 100` with ReLU, dropout and Adam. Training runs in plain JS on `Float32Array`, with no Python and no native modules, so the whole project reproduces with a single `npm run data:all`.

Weights are quantised to int8 with a per-output-neuron scale. `npm run verify` asserts that quantisation did not cost accuracy.

### Difficulty

Difficulty never swaps the model. It changes which categories are drawn from, how confident the network must be to accept a drawing, how often it is allowed to look at the canvas, and how many consecutive confident checks it needs before it may answer.

| Level | Words | Confidence | Round | Look every | Streak |
|---|---|---|---|---|---|
| Easy | 30 | 45% | 25 s | 400 ms | 2 |
| Normal | 65 | 62% | 20 s | 550 ms | 3 |
| Hard | 100 | 75% | 15 s | 700 ms | 3 |

## Deployment

The repository is connected to Vercel; every push to `main` deploys automatically.

```bash
npm run generate   # static output in .output/public
```

The output is plain static files, so any static host works. Example nginx config:

```nginx
server {
    server_name draw.example.com;
    root /var/www/sketch-duel;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(bin|json)$ { gzip on; expires 30d; }
}
```

Dependencies are installed with `npm install` rather than `npm ci`: on this dependency tree `npm ci` rejects every generated lock file, an npm bug involving the optional native `@emnapi/*` packages.

Local build output is excluded through `.vercelignore`. Without it, a locally built `.output` gets uploaded alongside the remote build, the client bundle and the app manifest end up coming from two different builds, and client-side routing silently stops working.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run generate` | static build into `.output/public` |
| `npm run data:fetch` | download the dataset and build the training set |
| `npm run data:train` | train the model and export the weights |
| `npm run verify` | check the artifacts (accuracy, replays, rasteriser) |

Tunable through environment variables:

```bash
N_TRAIN=3000 AUG_COPIES=2 npm run data:fetch
H1=384 EPOCHS=20 npm run data:train
```

## Data

[Google QuickDraw Dataset](https://github.com/googlecreativelab/quickdraw-dataset), licensed CC BY 4.0. The fetch script only pulls the slices it needs over HTTP Range — the full `.ndjson` files are 50–150 MB each.
