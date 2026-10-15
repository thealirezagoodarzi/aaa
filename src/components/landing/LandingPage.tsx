import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../../types';
import { Language } from '../../utils/i18n';
import { LAB_IMAGES } from '../../assets/images';
import { ThreeConcretePress } from './ThreeConcretePress';
import { ThreeSlumpVisualizer } from './ThreeSlumpVisualizer';
import { ThreeNdtVisualizer } from './ThreeNdtVisualizer';
import { CertificateVerifierWidget } from './CertificateVerifierWidget';
import { ConcreteStrengthChartWidget } from './ConcreteStrengthChartWidget';
import { TestRequestWizardModal } from './TestRequestWizardModal';
import { CompanyLogo } from '../common/CompanyLogo';
import { LAB_INFO, labDb } from '../../services/supabase';
import { getTodayJalali, toPersianDigits } from '../../utils/jalali';
import { 
  Building2, 
  ShieldCheck, 
  ArrowLeft, 
  Activity, 
  Award, 
  FileCheck,
  CheckCircle2,
  Phone,
  MapPin,
  Clock,
  Mail,
  Globe,
  FlaskConical,
  Shield,
  Zap,
  Headphones,
  FileText,
  Truck,
  Boxes,
  Maximize2,
  X,
  ArrowUp,
  Calendar,
  Users,
  Play,
  LayoutGrid,
  Send,
  Layers,
  Sparkles,
  User,
  RotateCw,
  MessageSquare,
  Building,
  ChevronDown,
  Instagram,
  Linkedin,
  Star,
  LogIn
} from 'lucide-react';
import { useModalBack } from '../../hooks/useModalBack';

