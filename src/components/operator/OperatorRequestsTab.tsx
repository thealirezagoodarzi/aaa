import React, { useState, useEffect } from 'react';
import { TechnicianDispatch, Customer, UserProfile } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { printOnlyElement } from '../../utils/printDom';
import { 
  Phone, 
  Clock, 
  UserCheck, 
  MapPin, 
  Calendar, 
  Search, 
  Printer, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  PlusCircle,
  FlaskConical,
  Trash2,
  X,
  Send,
  ExternalLink,
  ClipboardList
} from 'lucide-react';

interface OperatorRequestsTabProps {
  currentUser: UserProfile;
}

export const isContactLead = (disp: TechnicianDispatch): boolean => {
  if (disp.requestCategory === 'contact_lead') return true;
  if (disp.requestCategory === 'field_dispatch') return false;
  const cId = disp.customerId?.toLowerCase() || '';
  const proj = disp.projectName?.toLowerCase() || '';
  const srv = disp.serviceType?.toLowerCase() || '';
  const notes = disp.notes?.toLowerCase() || '';
  const addr = disp.projectAddress?.toLowerCase() || '';
  return (
    cId.startsWith('lead') ||
    proj.includes('وب‌سایت') ||
    proj.includes('مشاوره') ||
    srv.includes('مشاوره') ||
    srv.includes('تماس') ||
    addr.includes('هماهنگی تلفنی') ||
    notes.includes('مشاوره')
  );
};

