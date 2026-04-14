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
import { peakPick } from '../util.js'

export default function bandOnsets(data, opts) {
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
  // maps linearly in log-frequency so low bands get more resolution
  let bandEdges = [0]
  let minHz = 0, maxHz = fs / 2
  let logMin = Math.log(Math.max(20, minHz)), logMax = Math.log(maxHz)
  for (let b = 1; b <= bands; b++) {
    let hz = Math.exp(logMin + (logMax - logMin) * b / bands)
    bandEdges.push(Math.min(nBins, Math.max(bandEdges[b - 1] + 1, Math.round(hz / maxHz * nBins))))
  }
  bandEdges[bands] = nBins

  let odf = new Float64Array(nFrames)
  let prevMag = null

  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize
    let frame = new Float64Array(frameSize)
    for (let i = 0; i < frameSize; i++) frame[i] = (data[offset + i] || 0) * win[i]
    let mag = new Float64Array(fft(frame))

    if (prevMag) {
      // compute flux per band, sum
      for (let b = 0; b < bands; b++) {
        let lo = bandEdges[b], hi = bandEdges[b + 1]
        let flux = 0
        for (let i = lo; i < hi; i++) {
          let diff = mag[i] - prevMag[i]
          if (diff > 0) flux += diff
        }
        odf[f] += flux
      }
    }
    prevMag = mag
  }

  let hasEnergy = false
  for (let i = 0; i < odf.length; i++) { if (odf[i] > 0) { hasEnergy = true; break } }
  if (!hasEnergy) return new Float64Array(0)

  return peakPick(odf, { hopSize, fs, ...opts })
}
