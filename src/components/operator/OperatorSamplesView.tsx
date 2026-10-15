import React, { useState } from 'react';
import { TestReport, Customer, UserProfile } from '../../types';
import { 
  getTodayJalali, 
  formatJalali, 
  toPersianDigits, 
  parseJalali, 
  addDaysToJalali,
  jalaliToGregorian 
} from '../../utils/jalali';
import { printOnlyElement } from '../../utils/printDom';
import { 
  Boxes, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Search, 
  Filter, 
  Scale, 
  Thermometer, 
  Droplets, 
  Waves, 
  Eye, 
  PenTool, 
  Printer, 
  Sparkles,
  Info,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { OperatorResultModal } from './OperatorResultModal';
import { PrintCertificate } from '../common/PrintCertificate';

interface OperatorSamplesViewProps {
  reports: TestReport[];
  customers: Customer[];
  currentUser?: UserProfile;
  onRefresh?: () => void;
}

export const OperatorSamplesView: React.FC<OperatorSamplesViewProps> = ({
  reports,
  customers,
  currentUser,
  onRefresh
}) => {
  const todayJalali = formatJalali(getTodayJalali());
  const today = getTodayJalali();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'due_today' | 'pending_7d' | 'pending_28d' | 'completed'>('all');
  const [selectedForEntry, setSelectedForEntry] = useState<TestReport | null>(null);
  const [selectedForPreview, setSelectedForPreview] = useState<TestReport | null>(null);
  const [specimenLabelModal, setSpecimenLabelModal] = useState<TestReport | null>(null);

  // Helper: calculate days elapsed between sample date and today
  const calculateAgeDays = (sampleDateStr: string): number => {
    const parsed = parseJalali(sampleDateStr);
    if (!parsed) return 0;
    try {
      const gSample = jalaliToGregorian(parsed.jy, parsed.jm, parsed.jd);
      const gToday = jalaliToGregorian(today.jy, today.jm, today.jd);
      const d1 = new Date(gSample.gy, gSample.gm - 1, gSample.gd);
      const d2 = new Date(gToday.gy, gToday.gm - 1, gToday.gd);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  // Helper: calculate expected 7-day and 28-day break dates
  const getExpectedDates = (sampleDateStr: string) => {
    const parsed = parseJalali(sampleDateStr);
    if (!parsed) return { d7: todayJalali, d28: todayJalali };
    const d7 = formatJalali(addDaysToJalali(parsed, 7));
    const d28 = formatJalali(addDaysToJalali(parsed, 28));
    return { d7, d28 };
  };

  // Check if specimen is due today for 7d or 28d
  const isDue7dToday = (r: TestReport) => {
    if (r.breaking7dStrengthMpa) return false;
    const { d7 } = getExpectedDates(r.samplingDateJalali);
    return d7 === todayJalali || r.breakDate7dJalali === todayJalali;
  };

  const isDue28dToday = (r: TestReport) => {
    if (r.breaking28dStrengthMpa) return false;
    const { d28 } = getExpectedDates(r.samplingDateJalali);
    return d28 === todayJalali || r.breakDate28dJalali === todayJalali;
  };

  // Filtered samples
  const samples = reports.filter(r => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (r.reportNo || '').toLowerCase().includes(search) ||
      (r.projectName || '').toLowerCase().includes(search) ||
      (r.customerName || '').toLowerCase().includes(search) ||
      (r.sampleLocation || '').toLowerCase().includes(search);

    if (!matchesSearch) return false;

    const age = calculateAgeDays(r.samplingDateJalali);
    const has7d = !!r.breaking7dStrengthMpa;
    const has28d = !!r.breaking28dStrengthMpa;

    if (filterMode === 'due_today') {
      return isDue7dToday(r) || isDue28dToday(r);
    }
    if (filterMode === 'pending_7d') {
      return !has7d;
    }
    if (filterMode === 'pending_28d') {
      return !has28d;
    }
    if (filterMode === 'completed') {
      return has28d;
    }
    return true;
  });

  // Overview Stats
  const inBasinCount = reports.filter(r => !r.breaking28dStrengthMpa).length;
  const dueTodayCount = reports.filter(r => isDue7dToday(r) || isDue28dToday(r)).length;
  const pending7dCount = reports.filter(r => !r.breaking7dStrengthMpa).length;
  const completedCount = reports.filter(r => !!r.breaking28dStrengthMpa).length;

  const getCustomerForReport = (report: TestReport) => {
    return customers.find(c => c.id === report.customerId);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <span>مدیریت حوضچه کیورینگ و آزمونه‌های بتن</span>
                <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono">
                  ASTM C511 / ISIRI 3201
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                رهگیری سن دقیق آزمونه‌ها، پایش شرایط حوضچه عمل‌آوری استاندارد و موعد شکست نمونه‌های ۷ و ۲۸ روزه
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">
              امروز: {toPersianDigits(todayJalali)}
            </span>
          </div>
        </div>
      </div>

      {/* Curing Basin Environmental Status & Quick Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Basin Water Temp */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">دمای آب حوضچه کیورینگ</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">۲۳.۲</span>
              <span className="text-xs text-slate-500 font-mono">°C</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              محدوده مجاز (۲±۲۳°C)
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center">
            <Thermometer className="w-6 h-6" />
          </div>
        </div>

        {/* Lime Saturation */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">محلول آب‌آهک اشباع</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">12.4</span>
              <span className="text-xs text-slate-500 font-mono">pH</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              اشباع کامل Ca(OH)2
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Droplets className="w-6 h-6" />
          </div>
        </div>

        {/* Samples in Curing Tank */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">آزمونه‌های در حال عمل‌آوری</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-blue-600 font-mono">{toPersianDigits(inBasinCount)}</span>
              <span className="text-xs text-slate-500">سری نمونه</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {toPersianDigits(pending7dCount)} نمونه در انتظار شکست ۷ روزه
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Due Today Action Alert */}
        <div className={`rounded-2xl border p-5 shadow-xs flex items-center justify-between transition ${
          dueTodayCount > 0 
            ? 'bg-amber-500/10 border-amber-500/40 dark:border-amber-500/30' 
            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <div>
            <span className="text-xs text-slate-500 font-medium block">موعد شکست امروز</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black font-mono ${dueTodayCount > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}`}>
                {toPersianDigits(dueTodayCount)}
              </span>
              <span className="text-xs text-slate-500">نمونه</span>
            </div>
            <span className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${dueTodayCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
              {dueTodayCount > 0 ? 'نیازمند بارگذاری جک هیدرولیک' : 'آزمونی برای امروز نمانده'}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${dueTodayCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            <Scale className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${filterMode === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            همه آزمونه‌ها ({toPersianDigits(reports.length)})
          </button>
          <button
            onClick={() => setFilterMode('due_today')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${filterMode === 'due_today' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>موعد امروز ({toPersianDigits(dueTodayCount)})</span>
          </button>
          <button
            onClick={() => setFilterMode('pending_7d')}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${filterMode === 'pending_7d' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            در انتظار ۷ روزه ({toPersianDigits(pending7dCount)})
          </button>
          <button
            onClick={() => setFilterMode('pending_28d')}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${filterMode === 'pending_28d' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            در انتظار ۲۸ روزه ({toPersianDigits(inBasinCount)})
          </button>
          <button
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${filterMode === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            تکمیل شده ({toPersianDigits(completedCount)})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="جستجوی کد نمونه، پروژه یا کارفرما..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {/* Specimens Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-right text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="p-4 font-bold">شناسه و کد نمونه</th>
                <th className="p-4 font-bold">کارفرما و نام پروژه</th>
                <th className="p-4 font-bold">رده و قالب</th>
                <th className="p-4 font-bold">تاریخ قالب‌گیری و سن</th>
                <th className="p-4 font-bold">برنامه شکست ۷ روزه</th>
                <th className="p-4 font-bold">برنامه شکست ۲۸ روزه</th>
                <th className="p-4 font-bold text-center">عملیات اپراتور</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {samples.length > 0 ? (
                samples.map(r => {
                  const age = calculateAgeDays(r.samplingDateJalali);
                  const { d7, d28 } = getExpectedDates(r.samplingDateJalali);
                  const is7Done = !!r.breaking7dStrengthMpa;
                  const is28Done = !!r.breaking28dStrengthMpa;
                  const is7DueToday = isDue7dToday(r);
                  const is28DueToday = isDue28dToday(r);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      {/* Report ID */}
                      <td className="p-4">
                        <div className="font-mono font-bold text-blue-600 text-xs">
                          {r.reportNo || r.id}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[150px]" title={r.sampleLocation}>
                          {r.sampleLocation}
                        </span>
                      </td>

                      {/* Customer & Project */}
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {r.customerName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {r.projectName}
                        </div>
                      </td>

                      {/* Grade & Mold */}
                      <td className="p-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {r.concreteGrade} ({r.targetStrengthMpa} MPa)
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">
                          {r.moldType === 'cube_150' ? 'مکعبی ۱۵×۱۵' : 'استوانه‌ای ۱۵×۳۰'}
                        </span>
                      </td>

                      {/* Age & Sampling Date */}
                      <td className="p-4">
                        <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                          {toPersianDigits(r.samplingDateJalali)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>سن: {toPersianDigits(age)} روز</span>
                          </span>
                        </div>
                      </td>

                      {/* 7-Day Break Schedule */}
                      <td className="p-4 font-mono text-xs">
                        {is7Done ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{toPersianDigits(r.breaking7dStrengthMpa!)} MPa</span>
                          </div>
                        ) : is7DueToday ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px] animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>موعد امروز ({toPersianDigits(d7)})</span>
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            <span>{toPersianDigits(d7)}</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">در حوضچه</span>
                          </div>
                        )}
                      </td>

                      {/* 28-Day Break Schedule */}
                      <td className="p-4 font-mono text-xs">
                        {is28Done ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{toPersianDigits(r.breaking28dStrengthMpa!)} MPa</span>
                          </div>
                        ) : is28DueToday ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>موعد امروز ۲۸ روزه</span>
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            <span>{toPersianDigits(d28)}</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">در حوضچه</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Specimen Tag/Label button */}
                          <button
                            onClick={() => setSpecimenLabelModal(r)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200 transition"
                            title="مشاهده و چاپ برچسب الصاقی نمونه"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Preview Certificate */}
                          <button
                            onClick={() => setSelectedForPreview(r)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200 transition"
                            title="مشاهده شیت آزمون"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Enter Break Results */}
                          <button
                            onClick={() => setSelectedForEntry(r)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                            title="خروج از حوضچه و ثبت بار گسیختگی جک"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>ثبت بار شکست</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 text-sm">
                    هیچ نمونه‌ای با شرایط فیلتر در حوضچه یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Specimen Label Print Modal */}
      {specimenLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b pb-3">
              <span className="font-bold text-sm">شناسنامه الصاقی قالب / آزمونه بتن</span>
              <button
                onClick={() => setSpecimenLabelModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                بستن
              </button>
            </div>

            <div id="specimen-label-print-doc" className="border-2 border-dashed border-slate-400 p-5 rounded-2xl space-y-3 bg-slate-50 text-xs">
              <div className="text-center pb-2 border-b border-slate-300">
                <div className="font-black text-sm text-slate-900">آزما بتن پایش خاک و پی جهان بین</div>
                <div className="text-[10px] text-slate-500 mt-0.5">برچسب شناسنامه آزمونه کنترل کیفیت بتن</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">شماره پذیرش:</span>
                  <span className="font-mono font-bold text-blue-600 block text-xs">
                    {specimenLabelModal.reportNo || specimenLabelModal.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">رده بتن مشخصه:</span>
                  <span className="font-mono font-bold block">{specimenLabelModal.concreteGrade}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">کارفرما:</span>
                  <span className="font-bold block truncate">{specimenLabelModal.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">پروژه:</span>
                  <span className="font-bold block truncate">{specimenLabelModal.projectName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاریخ نمونه‌گیری:</span>
                  <span className="font-mono font-bold block">{toPersianDigits(specimenLabelModal.samplingDateJalali)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">نوع قالب:</span>
                  <span className="font-bold block">{specimenLabelModal.moldType === 'cube_150' ? 'مکعبی ۱۵' : 'استوانه‌ای'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">محل بتن‌ریزی:</span>
                  <span className="font-medium block truncate">{specimenLabelModal.sampleLocation}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">موعد ۷ روزه:</span>
                  <span className="font-mono font-bold text-blue-700 block">
                    {toPersianDigits(getExpectedDates(specimenLabelModal.samplingDateJalali).d7)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">موعد ۲۸ روزه:</span>
                  <span className="font-mono font-bold text-emerald-700 block">
                    {toPersianDigits(getExpectedDates(specimenLabelModal.samplingDateJalali).d28)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-300 text-center text-[10px] text-slate-400">
                نگهداری در حوضچه آب‌آهک استاندارد ۲۳±۲ درجه سانتی‌گراد
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { if (!printOnlyElement('specimen-label-print-doc')) window.print(); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ لیبل</span>
              </button>
              <button
                onClick={() => setSpecimenLabelModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break Test Entry Modal */}
      {selectedForEntry && (
        <OperatorResultModal
          report={selectedForEntry}
          currentUser={currentUser}
          onClose={() => setSelectedForEntry(null)}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Certificate / Specimen Sheet Preview Modal */}
      {selectedForPreview && (
        <PrintCertificate
          report={selectedForPreview}
          customer={getCustomerForReport(selectedForPreview)}
          onClose={() => setSelectedForPreview(null)}
        />
      )}
    </div>
  );
};
