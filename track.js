// Dynamic programming beat tracker.
// Builds optimal beat sequence by scoring onset strength + tempo consistency.
// Ref: Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007)

import { spectralFlux } from './util.js'
import tempo from './tempo.js'

export default function beatTrack(data, opts) {
  let fs = opts?.fs || 44100
  let { odf, nFrames, hopSize } = spectralFlux(data, opts)
  if (nFrames < 2) return { beats: new Float64Array(0), bpm: 0, confidence: 0 }

  let minBpm = opts?.minBpm || 60
  let maxBpm = opts?.maxBpm || 200
  let odfRate = fs / hopSize

  // tempo penalty: negative log-Gaussian around target tempo
  // auto-estimate if not provided, reuse ODF to avoid recomputing STFT
  let targetBpm = opts?.bpm || tempo(data, { ...opts, _odf: { odf, nFrames, hopSize, fs } }).bpm || 120
  let targetPeriod = odfRate * 60 / targetBpm
  let sigma = targetPeriod * 0.2

  // DP: score[i] = best cumulative score ending at frame i
  let score = new Float64Array(nFrames)
  let prev = new Int32Array(nFrames).fill(-1)

  // initialize: first onset frame can start a beat
  for (let i = 0; i < nFrames; i++) score[i] = odf[i]

  for (let i = 1; i < nFrames; i++) {
    let minGap = Math.floor(odfRate * 60 / maxBpm)
    let maxGap = Math.ceil(odfRate * 60 / minBpm)
    let lo = Math.max(0, i - maxGap)
    let hi = Math.max(0, i - minGap)

    for (let j = lo; j < hi; j++) {
      let gap = i - j
      // tempo deviation penalty
      let penalty = 0.5 * ((gap - targetPeriod) / sigma) ** 2
      let s = score[j] + odf[i] - penalty
      if (s > score[i]) {
        score[i] = s
        prev[i] = j
      }
    }
  }

  // backtrack from best final score
  let bestEnd = 0
  for (let i = 1; i < nFrames; i++) {
    if (score[i] > score[bestEnd]) bestEnd = i
  }

  let frames = []
  let cur = bestEnd
  while (cur >= 0) {
    frames.push(cur)
    cur = prev[cur]
  }
  frames.reverse()

  let beats = new Float64Array(frames.map(f => f * hopSize / fs))

  // estimate BPM from median interval
  let bpm = 0, confidence = 0
  if (beats.length >= 2) {
    let intervals = []
    for (let i = 1; i < beats.length; i++) intervals.push(beats[i] - beats[i - 1])
    intervals.sort((a, b) => a - b)
    let median = intervals[intervals.length >> 1]
    bpm = 60 / median
    // confidence: ratio of on-beat ODF energy to total
    let beatSet = new Set(frames)
    let onBeat = 0, total = 0
    for (let i = 0; i < nFrames; i++) {
      total += odf[i]
      if (beatSet.has(i)) onBeat += odf[i]
    }
    confidence = total > 0 ? onBeat / total : 0
  }

  return { beats, bpm, confidence }
}
