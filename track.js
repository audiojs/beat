/**
 * Dynamic programming beat tracker.
 * Builds optimal beat sequence by scoring onset strength + tempo consistency.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.minBpm=60] - Minimum BPM to consider
 * @param {number} [opts.maxBpm=200] - Maximum BPM to consider
 * @param {number} [opts.bpm] - Target BPM (auto-estimated if omitted)
 * @param {number} [opts.tightness=680] - Tempo constraint weight
 * @returns {{ beats: Float64Array, bpm: number, confidence: number }}
 * @see Ellis, "Beat Tracking by Dynamic Programming" (JNMR 2007)
 */

import { spectralFlux, ODF, validate } from './util.js'
import combTempo from './tempo/comb.js'

export default function beatTrack(data, opts) {
  validate(data, opts)
  let fs = opts?.fs || 44100
  let sf = spectralFlux(data, opts)
  let { odf, nFrames, hopSize } = sf
  if (nFrames < 2) return { beats: new Float64Array(0), bpm: 0, confidence: 0 }

  let odfRate = fs / hopSize

  // reuse STFT via ODF cache — same trick detect() uses
  let targetBpm = opts?.bpm || combTempo(data, { ...opts, [ODF]: sf }).bpm || 120
  let targetPeriod = odfRate * 60 / targetBpm

  // normalize ODF: zero-mean, unit-std — makes Ellis's tightness weight meaningful
  let mean = 0
  for (let i = 0; i < nFrames; i++) mean += odf[i]
  mean /= nFrames
  let variance = 0
  for (let i = 0; i < nFrames; i++) { let d = odf[i] - mean; variance += d * d }
  let std = Math.sqrt(variance / nFrames) || 1
  let odfN = new Float64Array(nFrames)
  for (let i = 0; i < nFrames; i++) odfN[i] = (odf[i] - mean) / std

  // DP forward: C[i] = max over valid j of ( C[j] + odfN[i] - α·log(gap/p)² )
  // log-ratio penalty gives octave symmetry — gap=2p and gap=p/2 cost the same,
  // and the penalty is sharp enough to pin DP to the target period.
  let alpha = opts?.tightness ?? 680
  let score = new Float64Array(nFrames)
  let prev = new Int32Array(nFrames).fill(-1)
  for (let i = 0; i < nFrames; i++) score[i] = odfN[i]

  let minGap = Math.max(1, Math.floor(targetPeriod * 0.5))
  let maxGap = Math.ceil(targetPeriod * 2)

  for (let i = 1; i < nFrames; i++) {
    let lo = Math.max(0, i - maxGap)
    let hi = Math.max(0, i - minGap)
    for (let j = lo; j < hi; j++) {
      let logR = Math.log((i - j) / targetPeriod)
      let s = score[j] + odfN[i] - alpha * logR * logR
      if (s > score[i]) {
        score[i] = s
        prev[i] = j
      }
    }
  }

  // backtrack from best score in the last targetPeriod frames (ensures we
  // reach the end of the signal rather than stopping at a mid-sequence peak)
  let endLo = Math.max(0, nFrames - Math.floor(targetPeriod))
  let bestEnd = endLo
  for (let i = endLo + 1; i < nFrames; i++) {
    if (score[i] > score[bestEnd]) bestEnd = i
  }

  let frames = []
  for (let cur = bestEnd; cur >= 0; cur = prev[cur]) frames.push(cur)
  frames.reverse()

  let beatIntervalSec = targetPeriod * hopSize / fs
  let beatTimes = frames.map(f => f * hopSize / fs)

  // extrapolate backward: DP anchors where onset strength is highest, not at t=0.
  // walk back by beatIntervalSec, snapping beats within half a period of t=0 to t=0.
  if (beatTimes.length > 0 && beatTimes[0] > beatIntervalSec * 0.25) {
    let extra = []
    for (let t = beatTimes[0] - beatIntervalSec; t > -beatIntervalSec * 0.5; t -= beatIntervalSec)
      extra.unshift(Math.max(0, t))
    beatTimes = [...extra, ...beatTimes]
  }

  let beats = new Float64Array(beatTimes)

  let confidence = 0
  if (beats.length >= 2) {
    let beatSet = new Set(frames)
    let onBeat = 0, total = 0
    for (let i = 0; i < nFrames; i++) {
      total += odf[i]
      if (beatSet.has(i)) onBeat += odf[i]
    }
    confidence = total > 0 ? onBeat / total : 0
  }

  return { beats, bpm: targetBpm, confidence }
}
