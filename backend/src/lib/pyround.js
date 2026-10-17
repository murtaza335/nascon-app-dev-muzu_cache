'use strict';
// Python round(x, ndigits): round-half-even on the EXACT binary value of the double (BR-STAND-02).
// JS toFixed rounds exact ties up (0.0625 → 0.063); Python gives 0.062.
function pyround(x, digits = 3) {
  if (!Number.isFinite(x) || x === 0) return x;
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const bits = buf.getBigUint64(0);
  const neg = (bits >> 63n) === 1n;
  const expBits = Number((bits >> 52n) & 0x7ffn);
  let mant = bits & 0xfffffffffffffn;
  let exp;
  if (expBits === 0) exp = -1074;
  else { mant |= 1n << 52n; exp = expBits - 1075; }
  const scale = 10n ** BigInt(digits);
  let n;
  if (exp >= 0) n = (mant << BigInt(exp)) * scale;
  else {
    const num = mant * scale;
    const den = 1n << BigInt(-exp);
    n = num / den;
    const twice = (num % den) * 2n;
    if (twice > den || (twice === den && (n & 1n) === 1n)) n += 1n;
  }
  const out = Number(n) / Number(scale);
  return neg ? -out : out;
}

module.exports = { pyround };
