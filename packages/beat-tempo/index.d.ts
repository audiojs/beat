/** Tempo estimation via autocorrelation of the onset detection function. */
export interface TempoOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** STFT frame size, default 2048 */
  frameSize?: number
  /** STFT hop size, default 512 */
  hopSize?: number
  /** minimum BPM to consider, default 60 */
  minBpm?: number
  /** maximum BPM to consider, default 200 */
  maxBpm?: number
  /** number of ranked tempo candidates to return, default 1 */
  candidates?: number
}

export interface TempoCandidate {
  /** candidate tempo, beats per minute */
  bpm: number
  /** candidate confidence, normalized [0, 1] */
  confidence: number
}

export interface TempoResult {
  /** estimated tempo, beats per minute (0 if undetermined) */
  bpm: number
  /** tempo confidence, normalized [0, 1] */
  confidence: number
  /** ranked alternatives, only present when `opts.candidates > 1` */
  candidates?: TempoCandidate[]
}

/**
 * Autocorrelation of the spectral-flux ODF, with perceptual (~120 BPM) weighting,
 * octave-duplicate suppression, and octave correction for syncopated material.
 */
export default function tempo(data: Float32Array | Float64Array, opts?: TempoOptions): TempoResult
