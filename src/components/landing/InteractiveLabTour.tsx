import React, { useState } from 'react';
import { 
  Building2, 
  FlaskConical, 
  Cpu, 
  Sliders, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  Eye, 
  Info,
  Maximize2,
  Sparkles
} from 'lucide-react';

interface InteractiveLabTourProps {
  language: 'fa' | 'en';
}

export const InteractiveLabTour: React.FC<InteractiveLabTourProps> = ({ language }) => {
  const isFa = language === 'fa';
  const [activeStation, setActiveStation] = useState<number>(0);

  const stations = [
    {
      id: 'press',
      nameFa: 'ایستگاه ۱: جک هیدرولیکی تمام اتوماتیک ۲۰۰۰ kN دیجیتال',
      nameEn: 'Station 1: Automatic 2000 kN Digital Hydraulic Press',
      code: 'UTM-HYDR-2000',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
      specsFa: 'سرعت بارگذاری استاندارد ۰.۶ مگاپاسکال بر ثانیه، لودسل دیجیتال سنسوریک کلاس ۰.۵، ثبت خودکار منحنی تنش-کرنش و اتصال به سامانه ابری.',
      specsEn: 'Pacing rate 0.6 MPa/sec, Class 0.5 digital load cell, automatic real-time stress-strain curve generation, IoT cloud connected.',
      standards: 'ASTM C39, EN 12390-4, ISIRI 3206',
      calibrated: '۱۴۰۳/۰۶/۱۵ (دارای تاییدیه رسمی کالیبراسیون)',
      calibratedEn: 'Aug 2024 (Official Calibration Certificate)',
      featuresFa: [
        'کنترل بارگذاری مداربسته Servo-Hydraulic',
        'تشخیص هوشمند نقطه پیک و شکست نهایی نمونه',
        'محفظه ایمنی ضد پرتاب ترکش بتن با پلی‌کربنات ۸ میلی‌متر',
        'سازگار با نمونه‌های مکعبی ۱۰۰ و ۱۵۰ و استوانه‌ای ۱۵۰×۳۰۰'
      ],
      featuresEn: [
        'Closed-loop Servo-Hydraulic load pacing',
        'Instant AI fracture peak detection',
        'Impact-resistant 8mm polycarbonate shield',
        'Dual molds (100mm, 150mm cubes & 150x300 cylinders)'
      ]
    },
    {
      id: 'schmidt',
      nameFa: 'ایستگاه ۲: چکش اشمیت دیجیتال SilverSchmidt سوئیس',
      nameEn: 'Station 2: SilverSchmidt Digital Rebound Hammer',
      code: 'NDT-SCHMIDT-PRO',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
      specsFa: 'تعیین عدد بازتابش با انرژی ضربه ۲.۲۰۷ ژول، محاسبه ضریب تصحیح زاویه ضربه و تبدیل آنی به مقاومت فشاری مگاپاسکال.',
      specsEn: 'Impact energy 2.207 N.m, automated impact angle compensation and instantaneous compressive MPa conversion.',
      standards: 'ASTM C805, EN 12504-2, ISIRI 3201',
      calibrated: '۱۴۰۳/۰۵/۲۰ (سندان کالیبراسیون استاندارد)',
      calibratedEn: 'July 2024 (Certified Anvil Validated)',
      featuresFa: [
        'ثبت داده‌های مکانی آزمون با GPS داخلی',
        'تحلیل آماری داده‌های بازگشتی (میانگین، انحراف معیار، ضریب تغییرات)',
        'عدم حساسیت به خطای انسانی اپراتور',
        'مناسب برای ارزیابی بتن‌های رده C15 تا C80'
      ],
      featuresEn: [
        'GPS location logging per impact point',
        'Statistical distribution & standard deviation calculation',
        'Human-error immune optical sensor technology',
        'Operates from C15 up to C80 high strength concrete'
      ]
    },
    {
      id: 'upv',
      nameFa: 'ایستگاه ۳: دستگاه اولتراسونیک بتن PUNDIT PL-200',
      nameEn: 'Station 3: PUNDIT Ultrasonic Pulse Velocity (UPV)',
      code: 'NDT-UPV-54KHZ',
      image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
      specsFa: 'ارسال امواج صوتی ۵۴ کیلوهرتز جهت پایش حفرات داخلی، لانه‌زنبوری شدن بتن، عمق ترک‌های سازه‌ای و تعیین مدول الاستیسیته دینامیک.',
      specsEn: '54 kHz ultrasonic transducer for internal honeycombing, void detection, crack depth mapping, and dynamic elasticity.',
      standards: 'ASTM C597, EN 12504-4, ISIRI 3202',
      calibrated: '۱۴۰۳/۰۴/۱۰ (میله مرجع کالیبراسیون سوئیسی)',
      calibratedEn: 'June 2024 (Proceq Reference Bar Certified)',
      featuresFa: [
        'اندازه‌گیری زمان گذر امواج با دقت ۰.۱ میکروثانیه',
        'روش‌های اندازه‌گیری مستقیم، نیمه‌مستقیم و سطحی',
        'ترکیب با چکش اشمیت به روش SonReb برای افزایش دقت تخمین',
        'ارزیابی کیفیت تزریق گروت در غلاف‌های پیش‌تنیدگی'
      ],
      featuresEn: [
        'Transit time precision of 0.1 microseconds',
        'Direct, semi-direct, and surface transmission modes',
        'Combined SonReb method for maximum accuracy',
        'Post-tensioned grout tendon void scanning'
      ]
    },
    {
      id: 'curing',
      nameFa: 'ایستگاه ۴: حوضچه‌های کیورینگ هوشمند با کنترل PID دما',
      nameEn: 'Station 4: Intelligent Curing Water Tanks with PID Temp Control',
      code: 'CURING-PID-20C',
      image: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80',
      specsFa: 'حفظ پیوسته دمای آب در محدوده ۲ ± ۲۳ درجه سانتی‌گراد و اشباع کامل با کلسیم هیدروکسید جهت جلوگیری از شسته شدن آهک نمونه‌ها.',
      specsEn: 'Maintains continuous temperature at 23 ± 2 °C with saturated lime-water to prevent calcium leaching.',
      standards: 'ASTM C511, EN 12390-2, ISIRI 3206',
      calibrated: 'سنسورهای ترموکوپل PT100 کالیبره سالانه',
      calibratedEn: 'Calibrated PT100 Thermocouple Array',
      featuresFa: [
        'سیرکولاسیون خودکار آب جهت توزیع یکنواخت دما در کل حوضچه',
        'ثبت لحظه‌ای لاگ دما در سامانه کنترل کیفیت به صورت ۲۴ ساعته',
        'ظرفیت نگهداری همزمان بیش از ۱۲۰۰ قالب نمونه بتن',
        'سامانه اعلام هشدار پیامکی در صورت نوسان دمای حوضچه'
      ],
      featuresEn: [
        'Automated water circulation pump for thermal homogeneity',
        '24/7 continuous thermal logging & cloud telemetry',
        'Capacity of over 1200 simultaneous concrete specimen molds',
        'Instant SMS emergency alarm on thermal deviation'
      ]
    },
    {
      id: 'slump-station',
      nameFa: 'ایستگاه ۵: مجموعه تست‌های بتن تازه (اسلامپ، حباب‌هوا و روانی)',
      nameEn: 'Station 5: Fresh Concrete Testing Suite (Slump, Air & Flow)',
      code: 'FRESH-SUITE-STD',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      specsFa: 'مخروط آبراهامز استاندارد ضخامت ۲ میلی‌متر با میله کوبه سرگرد، دستگاه سنجش درصد هوای بتن به روش فشاری (Air Meter Type B) و میز جریان بتن خودتراکم (Flow Table).',
      specsEn: 'Abrams slump cone, Type B pressure air entrainment meter, and SCC flow table spread testing kit.',
      standards: 'ASTM C143, ASTM C231, EN 12350',
      calibrated: 'گِیج فشار باد با تاییدیه اداره استاندارد',
      calibratedEn: 'Standard Certified Pressure Gauge',
      featuresFa: [
        'اندازه‌گیری دقیق اسلامپ بتن از صفر تا ۳۰۰ میلی‌متر',
        'تعیین دقیق درصد حباب‌های هوای محبوس و عمدی در بتن',
        'آزمایش قابلیت عبور بتن از موانع و میلگردها (L-Box / J-Ring)',
        'توزین چگالی بتن تازه با ظروف کالیبره حجم ثابت'
      ],
      featuresEn: [
        'High-precision slump drop measurement (0 - 300 mm)',
        'Determination of entrained and entrapped air voids',
        'Passing ability testing through rebars (L-Box & J-Ring)',
        'Fresh concrete unit weight density assessment'
      ]
    }
  ];

  const current = stations[activeStation];

  return (
    <div className="space-y-6 text-start">
      
      {/* Station Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {stations.map((st, idx) => (
          <button
            key={st.id}
            onClick={() => setActiveStation(idx)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 ${
              activeStation === idx
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-mono">
              0{idx + 1}
            </span>
            <span className="truncate max-w-[200px] sm:max-w-none">
              {isFa ? st.nameFa.split(':')[0] : st.nameEn.split(':')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Main Station Detail View */}
      <div className="rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          
          {/* Station Image Preview */}
          <div className="lg:col-span-5 relative min-h-[250px] lg:min-h-full">
            <img 
              src={current.image} 
              alt={isFa ? `ایستگاه آزمایشگاهی: ${current.nameFa}` : `Testing Station: ${current.nameEn}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
            <div className="absolute bottom-4 start-4 end-4 text-white">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-600/80 border border-blue-400/40 backdrop-blur-xs font-bold block w-fit mb-1.5">
                {current.code}
              </span>
              <h4 className="text-base font-black">
                {isFa ? current.nameFa : current.nameEn}
              </h4>
            </div>
          </div>

          {/* Station Technical Details */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-5">
            
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-400 block font-bold">
                  {isFa ? 'استانداردهای مرجع آزمون:' : 'Reference Standards:'}
                </span>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  {current.standards}
                </span>
              </div>
              <div className="text-end">
                <span className="text-xs text-slate-400 block font-bold">
                  {isFa ? 'وضعیت کالیبراسیون:' : 'Calibration Status:'}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isFa ? current.calibrated : current.calibratedEn}</span>
                </span>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {isFa ? 'شرح مشخصات و عملکرد مهندسی دستگاه' : 'Technical Specifications & Engineering Mechanism'}
              </h5>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                {isFa ? current.specsFa : current.specsEn}
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                {isFa ? 'قابلیت‌ها و استانداردهای کیفی ایستگاه' : 'Key Station Capabilities'}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(isFa ? current.featuresFa : current.featuresEn).map((feat, fIdx) => (
                  <div 
                    key={fIdx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
