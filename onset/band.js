/**
 * Multi-band onset detection.
 * Splits spectrum into logarithmic frequency bands, computes spectral flux per band, sums.
 * Better at detecting onsets across different instrument ranges.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.bands=4] - Number of frequency bands (logarithmic spacing)
 * @param {number} [opts.delta=1.4] - Peak-pick threshold multiplier
 * @param {number} [opts.windowSize=8] - Peak-pick local mean window (frames)
 * @returns {Float64Array} Onset times in seconds
 * @see Klapuri, "Sound Onset Detection by Applying Psychoacoustic Knowledge" (ICASSP 1999)
 */

import fft from 'fourier-transform'
import { hann } from 'window-function'
import { peakPick, validate } from '../util.js'

export default function bandOnsets(data, opts) {
  validate(data, opts)
  let fs = opts?.fs || 44100
  let frameSize = opts?.frameSize || 2048
  let hopSize = opts?.hopSize || 512
  let bands = opts?.bands || 4

  let nFrames = Math.floor((data.length - frameSize) / hopSize) + 1
  if (nFrames < 2) return new Float64Array(0)

  let win = new Float64Array(frameSize)
  for (let i = 0; i < frameSize; i++) win[i] = hann(i, frameSize)

  let nBins = frameSize / 2
  // logarithmic band edges (psychoacoustic spacing per Klapuri 1999)
  let bandEdges = [0]
  let maxHz = fs / 2
  let logMin = Math.log(20), logMax = Math.log(maxHz)
  for (let b = 1; b <= bands; b++) {
    let hz = Math.exp(logMin + (logMax - logMin) * b / bands)
    bandEdges.push(Math.min(nBins, Math.max(bandEdges[b - 1] + 1, Math.round(hz / maxHz * nBins))))
  }
  bandEdges[bands] = nBins

  // per-band ODF arrays — separate flux timeseries per band
  let bandOdfs = Array.from({ length: bands }, () => new Float64Array(nFrames))
  let prevMag = null

  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize
    let frame = new Float64Array(frameSize)
    for (let i = 0; i < frameSize; i++) frame[i] = (data[offset + i] || 0) * win[i]
    let mag = new Float64Array(fft(frame))

    if (prevMag) {
      for (let b = 0; b < bands; b++) {
        let lo = bandEdges[b], hi = bandEdges[b + 1], flux = 0
        for (let i = lo; i < hi; i++) {
          let diff = mag[i] - prevMag[i]
          if (diff > 0) flux += diff
        }
        bandOdfs[b][f] = flux
      }
    }
    prevMag = mag
  }

  // peak-pick each band independently, then merge and deduplicate
  let minGap = hopSize / fs
  let all = []
  for (let b = 0; b < bands; b++) {
    let hasEnergy = false
    for (let i = 0; i < nFrames; i++) if (bandOdfs[b][i] > 0) { hasEnergy = true; break }
    if (!hasEnergy) continue
    let ons = peakPick(bandOdfs[b], { hopSize, fs, ...opts })
    for (let t of ons) all.push(t)
  }

  if (!all.length) return new Float64Array(0)

  all.sort((a, b) => a - b)
  let deduped = [all[0]]
  for (let i = 1; i < all.length; i++)
    if (all[i] - deduped[deduped.length - 1] > minGap) deduped.push(all[i])

  return new Float64Array(deduped)
}
