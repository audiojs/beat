// @audio/beat — beat detection umbrella re-exporting every @audio/beat-* atom.
// For smaller bundles, depend directly on the individual atom.

export { default as detect } from '@audio/beat-detect'
export { default as onsets } from '@audio/beat-onset'
export { default as energyOnsets } from '@audio/beat-onset/energy'
export { default as phaseOnsets } from '@audio/beat-onset/phase'
export { default as bandOnsets } from '@audio/beat-onset/band'
export { default as tempo } from '@audio/beat-tempo'
export { default as combTempo } from '@audio/beat-tempo/comb'
export { default as beatTrack } from '@audio/beat-track'
export { spectralFlux, energyFlux, peakPick, ODF } from '@audio/beat-core'
