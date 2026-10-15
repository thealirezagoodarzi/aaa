import React, { useState, useEffect } from 'react';
import { Customer, TrashCustomerItem } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  X, 
  Building2, 
  Calendar, 
  User, 
  ShieldAlert,
  CheckCircle2,
  Search,
  ArchiveRestore
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';

interface AdminCustomerTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const AdminCustomerTrashModal: React.FC<AdminCustomerTrashModalProps> = ({
  isOpen,
  onClose,
  onRestored
}) => {
  useModalBack(isOpen, onClose, 'admin-trash-modal');

  const [trashItems, setTrashItems] = useState<TrashCustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadTrash = () => {
    setTrashItems(labDb.getTrashCustomers());
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = (customerId: string, companyName: string) => {
    const success = labDb.restoreCustomer(customerId);
    if (success) {
      setSuccessNotice(`شرکت "${companyName}" با موفقیت به لیست مشتریان فعال بازگردانده شد.`);
      loadTrash();
      if (onRestored) onRestored();
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  const handlePermanentDelete = (customerId: string, companyName: string) => {
    if (confirm(`آیا از حذف دائمی و غیرقابل بازگشت شرکت "${companyName}" اطمینان قطعی دارید؟ این اطلاعات برای همیشه پاک خواهد شد.`)) {
      labDb.permanentDeleteCustomer(customerId);
      loadTrash();
      setSuccessNotice(`اطلاعات شرکت "${companyName}" به صورت دائمی پاک شد.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  const handleEmptyTrash = () => {
    if (confirm('آیا از تخلیه کامل تمام حذفیات اطمینان دارید؟ تمام موارد موجود در این پوشه برای همیشه حذف خواهند شد.')) {
      labDb.emptyCustomerTrash();
      loadTrash();
      setSuccessNotice('پوشه حذفیات کاملاً تخلیه شد.');
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  const filteredItems = trashItems.filter(item => 
    item.customer.companyName.toLowerCase().includes(search.toLowerCase()) ||
    item.customer.representativeName.toLowerCase().includes(search.toLowerCase()) ||
    item.customer.phone.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  پوشه حذفیات و سطل زباله مشتریان
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono font-bold text-xs">
                  {toPersianDigits(trashItems.length)} مورد
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                کارفرمایان حذف‌شده در این بخش نگهداری می‌شوند و امکان بازگردانی کامل اطلاعات وجود دارد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trashItems.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/60 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تخلیه کامل سطل زباله</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {successNotice && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی شرکت یا نماینده در حذفیات..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pe-9 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ArchiveRestore className="w-4 h-4 text-blue-500" />
            <span>با کلیک روی «بازگردانی»، کارفرما بلافاصله به لیست فعال اضافه می‌شود.</span>
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Trash2 className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                پوشه حذفیات خالی است
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                هیچ شرکتی در سطل زباله وجود ندارد. هر زمان شرکتی را حذف کنید، قبل از حذف دائمی در این قسمت قرار می‌گیرد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.customer.id}
                  className="bg-white dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.customer.companyName}
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          نماینده: {item.customer.representativeName}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {item.customer.id}
                    </span>
                  </div>

                  {/* Deletion Metadata */}
                  <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        <span>تاریخ حذف: {toPersianDigits(item.deletedAtJalali)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-rose-500" />
                        <span>توسط: {item.deletedBy}</span>
                      </span>
                    </div>
                    {item.reason && (
                      <div className="text-slate-600 dark:text-slate-400 text-[10.5px]">
                        علت: {item.reason}
                      </div>
                    )}
                  </div>

                  {/* Financial & Project summary */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="text-slate-400 block text-[10px]">مبلغ کل قرارداد:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">
                        {toPersianDigits((item.customer.totalContractAmount || 0).toLocaleString())} تومان
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">مانده تراز:</span>
                      <strong className="font-mono text-amber-600 dark:text-amber-400">
                        {toPersianDigits((item.customer.balance || 0).toLocaleString())} تومان
                      </strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handlePermanentDelete(item.customer.id, item.customer.companyName)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-slate-600 dark:text-slate-400 font-bold text-xs transition cursor-pointer"
                    >
                      حذف دائمی
                    </button>

                    <button
                      onClick={() => handleRestore(item.customer.id, item.customer.companyName)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازگردانی به لیست</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
