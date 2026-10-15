import React, { useState } from 'react';
import { printOnlyElement } from '../../utils/printDom';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  BookOpen, 
  FileCheck,
  Scale,
  Sparkles,
  Table
} from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';
import { CompanyLogo } from './CompanyLogo';
import { LAB_INFO } from '../../services/supabase';
import { PrintStandardSheetModal } from './PrintStandardSheetModal';

interface LabFormItem {
  id: string;
  code: string;
  title: string;
  standard: string;
  category: 'نمونه‌گیری بتن تازه' | 'عمل‌آوری و کیورینگ' | 'محاسبات و استاندارد' | 'قرارداد و اعزام';
  pages: number;
  format: 'PDF / Word' | 'جدول استاندارد' | 'چک‌لیست رسمی';
  description: string;
  contentTemplate: {
    heading: string;
    subheading: string;
    fields: Array<{ label: string; placeholder: string; isWide?: boolean }>;
    tables?: Array<{ headers: string[]; rows: string[][] }>;
    notes: string[];
  };
}

const LAB_FORMS: LabFormItem[] = [
  {
    id: 'form-01',
    code: 'FORM-CTL-3201',
    title: 'فرم رسمی صورتجلسه نمونه‌برداری از بتن تازه در محل پروژه',
    standard: 'استاندارد ملی ایران شماره ۳۲۰۱ و ASTM C172',
    category: 'نمونه‌گیری بتن تازه',
    pages: 1,
    format: 'چک‌لیست رسمی',
    description: 'شامل ثبت شماره تراک‌میکسر، اسلامپ اولیه، دمای محیط و بتن، ساعت تخلیه، افزودنی‌های بتن و محل دقیق بتن‌ریزی سازه.',
    contentTemplate: {
      heading: 'صورتجلسه رسمی نمونه‌گیری و کنترل اسلامپ بتن تازه در کارگاه',
      subheading: 'بر اساس الزامات مبحث نهم مقررات ملی ساختمان و استانداردهای ISIRI 3201 & ASTM C172',
      fields: [
        { label: 'نام پروژه / کارگاه:', placeholder: 'مجتمع تجاری-اداری نگین / کارفرما: شرکت مهندسی سازه پایدار' },
        { label: 'محل دقیق بتن‌ریزی:', placeholder: 'سقف طبقه ۴، تیرها و دال محورهای C تا F' },
        { label: 'رده مقاومتی بتن (طرح اختلاط):', placeholder: 'C30 با اسلامپ هدف ۸۰±۲۰ میلیمتر' },
        { label: 'شماره پلاک / بچینگ تراک‌میکسر:', placeholder: 'کامیون شماره ۴ - بچ‌نامبر T-409' },
        { label: 'دمای بتن تازه (°C):', placeholder: '۲۱.۵ درجه سانتی‌گراد (مجاز: ۵ الی ۳۲ درجه)' },
        { label: 'دمای هوای محیط کارگاه (°C):', placeholder: '۲۴ درجه سانتی‌گراد' },
        { label: 'اسلامپ اندازه‌گیری شده (mm):', placeholder: '۸۵ میلیمتر (منطبق با روانی مجاز)' },
        { label: 'تعداد قالب‌های اخذ شده:', placeholder: '۶ قالب مکعبی ۱۵×۱۵ استاندارد' },
        { label: 'نام تکنسین نمونه‌بردار آزمایشگاه:', placeholder: 'مهندس سهراب مرادی' },
        { label: 'نام ناظر مقیم / سرپرست کارگاه:', placeholder: 'مهندس ناظر سازه نظام مهندسی' }
      ],
      notes: [
        'نمونه‌برداری باید از بخش میانی بار بتن پس از خروج حداقل ۰.۲ مترمکعب اول انجام شود.',
        'قالب‌ها باید پس از ۲۴ ساعت باز شده و بلافاصله به حوضچه آب آهک اشباع ۲۳ درجه منتقل شوند.',
        'هرگونه افزودن آب در محل تخلیه اکیداً ممنوع بوده و موجب ابطال تاییدیه بتن‌ریزی می‌گردد.'
      ]
    }
  },
  {
    id: 'form-02',
    code: 'FORM-CTL-511',
    title: 'چک‌لیست روزانه پایش شرایط حوضچه عمل‌آوری و کیورینگ نمونه‌ها',
    standard: 'استاندارد ASTM C511 و استاندارد ملی ایران شماره ۳۲۰۲',
    category: 'عمل‌آوری و کیورینگ',
    pages: 1,
    format: 'چک‌لیست رسمی',
    description: 'کنترل دمای آب حوضچه در محدوده ۲۳.۰±۲.۰ درجه سانتی‌گراد، سنجش pH و اشباع آب‌آهک جهت جلوگیری از شسته شدن هیدروکسید کلسیم.',
    contentTemplate: {
      heading: 'گزارش روزانه بازرسی حوضچه‌های عمل‌آوری و اتاق رطوبت آزمایشگاه',
      subheading: 'بر اساس استانداردهای بین‌المللی ASTM C511 و سیستم مدیریت کیفیت ISO/IEC 17025',
      fields: [
        { label: 'شماره مخزن / حوضچه آب:', placeholder: 'حوضچه ترموستاتیک شماره ۲ (گنجایش ۱۰۰۰ قالب)' },
        { label: 'دمای ثبت شده توسط سنسور دیجیتال:', placeholder: '۲۳.۱ درجه سانتی‌گراد (محدوده مجاز ۲۱ تا ۲۵)' },
        { label: 'دمای دماسنج کالیبره شاهد:', placeholder: '۲۳.۰ درجه سانتی‌گراد' },
        { label: 'غلظت آب آهک (اشباع):', placeholder: '۳ گرم هیدروکسید کلسیم در هر لیتر آب (کاملاً اشباع)' },
        { label: 'رطوبت نسبی اتاق نمونه‌ها (%):', placeholder: '۹۸ درصد (حداقل مجاز ۹۵٪)' },
        { label: 'مسئول کنترل کیفیت و ثبت داده:', placeholder: 'مهندس مریم کیانی' }
      ],
      notes: [
        'آب حوضچه باید همواره در گردش ملایم باشد تا گرادیان حرارتی در مخزن ایجاد نشود.',
        'تعویض کامل آب مخازن با آب آهک تازه باید به صورت دوره‌ای هر ۲ ماه یک‌بار انجام پذیرد.'
      ]
    }
  },
  {
    id: 'form-03',
    code: 'FORM-CTL-CONV',
    title: 'جدول رسمی ضریب تبدیل مقاومت مکعبی ۱۵×۱۵ به استوانه‌ای استاندارد',
    standard: 'آیین‌نامه بتن ایران (آبا) و استاندارد BS EN 12390',
    category: 'محاسبات و استاندارد',
    pages: 1,
    format: 'جدول استاندارد',
    description: 'جدول مقایسه‌ای دقیق جهت تطبیق رده‌های بتن مکعبی متداول در ایران با استوانه‌های طراحی مبحث نهم و ACI 318.',
    contentTemplate: {
      heading: 'جدول ضرایب تبدیل مقاومت فشاری نمونه مکعبی به استوانه استاندارد ۳۰۰×۱۵۰ میلیمتر',
      subheading: 'برگرفته از ضوابط آیین‌نامه بتن ایران (آبا) و مبحث نهم مقررات ملی ساختمان',
      fields: [],
      tables: [
        {
          headers: ['رده بتن استوانه‌ای (f\'c)', 'مقاومت مشخصه استوانه (MPa)', 'مقاومت مشخصه مکعبی (f_ck,cube)', 'ضریب تبدیل (استوانه / مکعب)', 'کاربرد متداول سازه‌ای'],
          rows: [
            ['C16/20', '۱۶', '۲۰', '۰.۸۰', 'بتن مگر و کف‌سازی غیرسازه‌ای'],
            ['C20/25', '۲۰', '۲۵', '۰.۸۰', 'فونداسیون سازه‌های مسکونی سبک'],
            ['C25/30', '۲۵', '۳۰', '۰.۸۳', 'تیر، دال و سقف سازه‌های بتن‌آرمه'],
            ['C30/37', '۳۰', '۳۷', '۰.۸۱', 'ستون‌ها و دیوارهای برشی برج‌ها'],
            ['C35/45', '۳۵', '۴۵', '۰.۷۸', 'سازه پل‌ها و بتن پیش‌تنیده'],
            ['C40/50', '۴۰', '۵۰', '۰.۸۰', 'سازه ابنیه سنگین و فونداسیون‌های حجیم']
          ]
        }
      ],
      notes: [
        'در پروژه‌های عمرانی ایران، معیار پذیرش بر اساس مقاومت نمونه مکعبی ۱۵ سانتیمتری ۲۸ روزه است.',
        'مقاومت بتن در ۷ روزگی به طور میانگین بین ۶۵٪ تا ۷۵٪ مقاومت ۲۸ روزه فرض می‌گردد.'
      ]
    }
  },
  {
    id: 'form-04',
    code: 'FORM-CTL-DISP',
    title: 'فرم کتبی درخواست اعزام تکنسین آزمایشگاه مقیم به کارگاه ساختمانی',
    standard: 'دستورالعمل کنترل و تضمین کیفیت وزارت راه و شهرسازی',
    category: 'قرارداد و اعزام',
    pages: 1,
    format: 'PDF / Word',
    description: 'فرم رسمی ثبت سفارش حضور نمونه‌بردار در پروژه‌ها، هماهنگی زمان بتن‌ریزی شبانه و تامین قالب‌های استاندارد.',
    contentTemplate: {
      heading: 'برگه تقاضای رسمی اعزام اکیپ نمونه‌بردار و تجهیزات آزمایشگاهی به پروژه',
      subheading: 'ارسال حداقل ۲۴ ساعت پیش از شروع عملیات بتن‌ریزی کارگاهی',
      fields: [
        { label: 'شرکت متقاضی / کارفرما:', placeholder: 'شرکت مهندسی عمران سازه پایدار تهران' },
        { label: 'نام پروژه و آدرس کارگاه:', placeholder: 'تهران، نیاوران، خیابان یاسر، بن‌بست ارغوان، پلاک ۱۲' },
        { label: 'نام مهندس کارگاه / رابط:', placeholder: 'مهندس علیرضا رضوانی - شماره تماس ۰۹۱۲۱۱۱۱۱۱۱' },
        { label: 'تاریخ و ساعت دقیق شروع بتن‌ریزی:', placeholder: '۱۴۰۳/۰۸/۰۲ - ساعت ۱۴:۳۰' },
        { label: 'حجم تخمینی بتن‌ریزی (مترمکعب):', placeholder: '۲۸۰ مترمکعب بتن آماده' },
        { label: 'کارخانه تامین‌کننده بتن آماده:', placeholder: 'شرکت بتن آماده پاسارگاد' },
        { label: 'خدمات درخواستی:', placeholder: 'نمونه‌گیری ۶ سری، آزمایش اسلامپ هر تراک، ثبت دما و هوای بتن' }
      ],
      notes: [
        'تامین محل سایبان موقت و حوضچه اولیه در کارگاه بر عهده کارفرما می‌باشد.',
        'تکنسین اعزامی مجهز به قالب‌های استاندارد و دستگاه اسلامپ سنجش کالیبره می‌باشد.'
      ]
    }
  },
  {
    id: 'form-05',
    code: 'FORM-CTL-BS1881',
    title: 'شیت استاندارد نتایج آزمایش تعیین مقاومت فشاری بتن (۲۱ ستونه با هوش مصنوعی)',
    standard: 'B.S. 1881 / ASTM C39 / مبحث نهم مقررات ملی ساختمان',
    category: 'محاسبات و استاندارد',
    pages: 1,
    format: 'جدول استاندارد',
    description: 'شیت رسمی کامل آزمایشگاهی منطبق با فرمت استاندارد مهندسی B.S.1881؛ شامل محاسبه خودکار حجم، وزن مخصوص، مقاومت مکعبی، ضریب تبدیل استوانه و میانگین سری با موتور هوش مصنوعی.',
    contentTemplate: {
      heading: 'آزمایش تعیین مقاومت فشاری بتن (Concrete Compressive Strength Test B.S.1881)',
      subheading: 'محاسبه آنی مقاومت نظیر استوانه‌ای طبق بند ۹-۱۵-۳ مبحث نهم و ارزیابی هوشمند انطباق',
      fields: [
        { label: 'پروژه:', placeholder: 'ساختمان اداره آب و فاضلاب بروجن' },
        { label: 'کارفرما / مجری:', placeholder: 'اداره آب و فاضلاب' },
        { label: 'شماره سریال و آزمون:', placeholder: 'سریال: ۱۱۵۰ - ۲۸ | شماره آزمون: ۱۰۷۹' },
        { label: 'محل تامین مصالح:', placeholder: 'بتن آماده قصرالدشت' },
        { label: 'عضو سازه‌ای:', placeholder: 'ستون‌های روی سقف اول' },
        { label: 'دمای محیط و بتن:', placeholder: 'محیط: ۳۳°C | بتن: ۲۹°C' }
      ],
      notes: [
        'مقاومت فشاری نمونه مکعبی طبق بند ۹-۱۵-۳ مبحث نهم به مقاومت نظیر استوانه‌ای استاندارد تبدیل شده است.',
        'محاسبات میانگین، وزن مخصوص و ارزیابی مقاومت مشخصه توسط هوش مصنوعی آزمایشگاه کنترل می‌گردد.'
      ]
    }
  }
];

