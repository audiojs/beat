/**
 * Musical synthesis generators for beat-detection testing and demo.
 * Pure functions, no dependencies — works in Node.js and browser.
 *
 * @module beat-detection/synth
 */

const PI2 = Math.PI * 2

// ── primitives ────────────────────────────

/** Kick drum: short pitch sweep + thump body. vel 0–1 */
export function fmKick(pos, sr = 44100, vel = 1) {
  let len = Math.floor(sr * 0.18)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let freq = 150 * Math.exp(-t * 40) + 50
    let body = Math.sin(PI2 * freq * t)
    let click = i < Math.floor(sr * 0.004) ? Math.exp(-i / (sr * 0.0008)) * (Math.random() * 2 - 1) * 0.4 : 0
    let env = Math.exp(-t * 12)
    d[i] = (body * 0.7 + click) * env * vel
  }
  return { d, pos, len }
}

/** Snare drum: body tone + noise rattle. vel 0–1 */
export function fmSnare(pos, sr = 44100, vel = 1) {
  let len = Math.floor(sr * 0.12)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let body = Math.sin(PI2 * 185 * t) * Math.exp(-t * 25) * 0.35
    let rattle = (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.45
    let click = Math.sin(PI2 * 400 * t) * Math.exp(-t * 50) * 0.15
    d[i] = (body + rattle + click) * vel
  }
  return { d, pos, len }
}

/** Hi-hat: filtered noise burst with bandpass character. vel 0–1 */
export function fmHihat(pos, open = false, sr = 44100, vel = 1) {
  let len = Math.floor(sr * (open ? 0.12 : 0.03))
  let d = new Float32Array(len)
  let decay = open ? 18 : 120
  for (let i = 0; i < len; i++) {
    let t = i / sr, env = Math.exp(-t * decay) * vel
    // bandpass-ish noise: sum a few tight harmonics for metallic tone
    let tone = Math.sin(PI2 * 6500 * t) * 0.08 + Math.sin(PI2 * 8200 * t) * 0.06
    d[i] = env * ((Math.random() * 2 - 1) * 0.18 + tone)
  }
  return { d, pos, len }
}

/** Bass note: sub-bass with tanh overdrive */
export function bassNote(freq, pos, duration = 0.3, sr = 44100) {
  let len = Math.floor(sr * duration)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let env = Math.min(1, t * 40) * Math.exp(-t / duration)
    d[i] = env * Math.tanh(Math.sin(PI2 * freq * t) * 1.5) * 0.6
  }
  return { d, pos, len }
}

/** Mix multiple drum hits { d, pos, len } into a single buffer */
export function mixHits(hits, duration, sr = 44100) {
  let n = Math.floor(duration * sr)
  let d = new Float32Array(n)
  for (let h of hits)
    for (let i = 0; i < h.len && h.pos + i < n; i++)
      d[h.pos + i] += h.d[i]
  return d
}

// ── style patterns ────────────────────────

/** 4-on-the-floor EDM: kick every beat, hats, sub-bass */
export function edm(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    for (let i = 0; i < 4; i++) hits.push(fmKick(base + i * beat, sr))
    for (let i = 0; i < 8; i++) hits.push(fmHihat(base + Math.floor(beat * i / 2), false, sr))
    for (let i = 0; i < 4; i++) hits.push(fmHihat(base + Math.floor(beat * (i + 0.5)), true, sr))
    hits.push(bassNote(55, base, 0.4, sr))
  }
  return mixHits(hits, dur, sr)
}

/** Boom-bap hip-hop: kick-snare with swing */
export function hiphop(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let swing = Math.floor(beat * 0.33)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    hits.push(fmKick(base, sr))
    if (b % 2 === 0) hits.push(fmKick(base + beat * 2, sr))
    hits.push(fmSnare(base + beat + (b % 2 ? swing : 0), sr))
    hits.push(fmSnare(base + beat * 3 + (b % 2 ? 0 : swing), sr))
    for (let i = 0; i < 8; i++) {
      let off = (i % 2) ? swing : 0
      hits.push(fmHihat(base + Math.floor(beat * i / 2) + off, false, sr))
    }
    hits.push(bassNote(65, base, 0.3, sr))
  }
  return mixHits(hits, dur, sr)
}

