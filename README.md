# beat-detection [![test](https://github.com/audiojs/beat-detection/actions/workflows/test.yml/badge.svg)](https://github.com/audiojs/beat-detection/actions/workflows/test.yml) [![npm](https://img.shields.io/npm/v/beat-detection)](https://www.npmjs.com/package/beat-detection) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Onset detection, tempo estimation, and beat tracking.

<table><tr><td valign="top">

**[Onset Detection](#onset-detection)**<br>
<sub>[onsets](#onsetsdata-opts) · [energyOnsets](#energyonsetsdata-opts) · [phaseOnsets](#phaseonsetsdata-opts) · [bandOnsets](#bandonsetsdata-opts)</sub>

**[Tempo Estimation](#tempo-estimation)**<br>
<sub>[tempo](#tempodata-opts) · [combTempo](#combtempodata-opts)</sub>

</td><td valign="top">

**[Beat Tracking](#beat-tracking)**<br>
<sub>[detect](#detectdata-opts) · [beatTrack](#beattrackdata-opts)</sub>

**[Utilities](#utilities)**<br>
<sub>[spectralFlux](#spectralfluxdata-opts) · [energyFlux](#energyfluxdata-opts) · [peakPick](#peakpickodf-opts)</sub>

</td></tr></table>


## Usage

```
npm install beat-detection
```

```js
import { detect, onsets, tempo, beatTrack } from 'beat-detection'

// full pipeline: onsets → tempo → beat grid
let result = detect(samples, { fs: 44100 })
result.bpm        // 120.2
result.beats      // Float64Array [0.01, 0.51, 1.01, ...]
result.onsets      // Float64Array [0.01, 0.26, 0.51, ...]

// individual algorithms
let ons = onsets(samples, { fs: 44100 })          // onset times in seconds
let tmp = tempo(samples, { fs: 44100 })           // { bpm, confidence }
let bt  = beatTrack(samples, { fs: 44100 })       // { beats, bpm, confidence }
```

> Works in Node.js and browser. No Web Audio API needed — operates on raw `Float32Array` / `Float64Array` samples.


## How it works

```
                    ┌──────────────────────────────────────────┐
                    │              raw samples                  │
                    └──────────┬───────────────────┬────────────┘
                               │                   │
                    ┌──────────▼──────────┐  ┌─────▼──────────┐
                    │    Onset Detection   │  │ Tempo Estimation│
                    │                      │  │                 │
                    │  STFT → magnitude →  │  │  autocorrelation│
                    │  positive flux →     │  │  or comb-filter │
                    │  adaptive threshold  │  │  of ODF         │
                    └──────────┬──────────┘  └─────┬──────────┘
                               │                   │
                               │    ┌──────────────┘
                               │    │
                    ┌──────────▼────▼─────────────────────────┐
                    │           Beat Tracking                   │
                    │                                           │
                    │  phase-aligned grid (detect)              │
                    │  or DP optimal sequence (beatTrack)       │
                    └──────────────────────────────────────────┘
```

**Onset detection** finds *when* events happen — note attacks, drum hits, transients. Four algorithms with different trade-offs.

**Tempo estimation** finds *how fast* — the dominant periodicity in the onset function. Two methods: autocorrelation and comb-filter resonance.

**Beat tracking** combines both: given onsets and tempo, find the beat positions. `detect` snaps a grid to onsets; `beatTrack` uses dynamic programming to find the globally optimal beat sequence.


## Onset Detection

All onset functions take raw samples and return onset times in seconds as `Float64Array`.

### `onsets(data, opts)`

Spectral flux. STFT → magnitude → sum positive frame-to-frame differences → adaptive threshold peak-pick. The general-purpose default.

```js
import { onsets } from 'beat-detection'
let ons = onsets(samples, { fs: 44100 })
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Sample rate |
| `frameSize` | `2048` | STFT window size |
| `hopSize` | `512` | Hop between frames |
| `delta` | `1.4` | Adaptive threshold multiplier |

**Use when:** General-purpose onset detection — music, speech, mixed material.<br>
**Ref:** Dixon, "Onset Detection Revisited" (DAFx 2006).<br>
**Complexity:** $O(N \log F)$ where $N$ = samples, $F$ = frame size (FFT).


### `energyOnsets(data, opts)`

Energy flux. Per-frame RMS energy → positive first differences → adaptive threshold. No FFT — fastest algorithm. Best for strong transients.

```js
import { energyOnsets } from 'beat-detection'
let ons = energyOnsets(samples, { fs: 44100 })
```

Same params as `onsets`.

**Use when:** Percussive material, real-time, CPU-constrained — 10× faster than spectral flux.<br>
**Not for:** Soft onsets, pitched instruments with gradual attacks.<br>
**Ref:** Klapuri, "Auditory Model Based Beat Tracking" (ICMC 1999).<br>
**Complexity:** $O(N)$ — no FFT, just RMS per frame.


### `phaseOnsets(data, opts)`

Phase deviation. Measures divergence between predicted and actual STFT phase, weighted by magnitude. More robust to steady-state signals (sustained notes, drones) than spectral flux.

```js
import { phaseOnsets } from 'beat-detection'
let ons = phaseOnsets(samples, { fs: 44100 })
```

Same params as `onsets`.

**Use when:** Material with sustained tones where spectral flux produces false onsets.<br>
**Not for:** Speed-critical paths — requires complex FFT (2× cost of spectral flux).<br>
**Ref:** Bello et al., "A Tutorial on Onset Detection in Music Signals" (IEEE TASLP 2005).<br>
**Complexity:** $O(N \log F)$ with complex FFT.


### `bandOnsets(data, opts)`

Multi-band spectral flux. Splits spectrum into frequency bands, computes spectral flux per band, sums. Detects onsets across different instrument ranges simultaneously.

```js
import { bandOnsets } from 'beat-detection'
let ons = bandOnsets(samples, { fs: 44100, bands: 6 })
```

| Param | Default | |
|---|---|---|
| `bands` | `4` | Number of frequency bands |
| + all `onsets` params | | |

**Use when:** Full-band music where low-frequency kicks and high-frequency hats produce onsets that a single-band detector misses.<br>
**Ref:** Klapuri, "Sound Onset Detection by Applying Psychoacoustic Knowledge" (ICASSP 1999).<br>
**Complexity:** $O(N \log F)$ — same FFT cost, slightly more post-processing.


### Onset comparison

| | Speed | Transients | Soft onsets | Steady-state | Best for |
|---|---|---|---|---|---|
| `onsets` | ★★★ | ★★★★ | ★★★ | ★★ | General purpose |
| `energyOnsets` | ★★★★★ | ★★★★★ | ★ | ★ | Percussive, real-time |
| `phaseOnsets` | ★★ | ★★★ | ★★★★ | ★★★★ | Sustained tones |
| `bandOnsets` | ★★★ | ★★★★ | ★★★ | ★★★ | Full-band music |


## Tempo Estimation

Both return `{ bpm, confidence }`. Pass `candidates: N` to get ranked alternatives.

### `tempo(data, opts)`

Autocorrelation of the onset detection function. Finds the dominant periodicity by correlating the spectral flux ODF with itself at different lags. Perceptual weighting (log-Gaussian centered at 120 BPM) resolves octave ambiguity.

```js
import { tempo } from 'beat-detection'
let { bpm, confidence } = tempo(samples, { fs: 44100 })
let { bpm, candidates } = tempo(samples, { fs: 44100, candidates: 3 })
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Sample rate |
| `minBpm` | `60` | Minimum BPM to consider |
| `maxBpm` | `200` | Maximum BPM to consider |
| `candidates` | `1` | Number of tempo candidates to return |

**Use when:** General tempo estimation — robust for most material.<br>
**Ref:** Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007).<br>
**Complexity:** $O(N \log F + L^2)$ where $L$ = lag range in ODF frames.


### `combTempo(data, opts)`

Comb-filter resonance. Tests BPM hypotheses by correlating the ODF with raised-cosine pulse trains at each candidate tempo (+ harmonics). Returns the BPM with highest resonance.

```js
import { combTempo } from 'beat-detection'
let { bpm, confidence } = combTempo(samples, { fs: 44100 })
```

Same params as `tempo`.

**Use when:** Cross-validation with autocorrelation, or when the signal has strong harmonic tempo structure.<br>
**Ref:** Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals" (JASA 1998).<br>
**Complexity:** $O(N \log F + B \cdot L)$ where $B$ = BPM range tested.


## Beat Tracking

### `detect(data, opts)`

Full pipeline: spectral flux onsets → autocorrelation tempo → phase-aligned beat grid. Finds the grid phase that best aligns with detected onsets.

```js
import { detect } from 'beat-detection'
let { bpm, confidence, beats, onsets } = detect(samples, { fs: 44100 })
```

Returns `{ bpm, confidence, beats: Float64Array, onsets: Float64Array }`.

**Use when:** Quick one-call solution — good enough for most applications.<br>
**Not for:** Tempo changes or rubato — the grid is uniform. Use `beatTrack` for adaptive tracking.


### `beatTrack(data, opts)`

Dynamic programming beat tracker. Estimates tempo (via autocorrelation), then finds the globally optimal beat sequence by maximizing onset strength while penalizing tempo deviation. Each beat position is placed where the onset function is strongest, subject to staying near the expected tempo period.

```js
import { beatTrack } from 'beat-detection'
let { beats, bpm, confidence } = beatTrack(samples, { fs: 44100 })
let result = beatTrack(samples, { fs: 44100, bpm: 120 })  // hint tempo
```

| Param | Default | |
|---|---|---|
| `bpm` | auto-estimated | Target BPM (auto-estimated if omitted) |
| + all `tempo` params | | |

Returns `{ beats: Float64Array, bpm, confidence }`.

**Use when:** Irregular timing, live performance, rubato — adapts to where beats actually fall.<br>
**Not for:** Perfectly metronomic material — `detect` is faster and sufficient.<br>
**Ref:** Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007).


## Utilities

Low-level building blocks. Used internally, exported for custom pipelines.

### `spectralFlux(data, opts)`

STFT → magnitude → sum positive differences. Returns the onset detection function (ODF) as `{ odf, nFrames, hopSize, frameSize, fs }`.

```js
import { spectralFlux } from 'beat-detection'
let { odf, nFrames, hopSize } = spectralFlux(samples, { fs: 44100 })
```

### `energyFlux(data, opts)`

Per-frame RMS energy → positive first differences. Returns `{ odf, nFrames, hopSize, frameSize, fs }`.

### `peakPick(odf, opts)`

Adaptive threshold peak-picker. Local mean × delta → pick peaks above threshold. Returns onset times in seconds.

```js
import { spectralFlux, peakPick } from 'beat-detection'
let { odf, hopSize, fs } = spectralFlux(samples, { fs: 44100 })
let onsets = peakPick(odf, { hopSize, fs, delta: 1.5 })
```


## Performance

All algorithms run 250–8000× faster than real-time on a single core (16.5s signal, 44.1 kHz, Node.js):

| Algorithm | Time | Throughput | Real-time multiple |
|---|---|---|---|
| `energyOnsets` | 2 ms | 362 Msamp/s | 8200× RT |
| `onsets` | 19 ms | 38 Msamp/s | 850× RT |
| `tempo` | 19 ms | 39 Msamp/s | 890× RT |
| `bandOnsets` | 21 ms | 35 Msamp/s | 790× RT |
| `combTempo` | 25 ms | 29 Msamp/s | 660× RT |
| `detect` | 37 ms | 20 Msamp/s | 450× RT |
| `beatTrack` | 18 ms | 40 Msamp/s | 900× RT |
| `phaseOnsets` | 63 ms | 12 Msamp/s | 260× RT |

Full 8-algorithm pass on 8.5s audio completes in ~150ms in-browser.


## See also

- [digital-filter](https://github.com/audiojs/digital-filter) — filter design and processing
- [time-stretch](https://github.com/audiojs/time-stretch) — time stretching and pitch shifting
- [audio-lena](https://github.com/audiojs/audio-lena) — test audio sample
