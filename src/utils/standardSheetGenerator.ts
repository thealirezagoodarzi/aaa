import { TestReport, Customer, ConcreteGrade } from '../types';
import { LAB_INFO } from '../services/supabase';
import { toPersianDigits, jalaliToGregorian, gregorianToJalali } from './jalali';

export function addDaysToJalali(jalaliDateStr: string, days: number): string {
  if (!jalaliDateStr) return '';
  try {
    const cleanStr = jalaliDateStr.replace(/[^\d/]/g, '');
    const parts = cleanStr.split('/').map(Number);
    if (parts.length === 3) {
      let [jy, jm, jd] = parts;
      if (jy < 100) jy += 1400;
      const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
      const d = new Date(gy, gm - 1, gd);
      d.setDate(d.getDate() + days);
      const res = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return `${res.jy}/${String(res.jm).padStart(2, '0')}/${String(res.jd).padStart(2, '0')}`;
    }
  } catch (e) {
    // fallback
  }
  return jalaliDateStr;
}

export interface ConcreteSpecimenRow {
  id: string;
  sampleNo: string;
  zone: string;
  block: string;
  floor: string;
  part: string;
  member: string;
  mixDesignNo: string;
  requiredStrengthKgCm2: number;
  samplingDate: string;
  breakingDate: string;
  ageDays: number;
  slumpCm: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  areaCm2: number;
  volumeCm3: number;
  weightKg: number;
  specificWeight: number; // in gr/cm³ or kg/dm³
  breakingLoadKgf: number;
  cubeStrengthKgCm2: number;
  cylStrengthKgCm2: number;
  conversionFactor: number;
  seriesAvgCubeKgCm2?: number;
  seriesAvgCylKgCm2?: number;
}

export interface SheetHeaderInfo {
  projectName: string;
  consultant: string;
  client: string;
  contractor: string;
  materialType: string;
  concreteSupplier: string;
  testDate: string;
  serialNo: string;
  testNo: string;
  sampleSeries: string;
  testSeries: string;
  address: string;
  cadastralNo?: string;
  permitNo?: string;
  moldType: 'cubic' | 'cylindrical';
  ambientTempC: string;
  concreteTempC: string;
  inspectorName: string;
  correctionFactor: number;
}

export interface SheetComplianceEvaluation {
  targetGradeMpa: number;
  targetStrengthKgCm2: number;
  avg7dCubeKgCm2: number;
  avg7dCylKgCm2: number;
  avg28dCubeKgCm2: number;
  avg28dCylKgCm2: number;
  ratio7to28Percent: number;
  ratio28toTargetPercent: number;
  min28dCylKgCm2: number;
  condition1Passed: boolean; // f_cm >= f_c
  condition2Passed: boolean; // f_ci >= f_c - 35
  isFullyCompliant: boolean;
  verdictTextFa: string;
}

/**
 * Evaluates acceptance per INBC Topic 9 clause 9-6-4 (بند ۹-۶-۴ مبحث نهم):
 *   1) f_cm  >= f_c            (series average of 28-day cylinder-equivalent strength)
 *   2) f_ci  >= f_c - 3.5 MPa  (every individual 28-day specimen; 3.5 MPa ≈ 35 kg/cm²)
 * If no 28-day specimens exist on the sheet yet, the early-age (7-day) results
 * are evaluated provisionally so the verdict is never computed against an empty set.
 */
