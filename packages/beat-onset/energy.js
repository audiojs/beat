/**
 * Energy-based onset detection.
 * Per-frame RMS → positive first differences → adaptive threshold peak-pick.
 * Simpler and faster than spectral flux. Best for percussive / strong transient signals.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - Frame size
 * @param {number} [opts.hopSize=512] - Hop size
 * @param {number} [opts.delta=1.4] - Peak-pick threshold multiplier
 * @param {number} [opts.windowSize=8] - Peak-pick local mean window (frames)
 * @returns {Float64Array} Onset times in seconds
 * @see Klapuri, "Auditory Model Based Beat Tracking" (ICMC 1999)
 */

import { energyFlux, peakPick } from '@audio/onset'
import { validate } from '@audio/beat-core'

export default function energyOnsets(data, opts) {
  validate(data, opts)
  let { odf, hopSize, fs } = energyFlux(data, opts)
  if (!odf.length) return new Float64Array(0)
  return peakPick(odf, { hopSize, fs, ...opts })
}
