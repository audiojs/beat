// Energy-based onset detection.
// Per-frame RMS → positive first differences → adaptive threshold peak-pick.
// Simpler and faster than spectral flux. Best for percussive / strong transient signals.
// Ref: Klapuri, "Auditory Model Based Beat Tracking" (ICMC 1999)

import { energyFlux, peakPick } from './util.js'

export default function energyOnsets(data, opts) {
  let { odf, hopSize, fs } = energyFlux(data, opts)
  if (!odf.length) return new Float64Array(0)
  return peakPick(odf, { hopSize, fs, ...opts })
}
