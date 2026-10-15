import React, { useState } from 'react';
import { SUPABASE_SQL_SCHEMA } from '../../services/supabase';
import { Database, Copy, Check, X, Shield, Terminal, Zap } from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ isOpen, onClose }) => {
  useModalBack(isOpen, onClose, 'sql-schema-modal');

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>اسکریپت دیتابیس Supabase و رول‌های امنیتی (RLS & Schema)</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                  PostgreSQL
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                جداول profiles، customers، test_reports، invoices و accounting_records به همراه قوانین دسترسی RBAC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>کپی شد!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>کپی تمام اسکریپت SQL</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-100/50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
            <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">امنیت سطح ردیف (RLS):</strong>
              مشتریان فقط مجاز به مشاهده نتایج تایید شده شرکت خود هستند.
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
            <Terminal className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">محدودیت اپراتورها:</strong>
              اپراتورها تنها قادر به ارسال تست با وضعیت pending می‌باشند.
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Supabase Realtime:</strong>
              همگام‌سازی بلادرنگ رویدادهای ثبت، تایید و پرداخت در داشبوردها.
            </div>
          </div>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed dir-ltr select-text">
          <pre className="text-emerald-400/90 whitespace-pre-wrap">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            قابل اجرا مستقیم در SQL Editor داشبورد Supabase
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium transition"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
