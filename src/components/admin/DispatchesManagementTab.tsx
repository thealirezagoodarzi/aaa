import { isCallbackRequest } from '../../utils/dispatchKind';
import React, { useState, useEffect } from 'react';
import { TechnicianDispatch, Customer, FieldTechnician } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { TechniciansManagementModal } from './TechniciansManagementModal';
import { 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  MapPin, 
  Calendar, 
  Search, 
  Printer, 
  Building2, 
  Check, 
  ArrowRight,
  PlusCircle,
  Trash2,
  AlertCircle,
  Users
} from 'lucide-react';

export const DispatchesManagementTab: React.FC = () => {
  const [dispatches, setDispatches] = useState<TechnicianDispatch[]>(() => labDb.getDispatches().filter(d => !isCallbackRequest(d)));
  const [customers, setCustomers] = useState<Customer[]>(() => labDb.getCustomers());
  const [technicians, setTechnicians] = useState<FieldTechnician[]>(() => labDb.getTechnicians());
  const [showTechsModal, setShowTechsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'assigned' | 'completed'>('all');
  const [search, setSearch] = useState('');
  
  // Assigning modal
  const [assigningItem, setAssigningItem] = useState<TechnicianDispatch | null>(null);
  const [techName, setTechName] = useState(() => {
    const techs = labDb.getTechnicians();
    return techs.find(t => t.isActive)?.fullName || 'مهندس سهراب مرادی';
  });

  // New Dispatch modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [serviceType, setServiceType] = useState('نمونه‌برداری بتن تازه و قالب‌گیری مکعبی');
  const [scheduledDateJalali, setScheduledDateJalali] = useState(() => formatJalali(getTodayJalali()));
  const [scheduledTime, setScheduledTime] = useState('09:30');
  const [dispatchTechnician, setDispatchTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = labDb.subscribe(() => {
      setDispatches(labDb.getDispatches().filter(d => !isCallbackRequest(d)));
      setCustomers(labDb.getCustomers());
      setTechnicians(labDb.getTechnicians());
    });
    return unsub;
  }, []);

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningItem) return;
    labDb.updateDispatchStatus(assigningItem.id, 'assigned', techName);
    setAssigningItem(null);
    setSuccessMsg(`تکنسین ${techName} برای برگه ${assigningItem.ticketNo} تخصیص یافت.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleComplete = (id: string) => {
    labDb.updateDispatchStatus(id, 'completed');
    setSuccessMsg('عملیات اعزام به وضعیت "انجام شده" تغییر یافت.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDelete = (id: string, ticketNo: string) => {
    if (confirm(`آیا از لغو و حذف برگه اعزام شماره ${ticketNo} اطمینان دارید؟`)) {
      labDb.deleteDispatch(id);
      setDispatches(labDb.getDispatches().filter(d => !isCallbackRequest(d)));
      setSuccessMsg(`برگه اعزام ${ticketNo} با موفقیت حذف گردید.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const c = customers.find(x => x.id === custId);
    if (c) {
      setCustomerName(c.companyName);
      setContactPhone(c.phone || '');
      setProjectAddress(c.address || '');
      if (c.projectNames && c.projectNames.length > 0) {
        setProjectName(c.projectNames[0]);
      }
    }
  };

  const handleCreateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !projectName) return;

    labDb.addDispatch({
      customerId: selectedCustomerId || 'cust-direct',
      customerName,
      projectName,
      projectAddress: projectAddress || 'محل کارگاه ثبت نشده',
      contactPhone: contactPhone || '۰۲۱',
      scheduledDateJalali,
      scheduledTime,
      serviceType,
      technicianName: dispatchTechnician || undefined,
      status: dispatchTechnician ? 'assigned' : 'requested',
      notes: notes || undefined
    });

    setShowCreateModal(false);
    // Reset form
    setSelectedCustomerId('');
    setCustomerName('');
    setProjectName('');
    setProjectAddress('');
    setContactPhone('');
    setDispatchTechnician('');
    setNotes('');
    setSuccessMsg('نوبت اعزام تکنسین با موفقیت ثبت شد.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const filtered = dispatches.filter(d => {
    const matchSearch = d.ticketNo.toLowerCase().includes(search.toLowerCase()) ||
                        d.projectName.toLowerCase().includes(search.toLowerCase()) ||
                        d.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 text-start">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-600" />
            <span>کارتابل اعزام تکنسین‌های آزمایشگاه مقیم به کارگاه‌های ساختمانی</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            مدیریت نوبت‌بندی نمونه‌برداری بتن تازه، هماهنگی زمان بتن‌ریزی با کارفرمایان و تخصیص اکیپ‌های مجهز به وسایل اسلامپ و قالب‌گیری.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-center">
            <span className="text-[10px] text-amber-600 block">درخواست‌های جدید:</span>
            <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
              {toPersianDigits(dispatches.filter(d => d.status === 'requested').length)} مورد
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-center">
            <span className="text-[10px] text-emerald-600 block">اعزام‌های انجام‌شده:</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {toPersianDigits(dispatches.filter(d => d.status === 'completed').length)} مورد
            </span>
          </div>
        </div>
      </div>

      {/* Dispatches List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
        
        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="جستجو در شماره برگه، نام کارفرما یا پروژه..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                همه ({toPersianDigits(dispatches.length)})
              </button>
              <button
                onClick={() => setFilterStatus('requested')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterStatus === 'requested'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                در صف بررسی
              </button>
              <button
                onClick={() => setFilterStatus('assigned')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterStatus === 'assigned'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                تکنسین تخصیص‌داده
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterStatus === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                انجام شد
              </button>
            </div>

            <button
              onClick={() => setShowTechsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>مدیریت و تعریف تکنسین‌های اعزام</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>ثبت نوبت اعزام جدید</span>
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {/* List of Dispatches */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-500/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs">
                    {item.ticketNo}
                  </span>
                  <strong className="text-sm font-black text-slate-900 dark:text-white">
                    {item.projectName}
                  </strong>
                  <span className="text-xs text-slate-500">
                    (کارفرما: {item.customerName})
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {item.serviceType}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    {item.projectAddress}
                  </span>
                  <span>تلفن تماس هماهنگی: {toPersianDigits(item.contactPhone)}</span>
                  {item.notes && <span className="text-amber-600">یادداشت: {item.notes}</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-start md:text-end font-mono text-xs">
                  <span className="text-[11px] text-slate-400 block font-sans">تاریخ و ساعت:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {toPersianDigits(item.scheduledDateJalali)} - {item.scheduledTime}
                  </span>
                  {item.technicianName && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold block font-sans">
                      تکنسین مسئول: {item.technicianName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'requested' && (
                    <button
                      onClick={() => setAssigningItem(item)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>تخصیص تکنسین</span>
                    </button>
                  )}

                  {item.status === 'assigned' && (
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ثبت اتمام ماموریت</span>
                    </button>
                  )}

                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
                      <Check className="w-3.5 h-3.5" />
                      انجام شد
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(item.id, item.ticketNo)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 dark:text-slate-500 transition cursor-pointer"
                    title="حذف برگه اعزام"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Dispatch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-start my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>ثبت نوبت اعزام تکنسین آزمایشگاه به پروژه</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  انتخاب شرکت / کارفرما:
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- ثبت آزاد / انتخاب از فهرست کارفرمایان طرف قرارداد --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.representativeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام شرکت / کارفرما *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="شرکت مهندسی سازه..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام پروژه *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="برج مسکونی یاس"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره تماس هماهنگی *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="0912..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع خدمت مورد درخواست
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="نمونه‌برداری بتن تازه و قالب‌گیری مکعبی">نمونه‌برداری بتن تازه و قالب‌گیری مکعبی</option>
                    <option value="تست اسلامپ و روانی بتن پای تراک میکسر">تست اسلامپ و روانی بتن پای تراک میکسر</option>
                    <option value="مغزه‌گیری بتن سخت‌شده (Core Drill)">مغزه‌گیری بتن سخت‌شده (Core Drill)</option>
                    <option value="آزمون غیرمخرب چکش اشمیت و مقاومت سطحی">آزمون غیرمخرب چکش اشمیت و مقاومت سطحی</option>
                    <option value="تست التراسونیک بتن (UPV)">تست التراسونیک بتن (UPV)</option>
                    <option value="نظارت مقیم بر فرایند بچینگ و بتن‌ریزی">نظارت مقیم بر فرایند بچینگ و بتن‌ریزی</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  آدرس دقیق کارگاه و محل بتن‌ریزی
                </label>
                <input
                  type="text"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="تهران، بزرگراه شهید همت، تقاطع..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاریخ اعزام (شمسی) *
                  </label>
                  <input
                    type="text"
                    required
                    value={scheduledDateJalali}
                    onChange={(e) => setScheduledDateJalali(e.target.value)}
                    placeholder="1403/07/20"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ساعت حضور در کارگاه *
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تکنسین مسئول اعزام (اختیاری):
                </label>
                <select
                  value={dispatchTechnician}
                  onChange={(e) => setDispatchTechnician(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">-- در صف بررسی (تخصیص در آینده) --</option>
                  {technicians.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.fullName}>
                      {t.fullName} ({t.specialty || 'تکنسین آزمایشگاه'}) - {t.phone}
                    </option>
                  ))}
                  {technicians.filter(t => t.isActive).length === 0 && (
                    <>
                      <option value="مهندس سهراب مرادی">مهندس سهراب مرادی (سرپرست اکیپ نمونه‌گیری)</option>
                      <option value="مهندس رضا کاظمی">مهندس رضا کاظمی (تکنسین آزمایشگاه بتن)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات و دستورکار ویژه:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="حجم بتن‌ریزی حدود ۸۰ مترمکعب، تهیه ۶ نمونه مکعبی ۱۵×۱۵..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  ثبت برگه اعزام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-start">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span>تخصیص تکنسین نمونه‌برداری</span>
              </h3>
              <button onClick={() => setAssigningItem(null)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div>برگه: <strong className="font-mono text-blue-600">{assigningItem.ticketNo}</strong></div>
                <div>پروژه: <strong>{assigningItem.projectName}</strong></div>
                <div>زمان: <strong>{toPersianDigits(assigningItem.scheduledDateJalali)} - {assigningItem.scheduledTime}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  انتخاب تکنسین مجرب آزمایشگاه:
                </label>
                <select
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {technicians.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.fullName}>
                      {t.fullName} ({t.specialty || 'تکنسین آزمایشگاه'}) - {t.phone}
                    </option>
                  ))}
                  {technicians.filter(t => t.isActive).length === 0 && (
                    <>
                      <option value="مهندس سهراب مرادی">مهندس سهراب مرادی (سرپرست اکیپ نمونه‌گیری)</option>
                      <option value="مهندس رضا کاظمی">مهندس رضا کاظمی (تکنسین آزمایشگاه بتن)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  تایید و صدور دستور اعزام
                </button>
                <button
                  type="button"
                  onClick={() => setAssigningItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technicians Management Modal */}
      {showTechsModal && (
        <TechniciansManagementModal
          isOpen={showTechsModal}
          onClose={() => setShowTechsModal(false)}
          onUpdated={() => {
            setTechnicians(labDb.getTechnicians());
          }}
        />
      )}

    </div>
  );
};
