/** Full beat detection pipeline: onset detection → tempo estimation → beat grid. */
export interface DetectOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** STFT frame size, default 2048 */
  frameSize?: number
  /** STFT hop size, default 512 */
  hopSize?: number
  /** onset peak-pick threshold multiplier, default 1.4 */
  delta?: number
  /** minimum BPM to consider, default 60 */
  minBpm?: number
  /** maximum BPM to consider, default 200 */
  maxBpm?: number
}

export interface DetectResult {
  /** estimated tempo, beats per minute */
  bpm: number
  /** tempo confidence, normalized [0, 1] */
  confidence: number
  /** phase-aligned beat grid, times in seconds */
  beats: Float64Array
  /** detected onset times, seconds */
  onsets: Float64Array
}

/**
 * Spectral flux onsets → comb-filter tempo → phase-aligned beat grid.
 * Shares a single STFT pass across onset and tempo stages.
 */
export default function detect(data: Float32Array | Float64Array, opts?: DetectOptions): DetectResult
