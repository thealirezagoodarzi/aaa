import React, { useState, useEffect, useMemo } from 'react';
import { LAB_INFO } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';
import { CompanyLogo } from './CompanyLogo';
import { 
  Printer, 
  Download, 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight,
  Calculator,
  Layers,
  FileSpreadsheet,
  Info,
  Copy,
  ShieldCheck,
  Check,
  Building2,
  FileText,
  BadgeCheck,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';
import { uniqueId } from '../../utils/uniqueId';
import { QRCodeSVG } from 'qrcode.react';
import { TestReport, Customer } from '../../types';
import { downloadBlob, printOnlyElement } from '../../utils/printDom';
import { 
  buildSheetDataFromReport, 
  buildBlankSheetData,
  evaluateSheetCompliance,
  ConcreteSpecimenRow, 
  SheetHeaderInfo, 
  SheetComplianceEvaluation 
} from '../../utils/standardSheetGenerator';

export type { ConcreteSpecimenRow, SheetHeaderInfo };

interface PrintStandardSheetModalProps {
  onClose: () => void;
  report?: TestReport;
  customer?: Customer;
  initialHeader?: Partial<SheetHeaderInfo>;
  initialRows?: ConcreteSpecimenRow[];
  readOnly?: boolean;
}

export const PrintStandardSheetModal: React.FC<PrintStandardSheetModalProps> = ({
  onClose,
  report,
  customer,
  initialHeader,
  initialRows,
  readOnly = false
}) => {
  // Hook modal to browser Back button so user returns cleanly
  useModalBack(true, onClose, 'print-standard-sheet-modal');

  // Compute auto-generated data from real contract, customer, and operator test input
  const generatedData = useMemo(() => {
    if (report) {
      return buildSheetDataFromReport(report, customer);
    }
    return null;
  }, [report, customer]);

  const [header, setHeader] = useState<SheetHeaderInfo>(() => {
    if (generatedData) {
      return { ...generatedData.header, ...initialHeader };
    }
    return { ...buildBlankSheetData().header, ...initialHeader };
  });

  const [rows, setRows] = useState<ConcreteSpecimenRow[]>(() => {
    if (initialRows && initialRows.length) return initialRows;
    if (generatedData) return generatedData.specimens;
    return buildBlankSheetData(initialHeader).specimens;
  });

  const [activeMode, setActiveMode] = useState<'preview' | 'edit'>('preview');
  const [isAiRecalculating, setIsAiRecalculating] = useState(false);
  const [aiAuditVerdict, setAiAuditVerdict] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // When report or customer changes, synchronize
  useEffect(() => {
    if (report) {
      const data = buildSheetDataFromReport(report, customer);
      setHeader({ ...data.header, ...initialHeader });
      if (!initialRows || initialRows.length === 0) {
        setRows(data.specimens);
      }
    }
  }, [report, customer]);

  // Recalculate row values and series averages
  const recalculateAll = (currentRows: ConcreteSpecimenRow[]): ConcreteSpecimenRow[] => {
    const isCube = header.moldType === 'cubic';
    const factor = isCube ? 0.835 : 1.00;

    const updated = currentRows.map(row => {
      const rLength = row.lengthCm || 15;
      const rWidth = row.widthCm || 15;
      const rHeight = row.heightCm || (isCube ? 15 : 30);
      let rArea: number;
      let rVol: number;
      if (!isCube) {
        // Standard cylinder Ød×h → cross-section area π·(d/2)² (exact, not a hardcoded constant)
        rArea = Math.PI * (rWidth / 2) * (rWidth / 2);
        rVol = rArea * rHeight;
      } else {
        rArea = rLength * rWidth;
        rVol = rArea * rHeight;
      }
      const weightGram = row.weightKg > 100 ? row.weightKg : row.weightKg * 1000;
      const calcSpecificWeight = rVol > 0 ? Number((weightGram / rVol).toFixed(2)) : 2.40;

      const cubeStr = rArea > 0 && row.breakingLoadKgf > 0 
        ? Math.round(row.breakingLoadKgf / rArea) 
        : row.cubeStrengthKgCm2;

      // For cubic molds the sheet reports both the measured cube strength and the
      // cylinder-equivalent value (×0.835 per مبحث نهم بند ۹-۱۵-۳). For cylindrical
      // specimens the measured value IS the cylinder strength — no conversion applied.
      const cylStr = isCube 
        ? Math.round(cubeStr * factor) 
        : cubeStr;

      return {
        ...row,
        heightCm: rHeight,
        areaCm2: Number(rArea.toFixed(2)),
        volumeCm3: Math.round(rVol),
        specificWeight: calcSpecificWeight,
        cubeStrengthKgCm2: cubeStr,
        cylStrengthKgCm2: cylStr,
        conversionFactor: factor,
      };
    });

    return updated.map(r => {
      const sameAgeRows = updated.filter(x => x.ageDays === r.ageDays);
      const avgCube = sameAgeRows.length 
        ? Math.round(sameAgeRows.reduce((sum, item) => sum + item.cubeStrengthKgCm2, 0) / sameAgeRows.length)
        : r.cubeStrengthKgCm2;
      const avgCyl = sameAgeRows.length 
        ? Math.round(sameAgeRows.reduce((sum, item) => sum + item.cylStrengthKgCm2, 0) / sameAgeRows.length)
        : r.cylStrengthKgCm2;
      return {
        ...r,
        seriesAvgCubeKgCm2: avgCube,
        seriesAvgCylKgCm2: avgCyl,
      };
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle cell edit
  const handleCellChange = (id: string, field: keyof ConcreteSpecimenRow, val: any) => {
    const updated = rows.map(r => {
      if (r.id === id) {
        return { ...r, [field]: val };
      }
      return r;
    });
    setRows(recalculateAll(updated));
  };

  // Dynamic specimen rows: sheets differ per test — operators add/remove rows.
  const handleAddRow = () => {
    if (readOnly) return;
    const blank = buildBlankSheetData({ moldType: header.moldType, rowCount: 1 }).specimens[0];
    // Collision-safe row id: two rapid clicks inside the same millisecond used
    // to produce duplicate keys (React key warnings + remove-row removing both).
    const newRow: ConcreteSpecimenRow = { ...blank, id: uniqueId('row') };
    setRows(recalculateAll([...rows, newRow]));
  };

  const handleRemoveRow = (id: string) => {
    if (readOnly) return;
    if (rows.length <= 1) return; // keep at least one editable row
    setRows(recalculateAll(rows.filter(r => r.id !== id)));
  };

  // AI Instant Auto-Calculate & Quality Audit
  const handleAiSmartCalculate = () => {
    if (readOnly) return; // read-only users may not mutate sheet data
    setIsAiRecalculating(true);
    setTimeout(() => {
      const recalculated = recalculateAll(rows);
      setRows(recalculated);

      const evalResult = evaluateSheetCompliance(recalculated);
      const { targetKgCm2, avgCyl: day28AvgCyl, minCyl: day28MinCyl } = evalResult;

      setAiAuditVerdict(
        !evalResult.isFullyCompliant
          ? `هشدار کنترل کیفیت: میانگین مقاومت ۲۸ روزه (${day28AvgCyl} kg/cm²) یا حداقل مقاومت تک‌نمونه (${day28MinCyl} kg/cm²) کمتر از حدود مجاز بند ۹-۶-۴ مبحث نهم است. هماهنگی با مهندس ناظر جهت آزمایش‌های تکمیلی (چکش اشمیت / مغزه‌گیری) توصیه می‌شود.`
          : evalResult.has28dData
            ? `تاییدیه انطباق هوشمند: میانگین مقاومت استوانه‌ای ۲۸ روزه برابر با ${day28AvgCyl} kg/cm² (${(day28AvgCyl / 10.197).toFixed(1)} MPa) است. هر دو شرط پذیرش بند ۹-۶-۴ مبحث نهم مقررات ملی ساختمان (میانگین ≥ مقاومت مشخصه، و کمترین نمونه ≥ مقاومت مشخصه منهای ۳.۵ مگاپاسکال) به طور کامل احراز گردیده و بتن مورد تایید قطعی است.`
            : `نتایج اولیه (۷ روزه): میانگین مقاومت استوانه‌ای موجود برابر با ${day28AvgCyl} kg/cm² است و شرایط بند ۹-۶-۴ مبحث نهم بر پایه نتایج اولیه احراز شد. ارزیابی نهایی پس از شکست نمونه‌های ۲۸ روزه الزامی است.`
      );
      setIsAiRecalculating(false);
    }, 450);
  };

  // Export Sheet to Excel-compatible UTF-8 CSV
  const handleExportCsv = () => {
    const csvHeaders = [
      'شماره نمونه',
      'بخش / عضو سازه',
      'شماره طرح اختلاط',
      'مقاومت مشخصه (Kg/cm²)',
      'تاریخ نمونه‌گیری',
      'تاریخ آزمایش',
      'سن (روز)',
      'اسلامپ (Cm)',
      'طول (Cm)',
      'عرض (Cm)',
      'ارتفاع (Cm)',
      'سطح مقطع (Cm²)',
      'حجم (Cm³)',
      'وزن (Kg)',
      'وزن مخصوص (gr/cm³)',
      'بار گسیختگی (Kgf)',
      'مقاومت فشاری مکعبی (Kg/cm²)',
      'مقاومت استوانه نظیر (Kg/cm²)',
      'ضریب تبدیل',
      'میانگین سری مکعبی (Kg/cm²)',
      'میانگین سری استوانه‌ای (Kg/cm²)'
    ];

    const csvRows = rows.map(r => [
      `"${r.sampleNo}"`,
      `"${r.member}"`,
      `"${r.mixDesignNo}"`,
      r.requiredStrengthKgCm2,
      r.samplingDate,
      r.breakingDate,
      r.ageDays,
      r.slumpCm,
      r.lengthCm,
      r.widthCm,
      r.heightCm,
      r.areaCm2,
      r.volumeCm3,
      r.weightKg,
      r.specificWeight,
      r.breakingLoadKgf,
      r.cubeStrengthKgCm2,
      r.cylStrengthKgCm2,
      r.conversionFactor,
      r.seriesAvgCubeKgCm2 || '',
      r.seriesAvgCylKgCm2 || ''
    ]);

    const csvContent = '\uFEFF' + [
      `"پروژه: ${header.projectName}"`,
      `"کارفرما: ${header.client}"`,
      `"شماره آزمایش: ${header.testNo}"`,
      `"تاریخ آزمون: ${header.testDate}"`,
      `"رده بتن: ${header.materialType}"`,
      '',
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `BetonLab-Sheet-${header.testNo || 'Report'}.csv`);
  };

  // Print / Save-as-PDF (A4 Landscape). The browser print dialog lets the
  // user choose "Save as PDF" — this is the reliable, dependency-free path.
  const handleDownloadPdf = () => {
    if (isExportingPdf) return; // guard against double-clicks while dialog opens
    setIsExportingPdf(true);
    // Switch back to preview mode so the edit panel (no-print) never appears.
    setActiveMode('preview');
    // Wait one frame for React to commit the mode change before printing.
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (!printOnlyElement('standard-sheet-print-doc')) {
            window.print();
          }
        } finally {
          setIsExportingPdf(false);
        }
      }, 50);
    });
  };

  // Group rows dynamically by specimen age — sheets differ per test: some have
  // only 7-day results, some 7+28, some include 56/90-day follow-up specimens.
  const ageGroups = useMemo(() => {
    const map = new Map<number, ConcreteSpecimenRow[]>();
    for (const r of rows) {
      const arr = map.get(r.ageDays) ?? [];
      arr.push(r);
      map.set(r.ageDays, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([age, groupRows]) => ({
        age,
        rows: groupRows,
        avgCube: groupRows.length ? Math.round(groupRows.reduce((s, i) => s + i.cubeStrengthKgCm2, 0) / groupRows.length) : 0,
        avgCyl: groupRows.length ? Math.round(groupRows.reduce((s, i) => s + i.cylStrengthKgCm2, 0) / groupRows.length) : 0,
      }));
  }, [rows]);

  // Shared compliance engine (بند ۹-۶-۴ مبحث نهم) — handles the case where only
  // early-age (7-day) results exist yet, so conditions are never evaluated against
  // an empty 28-day set (which previously produced a false "all passed" verdict).
  const sheetEval = evaluateSheetCompliance(rows);
  const targetSpecKgCm2 = sheetEval.targetKgCm2;
  const cond1Passed = sheetEval.condition1Passed;
  const cond2Passed = sheetEval.condition2Passed;
  const isAllPassed = sheetEval.isFullyCompliant;

  // Display helper: any blank header field renders as an official dash on the print sheet.
  const fmt = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '—';
    return toPersianDigits(String(val));
  };

  // Real digital-authenticity QR code encoding the lab, test number and key results.
  const verificationPayload = [
    'LAB-VERIFY',
    LAB_INFO.name,
    `NO:${header.testNo || '-'}`,
    `SRN:${header.serialNo || '-'}`,
    `PRJ:${header.projectName || '-'}`,
    `DATE:${header.testDate || '-'}`,
    `FCM:${sheetEval.avgCyl}kg`,
    `TARGET:${targetSpecKgCm2}kg`,
    `RES:${isAllPassed ? 'PASS' : sheetEval.has28dData ? 'FAIL' : 'EARLY'}`
  ].join('|');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-1 sm:p-4 text-slate-900" dir="rtl">
      
      {/* Dynamic Print Stylesheet strictly configured for A4 Landscape */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 6mm 7mm !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .standard-sheet-print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Floating Control Bar (Hidden on print) */}
      <div className="fixed top-3 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-slate-900/95 text-white px-4 py-2 rounded-full shadow-2xl border border-slate-700 no-print">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-md transition text-white active:scale-95 cursor-pointer"
          title="بازگشت (ESC)"
        >
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          <span>بازگشت</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        {!readOnly && (
        <button
          onClick={handleAiSmartCalculate}
          disabled={isAiRecalculating}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 font-bold text-xs shadow-md transition text-slate-950 active:scale-95 cursor-pointer"
          title="محاسبه خودکار مقاومت‌ها و انطباق مبحث نهم"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAiRecalculating ? 'animate-spin' : ''}`} />
          <span>محاسبه و ارزیابی هوشمند</span>
        </button>
        )}

        {!readOnly && (
          <button
            onClick={() => setActiveMode(activeMode === 'preview' ? 'edit' : 'preview')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 font-bold text-xs border border-slate-600 transition cursor-pointer"
          >
            {activeMode === 'preview' ? 'ویرایش داده‌های اپراتور' : 'مشاهده فرم نهایی پرینت'}
          </button>
        )}

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow-md transition text-white cursor-pointer active:scale-95"
          title="دانلود شیت به فرمت اکسل استاندارد (CSV UTF-8)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>دانلود اکسل (CSV)</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 font-bold text-xs shadow-md transition text-white cursor-pointer active:scale-95"
          title="دانلود یا چاپ فایل رسمی (A4 Landscape)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExportingPdf ? 'در حال تولید PDF...' : 'دانلود PDF / پرینت (A4 افقی)'}</span>
        </button>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Container - A4 Landscape Standard Sheet */}
      <div id="standard-sheet-print-doc" className="standard-sheet-print-container w-full max-w-6xl bg-white text-slate-900 rounded-lg shadow-2xl overflow-x-auto border border-slate-300 print-card my-12 print:my-0 print:border-none print:shadow-none p-3 sm:p-5 font-sans">
        
        {/* AI Audit Alert Banner (no-print) */}
        {aiAuditVerdict && (
          <div className="no-print mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-start gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              <strong>نتیجه پردازش هوش مصنوعی آزمایشگاه:</strong> {aiAuditVerdict}
            </div>
            <button 
              onClick={() => setAiAuditVerdict(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OFFICIAL SHEET REPLICA (EXACT STRUCTURAL MATCH TO EXCEL / FORM BS 1881) */}
        {/* ========================================================================= */}
        <div className="border-2 border-black p-2 print:p-1 text-[10.5px] select-text bg-white">
          
          {/* Top Bar: Code, Official Seal/Logo, Lab Official Info */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
            <div className="text-start space-y-0.5 min-w-[150px]">
              <div className="text-[10px] font-mono font-bold text-slate-900">
                Code No. : ISIRI-F-1403-QC048
              </div>
              <div className="text-[9px] text-slate-700 font-sans font-bold">
                استاندارد ملی ایران شماره ۳۲۰۱ و ۳۲۰۶
              </div>
              <div className="text-[9px] font-mono text-slate-600 font-bold">
                ISO/IEC 17025 ACCREDITED
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-50 border border-slate-400 rounded-lg">
              <CompanyLogo className="w-10 h-10 rounded shadow-xs" />
              <div className="text-center">
                <div className="font-extrabold text-[12px] text-slate-950 leading-tight">
                  آزمایشگاه تخصصی کنترل کیفیت بتن و مقاومت مصالح ساختمانی
                </div>
                <div className="text-[9.5px] text-blue-900 font-bold">
                  دارای صلاحیت رسمی از سازمان نظام مهندسی و اداره کل استاندارد
                </div>
              </div>
            </div>

            <div className="text-end space-y-0.5 min-w-[220px]">
              <span className="font-black text-xs sm:text-sm text-slate-950 font-serif block">
                {LAB_INFO.name}
              </span>
              <div className="text-[9px] text-slate-800 font-sans font-bold">
                شماره ثبت: <span className="font-mono font-bold">{toPersianDigits(LAB_INFO.registrationNo)}</span> • پروانه نظام مهندسی: <span className="font-mono font-bold">{toPersianDigits(LAB_INFO.licenseNo)}</span>
              </div>
              <div className="text-[8.5px] text-slate-600 font-mono" dir="ltr">
                TEL: {LAB_INFO.landline} | MOB: {LAB_INFO.phone}
              </div>
            </div>
          </div>

          {/* Title Header Box */}
          <div className="border-2 border-black text-center py-1 mb-2 bg-slate-100 print:bg-slate-200">
            <div className="font-black text-xs sm:text-sm text-black">
              شیت استاندارد نتایج آزمایش تعیین مقاومت فشاری نمونه‌های بتنی (شیت رسمی شکست بتن)
            </div>
            <div className="font-mono text-[8.5px] tracking-wider text-slate-800 uppercase font-bold" dir="ltr">
              Standard Test Method for Compressive Strength of Concrete Specimens (ISIRI 3201 / ASTM C39 / BS 1881)
            </div>
          </div>

          {/* Project & Client Metadata 4-Row Grid */}
          <div className="border border-black mb-2 text-[9.5px] leading-tight divide-y divide-black">
            
            {/* Row 1 */}
            <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black">
              <div className="col-span-3 p-1 font-bold text-start bg-slate-50">
                نوع مصالح: <span>{header.materialType || '—'}</span>
              </div>
              <div className="col-span-4 p-1 font-bold">
                پروژه: <span className="text-blue-950 font-black">{header.projectName || '—'}</span>
              </div>
              <div className="col-span-3 p-1">
                شماره قرارداد / سریال: <span className="font-mono font-bold">{fmt(header.serialNo)}</span>
              </div>
              <div className="col-span-1 p-1 text-center font-bold">
                {header.sampleSeries || '—'}
              </div>
              <div className="col-span-1 p-1 text-center font-bold">
                دمای محیط: {fmt(header.ambientTempC)}°C
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black">
              <div className="col-span-3 p-1">
                محل تامین بتن: <strong>{header.concreteSupplier}</strong>
              </div>
              <div className="col-span-4 p-1">
                مشاور / ناظر: <span>{header.consultant}</span>
              </div>
              <div className="col-span-3 p-1">
                شماره آزمایش: <span className="font-mono font-bold">{fmt(header.testNo)}</span>
              </div>
              <div className="col-span-2 p-1 text-center font-bold">
                دمای بتن تازه: {fmt(header.concreteTempC)}°C
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black">
              <div className="col-span-3 p-1">
                تاریخ انجام آزمایش: <span className="font-mono font-bold">{fmt(header.testDate)}</span>
              </div>
              <div className="col-span-4 p-1">
                کارفرما / خریدار: <strong>{header.client || '—'}</strong> {header.contractor ? `(مجری: ${header.contractor})` : ''}
              </div>
              <div className="col-span-4 p-1">
                نشانی کارگاه: <span>{header.address || '—'}</span> {header.cadastralNo ? `• پلاک: ${toPersianDigits(header.cadastralNo)}` : ''}
              </div>
              <div className="col-span-1 p-1 text-center font-bold text-emerald-900">
                {header.moldType === 'cubic' ? 'مکعبی ۱۵' : 'استوانه‌ای'}
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-12 divide-x divide-x-reverse divide-black bg-slate-50/70">
              <div className="col-span-3 p-1 flex items-center justify-between">
                <span>نوع قالب استاندارد:</span>
                <span className="font-bold">
                  {header.moldType === 'cubic' ? 'مکعبی ۱۵×۱۵×۱۵ سانتیمتر' : 'استوانه‌ای ۱۵×۳۰ سانتیمتر'}
                </span>
              </div>
              <div className="col-span-3 p-1 text-center">
                ضریب تبدیل به استوانه (مبحث ۹): <span className="font-mono font-bold">{header.moldType === 'cubic' ? '۰.۸۳۵ (مکعب ← استوانه)' : '۱.۰۰۰ (بدون تبدیل)'}</span>
              </div>
              <div className="col-span-3 p-1 text-center">
                نحوه عمل‌آوری: <strong>حوضچه آب آهک اشباع ۲±۲۳°C</strong>
              </div>
              <div className="col-span-3 p-1 text-center font-bold text-blue-900">
                مسئول فنی: <span>{header.inspectorName || '—'}</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RESULTS TABLE (THE EXACT 21 COLUMNS FROM THE USER'S EXCEL FILE)          */}
          {/* ========================================================================= */}
          <div className="overflow-x-auto border-t-2 border-b-2 border-black mb-2 mt-2">
            <table className="w-full border-collapse text-[9.5px] text-center border-black">
              
              {/* Complex Multi-level Table Header */}
              <thead>
                
                {/* Level 1 Headers */}
                <tr className="bg-slate-200 print:bg-slate-200 border-b border-black font-extrabold text-[9px]">
                  <th rowSpan={3} className="border-e border-black p-1 w-10">شماره نمونه</th>
                  <th colSpan={5} className="border-e border-black p-1">موقعیت و محل نمونه‌گیری</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-8">شماره طرح</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-12">
                    مقاومت خواسته شده<br/>
                    (Kg/cm²)
                  </th>
                  <th colSpan={2} className="border-e border-black p-1">تاریخ آزمایش</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-7">سن نمونه (روز)</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-7">اسلامپ (Cm)</th>
                  <th colSpan={3} className="border-e border-black p-1">ابعاد قالب (Cm)</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-10">مساحت (Cm²)</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-10">حجم (Cm³)</th>
                  <th rowSpan={3} className="border-e border-black p-1 w-12">وزن نمونه (Kg)</th>
                  {/* Corrected Metric Unit */}
                  <th rowSpan={3} className="border-e border-black p-1 w-12">وزن مخصوص (gr/cm³)</th>
                  <th colSpan={2} className="border-e border-black p-1">مقاومت شکست مکعبی</th>
                  <th colSpan={2} className="border-black p-1">مقاومت شکست استوانه‌ای (مبحث ۹)</th>
                </tr>

                {/* Level 2 Sub-Headers */}
                <tr className="bg-slate-100 print:bg-slate-100 border-b border-black text-[8.5px] font-bold">
                  <th rowSpan={2} className="border-e border-black p-1 w-6">ناحیه</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-5">زون</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-5">بلوک</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-6">طبقه</th>
                  <th rowSpan={2} className="border-e border-black p-1 min-w-28 text-start px-1.5">عضو سازه‌ای</th>
                  
                  <th rowSpan={2} className="border-e border-black p-1 w-12">نمونه‌گیری</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-12">شکست</th>

                  <th className="border-e border-black p-1 w-6">طول</th>
                  <th className="border-e border-black p-1 w-6">عرض</th>
                  <th className="border-e border-black p-1 w-6">ارتفاع</th>

                  <th rowSpan={2} className="border-e border-black p-1 w-12">بار جک (Kgf)</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-12">(Kg/cm²)</th>

                  <th rowSpan={2} className="border-e border-black p-1 w-12">میانگین</th>
                  <th rowSpan={2} className="border-e border-black p-1 w-12">(Kg/cm²)</th>
                  <th rowSpan={2} className="border-black p-1 w-12">میانگین نهایی</th>
                </tr>

                {/* Level 3 Dimension units */}
                <tr className="bg-slate-100 print:bg-slate-100 border-b border-black text-[8px]">
                  <th className="border-e border-black p-0.5">(Cm)</th>
                  <th className="border-e border-black p-0.5">(Cm)</th>
                  <th className="border-e border-black p-0.5">(Cm)</th>
                </tr>

              </thead>

              {/* Table Body — grouped dynamically by specimen age (7/28/56/90...) */}
              <tbody className="divide-y divide-black font-semibold">

                {ageGroups.map((group) => group.rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="border-e border-black p-1 font-bold bg-slate-50 print:bg-slate-50">{toPersianDigits(row.sampleNo) || '—'}</td>
                    <td className="border-e border-black p-1">{row.zone || '-'}</td>
                    <td className="border-e border-black p-1">{row.block || '-'}</td>
                    <td className="border-e border-black p-1">{row.floor || '-'}</td>
                    <td className="border-e border-black p-1">{row.part || '-'}</td>
                    <td className="border-e border-black p-1 font-sans text-start px-1.5 whitespace-nowrap">{row.member || '-'}</td>
                    <td className="border-e border-black p-1">{row.mixDesignNo || '-'}</td>
                    <td className="border-e border-black p-1 font-bold">{row.requiredStrengthKgCm2 ? toPersianDigits(row.requiredStrengthKgCm2) : '-'}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.samplingDate) || '-'}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.breakingDate) || '-'}</td>
                    <td className="border-e border-black p-1 font-bold text-amber-900">{toPersianDigits(row.ageDays)}</td>
                    <td className="border-e border-black p-1">{row.slumpCm ? toPersianDigits(row.slumpCm) : '-'}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.lengthCm)}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.widthCm)}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.heightCm)}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.areaCm2.toFixed(1))}</td>
                    <td className="border-e border-black p-1">{toPersianDigits(row.volumeCm3)}</td>
                    <td className="border-e border-black p-1 font-bold">{row.weightKg ? toPersianDigits(row.weightKg.toFixed(3)) : '-'}</td>
                    <td className="border-e border-black p-1">{row.specificWeight ? toPersianDigits(row.specificWeight.toFixed(2)) : '-'}</td>
                    <td className="border-e border-black p-1 font-bold text-slate-800">{row.breakingLoadKgf ? toPersianDigits(row.breakingLoadKgf.toLocaleString()) : '-'}</td>
                    <td className="border-e border-black p-1 font-bold text-black">{row.cubeStrengthKgCm2 ? toPersianDigits(row.cubeStrengthKgCm2) : '-'}</td>

                    {/* Cube Mean Span for this age group */}
                    {idx === 0 ? (
                      <td rowSpan={group.rows.length} className="border-e border-black p-1 font-black text-black align-middle bg-slate-50/60 text-[10px]">
                        {group.avgCube ? toPersianDigits(group.avgCube) : '-'}
                      </td>
                    ) : null}

                    {/* Cylinder Strength */}
                    <td className="border-e border-black p-1 font-bold">{row.cylStrengthKgCm2 ? toPersianDigits(row.cylStrengthKgCm2) : '-'}</td>

                    {/* Cylinder Mean Span for this age group */}
                    {idx === 0 ? (
                      <td rowSpan={group.rows.length} className="border-black p-1 font-black text-blue-900 text-[10.5px] align-middle bg-slate-50/80">
                        {group.avgCyl ? toPersianDigits(group.avgCyl) : '-'}
                      </td>
                    ) : null}
                  </tr>
                )))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={23} className="p-4 text-center text-slate-500 text-[10px] font-bold">
                      هیچ نمونه‌ای ثبت نشده است — برای شروع، از حالت «ویرایش داده‌های اپراتور» ردیف اضافه کنید.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

          {/* ========================================================================= */}
          {/* COMPLIANCE & ACCEPTANCE EVALUATION (INBC TOPIC 9 / مبحث نهم مقررات ملی)   */}
          {/* ========================================================================= */}
          {!sheetEval.has28dData && (
            <div className="border border-amber-500 bg-amber-50 p-1.5 mb-2 text-[9.5px] font-bold text-amber-900">
              ⚠ توجه: نتایج شکست ۲۸ روزه نمونه‌ها هنوز در دسترس نیست. ارزیابی زیر صرفاً پیش‌بینی اولیه بر پایه نتایج زودهنگام است و جایگزین تاییدیه نهایی بند ۹-۶-۴ مبحث نهم نمی‌باشد.
            </div>
          )}
          <div className="border border-black p-2 mb-2 bg-slate-50/90 text-[10px] space-y-1">
            <div className="flex flex-wrap items-center justify-between border-b border-black/40 pb-1 gap-2">
              <span className="font-extrabold text-black flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-emerald-700" />
                <span>ارزیابی انطباق استاندارد و ضوابط پذیرش بتن (بند ۹-۶-۴ مبحث نهم مقررات ملی ساختمان):</span>
              </span>
              
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-bold">
                  <span>شرط اول (fcm ≥ fc):</span>
                  {cond1Passed ? (
                    <span className="text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                      ✓ احراز شد ({toPersianDigits(sheetEval.avgCyl)} ≥ {toPersianDigits(targetSpecKgCm2)})
                    </span>
                  ) : (
                    <span className="text-rose-700 font-extrabold bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300">
                      ✗ عدم احراز
                    </span>
                  )}
                </span>

                <span className="inline-flex items-center gap-1 font-bold">
                  <span>شرط دوم (fci ≥ fc - 35):</span>
                  {cond2Passed ? (
                    <span className="text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                      ✓ احراز شد ({toPersianDigits(sheetEval.minCyl)} ≥ {toPersianDigits(targetSpecKgCm2 - 35)})
                    </span>
                  ) : (
                    <span className="text-rose-700 font-extrabold bg-rose-100 px-1.5 py-0.2 rounded border border-rose-300">
                      ✗ عدم احراز
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9.5px] leading-relaxed pt-0.5">
              <div className="flex-1 pe-3">
                <strong>نتیجه‌گیری کارشناسی آزمایشگاه:</strong> میانگین مقاومت فشاری استوانه‌ای {sheetEval.has28dData ? '۲۸ روزه' : '(موجود)'} برابر با{' '}
                <strong>{toPersianDigits(sheetEval.avgCyl)} kg/cm²</strong> ({toPersianDigits((sheetEval.avgCyl / 10.197).toFixed(1))} MPa) بوده که معادل{' '}
                <strong>{toPersianDigits(Math.round((sheetEval.avgCyl / (targetSpecKgCm2 || 1)) * 100))}%</strong> مقاومت مشخصه رده درخواستی است.{' '}
                {!sheetEval.has28dData
                  ? 'هنوز نمونه ۲۸ روزه آزمایش نشده است؛ این نتیجه صرفاً اولیه بوده و تعیین تکلیف نهایی پس از آزمون ۲۸ روزه انجام می‌شود.'
                  : isAllPassed
                  ? 'نمونه‌ها با ضوابط پذیرش آیین‌نامه بتن ایران (آبا) و مبحث نهم مقررات ملی ساختمان مطابقت کامل داشته و قطعه بتن‌ریزی شده مورد قبول قطعی می‌باشد.'
                  : 'مقاومت کسب شده کمتر از حد مجاز رده طراحی است. بررسی نتایج و تعیین تکلیف توسط مهندس ناظر الزامی است.'}
              </div>

              {/* QR Code Online Verification Box */}
              <div className="border border-black p-1 bg-white flex items-center gap-1.5 shrink-0 rounded">
                <QRCodeSVG value={verificationPayload} size={56} level="M" marginSize={1} />
                <div className="text-[8px] leading-tight text-center">
                  <span className="block font-bold text-emerald-800">اصالت دیجیتال</span>
                  <span className="font-mono text-slate-600">ISIRI-VERIFIED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Official Footnote */}
          <div className="border border-black p-1 mb-2 text-[9px] leading-relaxed bg-white">
            <strong>ملاحظات فنی:</strong> مقاومت فشاری نمونه‌های مکعبی طبق بند ۹-۱۵-۳ از مبحث نهم مقررات ملی ساختمان و استاندارد ملی ایران شماره ۳۲۰۱، با اعمال ضریب تبدیل استاندارد به مقاومت نظیر استوانه‌ای استاندارد (۱۵×۳۰ cm) تبدیل شده است.
          </div>

          {/* Signatures 3-Column Section */}
          <div className="border border-black divide-x divide-x-reverse divide-black grid grid-cols-3 text-center text-[9.5px] pt-1 pb-3">
            
            {/* Column 1: Supervising Body / دستگاه نظارت */}
            <div className="p-1 flex flex-col justify-between h-20">
              <span className="font-bold">دستگاه نظارت / ناظر هماهنگ‌کننده</span>
              <div className="text-[8.5px] text-slate-700">
                {customer?.supervisorEngineer || 'مهندس ناظر سازه'}
              </div>
              <div className="border-t border-dotted border-black pt-1 text-[8.5px] text-slate-600 flex justify-between px-2">
                <span>نام/امضاء/تاریخ:</span>
                <span>/ /</span>
              </div>
            </div>

            {/* Column 2: Laboratory Director / سرپرست و مسئول فنی آزمایشگاه */}
            <div className="p-1 flex flex-col justify-between h-20">
              <span className="font-bold">مسئول فنی و سرپرست آزمایشگاه بتن</span>
              <div className="text-[8.5px] text-slate-700 font-bold">
                {LAB_INFO.manager} (پروانه اشتغال: {toPersianDigits(LAB_INFO.licenseNo)})
              </div>
              <div className="border-t border-dotted border-black pt-1 text-[8.5px] text-slate-600 flex justify-between px-2">
                <span>نام/امضاء/مهر رسمی:</span>
                <span>/ /</span>
              </div>
            </div>

            {/* Column 3: Testing Technician / مسئول انجام آزمایش و جک */}
            <div className="p-1 flex flex-col justify-between h-20">
              <div className="flex items-center justify-around font-bold mb-0.5 text-[8.5px]">
                <span className="inline-flex items-center gap-1">مشاور ◯</span>
                <span className="inline-flex items-center gap-1">کارفرما ◉</span>
                <span className="inline-flex items-center gap-1">پیمانکار ◯</span>
              </div>
              <span className="font-bold">مسئول انجام آزمایش و بارگذاری</span>
              <div className="border-t border-dotted border-black pt-1 text-[8.5px] text-slate-600 flex justify-between px-2">
                <span>{header.inspectorName}</span>
                <span>/ /</span>
              </div>
            </div>

          </div>

          {/* Company Accreditation & Address Footer */}
          <div className="mt-1 pt-1 border-t border-black text-[8.5px] text-slate-800 flex flex-wrap items-center justify-between gap-1 leading-tight">
            <div>
              <strong>{LAB_INFO.name}</strong> • شماره ثبت: {toPersianDigits(LAB_INFO.registrationNo)} • پروانه اشتغال: {toPersianDigits(LAB_INFO.licenseNo)} ({LAB_INFO.licenseIssuer})
            </div>
            <div>
              نشانی: {LAB_INFO.address} | تلفن تماس: <span className="font-mono font-bold" dir="ltr">{toPersianDigits(LAB_INFO.phone)}</span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* EDITING INTERFACE FOR OPERATORS (Visible when in Edit Mode)              */}
        {/* ========================================================================= */}
        {activeMode === 'edit' && (
          <div className="no-print mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>ویرایش سریع داده‌های ورودی شیت (محاسبه آنی توسط موتور ریاضی و هوش مصنوعی)</span>
              </h4>
              {!readOnly && (
              <button
                onClick={handleAiSmartCalculate}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>محاسبه مجدد خودکار</span>
              </button>
              )}
            </div>

            {/* Header Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">نام پروژه:</label>
                <input
                  type="text"
                  value={header.projectName}
                  onChange={(e) => setHeader({ ...header, projectName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">کارفرما / خریدار:</label>
                <input
                  type="text"
                  value={header.client}
                  onChange={(e) => setHeader({ ...header, client: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">شماره آزمایش:</label>
                <input
                  type="text"
                  value={header.testNo}
                  onChange={(e) => setHeader({ ...header, testNo: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">محل تامین مصالح:</label>
                <input
                  type="text"
                  value={header.concreteSupplier}
                  onChange={(e) => setHeader({ ...header, concreteSupplier: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">نوع مصالح / رده بتن:</label>
                <input
                  type="text"
                  value={header.materialType}
                  onChange={(e) => setHeader({ ...header, materialType: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">تاریخ آزمایش (مثلاً ۱۴۰۳/۰۶/۲۸):</label>
                <input
                  type="text"
                  value={header.testDate}
                  onChange={(e) => setHeader({ ...header, testDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">شماره سریال گزارش:</label>
                <input
                  type="text"
                  value={header.serialNo}
                  onChange={(e) => setHeader({ ...header, serialNo: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">نوع قالب نمونه:</label>
                <select
                  value={header.moldType}
                  onChange={(e) => setHeader({ ...header, moldType: e.target.value as 'cubic' | 'cylindrical' })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                >
                  <option value="cubic">مکعبی ۱۵×۱۵×۱۵</option>
                  <option value="cylindrical">استوانه‌ای ۱۵×۳۰</option>
                </select>
              </div>
            </div>

            {/* Editable Specimens Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
              <table className="w-full text-xs text-center border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-e border-slate-200">کد نمونه</th>
                    <th className="p-2 border-e border-slate-200">عضو سازه‌ای</th>
                    <th className="p-2 border-e border-slate-200">سن (روز)</th>
                    <th className="p-2 border-e border-slate-200">اسلامپ (cm)</th>
                    <th className="p-2 border-e border-slate-200">وزن (kg)</th>
                    <th className="p-2 border-e border-slate-200">نیروی شکست جک (Kgf)</th>
                    <th className="p-2 border-e border-slate-200">مقاومت مکعبی</th>
                    <th className="p-2 border-e border-slate-200">مقاومت استوانه‌ای (محاسبه AI)</th>
                    <th className="p-2">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="p-1.5 border-e border-slate-200">
                        <input
                          type="text"
                          value={row.sampleNo}
                          onChange={(e) => handleCellChange(row.id, 'sampleNo', e.target.value)}
                          className="w-20 text-center border border-slate-200 rounded p-1.5 font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-e border-slate-200 font-sans">
                        <input
                          type="text"
                          value={row.member}
                          onChange={(e) => handleCellChange(row.id, 'member', e.target.value)}
                          className="w-48 text-start border border-slate-200 rounded p-1.5 font-medium"
                        />
                      </td>
                      <td className="p-1.5 border-e border-slate-200">
                        <select
                          value={row.ageDays}
                          onChange={(e) => handleCellChange(row.id, 'ageDays', Number(e.target.value))}
                          className="border border-slate-200 rounded p-1.5 font-bold"
                        >
                          <option value={7}>۷ روزه</option>
                          <option value={28}>۲۸ روزه</option>
                          <option value={90}>۹۰ روزه</option>
                        </select>
                      </td>
                      <td className="p-1.5 border-e border-slate-200">
                        <input
                          type="number"
                          value={row.slumpCm}
                          onChange={(e) => handleCellChange(row.id, 'slumpCm', Number(e.target.value))}
                          className="w-14 text-center border border-slate-200 rounded p-1.5"
                        />
                      </td>
                      <td className="p-1.5 border-e border-slate-200">
                        <input
                          type="number"
                          step="0.001"
                          value={row.weightKg}
                          onChange={(e) => handleCellChange(row.id, 'weightKg', Number(e.target.value))}
                          className="w-20 text-center border border-slate-200 rounded p-1.5 font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-e border-slate-200">
                        <input
                          type="number"
                          step="50"
                          value={row.breakingLoadKgf}
                          onChange={(e) => handleCellChange(row.id, 'breakingLoadKgf', Number(e.target.value))}
                          className="w-24 text-center border border-blue-400 bg-blue-50/50 rounded p-1.5 font-bold text-blue-900"
                        />
                      </td>
                      <td className="p-1.5 border-e border-slate-200 font-bold text-slate-900">
                        {toPersianDigits(row.cubeStrengthKgCm2)} Kg/cm²
                      </td>
                      <td className="p-1.5 border-e border-slate-200 font-black text-blue-700">
                        {toPersianDigits(row.cylStrengthKgCm2)} Kg/cm²
                      </td>
                      <td className="p-1.5">
                        {!readOnly && rows.length > 1 ? (
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            title="حذف این نمونه"
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!readOnly && (
              <div className="flex justify-start pt-1">
                <button
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>افزودن ردیف نمونه جدید</span>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveMode('preview')}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                ثبت تغییرات و مشاهده پیش‌نمایش پرینت
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