export const LabFormsDirectory: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activePreviewForm, setActivePreviewForm] = useState<LabFormItem | null>(null);
  const [showExcelSheetModal, setShowExcelSheetModal] = useState(false);

  const categories = [
    { id: 'all', label: 'همه فرم‌ها و مدارک' },
    { id: 'نمونه‌گیری بتن تازه', label: 'نمونه‌گیری بتن تازه' },
    { id: 'عمل‌آوری و کیورینگ', label: 'عمل‌آوری و کیورینگ' },
    { id: 'محاسبات و استاندارد', label: 'جداول استاندارد و تبدیل' },
    { id: 'قرارداد و اعزام', label: 'اعزام و پذیرش' }
  ];

  const filteredForms = selectedCategory === 'all' 
    ? LAB_FORMS 
    : LAB_FORMS.filter(f => f.category === selectedCategory);

  const handlePrint = () => {
    // Print only the form-preview modal (toolbar is no-print)
    if (!printOnlyElement('lab-form-print-doc')) window.print();
  };

  return (
    <div className="space-y-6 text-start">
      
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredForms.map(form => (
          <div
            key={form.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 shadow-sm transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black font-mono">
                    {form.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                    {form.format}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {toPersianDigits(form.pages)} صفحه
                </span>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-1">
                {form.title}
              </h3>

              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-2">
                مرجع: {form.standard}
              </p>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                {form.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (form.id === 'form-05') {
                    setShowExcelSheetModal(true);
                  } else {
                    setActivePreviewForm(form);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
              >
                {form.id === 'form-05' ? <Table className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-blue-500" />}
                <span>{form.id === 'form-05' ? 'باز کردن شیت استاندارد نتایج' : 'مشاهده پیش‌نمایش'}</span>
              </button>

              <button
                onClick={() => {
                  if (form.id === 'form-05') {
                    setShowExcelSheetModal(true);
                  } else {
                    setActivePreviewForm(form);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs transition ${
                  form.id === 'form-05' 
                    ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black' 
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {form.id === 'form-05' ? <Sparkles className="w-3.5 h-3.5 text-slate-950" /> : <Download className="w-3.5 h-3.5" />}
                <span>{form.id === 'form-05' ? 'محاسبه AI و چاپ' : 'دانلود و چاپ (A4)'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Preview & Printable Modal */}
      {activePreviewForm && (
        <div id="lab-form-print-doc" className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          
          {/* Top Floating Control Bar */}
          <div className="fixed top-4 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-slate-900/95 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700 no-print">
            <button
              onClick={() => setActivePreviewForm(null)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 font-bold text-xs shadow-md transition text-white active:scale-95"
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              <span>بازگشت به فهرست فرم‌ها</span>
            </button>

            <div className="h-4 w-px bg-slate-700" />

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-md transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ فرم خام (A4)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow-md transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ذخیره PDF</span>
            </button>
          </div>

          {/* Fixed Top-Start Back Button */}
          <button
            onClick={() => setActivePreviewForm(null)}
            className="fixed top-4 start-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 text-white hover:bg-slate-800 border border-slate-700 shadow-xl font-bold text-xs backdrop-blur-md transition no-print"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-400" />
            <span>بازگشت (ESC)</span>
          </button>

          {/* A4 Paper Document */}
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-300 print-card my-14 print:my-0 print:border-none print:shadow-none p-6 sm:p-10 font-sans">
            <div className="border-2 border-slate-800 p-6 rounded-lg relative">
              
              {/* Form Official Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <CompanyLogo className="w-12 h-12 rounded-lg" iconClassName="w-8 h-8 text-white" />
                  <div>
                    <h2 className="font-black text-slate-900 text-base sm:text-lg">
                      {LAB_INFO.name}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      شماره ثبت: {toPersianDigits(LAB_INFO.registrationNo)} • پروانه اشتغال فنی آزمایشگاهی: {toPersianDigits(LAB_INFO.licenseNo)} ({LAB_INFO.licenseIssuer})
                    </p>
                  </div>
                </div>

                <div className="text-end font-mono text-xs">
                  <div className="font-black text-blue-900">{activePreviewForm.code}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">ویرایش پاییز ۱۴۰۳</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h1 className="text-sm sm:text-base font-black text-slate-900">
                  {activePreviewForm.contentTemplate.heading}
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  {activePreviewForm.contentTemplate.subheading}
                </p>
              </div>

              {/* Form Fields Table/Grid */}
              {activePreviewForm.contentTemplate.fields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {activePreviewForm.contentTemplate.fields.map((field, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs">
                      <span className="text-slate-600 block mb-1 font-bold">{field.label}</span>
                      <span className="text-slate-800 font-mono">{field.placeholder}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Table (if applicable) */}
              {activePreviewForm.contentTemplate.tables && activePreviewForm.contentTemplate.tables.map((table, tIdx) => (
                <div key={tIdx} className="overflow-x-auto mb-6">
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                      <tr>
                        {table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="p-2 text-center border-e border-slate-300 last:border-e-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 text-center border-e border-slate-200 last:border-e-0 font-mono">
                              {toPersianDigits(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Technical Notes */}
              {activePreviewForm.contentTemplate.notes.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 mb-6">
                  <span className="font-bold block mb-1">نکات فنی و آیین‌نامه‌ای الزامی:</span>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {activePreviewForm.contentTemplate.notes.map((note, nIdx) => (
                      <li key={nIdx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Signatures Area */}
              <div className="border-t-2 border-slate-800 pt-4 grid grid-cols-3 text-center text-xs">
                <div>
                  <span className="text-slate-500 block">مهندس کارگاه / سرپرست:</span>
                  <div className="h-12 border-b border-slate-300 mx-4 mt-2" />
                  <span className="text-[10px] text-slate-400 mt-1 block">امضا و تاریخ</span>
                </div>
                <div>
                  <span className="text-slate-500 block">ناظر مقیم سازه نظام مهندسی:</span>
                  <div className="h-12 border-b border-slate-300 mx-4 mt-2" />
                  <span className="text-[10px] text-slate-400 mt-1 block">مهر و امضا</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تکنسین آزمایشگاه کنترل کیفیت:</span>
                  <div className="h-12 border-b border-slate-300 mx-4 mt-2" />
                  <span className="text-[10px] text-slate-400 mt-1 block">مهر و امضای تایید</span>
                </div>
              </div>

              {/* Lab Contact Footer on Form */}
              <div className="border-t border-slate-300 pt-3 mt-4 text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>نشانی آزمایشگاه:</strong> {LAB_INFO.address}
                </div>
                <div>
                  <strong>تلفن تماس:</strong> <span className="font-mono font-bold text-slate-900" dir="ltr">{toPersianDigits(LAB_INFO.phone)}</span>
                </div>
              </div>

            </div>

            {/* Bottom Return Bar */}
            <div className="no-print mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setActivePreviewForm(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
              >
                <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-rose-600" />
                <span>بازگشت به فهرست فرم‌ها</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ برگه A4</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Standard 21-Column B.S. 1881 Excel Sheet Modal with AI calculation */}
      {showExcelSheetModal && (
        <PrintStandardSheetModal
          onClose={() => setShowExcelSheetModal(false)}
        />
      )}

    </div>
  );
};
