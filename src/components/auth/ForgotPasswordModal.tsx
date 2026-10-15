import React, { useState } from 'react';
import { LAB_INFO } from '../../services/supabase';
import { 
  PhoneCall, 
  MapPin, 
  UserCheck, 
  Building2, 
  Copy, 
  Check, 
  X, 
  ShieldAlert, 
  ShieldCheck,
  Headphones, 
  MessageSquare,
  Clock
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose
}) => {
  useModalBack(isOpen, onClose, 'forgot-password-modal');

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(LAB_INFO.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#062436] rounded-3xl shadow-2xl border border-slate-200 dark:border-cyan-500/30 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-cyan-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-50 dark:bg-[#083344] text-[#00c49f] border border-teal-200/50 dark:border-cyan-500/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                بازیابی رمز عبور و پشتیبانی
              </h3>
              <p className="text-[11px] text-teal-600 dark:text-cyan-300 font-bold">
                تماس مستقیم با مدیریت آزمایشگاه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#083344] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Box */}
        <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-[#083344] border border-teal-200/60 dark:border-cyan-500/30 space-y-2 text-xs text-teal-950 dark:text-cyan-100">
          <div className="flex items-start gap-2 font-bold text-teal-800 dark:text-[#00c49f]">
            <ShieldAlert className="w-4 h-4 text-teal-600 dark:text-[#00c49f] shrink-0 mt-0.5" />
            <span>راهنمای بازیابی کلمه عبور:</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-700 dark:text-cyan-100/90 font-medium">
            به منظور حفظ امنیت داده‌های مهندسی و محرمانگی گزارش‌های آزمون مقاومت بتن، تغییر یا بازیابی رمز عبور کارفرمایان و تکنسین‌ها از طریق تماس با مدیریت آزمایشگاه انجام می‌گردد.
          </p>
        </div>

        {/* Contact Details Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#041d2d] border border-slate-200 dark:border-cyan-500/20 space-y-3 text-xs">
          
          {/* Lab Name */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#00c49f] shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">نام واحد آزمایشگاهی:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {LAB_INFO.name}
              </span>
            </div>
          </div>

          {/* Manager Name */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-cyan-900/40">
            <UserCheck className="w-4 h-4 text-[#00c49f] shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">مدیریت آزمایشگاه:</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">
                {LAB_INFO.manager}
              </span>
            </div>
          </div>

          {/* Phone Number */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-cyan-900/40">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#00c49f] shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">شماره تماس مستقیم (همراه):</span>
                <span className="font-mono font-black text-base text-[#00c49f] dark:text-[#00c49f]" dir="ltr">
                  {LAB_INFO.phone}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyPhone}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#083344] border border-slate-200 dark:border-cyan-500/30 text-slate-700 dark:text-slate-200 font-bold text-[11px] hover:bg-slate-100 dark:hover:bg-[#0d445b] transition flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00c49f]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد' : 'کپی شماره'}</span>
            </button>
          </div>

          {/* Address & Google Maps */}
          <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-cyan-900/40">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#00c49f] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-400 block">آدرس آزمایشگاه:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {LAB_INFO.address}
                </span>
                <span className="block text-[11px] text-teal-600 dark:text-cyan-400 font-mono mt-0.5">
                  مختصات: {LAB_INFO.coordinates.displayText}
                </span>
              </div>
            </div>
            <a
              href={LAB_INFO.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-[#083344] text-[#00c49f] border border-teal-200 dark:border-cyan-500/30 text-[10px] font-bold hover:bg-teal-100 dark:hover:bg-[#0d445b] transition mt-1"
            >
              نقشه
            </a>
          </div>

          {/* Registration & License */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-cyan-900/40 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00c49f] shrink-0" />
            <span>
              شماره ثبت: {LAB_INFO.registrationNo} • پروانه: {LAB_INFO.licenseNo} ({LAB_INFO.licenseIssuer})
            </span>
          </div>

          {/* Working hours */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-cyan-900/40 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ساعات پاسخگویی: شنبه تا پنج‌شنبه ۸:۰۰ الی ۱۹:۰۰</span>
          </div>

        </div>

        {/* Action Call Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href={`tel:${LAB_INFO.phone}`}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00c49f] to-teal-400 hover:from-[#00b08e] hover:to-teal-300 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>تماس تلفنی با آزمایشگاه</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-[#083344] dark:hover:bg-[#0d445b] text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer border border-transparent dark:border-cyan-500/20"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