/** Disco/funk: syncopated bass + 16th-note hi-hat */
export function disco(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar, s16 = Math.floor(beat / 4)
    hits.push(fmKick(base, sr))
    hits.push(fmKick(base + beat * 2, sr))
    hits.push(fmSnare(base + beat, sr))
    hits.push(fmSnare(base + beat * 3, sr))
    for (let i = 0; i < 16; i++) hits.push(fmHihat(base + Math.floor(beat * i / 4), false, sr))
    hits.push(bassNote(73, base, 0.2, sr))
    hits.push(bassNote(73, base + s16, 0.15, sr))
    hits.push(bassNote(65, base + s16 * 3, 0.15, sr))
    hits.push(bassNote(73, base + beat * 2, 0.2, sr))
  }
  return mixHits(hits, dur, sr)
}

/** Jazz swing: ride cymbal triplets + walking bass */
export function jazz(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let trip = Math.floor(beat / 3)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    for (let p of [0, 3, 5, 6, 8, 11, 13, 14]) {
      let pos = base + p * trip, len = Math.floor(sr * 0.12)
      let d = new Float32Array(len)
      for (let i = 0; i < len; i++) {
        let t = i / sr, env = Math.exp(-t * 20)
        d[i] = env * (Math.sin(PI2 * 5000 * t) * 0.15 + (Math.random() * 2 - 1) * 0.1)
      }
      hits.push({ d, pos, len })
    }
    if (b % 2 === 0) hits.push(fmKick(base, sr))
    if (b % 2 === 1) hits.push(fmSnare(base + trip * 20, sr))
    let f = [98, 110, 117, 131][b % 4]
    for (let i = 0; i < 4; i++) hits.push(bassNote(f + i * 2, base + i * beat, 0.35, sr))
  }
  return mixHits(hits, dur, sr)
}

/** Reggae one-drop: kick on 3, rimshot, offbeat skank */
export function reggae(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    hits.push(fmKick(base + beat * 2, sr))
    let rimLen = Math.floor(sr * 0.05), rimD = new Float32Array(rimLen)
    for (let i = 0; i < rimLen; i++) {
      let t = i / sr
      rimD[i] = Math.exp(-t * 50) * (Math.sin(PI2 * 1800 * t) * 0.5 + (Math.random() * 2 - 1) * 0.3)
    }
    hits.push({ d: rimD, pos: base + beat * 2, len: rimLen })
    for (let i = 0; i < 4; i++) {
      let pos = base + Math.floor(beat * (i + 0.5)), skLen = Math.floor(sr * 0.06)
      let skD = new Float32Array(skLen)
      for (let j = 0; j < skLen; j++) {
        let t = j / sr, env = Math.exp(-t * 40), val = 0
        for (let f of [330, 415, 494, 660]) val += Math.sin(PI2 * f * t)
        skD[j] = env * val * 0.15
      }
      hits.push({ d: skD, pos, len: skLen })
    }
    hits.push(bassNote(82, base, 0.3, sr))
    if (b % 2) hits.push(bassNote(98, base + beat * 2, 0.25, sr))
  }
  return mixHits(hits, dur, sr)
}

// ── humanized helpers ─────────────────────

/** Tiny timing jitter ±maxSamples */
const jit = (pos, range) => pos + Math.floor((Math.random() * 2 - 1) * range)

/** Velocity with slight random variation */
const v = (base, spread = 0.15) => Math.max(0.1, Math.min(1, base + (Math.random() * 2 - 1) * spread))

/** Ride cymbal hit — sustained shimmer */
function rideHit(pos, sr, vel = 1) {
  let len = Math.floor(sr * 0.2)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr, env = Math.exp(-t * 10) * vel
    let tone = Math.sin(PI2 * 5500 * t) * 0.1 + Math.sin(PI2 * 8000 * t) * 0.04
    d[i] = env * ((Math.random() * 2 - 1) * 0.1 + tone)
  }
  return { d, pos, len }
}

