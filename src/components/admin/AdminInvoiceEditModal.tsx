import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Calculator, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Invoice } from '../../types';
import { toPersianDigits } from '../../utils/jalali';
import { labDb } from '../../services/ConcreteLabStorage';

interface AdminInvoiceEditModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSaveSuccess: (updatedInvoice: Invoice) => void;
}

export const AdminInvoiceEditModal: React.FC<AdminInvoiceEditModalProps> = ({
  invoice,
  onClose,
  onSaveSuccess
}) => {
  const [invoiceNo, setInvoiceNo] = useState(invoice.invoiceNo);
  const [customerName, setCustomerName] = useState(invoice.customerName);
  const [projectName, setProjectName] = useState(invoice.projectName);
  const [issueDateJalali, setIssueDateJalali] = useState(invoice.issueDateJalali);
  const [dueDateJalali, setDueDateJalali] = useState(invoice.dueDateJalali);
  const [status, setStatus] = useState<Invoice['status']>(invoice.status);
  const [discountAmount, setDiscountAmount] = useState<number>(invoice.discountAmount || 0);

  // Items
  const [items, setItems] = useState(
    invoice.items && invoice.items.length > 0
      ? JSON.parse(JSON.stringify(invoice.items))
      : [
          {
            description: 'خدمات نمونه‌برداری و آزمون مقاومت فشاری نمونه‌های بتن',
            quantity: 1,
            unitPrice: invoice.amount || 0,
            total: invoice.amount || 0
          }
        ]
  );

  // Calculate Subtotal from Items
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
  const taxAmount = Math.round((subtotal - discountAmount) * 0.1); // 10% VAT
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
      const p = Number(field === 'unitPrice' ? value : updated[index].unitPrice) || 0;
      updated[index].total = q * p;
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: 'آیتم جدید خدمات آزمایشگاهی',
        quantity: 1,
        unitPrice: 1000000,
        total: 1000000
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_: any, i: number) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<Invoice> = {
      invoiceNo,
      customerName,
      projectName,
      issueDateJalali,
      dueDateJalali,
      status,
      items,
      amount: subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAt: status === 'paid' ? (invoice.paidAt || new Date().toISOString()) : undefined
    };

    const saved = labDb.updateInvoice(invoice.id, updates);
    if (saved) {
      onSaveSuccess(saved);
    } else {
      // Fallback
      onSaveSuccess({ ...invoice, ...updates } as Invoice);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                ویرایش مشخصات و اقلام فاکتور رسمی
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {invoiceNo} • {customerName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                شماره فاکتور:
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                وضعیت پرداخت:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
              >
                <option value="unpaid">معوق (در انتظار پرداخت)</option>
                <option value="pending_settlement">درخواست تسویه مشتری</option>
                <option value="paid">تسویه شده (کامل)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                نام کارفرما / خریدار:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                عنوان پروژه:
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاریخ صدور (شمسی):
              </label>
              <input
                type="text"
                value={issueDateJalali}
                onChange={(e) => setIssueDateJalali(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                placeholder="۱۴۰۳/۰۶/۱۵"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                تاریخ سررسید (شمسی):
              </label>
              <input
                type="text"
                value={dueDateJalali}
                onChange={(e) => setDueDateJalali(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                placeholder="۱۴۰۳/۰۷/۱۵"
                required
              />
            </div>
          </div>

          {/* Invoice Items Section */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>ردیف‌های خدمات و بهای اقلام</span>
                <span className="text-[10px] text-slate-400">({toPersianDigits(items.length)} ردیف)</span>
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ردیف جدید</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2 text-xs">
                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="شرح خدمت..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        placeholder="تعداد"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-center"
                        required
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="10000"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        placeholder="قیمت واحد"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-end"
                        required
                      />
                    </div>

                    <div className="w-28 text-end font-mono font-bold text-blue-600 dark:text-blue-400">
                      {toPersianDigits(item.total.toLocaleString())}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 transition cursor-pointer"
                      title="حذف ردیف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount & Totals Breakdown */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>جمع مبالغ خدمات:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {toPersianDigits(subtotal.toLocaleString())} تومان
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">مبلغ تخفیف اعطایی:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="50000"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-end text-rose-600 font-bold"
                  />
                  <span className="text-slate-400">تومان</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>مالیات بر ارزش افزوده (۱۰٪):</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {toPersianDigits(taxAmount.toLocaleString())} تومان
                </span>
              </div>

              <div className="flex items-center justify-between text-sm font-black pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                <span className="text-blue-600 dark:text-blue-400">مبلغ نهایی قابل پرداخت:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                  {toPersianDigits(totalAmount.toLocaleString())} تومان
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تغییرات فاکتور</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
