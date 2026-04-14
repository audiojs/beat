// Full beat detection pipeline: onset detection → tempo estimation → beat grid.
// Ref: Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007)

import onsetsFn from './onset.js'
import tempoFn from './tempo.js'

export default function detect(data, opts) {
  let fs = opts?.fs || 44100
  let ons = onsetsFn(data, opts)
  let { bpm, confidence } = tempoFn(data, opts)

  if (bpm <= 0 || !ons.length) return { bpm, confidence, beats: new Float64Array(0), onsets: ons }

  // build beat grid: find best phase by alignment with detected onsets
  let beatInterval = 60 / bpm
  let duration = data.length / fs

  let bestPhase = 0, bestScore = -Infinity
  let nTest = Math.min(20, Math.ceil(beatInterval * fs / 512))
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

  return { bpm, confidence, beats: new Float64Array(beats), onsets: ons }
}
