# @audio/beat-tempo [![npm](https://img.shields.io/npm/v/@audio/beat-tempo)](https://www.npmjs.com/package/@audio/beat-tempo) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Tempo estimation via autocorrelation of onset detection function

```
npm install @audio/beat-tempo
```

```js
import tempo from '@audio/beat-tempo'
```

Autocorrelation of the onset detection function. Finds the dominant periodicity by correlating the spectral flux ODF with itself at different lags. Perceptual weighting (log-Gaussian centered at 120 BPM) resolves octave ambiguity.

```js
import { tempo } from '@audio/beat'
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

---

Part of [@audio/beat](https://github.com/audiojs/beat) — the beat family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
