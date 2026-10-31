import React, { useState } from 'react';
import { Language } from '../../utils/i18n';
import { labDb } from '../../services/supabase';
import { getTodayJalali, formatJalali } from '../../utils/jalali';
// BUG FIX (ID collision): lead id was `uniqueId('lead')`
import { uniqueId } from '../../utils/uniqueId';
import {
  Phone, 
  Mail, 
  User,
  CheckCircle2, 
  AlertCircle,
  X, 
  Send,
  Headphones,
  Ticket
} from 'lucide-react';

interface TestRequestWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const TestRequestWizardModal: React.FC<TestRequestWizardModalProps> = ({
  isOpen,
  onClose,
  language
}) => {
  const isFa = language === 'fa';
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const [contactError, setContactError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toEnglishDigits = (str: string): string => {
    return (str || '')
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    const cleanName = fullName.trim();
    const cleanPhone = toEnglishDigits(contact.trim()).replace(/[^0-9]/g, '');
    
    if (!cleanName) return;

    if (cleanPhone.length !== 11) {
      setContactError(isFa ? 'شماره تماس باید حتماً ۱۱ رقمی باشد (مانند ۰۹۱۲۳۴۵۶۷۸۹).' : 'Phone number must be exactly 11 digits.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const todayJalali = formatJalali(getTodayJalali());
      const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      // Save the callback request before displaying a tracking code
      const newDispatch = await labDb.addCallbackRequest({
        customerId: uniqueId('lead'),
        customerName: cleanName,
        projectName: 'درخواست آنلاین آزمایشگاه',
        projectAddress: 'هماهنگی تلفنی با متقاضی',
        contactPhone: cleanPhone,
        scheduledDateJalali: todayJalali,
        scheduledTime: nowTime,
        serviceType: 'درخواست تماس و مشاوره',
        status: 'requested',
        notes: `درخواست ثبت‌شده از وب‌سایت • متقاضی: ${cleanName} • شماره تماس: ${cleanPhone} • ساعت: ${nowTime}`
      });

      setSubmittedTicket(newDispatch.ticketNo);
    } catch (err) {
      console.error(err);
      setContactError(isFa ? 'ثبت درخواست ناموفق بود. لطفاً دوباره تلاش کنید.' : 'Could not submit your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSubmittedTicket(null);
      setFullName('');
      setContact('');
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir={isFa ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isFa ? 'درخواست تماس پشتیبانی' : 'Request Callback'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isFa ? 'برای مشاوره و ثبت سفارش اطلاعات خود را وارد کنید' : 'Enter your info for consultation and order'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 transition flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {submittedTicket ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 animate-in zoom-in spin-in-12 duration-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {isFa ? 'درخواست شما با موفقیت ثبت شد' : 'Request Submitted Successfully'}
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <span className="block text-slate-400 mb-1">{isFa ? 'کد پیگیری درخواست:' : 'Ticket Number:'}</span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-sky-400">{submittedTicket}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                {isFa 
                  ? 'اطلاعات شما به ایستگاه اپراتور ارسال گردید. کارشناسان به زودی جهت هماهنگی با شما تماس خواهند گرفت.' 
                  : 'Your request was dispatched to the laboratory operator. Our team will contact you shortly.'}
              </p>
              
              <button
                onClick={handleClose}
                className="mt-6 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isFa ? 'بستن' : 'Close'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {contactError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{contactError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {isFa ? 'نام و نام خانوادگی / نام شرکت' : 'Full Name / Company'}
                </label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isFa ? 'مثال: علی محمدی' : 'e.g. Ali Mohammadi'}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 ps-9 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {isFa ? 'شماره تماس (۱۱ رقم)' : 'Phone Number (11 digits)'}
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {contact.length > 0 && `${contact.length} / ۱۱`}
                  </span>
                </div>
                <div className="relative">
                  <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="tel"
                    maxLength={11}
                    value={contact}
                    onChange={(e) => {
                      const clean = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                      if (clean.length <= 11) {
                        setContact(clean);
                      }
                    }}
                    placeholder="09123456789"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 ps-9 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono tracking-wider text-left"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {isFa ? 'شماره همراه حتماً باید ۱۱ رقم باشد (مثال: ۰۹۱۲۳۴۵۶۷۸۹)' : 'Phone number must be exactly 11 digits'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-70 mt-4 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 rtl:rotate-180" />
                    <span>{isFa ? 'ثبت درخواست تماس' : 'Submit Request'}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
