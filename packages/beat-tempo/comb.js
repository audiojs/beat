/**
 * Tempo estimation via comb-filter resonance.
 * Tests BPM hypotheses by summing ODF energy at pulse-train positions with harmonics.
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

  // perceptual tempo preference: log-Gaussian centered ~120 BPM
  let prefBpm = 120, prefSigma = 1.4

  // test BPM hypotheses in 1-BPM steps using comb filter correlation
  let scores = []
  let maxScore = 0
  for (let bpm = minBpm; bpm <= maxBpm; bpm++) {
    let period = odfRate * 60 / bpm
    let score = 0
    // correlate ODF with pulse train at this BPM + harmonics
    for (let h = 1; h <= 4; h++) {
      let p = period / h
      let halfWidth = Math.max(1, p * 0.15)
      let weight = 1 / h
      for (let i = 0; i < nFrames; i++) {
        let phase = i % p
        if (phase > p / 2) phase = p - phase
        // raised-cosine window around each pulse position
        if (phase < halfWidth) {
          let w = 0.5 * (1 + Math.cos(Math.PI * phase / halfWidth))
          score += odf[i] * weight * w
        }
      }
    }
    // apply perceptual weighting
    let logRatio = Math.log2(bpm / prefBpm)
    score *= Math.exp(-0.5 * (logRatio / prefSigma) ** 2)
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
