import React, { useState } from 'react';
import { labDb } from '../../services/supabase';
import { getTodayJalali, formatJalali, toPersianDigits } from '../../utils/jalali';
import { Download, Printer, FileSpreadsheet, CheckCircle2, FileText, Calendar, Building2, X, Table, Sparkles } from 'lucide-react';
import { downloadBlob, printOnlyElement } from '../../utils/printDom';
import { PrintStandardSheetModal } from '../common/PrintStandardSheetModal';

export const OperatorReports: React.FC = () => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showStandardExcelModal, setShowStandardExcelModal] = useState(false);
  const reports = labDb.getReports();
  const todayJalali = formatJalali(getTodayJalali());

  const handleExportCsv = () => {
    const headers = [
      'شماره گزارش',
      'کارفرما',
      'نام پروژه',
      'محل نمونه‌گیری',
      'رده بتن',
      'مقاومت هدف (MPa)',
      'نوع قالب',
      'اسلامپ (mm)',
      'نسبت W/C',
      'تاریخ نمونه‌گیری',
      'بار شکست ۷ روزه (kN)',
      'مقاومت ۷ روزه (MPa)',
      'بار شکست ۲۸ روزه (kN)',
      'مقاومت ۲۸ روزه (MPa)',
      'وضعیت نهایی'
    ];

    const rows = reports.map(r => [
      r.reportNo || r.id,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.projectName.replace(/"/g, '""')}"`,
      `"${r.sampleLocation.replace(/"/g, '""')}"`,
      r.concreteGrade,
      r.targetStrengthMpa,
      r.moldType === 'cube_150' ? 'مکعبی ۱۵' : 'استوانه‌ای',
      r.slumpMm,
      r.waterCementRatio,
      r.samplingDateJalali,
      r.breaking7dLoadKn || '',
      r.breaking7dStrengthMpa || '',
      r.breaking28dLoadKn || '',
      r.breaking28dStrengthMpa || '',
      r.isPassed ? 'منطبق بر مشخصات' : r.status === 'approved' ? 'تایید شده' : 'در دست بررسی'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `BetonLab-Operator-Reports-${todayJalali.replace(/\//g, '-')}.csv`);

    setDownloadSuccess('فایل اکسل تمام شیت‌های آزمایشگاه با موفقیت دانلود شد.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleTriggerPrint = () => {
    // Print only the daily-sheet preview modal (toolbar is print:hidden)
    if (!printOnlyElement('daily-print-sheet-doc')) window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              مرکز خروجی گزارشات و شیت‌های آزمایشگاهی
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تولید خروجی‌های آماری، برگه ثبت عملیات روزانه دستگاه شکست بتن و پشتیبان‌گیری
            </p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-400">
            امروز: {toPersianDigits(todayJalali)}
          </span>
        </div>

        {downloadSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Excel Export Card */}
          <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition bg-slate-50/50 dark:bg-slate-950/40">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">خروجی اکسل کامل شیت‌ها</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                دانلود کلیه آزمایش‌های ثبت شده شامل مشخصات نمونه، بار شکست جک، اسلامپ و درصد انطباق.
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              className="w-full mt-auto py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              دانلود فایل اکسل (CSV UTF-8)
            </button>
          </div>

          {/* NEW: 21-Column Standard Excel Sheet Modal with AI */}
          <div className="p-6 rounded-3xl border-2 border-amber-300 dark:border-amber-700/60 flex flex-col items-center text-center gap-4 hover:border-amber-400 hover:shadow-lg transition bg-amber-50/40 dark:bg-amber-950/20 relative">
            <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3" />
              <span>محاسبات هوشمند AI</span>
            </span>
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Table className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">شیت ۲۱ ستونی استاندارد B.S. 1881</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                شیت جامع آزمایشگاهی با محاسبات و فرمول‌های خودکار، تبدیل مقاومت فشاری نمونه مکعبی و استوانه‌ای و پرینت استاندارد A4.
              </p>
            </div>
            <button
              onClick={() => setShowStandardExcelModal(true)}
              className="w-full mt-auto py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <Table className="w-4 h-4" />
              ورود به شیت استاندارد نتایج (AI)
            </button>
          </div>

          {/* Daily Print Sheet Card */}
          <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition bg-slate-50/50 dark:bg-slate-950/40">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">شیت روزانه ایستگاه جک بتن</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                چاپ برگه استاندارد آزمون جهت ثبت دستی بار گسیختگی و یادداشت‌های حین شکست نمونه‌ها.
              </p>
            </div>
            <button
              onClick={() => setShowPrintModal(true)}
              className="w-full mt-auto py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              پیش‌نمایش و چاپ شیت روزانه
            </button>
          </div>

          {/* Certified Reports Archive Card */}
          <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition bg-slate-50/50 dark:bg-slate-950/40">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">آمار انطباق کیفی بتن</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                بررسی نسبت نمونه‌های پذیرفته شده به مردود طبق ضوابط مبحث نهم مقررات ملی ساختمان.
              </p>
            </div>
            <div className="w-full mt-auto p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300">
              <span className="font-bold block">
                درصد انطباق: {Math.round((reports.filter(r => r.isPassed).length / (reports.length || 1)) * 100)}%
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {reports.filter(r => r.isPassed).length} نمونه منطبق از {reports.length} آزمایش کل
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Standard B.S. 1881 21-Column Sheet Modal */}
      {showStandardExcelModal && (
        <PrintStandardSheetModal
          report={reports[0]}
          customer={reports[0] ? labDb.getCustomers().find(c => c.id === reports[0].customerId) : undefined}
          onClose={() => setShowStandardExcelModal(false)}
        />
      )}

      {/* Printable Sheet Modal */}
      {showPrintModal && (
        <div id="daily-print-sheet-doc" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible text-slate-900 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <span className="font-bold text-sm text-slate-700">پیش‌نمایش شیت روزانه چاپ</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  چاپ نهایی
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="border-2 border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-base font-black">آزمایشگاه تخصصی کنترل کیفیت و مقاومت مصالح بتن</h1>
                  <p className="text-xs text-slate-600 mt-1">شیت ثبت عملیات آزمایش جک هیدرولیکی شکست نمونه‌های فشاری بتن</p>
                </div>
                <div className="text-left text-xs font-mono">
                  <div>تاریخ شیت: {toPersianDigits(todayJalali)}</div>
                  <div>شماره فرم: LAB-REG-1403</div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-slate-400 text-center">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 p-2">ردیف</th>
                    <th className="border border-slate-400 p-2">کد گزارش</th>
                    <th className="border border-slate-400 p-2">کارفرما و پروژه</th>
                    <th className="border border-slate-400 p-2">رده بتن</th>
                    <th className="border border-slate-400 p-2">سن نمونه</th>
                    <th className="border border-slate-400 p-2">بار شکست (kN)</th>
                    <th className="border border-slate-400 p-2">مقاومت (MPa)</th>
                    <th className="border border-slate-400 p-2">امضا اپراتور</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 8).map((r, i) => (
                    <tr key={r.id}>
                      <td className="border border-slate-400 p-2 font-mono">{i + 1}</td>
                      <td className="border border-slate-400 p-2 font-mono">{r.reportNo || r.id}</td>
                      <td className="border border-slate-400 p-2 text-right">{r.customerName} - {r.projectName}</td>
                      <td className="border border-slate-400 p-2 font-mono">{r.concreteGrade}</td>
                      <td className="border border-slate-400 p-2">{r.breaking28dStrengthMpa ? '۲۸ روزه' : '۷ روزه'}</td>
                      <td className="border border-slate-400 p-2 font-mono">{r.breaking28dLoadKn || r.breaking7dLoadKn || '____'}</td>
                      <td className="border border-slate-400 p-2 font-mono">{r.breaking28dStrengthMpa || r.breaking7dStrengthMpa || '____'}</td>
                      <td className="border border-slate-400 p-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center pt-4 text-xs">
                <div>تکنسین مسئول آزمون: __________________</div>
                <div>تایید مدیر فنی آزمایشگاه: __________________</div>
                <div>مهر و امضای آزمایشگاه: __________________</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