/** Tom hit — resonant body with pitch drop */
function tomHit(pos, freq, sr, vel = 1) {
  let len = Math.floor(sr * 0.15)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let f = freq * Math.exp(-t * 6) + freq * 0.6
    let env = Math.exp(-t * 12) * vel
    let click = i < Math.floor(sr * 0.003) ? Math.exp(-i / (sr * 0.001)) * (Math.random() * 2 - 1) * 0.25 * vel : 0
    d[i] = env * Math.sin(PI2 * f * t) * 0.55 + click
  }
  return { d, pos, len }
}

/** Crash cymbal — noise wash with quick attack */
function crashHit(pos, sr, vel = 1) {
  let len = Math.floor(sr * 0.5)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr, env = Math.exp(-t * 4) * vel
    let tone = Math.sin(PI2 * 3200 * t) * 0.06 + Math.sin(PI2 * 4800 * t) * 0.04
    d[i] = env * ((Math.random() * 2 - 1) * 0.14 + tone)
  }
  return { d, pos, len }
}

/** Conga-style drum hit */
function congaHit(pos, freq, sr, vel = 1) {
  let len = Math.floor(sr * 0.12)
  let d = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let t = i / sr
    let f = freq * Math.exp(-t * 15) + freq * 0.7
    let env = Math.exp(-t * 12) * vel
    d[i] = env * (Math.sin(PI2 * f * t) * 0.5 + (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.2)
  }
  return { d, pos, len }
}

// ── humanized patterns ────────────────────

/** Rock beat with ghost snare, velocity variation, 4-bar fills */
export function rock(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let eighth = Math.floor(beat / 2), jRange = Math.floor(sr * 0.005)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    // kick pattern varies per bar
    let kickPattern = b % 4 === 3 ? [0, 2, 2.5, 3] : [0, 2]  // fill on bar 4
    for (let k of kickPattern) hits.push(fmKick(jit(base + Math.floor(k * beat), jRange), sr, v(0.85)))
    // snare on 2 and 4
    hits.push(fmSnare(jit(base + beat, jRange), sr, v(0.9)))
    hits.push(fmSnare(jit(base + beat * 3, jRange), sr, v(0.9)))
    // ghost snare on occasional 'and' of 1
    if (b % 2 === 1) hits.push(fmSnare(jit(base + eighth, jRange), sr, v(0.3, 0.1)))
    // 8th note hats with accent on beat
    for (let i = 0; i < 8; i++) {
      let vel = i % 2 === 0 ? v(0.6, 0.1) : v(0.4, 0.1)
      hits.push(fmHihat(jit(base + Math.floor(eighth * i), jRange), false, sr, vel))
    }
    // crash on bar 1
    if (b === 0) hits.push(crashHit(base, sr, 0.5))
    // fill: toms on last bar
    if (b % 4 === 3) {
      hits.push(tomHit(jit(base + beat * 3 + eighth, jRange), 200, sr, v(0.7)))
      hits.push(tomHit(jit(base + beat * 3 + eighth * 2, jRange), 160, sr, v(0.75)))
      hits.push(tomHit(jit(base + beat * 3 + eighth * 3, jRange), 120, sr, v(0.8)))
    }
  }
  return mixHits(hits, dur, sr)
}

/** Funk: syncopated ghost notes, 16th-note hats, varied kick */
export function funk(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let s16 = Math.floor(beat / 4), jRange = Math.floor(sr * 0.004)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    // syncopated kick: different each bar
    let kicks = b % 2 === 0 ? [0, 2 + 0.5, 3] : [0, 0.75, 2]
    for (let k of kicks) hits.push(fmKick(jit(base + Math.floor(k * beat), jRange), sr, v(0.8)))
    // snare on 2, ghost notes scattered
    hits.push(fmSnare(jit(base + beat, jRange), sr, v(0.85)))
    hits.push(fmSnare(jit(base + beat * 3, jRange), sr, v(0.85)))
    // ghost snares on 'e' of 1 and 'a' of 3
    hits.push(fmSnare(jit(base + s16, jRange), sr, v(0.25, 0.08)))
    hits.push(fmSnare(jit(base + beat * 3 + s16 * 3, jRange), sr, v(0.2, 0.08)))
    if (b % 2) hits.push(fmSnare(jit(base + beat * 2 + s16, jRange), sr, v(0.22, 0.08)))
    // 16th note hats with dynamics
    for (let i = 0; i < 16; i++) {
      let vel = (i % 4 === 0) ? v(0.55) : (i % 2 === 0) ? v(0.4) : v(0.3, 0.08)
      hits.push(fmHihat(jit(base + s16 * i, jRange), false, sr, vel))
    }
    // open hat on 'and' of 4
    if (b % 2 === 1) hits.push(fmHihat(jit(base + beat * 3 + s16 * 2, jRange), true, sr, v(0.45)))
  }
  return mixHits(hits, dur, sr)
}

