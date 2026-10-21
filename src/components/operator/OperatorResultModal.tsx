import React, { useState, useRef } from 'react';
import { TestReport, UserProfile } from '../../types';
import { labDb } from '../../services/supabase';
import { getTodayJalali, formatJalali, toPersianDigits } from '../../utils/jalali';
import { LAB_IMAGES } from '../../assets/images';
import { optimizeAndReadImageFile } from '../../utils/fileUpload';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  Calendar, 
  Award, 
  Camera, 
  Image as ImageIcon,
  Activity,
  Layers,
  Upload,
  Trash2
} from 'lucide-react';

interface OperatorResultModalProps {
  report: TestReport | null;
  onClose: () => void;
  onSaved: () => void;
  currentUser?: UserProfile;
}

export const OperatorResultModal: React.FC<OperatorResultModalProps> = ({
  report,
  onClose,
  onSaved,
  currentUser
}) => {
  if (!report) return null;

  const todayJalali = formatJalali(getTodayJalali());
  const isCube = report.moldType === 'cube_150';
  const areaMm2 = isCube ? 22500 : 17671.46; // 150x150 mm or pi*75^2

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [load7d, setLoad7d] = useState<string>(
    report.breaking7dLoadKn !== undefined ? String(report.breaking7dLoadKn) : ''
  );
  const [date7d, setDate7d] = useState<string>(
    report.breakDate7dJalali || todayJalali
  );

  const [load28d, setLoad28d] = useState<string>(
    report.breaking28dLoadKn !== undefined ? String(report.breaking28dLoadKn) : ''
  );
  const [date28d, setDate28d] = useState<string>(
    report.breakDate28dJalali || todayJalali
  );
  const [density, setDensity] = useState<string>(
    report.densityKgM3 !== undefined ? String(report.densityKgM3) : '2380'
  );

  // Failure Pattern (ASTM C39 / ISIRI 3201)
  const [failurePattern, setFailurePattern] = useState<string>(
    'گسیختگی مخروطی استاندارد (Standard Cone - Type 1)'
  );

  // Fracture Photo
  const [selectedPhoto, setSelectedPhoto] = useState<string>(
    (report.photos && report.photos[0]) || LAB_IMAGES.cubeFracture
  );
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Helper to calculate MPa from kN
  const calculateMpa = (loadKnVal: number) => {
    if (!loadKnVal || isNaN(loadKnVal) || loadKnVal <= 0) return 0;
    // Load (kN) * 1000 = N / Area (mm2) = MPa
    let mpa = (loadKnVal * 1000) / areaMm2;
    if (!isCube) {
      // Cylinder to cube equivalent factor: 1.25 according to standard
      mpa = mpa * 1.25;
    }
    return Math.round(mpa * 10) / 10;
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
    setSelectedPhoto((report.photos && report.photos[0]) || LAB_IMAGES.cubeFracture);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const strength7d = load7d ? calculateMpa(parseFloat(load7d)) : (report.breaking7dStrengthMpa || 0);
  const strength28d = load28d ? calculateMpa(parseFloat(load28d)) : (report.breaking28dStrengthMpa || 0);

  const target = report.targetStrengthMpa || 30;
  const is28dReady = strength28d > 0;
  const isCompliant = is28dReady ? strength28d >= target : strength7d >= target * 0.65;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const operatorName = currentUser?.fullName || report.operatorName || 'اپراتور آزمایشگاه';
    const operatorId = currentUser?.id || report.operatorId || 'usr-operator-01';

    const finalPhoto = uploadedPhotoUrl || selectedPhoto;

    const updatedPhotos = report.photos && report.photos.length > 0 
      ? [finalPhoto, ...report.photos.filter(p => p !== finalPhoto)]
      : [finalPhoto];

    const updated: TestReport = {
      ...report,
      breaking7dLoadKn: load7d ? parseFloat(load7d) : report.breaking7dLoadKn,
      breaking7dStrengthMpa: strength7d > 0 ? strength7d : report.breaking7dStrengthMpa,
      breakDate7dJalali: load7d ? date7d : report.breakDate7dJalali,
      breaking28dLoadKn: load28d ? parseFloat(load28d) : report.breaking28dLoadKn,
      breaking28dStrengthMpa: strength28d > 0 ? strength28d : report.breaking28dStrengthMpa,
      breakDate28dJalali: load28d ? date28d : report.breakDate28dJalali,
      densityKgM3: load28d ? parseFloat(density) : report.densityKgM3,
      isPassed: is28dReady ? strength28d >= target : report.isPassed,
      status: is28dReady ? (strength28d >= target ? 'approved' : 'rejected') : report.status,
      operatorId,
      operatorName,
      photos: updatedPhotos
    };

    labDb.updateReport(updated);

    // Trigger SMS notification for test results
    const customers = labDb.getCustomers();
    const cust = customers.find(c => c.id === report.customerId);
    if (cust) {
      if (load28d && strength28d > 0) {
        labDb.sendSms({
          recipientPhone: cust.phone,
          recipientName: cust.representativeName,
          customerId: cust.id,
          customerName: cust.companyName,
          projectName: report.projectName,
          reportId: report.id,
          reportNo: report.reportNo,
          event: 'test_ready',
          customMessage: `نتایج آزمون ۲۸ روزه نمونه ${report.reportNo} (مقاومت: ${strength28d} MPa - وضعیت: ${strength28d >= target ? 'مورد قبول و منطبق' : 'کمتر از رده مشخصه'}) ثبت گردید. جهت مشاهده شیت رسمی به پرتال کارفرما مراجعه فرمایید. | آزما بتن پایش خاک و پی جهان بین`
        });
      } else if (load7d && strength7d > 0) {
        labDb.sendSms({
          recipientPhone: cust.phone,
          recipientName: cust.representativeName,
          customerId: cust.id,
          customerName: cust.companyName,
          projectName: report.projectName,
          reportId: report.id,
          reportNo: report.reportNo,
          event: 'test_ready',
          customMessage: `نتایج شکست ۷ روزه نمونه ${report.reportNo} با مقاومت ${strength7d} MPa در سامانه آزمایشگاه ثبت گردید. | آزما بتن پایش خاک و پی جهان بین`
        });
      }
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 sm:p-8 overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">
                ثبت نتایج جک شکست بتن (Compression Press Machine)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                نمونه کد {report.reportNo || report.id} • پروژه {report.projectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specimen Info Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">رده بتن مشخصه:</span>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
              {report.concreteGrade} ({report.targetStrengthMpa} MPa)
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">نوع قالب:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {isCube ? 'مکعبی ۱۵×۱۵ cm' : 'استوانه‌ای ۱۵×۳۰ cm'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">تاریخ نمونه‌گیری:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
              {toPersianDigits(report.samplingDateJalali)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">محل نمونه:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate" title={report.sampleLocation}>
              {report.sampleLocation}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 7-Day Breaking Section */}
          <div className="p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                آزمایش مقاومت فشاری ۷ روزه (پیش‌بینی مقاومت)
              </span>
              <span className="text-xs text-blue-600 font-medium">هدف ۷ روزه: ~{Math.round(target * 0.65)} MPa</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  بار نهایی گسیختگی جک (kN)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="مثلاً: 520"
                    value={load7d}
                    onChange={(e) => setLoad7d(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">kN</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ شکست ۷ روزه
                  </label>
                  <button
                    type="button"
                    onClick={() => setDate7d(todayJalali)}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    امروز
                  </button>
                </div>
                <input
                  type="text"
                  value={date7d}
                  onChange={(e) => setDate7d(e.target.value)}
                  placeholder="1403/07/28"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 font-mono text-center"
                />
              </div>
            </div>

            {strength7d > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900 text-xs">
                <span className="text-slate-600 dark:text-slate-400">مقاومت فشاری محاسبه شده ۷ روزه:</span>
                <span className="font-mono font-bold text-sm text-blue-600">
                  {toPersianDigits(strength7d)} MPa ({Math.round((strength7d / target) * 100)}% رده مشخصه)
                </span>
              </div>
            )}
          </div>

          {/* 28-Day Breaking Section */}
          <div className="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                آزمایش مقاومت فشاری ۲۸ روزه (مقاومت مشخصه نهایی)
              </span>
              <span className="text-xs text-emerald-600 font-medium">حداقل مجاز: {target} MPa</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  بار نهایی گسیختگی جک (kN)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="مثلاً: 720"
                    value={load28d}
                    onChange={(e) => setLoad28d(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">kN</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  وزن مخصوص سخت‌شده
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="مثلاً: 2380"
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                    className="w-full pl-14 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute left-2 top-2.5 text-[10px] text-slate-400 font-mono">kg/m³</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ شکست ۲۸ روزه
                  </label>
                  <button
                    type="button"
                    onClick={() => setDate28d(todayJalali)}
                    className="text-[10px] text-emerald-600 hover:underline font-bold"
                  >
                    امروز
                  </button>
                </div>
                <input
                  type="text"
                  value={date28d}
                  onChange={(e) => setDate28d(e.target.value)}
                  placeholder="1403/08/18"
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-emerald-500 font-mono text-center"
                />
              </div>
            </div>

            {strength28d > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs">
                <span className="text-slate-600 dark:text-slate-400">مقاومت فشاری نهایی ۲۸ روزه:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    {toPersianDigits(strength28d)} MPa
                  </span>
                  {strength28d >= target ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> منطبق بر طرح
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" /> کمتر از رده مشخصه
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fracture Pattern & Specimen Photo Upload Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>الگوی شکست بتن (ASTM C39 / ISIRI 3201)</span>
              </label>
              <select
                value={failurePattern}
                onChange={(e) => setFailurePattern(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
              >
                <option value="گسیختگی مخروطی استاندارد (Standard Cone - Type 1)">گسیختگی مخروطی استاندارد (نوع ۱)</option>
                <option value="گسیختگی مخروطی و دو نیم شدن (Cone and Split - Type 2)">گسیختگی مخروطی با شکافتگی (نوع ۲)</option>
                <option value="گسیختگی ستونی و شیارهای قائم (Columnar - Type 3)">گسیختگی ستونی شیاردار (نوع ۳)</option>
                <option value="گسیختگی برشی مورب (Shear - Type 4)">گسیختگی برشی مورب (نوع ۴)</option>
                <option value="گسیختگی گوشه‌ای نامتقارن (Side fracture - Type 5)">گسیختگی گوشه‌ای نامتقارن (نوع ۵)</option>
              </select>
            </div>

            {/* Photo Upload & Gallery */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>تصویر مستند گسیختگی آزمونه زیر جک (اختیاری)</span>
                </label>
                <span className="text-[11px] text-slate-500">امکان آپلود عکس جدید</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500/30 shrink-0 bg-slate-100 dark:bg-slate-800 relative group">
                  <img 
                    src={uploadedPhotoUrl || selectedPhoto} 
                    alt="Fracture preview" 
                    className="w-full h-full object-cover" 
                  />
                  {uploadedPhotoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveUploadedPhoto}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                      title="حذف تصویر آپلود شده"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="break-photo-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>آپلود عکس آزمونه از دستگاه / دوربین</span>
                  </button>

                  {!uploadedPhotoUrl && (
                    <select
                      value={selectedPhoto}
                      onChange={(e) => setSelectedPhoto(e.target.value)}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={LAB_IMAGES.cubeFracture}>تصویر نمونه شکسته شده زیر جک (پیش‌فرض)</option>
                      <option value={LAB_IMAGES.cubePress}>استقرار آزمونه در دستگاه جک</option>
                      <option value={LAB_IMAGES.cubesBench}>میز آزمونه‌های سخت‌شده</option>
                      <option value={LAB_IMAGES.cubesLab}>حوضچه و محوطه آزمون</option>
                    </select>
                  )}
                </div>
              </div>
              {uploadError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت و ذخیره نتایج آزمایش
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
