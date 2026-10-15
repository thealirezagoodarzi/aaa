import React, { useState } from 'react';
import { Customer } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';
import { 
  Trash2, 
  AlertTriangle, 
  X, 
  Building2, 
  Wallet, 
  ShieldCheck, 
  FolderArchive,
  ArrowRight
} from 'lucide-react';

interface AdminCustomerDeleteModalProps {
  customer: Customer | null;
  onClose: () => void;
  onDeleted: (customer: Customer) => void;
}

export const AdminCustomerDeleteModal: React.FC<AdminCustomerDeleteModalProps> = ({
  customer,
  onClose,
  onDeleted
}) => {
  const [reason, setReason] = useState('اتمام پروژه و تسویه کامل قرارداد');
  const [customReason, setCustomReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    const finalReason = reason === 'other' ? customReason : reason;
    
    setTimeout(() => {
      const success = labDb.trashCustomer(customer.id, 'مدیر سیستم', finalReason);
      setIsDeleting(false);
      if (success) {
        onDeleted(customer);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden">
        
        {/* Header Warning */}
        <div className="p-6 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-b border-rose-100 dark:border-rose-900/40 flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shrink-0 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              انتقال شرکت و قرارداد به پوشه حذفیات
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              جهت جلوگیری از حذف ناخواسته، لطفاً اطلاعات زیر را تایید نمایید.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Target Customer Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <strong className="text-sm font-black text-slate-900 dark:text-white">
                  {customer.companyName}
                </strong>
              </div>
              <span className="font-mono font-bold text-slate-400 text-[11px]">
                {customer.id}
              </span>
            </div>

            <div className="text-slate-600 dark:text-slate-400 grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
              <div>
                <span>نماینده: </span>
                <strong className="text-slate-800 dark:text-slate-200">{customer.representativeName}</strong>
              </div>
              <div>
                <span>شماره همراه: </span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">{customer.phone}</strong>
              </div>
              <div>
                <span>مبلغ قرارداد: </span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">{toPersianDigits((customer.totalContractAmount || 0).toLocaleString())} تومان</strong>
              </div>
              <div>
                <span>مانده تراز مالی: </span>
                <strong className="font-mono text-amber-600 dark:text-amber-400">{toPersianDigits((customer.balance || 0).toLocaleString())} تومان</strong>
              </div>
            </div>
          </div>

          {/* Explanation Info */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 text-[11px] flex items-start gap-2">
            <FolderArchive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              این شرکت پس از تایید از لیست فعال خارج شده و به <strong>«پوشه حذفیات»</strong> منتقل می‌شود. اطلاعات قرارداد و تراکنش‌ها حفظ می‌گردد و در صورت نیاز در هر زمان می‌توانید آن را <strong>بازگردانی</strong> کنید.
            </p>
          </div>

          {/* Reason Select */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              علت انتقال به حذفیات:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="اتمام پروژه و تسویه کامل قرارداد">اتمام پروژه و تسویه کامل قرارداد</option>
              <option value="فسخ یا انصراف قرارداد آزمایشگاهی">فسخ یا انصراف قرارداد آزمایشگاهی</option>
              <option value="ثبت تکراری یا اطلاعات اشتباه">ثبت تکراری یا اطلاعات اشتباه</option>
              <option value="درخواست کتبی کارفرما">درخواست کتبی کارفرما</option>
              <option value="other">سایر دلایل (تایپ دستی)...</option>
            </select>
          </div>

          {reason === 'other' && (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                توضیح علت:
              </label>
              <input
                type="text"
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="علت حذف را بنویسید..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'در حال انتقال...' : 'انتقال به پوشه حذفیات'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
