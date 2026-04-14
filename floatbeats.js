// Real-music test tracks in Dollchan floatbeat format.
// A floatbeat is a single JavaScript expression that maps an integer sample
// index `t` to a float in [-1, 1] (or a stereo [L, R] pair). Math globals are
// in scope via `with (Math)`. See https://dollchan.net/bytebeat/
//
// Each track declares its BPM in the formula — so the expected tempo is a
// ground-truth fact, not a guess. Used by test.js and the browser demo as
// deterministic real-music fixtures (no audio files, no downloads).

/**
 * Render a floatbeat expression to a Float32Array at the given sample rate.
 * Stereo pairs are collapsed to mono by averaging.
 * @param {string} code - Floatbeat expression (comma-sequenced JS)
 * @param {number} sr - Sample rate (Hz)
 * @param {number} duration - Duration in seconds
 * @returns {Float32Array} Rendered mono samples in [-1, 1]
 */
export function renderFloatbeat(code, sr, duration) {
  let n = Math.floor(sr * duration)
  let out = new Float32Array(n)
  let fn = new Function('t', 'Math', `with (Math) { return (${code}); }`)
  for (let t = 0; t < n; t++) {
    let v
    try { v = fn(t, Math) } catch { v = 0 }
    if (Array.isArray(v)) v = (v[0] + v[1]) * 0.5
    if (!Number.isFinite(v)) v = 0
    out[t] = v < -1 ? -1 : v > 1 ? 1 : v
  }
  return out
}

/** Floatbeat by RealZynx92 — "sanxion loader music", 125 BPM in the formula. */
export const sanxion = {
  name: 'Sanxion Loader',
  author: 'RealZynx92',
  bpm: 125,
  sampleRate: 48000,
  code: `BPM = 125,
A = 440,
T = t/93.75*BPM/60,
k = max(-.1,min(.1,asin(sin(2**(-T/8%16+5)))*9))*3*(73>>(T>>7&7)&1),
h = random()/max(1,T%128/9)/3,
s = sin((t>>(T%128>30?3:4))**7)/max(2,T%128/9)*((T>>7)%8==4),
b = t/1500*440*(2**(1/12))**(T>8192?[-2,-4,3,-2][T>>11&3]:-2)*((37394>>(T>>7&15)&1)+1)%256/350*(1-T%128/200)-.5,
m = ((t/375*A*(2**(1/12))**[10,10,5,,8,,3,5,,1,,-4,-2,,8,10,1,1,3,,0,,3,8,13,13,12,,8,,3,3,1,1,3,,13,,8,13,15,13,3,,1,,-4,,-2][T>>7&63])*ceil(4/max(1,(T%128)/20))%256>70?1:0)/3,
(k+h+s+b+(T>8192?m:0))/1.5`,
}

/** Floatbeat by BaenHoHoHo — Jeroen Tel's "Stranglehold" (C64), 130 BPM. */
export const stranglehold = {
  name: 'Stranglehold',
  author: 'Jeroen Tel / BaenHoHoHo',
  bpm: 130,
  sampleRate: 48000,
  code: `t/=48e3,bpm=130,T=t*bpm/60,k=45E3*t,sp=x=>x%4,ps=x=>k*2**(x/12),wv=x=>sin(PI*x/64)*12**sin(T/8%1)/2,wv(ps(-'0345'[_=T/8&3]))*(dc=x=>.23**sp(T/2+x),dc(0))/6.25+wv(ps('2000'[_]))*dc(3.75)/6+wv(ps('3222'[_]))*dc(7.5)/5.75+wv(ps('7657'[_]))*dc(11.25)/5.5+wv(ps([10,9,8,12][_]))*dc(11)/5.25+wv(ps([14,12,12,14][_]))*dc(14.75)/5+wv(ps([15,14,14,17][_]))*dc(18.5)/4.75+wv(ps([19,18,17,19][_]))*dc(26.25)/4.5`,
}