export const OperatorRequestsTab: React.FC<OperatorRequestsTabProps> = ({
  currentUser
}) => {
  const [dispatches, setDispatches] = useState<TechnicianDispatch[]>(() => labDb.getDispatches());
  const [customers, setCustomers] = useState<Customer[]>(() => labDb.getCustomers());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'contact_leads' | 'field_dispatches'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'assigned' | 'completed'>('all');
  const [search, setSearch] = useState('');
  
  // Assigning modal
  const [assigningItem, setAssigningItem] = useState<TechnicianDispatch | null>(null);
  const [techName, setTechName] = useState('مهندس سهراب مرادی');
  
  // Print preview modal
  const [printingItem, setPrintingItem] = useState<TechnicianDispatch | null>(null);

  // Success message toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refreshData = () => {
    setDispatches(labDb.getDispatches());
    setCustomers(labDb.getCustomers());
  };

  useEffect(() => {
    refreshData();
    const unsub = labDb.subscribe(() => {
      refreshData();
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningItem) return;
    labDb.updateDispatchStatus(assigningItem.id, 'assigned', techName);
    setAssigningItem(null);
    showToast(`تکنسین ${techName} برای درخواست ${assigningItem.ticketNo} تخصیص یافت.`);
    refreshData();
  };

  const handleStatusChange = (id: string, newStatus: TechnicianDispatch['status']) => {
    labDb.updateDispatchStatus(id, newStatus, currentUser.fullName);
    showToast('وضعیت درخواست با موفقیت تغییر یافت.');
    refreshData();
  };

  const handleDelete = (id: string, ticketNo: string) => {
    if (confirm(`آیا از حذف درخواست آزمایش شماره ${ticketNo} اطمینان دارید؟`)) {
      labDb.deleteDispatch(id);
      refreshData();
      showToast(`درخواست ${ticketNo} با موفقیت حذف شد.`);
    }
  };

  // Distinct groups
  const contactLeads = dispatches.filter(isContactLead);
  const fieldDispatches = dispatches.filter(d => !isContactLead(d));

  const pendingContactLeads = contactLeads.filter(d => d.status === 'requested');
  const pendingFieldDispatches = fieldDispatches.filter(d => d.status === 'requested');

  // Filtered requests by category
  const categoryScopedDispatches = dispatches.filter(d => {
    if (categoryFilter === 'contact_leads') return isContactLead(d);
    if (categoryFilter === 'field_dispatches') return !isContactLead(d);
    return true;
  });

  // Filtered requests by status and search query
  const filteredDispatches = categoryScopedDispatches.filter(d => {
    const matchesFilter = filterStatus === 'all' || d.status === filterStatus;
    const q = search.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      d.customerName.toLowerCase().includes(q) ||
      d.ticketNo.toLowerCase().includes(q) ||
      (d.contactPhone && d.contactPhone.includes(q)) ||
      (d.projectName && d.projectName.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const requestedCount = categoryScopedDispatches.filter(d => d.status === 'requested').length;
  const assignedCount = categoryScopedDispatches.filter(d => d.status === 'assigned').length;
  const completedCount = categoryScopedDispatches.filter(d => d.status === 'completed').length;

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800 dark:text-slate-100 font-sans" dir="rtl">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Overview Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                مدیریت درخواست‌های متقاضیان و اعزام تکنسین
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تفکیک هوشمند درخواست‌های تماس و مشاوره وب‌سایت از مأموریت‌های اعزام تکنسین نمونه‌برداری کارگاهی
              </p>
            </div>
          </div>
        </div>

        {/* Action Counters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center min-w-[100px]">
            <span className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">تماس وب‌سایت</span>
            <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
              {toPersianDigits(contactLeads.length)}
              {pendingContactLeads.length > 0 && (
                <span className="text-[10px] text-rose-500 mr-1 font-bold">({toPersianDigits(pendingContactLeads.length)} جدید)</span>
              )}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-center min-w-[100px]">
            <span className="block text-[11px] font-bold text-blue-600 dark:text-blue-400">اعزام تکنسین</span>
            <span className="text-base font-black font-mono text-blue-700 dark:text-blue-300">
              {toPersianDigits(fieldDispatches.length)}
              {pendingFieldDispatches.length > 0 && (
                <span className="text-[10px] text-rose-500 mr-1 font-bold">({toPersianDigits(pendingFieldDispatches.length)} جدید)</span>
              )}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-center min-w-[100px]">
            <span className="block text-[11px] font-bold text-rose-600 dark:text-rose-400">کل موارد در انتظار</span>
            <span className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
              {toPersianDigits(requestedCount)}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Category Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          onClick={() => { setCategoryFilter('all'); }}
          className={`p-3.5 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">همه درخواست‌ها و اعزام‌ها</span>
          </div>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${categoryFilter === 'all' ? 'bg-white/20 text-white dark:bg-slate-800 dark:text-slate-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            {toPersianDigits(dispatches.length)}
          </span>
        </button>

        <button
          onClick={() => { setCategoryFilter('contact_leads'); }}
          className={`p-3.5 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            categoryFilter === 'contact_leads'
              ? 'bg-emerald-600 text-white border-transparent shadow-md'
              : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 shrink-0 text-emerald-500" />
            <div>
              <span className="text-xs font-bold block">درخواست‌های تماس و مشاوره سایت</span>
              <span className={`text-[10px] block ${categoryFilter === 'contact_leads' ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                شماره‌های ثبت شده متقاضیان آنلاین
              </span>
            </div>
          </div>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${categoryFilter === 'contact_leads' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'}`}>
            {toPersianDigits(contactLeads.length)}
          </span>
        </button>

        <button
          onClick={() => { setCategoryFilter('field_dispatches'); }}
          className={`p-3.5 rounded-2xl border transition-all text-start flex items-center justify-between cursor-pointer ${
            categoryFilter === 'field_dispatches'
              ? 'bg-blue-600 text-white border-transparent shadow-md'
              : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 shrink-0 text-blue-500" />
            <div>
              <span className="text-xs font-bold block">مأموریت‌های اعزام تکنسین</span>
              <span className={`text-[10px] block ${categoryFilter === 'field_dispatches' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                نمونه‌برداری و اسلامپ در پای‌کار
              </span>
            </div>
          </div>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${categoryFilter === 'field_dispatches' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}`}>
            {toPersianDigits(fieldDispatches.length)}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${filterStatus === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            همه موارد ({toPersianDigits(categoryScopedDispatches.length)})
          </button>
          <button
            onClick={() => setFilterStatus('requested')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${filterStatus === 'requested' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
            <span>جدید / نیازمند تماس ({toPersianDigits(requestedCount)})</span>
          </button>
          <button
            onClick={() => setFilterStatus('assigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${filterStatus === 'assigned' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            {categoryFilter === 'contact_leads' ? 'پیگیری شده / هماهنگ شده' : 'تکنسین اعزام شده'} ({toPersianDigits(assignedCount)})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${filterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            تکمیل شده ({toPersianDigits(completedCount)})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در متقاضی، تلفن، کد..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 ps-9 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Dispatches List */}
      {filteredDispatches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {filterStatus === 'requested' 
              ? 'در حال حاضر هیچ درخواست تماس جدیدی در انتظار ثبت نشده است.' 
              : 'هیچ درخواست آزمونی با این مشخصات یافت نشد.'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {filterStatus === 'requested'
              ? 'به محض ثبت فرم درخواست آزمایش یا مشاوره توسط متقاضیان واقعی در وب‌سایت، مشخصات و شماره تماس آن‌ها بلافاصله در این بخش نمایان خواهد شد.'
              : 'می‌توانید فیلتر وضعیت یا عبارت جستجو را تغییر دهید.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDispatches.map((disp) => {
            const isRequested = disp.status === 'requested';
            const isAssigned = disp.status === 'assigned';
            const isCompleted = disp.status === 'completed';
            const isLead = isContactLead(disp);

            return (
              <div 
                key={disp.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                  isLead
                    ? isRequested 
                      ? 'border-emerald-300 dark:border-emerald-700/80 ring-2 ring-emerald-500/15 bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900' 
                      : 'border-emerald-200/80 dark:border-emerald-900/40'
                    : isRequested 
                    ? 'border-rose-300 dark:border-rose-800/80 ring-2 ring-rose-500/10' 
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                          {disp.ticketNo}
                        </span>
                        {isLead ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                            <Phone className="w-2.5 h-2.5 text-emerald-600" />
                            درخواست تماس سایت
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            <Truck className="w-2.5 h-2.5 text-blue-600" />
                            اعزام تکنسین
                          </span>
                        )}
                        {isRequested && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 animate-pulse">
                            جدید
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                        {disp.customerName}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                      isRequested 
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900' 
                        : isAssigned 
                        ? isLead
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {isRequested 
                        ? (isLead ? 'در انتظار تماس' : 'نیازمند هماهنگی') 
                        : isAssigned 
                        ? (isLead ? 'تماس گرفته شد' : 'اعزام تکنسین') 
                        : 'تکمیل شد'}
                    </span>
                  </div>

                  {/* Details List */}
                  <div className={`space-y-2 text-xs p-3 rounded-2xl border ${
                    isLead 
                      ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">شماره تماس:</span>
                      <a 
                        href={`tel:${disp.contactPhone}`}
                        className="font-mono font-bold text-slate-900 dark:text-white hover:text-emerald-600 flex items-center gap-1 dir-ltr text-xs bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <Phone className="w-3 h-3 text-emerald-500" />
                        <span>{disp.contactPhone}</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">زمان ثبت:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium font-mono text-[11px]">
                        {disp.scheduledDateJalali} {disp.scheduledTime ? `- ${disp.scheduledTime}` : ''}
                      </span>
                    </div>

                    {isLead ? (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">موضوع:</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold truncate max-w-[150px]">
                          {disp.projectName || 'درخواست تماس و مشاوره'}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">پروژه:</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
                            {disp.projectName || 'پروژه بتن‌ریزی'}
                          </span>
                        </div>
                        {disp.projectAddress && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">آدرس:</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
                              {disp.projectAddress}
                            </span>
                          </div>
                        )}
                        {disp.technicianName && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
                            <span className="text-slate-400 text-[11px]">تکنسین مسئول:</span>
                            <span className="text-blue-600 dark:text-sky-400 font-bold">
                              {disp.technicianName}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {disp.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 pt-1 border-t border-slate-200/40 dark:border-slate-800">
                        {disp.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {/* Call Button */}
                  <a
                    href={`tel:${disp.contactPhone}`}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>تماس تلفنی با متقاضی ({disp.contactPhone})</span>
                  </a>

                  {/* Second row of actions */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    {!isLead && (
                      <button
                        onClick={() => setAssigningItem(disp)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3 text-blue-500" />
                        <span>{disp.technicianName ? 'تغییر تکنسین' : 'تخصیص تکنسین'}</span>
                      </button>
                    )}

                    {/* Change Status */}
                    {isRequested ? (
                      <button
                        onClick={() => handleStatusChange(disp.id, 'assigned')}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer flex-1 justify-center"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isLead ? 'تماس برقرار شد' : 'هماهنگ شد'}</span>
                      </button>
                    ) : isAssigned ? (
                      <button
                        onClick={() => handleStatusChange(disp.id, 'completed')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer flex-1 justify-center"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isLead ? 'مشاوره تکمیل شد' : 'نمونه‌گیری انجام شد'}</span>
                      </button>
                    ) : null}

                    {/* Print Dispatch Sheet (Only for field dispatches) */}
                    {!isLead && (
                      <button
                        onClick={() => setPrintingItem(disp)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                        title="چاپ برگه اعزام"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(disp.id, disp.ticketNo)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 transition cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Technician Modal */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  تخصیص تکنسین نمونه‌برداری
                </h3>
              </div>
              <button 
                onClick={() => setAssigningItem(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <div><span className="text-slate-400">متقاضی:</span> <span className="font-bold">{assigningItem.customerName}</span></div>
              <div><span className="text-slate-400">کد برگه:</span> <span className="font-mono">{assigningItem.ticketNo}</span></div>
              <div><span className="text-slate-400">شماره تماس:</span> <span className="font-mono">{assigningItem.contactPhone}</span></div>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  انتخاب تکنسین آزمایشگاه
                </label>
                <select
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="مهندس سهراب مرادی">مهندس سهراب مرادی (تکنسین ارشد بتن)</option>
                  <option value="سارا رضایی">سارا رضایی (اپراتور آزمایشگاه)</option>
                  <option value="مهندس فرشید کمالی">مهندس فرشید کمالی (ناظر کنترل کیفی)</option>
                  <option value="مهندس علی گودرزی">مهندس علی گودرزی (تکنسین نمونه‌برداری)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningItem(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  ثبت و تخصیص
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Dispatch Ticket Modal */}
      {printingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm">برگه ماموریت و اعزام نمونه‌برداری کارگاهی</h3>
              <button onClick={() => setPrintingItem(null)} className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="printable-dispatch-ticket" className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-300 text-xs space-y-3 font-sans">
              <div className="text-center border-b pb-2 space-y-0.5">
                <div className="font-black text-sm text-blue-900">آزما بتن پایش خاک و پی جهان بین</div>
                <div className="text-[10px] text-slate-500">برگه رسمی اعزام تکنسین نمونه‌برداری بتن تازه به کارگاه</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500">شماره رهگیری:</span> <strong className="font-mono">{printingItem.ticketNo}</strong></div>
                <div><span className="text-slate-500">تاریخ درخواست:</span> <strong>{printingItem.scheduledDateJalali}</strong></div>
                <div><span className="text-slate-500">نام متقاضی:</span> <strong>{printingItem.customerName}</strong></div>
                <div><span className="text-slate-500">شماره تماس:</span> <strong className="font-mono" dir="ltr">{printingItem.contactPhone}</strong></div>
                <div className="col-span-2"><span className="text-slate-500">محل پروژه:</span> <strong>{printingItem.projectAddress || 'طبق هماهنگی تلفنی با متقاضی'}</strong></div>
                <div className="col-span-2"><span className="text-slate-500">شرح خدمات:</span> <strong>{printingItem.serviceType}</strong></div>
                <div className="col-span-2"><span className="text-slate-500">تکنسین اعزامی:</span> <strong className="text-blue-700">{printingItem.technicianName || 'تعیین نشده'}</strong></div>
              </div>

              <div className="pt-4 border-t border-dashed grid grid-cols-2 text-center text-[10px] text-slate-500">
                <div>امضای تکنسین نمونه‌بردار</div>
                <div>امضا و تایید نماینده کارگاه / کارفرما</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPrintingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
              >
                بستن
              </button>
              <button
                onClick={() => { if (!printOnlyElement('printable-dispatch-ticket')) window.print(); }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ برگه</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
