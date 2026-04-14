// Spectral flux onset detection.
// STFT → magnitude → sum positive differences → adaptive threshold peak-pick.
// Ref: Dixon, "Onset Detection Revisited" (DAFx 2006)

import { spectralFlux, peakPick } from './util.js'

export default function onsets(data, opts) {
  let { odf, hopSize, fs } = spectralFlux(data, opts)
  if (!odf.length) return new Float64Array(0)
  return peakPick(odf, { hopSize, fs, ...opts })
}