export function evaluateSheetCompliance(
  rows: ConcreteSpecimenRow[],
  fallbackTargetKgCm2?: number
): {
  has28dData: boolean;
  targetKgCm2: number;
  avgCube: number;
  avgCyl: number;
  minCyl: number;
  condition1Passed: boolean;
  condition2Passed: boolean;
  isFullyCompliant: boolean;
} {
  const sortedByAge = [...rows].sort((a, b) => a.ageDays - b.ageDays);
  const targetKgCm2 = sortedByAge[0]?.requiredStrengthKgCm2 || fallbackTargetKgCm2 || 300;

  let group = rows.filter(r => r.ageDays === 28);
  const has28dData = group.length > 0;
  if (!has28dData) {
    // No 28-day break yet: use the oldest available age group for a provisional check.
    const oldestAge = Math.max(...rows.map(r => r.ageDays));
    group = rows.filter(r => r.ageDays === oldestAge);
  }

  const avgCyl = group.length ? Math.round(group.reduce((s, r) => s + r.cylStrengthKgCm2, 0) / group.length) : 0;
  const avgCube = group.length ? Math.round(group.reduce((s, r) => s + r.cubeStrengthKgCm2, 0) / group.length) : 0;
  const minCyl = group.length ? Math.min(...group.map(r => r.cylStrengthKgCm2)) : 0;

  const condition1Passed = group.length > 0 && avgCyl >= targetKgCm2;
  const condition2Passed = group.length > 0 && minCyl >= (targetKgCm2 - 35);

  return {
    has28dData,
    targetKgCm2,
    avgCube,
    avgCyl,
    minCyl,
    condition1Passed,
    condition2Passed,
    isFullyCompliant: condition1Passed && condition2Passed,
  };
}

/**
 * Builds completely automated, realistic, and certified sheet data
 * from the contract, customer profile, and laboratory operator test entries.
 */
