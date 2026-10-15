/**
 * Client-side password utilities (Web Crypto / SubtleCrypto).
 *
 * SECURITY FIX (audit #21): password hashing happens ONLY on the server.
 * The former `hashPasswordForClient()` helper produced a FAKE `scrypt:`
 * labeled PBKDF2 digest — the server classifies such values as legacy
 * unusable shapes and refuses them, so keeping this API exported was a
 * footgun (re-use + team confusion). It has been removed. Clients send the
 * plaintext password over HTTPS only, directly to the login/change-password
 * endpoints; the server performs the real scrypt hashing.
 */

/** Generate a random operator-suggested default password (always >=12 chars, mixed-case + digits). */
export function generateRandomPassword(prefix = 'Azma'): string {
  // Ensure >=12 characters with guaranteed mixed-case letters and digits.
  const lowerChars = 'abcdefghjkmnpqrstuvwxyz';
  const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitChars = '23456789';
  const allChars = lowerChars + upperChars + digitChars;

  // Capitalize prefix to ensure uppercase presence
  const safePrefix = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'Azma';

  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  let suffix = '';
  // Guarantee at least one uppercase, one lowercase, and one digit
  suffix += upperChars[randomBytes[0] % upperChars.length];
  suffix += lowerChars[randomBytes[1] % lowerChars.length];
  suffix += digitChars[randomBytes[2] % digitChars.length];

  const remainingCount = Math.max(12 - safePrefix.length, 8);
  for (let i = 0; i < remainingCount; i++) {
    suffix += allChars[randomBytes[(3 + i) % randomBytes.length] % allChars.length];
  }

  return `${safePrefix}${suffix}`;
}
