/**
 * Shared Jalali (Persian calendar) conversion — SINGLE SOURCE OF TRUTH.
 *
 * ARCHITECTURE FIX (audit item #52): the Gregorian->Jalali algorithm used to be
 * duplicated in src/utils/jalali.ts (client) and server/labDbServer.ts with a
 * comment claiming they were "aligned". Two independent copies of the same
 * algorithm always drift, and here the drift corrupts money/identity data:
 * invoice numbers (`INV-<jy>-...`) and issue dates are derived from this
 * conversion on the SERVER, while every UI date flows through the client copy.
 *
 * Both bundles now import THIS file (the client bundle via vite, the server
 * bundle via esbuild — both resolve relative TS paths at build time), so there
 * is exactly one implementation. The body below is byte-for-byte the former
 * src/utils/jalali.ts algorithm (no behavior change for existing clients).
 */

export interface JalaliDateParts {
  jy: number; // Jalali Year (e.g. 1403)
  jm: number; // Jalali Month (1-12)
  jd: number; // Jalali Day (1-31)
}

/** Standard jalaali-js style Gregorian->Jalali conversion. */
export function gregorianToJalaliShared(gy: number, gm: number, gd: number): JalaliDateParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

/** Today's Jalali date as `YYYY/MM/DD` (zero-padded) — invoices / sheets / OTP. */
export function todayJalaliStrShared(now: Date = new Date()): string {
  const j = gregorianToJalaliShared(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}
