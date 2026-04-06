import fft from 'fourier-transform'
import { hann } from 'window-function'

/**
 * Spectral flux onset detection.
 * STFT → magnitude → sum positive differences → peak-pick with adaptive threshold.
 *
 * @param {Float32Array} data - mono audio samples
 * @param {{fs?: number, frameSize?: number, hopSize?: number}} params
 * @returns {Float64Array} onset times in seconds
 */
export default function onsets(data, params) {
  let fs = params?.fs || 44100
  let frameSize = params?.frameSize || 2048
  let hopSize = params?.hopSize || 512

  let len = data.length
  let nFrames = Math.floor((len - frameSize) / hopSize) + 1
  if (nFrames < 2) return new Float64Array(0)

  // windowed frame buffer
  let frame = new Float64Array(frameSize)
  let win = new Float64Array(frameSize)
  for (let i = 0; i < frameSize; i++) win[i] = hann(i, frameSize)

  // compute spectral flux ODF
  let odf = new Float64Array(nFrames)
  let prevMag = null

  for (let f = 0; f < nFrames; f++) {
    let offset = f * hopSize
    for (let i = 0; i < frameSize; i++) frame[i] = (data[offset + i] || 0) * win[i]

    let mag = new Float64Array(fft(frame)) // clone — fft reuses internal buffer
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

  // adaptive threshold peak-picking
  let medianWindow = 8
  let multiplier = 1.5
  let onsetList = []

  for (let f = 1; f < nFrames - 1; f++) {
    // local median
    let start = Math.max(0, f - medianWindow)
    let end = Math.min(nFrames, f + medianWindow + 1)
    let local = Array.from(odf.subarray(start, end)).sort((a, b) => a - b)
    let median = local[local.length >> 1]

    if (odf[f] > median * multiplier && odf[f] > odf[f - 1] && odf[f] >= odf[f + 1]) {
      onsetList.push(f * hopSize / fs)
    }
  }

  return new Float64Array(onsetList)
}
