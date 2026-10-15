/**
 * Collision-safe record ID generator.
 *
 * SECURITY/BUG FIX (audit item "ID Collision Bug"): IDs used to be produced as
 * `prefix-${Date.now().toString().slice(-4)}` — only the last 4 digits of the
 * epoch millisecond. Two records created within the same second (or by two
 * concurrent tabs/users) collided with probability ~1/2 every second and were
 * guaranteed to wrap every ~100 seconds, silently overwriting each other in
 * `findIndex(p => p.id === ...)` lookups.
 *
 * The new format keeps the human-readable prefix + timestamp (useful for
 * sorting/debugging) and appends 6 random base36 chars (~2.1 billion combos),
 * so collisions are practically impossible even under concurrent creation.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(length = 6): string {
  let out = '';
  // Prefer the WebCrypto CSPRNG when available (browser + Node >= 19 global).
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    g.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  } else {
    for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** e.g. uniqueId('cust') -> "cust-1mzx8k2f-a9k2d1" */
export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomSuffix(6)}`;
}

/** Human-readable transaction/reference numbers, still collision-safe. */
export function uniqueRefNo(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomSuffix(4).toUpperCase()}`;
}
