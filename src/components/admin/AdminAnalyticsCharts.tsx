import React, { useState } from 'react';
import { TestReport, Invoice, AccountingRecord } from '../../types';
import {
  toPersianDigits,
  parseJalali,
  getTodayJalali,
  jalaliToGregorian,
  addDaysToJalali,
  getDaysInJalaliMonth,
  getJalaliWeekday,
  WEEKDAYS_FA,
  JALALI_MONTH_NAMES_FA
} from '../../utils/jalali';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import {
  Activity,
  PieChart as PieIcon,
  FlaskConical,
  DollarSign
} from 'lucide-react';

interface AdminAnalyticsChartsProps {
  reports: TestReport[];
  invoices: Invoice[];
  accounting: AccountingRecord[];
  isDarkMode?: boolean;
}

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({
  reports,
  invoices,
  accounting,
  isDarkMode = false
}) => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');

  // ---- Real Jalali date-based aggregation helpers ----
  const toDayIndex = (jy: number, jm: number, jd: number): number => {
    const g = jalaliToGregorian(jy, jm, jd);
    return Math.floor(Date.UTC(g.gy, g.gm - 1, g.gd) / 86400000);
  };

  const jalaliStrToDayIndex = (jalaliStr?: string): number | null => {
    const parsed = parseJalali(jalaliStr || '');
    if (!parsed) return null;
    return toDayIndex(parsed.jy, parsed.jm, parsed.jd);
  };

  const todayJ = getTodayJalali();

  // Count reports per bucket using their REAL sampling dates
  const countReportsInRange = (fromIdx: number, toIdx: number) => {
    let tests = 0;
    let passed = 0;
    for (const r of reports) {
      const idx = jalaliStrToDayIndex(r.samplingDateJalali);
      if (idx === null) continue;
      if (idx >= fromIdx && idx <= toIdx) {
        tests++;
        if (r.isPassed || r.status === 'approved') passed++;
      }
    }
    return { tests, passed };
  };

  // 1. Dynamic Test Activity Trend Data - Strictly aggregated from real report sampling dates
  const getActivityData = () => {
    if (timeframe === 'week') {
      // Last 7 real days ending today, labeled with their true Persian weekday names
      return Array.from({ length: 7 }, (_, i) => {
        const j = addDaysToJalali(todayJ, -(6 - i));
        const idx = toDayIndex(j.jy, j.jm, j.jd);
        const wd = getJalaliWeekday(j.jy, j.jm, j.jd); // 0 = شنبه ... 6 = جمعه
        return { name: WEEKDAYS_FA[wd], ...countReportsInRange(idx, idx) };
      });
    }
    if (timeframe === 'month') {
      // Current Jalali month split into real weekly buckets (1-7, 8-14, 15-21, 22-end of month)
      const daysInMonth = getDaysInJalaliMonth(todayJ.jy, todayJ.jm);
      const weekStarts = [1, 8, 15, 22];
      return weekStarts.map((start, wi) => {
        const end = wi === 3 ? daysInMonth : start + 6;
        const fromIdx = toDayIndex(todayJ.jy, todayJ.jm, start);
        const toIdx = toDayIndex(todayJ.jy, todayJ.jm, end);
        return { name: `هفته ${toPersianDigits(wi + 1)}`, ...countReportsInRange(fromIdx, toIdx) };
      });
    }
    // Year: last 12 Jalali months ending in current month
    const result: { name: string; tests: number; passed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let jy = todayJ.jy;
      let jm = todayJ.jm - i;
      while (jm <= 0) { jm += 12; jy -= 1; }
      const firstIdx = toDayIndex(jy, jm, 1);
      const lastIdx = toDayIndex(jy, jm, getDaysInJalaliMonth(jy, jm));
      result.push({ name: JALALI_MONTH_NAMES_FA[jm - 1], ...countReportsInRange(firstIdx, lastIdx) });
    }
    return result;
  };

  // Real compliance rate derived from actual approved/passed reports
  const complianceRate = (() => {
    const decided = reports.filter(r => r.status !== 'pending');
    if (decided.length === 0) return null;
    const ok = decided.filter(r => r.isPassed).length;
    return Math.round((ok / decided.length) * 1000) / 10;
  })();

  // 2. Concrete Test Types Breakdown - Strictly from real data
  const compressiveCount = reports.filter(r => r.moldType === 'cube_150' || !r.moldType).length;
  const slumpCount = reports.filter(r => typeof r.slumpMm === 'number' && r.slumpMm > 0).length;
  const flexuralCount = reports.filter(r => r.moldType === 'cylinder_150_300').length;
  const ndtCount = reports.filter(r => (r as any).testType === 'ndt').length;

  const testTypeBreakdown = [
    { name: 'مقاومت فشاری مکعبی', value: compressiveCount, color: '#2563eb' },
    { name: 'اسلامپ و کارایی کارگاه', value: slumpCount, color: '#10b981' },
    { name: 'آزمون مغزه‌گیری و خمشی', value: flexuralCount, color: '#f59e0b' },
    { name: 'آزمون غیرمخرب چکش اشمیت', value: ndtCount, color: '#8b5cf6' },
  ];

  // 3. Concrete Strength Distribution vs Design Target - Strictly from real data (MPa)
  const strengthOf = (r: TestReport) => r.breaking28dStrengthMpa || 0;
  const strengthDistribution = [
    { range: 'زیر ۲۰ MPa', count: reports.filter(r => strengthOf(r) > 0 && strengthOf(r) < 20).length },
    { range: '۲۰ تا ۲۵', count: reports.filter(r => strengthOf(r) >= 20 && strengthOf(r) < 25).length },
    { range: '۲۵ تا ۳۰', count: reports.filter(r => strengthOf(r) >= 25 && strengthOf(r) < 30).length },
    { range: '۳۰ تا ۳۵', count: reports.filter(r => strengthOf(r) >= 30 && strengthOf(r) < 35).length },
    { range: 'بالای ۳۵ MPa', count: reports.filter(r => strengthOf(r) >= 35).length },
  ];
  const testedWithResult = reports.filter(r => strengthOf(r) > 0).length;
  const withinStandardCount = reports.filter(r => strengthOf(r) > 0 && strengthOf(r) >= (r.targetStrengthMpa || 0)).length;
  const withinStandardPct = testedWithResult > 0 ? Math.round((withinStandardCount / testedWithResult) * 100) : null;

  // 4. Financial Cashflow Overview - Strictly from real invoices, grouped by REAL issue dates
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
  const totalCollected = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.totalAmount || 0), 0);
  const totalPending = Math.max(0, totalInvoiced - totalCollected);

  const financialData = (() => {
    // Build the same 12-month window as the activity chart so both stay in sync
    const months: { jy: number; jm: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let jy = todayJ.jy;
      let jm = todayJ.jm - i;
      while (jm <= 0) { jm += 12; jy -= 1; }
      months.push({ jy, jm });
    }
    const rows = months.map(m => ({
      month: `${JALALI_MONTH_NAMES_FA[m.jm - 1]} ${toPersianDigits(m.jy % 100)}`,
      invoiced: 0,
      collected: 0,
    }));
    for (const inv of invoices) {
      if (inv.status === 'cancelled') continue;
      const p = parseJalali(inv.issueDateJalali || '');
      if (!p) continue;
      const pos = months.findIndex(m => m.jy === p.jy && m.jm === p.jm);
      if (pos === -1) continue;
      rows[pos].invoiced += inv.totalAmount || 0;
      if (inv.status === 'paid') rows[pos].collected += inv.totalAmount || 0;
    }
    return rows;
  })();

  const gridStroke = isDarkMode ? '#334155' : '#e2e8f0';
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      
      {/* Chart Header with Timeframe Selectors */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              داشبورد تحلیلی و نمودارهای آماری آزمایشگاه بتن
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            رصد لحظه‌ای حجم نمونه‌گیری، روند شکست، انطباق آیین‌نامه و درآمدهای وصولی
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <button
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              timeframe === 'week'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            هفتگی
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              timeframe === 'month'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            ماهانه
          </button>
          <button
            onClick={() => setTimeframe('year')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              timeframe === 'year'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            سالانه
          </button>
        </div>
      </div>

      {/* Grid of Main 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Test Activity Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-400">روند عملکرد آزمون‌ها</span>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>نمودار فعالیتی و انطباق استاندارد نمونه‌های بتن</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {toPersianDigits(reports.length)} نمونه فعال
                </span>
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                کل آزمون‌ها
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                منطبق و قبول
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getActivityData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" stroke={textColor} fontSize={11} tickLine={false} />
                <YAxis stroke={textColor} fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    direction: 'rtl'
                  }}
                  formatter={(val: any, name: any) => [`${toPersianDigits(Number(val))} آزمون`, String(name)]}
                />
                <Area type="monotone" dataKey="tests" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTests)" name="کل آزمون‌ها" />
                <Area type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPassed)" name="منطبق با آیین‌نامه" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>نرخ انطباق استاندارد بتن: <strong className="text-emerald-600 font-mono">{complianceRate === null ? '—' : `${toPersianDigits(complianceRate)}٪`}</strong></span>
            <span>بر اساس ضوابط مبحث نهم مقررات ملی ساختمان و استاندارد ملی ایران</span>
          </div>
        </div>

        {/* Test Types Donut Breakdown (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-0.5 mb-2">
            <span className="text-xs font-bold text-slate-400">توزیع نوع آزمون‌ها</span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-blue-600" />
              <span>ترکیب خدمات آزمایشگاهی</span>
            </h4>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={testTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {testTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    direction: 'rtl'
                  }}
                  formatter={(val: any, name: any) => [`${toPersianDigits(Number(val))} مورد`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {testTypeBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {toPersianDigits(item.value)} مورد
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Grid of Secondary 2 Charts: Strength Distribution & Financial Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Strength Distribution Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-400">توزیع مقاومت فشاری ۲۸ روزه</span>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>طیف مقاومت‌های استوانه‌ای حاصل از شکست</span>
              </h4>
            </div>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-xl">
              بر حسب MPa
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strengthDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="range" stroke={textColor} fontSize={10} tickLine={false} />
                <YAxis stroke={textColor} fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    direction: 'rtl'
                  }}
                  formatter={(val: any, name: any) => [`${toPersianDigits(Number(val))} شیت آزمایش`, String(name)]}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} name="تعداد نمونه‌ها" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>مقاومت مشخصه طراحی: <strong className="text-blue-600 font-mono">۲۵ تا ۳۵ MPa</strong></span>
            <span>{withinStandardPct === null
              ? 'هنوز نتیجه شکست ۲۸ روزه‌ای ثبت نشده است.'
              : `${toPersianDigits(withinStandardPct)}٪ از ${toPersianDigits(testedWithResult)} نمونه دارای نتیجه، به مقاومت هدف رسیده‌اند.`}</span>
          </div>
        </div>

        {/* Financial Flow Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-400">جریان مالی و حسابداری</span>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>صورتحساب‌های صادرشده در برابر وصولی‌ها (تومان)</span>
              </h4>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> صادرشده</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> وصول‌شده</span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" stroke={textColor} fontSize={10} tickLine={false} />
                <YAxis stroke={textColor} fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${toPersianDigits(Math.round(v / 1000000))}M` : toPersianDigits(Math.round(v / 1000)) + 'K'} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    direction: 'rtl'
                  }}
                  formatter={(val: any, name: any) => [`${toPersianDigits(Number(val).toLocaleString('en-US'))} تومان`, String(name)]}
                />
                <Bar dataKey="invoiced" fill="#3b82f6" radius={[6, 6, 0, 0]} name="صورتحساب" />
                <Bar dataKey="collected" fill="#10b981" radius={[6, 6, 0, 0]} name="وصولی نقدی" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>کل مطالبات وصول‌شده: <strong className="text-emerald-600 font-mono">{toPersianDigits(totalCollected.toLocaleString('en-US'))} تومان</strong></span>
            <span>مطالبات جاری: <strong className="text-amber-600 font-mono">{toPersianDigits(totalPending.toLocaleString('en-US'))} تومان</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
};
