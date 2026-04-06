import fft from 'fourier-transform'
import { hann } from 'window-function'

/**
 * Tempo estimation via autocorrelation of onset detection function.
 *
 * @param {Float32Array} data - mono audio samples
 * @param {{fs?: number, frameSize?: number, hopSize?: number, minBpm?: number, maxBpm?: number}} params
 * @returns {{bpm: number, confidence: number}}
 */
export default function tempo(data, params) {
  let fs = params?.fs || 44100
  let frameSize = params?.frameSize || 2048
  let hopSize = params?.hopSize || 512
  let minBpm = params?.minBpm || 60
  let maxBpm = params?.maxBpm || 200

  let len = data.length
  let nFrames = Math.floor((len - frameSize) / hopSize) + 1
  if (nFrames < 2) return { bpm: 0, confidence: 0 }

  // compute spectral flux ODF
  let frame = new Float64Array(frameSize)
  let win = new Float64Array(frameSize)
  for (let i = 0; i < frameSize; i++) win[i] = hann(i, frameSize)

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

  // autocorrelation of ODF
  let odfRate = fs / hopSize // ODF sample rate
  let minLag = Math.floor(odfRate * 60 / maxBpm)
  let maxLag = Math.ceil(odfRate * 60 / minBpm)
  if (maxLag > nFrames) maxLag = nFrames

  let bestLag = minLag, bestVal = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < nFrames - lag; i++) sum += odf[i] * odf[i + lag]
    if (sum > bestVal) { bestVal = sum; bestLag = lag }
  }

  // normalize confidence
  let r0 = 0
  for (let i = 0; i < nFrames; i++) r0 += odf[i] * odf[i]
  let confidence = r0 > 0 ? bestVal / r0 : 0

  return { bpm: (odfRate * 60) / bestLag, confidence }
}
