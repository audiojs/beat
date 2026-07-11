/** Dynamic programming beat tracker. */
export interface BeatTrackOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** STFT frame size, default 2048 */
  frameSize?: number
  /** STFT hop size, default 512 */
  hopSize?: number
  /** minimum BPM to consider during auto tempo estimation, default 60 */
  minBpm?: number
  /** maximum BPM to consider during auto tempo estimation, default 200 */
  maxBpm?: number
  /** target BPM; auto-estimated via comb-filter tempo when omitted */
  bpm?: number
  /** tempo constraint weight — higher is stricter, default 680 */
  tightness?: number
}

export interface BeatTrackResult {
  /** beat positions, times in seconds */
  beats: Float64Array
  /** tempo used for tracking, beats per minute */
  bpm: number
  /** fraction of onset-detection-function energy that lands on beats, normalized [0, 1] */
  confidence: number
}

/**
 * Estimates tempo (autocorrelation), then finds the globally optimal beat sequence via
 * dynamic programming — maximizing onset strength while penalizing tempo deviation.
 */
export default function beatTrack(data: Float32Array | Float64Array, opts?: BeatTrackOptions): BeatTrackResult
