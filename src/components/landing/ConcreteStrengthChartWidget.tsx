import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { 
  TrendingUp, 
  CheckCircle2, 
  ShieldCheck, 
  Activity, 
  Sparkles,
  Calendar,
  Layers,
  Zap
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface ConcreteStrengthChartWidgetProps {
  isFa?: boolean;
  isDarkMode?: boolean;
}

interface MilestoneDetail {
  day: number;
  labelFa: string;
  labelEn: string;
  strength: number; // in MPa
  loadKn: number; // Breaking load in kN for 150mm cube
  percentOfTarget: number; // % of 35 MPa target
  ratioTo28d: string;
  statusFa: string;
  statusEn: string;
  descriptionFa: string;
  isTargetPassed: boolean;
}

export const ConcreteStrengthChartWidget: React.FC<ConcreteStrengthChartWidgetProps> = ({
  isFa = true,
  isDarkMode = true,
}) => {
  // 3 Primary Standard Milestones
  const milestoneData: Record<number, MilestoneDetail> = {
    7: {
      day: 7,
      labelFa: '۷ روزه',
      labelEn: '7 Days',
      strength: 29.4,
      loadKn: 661.5,
      percentOfTarget: 84.0,
      ratioTo28d: '۶۹.۰٪',
      statusFa: 'رشد بهینه مقاومت زودرس',
      statusEn: 'Optimal Early Growth',
      descriptionFa: 'کسب ۶۹٪ مقاومت ۲۸ روزه در سن ۷ روز، بیانگر کیفیت عالی سیمان و عمل‌آوری استاندارد است.',
      isTargetPassed: false,
    },
    14: {
      day: 14,
      labelFa: '۱۴ روزه',
      labelEn: '14 Days',
      strength: 36.8,
      loadKn: 828.0,
      percentOfTarget: 105.1,
      ratioTo28d: '۸۶.۴٪',
      statusFa: 'عبور زودهنگام از مقاومت هدف',
      statusEn: 'Exceeded Spec Ahead of Time',
      descriptionFa: 'در سن ۱۴ روزگی، مقاومت نمونه‌ها از رده هدف ۳۵ مگاپاسکال فراتر رفته است.',
      isTargetPassed: true,
    },
    28: {
      day: 28,
      labelFa: '۲۸ روزه',
      labelEn: '28 Days',
      strength: 42.6,
      loadKn: 958.5,
      percentOfTarget: 121.7,
      ratioTo28d: '۱۰۰٪',
      statusFa: 'تایید قطعی استاندارد ملی',
      statusEn: 'Full National Compliance',
      descriptionFa: 'مقاومت مشخصه نهایی به ۴۲.۶ مگاپاسکال رسید؛ ۱۲۱.۷٪ تحقق مقاومت هدف رده C35.',
      isTargetPassed: true,
    }
  };

  // Full Growth Curve Data Points
  const strengthCurveData = [
    { day: 1, dayLabel: isFa ? 'روز ۱' : 'Day 1', strength: 9.8, standardMin: 8.0, targetGrade: 35.0, stage: isFa ? 'گیرش اولیه' : 'Initial Set' },
    { day: 3, dayLabel: isFa ? 'روز ۳' : 'Day 3', strength: 18.4, standardMin: 16.0, targetGrade: 35.0, stage: isFa ? 'سخت‌شدگی' : 'Hardening' },
    { day: 7, dayLabel: isFa ? 'روز ۷' : 'Day 7', strength: 29.4, standardMin: 24.5, targetGrade: 35.0, isMilestone: true, stage: isFa ? 'کنترل ۷ روزه' : '7d Control' },
    { day: 14, dayLabel: isFa ? 'روز ۱۴' : 'Day 14', strength: 36.8, standardMin: 31.0, targetGrade: 35.0, isMilestone: true, stage: isFa ? 'پایش ۱۴ روزه' : '14d Interim' },
    { day: 21, dayLabel: isFa ? 'روز ۲۱' : 'Day 21', strength: 40.1, standardMin: 33.5, targetGrade: 35.0, stage: isFa ? 'بلوغ بتن' : 'Hydration' },
    { day: 28, dayLabel: isFa ? 'روز ۲۸' : 'Day 28', strength: 42.6, standardMin: 35.0, targetGrade: 35.0, isMilestone: true, stage: isFa ? 'شکست ۲۸ روزه' : '28d Final' },
  ];

  // Active Milestone State (defaults to 28 days)
  const [selectedDay, setSelectedDay] = useState<number>(28);

  const activeMilestone = milestoneData[selectedDay] || milestoneData[28];
  const activeCurvePoint = strengthCurveData.find(p => p.day === selectedDay) || strengthCurveData[5];

  // Custom Interactive Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-[#041a29]/95 backdrop-blur-md border border-cyan-500/40 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1.5 min-w-[170px]" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1">
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              {data.dayLabel}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
              {toPersianDigits(((data.strength / 35.0) * 100).toFixed(0))}% رده C35
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-300">مقاومت فشاری:</span>
            <span className="font-mono font-black text-sm text-[#00e5b0]">
              {toPersianDigits(data.strength)} MPa
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>حد مجاز استاندارد:</span>
            <span className="font-mono text-slate-200">≥ {toPersianDigits(data.standardMin)} MPa</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate pt-0.5 border-t border-slate-800">
            {data.stage}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg rounded-[28px] bg-white/95 dark:bg-[#062436]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-cyan-400/40 p-5 sm:p-6 shadow-2xl space-y-4 text-start relative overflow-hidden transition-all text-slate-900 dark:text-white">
      
      {/* Ambient background glows */}
      <div className="absolute -top-12 -end-12 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -start-10 w-40 h-40 bg-[#00c49f]/12 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Section */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 text-[11px] font-bold text-cyan-800 dark:text-cyan-300 mb-1.5">
            <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span>{isFa ? 'سامانه هوشمند نتایج آزمون' : 'Smart Concrete Testing System'}</span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
            {isFa ? 'دقت در آزمون، اطمینان در ساخت' : 'Precision in Testing, Confidence in Construction'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>{isFa ? 'منحنی رشد مقاومت فشاری بتن استاندارد (۷، ۱۴ و ۲۸ روزه)' : 'Standard Compressive Strength Growth Curve (7, 14 & 28 Days)'}</span>
          </p>
        </div>

        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00b4d8] via-teal-400 to-[#00c49f] text-white flex items-center justify-center shadow-lg shadow-teal-500/25 shrink-0">
          <Activity className="w-5 h-5 text-white animate-pulse" />
        </div>
      </div>

      {/* Primary Dynamic Hero Metric Callout (Updates immediately when 7d/14d/28d is clicked) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-teal-50/40 to-cyan-50/50 dark:from-[#093147]/70 dark:via-[#072a3d]/60 dark:to-[#041d2d]/80 border border-teal-200/70 dark:border-cyan-500/30 relative overflow-hidden transition-all">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5" dir="ltr">
              <span className="text-emerald-500 font-black text-2xl sm:text-3xl leading-none">↑</span>
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white transition-all duration-300">
                {activeMilestone.strength.toFixed(1)}
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-[#00e5b0]">
                MPa
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-cyan-200">
                {isFa ? 'رده مقاومت: C35/45' : 'Strength Grade: C35/45'}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md transition-all">
                {toPersianDigits(activeMilestone.percentOfTarget.toFixed(1))}% {isFa ? 'تحقق رده هدف' : 'of target'}
              </span>
              <span className="text-[10px] font-medium text-cyan-800 dark:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded-md border border-cyan-500/20">
                {isFa ? `سن آزمون: ${activeMilestone.labelFa}` : `Age: ${activeMilestone.labelEn}`}
              </span>
            </div>
          </div>

          <div className="text-end shrink-0">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
              {isFa ? 'نیروی جک هیدرولیکی' : 'Crushing Load'}
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200" dir="ltr">
              {toPersianDigits(activeMilestone.loadKn)} kN
            </span>
            <div className="flex items-center gap-1 justify-end text-[10px] text-emerald-700 dark:text-[#00d2a0] font-bold mt-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{isFa ? activeMilestone.statusFa : activeMilestone.statusEn}</span>
            </div>
          </div>
        </div>

        {/* Dynamic description of the selected milestone */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-cyan-500/20 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="line-clamp-1">{activeMilestone.descriptionFa}</span>
        </div>
      </div>

      {/* Main Interactive Recharts Curve */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] px-1">
          <span className="font-bold text-slate-700 dark:text-cyan-200 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
            {isFa ? 'روند رشد مقاومت نمونه‌ها' : 'Specimen Strength Growth Trend'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {isFa ? 'استاندارد ملی ISIRI 3201' : 'National Standard ISIRI 3201'}
          </span>
        </div>

        <div className="h-44 sm:h-48 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={strengthCurveData} 
              margin={{ top: 12, right: 10, left: -18, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e?.activePayload && e.activePayload.length) {
                  const pt = e.activePayload[0].payload;
                  if (pt?.day && (pt.day === 7 || pt.day === 14 || pt.day === 28)) {
                    setSelectedDay(pt.day);
                  }
                }
              }}
            >
              <defs>
                {/* Strength Curve Gradient */}
                <linearGradient id="concreteStrengthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00c49f" stopOpacity={0.65} />
                  <stop offset="60%" stopColor="#00b4d8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00b4d8" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke={isDarkMode ? 'rgba(56, 189, 248, 0.12)' : 'rgba(203, 213, 225, 0.5)'} 
              />
              
              <XAxis 
                dataKey="dayLabel" 
                tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              
              <YAxis 
                domain={[0, 48]} 
                ticks={[0, 15, 30, 45]}
                tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                unit="M"
              />

              {/* Target Line C35: 35 MPa */}
              <ReferenceLine 
                y={35} 
                stroke="#f59e0b" 
                strokeDasharray="4 4" 
                strokeWidth={1.5}
                label={{ 
                  value: isFa ? 'رде هدف (35MPa)' : 'Target C35', 
                  fill: '#f59e0b', 
                  fontSize: 9, 
                  fontWeight: 700,
                  position: 'insideTopLeft'
                }} 
              />

              {/* Vertical Highlight Line on Selected Milestone */}
              <ReferenceLine 
                x={activeCurvePoint.dayLabel} 
                stroke="#00e5b0" 
                strokeDasharray="3 3" 
                strokeWidth={1.8}
              />

              {/* Glowing Indicator Dot on Selected Milestone */}
              <ReferenceDot
                x={activeCurvePoint.dayLabel}
                y={activeCurvePoint.strength}
                r={6}
                fill="#00e5b0"
                stroke="#ffffff"
                strokeWidth={2.5}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area 
                type="monotone" 
                dataKey="strength" 
                stroke="#00e5b0" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#concreteStrengthGradient)" 
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isSelected = payload.day === selectedDay;
                  if (isSelected) {
                    return (
                      <g key={`dot-${payload.day}`}>
                        <circle cx={cx} cy={cy} r={9} fill="#00e5b0" fillOpacity={0.35} />
                        <circle cx={cx} cy={cy} r={5.5} fill="#00e5b0" stroke="#ffffff" strokeWidth={2} />
                      </g>
                    );
                  }
                  if (payload.isMilestone) {
                    return (
                      <circle key={`dot-${payload.day}`} cx={cx} cy={cy} r={3.5} fill="#00b4d8" stroke="#ffffff" strokeWidth={1.5} />
                    );
                  }
                  return <circle key={`dot-${payload.day}`} cx={cx} cy={cy} r={2} fill="#64748b" opacity={0.5} />;
                }}
                activeDot={{ 
                  r: 7, 
                  fill: '#ffffff', 
                  stroke: '#00e5b0', 
                  strokeWidth: 3 
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3 Milestone Quick Selectors (7, 14, 28 Days) - Clicking triggers immediate visual and state updates */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
        {[
          { day: 7, label: isFa ? '۷ روزه' : '7 Days', val: '29.4 MPa', ratio: '۶۹٪ رده', desc: 'کنترل اولیه' },
          { day: 14, label: isFa ? '۱۴ روزه' : '14 Days', val: '36.8 MPa', ratio: '۸۶٪ رده', desc: 'پایش میانی' },
          { day: 28, label: isFa ? '۲۸ روزه' : '28 Days', val: '42.6 MPa', ratio: '۱۰۰٪ نهایی', desc: 'قبول قطعی' },
        ].map((item) => {
          const isSelected = selectedDay === item.day;
          return (
            <button
              key={item.day}
              type="button"
              onClick={() => setSelectedDay(item.day)}
              className={`p-2.5 rounded-xl transition-all duration-200 border text-start flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                isSelected
                  ? 'bg-gradient-to-tr from-cyan-500/25 to-teal-500/25 border-cyan-400 dark:border-[#00e5b0] text-slate-900 dark:text-white shadow-md ring-1 ring-cyan-400/40 transform scale-[1.02]'
                  : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-cyan-500/20 text-slate-600 dark:text-slate-300 hover:border-cyan-400/60 hover:bg-slate-100/80 dark:hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[11px] font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.label}
                </span>
                {isSelected ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#00e5b0] shadow-xs" />
                ) : (
                  <span className="text-[9px] text-slate-400 font-medium">{item.desc}</span>
                )}
              </div>
              <span className={`font-mono font-black text-xs sm:text-sm mt-1 ${isSelected ? 'text-emerald-600 dark:text-[#00e5b0]' : 'text-slate-900 dark:text-white'}`} dir="ltr">
                {item.val}
              </span>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/50 dark:border-cyan-900/30">
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {item.ratio}
                </span>
                {isSelected && (
                  <span className="text-[9px] text-cyan-600 dark:text-cyan-300 font-bold">
                    فعال
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Verification Badge */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-cyan-900/40 text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>{isFa ? 'گواهینامه دارای بارکد QR معتبر' : 'QR-Verified Lab Certificate'}</span>
        </span>
        <span className="font-bold text-emerald-700 dark:text-[#00d2a0] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          {isFa ? 'استاندارد ملی ISIRI 3201' : 'ISIRI 3201 / ASTM C39'}
        </span>
      </div>

    </div>
  );
};
