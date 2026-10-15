import React from 'react';
import { TestReport, Customer } from '../../types';
import { toPersianDigits } from '../../utils/jalali';
import { 
  X, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  FlaskConical, 
  Calendar, 
  Layers, 
  Gauge, 
  Building2, 
  MapPin, 
  User, 
  Check, 
  Lock,
  Thermometer,
  Waves,
  Scale
} from 'lucide-react';

interface CustomerTestDetailModalProps {
  report: TestReport;
  customer?: Customer;
  isLocked?: boolean;
  onClose: () => void;
  onOpenCertificate: () => void;
  onOpenStandardSheet?: () => void;
  onSettleDebt?: () => void;
}

export const CustomerTestDetailModal: React.FC<CustomerTestDetailModalProps> = ({
  report,
  customer,
  isLocked = false,
  onClose,
  onOpenCertificate,
  onOpenStandardSheet,
  onSettleDebt
}) => {
  const is28Ready = !!report.breaking28dStrengthMpa;
  const is7Ready = !!report.breaking7dStrengthMpa;
  const targetMpa = report.targetStrengthMpa || 25;
  const pct28 = is28Ready ? Math.round((report.breaking28dStrengthMpa! / targetMpa) * 100) : 0;
  const pct7 = is7Ready ? Math.round((report.breaking7dStrengthMpa! / targetMpa) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto flex flex-col">
        
        {/* Header Bar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  کارنامه و ریز نتایج آزمایش بتن
                </h3>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {report.reportNo || report.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {report.projectName} • {report.sampleLocation}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {/* Financial Lock Warning if locked */}
          {isLocked && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold block">محدودیت دسترسی به علت صورت‌حساب معوق</span>
                  <span className="text-[11px] opacity-80">ریز تنش‌های شکست و دانلود گواهینامه معتبر منوط به تسویه بدهی مالی پرونده می‌باشد.</span>
                </div>
              </div>
              {onSettleDebt && (
                <button
                  onClick={onSettleDebt}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 transition"
                >
                  درخواست تسویه به مدیر
                </button>
              )}
            </div>
          )}

          {/* Project & Specimen Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] block">رده مقاومتی مشخصه:</span>
              <span className="font-mono font-black text-sm text-slate-800 dark:text-white mt-1 block">
                {report.concreteGrade} ({toPersianDigits(targetMpa)} MPa)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] block">نوع قالب استاندارد:</span>
              <span className="font-bold text-xs text-slate-800 dark:text-white mt-1 block">
                {report.moldType === 'cube_150' ? 'مکعبی ۱۵×۱۵×۱۵ سانتیمتر' : 'استوانه‌ای ۱۵×۳۰ سانتیمتر'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] block">تاریخ نمونه‌برداری:</span>
              <span className="font-mono font-bold text-xs text-slate-800 dark:text-white mt-1 block">
                {toPersianDigits(report.samplingDateJalali)} ({report.samplingTime || '۱۰:۰۰'})
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] block">وضعیت تطابق مبحث ۹:</span>
              <div className="mt-1">
                {report.status === 'approved' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> تایید و منطبق
                  </span>
                ) : report.status === 'pending' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 text-xs">
                    <Clock className="w-3.5 h-3.5" /> در حال آزمایش
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> عدم انطباق
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Concrete Strength Test Breakdown (7d & 28d) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-950 dark:to-blue-950/20 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <span>نتایج مقاومت فشاری نمونه‌های بتن (جک کالیبره)</span>
              </h4>
              <span className="text-xs text-slate-500">
                دستگاه آزمایش: جک فشاری ۲۰۰۰ کیلونیوتنی کالیبره
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 7-Day Specimen Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">آزمون ۷ روزه (پیش‌بینی مقاومت)</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">سن: ۷ روز تقویمی</span>
                </div>

                {isLocked ? (
                  <div className="p-4 text-center text-slate-400 font-bold text-xs space-y-1">
                    <Lock className="w-6 h-6 mx-auto text-amber-500" />
                    <span>مقادیر بار و مقاومت ۷ روزه قفل می‌باشد</span>
                  </div>
                ) : is7Ready ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">نیروی گسیختگی نهایی:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">
                        {toPersianDigits(report.breaking7dLoadKn || Math.round(report.breaking7dStrengthMpa! * 22.5))} kN
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">مقاومت فشاری محاسبه‌شده:</span>
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                        {toPersianDigits(report.breaking7dStrengthMpa!)} MPa
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">درصد تحقق نسبت به رده هدف:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {toPersianDigits(pct7)}%
                      </span>
                    </div>

                    {report.breakDate7dJalali && (
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>تاریخ شکست در آزمایشگاه:</span>
                        <span className="font-mono">{toPersianDigits(report.breakDate7dJalali)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>نمونه در حوضچه کیورینگ (هنوز به سن ۷ روز نرسیده)</span>
                  </div>
                )}
              </div>

              {/* 28-Day Specimen Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">آزمون ۲۸ روزه (مقاومت نهایی طراحی)</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">سن: ۲۸ روز تقویمی</span>
                </div>

                {isLocked ? (
                  <div className="p-4 text-center text-slate-400 font-bold text-xs space-y-1">
                    <Lock className="w-6 h-6 mx-auto text-amber-500" />
                    <span>مقادیر بار و مقاومت ۲۸ روزه قفل می‌باشد</span>
                  </div>
                ) : is28Ready ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">نیروی گسیختگی نهایی:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">
                        {toPersianDigits(report.breaking28dLoadKn || Math.round(report.breaking28dStrengthMpa! * 22.5))} kN
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">مقاومت فشاری ۲۸ روزه:</span>
                      <span className={`font-mono font-black text-sm ${report.breaking28dStrengthMpa! >= targetMpa ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {toPersianDigits(report.breaking28dStrengthMpa!)} MPa
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">درصد انطباق با رده مشخصه:</span>
                      <span className={`font-mono font-bold ${pct28 >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {toPersianDigits(pct28)}%
                      </span>
                    </div>

                    {report.breakDate28dJalali && (
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>تاریخ شکست در آزمایشگاه:</span>
                        <span className="font-mono">{toPersianDigits(report.breakDate28dJalali)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>نمونه‌ها در شرایط استاندارد حوضچه آب‌آهک در حال عمل‌آوری می‌باشند</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Technical Concrete & Sampling Parameters */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-500" />
              <span>مشخصات فنی و شرایط نمونه‌برداری کارگاهی</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">روانی بتن (اسلامپ):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 block">
                  {toPersianDigits(report.slumpMm || 90)} mm
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">نسبت آب به سیمان (W/C):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 block">
                  {report.waterCementRatio || '0.45'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">نوع سیمان مصرفی:</span>
                <span className="font-medium text-slate-800 dark:text-white mt-0.5 block truncate">
                  {report.cementType || 'سیمان تیپ ۲'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">شماره تراک / بچینگ:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 block">
                  {report.truckBatchNo || 'TRK-01'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">روش و شرایط عمل‌آوری:</span>
                <span className="font-medium text-slate-800 dark:text-white mt-0.5 block truncate">
                  {report.curingMethod || 'حوضچه آب‌آهک استاندارد ۲۳ درجه'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">وزن مخصوص بتن سخت‌شده:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white mt-0.5 block">
                  {toPersianDigits(report.densityKgM3 || 2380)} kg/m³
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">تکنسین آزمایشگاه:</span>
                <span className="font-medium text-slate-800 dark:text-white mt-0.5 block truncate">
                  {report.operatorName || 'تکنسین فنی'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">مدیر فنی آزمایشگاه:</span>
                <span className="font-medium text-slate-800 dark:text-white mt-0.5 block truncate">
                  {report.approvedByName || 'مهندس صالح صادقی نیا'}
                </span>
              </div>
            </div>
          </div>

          {/* Technical Approval / Conclusion Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>نتیجه‌گیری و تطابق با استانداردهای ملی ساختمان (مبحث نهم):</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {report.approvalNotes || (
                report.status === 'approved' 
                  ? `نمونه‌های آزمایش‌شده در سن ۲۸ روز به مقاومت فشاری ${report.breaking28dStrengthMpa || 30} مگاپاسکال دست یافته‌اند که برابر با رده مقاومتی ${report.concreteGrade} بوده و با ضوابط پذیرش بتن سازه‌ای مبحث ۹ مقررات ملی ایران مطابقت کامل دارد.`
                  : report.status === 'pending'
                    ? 'نمونه‌ها در شرایط استاندارد نگهداری شده و پس از تکمیل دوره ۲۸ روزه عمل‌آوری، آزمون بارگذاری فشاری انجام و نتیجه اعلام خواهد گردید.'
                    : 'مقاومت ۲۸ روزه کمتر از رده مشخصه طراحی می‌باشد. جهت تعیین تکلیف عضو سازه‌ای، هماهنگی با مهندس ناظر و آزمایش‌های تکمیلی مانند چکش اشمیت یا مغزه‌گیری (کرگیری) توصیه می‌شود.'
              )}
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            بستن پنجره
          </button>

          <div className="flex items-center gap-2.5">
            {isLocked ? (
              <button
                onClick={() => {
                  onClose();
                  if (onSettleDebt) onSettleDebt();
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>درخواست تسویه حساب به مدیر جهت آزادسازی</span>
              </button>
            ) : (
              <>
                {onOpenStandardSheet && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStandardSheet();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                    title="مشاهده، چاپ و دانلود شیت استاندارد مقاومت بتن (ISIRI 3201)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>شیت رسمی شکست بتن (ISIRI 3201)</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onClose();
                    onOpenCertificate();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>گواهینامه رسمی با QR Code</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
