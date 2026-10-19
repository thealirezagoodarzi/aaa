import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../../types';
import { Language } from '../../utils/i18n';
import { labDb } from '../../services/supabase';
import { KeyRound, ShieldAlert, Loader2 } from 'lucide-react';

interface ForcePasswordChangeModalProps {
  user: UserProfile;
  language: Language;
  onSuccess: (updatedUser: UserProfile) => void;
  onCancel: () => void;
}

/**
 * Forced password-change gate: shown when the server flags the account with
 * mustChangePassword (e.g. still using the legacy/default credential).
 * The user CANNOT proceed to the portal until a new password is set.
 */
export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  user,
  language,
  onSuccess,
  onCancel
}) => {
  const isFa = language === 'fa';
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!currentPw) return isFa ? 'رمز عبور فعلی را وارد کنید.' : 'Current password is required.';
    if (newPw.trim().length < 8) return isFa ? 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.' : 'New password must be at least 8 characters.';
    if (newPw === currentPw) return isFa ? 'رمز عبور جدید نمی‌تواند مشابه رمز قبلی باشد.' : 'New password must differ from the current one.';
    if (newPw !== confirmPw) return isFa ? 'تکرار رمز عبور جدید مطابقت ندارد.' : 'Confirmed password does not match.';
    // Reject known default/legacy credentials
    const lower = newPw.trim().toLowerCase();
    if (lower === 'ag12258' || lower === 'admin@123' || lower === 'admin123' || lower === '12345678') {
      return isFa ? 'استفاده از رمزهای پیش‌فرض سیستم ممنوع است.' : 'Default system passwords are not allowed.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }
    setIsSubmitting(true);
    try {
      // SECURITY FIX #5 companion: pass the current credential so the server
      // can verify it (self-service changes without it are rejected 400).
      const ok = await labDb.updateUserPassword(user.id, newPw, currentPw);
      if (!ok) {
        // Prefer the precise server message (e.g. "رمز عبور فعلی صحیح نیست")
        // stored by ConcreteLabStorage on a 400/403 rejection.
        const serverErr = (labDb as any).lastWriteError as string | null;
        setErrorMsg(serverErr || (isFa ? 'تغییر رمز عبور در سرور ناموفق بود. لطفاً مجدداً تلاش کنید.' : 'Server rejected the password change.'));
        setIsSubmitting(false);
        return;
      }
      onSuccess({ ...user, mustChangePassword: false });
    } catch (err: any) {
      setErrorMsg(err?.message || (isFa ? 'خطا در تغییر رمز عبور.' : 'Password change error.'));
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#062436] border border-amber-400/40 shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isFa ? 'تغییر اجباری رمز عبور' : 'Password Change Required'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isFa
                ? 'حساب کاربری شما همچنان از رمز عبور پیش‌فرض استفاده می‌کند. برای امنیت سامانه، قبل از ورود باید یک رمز عبور جدید انتخاب کنید.'
                : 'Your account still uses the default credential. Choose a new password before continuing.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isFa ? 'رمز عبور فعلی' : 'Current password'}
            </label>
            <input type="password" dir="ltr" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isFa ? 'رمز عبور جدید (حداقل ۸ کاراکتر)' : 'New password (min 8 chars)'}
            </label>
            <input type="password" dir="ltr" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isFa ? 'تکرار رمز عبور جدید' : 'Confirm new password'}
            </label>
            <input type="password" dir="ltr" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} />
          </div>

          {errorMsg && (
            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2.5">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-extrabold transition cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {isFa ? 'ثبت رمز جدید و ورود' : 'Set password & continue'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-cyan-500/30 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-[#083344] transition cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
