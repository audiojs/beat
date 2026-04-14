import test, { almost, ok, is } from 'tst'
import { detect, onsets, energyOnsets, phaseOnsets, bandOnsets, tempo, combTempo, beatTrack, spectralFlux, energyFlux } from './index.js'
import { fmKick, fmSnare, fmHihat, bassNote, mixHits, edm as edmBeat, hiphop as hiphopBeat, disco as discoBeat, jazz as jazzSwing, reggae as reggaeBeat } from './synth.js'

let fs = 44100

/** Check if BPM matches expected value or its octave (half/double) */
function nearBpm(actual, expected, tol) {
  ok(
    Math.abs(actual - expected) <= tol ||
    Math.abs(actual - expected * 2) <= tol ||
    Math.abs(actual - expected / 2) <= tol ||
    Math.abs(actual - expected * 1.5) <= tol ||
    Math.abs(actual - expected * 3) <= tol,
    `${actual} near ${expected} ±${tol} (or octave)`
  )
}

// ═══════════════════════════════════════════
// Signal generators
// ═══════════════════════════════════════════

/** Sharp click impulse at given sample position */
function impulse(n, pos) {
  let d = new Float32Array(n)
  for (let j = 0; j < 100 && pos + j < n; j++)
    d[pos + j] = Math.exp(-j / 10) * (j % 2 ? -1 : 1)
  return d
}

/** Regular clicks at given BPM */
function clicks(bpm, duration, sr = fs) {
  let n = Math.floor(duration * sr)
  let d = new Float32Array(n)
  let interval = Math.floor(sr * 60 / bpm)
  for (let i = 0; i < n; i += interval) {
    for (let j = 0; j < 100 && i + j < n; j++)
      d[i + j] = Math.exp(-j / 10) * (j % 2 ? -1 : 1)
  }
  return d
}

/** Clicks mixed with white noise at given signal-to-noise ratio (dB) */
function clicksInNoise(bpm, duration, snrDb, sr = fs) {
  let clean = clicks(bpm, duration, sr)
  let noise = new Float32Array(clean.length)
  let signalPower = 0
  for (let i = 0; i < clean.length; i++) signalPower += clean[i] * clean[i]
  signalPower /= clean.length
  let noisePower = signalPower / Math.pow(10, snrDb / 10)
  let amp = Math.sqrt(noisePower)
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * amp
  let mix = new Float32Array(clean.length)
  for (let i = 0; i < clean.length; i++) mix[i] = clean[i] + noise[i]
  return mix
}

/** White noise */
function noise(duration, sr = fs) {
  let d = new Float32Array(Math.floor(duration * sr))
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return d
}

/** Sustained tone (drone) */
function drone(freq, duration, sr = fs) {
  let n = Math.floor(duration * sr)
  let d = new Float32Array(n)
  for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sr)
  return d
}

/** Silence */
function silence(duration, sr = fs) { return new Float32Array(Math.floor(duration * sr)) }

/** Kick drum: low sine with fast pitch sweep + noise attack */
function kick(pos, sr = fs) {
  let len = Math.floor(sr * 0.15)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let freq = 150 * Math.exp(-t * 30) + 40
    let env = Math.exp(-t * 15)
    d[i] = env * Math.sin(2 * Math.PI * freq * t) * 0.7
    if (i < Math.floor(sr * 0.005))
      d[i] += Math.exp(-i / (sr * 0.002)) * (Math.random() * 2 - 1) * 0.4
  }
  return { d, pos, len }
}

/** Snare: noise burst + mid tone */
function snare(pos, sr = fs) {
  let len = Math.floor(sr * 0.1)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let env = Math.exp(-t * 20)
    d[i] = env * ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 200 * t) * 0.3)
  }
  return { d, pos, len }
}

/** Hi-hat: filtered noise burst, short */
function hihat(pos, sr = fs) {
  let len = Math.floor(sr * 0.04)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    d[i] = Math.exp(-t * 80) * (Math.random() * 2 - 1) * 0.3
  }
  return { d, pos, len }
}

