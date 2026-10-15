import React, { useState } from 'react';
import { Customer, Invoice } from '../../types';
import { LAB_INFO, labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { 
  CreditCard, 
  Phone, 
  X, 
  Building, 
  Copy, 
  Check, 
  AlertCircle, 
  FileText, 
  Send, 
  CheckCircle2,
  Clock,
  ShieldAlert
} from 'lucide-react';

interface CustomerPaymentModalProps {
  customer: Customer | null;
  invoice?: Invoice | null;
  amountToPay?: number;
  onClose: () => void;
  onPaymentNotified?: () => void;
}

export const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({
  customer,
  invoice,
  amountToPay,
  onClose,
  onPaymentNotified
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [documentNo, setDocumentNo] = useState('');
  const [payMethod, setPayMethod] = useState<'bank_transfer' | 'card_to_card' | 'pos' | 'cheque'>('bank_transfer');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);

  // Never allow negative/NaN amounts; the declared payment is capped at the balance.
  const rawAmount = amountToPay !== undefined
    ? amountToPay
    : invoice
      ? invoice.totalAmount
      : (customer?.balance || 0);
  const finalAmount = Math.max(0, Number.isFinite(rawAmount) ? rawAmount : 0);

  const bankAccounts = [
    {
      bank: 'بانک ملت',
      accountName: 'شرکت مهندسین آزما بتن پایش خاک و پی جهان بین (صالح صادقی نیا)',
      cardNumber: '۶۱۰۴-۳۳۷۸-۹۹۲۱-۴۴۰۵',
      shabaNumber: 'IR54-0120-0000-0000-4491-8821-02',
      accountNumber: '۴۴۹۱۸۸۲۱۰۲',
    },
    {
      bank: 'بانک پاسارگاد',
      accountName: 'آزمایشگاه آزما بتن پایش خاک و پی جهان بین',
      cardNumber: '۵۰۲۲-۲۹۱۰-۸۸۴۲-۷۷۱۹',
      shabaNumber: 'IR89-0570-0291-8000-1124-7700-01',
      accountNumber: '۲۹۱۸۰۰۰۱۱۲۴۷۷۰۰۱',
    }
  ];

  const selectedBank = bankAccounts[selectedBankIdx] || bankAccounts[0];

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text.replace(/-/g, ''));
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmitNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setIsSubmitting(true);

    const todayJalali = formatJalali(getTodayJalali());

    // Validation: never record a fake/default amount — the declared payment
    // must be a positive number within the remaining balance.
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      setErrorMsg('مانده حسابی برای پرداخت وجود ندارد یا مبلغ اعلامی نامعتبر است.');
      setIsSubmitting(false);
      return;
    }
    if ((customer.balance || 0) > 0 && finalAmount > (customer.balance || 0)) {
      setErrorMsg('مبلغ وارد شده بیشتر از مانده حساب است.');
      setIsSubmitting(false);
      return;
    }
    if (!documentNo.trim()) {
      setErrorMsg('لطفاً شماره سند/رسید واریز را وارد کنید.');
      setIsSubmitting(false);
      return;
    }

    // Record the payment notification (bank name taken from the selected account card)
    labDb.addCustomerPayment(customer.id, {
      amount: finalAmount,
      method: payMethod,
      documentNo: documentNo.trim(),
      bankName: payMethod === 'card_to_card' ? 'کارت به کارت' : (selectedBank?.bank || 'حواله بانکی'),
      jalaliDate: todayJalali,
      description: `اعلام پرداخت توسط کارفرما: ${description || 'بابت تسویه فاکتور و شیت‌های آزمایش'}`,
      registeredBy: `کارفرما (${customer.representativeName})`,
      status: 'pending' // Pending approval from accounting admin
    });

    // Mark invoice(s) as pending settlement approval by admin
    if (invoice) {
      labDb.requestInvoiceSettlement(invoice.id, `فیش واریزی توسط مشتری: ${documentNo || 'اعلام پرداخت'}`);
    } else {
      labDb.requestCustomerSettlement(customer.id, `فیش واریزی توسط مشتری: ${documentNo || 'اعلام پرداخت'}`);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      if (onPaymentNotified) onPaymentNotified();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                راهنمای تسویه حساب و پرداخت خدمات آزمایشگاهی
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {customer?.companyName} • {invoice ? `فاکتور شماره ${invoice.invoiceNo}` : 'تسویه حساب پرونده'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent "Contact Laboratory" Notice */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/40 dark:border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 shrink-0 mt-0.5">
              <Phone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                درگاه پرداخت آنلاین شاپرک در دست ارتقا می‌باشد
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                جهت تسویه حساب و دریافت گواهینامه معتبر، لطفاً از طریق شماره‌های زیر با واحد مالی آزمایشگاه تماس حاصل فرمایید یا فیش واریزی خود را ثبت نمایید.
              </p>
            </div>
          </div>

          <a 
            href={`tel:${LAB_INFO.phone}`}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shrink-0 transition"
          >
            <Phone className="w-4 h-4" />
            <span>تماس فوری با آزمایشگاه</span>
          </a>
        </div>

        {/* Amount Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">مبلغ قابل تسویه:</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
              {toPersianDigits(finalAmount.toLocaleString())} <span className="text-xs font-sans text-slate-500">تومان</span>
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">شماره تماس پشتیبانی مالی:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono mt-1 block dir-ltr text-end sm:text-start">
              {LAB_INFO.phone} / 09131703177
            </span>
          </div>
        </div>

        {/* Official Bank Account Cards */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-500" />
            <span>شماره حساب‌های رسمی و معتبر آزمایشگاه جهت واریز:</span>
          </h4>

          <div className="grid grid-cols-1 gap-3">
            {bankAccounts.map((acc, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedBankIdx(idx)}
                className={`cursor-pointer p-4 rounded-2xl border space-y-2.5 text-xs transition ${selectedBankIdx === idx ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/40' : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedBankIdx === idx ? 'bg-blue-600' : 'bg-slate-400'}`} />
                    {acc.bank}
                    {selectedBankIdx === idx && <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">(حساب انتخاب‌شده برای واریز)</span>}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    به نام: {acc.accountName}
                  </span>
                </div>

                {/* Card Number */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[11px]">شماره کارت:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 dir-ltr">
                      {acc.cardNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.cardNumber, `card-${idx}`)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition"
                      title="کپی شماره کارت"
                    >
                      {copiedField === `card-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Shaba Number */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[11px]">شماره شبا (IBAN):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 dir-ltr">
                      {acc.shabaNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(acc.shabaNumber, `shaba-${idx}`)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition"
                      title="کپی شماره شبا"
                    >
                      {copiedField === `shaba-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notify Lab of Payment Form */}
        {submitted ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              اطلاعات پرداخت با موفقیت برای مدیریت مالی ارسال شد
            </h4>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              پس از بررسی فیش واریزی توسط حسابداری، گواهینامه‌ها به‌صورت خودکار آزاد خواهند شد.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitNotification} className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span>ثبت اطلاعات فیش واریزی / شماره پیگیری تراکنش</span>
            </h4>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  روش پرداخت *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => { setPayMethod(e.target.value as any); if (errorMsg) setErrorMsg(null); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="bank_transfer">حواله پایا / ساتنا</option>
                  <option value="card_to_card">کارت به کارت</option>
                  <option value="pos">واریز از دستگاه کارتخوان آزمایشگاه</option>
                  <option value="cheque">چک صیادی بانکی</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  شماره فیش / کد پیگیری / شماره چک *
                </label>
                <input
                  type="text"
                  required
                  value={documentNo}
                  onChange={(e) => { setDocumentNo(e.target.value); if (errorMsg) setErrorMsg(null); }}
                  placeholder="مثال: TR-984120 یا شماره پیگیری"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                توضیحات تکمیلی (اختیاری)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="واریز از حساب بانک تجارت به نام..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95 disabled:opacity-70 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'در حال ثبت...' : 'ارسال فیش به حسابداری آزمایشگاه'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
