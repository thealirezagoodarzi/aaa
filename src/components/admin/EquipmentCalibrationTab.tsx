import React, { useState } from 'react';
import { 
  EquipmentCalibration 
} from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { JalaliDatePicker } from '../common/JalaliDatePicker';
import { 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  PlusCircle, 
  Wrench, 
  FileCheck, 
  Search, 
  ShieldCheck,
  Award,
  RefreshCw
} from 'lucide-react';

export const EquipmentCalibrationTab: React.FC = () => {
  const [calibrations, setCalibrations] = useState<EquipmentCalibration[]>(() => labDb.getCalibrations());
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [certNo, setCertNo] = useState('');
  const [agency, setAgency] = useState('مرکز ملی تایید صلاحیت ایران (NACI)');
  const [calDate, setCalDate] = useState(formatJalali(getTodayJalali()));
  const [nextDate, setNextDate] = useState('۱۴۰۴/۰۶/۱۵');
  const [errorRate, setErrorRate] = useState('±۰.۳٪');
  const [status, setStatus] = useState<EquipmentCalibration['status']>('valid');

  React.useEffect(() => {
    const unsub = labDb.subscribe(() => {
      setCalibrations(labDb.getCalibrations());
    });
    return unsub;
  }, []);

  const handleAddCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    labDb.addCalibration({
      equipmentName: name,
      model,
      serialNumber: serial,
      calibrationCertNo: certNo,
      calibrationAgency: agency,
      calibrationDateJalali: calDate,
      nextCalibrationDueJalali: nextDate,
      status,
      maxAllowedError: errorRate
    });

    setShowAddModal(false);
    setName('');
    setModel('');
    setSerial('');
    setCertNo('');
  };

  const filtered = calibrations.filter(c => 
    c.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
    c.model.toLowerCase().includes(search.toLowerCase()) ||
    c.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.calibrationCertNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 text-start">
      
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span>مدیریت کالیبراسیون ادواری جک‌ها و تجهیزات اندازه‌گیری (ISO 17025)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            ثبت و پایش دوره‌ای صحت عملکرد جک‌های هیدرولیک شکست بتن، باسکول‌های دیجیتال، حوضچه عمل‌آوری و وسایل اسلامپ مطابق با استانداردهای ملی و بین‌المللی.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 shrink-0 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ثبت تجهیز یا کالیبراسیون جدید</span>
        </button>
      </div>

      {/* Search and Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">تعداد کل تجهیزات کالیبره‌شده:</span>
          <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
            {toPersianDigits(calibrations.length)} <span className="text-xs font-sans text-slate-400">دستگاه فعال</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">تجهیزات دارای تاییدیه معتبر:</span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {toPersianDigits(calibrations.filter(c => c.status === 'valid').length)} <span className="text-xs font-sans text-slate-400">مجاز به آزمون</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">در آستانه انقضای گواهی کالیبراسیون:</span>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
            {toPersianDigits(calibrations.filter(c => c.status === 'due_soon').length)} <span className="text-xs font-sans text-slate-400">هشدار تجدید</span>
          </div>
        </div>
      </div>

      {/* Equipment List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            فهرست شناسنامه‌های تجهیزات آزمایشگاهی
          </h4>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="جستجو در نام دستگاه، شماره سریال، گواهی..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-start">نام دستگاه و مدل</th>
                <th className="p-3 text-start">شماره سریال</th>
                <th className="p-3 text-start">شماره گواهی کالیبراسیون</th>
                <th className="p-3 text-start">مرجع صادرکننده</th>
                <th className="p-3 text-start">میزان خطا</th>
                <th className="p-3 text-start">موعد تمدید بعدی</th>
                <th className="p-3 text-center">وضعیت اعتبار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                    <div className="font-bold">{item.equipmentName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{item.model}</div>
                  </td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                    {item.serialNumber}
                  </td>
                  <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {item.calibrationCertNo}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    {item.calibrationAgency}
                  </td>
                  <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                    {toPersianDigits(item.maxAllowedError)}
                  </td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                    {toPersianDigits(item.nextCalibrationDueJalali)}
                  </td>
                  <td className="p-3 text-center">
                    {item.status === 'valid' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        معتبر و کالیبره
                      </span>
                    ) : item.status === 'due_soon' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        نزدیک به سررسید
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        منقضی شده
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-start">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                <span>ثبت مشخصات و کالیبراسیون تجهیز جدید</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddCalibration} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام دستگاه *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="جک هیدرولیک فشار بتن ۲۰۰۰ KN..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مدل و برند</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="MATEST C040N"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شماره سریال</label>
                  <input
                    type="text"
                    required
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="SN-94821"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شماره گواهی کالیبراسیون</label>
                  <input
                    type="text"
                    required
                    value={certNo}
                    onChange={(e) => setCertNo(e.target.value)}
                    placeholder="CAL-403-902"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">حداکثر خطای مجاز</label>
                  <input
                    type="text"
                    value={errorRate}
                    onChange={(e) => setErrorRate(e.target.value)}
                    placeholder="±۰.۳٪"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <JalaliDatePicker
                  label="تاریخ انجام کالیبراسیون:"
                  value={calDate}
                  onChange={setCalDate}
                  required
                />
                <JalaliDatePicker
                  label="موعد انقضا و تجدید:"
                  value={nextDate}
                  onChange={setNextDate}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شرکت / آزمایشگاه همکار مرجع کالیبراسیون</label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  ثبت مشخصات تجهیز
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  انصراف
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
