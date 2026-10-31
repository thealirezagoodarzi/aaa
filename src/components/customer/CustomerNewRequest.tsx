import React, { useState } from 'react';
import { labDb } from '../../services/supabase';
import { getTodayJalali, formatJalali, parseJalali, jalaliToGregorian } from '../../utils/jalali';
import { ArrowRight, Info, CheckCircle2, Calendar, MapPin, Truck, Phone, Building } from 'lucide-react';

interface CustomerNewRequestProps {
  onBack: () => void;
  onSubmit: (data: any) => void;
  customerId?: string;
  customerName?: string;
}

export const CustomerNewRequest: React.FC<CustomerNewRequestProps> = ({ 
  onBack, 
  onSubmit,
  customerId = 'cust-01',
  customerName = 'شرکت مهندسی عمران سازه پایدار تهران'
}) => {
  const todayJalali = formatJalali(getTodayJalali());
  const customers = labDb.getCustomers();
  const currentCustomer = customers.find(c => c.id === customerId) || customers[0] || null;

  const [formData, setFormData] = useState({
    projectName: currentCustomer?.projectNames?.[0] || 'پروژه جدید',
    sampleLocation: '',
    concreteGrade: 'C30',
    moldType: 'cube_150' as const,
    address: currentCustomer?.address || '',
    contactPhone: currentCustomer?.phone || '۰۹۱۲۱۱۱۱۱۱۱',
    scheduledDate: todayJalali,
    scheduledTime: '۱۰:۰۰ صبح',
    volumeM3: '45',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ ticketNo: string; reportNo: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const currentUser = labDb.getCurrentUser();
    const effectiveCustId = currentCustomer?.id || customerId;
    const effectiveCustName = currentCustomer?.companyName || customerName;

    // 1. Create Technician Dispatch Request
    const newDispatch = labDb.addDispatch({
      customerId: effectiveCustId,
      customerName: effectiveCustName,
      projectName: formData.projectName,
      projectAddress: formData.address,
      contactPhone: formData.contactPhone,
      scheduledDateJalali: formData.scheduledDate,
      scheduledTime: formData.scheduledTime,
      serviceType: `نمونه‌گیری بتن تازه رده ${formData.concreteGrade} - حجم تقریبی ${formData.volumeM3} مترمکعب`,
      requestCategory: 'field_dispatch',
      status: 'requested',
      notes: `${formData.sampleLocation} • ${formData.notes || 'درخواست اعزام نمونه‌گیر به کارگاه'}`
    });

    const trackingCode = `CTL-${newDispatch.ticketNo.replace('DSP-', '')}`;

    setCreatedResult({
      ticketNo: newDispatch.ticketNo,
      reportNo: trackingCode
    });

    setIsSubmitting(false);
    onSubmit({ dispatch: newDispatch, reportNo: trackingCode });
  };

  if (createdResult) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 max-w-2xl mx-auto text-center space-y-6 shadow-sm animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            درخواست نمونه‌گیری با موفقیت ثبت شد
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            اطلاعات کارگاه دریافت گردید و تکنسین آزمایشگاه جهت اعزام تخصیص داده خواهد شد.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">شماره تیکت اعزام:</span>
            <span className="font-bold text-sm font-mono text-blue-600 mt-1 block">
              {createdResult.ticketNo}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">کد رهگیری نمونه:</span>
            <span className="font-bold text-sm font-mono text-emerald-600 mt-1 block">
              {createdResult.reportNo}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onBack}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition"
          >
            بازگشت به پرتال مشتری
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">ثبت درخواست اعزام تکنسین و نمونه‌گیری بتن</h2>
          <p className="text-xs text-slate-500 mt-0.5">درخواست نمونه‌گیری در محل پروژه، آزمایش اسلامپ و کنترل کیفیت بتن آماده</p>
        </div>
      </div>

      <div className="flex gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs mb-6 border border-blue-100 dark:border-blue-800">
        <Info className="w-5 h-5 shrink-0 text-blue-600" />
        <p className="leading-relaxed">
          لطفاً ساعت تخمینی تخلیه تراک میکسرها و محل دقیق عضو سازه‌ای را با دقت ثبت فرمایید تا تیم نمونه‌گیری با قالب‌های کالیبره در موعد مقرر در کارگاه حاضر شوند.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Project */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نام پروژه و کارگاه *
            </label>
            {currentCustomer?.projectNames && currentCustomer.projectNames.length > 0 ? (
              <select
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                {currentCustomer.projectNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                name="projectName" 
                required 
                value={formData.projectName} 
                onChange={handleChange}
                placeholder="مثلاً: برج مسکونی نیلوفر"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Location / Structural Member */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              محل بتن‌ریزی / عضو سازه‌ای (طبق مبحث ۹ مقررات ملی) *
            </label>
            <select
              name="sampleLocation"
              value={formData.sampleLocation}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 mb-2"
            >
              <option value="">انتخاب المان سازه‌ای...</option>
              <option value="فونداسیون">فونداسیون</option>
              <option value="ستون">ستون</option>
              <option value="سقف">سقف</option>
              <option value="دیوار برشی">دیوار برشی</option>
              <option value="دیوار حائل">دیوار حائل</option>
              <option value="سایر">سایر موارد...</option>
            </select>
            {formData.sampleLocation === 'سایر' && (
              <input 
                type="text" 
                name="sampleLocation" 
                required 
                onChange={handleChange}
                placeholder="مثلاً: سقف طبقه ۵، دال و تیرهای محور ۲ تا ۵"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Grade */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              رده مقاومتی بتن مورد نیاز *
            </label>
            <select 
              name="concreteGrade" 
              value={formData.concreteGrade} 
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value="C20">C20 (مقاومت مشخصه ۲۰ مگاپاسکال)</option>
              <option value="C25">C25 (مقاومت مشخصه ۲۵ مگاپاسکال)</option>
              <option value="C30">C30 (مقاومت مشخصه ۳۰ مگاپاسکال)</option>
              <option value="C35">C35 (مقاومت مشخصه ۳۵ مگاپاسکال)</option>
              <option value="C40">C40 (مقاومت مشخصه ۴۰ مگاپاسکال)</option>
              <option value="C50">C50 (مقاومت مشخصه ۵۰ مگاپاسکال)</option>
            </select>
          </div>

          {/* Mold */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نوع قالب نمونه‌گیری
            </label>
            <select 
              name="moldType" 
              value={formData.moldType} 
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="cube_150">قالب مکعبی استاندارد ۱۵×۱۵ سانتی‌متر</option>
              <option value="cylinder_150_300">قالب استوانه‌ای ۱۵×۳۰ سانتی‌متر</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              تاریخ بتن‌ریزی مورد نظر (جلالی) *
            </label>
            <input 
              type="text" 
              name="scheduledDate" 
              required 
              value={formData.scheduledDate} 
              onChange={handleChange}
              placeholder="1403/08/10"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time & Volume */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ساعت تخلیه
              </label>
              <input 
                type="text" 
                name="scheduledTime" 
                value={formData.scheduledTime} 
                onChange={handleChange}
                placeholder="۱۰:۰۰ صبح"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-center focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                حجم بتن (m³)
              </label>
              <input 
                type="number" 
                name="volumeM3" 
                value={formData.volumeM3} 
                onChange={handleChange}
                placeholder="40"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-center font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              شماره تماس هماهنگ‌کننده کارگاه *
            </label>
            <input 
              type="text" 
              name="contactPhone" 
              required 
              value={formData.contactPhone} 
              onChange={handleChange}
              placeholder="۰۹۱۲..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              آدرس دقیق کارگاه پروژه جهت اعزام *
            </label>
            <textarea 
              name="address" 
              required 
              rows={2}
              value={formData.address} 
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="شهر، منطقه، خیابان اصلی و فرعی، شماره پلاک یا نام کارگاه..."
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              یادداشت و تمهیدات خاص (اختیاری)
            </label>
            <input 
              type="text" 
              name="notes" 
              value={formData.notes} 
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="مثلاً: هماهنگی جهت آزمایش روانی اسلامپ در چند تراک میکسر..."
            />
          </div>
        </div>

        {/* Note Box per Manual */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs mt-6">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-blue-800 dark:text-blue-200 space-y-1.5 leading-relaxed">
              <span className="font-bold block">الزام شیوه نامه سازمان نظام مهندسی:</span>
              <p>
                لطفا توجه داشته باشید که طبق شیوه نامه حداقل اخذ ۵ نمونه استاندارد شامل:
                <span className="font-bold"> ۱ نمونه ۷ روزه، ۳ نمونه ۲۸ روزه، و ۱ نمونه شاهد (نگهداری تا ۹۰ روز) </span>
                برای این دسته از سازه‌ها الزامی است. تکنسین‌های این آزمایشگاه این مورد را رعایت خواهند کرد.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="button" 
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition"
          >
            انصراف
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی درخواست اعزام'}
          </button>
        </div>
      </form>
    </div>
  );
};
