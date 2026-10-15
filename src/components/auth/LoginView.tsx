import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';
import { Language } from '../../utils/i18n';
import { LAB_IMAGES } from '../../assets/images';
import { labDb } from '../../services/supabase';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { CompanyLogo } from '../common/CompanyLogo';
import { toPersianDigits } from '../../utils/jalali';
import { 
  Lock, 
  Mail, 
  ArrowLeft, 
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  RotateCw,
  MessageSquare,
  Smartphone,
  Timer,
  CheckCircle2,
  Sparkles,
  X
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
  availableUsers: UserProfile[];
  language: Language;
}

// Normalize Persian, Arabic, and English characters/digits for seamless captcha validation
export const normalizeCaptcha = (input: string): string => {
  if (!input) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let normalized = input.trim();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], i.toString());
    normalized = normalized.replaceAll(arabicDigits[i], i.toString());
  }
  // Strip whitespace and zero-width characters, uppercase
  return normalized.replace(/[\s\u200C\u200B\uFEFF]/g, '').toUpperCase();
};

// Generate a clear 4-digit numeric captcha
const generateRandomCaptcha = (length = 4): string => {
  let res = '';
  for (let i = 0; i < length; i++) {
    res += Math.floor(Math.random() * 10).toString();
  }
  return res;
};

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  availableUsers,
  language
}) => {
  const isFa = language === 'fa';

  // Step state: 'credentials' | 'sms-otp'
  const [step, setStep] = useState<'credentials' | 'sms-otp'>('credentials');

  // Credentials inputs (prefilled from QR access-card deep link: /?login=<username>&cust=<id>)
  const qrPrefill = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { login: p.get('login') || '', cust: p.get('cust') || '' };
    } catch {
      return { login: '', cust: '' };
    }
  })();
  const [identifierInput, setIdentifierInput] = useState(qrPrefill.login);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Return to credentials step when on OTP screen if back button is pressed
  useModalBack(step === 'sms-otp', () => {
    setStep('credentials');
    setOtpError('');
  }, 'login-view-otp-step');

  // Close Forgot Password modal if back button is pressed
  useModalBack(showForgotModal, () => setShowForgotModal(false), 'login-forgot-modal');

  // Captcha state - initial state randomized dynamically on load
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState<string>(() => generateRandomCaptcha(4));
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);

  // Proactively fetch latest profiles from server on mount so changes made on other devices are immediately present
  useEffect(() => {
    labDb.fetchFromServer(true);
  }, []);

  // OTP / 2FA state for Operator & Admin
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [pendingTempToken, setPendingTempToken] = useState<string>('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  // FIX #1.4: when the server withholds the OTP code (production, no SMS gateway),
  // switch the UI to "manual mode" so we never present a fake code as real.
  const [manualOtpMode, setManualOtpMode] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(120);
  const [isResending, setIsResending] = useState(false);
  const [showSimulatedSmsToast, setShowSimulatedSmsToast] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate random captcha code on demand
  const refreshCaptcha = () => {
    setIsRefreshingCaptcha(true);
    const newCode = generateRandomCaptcha(4);
    setCaptchaCode(newCode);
    setCaptchaInput('');
    setTimeout(() => setIsRefreshingCaptcha(false), 300);
  };

  // Generate random 5-digit OTP
  const generateNewOtp = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
  };

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === 'sms-otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, otpTimer]);

  // Convert Persian/Arabic numbers to English
  const toEnglishDigits = (str: string): string => {
    return (str || '')
      .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
  };

  const findMatchedUser = (list: UserProfile[], rawInput: string): UserProfile | undefined => {
    const raw = rawInput.trim();
    if (!raw) return undefined;
    const eng = toEnglishDigits(raw).toLowerCase();
    const digitsOnly = eng.replace(/[^0-9]/g, '');

    return list.find(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uUsername = toEnglishDigits(u.username || '').toLowerCase();
      const uPhone = toEnglishDigits(u.phone || '').replace(/[^0-9]/g, '');
      const uCustId = toEnglishDigits(u.customerId || '').toLowerCase();
      const uFullName = (u.fullName || '').toLowerCase();

      // 1. Direct match on username or email or customerId
      if (uUsername === eng || uEmail === eng || uCustId === eng) return true;
      if (uCustId && `cust-${eng}` === uCustId) return true;
      if (eng === 'admin' && (u.role === 'admin' || uUsername === 'admin')) return true;
      if (eng === 'operator' && (u.role === 'operator' || uUsername === 'operator')) return true;
      if (eng === 'customer' && (u.role === 'customer' || uUsername === 'customer' || uCustId === 'cust-001')) return true;
      if (eng === 'client' && (uCustId === 'cust-002' || uUsername === 'client')) return true;

      // 2. Phone or digit match
      if (digitsOnly.length >= 4) {
        if (uPhone === digitsOnly) return true;
        if (uPhone.endsWith(digitsOnly)) return true;
        if (uUsername === digitsOnly) return true;
        if (digitsOnly.length >= 6 && uPhone.slice(-6) === digitsOnly) return true;
      }

      // 3. Email prefix
      if (eng.length >= 3 && uEmail.startsWith(eng)) return true;

      // 4. Full name
      if (raw.length >= 3 && uFullName.includes(raw.toLowerCase())) return true;

      return false;
    });
  };

  // Handle Initial Login Submission
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Strict Captcha Verification (User must enter manually)
    const cleanInput = normalizeCaptcha(captchaInput);
    const cleanExpected = normalizeCaptcha(captchaCode);

    if (!cleanInput || cleanInput !== cleanExpected) {
      setErrorMsg(
        isFa 
          ? 'کد امنیتی وارد شده صحیح نمی‌باشد. لطفاً کد جدید را وارد نمایید.' 
          : 'Security captcha code is incorrect. Please enter the newly generated code.'
      );
      refreshCaptcha();
      return;
    }

    setIsLoading(true);

    try {
      const loginResult = await labDb.login(identifierInput.trim(), passwordInput.trim());

      if (!loginResult.success) {
        setIsLoading(false);
        setErrorMsg(loginResult.error || (isFa ? 'نام کاربری یا رمز عبور نامعتبر است.' : 'Invalid credentials.'));
        refreshCaptcha();
        return;
      }

      // Check if user is Operator or Admin -> Require SMS OTP Verification
      if (loginResult.requiresOtp) {
        // FIX #1.4: in production the server never leaks the real OTP code,
        // so a locally generated random number would NEVER match the server's
        // pending code — every staff login got locked out until an SMS gateway
        // is wired up. When no real code was received, switch to "manual mode":
        // hide the fake SMS banner and tell the user to obtain the code from
        // the lab manager (who reads it from the server console/log).
        const manualOtpMode = !loginResult.simulatedOtp;
        const newCode = loginResult.simulatedOtp || '';
        setGeneratedOtp(newCode);
        setManualOtpMode(manualOtpMode);
        setPendingTempToken(loginResult.tempToken || '');
        setPendingUser(loginResult.user || null);
        setOtpDigits(['', '', '', '', '']);
        setOtpTimer(120);
        setOtpError('');
        setIsLoading(false);

        // Send simulated SMS to user phone (dev only — a locally invented
        // code must never be presented as the verification code)
        if (!manualOtpMode) {
          const destPhone = loginResult.user?.phone || '09131703177';
          labDb.sendSms({
            recipientPhone: destPhone,
            recipientName: loginResult.user?.fullName || '',
            event: 'custom',
            customMessage: `کد تایید ورود به سامانه آزما بتن پایش خاک و پی جهان بین: ${newCode} (معتبر تا ۲ دقیقه)`
          });
        }

        // Trigger step change and display simulated SMS banner
        setStep('sms-otp');
        setShowSimulatedSmsToast(!manualOtpMode);

        // Focus first OTP input on next tick
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);

      } else if (loginResult.user) {
        // Customer or direct login -> Success
        setIsLoading(false);
        onLogin(loginResult.user);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setIsLoading(false);
      setErrorMsg(isFa ? 'خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش فرمایید.' : 'Server connection error.');
      refreshCaptcha();
    }
  };

  // Handle OTP Resend
  const handleResendOtp = async () => {
    if (otpTimer > 0 || !pendingTempToken) return;
    setIsResending(true);
    setOtpError('');

    try {
      const resendRes = await labDb.resendOtp(pendingTempToken);
      setIsResending(false);
      if (resendRes.success) {
        // FIX #1.4: keep manual mode consistent on resend too — in production
        // the server withholds the code, so never fall back to a fake local one.
        setGeneratedOtp(resendRes.simulatedOtp || '');
        setManualOtpMode(!resendRes.simulatedOtp);
        setOtpTimer(120);
        setOtpDigits(['', '', '', '', '']);

        if (resendRes.simulatedOtp) {
          const destPhone = pendingUser?.phone || '09131703177';
          labDb.sendSms({
            recipientPhone: destPhone,
            recipientName: pendingUser?.fullName || '',
            event: 'custom',
            customMessage: `کد تایید ورود مجدد به سامانه آزما بتن پایش خاک و پی جهان بین: ${resendRes.simulatedOtp}`
          });
        }

        setShowSimulatedSmsToast(!!resendRes.simulatedOtp);
        otpInputRefs.current[0]?.focus();
      } else {
        setOtpError(resendRes.error || (isFa ? 'خطا در ارسال مجدد کد پیامک.' : 'Resend error.'));
      }
    } catch (e: any) {
      setIsResending(false);
      setOtpError(isFa ? 'خطا در ارسال مجدد کد پیامک.' : 'Resend error.');
    }
  };

  // Handle OTP digit input change
  const handleOtpDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned.slice(-1);
    setOtpDigits(newDigits);
    setOtpError('');

    if (cleaned && index < 4) {
      otpInputRefs.current[index + 1]?.focus();
    }

    const currentCode = newDigits.join('');
    if (currentCode.length === 5) {
      verifyOtpCode(currentCode);
    }
  };

  // Handle backspace in OTP input
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle clipboard paste in OTP input
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 5);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);
    setOtpError('');
    if (pasted.length === 5) {
      verifyOtpCode(pasted);
    } else {
      otpInputRefs.current[pasted.length]?.focus();
    }
  };

  // Verify OTP submission via server
  const verifyOtpCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length < 5) {
      setOtpError(isFa ? 'لطفاً کد تایید ۵ رقمی را کامل وارد کنید.' : 'Please enter the complete 5-digit code.');
      return;
    }

    setIsLoading(true);
    try {
      const verifyRes = await labDb.verifyOtp(pendingTempToken, code);
      setIsLoading(false);
      if (!verifyRes.success || !verifyRes.user) {
        setOtpError(verifyRes.error || (isFa ? 'کد تایید پیامک نادرست است. لطفاً مجدداً بررسی نمایید.' : 'Incorrect verification code.'));
        return;
      }

      setOtpSuccess(true);
      setOtpError('');
      setTimeout(() => {
        // FIX #1: propagate the server's mustChangePassword flag through the
        // 2FA path too — previously only the direct (customer) login passed it,
        // so admins/operators with the legacy credential skipped the forced
        // password-change gate entirely.
        onLogin(verifyRes.user!, verifyRes.mustChangePassword);
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      setOtpError(isFa ? 'خطا در تایید کد پیامک.' : 'Verification error.');
    }
  };

  // Auto-fill OTP from simulated SMS toast
  const handleAutoFillOtp = () => {
    if (!generatedOtp) return;
    const digits = generatedOtp.split('');
    setOtpDigits(digits);
    setOtpError('');
    verifyOtpCode(generatedOtp);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const maskPhone = (phone?: string) => {
    if (!phone || phone.length < 10) return '۰۹۱۳***۳۱۷۷';
    return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
  };

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none" dir={isFa ? 'rtl' : 'ltr'}>
      
      {/* Animated Floating Background Orbs & Structural Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Ambient Light Orbs */}
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-[#00c49f]/15 dark:bg-[#00c49f]/20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -50, 30, 0],
            y: [0, 40, -30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-28 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#00b4d8]/15 dark:bg-[#00b4d8]/20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 30, -40, 0],
            y: [0, 25, -35, 0],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#041d2d]/25 dark:bg-[#041d2d]/60 blur-3xl"
        />

        {/* Animated Subtle Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '28px 28px'
          }}
        />

        {/* Floating Geometric Concrete Crystal accents */}
        <motion.div
          animate={{ rotate: 360, y: [0, -15, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute top-16 left-12 w-20 h-20 border border-teal-400/25 dark:border-cyan-500/25 rounded-3xl"
        />
        <motion.div
          animate={{ rotate: -360, y: [0, 20, 0] }}
          transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-16 right-16 w-28 h-28 border border-cyan-400/25 dark:border-teal-500/25 rounded-3xl"
        />
      </div>

      {/* Main Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-4xl bg-white/95 dark:bg-[#041d2d]/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(4,29,45,0.22)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-200/80 dark:border-cyan-500/30 grid grid-cols-1 md:grid-cols-12 overflow-hidden transition-all">
        
        {/* Left Visual Banner: Pure Attractive Laboratory Photo */}
        <div className="hidden md:block md:col-span-5 relative overflow-hidden group select-none min-h-[520px]">
          <img 
            src={LAB_IMAGES.modernHeroLab || LAB_IMAGES.cubePress} 
            alt="دستگاه جک فشاری و تجهیزات آزمایشگاه آزما بتن پایش خاک و پی جهان بین" 
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          {/* Subtle soft gradient overlay for elegant contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#041d2d]/95 via-[#041d2d]/40 to-transparent pointer-events-none" />
          
          {/* Subtle elegant branding tag at bottom */}
          <div className="absolute bottom-5 start-5 end-5 z-10 p-3 rounded-2xl bg-[#041d2d]/80 backdrop-blur-md border border-cyan-400/30 text-white flex items-center justify-between">
            <span className="text-xs font-black tracking-tight text-white/90">آزما بتن پایش خاک و پی جهان بین</span>
            <span className="text-[10px] text-[#00c49f] font-mono tracking-wider">ISO/IEC 17025</span>
          </div>
        </div>

        {/* Right Side Content (Form & OTP Step) */}
        <div className="col-span-1 md:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          
          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              /* Step 1: Credentials & Captcha */
              <motion.div
                key="step-credentials"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="text-center space-y-2">
                  <CompanyLogo className="w-14 h-14 rounded-2xl mx-auto shadow-lg shadow-teal-500/20 mb-1 border border-cyan-500/30" iconClassName="w-7 h-7" />
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isFa ? 'ورود به پرتال سامانه' : 'Portal Login'}
                  </h1>
                  <p className="text-xs sm:text-sm text-teal-600 dark:text-cyan-300 font-bold">
                    {isFa 
                      ? 'جهت دسترسی به پرتال اختصاصی، اطلاعات خود را وارد کنید'
                      : 'Enter your credentials to access your dashboard'}
                  </p>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{errorMsg}</span>
                  </motion.div>
                )}

                {/* Form - Clean & Spacious Without Clutter */}
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  
                  {/* Field 1: Identifier (Username / Email / Mobile) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isFa ? 'نام کاربری یا ایمیل' : 'Username or Email'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="input-login-identifier"
                        type="text"
                        required
                        value={identifierInput}
                        onChange={(e) => {
                          setIdentifierInput(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="admin"
                        className="w-full h-12 bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 rounded-xl ps-10 pe-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#00c49f]/30 focus:border-[#00c49f] dark:focus:ring-cyan-500/30 dark:focus:border-cyan-400 transition shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Field 2: Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isFa ? 'رمز عبور' : 'Password'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="input-login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="••••••••"
                        className="w-full h-12 bg-slate-50 dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 rounded-xl ps-10 pe-11 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#00c49f]/30 focus:border-[#00c49f] dark:focus:ring-cyan-500/30 dark:focus:border-cyan-400 transition shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Field 3: Captcha Security Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isFa ? 'کد امنیتی' : 'Security Code'}
                      </label>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {isFa ? 'ارقام از چپ به راست' : '4-digit code'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {/* Stylized Captcha Canvas Box (Forced LTR) */}
                      <div 
                        dir="ltr"
                        onClick={refreshCaptcha}
                        className="w-44 h-12 shrink-0 flex items-center justify-between px-3.5 bg-gradient-to-r from-teal-50 via-slate-100 to-cyan-50 dark:from-[#062436] dark:via-[#083344] dark:to-[#041d2d] border border-teal-200 dark:border-cyan-500/40 rounded-xl select-none shadow-inner cursor-pointer group hover:border-[#00c49f] transition relative overflow-hidden"
                        title={isFa ? 'برای تغییر کد امنیتی کلیک کنید' : 'Click to refresh security code'}
                      >
                        {/* Decorative Security Watermark Grid */}
                        <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none bg-[radial-gradient(#00c49f_1px,transparent_1px)] [background-size:8px_8px]" />
                        
                        <div className="flex flex-row items-center gap-2 font-mono font-black text-xl tracking-widest select-none z-10">
                          {captchaCode.split('').map((ch, idx) => {
                            const tilts = ['-rotate-6', 'rotate-3', '-rotate-3', 'rotate-6'];
                            const tilt = tilts[idx % tilts.length];
                            return (
                              <span 
                                key={idx} 
                                className={`inline-block transform ${tilt} text-slate-900 dark:text-[#00c49f] ${idx % 2 === 0 ? 'text-teal-800 dark:text-cyan-300' : 'text-slate-950 dark:text-[#00c49f]'}`}
                              >
                                {ch}
                              </span>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            refreshCaptcha();
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-cyan-950 text-slate-500 dark:text-cyan-300 transition cursor-pointer z-10"
                          title={isFa ? 'تغییر کد امنیتی' : 'Refresh'}
                        >
                          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-300 ${isRefreshingCaptcha ? 'rotate-180 text-[#00c49f]' : 'group-hover:rotate-45'}`} />
                        </button>
                      </div>

                      {/* Captcha Text Input (Forced LTR) */}
                      <div className="relative flex-1" dir="ltr">
                        <ShieldCheck className={`w-4 h-4 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${captchaInput.length === 4 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-cyan-500/50'}`} />
                        <input
                          id="input-login-captcha"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          required
                          maxLength={4}
                          value={captchaInput}
                          onChange={(e) => {
                            const val = normalizeCaptcha(e.target.value);
                            setCaptchaInput(val);
                            if (errorMsg) setErrorMsg('');
                          }}
                          placeholder={isFa ? 'کد ۴ رقمی' : '4-digit code'}
                          className={`w-full h-12 bg-white dark:bg-[#083344] border rounded-xl pl-9 pr-9 transition-all duration-200 shadow-xs focus:outline-hidden focus:ring-2 ${
                            captchaInput.length === 4
                              ? 'border-emerald-500/80 dark:border-emerald-400 focus:ring-emerald-500/20 text-emerald-900 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-cyan-500/30 focus:border-[#00c49f] focus:ring-[#00c49f]/25 text-slate-900 dark:text-white'
                          } ${
                            captchaInput 
                              ? 'text-center font-mono font-black text-lg tracking-[0.35em]' 
                              : 'text-center font-medium text-xs tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-500'
                          }`}
                        />
                        {captchaInput.length === 4 ? (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-400 pointer-events-none">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : captchaInput.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setCaptchaInput('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1 rounded-md transition cursor-pointer"
                            title={isFa ? 'پاک کردن' : 'Clear'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Options Row */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded text-[#00c49f] focus:ring-[#00c49f] border-slate-300 dark:border-slate-700"
                      />
                      <span>{isFa ? 'مرا به خاطر بسپار' : 'Remember me'}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-teal-600 dark:text-[#00c49f] hover:underline font-bold transition cursor-pointer"
                    >
                      {isFa ? 'فراموشی رمز عبور؟' : 'Forgot password?'}
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="btn-login-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#00c49f] to-teal-400 hover:from-[#00b08e] hover:to-teal-300 text-slate-950 font-black text-sm shadow-lg shadow-teal-500/25 border border-emerald-300/50 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-70 mt-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-block w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isFa ? 'ورود به سامانه' : 'Sign In'}</span>
                        {isFa ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* Step 2: SMS Verification OTP Screen (for Operator & Admin) */
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* FIX #1.4: Manual-mode banner — production has no SMS gateway,
                    so the real code is printed on the server console. Staff must
                    get it from the lab manager instead of a fake local code. */}
                {manualOtpMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border border-amber-300/60 dark:border-amber-500/30 text-xs leading-relaxed font-bold flex items-start gap-2"
                  >
                    <span className="text-base leading-none">📵</span>
                    <span>
                      {isFa
                        ? 'ارسال خودکار پیامک غیرفعال است. کد تایید ۵ رقمی را از مدیر آزمایشگاه دریافت کنید (کد در کنسول/لاگ سرور نمایش داده می‌شود) و در کادرهای زیر وارد نمایید.'
                        : 'Automatic SMS is disabled. Please obtain the 5-digit code from the lab manager (it is printed in the server console/log) and enter it below.'}
                    </span>
                  </motion.div>
                )}

                {/* Floating Simulated SMS Push Notification */}
                {showSimulatedSmsToast && (
                  <motion.div 
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-[#041d2d] via-[#062c3e] to-[#083344] text-white shadow-xl shadow-cyan-950/40 space-y-2 border border-cyan-400/40"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-[#00c49f]" />
                        {isFa ? 'پیامک اعتبارسنجی ارسالی به تلفن همراه شما' : 'SMS Verification Received'}
                      </span>
                      <span className="text-[10px] opacity-80 font-mono">الان</span>
                    </div>
                    <p className="text-xs leading-relaxed text-cyan-100">
                      {isFa 
                        ? `کد تایید ورود به سامانه آزما بتن پایش خاک و پی جهان بین: `
                        : `Your verification code is: `}
                      <strong className="text-[#00c49f] font-mono text-sm tracking-widest px-2 py-0.5 rounded-md bg-black/40 mx-1 border border-cyan-500/30">
                        {generatedOtp}
                      </strong>
                    </p>
                    <button
                      type="button"
                      onClick={handleAutoFillOtp}
                      className="w-full py-1.5 rounded-xl bg-[#00c49f] hover:bg-[#00b08e] text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isFa ? 'درج کد تایید' : 'Enter Code'}</span>
                    </button>
                  </motion.div>
                )}

                {/* Header */}
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-[#083344] text-[#00c49f] dark:text-[#00c49f] border border-teal-200 dark:border-cyan-500/30 flex items-center justify-center mx-auto shadow-md shadow-teal-500/10">
                    <Smartphone className="w-7 h-7 animate-bounce" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {isFa ? 'تایید هویت پیامکی' : 'SMS Verification'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    {isFa ? (
                      <>
                        کد تایید ۵ رقمی به شماره همراه{' '}
                        <strong className="text-slate-800 dark:text-slate-200 font-mono" dir="ltr">
                          {maskPhone(pendingUser?.phone)}
                        </strong>{' '}
                        پیامک شد.
                      </>
                    ) : (
                      `A 5-digit verification code has been sent to ${maskPhone(pendingUser?.phone)}`
                    )}
                  </p>
                </div>

                {/* Error / Success Feedback */}
                {otpError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {otpSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{isFa ? 'کد تایید شد. در حال انتقال به پنل...' : 'Verified successfully. Redirecting...'}</span>
                  </div>
                )}

                {/* 5-Digit Segmented Input Boxes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 sm:gap-3" dir="ltr">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className={`w-11 h-13 sm:w-13 sm:h-14 text-center font-mono font-black text-xl rounded-2xl border transition-all focus:outline-hidden ${
                          digit
                            ? 'bg-teal-50 dark:bg-[#083344] border-[#00c49f] text-[#00c49f] shadow-sm'
                            : 'bg-slate-50 dark:bg-[#062436] border-slate-200 dark:border-cyan-500/30 text-slate-900 dark:text-white focus:border-[#00c49f] focus:ring-2 focus:ring-[#00c49f]/20'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Countdown Timer & Resend Button */}
                  <div className="flex items-center justify-between text-xs px-2 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-slate-400" />
                      <span>{isFa ? 'زمان باقی‌مانده:' : 'Time remaining:'}</span>
                      <span className="font-mono font-bold text-teal-600 dark:text-[#00c49f]">
                        {isFa ? toPersianDigits(formatTimer(otpTimer)) : formatTimer(otpTimer)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpTimer > 0 || isResending}
                      className="font-bold text-teal-600 dark:text-[#00c49f] hover:underline disabled:opacity-40 disabled:hover:no-underline transition cursor-pointer"
                    >
                      {isResending 
                        ? (isFa ? 'در حال ارسال...' : 'Sending...') 
                        : (isFa ? 'ارسال مجدد پیامک' : 'Resend Code')}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => verifyOtpCode()}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00c49f] to-teal-400 hover:from-[#00b08e] hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-teal-500/25 border border-emerald-300/50 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isFa 
                        ? `تایید کد و ورود به پنل ${pendingUser?.role === 'admin' ? 'مدیریت' : 'اپراتور'}`
                        : 'Verify & Enter Dashboard'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setOtpError('');
                      refreshCaptcha();
                    }}
                    className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-[#083344] hover:bg-slate-200 dark:hover:bg-[#0c445a] text-slate-700 dark:text-slate-200 border border-transparent dark:border-cyan-500/20 font-bold text-xs transition cursor-pointer"
                  >
                    {isFa ? 'بازگشت و تغییر نام کاربری' : 'Change User / Back'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer note */}
          <div className="mt-6 pt-3 border-t border-slate-100 dark:border-cyan-900/40 text-center text-[11px] text-slate-400">
            <span>شرکت فنی مهندسی آزما بتن پایش خاک و پی جهان بین</span>
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
