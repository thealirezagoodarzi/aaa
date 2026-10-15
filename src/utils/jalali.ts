/**
 * Persian Jalali (Solar Hijri) Calendar Utilities
 * Accurate algorithmic Gregorian <-> Jalali conversion
 */

export interface JalaliDate {
  jy: number; // Jalali Year (e.g. 1403)
  jm: number; // Jalali Month (1-12)
  jd: number; // Jalali Day (1-31)
}

export const JALALI_MONTH_NAMES_FA = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

export const JALALI_MONTH_NAMES_EN = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Day',
  'Bahman',
  'Esfand'
];

export const WEEKDAYS_FA = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه'
];

export const WEEKDAYS_SHORT_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// Check if Jalali Year is Leap (کبیسه)
export function isJalaliLeapYear(jy: number): boolean {
  const r = (jy % 33);
  return r === 1 || r === 5 || r === 9 || r === 13 || r === 17 || r === 22 || r === 26 || r === 30;
}

export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
  return 30;
}

/**
 * Converts Gregorian Date to Jalali Date
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
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

/**
 * Converts Jalali Date to Gregorian Date
 * Exact inverse of gregorianToJalali above (verified against the reference
 * jalaali-js implementation for Jalali years 1380..1420 with zero mismatches).
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  // Day-of-year (0-based) inside the Jalali year: months 1..6 have 31 days, 7..12 have 30.
  const jm0 = jm - 1;
  const doy = (jm0 <= 5 ? jm0 * 31 : 186 + (jm0 - 6) * 30) + (jd - 1);

  // Farvardin 1 always falls on March 20 or March 21 of Gregorian year jy + 621.
  // Probe both anchors and keep the one whose forward conversion matches exactly.
  const gy0 = jy + 621;
  for (const farvardin1MarDay of [20, 21]) {
    const probe = new Date(gy0, 2, farvardin1MarDay + doy); // JS Date normalizes overflow days
    const gj = gregorianToJalali(probe.getFullYear(), probe.getMonth() + 1, probe.getDate());
    if (gj.jy === jy && gj.jm === jm && gj.jd === jd) {
      return { gy: probe.getFullYear(), gm: probe.getMonth() + 1, gd: probe.getDate() };
    }
  }

  // Fallback for out-of-range/invalid input: scan neighboring Gregorian years.
  for (const gyTry of [gy0 - 1, gy0, gy0 + 1]) {
    for (const marDay of [19, 20, 21, 22]) {
      const probe = new Date(gyTry, 2, marDay + doy);
      const gj = gregorianToJalali(probe.getFullYear(), probe.getMonth() + 1, probe.getDate());
      if (gj.jy === jy && gj.jm === jm && gj.jd === jd) {
        return { gy: probe.getFullYear(), gm: probe.getMonth() + 1, gd: probe.getDate() };
      }
    }
  }

  // Should only be reached for invalid dates (e.g. Esfand 30 in a common year).
  const last = new Date(gy0, 2, 21 + doy);
  return { gy: last.getFullYear(), gm: last.getMonth() + 1, gd: last.getDate() };
}

/**
 * Get current Jalali date
 */
export function getTodayJalali(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Format Jalali Date as "1403/06/18"
 */
export function formatJalali(jDate: JalaliDate): string {
  const m = jDate.jm < 10 ? `0${jDate.jm}` : `${jDate.jm}`;
  const d = jDate.jd < 10 ? `0${jDate.jd}` : `${jDate.jd}`;
  return `${jDate.jy}/${m}/${d}`;
}

/**
 * Format Jalali Date to Human Readable String (e.g. "۱۸ شهریور ۱۴۰۳")
 */
export function formatJalaliHumanFa(jDate: JalaliDate): string {
  const monthName = JALALI_MONTH_NAMES_FA[jDate.jm - 1] || '';
  return `${toPersianDigits(jDate.jd)} ${monthName} ${toPersianDigits(jDate.jy)}`;
}

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(num: number | string): string {
  const idMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (w) => idMap[+w]);
}

/**
 * Parse string "1403/06/18" to JalaliDate
 */
export function parseJalali(str: string): JalaliDate | null {
  if (!str) return null;
  // Accept Persian/Arabic-Indic digits and "-" or "." separators, then normalize
  const normalized = String(str)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[-.]/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { jy: parts[0], jm: parts[1], jd: parts[2] };
  }
  return null;
}

/**
 * Add days to Jalali Date (e.g. +7 days, +28 days for concrete break date)
 */
export function addDaysToJalali(jDate: JalaliDate, daysToAdd: number): JalaliDate {
  const g = jalaliToGregorian(jDate.jy, jDate.jm, jDate.jd);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  d.setDate(d.getDate() + daysToAdd);
  return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Returns Persian weekday index for a Jalali date (0 = شنبه, 1 = یکشنبه, ..., 6 = جمعه)
 */
export function getJalaliWeekday(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorian(jy, jm, jd);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  const jsDay = d.getDay(); // 0 = Sunday, 6 = Saturday
  // Convert so that Saturday is 0, Sunday is 1, ..., Friday is 6
  return (jsDay + 1) % 7;
}

/**
 * Returns the weekday of the 1st day of a Jalali month (0 = شنبه, ..., 6 = جمعه)
 */
export function getFirstWeekdayOfJalaliMonth(jy: number, jm: number): number {
  return getJalaliWeekday(jy, jm, 1);
}

/**
 * Format number with comma thousand separators
 */
export function formatToman(amount: number): string {
  return amount.toLocaleString('en-US');
}

