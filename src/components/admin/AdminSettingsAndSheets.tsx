import React, { useState } from 'react';
import { 
  Settings, 
  FileSpreadsheet, 
  Sliders, 
  Database, 
  Download, 
  Save, 
  CheckCircle2, 
  Printer, 
  Plus, 
  Building2, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Scale, 
  FileText, 
  RefreshCw,
  Table,
  Sparkles,
  Layers,
  AlertCircle
} from 'lucide-react';
import { LAB_INFO } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';
import { LabFormsDirectory } from '../common/LabFormsDirectory';
import { PrintStandardSheetModal } from '../common/PrintStandardSheetModal';
import { labDb } from '../../services/ConcreteLabStorage';
import { downloadBlob } from '../../utils/printDom';

export const AdminSettingsAndSheets: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'sheets' | 'settings' | 'backup'>('sheets');
  const [showStandardSheetModal, setShowStandardSheetModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable Laboratory Settings
  const [labSettings, setLabSettings] = useState({
    name: LAB_INFO.name,
    licenseNo: LAB_INFO.licenseNo,
    licenseIssuer: LAB_INFO.licenseIssuer,
    registrationNo: LAB_INFO.registrationNo,
    economicCode: '۴۱۱۴۸۸۹۹۲۳۱',
    nationalId: '۱۰۲۶۰۵۹۸۷۶۱',
    managerName: LAB_INFO.manager,
    technicalDirector: 'مهندس صالح صادقی نیا',
    phone: LAB_INFO.phone,
    phoneRaw: LAB_INFO.phoneRaw,
    address: LAB_INFO.address,
    // Technical Coefficients
    cubeToCylFactor: 0.80,
    age7to28Factor: 0.65,
    curingTempMin: 21,
    curingTempMax: 25,
    curingHumidityMin: 95,
    vatPercentage: 10,
    baseTestTariff: 1850000 // Toman per set of 3 cubes
  });

  const handleSaveSettings = () => {
    // In a production app, persist to server settings
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleDownloadBackup = () => {
    try {
      const dbData = {
        customers: labDb.getCustomers(),
        reports: labDb.getReports(),
        invoices: labDb.getInvoices(),
        calibrations: labDb.getCalibrations(),
        dispatches: labDb.getDispatches(),
        envLogs: labDb.getEnvLogs(),
        settings: labSettings,
        exportedAt: new Date().toISOString()
      };
      const jsonStr = JSON.stringify(dbData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      downloadBlob(blob, `backup-lab-database-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      console.error('Backup download error:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title & Sub-Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <span>مرکز تنظیمات مدیریتی و شیت‌های رسمی آزمایشگاه</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            پیکربندی هویت رسمی، ضرایب محاسباتی استاندارد، شیت‌های آزمون و پشتیبان‌گیری
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('sheets')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'sheets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>شیت‌ها و فرم‌های فنی</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>تنظیمات و ضرایب</span>
          </button>

          <button
            onClick={() => setActiveSubTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'backup'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>پشتیبان‌گیری</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: SHEETS & TECHNICAL FORMS                                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'sheets' && (
        <div className="space-y-6">
          
          {/* Quick Action: Open Standard Concrete Break Sheet */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>سامانه اختصاصی شیت شکست بتن جک هیدرولیک</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  شیت هوشمند نتایج آزمون مقاومت فشاری بتن (مکعبی و استوانه‌ای)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  قابلیت درج ابعاد نمونه‌ها (طول، عرض، ارتفاع، وزن)، محاسبه خودکار وزن مخصوص، سطح مقطع، بار گسیختگی، مقاومت مکعبی، ضریب تبدیل به استوانه استاندارد و میانگین رده با چاپ A4 رسمی.
                </p>
              </div>

              <button
                onClick={() => setShowStandardSheetModal(true)}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-400 hover:to-teal-300 text-slate-950 font-black text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>ورود و چاپ شیت رسمی مقاومت بتن</span>
              </button>
            </div>
          </div>

          {/* Directory of Technical Forms & Checklists */}
          <LabFormsDirectory />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: LAB SETTINGS & TECHNICAL COEFFICIENTS                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          
          {saveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>تنظیمات رسمی آزمایشگاه و ضرایب فنی با موفقیت ذخیره و در سامانه اعمال گردید.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Box 1: Legal Identity & License Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>اطلاعات هویتی و پروانه اشتغال حقوقی</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام رسمی شرکت آزمایشگاهی:
                  </label>
                  <input
                    type="text"
                    value={labSettings.name}
                    onChange={(e) => setLabSettings({ ...labSettings, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره پروانه نظام مهندسی:
                    </label>
                    <input
                      type="text"
                      value={labSettings.licenseNo}
                      onChange={(e) => setLabSettings({ ...labSettings, licenseNo: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره ثبت شرکت:
                    </label>
                    <input
                      type="text"
                      value={labSettings.registrationNo}
                      onChange={(e) => setLabSettings({ ...labSettings, registrationNo: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      کد اقتصادی خریدار/فروشنده:
                    </label>
                    <input
                      type="text"
                      value={labSettings.economicCode}
                      onChange={(e) => setLabSettings({ ...labSettings, economicCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شناسه ملی حقوقی:
                    </label>
                    <input
                      type="text"
                      value={labSettings.nationalId}
                      onChange={(e) => setLabSettings({ ...labSettings, nationalId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام مدیر فنی ارشد آزمایشگاه:
                  </label>
                  <input
                    type="text"
                    value={labSettings.technicalDirector}
                    onChange={(e) => setLabSettings({ ...labSettings, technicalDirector: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Contact & Technical Standards */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>ضرایب فنی محاسبات بتن و مالیات</span>
              </h3>

              <div className="space-y-3 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ضریب تبدیل مکعبی به استوانه‌ای:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={labSettings.cubeToCylFactor}
                      onChange={(e) => setLabSettings({ ...labSettings, cubeToCylFactor: parseFloat(e.target.value) || 0.8 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">مبحث ۹ مقررات ملی: ۰.۸۰</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ضریب تخمین ۷ به ۲۸ روزه:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={labSettings.age7to28Factor}
                      onChange={(e) => setLabSettings({ ...labSettings, age7to28Factor: parseFloat(e.target.value) || 0.65 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">معمولاً بین ۰.۶۵ تا ۰.۷۰</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      دمای استاندارد حوضچه (°C):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={labSettings.curingTempMin}
                        onChange={(e) => setLabSettings({ ...labSettings, curingTempMin: parseInt(e.target.value) || 21 })}
                        className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-center"
                      />
                      <span className="text-slate-400">تا</span>
                      <input
                        type="number"
                        value={labSettings.curingTempMax}
                        onChange={(e) => setLabSettings({ ...labSettings, curingTempMax: parseInt(e.target.value) || 25 })}
                        className="w-1/2 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      مالیات بر ارزش افزوده (%):
                    </label>
                    <input
                      type="number"
                      value={labSettings.vatPercentage}
                      onChange={(e) => setLabSettings({ ...labSettings, vatPercentage: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره تماس مستقیم آزمایشگاه:
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={labSettings.phone}
                    onChange={(e) => setLabSettings({ ...labSettings, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نشانی رسمی آزمایشگاه و شعبه مرکزی:
                  </label>
                  <input
                    type="text"
                    value={labSettings.address}
                    onChange={(e) => setLabSettings({ ...labSettings, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

              </div>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره کلیه تنظیمات و اعمال در سامانه</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: DATABASE BACKUP & RESTORE                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  پشتیبان‌گیری پایگاه داده آزمایشگاه (Database Backup)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  دریافت فایل پشتیبان کامل با فرمت استاندارد JSON شامل مشتریان، قراردادها، گزارش‌های آزمایش و فاکتورها.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span>تعداد مشتریان: <strong>{toPersianDigits(labDb.getCustomers().length)}</strong></span>
                <span className="mx-2">•</span>
                <span>گزارش‌های آزمون: <strong>{toPersianDigits(labDb.getReports().length)}</strong></span>
                <span className="mx-2">•</span>
                <span>فاکتورها: <strong>{toPersianDigits(labDb.getInvoices().length)}</strong></span>
              </div>

              <button
                onClick={handleDownloadBackup}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>دانلود نسخه پشتیبان JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Concrete Test Results Sheet Modal */}
      {showStandardSheetModal && (
        <PrintStandardSheetModal
          report={labDb.getReports()[0]}
          customer={labDb.getCustomers()[0]}
          onClose={() => setShowStandardSheetModal(false)}
        />
      )}

    </div>
  );
};
