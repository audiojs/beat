# @audio/beat-detect [![npm](https://img.shields.io/npm/v/@audio/beat-detect)](https://www.npmjs.com/package/@audio/beat-detect) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Full beat detection pipeline: onset detection → tempo estimation → beat grid

```
npm install @audio/beat-detect
```

```js
import detect from '@audio/beat-detect'
```

Full pipeline: spectral flux onsets → comb-filter tempo → phase-aligned beat grid. Shares a single STFT pass across onset and tempo stages, so it costs only marginally more than either alone.

```js
import { detect } from '@audio/beat'
let { bpm, confidence, beats, onsets } = detect(samples, { fs: 44100 })
```

Returns `{ bpm, confidence, beats: Float64Array, onsets: Float64Array }`.

**Use when:** Quick one-call solution — good enough for most applications.<br>
**Not for:** Tempo changes or rubato — the grid is uniform. Use `beatTrack` for adaptive tracking.

---

Part of [@audio/beat](https://github.com/audiojs/beat) — the beat family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
