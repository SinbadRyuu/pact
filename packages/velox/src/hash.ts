/** JSON with object keys sorted, so equal values always serialise identically. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(`,`)}]`
  if (value && typeof value === `object`) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(`,`)}}`
  }
  return JSON.stringify(value)
}

/** 64-bit FNV-1a of the stable JSON, as 16 hex characters. For cache keys, not for security. */
export function stableHash(value: unknown): string {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (const byte of new TextEncoder().encode(stableStringify(value))) {
    h ^= BigInt(byte)
    h = (h * prime) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, `0`)
}
