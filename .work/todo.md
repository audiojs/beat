## Plan

### Architecture
- [x] Extract shared ODF computation into internal helper, deduplicate onset.js ↔ tempo.js
- [x] Ensure all functions are pure (no shared mutable state), minimal functional style, convention is similar to ~/projects/time-stretch

### Onset Detection
- [x] Spectral flux (current) — clean up, make canonical
- [x] Energy-based onset detection (simple, fast)
- [x] Complex-domain onset detection (phase deviation)
- [x] Multi-band onset detection (bandwise spectral flux, log-frequency bands per Klapuri)
- [x] Adaptive threshold — refine: use mean+delta instead of median, handle edge cases

### Tempo Estimation
- [x] Autocorrelation (current) — clean up, make canonical
- [x] Comb-filter resonance (tempo hypothesis grid)
- [x] Return tempo candidates with confidences, not just single BPM

### Beat Tracking
- [x] Beat grid from tempo + best phase alignment (current) — clean up
- [x] Dynamic programming beat tracker (Ellis-style)

### Quality
- [x] Test with real audio samples, not just synthetic clicks
- [x] Test edge cases: very short audio, single onset, drone/noise, polyrhythm
- [x] Benchmark performance (samples/sec throughput)
- [x] Accuracy benchmark: 10 styles × 10 BPMs = 100 cases, 4 methods
  - tempo: 71% exact, 87% octave-tolerant, MAE 19.2 BPM
  - combTempo: 87% exact, 93% octave-tolerant, MAE 8.7 BPM
  - detect: 87% exact, 93% octave-tolerant, MAE 8.7 BPM (now uses combTempo + shared STFT)
  - beatTrack: 72% exact, 88% octave-tolerant
- [x] Real-music sanity test: floatbeat track (sanxion loader, 125 BPM) — detect hits 125.0 exactly
- [x] Octave correction for autocorrelation (prefer half-tempo when fast dominates >2×)
- Known limitations (honest, not masked):
  - Reggae: one-drop pattern confuses autocorrelation at all but 70-90 BPM range
  - Jazz: swing triplets produce ambiguous metrical levels
  - Extreme BPMs (<80, >160): perceptual weighting + octave ambiguity
  - All methods: syncopated music is the frontier of classical signal processing

### Documentation
- [x] README with clear algorithm descriptions, usage examples, references to papers
- [x] JSDoc for every exported function with params, returns, algorithm notes
- [x] Each algorithm section: what it does, when to use, complexity, reference paper
- [x] TypeScript declarations (index.d.ts)

### Package
- [x] Ensure exports map covers all algorithms
- [x] Verify tree-shaking works (sideEffects: false)
- [x] License, keywords, description aligned with audiojs conventions
- [x] GitHub Actions CI workflow (.github/workflows/test.yml)
- [x] GitHub Pages workflow (.github/workflows/pages.yml) — deploys index.html demo
- [x] index.d.ts in files array