interface LandingPageProps {
  onOpenLogin: () => void;
  onLogin: (user: UserProfile) => void;
  availableUsers: UserProfile[];
  language: Language;
  activeSection?: string;
  onSectionChange?: (sectionId: string) => void;
  onOpenTestRequest?: () => void;
  isDarkMode?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  language,
  onSectionChange,
  onOpenTestRequest,
  isDarkMode = true
}) => {
  const isFa = language === 'fa';
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [simulationSubTab, setSimulationSubTab] = useState<'press' | 'slump' | 'ndt'>('press');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [badgeModalData, setBadgeModalData] = useState<{ title: string; desc: string } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Hook modals to browser back button
  useModalBack(isWizardOpen, () => setIsWizardOpen(false), 'landing-wizard-modal');
  useModalBack(isLocationModalOpen, () => setIsLocationModalOpen(false), 'landing-location-modal');
  useModalBack(isVideoModalOpen, () => setIsVideoModalOpen(false), 'landing-video-modal');
  useModalBack(Boolean(badgeModalData), () => setBadgeModalData(null), 'landing-badge-modal');

  // Scroll listener for floating scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver to sync navbar active indicator with current section on scroll
  useEffect(() => {
    if (!onSectionChange) return;

    const sections = [
      { id: 'hero-section', navId: 'home' },
      { id: 'section-services', navId: 'services' },
      { id: 'section-process', navId: 'about' },
      { id: 'section-simulations', navId: 'gallery' },
      { id: 'section-contact', navId: 'contact' },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = sections.find((s) => s.id === entry.target.id);
            if (match) {
              onSectionChange(match.navId);
            }
          }
        });
      },
      {
        threshold: 0.25,
        rootMargin: '-80px 0px -20% 0px'
      }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [onSectionChange]);

  // Smooth scroll helper
  const scrollTo = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 2 Visual Cards for Lab Services (Concrete only)
  const serviceCards = [
    {
      id: 1,
      tag: isFa ? 'آزمایش بتن' : 'Concrete Testing',
      tagColor: 'bg-teal-500/15 text-teal-700 dark:text-[#00d2a0] border-teal-500/30',
      title: isFa ? 'آزمایش بتن' : 'Concrete Strength Testing',
      desc: isFa ? 'مقاومت فشاری، کششی، خمشی و دوام بتن مطابق مبحث نهم مقررات ملی ساختمان' : 'Compressive, splitting tensile, flexural and durability tests of concrete',
      img: LAB_IMAGES.cubesBench,
      iconColor: 'text-[#00d2a0]'
    },
    {
      id: 2,
      tag: isFa ? 'گزارش و مستندات' : 'Reports & Records',
      tagColor: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
      title: isFa ? 'گزارش و مستندات' : 'Certified Test Reports',
      desc: isFa ? 'ارائه گزارش‌های دقیق و معتبر با مهر و امضای رسمی مدیر فنی' : 'Issuance of accredited reports with engineering stamp and QR code',
      img: LAB_IMAGES.cubePress,
      iconColor: 'text-cyan-400'
    },
  ];

  return (
    <div className="w-full space-y-10 sm:space-y-14 pb-12">
      
      {/* ========================================================= */}
      {/* 1. HERO SECTION (Full-Width First-Viewport Premium UI)    */}
      {/* ========================================================= */}
      <section 
        id="hero-section" 
        className="relative w-full overflow-hidden bg-gradient-to-b from-[#e2f1f8] via-[#f0f9ff] to-white dark:bg-[#031522] min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] flex items-center justify-center border-b border-cyan-500/20 shadow-2xl transition-colors"
      >
        {/* Real Concrete Testing Laboratory Background Photo matching reference */}
        <img 
          src={LAB_IMAGES.modernHeroLab || LAB_IMAGES.cubePress} 
          alt="دستگاه جک بتن‌شکن تمام اتوماتیک و آزمایشگاه تخصصی مقاومت مصالح، بتن و ژئوتکنیک" 
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center transform scale-100 opacity-35 dark:opacity-90 transition-all duration-1000"
          referrerPolicy="no-referrer"
        />

        {/* Ambient Gradients for Maximum Legibility and Depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-50/85 via-sky-100/65 to-transparent dark:from-[#041d2d]/92 dark:via-[#062c3e]/80 dark:to-[#041d2d]/50 rtl:bg-gradient-to-l rtl:from-sky-50/85 rtl:via-sky-100/65 rtl:to-transparent dark:rtl:from-[#041d2d]/92 dark:rtl:via-[#062c3e]/80 dark:rtl:to-[#041d2d]/50 pointer-events-none" />
        <div className="absolute inset-0 bg-radial at-center from-transparent via-white/40 to-white/80 dark:via-[#041d2d]/30 dark:to-[#041d2d]/90 pointer-events-none" />

        {/* Layered Modern Teal & Mint Wave Swoosh on Bottom Left matching image */}
        <div className="absolute -bottom-1 -left-4 w-96 sm:w-[540px] h-48 pointer-events-none z-10 opacity-95">
          <svg viewBox="0 0 540 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M0 180V110C140 135 270 50 420 85C480 100 520 140 540 180H0Z" fill="#00b4d8" fillOpacity="0.45" />
            <path d="M0 180V135C100 145 210 80 350 105C440 120 500 155 540 180H0Z" fill="#00c49f" fillOpacity="0.85" />
            <path d="M0 180V152C80 158 170 115 290 125C380 135 450 168 500 180H0Z" fill="#06b6d4" />
          </svg>
        </div>

        {/* Subtle Decorative Dot Matrix on Bottom Right matching image */}
        <div className="absolute bottom-6 right-8 z-10 opacity-30 dark:opacity-40 hidden sm:grid grid-cols-6 gap-2 pointer-events-none">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
          ))}
        </div>

        {/* Main Hero Inner Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 py-6 sm:py-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Right side in RTL (Text & Actions matching Image) */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="lg:col-span-7 space-y-4 text-start"
            >
              {/* Top Teal Ribbon with Shield: «دقت در آزمون، اطمینان در ساخت» */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-teal-50 dark:bg-[#0a2e42]/90 text-slate-800 dark:text-white shadow-xs border border-teal-200 dark:border-cyan-400/40 backdrop-blur-md">
                  <ShieldCheck className="w-4 h-4 text-[#00a383] dark:text-[#00c49f] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold tracking-wide">
                    {isFa ? (
                      <>
                        دقت در <span className="text-teal-700 dark:text-[#00c49f] font-black">آزمون</span>، اطمینان در ساخت
                      </>
                    ) : (
                      'Accuracy in Testing, Confidence in Construction'
                    )}
                  </span>
                </div>
              </div>

              {/* Display Headings with High Precision Typography */}
              <div className="space-y-1">
                <span className="text-xs sm:text-sm font-black tracking-wider text-cyan-800 dark:text-cyan-300 block drop-shadow-sm">
                  {isFa ? 'آزمایشگاه تخصصی مقاومت مصالح، بتن و ژئوتکنیک' : 'SPECIALIZED MATERIALS RESISTANCE, CONCRETE & GEOTECHNICAL LAB'}
                </span>
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-tight drop-shadow-sm">
                  {isFa ? 'آزما بتن' : 'Azma Beton'}
                </h1>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-cyan-700 to-blue-700 dark:from-[#00c49f] dark:via-teal-300 dark:to-[#38bdf8] tracking-tight leading-tight">
                  {isFa ? 'پایش خاک و پی جهان بین' : 'Payesh Khak o Pey Jahan Bin'}
                </h2>
              </div>

              {/* 3 Horizontal Pill Badges - Identically sized and aligned */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 w-full max-w-2xl items-stretch">
                {/* Pill 1 */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-white/90 dark:bg-[#082a3c]/90 border border-slate-200 dark:border-cyan-400/35 text-slate-800 dark:text-white shadow-xs flex items-center justify-between gap-2.5 backdrop-blur-md hover:border-teal-400 dark:hover:border-cyan-300 transition-colors h-full min-h-[62px] sm:min-h-[68px]">
                  <div className="text-start min-w-0 flex-1">
                    <span className="text-[11px] sm:text-[11.5px] font-black block leading-snug text-slate-900 dark:text-white">
                      {isFa ? 'طرح اختلاط، اسلامپ و پذیرش' : 'Mix Design & Slump'}
                    </span>
                    <span className="text-[10px] text-teal-700 dark:text-cyan-300 font-bold block mt-0.5">
                      {isFa ? 'کاربردی و دقیق' : 'Practical & Accurate'}
                    </span>
                  </div>
                  <FlaskConical className="w-5 h-5 text-teal-600 dark:text-[#00c49f] shrink-0 ms-1" />
                </div>

                {/* Pill 2 */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-white/90 dark:bg-[#082a3c]/90 border border-slate-200 dark:border-cyan-400/35 text-slate-800 dark:text-white shadow-xs flex items-center justify-between gap-2.5 backdrop-blur-md hover:border-teal-400 dark:hover:border-cyan-300 transition-colors h-full min-h-[62px] sm:min-h-[68px]">
                  <div className="text-start min-w-0 flex-1">
                    <span className="text-[11px] sm:text-[11.5px] font-black block leading-snug text-slate-900 dark:text-white">
                      {isFa ? 'آزمایشگاه تخصصی مقاومت فشاری بتن' : 'Compressive Strength Lab'}
                    </span>
                    <span className="text-[10px] text-teal-700 dark:text-cyan-300 font-bold block mt-0.5">
                      {isFa ? 'با تجهیزات پیشرفته' : 'Advanced Equipment'}
                    </span>
                  </div>
                  <Layers className="w-5 h-5 text-teal-600 dark:text-[#00c49f] shrink-0 ms-1" />
                </div>

                {/* Pill 3 */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-white/90 dark:bg-[#082a3c]/90 border border-slate-200 dark:border-cyan-400/35 text-slate-800 dark:text-white shadow-xs flex items-center justify-between gap-2.5 backdrop-blur-md hover:border-teal-400 dark:hover:border-cyan-300 transition-colors h-full min-h-[62px] sm:min-h-[68px]">
                  <div className="text-start min-w-0 flex-1">
                    <span className="text-[11px] sm:text-[11.5px] font-black block leading-snug text-slate-900 dark:text-white">
                      {isFa ? 'نمونه‌برداری و آزمون‌های استاندارد' : 'Standard Sampling'}
                    </span>
                    <span className="text-[10px] text-teal-700 dark:text-cyan-300 font-bold block mt-0.5">
                      {isFa ? 'از بتن تا مصالح' : 'Concrete to Aggregates'}
                    </span>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-[#00c49f] shrink-0 ms-1" />
                </div>
              </div>

              {/* Subtitle Description */}
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-200 leading-relaxed font-medium max-w-xl">
                {isFa 
                  ? 'ارائه خدمات تخصصی کنترل کیفی بتن، نمونه‌برداری کارگاهی، آزمون‌های مقاومت فشاری و خمش، چکش اشمیت و غیرمخرب بتن سخت‌شده، تحت نظارت مهندسین مجرب و تجهیزات کالیبره تمام‌اتوماتیک.'
                  : 'Delivering certified concrete quality control, field sampling, compressive strength tests, Schmidt hammer, and NDT diagnostic testing with calibrated automated machinery.'}
              </p>

              {/* High-Contrast Action Buttons: Mint Green CTA + Portal Login + Hotline */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 w-full sm:w-auto">
                <button
                  id="btn-hero-order"
                  onClick={onOpenTestRequest}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#00c49f] hover:bg-[#00b08e] text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2.5 transition active:scale-95 cursor-pointer group border border-emerald-300 min-h-[48px]"
                >
                  <span>{isFa ? 'ثبت درخواست خدمات و مشاوره' : 'Submit Service Request'}</span>
                  <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 group-hover:-translate-x-1 transition-transform" />
                </button>

                <button
                  id="btn-hero-login"
                  onClick={onOpenLogin}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-[#0a2e42] dark:hover:bg-[#0f3d54] text-white font-bold text-sm shadow-md border border-slate-700 dark:border-cyan-400/40 flex items-center justify-center gap-2.5 transition active:scale-95 cursor-pointer min-h-[48px]"
                >
                  <LogIn className="w-4 h-4 text-cyan-300" />
                  <span>{isFa ? 'ورود به سامانه' : 'Portal Login'}</span>
                </button>

                <a
                  href={`tel:${LAB_INFO.phoneRaw}`}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-full bg-white dark:bg-[#062436] hover:bg-slate-100 dark:hover:bg-[#083344] text-slate-800 dark:text-cyan-200 font-bold text-sm shadow-xs border border-slate-200 dark:border-cyan-500/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer min-h-[48px]"
                >
                  <Phone className="w-4 h-4 text-teal-600 dark:text-[#00c49f]" />
                  <span className="font-mono" dir="ltr">{LAB_INFO.phone}</span>
                </a>
              </div>
            </motion.div>

            {/* Left side in RTL (Concrete Strength Growth Curve Chart Widget) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="lg:col-span-5 flex justify-center lg:justify-start"
            >
              <ConcreteStrengthChartWidget isFa={isFa} isDarkMode={isDarkMode} />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. FIVE-COLUMN DISTINCT BENEFIT STRIP (Exactly matching 2.png) */}
      {/* ========================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section id="section-benefits" className="relative z-20">
          <div className="bg-white dark:bg-[#062436] rounded-3xl border border-slate-200/90 dark:border-cyan-500/20 shadow-xl p-4 sm:p-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 divide-slate-100 dark:divide-cyan-900/40 transition-colors">
            
            {/* Item 1: پشتیبانی کامل (Far Right in RTL) */}
            <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/50 sm:bg-transparent dark:bg-[#082a3c]/30 sm:dark:bg-transparent">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0f7fa] dark:bg-[#093547] text-[#00b4d8] dark:text-[#2dd4bf] flex items-center justify-center mb-2 sm:mb-3 shadow-xs">
                <Star className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'پشتیبانی کامل' : 'Full Support'}
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'در تمام مراحل' : 'At every project phase'}
              </p>
            </div>

            {/* Item 2: تیم متخصص */}
            <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/50 sm:bg-transparent dark:bg-[#082a3c]/30 sm:dark:bg-transparent">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0f7fa] dark:bg-[#093547] text-[#00b4d8] dark:text-[#2dd4bf] flex items-center justify-center mb-2 sm:mb-3 shadow-xs">
                <Users className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'تیم متخصص' : 'Expert Civil Team'}
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'و با تجربه' : 'Experienced certified engineers'}
              </p>
            </div>

            {/* Item 3: تجهیزات مدرن (Center) */}
            <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/50 sm:bg-transparent dark:bg-[#082a3c]/30 sm:dark:bg-transparent">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0f7fa] dark:bg-[#093547] text-[#00b4d8] dark:text-[#2dd4bf] flex items-center justify-center mb-2 sm:mb-3 shadow-xs">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'تجهیزات مدرن' : 'Modern Equipment'}
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'و کالیبره استاندارد' : 'Fully calibrated & automated'}
              </p>
            </div>

            {/* Item 4: تحویل سریع نتایج */}
            <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/50 sm:bg-transparent dark:bg-[#082a3c]/30 sm:dark:bg-transparent">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0f7fa] dark:bg-[#093547] text-[#00b4d8] dark:text-[#2dd4bf] flex items-center justify-center mb-2 sm:mb-3 shadow-xs">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'تحویل سریع نتایج' : 'Fast Result Delivery'}
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'در کمترین زمان' : 'In the shortest time possible'}
              </p>
            </div>

            {/* Item 5: دقت و صحت بالا (Far Left in RTL) - spans 2 cols on mobile */}
            <div className="col-span-2 sm:col-span-1 flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/50 sm:bg-transparent dark:bg-[#082a3c]/30 sm:dark:bg-transparent">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#e0f7fa] dark:bg-[#093547] text-[#00b4d8] dark:text-[#2dd4bf] flex items-center justify-center mb-2 sm:mb-3 shadow-xs">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'دقت و صحت بالا' : 'High Precision & Accuracy'}
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'به همراه گزارش معتبر' : 'With verified engineering report'}
              </p>
            </div>

          </div>
        </section>
      </div>

      {/* Main Content Sections Wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">


      {/* ========================================================= */}
      {/* 3. SERVICES SECTION WITH USER'S OFFICIAL SCOPE CLAUSES    */}
      {/* ========================================================= */}
      <section id="section-services" className="space-y-8 pt-4">
        
        {/* Main 2-Column Section Layout matching modern bento box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Right Column in RTL: Scope Text and Official Clauses */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-8 p-8 sm:p-10 bg-white dark:bg-[#062436] rounded-3xl border border-slate-200/90 dark:border-cyan-500/20 shadow-md transition-colors">
            
            <div className="space-y-4 text-start">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-600 dark:text-[#00d2a0] uppercase tracking-wider">
                  {isFa ? '— خدمات تخصصی' : '— Specialized Services'}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                {isFa 
                  ? 'خدمات آزمایشگاهی و کنترل کیفی بتن' 
                  : 'Concrete Testing & Quality Services'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {isFa ? 'انجام کلیه آزمون‌های مکانیکی، مخرب و غیرمخرب بتن با بالاترین دقت توسط مهندسین مجرب و پیشرفته‌ترین تجهیزات آزمایشگاهی.' : 'Performing all destructive and non-destructive concrete tests with high precision.'}
              </p>
            </div>

            {/* Official Clauses - Redesigned as clean list */}
            <div className="space-y-5">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] font-mono text-sm font-black flex items-center justify-center shrink-0 border border-teal-200 dark:border-cyan-500/30 group-hover:scale-110 transition-transform">
                  {isFa ? '۱' : '1'}
                </div>
                <div className="pt-0.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isFa ? 'تواتر نمونه‌برداری از بتن تازه' : 'Fresh Concrete Sampling Frequency'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {isFa ? 'مطابق با آیین‌نامه و مبحث نهم مقررات ملی ساختمان و استانداردهای ملی' : 'Compliant with national building codes and standard regulations'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-[#083344] text-cyan-600 dark:text-cyan-300 font-mono text-sm font-black flex items-center justify-center shrink-0 border border-cyan-200 dark:border-cyan-500/30 group-hover:scale-110 transition-transform">
                  {isFa ? '۲' : '2'}
                </div>
                <div className="pt-0.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isFa ? 'عمل‌آوری استاندارد و آزمون مقاومت' : 'Curing & Compressive Strength Tests'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {isFa ? 'ارائه نتایج دقیق مقاومت فشاری ۷ روزه، ۲۸ روزه و ۹۰ روزه با جک دیجیتال' : 'Accurate 7-day, 28-day, and 90-day compressive strength reports'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#083344] text-emerald-600 dark:text-[#00d2a0] font-mono text-sm font-black flex items-center justify-center shrink-0 border border-emerald-200 dark:border-cyan-500/30 group-hover:scale-110 transition-transform">
                  {isFa ? '۳' : '3'}
                </div>
                <div className="pt-0.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isFa ? 'تست‌های غیرمخرب و کرگیری (مغزه‌گیری)' : 'NDT & Diamond Core Drilling'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {isFa ? 'نمونه‌برداری و آزمون مغزه بتن سخت‌شده در محل پروژه و اسکن آرماتور' : 'In-situ hardened concrete core extraction and ultrasonic testing'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onOpenTestRequest}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#00bfa5] to-teal-500 hover:from-[#00a892] hover:to-teal-600 dark:from-[#00d2a0] dark:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-teal-500/20 cursor-pointer group"
              >
                <span>{isFa ? 'ثبت درخواست خدمات و مشاوره' : 'Request Services & Consultation'}</span>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

          {/* Left Column in RTL: Bento Box Visuals */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Bento Card 1 */}
            <div className="sm:col-span-2 rounded-3xl overflow-hidden bg-slate-100 dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-sm relative group min-h-[260px] sm:h-64">
              <img 
                src={LAB_IMAGES.cubesBench} 
                alt="نمونه‌های مکعبی بتن آماده آزمایش مقاومت در آزمایشگاه" 
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#041d2d]/95 via-[#041d2d]/50 to-transparent" />
              
              <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#00d2a0]/20 text-[#00d2a0] border border-[#00d2a0]/30 backdrop-blur-md mb-2 sm:mb-3 inline-block">
                    {isFa ? 'آزمایش بتن' : 'Concrete Testing'}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white">{isFa ? 'مقاومت فشاری، کششی و خمشی' : 'Compressive & Flexural Strength'}</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm">{isFa ? 'بررسی دقیق رفتار بتن در شرایط بارگذاری استاندارد' : 'Precise analysis of concrete behavior under load'}</p>
                </div>
                <button 
                  onClick={() => {
                    setSimulationSubTab('press');
                    scrollTo('section-simulations');
                  }}
                  className="w-full sm:w-auto px-4 h-10 rounded-full bg-white/20 hover:bg-[#00d2a0] hover:text-slate-950 text-white backdrop-blur-md flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer shrink-0 font-bold text-[11px] min-h-[40px]"
                >
                  <span>{isFa ? 'شبیه‌سازهای سه‌بعدی' : '3D Simulators'}</span>
                  <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </button>
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-sm p-6 flex flex-col justify-between group hover:border-teal-500/50 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] flex items-center justify-center mb-4 border border-teal-200 dark:border-cyan-500/30">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{isFa ? 'گزارش و مستندات معتبر' : 'Certified Test Reports'}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isFa ? 'ارائه گزارش‌های دقیق و معتبر با مهر و امضای رسمی مدیر فنی و کد رهگیری اختصاصی.' : 'Issuance of accredited reports with engineering stamp and QR code.'}
                </p>
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-teal-900 to-slate-900 dark:from-[#041d2d] dark:to-[#083344] border border-teal-500/30 dark:border-cyan-500/20 shadow-sm relative group">
              <img 
                src={LAB_IMAGES.cubePress} 
                alt="جک هیدرولیک تمام دیجیتال آزمایشگاه بتن جهان بین" 
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-30 mix-blend-overlay"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-teal-950/80 dark:from-[#041d2d]/95 dark:to-[#083344]/90" />
              
              <div className="relative p-6 h-full flex flex-col justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm text-cyan-300 flex items-center justify-center mb-4 border border-white/10">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">{isFa ? 'تجهیزات تمام اتوماتیک' : 'Automated Equipment'}</h3>
                  <p className="text-xs text-cyan-100/80 leading-relaxed">
                    {isFa ? 'بهره‌گیری از جک‌های هیدرولیک پیشرفته متصل به سیستم پردازش هوش مصنوعی.' : 'Advanced hydraulic presses connected to AI processing.'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* ========================================================= */}
      {/* 4. PROCESS WORKFLOW (FORMAL ENGINEERING SERVICES WORKFLOW)  */}
      {/* ========================================================= */}
      <section id="section-process-workflow" className="px-2 sm:px-4">
        <div className="rounded-3xl bg-white dark:bg-[#062436] border border-slate-200/90 dark:border-cyan-500/20 shadow-md overflow-hidden p-8 sm:p-12 transition-colors">
          
          <div className="mb-12 text-start">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-8 h-[2px] bg-[#00d2a0] rounded-full" />
              <span className="text-xs font-bold text-teal-600 dark:text-cyan-400 uppercase tracking-widest shrink-0">
                {isFa ? 'فرآیند کنترل کیفیت' : 'Quality Control Workflow'}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {isFa ? 'مراحل آزمون و کنترل کیفیت' : 'Testing & Quality Process'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 max-w-2xl font-medium leading-relaxed">
              {isFa 
                ? 'از ثبت درخواست تا نمونه‌برداری، آزمون و صدور شیت رسمی نتایج در کوتاه‌ترین زمان.' 
                : 'From request to certified sampling, standard testing, and official report issuance.'}
            </p>
          </div>

          <div className="relative flex flex-col sm:flex-row-reverse items-start justify-between gap-10 sm:gap-4 w-full max-w-5xl mx-auto">
            
            {/* Connecting Line (Desktop) with Mint & Cyan Gradient */}
            <div className="hidden sm:block absolute top-10 start-16 end-16 h-[2px] bg-gradient-to-l from-[#00d2a0] via-teal-400 to-cyan-400 opacity-40 -z-10" />
            
            {/* Step 1: ثبت درخواست */}
            <div className="relative flex flex-col items-center text-center group w-full sm:w-1/4">
              <div className="w-20 h-20 rounded-2xl bg-teal-50 dark:bg-[#083344] border border-teal-200 dark:border-cyan-400/30 flex items-center justify-center text-[#00bfa5] dark:text-[#2dd4bf] mb-5 shadow-sm group-hover:-translate-y-2 group-hover:shadow-md group-hover:shadow-teal-500/20 transition-all relative">
                <FileCheck className="w-8 h-8" />
                <div className="absolute -top-3 -end-3 w-8 h-8 rounded-xl bg-[#00d2a0] text-slate-950 text-xs font-black flex items-center justify-center shadow-sm border border-emerald-200">
                  ۱
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                {isFa ? 'ثبت درخواست' : 'Registration'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium px-2 leading-relaxed">
                {isFa 
                  ? 'ثبت آنلاین پروژه، تعیین رده مقاومتی و هماهنگی زمان بتن‌ریزی' 
                  : 'Project data intake, concrete grade assignment, and scheduling.'}
              </p>
            </div>

            {/* Step 2: نمونه‌برداری کارگاهی */}
            <div className="relative flex flex-col items-center text-center group w-full sm:w-1/4">
              <div className="w-20 h-20 rounded-2xl bg-cyan-50 dark:bg-[#083344] border border-cyan-200 dark:border-cyan-400/30 flex items-center justify-center text-cyan-600 dark:text-cyan-300 mb-5 shadow-sm group-hover:-translate-y-2 group-hover:shadow-md group-hover:shadow-cyan-500/20 transition-all relative">
                <Truck className="w-8 h-8" />
                <div className="absolute -top-3 -end-3 w-8 h-8 rounded-xl bg-cyan-500 text-white text-xs font-black flex items-center justify-center shadow-sm border border-cyan-300">
                  ۲
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                {isFa ? 'نمونه‌برداری کارگاهی' : 'Certified Sampling'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium px-2 leading-relaxed">
                {isFa 
                  ? 'اعزام کارشناس پای کار، تست اسلامپ، کنترل دما و قالب‌گیری استاندارد' 
                  : 'On-site slump test, temperature monitoring, and ASTM mold sampling.'}
              </p>
            </div>

            {/* Step 3: عمل‌آوری و آزمون فشاری */}
            <div className="relative flex flex-col items-center text-center group w-full sm:w-1/4">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-[#083344] border border-emerald-200 dark:border-cyan-400/30 flex items-center justify-center text-emerald-600 dark:text-[#00d2a0] mb-5 shadow-sm group-hover:-translate-y-2 group-hover:shadow-md group-hover:shadow-emerald-500/20 transition-all relative">
                <FlaskConical className="w-8 h-8" />
                <div className="absolute -top-3 -end-3 w-8 h-8 rounded-xl bg-[#00d2a0] text-slate-950 text-xs font-black flex items-center justify-center shadow-sm border border-emerald-200">
                  ۳
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                {isFa ? 'عمل‌آوری و آزمون فشاری' : 'Curing & Testing'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium px-2 leading-relaxed">
                {isFa 
                  ? 'نگهداری در حوضچه استاندارد و تست مقاومت با جک دیجیتال' 
                  : 'Standard tank curing and compressive tests via calibrated press.'}
              </p>
            </div>

            {/* Step 4: صدور شیت رسمی */}
            <div className="relative flex flex-col items-center text-center group w-full sm:w-1/4">
              <div className="w-20 h-20 rounded-2xl bg-teal-50 dark:bg-[#083344] border border-teal-200 dark:border-cyan-400/30 flex items-center justify-center text-[#00bfa5] dark:text-cyan-300 mb-5 shadow-sm group-hover:-translate-y-2 group-hover:shadow-md group-hover:shadow-teal-500/20 transition-all relative">
                <FileText className="w-8 h-8" />
                <div className="absolute -top-3 -end-3 w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center shadow-sm border border-cyan-200">
                  ۴
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                {isFa ? 'صدور شیت رسمی' : 'Official Report'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium px-2 leading-relaxed">
                {isFa 
                  ? 'تایید مدیر فنی و دریافت فوری گزارش با QR کد رهگیری' 
                  : 'Technical approval and instant report issuance with QR tracking.'}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. ABOUT US SECTION                                        */}
      {/* ========================================================= */}
      <section id="section-process" className="space-y-6 pt-4">
        <div className="bg-white dark:bg-[#062436] rounded-3xl border border-slate-200/90 dark:border-cyan-500/20 p-8 sm:p-12 shadow-md text-start max-w-4xl mx-auto transition-colors">
          
          {/* Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="w-8 h-[2px] bg-[#00d2a0] rounded-full" />
              <span className="text-xs font-bold text-teal-600 dark:text-[#00d2a0] uppercase tracking-widest">
                {isFa ? 'درباره آزمایشگاه' : 'About the Lab'}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {isFa ? 'شرکت آزما بتن پایش خاک و پی جهان بین' : 'Azma Beton Payesh Khak o Pey Jahan Bin Laboratory'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-loose font-medium text-justify">
              {isFa 
                ? 'شرکت آزما بتن پایش خاک و پی جهان بین با بهره‌گیری از کادر مجرب مهندسی عمران، پیشرفته‌ترین تجهیزات کالیبره شده را منحصراً جهت ارزیابی مقاومت، اسلامپ، آزمایش‌های غیرمخرب و کنترل کیفیت تخصصی بتن به کار گرفته است. رسالت ما ارتقای ایمنی و پایداری سازه‌های بتنی از طریق ارائه گزارش‌های دقیق، مستند و منطبق بر استانداردهای ملی و بین‌المللی در سریعترین زمان ممکن است.' 
                : 'Azma Beton Payesh Khak o Pey Jahan Bin Laboratory, utilizing expert civil engineers and advanced calibrated equipment, is dedicated exclusively to concrete quality control and compressive strength assessment. Our mission is to enhance project safety through accurate, standard-compliant reporting.'}
            </p>
          </div>
          
        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. INTERACTIVE 3D SIMULATION LAB (GALLERY)                 */}
      {/* ========================================================= */}
      <section id="section-simulations" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-start">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] text-xs font-bold border border-teal-200 dark:border-cyan-500/30">
              <Zap className="w-3.5 h-3.5" />
              <span>{isFa ? 'شبیه‌ساز سه‌بعدی ایستگاه‌های آزمایشگاهی' : '3D Virtual Lab Simulator'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {isFa ? 'تجهیزات و شبیه‌سازهای سه‌بعدی آزمایشگاه' : '3D Concrete Testing Stations'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFa 
                ? 'نمونه‌های مکعبی را تحت فشار قرار دهید، روانی اسلامپ را بسنجید یا پالس اولتراسونیک را شبیه‌سازی کنید'
                : 'Crush standard concrete cubes, measure Abrams slump workability, or simulate ultrasonic UPV pulses.'}
            </p>
          </div>

          {/* Sub Tab Switcher */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start bg-white dark:bg-[#062436] p-1.5 rounded-2xl border border-slate-200/90 dark:border-cyan-500/20 shadow-2xs gap-1 overflow-x-auto">
            <button
              id="btn-sim-press"
              onClick={() => setSimulationSubTab('press')}
              className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[40px] ${
                simulationSubTab === 'press' 
                  ? 'bg-gradient-to-r from-[#00d2a0] to-teal-400 text-slate-950 font-black shadow-md shadow-teal-500/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 shrink-0" />
              <span>{isFa ? 'جک فشاری' : 'Cube Press'}</span>
            </button>

            <button
              id="btn-sim-slump"
              onClick={() => setSimulationSubTab('slump')}
              className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[40px] ${
                simulationSubTab === 'slump' 
                  ? 'bg-gradient-to-r from-[#00d2a0] to-teal-400 text-slate-950 font-black shadow-md shadow-teal-500/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>{isFa ? 'مخروط اسلامپ' : 'Slump Cone'}</span>
            </button>

            <button
              id="btn-sim-ndt"
              onClick={() => setSimulationSubTab('ndt')}
              className={`flex-1 sm:flex-initial text-center justify-center px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[40px] ${
                simulationSubTab === 'ndt' 
                  ? 'bg-gradient-to-r from-[#00d2a0] to-teal-400 text-slate-950 font-black shadow-md shadow-teal-500/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>{isFa ? 'اولتراسونیک NDT' : 'Concrete UPV'}</span>
            </button>
          </div>
        </div>

        {/* 3D Visualizer Canvas Container */}
        <div className="rounded-3xl overflow-hidden shadow-xl border border-slate-200/90 dark:border-cyan-500/20 bg-white dark:bg-[#062436]">
          {simulationSubTab === 'press' && <ThreeConcretePress language={language} />}
          {simulationSubTab === 'slump' && <ThreeSlumpVisualizer language={language} />}
          {simulationSubTab === 'ndt' && <ThreeNdtVisualizer language={language} />}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. CERTIFICATE VERIFIER WIDGET ONLY                       */}
      {/* ========================================================= */}
      <section id="section-tools" className="max-w-3xl mx-auto w-full pt-4">
        <CertificateVerifierWidget language={language} />
      </section>

      {/* ========================================================= */}
      {/* 8. WORLD-CLASS CONTACT US SECTION                          */}
      {/* ========================================================= */}
      <section id="section-contact" className="space-y-8 pt-4">
        
        {/* Top Header Wide Panoramic Banner */}
        <div className="relative rounded-[32px] overflow-hidden border border-slate-200/90 dark:border-cyan-500/30 shadow-2xl transition-all">
          {/* Panoramic Background Image matching Hero Style */}
          <img 
            src={LAB_IMAGES.cubeFracture} 
            alt="نمونه بتن و تجهیزات کنترل کیفیت آزمایشگاه آزما بتن" 
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-center transform scale-100 opacity-25 dark:opacity-40 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />

          {/* Ambient Lighting Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-teal-50/70 dark:from-[#041d2d] dark:via-[#062436]/95 dark:to-[#083344]/80 rtl:bg-gradient-to-l rtl:from-white rtl:via-white/95 rtl:to-teal-50/70 dark:rtl:from-[#041d2d] dark:rtl:via-[#062436]/95 dark:rtl:to-[#083344]/80 pointer-events-none" />
          
          {/* Content Container */}
          <div className="relative z-10 p-6 sm:p-10 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Right side in RTL (Text & Heading) */}
              <div className="lg:col-span-8 space-y-4 text-start">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 dark:bg-[#083344] text-[#00a383] dark:text-[#00c49f] text-xs font-bold border border-teal-200/80 dark:border-cyan-400/30 shadow-xs backdrop-blur-md">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تماس با ما' : 'Contact Us'}</span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {isFa ? (
                    <>
                      با ما در <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-[#00c49f] dark:to-cyan-300">ارتباط</span> باشید
                    </>
                  ) : (
                    <>
                      Get in <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-[#00c49f] dark:to-cyan-300">Touch</span> with Us
                    </>
                  )}
                </h2>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-medium">
                  {isFa 
                    ? 'برای دریافت مشاوره فنی، استعلام قیمت آزمون‌ها، ثبت درخواست خدمات و مشاوره یا هماهنگی نمونه‌برداری کارگاهی با کارشناسان و مهندسان ما در ارتباط باشید.' 
                    : 'For technical consultation, service requests, or project scheduling, contact our engineering office.'}
                </p>
              </div>

            {/* Left side in RTL (Photo banner with calligraphy) */}
            <div className="lg:col-span-4 flex flex-col justify-center items-start lg:items-end">
              <div className="w-full sm:w-auto p-5 rounded-2xl bg-white/80 dark:bg-[#082a3c]/85 border border-slate-200 dark:border-cyan-400/30 shadow-md backdrop-blur-md text-start lg:text-end space-y-1.5">
              
                <div className="flex items-center lg:justify-end gap-2">
                  <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">کیفیت،</span>
                  <span className="text-base sm:text-lg font-black text-teal-600 dark:text-[#00c49f]">اعتماد،</span>
                  <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">آزمایش دقیق</span>
                </div>
                
                <span className="text-[11px] text-cyan-200/90 font-medium">
                  {isFa ? 'آزمایشگاه آزما بتن پایش خاک و پی جهان بین شهرکرد' : 'Azma Beton Payesh Khak o Pey Jahan Bin Lab - Shahrekord'}
                </span>
              </div>
            </div>

          </div>
        </div>

        </div>

        {/* The 2 Main Balanced Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================= */}
          {/* COLUMN 1 (Right in RTL): Map & Lab Building Visuals     */}
          {/* ======================================================= */}
          <div className="lg:col-span-6 space-y-5">
            
            {/* Header: موقعیت ما در نقشه */}
            <div className="flex items-center gap-2.5 text-start px-1">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] flex items-center justify-center border border-teal-200 dark:border-cyan-500/30">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isFa ? 'موقعیت مکانی آزمایشگاه' : 'Laboratory Location'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {isFa ? 'دسترسی سریع و آسان در مرکز استان' : 'Easy access located in the province center'}
                </p>
              </div>
            </div>

            {/* Box 1: Stylized Google Map Preview Card */}
            <div 
              className="relative rounded-3xl overflow-hidden bg-slate-100 dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-md h-64 sm:h-72 group transition-all"
            >
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3298.530377063857!2d50.86298!3d32.329447!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzLCsDE5JzQ2LjAiTiA1MMKwNTEnNDYuNyJF!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full"
              ></iframe>
              {/* Clickable overlay to open the modal version */}
              <div 
                onClick={() => setIsLocationModalOpen(true)}
                className="absolute inset-0 z-10 cursor-pointer bg-slate-950/0 hover:bg-slate-950/10 transition-colors flex items-end p-4"
                title={isFa ? 'بزرگنمایی نقشه' : 'Expand map'}
              >
                <span className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-[#041d2d]/90 backdrop-blur-md text-xs font-bold text-slate-800 dark:text-slate-200 shadow-md flex items-center gap-1.5 border border-slate-200/50 dark:border-cyan-500/30">
                  <MapPin className="w-3.5 h-3.5 text-[#00bfa5] dark:text-[#00d2a0]" />
                  {isFa ? 'مشاهده نقشه کامل و مسیریابی' : 'View Full Map'}
                </span>
              </div>
            </div>

            {/* Box 2: Laboratory Building Photo */}
            <div 
              onClick={() => setIsLocationModalOpen(true)}
              className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200/80 dark:border-cyan-500/20 h-44 sm:h-48 group cursor-pointer"
            >
              <img 
                src={LAB_IMAGES.building} 
                alt="نمای ساختمان مجتمع تخصصی آزمایشگاه بتن و خاک جهان بین شهرکرد" 
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#041d2d]/90 via-[#041d2d]/40 to-transparent" />
              
              {/* Bottom text overlay */}
              <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2 text-start">
                <div className="space-y-1 text-white">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white drop-shadow-sm">
                      {isFa ? 'مجتمع تخصصی آزما بتن پایش خاک و پی جهان بین' : 'Azma Beton Payesh Khak o Pey Jahan Bin Facility'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 drop-shadow-sm line-clamp-1">
                    {LAB_INFO.address}
                  </p>
                </div>

                {/* Round Arrow Button */}
                <div className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm border border-white/40">
                  <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                </div>
              </div>

            </div>

          </div>

          {/* ======================================================= */}
          {/* COLUMN 2 (Left in RTL): Direct Contact Cards & CTA      */}
          {/* ======================================================= */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Header: راه‌های ارتباطی مستقیم */}
            <div className="flex items-center gap-2.5 text-start px-1">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#2dd4bf] flex items-center justify-center border border-teal-200 dark:border-cyan-500/30">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isFa ? 'اطلاعات تماس مستقیم' : 'Direct Contact Info'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {isFa ? 'پاسخگویی سریع توسط کارشناسان فنی' : 'Fast technical support by engineers'}
                </p>
              </div>
            </div>

            {/* Grid 2x2 of Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card 1: Phone & Management */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#062436] border border-teal-500/30 dark:border-cyan-500/30 shadow-sm hover:shadow-md hover:border-teal-400 transition flex flex-col justify-between text-start group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                      {isFa ? 'مدیریت و تلفن تماس مستقیم' : 'Management & Hotline'}
                    </span>
                    <span className="text-xs font-black text-[#00bfa5] dark:text-[#00d2a0] mt-0.5 block">
                      {LAB_INFO.manager}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-[#00d2a0] flex items-center justify-center shrink-0 border border-teal-200 dark:border-cyan-500/40">
                    <Phone className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <a 
                    href={`tel:${LAB_INFO.phoneRaw}`} 
                    className="text-lg font-black font-mono text-[#00bfa5] dark:text-cyan-300 hover:text-teal-400 transition block" 
                    dir="ltr"
                  >
                    {LAB_INFO.phone}
                  </a>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold pt-1">
                    {isFa ? 'پاسخگویی و مشاوره فنی مهندسی مستقیم' : 'Direct Technical Consultation'}
                  </span>
                </div>
              </div>

              {/* Card 2: Address */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-sm hover:shadow-md hover:border-teal-500/50 transition flex flex-col justify-between text-start group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isFa ? 'آدرس آزمایشگاه' : 'Address'}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {LAB_INFO.address}
                  </p>
                  <button 
                    onClick={() => setIsLocationModalOpen(true)}
                    className="text-[11px] font-bold text-teal-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer pt-2"
                  >
                    <span>{isFa ? 'مشاهده روی نقشه' : 'View on map'}</span>
                    <ArrowLeft className="w-3 h-3 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                </div>
              </div>

              {/* Card 3: Official Website */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-sm hover:shadow-md hover:border-teal-500/50 transition flex flex-col justify-between text-start group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isFa ? 'وب‌سایت رسمی' : 'Official Website'}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <a 
                    href="https://www.azmajahanbin.ir" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-black font-mono text-teal-600 dark:text-cyan-300 hover:underline transition flex items-center gap-1.5"
                    dir="ltr"
                  >
                    <span>www.azmajahanbin.ir</span>
                  </a>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block pt-0.5">
                    {isFa ? 'سامانه رسمی گزارش‌ها و خدمات آزمایشگاهی' : 'Official Laboratory Portal & Services'}
                  </span>
                </div>
              </div>

              {/* Card 4: Working Hours */}
              <div className="p-5 rounded-3xl bg-white dark:bg-[#062436] border border-slate-200/80 dark:border-cyan-500/20 shadow-sm hover:shadow-md hover:border-teal-500/50 transition flex flex-col justify-between text-start group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isFa ? 'ساعات کاری پذیرش' : 'Working Hours'}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#083344] text-[#00bfa5] dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {isFa ? 'شنبه تا چهارشنبه: ۷:۳۰ الی ۱۷:۳۰' : 'Sat - Wed: 07:30 - 17:30'}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                    {isFa ? 'پنجشنبه‌ها: ۷:۳۰ الی ۱۳:۰۰' : 'Thu: 07:30 - 13:00'}
                  </p>
                </div>
              </div>

            </div>

            {/* Direct CTA Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-600 via-cyan-700 to-blue-700 dark:from-[#041d2d] dark:via-[#083344] dark:to-[#0e4459] border border-teal-500/30 dark:border-cyan-400/30 text-white shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-start transition-colors">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">
                  {isFa ? 'ثبت مستقیم درخواست آزمایش بتن' : 'Submit Test Request Online'}
                </h4>
                <p className="text-xs text-cyan-50 dark:text-cyan-100 max-w-md leading-relaxed">
                  {isFa 
                    ? 'مشخصات پروژه و شماره تماس خود را ثبت نمایید تا بلافاصله در سامانه ثبت شده و کارشناسان آزمایشگاه با شما تماس بگیرند.'
                    : 'Submit your project details and phone number to arrange immediate sample collection.'}
                </p>
              </div>

              <button
                onClick={onOpenTestRequest}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-teal-50 dark:bg-gradient-to-r dark:from-[#00d2a0] dark:to-teal-400 dark:hover:from-[#00bf91] dark:hover:to-teal-300 text-slate-900 dark:text-slate-950 font-black text-xs shadow-lg shadow-black/10 dark:shadow-teal-500/20 transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shrink-0 border border-white/40 dark:border-teal-300/40 min-h-[44px]"
              >
                <span>{isFa ? 'ورود به صفحه ثبت درخواست' : 'Go to Request Page'}</span>
                <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-teal-700 dark:text-slate-950" />
              </button>
            </div>

          </div>

        </div>

      </section>

      {/* ========================================================= */}
      {/* FLOATING SCROLL TO TOP BUTTON                             */}
      {/* ========================================================= */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 sm:bottom-6 end-4 sm:end-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#00d2a0] hover:bg-[#00bf91] text-slate-950 shadow-2xl shadow-teal-500/40 flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer animate-in fade-in"
          title={isFa ? 'رفتن به بالای صفحه' : 'Scroll to top'}
        >
          <ArrowUp className="w-5 h-5 font-black" />
        </button>
      )}

      {/* ========================================================= */}
      {/* MOBILE STICKY QUICK BAR FOR INSTANT ACCESS & LOGIN        */}
      {/* ========================================================= */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#041d2d]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-cyan-500/25 px-3 py-2 flex items-center justify-around gap-2 shadow-[0_-8px_20px_rgba(0,0,0,0.15)] pb-safe">
        {/* Quick Login Button */}
        <button
          id="btn-mobile-quick-login"
          onClick={onOpenLogin}
          className="flex-1 py-2 px-2.5 rounded-xl bg-slate-900 dark:bg-[#0a2e42] text-cyan-300 border border-cyan-500/40 flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 transition-all shadow-xs min-h-[42px]"
        >
          <LogIn className="w-4 h-4 text-[#00c49f] shrink-0" />
          <span>{isFa ? 'ورود به سامانه' : 'Login'}</span>
        </button>

        {/* Quick Test Request Button */}
        <button
          id="btn-mobile-quick-order"
          onClick={onOpenTestRequest}
          className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-[#00c49f] to-teal-400 text-slate-950 border border-emerald-300 flex items-center justify-center gap-1.5 text-xs font-black active:scale-95 transition-all shadow-xs min-h-[42px]"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>{isFa ? 'ثبت درخواست' : 'Request'}</span>
        </button>

        {/* Direct Phone Call */}
        <a
          href={`tel:${LAB_INFO.phoneRaw}`}
          className="p-2.5 rounded-xl bg-teal-50 dark:bg-[#083344] text-teal-700 dark:text-[#00c49f] border border-teal-200 dark:border-cyan-500/30 flex items-center justify-center active:scale-95 transition-all min-h-[42px] min-w-[42px]"
          title={isFa ? 'تماس تلفنی' : 'Call'}
        >
          <Phone className="w-4 h-4" />
        </a>
      </div>

      {/* ========================================================= */}
      {/* MODAL: PUBLIC TEST REQUEST WIZARD                         */}
      {/* ========================================================= */}
      <TestRequestWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        language={language}
      />

      {/* ========================================================= */}
      {/* MODAL: LAB INTRODUCTION VIDEO                             */}
      {/* ========================================================= */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#062436] rounded-3xl border border-slate-200 dark:border-cyan-500/30 overflow-hidden shadow-2xl text-slate-900 dark:text-white space-y-4 p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-cyan-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-teal-600 dark:text-[#00d2a0]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isFa ? 'معرفی تجهیزات و فرآیند آزمایشگاه آزما بتن پایش خاک و پی جهان بین' : 'Laboratory Facilities & Tour'}
                </h3>
              </div>
              <button 
                onClick={() => setIsVideoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200 dark:border-cyan-500/20">
              <img 
                src={LAB_IMAGES.cubePress} 
                alt="تجهیزات آزمایشگاه بتن" 
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#00d2a0] text-slate-950 flex items-center justify-center shadow-xl shadow-teal-500/30">
                  <Play className="w-7 h-7 fill-current ms-1" />
                </div>
                <p className="text-xs text-white max-w-md font-medium drop-shadow-md">
                  {isFa 
                    ? 'جک هیدرولیکی تمام‌اتوماتیک ۲۰۰۰ kN با لودسل کالیبره، حوضچه عمل‌آوری با دمای کنترل شده ۲۰±۲ درجه و تجهیزات آزمایش‌های غیرمخرب.' 
                    : '2000 kN fully automatic hydraulic press, curing tanks with 20±2°C control, and non-destructive testing equipment.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#083344] dark:hover:bg-[#0d445b] text-white text-xs font-bold border border-transparent dark:border-cyan-400/30 cursor-pointer"
              >
                {isFa ? 'بستن' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: LOCATION & ROUTING MAP                             */}
      {/* ========================================================= */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#062436] rounded-3xl border border-slate-200 dark:border-cyan-500/30 p-6 space-y-4 text-start animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600 dark:text-[#00d2a0]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isFa ? 'موقعیت جغرافیایی آزمایشگاه' : 'Laboratory Geolocation'}
                </h3>
              </div>
              <button 
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#083344] border border-slate-200/80 dark:border-cyan-500/20 text-xs space-y-2">
              <p className="text-slate-500 dark:text-slate-400">{isFa ? 'مختصات دقیق GPS:' : 'GPS Coordinates:'}</p>
              <p className="font-mono font-bold text-teal-600 dark:text-cyan-300 text-sm">
                {LAB_INFO.coordinates.displayText}
              </p>
              <p className="text-slate-800 dark:text-slate-200 pt-1 font-semibold leading-relaxed">
                {LAB_INFO.address}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-cyan-900/40">
                {isFa ? 'تلفن تماس مستقیم:' : 'Direct Phone:'} <a href={`tel:${LAB_INFO.phone}`} className="font-bold text-teal-600 dark:text-[#00d2a0] font-mono" dir="ltr">{LAB_INFO.phone}</a>
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">{isFa ? 'مسیریابی مستقیم و نقشه:' : 'Direct Navigation & Map:'}</span>
              <a
                href={LAB_INFO.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00d2a0] to-teal-400 hover:from-[#00bf91] hover:to-teal-300 text-xs font-black text-center text-slate-950 transition flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 active:scale-95"
              >
                <MapPin className="w-4 h-4" />
                <span>{isFa ? 'مسیریابی در گوگل مپ (Google Maps)' : 'Navigate with Google Maps'}</span>
              </a>
            </div>

            <button
              onClick={() => setIsLocationModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-[#082a3c] hover:bg-slate-800 dark:hover:bg-[#0d3b53] text-white text-xs font-bold border border-transparent dark:border-cyan-500/20 cursor-pointer"
            >
              {isFa ? 'بستن پنجره' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      </div>

      {/* ========================================================= */}
      {/* MODAL: FEATURE BADGE INFO                                 */}
      {/* ========================================================= */}
      {badgeModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#062436] rounded-3xl border border-slate-200 dark:border-cyan-500/30 p-6 space-y-3 text-start animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-[#00d2a0]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {badgeModalData.title}
                </h3>
              </div>
              <button 
                onClick={() => setBadgeModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {badgeModalData.desc}
            </p>
            <div className="pt-2">
              <button
                onClick={() => setBadgeModalData(null)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00d2a0] to-teal-400 hover:from-[#00bf91] hover:to-teal-300 text-slate-950 text-xs font-black cursor-pointer shadow-md shadow-teal-500/20"
              >
                {isFa ? 'بستن' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
