import React, { useState } from 'react';
import { labDb } from '../../services/supabase';
import { TestReport } from '../../types';
import { 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  QrCode, 
  Calendar, 
  Building2, 
  HardHat, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface CertificateVerifierWidgetProps {
  language?: 'fa' | 'en';
}

export const CertificateVerifierWidget: React.FC<CertificateVerifierWidgetProps> = ({ language = 'fa' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedReport, setMatchedReport] = useState<TestReport | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (codeToTest?: string) => {
    const q = (codeToTest || searchQuery).trim();
    if (!q) return;

    setIsVerifying(true);
    setHasSearched(false);

    // SECURITY FIX (audit #24): verification must run server-side. The old
    // implementation searched the client's cached labDb.getReports() behind a
    // fake 350ms setTimeout — guests no longer receive report data (FIX #6),
    // so it always returned "not found" for visitors and leaked logged-in
    // users' full dataset instead. Now we call the dedicated public endpoint
    // POST /api/lab-data/verify-report which returns at most one minimal,
    // approved-only record.
    try {
      const res = await fetch('/api/lab-data/verify-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: q })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data?.found && data?.report) {
        setMatchedReport(data.report as any);
      } else {
        setMatchedReport(null);
      }
    } catch (e) {
      setMatchedReport(null);
    } finally {
      setHasSearched(true);
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-[#062436] border border-slate-200/90 dark:border-cyan-500/20 p-6 sm:p-8 text-slate-900 dark:text-white shadow-xl relative overflow-hidden transition-colors">
      
      {/* Background Glow */}
      <div className="absolute top-0 end-0 w-80 h-80 bg-[#00d2a0]/10 dark:bg-[#00d2a0]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 start-0 w-80 h-80 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] border border-teal-200 dark:border-cyan-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {language === 'fa' 
                ? 'سامانه استعلام آنی اصالت گواهی و شیت نتایج آزمایش' 
                : 'Instant Certificate Authenticity & Validation Gateway'}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {language === 'fa' 
              ? 'تایید برخط امضای دیجیتال و استاندارد ISO/IEC 17025 با درج شماره گزارش یا شناسه نمونه' 
              : 'Cryptographic validation of laboratory test sheets and ISO 17025 digital seals'}
          </p>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-[#083344] text-teal-800 dark:text-[#00d2a0] border border-teal-200 dark:border-cyan-400/30 text-xs font-bold shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#00d2a0] animate-ping" />
          <span>{language === 'fa' ? 'سامانه برخط استعلام فعال' : 'Online Verification Active'}</span>
        </div>
      </div>

      {/* Input Form */}
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder={language === 'fa' ? 'شماره گزارش (مثال: CTL-1403-1092)...' : 'Enter Report # (e.g. CTL-1403-1092)...'}
              className="w-full bg-slate-50 dark:bg-[#041d2d] border border-slate-300 dark:border-cyan-500/30 rounded-2xl px-4 py-3 ps-11 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0] transition"
            />
            <Search className="w-5 h-5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={isVerifying}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#00d2a0] via-teal-400 to-cyan-400 hover:from-[#00bf91] text-slate-950 font-black text-sm shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 shrink-0 cursor-pointer"
          >
            {isVerifying ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{language === 'fa' ? 'استعلام اصالت گواهی' : 'Verify Certificate'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result Card */}
      {hasSearched && (
        <div className="mt-6 relative z-10 animate-in fade-in slide-in-from-top-3 duration-200">
          {matchedReport ? (
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-[#041d2d] border border-emerald-300 dark:border-[#00d2a0]/40 shadow-xl">
              
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-[#083344] text-teal-700 dark:text-[#00d2a0] flex items-center justify-center border border-teal-300 dark:border-cyan-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-teal-600 dark:text-[#00d2a0] uppercase tracking-wider">
                      {language === 'fa' ? 'گواهی رسمی معتبر و ممهور در سامانه' : 'Authentic Certified Report'}
                    </span>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                      {matchedReport.reportNo}
                    </h4>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  matchedReport.status === 'approved'
                    ? 'bg-teal-50 text-teal-900 dark:bg-[#083344] dark:text-[#00d2a0] border-teal-300 dark:border-cyan-400/40'
                    : 'bg-amber-50 text-amber-900 dark:bg-[#083344] dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                }`}>
                  {matchedReport.status === 'approved' 
                    ? (language === 'fa' ? 'تایید شده و ممهور' : 'Official Approved')
                    : (language === 'fa' ? 'در نوبت بررسی مدیر' : 'Pending Review')}
                </span>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/20">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">{language === 'fa' ? 'پروژه / کارفرما' : 'Project'}</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{matchedReport.projectName}</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/20">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">{language === 'fa' ? 'مقاومت ۲۸ روزه' : '28-Day Strength'}</span>
                  <span className="font-black font-mono text-[#00bfa5] dark:text-[#00d2a0] text-sm">
                    {matchedReport.breaking28dStrengthMpa ? `${matchedReport.breaking28dStrengthMpa} MPa` : 'در حال انتظار'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/20">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">{language === 'fa' ? 'رده مقاومت بتن' : 'Target Grade'}</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{matchedReport.concreteGrade}</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/20">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">{language === 'fa' ? 'تاریخ نمونه‌برداری' : 'Sampling Date'}</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{matchedReport.samplingDateJalali}</span>
                </div>
              </div>

              {/* Approval Notes */}
              {matchedReport.approvalNotes && (
                <div className="mt-3 p-3 rounded-xl bg-white dark:bg-[#062436] border border-slate-200 dark:border-cyan-500/20 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    {language === 'fa' ? 'نظر کارشناسی مدیر آزمایشگاه:' : 'Lab Director Certification:'}
                  </span>
                  <span>{matchedReport.approvalNotes}</span>
                </div>
              )}

            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  {language === 'fa' ? 'گواهی یا گزارشی با این شناسه یافت نشد!' : 'No test certificate found for this identifier.'}
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                  {language === 'fa' ? 'لطفاً شماره گزارش درج شده در بالای شیت نتایج را بررسی و مجدداً تلاش فرمایید.' : 'Please double check the report number on your official certificate.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