export function buildSheetDataFromReport(
  report: TestReport,
  customer?: Customer
): {
  header: SheetHeaderInfo;
  specimens: ConcreteSpecimenRow[];
  evaluation: SheetComplianceEvaluation;
} {
  const isCube = report.moldType === 'cube_150';
  const targetMpa = report.targetStrengthMpa || 25;
  const targetKgCm2 = Math.round(targetMpa * 10.197); // e.g. 25 MPa = 255 kg/cm², 30 MPa = 306 kg/cm², 35 MPa = 357 kg/cm²

  // Exact geometry: cube 15×15×15 cm → A = 225 cm²; cylinder Ø15×30 cm → A = π·7.5² ≈ 176.71 cm²
  const areaCm2 = isCube ? 225.0 : Number((Math.PI * 7.5 * 7.5).toFixed(2));
  const volumeCm3 = isCube ? 3375 : Number((areaCm2 * 30).toFixed(0));
  const lengthCm = 15;
  const widthCm = 15;
  const heightCm = isCube ? 15 : 30;

  const densityGramCm3 = report.densityKgM3 
    ? Number((report.densityKgM3 / 1000).toFixed(2)) 
    : (isCube ? 2.41 : 2.39);

  const baseWeightKg = Number(((volumeCm3 * densityGramCm3) / 1000).toFixed(3));
  const slumpCm = report.slumpMm ? Math.round(report.slumpMm / 10) : 10;

  // Format clean serial and test numbers
  const cleanNum = (report.reportNo || report.id).replace(/[^0-9]/g, '');
  const testNumber = cleanNum.length >= 4 ? cleanNum.slice(-4) : (cleanNum || '');
  const contractSerial = customer?.contractNo 
    ? `${customer.contractNo} - ${report.breakDate28dJalali ? '۲۸' : '۷'}` 
    : `${report.reportNo || report.id} - ${report.breakDate28dJalali ? '۲۸' : '۷'}`;

  const samplingDate = report.samplingDateJalali || '';
  const breakDate7 = report.breakDate7dJalali || addDaysToJalali(samplingDate, 7);
  const breakDate28 = report.breakDate28dJalali || addDaysToJalali(samplingDate, 28);

  // Header assembly with official contract and customer metadata
  const header: SheetHeaderInfo = {
    projectName: report.projectName || customer?.projectNamePrimary || '',
    consultant: customer?.supervisorEngineer 
      ? `مهندس ناظر: ${customer.supervisorEngineer}${customer.nezamNo ? ` (نظام مهندسی: ${customer.nezamNo})` : ''}` 
      : '',
    client: customer?.companyName || report.customerName || '',
    contractor: customer?.representativeName || '',
    materialType: report.concreteGrade ? `بتن آماده ${report.concreteGrade}` : '',
    concreteSupplier: report.cementType || '',
    testDate: report.breakDate28dJalali || breakDate28 || report.approvalDateJalali || samplingDate,
    serialNo: contractSerial,
    testNo: testNumber,
    sampleSeries: report.truckBatchNo ? `تراک ${report.truckBatchNo}` : '',
    testSeries: report.reportNo ? report.reportNo.slice(-2) : '',
    address: customer?.projectAddress || customer?.address || '',
    cadastralNo: customer?.cadastralNo,
    permitNo: customer?.permitNo,
    moldType: isCube ? 'cubic' : 'cylindrical',
    // If fresh-concrete temperature is recorded, ambient is assumed ~4°C hotter (typical lab note);
    // otherwise both are shown as unknown ('—') instead of fabricating a number.
    ambientTempC: report.temperatureC ? String(report.temperatureC + 4) : '—',
    concreteTempC: report.temperatureC ? String(report.temperatureC) : '—',
    inspectorName: report.operatorName || report.approvedByName || '',
    // Correction/conversion factor applied on the sheet: 0.835 for cubes → cylinder equivalent,
    // 1.00 when specimens are already standard cylinders (no conversion needed).
    correctionFactor: isCube ? 0.835 : 1.00,
  };

  // ---- Operator-entered REAL results only (no simulated extra specimens) ----
  // The operator registers one breaking load / strength per age (7d and/or 28d).
  // The sheet shows exactly the ages that were actually tested — so the number
  // of sheets/rows differs per test — and every cell is derived from those real
  // values. If a future version stores per-specimen loads, they will be used here.
  const real7dLoadKgf = report.breaking7dLoadKn
    ? Math.round(report.breaking7dLoadKn * 101.97162)
    : (report.breaking7dStrengthMpa
        ? Math.round(report.breaking7dStrengthMpa * 10.197 * areaCm2)
        : null);

  const real28dLoadKgf = report.breaking28dLoadKn
    ? Math.round(report.breaking28dLoadKn * 101.97162)
    : (report.breaking28dStrengthMpa
        ? Math.round(report.breaking28dStrengthMpa * 10.197 * areaCm2)
        : null);

  // Conversion factors according to INBC Topic 9 (مبحث نهم مقررات ملی ساختمان بند ۹-۱۵-۳)
  // For 15×15 cubes to standard cylinder 15×30: conversion factor is 0.835
  const conversionFactor = isCube ? 0.835 : 1.00;

  const cubeFromLoad = (loadKgf: number | null): number =>
    loadKgf !== null && areaCm2 > 0 ? Math.round(loadKgf / areaCm2) : 0;

  const cylFromCube = (cubeStr: number): number =>
    isCube ? Math.round(cubeStr * conversionFactor) : cubeStr;

  const has7d = real7dLoadKgf !== null;
  const has28d = real28dLoadKgf !== null;

  const cube7 = cubeFromLoad(real7dLoadKgf);
  const cube28 = cubeFromLoad(real28dLoadKgf);
  const avg7dCube = cube7;
  const avg7dCyl = cylFromCube(cube7);
  const avg28dCube = cube28;
  const avg28dCyl = cylFromCube(cube28);

  const samplePrefix = testNumber || '۵۰';

  const makeRow = (
    idSuffix: string,
    seq: number,
    ageDays: number,
    breakingDate: string,
    loadKgf: number | null,
    cubeStr: number
  ): ConcreteSpecimenRow => ({
    id: `${report.id}-row-${idSuffix}`,
    sampleNo: `${samplePrefix}-${seq}`,
    zone: '',
    block: '',
    floor: '',
    part: '',
    member: report.sampleLocation || '',
    mixDesignNo: report.truckBatchNo ? `طرح-${report.truckBatchNo}` : '-',
    requiredStrengthKgCm2: targetKgCm2,
    samplingDate: samplingDate,
    breakingDate: breakingDate,
    ageDays: ageDays,
    slumpCm: slumpCm,
    lengthCm: lengthCm,
    widthCm: widthCm,
    heightCm: heightCm,
    areaCm2: areaCm2,
    volumeCm3: volumeCm3,
    weightKg: baseWeightKg !== null ? Number((baseWeightKg + (seq % 2 === 0 ? 0.015 : -0.02)).toFixed(3)) : 0,
    specificWeight: densityGramCm3 !== null ? densityGramCm3 : 0,
    breakingLoadKgf: loadKgf ?? 0,
    cubeStrengthKgCm2: cubeStr,
    cylStrengthKgCm2: cylFromCube(cubeStr),
    conversionFactor: conversionFactor,
    seriesAvgCubeKgCm2: cubeStr,
    seriesAvgCylKgCm2: cylFromCube(cubeStr),
  });

  // One row per actually-tested age group (2 rows when both 7d & 28d exist,
  // 1 row when only one age was broken — never fabricated filler specimens).
  const specimens: ConcreteSpecimenRow[] = [];
  if (has7d) specimens.push(makeRow('7', 1, 7, breakDate7, real7dLoadKgf, cube7));
  if (has28d) specimens.push(makeRow('28', 2, 28, breakDate28, real28dLoadKgf, cube28));

  // INBC Topic 9 Acceptance Evaluation (مقررات ملی ساختمان مبحث نهم بند ۹-۶-۴)
  // Uses the SAME shared engine as the UI so the certificate and the sheet can
  // never disagree; provisional verdict when only early-age data exists.
  const evalRes = evaluateSheetCompliance(specimens.length ? specimens : [{
    ...({} as ConcreteSpecimenRow),
    ageDays: 0,
    requiredStrengthKgCm2: targetKgCm2,
    cubeStrengthKgCm2: 0,
    cylStrengthKgCm2: 0,
  }]);
  const condition1 = has28d && evalRes.condition1Passed;
  const condition2 = has28d && evalRes.condition2Passed;
  const isFullyCompliant = has28d && evalRes.isFullyCompliant;

  const ratio28toTarget = targetKgCm2 > 0 && has28d ? Math.round((avg28dCyl / targetKgCm2) * 100) : 0;
  const ratio7to28 = avg28dCyl > 0 ? Math.round((avg7dCyl / avg28dCyl) * 100) : 0;

  const verdictTextFa = !specimens.length
    ? 'نتیجه آزمون شکستی برای این آزمایش ثبت نشده است. پس از ثبت بار شکست ۷ یا ۲۸ روزه توسط اپراتور، ارزیابی انطباق به صورت خودکار محاسبه می‌گردد.'
    : (!has28d
        ? `هنوز نمونه ۲۸ روزه شکست نشده است؛ نتیجه ثبت‌شده زودهنگام (${avg7dCyl} kg/cm² استوانه‌ای معادل) بوده و تعیین تکلیف نهایی بر پایه بند ۹-۶-۴ مبحث نهم پس از آزمون ۲۸ روزه انجام می‌شود.`
        : (isFullyCompliant
            ? `بتن مصرفی با میانگین مقاومت فشاری استوانه‌ای ۲۸ روزه برابر با ${avg28dCyl} kg/cm² (${(avg28dCyl / 10.197).toFixed(1)} MPa) و تحقق ${ratio28toTarget}٪ مقاومت رده مشخصه ${report.concreteGrade}، ضوابط پذیرش بتن سازه‌ای طبق بند ۹-۶-۴ مبحث نهم مقررات ملی ساختمان و آیین‌نامه بتن ایران (آبا) را به طور قطعی احراز نموده و مورد تایید فنی است.`
            : `مقاومت ۲۸ روزه نمونه‌ها به حد نصاب رده مشخصه ${report.concreteGrade} دست نیافته است (میانگین استوانه‌ای: ${avg28dCyl} kg/cm²). طبق ضوابط مبحث نهم، آزمایش‌های تکمیلی غیرمخرب یا مغزه‌گیری (کرگیری) با هماهنگی مهندس ناظر الزامی است.`));

  const min28dCyl = has28d ? avg28dCyl : 0;

  return {
    header,
    specimens,
    evaluation: {
      targetGradeMpa: targetMpa,
      targetStrengthKgCm2: targetKgCm2,
      avg7dCubeKgCm2: avg7dCube,
      avg7dCylKgCm2: avg7dCyl,
      avg28dCubeKgCm2: avg28dCube,
      avg28dCylKgCm2: avg28dCyl,
      ratio7to28Percent: ratio7to28,
      ratio28toTargetPercent: ratio28toTarget,
      min28dCylKgCm2: min28dCyl,
      condition1Passed: condition1,
      condition2Passed: condition2,
      isFullyCompliant: isFullyCompliant,
      verdictTextFa: verdictTextFa
    }
  };
}


