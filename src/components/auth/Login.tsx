import React, { useState } from 'react';
import { UserProfile, UserRole } from '../../types';
import { translations, Language } from '../../utils/i18n';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { labDb } from '../../services/ConcreteLabStorage';
import { 
  Building2, 
  ShieldCheck, 
  HardHat, 
  UserCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2,
  Database,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile, mustChangePassword?: boolean) => void;
  allUsers?: UserProfile[];
  language: Language;
  onOpenSqlModal: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onLogin,
  allUsers = [],
  language,
  onOpenSqlModal,
}) => {
  const t = translations[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Security fix: authentication is performed exclusively on the server
      // (scrypt hash verification). No plaintext passwords and no hard-coded
      // default credentials exist in the client anymore.
      const result = await labDb.login(email.trim(), password.trim());

      if (!result.success) {
        setError(
          result.error ||
            (language === 'fa'
              ? 'نام کاربری یا رمز عبور نامعتبر است. لطفاً مجدداً بررسی فرمایید.'
              : 'Invalid username or password. Please try again.')
        );
        setLoading(false);
        return;
      }

      if (result.requiresOtp) {
        setError(
          language === 'fa'
            ? 'برای ورود، کد پیامک‌شده را وارد نمایید.'
            : 'Please enter the SMS verification code to continue.'
        );
        setLoading(false);
        return;
      }

      if (result.user) {
        setLoading(false);
        onLogin(result.user, result.mustChangePassword);
        return;
      }

      setError(language === 'fa' ? 'ورود ناموفق بود.' : 'Sign-in failed.');
      setLoading(false);
    } catch (err) {
      console.error('Login error:', err);
      setError(language === 'fa' ? 'خطا در ارتباط با سرور' : 'Connection error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      
      <div className="w-full max-w-md">
        
        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 relative overflow-hidden">
          
          {/* Top Decorative Glow */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

          {/* Logo & Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-3">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t.appName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fa' ? 'ورود یکپارچه به پرتال آزمایشگاه بتن و مقاومت مصالح' : 'Unified Concrete Laboratory Portal Sign In'}
            </p>
          </div>

          {/* Error Message Alert */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email / Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.emailOrUsername}
              </label>
              <div className="relative">
                <input
                  id="input-login-email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@betonlab.ir"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 ps-10 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.password}
                </label>
                <span className="text-[11px] text-slate-400">
                  {language === 'fa' ? 'رمز عبور شخصی خود را وارد کنید' : 'Enter your personal password'}
                </span>
              </div>
              <div className="relative">
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 ps-10 pe-10 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute end-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                رمز عبور را فراموش کرده‌اید؟
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-login"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t.loginButton}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* Database Schema Link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onOpenSqlModal}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-medium transition"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{t.viewSqlSchema}</span>
            </button>
          </div>

        </div>

      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
};
