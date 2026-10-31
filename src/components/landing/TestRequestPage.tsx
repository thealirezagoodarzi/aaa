import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Language } from '../../utils/i18n';
import { CompanyLogo } from '../common/CompanyLogo';
import { labDb, LAB_INFO } from '../../services/supabase';
import { getTodayJalali, formatJalali } from '../../utils/jalali';
// BUG FIX (ID collision): lead id was `uniqueId('lead')`
import { uniqueId } from '../../utils/uniqueId';
import {
  ArrowRight, 
  ArrowLeft, 
  User, 
  Phone, 
  ShieldCheck, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle,
  BellRing,
  Sparkles
} from 'lucide-react';

interface TestRequestPageProps {
  onBack: () => void;
  language: Language;
  isDarkMode?: boolean;
}

// Convert Persian/Arabic numerals to standard digits
const toEnglishDigits = (str: string): string => {
  return (str || '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

// Generate a random 4-character alphanumeric captcha
const generateRandomCaptcha = (): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < 4; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

export const TestRequestPage: React.FC<TestRequestPageProps> = ({
  onBack,
  language
}) => {
  const isFa = language === 'fa';
  const todayJalali = formatJalali(getTodayJalali());

  // Form states: only Name, Phone, and Security Code
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState<string>(() => generateRandomCaptcha());
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const refreshCaptcha = () => {
    setCaptchaCode(generateRandomCaptcha());
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setErrorMessage(isFa ? 'لطفاً نام و نام خانوادگی خود را وارد کنید.' : 'Please enter your name.');
      return;
    }

    const digitsOnly = toEnglishDigits(phone.trim()).replace(/[^0-9]/g, '');
    if (digitsOnly.length !== 11) {
      setErrorMessage(
        isFa 
          ? 'شماره تلفن حتماً باید ۱۱ رقمی باشد (مثال: ۰۹۱۲۳۴۵۶۷۸۹).' 
          : 'Phone number must be exactly 11 digits (e.g. 09123456789).'
      );
      return;
    }

    const cleanCaptchaInput = toEnglishDigits(captchaInput.trim()).toUpperCase();
    const cleanCaptchaExpected = captchaCode.toUpperCase();
    if (!cleanCaptchaInput || cleanCaptchaInput !== cleanCaptchaExpected) {
      setErrorMessage(
        isFa 
          ? 'کد امنیتی صحیح نمی‌باشد. کد جدید تولید شد، لطفاً دوباره وارد کنید.' 
          : 'Invalid security code. A new code has been generated.'
      );
      refreshCaptcha();
      setCaptchaInput('');
      return;
    }

    setIsSubmitting(true);

    try {
      const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      
      // درخواست تماس جدا از اعزام‌های تکنسین پیگیری می‌شود
      await labDb.addCallbackRequest({
        customerId: uniqueId('lead'),
        customerName: cleanName,
        projectName: 'درخواست آزمایش وب‌سایت',
        projectAddress: 'هماهنگی تلفنی با متقاضی',
        contactPhone: digitsOnly,
        scheduledDateJalali: todayJalali,
        scheduledTime: nowTime,
        serviceType: 'درخواست آزمایش بتن (اعزام تکنسین و نمونه‌گیری)',
        status: 'requested',
        notes: `اعلان درخواست متقاضی از وب‌سایت • نام: ${cleanName} • تلفن: ${digitsOnly} • ساعت: ${nowTime}`
      });

      // پیام تأیید ارسال اعلان بدون صفحه‌سازی جدید
      setSuccessNotice(
        isFa 
          ? `اعلان درخواست آزمایش برای صفحه اپراتور ارسال گردید. کارشناسان ما به زودی با شماره ${digitsOnly} تماس خواهند گرفت.`
          : `Notification sent to operator dashboard. Our team will contact ${digitsOnly} shortly.`
      );

      // پاک کردن فرم جهت آمادگی برای ثبت بعدی
      setFullName('');
      setPhone('');
      setCaptchaInput('');
      refreshCaptcha();
    } catch (err) {
      console.error(err);
      setErrorMessage(isFa ? 'خطا در ثبت درخواست. لطفاً دوباره تلاش نمایید.' : 'Error submitting request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-12 px-4 text-start font-sans" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
        >
          {isFa ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{isFa ? 'بازگشت' : 'Back'}</span>
        </button>

        <div className="flex items-center gap-2">
          <CompanyLogo className="w-6 h-6 rounded-md" />
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {isFa ? 'آزما بتن پایش خاک و پی جهان بین' : 'Azma Beton Payesh Khak o Pey Jahan Bin'}
          </span>
        </div>
      </div>

      {/* Clean Request Card: No new page creation, inline operator notification */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-5"
      >
        {/* Card Header */}
        <div className="text-center space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-sky-400 text-[11px] font-bold mx-auto mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isFa ? 'ثبت سریع درخواست خدمات و مشاوره' : 'Quick Service & Consultation Request'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isFa ? 'ثبت درخواست خدمات و مشاوره' : 'Request Services & Consultation'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isFa ? 'جهت هماهنگی، لطفاً مشخصات خود را وارد نمایید' : 'Enter your details for dispatch coordination'}
          </p>
        </div>

        {/* Success Notice: Inline confirmation */}
        {successNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-start gap-2.5 leading-relaxed shadow-xs"
          >
            <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>{successNotice}</span>
          </motion.div>
        )}

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {isFa ? 'نام و نام خانوادگی' : 'Full Name'} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isFa ? 'مثال: مهندس صادقی' : 'e.g. John Doe'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              <User className="w-4 h-4 text-slate-400 absolute start-auto end-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* 2. Phone Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isFa ? 'شماره تماس (۱۱ رقم)' : 'Phone Number (11 digits)'} <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-mono font-semibold text-slate-400">
                {phone.length > 0 && `${phone.length} / ۱۱`}
              </span>
            </div>
            <div className="relative">
              <input
                type="tel"
                required
                dir="ltr"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  const clean = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                  if (clean.length <= 11) {
                    setPhone(clean);
                  }
                }}
                placeholder="09123456789"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-mono tracking-wider text-end"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute start-auto end-3.5 top-3.5 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400">
              {isFa ? 'لطفاً شماره همراه ۱۱ رقمی خود را با صفر اول وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)' : 'Enter 11-digit mobile number starting with 0'}
            </p>
          </div>

          {/* 3. Security Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {isFa ? 'کد امنیتی' : 'Security Code'} <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-12 gap-2.5 items-center">
              {/* Visual Captcha Display */}
              <div className="col-span-5 flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 select-none shadow-inner">
                <span className="font-mono font-black text-base tracking-widest text-blue-700 dark:text-sky-300 italic select-none">
                  {captchaCode}
                </span>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                  title={isFa ? 'تولید کد جدید' : 'Refresh code'}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Input for Captcha */}
              <div className="col-span-7 relative">
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder={isFa ? 'کد ۴ رقمی' : '4-digit code'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white uppercase font-mono tracking-widest focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute start-auto end-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 4. Confirm Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFa ? 'ارسال اعلان به اپراتور' : 'Send Notification to Operator'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Direct phone call option */}
        <div className="pt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
          <span>{isFa ? 'تماس مستقیم با پذیرش آزمایشگاه:' : 'Lab Hotline:'} </span>
          <a href={`tel:${LAB_INFO.phone}`} className="font-mono font-bold text-blue-600 dark:text-sky-400 underline" dir="ltr">
            {LAB_INFO.phone}
          </a>
        </div>
      </motion.div>
    </div>
  );
};
