// Multi-band onset detection.
// Splits spectrum into frequency bands, computes spectral flux per band, sums.
// Better at detecting onsets across different instrument ranges.
// Ref: Klapuri, "Sound Onset Detection by Applying Psychoacoustic Knowledge" (ICASSP 1999)

import fft from 'fourier-transform'
import { hann } from 'window-function'
import { peakPick } from './util.js'

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
  // define band edges (linear split of frequency range)
  let bandEdges = []
  for (let b = 0; b <= bands; b++) bandEdges.push(Math.floor(nBins * b / bands))

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
