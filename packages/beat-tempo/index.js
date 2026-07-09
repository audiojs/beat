/**
 * Tempo estimation via autocorrelation of onset detection function.
 * Includes perceptual weighting (~120 BPM preference), octave suppression,
 * and octave correction for syncopated music.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.minBpm=60] - Minimum BPM to consider
 * @param {number} [opts.maxBpm=200] - Maximum BPM to consider
 * @param {number} [opts.candidates=1] - Number of tempo candidates to return
 * @returns {{ bpm: number, confidence: number, candidates?: Array }} Tempo result
 * @see Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007)
 * @see Davies & Plumbley, "Context-Dependent Beat Tracking" (TASLP 2007)
 */

import { spectralFlux, ODF } from '@audio/onset'
import { validate } from './validate.js'

export default function tempo(data, opts) {
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
  let minLag = Math.floor(odfRate * 60 / maxBpm)
  let maxLag = Math.ceil(odfRate * 60 / minBpm)
  if (maxLag > nFrames) maxLag = nFrames

  // autocorrelation of ODF — collect all lag scores
  let r0 = 0
  for (let i = 0; i < nFrames; i++) r0 += odf[i] * odf[i]

  // perceptual tempo preference: log-Gaussian centered ~120 BPM (Ellis 2007)
  let prefBpm = 120, prefSigma = 0.8

  let scores = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < nFrames - lag; i++) sum += odf[i] * odf[i + lag]
    let bpm = (odfRate * 60) / lag
    let raw = r0 > 0 ? sum / r0 : 0
    // apply perceptual weighting: log-Gaussian centered at prefBpm
    let logRatio = Math.log2(bpm / prefBpm)
    let weight = Math.exp(-0.5 * (logRatio / prefSigma) ** 2)
    scores.push({ bpm, confidence: raw * weight })
  }

  // normalize to [0, 1] so confidence is comparable across algorithms
  let maxConf = 0
  for (let s of scores) if (s.confidence > maxConf) maxConf = s.confidence
  if (maxConf > 0) for (let s of scores) s.confidence /= maxConf

  // sort by confidence descending
  scores.sort((a, b) => b.confidence - a.confidence)

  // suppress octave duplicates: remove candidates within ±5% of a higher-ranked one
  let filtered = []
  for (let s of scores) {
    let dup = false
    for (let f of filtered) {
      let ratio = s.bpm / f.bpm
      if (ratio > 0.95 && ratio < 1.05) { dup = true; break }
      // also suppress half/double tempo
      if (ratio > 1.95 && ratio < 2.05) { dup = true; break }
      if (ratio > 0.45 && ratio < 0.55) { dup = true; break }
    }
    if (!dup) filtered.push(s)
    if (filtered.length >= topN) break
  }

  if (!filtered.length) return { bpm: 0, confidence: 0 }

  let best = filtered[0]

  // octave correction: if the winning tempo is fast (>130 BPM) and dominates the
  // half-tempo by large margin (>2×), the fast period likely comes from sub-beat
  // events (offbeats, 8th-note hi-hats) rather than the actual beat level.
  // When both levels are similar strength, both metrical levels are genuine.
  // Ref: Davies & Plumbley, "Context-Dependent Beat Tracking" (TASLP 2007)
  if (best.bpm > 130) {
    let halfBpm = best.bpm / 2
    if (halfBpm >= minBpm) {
      let halfLag = Math.round(odfRate * 60 / halfBpm)
      let bestLag = Math.round(odfRate * 60 / best.bpm)
      if (halfLag <= nFrames && bestLag <= nFrames) {
        let halfSum = 0, bestSum = 0
        for (let i = 0; i < nFrames - halfLag; i++) halfSum += odf[i] * odf[i + halfLag]
        for (let i = 0; i < nFrames - bestLag; i++) bestSum += odf[i] * odf[i + bestLag]
        let halfRaw = r0 > 0 ? halfSum / r0 : 0
        let bestRaw = r0 > 0 ? bestSum / r0 : 0
        // if fast tempo dominates by >2× AND half-tempo has meaningful correlation,
        // prefer half-tempo — the dominance suggests sub-beat artifact
        if (halfRaw > 0.02 && bestRaw > halfRaw * 2) {
          let logRatio = Math.log2(halfBpm / prefBpm)
          let weight = Math.exp(-0.5 * (logRatio / prefSigma) ** 2)
          best = { bpm: halfBpm, confidence: maxConf > 0 ? Math.min(1, halfRaw * weight / maxConf) : 0 }
        }
      }
    }
  }

  let result = { bpm: best.bpm, confidence: best.confidence }
  if (topN > 1) result.candidates = filtered
  return result
}
