import React, { useState } from 'react';
import { 
  Calculator, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Droplet, 
  Scale, 
  Beaker,
  TrendingUp,
  Cpu,
  Printer,
  Table
} from 'lucide-react';
import { PrintStandardSheetModal } from '../common/PrintStandardSheetModal';

interface MixDesignEstimatorWidgetProps {
  language: 'fa' | 'en';
}

export const MixDesignEstimatorWidget: React.FC<MixDesignEstimatorWidgetProps> = ({ language }) => {
  const [wcRatio, setWcRatio] = useState<number>(0.45);
  const [cementType, setCementType] = useState<'type2' | 'type1' | 'type5' | 'pozzolanic'>('type2');
  const [cementContentKg, setCementContentKg] = useState<number>(380);
  const [hasAdmixture, setHasAdmixture] = useState<boolean>(true);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Quick Presets
  const applyPreset = (grade: 'C25' | 'C30' | 'C35' | 'C40') => {
    switch(grade) {
      case 'C25':
        setWcRatio(0.48);
        setCementContentKg(350);
        break;
      case 'C30':
        setWcRatio(0.42);
        setCementContentKg(380);
        break;
      case 'C35':
        setWcRatio(0.38);
        setCementContentKg(420);
        break;
      case 'C40':
        setWcRatio(0.34);
        setCementContentKg(460);
        break;
    }
  };

  // ABA & Bolomey Formula Strength calculation
  // f_cm = A * (C/W - 0.5)
  const cementFactor = {
    'type1': 26,
    'type2': 25,
    'type5': 23,
    'pozzolanic': 24.5
  }[cementType];

  const cw = 1 / wcRatio;
  const rawStrength = cementFactor * (cw - 0.45);
  const admixtureBonus = hasAdmixture ? 1.14 : 1.0;
  const predicted28DayMpa = Math.max(15, Math.min(85, Number((rawStrength * admixtureBonus).toFixed(1))));
  const predicted7DayMpa = Number((predicted28DayMpa * 0.68).toFixed(1));

  // Water content (kg/m3)
  const waterKg = Math.round(cementContentKg * wcRatio);
  const aggregateKg = Math.round(2400 - cementContentKg - waterKg);

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-slate-900 dark:text-white shadow-xl relative overflow-hidden transition-colors">
      
      {/* Glow */}
      <div className="absolute top-0 start-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 relative z-10 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {language === 'fa' ? 'محاسبه‌گر هوشمند مقاومت و طرح اختلاط بتن' : 'Smart Concrete Mix-Design Strength Predictor'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 whitespace-nowrap">
                ABA & ACI 211
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fa' ? 'پیش‌بینی دقیق مقاومت فشاری ۷ و ۲۸ روزه بر پایه نسبت آب به سیمان (W/C) و آیین‌نامه بتن ایران' : 'Instant 7 & 28-day compressive estimation based on Bolomey & ABA'}
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-400 me-1 whitespace-nowrap">
            {language === 'fa' ? 'رده‌های پرکاربرد:' : 'Presets:'}
          </span>
          {(['C25', 'C30', 'C35', 'C40'] as const).map((grade) => (
            <button
              key={grade}
              onClick={() => applyPreset(grade)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700 transition active:scale-95"
            >
              {grade}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Live Output Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10 items-stretch">
        
        {/* Left Inputs (xl:col-span-7) */}
        <div className="xl:col-span-7 flex flex-col justify-between space-y-4">
          
          {/* W/C Slider */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span>{language === 'fa' ? 'نسبت آب به سیمان (W/C):' : 'Water-to-Cement Ratio (W/C):'}</span>
              </label>
              <span className="text-base font-black font-mono text-blue-600 dark:text-cyan-400 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                {wcRatio.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.65"
              step="0.01"
              value={wcRatio}
              onChange={(e) => setWcRatio(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
              <span>0.30 (بتن پرمقاومت HPC)</span>
              <span>0.45 (متعارف)</span>
              <span>0.65 (بتن مگر)</span>
            </div>
          </div>

          {/* Cement Type & Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Cement Type Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                {language === 'fa' ? 'تیپ سیمان پرتلند:' : 'Cement Type:'}
              </label>
              <select
                value={cementType}
                onChange={(e: any) => setCementType(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="type2">{language === 'fa' ? 'تیپ ۲ (ضد سولفات متوسط)' : 'Type II (Moderate Sulfate)'}</option>
                <option value="type1">{language === 'fa' ? 'تیپ ۱ (پرتلند معمولی)' : 'Type I (Standard Portland)'}</option>
                <option value="type5">{language === 'fa' ? 'تیپ ۵ (ضد سولفات قوی)' : 'Type V (High Sulfate Resistance)'}</option>
                <option value="pozzolanic">{language === 'fa' ? 'پوزولانی ویژه دوده سیلیسی' : 'Silica Fume Pozzolanic'}</option>
              </select>
            </div>

            {/* Cement Content Slider */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'fa' ? 'عیار سیمان (kg/m³):' : 'Cement Content:'}
                </label>
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-white">{cementContentKg} kg</span>
              </div>
              <input
                type="range"
                min="250"
                max="500"
                step="10"
                value={cementContentKg}
                onChange={(e) => setCementContentKg(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer mt-1.5"
              />
            </div>

          </div>

          {/* Superplasticizer Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white block">
                  {language === 'fa' ? 'افزودنی فوق‌روان‌کننده پلی‌کربوکسیلاتی (PCE)' : 'Superplasticizer Admixture (PCE)'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {language === 'fa' ? 'کاهش آب‌اندازی و افزایش ۱۴٪ مقاومت فشاری' : 'Water reducing & 14% strength enhancement'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setHasAdmixture(!hasAdmixture)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                hasAdmixture ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                  hasAdmixture ? 'start-7' : 'start-1'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Right Output HUD (xl:col-span-5) */}
        <div className="xl:col-span-5 flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 border border-blue-200 dark:border-blue-500/30">
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-cyan-400 animate-pulse" />
                {language === 'fa' ? 'پیش‌بینی مقاومت فشاری' : 'Strength Predictions'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-bold">
                ASTM C39
              </span>
            </div>

            {/* 28-Day Strength Hero Box */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                {language === 'fa' ? 'مقاومت مشخصه ۲۸ روزه (f\'c):' : '28-Day Target Strength (f\'c):'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {predicted28DayMpa}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">MPa (kgf/cm² {(predicted28DayMpa * 10).toFixed(0)})</span>
              </div>
            </div>

            {/* 7-Day Strength Box */}
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {language === 'fa' ? 'تخمین مقاومت ۷ روزه:' : '7-Day Strength:'}
              </span>
              <span className="text-lg font-black font-mono text-blue-600 dark:text-cyan-400">
                {predicted7DayMpa} MPa
              </span>
            </div>
          </div>

          {/* Unit Weight & Proportions */}
          <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-900/60 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/50 border border-blue-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{language === 'fa' ? 'آب مصرفی' : 'Water'}</span>
              <span className="font-bold font-mono text-blue-600 dark:text-blue-300">{waterKg} L</span>
            </div>
            <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/50 border border-blue-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{language === 'fa' ? 'سیمان' : 'Cement'}</span>
              <span className="font-bold font-mono text-slate-800 dark:text-white">{cementContentKg} kg</span>
            </div>
            <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/50 border border-blue-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{language === 'fa' ? 'سنگدانه' : 'Aggregate'}</span>
              <span className="font-bold font-mono text-amber-600 dark:text-amber-300">{aggregateKg} kg</span>
            </div>
          </div>

          {/* Export to Official Sheet & Print Button */}
          <button
            onClick={() => setShowPrintModal(true)}
            className="mt-3 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <Table className="w-4 h-4 text-amber-300" />
            <span>{language === 'fa' ? 'صدور به شیت استاندارد نتایج آزمایش و پرینت رسمی A4' : 'Export to Standard Test Sheet & Print'}</span>
          </button>

        </div>

      </div>

      {/* Standard B.S. 1881 Sheet Modal */}
      {showPrintModal && (
        <PrintStandardSheetModal
          onClose={() => setShowPrintModal(false)}
          initialHeader={{
            materialType: `بتن عیار ${cementContentKg} (W/C: ${wcRatio})`,
            testDate: '۹۹.۰۵.۰۶',
          }}
        />
      )}

    </div>
  );
};
