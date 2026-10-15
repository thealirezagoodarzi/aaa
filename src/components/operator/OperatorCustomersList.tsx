import React, { useState } from 'react';
import { Customer } from '../../types';
import { toPersianDigits } from '../../utils/jalali';
import { 
  Building2, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FolderKanban, 
  ShieldCheck, 
  FileText,
  Lock,
  ExternalLink,
  Users,
  CheckCircle2
} from 'lucide-react';

interface OperatorCustomersListProps {
  customers: Customer[];
}

export const OperatorCustomersList: React.FC<OperatorCustomersListProps> = ({ customers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.representativeName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.projectNames.some(p => p.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Policy Notice Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-blue-900/50 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>ضوابط مدیریتی آزمایشگاه</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black">
              فهرست کارفرمایان طرف قرارداد و پروژه‌های مجاز
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              ثبت کارفرمای جدید، صدور کد اشتراک، تعیین رمز ورود و تخصیص سهمیه نمونه‌گیری منحصراً توسط مدیریت آزمایشگاه و پس از ثبت قرارداد رسمی امکان‌پذیر می‌باشد.
            </p>
          </div>
          
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-center shrink-0">
            <span className="text-xs text-blue-200 block font-medium">تعداد کارفرمایان فعال</span>
            <span className="text-2xl font-black font-mono mt-0.5 block">{toPersianDigits(customers.length)}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="جستجو بر اساس نام شرکت، نماینده، شماره تماس یا پروژه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-end sm:self-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>دسترسی مشاهده پرونده‌های رسمی (اپراتور آزمایشگاه)</span>
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(cust => (
          <div
            key={cust.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-blue-500/50 transition flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {cust.companyName}
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      کد اشتراک: <strong className="font-mono text-blue-600 dark:text-blue-400">{cust.id}</strong>
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> قرارداد معتبر
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">نماینده فنی:</span>
                  <span className="font-bold">{cust.representativeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">شماره تماس:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                    {toPersianDigits(cust.phone)}
                  </span>
                </div>
                {cust.nationalId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">شناسه ملی:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                      {toPersianDigits(cust.nationalId)}
                    </span>
                  </div>
                )}
              </div>

              {/* Projects List */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                  <span>پروژه‌های تحت نظارت:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cust.projectNames.map((proj, pIdx) => (
                    <span
                      key={pIdx}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                    >
                      {proj}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate max-w-[200px]" title={cust.address}>
                📍 {cust.address}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCustomer(cust)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-bold shrink-0"
              >
                جزئیات قرارداد
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  پرونده رسمی کارفرما: {selectedCustomer.companyName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>اطلاعات قرارداد و دسترسی‌های این کارفرما توسط مدیریت آزمایشگاه نهایی شده است.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px]">شناسه کاربری ورود:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block" dir="ltr">
                    {selectedCustomer.email}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px]">شماره همراه ثبتی:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block" dir="ltr">
                    {toPersianDigits(selectedCustomer.phone)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px] mb-1">پروژه‌های تحت نظارت:</span>
                <ul className="list-disc list-inside space-y-1 font-medium text-slate-800 dark:text-slate-200">
                  {selectedCustomer.projectNames.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">نشانی محل پروژه / دفتر:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {selectedCustomer.address}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
