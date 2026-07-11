# @audio/beat-track [![npm](https://img.shields.io/npm/v/@audio/beat-track)](https://www.npmjs.com/package/@audio/beat-track) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Dynamic programming beat tracker

```
npm install @audio/beat-track
```

```js
import beatTrack from '@audio/beat-track'
```

Dynamic programming beat tracker. Estimates tempo (via autocorrelation), then finds the globally optimal beat sequence by maximizing onset strength while penalizing tempo deviation. Each beat position is placed where the onset function is strongest, subject to staying near the expected tempo period.

```js
import beatTrack from '@audio/beat-track'
let { beats, bpm, confidence } = beatTrack(samples, { fs: 44100 })
let result = beatTrack(samples, { fs: 44100, bpm: 120 })  // hint tempo
```

| Param | Default | |
|---|---|---|
| `bpm` | auto-estimated | Target BPM (auto-estimated if omitted) |
| `tightness` | `680` | Tempo constraint weight (higher = stricter) |
| + all `tempo` params | | `fs`, `frameSize`, `hopSize`, `minBpm`, `maxBpm`, `candidates` |

Returns `{ beats: Float64Array, bpm, confidence }`.

**Use when:** Irregular timing, live performance, rubato — adapts to where beats actually fall.<br>
**Not for:** Perfectly metronomic material — `detect` is faster and sufficient.<br>
**Ref:** Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007).

---

Part of [@audio/beat](https://github.com/audiojs/beat) — the beat family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