/** Ballad: slow 6/8 feel, ride, cross-stick, gentle fills */
export function ballad(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let trip = Math.floor(beat / 3), jRange = Math.floor(sr * 0.006)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    // kick on 1, sometimes on 3
    hits.push(fmKick(jit(base, jRange), sr, v(0.75)))
    if (b % 2 === 0) hits.push(fmKick(jit(base + beat * 2, jRange), sr, v(0.65)))
    // cross-stick (rim click) on 2 and 4
    let rimLen = Math.floor(sr * 0.04)
    for (let s of [beat, beat * 3]) {
      let rimD = new Float32Array(rimLen)
      let pos = jit(base + s, jRange)
      for (let i = 0; i < rimLen; i++) {
        let t = i / sr
        rimD[i] = Math.exp(-t * 60) * (Math.sin(PI2 * 1200 * t) * 0.4 + (Math.random() * 2 - 1) * 0.15) * v(0.8)
      }
      hits.push({ d: rimD, pos, len: rimLen })
    }
    // ride pattern in swung 8ths
    for (let i = 0; i < 12; i++) {
      let pos = base + Math.floor(trip * i * 2)
      hits.push(rideHit(jit(pos, jRange), sr, v(i % 3 === 0 ? 0.5 : 0.35, 0.08)))
    }
    // gentle tom fill every 4 bars
    if (b % 4 === 3) {
      for (let i = 0; i < 3; i++)
        hits.push(tomHit(jit(base + beat * 3 + trip * 2 * (i + 1), jRange), 180 - i * 30, sr, v(0.5)))
    }
  }
  return mixHits(hits, dur, sr)
}

/** Breakbeat: chopped funky drummer pattern with congas */
export function breakbeat(bpm, bars = 4, sr = 44100) {
  let beat = Math.floor(sr * 60 / bpm), bar = beat * 4
  let s16 = Math.floor(beat / 4), jRange = Math.floor(sr * 0.006)
  let dur = bars * bar / sr + 0.5, hits = []
  for (let b = 0; b < bars; b++) {
    let base = b * bar
    // asymmetric kick — the breakbeat signature
    let kicks = [
      [0, 2.5, 3],
      [0, 1.75, 2.5, 3.5],
      [0, 2, 3.25],
      [0.5, 2, 3, 3.5],
    ][b % 4]
    for (let k of kicks) hits.push(fmKick(jit(base + Math.floor(k * beat), jRange), sr, v(0.8)))
    // snare pattern — displaced
    let snares = b % 2 === 0 ? [1, 3] : [1, 2.75]
    for (let s of snares) hits.push(fmSnare(jit(base + Math.floor(s * beat), jRange), sr, v(0.85)))
    // ghost snare
    if (b % 4 >= 2) hits.push(fmSnare(jit(base + s16 * 3, jRange), sr, v(0.25, 0.08)))
    // conga pattern
    let congaPattern = [0, 2, 4, 6, 8, 10, 12, 14]
    for (let i = 0; i < congaPattern.length; i++) {
      let freq = i % 4 < 2 ? 300 : 220
      hits.push(congaHit(jit(base + s16 * congaPattern[i], jRange), freq, sr, v(i % 2 === 0 ? 0.4 : 0.25, 0.08)))
    }
    // hats with varying openness
    for (let i = 0; i < 16; i++) {
      let open = (b % 2 === 0 && i === 14) || (b % 2 === 1 && i === 10)
      hits.push(fmHihat(jit(base + s16 * i, jRange), open, sr, v(i % 4 === 0 ? 0.5 : 0.35, 0.08)))
    }
  }
  return mixHits(hits, dur, sr)
}
