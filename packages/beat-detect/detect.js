/**
 * Full beat detection pipeline: onset detection → tempo estimation → beat grid.
 * Detects onsets via spectral flux, estimates tempo via comb-filter resonance,
 * then builds a phase-aligned beat grid. Shares a single STFT pass across both stages.
 * @param {Float32Array|Float64Array} data - Audio samples (mono)
 * @param {Object} [opts]
 * @param {number} [opts.fs=44100] - Sample rate
 * @param {number} [opts.frameSize=2048] - STFT frame size
 * @param {number} [opts.hopSize=512] - STFT hop size
 * @param {number} [opts.delta=1.4] - Onset peak-pick threshold multiplier
 * @param {number} [opts.minBpm=60] - Minimum BPM to consider
 * @param {number} [opts.maxBpm=200] - Maximum BPM to consider
 * @returns {{ bpm: number, confidence: number, beats: Float64Array, onsets: Float64Array }}
 * @see Scheirer, "Tempo and Beat Analysis of Acoustic Musical Signals" (JASA 1998)
 * @see Dixon, "Onset Detection Revisited" (DAFx 2006)
 */

import { spectralFlux, peakPick, ODF } from '@audio/onset'
import { validate } from './validate.js'
import combTempo from '@audio/beat-tempo/comb'

export default function detect(data, opts) {
  validate(data, opts)
  let fs = opts?.fs || 44100
  let sf = spectralFlux(data, opts)
  if (!sf.odf.length) return { bpm: 0, confidence: 0, beats: new Float64Array(0), onsets: new Float64Array(0) }

  let ons = peakPick(sf.odf, { hopSize: sf.hopSize, fs: sf.fs, ...opts })
  let { bpm, confidence } = combTempo(data, { ...opts, [ODF]: sf })

  if (bpm <= 0 || !ons.length) return { bpm, confidence, beats: new Float64Array(0), onsets: ons }

  // build beat grid: the phase that lays the most onset strength on it
  let beatInterval = 60 / bpm
  let duration = data.length / fs
  let bestPhase = gridPhase(sf.odf, sf.hopSize / sf.fs, beatInterval)

  let beats = []
  for (let t = bestPhase; t < duration; t += beatInterval) beats.push(t)

  // if the first beat leaves a gap at t=0, snap one beat back to cover the start
  if (beats.length > 0 && beats[0] > beatInterval * 0.25)
    beats.unshift(Math.max(0, beats[0] - beatInterval))

  return { bpm, confidence, beats: new Float64Array(beats), onsets: ons }
}

/**
 * Phase of a beat grid of period `iv` (s): the one whose points collect the most ODF strength within ±10 %
 * of a period, raised-cosine weighted, tested at every ODF frame of the period. Summed distances to the
 * nearest onset don't prefer a phase when off-beats sound too (8th-note hats): every phase between an
 * on-beat and an off-beat onset scored the same, and a 120 BPM loop's beats fell 100 ms off.
 * @param {Float64Array} odf onset detection function, one value per frame
 * @param {number} dt seconds per ODF frame
 * @param {number} iv beat period (s)
 */
export function gridPhase(odf, dt, iv) {
	let nTest = Math.max(20, Math.ceil(iv / dt)), win = 0.1 * iv, best = 0, bestScore = -Infinity
	for (let p = 0; p < nTest; p++) {
		let phase = p / nTest * iv, score = 0
		for (let i = 0; i < odf.length; i++) {
			let d = ((i * dt - phase) % iv + iv) % iv
			if (d > iv / 2) d = iv - d
			if (d < win) score += odf[i] * (0.5 + 0.5 * Math.cos(Math.PI * d / win))
		}
		if (score > bestScore) { bestScore = score; best = phase }
	}
	return best
}
