/**
 * Spectral flux onset detection.
 * STFT → magnitude → sum positive differences → adaptive threshold peak-pick.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - Hop between frames
 * @param {number} [opts.delta=1.4] - Peak-pick threshold multiplier
 * @param {number} [opts.windowSize=8] - Peak-pick local mean window (frames)
 * @returns {Float64Array} Onset times in seconds
 * @see Dixon, "Onset Detection Revisited" (DAFx 2006)
 */

import { spectralFlux, peakPick, validate } from '@audio/beat-core'

export default function onsets(data, opts) {
  validate(data, opts)
  let { odf, hopSize, fs } = spectralFlux(data, opts)
  if (!odf.length) return new Float64Array(0)
  return peakPick(odf, { hopSize, fs, ...opts })
}
