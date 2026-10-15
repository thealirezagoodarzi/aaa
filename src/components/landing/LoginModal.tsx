import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Language } from '../../utils/i18n';
import { CompanyLogo } from '../common/CompanyLogo';
import { labDb } from '../../services/supabase';
import { 
  Building2, 
  Lock, 
  Mail, 
  X, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
  availableUsers: UserProfile[];
  language: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  availableUsers,
  language
}) => {
  const [step, setStep] = useState<'credentials' | 'sms-otp'>('credentials');
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [pendingTempToken, setPendingTempToken] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await labDb.login(identifierInput, passwordInput);
      setIsLoading(false);

      if (!result.success) {
        setErrorMsg(
          result.error || 
          (language === 'fa' 
            ? 'شناسه کاربری یا رمز عبور نامعتبر است. لطفاً بررسی و مجدداً تلاش فرمایید.' 
            : 'Invalid username/email or password.')
        );
        return;
      }

      if (result.requiresOtp) {
        setPendingTempToken(result.tempToken || '');
        setSimulatedOtp(result.simulatedOtp || '');
        setStep('sms-otp');
        return;
      }

      if (result.user) {
        onLogin(result.user);
        onClose();
      }
    } catch (err: any) {
      console.error('LoginModal error:', err);
      setIsLoading(false);
      setErrorMsg(language === 'fa' ? 'خطا در بررسی حساب کاربری.' : 'Login check error.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await labDb.verifyOtp(pendingTempToken, otpInput.trim());
      setIsLoading(false);

      if (!result.success || !result.user) {
        setErrorMsg(result.error || (language === 'fa' ? 'کد تایید پیامک نادرست است.' : 'Invalid OTP.'));
        return;
      }

      onLogin(result.user);
      onClose();
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(language === 'fa' ? 'خطا در بررسی کد تایید.' : 'OTP check error.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      
      <div 
        className="w-full max-w-md bg-white dark:bg-[#062436] rounded-3xl shadow-2xl border border-slate-200 dark:border-cyan-500/30 p-6 sm:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Ambient Glow */}
        <div className="absolute -top-12 -end-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -start-10 w-28 h-28 bg-[#00d2a0]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-[#083344] border border-transparent dark:border-cyan-500/20 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Logo & Heading */}
        <div className="text-center mb-6">
          <CompanyLogo className="w-16 h-16 rounded-2xl mx-auto shadow-xl shadow-teal-500/20 mb-3 border border-cyan-500/30" />
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {language === 'fa' ? 'آزما بتن پایش خاک و پی جهان بین' : 'Azma Beton Payesh Khak o Pey Jahan Bin Lab'}
          </h2>
          <p className="text-xs text-teal-600 dark:text-cyan-300 font-bold mt-1">
            {language === 'fa' 
              ? 'سامانه جامع کنترل کیفیت و مدیریت آزمون‌های تخصصی بتن' 
              : 'Specialized Concrete Testing & Quality Control System'}
          </p>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'credentials' ? (
          /* Credentials Form */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'شماره موبایل، نام کاربری یا ایمیل' : 'Username, Mobile or Email'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder="admin / operator / customer"
                  dir="ltr"
                  className="w-full bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {language === 'fa' ? 'رمز عبور' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={language === 'fa' ? 'رمز عبور خود را وارد کنید' : 'Enter your password'}
                  className="w-full bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00d2a0] to-teal-400 hover:from-[#00bf91] hover:to-teal-300 text-slate-950 font-black text-sm shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-70 cursor-pointer mt-4"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{language === 'fa' ? 'ورود به سامانه' : 'Sign In'}</span>
              )}
            </button>
          </form>
        ) : (
          /* OTP Form for 2FA */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <p className="text-xs text-emerald-400 font-bold mb-1">
                {language === 'fa' ? 'کد تایید پیامک (شبیه‌سازی شده)' : 'Simulated SMS Verification Code'}
              </p>
              <p className="text-xl font-mono font-black text-emerald-300 tracking-widest">{simulatedOtp}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 text-center">
                {language === 'fa' ? 'کد تایید ۵ رقمی را وارد نمایید:' : 'Enter 5-digit verification code:'}
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="12345"
                dir="ltr"
                className="w-full text-center tracking-widest text-lg font-mono bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-1/3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {language === 'fa' ? 'بازگشت' : 'Back'}
              </button>
              <button
                type="submit"
                disabled={isLoading || otpInput.length < 5}
                className="w-2/3 py-2.5 rounded-xl bg-[#00d2a0] hover:bg-[#00bf91] text-slate-950 font-black text-xs shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>{language === 'fa' ? 'تایید و ورود' : 'Verify & Enter'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
