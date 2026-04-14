/**
 * Complex-domain onset detection (phase deviation).
 * Measures divergence between predicted and actual STFT phase.
 * More robust to steady-state signals than spectral flux.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.delta=1.4] - Peak-pick threshold multiplier
 * @param {number} [opts.windowSize=8] - Peak-pick local mean window (frames)
 * @returns {Float64Array} Onset times in seconds
 * @see Bello et al., "A Tutorial on Onset Detection in Music Signals" (TASLP 2005)
 */

import { cfft } from 'fourier-transform'
import { hann } from 'window-function'
import { peakPick } from '../util.js'

export default function phaseOnsets(data, opts) {
  let fs = opts?.fs || 44100
  let frameSize = opts?.frameSize || 2048
  let hopSize = opts?.hopSize || 512

  let nFrames = Math.floor((data.length - frameSize) / hopSize) + 1
  if (nFrames < 3) return new Float64Array(0)

  let win = new Float64Array(frameSize)
  for (let i = 0; i < frameSize; i++) win[i] = hann(i, frameSize)

  let odf = new Float64Array(nFrames)
  let prevPhase = null, prevPrevPhase = null

  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize
    let re = new Float64Array(frameSize)
    let im = new Float64Array(frameSize)
    for (let i = 0; i < frameSize; i++) re[i] = (data[offset + i] || 0) * win[i]
    cfft(re, im)

    let nBins = frameSize / 2
    let phase = new Float64Array(nBins)
    let mag = new Float64Array(nBins)
    for (let i = 0; i < nBins; i++) {
      mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
      phase[i] = Math.atan2(im[i], re[i])
    }

    // phase deviation: |actual - predicted|, predicted = 2*prev - prevPrev
    if (prevPhase && prevPrevPhase) {
      let deviation = 0
      for (let i = 0; i < nBins; i++) {
        let predicted = 2 * prevPhase[i] - prevPrevPhase[i]
        let diff = phase[i] - predicted
        // wrap to [-π, π]
        diff -= Math.round(diff / (2 * Math.PI)) * (2 * Math.PI)
        deviation += Math.abs(diff) * mag[i]
      }
      odf[f] = deviation
    }

    prevPrevPhase = prevPhase
    prevPhase = phase
  }

  // check for silence
  let hasEnergy = false
  for (let i = 0; i < odf.length; i++) { if (odf[i] > 0) { hasEnergy = true; break } }
  if (!hasEnergy) return new Float64Array(0)

  return peakPick(odf, { hopSize, fs, ...opts })
}