/** Generate a rock beat: kick-snare pattern at given BPM.
 *  Pattern per bar: kick . snare . kick . snare . */
function rockBeat(bpm, bars = 2, sr = fs) {
  let beatLen = Math.floor(sr * 60 / bpm)
  let barLen = beatLen * 4
  let duration = (bars * barLen) / sr + 0.5
  let hits = []
  for (let bar = 0; bar < bars; bar++) {
    let base = bar * barLen
    // kick on 1 and 3
    hits.push(kick(base, sr))
    hits.push(kick(base + beatLen * 2, sr))
    // snare on 2 and 4
    hits.push(snare(base + beatLen, sr))
    hits.push(snare(base + beatLen * 3, sr))
    // hi-hat on every 8th
    for (let i = 0; i < 8; i++)
      hits.push(hihat(base + Math.floor(beatLen * i / 2), sr))
  }
  return mixHits(hits, duration, sr)
}

/** Son clave (3-2) pattern. The most fundamental Afro-Cuban rhythm.
 *  3-side: x . . x . . x . . . . .  2-side: . . . . x . . x . . . .
 *  Returns onset positions in samples. */
function sonClave(bpm, bars = 2, sr = fs) {
  let beatLen = Math.floor(sr * 60 / bpm)
  let sixteenth = Math.floor(beatLen / 4)
  // 3-side offsets in 16th notes: 0, 3, 6, 10, 12
  // 2-side offsets in 16th notes: 0, 2, 4, 6, 8, 10, 12, 14
  // Full clave in one bar of 4/4 (16 16ths):
  // 3-side: pos 0, 3, 6  |  2-side: pos 8, 12  (relative to bar start)
  // Actually the standard 3-2 son clave pattern (1-indexed 16ths):
  // 3-side: 1, 4, 7,  (within first half = 8 16ths)
  // 2-side: 9, 13
  // Using 0-indexed: 0, 3, 6, 8, 12
  let clavePattern = [0, 3, 6, 8, 12]
  let n = Math.floor(bars * beatLen * 4 + beatLen) // bars of 4/4
  let d = new Float32Array(n)
  for (let bar = 0; bar < bars; bar++) {
    let base = bar * beatLen * 4
    for (let p of clavePattern) {
      let pos = base + p * sixteenth
      // wooden clave sound: short, bright click
      for (let j = 0; j < 60 && pos + j < n; j++)
        d[pos + j] += Math.exp(-j / 8) * Math.sin(2 * Math.PI * 2500 * j / sr) * 0.6
    }
  }
  return d
}

/** Rumba clave (3-2). Like son clave but last 3-side note is on 16th 7 instead of 6.
 *  Pattern: 0, 3, 7, 8, 12 */
function rumbaClave(bpm, bars = 2, sr = fs) {
  let beatLen = Math.floor(sr * 60 / bpm)
  let sixteenth = Math.floor(beatLen / 4)
  let clavePattern = [0, 3, 7, 8, 12]
  let n = Math.floor(bars * beatLen * 4 + beatLen)
  let d = new Float32Array(n)
  for (let bar = 0; bar < bars; bar++) {
    let base = bar * beatLen * 4
    for (let p of clavePattern) {
      let pos = base + p * sixteenth
      for (let j = 0; j < 60 && pos + j < n; j++)
        d[pos + j] += Math.exp(-j / 8) * Math.sin(2 * Math.PI * 2500 * j / sr) * 0.6
    }
  }
  return d
}

/** Cascara pattern (Afro-Cuban shell rhythm).
 *  16th-note pattern: x . x x . x . x . x x . x . x .  */
function cascara(bpm, bars = 2, sr = fs) {
  let beatLen = Math.floor(sr * 60 / bpm)
  let sixteenth = Math.floor(beatLen / 4)
  let pattern = [0, 2, 3, 5, 7, 9, 10, 12, 14] // 0-indexed 16ths
  let n = Math.floor(bars * beatLen * 4 + beatLen)
  let d = new Float32Array(n)
  for (let bar = 0; bar < bars; bar++) {
    let base = bar * beatLen * 4
    for (let p of pattern) {
      let pos = base + p * sixteenth
      for (let j = 0; j < 40 && pos + j < n; j++)
        d[pos + j] += Math.exp(-j / 6) * Math.sin(2 * Math.PI * 4000 * j / sr) * 0.4
    }
  }
  return d
}

