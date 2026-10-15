import React, { useState, useEffect } from 'react';
import { Customer, UserProfile, CustomerPaymentRecord } from '../../types';
import { labDb } from '../../services/supabase';
import { generateRandomPassword } from '../../utils/passwordCrypto';
// BUG FIX (ID collision): was `usr-${Date.now().toString(36)}` — see src/utils/uniqueId.ts
import { uniqueId } from '../../utils/uniqueId';
import { getTodayJalali, formatJalali, toPersianDigits } from '../../utils/jalali';
import { 
  Building2, 
  User, 
  FileText, 
  Wallet, 
  X, 
  Check, 
  MapPin, 
  Phone, 
  Mail, 
  Layers, 
  ShieldCheck, 
  Calendar,
  Key,
  CreditCard,
  FileSignature,
  Upload,
  Trash2,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { PrintContractModal } from '../common/PrintContractModal';

interface AdminCustomerContractModalProps {
  customerToEdit?: Customer | null;
  customer?: Customer | null;
  isOpen?: boolean;
  onClose: () => void;
  onSaved: (customer: Customer, user?: UserProfile, pass?: string) => void;
}

export const AdminCustomerContractModal: React.FC<AdminCustomerContractModalProps> = ({
  customerToEdit: propCustomerToEdit,
  customer,
  isOpen = true,
  onClose,
  onSaved
}) => {
  const targetCustomer = propCustomerToEdit || customer || null;
  const isEdit = !!targetCustomer;
  const todayJalali = formatJalali(getTodayJalali());

  const [activeTab, setActiveTab] = useState<'legal' | 'project' | 'contract' | 'financial'>('legal');

  // Tab 1: Legal & Company Identity - NO PREFILLED DEFAULTS FOR NEW CUSTOMER
  const [companyName, setCompanyName] = useState(targetCustomer?.companyName || '');
  const [representativeName, setRepresentativeName] = useState(targetCustomer?.representativeName || '');
  const [ceoName, setCeoName] = useState(targetCustomer?.ceoName || '');
  const [registrationNo, setRegistrationNo] = useState(targetCustomer?.registrationNo || '');
  const [nationalId, setNationalId] = useState(targetCustomer?.nationalId || '');
  const [economicCode, setEconomicCode] = useState(targetCustomer?.economicCode || '');
  const [phone, setPhone] = useState(targetCustomer?.phone || '');
  const [landlinePhone, setLandlinePhone] = useState(targetCustomer?.landlinePhone || '');
  // Email is explicitly optional
  const [email, setEmail] = useState(targetCustomer?.email || '');
  const [address, setAddress] = useState(targetCustomer?.address || '');
  const [postalCode, setPostalCode] = useState(targetCustomer?.postalCode || '');

  // Tab 2: Project & Workshop Details - NO PREFILLED DEFAULTS
  const [projectNamePrimary, setProjectNamePrimary] = useState(
    targetCustomer?.projectNamePrimary || targetCustomer?.projectNames?.[0] || ''
  );
  const [projectNamesText, setProjectNamesText] = useState(
    targetCustomer?.projectNames?.join('، ') || ''
  );
  const [projectAddress, setProjectAddress] = useState(targetCustomer?.projectAddress || '');
  const [cadastralNo, setCadastralNo] = useState(targetCustomer?.cadastralNo || '');
  const [permitNo, setPermitNo] = useState(targetCustomer?.permitNo || '');
  const [supervisorEngineer, setSupervisorEngineer] = useState(targetCustomer?.supervisorEngineer || '');
  const [supervisorPhone, setSupervisorPhone] = useState(targetCustomer?.supervisorPhone || '');
  const [nezamNo, setNezamNo] = useState(targetCustomer?.nezamNo || '');
  const [mapAreaM2, setMapAreaM2] = useState<string>(
    targetCustomer?.mapAreaM2 ? String(targetCustomer.mapAreaM2) : ''
  );

  // Tab 3: Technical Specifications & Contract Terms - NO PREFILLED DEFAULTS
  const [contractNo, setContractNo] = useState(targetCustomer?.contractNo || '');
  const [contractDateJalali, setContractDateJalali] = useState(targetCustomer?.contractDateJalali || '');
  const [contractStartDateJalali, setContractStartDateJalali] = useState(targetCustomer?.contractStartDateJalali || '');
  const [contractEndDateJalali, setContractEndDateJalali] = useState(targetCustomer?.contractEndDateJalali || '');
  const [concreteTargetGrade, setConcreteTargetGrade] = useState(targetCustomer?.concreteTargetGrade || '');
  const [estimatedVolumeM3, setEstimatedVolumeM3] = useState<string>(
    targetCustomer?.estimatedVolumeM3 ? String(targetCustomer.estimatedVolumeM3) : ''
  );
  const [sampleSeriesCount, setSampleSeriesCount] = useState<string>(
    targetCustomer?.sampleSeriesCount ? String(targetCustomer.sampleSeriesCount) : ''
  );
  const [pricePerSeries, setPricePerSeries] = useState<string>(
    targetCustomer?.pricePerSeries ? String(targetCustomer.pricePerSeries) : ''
  );
  const [contractTerms, setContractTerms] = useState(targetCustomer?.contractTerms || '');

  // Tab 4: Financial & Initial Payment Setup - NO PREFILLED DEFAULTS
  const [totalContractAmount, setTotalContractAmount] = useState<string>(
    targetCustomer?.totalContractAmount ? String(targetCustomer.totalContractAmount) : ''
  );
  const [customPassword, setCustomPassword] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customerUserRole, setCustomerUserRole] = useState<'customer' | 'operator'>('customer');

  // Load existing user account credentials if editing customer
  useEffect(() => {
    if (isOpen) {
      if (targetCustomer) {
        const u = labDb.getProfiles().find(p => p.customerId === targetCustomer.id || (targetCustomer.phone && p.phone === targetCustomer.phone));
        if (u) {
          setCustomUsername(u.username || '');
          setCustomPassword(u.password || '');
          setCustomerUserRole(u.role === 'operator' ? 'operator' : 'customer');
        } else {
          setCustomUsername(targetCustomer.phone ? targetCustomer.phone.slice(-6) : '');
          setCustomPassword('');
          setCustomerUserRole('customer');
        }
      } else {
        setCustomUsername('');
        setCustomPassword('');
        setCustomerUserRole('customer');
      }
    }
  }, [isOpen, targetCustomer]);

  // Initial payment details on registration
  const [hasInitialPayment, setHasInitialPayment] = useState(
    targetCustomer?.paidAmount ? targetCustomer.paidAmount > 0 : false
  );
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>(
    targetCustomer?.paidAmount ? String(targetCustomer.paidAmount) : ''
  );
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'receipt' | 'bank_transfer' | 'pos' | 'card_to_card' | 'cheque' | 'cash'>('receipt');
  const [initialPaymentDoc, setInitialPaymentDoc] = useState('');
  const [initialPaymentBank, setInitialPaymentBank] = useState('');
  const [initialPaymentDate, setInitialPaymentDate] = useState(todayJalali);
  const [initialPaymentDesc, setInitialPaymentDesc] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');

  // Feedback states
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedContractCustomer, setSavedContractCustomer] = useState<Customer | null>(null);
  const [smsSentNotice, setSmsSentNotice] = useState<string | null>(null);
  const [showPrintModalCustomer, setShowPrintModalCustomer] = useState<Customer | null>(null);

  if (!isOpen) return null;

  // Handle receipt image file selection
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so selecting the SAME file again still fires
    // onChange (otherwise re-picking after a rejection appears frozen).
    const resetInput = () => { if (e.target) e.target.value = ''; };

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!file.type.startsWith('image/') && !isPdf) {
      alert('لطفاً فقط تصویر (JPG/PNG) یا فایل PDF انتخاب فرمایید.');
      resetInput();
      return;
    }
    // Keep data-URLs small enough for localStorage / DB text columns.
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل انتخابی بیشتر از ۲ مگابایت است. لطفاً حجم فایل را کاهش دهید.');
      resetInput();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReceiptImage(event.target.result as string);
      }
      resetInput();
    };
    reader.onerror = () => {
      alert('خواندن فایل ناموفق بود. لطفاً دوباره تلاش کنید.');
      resetInput();
    };
    reader.readAsDataURL(file);
  };

  // Auto calculate total contract amount when series count or unit price changes
  const handleSeriesOrPriceChange = (seriesVal: string, priceVal: string) => {
    const s = parseInt(seriesVal.replace(/,/g, '') || '0', 10);
    const p = parseInt(priceVal.replace(/,/g, '') || '0', 10);
    if (s > 0 && p > 0) {
      setTotalContractAmount(String(s * p));
    }
  };

  // Step navigation helper
  const handleNextStep = () => {
    setFormError('');
    if (activeTab === 'legal') {
      if (!companyName.trim() && !representativeName.trim()) {
        setFormError('لطفاً حداقل نام شرکت یا نام کارفرما/نماینده را وارد فرمایید.');
        return;
      }
      setActiveTab('project');
    } else if (activeTab === 'project') {
      setActiveTab('contract');
    } else if (activeTab === 'contract') {
      setActiveTab('financial');
    }
  };

  const handlePrevStep = () => {
    setFormError('');
    if (activeTab === 'financial') setActiveTab('contract');
    else if (activeTab === 'contract') setActiveTab('project');
    else if (activeTab === 'project') setActiveTab('legal');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Minimal validation: at least company or representative name
    if (!companyName.trim() && !representativeName.trim()) {
      setActiveTab('legal');
      setFormError('لطفاً حداقل نام شرکت یا نام کارفرما را درج نمایید.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare project names
      const names = projectNamesText
        .split(/[,،\n]/)
        .map(s => s.trim())
        .filter(Boolean);
      if (projectNamePrimary.trim() && !names.includes(projectNamePrimary.trim())) {
        names.unshift(projectNamePrimary.trim());
      }
      if (names.length === 0 && projectNamePrimary.trim()) {
        names.push(projectNamePrimary.trim());
      }

      const totalNum = parseInt(totalContractAmount.replace(/,/g, '') || '0', 10);
      const initialPaidNum = hasInitialPayment 
        ? parseInt(initialPaymentAmount.replace(/,/g, '') || '0', 10) 
        : (targetCustomer?.paidAmount || 0);
      const balanceNum = Math.max(0, totalNum - initialPaidNum);

      const customerPayload: Omit<Customer, 'id' | 'createdAt'> = {
        companyName: companyName.trim(),
        representativeName: representativeName.trim(),
        ceoName: ceoName.trim() || undefined,
        registrationNo: registrationNo.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        economicCode: economicCode.trim() || undefined,
        phone: phone.trim(),
        landlinePhone: landlinePhone.trim() || undefined,
        email: email.trim() || undefined, // Email is optional
        address: address.trim(),
        postalCode: postalCode.trim() || undefined,
        projectNames: names,

        contractNo: contractNo.trim() || undefined,
        contractDateJalali: contractDateJalali.trim() || undefined,
        contractStartDateJalali: contractStartDateJalali.trim() || undefined,
        contractEndDateJalali: contractEndDateJalali.trim() || undefined,
        projectNamePrimary: projectNamePrimary.trim() || names[0] || undefined,
        projectAddress: projectAddress.trim() || address.trim() || undefined,
        cadastralNo: cadastralNo.trim() || undefined,
        permitNo: permitNo.trim() || undefined,
        supervisorEngineer: supervisorEngineer.trim() || undefined,
        supervisorPhone: supervisorPhone.trim() || undefined,
        nezamNo: nezamNo.trim() || undefined,
        mapAreaM2: mapAreaM2.trim() || undefined,
        concreteTargetGrade: concreteTargetGrade.trim() || undefined,
        estimatedVolumeM3: parseInt(estimatedVolumeM3.replace(/,/g, '') || '0', 10) || undefined,
        sampleSeriesCount: parseInt(sampleSeriesCount.replace(/,/g, '') || '0', 10) || undefined,
        pricePerSeries: parseInt(pricePerSeries.replace(/,/g, '') || '0', 10) || undefined,
        contractTerms: contractTerms.trim() || undefined,

        totalContractAmount: totalNum || undefined,
        paidAmount: initialPaidNum,
        balance: balanceNum,
        paymentRecords: targetCustomer?.paymentRecords || []
      };

      if (isEdit && targetCustomer) {
        const updated: Customer = {
          ...targetCustomer,
          ...customerPayload,
          paymentRecords: targetCustomer.paymentRecords || []
        };
        labDb.updateCustomer(updated);
        
        // Synchronize linked user profile (credentials, password, role) across all devices and server
        const linkedUser = labDb.getProfiles().find(p => p.customerId === targetCustomer.id || (targetCustomer.phone && p.phone === targetCustomer.phone));
        if (linkedUser) {
          await labDb.updateProfile({
            ...linkedUser,
            fullName: representativeName.trim() || companyName.trim(),
            phone: phone.trim(),
            username: customUsername.trim() || linkedUser.username,
            password: customPassword.trim() || linkedUser.password,
            role: customerUserRole || linkedUser.role,
          });
        } else if (customUsername.trim() || customPassword.trim()) {
          const newUserId = uniqueId('usr');
          await labDb.updateProfile({
            id: newUserId,
            fullName: representativeName.trim() || companyName.trim(),
            email: email.trim() || `${phone.slice(-6)}@azmabeton.ir`,
            username: customUsername.trim() || phone.slice(-6),
            phone: phone.trim(),
            role: customerUserRole || 'customer',
            status: 'active',
            password: customPassword.trim() || generateRandomPassword(),
            customerId: targetCustomer.id,
            createdAt: new Date().toISOString()
          });
        }

        // If initial payment was added newly
        if (hasInitialPayment && initialPaidNum > 0 && (!targetCustomer.paidAmount || targetCustomer.paidAmount === 0)) {
          labDb.addCustomerPayment(updated.id, {
            amount: initialPaidNum,
            method: initialPaymentMethod,
            documentNo: initialPaymentDoc.trim() || 'فیش ثبت قرارداد',
            bankName: initialPaymentBank.trim() || 'بانک مبدأ',
            receiptImage: receiptImage || undefined,
            jalaliDate: initialPaymentDate.trim() || todayJalali,
            description: initialPaymentDesc.trim() || 'پیش‌پرداخت اولیه عقد قرارداد نظارت و آزمون بتن',
            registeredBy: 'مدیریت ارشد (ویرایش قرارداد)',
            status: 'cleared'
          });
        }

        setIsSubmitting(false);
        onSaved(updated);
        onClose();
      } else {
        // New customer registration
        const finalPass = customPassword.trim() || undefined;
        const result = labDb.registerCustomerWithAccount(customerPayload, finalPass);

        // If custom username or role was specified, persist to server
        if (customUsername.trim() || customerUserRole !== 'customer') {
          await labDb.updateProfile({
            ...result.user,
            username: customUsername.trim() || result.user.username,
            role: customerUserRole || 'customer',
          });
          result.user.username = customUsername.trim() || result.user.username;
          result.user.role = customerUserRole || 'customer';
        }

        // Record initial payment if provided
        if (hasInitialPayment && initialPaidNum > 0) {
          labDb.addCustomerPayment(result.customer.id, {
            amount: initialPaidNum,
            method: initialPaymentMethod,
            documentNo: initialPaymentDoc.trim() || 'فیش واریزی اولیه',
            bankName: initialPaymentBank.trim() || 'بانک مبدأ',
            receiptImage: receiptImage || undefined,
            jalaliDate: initialPaymentDate.trim() || todayJalali,
            description: initialPaymentDesc.trim() || 'پیش‌پرداخت اولیه عقد قرارداد نظارت و آزمایش بتن',
            registeredBy: 'مدیریت ارشد (ثبت قرارداد)',
            status: 'cleared'
          });
        }

        // Automatic SMS notification
        if (result.customer.phone) {
          const smsText = `کارفرمای محترم ${result.customer.representativeName || result.customer.companyName}، قرارداد خدمات کنترل کیفی و آزمایشگاهی بتن در شرکت آزما بتن پایش خاک و پی جهان‌بین ثبت و منعقد گردید.\nکد کاربری: ${result.user.username}\nرمز عبور: ${result.passwordGenerated}\nمشاهده آنلاین نتایج و قرارداد: azmabeton.ir`;
          setSmsSentNotice(`پیامک تایید به شماره ${result.customer.phone} ارسال شد.`);
        }

        setIsSubmitting(false);
        setSavedContractCustomer(result.customer);
        onSaved(result.customer, result.user, result.passwordGenerated);
      }
    } catch (err: any) {
      console.error('Error saving customer and contract:', err);
      setFormError('خطا در ذخیره اطلاعات قرارداد: ' + (err?.message || 'لطفاً دوباره تلاش کنید.'));
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-4 sm:p-7 space-y-4 max-h-[94vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileSignature className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">
                  {isEdit ? 'ویرایش مشخصات کارفرما و قرارداد' : 'ثبت شرکت جدید و صدور قرارداد رسمی (مرحله‌ای)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ثبت مشخصات حقوقی، پروژه، شرایط قرارداد و پیش‌پرداخت مالی با ارسال خودکار پیامک
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const previewCustomerObj: Customer = {
                    id: targetCustomer?.id || 'temp-preview',
                    companyName: companyName || '',
                    representativeName: representativeName || '',
                    nationalId: nationalId || '',
                    economicCode: economicCode || '',
                    phone: phone || '',
                    landlinePhone: landlinePhone || '',
                    email: email || '',
                    address: address || '',
                    postalCode: postalCode || '',
                    projectNames: projectNamePrimary ? [projectNamePrimary] : (projectNamesText ? projectNamesText.split('،').map(s => s.trim()) : []),
                    projectNamePrimary: projectNamePrimary || '',
                    projectAddress: projectAddress || '',
                    cadastralNo: cadastralNo || '',
                    permitNo: permitNo || '',
                    supervisorEngineer: supervisorEngineer || '',
                    supervisorPhone: supervisorPhone || '',
                    nezamNo: nezamNo || '',
                    mapAreaM2: mapAreaM2 ? Number(mapAreaM2) : undefined,
                    contractNo: contractNo || '',
                    contractDateJalali: contractDateJalali || '',
                    sampleSeriesCount: sampleSeriesCount ? Number(sampleSeriesCount) : undefined,
                    pricePerSeries: pricePerSeries ? Number(pricePerSeries.replace(/\D/g, '')) : undefined,
                    totalContractAmount: totalContractAmount ? Number(totalContractAmount.replace(/\D/g, '')) : undefined,
                    paidAmount: hasInitialPayment && initialPaymentAmount ? Number(initialPaymentAmount.replace(/\D/g, '')) : 0,
                    balance: Math.max(0, (totalContractAmount ? Number(totalContractAmount.replace(/\D/g, '')) : 0) - (hasInitialPayment && initialPaymentAmount ? Number(initialPaymentAmount.replace(/\D/g, '')) : 0)),
                    createdAt: targetCustomer?.createdAt || new Date().toISOString()
                  };
                  setShowPrintModalCustomer(previewCustomerObj);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                title="مشاهده پیش‌نمایش برگه قرارداد رسمی ۲ صفحه‌ای"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>پیش‌نمایش قرارداد چاپی</span>
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => { setFormError(''); setActiveTab('legal'); }}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'legal' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>۱. مشخصات هویتی و حقوقی</span>
            </button>

            <button
              type="button"
              onClick={() => { setFormError(''); setActiveTab('project'); }}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'project' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>۲. پروژه و پلاک ثبتی</span>
            </button>

            <button
              type="button"
              onClick={() => { setFormError(''); setActiveTab('contract'); }}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'contract' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>۳. تعهدات و مشخصات فنی</span>
            </button>

            <button
              type="button"
              onClick={() => { setFormError(''); setActiveTab('financial'); }}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'financial' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>۴. مالی، فیش و تایید نهایی</span>
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Wizard */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* ========================================================================= */}
            {/* TAB 1: مشخصات هویتی و حقوقی                                              */}
            {/* ========================================================================= */}
            {activeTab === 'legal' && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام شرکت / شخصیت حقوقی
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="شرکت مهندسی..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام کارفرما / نماینده قانونی
                    </label>
                    <input
                      type="text"
                      value={representativeName}
                      onChange={(e) => setRepresentativeName(e.target.value)}
                      placeholder="مهندس..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام مدیرعامل شرکت
                    </label>
                    <input
                      type="text"
                      value={ceoName}
                      onChange={(e) => setCeoName(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره ثبت شرکت
                    </label>
                    <input
                      type="text"
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      کد ملی / شناسه ملی
                    </label>
                    <input
                      type="text"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      کد اقتصادی
                    </label>
                    <input
                      type="text"
                      value={economicCode}
                      onChange={(e) => setEconomicCode(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره همراه (جهت ارسال پیامک و پرتال)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تلفن ثابت
                    </label>
                    <input
                      type="text"
                      value={landlinePhone}
                      onChange={(e) => setLandlinePhone(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        ایمیل شرکت (اختیاری)
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">اختیاری</span>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="اختیاری - بدون نیاز به پر کردن"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نشانی کارفرما
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="نشانی دفتر یا اقامتگاه..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      کد پستی
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: مشخصات پروژه و کارگاه                                             */}
            {/* ========================================================================= */}
            {activeTab === 'project' && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام پروژه
                    </label>
                    <input
                      type="text"
                      value={projectNamePrimary}
                      onChange={(e) => setProjectNamePrimary(e.target.value)}
                      placeholder="پروژه ساختمانی..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سایر پروژه‌ها یا بلوک‌ها
                    </label>
                    <input
                      type="text"
                      value={projectNamesText}
                      onChange={(e) => setProjectNamesText(e.target.value)}
                      placeholder="بلوک A، بلوک B"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نشانی پروژه (محل کارگاه بتن‌ریزی)
                  </label>
                  <input
                    type="text"
                    value={projectAddress}
                    onChange={(e) => setProjectAddress(e.target.value)}
                    placeholder="شهرکرد، خیابان..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره پلاک ثبتی ملک (قرارداد)
                    </label>
                    <input
                      type="text"
                      value={cadastralNo}
                      onChange={(e) => setCadastralNo(e.target.value)}
                      placeholder="مثال: ۲۳۹۵/۱۱۴"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره ثبت نظام مهندسی
                    </label>
                    <input
                      type="text"
                      value={nezamNo}
                      onChange={(e) => setNezamNo(e.target.value)}
                      placeholder="مثال: ۱۰-۳-۰-۸۸"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      متراژ دستور نقشه (متر مربع)
                    </label>
                    <input
                      type="text"
                      value={mapAreaM2}
                      onChange={(e) => setMapAreaM2(e.target.value)}
                      placeholder="مثال: ۱۲۰۰"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره پروانه ساختمانی
                    </label>
                    <input
                      type="text"
                      value={permitNo}
                      onChange={(e) => setPermitNo(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام مهندس ناظر سازه
                    </label>
                    <input
                      type="text"
                      value={supervisorEngineer}
                      onChange={(e) => setSupervisorEngineer(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تلفن همراه ناظر
                    </label>
                    <input
                      type="text"
                      value={supervisorPhone}
                      onChange={(e) => setSupervisorPhone(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: تعهدات فنی و شرایط قرارداد                                         */}
            {/* ========================================================================= */}
            {activeTab === 'contract' && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره قرارداد رسمی
                    </label>
                    <input
                      type="text"
                      value={contractNo}
                      onChange={(e) => setContractNo(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ عقد قرارداد
                    </label>
                    <input
                      type="text"
                      value={contractDateJalali}
                      onChange={(e) => setContractDateJalali(e.target.value)}
                      placeholder="۱۴۰۳/۰۲/۱۵"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ شروع خدمات
                    </label>
                    <input
                      type="text"
                      value={contractStartDateJalali}
                      onChange={(e) => setContractStartDateJalali(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ پایان قرارداد
                    </label>
                    <input
                      type="text"
                      value={contractEndDateJalali}
                      onChange={(e) => setContractEndDateJalali(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      رده بتن مشخصه
                    </label>
                    <select
                      value={concreteTargetGrade}
                      onChange={(e) => setConcreteTargetGrade(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      <option value="">انتخاب رده بتن (اختیاری)</option>
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
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      حجم کل بتن‌ریزی (m³)
                    </label>
                    <input
                      type="number"
                      value={estimatedVolumeM3}
                      onChange={(e) => setEstimatedVolumeM3(e.target.value)}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تعداد سری مورد نیاز
                    </label>
                    <input
                      type="number"
                      value={sampleSeriesCount}
                      onChange={(e) => {
                        setSampleSeriesCount(e.target.value);
                        handleSeriesOrPriceChange(e.target.value, pricePerSeries);
                      }}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      حق‌الزحمه هر سری (تومان)
                    </label>
                    <input
                      type="number"
                      value={pricePerSeries}
                      onChange={(e) => {
                        setPricePerSeries(e.target.value);
                        handleSeriesOrPriceChange(sampleSeriesCount, e.target.value);
                      }}
                      placeholder=""
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شرایط و تعهدات فنی اختصاصی قرارداد (اختیاری)
                  </label>
                  <textarea
                    rows={2}
                    value={contractTerms}
                    onChange={(e) => setContractTerms(e.target.value)}
                    placeholder=""
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: مالی، پیش‌پرداخت، فیش و تایید نهایی                                  */}
            {/* ========================================================================= */}
            {activeTab === 'financial' && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Total Contract Amount */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    <span>مبالغ قرارداد</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مبلغ کل قرارداد (تومان)
                      </label>
                      <input
                        type="number"
                        value={totalContractAmount}
                        onChange={(e) => setTotalContractAmount(e.target.value)}
                        placeholder=""
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-600"
                      />
                      {totalContractAmount && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          معادل: {toPersianDigits(parseInt(totalContractAmount || '0', 10).toLocaleString())} تومان
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مانده حساب پس از اعمال پرداختی
                      </label>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                        {toPersianDigits(
                          Math.max(
                            0, 
                            (parseInt(totalContractAmount || '0', 10) - (hasInitialPayment ? parseInt(initialPaymentAmount || '0', 10) : 0))
                          ).toLocaleString()
                        )} تومان
                      </div>
                    </div>
                  </div>
                </div>

                {/* Initial Payment Capture Section */}
                <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      <span>ثبت پیش‌پرداخت اولیه یا فیش واریزی کارفرما</span>
                    </h4>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={hasInitialPayment}
                        onChange={(e) => setHasInitialPayment(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span>مبلغی پرداخت شده است</span>
                    </label>
                  </div>

                  {hasInitialPayment && (
                    <div className="space-y-3 pt-2 border-t border-emerald-100 dark:border-emerald-900/40 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            مبلغ پرداختی اولیه (تومان)
                          </label>
                          <input
                            type="number"
                            value={initialPaymentAmount}
                            onChange={(e) => setInitialPaymentAmount(e.target.value)}
                            placeholder=""
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            روش و نحوه پرداخت
                          </label>
                          <select
                            value={initialPaymentMethod}
                            onChange={(e) => setInitialPaymentMethod(e.target.value as any)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                          >
                            <option value="receipt">فیش واریزی بانکی</option>
                            <option value="bank_transfer">انتقال پایا / ساتنا</option>
                            <option value="pos">دستگاه پوز کارتخوان آزمایشگاه</option>
                            <option value="card_to_card">کارت به کارت</option>
                            <option value="cheque">چک صیادی بانکی</option>
                            <option value="cash">پرداخت نقدی</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            شماره فیش / کد پیگیری / شماره ارجاع
                          </label>
                          <input
                            type="text"
                            value={initialPaymentDoc}
                            onChange={(e) => setInitialPaymentDoc(e.target.value)}
                            placeholder="شماره فیش یا سریال پیگیری"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            نام بانک واریزکننده / مقصد
                          </label>
                          <input
                            type="text"
                            value={initialPaymentBank}
                            onChange={(e) => setInitialPaymentBank(e.target.value)}
                            placeholder="بانک ملی، ملت، صادرات و..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            تاریخ پرداخت (شمسی)
                          </label>
                          <input
                            type="text"
                            value={initialPaymentDate}
                            onChange={(e) => setInitialPaymentDate(e.target.value)}
                            placeholder={todayJalali}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Receipt File Upload */}
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          تصویر یا فایل فیش واریزی
                        </label>
                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer px-4 py-2 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition">
                            <Upload className="w-4 h-4 text-emerald-600" />
                            <span>انتخاب عکس یا سند فیش</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleReceiptUpload}
                              className="hidden"
                            />
                          </label>

                          {receiptImage && (
                            <div className="flex items-center gap-2">
                              <img
                                src={receiptImage}
                                alt="پیش‌نمایش فیش"
                                className="w-10 h-10 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shadow-xs"
                              />
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                                فیش ضمیمه شد
                              </span>
                              <button
                                type="button"
                                onClick={() => setReceiptImage('')}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="حذف فیش"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          توضیحات و بابت پرداخت
                        </label>
                        <input
                          type="text"
                          value={initialPaymentDesc}
                          onChange={(e) => setInitialPaymentDesc(e.target.value)}
                          placeholder="پیش‌پرداخت اولیه قرارداد آزمایش بتن"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Portal Access, Password and User Role Management */}
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-blue-600" />
                      <span>{isEdit ? 'مدیریت حساب پرتال، کلمه عبور و سطح دسترسی کاربر' : 'تنظیم حساب پرتال، رمز ورود و سطح دسترسی'}</span>
                    </h4>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                      هماهنگ با سرور و موبایل
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-5">
                    {isEdit 
                      ? 'تغییرات کد کاربری، رمز عبور و سطح دسترسی بلافاصله در تمامی دستگاه‌ها (مرورگر، کامپیوتر و گوشی موبایل) اعمال می‌شود.'
                      : 'پس از ثبت قرارداد، اطلاعات دسترسی به پرتال آنلاین آزمایشگاه ایجاد شده و برای شماره همراه کارفرما پیامک خواهد شد.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نام کاربری (کد ورود به سیستم) *
                      </label>
                      <input
                        type="text"
                        value={customUsername}
                        onChange={(e) => setCustomUsername(e.target.value)}
                        placeholder={phone ? phone.slice(-6) : 'کد ورود دلخواه...'}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        پیش‌فرض: ۶ رقم آخر موبایل
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        کلمه عبور کاربر *
                      </label>
                      <input
                        type="text"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="رمز عبور دلخواه..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                        dir="ltr"
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setCustomPassword('azma' + Math.floor(1000 + Math.random() * 9000))}
                          className="text-[9px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                        >
                          رمز تصادفی
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نقش و سطح دسترسی
                      </label>
                      <select
                        value={customerUserRole}
                        onChange={(e) => setCustomerUserRole(e.target.value as 'customer' | 'operator')}
                        className={`w-full border rounded-xl px-3 py-2 text-xs font-bold transition ${
                          customerUserRole === 'operator'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <option value="customer">مشتری و کارفرما (مشاهده آنلاین سوابق و نتایج آزمایش)</option>
                        <option value="operator">اپراتور / تکنسین فنی آزمایشگاه بتن</option>
                      </select>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                        🛡️ دسترسی مدیریت آزمایشگاه کاملاً اختصاصی و ثابت بوده و به کاربران یا قراردادها اعطا نمی‌شود.
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Footer Navigation & Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {activeTab !== 'legal' && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition hover:bg-slate-200"
                  >
                    مرحله قبل
                  </button>
                )}

                {activeTab !== 'financial' && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    مرحله بعد
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  انصراف
                </button>

                {activeTab === 'financial' && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isEdit ? 'ذخیره تغییرات قرارداد' : 'ثبت قطعی شرکت، ذخیره قرارداد و ارسال پیامک'}</span>
                  </button>
                )}
              </div>
            </div>

          </form>

        </div>
      </div>

      {/* Success Modal with direct Contract Print Option */}
      {savedContractCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                ثبت قرارداد و شرکت با موفقیت انجام شد
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                اطلاعات شرکت «{savedContractCustomer.companyName}» در سامانه ثبت و قرارداد رسمی صادر گردید.
              </p>
            </div>

            {smsSentNotice && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-blue-700 dark:text-blue-300 text-xs flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>{smsSentNotice}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSavedContractCustomer(null);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                بستن پنجره
              </button>

              <button
                type="button"
                onClick={() => {
                  const cust = savedContractCustomer;
                  setShowPrintModalCustomer(cust);
                  setSavedContractCustomer(null);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>مشاهده و چاپ قرارداد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official 2-Page Contract Print Modal */}
      {showPrintModalCustomer && (
        <PrintContractModal
          customer={showPrintModalCustomer}
          onClose={() => {
            setShowPrintModalCustomer(null);
            if (!targetCustomer && savedContractCustomer) {
              onClose();
            }
          }}
        />
      )}
    </>
  );
};
