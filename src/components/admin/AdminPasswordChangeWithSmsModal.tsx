import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Smartphone, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  Clock, 
  RefreshCw 
} from 'lucide-react';
import { UserProfile } from '../../types';
import { labDb, LAB_INFO } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';

interface AdminPasswordChangeWithSmsModalProps {
  isOpen?: boolean;
  adminUser?: UserProfile;
  onClose: () => void;
  onSuccess?: (newPassword: string) => void;
  onPasswordChanged?: (newPassword: string) => void;
}

export const AdminPasswordChangeWithSmsModal: React.FC<AdminPasswordChangeWithSmsModalProps> = ({
  isOpen = true,
  adminUser,
  onClose,
  onSuccess,
  onPasswordChanged
}) => {
  const currentAdmin = adminUser || labDb.getProfiles().find(p => p.role === 'admin') || {
    id: 'usr-admin-01',
    fullName: 'مدیر ارشد سامانه',
    email: 'admin@azmabeton.ir',
    username: 'admin',
    phone: '09131234567',
    role: 'admin' as const
  };

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [phone, setPhone] = useState(currentAdmin.phone || '09131234567');
  const [otpCode, setOtpCode] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [simulatedSmsBanner, setSimulatedSmsBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync phone if admin changes
  useEffect(() => {
    if (currentAdmin.phone) {
      setPhone(currentAdmin.phone);
    }
  }, [currentAdmin.phone]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('request');
      setEnteredOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSimulatedSmsBanner(null);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendSms = () => {
    setError(null);
    // Generate secure 6-digit OTP
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(generated);
    setCountdown(120);
    setStep('verify');

    // Simulate SMS dispatch via system
    const smsMessage = `کد تایید امنیتی تغییر رمز عبور مدیر سامانه: ${generated}\nآزمایشگاه آزما بتن جهان بین`;
    setSimulatedSmsBanner(`📲 پیامک ارسال شد به ${phone}: «کد تایید شما: ${toPersianDigits(generated)}»`);

    // Log to SMS records in database
    try {
      labDb.sendSms({
        recipientPhone: phone,
        recipientName: currentAdmin.fullName || 'مدیر ارشد سامانه',
        message: smsMessage,
        event: 'custom'
      });
    } catch (e) {
      console.debug('SMS log entry:', e);
    }
  };

  const handleVerifyAndChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Verify OTP code
    const cleanEntered = enteredOtp.replace(/[^0-9]/g, '');
    if (!cleanEntered || cleanEntered !== otpCode) {
      setError('کد تایید پیامکی وارد شده صحیح نمی‌باشد. لطفاً مجدداً بررسی فرمایید.');
      return;
    }

    // 2. Validate new password
    if (!newPassword || newPassword.length < 6) {
      setError('کلمه عبور جدید باید حداقل دارای ۶ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('تکرار کلمه عبور با رمز جدید وارد شده مطابقت ندارد.');
      return;
    }

    setLoading(true);
    try {
      // 3. Save new password in DB
      await labDb.updateUserPassword(currentAdmin.id, newPassword);

      // 4. Trigger success callbacks
      onPasswordChanged?.(newPassword);
      onSuccess?.(newPassword);
      onClose();
    } catch (err) {
      setError('خطا در ذخیره کلمه عبور جدید. لطفاً مجدداً تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 text-start">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                تغییر امنیتی رمز عبور مدیر سامانه
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                احراز هویت دومرحله‌ای از طریق ارسال کد یکبار مصرف (SMS OTP)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            مطابق با پروتکل‌های امنیتی سامانه، ویرایش مستقیم پروفایل مدیر ارشد غیرفعال بوده و تغییر رمز عبور صرفاً با تایید کد پیامکی ارسالی به شماره تماس ثبت‌شده مجاز می‌باشد.
          </p>
        </div>

        {/* Simulated SMS Notification Banner */}
        {simulatedSmsBanner && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-bounce-short">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{simulatedSmsBanner}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Request SMS */}
        {step === 'request' && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام کاربری مدیر ارشد
              </label>
              <input
                type="text"
                disabled
                value={`${currentAdmin.fullName} (${currentAdmin.username})`}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                شماره همراه دریافت‌کننده کد تایید پیامکی *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0913..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-700 dark:text-purple-300"
                  dir="ltr"
                  required
                />
                <Smartphone className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                کد تایید ۶ رقمی به این شماره ارسال خواهد شد.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSendSms}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ارسال کد تایید پیامکی</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Verify OTP and Enter New Password */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyAndChange} className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  کد تایید پیامک شده (۶ رقم) *
                </label>
                {countdown > 0 ? (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{toPersianDigits(countdown)} ثانیه تا ارسال مجدد</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendSms}
                    className="text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>ارسال مجدد کد</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                maxLength={6}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value)}
                placeholder="******"
                className="w-full bg-purple-50/50 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-black tracking-widest text-purple-900 dark:text-purple-200"
                dir="ltr"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                کلمه عبور جدید مدیر ارشد *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                  required
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

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                تکرار کلمه عبور جدید *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار دقیق کلمه عبور جدید..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                dir="ltr"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? 'در حال ثبت...' : 'تایید کد و تغییر رمز عبور'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
