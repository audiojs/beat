export interface OnsetOpts {
  fs?: number
  frameSize?: number
  hopSize?: number
  delta?: number
  windowSize?: number
}

export interface BandOnsetOpts extends OnsetOpts {
  bands?: number
}

export interface TempoResult {
  bpm: number
  confidence: number
  candidates?: TempoResult[]
}

export interface TempoOpts {
  fs?: number
  frameSize?: number
  hopSize?: number
  minBpm?: number
  maxBpm?: number
  candidates?: number
}

export interface DetectResult {
  bpm: number
  confidence: number
  beats: Float64Array
  onsets: Float64Array
}

export interface BeatTrackResult {
  beats: Float64Array
  bpm: number
  confidence: number
}

export interface BeatTrackOpts extends TempoOpts {
  bpm?: number
  tightness?: number
}

/** Symbol key for passing a pre-computed ODF result to tempo/track functions, avoiding a second STFT pass. */
export declare const ODF: unique symbol

export declare function detect(data: Float32Array | Float64Array, opts?: OnsetOpts & TempoOpts): DetectResult
export declare function onsets(data: Float32Array | Float64Array, opts?: OnsetOpts): Float64Array
export declare function energyOnsets(data: Float32Array | Float64Array, opts?: OnsetOpts): Float64Array
export declare function phaseOnsets(data: Float32Array | Float64Array, opts?: OnsetOpts): Float64Array
export declare function bandOnsets(data: Float32Array | Float64Array, opts?: BandOnsetOpts): Float64Array
export declare function tempo(data: Float32Array | Float64Array | null, opts?: TempoOpts): TempoResult
export declare function combTempo(data: Float32Array | Float64Array | null, opts?: TempoOpts): TempoResult
export declare function beatTrack(data: Float32Array | Float64Array, opts?: BeatTrackOpts): BeatTrackResult
export declare function peakPick(odf: Float64Array, opts?: OnsetOpts): Float64Array

export interface FluxResult {
  odf: Float64Array
  nFrames: number
  hopSize: number
  frameSize: number
  fs: number
}

export declare function spectralFlux(data: Float32Array | Float64Array, opts?: OnsetOpts): FluxResult
export declare function energyFlux(data: Float32Array | Float64Array, opts?: OnsetOpts): FluxResult
