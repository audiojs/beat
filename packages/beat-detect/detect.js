/**
 * Full beat detection pipeline: onset detection → tempo estimation → beat grid.
 * Detects onsets via spectral flux, estimates tempo via comb-filter resonance,
 * then builds a phase-aligned beat grid. Shares a single STFT pass across both stages.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.delta=1.4] - Onset peak-pick threshold multiplier
 * @param {number} [opts.minBpm=60] - Minimum BPM to consider
 * @param {number} [opts.maxBpm=200] - Maximum BPM to consider
 * @returns {{ bpm: number, confidence: number, beats: Float64Array, onsets: Float64Array }}
 * @see Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals" (JASA 1998)
 * @see Dixon, "Onset Detection Revisited" (DAFx 2006)
 */

import { spectralFlux, peakPick, ODF } from '@audio/onset'
import { validate } from './validate.js'
import combTempo from '@audio/beat-tempo/comb'

export default function detect(data, opts) {
  validate(data, opts)
  let fs = opts?.fs || 44100
  let sf = spectralFlux(data, opts)
  if (!sf.odf.length) return { bpm: 0, confidence: 0, beats: new Float64Array(0), onsets: new Float64Array(0) }

  let ons = peakPick(sf.odf, { hopSize: sf.hopSize, fs: sf.fs, ...opts })
  let { bpm, confidence } = combTempo(data, { ...opts, [ODF]: sf })

  if (bpm <= 0 || !ons.length) return { bpm, confidence, beats: new Float64Array(0), onsets: ons }

  // build beat grid: find best phase by alignment with detected onsets
  let beatInterval = 60 / bpm
  let duration = data.length / fs

  let bestPhase = 0, bestScore = -Infinity
  let nTest = Math.min(20, Math.ceil(beatInterval * fs / sf.hopSize))
  for (let p = 0; p < nTest; p++) {
    let phase = (p / nTest) * beatInterval
    let score = 0
    for (let o of ons) {
      let dist = ((o - phase) % beatInterval + beatInterval) % beatInterval
      if (dist > beatInterval / 2) dist = beatInterval - dist
      score -= dist
    }
    if (score > bestScore) { bestScore = score; bestPhase = phase }
  }

  let beats = []
  for (let t = bestPhase; t < duration; t += beatInterval) beats.push(t)

  // if the first beat leaves a gap at t=0, snap one beat back to cover the start
  if (beats.length > 0 && beats[0] > beatInterval * 0.25)
    beats.unshift(Math.max(0, beats[0] - beatInterval))

  return { bpm, confidence, beats: new Float64Array(beats), onsets: ons }
}
