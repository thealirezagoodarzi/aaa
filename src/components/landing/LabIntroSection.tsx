import React from 'react';
import { 
  Building2, 
  Award, 
  ShieldCheck, 
  CheckCircle2, 
  FlaskConical, 
  Compass, 
  Microscope, 
  FileCheck, 
  Cpu, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Layers,
  Zap,
  Shield,
  Sparkles
} from 'lucide-react';

interface LabIntroSectionProps {
  language: 'fa' | 'en';
}

export const LabIntroSection: React.FC<LabIntroSectionProps> = ({ language }) => {
  const isFa = language === 'fa';

  const departments = [
    {
      titleFa: 'دپارتمان آزمون‌های مکانیکی و مقاومت فشاری',
      titleEn: 'Mechanical & Compressive Testing Dept',
      descFa: 'شکست نمونه‌های بتن مکعبی و استوانه‌ای با جک‌های هیدرولیکی اتوماتیک ۲۰۰۰ کیلونیوتن کالیبره، تعیین مدول الاستیسیته و مقاومت کششی برزیلی.',
      descEn: 'Automatic 2000 kN hydraulic compression testing, modulus of elasticity, and Brazilian splitting tensile tests.',
      icon: FlaskConical,
      badgeFa: 'استاندارد ASTM C39 / ISIRI 3206',
      badgeEn: 'ASTM C39 / ISO 1920',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80'
    },
    {
      titleFa: 'دپارتمان آزمون‌های غیرمخرب سازه‌ای (NDT)',
      titleEn: 'Non-Destructive Testing (NDT) Dept',
      descFa: 'ارزیابی مقاومت بتن درجا با چکش اشمیت دیجیتال سوئیسی SilverSchmidt، سرعت امواج التراسونیک (UPV) و اسکن مغناطیسی میلگرد.',
      descEn: 'In-situ concrete assessment via SilverSchmidt rebound hammer, Ultrasonic Pulse Velocity (UPV), and radar rebar scanning.',
      icon: Microscope,
      badgeFa: 'استاندارد ASTM C597 / ISIRI 3201',
      badgeEn: 'ASTM C597 / BS 1881',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80'
    },
    {
      titleFa: 'دپارتمان طرح اختلاط و بتن‌های پیشرفته (HPC & SCC)',
      titleEn: 'Mix-Design & Advanced Concrete Technologies',
      descFa: 'طراحی فرمولاسیون اختصاصی بتن خودتراکم (SCC)، بتن‌های پرمقاومت با میکروسیلیس و پلی‌کربوکسیلات‌های فوق روان‌کننده.',
      descEn: 'High-Performance Concrete (HPC), Self-Compacting Concrete (SCC) mix design, and silica fume pozzolanic micro-structures.',
      icon: Cpu,
      badgeFa: 'آیین‌نامه بتن ایران (آبا)',
      badgeEn: 'ACI 211.1 / EN 206',
      image: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80'
    },
    {
      titleFa: 'دپارتمان دوام، شیمی و نفوذپذیری بتن',
      titleEn: 'Durability, Chemistry & Permeability Dept',
      descFa: 'آزمایش نفوذ تسریع‌شده یون کلراید (RCPT)، مقاومت الکتریکی ویژه، تعیین عمق کربناتاسیون و جذب آب مویینه سازه.',
      descEn: 'Rapid Chloride Permeability Test (RCPT), concrete bulk resistivity, carbonation depth, and capillary absorption.',
      icon: Layers,
      badgeFa: 'استاندارد ASTM C1202',
      badgeEn: 'ASTM C1202 / NT BUILD 492',
      image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80'
    },
    {
      titleFa: 'دپارتمان کنترل کیفی مصالح سنگی، سیمان و آب',
      titleEn: 'Aggregates, Cement & Water Quality Dept',
      descFa: 'دانه‌بندی سنگدانه با الک‌های استاندارد، ارزش ماسه‌ای (SE)، سایش لوس‌آنجلس و آزمایش‌های فیزیکی-شیمیایی سیمان.',
      descEn: 'Sieve aggregate gradation, Sand Equivalent (SE), Los Angeles abrasion, specific gravity, and chemical water testing.',
      icon: Compass,
      badgeFa: 'استاندارد ASTM C33 / ISIRI 302',
      badgeEn: 'ASTM C33 / EN 933',
      image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80'
    },
    {
      titleFa: 'دپارتمان کرگیری و ارزیابی سازه‌های بتنی',
      titleEn: 'Diamond Core Drilling & Structural Audit',
      descFa: 'مغزه‌گیری مغناطیسی بتن با دستگاه‌های هیدرولیکی هیلتی بدون آسیب به میلگردها و تعیین ضریب تصحیح مقاومت مغزه‌ها.',
      descEn: 'Diamond core drilling with Hilti diamond rigs, compressive core correction factors, and seismic retrofitting consultancy.',
      icon: Zap,
      badgeFa: 'استاندارد ASTM C42',
      badgeEn: 'ASTM C42 / ACI 318',
      image: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80'
    }
  ];

  const stats = [
    { value: '+۲۵۰,۰۰۰', valueEn: '+250,000', labelFa: 'آزمون شکست و مقاومت صادرشده', labelEn: 'Certified Test Reports', icon: FileCheck },
    { value: '۴۵۰+', valueEn: '450+', labelFa: 'پروژه عمرانی و ساختمانی تحت پوشش', labelEn: 'Active Construction Projects', icon: Building2 },
    { value: '۹۹.۹۸٪', valueEn: '99.98%', labelFa: 'شاخص دقت و کالیبراسیون تجهیزات', labelEn: 'Calibration Precision Rate', icon: Award },
    { value: '۲۴ ساعته', valueEn: '24 Hours', labelFa: 'مدت زمان ارائه نتایج رسمی', labelEn: 'Turnaround Certificate Time', icon: Clock }
  ];

  const certifications = [
    { title: 'گواهینامه تایید صلاحیت ISO/IEC 17025:2017', sub: 'نظام مدیریت کیفیت آزمایشگاه‌های آزمون و کالیبراسیون' },
    { title: 'پروانه پایه ارشد خدمات فنی و آزمایشگاهی', sub: 'وزارت راه و شهرسازی و سازمان نظام مهندسی ساختمان' },
    { title: 'آزمایشگاه همکار سازمان ملی استاندارد ایران (ISIRI)', sub: 'کد اعتبار ملی IRAN-NACI-LAB-1403' },
    { title: 'تاییدیه مرکز تحقیقات راه، مسکن و شهرسازی (BHRC)', sub: 'صلاحیت فنی کنترل کیفی بتن آماده و فرآورده‌های بتنی' }
  ];

  return (
    <div className="space-y-12 text-start">
      
      {/* Visual Image Banner & Mission Statement */}
      <div className="rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 w-fit">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isFa ? 'مرکز تخصصی آزمون‌های کنترل کیفیت بتن' : 'Advanced Concrete Testing Lab'}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {isFa 
                ? 'تضمین دوام و پایایی سازه‌ها با تکیه بر استانداردهای جهانی' 
                : 'Ensuring Structural Safety & Concrete Durability'}
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isFa 
                ? 'آزمایشگاه تخصصی بتن با بهره‌گیری از کادر مهندسین ارشد سازه و تکنولوژیست‌های بتن، پیشرفته‌ترین جک‌های هیدرولیکی دیجیتال و ابزارهای پایش هوشمند، به عنوان معتمد پروژه‌های ملی، انبوه‌سازی و زیربنایی کشور خدمات کنترل کیفی و آزمایشگاهی ارائه می‌دهد.' 
                : 'Our Concrete Laboratory operates certified mechanical testing facilities, NDT non-destructive diagnostic suites, and AI-driven maturity prediction platforms for high-rise, civil and infrastructure projects.'}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {isFa ? 'کالیبراسیون رسمی' : 'Accredited Calibration'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {isFa ? 'دستگاه‌ها تحت نظارت سازمان ملی استاندارد' : 'Monitored under ISO 17025 protocols'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  {isFa ? 'امضای دیجیتال' : 'Cryptographic QR'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {isFa ? 'شیت‌های دارای QR و کد اصالت لحظه‌ای' : 'Realtime digital stamp & verify token'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-full">
            <img 
              src="https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80" 
              alt="تیم مهندسی و تکنسین‌های کنترل کیفیت در حال نمونه‌برداری بتن کارگاهی"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent lg:bg-gradient-to-e lg:from-white dark:lg:from-slate-900 lg:via-transparent lg:to-transparent" />
            <div className="absolute bottom-4 start-4 end-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md text-white border border-slate-700 text-xs">
              <span className="font-bold block text-blue-300">
                {isFa ? 'نمونه‌گیری استاندارد سر پروژه' : 'On-Site Field Sampling'}
              </span>
              <span className="text-[11px] text-slate-300">
                {isFa ? 'توسط تکنسین‌های دارای گواهینامه ACI و نظام مهندسی' : 'Certified technicians using ACI field protocols'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Key Numbers / Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div 
              key={idx}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                  {isFa ? s.value : s.valueEn}
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isFa ? s.labelFa : s.labelEn}
              </p>
            </div>
          );
        })}
      </div>

      {/* Departments Grid */}
      <div className="space-y-4">
        <h4 className="text-lg font-black text-slate-900 dark:text-white">
          {isFa ? 'دپارتمان‌های تخصصی کنترل کیفیت و پژوهش بتن' : 'Specialized Concrete Testing Departments'}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept, i) => {
            const Icon = dept.icon;
            return (
              <div 
                key={i}
                className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/50 transition flex flex-col"
              >
                <div className="h-32 relative overflow-hidden">
                  <img 
                    src={dept.image} 
                    alt={dept.titleFa}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  <div className="absolute top-3 start-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 start-3 end-3">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-900/80 text-blue-200 border border-blue-700/50 backdrop-blur-xs font-mono">
                      {isFa ? dept.badgeFa : dept.badgeEn}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                      {isFa ? dept.titleFa : dept.titleEn}
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isFa ? dept.descFa : dept.descEn}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certifications and Accreditations */}
      <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
              <Award className="w-4 h-4" />
              <span>{isFa ? 'گواهینامه‌های رسمی و اعتبارسنجی' : 'Official Accreditations & Licenses'}</span>
            </div>
            <h4 className="text-xl font-black tracking-tight">
              {isFa ? 'صلاحیت‌های قانونی و مجوزهای کشوری آزمایشگاه' : 'Certified under National & International Standards'}
            </h4>
          </div>
          <span className="px-3 py-1 rounded-xl bg-slate-800 text-xs text-slate-300 font-mono border border-slate-700 w-fit">
            ISO/IEC 17025
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certifications.map((cert, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/70 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs sm:text-sm font-bold block text-slate-100 mb-0.5">
                  {cert.title}
                </span>
                <span className="text-xs text-slate-400">
                  {cert.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
