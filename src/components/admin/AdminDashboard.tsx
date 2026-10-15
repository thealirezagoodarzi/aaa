import React, { useState } from 'react';
import { 
  UserProfile, 
  TestReport, 
  Customer, 
  Invoice, 
  AccountingRecord, 
  AIPredictionResult, 
  AIFinancialSummary 
} from '../../types';
import { labDb, LAB_INFO } from '../../services/supabase';
import { generateRandomPassword } from '../../utils/passwordCrypto';
import { predictConcreteStrength, generateFinancialAuditSummary } from '../../services/gemini';
import { QRCodeSVG } from 'qrcode.react';
import { translations, Language } from '../../utils/i18n';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { useModalBack } from '../../hooks/useModalBack';
import { JalaliDatePicker } from '../common/JalaliDatePicker';
import { PrintCertificate } from '../common/PrintCertificate';
import { PrintInvoiceModal } from '../common/PrintInvoiceModal';
import { PrintContractModal } from '../common/PrintContractModal';
import { LabFormsDirectory } from '../common/LabFormsDirectory';
import { AdminSettingsAndSheets } from './AdminSettingsAndSheets';
import { EquipmentCalibrationTab } from './EquipmentCalibrationTab';
import { DispatchesManagementTab } from './DispatchesManagementTab';
import { EnvironmentalLogsTab } from './EnvironmentalLogsTab';
import { AdminAnalyticsCharts } from './AdminAnalyticsCharts';
import { AdminSmsManagementTab } from './AdminSmsManagementTab';
import { AdminCustomerContractModal } from './AdminCustomerContractModal';
import { AdminFinancialManagementTab } from './AdminFinancialManagementTab';
import { AdminCustomerTrashModal } from './AdminCustomerTrashModal';
import { AdminCustomerDeleteModal } from './AdminCustomerDeleteModal';
import { AdminInvoiceEditModal } from './AdminInvoiceEditModal';
import { TechniciansManagementModal } from './TechniciansManagementModal';
import { AdminPasswordChangeWithSmsModal } from './AdminPasswordChangeWithSmsModal';
const QrAccessCardModal = React.lazy(() => import('../common/QrAccessCardModal').then(m => ({ default: m.QrAccessCardModal })));
import { PhotoGalleryViewer } from '../common/PhotoGalleryViewer';
import { CompanyLogo } from '../common/CompanyLogo';
import { downloadBlob, printOnlyElement } from '../../utils/printDom';
import { LAB_IMAGES } from '../../assets/images';
// BUG FIX (ID collision): see src/utils/uniqueId.ts — was `TX-${Date.now().toString().slice(-6)}`
import { uniqueId, uniqueRefNo } from '../../utils/uniqueId';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  Users,
  Sparkles,
  Building2,
  FileText,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Check,
  Printer,
  Trash2,
  CreditCard,
  Layers,
  FlaskConical,
  BrainCircuit,
  PieChart as PieIcon,
  ChevronRight,
  MapPin,
  Camera,
  Calendar,
  RefreshCw,
  Wallet,
  Scale,
  PhoneCall,
  Droplets,
  Download,
  Pencil,
  LayoutDashboard,
  Boxes,
  Activity,
  BarChart3,
  ChevronLeft,
  LogOut,
  Sun,
  Moon,
  Home,
  KeyRound,
  QrCode,
  UserPlus,
  ShieldAlert,
  Copy,
  ExternalLink,
  Lock,
  Phone,
  Mail,
  FileSignature,
  Menu,
  MessageSquare,
  Send,
  X,
  Database
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: UserProfile;
  language: Language;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  allUsers?: UserProfile[];
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
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
  const [showAdminUserMenu, setShowAdminUserMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'reports' | 'accounting' | 'ai_suite' | 'calibrations' | 'dispatches' | 'env_logs' | 'gallery' | 'sms' | 'forms' | 'customers' | 'users'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [overviewPeriod, setOverviewPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Real-time data from labDb
  const [reports, setReports] = useState<TestReport[]>(() => labDb.getReports());
  const [customers, setCustomers] = useState<Customer[]>(() => labDb.getCustomers());
  const [invoices, setInvoices] = useState<Invoice[]>(() => labDb.getInvoices());
  const [accounting, setAccounting] = useState<AccountingRecord[]>(() => labDb.getAccountingRecords());
  const [profiles, setProfiles] = useState<UserProfile[]>(() => labDb.getProfiles());

  // Certificate Modal State
  const [selectedReportForCert, setSelectedReportForCert] = useState<TestReport | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Approval Action State
  const [reviewingReport, setReviewingReport] = useState<TestReport | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);

  // AI Predictor Form State
  const [aiGrade, setAiGrade] = useState('C30');
  const [ai7dStrength, setAi7dStrength] = useState<number>(22.5);
  const [aiSlump, setAiSlump] = useState<number>(95);
  const [aiWcRatio, setAiWcRatio] = useState<number>(0.42);
  const [aiPredicting, setAiPredicting] = useState(false);
  const [aiPredictionResult, setAiPredictionResult] = useState<AIPredictionResult | null>(null);

  // AI Financial Summary State
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiFinancialAudit, setAiFinancialAudit] = useState<AIFinancialSummary | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [adminInvoiceSearch, setAdminInvoiceSearch] = useState('');
  const [adminInvoiceStatusFilter, setAdminInvoiceStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending_settlement'>('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // New Invoice Modal
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('');
  const [invoiceProject, setInvoiceProject] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState<number>(25000000);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(() => formatJalali(getTodayJalali()));

  // New Customer & Contract Modal State
  const [showContractRegistrationModal, setShowContractRegistrationModal] = useState(false);
  const [editingCustomerForContract, setEditingCustomerForContract] = useState<Customer | null>(null);
  const [customerForQrCard, setCustomerForQrCard] = useState<Customer | null>(null);
  const [accountingViewMode, setAccountingViewMode] = useState<'project_balances' | 'invoices_ledger'>('project_balances');

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustRep, setNewCustRep] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustProjects, setNewCustProjects] = useState('');

  // Edit Report & Customer State
  const [editingReport, setEditingReport] = useState<TestReport | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForContract, setSelectedCustomerForContract] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);

  // User Management States (Admin Oversight)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserProfile | null>(null);
  const [showAdminSmsPasswordModal, setShowAdminSmsPasswordModal] = useState(false);
  const [showTechsModal, setShowTechsModal] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'staff' | 'customer'>('all');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState<{
    fullName: string;
    email: string;
    username: string;
    phone: string;
    role: 'operator' | 'customer';
    password: string;
    customerId?: string;
  }>({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    role: 'operator',
    password: generateRandomPassword(),
    customerId: ''
  });
  const [viewingQrUser, setViewingQrUser] = useState<{ user: UserProfile; customer?: Customer; password?: string } | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState(false);

  // New Accounting Transaction Modal
  const [showNewTransModal, setShowNewTransModal] = useState(false);
  const [transTitle, setTransTitle] = useState('');
  const [transType, setTransType] = useState<'income' | 'expense'>('income');
  const [transCategory, setTransCategory] = useState('خدمات آزمایشگاهی');
  const [transAmount, setTransAmount] = useState<number>(10000000);
  const [transDate, setTransDate] = useState<string>(() => formatJalali(getTodayJalali()));
  const [transRef, setTransRef] = useState('');

  // Hook standalone admin-level dialogs to browser Back button
  // (Note: activeTab is a view tab, NOT a modal — using useModalBack on tabs caused
  // history.back() to fire on every tab switch and eject the user to home/login)
  useModalBack(Boolean(editingInvoice), () => setEditingInvoice(null), 'admin-modal-edit-invoice');
  useModalBack(Boolean(reviewingReport), () => setReviewingReport(null), 'admin-modal-review');
  useModalBack(showNewInvoiceModal, () => setShowNewInvoiceModal(false), 'admin-modal-new-invoice');
  useModalBack(showContractRegistrationModal, () => setShowContractRegistrationModal(false), 'admin-modal-contract-reg');
  useModalBack(showNewCustomerModal, () => setShowNewCustomerModal(false), 'admin-modal-new-cust');
  useModalBack(Boolean(editingCustomer), () => setEditingCustomer(null), 'admin-modal-edit-cust');
  useModalBack(Boolean(editingReport), () => setEditingReport(null), 'admin-modal-edit-rep');
  useModalBack(Boolean(editingUser), () => setEditingUser(null), 'admin-modal-edit-user');
  useModalBack(showNewUserModal, () => setShowNewUserModal(false), 'admin-modal-new-user');
  useModalBack(showNewTransModal, () => setShowNewTransModal(false), 'admin-modal-new-trans');
  useModalBack(showTechsModal, () => setShowTechsModal(false), 'admin-modal-techs');
  useModalBack(showAdminSmsPasswordModal, () => setShowAdminSmsPasswordModal(false), 'admin-modal-sms-pwd');
  useModalBack(mobileMenuOpen, () => setMobileMenuOpen(false), 'admin-modal-mobile-menu');

  // Subscribe to DB updates
  React.useEffect(() => {
    const unsub = labDb.subscribe(() => {
      // PERF FIX (audit #47): only setState when the reference actually
      // changed. labDb.notify() fires on every sync tick / unrelated event;
      // previously each one pushed five new state values into this component
      // and re-rendered the entire tree even when the data was identical.
      // Combined with the memoized getProfiles() projection (audit #48), a
      // no-op notification now produces ZERO state updates here.
      setReports(prev => { const next = labDb.getReports(); return next === prev ? prev : next; });
      setCustomers(prev => { const next = labDb.getCustomers(); return next === prev ? prev : next; });
      setInvoices(prev => { const next = labDb.getInvoices(); return next === prev ? prev : next; });
      setAccounting(prev => { const next = labDb.getAccountingRecords(); return next === prev ? prev : next; });
      setProfiles(prev => { const next = labDb.getProfiles(); return next === prev ? prev : next; });
    });
    return unsub;
  }, []);

  // Filter pending reports for queue
  // PERF FIX (audit #47): memoize derived lists. These were recomputed on
  // EVERY render of a 3700-line component (including transient keystroke
  // renders in uncontrolled inputs); now they recompute only when the source
  // array reference changes, which after the subscribe() fix above happens
  // only on real data mutations.
  const pendingReports = React.useMemo(
    () => reports.filter((r) => r.status === 'pending'),
    [reports]
  );
  const approvedReports = React.useMemo(
    () => reports.filter((r) => r.status === 'approved'),
    [reports]
  );

  // Financial Calculations
  // PERF FIX (audit #47): memoized — these reduce() passes over the full
  // accounting array ran on every render before.
  const totalIncome = React.useMemo(() => accounting
    .filter((a) => a.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0), [accounting]);

  const totalExpense = React.useMemo(() => accounting
    .filter((a) => a.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0), [accounting]);

  const netProfit = totalIncome - totalExpense;

  const unpaidInvoicesAmount = invoices
    .filter((i) => i.status === 'unpaid')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const passRate = reports.length > 0 
    ? Math.round((reports.filter(r => r.isPassed).length / reports.length) * 100) 
    : 100;

  // Handle Approve / Reject
  const handleProcessApproval = (status: 'approved' | 'rejected') => {
    if (!reviewingReport) return;
    setApprovalLoading(true);

    const reportNo = reviewingReport.reportNo;
    setTimeout(() => {
      labDb.updateReportStatus(
        reviewingReport.id,
        status,
        approvalNotes || (status === 'approved' ? 'تایید نهایی با رعایت استانداردهای ملی و مبحث ۹' : 'مردود به دلیل عدم احراز مقاومت مشخصه'),
        currentUser
      );
      setSuccessMessage(status === 'approved' 
        ? `گزارش ${reportNo} با موفقیت تایید نهایی و گواهینامه معتبر صادر گردید.` 
        : `گزارش ${reportNo} عدم تایید (مردود) گردید.`
      );
      setTimeout(() => setSuccessMessage(null), 3500);
      setReviewingReport(null);
      setApprovalNotes('');
      setApprovalLoading(false);
    }, 300);
  };

  // Run AI Concrete Prediction
  const handleRunAiPrediction = async () => {
    setAiPredicting(true);
    try {
      const res = await predictConcreteStrength({
        concreteGrade: aiGrade,
        strength7d: ai7dStrength,
        slump: aiSlump,
        wcRatio: aiWcRatio,
        cementGrade: 'تیپ ۲',
        curingTemp: '۲۳ درجه سانتی‌گراد'
      });
      setAiPredictionResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setAiPredicting(false);
    }
  };

  // Run AI Financial Audit
  const handleRunAiAudit = async () => {
    setAiAuditLoading(true);
    try {
      const res = await generateFinancialAuditSummary({
        totalIncome,
        totalExpense,
        pendingInvoices: unpaidInvoicesAmount,
        testsCount: reports.length,
        passRate,
        period: 'دوره مالی جاری'
      });
      setAiFinancialAudit(res);
    } catch (e) {
      console.error(e);
    } finally {
      setAiAuditLoading(false);
    }
  };

  // Create Invoice Handler
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === invoiceCustomerId);
    if (!cust) return;

    const tax = Math.round(invoiceAmount * 0.10);
    const total = invoiceAmount + tax;

    labDb.addInvoice({
      invoiceNo: `INV-1403-${Math.floor(100 + Math.random() * 900)}`,
      customerId: cust.id,
      customerName: cust.companyName,
      projectName: invoiceProject || cust.projectNames[0] || 'پروژه جاری',
      amount: invoiceAmount,
      taxAmount: tax,
      discountAmount: 0,
      totalAmount: total,
      status: 'unpaid',
      issueDateJalali: formatJalali(getTodayJalali()),
      dueDateJalali: invoiceDueDate,
      items: [
        {
          description: `آزمایش‌های کنترل کیفی بتن پروژه ${invoiceProject || cust.projectNames[0] || ''}`,
          quantity: 1,
          unitPrice: invoiceAmount,
          total: invoiceAmount
        }
      ]
    });

    setShowNewInvoiceModal(false);
    setInvoiceCustomerId('');
    setInvoiceProject('');
  };

  // Create Customer Handler
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    labDb.addCustomer({
      companyName: newCustName,
      representativeName: newCustRep,
      phone: newCustPhone,
      email: newCustEmail,
      address: newCustAddress,
      projectNames: newCustProjects.split(',').map(s => s.trim()).filter(Boolean),
      balance: 0
    });

    setShowNewCustomerModal(false);
    setNewCustName('');
    setNewCustRep('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustProjects('');
  };

  // Create Transaction Handler
  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    labDb.addAccountingRecord({
      title: transTitle,
      type: transType,
      category: transCategory,
      amount: transAmount,
      jalaliDate: transDate,
      referenceNo: transRef || uniqueRefNo('TX'),
      createdBy: currentUser.id
    });

    setShowNewTransModal(false);
    setTransTitle('');
    setTransRef('');
  };

  // Filtered reports for all reports view
  const filteredReports = reports.filter((r) => {
    const matchesSearch = 
      r.reportNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportAllReportsCsv = () => {
    const headers = [
      'شماره گزارش',
      'کارفرما',
      'پروژه',
      'محل بتن‌ریزی',
      'رده بتن',
      'مقاومت هدف (MPa)',
      'اسلامپ (mm)',
      'مقاومت ۷ روزه (MPa)',
      'مقاومت ۲۸ روزه (MPa)',
      'تاریخ نمونه‌گیری',
      'وضعیت تایید',
      'نتیجه انطباق'
    ];
    const rows = filteredReports.map(r => [
      r.reportNo,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.projectName.replace(/"/g, '""')}"`,
      `"${r.sampleLocation.replace(/"/g, '""')}"`,
      r.concreteGrade,
      r.targetStrengthMpa,
      r.slumpMm,
      r.breaking7dStrengthMpa || '',
      r.breaking28dStrengthMpa || '',
      r.samplingDateJalali,
      r.status === 'approved' ? 'تایید شده' : r.status === 'pending' ? 'در انتظار' : 'مردود',
      r.isPassed ? 'منطبق' : 'عدم انطباق'
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `BetonLab-Reports-Export-${formatJalali(getTodayJalali())}.csv`);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.invoiceNo.toLowerCase().includes(adminInvoiceSearch.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(adminInvoiceSearch.toLowerCase()) ||
      inv.projectName.toLowerCase().includes(adminInvoiceSearch.toLowerCase());
    let matchesStatus = true;
    if (adminInvoiceStatusFilter === 'paid') {
      matchesStatus = inv.status === 'paid';
    } else if (adminInvoiceStatusFilter === 'pending_settlement') {
      matchesStatus = inv.status === 'pending_settlement';
    } else if (adminInvoiceStatusFilter === 'unpaid') {
      matchesStatus = inv.status !== 'paid';
    }
    return matchesSearch && matchesStatus;
  });

  const handleExportAdminInvoicesCsv = () => {
    const headers = ['شماره فاکتور', 'کارفرما', 'پروژه', 'مبلغ ناخالص (تومان)', 'مالیات (تومان)', 'مبلغ کل (تومان)', 'تاریخ صدور', 'تاریخ سررسید', 'وضعیت پرداخت'];
    const rows = filteredInvoices.map(inv => [
      inv.invoiceNo,
      `"${inv.customerName.replace(/"/g, '""')}"`,
      `"${inv.projectName.replace(/"/g, '""')}"`,
      inv.amount,
      inv.taxAmount,
      inv.totalAmount,
      inv.issueDateJalali,
      inv.dueDateJalali,
      inv.status === 'paid' ? 'تسویه شده' : inv.status === 'pending_settlement' ? 'درخواست تسویه' : 'معوق'
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `BetonLab-Invoices-Export-${formatJalali(getTodayJalali())}.csv`);
  };

  const handleExportTransactionsCsv = () => {
    const headers = ['عنوان سند', 'نوع', 'دسته‌بندی', 'مبلغ (تومان)', 'تاریخ', 'شماره پیگیری'];
    const rows = accounting.map(rec => [
      `"${rec.title.replace(/"/g, '""')}"`,
      rec.type === 'income' ? 'درآمد' : 'هزینه',
      `"${rec.category}"`,
      rec.amount,
      rec.jalaliDate,
      rec.referenceNo || '-'
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `BetonLab-Transactions-Ledger-${formatJalali(getTodayJalali())}.csv`);
  };

  const handleBulkApproveConforming = () => {
    const conforming = pendingReports.filter(r => {
      const is28dReady = !!r.breaking28dStrengthMpa;
      const strength = r.breaking28dStrengthMpa || r.breaking7dStrengthMpa || 0;
      const target = r.targetStrengthMpa;
      return strength >= (is28dReady ? target : target * 0.65);
    });

    if (conforming.length === 0) return;
    conforming.forEach(r => {
      labDb.updateReportStatus(r.id, 'approved', 'تایید جمعی سیستمی بر اساس تطابق مقاومت با رده طرح', currentUser);
    });
    setSuccessMessage(`${toPersianDigits(conforming.length)} گزارش استاندارد با موفقیت تایید نهایی شدند.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (

    <div className="flex h-screen w-full bg-[#f1f5f9] dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-hidden font-sans" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        bg-[#0f172a] text-white flex-col h-full shrink-0 shadow-2xl z-20 w-64
        ${mobileMenuOpen ? 'fixed inset-y-0 start-0 z-50 flex' : 'hidden'}
        ${isSidebarOpen ? 'lg:flex lg:static' : 'lg:hidden'}
      `}>
        <div className="p-5 flex items-center justify-between gap-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <CompanyLogo className="w-10 h-10 rounded-xl shrink-0" iconClassName="w-5 h-5 text-white" />
            <div className="overflow-hidden">
              <h1 className="text-xs font-black leading-tight truncate">آزما بتن پایش خاک و پی جهان بین</h1>
              <span className="text-[10px] text-blue-400 font-medium">پنل مدیریت ارشد</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-800/60 flex items-center gap-3">
           <img src={`https://ui-avatars.com/api/?name=${currentUser.fullName}&background=cbd5e1&color=0f172a`} alt="avatar" className="w-11 h-11 rounded-full border-2 border-slate-700 object-cover bg-slate-200" />
           <div className="overflow-hidden">
             <div className="font-bold text-sm truncate">{currentUser.fullName || 'کاربر'}</div>
             <div className="text-xs text-slate-400 mt-0.5 truncate">{t.roleAdmin}</div>
           </div>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-1.5 overflow-y-auto">
          {[
            { id: 'overview', label: 'داشبورد آماری', icon: LayoutDashboard },
            { id: 'approvals', label: 'کارتابل تاییدات', icon: FileText },
            { id: 'customers', label: 'مشتریان و قراردادها', icon: FileSignature },
            { id: 'reports', label: 'مدیریت آزمایش‌ها', icon: FileSpreadsheet },
            { id: 'accounting', label: 'حسابداری و فاکتورها', icon: Wallet },
            { id: 'users', label: 'مدیریت کاربران و دسترسی‌ها', icon: Users },
            { id: 'sms', label: 'سامانه پیامک خودکار', icon: MessageSquare },
            { id: 'dispatches', label: 'نمونه‌ها و اعزام تکنسین', icon: Layers },
            { id: 'env_logs', label: 'حوضچه کیورینگ و شرایط محیطی', icon: Droplets },
            { id: 'calibrations', label: 'تجهیزات و کالیبراسیون', icon: Scale },
            { id: 'gallery', label: 'گالری تصاویر بتن', icon: Camera },
            { id: 'ai_suite', label: 'دستیار هوش مصنوعی', icon: Sparkles },
            { id: 'forms', label: 'تنظیمات و شیت‌ها', icon: Pencil }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-slate-400'}`} />
                <span className="font-bold text-[13px]">{item.label}</span>
              </div>
              {item.id === 'approvals' && pendingReports.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${activeTab === 'approvals' ? 'bg-white text-blue-600' : 'bg-slate-700 text-slate-300'}`}>
                  {toPersianDigits(pendingReports.length)}
                </span>
              )}
              {item.id === 'accounting' && invoices.filter(i => i.status === 'pending_settlement').length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                  {toPersianDigits(invoices.filter(i => i.status === 'pending_settlement').length)} تسویه
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-2">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full flex items-center justify-between px-3.5 py-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition text-xs font-bold"
            >
              <span>مشاهده وبسایت اصلی</span>
              <Home className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition text-xs font-bold"
          >
            <span>خروج از پنل مدیریت</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-[72px] px-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-10 shrink-0">
          
          {/* Logo & Title (Left in LTR, Right in RTL) */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarOpen(!isSidebarOpen);
                } else {
                  setMobileMenuOpen(true);
                }
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer lg:me-2"
            >
              <Menu className="w-5 h-5" />
            </button>
            <CompanyLogo className="w-9 h-9 rounded-xl shrink-0" iconClassName="w-4 h-4 text-white" />
            <div className="text-right hidden sm:block">
              <span className="font-black text-sm text-slate-800 dark:text-slate-200 block">مدیریت عالی آزمایشگاه</span>
              <span className="text-[10px] text-blue-500 font-mono" dir="ltr">BETONLAB CONTROL v3.0</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="w-[360px] relative hidden md:block">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="جستجو در سامانه..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-4 pe-11 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border-transparent text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
            />
          </div>

          {/* Actions & Profile (Right in LTR, Left in RTL) */}
          <div className="flex items-center gap-2">
            {/* Approvals quick pill */}
            <button 
              onClick={() => setActiveTab('approvals')}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer relative"
              title="کارتابل تاییدات"
            >
              <FileText className="w-4 h-4" />
              {pendingReports.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 absolute top-2 end-2 animate-pulse" />
              )}
            </button>

            {/* Dark mode toggle */}
            {onToggleDarkMode && (
              <button 
                onClick={onToggleDarkMode} 
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="تغییر تم"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {/* Logout */}
            <button onClick={onLogout} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer" title="خروج">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
           {successMessage && (
             <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
               <CheckCircle2 className="w-4 h-4" />
               {successMessage}
             </div>
           )}
           {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Greeting & Quick Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
                  <div className="space-y-1">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      خوش آمدید، {currentUser.fullName}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      سامانه جامع مدیریت عالی و پایش کیفی آزمایشگاه تخصصی بتن و مصالح ساختمانی
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowContractRegistrationModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                      title="ثبت کارفرمای جدید و صدور قرارداد رسمی"
                    >
                      <FileSignature className="w-4 h-4" />
                      <span>صدور قرارداد جدید</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('approvals')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                      title="بررسی و تایید نتایج آزمایش‌های بتن"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>کارتابل تاییدات</span>
                      {pendingReports.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-white text-amber-700 font-mono text-[10px] font-bold">
                          {toPersianDigits(pendingReports.length)}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setShowNewInvoiceModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>صدور فاکتور</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('sms')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>ارسال پیامک</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('gallery')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>گالری تصاویر</span>
                    </button>
                  </div>
                </div>

                {/* 4 Real-time Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Income Card */}
                  <div 
                    onClick={() => setActiveTab('accounting')}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-600/50 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition cursor-pointer group"
                    title="مشاهده جزئیات حسابداری و درآمدها"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-slate-500 font-bold group-hover:text-orange-600 transition">کل درآمدهای وصولی</span>
                      <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500 group-hover:scale-110 transition">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono">
                        {toPersianDigits(totalIncome.toLocaleString())}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                        تومان <span className="text-slate-400 font-normal">وصول قطعی</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Customers Card */}
                  <div 
                    onClick={() => setActiveTab('customers')}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-600/50 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition cursor-pointer group"
                    title="مدیریت کارفرمایان و قراردادها"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-slate-500 font-bold group-hover:text-purple-600 transition">کارفرمایان و قراردادها</span>
                      <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-500 group-hover:scale-110 transition">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono">
                        {toPersianDigits(customers.length)}
                      </div>
                      <div className="text-[11px] font-bold text-purple-600 mt-1 flex items-center gap-1">
                        شرکت فعال <span className="text-slate-400 font-normal">در سامانه</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Samples Card */}
                  <div 
                    onClick={() => setActiveTab('reports')}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-600/50 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition cursor-pointer group"
                    title="مشاهده شیت‌ها و نمونه‌های بتن"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-slate-500 font-bold group-hover:text-emerald-600 transition">نمونه‌های بتن ثبت شده</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition">
                        <Boxes className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono">
                        {toPersianDigits(reports.reduce((acc, r) => acc + (r.samples?.length || 5), 0))}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                        مکعب بتنی آزمون <span className="text-slate-400 font-normal">۱۵×۱۵</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tests Card */}
                  <div 
                    onClick={() => setActiveTab('reports')}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600/50 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition cursor-pointer group"
                    title="مدیریت آزمایش‌ها و نتایج"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs text-slate-500 font-bold group-hover:text-blue-600 transition">شیت‌های آزمایش صادر شده</span>
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 group-hover:scale-110 transition">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono">
                        {toPersianDigits(reports.length)}
                      </div>
                      <div className="text-[11px] font-bold text-blue-500 mt-1 flex items-center gap-1">
                        گزارش آزمون <span className="text-slate-400 font-normal">معتبر</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real Recharts Interactive Analytics Component */}
                <AdminAnalyticsCharts
                  reports={reports}
                  invoices={invoices}
                  accounting={accounting}
                  isDarkMode={isDarkMode}
                />
              </div>
           )}

           {/* TAB: PHOTO GALLERY */}
           {activeTab === 'gallery' && (
             <PhotoGalleryViewer currentUser={currentUser} />
           )}

           {/* TAB: SMS DISPATCH & NOTIFICATIONS */}
           {activeTab === 'sms' && (
             <AdminSmsManagementTab currentUser={currentUser} />
           )}

      {/* TAB 1: APPROVAL QUEUE                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t.approvalQueueTitle}</span>
                <span className="text-xs font-normal text-slate-500">
                  ({toPersianDigits(pendingReports.length)} مورد در انتظار بررسی و امضا)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                گزارش‌های ثبت‌شده توسط تکنسین‌ها تنها پس از تایید در این پنل برای مشتریان قابل رویت خواهند شد (قانون RLS).
              </p>
            </div>

            {pendingReports.length > 0 && (
              <button
                onClick={handleBulkApproveConforming}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition active:scale-95 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید سریع همه گزارش‌های استاندارد</span>
              </button>
            )}
          </div>

          {pendingReports.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                هیچ گزارشی در صف انتظار وجود ندارد
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تمام آزمایش‌های ارسال‌شده توسط تکنسین‌ها بررسی و تایید شده‌اند.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingReports.map((report) => {
                const is28dReady = !!report.breaking28dStrengthMpa;
                const strength = report.breaking28dStrengthMpa || report.breaking7dStrengthMpa || 0;
                const target = report.targetStrengthMpa;
                const isTargetMet = strength >= (is28dReady ? target : target * 0.65);

                return (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-md p-5 space-y-4 hover:border-amber-400 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {report.reportNo}
                          </span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                            در انتظار تایید
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                          {report.customerName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          پروژه: {report.projectName} • {report.sampleLocation}
                        </p>
                      </div>

                      <div className="text-end">
                        <span className="text-xs text-slate-400 block">رده بتن:</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                          {report.concreteGrade} ({toPersianDigits(target)} MPa)
                        </span>
                      </div>
                    </div>

                    {/* Technical Parameters Matrix */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">اسلامپ</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {toPersianDigits(report.slumpMm)} mm
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">شکست ۷ روزه</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {report.breaking7dStrengthMpa ? `${toPersianDigits(report.breaking7dStrengthMpa)} MPa` : '-'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">شکست ۲۸ روزه</span>
                        <strong className={`font-mono font-bold ${isTargetMet ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {report.breaking28dStrengthMpa ? `${toPersianDigits(report.breaking28dStrengthMpa)} MPa` : 'ثبت نشده'}
                        </strong>
                      </div>
                    </div>

                    {/* Operator & Date Info */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span>ثبت شده توسط: <strong>{report.operatorName}</strong></span>
                      <span>تاریخ نمونه‌گیری: <strong className="font-mono">{toPersianDigits(report.samplingDateJalali)}</strong></span>
                    </div>

                    {/* Photos Preview */}
                    {report.photos && report.photos.length > 0 && (
                      <div className="flex items-center gap-2">
                        {report.photos.map((p, i) => (
                          <div key={i} className="w-14 h-12 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100">
                            <img src={p} alt="Sample" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setReviewingReport(report);
                          setApprovalNotes('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>بررسی و تصمیم‌گیری نهایی</span>
                      </button>

                      <button
                        onClick={() => setEditingReport(JSON.parse(JSON.stringify(report)))}
                        className="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-medium transition"
                        title="ویرایش کامل داده‌های آزمایش"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setSelectedReportForCert(report)}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
                        title="پیش‌نمایش گواهی"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL REPORTS ARCHIVE                                                */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          
          {/* Controls & Search */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس شماره گزارش، کارفرما یا نام پروژه..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 pe-9 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">همه وضعیت‌ها ({toPersianDigits(reports.length)})</option>
                <option value="approved">تایید شده‌ها ({toPersianDigits(reports.filter(r => r.status === 'approved').length)})</option>
                <option value="pending">در انتظار تایید ({toPersianDigits(reports.filter(r => r.status === 'pending').length)})</option>
                <option value="rejected">مردود شده‌ها ({toPersianDigits(reports.filter(r => r.status === 'rejected').length)})</option>
              </select>

              <button
                onClick={handleExportAllReportsCsv}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
                title="دانلود فایل اکسل تمامی گزارش‌های آزمایشگاه"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>دانلود اکسل گزارش‌ها</span>
              </button>
            </div>
          </div>

          {/* Reports Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5 text-start">شماره گزارش</th>
                    <th className="p-3.5 text-start">کارفرما و پروژه</th>
                    <th className="p-3.5 text-start">رده بتن</th>
                    <th className="p-3.5 text-start">مقاومت ۷ روزه</th>
                    <th className="p-3.5 text-start">مقاومت ۲۸ روزه</th>
                    <th className="p-3.5 text-start">وضعیت تایید</th>
                    <th className="p-3.5 text-center">عملیات و گواهی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredReports.map((report) => {
                    return (
                      <tr key={report.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {report.reportNo}
                        </td>
                        <td className="p-3.5">
                          <strong className="block text-slate-900 dark:text-slate-100">{report.customerName}</strong>
                          <span className="text-[11px] text-slate-400">{report.projectName}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold font-mono text-[11px]">
                            {report.concreteGrade}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono">
                          {report.breaking7dStrengthMpa ? `${toPersianDigits(report.breaking7dStrengthMpa)} MPa` : '-'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {report.breaking28dStrengthMpa ? `${toPersianDigits(report.breaking28dStrengthMpa)} MPa` : '-'}
                        </td>
                        <td className="p-3.5">
                          {report.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              تایید نهایی
                            </span>
                          ) : report.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-[11px]">
                              <Clock className="w-3 h-3" />
                              در انتظار تایید
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px]">
                              <XCircle className="w-3 h-3" />
                              مردود
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditingReport(JSON.parse(JSON.stringify(report)))}
                              className="px-2 py-1.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100 font-bold text-[11px] flex items-center gap-1 transition"
                              title="ویرایش مشخصات گزارش"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>
                            <button
                              onClick={() => setSelectedReportForCert(report)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 font-bold text-[11px] flex items-center gap-1 transition"
                              title="مشاهده، چاپ و دانلود گواهی رسمی"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>چاپ گواهی</span>
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`آیا از حذف گزارش آزمایش شماره ${report.reportNo} اطمینان دارید؟`)) {
                                  labDb.deleteReport(report.id);
                                  setReports(labDb.getReports());
                                  setSuccessMessage(`گزارش آزمایش شماره ${report.reportNo} با موفقیت حذف گردید.`);
                                  setTimeout(() => setSuccessMessage(null), 3500);
                                }
                              }}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="حذف گزارش"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACCOUNTING & BILLING SUITE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'accounting' && (
        <div className="space-y-6">
          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full sm:w-fit border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setAccountingViewMode('project_balances')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                accountingViewMode === 'project_balances'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>مدیریت مالی پروژه‌ها و حساب کارفرمایان (تراز، مبالغ، واریزی‌ها)</span>
            </button>

            <button
              onClick={() => setAccountingViewMode('invoices_ledger')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                accountingViewMode === 'invoices_ledger'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>فاکتورهای رسمی و دفتر کل حسابداری (Invoices & Ledger)</span>
            </button>
          </div>

          {accountingViewMode === 'project_balances' && (
            <AdminFinancialManagementTab
              customers={customers}
              onCustomersUpdated={() => {
                setCustomers(labDb.getCustomers());
                setAccounting(labDb.getAccountingRecords());
              }}
            />
          )}

          {accountingViewMode === 'invoices_ledger' && (
            <div className="space-y-6">
              {/* Top Accounting Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>کل درآمد ثبت‌شده</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {toPersianDigits(totalIncome.toLocaleString())}
                <span className="text-xs font-sans text-slate-500 ms-1">تومان</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>کل هزینه‌های جاری</span>
                <DollarSign className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {toPersianDigits(totalExpense.toLocaleString())}
                <span className="text-xs font-sans text-slate-500 ms-1">تومان</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>سود خالص عملیاتی</span>
                <Wallet className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {toPersianDigits(netProfit.toLocaleString())}
                <span className="text-xs font-sans text-slate-500 ms-1">تومان</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>مطالبات وصول‌نشده</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {toPersianDigits(unpaidInvoicesAmount.toLocaleString())}
                <span className="text-xs font-sans text-slate-500 ms-1">تومان</span>
              </div>
            </div>

          </div>

          {/* Invoices List with Fast Create */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>فاکتورها و صورتحساب‌های رسمی آزمایشگاه</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  مدیریت صورتحساب‌های پروژه‌ها و پرداخت‌های آنلاین کارفرمایان
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportAdminInvoicesCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95"
                  title="دانلود خروجی اکسل فاکتورها"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>دانلود اکسل فاکتورها</span>
                </button>

                <button
                  onClick={() => setShowNewInvoiceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>صدور فاکتور جدید</span>
                </button>
              </div>
            </div>

            {/* Invoices Search & Status Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 w-full max-w-sm">
                <input
                  type="text"
                  value={adminInvoiceSearch}
                  onChange={(e) => setAdminInvoiceSearch(e.target.value)}
                  placeholder="جستجو بر اساس شماره فاکتور، کارفرما، پروژه..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 pe-8 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                <button
                  onClick={() => setAdminInvoiceStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    adminInvoiceStatusFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  همه ({toPersianDigits(invoices.length)})
                </button>
                <button
                  onClick={() => setAdminInvoiceStatusFilter('pending_settlement')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    adminInvoiceStatusFilter === 'pending_settlement'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-300/40 dark:border-amber-700/40'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>درخواست تسویه ({toPersianDigits(invoices.filter(i => i.status === 'pending_settlement').length)})</span>
                </button>
                <button
                  onClick={() => setAdminInvoiceStatusFilter('unpaid')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    adminInvoiceStatusFilter === 'unpaid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  معوق ({toPersianDigits(invoices.filter(i => i.status === 'unpaid').length)})
                </button>
                <button
                  onClick={() => setAdminInvoiceStatusFilter('paid')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    adminInvoiceStatusFilter === 'paid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  تسویه شده ({toPersianDigits(invoices.filter(i => i.status === 'paid').length)})
                </button>
              </div>
            </div>

            {/* Pending Settlement Requests Notification Banner */}
            {invoices.filter(i => i.status === 'pending_settlement').length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      {toPersianDigits(invoices.filter(i => i.status === 'pending_settlement').length)} فاکتور در صف تایید تسویه حساب توسط مشتریان
                    </h4>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      مشتری با زدن دکمه تسویه حساب به سیستم درخواست داده است؛ با زدن دکمه «تایید تسویه حساب»، تسویه نهایی اعمال شده و گواهینامه‌های کارفرما آزاد می‌گردند.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdminInvoiceStatusFilter('pending_settlement')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 transition cursor-pointer shadow-xs"
                >
                  مشاهده موارد نیازمند تایید
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-start">شماره فاکتور</th>
                    <th className="p-3 text-start">مشتری و پروژه</th>
                    <th className="p-3 text-start">مبلغ کل (با ارزش افزوده)</th>
                    <th className="p-3 text-start">تاریخ سررسید</th>
                    <th className="p-3 text-start">وضعیت پرداخت</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        فاکتوری با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                          {inv.invoiceNo}
                        </td>
                        <td className="p-3">
                          <strong className="block text-slate-900 dark:text-slate-100">{inv.customerName}</strong>
                          <span className="text-[11px] text-slate-400">{inv.projectName}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {toPersianDigits(inv.totalAmount.toLocaleString())} تومان
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {toPersianDigits(inv.dueDateJalali)}
                        </td>
                        <td className="p-3">
                          {inv.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              تسویه شده ({inv.paymentMethod === 'online' ? 'آنلاین' : 'پایا/بانکی'})
                            </span>
                          ) : inv.status === 'pending_settlement' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold text-[11px] border border-amber-300 dark:border-amber-700 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" />
                              درخواست تسویه مشتری (در انتظار تایید مدیر)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px]">
                              <Clock className="w-3 h-3" />
                              در انتظار پرداخت
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoiceForPrint(inv)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="مشاهده، چاپ و دانلود رسمی فاکتور"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>چاپ و دانلود</span>
                            </button>
                            <button
                              onClick={() => setEditingInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="ویرایش اقلام، مبالغ و تاریخ‌های فاکتور"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>ویرایش</span>
                            </button>
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  labDb.payInvoice(inv.id, 'bank_transfer');
                                  setInvoices(labDb.getInvoices());
                                  setSuccessMessage(`تسویه حساب فاکتور شماره ${inv.invoiceNo} (${inv.customerName}) با موفقیت توسط مدیر تایید شد. دسترسی کارفرما به گواهینامه‌ها آزاد گردید.`);
                                  setTimeout(() => setSuccessMessage(null), 5000);
                                }}
                                className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shadow-xs ${
                                  inv.status === 'pending_settlement'
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/80 shadow-emerald-600/30'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100'
                                }`}
                                title="تایید تسویه حساب و آزادسازی مدارک کارفرما"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{inv.status === 'pending_settlement' ? 'تایید تسویه حساب' : 'تسویه حساب'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>دفتر کل ثبت تراکنش‌های درآمد و هزینه (Ledger)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ثبت خریدهای قالب، کالیبراسیون جک، سوخت خودروهای نمونه‌گیری و وصولی‌ها
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportTransactionsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition active:scale-95"
                  title="دانلود خروجی اکسل دفتر کل تراکنش‌ها"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                  <span>دانلود اکسل تراکنش‌ها</span>
                </button>

                <button
                  onClick={() => setShowNewTransModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ثبت تراکنش جدید</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3 text-start">عنوان سند</th>
                    <th className="p-3 text-start">نوع</th>
                    <th className="p-3 text-start">دسته‌بندی</th>
                    <th className="p-3 text-start">مبلغ</th>
                    <th className="p-3 text-start">تاریخ</th>
                    <th className="p-3 text-start">شماره پیگیری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accounting.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                        {rec.title}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          rec.type === 'income' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {rec.type === 'income' ? 'درآمد' : 'هزینه'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">
                        {rec.category}
                      </td>
                      <td className={`p-3 font-mono font-bold ${
                        rec.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {rec.type === 'income' ? '+' : '-'}{toPersianDigits(rec.amount.toLocaleString())} تومان
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {toPersianDigits(rec.jalaliDate)}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {rec.referenceNo || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GEMINI AI ENGINEERING & FINANCIAL AUDIT SUITE                      */}
      {/* ========================================================================= */}
      {activeTab === 'ai_suite' && (
        <div className="space-y-6">
          
          {/* Top Explainer */}
          <div className="bg-gradient-to-tr from-indigo-900 via-blue-900 to-purple-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur text-amber-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>هوش مصنوعی تخصصی مهندسی بتن و ممیزی مالی (Gemini AI Engine)</span>
                </h2>
                <p className="text-xs text-blue-200">
                  تحلیل مدل‌های هیدراسیون ACI 209R، پیش‌بینی هوشمند مقاومت ۲۸ روزه و حسابرسی مالی آزمایشگاه
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Concrete 28-Day Strength Predictor */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    پیش‌بینی هوشمند مقاومت ۲۸ روزه بر اساس آزمایش ۷ روزه
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  ACI 209R Maturation
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    رده مقاومتی هدف
                  </label>
                  <select
                    value={aiGrade}
                    onChange={(e) => setAiGrade(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="C20">C20 (مقاومت ۲۰ MPa)</option>
                    <option value="C25">C25 (مقاومت ۲۵ MPa)</option>
                    <option value="C30">C30 (مقاومت ۳۰ MPa)</option>
                    <option value="C35">C35 (مقاومت ۳۵ MPa)</option>
                    <option value="C40">C40 (مقاومت ۴۰ MPa)</option>
                    <option value="C50">C50 (مقاومت ۵۰ MPa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    مقاومت شکسته شده ۷ روزه (MPa)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ai7dStrength}
                    onChange={(e) => setAi7dStrength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    اسلامپ اندازه‌گیری شده (mm)
                  </label>
                  <input
                    type="number"
                    value={aiSlump}
                    onChange={(e) => setAiSlump(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    نسبت آب به سیمان (W/C)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={aiWcRatio}
                    onChange={(e) => setAiWcRatio(parseFloat(e.target.value) || 0.45)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleRunAiPrediction}
                disabled={aiPredicting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-70"
              >
                {aiPredicting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>محاسبه و تحلیل هوش مصنوعی Gemini</span>
                  </>
                )}
              </button>

              {/* AI Prediction Outcome */}
              {aiPredictionResult && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">پیش‌بینی مقاومت ۲۸ روزه:</span>
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                      {toPersianDigits(aiPredictionResult.predicted28dStrength)} MPa
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">احتمال قبولی در مبحث ۹:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full ${
                      aiPredictionResult.targetCompliance === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {aiPredictionResult.targetCompliance === 'PASS' ? 'منطبق (PASS)' : 'نیازمند مراقبت'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-800">
                    {aiPredictionResult.analysisFa}
                  </p>

                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 block">توصیه‌های فنی عمل‌آوری:</span>
                    {aiPredictionResult.recommendationsFa.map((rec, i) => (
                      <div key={i} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* 2. Executive Financial Audit Generator */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    حسابرسی و ممیزی مالی هوشمند آزمایشگاه
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  AI Financial Auditor
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                بررسی نسبت‌های سودآوری، هزینه‌های نمونه‌برداری، وضعیت مطالبات معوق و ارائه استراتژی‌های کاهش بهای تمام‌شده.
              </p>

              <button
                onClick={handleRunAiAudit}
                disabled={aiAuditLoading}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 transition disabled:opacity-70"
              >
                {aiAuditLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>تولید گزارش تفسیری حسابرسی هوش مصنوعی</span>
                  </>
                )}
              </button>

              {aiFinancialAudit && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">حاشیه سود خالص عملیاتی:</span>
                    <span className="text-base font-black text-emerald-600 font-mono">
                      {toPersianDigits(aiFinancialAudit.profitMargin)}٪
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-800">
                    {aiFinancialAudit.executiveSummaryFa}
                  </p>

                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 block">نکات کلیدی پایش مالی:</span>
                    {aiFinancialAudit.keyObservationsFa.map((obs, i) => (
                      <div key={i} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500 block">راهکارهای بهینه‌سازی هزینه‌ها:</span>
                    {aiFinancialAudit.costOptimizationTipsFa.map((tip, i) => (
                      <div key={i} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMERS DIRECTORY                                                */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                دایرکتوری شرکت‌های ساختمانی و کارفرمایان طرف قرارداد
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فهرست پیمانکاران، پروژه‌های تحت پوشش و مشخصات نمایندگان رسمی
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="جستجوی شرکت، نماینده یا پروژه..."
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 pe-8 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => setShowTrashModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition active:scale-95 shrink-0 cursor-pointer"
                title="مشاهده و بازگردانی کارفرمایان حذف‌شده"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>پوشه حذفیات</span>
                {labDb.getTrashCustomers().length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px]">
                    {toPersianDigits(labDb.getTrashCustomers().length)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowContractRegistrationModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>ثبت شرکت و صدور قرارداد جدید</span>
              </button>
            </div>
          </div>

          {customers.filter(c => 
            c.companyName.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.representativeName.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.projectNames.some(p => p.toLowerCase().includes(customerSearch.toLowerCase()))
          ).length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-400 text-xs">
              کارفرمایی با این مشخصات یافت نشد.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {customers.filter(c => 
                c.companyName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.representativeName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.projectNames.some(p => p.toLowerCase().includes(customerSearch.toLowerCase()))
              ).map((cust) => (
                <div
                  key={cust.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs hover:border-blue-400 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {cust.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const matchedUser = allUsers.find(u => u.customerId === cust.id || (u.phone && cust.phone && u.phone === cust.phone));
                          if (matchedUser && onSwitchUser) {
                            onSwitchUser(matchedUser);
                          } else {
                            onSwitchUser?.({
                              id: `usr-${cust.id}`,
                              email: cust.email,
                              username: cust.phone?.slice(-6) || cust.id,
                              fullName: `${cust.representativeName} (${cust.companyName})`,
                              role: 'customer',
                              customerId: cust.id,
                              phone: cust.phone,
                              status: 'active'
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 transition cursor-pointer"
                        title="ورود به پرتال این مشتری (مشاهده پنل و مالی از دید مشتری)"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCustomerForQrCard(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition"
                        title="صدور و دانلود کارت ورود QR هوشمند"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedCustomerForContract(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition"
                        title="چاپ قرارداد رسمی"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingCustomerForContract(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                        title="ویرایش مشخصات جامع و مالی قرارداد"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCustomerToDelete(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="انتقال به پوشه حذفیات"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {cust.companyName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      نماینده: {cust.representativeName}
                    </p>
                  </div>

                  {/* Financial Status Summary */}
                  {(cust.totalContractAmount !== undefined && cust.totalContractAmount > 0) && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>مبلغ قرارداد:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {toPersianDigits(cust.totalContractAmount.toLocaleString())} تومان
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600">
                        <span>واریز شده:</span>
                        <span className="font-mono font-bold">
                          {toPersianDigits((cust.paidAmount || 0).toLocaleString())} تومان
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">مانده بدهی:</span>
                        <span className={`font-mono font-bold ${(cust.balance ?? ((cust.totalContractAmount || 0) - (cust.paidAmount || 0))) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {toPersianDigits((cust.balance ?? Math.max(0, (cust.totalContractAmount || 0) - (cust.paidAmount || 0))).toLocaleString())} تومان
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">تلفن:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200" dir="ltr" style={{ unicodeBidi: 'isolate' }}>{cust.phone}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">ایمیل:</span>
                      <span className="font-mono text-[11px]">{cust.email}</span>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-400 block mb-1">پروژه‌های تحت آزمایش:</span>
                      <div className="flex flex-wrap gap-1">
                        {cust.projectNames.map((proj, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                            {proj}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: USERS MANAGEMENT (STAFF & LAB PERSONNEL CONTROL)                   */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Top Header & Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold mb-1 border border-blue-200 dark:border-blue-800/60">
                <Users className="w-3.5 h-3.5" />
                <span>مدیریت دسترسی‌ها و پرسنل آزمایشگاه</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                مدیریت کاربران، تکنسین‌ها و مدیران آزمایشگاه
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مدیریت حساب‌های کاربری پرسنل و تعیین نقش‌های فنی (مشتریان و کارفرمایان در بخش اختصاصی «مشتریان و پروژه‌ها» مدیریت می‌شوند).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="جستجوی نام، ایمیل، شناسه یا شماره پرسنلی..."
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 pe-9 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
                />
                <Search className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => setShowTechsModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
              >
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>مدیریت تکنسین‌های مسئول اعزام</span>
              </button>

              <button
                onClick={() => {
                  setNewUserData({
                    fullName: '',
                    email: '',
                    username: '',
                    phone: '',
                    role: 'operator',
                    password: generateRandomPassword(),
                    customerId: ''
                  });
                  setShowNewUserModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95 shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>تعریف کاربر جدید پرسنل</span>
              </button>
            </div>
          </div>

          {/* User Stat Counters & Role Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setUserRoleFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  userRoleFilter === 'all' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                همه کاربران ({toPersianDigits(profiles.length)})
              </button>
              <button
                onClick={() => setUserRoleFilter('staff')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  userRoleFilter === 'staff' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                پرسنل فنی و آزمایشگاه ({toPersianDigits(profiles.filter(p => p.role === 'admin' || p.role === 'operator').length)})
              </button>
              <button
                onClick={() => setUserRoleFilter('customer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  userRoleFilter === 'customer' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                کارفرمایان و مشتریان ({toPersianDigits(profiles.filter(p => p.role === 'customer').length)})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 block">کل حساب‌های کاربری</span>
              <strong className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1 block">
                {toPersianDigits(profiles.length)}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 block">مدیر ارشد سامانه (ثابت و یکتا)</span>
              <strong className="text-xl font-black text-purple-700 dark:text-purple-300 font-mono mt-1 block">
                {toPersianDigits(1)} حساب واحد
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">اپراتورها و تکنسین‌های فنی</span>
              <strong className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                {toPersianDigits(profiles.filter(p => p.role === 'operator').length)}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 block">کارفرمایان متصل</span>
              <strong className="text-xl font-black text-cyan-700 dark:text-cyan-300 font-mono mt-1 block">
                {toPersianDigits(profiles.filter(p => p.role === 'customer').length)}
              </strong>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3.5 text-start">مشخصات کاربر</th>
                    <th className="p-3.5 text-start">نام کاربری / ایمیل</th>
                    <th className="p-3.5 text-start">نقش و دسترسی</th>
                    <th className="p-3.5 text-start">شماره تماس</th>
                    <th className="p-3.5 text-start">رمز عبور جاری</th>
                    <th className="p-3.5 text-start">وضعیت</th>
                    <th className="p-3.5 text-center">عملیات مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {profiles
                    .filter(p => {
                      if (!p) return false;
                      if (userRoleFilter === 'staff') return p.role === 'admin' || p.role === 'operator';
                      if (userRoleFilter === 'customer') return p.role === 'customer';
                      return true;
                    })
                    .filter(p => {
                      const s = (userSearch || '').trim().toLowerCase();
                      if (!s) return true;
                      const name = (p.fullName || p.username || '').toLowerCase();
                      const email = (p.email || '').toLowerCase();
                      const uname = (p.username || '').toLowerCase();
                      const phone = (p.phone || '');
                      return name.includes(s) || email.includes(s) || uname.includes(s) || phone.includes(s);
                    }).map((p) => {
                    const cust = customers.find(c => c.id === p.customerId);
                    const displayName = p.fullName || p.username || 'کاربر سیستم';
                    const isAdmin = p.id === 'usr-admin-01' || p.username === 'admin' || p.role === 'admin';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        {/* Name & ID */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {displayName}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            شناسه: {p.id}
                          </span>
                        </td>

                        {/* Email & Username */}
                        <td className="p-3.5">
                          <div className="font-mono text-slate-800 dark:text-slate-200 font-medium" dir="ltr">
                            {p.email || '-'}
                          </div>
                          {p.username && (
                            <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                              کد کاربری: {p.username}
                            </div>
                          )}
                        </td>

                        {/* Role */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            {isAdmin ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-xs">
                                <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                <span>مدیر ارشد سامانه (واحد و یکتا)</span>
                              </div>
                            ) : (
                              <select
                                value={p.role}
                                onChange={async (e) => {
                                  const newRole = e.target.value as 'operator' | 'customer';
                                  if (newRole === p.role) return;
                                  const roleTitle = newRole === 'operator' ? 'اپراتور و تکنسین بتن' : 'مشتری و کارفرما';
                                  const ok = window.confirm(`آیا می‌خواهید نقش کاربر «${p.fullName}» به «${roleTitle}» تغییر کند؟`);
                                  if (!ok) return;
                                  try {
                                    await labDb.updateUserRole(p.id, newRole);
                                    setProfiles(labDb.getProfiles());
                                    setSuccessMessage(`نقش کاربر «${p.fullName}» با موفقیت به «${roleTitle}» تغییر یافت و ذخیره شد.`);
                                    setTimeout(() => setSuccessMessage(null), 3500);
                                  } catch (err: any) {
                                    alert(err?.message || 'خطا در تغییر نقش کاربر در سرور.');
                                    setProfiles(labDb.getProfiles());
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] cursor-pointer outline-none border transition ${
                                  p.role === 'operator'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                                    : p.role === 'admin'
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                {p.role === 'admin' && (
                                  <option value="admin" disabled>مدیر ارشد (غیرقابل تغییر)</option>
                                )}
                                <option value="operator">اپراتور و تکنسین بتن</option>
                                <option value="customer">مشتری و کارفرما</option>
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                          {p.phone || '-'}
                        </td>

                        {/* Password display & quick change */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]" dir="ltr">
                              {p.password || '******'}
                            </span>
                            <button
                              onClick={() => {
                                if (isAdmin) {
                                  setShowAdminSmsPasswordModal(true);
                                } else {
                                  setPasswordResetUser(p);
                                  setNewPasswordValue(p.password || '');
                                }
                              }}
                              className={`p-1 rounded transition ${isAdmin ? 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'}`}
                              title={isAdmin ? "تغییر رمز عبور مدیر با تایید پیامکی (OTP)" : "تغییر سریع رمز عبور"}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            فعال
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* QR Voucher View */}
                            <button
                              onClick={() => {
                                setViewingQrUser({
                                  user: p,
                                  customer: cust,
                                  password: p.password
                                });
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                              title="مشاهده و چاپ کارت ورود و کد QR"
                            >
                              <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>

                            {/* Edit Profile - ONLY FOR NON-ADMINS */}
                            {!isAdmin ? (
                              <button
                                onClick={() => {
                                  setEditingUser(JSON.parse(JSON.stringify(p)));
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition"
                                title="ویرایش مشخصات کاربر"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            ) : (
                              <span
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-400 cursor-not-allowed opacity-60"
                                title="مشخصات پروفایل مدیر ارشد ثابت و غیرقابل ویرایش مستقیم است"
                              >
                                <ShieldCheck className="w-4 h-4 text-purple-400" />
                              </span>
                            )}

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                if (isAdmin) {
                                  setShowAdminSmsPasswordModal(true);
                                } else {
                                  setPasswordResetUser(p);
                                  setNewPasswordValue(p.password || '');
                                }
                              }}
                              className={`p-1.5 rounded-lg transition ${isAdmin ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400' : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400'}`}
                              title={isAdmin ? "تغییر رمز عبور مدیر از طریق تایید پیامکی (OTP)" : "تغییر کلمه عبور"}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Delete User */}
                            {!isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm(`آیا از حذف حساب کاربری "${displayName}" اطمینان دارید؟`)) {
                                    labDb.deleteProfile(p.id);
                                    setProfiles(labDb.getProfiles());
                                    setSuccessMessage(`حساب کاربری "${displayName}" با موفقیت حذف شد.`);
                                    setTimeout(() => setSuccessMessage(null), 3500);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
                                title="حذف کاربر"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: EQUIPMENT & CALIBRATION MANAGEMENT                                 */}
      {/* ========================================================================= */}
      {activeTab === 'calibrations' && (
        <EquipmentCalibrationTab />
      )}

      {/* ========================================================================= */}
      {/* TAB 8: TECHNICIAN FIELD DISPATCHES CONTROL                                */}
      {/* ========================================================================= */}
      {activeTab === 'dispatches' && (
        <DispatchesManagementTab />
      )}

      {/* ========================================================================= */}
      {/* TAB 9: CURING TANK & ENVIRONMENTAL SENSOR LOGS                           */}
      {/* ========================================================================= */}
      {activeTab === 'env_logs' && (
        <EnvironmentalLogsTab />
      )}

      {/* ========================================================================= */}
      {/* TAB 10: OFFICIAL SETTINGS & STANDARD TECHNICAL SHEETS                    */}
      {/* ========================================================================= */}
      {activeTab === 'forms' && (
        <AdminSettingsAndSheets />
      )}

      {/* ========================================================================= */}
      {/* MODAL: APPROVAL REVIEW DRAWER / MODAL                                     */}
      {/* ========================================================================= */}
      {reviewingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  بررسی فنی و تایید صدور گواهینامه {reviewingReport.reportNo}
                </h3>
                <p className="text-xs text-slate-500">
                  کارفرما: {reviewingReport.customerName}
                </p>
              </div>
              <button
                onClick={() => setReviewingReport(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block">رده بتن هدف:</span>
                  <strong className="text-blue-600 text-sm font-bold font-mono">
                    {reviewingReport.concreteGrade} ({toPersianDigits(reviewingReport.targetStrengthMpa)} MPa)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">مقاومت حاصل شده ۲۸ روزه:</span>
                  <strong className="text-emerald-600 text-sm font-bold font-mono">
                    {reviewingReport.breaking28dStrengthMpa ? `${toPersianDigits(reviewingReport.breaking28dStrengthMpa)} MPa` : 'ثبت نشده'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  یادداشت و توضیحات مدیر فنی (جهت درج در گواهینامه رسمی):
                </label>
                <textarea
                  rows={3}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="مقاومت فشاری ۲۸ روزه بر ضوابط مبحث ۹ مقررات ملی ساختمان انطباق دارد..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={approvalLoading}
                onClick={() => handleProcessApproval('approved')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید نهایی و صدور گواهینامه معتبر</span>
              </button>

              <button
                disabled={approvalLoading}
                onClick={() => handleProcessApproval('rejected')}
                className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 font-bold text-xs transition"
              >
                عدم تایید (مردود)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW INVOICE MODAL                                                  */}
      {/* ========================================================================= */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                صدور فاکتور رسمی خدمات آزمایشگاهی
              </h3>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  انتخاب کارفرما / شرکت *
                </label>
                <select
                  required
                  value={invoiceCustomerId}
                  onChange={(e) => {
                    setInvoiceCustomerId(e.target.value);
                    const c = customers.find(x => x.id === e.target.value);
                    if (c && c.projectNames.length > 0) setInvoiceProject(c.projectNames[0]);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold"
                >
                  <option value="">-- انتخاب شرکت --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نام پروژه
                </label>
                <input
                  type="text"
                  value={invoiceProject}
                  onChange={(e) => setInvoiceProject(e.target.value)}
                  placeholder="برج مسکونی یاس"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ پایه فاکتور (تومان) *
                </label>
                <input
                  type="number"
                  required
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <JalaliDatePicker
                  label="تاریخ سررسید پرداخت"
                  value={invoiceDueDate}
                  onChange={setInvoiceDueDate}
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-800 dark:text-blue-300">
                مبلغ نهایی با محاسبه ۱۰٪ مالیات بر ارزش افزوده: <strong className="font-mono">{(invoiceAmount * 1.1).toLocaleString('fa-IR')} تومان</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  صدور و ثبت فاکتور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW CUSTOMER MODAL                                                 */}
      {/* ========================================================================= */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ثبت مشخصات شرکت / کارفرمای جدید
              </h3>
              <button onClick={() => setShowNewCustomerModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">نام شرکت / شخصیت حقوقی *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="شرکت مهندسی عمران..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">نام نماینده / مدیر پروژه *</label>
                  <input
                    type="text"
                    required
                    value={newCustRep}
                    onChange={(e) => setNewCustRep(e.target.value)}
                    placeholder="مهندس علیزاده"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">تلفن تماس *</label>
                  <input
                    type="text"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="021-8845..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">ایمیل جهت ورود به پرتال *</label>
                <input
                  type="email"
                  required
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="contractor@domain.ir"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">پروژه‌ها (با کاما جدا کنید)</label>
                <input
                  type="text"
                  value={newCustProjects}
                  onChange={(e) => setNewCustProjects(e.target.value)}
                  placeholder="مجتمع نگین, برج یاس"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">نشانی کارگاه / دفتر مرکزی</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="تهران، خیابان..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  ذخیره شرکت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW TRANSACTION MODAL                                              */}
      {/* ========================================================================= */}
      {showNewTransModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ثبت سند مالی جدید در دفتر کل
              </h3>
              <button onClick={() => setShowNewTransModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">عنوان سند *</label>
                <input
                  type="text"
                  required
                  value={transTitle}
                  onChange={(e) => setTransTitle(e.target.value)}
                  placeholder="خرید قالب مکعبی چدنی..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">نوع تراکنش</label>
                  <select
                    value={transType}
                    onChange={(e) => setTransType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="income">درآمد (+)</option>
                    <option value="expense">هزینه (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">دسته‌بندی</label>
                  <select
                    value={transCategory}
                    onChange={(e) => setTransCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="خدمات آزمایشگاهی">خدمات آزمایشگاهی</option>
                    <option value="نگهداری و کالیبراسیون">نگهداری و کالیبراسیون</option>
                    <option value="ابزار و ملزومات مصرفی">ابزار و ملزومات مصرفی</option>
                    <option value="حمل و نقل و لجستیک">حمل و نقل و لجستیک</option>
                    <option value="حقوق و دستمزد">حقوق و دستمزد</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">مبلغ (تومان) *</label>
                <input
                  type="number"
                  required
                  value={transAmount}
                  onChange={(e) => setTransAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <JalaliDatePicker
                  label="تاریخ تراکنش"
                  value={transDate}
                  onChange={setTransDate}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTransModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md"
                >
                  ثبت سند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CERTIFICATE VIEWER & PRINTER                                       */}
      {/* ========================================================================= */}
      {selectedReportForCert && (
        <PrintCertificate
          report={selectedReportForCert}
          customer={customers.find(c => c.id === selectedReportForCert.customerId)}
          onClose={() => setSelectedReportForCert(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: INVOICE VIEWER & PRINTER                                           */}
      {/* ========================================================================= */}
      {selectedInvoiceForPrint && (
        <PrintInvoiceModal
          invoice={selectedInvoiceForPrint}
          customer={customers.find(c => c.id === selectedInvoiceForPrint.customerId)}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: INVOICE EDIT MODAL                                                 */}
      {/* ========================================================================= */}
      {editingInvoice && (
        <AdminInvoiceEditModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaveSuccess={(updated) => {
            setInvoices(labDb.getInvoices());
            setEditingInvoice(null);
            setSuccessMessage(`فاکتور شماره ${updated.invoiceNo} با موفقیت ویرایش و مبالغ آن بروزرسانی گردید.`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTRACT VIEWER & PRINTER                                          */}
      {/* ========================================================================= */}
      {selectedCustomerForContract && (
        <PrintContractModal
          customer={selectedCustomerForContract}
          onClose={() => setSelectedCustomerForContract(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTRACT REGISTRATION & EDIT MODAL                                 */}
      {/* ========================================================================= */}
      {showContractRegistrationModal && (
        <AdminCustomerContractModal
          isOpen={showContractRegistrationModal}
          onClose={() => setShowContractRegistrationModal(false)}
          onSaved={(savedCust, createdUser, password) => {
            setShowContractRegistrationModal(false);
            setCustomers(labDb.getCustomers());
            if (createdUser && password) {
              setViewingQrUser({
                user: createdUser,
                customer: savedCust,
                password: password
              });
            }
          }}
        />
      )}

      {editingCustomerForContract && (
        <AdminCustomerContractModal
          isOpen={!!editingCustomerForContract}
          customer={editingCustomerForContract}
          onClose={() => setEditingCustomerForContract(null)}
          onSaved={() => {
            setEditingCustomerForContract(null);
            setCustomers(labDb.getCustomers());
          }}
        />
      )}

      {customerForQrCard && (
        <React.Suspense fallback={null}>
          <QrAccessCardModal
            customer={customerForQrCard}
            user={profiles.find(p => p.customerId === customerForQrCard.id)}
            onClose={() => setCustomerForQrCard(null)}
          />
        </React.Suspense>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT REPORT MODAL (ADMIN COMPLETE OVERSIGHT)                       */}
      {/* ========================================================================= */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-blue-600" />
                  <span>ویرایش جامع مشخصات گزارش آزمایش</span>
                </h3>
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {editingReport.reportNo}
                </span>
              </div>
              <button onClick={() => setEditingReport(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Auto calculate isPassed based on strength vs target
                const maxStrength = editingReport.breaking28dStrengthMpa || editingReport.breaking7dStrengthMpa || 0;
                const isPassed = maxStrength >= (editingReport.breaking28dStrengthMpa ? editingReport.targetStrengthMpa : editingReport.targetStrengthMpa * 0.65);
                labDb.updateReport({
                  ...editingReport,
                  isPassed
                });
                setEditingReport(null);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">نام کارفرما / شرکت</label>
                  <input
                    type="text"
                    required
                    value={editingReport.customerName}
                    onChange={(e) => setEditingReport({ ...editingReport, customerName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">نام پروژه کارگاهی</label>
                  <input
                    type="text"
                    required
                    value={editingReport.projectName}
                    onChange={(e) => setEditingReport({ ...editingReport, projectName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">محل نمونه‌گیری / المان سازه‌ای</label>
                  <input
                    type="text"
                    required
                    value={editingReport.sampleLocation}
                    onChange={(e) => setEditingReport({ ...editingReport, sampleLocation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">رده بتن</label>
                  <select
                    value={editingReport.concreteGrade}
                    onChange={(e) => {
                      const grade = e.target.value;
                      const target = parseFloat(grade.replace(/[^0-9.]/g, '')) || 25;
                      setEditingReport({ ...editingReport, concreteGrade: grade, targetStrengthMpa: target });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  >
                    <option value="C20">C20 (20 MPa)</option>
                    <option value="C25">C25 (25 MPa)</option>
                    <option value="C30">C30 (30 MPa)</option>
                    <option value="C35">C35 (35 MPa)</option>
                    <option value="C40">C40 (40 MPa)</option>
                    <option value="C45">C45 (45 MPa)</option>
                    <option value="C50">C50 (50 MPa)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">مقاومت فشاری مشخصه هدف (MPa)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingReport.targetStrengthMpa}
                    onChange={(e) => setEditingReport({ ...editingReport, targetStrengthMpa: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">اسلامپ بتن تازه (mm)</label>
                  <input
                    type="number"
                    required
                    value={editingReport.slumpMm}
                    onChange={(e) => setEditingReport({ ...editingReport, slumpMm: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">دمای بتن تازه (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingReport.temperatureC || ''}
                    onChange={(e) => setEditingReport({ ...editingReport, temperatureC: parseFloat(e.target.value) || 0 })}
                    placeholder="مثلا 24.5"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">مقاومت فشاری ۷ روزه (MPa)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingReport.breaking7dStrengthMpa || ''}
                    onChange={(e) => setEditingReport({ ...editingReport, breaking7dStrengthMpa: parseFloat(e.target.value) || undefined })}
                    placeholder="مثلا 18.5"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">مقاومت فشاری ۲۸ روزه (MPa)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingReport.breaking28dStrengthMpa || ''}
                    onChange={(e) => setEditingReport({ ...editingReport, breaking28dStrengthMpa: parseFloat(e.target.value) || undefined })}
                    placeholder="مثلا 32.4"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">وزن مخصوص بتن سخت شده</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingReport.densityKgM3 || ''}
                    onChange={(e) => setEditingReport({ ...editingReport, densityKgM3: parseFloat(e.target.value) || undefined })}
                    placeholder="مثلا 2350"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">تاریخ نمونه‌گیری (شمسی)</label>
                  <input
                    type="text"
                    required
                    value={editingReport.samplingDateJalali}
                    onChange={(e) => setEditingReport({ ...editingReport, samplingDateJalali: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">وضعیت تایید و انتشار در پرتال</label>
                  <select
                    value={editingReport.status}
                    onChange={(e) => setEditingReport({ ...editingReport, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="approved">تایید شده و قابل مشاهده توسط مشتری (Approved)</option>
                    <option value="pending">در انتظار تایید مدیر فنی (Pending)</option>
                    <option value="rejected">مردود شده (Rejected)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">توضیحات و یادداشت فنی مدیر / آزمایشگاه</label>
                <textarea
                  rows={2}
                  value={editingReport.approvalNotes || ''}
                  onChange={(e) => setEditingReport({ ...editingReport, approvalNotes: e.target.value })}
                  placeholder="ملاحظات فنی..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  ذخیره تغییرات گزارش
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT CUSTOMER MODAL (ADMIN COMPLETE OVERSIGHT)                      */}
      {/* ========================================================================= */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>ویرایش اطلاعات شرکت / کارفرما</span>
              </h3>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                labDb.updateCustomer(editingCustomer);
                setEditingCustomer(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">نام شرکت / شخصیت حقوقی *</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.companyName}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, companyName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">نام نماینده رسمی *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.representativeName}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, representativeName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">شماره تماس *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">ایمیل *</label>
                <input
                  type="email"
                  required
                  value={editingCustomer.email}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">پروژه‌ها (با کاما جدا کنید)</label>
                <input
                  type="text"
                  value={editingCustomer.projectNames.join(', ')}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, projectNames: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">نشانی دفتر / پروژه</label>
                <input
                  type="text"
                  value={editingCustomer.address}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  ذخیره تغییرات شرکت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER PROFILE (ADMIN OVERSIGHT)                                */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <span>ویرایش حساب کاربری</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingUser.id === 'usr-admin-01' || editingUser.username === 'admin') {
                  editingUser.role = 'admin';
                } else if (editingUser.role === 'admin') {
                  editingUser.role = 'operator';
                }
                await labDb.updateProfile(editingUser);
                setProfiles(labDb.getProfiles());
                if (currentUser.id === editingUser.id) {
                  if (editingUser.password) currentUser.password = editingUser.password;
                  if (editingUser.role) currentUser.role = editingUser.role;
                }
                setSuccessMessage(`مشخصات و نقش کاربر "${editingUser.fullName}" با موفقیت ذخیره و در تمامی دستگاه‌ها اعمال شد.`);
                setTimeout(() => setSuccessMessage(null), 3500);
                setEditingUser(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">نام و نام خانوادگی *</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">نام کاربری (کد ورود) *</label>
                <input
                  type="text"
                  required
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">کلمه عبور (Password)</label>
                <input
                  type="text"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder="کلمه عبور دلخواه کاربر..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">ایمیل کاربری *</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">شماره همراه</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">نقش و سطح دسترسی</label>
                {(editingUser.id === 'usr-admin-01' || editingUser.username === 'admin') ? (
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      مدیر ارشد سامانه (حساب واحد و یکتا)
                    </span>
                    <span className="text-[10px] bg-purple-200/60 dark:bg-purple-900/60 px-2 py-0.5 rounded-md">ثابت و غیرقابل تغییر</span>
                  </div>
                ) : (
                  <div>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      <option value="operator">اپراتور / تکنسین آزمایشگاه بتن</option>
                      <option value="customer">مشتری / کارفرما (مشاهده نتایج و سوابق)</option>
                    </select>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                      🛡️ دسترسی مدیریت آزمایشگاه کاملاً اختصاصی و ثابت بوده و به کاربران دیگر اعطا نمی‌شود.
                    </span>
                  </div>
                )}
              </div>

              {editingUser.role === 'customer' && (
                <div>
                  <label className="block font-bold mb-1">شرکت متصل به حساب</label>
                  <select
                    value={editingUser.customerId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, customerId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">-- بدون اتصال مستقیم به شرکت --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.representativeName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  ذخیره تغییرات کاربر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESET / CHANGE PASSWORD                                            */}
      {/* ========================================================================= */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>تغییر رمز عبور کاربر</span>
              </h3>
              <button onClick={() => setPasswordResetUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/60">
              <span className="text-[11px] text-amber-800 dark:text-amber-300 block">
                تغییر کلمه عبور برای: <strong>{passwordResetUser.fullName}</strong>
              </span>
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 block mt-0.5" dir="ltr">
                {passwordResetUser.email}
              </span>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newPasswordValue.trim()) return;
                const newPass = newPasswordValue.trim();
                const ok = await labDb.updateUserPassword(passwordResetUser.id, newPass);
                if (ok) {
                  const latestProfiles = labDb.getProfiles();
                  setProfiles(latestProfiles);
                  // FIX: do NOT mirror the plaintext password into the live
                  // currentUser object — it would leak into localStorage and
                  // any state serialization. The server holds the credential.
                  setSuccessMessage(`رمز عبور کاربر "${passwordResetUser.fullName}" با موفقیت تغییر یافت و در تمامی دستگاه‌ها اعمال گردید.`);
                  setTimeout(() => setSuccessMessage(null), 4000);
                  setPasswordResetUser(null);
                } else {
                  const serverErr = (labDb as any).lastWriteError as string | null;
                  setSuccessMessage(serverErr || 'تغییر رمز عبور در سرور ناموفق بود. لطفاً مجدداً تلاش کنید.');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">کلمه عبور جدید *</label>
                <input
                  type="text"
                  required
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="رمز عبور دلخواه را وارد کنید..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewPasswordValue('azma' + Math.floor(1000 + Math.random() * 9000))}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                >
                  تولید رمز تصادفی
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md"
                >
                  ثبت رمز جدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW USER                                                    */}
      {/* ========================================================================= */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>تعریف کاربر جدید در سامانه</span>
              </h3>
              <button onClick={() => setShowNewUserModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if ((newUserData.role as string) === 'admin') {
                  alert('تعریف مدیر جدید مجاز نمی‌باشد. این سیستم دارای یک مدیر ارشد واحد است.');
                  return;
                }
                // BUG FIX (ID collision): bare timestamp could collide for two
                // technicians added in the same millisecond — use uniqueId().
                const newId = uniqueId('usr-tech');
                try {
                  const created = await labDb.addProfile({
                    id: newId,
                    fullName: newUserData.fullName.trim(),
                    email: newUserData.email.trim(),
                    username: newUserData.username.trim() || newUserData.email.split('@')[0],
                    phone: newUserData.phone.trim(),
                    role: 'operator',
                    status: 'active',
                    password: newUserData.password.trim() || generateRandomPassword(),
                    createdAt: new Date().toISOString()
                  });
                  setShowNewUserModal(false);
                  setProfiles(labDb.getProfiles());
                  setSuccessMessage(`حساب کاربری پرسنل «${created.fullName}» با نقش اپراتور فنی با موفقیت تعریف شد.`);
                  setTimeout(() => setSuccessMessage(null), 3500);
                } catch (err: any) {
                  alert(err?.message || 'خطا در ثبت کاربر جدید در سرور.');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/70 dark:border-blue-800/50 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                <strong>توجه:</strong> ایجاد حساب کاربری مشتریان و کارفرمایان صرفاً پس از تشکیل و ثبت قرارداد در بخش قراردادها به صورت خودکار انجام می‌پذیرد. این بخش منحصراً جهت تعریف اپراتورها و تکنسین‌های آزمایشگاه بتن می‌باشد.
              </div>

              <div>
                <label className="block font-bold mb-1">نام و نام خانوادگی پرسنل *</label>
                <input
                  type="text"
                  required
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                  placeholder="مثلا: مهندس رضا محمدی"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">نام کاربری (کد ورود) *</label>
                  <input
                    type="text"
                    required
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    placeholder="مثلا: reza_m"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">کلمه عبور *</label>
                  <input
                    type="text"
                    required
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">ایمیل *</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">شماره همراه</label>
                <input
                  type="text"
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  placeholder="0913..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">نقش و سطح دسترسی کاربر</label>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
                  <span>اپراتور و تکنسین آزمایشگاه بتن (Operator)</span>
                  <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">دسترسی پرسنل فنی</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  ایجاد حساب کاربری پرسنل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QR CODE VOUCHER & ACCESS CARD (ADMIN VIEW / PRINT)                 */}
      {/* ========================================================================= */}
      {viewingQrUser && (
        <div id="admin-qr-card-print-doc" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:p-0">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>کارت ورود هوشمند و رمز عبور کاربر</span>
              </h3>
              <button onClick={() => setViewingQrUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Access Card Voucher */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                    JB
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">
                      {LAB_INFO.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 block">
                      کارت احراز هویت و دسترسی پرتال
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  viewingQrUser.user.role === 'admin' ? 'bg-purple-900/60 text-purple-300' :
                  viewingQrUser.user.role === 'operator' ? 'bg-emerald-900/60 text-emerald-300' :
                  'bg-blue-900/60 text-blue-300'
                }`}>
                  {viewingQrUser.user.role === 'admin' ? 'مدیر ارشد' : viewingQrUser.user.role === 'operator' ? 'تکنسین بتن' : 'مشتری'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* QR Code */}
                <div className="p-2.5 bg-white rounded-2xl shrink-0 shadow-md">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      portal: 'JahanBin-Concrete-Lab',
                      username: viewingQrUser.user.username || viewingQrUser.user.email,
                      email: viewingQrUser.user.email,
                      fullName: viewingQrUser.user.fullName,
                      role: viewingQrUser.user.role
                    })}
                    size={96}
                    level="M"
                  />
                </div>

                <div className="space-y-1.5 text-xs flex-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block">نام کاربر / شرکت:</span>
                    <strong className="text-white text-xs block font-bold">{viewingQrUser.user.fullName}</strong>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block">کد کاربری (Username):</span>
                    <strong className="text-blue-400 font-mono text-xs block" dir="ltr">
                      {viewingQrUser.user.username || viewingQrUser.user.email}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block">کلمه عبور (Password):</span>
                    <strong className="text-emerald-400 font-mono text-xs block" dir="ltr">
                      ••••••
                    </strong>
                    <span className="text-slate-500 text-[9px] block">به دلایل امنیتی رمز عبور نمایش داده نمی‌شود؛ در صورت فراموشی از «بازنشانی رمز عبور» استفاده کنید.</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between items-center">
                <span>مدیر فنی: {LAB_INFO.manager}</span>
                <span className="font-mono">{LAB_INFO.phone}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  const text = `کارت ورود پرتال آزمایشگاه ${LAB_INFO.name}\nنام کاربر: ${viewingQrUser.user.fullName}\nکد کاربری: ${viewingQrUser.user.username || viewingQrUser.user.email}\nآدرس پرتال و تماس: ${LAB_INFO.phone}`;
                  navigator.clipboard.writeText(text);
                  setCopiedVoucher(true);
                  setTimeout(() => setCopiedVoucher(false), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                {copiedVoucher ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedVoucher ? 'کپی شد!' : 'کپی مشخصات ورود'}</span>
              </button>

              <button
                onClick={() => { if (!printOnlyElement('admin-qr-card-print-doc')) window.print(); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ کارت</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER DELETE CONFIRMATION (DELIBERATE SAFETY PROCESS)           */}
      {/* ========================================================================= */}
      {customerToDelete && (
        <AdminCustomerDeleteModal
          customer={customerToDelete}
          onClose={() => setCustomerToDelete(null)}
          onDeleted={(deletedCust) => {
            setCustomerToDelete(null);
            setSuccessMessage(`شرکت "${deletedCust.companyName}" به پوشه حذفیات منتقل شد و در هر زمان قابل بازگردانی است.`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER RECYCLE BIN / TRASH RECOVERY FOLDER                       */}
      {/* ========================================================================= */}
      {showTrashModal && (
        <AdminCustomerTrashModal
          isOpen={showTrashModal}
          onClose={() => setShowTrashModal(false)}
          onRestored={() => {
            setSuccessMessage('کارفرما با موفقیت بازگردانده شد.');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN SECURE PASSWORD RESET VIA SMS OTP                             */}
      {/* ========================================================================= */}
      {showAdminSmsPasswordModal && (
        <AdminPasswordChangeWithSmsModal
          isOpen={showAdminSmsPasswordModal}
          onClose={() => setShowAdminSmsPasswordModal(false)}
          onPasswordChanged={() => {
            setProfiles(labDb.getProfiles());
            setSuccessMessage('رمز عبور مدیر ارشد سامانه با موفقیت و پس از تایید پیامکی (OTP) تغییر یافت.');
            setTimeout(() => setSuccessMessage(null), 4500);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: FIELD TECHNICIANS & DISPATCH PERSONNEL MANAGEMENT                   */}
      {/* ========================================================================= */}
      {showTechsModal && (
        <TechniciansManagementModal
          isOpen={showTechsModal}
          onClose={() => setShowTechsModal(false)}
          onUpdated={() => {
            setSuccessMessage('فهرست تکنسین‌های اعزام با موفقیت به‌روزرسانی شد.');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}

        </div>
      </main>
    </div>
  );
};