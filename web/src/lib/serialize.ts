/** Serialize values for JSON (BigInt, Date) — matches legacy Express API. */
export function serializeBigInts(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "bigint") return input.toString();
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.map((v) => serializeBigInts(v));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = serializeBigInts(v);
    }
    return out;
  }
  return input;
}