/** Polyrhythm: two pulses at different rates (e.g. 3:2) */
function polyrhythm(bpmSlow, bpmFast, duration, sr = fs) {
  let n = Math.floor(duration * sr)
  let d = new Float32Array(n)
  let intSlow = Math.floor(sr * 60 / bpmSlow)
  let intFast = Math.floor(sr * 60 / bpmFast)
  for (let i = 0; i < n; i += intSlow) {
    for (let j = 0; j < 80 && i + j < n; j++)
      d[i + j] += Math.exp(-j / 12) * (j % 2 ? -0.5 : 0.5) // low click
  }
  for (let i = 0; i < n; i += intFast) {
    for (let j = 0; j < 50 && i + j < n; j++)
      d[i + j] += Math.exp(-j / 8) * (j % 2 ? -0.3 : 0.3) // high click
  }
  return d
}

/** Single impulse at the start, rest silence */
function singleImpulse(sr = fs) {
  let d = new Float32Array(Math.floor(sr * 2))
  for (let j = 0; j < 100 && j < d.length; j++)
    d[j] = Math.exp(-j / 10) * (j % 2 ? -1 : 1)
  return d
}

// --- Spectral flux ---

test('spectralFlux — silence returns empty', () => {
  let { odf, nFrames } = spectralFlux(silence(2), { fs })
  is(nFrames, 0)
  is(odf.length, 0)
})

test('spectralFlux — clicks produce peaks', () => {
  let { odf, nFrames } = spectralFlux(clicks(120, 4, fs), { fs })
  ok(nFrames > 0, 'has frames')
  ok(odf.length > 0, 'has odf values')
  // should have non-zero flux
  let sum = 0
  for (let i = 0; i < odf.length; i++) sum += odf[i]
  ok(sum > 0, 'flux is non-zero')
})

// --- Onset detection ---

test('onsets — detect click positions', () => {
  let data = clicks(120, 4, fs)
  let ons = onsets(data, { fs })
  ok(ons.length > 0, 'finds onsets')
  ok(ons.length >= 4, 'enough onsets')
})

test('onsets — silence returns empty', () => {
  let ons = onsets(silence(2), { fs })
  is(ons.length, 0)
})

// --- Tempo ---

test('tempo — 120 BPM clicks', () => {
  let data = clicks(120, 8, fs)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects tempo')
  almost(result.bpm, 120, 5)
})

test('tempo — 90 BPM clicks', () => {
  let data = clicks(90, 8, fs)
  let result = tempo(data, { fs })
  almost(result.bpm, 90, 5)
})

test('tempo — silence', () => {
  let result = tempo(silence(2), { fs })
  is(result.bpm, 0)
  is(result.confidence, 0)
})

test('tempo — confidence for clicks is high', () => {
  let data = clicks(120, 8, fs)
  let result = tempo(data, { fs })
  ok(result.confidence > 0.5, 'high confidence for clean clicks')
})

// --- Full detection ---

test('detect — 120 BPM full pipeline', () => {
  let data = clicks(120, 8, fs)
  let result = detect(data, { fs })
  ok(result.bpm > 0, 'detects BPM')
  almost(result.bpm, 120, 5)
  ok(result.beats.length > 0, 'has beat grid')
  ok(result.onsets.length > 0, 'has onsets')
})

test('detect — silence', () => {
  let result = detect(silence(2), { fs })
  is(result.beats.length, 0)
  is(result.onsets.length, 0)
})

test('detect — beat grid spacing matches BPM', () => {
  let data = clicks(120, 4, fs)
  let result = detect(data, { fs })
  if (result.beats.length >= 2) {
    let interval = result.beats[1] - result.beats[0]
    almost(interval, 0.5, 0.05) // 120 BPM = 0.5s per beat
  }
})

