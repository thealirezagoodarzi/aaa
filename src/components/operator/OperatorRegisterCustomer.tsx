import React, { useState } from 'react';
import { Customer, UserProfile } from '../../types';
import { labDb, LAB_INFO } from '../../services/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { PrintContractModal } from '../common/PrintContractModal';
import { printOnlyElement } from '../../utils/printDom';
import { 
  Building2, 
  UserPlus, 
  KeyRound, 
  QrCode, 
  Copy, 
  Check, 
  Printer, 
  Share2, 
  Sparkles, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  FolderPlus,
  RefreshCw,
  Eye,
  EyeOff,
  FileCheck,
  ShieldCheck,
  X,
  FileSignature
} from 'lucide-react';

interface OperatorRegisterCustomerProps {
  onSuccess?: (customer: Customer, user: UserProfile) => void;
  onCancel?: () => void;
}

export const OperatorRegisterCustomer: React.FC<OperatorRegisterCustomerProps> = ({
  onSuccess,
  onCancel
}) => {
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [projectNames, setProjectNames] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  
  // Custom password option
  const [autoGenPassword, setAutoGenPassword] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  
  // State for created result modal
  const [createdResult, setCreatedResult] = useState<{
    customer: Customer;
    user: UserProfile;
    passwordGenerated: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [showContract, setShowContract] = useState(false);

  // Auto populate email based on company name/phone if empty
  const handlePhoneBlur = () => {
    if (!email && phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone) {
        setEmail(`user_${cleanPhone.slice(-6)}@azmabeton.ir`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!companyName.trim() || !representativeName.trim() || !phone.trim() || !email.trim()) {
      setFormError('لطفاً فیلدهای ستاره‌دار را تکمیل نمایید.');
      return;
    }

    const projectsList = projectNames
      .split(/[,،\n]/)
      .map(p => p.trim())
      .filter(Boolean);

    if (projectsList.length === 0) {
      projectsList.push('پروژه ساختمانی اصلی');
    }

    const finalPassword = autoGenPassword ? undefined : (customPassword.trim() || undefined);

    const result = labDb.registerCustomerWithAccount(
      {
        companyName: companyName.trim(),
        representativeName: representativeName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim() || 'شهرکرد - پروژه ساختمانی',
        projectNames: projectsList,
        economicCode: economicCode.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        balance: 0
      },
      finalPassword
    );

    setCreatedResult(result);
    if (onSuccess) {
      onSuccess(result.customer, result.user);
    }
  };

  const handleResetForm = () => {
    setCompanyName('');
    setRepresentativeName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setProjectNames('');
    setEconomicCode('');
    setNationalId('');
    setCustomPassword('');
    setAutoGenPassword(true);
    setCreatedResult(null);
  };

  const copyCredentials = () => {
    if (!createdResult) return;
    const text = `🏢 آزمایشگاه ${LAB_INFO.name}\n` +
      `👤 کارفرما: ${createdResult.customer.companyName}\n` +
      `🔑 کد کاربری / ایمیل: ${createdResult.user.email}\n` +
      `📱 شماره همراه: ${createdResult.customer.phone}\n` +
      `🔒 رمز عبور: ${createdResult.passwordGenerated}\n` +
      `🌐 سامانه مشاهده آنلاین نتایج بتن و گواهینامه‌ها`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrintVoucher = () => {
    // Print only the voucher card; fall back to full page print if not mounted.
    if (!printOnlyElement('customer-voucher-print-doc')) window.print();
  };

  // QR code content formatted for quick login / scanning
  const qrData = createdResult ? JSON.stringify({
    lab: LAB_INFO.shortName,
    app: 'AzmaBeton-Jahanbin',
    cust_id: createdResult.customer.id,
    company: createdResult.customer.companyName,
    rep: createdResult.customer.representativeName,
    username: createdResult.user.email,
    pass: createdResult.passwordGenerated,
    phone: createdResult.customer.phone,
    ts: Date.now()
  }) : '';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 end-0 -mt-8 -me-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>پذیرش سریع مشتریان آزمایشگاه</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              ثبت مشتری جدید و صدور آنی حساب کاربری و کد QR
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
              با ثبت اطلاعات کارفرما، بلافاصله شناسه کاربری، رمز عبور اختصاصی و کارت ورود با کد QR جهت تحویل به مشتری صادر می‌شود.
            </p>
          </div>
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-center shrink-0">
            <QrCode className="w-8 h-8 text-white mx-auto mb-1" />
            <span className="text-[11px] font-bold block">صدور خودکار QR</span>
          </div>
        </div>
      </div>

      {/* Main Registration Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        {formError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>مشخصات هویتی و ثبتی شرکت / کارفرما</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Field 1: Company Name */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نام شرکت / پیمانکار / شخص حقوقی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="مثال: شرکت مهندسی عمران زاگرس سازه"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Field 2: Representative Name */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نام و نام خانوادگی نماینده رسمی / مدیر پروژه <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="مثال: مهندس کاوه دهکردی"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Field 3: Phone */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                شماره همراه کارفرما (جهت پیامک و ورود) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="0913xxxxxxx"
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 pe-10 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field 4: Email / Username */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ایمیل / نام کاربری ورود به پرتال <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contractor@azmabeton.ir"
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 pe-10 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field 5: Projects */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نام پروژه‌ها و کارگاه‌های فعال (با کاما جدا کنید)
              </label>
              <input
                type="text"
                value={projectNames}
                onChange={(e) => setProjectNames(e.target.value)}
                placeholder="مثال: مجتمع مسکونی مهرگان شهرکرد، پروژه پل ولیعصر"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Field 6: Address */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نشانی دفتر / محل پروژه
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="شهرکرد، خیابان کاشانی، پروژه..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 pe-10 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Field 7 & 8: Economic Code & National ID */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                کد اقتصادی (اختیاری)
              </label>
              <input
                type="text"
                value={economicCode}
                onChange={(e) => setEconomicCode(e.target.value)}
                placeholder="کد ۱۲ رقمی اقتصادی"
                dir="ltr"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                شناسه ملی / کد ملی کارفرما (اختیاری)
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="شناسه ۱۱ رقمی یا کد ملی"
                dir="ltr"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Password Settings Section */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تنظیمات رمز عبور ورود مشتری:
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-blue-700 dark:text-blue-300">
                  <input
                    type="radio"
                    name="pwd-type"
                    checked={autoGenPassword}
                    onChange={() => setAutoGenPassword(true)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>تولید خودکار رمز امن ۶ رقمی</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="pwd-type"
                    checked={!autoGenPassword}
                    onChange={() => setAutoGenPassword(false)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>تعیین دستی رمز عبور</span>
                </label>
              </div>
            </div>

            {!autoGenPassword && (
              <div className="pt-2 max-w-sm">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="رمز عبور دلخواه کارفرما را وارد کنید"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 pe-10 text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
            >
              پاک‌سازی فرم
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center gap-2 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>ثبت مشتری و صدور کارت دسترسی و QR</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SUCCESSFUL REGISTRATION WITH CREDENTIALS & QR CODE VOUCHER         */}
      {/* ========================================================================= */}
      {createdResult && !showContract && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    مشتری با موفقیت ثبت شد
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    کارت مشخصات ورود و کد QR اختصاصی صادر گردید
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCreatedResult(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Voucher Card */}
            <div id="customer-voucher-print-doc" className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-2 border-blue-500/30 dark:border-blue-500/20 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
              
              {/* Top lab header in voucher */}
              <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="text-xs font-black text-blue-700 dark:text-blue-400">
                  {LAB_INFO.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  کارت اختصاصی ورود به سامانه آنلاین گزارش‌ها و گواهینامه‌های بتن
                </div>
              </div>

              {/* QR Code and Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                
                {/* QR Code Container */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner text-center">
                  <QRCodeSVG 
                    value={qrData}
                    size={130}
                    level="M"
                    includeMargin={false}
                    className="p-1 bg-white rounded-lg shadow-xs"
                  />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-2">
                    اسکن جهت ورود مستقیم
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    کد: {createdResult.customer.id}
                  </span>
                </div>

                {/* Credentials details */}
                <div className="sm:col-span-7 space-y-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">نام شرکت / کارفرما:</span>
                    <strong className="text-slate-900 dark:text-white text-sm font-bold">
                      {createdResult.customer.companyName}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">نماینده رسمی:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {createdResult.customer.representativeName}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold">کد کاربری / ایمیل:</span>
                      <span className="font-mono font-bold text-xs text-blue-900 dark:text-blue-200" dir="ltr">
                        {createdResult.user.email}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                      <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold">رمز عبور اختصاصی:</span>
                      <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700" dir="ltr">
                        {createdResult.passwordGenerated}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <span>تلفن همراه: <strong className="font-mono text-slate-700 dark:text-slate-300">{createdResult.customer.phone}</strong></span>
                  </div>
                </div>
              </div>

              {/* Footer notes on voucher */}
              <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl leading-relaxed">
                ℹ️ کارفرمای محترم می‌تواند با مراجعه به سامانه آزمایشگاه و وارد کردن مشخصات فوق یا اسکن کد QR، نتایج آزمایش‌های مقاومت فشاری و گواهینامه‌های رسمی را به صورت برخط و ۲۴ ساعته مشاهده و دانلود نماید.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={copyCredentials}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'مشخصات کپی شد' : 'کپی اطلاعات ورود'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowContract(true)}
                  className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 transition border border-purple-200 dark:border-purple-800"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>چاپ قرارداد</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintVoucher}
                  className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ کارت ورود</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ثبت مشتری بعدی</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {showContract && createdResult && (
        <PrintContractModal
          customer={createdResult.customer}
          onClose={() => setShowContract(false)}
        />
      )}
    </div>
  );
};
