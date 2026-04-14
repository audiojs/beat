// Shared internal helpers for beat-detection algorithms.

import fft from 'fourier-transform'
import { hann } from 'window-function'

/** Compute spectral flux onset detection function (ODF).
 * STFT → magnitude → sum positive differences.
 * Returns { odf, nFrames, hopSize, frameSize, fs }. */
export function spectralFlux(data, opts) {
  let fs = opts?.fs || 44100
  let frameSize = opts?.frameSize || 2048
  let hopSize = opts?.hopSize || 512

  let nFrames = Math.floor((data.length - frameSize) / hopSize) + 1
  if (nFrames < 2) return { odf: new Float64Array(0), nFrames: 0, hopSize, frameSize, fs }

  let frame = new Float64Array(frameSize)
  let win = new Float64Array(frameSize)
  for (let i = 0; i < frameSize; i++) win[i] = hann(i, frameSize)

  let odf = new Float64Array(nFrames)
  let prevMag = null

  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize
    for (let i = 0; i < frameSize; i++) frame[i] = (data[offset + i] || 0) * win[i]
    let mag = new Float64Array(fft(frame))
    if (prevMag) {
      let flux = 0
      for (let i = 0; i < mag.length; i++) {
        let diff = mag[i] - prevMag[i]
        if (diff > 0) flux += diff
      }
      odf[f] = flux
    }
    prevMag = mag
  }

  // check if ODF is entirely silent
  let hasEnergy = false
  for (let i = 0; i < odf.length; i++) { if (odf[i] > 0) { hasEnergy = true; break } }
  if (!hasEnergy) return { odf: new Float64Array(0), nFrames: 0, hopSize, frameSize, fs }

  return { odf, nFrames, hopSize, frameSize, fs }
}

/** Peak-pick ODF with adaptive threshold (local mean + delta). Returns onset times in seconds. */
export function peakPick(odf, opts) {
  let windowSize = opts?.windowSize || 8
  let delta = opts?.delta || 1.4
  let hopSize = opts?.hopSize || 512
  let fs = opts?.fs || 44100

  let n = odf.length
  let onsets = []

  // also detect frame 0 if it has significant energy (first onset)
  if (n > 1 && odf[0] > 0 && odf[0] >= odf[1]) {
    let start = 0, end = Math.min(n, windowSize + 1), sum = 0
    for (let i = start; i < end; i++) sum += odf[i]
    let mean = sum / (end - start)
    if (odf[0] > mean * delta) onsets.push(0)
  }

  for (let f = 1; f < n - 1; f++) {
    let start = Math.max(0, f - windowSize)
    let end = Math.min(n, f + windowSize + 1)
    let sum = 0
    for (let i = start; i < end; i++) sum += odf[i]
    let mean = sum / (end - start)

    if (odf[f] > mean * delta && odf[f] > odf[f - 1] && odf[f] >= odf[f + 1]) {
      onsets.push(f * hopSize / fs)
    }
  }

  return new Float64Array(onsets)
}

/** Energy-based onset detection function.
 * Computes RMS energy per frame, returns positive first differences.
 * Ref: Klapuri, "Auditory Model Based Beat Tracking" (ICMC 1999) */
export function energyFlux(data, opts) {
  let fs = opts?.fs || 44100
  let frameSize = opts?.frameSize || 2048
  let hopSize = opts?.hopSize || 512

  let nFrames = Math.floor((data.length - frameSize) / hopSize) + 1
  if (nFrames < 2) return { odf: new Float64Array(0), nFrames: 0, hopSize, frameSize, fs }

  // compute per-frame RMS energy
  let energy = new Float64Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize, sum = 0
    for (let i = 0; i < frameSize; i++) {
      let s = data[offset + i] || 0
      sum += s * s
    }
    energy[f] = Math.sqrt(sum / frameSize)
  }

  // first difference (positive only = energy increase)
  let odf = new Float64Array(nFrames)
  let hasEnergy = false

  // detect initial onset: if first frame has significant energy, mark it
  let maxE = 0
  for (let f = 0; f < nFrames; f++) if (energy[f] > maxE) maxE = energy[f]
  if (maxE > 0 && energy[0] > maxE * 0.05) { odf[0] = energy[0]; hasEnergy = true }

  for (let f = 1; f < nFrames; f++) {
    let diff = energy[f] - energy[f - 1]
    if (diff > 0) { odf[f] = diff; hasEnergy = true }
  }
  if (!hasEnergy) return { odf: new Float64Array(0), nFrames: 0, hopSize, frameSize, fs }

  return { odf, nFrames, hopSize, frameSize, fs }
}