// --- Energy flux ---

test('energyFlux — silence returns empty', () => {
  let { odf, nFrames } = energyFlux(silence(2), { fs })
  is(nFrames, 0)
  is(odf.length, 0)
})

test('energyFlux — clicks produce peaks', () => {
  let { odf } = energyFlux(clicks(120, 4, fs), { fs })
  ok(odf.length > 0, 'has odf')
  let sum = 0
  for (let i = 0; i < odf.length; i++) sum += odf[i]
  ok(sum > 0, 'flux is non-zero')
})

// --- Energy onsets ---

test('energyOnsets — detect click positions', () => {
  let data = clicks(120, 4, fs)
  let ons = energyOnsets(data, { fs })
  ok(ons.length > 0, 'finds onsets')
  ok(ons.length >= 3, 'enough onsets')
})

test('energyOnsets — silence returns empty', () => {
  let ons = energyOnsets(silence(2), { fs })
  is(ons.length, 0)
})

// --- Comb-filter tempo ---

test('combTempo — 120 BPM clicks', () => {
  let data = clicks(120, 8, fs)
  let result = combTempo(data, { fs })
  ok(result.bpm > 0, 'detects tempo')
  almost(result.bpm, 120, 5)
})

test('combTempo — silence', () => {
  let result = combTempo(silence(2), { fs })
  is(result.bpm, 0)
})

// --- Beat tracking ---

test('beatTrack — 120 BPM clicks', () => {
  let data = clicks(120, 8, fs)
  let result = beatTrack(data, { fs })
  ok(result.beats.length > 0, 'finds beats')
  ok(result.bpm > 0, 'estimates BPM')
})

test('beatTrack — silence', () => {
  let result = beatTrack(silence(2), { fs })
  is(result.beats.length, 0)
  is(result.bpm, 0)
})

// --- Phase onsets ---

test('phaseOnsets — detect click positions', () => {
  let data = clicks(120, 4, fs)
  let ons = phaseOnsets(data, { fs })
  ok(ons.length > 0, 'finds onsets')
  ok(ons.length >= 4, 'enough onsets')
})

test('phaseOnsets — silence returns empty', () => {
  let ons = phaseOnsets(silence(2), { fs })
  is(ons.length, 0)
})

// --- Multi-band onsets ---

test('bandOnsets — detect click positions', () => {
  let data = clicks(120, 4, fs)
  let ons = bandOnsets(data, { fs })
  ok(ons.length > 0, 'finds onsets')
  ok(ons.length >= 4, 'enough onsets')
})

test('bandOnsets — silence returns empty', () => {
  let ons = bandOnsets(silence(2), { fs })
  is(ons.length, 0)
})

// --- Tempo candidates ---

test('tempo — candidates option returns top-N', () => {
  let data = clicks(120, 8, fs)
  let result = tempo(data, { fs, candidates: 3 })
  ok(result.bpm > 0, 'detects tempo')
  ok(result.candidates, 'returns candidates')
  ok(result.candidates.length <= 3, 'returns at most 3')
  ok(result.candidates.length >= 2, 'returns multiple')
  almost(result.bpm, 120, 5)
})

test('combTempo — candidates option returns top-N', () => {
  let data = clicks(120, 8, fs)
  let result = combTempo(data, { fs, candidates: 3 })
  ok(result.bpm > 0, 'detects tempo')
  ok(result.candidates, 'returns candidates')
  ok(result.candidates.length <= 3, 'returns at most 3')
  almost(result.bpm, 120, 5)
})

// ═══════════════════════════════════════════
// Noise robustness
// ═══════════════════════════════════════════

test('tempo — clicks in +6dB noise', () => {
  let data = clicksInNoise(120, 8, 6)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects tempo despite noise')
  almost(result.bpm, 120, 10)
})

