import React, { useState, useEffect } from 'react';
import { SmsLog, SmsEvent, Customer, UserProfile } from '../../types';
import { labDb, LAB_INFO } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Plus, 
  Smartphone, 
  Radio, 
  Building2, 
  FileText, 
  Calendar, 
  Copy, 
  Sparkles,
  ShieldCheck,
  User,
  X
} from 'lucide-react';

interface AdminSmsManagementTabProps {
  currentUser: UserProfile;
}

const SMS_EVENT_LABELS: Record<SmsEvent, string> = {
  sample_registered: 'ثبت نمونه بتن',
  sample_received: 'پذیرش و ورود به کیورینگ',
  test_7d_result: 'نتیجه ۷ روزه بتن',
  test_28d_result: 'نتیجه ۲۸ روزه نهایی',
  test_ready: 'آماده بودن نتیجه آزمایش',
  test_failed: 'عدم انطباق و مردودی نمونه',
  certificate_issued: 'صدور گواهینامه استاندارد',
  invoice_issued: 'صدور فاکتور آزمایشگاه',
  payment_received: 'ثبت پرداخت و تسویه',
  payment_reminder: 'یادآوری پرداخت و تسویه',
  dispatch_scheduled: 'هماهنگی اعزام تکنسین',
  custom: 'پیامک اختصاصی و اطلاع‌رسانی'
};

