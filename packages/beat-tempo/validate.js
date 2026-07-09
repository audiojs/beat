// Input validation at the public API boundary (inlined family convention).

function isPow2(n) { return n > 0 && (n & (n - 1)) === 0 }

/**
 * @param {*} data - Audio samples or null (null is valid when an ODF cache is supplied)
 * @param {Object} [opts]
 */
export function validate(data, opts) {
  if (data != null && !(data instanceof Float32Array) && !(data instanceof Float64Array))
    throw new TypeError('data must be Float32Array or Float64Array')
  if (opts?.fs != null && opts.fs <= 0)
    throw new RangeError('fs must be > 0')
  if (opts?.frameSize != null && !isPow2(opts.frameSize))
    throw new RangeError('frameSize must be a power of 2')
  if (opts?.hopSize != null && opts?.frameSize != null && opts.hopSize >= opts.frameSize)
    throw new RangeError('hopSize must be < frameSize')
  if (opts?.minBpm != null && opts?.maxBpm != null && opts.minBpm >= opts.maxBpm)
    throw new RangeError('minBpm must be < maxBpm')
}
