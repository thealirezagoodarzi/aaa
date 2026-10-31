import React, { useState } from 'react';
import { Customer } from '../../types';
import { 
  Printer, 
  X, 
  FileSignature, 
  Edit3, 
  FileDown, 
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';
import { LAB_INFO } from '../../services/supabase';
// PERF FIX (audit #46): `docx` is a multi-MB library that was previously a
// static import here — so it landed in the main SPA chunk and slowed every
// first load even though DOCX export is a rare, user-triggered action.
// It is now loaded via dynamic import() on click; vite.config.ts also pins it
// into its own cacheable vendor chunk.
// import { generateAndDownloadContractDocx } from '../../utils/contractDocxGenerator';
// PERF FIX (audit #46): html2pdf.js (pulled in by contractPdfGenerator) is also
// multi-MB — loaded lazily via dynamic import() on first PDF export click.
// import { downloadContractPdf } from '../../utils/contractPdfGenerator';
import { printOnlyElement, printIsolatedElement, downloadBlob } from '../../utils/printDom';

interface PrintContractModalProps {
  customer: Customer | null;
  isCustomerView?: boolean;
  onClose: () => void;
}

export const PrintContractModal: React.FC<PrintContractModalProps> = ({ 
  customer, 
  isCustomerView = false, 
  onClose 
}) => {
  // Mode: filled contract vs completely blank template
  const [isBlankTemplate, setIsBlankTemplate] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'compact' | 'large'>('normal');
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Controlled fields populated from customer data with fallback to empty string
  const [companyName, setCompanyName] = useState(customer?.companyName || customer?.representativeName || '');
  const [repName, setRepName] = useState(customer?.representativeName || '');
  const [nationalId, setNationalId] = useState(customer?.nationalId || '');
  const [regPlate, setRegPlate] = useState(customer?.cadastralNo || '');
  const [nezamNo, setNezamNo] = useState(customer?.nezamNo || '');
  const [phone, setPhone] = useState(customer?.phone || customer?.landlinePhone || '');
  const [area, setArea] = useState(customer?.mapAreaM2 ? String(customer.mapAreaM2) : '');
  const [projectAddress, setProjectAddress] = useState(
    customer?.projectAddress?.trim() 
    || (customer?.projectNames && customer.projectNames.length > 0 ? customer.projectNames.join(' - ') : '') 
    || customer?.address?.trim() 
    || ''
  );
  const [customerAddress, setCustomerAddress] = useState(customer?.address?.trim() || '');
  const [seriesCount, setSeriesCount] = useState(customer?.sampleSeriesCount ? String(customer.sampleSeriesCount) : '');
  const [pricePerSeries, setPricePerSeries] = useState(customer?.pricePerSeries ? String(customer.pricePerSeries) : '');
  const [totalAmountState, setTotalAmountState] = useState(customer?.totalContractAmount ? String(customer.totalContractAmount) : '');
  
  // Real official lab address and phone
  const [labAddress, setLabAddress] = useState(LAB_INFO.address || 'شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰');
  const [labPhone, setLabPhone] = useState(LAB_INFO.phoneRaw || '09131703177');

  const [showEditor, setShowEditor] = useState(false);

  if (!customer) return null;

  const handlePrint = () => {
    // Print isolated 2-page contract using dedicated iframe to prevent dashboard bleeding
    if (!printIsolatedElement('contract-printable-doc', 'قرارداد رسمی ارائه خدمات آزمایشگاهی بتن')) {
      if (!printOnlyElement('contract-printable-doc')) {
        window.print();
      }
    }
  };

  // Safe formatting helper: return value if in filled mode and present, otherwise dotted line placeholder
  const renderBlankOrValue = (
    val: string | number | undefined | null, 
    defaultDots: string = '...............................................',
    prefix: string = '',
    suffix: string = ''
  ) => {
    if (isBlankTemplate) return defaultDots;
    if (val === undefined || val === null) return defaultDots;
    const s = String(val).trim();
    if (s.length === 0) return defaultDots;
    return `${prefix}${toPersianDigits(s)}${suffix}`;
  };

  // Helper for numeric values with formatting
  const formatNumberWithCommas = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) return '';
    return parseInt(raw, 10).toLocaleString('fa-IR');
  };

  // Auto calculate total if series and price provided
  const calculateTotalRials = () => {
    if (totalAmountState && totalAmountState.trim().length > 0) {
      return renderBlankOrValue(formatNumberWithCommas(totalAmountState), '.....................................');
    }
    const s = parseInt(seriesCount.replace(/\D/g, ''), 10);
    const p = parseInt(pricePerSeries.replace(/\D/g, ''), 10);
    if (!isNaN(s) && !isNaN(p) && s > 0 && p > 0) {
      return toPersianDigits((s * p).toLocaleString('fa-IR'));
    }
    return '.....................................';
  };

  const currentEmployerName = renderBlankOrValue(
    companyName || repName,
    '...............................................'
  );

  const cleanFilename = `gharardad-${(companyName || repName || customer.id).replace(/\s+/g, '_')}`;

  // Word (.docx) export handler
  const handleDownloadDocx = async () => {
    if (isCustomerView) return; // Strict security restriction for customer
    if (isGeneratingDocx) return; // guard against double-clicks
    try {
      setIsGeneratingDocx(true);
      // PERF FIX (audit #46): load the multi-MB `docx` library lazily, only
      // when the user actually clicks the Word-export button.
      const { generateAndDownloadContractDocx } = await import('../../utils/contractDocxGenerator');
      await generateAndDownloadContractDocx({
        companyName,
        repName,
        nationalId,
        regPlate,
        nezamNo,
        phone,
        area,
        projectAddress,
        customerAddress,
        seriesCount,
        pricePerSeries,
        totalAmount: totalAmountState,
        labAddress,
        labPhone: toPersianDigits(labPhone),
        isBlankTemplate
      }, `${cleanFilename}.docx`);
      setNotification('فایل Word قرارداد با موفقیت تولید و دانلود شد.');
      setTimeout(() => setNotification(null), 4000);
    } catch (e) {
      setNotification('خطا در ایجاد فایل Word، لطفاً از دکمه چاپ یا PDF استفاده فرمایید.');
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  // Real PDF download handler
  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return; // guard against double-clicks queuing renders
    try {
      setIsGeneratingPdf(true);
      const { downloadContractPdf } = await import('../../utils/contractPdfGenerator');
      // BUG FIX (problem #3): `downloadContractPdf` resolves to a
      // PdfExportResponse OBJECT ({ status, success, error, pageCount }), which
      // is always truthy — the old `if (success)` therefore reported "PDF
      // downloaded successfully" even when the render had timed out or failed,
      // and the print-dialog fallback never ran. Inspect the actual result now.
      const result = await downloadContractPdf('contract-printable-doc', `${cleanFilename}.pdf`);
      if (result?.status === 'SUCCESS' && result.pageCount && result.pageCount > 1) {
        setNotification(`فایل PDF رسمی قرارداد (${toPersianDigits(String(result.pageCount))} صفحه) با موفقیت تولید و دانلود شد.`);
      } else if (result?.status === 'SUCCESS') {
        setNotification('فایل PDF رسمی قرارداد با موفقیت تولید و دانلود شد.');
      } else {
        // Fallback: Trigger clean print dialog so user can Save as PDF
        printOnlyElement('contract-printable-doc');
        setNotification('پنجره چاپ آماده شد. در پنجره باز شده، گزینه «Save as PDF» (ذخیره به عنوان PDF) را انتخاب فرمایید.');
      }
      setTimeout(() => setNotification(null), 5000);
    } catch (e: any) {
      console.error('PDF download error:', e);
      printOnlyElement('contract-printable-doc');
      setNotification('پنجره چاپ آماده شد. لطفاً در بخش چاپگر گزینه «Save as PDF» را انتخاب نمایید.');
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm print:static print:inset-auto print:z-auto print:block print:bg-white print:p-0 print:overflow-visible print:h-auto animate-fadeIn">
      
      {/* Container Box */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full p-4 sm:p-6 overflow-y-auto max-h-[95vh] print:static print:max-h-none print:h-auto print:overflow-visible print:shadow-none print:border-none print:rounded-none print:w-full print:p-0">
        
        {/* ========================================================================= */}
        {/* Top Controls Toolbar - STRICTLY HIDDEN IN PRINT                          */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-4 print:hidden gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-800 dark:text-white">
                  قرارداد رسمی خدمات آزمایشگاهی بتن (۲ صفحه‌ای)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>تطابق کامل با سند حقوقی آزمایشگاه</span>
                </span>
                {isCustomerView && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                    پرتال مشتری (دانلود نسخه نهایی PDF)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                طرف قرارداد: <span className="font-bold text-slate-700 dark:text-slate-300">{customer.companyName || customer.representativeName}</span>
                {customer.contractNo && ` | شماره ثبت دبیرخانه: ${toPersianDigits(customer.contractNo)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
            {/* Blank vs Filled Template Toggle (Admin/Operator only) */}
            {!isCustomerView && (
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsBlankTemplate(false)}
                  className={`px-3 py-1.5 rounded-lg transition ${!isBlankTemplate ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  تکمیل‌شده
                </button>
                <button
                  type="button"
                  onClick={() => setIsBlankTemplate(true)}
                  className={`px-3 py-1.5 rounded-lg transition ${isBlankTemplate ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                  title="نمایش قالب خام با نقطه‌چین جهت چاپ فرم سفید دستی"
                >
                  قالب خام سفید
                </button>
              </div>
            )}

            {/* Quick Inline Editor Toggle (Admin/Operator only) */}
            {!isCustomerView && (
              <button
                type="button"
                onClick={() => setShowEditor(!showEditor)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${showEditor ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
              >
                <Edit3 className="w-4 h-4" />
                <span>{showEditor ? 'بستن تنظیمات' : 'تنظیم متن و نشانی'}</span>
              </button>
            )}

            {/* Direct Print Button (Isolated Iframe, Clean 2-page A4) */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
              title="چاپ مستقیم قرارداد دو صفحه‌ای با ابعاد دقیق A4 بدون پس‌زمینه"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ قرارداد (A4)</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
              title="دانلود فایل PDF رسمی قرارداد دو صفحه‌ای"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'در حال ایجاد فایل PDF (۲ صفحه)...' : 'دانلود PDF رسمی'}</span>
            </button>

            {/* Real Word (.docx) Download Button - ONLY FOR LAB ADMIN / STAFF (HIDDEN FOR CUSTOMER) */}
            {!isCustomerView && (
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={isGeneratingDocx}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-700/20 active:scale-95 cursor-pointer"
                title="دانلود فایل Word (.docx) قابل ویرایش، ۲ صفحه‌ای و منطبق با پیش‌نمایش"
              >
                <FileText className="w-4 h-4" />
                <span>{isGeneratingDocx ? 'در حال ایجاد ورد...' : 'دانلود Word (.docx)'}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Toast / Notification */}
        {notification && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs flex items-center gap-2 print:hidden animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{notification}</span>
          </div>
        )}

        {/* Customer Portal Notice if in customer mode */}
        {isCustomerView && (
          <div className="mb-4 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 rounded-2xl text-xs flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>کارفرمای گرامی، نسخه نهایی قرارداد رسمی آزمایشگاه آماده است. شما می‌توانید فایل PDF قرارداد را به صورت مستقیم دانلود یا چاپ فرمایید.</span>
            </div>
          </div>
        )}

        {/* Quick Inline Editor - Hidden in print and hidden in customer view */}
        {showEditor && !isCustomerView && (
          <div className="bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl p-4 mb-6 print:hidden border border-blue-100 dark:border-blue-900/40 text-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-blue-600" />
                تنظیم مشخصات و نشانی‌های مندرج در قرارداد قبل از چاپ یا دانلود (تغییرات به صورت آنی اعمال می‌شود):
              </h4>
              <button
                type="button"
                onClick={() => {
                  setCompanyName(customer.companyName || customer.representativeName || '');
                  setRepName(customer.representativeName || '');
                  setNationalId(customer.nationalId || '');
                  setRegPlate(customer.cadastralNo || '');
                  setNezamNo(customer.nezamNo || '');
                  setPhone(customer.phone || customer.landlinePhone || '');
                  setArea(customer.mapAreaM2 ? String(customer.mapAreaM2) : '');
                  setProjectAddress(customer.projectAddress || '');
                  setCustomerAddress(customer.address || '');
                  setSeriesCount(customer.sampleSeriesCount ? String(customer.sampleSeriesCount) : '');
                  setPricePerSeries(customer.pricePerSeries ? String(customer.pricePerSeries) : '');
                  setTotalAmountState(customer.totalContractAmount ? String(customer.totalContractAmount) : '');
                  setLabAddress(LAB_INFO.address || 'شهرکرد، بلوار آیت الله کاشانی، انتهای کوچه ۳۰');
                  setLabPhone(LAB_INFO.phoneRaw || '09131703177');
                }}
                className="text-[11px] text-blue-700 hover:text-blue-800 dark:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی به مقادیر اولیه پرونده</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نام کارفرما / نماینده کارفرما</label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">کد ملی</label>
                <input 
                  type="text" 
                  value={nationalId} 
                  onChange={(e) => setNationalId(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">شماره پلاک ثبتی</label>
                <input 
                  type="text" 
                  value={regPlate} 
                  onChange={(e) => setRegPlate(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">شماره ثبت نظام مهندسی</label>
                <input 
                  type="text" 
                  value={nezamNo} 
                  onChange={(e) => setNezamNo(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">شماره تماس کارفرما</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">متراژ دستور نقشه (متر مربع)</label>
                <input 
                  type="text" 
                  value={area} 
                  onChange={(e) => setArea(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">تعداد سری آزمایش (الف)</label>
                <input 
                  type="text" 
                  value={seriesCount} 
                  onChange={(e) => setSeriesCount(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">حق‌الزحمه هر سری (ریال)</label>
                <input 
                  type="text" 
                  value={pricePerSeries} 
                  onChange={(e) => setPricePerSeries(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">مبلغ کل قرارداد (ریال)</label>
                <input 
                  type="text" 
                  value={totalAmountState} 
                  onChange={(e) => setTotalAmountState(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono" 
                  placeholder="در صورت خالی بودن خودکار محاسبه می‌شود"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نشانی پروژه (ماده ۱)</label>
                <input 
                  type="text" 
                  value={projectAddress} 
                  onChange={(e) => setProjectAddress(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs" 
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نشانی کارفرما (ماده ۸)</label>
                <input 
                  type="text" 
                  value={customerAddress} 
                  onChange={(e) => setCustomerAddress(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs" 
                />
              </div>

              {/* Lab Address and Phone (Fixed and Editable) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  نشانی رسمی آزمایشگاه (ماده ۸) - اصلاح شده مطابق پروانه
                </label>
                <input 
                  type="text" 
                  value={labAddress} 
                  onChange={(e) => setLabAddress(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  تلفن تماس آزمایشگاه (ماده ۸)
                </label>
                <input 
                  type="text" 
                  value={labPhone} 
                  onChange={(e) => setLabPhone(e.target.value)} 
                  className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200" 
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONTRACT DOCUMENT WRAPPER (2 EXACT A4 PAGES WITH OUTER BORDER)            */}
        {/* ========================================================================= */}
        <div 
          id="contract-printable-doc"
          className="contract-page-wrapper space-y-8 print:space-y-0 text-black bg-slate-100/70 dark:bg-slate-950/40 p-2 sm:p-6 print:p-0 print:bg-white font-contract" 
          dir="rtl"
        >

          {/* ========================================================================= */}
          {/* PAGE 1: صفحه اول قرارداد                                                 */}
          {/* ========================================================================= */}
          <div 
            className={`contract-page contract-bordered-page bg-white text-black p-8 sm:p-11 mx-auto w-full max-w-[210mm] border-[2px] border-black rounded-none shadow-md print:shadow-none print:m-0 print:border-[2px] print:border-black min-h-[297mm] flex flex-col justify-between ${
              fontSize === 'compact' ? 'text-[12px] leading-[1.8]' : fontSize === 'large' ? 'text-[14px] leading-[2.1]' : 'text-[13px] leading-[1.95]'
            }`}
            style={{ 
              pageBreakAfter: 'always', 
              breakAfter: 'page',
              boxSizing: 'border-box' 
            }}
          >
            <div>
              {/* Header */}
              <div className="text-center mb-5 pt-1">
                <h1 className="text-base sm:text-lg font-bold mb-2.5 tracking-wide">به نام خدا</h1>
                <h2 className="text-sm sm:text-[15px] font-bold tracking-normal leading-relaxed">
                  قرارداد ارائه خدمات آزمایشگاهی، نمونه برداری، تعیین مقاومت فشاری و مشخصات بتن
                </h2>
              </div>

              {/* Preamble / Introduction */}
              <p className="mb-3.5 text-justify leading-relaxed">
                این قرارداد فی مابین آقای/ خانم/ شرکت{' '}
                <span className="font-bold inline-block px-1">
                  {currentEmployerName}
                </span>{' '}
                مالک/ وکیل ملک به پلاک ثبتی شماره{' '}
                <span className="font-bold inline-block px-1">
                  {renderBlankOrValue(regPlate, '.....................................')}
                </span>{' '}
                که منبعد در این قرارداد <strong>کارفرما</strong> نامیده می شود از یک طرف، و شرکت{' '}
                <strong>آزما بتن پایش خاک و پی جهان بین</strong> با شماره ثبت <strong>16445</strong> دارای پروانه اشتغال به کار خدمات فنی آزمایشگاهی به شماره <strong>182700018</strong> از اداره کل راه و شهر سازی استان چهارمحال و بختیاری که از این پس <strong>آزمایشگاه</strong> نامیده می شود از سوی دیگر، طبق مقررات و شرایطی که در این قرارداد درج شده است، منعقد می گردد و طرفین متعهد به اجرای کلیه مفاد آن می باشند.
              </p>

              {/* Article 1: موضوع قرارداد */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۱- موضوع قرارداد</h3>
                <p className="text-justify mb-2.5 leading-relaxed">
                  عبارت است از انجام و ثبت آزمایش های کنترل کیفیت بتن به صورت نمونه برداری از بتن تازه و تعیین مقاومت فشاری و تهیه گزارش مربوطه به پروژه با مشخصات زیر:
                </p>

                {/* Table: Exactly 2 columns + merged row 4 as scanned in original */}
                <table className="w-full border-collapse border border-black mb-3 text-xs sm:text-[12.5px] text-right">
                  <tbody>
                    {/* Row 1 */}
                    <tr>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">نام کارفرما/ نماینده کارفرما: </span>
                        <span>{renderBlankOrValue(companyName || repName, '................................................')}</span>
                      </td>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">کد ملی: </span>
                        <span className="font-mono">{renderBlankOrValue(nationalId, '................................................')}</span>
                      </td>
                    </tr>

                    {/* Row 2 */}
                    <tr>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">شماره پلاک ثبتی: </span>
                        <span>{renderBlankOrValue(regPlate, '................................................')}</span>
                      </td>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">شماره ثبت نظام مهندسی: </span>
                        <span className="font-mono">{renderBlankOrValue(nezamNo, '................................................')}</span>
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">شماره تماس: </span>
                        <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }} className="font-mono">
                          {isBlankTemplate || !phone || phone.trim() === '' ? '................................................' : toPersianDigits(phone)}
                        </span>
                      </td>
                      <td className="border border-black p-2.5 w-1/2 align-top">
                        <span className="font-bold">متراژ دستور نقشه: </span>
                        <span>
                          {isBlankTemplate || !area || area.trim() === '' 
                            ? '................... متر مربع' 
                            : `${toPersianDigits(area)} متر مربع`}
                        </span>
                      </td>
                    </tr>

                    {/* Row 4: Merged Full Width */}
                    <tr>
                      <td colSpan={2} className="border border-black p-2.5 align-top">
                        <span className="font-bold">نشانی پروژه: </span>
                        <span>{renderBlankOrValue(projectAddress, '....................................................................................................................................................')}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Article 2: شرح خدمات آزمایشگاه */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۲- شرح خدمات آزمایشگاه</h3>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۱-۲</strong> تواتر نمونه برداری از بتن تازه مطابق با مبحث نهم مقررات ملی ساختمان، آیین نامه بتن ایران و دستورالعمل ها و الزامات سازمان نظام مهندسی استان چهارمحال و بختیاری صورت می گیرد.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۲-۲</strong> نگهداری، عمل آوری و ارائه نتایج آزمون مقاومت های فشاری ۷ و ۲۸ روزه و نگهداری نمونه شاهد به مدت ۹۰ روز در محل آزمایشگاه.
                </p>
                <p className="mb-2 text-justify leading-relaxed">
                  <strong>۳-۲</strong> انجام عملیات و آزمایش های مخرب و غیر مخرب اعم از چکش اشمیت و مغزه گیری در پروژه (هزینه این قسمت جداگانه محاسبه می گردد.)
                </p>
              </div>

              {/* Article 3: مدت زمان قرارداد */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۳- مدت زمان قرارداد</h3>
                <p className="text-justify leading-relaxed">
                  ارائه خدمات موضوع قرارداد از تاریخ عقد و به مدت ۲۴ ماه می باشد. پس از پایان این مدت با توجه به پیشرفت فیزیکی پروژه مذکور، قرارداد به احتساب نرخ مصوب جدید و پرداخت مابه التفاوت توسط صاحبکار قابل تمدید خواهد بود.
                </p>
              </div>

              {/* Article 4: مبلغ و نحوه پرداخت قرارداد */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۴- مبلغ و نحوه پرداخت قرارداد</h3>
                <p className="mb-1 text-justify leading-relaxed">
                  <strong>۱-۴</strong> حق الزحمه ارائه خدمات آزمایشگاهی بر مبنای نرخ مصوب سازمان نظام مهندسی استان و با توجه به زیربنا و تعداد طبقات ساختمان و با احتساب ۱۰ درصد مالیات بر ارزش افزوده محاسبه و تعیین می گردد.
                </p>
                <p className="mb-1">
                  الف: تعداد مورد نیاز آزمایش{' '}
                  <span className="font-bold inline-block px-1">
                    {renderBlankOrValue(seriesCount, '...........')}
                  </span>{' '}
                  عدد (سری)
                </p>
                <p className="mb-1 text-justify leading-relaxed">
                  ب: مبلغ حق الزحمه به ازای هر سری آزمایش{' '}
                  <span className="font-bold inline-block px-1">
                    {renderBlankOrValue(formatNumberWithCommas(pricePerSeries), '.........................................')}
                  </span>{' '}
                  ریال و به مبلغ کل{' '}
                  <span className="font-bold inline-block px-1">
                    {calculateTotalRials()}
                  </span>{' '}
                  ریال که نقدا توسط کارفرما پرداخت می گردد.
                </p>
                <p className="text-justify text-[11px] sm:text-xs leading-relaxed">
                  <strong>تبصره ۱:</strong> در صورت اعمال اضافه بنا و تغییر دفعات بتن ریزی و افزایش تعداد سری نمونه گیری، حق الزحمه نمونه های مازاد بر اساس نرخ مصوب ملاک عمل خدمات فنی و آزمایشگاهی محاسبه می گردد و مالک موظف به پرداخت آن خواهد بود.
                </p>
              </div>
            </div>

            {/* Bottom Footer of Page 1 */}
            <div className="pt-3 border-t border-slate-200 mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <span>قرارداد رسمی ارائه خدمات آزمایشگاهی، نمونه‌برداری و تعیین مقاومت فشاری بتن</span>
              <span className="font-bold">صفحه ۱ از ۲</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PAGE 2: صفحه دوم قرارداد                                                 */}
          {/* ========================================================================= */}
          <div 
            className={`contract-page contract-bordered-page bg-white text-black p-8 sm:p-11 mx-auto w-full max-w-[210mm] border-[2px] border-black rounded-none shadow-md print:shadow-none print:m-0 print:border-[2px] print:border-black min-h-[297mm] flex flex-col justify-between ${
              fontSize === 'compact' ? 'text-[12px] leading-[1.8]' : fontSize === 'large' ? 'text-[14px] leading-[2.1]' : 'text-[13px] leading-[1.95]'
            }`}
            style={{ 
              pageBreakAfter: 'auto', 
              breakAfter: 'auto',
              boxSizing: 'border-box' 
            }}
          >
            <div>
              {/* Header for Page 2 */}
              <div className="text-center mb-3 pb-2 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-700">به نام خدا - ادامه قرارداد ارائه خدمات آزمایشگاهی بتن</p>
              </div>

              {/* Article 5: تعهدات شرکت (کامل و یکپارچه در صفحه دوم) */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۵- تعهدات شرکت</h3>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۱-۵</strong> حضور تکنسین با تجهیزات لازم در زمان بتن ریزی و انجام عملیات نمونه گیری.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۲-۵</strong> زمان و محل نمونه گیری توسط مهندس ناظر سازه و در صورت عدم حضور ایشان، توسط آزمایشگاه تعیین می گردد.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۳-۵</strong> نمونه گیری مطابق دستورالعمل های سازمان نظام مهندسی و استانداردهای معتبر، انجام آزمایش اسلامپ، حمل آزمونه ها به محل آزمایشگاه، نگهداری و عمل آوری نمونه ها در شرایط استاندارد، انجام آزمایش های مورد نیاز مطابق با استاندارد و ارائه گزارش نتایج آزمایش.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۴-۵</strong> نتایج آزمایش ها در دو نوبت در سن ۷ و ۲۸ روزه یا مطابق با دستور کتبی ناظر سازه تهیه و ارائه می گردد.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۵-۵</strong> حداقل یک نمونه شاهد تا ۹۰ روز در آزمایشگاه نگهداری می گردد و بنا به دستور کتبی مهندس ناظر مورد آزمایش قرار خواهد گرفت.
                </p>
                <p className="mb-2 text-justify leading-relaxed">
                  <strong>۶-۵</strong> در صورت اطلاع رسانی به موقع توسط کارفرما و عدم مراجعه آزمایشگاه، هزینه آزمایشات جایگزین اعم از مخرب و غیرمخرب به عهده آزمایشگاه می باشد.
                </p>
              </div>

              {/* Article 6: تعهدات کارفرما */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۶- تعهدات کارفرما</h3>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۱-۶</strong> کارفرما موظف است حداقل ۴۸ ساعت قبل از بتن ریزی و همچنین یک ساعت قبل از ورود اولین میکسر، مراتب را به آزمایشگاه اطلاع رسانی کند.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۲-۶</strong> کارفرما موظف است با هماهنگی ناظر و مجری پروژه، شرایط لازم جهت نمونه گیری صحیح و به موقع را فراهم کند.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۳-۶</strong> کارفرما متعهد می گردد نمونه های گرفته شده را حداکثر تا ۲۴ ساعت در شرایط مطلوب (جلوگیری از خشک شدن نمونه ها در هوای گرم، جلوگیری از سرما زدگی در هوای سرد، مراقبت از سلامت نمونه ها و جلوگیری از هر گونه آسیب و ضربه به آن ها، عدم جابجایی نمونه ها) نگهداری کند. در صورت بروز هرگونه آسیب به نمونه ها در این مدت عواقب بعدی بر عهده کارفرما خواهد بود.
                </p>
                <p className="mb-1.5 text-justify leading-relaxed">
                  <strong>۴-۶</strong> در صورت عدم اطلاع رسانی به موقع توسط کارفرما جهت انجام عملیات نمونه گیری، هزینه آزمایشات جایگزین اعم از چکش اشمیت یا مغزه گیری بر عهده کارفرما می باشد.
                </p>
                <p className="mb-2 text-justify leading-relaxed">
                  <strong>۵-۶</strong> تامین حداقل یک نفر کارگر به همراه وسایل مورد نیاز (یک عدد فرغون و بیل) برای انجام عملیات نمونه گیری توسط نیروهای آزمایشگاه، از سوی کارفرما الزامی است.
                </p>
              </div>

              {/* Article 7: حل اختلاف */}
              <div className="mb-3.5">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۷- حل اختلاف</h3>
                <p className="text-justify leading-relaxed">
                  کلیه اختلافاتی که ممکن است در اثر تعبیر و تفسیر مفاد این قرارداد یا در اجرای کار بین طرفین بروز نماید، که نتوان آن را از طریق مذاکرات یا مکاتبات به طور دوستانه و حداکثر ظرف مدت یک ماه حل و فصل نمود، موضوع از طریق ارجاع به هیئات حل اختلاف سازمان نظام مهندسی استان پیگیری خواهد شد و نظر این هیئات برای هر دو طرف حاکم می باشد.
                </p>
              </div>

              {/* Article 8: نشانی و تعداد نسخه های قرارداد - FIXED WITH REAL LAB ADDRESS & PHONE */}
              <div className="mb-4">
                <h3 className="font-bold text-sm sm:text-[14px] mb-1.5">ماده ۸- نشانی و تعداد نسخه های قرارداد</h3>
                <p className="mb-2 text-justify leading-relaxed">
                  <span>نشانی کارفرما: </span>
                  <span className="inline-block px-1">
                    {renderBlankOrValue(customerAddress, '....................................................................................................')}
                  </span>{' '}
                  <span className="mr-3">تلفن: </span>
                  <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }} className="font-mono px-1">
                    {isBlankTemplate || !phone || phone.trim() === '' ? '........................................' : toPersianDigits(phone)}
                  </span>
                </p>
                <p className="mb-2 text-justify leading-relaxed">
                  <span>نشانی آزمایشگاه: </span>
                  <strong className="px-1">{labAddress}</strong>{' '}
                  <span className="mr-3">تلفن: </span>
                  <strong className="font-mono px-1 inline-block" dir="ltr" style={{ unicodeBidi: 'isolate' }}>{toPersianDigits(labPhone)}</strong>
                </p>
                
                <p className="text-justify font-bold mt-2.5 leading-relaxed">
                  این قرارداد در دو صفحه و دو نسخه مشتمل بر ۸ ماده و با اعتبار یکسان تنظیم شده و به امضای دو طرف رسیده است.
                </p>
              </div>
            </div>

            {/* Official Signatures Section - Clean, Matching Scanned Document */}
            <div className="pt-6 pb-2">
              <div className="flex justify-between items-start text-center font-bold px-4 sm:px-10">
                {/* Employer Signature Block */}
                <div className="flex flex-col items-center w-5/12">
                  <p className="text-xs sm:text-[13px] font-bold">نام و نام خانوادگی کارفرما/ نماینده کارفرما</p>
                  {!isBlankTemplate && (companyName || repName) && (
                    <p className="text-xs text-gray-700 mt-1 font-normal">
                      {companyName || repName}
                    </p>
                  )}
                  <div className="h-20 sm:h-24 w-full flex items-center justify-center text-[10px] text-gray-400">
                    (محل امضا و اثر انگشت)
                  </div>
                </div>

                {/* Laboratory Signature Block */}
                <div className="flex flex-col items-center w-5/12">
                  <p className="text-xs sm:text-[13px] font-bold">نام و نام خانوادگی نماینده آزمایشگاه</p>
                  <p className="text-xs text-gray-700 mt-1 font-normal">شرکت آزما بتن پایش خاک و پی جهان بین</p>
                  <div className="h-20 sm:h-24 w-full flex items-center justify-center text-[10px] text-gray-400">
                    (محل امضا و مهر رسمی شرکت)
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer of Page 2 */}
            <div className="pt-2 border-t border-slate-200 mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>قرارداد رسمی ارائه خدمات آزمایشگاهی، نمونه‌برداری و تعیین مقاومت فشاری بتن</span>
              <span className="font-bold">صفحه ۲ از ۲</span>
            </div>
          </div>

        </div>

      </div>

      {/* Global CSS for Strict Print Layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          html, body {
            background-color: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .contract-page-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .contract-bordered-page {
            border: 2px solid #000 !important;
            margin: 0 auto !important;
            padding: 8mm 10mm !important;
            min-height: 275mm !important;
            max-height: 280mm !important;
            box-sizing: border-box !important;
          }
          .contract-page:first-of-type {
            page-break-after: always !important;
            break-after: page !important;
          }
          .contract-page:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}} />

    </div>
  );
};
