import React, { useEffect, useState } from 'react';
import { TestReport, Customer } from '../../types';
import { toPersianDigits } from '../../utils/jalali';
import { LAB_INFO } from '../../services/supabase';
import { CompanyLogo } from './CompanyLogo';
import { PrintStandardSheetModal } from './PrintStandardSheetModal';
import { 
  Building2, 
  CheckCircle, 
  XCircle, 
  Printer, 
  Download, 
  X, 
  QrCode, 
  ShieldCheck, 
  FileSpreadsheet,
  Award,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Table
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';
import { printOnlyElement } from '../../utils/printDom';

// Print only the certificate document; fall back to full page print.
const printCertificate = () => {
  if (!printOnlyElement('certificate-print-area')) window.print();
};

interface PrintCertificateProps {
  report: TestReport;
  customer?: Customer;
  onClose: () => void;
  readOnly?: boolean;
}

export const PrintCertificate: React.FC<PrintCertificateProps> = ({
  report,
  customer,
  onClose,
  readOnly = false
}) => {
  const [showStandardSheet, setShowStandardSheet] = useState(false);

  useModalBack(true, onClose, 'print-certificate-modal');
  useModalBack(showStandardSheet, () => setShowStandardSheet(false), 'print-cert-child-sheet');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    printCertificate();
  };

  // Real PDF download for the certificate (with graceful print fallback)
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const { downloadContractPdf } = await import('../../utils/contractPdfGenerator');
      const ok = await downloadContractPdf('certificate-print-area', `Gvahinameh-${report.reportNo || report.id || 'lab'}.pdf`);
      if (!ok) {
        // Generator failed / timed out: open exactly ONE controlled print dialog.
        printCertificate();
      }
    } catch (err) {
      console.warn('Certificate PDF fallback to print:', err);
      printCertificate();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isPassed = report.isPassed ?? ((report.breaking28dStrengthMpa || 0) >= report.targetStrengthMpa);
  const percentAchieved = report.breaking28dStrengthMpa 
    ? Math.round((report.breaking28dStrengthMpa / report.targetStrengthMpa) * 100) 
    : (report.breaking7dStrengthMpa ? Math.round((report.breaking7dStrengthMpa / (report.targetStrengthMpa * 0.68)) * 100) : 0);

  if (showStandardSheet) {
    return (
      <PrintStandardSheetModal
        onClose={() => setShowStandardSheet(false)}
        report={report}
        customer={customer}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      
      {/* Fixed Top-Start Back Button */}
      <button
        onClick={onClose}
        className="fixed top-4 start-4 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/95 text-white hover:bg-slate-800 border border-slate-700 shadow-2xl font-bold text-xs backdrop-blur-md transition no-print active:scale-95 cursor-pointer"
        title="بازگشت به پرتال"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-400" />
        <span>بازگشت (ESC)</span>
      </button>

      {/* Top Floating Control Bar (Hidden on print) */}
      <div className="fixed top-4 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 no-print">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-md transition text-white active:scale-95"
          title="بازگشت به پرتال (ESC)"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          <span>بازگشت به پرتال</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={() => setShowStandardSheet(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition active:scale-95"
          title="نمایش شیت استاندارد نتایج آزمایش با هوش مصنوعی"
        >
          <Table className="w-3.5 h-3.5" />
          <span>شیت استاندارد نتایج آزمایش (B.S.1881)</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-md transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>چاپ A4</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold text-xs shadow-md transition cursor-pointer"
        >
          {isExportingPdf ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isExportingPdf ? 'در حال تولید PDF...' : 'دانلود PDF'}</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fixed Prominent Top-Start Back Button */}
      <button
        onClick={onClose}
        className="fixed top-4 start-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 text-white hover:bg-slate-800 border border-slate-700 shadow-xl font-bold text-xs backdrop-blur-md transition no-print"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-400" />
        <span className="hidden sm:inline">بازگشت (ESC)</span>
        <span className="sm:hidden">بازگشت</span>
      </button>

      {/* A4 Document Paper Container */}
      <div id="certificate-print-area" className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-card my-14 print:my-0 print:border-none print:shadow-none p-6 sm:p-10 font-sans">
        
        {/* Certificate Border & Header */}
        <div className="border-4 border-double border-slate-800 p-6 rounded-lg relative">
          
          {/* Top ISO & National Standard Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6">
            <div className="text-start">
              <div className="flex items-center gap-2 text-slate-800">
                <CompanyLogo className="w-12 h-12 rounded-lg" iconClassName="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {LAB_INFO.name}
                  </h1>
                  <p className="text-[11px] text-slate-700 font-semibold">
                    شماره ثبت: {toPersianDigits(LAB_INFO.registrationNo)} • پروانه اشتغال به کار خدمات فنی آزمایشگاهی: {toPersianDigits(LAB_INFO.licenseNo)} ({LAB_INFO.licenseIssuer})
                  </p>
                </div>
              </div>
            </div>

              <div className="text-center">
                <div className="inline-block px-3.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs font-black text-amber-900">
                  گواهینامه رسمی نتایج آزمایش بتن
                </div>
                <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                  «{LAB_INFO.slogan}»
                </p>
                <p className="text-[9px] text-slate-500 font-mono">
                  {LAB_INFO.englishSubtitle}
                </p>
              </div>

            <div className="text-end text-xs space-y-1">
              <div className="font-bold text-slate-900">
                شماره گزارش: <span className="font-mono text-blue-700">{report.reportNo}</span>
              </div>
              <div className="text-slate-600">
                تاریخ صدور: <span className="font-mono">{toPersianDigits(report.approvalDateJalali || report.samplingDateJalali)}</span>
              </div>
              <div className="text-slate-600 text-[10px]">
                استاندارد مرجع: ISIRI 3206 / ASTM C39
              </div>
            </div>
          </div>

          {/* Section 1: Customer & Project Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3.5 mb-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">کارفرما / شرکت متقاضی:</span>
              <strong className="text-slate-900">{report.customerName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">نام پروژه ساختمانی:</span>
              <strong className="text-slate-900">{report.projectName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">محل بتن‌ریزی و پارت:</span>
              <strong className="text-slate-900">{report.sampleLocation}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">رده مقاومتی درخواستی:</span>
              <strong className="text-blue-700 text-sm font-black">{report.concreteGrade} ({toPersianDigits(report.targetStrengthMpa)} MPa)</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">نوع و ابعاد قالب:</span>
              <strong className="text-slate-800">{report.moldType === 'cube_150' ? 'مکعبی ۱۵×۱۵×۱۵ سانتی‌متر' : 'استوانه‌ای ۱۵×۳۰ سانتی‌متر'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">محیط عمل‌آوری نمونه:</span>
              <strong className="text-slate-800">{report.curingMethod}</strong>
            </div>
          </div>

          {/* Section 2: Fresh Concrete Properties */}
          <div className="grid grid-cols-6 gap-2 border border-slate-200 rounded-md p-3 mb-4 text-xs text-center bg-white">
            <div className="border-e border-slate-200">
              <span className="text-slate-500 text-[11px] block">تاریخ نمونه‌گیری</span>
              <strong className="text-slate-800 font-mono text-sm">{toPersianDigits(report.samplingDateJalali)}</strong>
            </div>
            <div className="border-e border-slate-200">
              <span className="text-slate-500 text-[11px] block">دمای بتن تازه</span>
              <strong className="text-slate-800 font-mono text-sm">{report.temperatureC ? `${toPersianDigits(report.temperatureC)} °C` : '-'}</strong>
            </div>
            <div className="border-e border-slate-200">
              <span className="text-slate-500 text-[11px] block">اسلامپ</span>
              <strong className="text-slate-800 font-mono text-sm">{toPersianDigits(report.slumpMm)} mm</strong>
            </div>
            <div className="border-e border-slate-200">
              <span className="text-slate-500 text-[11px] block">نسبت W/C</span>
              <strong className="text-slate-800 font-mono text-sm">{toPersianDigits(report.waterCementRatio)}</strong>
            </div>
            <div className="border-e border-slate-200">
              <span className="text-slate-500 text-[11px] block">وزن مخصوص (سخت شده)</span>
              <strong className="text-slate-800 font-mono text-sm">{report.densityKgM3 ? `${toPersianDigits(report.densityKgM3)} kg/m³` : '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">شماره تراک / بچ</span>
              <strong className="text-slate-800 font-mono text-sm">{report.truckBatchNo || '-'}</strong>
            </div>
          </div>

          {/* Section 3: Hardened Concrete Breaking Results Table */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              نتایج آزمایش جک هیدرولیکی مقاومت فشاری (Compressive Strength Test Results)
            </h3>

            <table className="w-full border-collapse border border-slate-300 text-xs text-center">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th className="border border-slate-300 p-2">سن نمونه</th>
                  <th className="border border-slate-300 p-2">تاریخ شکست</th>
                  <th className="border border-slate-300 p-2">سطح مقطع (cm²)</th>
                  <th className="border border-slate-300 p-2">بار نهایی گسیختگی (kN)</th>
                  <th className="border border-slate-300 p-2">مقاومت فشاری (MPa)</th>
                  <th className="border border-slate-300 p-2">درصد مقاومت مشخصه</th>
                  <th className="border border-slate-300 p-2">وضعیت انطباق</th>
                </tr>
              </thead>
              <tbody>
                {/* 7 Days Row */}
                <tr>
                  <td className="border border-slate-300 p-2 font-bold">۷ روزه</td>
                  <td className="border border-slate-300 p-2 font-mono">{toPersianDigits(report.breakDate7dJalali || '-')}</td>
                  <td className="border border-slate-300 p-2 font-mono">۲۲۵.۰</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-slate-800">
                    {report.breaking7dLoadKn ? toPersianDigits(report.breaking7dLoadKn) : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono font-black text-slate-900 text-sm">
                    {report.breaking7dStrengthMpa ? toPersianDigits(report.breaking7dStrengthMpa) : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono">
                    {report.breaking7dStrengthMpa 
                      ? `${toPersianDigits(Math.round((report.breaking7dStrengthMpa / report.targetStrengthMpa) * 100))}٪` 
                      : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-600 font-medium">
                    کنترل مقدماتی رشد هیدراسیون
                  </td>
                </tr>

                {/* 28 Days Row */}
                <tr className="bg-blue-50/40">
                  <td className="border border-slate-300 p-2 font-bold text-blue-950">۲۸ روزه (نهایی)</td>
                  <td className="border border-slate-300 p-2 font-mono">{toPersianDigits(report.breakDate28dJalali || '-')}</td>
                  <td className="border border-slate-300 p-2 font-mono">۲۲۵.۰</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-slate-800">
                    {report.breaking28dLoadKn ? toPersianDigits(report.breaking28dLoadKn) : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono font-black text-blue-900 text-base">
                    {report.breaking28dStrengthMpa ? toPersianDigits(report.breaking28dStrengthMpa) : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-blue-800">
                    {report.breaking28dStrengthMpa 
                      ? `${toPersianDigits(percentAchieved)}٪` 
                      : '-'}
                  </td>
                  <td className="border border-slate-300 p-2 font-bold">
                    {isPassed ? (
                      <span className="text-emerald-700 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        منطبق (PASS)
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center justify-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        عدم انطباق (FAIL)
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: Visual Strength Maturity Curve */}
          <div className="border border-slate-200 rounded-md p-3 mb-4 bg-slate-50/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800">منحنی رشد مقاومت در برابر مقاومت هدف ({report.concreteGrade})</span>
              <span className="font-mono text-[11px] text-slate-600">
                حداقل مجاز: {report.targetStrengthMpa} MPa | حاصل شده: {report.breaking28dStrengthMpa || report.breaking7dStrengthMpa || 0} MPa
              </span>
            </div>
            
            <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
              <div 
                className={`h-full rounded-full transition-all ${isPassed ? 'bg-gradient-to-r from-blue-600 to-emerald-500' : 'bg-gradient-to-r from-amber-500 to-rose-600'}`}
                style={{ width: `${Math.min(percentAchieved, 100)}%` }}
              />
            </div>
          </div>

          <div className="border border-slate-300 border-dashed rounded-md p-2.5 mb-4 text-[10px] text-slate-700 leading-relaxed bg-white">
            <strong className="block mb-1">الزامات شیوه نامه سازمان نظام مهندسی ساختمان:</strong>
            - طبق مبحث نهم مقررات ملی، حداقل تعداد نمونه برای این رده سازه، اخذ ۵ نمونه (۱ نمونه ۷ روزه، ۳ نمونه ۲۸ روزه و ۱ نمونه شاهد) می‌باشد.<br/>
            - نمونه شاهد بمدت ۹۰ روز پس از اخذ در آزمایشگاه نگهداری خواهد شد.<br/>
            - مقاومت فشاری ارائه شده بر اساس نمونه‌های استاندارد {report.moldType === 'cube_150' ? 'مکعبی' : 'استوانه‌ای'} می‌باشد.
          </div>

          {/* Section 5: Photographic Evidence Preview */}
          {report.photos && report.photos.length > 0 && (
            <div className="mb-4">
              <span className="text-[11px] font-bold text-slate-600 block mb-1">
                مستندات تصویری نمونه‌گیری و شکست در آزمایشگاه:
              </span>
              <div className="flex items-center gap-3">
                {report.photos.map((url, i) => (
                  <div key={i} className="w-24 h-16 rounded border border-slate-300 overflow-hidden bg-slate-100">
                    <img src={url} alt="Specimen" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Official Verdict & Signatures */}
          <div className="border-t-2 border-slate-800 pt-4 mt-4 grid grid-cols-3 items-end text-xs">
            
            {/* Operator Signature */}
            <div className="text-center">
              <p className="text-slate-500 text-[11px]">تکنسین آزمایشگاه:</p>
              <p className="font-bold text-slate-900 mt-1">{report.operatorName}</p>
              <div className="h-10 flex items-center justify-center text-slate-400 italic font-mono text-[11px]">
                [امضای دیجیتال اپراتور]
              </div>
            </div>

            {/* Official Verification Stamp */}
            <div className="text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-blue-800/80 flex flex-col items-center justify-center text-blue-900 p-1 rotate-[-6deg] bg-blue-50/50">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <span className="text-[9px] font-black uppercase">کنترل کیفیت تایید شد</span>
                <span className="text-[8px] font-mono">QC-CERTIFIED</span>
              </div>
            </div>

            {/* Technical Director Signature & QR Verification */}
            <div className="text-center flex flex-col items-center">
              <p className="text-slate-500 text-[11px]">مدیر فنی و کنترل کیفیت:</p>
              <p className="font-bold text-slate-900 mt-1">{report.approvedByName || LAB_INFO.manager}</p>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <QrCode className="w-8 h-8 text-slate-800" />
                <span className="text-[9px] text-slate-500 text-start leading-tight">
                  استعلام برخط اصالت<br />سامانه جامع بتن
                </span>
              </div>
            </div>

          </div>

          {/* Certificate Official Footer (Address, Phone & License) */}
          <div className="border-t border-slate-300 pt-2.5 mt-4 text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>نشانی آزمایشگاه:</strong> {LAB_INFO.address}
            </div>
            <div className="flex items-center gap-4">
              <div>
                <strong>تلفن تماس:</strong> <span className="font-mono font-bold text-slate-900" dir="ltr">{toPersianDigits(LAB_INFO.phone)}</span>
              </div>
              <div>
                <strong>موقعیت نقشه (GPS):</strong> <span className="font-mono text-blue-700">{LAB_INFO.coordinates.displayText}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Document Action Bar (Hidden on Print) */}
        <div className="no-print mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition active:scale-95"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-600" />
            <span>بازگشت به پرتال آزمایشگاه</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStandardSheet(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <Table className="w-4 h-4" />
              <span>شیت استاندارد نتایج آزمایش (B.S.1881)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ گواهینامه رسمی (A4)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
            >
              <Download className="w-4 h-4" />
              <span>ذخیره فایل PDF</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
