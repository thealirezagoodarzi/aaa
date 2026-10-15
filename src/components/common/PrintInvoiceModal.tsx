import React, { useEffect, useState } from 'react';
import { Invoice, Customer } from '../../types';
import { toPersianDigits, gregorianToJalali, formatJalali } from '../../utils/jalali';
import { LAB_INFO } from '../../services/supabase';
import { CompanyLogo } from './CompanyLogo';
import { 
  Building2, 
  Printer, 
  Download, 
  X, 
  ShieldCheck, 
  ArrowRight, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet,
  QrCode,
  Loader2
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';
// PERF FIX (audit #46): html2pdf.js is a multi-MB library; load it lazily on
// first PDF export click instead of statically importing it into the main chunk.
// import { downloadContractPdf } from '../../utils/contractPdfGenerator';
import { printOnlyElement, downloadBlob } from '../../utils/printDom';

// Print only the invoice document; fall back to full page print.
const printInvoice = () => {
  if (!printOnlyElement('invoice-print-area')) window.print();
};

interface PrintInvoiceModalProps {
  invoice: Invoice;
  customer?: Customer;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  invoice,
  customer,
  onClose
}) => {
  useModalBack(true, onClose, 'print-invoice-modal');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    printInvoice();
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return; // guard against double-clicks
    setIsExportingPdf(true);
    try {
      const { downloadContractPdf } = await import('../../utils/contractPdfGenerator');
      const ok = await downloadContractPdf('invoice-print-area', `Factor-${invoice.invoiceNo || 'lab'}`);
      if (!ok) {
        // Generator could not produce the PDF (missing element / timeout):
        // open exactly ONE controlled print dialog as a graceful fallback.
        printInvoice();
      }
    } catch (err) {
      console.warn('PDF generation fallback to print:', err);
      printInvoice();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['ردیف', 'شرح خدمات آزمایشگاهی', 'تعداد', 'قیمت واحد (تومان)', 'مبلغ کل (تومان)'];
    const rows = (invoice.items || []).map((item, idx) => [
      idx + 1,
      `"${item.description}"`,
      item.quantity,
      item.unitPrice,
      item.total
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Invoice-${invoice.invoiceNo}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      
      {/* Fixed Top-Start Back Button */}
      <button
        onClick={onClose}
        className="fixed top-4 start-4 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/95 text-white hover:bg-slate-800 border border-slate-700 shadow-2xl font-bold text-xs backdrop-blur-md transition no-print active:scale-95 cursor-pointer"
        title="بازگشت به پرتال"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-400" />
        <span>بازگشت (ESC)</span>
      </button>

      {/* Top Floating Control Bar (Hidden on print) */}
      <div className="fixed top-4 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 no-print">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-md transition text-white active:scale-95"
          title="بازگشت به پرتال (ESC)"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          <span>بازگشت به پرتال</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-md transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>چاپ فاکتور (A4)</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
        >
          {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isExportingPdf ? 'در حال تولید...' : 'ذخیره PDF'}</span>
        </button>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs transition"
          title="دریافت فایل اکسل"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">خروجی اکسل</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fixed Prominent Top-Start Back Button */}
      <button
        onClick={onClose}
        className="fixed top-4 start-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 text-white hover:bg-slate-800 border border-slate-700 shadow-xl font-bold text-xs backdrop-blur-md transition no-print"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-400" />
        <span className="hidden sm:inline">بازگشت (ESC)</span>
        <span className="sm:hidden">بازگشت</span>
      </button>

      {/* A4 Invoice Paper Container */}
      <div id="invoice-print-area" className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-card my-14 print:my-0 print:border-none print:shadow-none p-6 sm:p-10 font-sans">
        
        {/* Invoice Border Container */}
        <div className="border-2 border-slate-800 p-6 rounded-lg relative">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-800 pb-4 mb-6 gap-4">
            <div className="flex items-center gap-3 text-start">
              <CompanyLogo className="w-12 h-12 rounded-xl shrink-0" iconClassName="w-7 h-7 text-white" />
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {LAB_INFO.name}
                </h1>
                <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                  شماره ثبت: {toPersianDigits(LAB_INFO.registrationNo)} • پروانه اشتغال فنی آزمایشگاهی: {toPersianDigits(LAB_INFO.licenseNo)} ({LAB_INFO.licenseIssuer})
                </p>
                <p className="text-[10px] text-slate-500">
                  نشانی: {LAB_INFO.address} • تلفن: <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }} className="font-mono font-bold">{toPersianDigits(LAB_INFO.phone)}</span>
                </p>
              </div>
            </div>

            <div className="text-center sm:text-end shrink-0">
              <div className="inline-block px-3.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                صورتحساب رسمی خدمات آزمایشگاهی
              </div>
              <div className="text-xs space-y-1 mt-2 font-mono text-slate-700">
                <div>شماره فاکتور: <strong className="text-blue-800">{invoice.invoiceNo}</strong></div>
                <div>تاریخ صدور: <strong>{toPersianDigits(invoice.issueDateJalali)}</strong></div>
                <div>سررسید: <strong>{toPersianDigits(invoice.dueDateJalali)}</strong></div>
              </div>
            </div>
          </div>

          {/* Buyer Information Section */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6 text-xs text-start">
            <h3 className="font-black text-slate-800 mb-2 border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>مشخصات کارفرما / خریدار خدمات</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">
                کد مشتری: {customer?.id || invoice.customerId}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">نام شرکت / متقاضی:</span>
                <span className="font-bold text-slate-900">{invoice.customerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">پروژه عمرانی:</span>
                <span className="font-bold text-blue-900">{invoice.projectName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">نماینده کارگاه / مدیر پروژه:</span>
                <span className="font-bold text-slate-900">{customer?.representativeName || invoice.customerName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">شماره تماس مستقیم:</span>
                <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }} className="font-bold font-mono text-slate-900">
                  {customer?.phone ? toPersianDigits(customer.phone) : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">کد اقتصادی خریدار:</span>
                <span className="font-mono text-slate-900">{customer?.economicCode || '۴۱۱۴۸۸۹۹۲۳۱'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">نشانی پروژه:</span>
                <span className="text-slate-800">{customer?.address || 'تهران، سعادت‌آباد، خیابان سرو شرقی'}</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto mb-6 text-start">
            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 text-center border-e border-slate-300 w-12">ردیف</th>
                  <th className="p-2.5 text-start border-e border-slate-300">شرح خدمات آزمایشگاهی و آزمون‌های کنترل کیفی بتن</th>
                  <th className="p-2.5 text-center border-e border-slate-300 w-20">تعداد</th>
                  <th className="p-2.5 text-center border-e border-slate-300 w-32">قیمت واحد (تومان)</th>
                  <th className="p-2.5 text-center w-36">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="p-2.5 text-center border-e border-slate-200 font-mono">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="p-2.5 border-e border-slate-200 font-medium text-slate-800">
                      {item.description}
                    </td>
                    <td className="p-2.5 text-center border-e border-slate-200 font-mono font-bold">
                      {toPersianDigits(item.quantity)}
                    </td>
                    <td className="p-2.5 text-end border-e border-slate-200 font-mono">
                      {toPersianDigits(item.unitPrice.toLocaleString())}
                    </td>
                    <td className="p-2.5 text-end font-mono font-bold text-slate-900">
                      {toPersianDigits(item.total.toLocaleString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals & Payment Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start mb-6 text-start">
            
            {/* Payment Verdict Stamp */}
            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block mb-1">وضعیت تسویه فاکتور:</span>
                {invoice.status === 'paid' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>پرداخت شده و تسویه حساب کامل</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 font-black text-xs">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>در انتظار تسویه سررسید</span>
                  </div>
                )}
                {invoice.paidAt && (
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    تاریخ تراکنش: {(() => { const j = gregorianToJalali(new Date(invoice.paidAt).getFullYear(), new Date(invoice.paidAt).getMonth() + 1, new Date(invoice.paidAt).getDate()); return toPersianDigits(formatJalali(j)); })()}
                  </p>
                )}
              </div>

              {/* Official Stamp Simulation */}
              <div className={`w-24 h-24 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-1.5 rotate-[-8deg] ${
                invoice.status === 'paid'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                  : 'border-amber-700 bg-amber-50 text-amber-800'
              }`}>
                <ShieldCheck className="w-6 h-6 mb-0.5" />
                <span className="text-[9px] font-black uppercase text-center leading-tight">
                  {invoice.status === 'paid' ? 'امور مالی تسویه شد' : 'در انتظار واریز'}
                </span>
                <span className="text-[8px] font-mono mt-0.5">FINANCE DEPT</span>
              </div>
            </div>

            {/* Sum breakdown table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
              <div className="flex items-center justify-between p-2.5 border-b border-slate-200 bg-slate-50">
                <span className="text-slate-600">مجموع خدمات ناخالص:</span>
                <span className="font-mono font-bold text-slate-900">{toPersianDigits(invoice.amount.toLocaleString())} تومان</span>
              </div>
              <div className="flex items-center justify-between p-2.5 border-b border-slate-200">
                <span className="text-slate-600">تخفیف همکاری پروژه‌ای:</span>
                <span className="font-mono font-bold text-rose-600">
                  {invoice.discountAmount ? `- ${toPersianDigits(invoice.discountAmount.toLocaleString())}` : '۰'} تومان
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 border-b border-slate-200 bg-slate-50">
                <span className="text-slate-600">مالیات بر ارزش افزوده (۱۰٪):</span>
                <span className="font-mono font-bold text-slate-900">{toPersianDigits(invoice.taxAmount.toLocaleString())} تومان</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 text-white font-black text-sm">
                <span>مبلغ کل نهایی و قابل پرداخت:</span>
                <span className="font-mono text-emerald-400">{toPersianDigits(invoice.totalAmount.toLocaleString())} تومان</span>
              </div>
            </div>

          </div>

          {/* Bank Account & Signatures */}
          <div className="border-t-2 border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-start">
            <div className="sm:col-span-2">
              <span className="font-bold text-slate-800 block mb-1">اطلاعات حساب جهت واریز پایا و ساتنا:</span>
              <p className="text-[11px] text-slate-600 font-mono">
                شماره شبا: IR720120000000003849102938 • بانک ملت شعبه مرکزی<br />
                به نام: آزمایشگاه تخصصی بتن
              </p>
            </div>

            <div className="text-center sm:text-end flex flex-col items-center sm:items-end justify-end">
              <div className="flex items-center gap-2">
                <QrCode className="w-10 h-10 text-slate-800" />
                <div className="text-[10px] text-slate-500 text-start leading-tight">
                  شناسه پرداخت شاپرک<br />
                  استعلام برخط فاکتور
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-800 mt-2">امضای امور مالی و صدور اسناد</span>
            </div>
          </div>

        </div>

        {/* Bottom Document Action Bar (Hidden on print) */}
        <div className="no-print mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition active:scale-95"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-600" />
            <span>بازگشت به پرتال مشتریان</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>دانلود اکسل (CSV)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور رسمی (A4)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
            >
              <Download className="w-4 h-4" />
              <span>ذخیره PDF</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
