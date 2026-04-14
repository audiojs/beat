## Plan

### Architecture
- [x] Extract shared ODF computation into internal helper, deduplicate onset.js ↔ tempo.js
- [x] Ensure all functions are pure (no shared mutable state), minimal functional style, convention is similar to ~/projects/time-stretch

### Onset Detection
- [x] Spectral flux (current) — clean up, make canonical
- [x] Energy-based onset detection (simple, fast)
- [x] Complex-domain onset detection (phase deviation)
- [x] Multi-band onset detection (bandwise spectral flux)
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
- [ ] Validate BPM accuracy against reference datasets (e.g. ballroom set)

### Documentation
- [x] README with clear algorithm descriptions, usage examples, references to papers
- [ ] JSDoc for every exported function with params, returns, algorithm notes
- [x] Each algorithm section: what it does, when to use, complexity, reference paper

### Package
- [x] Ensure exports map covers all algorithms
- [x] Verify tree-shaking works (sideEffects: false)
- [x] License, keywords, description aligned with audiojs conventions
