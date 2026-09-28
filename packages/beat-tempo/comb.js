/**
 * Tempo estimation via comb-filter resonance.
 * Tests BPM hypotheses with a comb over the ODF's autocorrelation: the beat period and its
 * multiples (Davies & Plumbley 2007), whatever the beats' phase.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.minBpm=60] - Minimum BPM to consider
 * @param {number} [opts.maxBpm=200] - Maximum BPM to consider
 * @param {number} [opts.candidates=1] - Number of tempo candidates to return
 * @returns {{ bpm: number, confidence: number, candidates?: Array }} Tempo result
 * @see Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals" (JASA 1998)
 */

import { spectralFlux, ODF } from '@audio/onset'
import { validate } from './validate.js'

export default function combTempo(data, opts) {
  validate(data, opts)
  let odf, nFrames, hopSize, fs
  if (opts?.[ODF]) {
    ;({ odf, nFrames, hopSize, fs } = opts[ODF])
  } else {
    ;({ odf, nFrames, hopSize, fs } = spectralFlux(data, opts))
  }
  if (nFrames < 2) return { bpm: 0, confidence: 0 }

  let minBpm = opts?.minBpm || 60
  let maxBpm = opts?.maxBpm || 200
  let topN = opts?.candidates || 1
  let odfRate = fs / hopSize

  // perceptual tempo preference: Davies & Plumbley's Rayleigh weighting of the beat period, peaking at
  // 0.5 s (120 BPM); it goes with their comb, which otherwise favours the slower metrical level
  let beta = 0.5 * odfRate

  // Autocorrelation of the ODF (mean removed, unbiased), over the lags the comb reads. A pulse train laid
  // on the ODF from frame 0 scored a tempo by where the file's first beat happened to fall: loops at 85,
  // 100, 140 and 160 BPM read 149, 133, 93 and 140. The autocorrelation doesn't depend on the phase.
  let mean = 0
  for (let i = 0; i < nFrames; i++) mean += odf[i]
  mean /= nFrames
  let x = new Float64Array(nFrames)
  for (let i = 0; i < nFrames; i++) x[i] = odf[i] - mean
  let maxLag = Math.min(nFrames - 1, Math.ceil(4 * odfRate * 60 / minBpm) + 4)
  let acf = new Float64Array(maxLag + 2)
  for (let k = 0; k <= maxLag; k++) {
    let s = 0
    for (let i = 0; i + k < nFrames; i++) s += x[i] * x[i + k]
    acf[k] = s / (nFrames - k)
  }
  let at = t => { let k = Math.floor(t), f = t - k; return k + 1 > maxLag ? 0 : acf[k] * (1 - f) + acf[k + 1] * f }

  // test BPM hypotheses in 1-BPM steps: the comb sums the autocorrelation at the beat period and its
  // multiples, each widened by its own tolerance (Davies & Plumbley, "Context-Dependent Beat Tracking of
  // Musical Audio", TASLP 2007, eq. 5)
  let scores = []
  let maxScore = 0
  for (let bpm = minBpm; bpm <= maxBpm; bpm++) {
    let period = odfRate * 60 / bpm
    let score = 0
    for (let a = 1; a <= 4; a++)
      for (let b = 1 - a; b <= a - 1; b++) score += at(a * period + b) / (2 * a - 1)
    score = Math.max(0, score) * period / beta * Math.exp(-0.5 * ((period / beta) ** 2 - 1))
    scores.push({ bpm, confidence: score })
    if (score > maxScore) maxScore = score
  }

  // normalize confidences to [0, 1]
  if (maxScore > 0) {
    for (let s of scores) s.confidence /= maxScore
  }

  // sort by confidence descending
  scores.sort((a, b) => b.confidence - a.confidence)

  // suppress octave duplicates (including half/double tempo)
  let filtered = []
  for (let s of scores) {
    let dup = false
    for (let f of filtered) {
      let ratio = s.bpm / f.bpm
      if (ratio > 0.95 && ratio < 1.05) { dup = true; break }
      if (ratio > 1.95 && ratio < 2.05) { dup = true; break }
      if (ratio > 0.45 && ratio < 0.55) { dup = true; break }
    }
    if (!dup) filtered.push(s)
    if (filtered.length >= topN) break
  }

  if (!filtered.length) return { bpm: 0, confidence: 0 }

  let best = filtered[0]
  let result = { bpm: best.bpm, confidence: best.confidence }
  if (topN > 1) result.candidates = filtered
  return result
}
