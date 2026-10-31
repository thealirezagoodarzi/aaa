import { usePortalTab } from '../../hooks/usePortalTab';
import React, { useState, useMemo } from 'react';
import { 
  UserProfile, 
  TestReport, 
  Customer, 
  Invoice 
} from '../../types';
import { labDb, LAB_INFO } from '../../services/supabase';
import { Language, translations } from '../../utils/i18n';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { CompanyLogo } from '../common/CompanyLogo';
import { CustomerTestDetailModal } from './CustomerTestDetailModal';
import { CustomerPaymentModal } from './CustomerPaymentModal';
import { CustomerNewRequest } from './CustomerNewRequest';
import { PrintCertificate } from '../common/PrintCertificate';
import { PrintStandardSheetModal } from '../common/PrintStandardSheetModal';
import { PrintInvoiceModal } from '../common/PrintInvoiceModal';
import { PrintContractModal } from '../common/PrintContractModal';
import { 
  LayoutDashboard, 
  FlaskConical, 
  FileText, 
  CreditCard, 
  FileCheck2, 
  User, 
  LogOut, 
  Home, 
  Sun, 
  Moon, 
  Search, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  FileSpreadsheet,
  Award,
  Wallet,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

export interface CustomerPortalProps {
  currentUser: UserProfile | null;
  language: Language;
  onLogout: () => void;
  onNavigateHome: () => void;
  allUsers?: UserProfile[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const PORTAL_TABS = ['dashboard', 'reports', 'new-request', 'invoices', 'contracts', 'profile'] as const;

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  currentUser,
  language,
  onLogout,
  onNavigateHome,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [activeTab, setActiveTab] = usePortalTab('dashboard', PORTAL_TABS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'pending'>('all');

  // Modals state
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<TestReport | null>(null);
  const [selectedReportForCert, setSelectedReportForCert] = useState<TestReport | null>(null);
  const [selectedReportForSheet, setSelectedReportForSheet] = useState<TestReport | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  // Load customer data
  const customers = labDb.getCustomers();
  const allReports = labDb.getReports();
  const allInvoices = labDb.getInvoices();

  // Find linked customer
  const currentCustomer: Customer | null = useMemo(() => {
    if (!currentUser) return customers[0] || null;
    if (currentUser.customerId) {
      const match = customers.find(c => c.id === currentUser.customerId);
      if (match) return match;
    }
    // Match by email or phone
    const byEmail = customers.find(c => c.email && currentUser.email && c.email.toLowerCase() === currentUser.email.toLowerCase());
    if (byEmail) return byEmail;
    const byPhone = customers.find(c => c.phone && currentUser.phone && c.phone === currentUser.phone);
    if (byPhone) return byPhone;
    return customers[0] || null;
  }, [currentUser, customers]);

  // Filter reports strictly for this customer
  const customerReports = useMemo(() => {
    if (!currentCustomer) return [];
    return allReports.filter(r => r.customerId === currentCustomer.id || r.customerName === currentCustomer.companyName);
  }, [allReports, currentCustomer]);

  // Filter invoices for this customer
  const customerInvoices = useMemo(() => {
    if (!currentCustomer) return [];
    return allInvoices.filter(inv => inv.customerId === currentCustomer.id || inv.customerName === currentCustomer.companyName);
  }, [allInvoices, currentCustomer]);

  // Filtered reports for the table / view
  const filteredReports = useMemo(() => {
    return customerReports.filter(r => {
      const matchesSearch = 
        r.reportNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sampleLocation.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGrade = filterGrade === 'all' || r.concreteGrade === filterGrade;
      
      const matchesStatus = 
        filterStatus === 'all' ? true :
        filterStatus === 'passed' ? r.isPassed :
        !r.breaking28dStrengthMpa;

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [customerReports, searchQuery, filterGrade, filterStatus]);

  // Stats calculation
  const totalSamples = customerReports.length;
  const completedReports = customerReports.filter(r => !!r.breaking28dStrengthMpa);
  const passedReports = customerReports.filter(r => r.isPassed);
  const pendingBreakings = customerReports.filter(r => !r.breaking28dStrengthMpa);
  const totalDebt = currentCustomer?.balance || 0;

  const isRTL = language === 'fa';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CompanyLogo className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                {currentCustomer?.companyName || (language === 'fa' ? 'پرتال کارفرما' : 'Customer Portal')}
              </h1>
              <p className="text-xs text-teal-600 dark:text-teal-400">
                {language === 'fa' ? 'سامانه نتایج آزمایشگاه آزما بتن جهان‌بین' : 'Azma Beton Lab Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDarkMode}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'روشن' : 'تاریک'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={onNavigateHome}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'صفحه اصلی' : 'Home'}</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'fa' ? 'خروج' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-20 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{language === 'fa' ? 'داشبورد کلی' : 'Dashboard'}</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'reports'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>{language === 'fa' ? 'نتایج و شیت‌های آزمون' : 'Test Reports'}</span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">
              {toPersianDigits(customerReports.length)}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('new-request')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'new-request'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-500" />
            <span>{language === 'fa' ? 'ثبت درخواست نمونه‌گیری' : 'New Sampling'}</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'invoices'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{language === 'fa' ? 'امور مالی و فاکتورها' : 'Invoices & Billing'}</span>
            {totalDebt > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {language === 'fa' ? 'بدهکار' : 'Due'}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'contracts'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>{language === 'fa' ? 'قرارداد رسمی' : 'Contract'}</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
              activeTab === 'profile'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{language === 'fa' ? 'مشخصات شرکت' : 'Company Profile'}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        
        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Balance & Debt Alert if any */}
            {totalDebt > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-200">
                      {language === 'fa' ? 'وضعیت مالی حساب: دارای بدهی جاری' : 'Current Account Balance: Outstanding Debt'}
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
                      {language === 'fa'
                        ? `مبلغ ${toPersianDigits(totalDebt.toLocaleString())} ریال بدهی سررسید شده در سامانه ثبت شده است. جهت تسویه سریع می‌توانید رسید واریزی را ارسال نمایید.`
                        : `An outstanding amount of ${totalDebt.toLocaleString()} IRR is recorded. Please settle to avoid test certification hold.`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 whitespace-nowrap self-end sm:self-auto"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{language === 'fa' ? 'ثبت واریز و تسویه حساب' : 'Record Payment'}</span>
                </button>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs">{language === 'fa' ? 'کل نمونه‌های برداشته شده' : 'Total Specimens'}</span>
                  <FlaskConical className="w-4 h-4 text-teal-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {toPersianDigits(totalSamples)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {language === 'fa' ? `${toPersianDigits(currentCustomer?.projectNames?.length || 1)} پروژه فعال` : `${currentCustomer?.projectNames?.length || 1} Active Projects`}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs">{language === 'fa' ? 'آزمون‌های منطبق (قبول)' : 'Passed Tests'}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {toPersianDigits(passedReports.length)}
                </div>
                <div className="text-[11px] text-emerald-600/80 mt-1">
                  {completedReports.length > 0 
                    ? `${toPersianDigits(Math.round((passedReports.length / completedReports.length) * 100))}% قبولی استاندارد`
                    : 'در انتظار شکست'}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs">{language === 'fa' ? 'نمونه‌ها در حوضچه عمل‌آوری' : 'Curing / In-Tank'}</span>
                  <Clock className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                  {toPersianDigits(pendingBreakings.length)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {language === 'fa' ? 'در انتظار سررسید ۷ یا ۲۸ روزه' : 'Awaiting 7d / 28d break'}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs">{language === 'fa' ? 'مانده حساب مالی' : 'Account Balance'}</span>
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                </div>
                <div className={`text-xl sm:text-2xl font-black ${totalDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {toPersianDigits(totalDebt.toLocaleString())} <span className="text-xs font-normal">ریال</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {totalDebt > 0 ? (language === 'fa' ? 'بدهکار آزمایشگاه' : 'Balance Due') : (language === 'fa' ? 'تسویه کامل' : 'Fully Settled')}
                </div>
              </div>
            </div>

            {/* Quick Action Banner */}
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-start">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <h3 className="font-bold text-base sm:text-lg">
                    {language === 'fa' ? 'اعزام تکنسین و نمونه‌گیری بتن تازه در محل پروژه' : 'Fresh Concrete Sampling on Project Site'}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 max-w-xl">
                  {language === 'fa'
                    ? 'برای بتن‌ریزی‌های بعدی، زمان و رده مقاومتی مورد نیاز را به صورت آنلاین ثبت کنید تا اکیپ آزمایشگاه در زمان مقرر در کارگاه حاضر شوند.'
                    : 'Schedule a technician visit for your next concrete pour to ensure compliance and timely testing.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('new-request')}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center gap-2 whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'fa' ? 'ثبت نوبت نمونه‌گیری' : 'Request Sampling'}</span>
              </button>
            </div>

            {/* Recent Test Reports Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {language === 'fa' ? 'آخرین گزارش‌های آزمون مقاومت فشاری' : 'Recent Compressive Strength Reports'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'fa' ? 'شیت‌های رسمی تأیید شده همراه با بارکد اصالت سنجی و QR کد' : 'Certified standard sheets with QR verification'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>{language === 'fa' ? 'مشاهده همه' : 'View All'}</span>
                  {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {customerReports.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FlaskConical className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-medium">{language === 'fa' ? 'هنوز نمونه‌ای برای این شرکت ثبت نشده است.' : 'No test reports found for this account.'}</p>
                  <button
                    onClick={() => setActiveTab('new-request')}
                    className="mt-3 text-xs text-teal-600 dark:text-teal-400 underline font-medium"
                  >
                    {language === 'fa' ? 'ثبت اولین درخواست نمونه‌گیری' : 'Schedule first test'}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'شماره شیت' : 'Report No'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'پروژه و موقعیت' : 'Project / Location'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'رده بتن' : 'Grade'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'تاریخ نمونه‌گیری' : 'Sample Date'}</th>
                        <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'مقاومت ۲۸ روزه' : '28d Strength'}</th>
                        <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'نتیجه استاندارد' : 'Result'}</th>
                        <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'عملیات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customerReports.slice(0, 5).map(report => {
                        const target = report.targetStrengthMpa || 25;
                        const strength28 = report.breaking28dStrengthMpa;
                        const pct = strength28 ? Math.round((strength28 / target) * 100) : null;

                        return (
                          <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                              {toPersianDigits(report.reportNo)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900 dark:text-white">{report.projectName}</div>
                              <div className="text-[11px] text-slate-400">{report.sampleLocation}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                {report.concreteGrade}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {toPersianDigits(report.samplingDateJalali)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {strength28 ? (
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                                    {toPersianDigits(strength28.toFixed(1))}
                                  </span>
                                  <span className="text-[10px] text-slate-400 mr-1">MPa</span>
                                  {pct && (
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                      {toPersianDigits(pct)}% {language === 'fa' ? 'طرح' : 'design'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{language === 'fa' ? 'در حوضچه' : 'Curing'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {report.isPassed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{language === 'fa' ? 'انطباق دارد' : 'Passed'}</span>
                                </span>
                              ) : strength28 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{language === 'fa' ? 'عدم انطباق' : 'Failed'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{language === 'fa' ? 'در حال آزمون' : 'Pending'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setSelectedReportForDetail(report)}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                                  title={language === 'fa' ? 'مشاهده جزئیات کامل' : 'View Details'}
                                >
                                  {language === 'fa' ? 'جزئیات' : 'Details'}
                                </button>
                                <button
                                  onClick={() => setSelectedReportForCert(report)}
                                  className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 transition"
                                  title={language === 'fa' ? 'گواهی رسمی' : 'Certificate'}
                                >
                                  <Award className="w-3.5 h-3.5 inline" />
                                </button>
                                <button
                                  onClick={() => setSelectedReportForSheet(report)}
                                  className="px-2 py-1 rounded bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 transition"
                                  title={language === 'fa' ? 'شیت استاندارد آزمایشگاهی' : 'Standard Sheet'}
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 inline" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ALL REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={language === 'fa' ? 'جستجو در شماره شیت، پروژه یا موقعیت...' : 'Search reports...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-9 text-xs focus:ring-2 focus:ring-teal-500 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={filterGrade}
                  onChange={e => setFilterGrade(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs outline-hidden"
                >
                  <option value="all">{language === 'fa' ? 'تمام رده‌های بتن' : 'All Grades'}</option>
                  <option value="C20">C20</option>
                  <option value="C25">C25</option>
                  <option value="C30">C30</option>
                  <option value="C35">C35</option>
                  <option value="C40">C40</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs outline-hidden"
                >
                  <option value="all">{language === 'fa' ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
                  <option value="passed">{language === 'fa' ? 'قبول استاندارد' : 'Passed Only'}</option>
                  <option value="pending">{language === 'fa' ? 'در انتظار شکست ۲۸ روزه' : 'Pending 28d'}</option>
                </select>
              </div>
            </div>

            {/* Reports List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'شماره شیت' : 'Report No'}</th>
                      <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'پروژه و قطعه ریخته شده' : 'Project / Element'}</th>
                      <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'رده بتن' : 'Grade'}</th>
                      <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'تاریخ نمونه‌گیری' : 'Sample Date'}</th>
                      <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'مقاومت ۷ روزه' : '7d Mpa'}</th>
                      <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'مقاومت ۲۸ روزه' : '28d Mpa'}</th>
                      <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'نتیجه' : 'Status'}</th>
                      <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'مشاهده و دانلود' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredReports.map(report => (
                      <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                          {toPersianDigits(report.reportNo)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">{report.projectName}</div>
                          <div className="text-[11px] text-slate-400">{report.sampleLocation}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            {report.concreteGrade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {toPersianDigits(report.samplingDateJalali)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {report.breaking7dStrengthMpa ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {toPersianDigits(report.breaking7dStrengthMpa.toFixed(1))}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {report.breaking28dStrengthMpa ? (
                            <span className="font-bold text-slate-900 dark:text-white">
                              {toPersianDigits(report.breaking28dStrengthMpa.toFixed(1))}
                            </span>
                          ) : (
                            <span className="text-cyan-600 dark:text-cyan-400 font-medium text-[11px]">
                              {language === 'fa' ? 'در حوضچه' : 'Curing'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {report.isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'fa' ? 'قبول' : 'Passed'}</span>
                            </span>
                          ) : report.breaking28dStrengthMpa ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{language === 'fa' ? 'رد' : 'Failed'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              {language === 'fa' ? 'در جریان' : 'In Progress'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedReportForDetail(report)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                            >
                              {language === 'fa' ? 'جزئیات' : 'Details'}
                            </button>
                            <button
                              onClick={() => setSelectedReportForCert(report)}
                              className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 transition"
                              title={language === 'fa' ? 'گواهی رسمی' : 'Certificate'}
                            >
                              <Award className="w-3.5 h-3.5 inline ml-1" />
                              <span>{language === 'fa' ? 'گواهی' : 'Cert'}</span>
                            </button>
                            <button
                              onClick={() => setSelectedReportForSheet(report)}
                              className="px-2 py-1 rounded bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 transition"
                              title={language === 'fa' ? 'شیت استاندارد آزمایشگاهی' : 'Standard Sheet'}
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 inline ml-1" />
                              <span>{language === 'fa' ? 'شیت' : 'Sheet'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: NEW REQUEST */}
        {activeTab === 'new-request' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <CustomerNewRequest
              customerId={currentCustomer?.id}
              customerName={currentCustomer?.companyName}
              onBack={() => setActiveTab('dashboard')}
              onSubmit={() => {
                setActiveTab('dashboard');
              }}
            />
          </div>
        )}

        {/* TAB: INVOICES & FINANCIAL */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Financial Summary Card */}
            <div className="bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <span className="text-xs text-teal-400 font-bold uppercase tracking-wider">
                  {language === 'fa' ? 'خلاصه حسابداری رسمی کارفرما' : 'Official Customer Balance'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black">
                  {toPersianDigits(totalDebt.toLocaleString())} <span className="text-base font-normal text-slate-300">ریال</span>
                </h3>
                <p className="text-xs text-slate-300">
                  {totalDebt > 0 
                    ? (language === 'fa' ? 'بدهی سررسید شده قرارداد آزمایشگاه' : 'Outstanding Lab Invoices')
                    : (language === 'fa' ? 'تمام فاکتورهای صادره تسویه شده‌اند.' : 'All issued invoices are settled.')}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex-1 md:flex-none px-5 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{language === 'fa' ? 'ثبت واریز / ارسال فیش' : 'Notify Payment'}</span>
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {language === 'fa' ? 'فاکتورهای رسمی و پیش‌فاکتورها' : 'Official Invoices'}
                </h3>
              </div>

              {customerInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-medium">{language === 'fa' ? 'فاکتوری برای این شرکت صادر نشده است.' : 'No invoices found.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'شماره فاکتور' : 'Invoice No'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'شرح / پروژه' : 'Project / Title'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'تاریخ صدور' : 'Issue Date'}</th>
                        <th className="py-3 px-4 text-start font-semibold">{language === 'fa' ? 'سررسید' : 'Due Date'}</th>
                        <th className="py-3 px-4 text-end font-semibold">{language === 'fa' ? 'مبلغ کل (ریال)' : 'Amount'}</th>
                        <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'وضعیت' : 'Status'}</th>
                        <th className="py-3 px-4 text-center font-semibold">{language === 'fa' ? 'مشاهده و چاپ' : 'Print'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customerInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                            {toPersianDigits(inv.invoiceNo)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            {inv.projectName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {toPersianDigits(inv.issueDateJalali)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {toPersianDigits(inv.dueDateJalali)}
                          </td>
                          <td className="py-3 px-4 text-end font-bold text-slate-900 dark:text-white">
                            {toPersianDigits(inv.totalAmount.toLocaleString())}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {inv.status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{language === 'fa' ? 'پرداخت شده' : 'Paid'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                <Clock className="w-3 h-3" />
                                <span>{language === 'fa' ? 'پرداخت نشده' : 'Unpaid'}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedInvoiceForPrint(inv)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{language === 'fa' ? 'فاکتور رسمی' : 'Invoice'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CONTRACTS */}
        {activeTab === 'contracts' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-teal-500" />
                  <span>{language === 'fa' ? 'قرارداد رسمی ارائه خدمات کنترل کیفیت بتن' : 'Official Laboratory Contract'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'fa'
                    ? 'مطابق ضوابط نظام مهندسی ساختمان، سازمان ملی استاندارد و مبحث نهم مقررات ملی ساختمان'
                    : 'Compliant with national building codes and construction standards.'}
                </p>
              </div>

              <button
                onClick={() => setIsContractModalOpen(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'fa' ? 'مشاهده و چاپ نسخه رسمی قرارداد' : 'View Full Contract'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'fa' ? 'طرف اول قرارداد (آزمایشگاه):' : 'Party 1 (Laboratory):'}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {LAB_INFO.name} به مدیریت {LAB_INFO.managerFullName}
                </p>
                <p className="text-slate-500 dark:text-slate-500">
                  {language === 'fa' ? 'آدرس:' : 'Address:'} {LAB_INFO.address}
                </p>
                <p className="text-slate-500 dark:text-slate-500">
                  {language === 'fa' ? 'تلفن تماس:' : 'Phone:'} {LAB_INFO.phone} - {LAB_INFO.landline}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'fa' ? 'طرف دوم قرارداد (کارفرما):' : 'Party 2 (Client):'}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {currentCustomer?.companyName}
                </p>
                <p className="text-slate-500 dark:text-slate-500">
                  {language === 'fa' ? 'نماینده / مدیرعامل:' : 'Representative:'} {currentCustomer?.representativeName}
                </p>
                <p className="text-slate-500 dark:text-slate-500">
                  {language === 'fa' ? 'شماره تماس:' : 'Phone:'} {toPersianDigits(currentCustomer?.phone || '-')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-500" />
                <span>{language === 'fa' ? 'مشخصات حقوقی و شناسنامه کارفرما' : 'Company Information'}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'نام شرکت / شخصیت حقوقی' : 'Company Name'}</label>
                <div className="font-bold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {currentCustomer?.companyName || '-'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'نماینده تام‌الاختیار / مدیرعامل' : 'Representative'}</label>
                <div className="font-bold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {currentCustomer?.representativeName || '-'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'شماره تماس همراه' : 'Phone'}</label>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {toPersianDigits(currentCustomer?.phone || '-')}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'پست الکترونیک' : 'Email'}</label>
                <div className="font-mono text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {currentCustomer?.email || '-'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'کد ملی / شناسه ملی' : 'National ID'}</label>
                <div className="font-mono text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {toPersianDigits(currentCustomer?.nationalId || '-')}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">{language === 'fa' ? 'کد اقتصادی' : 'Economic Code'}</label>
                <div className="font-mono text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {toPersianDigits(currentCustomer?.economicCode || '-')}
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-slate-400">{language === 'fa' ? 'نشانی اقامتگاه قانونی' : 'Address'}</label>
                <div className="text-slate-800 dark:text-slate-200 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {currentCustomer?.address || '-'}
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-slate-400">{language === 'fa' ? 'پروژه‌های تحت پوشش قرارداد' : 'Projects'}</label>
                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {currentCustomer?.projectNames && currentCustomer.projectNames.length > 0 ? (
                    currentCustomer.projectNames.map((proj, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium">
                        {proj}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">{language === 'fa' ? 'پروژه‌ای ثبت نشده است.' : 'No projects listed.'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {selectedReportForDetail && (
        <CustomerTestDetailModal
          report={selectedReportForDetail}
          customer={currentCustomer || undefined}
          isLocked={totalDebt > 0}
          onClose={() => setSelectedReportForDetail(null)}
          onOpenCertificate={() => {
            setSelectedReportForCert(selectedReportForDetail);
            setSelectedReportForDetail(null);
          }}
          onOpenStandardSheet={() => {
            setSelectedReportForSheet(selectedReportForDetail);
            setSelectedReportForDetail(null);
          }}
          onSettleDebt={() => {
            setIsPaymentModalOpen(true);
            setSelectedReportForDetail(null);
          }}
        />
      )}

      {selectedReportForCert && (
        <PrintCertificate
          report={selectedReportForCert}
          customer={currentCustomer || undefined}
          onClose={() => setSelectedReportForCert(null)}
        />
      )}

      {selectedReportForSheet && (
        <PrintStandardSheetModal
          report={selectedReportForSheet}
          customer={currentCustomer || undefined}
          onClose={() => setSelectedReportForSheet(null)}
        />
      )}

      {selectedInvoiceForPrint && (
        <PrintInvoiceModal
          invoice={selectedInvoiceForPrint}
          customer={currentCustomer || undefined}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}

      {isPaymentModalOpen && (
        <CustomerPaymentModal
          customer={currentCustomer}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentNotified={() => {
            setIsPaymentModalOpen(false);
          }}
        />
      )}

      {isContractModalOpen && (
        <PrintContractModal
          customer={currentCustomer}
          isCustomerView={true}
          onClose={() => setIsContractModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CustomerPortal;