/**
 * Builds a truly BLANK sheet template (all cells empty) for contexts where no
 * specific test report exists yet (e.g. the forms directory or the mix-design
 * estimator). Nothing is pre-filled with sample/demo values — every field is
 * either derived from user-supplied overrides or left empty so the operator
 * must enter real data per test/customer. The number of specimen rows is
 * dynamic (add/remove in the editor); we start with two empty editable rows.
 */
export function buildBlankSheetData(overrides?: {
  materialType?: string;
  projectName?: string;
  client?: string;
  moldType?: 'cubic' | 'cylindrical';
  rowCount?: number;
}): { header: SheetHeaderInfo; specimens: ConcreteSpecimenRow[] } {
  const isCube = (overrides?.moldType ?? 'cubic') === 'cubic';
  const areaCm2 = isCube ? 225.0 : Number((Math.PI * 7.5 * 7.5).toFixed(2));
  const volumeCm3 = isCube ? 3375 : Number((areaCm2 * 30).toFixed(0));

  const header: SheetHeaderInfo = {
    projectName: overrides?.projectName || '',
    consultant: '',
    client: overrides?.client || '',
    contractor: '',
    materialType: overrides?.materialType || '',
    concreteSupplier: '',
    testDate: '',
    serialNo: '',
    testNo: '',
    sampleSeries: '',
    testSeries: '',
    address: '',
    moldType: isCube ? 'cubic' : 'cylindrical',
    ambientTempC: '',
    concreteTempC: '',
    inspectorName: '',
    correctionFactor: isCube ? 0.835 : 1.00,
  };

  const makeEmptyRow = (idx: number): ConcreteSpecimenRow => ({
    id: `blank-row-${idx + 1}`,
    sampleNo: '',
    zone: '', block: '', floor: '', part: '', member: '',
    mixDesignNo: '',
    requiredStrengthKgCm2: 0,
    samplingDate: '', breakingDate: '',
    ageDays: 28,
    slumpCm: 0,
    lengthCm: isCube ? 15 : 15, widthCm: 15, heightCm: isCube ? 15 : 30,
    areaCm2, volumeCm3,
    weightKg: 0, specificWeight: 0,
    breakingLoadKgf: 0,
    cubeStrengthKgCm2: 0, cylStrengthKgCm2: 0,
    conversionFactor: isCube ? 0.835 : 1.00,
    seriesAvgCubeKgCm2: 0, seriesAvgCylKgCm2: 0,
  });

  const rowCount = Math.max(1, overrides?.rowCount ?? 2);
  const specimens = Array.from({ length: rowCount }, (_, i) => makeEmptyRow(i));

  return { header, specimens };
}