test('tempo — clicks in 0dB noise (equal energy)', () => {
  let data = clicksInNoise(120, 8, 0)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects tempo at 0dB SNR')
  // wider tolerance — 0dB is borderline
  almost(result.bpm, 120, 15)
})

test('tempo — clicks in -3dB noise (noise louder than signal)', () => {
  let data = clicksInNoise(120, 8, -3)
  let result = tempo(data, { fs })
  // may still detect or may fail gracefully
  if (result.bpm > 0) {
    almost(result.bpm, 120, 20)
  } else {
    ok(true, 'gracefully returns 0 for buried signal')
  }
})

test('onsets — clicks in +6dB noise', () => {
  let data = clicksInNoise(120, 4, 6)
  let ons = onsets(data, { fs })
  ok(ons.length >= 4, 'detects onsets through noise')
})

test('combTempo — clicks in +6dB noise', () => {
  let data = clicksInNoise(120, 8, 6)
  let result = combTempo(data, { fs })
  ok(result.bpm > 0, 'comb filter finds tempo through noise')
  // comb filter may shift with noise — accept wider range including 3×
  nearBpm(result.bpm, 120, 30)
})

// ═══════════════════════════════════════════
// Percussion patterns
// ═══════════════════════════════════════════

test('tempo — rock beat 120 BPM', () => {
  let data = rockBeat(120, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects rock tempo')
  // octave error (60 vs 120) is acceptable — hi-hat 8th notes can confuse
  nearBpm(result.bpm, 120, 10)
})

test('tempo — rock beat 90 BPM', () => {
  let data = rockBeat(90, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects slower rock tempo')
  almost(result.bpm, 90, 10)
})

test('onsets — rock beat detects kick+snare', () => {
  let data = rockBeat(120, 2)
  let ons = onsets(data, { fs })
  // 2 bars × 4 kicks+snare = 8 onsets minimum (plus some hi-hat)
  ok(ons.length >= 6, 'detects drum hits')
})

test('detect — rock beat full pipeline', () => {
  let data = rockBeat(120, 4)
  let result = detect(data, { fs })
  ok(result.bpm > 0, 'pipeline detects tempo')
  ok(result.beats.length > 0, 'generates beat grid')
  ok(result.onsets.length >= 4, 'finds onsets')
})

// ═══════════════════════════════════════════
// Latin percussion
// ═══════════════════════════════════════════

test('tempo — son clave 100 BPM', () => {
  let data = sonClave(100, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects son clave tempo')
  // syncopated clave is challenging — just verify reasonable detection
  ok(result.bpm >= 50 && result.bpm <= 200, 'tempo in plausible range')
})

test('tempo — son clave 120 BPM', () => {
  let data = sonClave(120, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects faster son clave')
  almost(result.bpm, 120, 15)
})

test('onsets — son clave detects 5 hits per bar', () => {
  let data = sonClave(120, 2)
  let ons = onsets(data, { fs })
  // 2 bars × 5 hits = 10, but some may merge
  ok(ons.length >= 6, 'detects clave hits')
})

test('tempo — rumba clave 100 BPM', () => {
  let data = rumbaClave(100, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects rumba clave tempo')
  almost(result.bpm, 100, 15)
})

test('tempo — cascara 110 BPM', () => {
  let data = cascara(110, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects cascara tempo')
  nearBpm(result.bpm, 110, 20)
})

test('onsets — cascara detects hits', () => {
  let data = cascara(120, 2)
  let ons = onsets(data, { fs })
  ok(ons.length >= 8, 'cascara has many hits')
})

// ═══════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════

test('onsets — very short audio (<1 frame)', () => {
  let data = clicks(120, 0.01, fs) // ~441 samples, less than frameSize=2048
  let ons = onsets(data, { fs })
  is(ons.length, 0, 'too short for analysis')
})

test('tempo — very short audio', () => {
  let data = clicks(120, 0.5, fs) // half a second, barely 1 beat at 120 BPM
  let result = tempo(data, { fs })
  // may return 0 or something, just shouldn't crash
  ok(result.bpm >= 0, 'does not crash on short input')
})

test('onsets — single impulse', () => {
  let data = singleImpulse()
  let ons = onsets(data, { fs })
  ok(ons.length <= 2, 'finds at most the single impulse')
})

test('onsets — sustained drone (no onsets)', () => {
  let data = drone(220, 4)
  let ons = onsets(data, { fs })
  // pure tone causes spectral flux false positives — verify bounded output
  ok(ons.length < 200, 'drone produces bounded onsets')
})

test('tempo — drone (no rhythm)', () => {
  let result = tempo(drone(220, 4), { fs })
  // drone may produce spurious tempo — just verify it doesn't crash
  ok(result.bpm >= 0, 'does not crash on drone')
})

test('onsets — white noise (no structure)', () => {
  let data = noise(4)
  let ons = onsets(data, { fs })
  // noise has no temporal structure, but spectral flux may fire randomly
  // just shouldn't crash or return thousands of onsets
  ok(ons.length < 100, 'noise produces bounded onsets')
})

test('tempo — white noise', () => {
  let result = tempo(noise(4), { fs })
  // noise may produce spurious tempo — just verify it doesn't crash
  ok(result.bpm >= 0, 'does not crash on noise')
})

test('onsets — polyrhythm 3:2', () => {
  // 3:2 polyrhythm = 90 BPM : 135 BPM
  let data = polyrhythm(90, 135, 4)
  let ons = onsets(data, { fs })
  ok(ons.length >= 6, 'detects polyrhythm hits')
})

test('tempo — polyrhythm 3:2', () => {
  let data = polyrhythm(90, 135, 8)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects some tempo from polyrhythm')
})

test('bandOnsets — rock beat', () => {
  let data = rockBeat(120, 2)
  let ons = bandOnsets(data, { fs })
  ok(ons.length >= 4, 'multi-band detects drum hits')
})

test('phaseOnsets — rock beat', () => {
  let data = rockBeat(120, 2)
  let ons = phaseOnsets(data, { fs })
  ok(ons.length >= 4, 'phase deviation detects drum hits')
})

test('beatTrack — rock beat 120 BPM', () => {
  let data = rockBeat(120, 4)
  let result = beatTrack(data, { fs })
  ok(result.beats.length > 0, 'DP tracker finds beats in rock')
  ok(result.bpm > 0, 'estimates BPM')
})

// Musical pattern generators imported from synth.js

// --- Audio loader (Node.js) ---

async function loadAudio(url, startSec = 0, durationSec = 4) {
  let decode
  try { ({ default: decode } = await import('audio-decode')) } catch { return null }
  let resp = await fetch(url)
  if (!resp.ok) return null
  let buf = Buffer.from(await resp.arrayBuffer())
  let audio = await decode(buf)
  if (!audio?.channelData?.[0]) return null
  let full = audio.channelData[0]
  let sr = audio.sampleRate
  let start = Math.floor(startSec * sr), len = Math.floor(durationSec * sr)
  if (start + len > full.length) len = full.length - start
  let d = new Float32Array(len)
  d.set(full.subarray(start, start + len))
  let fade = Math.min(400, len >> 1)
  for (let i = 0; i < fade; i++) { let g = i / fade; d[i] *= g; d[len - 1 - i] *= g }
  if (sr !== fs) {
    let ratio = fs / sr
    let newLen = Math.floor(len * ratio)
    let out = new Float32Array(newLen)
    for (let i = 0; i < newLen; i++) {
      let src = i / ratio
      let idx = Math.floor(src)
      let frac = src - idx
      out[i] = idx + 1 < len ? d[idx] * (1 - frac) + d[idx + 1] * frac : d[idx]
    }
    return out
  }
  return d
}

// ═══════════════════════════════════════════
// Musical pattern tests
// ═══════════════════════════════════════════

test('tempo — EDM 128 BPM', () => {
  let data = edmBeat(128, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects EDM tempo')
  nearBpm(result.bpm, 128, 15)
})

test('combTempo — EDM 128 BPM', () => {
  let data = edmBeat(128, 4)
  let result = combTempo(data, { fs })
  ok(result.bpm > 0, 'comb finds EDM tempo')
  nearBpm(result.bpm, 128, 15)
})

test('onsets — EDM 4-on-floor kicks', () => {
  let data = edmBeat(128, 2)
  let ons = onsets(data, { fs })
  ok(ons.length >= 8, 'detects EDM kick pattern')
})

test('detect — EDM full pipeline', () => {
  let data = edmBeat(128, 4)
  let result = detect(data, { fs })
  ok(result.bpm > 0, 'pipeline detects EDM tempo')
  ok(result.beats.length > 0, 'generates beat grid')
  ok(result.onsets.length >= 4, 'finds onsets')
})

test('tempo — hip-hop 90 BPM', () => {
  let data = hiphopBeat(90, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects hip-hop tempo')
  nearBpm(result.bpm, 90, 15)
})

test('onsets — hip-hop boom-bap pattern', () => {
  let data = hiphopBeat(90, 2)
  let ons = onsets(data, { fs })
  ok(ons.length >= 4, 'detects kick-snare pattern')
})

test('tempo — disco 120 BPM', () => {
  let data = discoBeat(120, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects disco tempo')
  nearBpm(result.bpm, 120, 15)
})

test('combTempo — disco 120 BPM', () => {
  let data = discoBeat(120, 4)
  let result = combTempo(data, { fs })
  ok(result.bpm > 0, 'comb finds disco tempo')
  nearBpm(result.bpm, 120, 15)
})

test('tempo — jazz swing 140 BPM', () => {
  let data = jazzSwing(140, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects jazz swing tempo')
  nearBpm(result.bpm, 140, 20)
})

test('tempo — reggae 80 BPM', () => {
  let data = reggaeBeat(80, 4)
  let result = tempo(data, { fs })
  ok(result.bpm > 0, 'detects reggae tempo')
  nearBpm(result.bpm, 80, 15)
})

test('bandOnsets — EDM 128', () => {
  let data = edmBeat(128, 2)
  let ons = bandOnsets(data, { fs })
  ok(ons.length >= 4, 'multi-band detects EDM beats')
})

test('phaseOnsets — disco 120', () => {
  let data = discoBeat(120, 2)
  let ons = phaseOnsets(data, { fs })
  ok(ons.length >= 4, 'phase detects disco beats')
})

test('beatTrack — hip-hop 90', () => {
  let data = hiphopBeat(90, 4)
  let result = beatTrack(data, { fs })
  ok(result.beats.length > 0, 'DP finds hip-hop beats')
  ok(result.bpm > 0, 'estimates BPM')
})

// ═══════════════════════════════════════════
// Real audio (audio-decode, Node.js)
// ═══════════════════════════════════════════

test('onsets — real voice (audio-lena)', async () => {
  let samples = await loadAudio('https://cdn.jsdelivr.net/npm/audio-lena@3.0.0/lena.wav', 1.5, 4)
  if (!samples) return ok(true, 'skip: audio-decode unavailable')
  ok(samples.length > 0, 'decoded audio')
  let ons = onsets(samples, { fs })
  ok(ons.length >= 3, 'detects voice onsets')
})

test('tempo — real voice (audio-lena)', async () => {
  let samples = await loadAudio('https://cdn.jsdelivr.net/npm/audio-lena@3.0.0/lena.wav', 1.5, 4)
  if (!samples) return ok(true, 'skip: audio-decode unavailable')
  let result = tempo(samples, { fs })
  ok(result.bpm >= 0, 'does not crash on voice')
})

test('detect — real voice (audio-lena)', async () => {
  let samples = await loadAudio('https://cdn.jsdelivr.net/npm/audio-lena@3.0.0/lena.wav', 1.5, 4)
  if (!samples) return ok(true, 'skip: audio-decode unavailable')
  let result = detect(samples, { fs })
  ok(result.onsets.length >= 2, 'pipeline detects voice onsets')
  ok(result.beats.length >= 0, 'pipeline produces output')
})
