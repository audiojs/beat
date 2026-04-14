// Tempo estimation via autocorrelation of onset detection function.
// Returns top BPM and optional tempo candidates with confidences.
// Ref: Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007)

import { spectralFlux } from './util.js'

export default function tempo(data, opts) {
  let odf, nFrames, hopSize, fs
  if (opts?._odf) {
    ;({ odf, nFrames, hopSize, fs } = opts._odf)
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
  let result = { bpm: best.bpm, confidence: best.confidence }
  if (topN > 1) result.candidates = filtered
  return result
}
