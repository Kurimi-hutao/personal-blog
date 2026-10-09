// Match Tencent COSCLI's hash/crc64.MakeTable(crc64.ECMA), not the
// unreflected CRC-64/ECMA-182 variant. COS returns an unsigned decimal string.
// Official implementation: https://github.com/tencentyun/coscli/blob/master/util/hash.go
const polynomial = 0xc96c5795d7870f42n;
const lowTable = new Uint32Array(256);
const highTable = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = BigInt(index);
  for (let bit = 0; bit < 8; bit++) {
    value = (value >> 1n) ^ (value & 1n ? polynomial : 0n);
  }
  lowTable[index] = Number(value & 0xffffffffn);
  highTable[index] = Number(value >> 32n);
}

export function crc64Cos(bytes) {
  let low = 0xffffffff;
  let high = 0xffffffff;
  for (const byte of bytes) {
    const index = (low ^ byte) & 0xff;
    low = ((low >>> 8) | (high << 24)) ^ lowTable[index];
    high = (high >>> 8) ^ highTable[index];
  }
  return ((BigInt((high ^ 0xffffffff) >>> 0) << 32n)
    | BigInt((low ^ 0xffffffff) >>> 0)).toString(10);
}
