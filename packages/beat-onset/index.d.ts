/** Spectral flux onset detection. */
export interface OnsetsOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** STFT window size, default 2048 */
  frameSize?: number
  /** hop between frames, default 512 */
  hopSize?: number
  /** adaptive threshold multiplier, default 1.4 */
  delta?: number
  /** peak-pick local mean window, in frames, default 8 */
  windowSize?: number
}

/**
 * STFT → magnitude → sum positive frame-to-frame differences → adaptive threshold peak-pick.
 * Returns onset times in seconds.
 */
export default function onsets(data: Float32Array | Float64Array, opts?: OnsetsOptions): Float64Array
