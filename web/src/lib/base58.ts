/** Minimal base58 (Bitcoin alphabet) for Solana-style keys in API JSON. */
const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const encoded: number[] = [];
  const input = new Uint8Array(bytes);
  let startAt = zeros;
  while (startAt < input.length) {
    let carry = 0;
    for (let i = startAt; i < input.length; i++) {
      const val = (input[i]! & 0xff) + carry * 256;
      input[i] = (val / 58) | 0;
      carry = val % 58;
    }
    encoded.push(carry);
    while (startAt < input.length && input[startAt] === 0) startAt++;
  }
  let result = "";
  for (let i = 0; i < zeros; i++) result += "1";
  for (let i = encoded.length - 1; i >= 0; i--) {
    result += BASE58[encoded[i]!]!;
  }
  return result;
}
