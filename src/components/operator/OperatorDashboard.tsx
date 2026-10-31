import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  TestReport, 
  Customer,
  TechnicianDispatch
} from '../../types';
import { labDb } from '../../services/supabase';
import { translations, Language } from '../../utils/i18n';
import { toPersianDigits, getTodayJalali, formatJalali, parseJalali, addDaysToJalali, jalaliToGregorian, getDaysInJalaliMonth, getJalaliWeekday, WEEKDAYS_FA } from '../../utils/jalali';
import { useModalBack } from '../../hooks/useModalBack';
import { LAB_IMAGES } from '../../assets/images';
import { 
  LayoutDashboard, 
  FlaskConical, 
  Boxes, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Search, 
  Bell, 
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Home,
  Sun,
  Moon,
  Users,
  Menu,
  X,
  Scale,
  Eye,
  PenTool,
  ArrowUpRight,
  ChevronDown,
  Phone,
  UserPlus,
  Plus,
  Sparkles
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { OperatorNewTest } from './OperatorNewTest';
import { OperatorTestsList } from './OperatorTestsList';
import { OperatorReports } from './OperatorReports';
import { OperatorSettingsTab } from './OperatorSettingsTab';
import { OperatorResultModal } from './OperatorResultModal';
import { OperatorSamplesView } from './OperatorSamplesView';
import { OperatorCustomersList } from './OperatorCustomersList';
import { OperatorRequestsTab, isContactLead } from './OperatorRequestsTab';
import { PhotoGalleryViewer } from '../common/PhotoGalleryViewer';
import { PrintCertificate } from '../common/PrintCertificate';
import { CompanyLogo } from '../common/CompanyLogo';
import { navHistory } from '../../services/navigationHistory';
import { 
  QrCode,
  Camera,
  Truck,
  ArrowLeft
} from 'lucide-react';

interface OperatorDashboardProps {
  currentUser: UserProfile;
  language: Language;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  allUsers?: UserProfile[];
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  currentUser,
  language,
  onLogout,
  onNavigateHome,
  onSwitchUser,
  allUsers = [],
  isDarkMode = false,
  onToggleDarkMode
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'new_test' | 'samples' | 'tests' | 'customers' | 'reports' | 'gallery' | 'settings'>(() => {
    const curTab = navHistory.getCurrentTab();
    if (curTab && ['dashboard', 'requests', 'new_test', 'samples', 'tests', 'customers', 'reports', 'gallery', 'settings'].includes(curTab)) {
      return curTab as any;
    }
    return 'dashboard';
  });

  const handleTabChange = (newTab: typeof activeTab) => {
    setActiveTab(newTab);
    setMobileMenuOpen(false);
    if (newTab !== 'dashboard') {
      navHistory.navigateTab(newTab);
    } else {
      navHistory.navigateTab('dashboard');
    }
  };

  useEffect(() => {
    const unsubNav = navHistory.subscribeView((view, meta) => {
      if (view === 'portal') {
        const targetTab = meta?.tab as typeof activeTab | undefined;
        if (targetTab && ['dashboard', 'requests', 'new_test', 'samples', 'tests', 'customers', 'reports', 'gallery', 'settings'].includes(targetTab)) {
          setActiveTab(targetTab);
        } else {
          setActiveTab('dashboard');
        }
      }
    });
    return () => unsubNav();
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sampleTypeFilter, setSampleTypeFilter] = useState<'all' | 'compressive' | 'water' | 'flexural'>('all');
  const [activityTimeframe, setActivityTimeframe] = useState<'week' | 'month'>('week');

  // Modals
  const [selectedForEntry, setSelectedForEntry] = useState<TestReport | null>(null);
  const [selectedForPreview, setSelectedForPreview] = useState<TestReport | null>(null);

  // Hook dialogs to browser Back button (activeTab is a view tab, NOT a modal)
  useModalBack(Boolean(selectedForEntry), () => setSelectedForEntry(null), 'operator-modal-entry');
  useModalBack(Boolean(selectedForPreview), () => setSelectedForPreview(null), 'operator-modal-preview');
  useModalBack(mobileMenuOpen, () => setMobileMenuOpen(false), 'operator-modal-mobile-menu');
  useModalBack(showNotifications, () => setShowNotifications(false), 'operator-modal-notifications');

  // Reactive DB State
  const [reports, setReports] = useState<TestReport[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dispatches, setDispatches] = useState<TechnicianDispatch[]>([]);

  const refreshData = () => {
    setReports(labDb.getReports());
    setCustomers(labDb.getCustomers());
    setDispatches(labDb.getDispatches());
  };

  useEffect(() => {
    refreshData();
    const unsub = labDb.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, []);

  // Separate website contact leads from field technician dispatches
  const contactLeads = dispatches.filter(isContactLead);
  const fieldDispatches = dispatches.filter(d => !isContactLead(d));

  const pendingContactLeads = contactLeads.filter(d => d.status === 'requested');
  const pendingFieldDispatches = fieldDispatches.filter(d => d.status === 'requested');
  const webRequests = pendingContactLeads; // For backwards compatibility

  const todayJalali = formatJalali(getTodayJalali());

  // Real Stats
  const totalTests = reports.length;
  const approvedTests = reports.filter(r => r.status === 'approved').length;
  const pendingTests = reports.filter(r => r.status === 'pending').length;
  const failedTests = reports.filter(r => r.status === 'rejected' || (r.status === 'approved' && !r.isPassed)).length;

  // Real Breakdown for Donut Chart (status categories are mutually exclusive)
  const cubeCount = reports.filter(r => r.moldType === 'cube_150' || !r.moldType).length;
  const cylinderCount = reports.filter(r => r.moldType === 'cylinder_150_300').length;
  const concreteBreakdownAll = [
    { name: 'فشاری مکعبی (۱۵cm)', value: cubeCount, color: '#2563eb' },
    { name: 'فشاری استوانه‌ای (۱۵×۳۰)', value: cylinderCount, color: '#0ea5e9' },
    { name: 'انطباق تایید شده', value: approvedTests, color: '#10b981' },
    { name: 'در حال کیورینگ/بررسی', value: pendingTests, color: '#f59e0b' },
    { name: 'عدم انطباق / رد شده', value: failedTests, color: '#f43f5e' },
  ];
  const concreteBreakdown = concreteBreakdownAll.filter(d => d.value > 0);

  // ---- Real Jalali date helpers for activity aggregation ----
  const toDayIndex = (jy: number, jm: number, jd: number): number => {
    const g = jalaliToGregorian(jy, jm, jd);
    return Math.floor(Date.UTC(g.gy, g.gm - 1, g.gd) / 86400000);
  };
  const todayJOp = getTodayJalali();
  const countInRange = (fromIdx: number, toIdx: number) => {
    let c = 0;
    for (const r of reports) {
      const p = parseJalali(r.samplingDateJalali || '');
      if (!p) continue;
      const idx = toDayIndex(p.jy, p.jm, p.jd);
      if (idx >= fromIdx && idx <= toIdx) c++;
    }
    return c;
  };

  // Dynamic Bar Chart Data based on actual reports and their REAL sampling dates
  const barChartData = activityTimeframe === 'week'
    ? Array.from({ length: 7 }, (_, i) => {
        const j = addDaysToJalali(todayJOp, -(6 - i));
        const idx = toDayIndex(j.jy, j.jm, j.jd);
        const wd = getJalaliWeekday(j.jy, j.jm, j.jd); // 0 = شنبه ... 6 = جمعه
        return { date: WEEKDAYS_FA[wd], count: countInRange(idx, idx) };
      })
    : (() => {
        const daysInMonth = getDaysInJalaliMonth(todayJOp.jy, todayJOp.jm);
        return [1, 8, 15, 22].map((start, wi) => {
          const end = wi === 3 ? daysInMonth : start + 6;
          return {
            date: `هفته ${toPersianDigits(wi + 1)}`,
            count: countInRange(toDayIndex(todayJOp.jy, todayJOp.jm, start), toDayIndex(todayJOp.jy, todayJOp.jm, end)),
          };
        });
      })();

  // Filtered samples for quick dashboard table
  const filteredDashboardSamples = reports.filter(r => {
    if (sampleTypeFilter === 'compressive' && r.moldType !== 'cube_150') return false;
    if (sampleTypeFilter === 'flexural' && r.moldType !== 'cylinder_150_300') return false;
    if (!searchQuery) return true;
    return (
      (r.reportNo || r.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }).slice(0, 5);

  const getCustomerForReport = (report: TestReport) => {
    return customers.find(c => c.id === report.customerId);
  };

  // Check samples due for break tests
  const dueBreakSamples = reports.filter(r => {
    if (r.status === 'approved') return false;
    const parsed = parseJalali(r.samplingDateJalali);
    if (!parsed) return false;
    const d7 = formatJalali(addDaysToJalali(parsed, 7));
    const d28 = formatJalali(addDaysToJalali(parsed, 28));
    return d7 === todayJalali || d28 === todayJalali || !r.breaking7dStrengthMpa;
  });

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar - Right side in RTL */}
      <aside className={`
        bg-[#0a1128] text-white flex-col shadow-2xl shrink-0 h-full z-20 w-64
        ${mobileMenuOpen 
          ? 'fixed inset-y-0 start-0 z-50 flex' 
          : 'hidden'}
        ${isSidebarOpen ? 'lg:flex lg:static' : 'lg:hidden'}
      `}>
        {/* Header: آزما بتن پایش خاک و پی جهان بین */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <CompanyLogo className="w-10 h-10 rounded-xl shrink-0" iconClassName="w-5 h-5 text-white" />
            <div className="overflow-hidden">
              <span className="font-black text-xs tracking-tight block truncate">آزما بتن پایش خاک و پی جهان بین</span>
              <span className="text-[10px] text-blue-400 font-medium">ایستگاه و پنل اپراتور</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card: سارا رضایی - اپراتور آزمایشگاه */}
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-blue-500/40 flex items-center justify-center overflow-hidden shrink-0">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.fullName || 'سارا رضایی')}&background=1e293b&color=38bdf8`} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-sm truncate">{currentUser.fullName || 'سارا رضایی'}</div>
            <div className="text-xs text-slate-400 font-medium">اپراتور آزمایشگاه بتن</div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
          <button 
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>پیشخوان و آمار سریع</span>
          </button>

          <button 
            onClick={() => handleTabChange('requests')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'requests' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>درخواست‌ها و تماس‌های سایت</span>
            </div>
            {pendingContactLeads.length > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500 text-white animate-pulse" title="شماره تماس جدید از وب‌سایت">
                {toPersianDigits(pendingContactLeads.length)} تماس
              </span>
            ) : pendingFieldDispatches.length > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-blue-500 text-white">
                {toPersianDigits(pendingFieldDispatches.length)}
              </span>
            ) : null}
          </button>

          <button 
            onClick={() => handleTabChange('new_test')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'new_test' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <FlaskConical className="w-4 h-4 shrink-0" />
            <span>ثبت پذیرش نمونه بتن</span>
          </button>

          <button 
            onClick={() => handleTabChange('samples')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'samples' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <Boxes className="w-4 h-4 shrink-0" />
              <span>حوضچه کیورینگ و آزمونه‌ها</span>
            </div>
            {dueBreakSamples.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-amber-500 text-slate-900 animate-pulse">
                {toPersianDigits(dueBreakSamples.length)}
              </span>
            )}
          </button>

          <button 
            onClick={() => handleTabChange('tests')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'tests' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <Scale className="w-4 h-4 shrink-0" />
              <span>بانک آزمایش‌ها و شیت‌ها</span>
            </div>
            {pendingTests > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-blue-500 text-white">
                {toPersianDigits(pendingTests)}
              </span>
            )}
          </button>

          <button 
            onClick={() => handleTabChange('customers')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'customers' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" />
              <span>کارفرمایان و قراردادها</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono text-slate-400 bg-slate-800">
              {toPersianDigits(customers.length)}
            </span>
          </button>

          <button 
            onClick={() => handleTabChange('reports')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>گزارشات و خروجی اکسل</span>
          </button>

          <button 
            onClick={() => handleTabChange('gallery')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'gallery' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>گالری تصاویر بتن</span>
          </button>

          <button 
            onClick={() => handleTabChange('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>تنظیمات و کالیبراسیون</span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          {onNavigateHome && (
            <button 
              onClick={onNavigateHome}
              className="w-full flex items-center justify-between px-3.5 py-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition text-xs font-bold"
            >
              <span>مشاهده سایت آزمایشگاه</span>
              <Home className="w-4 h-4" />
            </button>
          )}

          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition text-xs font-bold"
          >
            <span>خروج از پنل</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#f8fafc] dark:bg-slate-900">
        {/* Top Header Bar */}
        <header className="h-[68px] px-6 lg:px-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarOpen(!isSidebarOpen);
                } else {
                  setMobileMenuOpen(true);
                }
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white">پنل ایستگاه اپراتور بتن</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">ثبت نمونه‌ها، حوضچه کیورینگ، آزمون بار گسیختگی و چاپ شیت</p>
            </div>
          </div>

          {/* Center Search Bar */}
          <div className="flex-1 max-w-md mx-4 relative hidden md:block">
            <input 
              type="text" 
              placeholder="جستجو در کد شیت، نام پروژه، یا کارفرما..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent rounded-2xl text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          </div>

          {/* Top Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Action Buttons */}
            {webRequests.length > 0 && (
              <button
                onClick={() => setActiveTab('requests')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-xs transition animate-pulse cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{toPersianDigits(webRequests.length)} درخواست آنلاین جدید</span>
              </button>
            )}

            <button
              onClick={() => handleTabChange('new_test')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت نمونه بتن</span>
            </button>

            {/* Dark mode */}
            {onToggleDarkMode && (
              <button 
                onClick={onToggleDarkMode}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="تغییر حالت شب و روز"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {/* Notification Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition relative cursor-pointer"
                title="پیام‌ها و اعلان‌ها"
              >
                <Bell className="w-4 h-4" />
                {(pendingContactLeads.length > 0 || pendingFieldDispatches.length > 0 || dueBreakSamples.length > 0) && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono absolute -top-1 -right-1 flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {toPersianDigits(pendingContactLeads.length + pendingFieldDispatches.length + dueBreakSamples.length)}
                  </span>
                )}
              </button>

            {showNotifications && (
              <div className="absolute left-0 mt-2 w-88 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-fadeIn text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2.5">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-500" />
                    <span>اعلان‌ها و رویدادهای آزمایشگاه</span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                    {toPersianDigits(pendingContactLeads.length + pendingFieldDispatches.length + dueBreakSamples.length)} مورد
                  </span>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {/* 1. Website Contact Leads */}
                  {pendingContactLeads.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>درخواست‌های تماس سایت ({toPersianDigits(pendingContactLeads.length)})</span>
                        </span>
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            handleTabChange('requests');
                          }}
                          className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                        >
                          مشاهده همه
                        </button>
                      </div>

                      {pendingContactLeads.slice(0, 3).map(req => (
                        <div key={req.id} className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{req.customerName}</span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold" dir="ltr">{req.contactPhone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/40">
                            <a 
                              href={`tel:${req.contactPhone}`} 
                              className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition"
                            >
                              <Phone className="w-3 h-3" />
                              <span>تماس فوری</span>
                            </a>
                            <button
                              onClick={() => {
                                labDb.updateDispatchStatus(req.id, 'assigned', currentUser.fullName);
                                refreshData();
                              }}
                              className="flex-1 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                              title="ثبت تماس گرفته شد"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>پیگیری شد</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 2. Field Dispatches */}
                  {pendingFieldDispatches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 dark:text-blue-400">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-blue-500" />
                          <span>اعزام‌های تکنسین ({toPersianDigits(pendingFieldDispatches.length)})</span>
                        </span>
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            handleTabChange('requests');
                          }}
                          className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                          مشاهده
                        </button>
                      </div>

                      {pendingFieldDispatches.slice(0, 2).map(req => (
                        <div key={req.id} className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{req.projectName || req.customerName}</span>
                            <span className="text-[10px] font-mono text-blue-600 dark:text-sky-400">{req.scheduledTime}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">{req.projectAddress || req.customerName}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Due Break Samples */}
                  {dueBreakSamples.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>موعد آزمون شکست جک ({toPersianDigits(dueBreakSamples.length)})</span>
                      </div>
                      {dueBreakSamples.slice(0, 2).map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => {
                            setSelectedForEntry(s);
                            setShowNotifications(false);
                          }}
                          className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 cursor-pointer hover:bg-amber-100/60 transition space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                              {s.projectName}
                            </span>
                            <span className="font-mono text-[10px] text-blue-600 font-bold">{s.reportNo}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            عیار {s.concreteGrade} - {s.customerName}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingContactLeads.length === 0 && pendingFieldDispatches.length === 0 && dueBreakSamples.length === 0 && (
                    <div className="py-6 text-center text-slate-400 space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">هیچ اعلان معوقی وجود ندارد</p>
                      <p className="text-[10px]">همه درخواست‌های تماس و مأموریت‌ها رسیدگی شده‌اند.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-5 lg:p-7 overflow-y-auto">
          {/* Top Breadcrumb & Return to Dashboard Button for sub-tabs */}
          {activeTab !== 'dashboard' && (
            <div className="mb-5 flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <button 
                  onClick={() => handleTabChange('dashboard')}
                  className="hover:text-blue-600 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-blue-500" />
                  <span>پیشخوان اصلی اپراتور</span>
                </button>
                <span className="text-slate-400">/</span>
                <span className="text-slate-900 dark:text-white font-black">
                  {activeTab === 'requests' ? 'درخواست‌ها و تماس‌های سایت' :
                   activeTab === 'new_test' ? 'ثبت پذیرش نمونه بتن تازه' :
                   activeTab === 'samples' ? 'حوضچه کیورینگ و موعد شکست' :
                   activeTab === 'tests' ? 'بانک آزمایش‌ها و شیت‌ها' :
                   activeTab === 'customers' ? 'کارفرمایان و قراردادها' :
                   activeTab === 'reports' ? 'شیت‌های پذیرش و خروجی اکسل' :
                   activeTab === 'gallery' ? 'گالری تصاویر بتن' : 'تنظیمات'}
                </span>
              </div>
              <button
                onClick={() => handleTabChange('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>بازگشت به پیشخوان اصلی</span>
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* 1. Website Consultation Leads Alert Banner */}
              {pendingContactLeads.length > 0 && (
                <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white shadow-lg space-y-3 border border-emerald-600/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white animate-bounce" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">
                          {toPersianDigits(pendingContactLeads.length)} شماره تماس و درخواست مشاوره جدید از وب‌سایت
                        </h3>
                        <p className="text-[11px] text-emerald-100">
                          متقاضیان شماره تماس خود را در صفحه اصلی جهت مشاوره، استعلام قیمت و هماهنگی آزمایش ثبت نموده‌اند
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTabChange('requests')}
                      className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>مدیریت تماس‌های سایت ({toPersianDigits(contactLeads.length)})</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {pendingContactLeads.slice(0, 3).map(req => (
                      <div key={req.id} className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate max-w-[130px]">{req.customerName}</span>
                          <span className="text-[10px] text-emerald-200 font-mono">{req.scheduledDateJalali || todayJalali} - {req.scheduledTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-100" dir="ltr">{req.contactPhone}</span>
                          <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/90">{req.ticketNo}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                          <a
                            href={`tel:${req.contactPhone}`}
                            className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition"
                          >
                            <Phone className="w-3 h-3" />
                            <span>تماس فوری</span>
                          </a>
                          <button
                            onClick={() => {
                              labDb.updateDispatchStatus(req.id, 'assigned', currentUser.fullName);
                              refreshData();
                            }}
                            className="flex-1 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                            title="ثبت تماس گرفته شد"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>پیگیری شد</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Field Technician Dispatches Alert Banner */}
              {pendingFieldDispatches.length > 0 && (
                <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-800 via-indigo-800 to-slate-900 text-white shadow-lg space-y-3 border border-blue-600/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">
                          {toPersianDigits(pendingFieldDispatches.length)} مأموریت اعزام تکنسین جدید
                        </h3>
                        <p className="text-[11px] text-blue-100">
                          درخواست‌های نمونه‌برداری کارگاهی نیازمند تخصیص تکنسین و صدور شیت پذیرش
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTabChange('requests')}
                      className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>مشاهده مأموریت‌ها ({toPersianDigits(fieldDispatches.length)})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Action Cards at Top */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button 
                  onClick={() => handleTabChange('new_test')} 
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 hover:border-blue-500 hover:shadow-md transition group text-start relative overflow-hidden cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">ثبت نمونه بتن تازه</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">پذیرش و صدور بارکد</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition" />
                </button>

                <button 
                  onClick={() => handleTabChange('samples')} 
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 hover:border-amber-500 hover:shadow-md transition group text-start relative overflow-hidden cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0 group-hover:scale-105 transition">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">حوضچه کیورینگ</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">موعد ۷ و ۲۸ روزه جک</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-600 opacity-0 group-hover:opacity-100 transition" />
                </button>

                <button 
                  onClick={() => handleTabChange('tests')} 
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 hover:border-indigo-500 hover:shadow-md transition group text-start relative overflow-hidden cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">بانک آزمایش‌ها</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">مشاهده و ورود بار شیت</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition" />
                </button>

                <button 
                  onClick={() => handleTabChange('reports')} 
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3.5 hover:border-emerald-500 hover:shadow-md transition group text-start relative overflow-hidden cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">خروجی اکسل و دفتر</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">شیت‌های رسمی آزمایشگاه</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                </button>
              </div>

              {/* Middle 3-Column Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* 1. Left Card: نمونه‌های امروز Table (5 cols on lg) */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">نمونه‌های فعال آزمایشگاه</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        <select 
                          value={sampleTypeFilter} 
                          onChange={(e) => setSampleTypeFilter(e.target.value as any)}
                          className="bg-transparent text-xs font-medium outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                          <option value="all">همه قالب‌ها</option>
                          <option value="compressive">مکعبی ۱۵</option>
                          <option value="flexural">استوانه‌ای</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-right text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <th className="pb-2 font-semibold">کد شیت</th>
                            <th className="pb-2 font-semibold">رده و قالب</th>
                            <th className="pb-2 font-semibold">کارفرما</th>
                            <th className="pb-2 font-semibold text-center">اقدام سریع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {filteredDashboardSamples.map((r, idx) => (
                            <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2.5 font-mono font-bold text-blue-600">
                                {r.reportNo || `CT-1403-${1287 - idx}`}
                              </td>
                              <td className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                                <span className="font-bold">{r.concreteGrade}</span>
                                <span className="text-[10px] text-slate-400 block">
                                  {r.moldType === 'cylinder_150_300' ? 'استوانه‌ای' : 'مکعبی ۱۵'}
                                </span>
                              </td>
                              <td className="py-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[110px]" title={r.customerName}>
                                {r.customerName}
                              </td>
                              <td className="py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setSelectedForEntry(r)}
                                    className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 text-[10px] font-bold transition"
                                    title="ثبت بار شکست جک"
                                  >
                                    ثبت بار
                                  </button>
                                  <button
                                    onClick={() => setSelectedForPreview(r)}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 transition"
                                    title="مشاهده شیت"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTabChange('tests')}
                    className="w-full mt-3 text-center text-xs text-blue-600 font-bold hover:underline py-1 cursor-pointer"
                  >
                    مشاهده لیست کامل تمام آزمایش‌ها ({toPersianDigits(reports.length)})
                  </button>
                </div>

                {/* 2. Center Card: Concrete Lab Image Banner (3 cols on lg) */}
                <div className="lg:col-span-3 rounded-2xl overflow-hidden relative shadow-xs min-h-[220px] group bg-slate-900">
                  <img 
                    src={LAB_IMAGES.cubesBench} 
                    alt="آزمایشگاه تخصصی بتن" 
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  
                  <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                    <span className="text-[10px] font-bold text-blue-400 mb-1">مرجع کنترل کیفیت بتن</span>
                    <h3 className="text-base font-black text-white leading-snug">
                      آزمایشگاه تخصصی بتن
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      تضمین کیفیت با استانداردهای ملی و بین‌المللی ASTM & ISIRI
                    </p>
                  </div>
                </div>

                {/* 3. Right Card: روند آزمایش‌ها Donut Chart (4 cols on lg) */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">روند آزمایش‌ها</h3>
                    <span className="text-[11px] text-slate-400 font-medium">سهم رده‌ها و وضعیت</span>
                  </div>

                  {/* Donut Chart with Center Text */}
                  <div className="relative w-36 h-36 mx-auto my-2">
                    {concreteBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={concreteBreakdown}
                          innerRadius={46}
                          outerRadius={62}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {concreteBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [toPersianDigits(Number(val)) + ' شیت', '']} contentStyle={{ borderRadius: 12, fontSize: 11, direction: 'rtl' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full rounded-full border-8 border-slate-100 dark:border-slate-800" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-lg font-black text-blue-600">{toPersianDigits(reports.length)}</span>
                      <span className="text-[9px] font-bold text-slate-400">کل شیت‌ها</span>
                    </div>
                  </div>

                  {/* Colored Legend */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {concreteBreakdown.map(item => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Bottom 2-Column Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* 1. Left: نوتیفیکیشن‌ها و سررسیدهای شکست (5 cols on lg) */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">نوتیفیکیشن‌های آزمایشگاه</h3>
                    <span className="text-[10px] text-blue-600 font-bold">بروزرسانی زنده</span>
                  </div>
                  
                  <div className="space-y-3 text-xs">
                    {dueBreakSamples.length > 0 ? (
                      dueBreakSamples.slice(0, 3).map(sample => (
                        <div 
                          key={sample.id}
                          onClick={() => setSelectedForEntry(sample)}
                          className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 cursor-pointer hover:bg-amber-100/70 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-amber-200 dark:bg-amber-900/60 text-amber-700 flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                موعد شکست جک: {sample.reportNo}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {sample.customerName} - {sample.concreteGrade}
                              </span>
                            </div>
                          </div>
                          <span className="text-blue-600 font-bold text-[11px]">ثبت بار</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">تمام نمونه‌های امروز تحت کنترل هستند</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{todayJalali}</span>
                      </div>
                    )}

                    {reports.slice(0, 2).map((r, idx) => (
                      <div 
                        key={r.id}
                        onClick={() => setSelectedForPreview(r)}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              شیت شماره {r.reportNo}
                            </span>
                            <span className="text-[10px] text-slate-500">{r.projectName}</span>
                          </div>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">مشاهده</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Right: آمار آزمایش‌های اخیر Bar Chart (7 cols on lg) */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">آمار آزمایش‌های اخیر</h3>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                      <button 
                        onClick={() => setActivityTimeframe('week')}
                        className={`px-3 py-1 rounded-md font-bold text-[11px] transition ${activityTimeframe === 'week' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'}`}
                      >
                        هفته
                      </button>
                      <button 
                        onClick={() => setActivityTimeframe('month')}
                        className={`px-3 py-1 rounded-md font-bold text-[11px] transition ${activityTimeframe === 'month' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'}`}
                      >
                        ماه
                      </button>
                    </div>
                  </div>

                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(val: any) => [`${toPersianDigits(Number(val))} نمونه`, 'آزمایش‌ها']} contentStyle={{ borderRadius: 12, fontSize: 11, direction: 'rtl' }} />
                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'requests' && (
            <OperatorRequestsTab currentUser={currentUser} />
          )}

          {activeTab === 'new_test' && (
            <OperatorNewTest 
              customers={customers} 
              onSubmit={() => {
                refreshData();
                handleTabChange('tests');
              }} 
              onCancel={() => {
                handleTabChange('dashboard');
              }} 
              onCustomerRegistered={refreshData}
            />
          )}

          {activeTab === 'samples' && (
            <OperatorSamplesView 
              reports={reports} 
              customers={customers}
              currentUser={currentUser}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'tests' && (
            <OperatorTestsList 
              reports={reports} 
              customers={customers}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <OperatorCustomersList customers={customers} />
            </div>
          )}

          {activeTab === 'reports' && (
            <OperatorReports />
          )}

          {activeTab === 'gallery' && (
            <PhotoGalleryViewer currentUser={currentUser} />
          )}

          {activeTab === 'settings' && (
            <OperatorSettingsTab currentUser={currentUser} />
          )}
        </div>
      </main>

      {/* Break Test Entry Modal */}
      {selectedForEntry && (
        <OperatorResultModal
          report={selectedForEntry}
          onClose={() => setSelectedForEntry(null)}
          onSaved={refreshData}
        />
      )}

      {/* Certificate / Specimen Sheet Preview Modal */}
      {selectedForPreview && (
        <PrintCertificate
          report={selectedForPreview}
          customer={getCustomerForReport(selectedForPreview)}
          onClose={() => setSelectedForPreview(null)}
        />
      )}
    </div>
  );
};
