import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { labDb } from '../../services/supabase';
import { 
  Settings, 
  Scale, 
  ShieldCheck, 
  Bell, 
  Cpu, 
  CheckCircle2, 
  Save, 
  BookOpen,
  HelpCircle,
  FileCheck2
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';

interface OperatorSettingsTabProps {
  currentUser: UserProfile;
}

export const OperatorSettingsTab: React.FC<OperatorSettingsTabProps> = ({ currentUser }) => {
  const calibrations = labDb.getCalibrations();
  const pressMachine = calibrations.find(c => c.equipmentName.includes('جک')) || calibrations[0];

  const [machineModel, setMachineModel] = useState(pressMachine?.model || 'Matest 2000 kN Digital Press');
  const [operatorNote, setOperatorNote] = useState('کنترل صحت گیج فشار پیش از هر سری آزمایش الزامی است.');
  const [autoCalculateMpa, setAutoCalculateMpa] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            تنظیمات ایستگاه کاری اپراتور آزمایشگاه
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            پیکربندی تجهیزات جک بتن‌شکن، استانداردهای محاسباتی و اولویت‌های محیط کاری
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>تنظیمات دستگاه و ترجیحات ایستگاه اپراتور با موفقیت ذخیره شد.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Machine Calibration Status Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">وضعیت کالیبراسیون دستگاه شکست بتن</h3>
                <p className="text-xs text-slate-400">شناسنامه فنی جک هیدرولیکی آزمایشگاه</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-xs font-bold border border-emerald-100 dark:border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              کالیبره معتبر
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">دستگاه فعال:</span>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 mt-1 block">
                {pressMachine?.equipmentName || 'جک هیدرولیکی دیجیتال ۲۰۰۰ kN'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">شماره گواهی کالیبراسیون:</span>
              <span className="font-bold text-xs text-blue-600 font-mono mt-1 block">
                {pressMachine?.certificateNo || 'CERT-CAL-1403-882'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 block">اعتبار کالیبراسیون تا:</span>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 mt-1 block font-mono">
                {toPersianDigits(pressMachine?.expiryDateJalali || '1404/04/15')}
              </span>
            </div>
          </div>
        </div>

        {/* Calculation & Standards Config */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            استانداردهای محاسباتی و پارامترهای تبدیل
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  محاسبه آنی مقاومت فشاری بر حسب MPa
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  تبدیل خودکار بار شکست جک (kN) به مقاومت فشاری با توجه به مساحت سطح مقطع قالب
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoCalculateMpa}
                onChange={(e) => setAutoCalculateMpa(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  هشدار صوتی و تصویری موعد شکست نمونه‌ها
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  نمایش اعلان خودکار در روز سررسید ۷ روزه و ۲۸ روزه عمل‌آوری بتن در حوضچه
                </span>
              </div>
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Technical Guidelines Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            مراجع و استانداردهای مصوب آزمایشگاه
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
              <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-slate-700 dark:text-slate-300">استاندارد ملی ایران ۳۲۰۱</span>
                <span>روش تعیین مقاومت فشاری نمونه‌های بتن سخت‌شده</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
              <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-slate-700 dark:text-slate-300">مبحث نهم مقررات ملی ساختمان</span>
                <span>طرح و اجرای ساختمان‌های بتن‌آرمه (ویرایش پنجم)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            ذخیره تنظیمات
          </button>
        </div>
      </form>
    </div>
  );
};
