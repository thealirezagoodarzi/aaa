import React, { useState, useRef } from 'react';
import { Customer, TestReport } from '../../types';
import { labDb } from '../../services/supabase';
import { 
  getTodayJalali, 
  formatJalali, 
  parseJalali, 
  addDaysToJalali, 
  toPersianDigits,
  jalaliToGregorian
} from '../../utils/jalali';
import { LAB_IMAGES } from '../../assets/images';
import { optimizeAndReadImageFile } from '../../utils/fileUpload';
import { 
  FlaskConical, 
  CheckCircle2, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Clock, 
  Truck, 
  Layers, 
  Activity,
  Info,
  Camera,
  CalendarCheck,
  Upload,
  Image as ImageIcon,
  Trash2,
  Lock,
  Building2
} from 'lucide-react';

interface OperatorNewTestProps {
  customers: Customer[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onCustomerRegistered?: () => void;
}

export const OperatorNewTest: React.FC<OperatorNewTestProps> = ({ 
  customers, 
  onSubmit, 
  onCancel
}) => {
  const todayJalali = formatJalali(getTodayJalali());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0] || null;

  const [projectName, setProjectName] = useState(selectedCustomer?.projectNames?.[0] || 'پروژه جاری');
  const [sampleLocation, setSampleLocation] = useState('سقف و دال بتنی');
  const [concreteGrade, setConcreteGrade] = useState('C30');
  const [temperatureC, setTemperatureC] = useState<number>(23);
  const [moldType, setMoldType] = useState<'cube_150' | 'cylinder_150_300'>('cube_150');
  const [slumpMm, setSlumpMm] = useState<number>(85);
  const [wcRatio, setWcRatio] = useState<number>(0.45);
  const [cementType, setCementType] = useState('سیمان پرتلند تیپ ۲');
  const [truckBatchNo, setTruckBatchNo] = useState('TRK-104');
  const [curingMethod, setCuringMethod] = useState('حوضچه آب‌آهک استاندارد ۲۳ درجه (ASTM C511)');
  const [samplingDateJalali, setSamplingDateJalali] = useState(todayJalali);
  const [samplingTime, setSamplingTime] = useState('۱۰:۳۰');
  const [selectedPhoto, setSelectedPhoto] = useState<string>(LAB_IMAGES.cubesBench);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReportNo, setCreatedReportNo] = useState<string | null>(null);

  // Calculate projected 7-day and 28-day break dates
  const parsedDate = parseJalali(samplingDateJalali) || getTodayJalali();
  const date7d = formatJalali(addDaysToJalali(parsedDate, 7));
  const date28d = formatJalali(addDaysToJalali(parsedDate, 28));

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setCustomerId(cid);
    const cust = customers.find(c => c.id === cid);
    if (cust && cust.projectNames.length > 0) {
      setProjectName(cust.projectNames[0]);
    }
  };

  const gradeTargetMap: Record<string, number> = {
    'C15': 15,
    'C20': 20,
    'C25': 25,
    'C30': 30,
    'C35': 35,
    'C40': 40,
    'C45': 45,
    'C50': 50,
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('لطفاً یک فایل تصویری معتبر انتخاب فرمایید.');
      setTimeout(() => setUploadError(null), 4000);
      return;
    }

    try {
      const result = await optimizeAndReadImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      setUploadedPhotoUrl(result);
      setSelectedPhoto(result);
      setUploadError(null);
    } catch (err: any) {
      setUploadError(err?.message || 'خطا در بارگذاری تصویر.');
      setTimeout(() => setUploadError(null), 4000);
    }
  };

  const handleRemoveUploadedPhoto = () => {
    setUploadedPhotoUrl(null);
    setSelectedPhoto(LAB_IMAGES.cubesBench);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const currentUser = labDb.getCurrentUser();
    const cust = customers.find(c => c.id === customerId) || customers[0];
    const targetMpa = gradeTargetMap[concreteGrade] || 30;
    const reportNo = `CTL-1403-${Math.floor(1000 + Math.random() * 9000)}`;

    const effectivePhoto = uploadedPhotoUrl || selectedPhoto;

    const newReport: any = {
      reportNo,
      customerId: cust?.id || 'cust-01',
      customerName: cust?.companyName || 'مشتری آزمایشگاه',
      projectName: projectName || 'پروژه جاری',
      sampleLocation: sampleLocation || 'سقف طبقه سازه',
      concreteGrade,
      targetStrengthMpa: targetMpa,
      moldType,
      slumpMm: Number(slumpMm) || 80,
      temperatureC: Number(temperatureC) || 24,
      waterCementRatio: Number(wcRatio) || 0.45,
      cementType,
      samplingDateJalali,
      // FIX (date consistency): derive the Gregorian date from the selected
      // Jalali sampling date instead of hard-coding "today".
      samplingDateGregorian: (() => {
        const g = jalaliToGregorian(parsedDate.jy, parsedDate.jm, parsedDate.jd);
        return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
      })(),
      samplingTime,
      truckBatchNo: truckBatchNo || 'TRK-01',
      curingMethod,
      isPassed: false,
      status: 'pending',
      operatorId: currentUser?.id || 'usr-operator-01',
      operatorName: currentUser?.fullName || 'اپراتور آزمایشگاه',
      photos: [effectivePhoto],
      coordinates: { lat: 35.6892, lng: 51.3890, address: 'تهران، کارگاه ساختمانی پروژه' }
    };

    const saved = labDb.addReport(newReport);
    setCreatedReportNo(saved.reportNo);

    // Trigger SMS to Customer upon sampling & entry
    const selectedCust = customers.find(c => c.id === customerId);
    if (selectedCust) {
      labDb.sendSms({
        recipientPhone: selectedCust.phone,
        recipientName: selectedCust.representativeName,
        customerId: selectedCust.id,
        customerName: selectedCust.companyName,
        projectName: projectName,
        reportId: saved.id,
        reportNo: saved.reportNo,
        event: 'sample_received',
        customMessage: `نمونه‌برداری جدید پروژه «${projectName}» با شماره پذیرش ${saved.reportNo} در آزمایشگاه ثبت و به حوضچه کیورینگ منتقل گردید. موعد شکست ۷ روزه: ${date7d} | آزما بتن پایش خاک و پی جهان بین`
      });
    }

    setTimeout(() => {
      setIsSubmitting(false);
      onSubmit(saved);
    }, 600);
  };

  if (createdReportNo) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 max-w-xl mx-auto text-center space-y-5 animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
          نمونه با موفقیت در آزمایشگاه ثبت شد
        </h3>
        <p className="text-sm text-slate-500">
          کد رهگیری نمونه: <span className="font-mono font-bold text-blue-600">{createdReportNo}</span>
        </p>
        
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2 text-right">
          <div className="flex justify-between">
            <span>موعد آزمون مقاومت فشاری ۷ روزه:</span>
            <span className="font-mono font-bold text-blue-600">{toPersianDigits(date7d)}</span>
          </div>
          <div className="flex justify-between">
            <span>موعد آزمون مقاومت مشخصه ۲۸ روزه:</span>
            <span className="font-mono font-bold text-emerald-600">{toPersianDigits(date28d)}</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
            نمونه به حوضچه کیورینگ استاندارد ۲۳ درجه منتقل و پیامک اطلاع‌رسانی به کارفرما ارسال گردید.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition"
        >
          مشاهده در لیست آزمایش‌ها
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-3xl mx-auto shadow-xs">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">پذیرش و ثبت نمونه بتن تازه</h2>
            <p className="text-xs text-slate-500 mt-0.5">ثبت شناسنامه اولیه نمونه بتن و ورود به حوضچه عمل‌آوری</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition"
        >
          بازگشت
        </button>
      </div>

      {/* Admin Policy Notice */}
      <div className="mb-5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
        <Lock className="w-4 h-4 text-blue-600 shrink-0" />
        <span>لیست کارفرمایان و پروژه‌ها صرفاً بر اساس قراردادهای رسمی منعقد شده توسط مدیریت آزمایشگاه بارگذاری شده است.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>مشتری / کارفرمای دارای قرارداد رسمی *</span>
              <span className="text-[10px] text-slate-400 font-normal">کد اشتراک معتبر</span>
            </label>
            <select
              value={customerId}
              onChange={handleCustomerChange}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName} ({c.representativeName})</option>
              ))}
            </select>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نام پروژه و کارگاه تحت قرارداد *
            </label>
            {selectedCustomer?.projectNames && selectedCustomer.projectNames.length > 0 ? (
              <select
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                {selectedCustomer.projectNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="مثلاً: مجتمع مسکونی مهرگان"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Location */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              محل دقیق نمونه‌گیری / عضو سازه‌ای (طبق مبحث نهم مقررات ملی) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={sampleLocation}
                onChange={(e) => setSampleLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="فونداسیون - پارت بتن‌ریزی شماره ۱">فونداسیون - پارت ۱</option>
                <option value="ستون‌ها و دیوارهای برشی طبقه همکف">ستون‌ها و دیوارهای برشی طبقه همکف</option>
                <option value="سقف و دال بتنی طبقه اول">سقف و دال بتنی طبقه اول</option>
                <option value="سقف و دال بتنی طبقه دوم">سقف و دال بتنی طبقه دوم</option>
                <option value="سقف و دال بتنی طبقه سوم">سقف و دال بتنی طبقه سوم</option>
                <option value="دیوار حائل و پیرامونی منفی یک">دیوار حائل و پیرامونی منفی یک</option>
                <option value="سایر">سایر موارد (شخصی‌سازی)...</option>
              </select>

              {sampleLocation === 'سایر' ? (
                <input
                  type="text"
                  required
                  placeholder="مثلاً: سقف طبقه ۵ - تیرها و دال محور C تا F"
                  onChange={(e) => setSampleLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="text"
                  value={sampleLocation}
                  onChange={(e) => setSampleLocation(e.target.value)}
                  placeholder="جزئیات موقعیت..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>

          {/* Concrete Grade */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              رده بتن مشخصه (Concrete Grade) *
            </label>
            <select
              value={concreteGrade}
              onChange={(e) => setConcreteGrade(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value="C20">C20 (مقاومت مشخصه ۲۰ MPa)</option>
              <option value="C25">C25 (مقاومت مشخصه ۲۵ MPa)</option>
              <option value="C30">C30 (مقاومت مشخصه ۳۰ MPa)</option>
              <option value="C35">C35 (مقاومت مشخصه ۳۵ MPa)</option>
              <option value="C40">C40 (مقاومت مشخصه ۴۰ MPa)</option>
              <option value="C45">C45 (مقاومت مشخصه ۴۵ MPa)</option>
              <option value="C50">C50 (مقاومت مشخصه ۵۰ MPa)</option>
            </select>
          </div>

          {/* Mold Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نوع قالب نمونه‌گیری *
            </label>
            <select
              value={moldType}
              onChange={(e) => setMoldType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="cube_150">قالب مکعبی استاندارد ۱۵×۱۵×۱۵ سانتی‌متر (Cube 150)</option>
              <option value="cylinder_150_300">قالب استوانه‌ای ۱۵×۳۰ سانتی‌متر (Cylinder 150x300)</option>
            </select>
          </div>

          {/* Slump */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              اسلامپ بتن تازه (میلی‌متر) *
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min="0"
                max="300"
                value={slumpMm}
                onChange={(e) => setSlumpMm(Number(e.target.value))}
                className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
            </div>
          </div>

          {/* W/C Ratio */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نسبت آب به سیمان (W/C)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.2"
              max="0.8"
              value={wcRatio}
              onChange={(e) => setWcRatio(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cement Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نوع سیمان مصرفی
            </label>
            <select
              value={cementType}
              onChange={(e) => setCementType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="سیمان پرتلند تیپ ۲">سیمان پرتلند تیپ ۲ (معمولی)</option>
              <option value="سیمان پرتلند تیپ ۱">سیمان پرتلند تیپ ۱ (زودگیر)</option>
              <option value="سیمان پرتلند تیپ ۵">سیمان پرتلند تیپ ۵ (ضد سولفات)</option>
              <option value="سیمان پرتلند پوزولانی">سیمان پرتلند پوزولانی ویژه</option>
            </select>
          </div>

          {/* Truck Mixer Batch */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              شماره بارنامه / تراک میکسر
            </label>
            <input
              type="text"
              value={truckBatchNo}
              onChange={(e) => setTruckBatchNo(e.target.value)}
              placeholder="TRK-104 / بچینگ کارخانه"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Sampling Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                تاریخ نمونه‌گیری (جلالی)
              </label>
              <button
                type="button"
                onClick={() => setSamplingDateJalali(todayJalali)}
                className="text-[10px] text-blue-600 hover:underline font-bold"
              >
                امروز
              </button>
            </div>
            <input
              type="text"
              value={samplingDateJalali}
              onChange={(e) => setSamplingDateJalali(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sampling Time & Concrete Temp */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ساعت نمونه‌برداری
              </label>
              <input
                type="text"
                value={samplingTime}
                onChange={(e) => setSamplingTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                دمای بتن تازه (°C)
              </label>
              <input
                type="number"
                value={temperatureC}
                onChange={(e) => setTemperatureC(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Schedule Preview Calculated Automatically */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-900 dark:text-blue-200">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <span>تقویم برنامه‌ریزی هوشمند شکست جک (محاسبه خودکار)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
              <span className="text-slate-400 block text-[11px]">موعد آزمون مقاومت فشاری ۷ روزه:</span>
              <span className="font-mono font-bold text-blue-600 text-sm mt-0.5 block">
                {toPersianDigits(date7d)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">بررسی اولیه روند گیرش و پیش‌بینی ۲۸ روزه</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
              <span className="text-slate-400 block text-[11px]">موعد آزمون مقاومت مشخصه ۲۸ روزه:</span>
              <span className="font-mono font-bold text-emerald-600 text-sm mt-0.5 block">
                {toPersianDigits(date28d)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">معیار قطعی انطباق مقاومت بتن با طرح اختلاط</span>
            </div>
          </div>
        </div>

        {/* Concrete Intake Photo Upload & Preset Selection */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>پیوست تصویر مستند نمونه‌گیری بتن (اختیاری)</span>
            </label>
            <span className="text-[11px] text-slate-500">آپلود از دوربین یا گالری</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Image Preview */}
            <div className="sm:col-span-4 flex items-center gap-3">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-blue-500/30 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-sm relative group">
                <img 
                  src={uploadedPhotoUrl || selectedPhoto} 
                  alt="Concrete specimen" 
                  className="w-full h-full object-cover" 
                />
                {uploadedPhotoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveUploadedPhoto}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition text-xs font-bold gap-1"
                    title="حذف تصویر آپلود شده"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                )}
              </div>
              <div className="text-[11px] space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {uploadedPhotoUrl ? 'تصویر آپلود شده کاربر' : 'تصویر پیش‌فرض آزمایشگاه'}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  در شیت نهایی و پرتال کارفرما نمایش داده می‌شود
                </span>
              </div>
            </div>

            {/* Upload & Select options */}
            <div className="sm:col-span-8 flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="concrete-photo-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>آپلود عکس از سیستم / دوربین</span>
              </button>

              {!uploadedPhotoUrl && (
                <select
                  value={selectedPhoto}
                  onChange={(e) => setSelectedPhoto(e.target.value)}
                  className="py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={LAB_IMAGES.cubesBench}>انتخاب قالب‌ها از آرشیو</option>
                  <option value={LAB_IMAGES.cubesLab}>محیط حوضچه کیورینگ</option>
                  <option value={LAB_IMAGES.cubePress}>استقرار در دستگاه جک</option>
                </select>
              )}
            </div>
            {uploadError && (
              <div className="sm:col-span-12 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Note Box per Manual */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">الزام شیوه نامه سازمان نظام مهندسی:</span>
              <p>
                حداقل تعداد نمونه مورد نیاز شامل ۱ نمونه ۷ روزه، ۳ نمونه ۲۸ روزه و ۱ نمونه شاهد می‌باشد. همچنین ثبت اسلامپ و دمای بتن تازه جهت ارزیابی کارایی الزامی است.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'در حال ثبت نمونه...' : 'ثبت قطعی نمونه و صدور برچسب'}
          </button>
        </div>
      </form>
    </div>
  );
};
