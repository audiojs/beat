type Buf = Float32Array | Float64Array

export interface OdfOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** FFT frame size, power of 2, default 2048 */
  frameSize?: number
  /** hop between frames, default 512 */
  hopSize?: number
}

export interface OdfResult {
  /** onset detection function values, one per frame */
  odf: Float64Array
  /** number of frames (0 when the signal is too short or silent) */
  nFrames: number
  /** hop size used, samples */
  hopSize: number
  /** frame size used, samples */
  frameSize: number
  /** sample rate used */
  fs: number
}

export interface PeakPickOptions {
  /** hop size, for time conversion, default 512 */
  hopSize?: number
  /** sample rate, for time conversion, default 44100 */
  fs?: number
  /** local mean window size, in frames, default 8 */
  windowSize?: number
  /** threshold multiplier over the local mean, default 1.4 */
  delta?: number
}

/** Spectral flux ODF: STFT → magnitude → sum of positive bin-to-bin differences. Broadband. */
export function spectralFlux(data: Buf, opts?: OdfOptions): OdfResult

/** Energy ODF: per-frame RMS energy → positive first differences. Cheaper, favors percussive onsets. */
export function energyFlux(data: Buf, opts?: OdfOptions): OdfResult

/** Adaptive threshold peak-picker: local mean × delta, local maximum. Returns onset times in seconds. */
export function peakPick(odf: Float64Array, opts?: PeakPickOptions): Float64Array

/** Symbol key for handing a precomputed ODF result to a downstream tempo/beat-track pass, avoiding a second STFT. */
export const ODF: unique symbol