const SMS_EVENT_COLORS: Record<SmsEvent, string> = {
  sample_registered: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  sample_received: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  test_7d_result: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  test_28d_result: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  test_ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  test_failed: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  certificate_issued: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900',
  invoice_issued: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  payment_received: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900',
  payment_reminder: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-900',
  dispatch_scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900',
  custom: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

export const AdminSmsManagementTab: React.FC<AdminSmsManagementTabProps> = ({ currentUser }) => {
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState<SmsEvent | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'sent' | 'failed'>('all');

  // New SMS Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<SmsEvent>('custom');
  const [smsMessage, setSmsMessage] = useState('');
  const [sendSuccessToast, setSendSuccessToast] = useState<string | null>(null);
  const [sendErrorMsg, setSendErrorMsg] = useState<string | null>(null);

  const refreshData = () => {
    setSmsLogs(labDb.getSmsLogs());
    setCustomers(labDb.getCustomers());
  };

  useEffect(() => {
    refreshData();
    const unsub = labDb.subscribe(refreshData);
    return () => unsub();
  }, []);

  // Predefined Templates
  const applyTemplate = (event: SmsEvent, cust?: Customer) => {
    const custName = cust?.companyName || 'کارفرمای محترم';
    const proj = cust?.projectNames?.[0] || 'پروژه جاری';

    switch (event) {
      case 'sample_registered':
        setSmsMessage(`کارفرمای محترم، ${custName}؛ نمونه‌های بتن پروژه «${proj}» با موفقیت در آزمایشگاه ثبت و وارد حوضچه استاندارد کیورینگ شد.\n${LAB_INFO.name}`);
        break;
      case 'test_7d_result':
        setSmsMessage(`کارفرمای گرامی، ${custName}؛ نتایج آزمایش مقاومت فشاری ۷ روزه پروژه «${proj}» با میانگین مطلوب ثبت گردید و در پورتال شما قابل مشاهده است.\n${LAB_INFO.name}`);
        break;
      case 'test_28d_result':
        setSmsMessage(`کارفرمای گرامی، ${custName}؛ شیت آزمایش نهایی ۲۸ روزه پروژه «${proj}» تایید و گواهینامه استاندارد صادر شد. جهت دانلود نسخه PDF به پورتال مراجعه فرمایید.\n${LAB_INFO.name}`);
        break;
      case 'test_failed':
        setSmsMessage(`هشدار فنی: کارفرمای محترم، ${custName}؛ مقاومت فشاری نمونه پروژه «${proj}» کمتر از حد مشخصه طراحی ثبت شد. لطفاً جهت هماهنگی کرگیری با آزمایشگاه تماس حاصل فرمایید.\n${LAB_INFO.name} - ${LAB_INFO.phone}`);
        break;
      case 'certificate_issued':
        setSmsMessage(`کارفرمای محترم، ${custName}؛ گواهینامه رسمی کنترل کیفیت بتن پروژه «${proj}» صادر و مهر شد. فایل PDF در پورتال شما بارگذاری گردید.\n${LAB_INFO.name}`);
        break;
      case 'invoice_issued':
        setSmsMessage(`کارفرمای گرامی، ${custName}؛ صورتحساب خدمات آزمایشگاهی پروژه «${proj}» صادر گردید. جهت مشاهده و تسویه به پورتال مشتریان مراجعه فرمایید.\n${LAB_INFO.name}`);
        break;
      case 'payment_received':
        setSmsMessage(`کارفرمای محترم ${custName}؛ پرداخت و تسویه مالی شما برای پروژه «${proj}» تایید شد. دسترسی به گزارشات رسمی فعال است.\n${LAB_INFO.name}`);
        break;
      case 'payment_reminder':
        setSmsMessage(`یادآوری: کارفرمای محترم ${custName}؛ خواهشمند است نسبت به تسویه فاکتور معوق آزمایشگاه اقدام فرمایید تا دسترسی به گواهینامه‌های نهایی پروژه فعال بماند.\n${LAB_INFO.name}`);
        break;
      case 'dispatch_scheduled':
        setSmsMessage(`کارفرمای گرامی؛ اکیپ تکنسین نمونه‌برداری بتن آزمایشگاه جهت نمونه‌گیری پروژه «${proj}» اعزام گردید.\nتکنسین مربوطه به زودی با شما تماس خواهد گرفت.\n${LAB_INFO.name}`);
        break;
      case 'custom':
      default:
        setSmsMessage(`کارفرمای محترم ${custName}؛ با سلام، جهت هماهنگی امور آزمایشگاهی با شماره تلفن ${LAB_INFO.phone} تماس حاصل فرمایید.\n${LAB_INFO.name}`);
        break;
    }
  };

  const handleCustomerChange = (cId: string) => {
    setSelectedCustomerId(cId);
    const c = customers.find(x => x.id === cId);
    if (c) {
      setCustomPhone(c.phone || '');
      applyTemplate(selectedEventType, c);
    }
  };

  const handleEventTypeChange = (eType: SmsEvent) => {
    setSelectedEventType(eType);
    const c = customers.find(x => x.id === selectedCustomerId);
    applyTemplate(eType, c);
  };

  const handleSendSmsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPhone.trim() || !smsMessage.trim()) {
      setSendErrorMsg('شماره تلفن گیرنده و متن پیامک الزامی است.');
      return;
    }
    setSendErrorMsg(null);

    const c = customers.find(x => x.id === selectedCustomerId);

    labDb.sendSms({
      customerId: c?.id,
      customerName: c?.companyName || 'مشتری مستقیم',
      recipientPhone: customPhone.trim(),
      eventType: selectedEventType,
      message: smsMessage.trim(),
      projectName: c?.projectNames?.[0]
    });

    setSendSuccessToast(`پیامک با موفقیت به شماره ${toPersianDigits(customPhone)} ارسال شد.`);
    setShowSendModal(false);
    setSmsMessage('');
    setTimeout(() => setSendSuccessToast(null), 4000);
  };

  const filteredLogs = smsLogs.filter(log => {
    const eventMatch = log.event || (log as any).eventType;
    if (selectedEventFilter !== 'all' && eventMatch !== selectedEventFilter) return false;
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.recipientPhone.includes(q) ||
        (log.customerName && log.customerName.toLowerCase().includes(q)) ||
        (log.projectName && log.projectName.toLowerCase().includes(q)) ||
        log.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {sendSuccessToast && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sendSuccessToast}</span>
          </div>
          <button onClick={() => setSendSuccessToast(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Gateway Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-3xl shadow-md flex items-center justify-between border border-blue-800/60">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-blue-200">سامانه پیامک خودکار آزمایشگاه (GSM Gateway)</span>
            </div>
            <h3 className="text-lg font-black text-white">
              درگاه اطلاع‌رسانی پیامکی مشتریان
            </h3>
            <p className="text-xs text-blue-300/90 leading-relaxed">
              ارسال آنی پیامک به کارفرمایان هنگام ثبت نمونه، تایید مقاومت ۷ و ۲۸ روزه، صدور فاکتور و اعزام تکنسین
            </p>
          </div>

          <button
            onClick={() => {
              if (customers.length > 0) {
                handleCustomerChange(customers[0].id);
              }
              setShowSendModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>ارسال پیامک جدید</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">وضعیت سرخط و وب‌سرویس</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              فعال و متصل
            </span>
          </div>
          <div className="mt-2">
            <div className="font-mono text-sm font-black text-slate-800 dark:text-white">
              خط اختصاصی: ۳۰۰۰۲۱۴۴
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              اعتبار باقی‌مانده: <strong className="text-blue-600 font-mono">۴,۲۵۰</strong> پیامک
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">آمار ارسال‌ها</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {toPersianDigits(smsLogs.length)}
            </span>
            <span className="text-xs text-slate-500">پیامک دیسپچ شده</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">
            ۱۰۰٪ نرخ تحویل موفق به مخابرات
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedEventFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedEventFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              همه رویدادها ({toPersianDigits(smsLogs.length)})
            </button>
            {(Object.keys(SMS_EVENT_LABELS) as SmsEvent[]).map(ev => {
              const count = smsLogs.filter(l => (l.event || (l as any).eventType) === ev).length;
              return (
                <button
                  key={ev}
                  onClick={() => setSelectedEventFilter(ev)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedEventFilter === ev
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {SMS_EVENT_LABELS[ev]} ({toPersianDigits(count)})
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در شماره، مشتری یا متن پیام..."
              className="w-full ps-9 pe-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* SMS Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-800/40">
                <th className="p-3">گیرنده / کارفرما</th>
                <th className="p-3">شماره تماس</th>
                <th className="p-3">نوع رویداد</th>
                <th className="p-3 min-w-[280px]">متن پیامک ارسالی</th>
                <th className="p-3">زمان ارسال</th>
                <th className="p-3 text-center">وضعیت تحویل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map(log => {
                const evKey: SmsEvent = log.event || (log as any).eventType || 'custom';
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      <div>{log.customerName || log.recipientName || 'مشتری آزمایشگاه'}</div>
                      {log.projectName && (
                        <span className="text-[10px] text-slate-400 font-normal block">{log.projectName}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                      {log.recipientPhone}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${SMS_EVENT_COLORS[evKey] || SMS_EVENT_COLORS.custom}`}>
                        {SMS_EVENT_LABELS[evKey] || 'اطلاع‌رسانی'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        {log.message}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                      <div>{toPersianDigits(log.jalaliDate || '')}</div>
                      <div className="text-[10px] text-slate-400">{toPersianDigits(log.jalaliTime || '')}</div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {log.status === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          تحویل داده شد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-[10px]">
                          <Clock className="w-3 h-3 text-blue-600" />
                          در صف ارسال
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

      {/* Compose & Send SMS Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ارسال پیامک اطلاع‌رسانی به کارفرما
                </h3>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendSmsSubmit} className="space-y-4 text-xs">
              {sendErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{sendErrorMsg}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">انتخاب کارفرما</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.representativeName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">شماره موبایل گیرنده *</label>
                  <input
                    type="tel"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="0913xxxxxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-start"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">قالب پیش‌فرض پیامک</label>
                <select
                  value={selectedEventType}
                  onChange={(e) => handleEventTypeChange(e.target.value as SmsEvent)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  {(Object.keys(SMS_EVENT_LABELS) as SmsEvent[]).map(ev => (
                    <option key={ev} value={ev}>{SMS_EVENT_LABELS[ev]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300">متن پیامک *</label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {toPersianDigits(smsMessage.length)} کاراکتر (۱ پیامک فارسی)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="متن پیامک را اینجا وارد کنید..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-sans"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-500 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                <span>پیامک از سرخط ۳۰۰۰ به صورت آنی به تلفن همراه کارفرما ارسال و در سوابق ذخیره می‌گردد.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال فوری پیامک</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
