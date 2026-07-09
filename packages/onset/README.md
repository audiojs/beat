# @audio/onset

> Onset detection — where notes and hits begin. Onset detection functions (ODFs) plus adaptive peak picking.

Two ODFs and a picker. Compute an ODF over the signal, then peak-pick it into onset times. Classical, deterministic, no model weights.

```js
import { spectralFlux, peakPick } from '@audio/onset'

let { odf, hopSize, fs } = spectralFlux(signal, { fs: 48000 })
let onsets = peakPick(odf, { hopSize, fs })   // Float64Array of onset times (seconds)
```

## `spectralFlux(data, opts?)`

STFT magnitude → sum of positive bin-to-bin differences. Broadband; catches tonal and percussive onsets alike. `opts`: `fs` (44100), `frameSize` (2048, power of 2), `hopSize` (512). Returns `{ odf, nFrames, hopSize, frameSize, fs }`.

## `energyFlux(data, opts?)`

Per-frame RMS energy → positive first differences. Cheaper, favours percussive/energy onsets (Klapuri, ICMC 1999). Same options and return shape as `spectralFlux`.

## `peakPick(odf, opts?)`

Adaptive threshold: a frame is an onset if it exceeds `delta ×` the local-mean ODF and is a local maximum. `opts`: `hopSize`/`fs` (time conversion), `windowSize` (8 frames), `delta` (1.4). Returns onset times in seconds.

## `ODF`

A symbol key for handing a precomputed ODF result to a downstream tempo/beat pass, avoiding a second STFT.

## Notes

FFT via [`fourier-transform`](https://github.com/audiojs/fourier-transform), windows via [`window-function`](https://github.com/audiojs/window-function). Powers [`@audio/beat`](https://github.com/audiojs/beat)'s tempo/tracking. MIT.
