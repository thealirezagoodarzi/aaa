import React, { useState } from 'react';
import { AIPredictionResult, AIFinancialSummary, ConcreteGrade } from '../../types';
import { predictConcreteStrength, generateFinancialAuditSummary } from '../../services/gemini';
import { translations, Language } from '../../utils/i18n';
import { toPersianDigits } from '../../utils/jalali';
import { 
  Sparkles, 
  Calculator, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  BarChart3, 
  Flame, 
  DollarSign, 
  Info, 
  FileText,
  Lightbulb
} from 'lucide-react';

interface AiSuiteProps {
  language: Language;
  totalIncome: number;
  totalExpense: number;
  pendingInvoices: number;
  testsCount: number;
  passRate: number;
}

export const AiSuite: React.FC<AiSuiteProps> = ({
  language,
  totalIncome,
  totalExpense,
  pendingInvoices,
  testsCount,
  passRate
}) => {
  const t = translations[language];

  // Active Sub-Tab: 'strength' | 'financial'
  const [activeTab, setActiveTab] = useState<'strength' | 'financial'>('strength');

  // Concrete Prediction Form State
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>('C30');
  const [strength7d, setStrength7d] = useState<number>(22.5);
  const [slump, setSlump] = useState<number>(90);
  const [wcRatio, setWcRatio] = useState<number>(0.42);
  const [cementGrade, setCementGrade] = useState<string>('سیمان تیپ ۲ پرتلند (۴۲.۵R)');
  const [aggregateSize, setAggregateSize] = useState<string>('۱۹ میلی‌متر (شن شکسته)');
  const [curingTemp, setCuringTemp] = useState<string>('۲۳ درجه سانتی‌گراد');

  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<AIPredictionResult | null>(null);

  // Financial Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<AIFinancialSummary | null>(null);

  const handlePredictStrength = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPredicting(true);
    try {
      const res = await predictConcreteStrength({
        concreteGrade,
        strength7d: Number(strength7d),
        slump: Number(slump),
        wcRatio: Number(wcRatio),
        cementGrade,
        aggregateSize,
        curingTemp
      });
      setPredictionResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleGenerateFinancialAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await generateFinancialAuditSummary({
        totalIncome,
        totalExpense,
        pendingInvoices,
        testsCount,
        passRate,
        period: 'ماه جاری'
      });
      setFinancialSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Sub-Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>سوئیت هوش مصنوعی مهندسی و مالی آزمایشگاه (Gemini AI)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            تلفیق مدل‌های پیشرفته جمنای با آئین‌نامه‌های ACI 209R، مبحث نهم مقررات ملی و استانداردهای ISIRI
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('strength')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'strength'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>پیش‌بینی مقاومت ۲۸ روزه</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'financial'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>تحلیل مالی و سودآوری</span>
          </button>
        </div>
      </div>

      {/* 1. Strength Predictor Section */}
      {activeTab === 'strength' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Input Parameters Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>پارامترهای ورودی نمونه و آزمون ۷ روزه</span>
            </h3>

            <form onSubmit={handlePredictStrength} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رده مقاومتی هدف
                  </label>
                  <select
                    value={concreteGrade}
                    onChange={(e) => setConcreteGrade(e.target.value as ConcreteGrade)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="C20">C20 (مقاومت ۲۰ MPa)</option>
                    <option value="C25">C25 (مقاومت ۲۵ MPa)</option>
                    <option value="C30">C30 (مقاومت ۳۰ MPa)</option>
                    <option value="C35">C35 (مقاومت ۳۵ MPa)</option>
                    <option value="C40">C40 (مقاومت ۴۰ MPa)</option>
                    <option value="C50">C50 (مقاومت ۵۰ MPa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    مقاومت ۷ روزه حاصله (MPa)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={strength7d}
                    onChange={(e) => setStrength7d(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-bold text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسلامپ اندازه‌گیری شده (mm)
                  </label>
                  <input
                    type="number"
                    value={slump}
                    onChange={(e) => setSlump(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-medium text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نسبت آب به سیمان (W/C)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={wcRatio}
                    onChange={(e) => setWcRatio(parseFloat(e.target.value) || 0.45)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-medium text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تیپ و رده سیمان مصرفی
                </label>
                <input
                  type="text"
                  value={cementGrade}
                  onChange={(e) => setCementGrade(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حداکثر اندازه سنگدانه
                  </label>
                  <input
                    type="text"
                    value={aggregateSize}
                    onChange={(e) => setAggregateSize(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    دمای محیط عمل‌آوری
                  </label>
                  <input
                    type="text"
                    value={curingTemp}
                    onChange={(e) => setCuringTemp(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                id="btn-run-ai-prediction"
                type="submit"
                disabled={isPredicting}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-70 mt-2"
              >
                {isPredicting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t.predicting}</span>
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t.predictButton}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* AI Result Card */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            {predictionResult ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                
                {/* Result Top Banner */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                      مقاومت ۲۸ روزه پیش‌بینی شده:
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black text-blue-700 dark:text-blue-400 font-mono">
                        {toPersianDigits(predictionResult.predicted28dStrength)}
                      </span>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">مگاپاسکال (MPa)</span>
                    </div>
                  </div>

                  <div className="text-end">
                    {predictionResult.targetCompliance === 'PASS' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                        منطبق با رده {concreteGrade}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        احتمال افت مقاومت
                      </span>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      ضریب اطمینان: {toPersianDigits(predictionResult.confidenceScore)}٪
                    </p>
                  </div>
                </div>

                {/* Growth Metrics */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">نسبت مقاومت ۷ به ۲۸ روزه</span>
                    <strong className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {toPersianDigits(predictionResult.strengthRatio7to28)}٪
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">سطح ریسک سازه‌ای</span>
                    <strong className={`text-sm font-bold ${
                      predictionResult.structuralRiskLevel === 'LOW' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {predictionResult.structuralRiskLevel === 'LOW' ? 'پایین (Low Risk)' : 'متوسط (نیاز به پایش)'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">شاخص بلوغ تخمینی</span>
                    <strong className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {toPersianDigits(predictionResult.estimatedMaturityIndex || '540 °C-hr')}
                    </strong>
                  </div>
                </div>

                {/* Analysis Body */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>تحلیل جامع مهندسی جمنای بر مبنای مبحث ۹ مقررات ملی</span>
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-justify">
                    {predictionResult.analysisFa}
                  </p>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>توصیه‌های فنی و عملیاتی هوش مصنوعی:</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {predictionResult.recommendationsFa.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  آماده برای پیش‌بینی مقاومت فشاری ۲۸ روزه
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  پارامترهای طرح مخلوط بتن و نتیجه شکست ۷ روزه را وارد نموده و دکمه تحلیل با جمنای را کلیک فرمایید.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 2. Financial & Quality Executive Audit Section */}
      {activeTab === 'financial' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>گزارش تحلیلی و مانیتورینگ سودآوری آزمایشگاه با هوش مصنوعی</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                بررسی شاخص‌های مالی، مطالبات معوق و نرخ انطباق کیفی آزمایش‌های جاری
              </p>
            </div>

            <button
              id="btn-run-ai-financial"
              onClick={handleGenerateFinancialAudit}
              disabled={isAuditing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-70"
            >
              {isAuditing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>در حال ارزیابی با جمنای...</span>
                </span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t.generateFinancialReport}</span>
                </>
              )}
            </button>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">کل درآمد وصولی</span>
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1 block">
                {toPersianDigits(totalIncome.toLocaleString('fa-IR'))}
              </span>
              <span className="text-[10px] text-slate-400">تومان</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">هزینه‌های جاری آزمایشگاه</span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-1 block">
                {toPersianDigits(totalExpense.toLocaleString('fa-IR'))}
              </span>
              <span className="text-[10px] text-slate-400">تومان</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">مطالبات معوق فاکتورها</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                {toPersianDigits(pendingInvoices.toLocaleString('fa-IR'))}
              </span>
              <span className="text-[10px] text-slate-400">تومان</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">نرخ انطباق کیفی بتن‌ها</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                {toPersianDigits(passRate)}٪
              </span>
              <span className="text-[10px] text-slate-400">از کل {testsCount} آزمون</span>
            </div>
          </div>

          {/* AI Audit Findings */}
          {financialSummary && (
            <div className="space-y-4 pt-2 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>خلاصه ارزیابی مدیر ارشد مالی و عملیاتی هوش مصنوعی</span>
                  </h4>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                    حاشیه سود: {toPersianDigits(financialSummary.profitMargin)}٪
                  </span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {financialSummary.executiveSummaryFa}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                    نکات کلیدی پایش مالی:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {financialSummary.keyObservationsFa.map((obs, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                    استراتژی‌های پیشنهادی کاهش هزینه و رشد درآمد:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {financialSummary.costOptimizationTipsFa.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
