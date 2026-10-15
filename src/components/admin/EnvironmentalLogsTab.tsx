import React, { useState } from 'react';
import { EnvironmentalLog } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { 
  Droplets, 
  Thermometer, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  PlusCircle, 
  Activity, 
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const EnvironmentalLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<EnvironmentalLog[]>(() => labDb.getEnvironmentalLogs());
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [tankId, setTankId] = useState('حوضچه آب آهک شماره ۱');
  const [waterTemp, setWaterTemp] = useState<number>(23.1);
  const [roomTemp, setRoomTemp] = useState<number>(22.4);
  const [humidity, setHumidity] = useState<number>(97);
  const [ph, setPh] = useState<number>(12.2);
  const [operator, setOperator] = useState('مهندس مریم کیانی');
  const [notes, setNotes] = useState('شرایط عمل‌آوری کاملاً ایده‌آل و منطبق با ASTM C511');

  React.useEffect(() => {
    const unsub = labDb.subscribe(() => {
      setLogs(labDb.getEnvironmentalLogs());
    });
    return unsub;
  }, []);

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    labDb.addEnvironmentalLog({
      tankId,
      waterTempC: waterTemp,
      roomTempC: roomTemp,
      humidityPercent: humidity,
      limeSaturationPh: ph,
      loggedDateJalali: formatJalali(getTodayJalali()),
      loggedTime: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      operatorName: operator,
      status: (waterTemp >= 21 && waterTemp <= 25 && humidity >= 95) ? 'compliant' : 'warning',
      notes
    });

    setShowAddModal(false);
  };

  const rawLatest = logs[0];
  const latestWaterTemp = rawLatest?.waterTempC ?? rawLatest?.waterBathTempC ?? 23.0;
  const latestRoomTemp = rawLatest?.roomTempC ?? rawLatest?.labAmbientTempC ?? 22.0;
  const latestHumidity = rawLatest?.humidityPercent ?? rawLatest?.curingChamberHumidityRh ?? 97;
  const latestPh = rawLatest?.limeSaturationPh ?? 12.0;

  return (
    <div className="space-y-6 text-start">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            <span>پایش و ثبت روزانه شرایط حوضچه‌های عمل‌آوری و اتاق رطوبت (ASTM C511)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            ثبت پیوسته دمای آب حوضچه نگهداری نمونه‌ها در محدوده ۲۳.۰±۲.۰ درجه سانتی‌گراد و سنجش غلظت آب‌آهک اشباع و رطوبت نسبی اتاق نمونه‌برداری.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 shrink-0 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ثبت قرائت جدید سنسورها</span>
        </button>
      </div>

      {/* Real-time Environment Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">دمای آب حوضچه‌ها:</span>
            <Thermometer className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono mt-1">
            {toPersianDigits(Number(latestWaterTemp).toFixed(1))} °C
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block font-bold">
            استاندارد (۲۱ الی ۲۵ درجه)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">رطوبت نسبی اتاق:</span>
            <Droplets className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 dark:text-indigo-100 font-mono mt-1">
            {toPersianDigits(Math.round(latestHumidity))}٪
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block font-bold">
            حداقل مجاز: ۹۵ درصد
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">دمای محیط آزمایشگاه:</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-mono mt-1">
            {toPersianDigits(Number(latestRoomTemp).toFixed(1))} °C
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            تهویه فعال و پایدار
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">اسیدیته و آب‌آهک (pH):</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 dark:text-purple-100 font-mono mt-1">
            {toPersianDigits(Number(latestPh).toFixed(1))}
          </div>
          <span className="text-[11px] text-purple-600 mt-1 block font-bold">
            محلول اشباع هیدروکسید کلسیم
          </span>
        </div>

      </div>

      {/* Historical Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          دفترچه ثبت وقایع و بازرسی روزانه حوضچه‌های کیورینگ:
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
              <tr>
                <th className="p-3 text-start">مخزن / حوضچه</th>
                <th className="p-3 text-start">دمای آب (°C)</th>
                <th className="p-3 text-start">رطوبت اتاق (%)</th>
                <th className="p-3 text-start">دمای محیط</th>
                <th className="p-3 text-start">pH اشباع</th>
                <th className="p-3 text-start">تاریخ و ساعت</th>
                <th className="p-3 text-start">مسئول ثبت</th>
                <th className="p-3 text-center">انطباق استاندارد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((item) => {
                const itemWaterTemp = item.waterTempC ?? item.waterBathTempC ?? 23.0;
                const itemRoomTemp = item.roomTempC ?? item.labAmbientTempC ?? 22.0;
                const itemHumidity = item.humidityPercent ?? item.curingChamberHumidityRh ?? 95;
                const itemPh = item.limeSaturationPh ?? 12.0;
                const dateStr = item.loggedDateJalali || item.dateJalali || '1403/07/28';
                const timeStr = item.loggedTime || '۰۸:۰۰';
                const isCompliant = item.status === 'compliant' || item.complianceStatus === 'NORMAL';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      {item.tankId || 'حوضچه شماره ۱'}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600">
                      {toPersianDigits(Number(itemWaterTemp).toFixed(1))} °C
                    </td>
                    <td className="p-3 font-mono text-indigo-600 font-bold">
                      {toPersianDigits(Math.round(itemHumidity))}%
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                      {toPersianDigits(Number(itemRoomTemp).toFixed(1))} °C
                    </td>
                    <td className="p-3 font-mono text-purple-600 font-bold">
                      {toPersianDigits(Number(itemPh).toFixed(1))}
                    </td>
                    <td className="p-3 font-mono text-slate-500">
                      {toPersianDigits(dateStr)} - {toPersianDigits(timeStr)}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      {item.operatorName}
                    </td>
                    <td className="p-3 text-center">
                      {isCompliant ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          منطبق (ASTM)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          نیازمند تنظیم
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Reading Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-start">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-600" />
                <span>ثبت داده‌های سنسور حوضچه کیورینگ</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddLog} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نام مخزن / حوضچه:
                </label>
                <select
                  value={tankId}
                  onChange={(e) => setTankId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="حوضچه آب آهک شماره ۱">حوضچه آب آهک شماره ۱ (مخزن اصلی ۱۰۰۰ قالب)</option>
                  <option value="حوضچه آب آهک شماره ۲">حوضچه آب آهک شماره ۲</option>
                  <option value="اتاق رطوبت و مه‌پاش">اتاق رطوبت و مه‌پاش استاندارد</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    دمای آب (°C):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={waterTemp}
                    onChange={(e) => setWaterTemp(parseFloat(e.target.value) || 23.0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رطوبت اتاق (%):
                  </label>
                  <input
                    type="number"
                    required
                    value={humidity}
                    onChange={(e) => setHumidity(parseInt(e.target.value) || 95)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    دمای محیط آزمایشگاه:
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={roomTemp}
                    onChange={(e) => setRoomTemp(parseFloat(e.target.value) || 22.0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    pH آب آهک (اشباع):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={ph}
                    onChange={(e) => setPh(parseFloat(e.target.value) || 12.0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نام کارشناس ثبت:
                </label>
                <input
                  type="text"
                  required
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  ثبت قرائت در سامانه
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
