# @audio/beat-onset [![npm](https://img.shields.io/npm/v/@audio/beat-onset)](https://www.npmjs.com/package/@audio/beat-onset) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Spectral flux onset detection

```
npm install @audio/beat-onset
```

```js
import onsets from '@audio/beat-onset'
```

Spectral flux. STFT → magnitude → sum positive frame-to-frame differences → adaptive threshold peak-pick. The general-purpose default.

```js
import onsets from '@audio/beat-onset'
let ons = onsets(samples, { fs: 44100 })
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Sample rate |
| `frameSize` | `2048` | STFT window size |
| `hopSize` | `512` | Hop between frames |
| `delta` | `1.4` | Adaptive threshold multiplier |
| `windowSize` | `8` | Peak-pick local mean window (frames) |

**Use when:** General-purpose onset detection — music, speech, mixed material.<br>
**Ref:** Dixon, "Onset Detection Revisited" (DAFx 2006).<br>
**Complexity:** $O(N \log F)$ where $N$ = samples, $F$ = frame size (FFT).

**Also in this package** (subpath imports, each a standalone default export):

| Import | Function | |
|---|---|---|
| `@audio/beat-onset/energy` | `energyOnsets(data, opts)` | Energy flux — no FFT, fastest, best for strong transients |
| `@audio/beat-onset/phase` | `phaseOnsets(data, opts)` | Phase deviation — robust to sustained tones |
| `@audio/beat-onset/band` | `bandOnsets(data, opts)` | Multi-band spectral flux — full-band music |

See the [@audio/beat](https://github.com/audiojs/beat#onset-detection) umbrella docs for their param tables and refs.

---

Part of [@audio/beat](https://github.com/audiojs/beat) — the beat family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
