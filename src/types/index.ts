/**
 * Types & Data Models for Concrete Testing Laboratory (سامانه جامع آزمایشگاه بتن)
 */

export type UserRole = 'admin' | 'operator' | 'customer';

// The system has strictly one and only one administrator. No other user can ever be granted admin access.
export const SOLE_ADMIN_ID = 'usr-admin-01';
export const SOLE_ADMIN_USERNAME = 'admin';

export const isSoleAdminUser = (user?: { id?: string; username?: string; role?: string } | null): boolean => {
  if (!user) return false;
  return user.id === SOLE_ADMIN_ID || user.username === SOLE_ADMIN_USERNAME;
};

export interface UserProfile {
  id: string; // Explicit 'usr-*' ID namespace
  email: string;
  username?: string;
  password?: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  customerId?: string; // Reference to customer 'cust-*'
  status: 'active' | 'inactive';
  avatarUrl?: string;
  createdAt: string;
  // Server-set flag: user must change password (legacy/default credential) before using the portal.
  mustChangePassword?: boolean;
}

export interface CustomerPaymentRecord {
  id: string;
  amount: number; // مبلغ به تومان
  method: 'bank_transfer' | 'cheque' | 'card_to_card' | 'pos' | 'cash' | 'receipt'; // روش پرداخت
  documentNo: string; // شماره فیش، شماره سریال چک یا کد پیگیری
  bankName?: string; // نام بانک
  receiptImage?: string; // تصویر یا فایل فیش واریزی
  dueDateJalali?: string; // سررسید چک
  jalaliDate: string; // تاریخ پرداخت
  description?: string; // بابت / توضیحات
  registeredBy: string; // کاربر ثبت‌کننده
  status: 'cleared' | 'pending' | 'bounced';
  createdAt: string;
}

export interface Customer {
  id: string; // Explicit 'cust-*' ID namespace (distinct from usr-*)
  companyName: string;
  representativeName: string;
  economicCode?: string;
  nationalId?: string;
  registrationNo?: string; // شماره ثبت شرکت
  ceoName?: string; // نام مدیرعامل
  phone: string;
  contactPhone?: string; // شماره تماس کارفرما در صورت عدم تطابق با پروفایل کاربری
  landlinePhone?: string; // تلفن ثابت دفتر
  email?: string;
  address: string;
  postalCode?: string; // کد پستی
  projectNames: string[];
  
  // Contract Details for official lab agreement & printing
  contractNo?: string; // شماره قرارداد رسمی آزمایشگاه
  contractDateJalali?: string; // تاریخ عقد قرارداد
  contractStartDateJalali?: string; // تاریخ شروع قرارداد
  contractEndDateJalali?: string; // تاریخ پایان قرارداد
  projectNamePrimary?: string; // نام پروژه اصلی
  projectAddress?: string; // آدرس دقیق کارگاه
  cadastralNo?: string; // شماره پلاک ثبتی
  permitNo?: string; // شماره پروانه ساختمانی
  supervisorEngineer?: string; // نام مهندس ناظر سازه
  supervisorPhone?: string; // شماره تماس مهندس ناظر
  nezamNo?: string; // شماره نظام مهندسی
  mapAreaM2?: string | number; // متراژ دستور نقشه (متر مربع)
  concreteTargetGrade?: string; // رده بتن هدف (C25/C30/...)
  estimatedVolumeM3?: number; // حجم تقریبی بتن‌ریزی (مترمکعب)
  sampleSeriesCount?: number; // تعداد سری پیش‌بینی شده
  pricePerSeries?: number; // حق‌الزحمه هر سری (تومان)
  contractTerms?: string; // شرایط و تعهدات اختصاصی
  
  // Financial State managed by Admin
  totalContractAmount?: number; // مبلغ کل قرارداد پروژه (تومان)
  paidAmount?: number; // جمع کل مبالغ تسویه شده (تومان)
  balance: number; // مانده بدهی تراز مالی (تومان)
  paymentRecords?: CustomerPaymentRecord[]; // ریز اسناد پرداخت و تسویه
  
  createdAt: string;
}

export interface TrashCustomerItem {
  customer: Customer;
  deletedAtJalali: string;
  deletedAtIso: string;
  deletedBy: string;
  reason?: string;
}

export type ConcreteGrade = 'C15' | 'C20' | 'C25' | 'C30' | 'C35' | 'C40' | 'C45' | 'C50';
export type MoldType = 'cube_150' | 'cylinder_150_300';
export type TestStatus = 'pending' | 'approved' | 'rejected';

export interface TestReport {
  id: string;
  reportNo: string; // e.g. "CTL-1403-0892"
  customerId: string;
  customerName: string;
  projectName: string;
  sampleLocation: string; // e.g. "سقف طبقه ۴ - محور A-B"
  concreteGrade: ConcreteGrade;
  targetStrengthMpa: number; // e.g. 25
  moldType: MoldType;
  slumpMm: number; // e.g. 85 mm
  temperatureC?: number; // دمای بتن تازه
  densityKgM3?: number; // وزن مخصوص بتن سخت شده
  waterCementRatio: number; // e.g. 0.44
  cementType: string; // e.g. "تیپ ۲ - کارخانه تهران"
  samplingDateJalali: string; // "1403/06/18"
  samplingDateGregorian: string;
  samplingTime: string; // "10:30"
  truckBatchNo: string; // "T-409"
  curingMethod: string; // "حوضچه آب آهک ۲۳ درجه"
  
  // Breaking Test 7 Days
  breaking7dLoadKn?: number; // Force in kN
  breaking7dStrengthMpa?: number; // Calculated MPa
  breakDate7dJalali?: string;
  
  // Breaking Test 28 Days
  breaking28dLoadKn?: number; // Force in kN
  breaking28dStrengthMpa?: number; // Calculated MPa
  breakDate28dJalali?: string;

  // Compliance
  isPassed?: boolean;
  status: TestStatus;
  operatorId: string;
  operatorName: string;
  approvedById?: string;
  approvedByName?: string;
  approvalDateJalali?: string;
  approvalNotes?: string;
  
  // Media & GPS
  photos: string[];
  coordinates?: {
    lat: number;
    lng: number;
    address?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

export type AccountingType = 'income' | 'expense';

export interface AccountingRecord {
  id: string;
  title: string;
  type: AccountingType;
  category: string;
  amount: number; // in Toman or Rial
  jalaliDate: string;
  customerId?: string;
  customerName?: string;
  invoiceId?: string;
  referenceNo?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'cancelled' | 'pending_settlement';

export interface Invoice {
  id: string;
  invoiceNo: string; // "INV-1403-104"
  customerId: string;
  customerName: string;
  projectName: string;
  amount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issueDateJalali: string;
  dueDateJalali: string;
  paidAt?: string;
  settlementRequestedAt?: string;
  settlementNotes?: string;
  paymentMethod?: 'online' | 'bank_transfer' | 'cheque';
  paymentReceiptUrl?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  createdAt: string;
}

export interface AIPredictionResult {
  predicted28dStrength: number;
  strengthRatio7to28: number;
  targetCompliance: 'PASS' | 'WARNING' | 'FAIL';
  confidenceScore: number;
  structuralRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  analysisFa: string;
  analysisEn: string;
  recommendationsFa: string[];
  recommendationsEn: string[];
  curingAdviceFa: string;
  estimatedMaturityIndex: string;
}

export interface AIFinancialSummary {
  profitMargin: number;
  financialHealth: 'EXCELLENT' | 'STABLE' | 'NEEDS_ATTENTION';
  executiveSummaryFa: string;
  executiveSummaryEn: string;
  keyObservationsFa: string[];
  keyObservationsEn: string[];
  costOptimizationTipsFa: string[];
  costOptimizationTipsEn: string[];
  revenueGrowthStrategiesFa: string[];
}

export interface EquipmentCalibration {
  id: string;
  equipmentName: string; // e.g. "جک هیدرولیکی دیجیتال ۲۰۰۰ kN"
  model: string;
  serialNo?: string;
  serialNumber?: string;
  lastCalibratedJalali?: string;
  calibrationDateJalali?: string;
  expiryDateJalali?: string;
  nextCalibrationDueJalali?: string;
  status: 'calibrated' | 'due_soon' | 'expired' | 'valid';
  calibratedBy?: string;
  calibrationAgency?: string;
  certificateNo?: string;
  calibrationCertNo?: string;
  loadCellAccuracy?: string;
  maxAllowedError?: string;
}

export interface FieldTechnician {
  id: string;
  fullName: string;
  phone: string;
  nationalCode?: string;
  specialty?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface TechnicianDispatch {
  source?: 'website_callback' | 'dispatch';
  id: string;
  ticketNo: string;
  customerId: string;
  customerName: string;
  projectName: string;
  projectAddress: string;
  contactPhone: string;
  scheduledDateJalali: string;
  scheduledTime: string;
  technicianName?: string;
  serviceType: string;
  status: 'requested' | 'assigned' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface EnvironmentalLog {
  id: string;
  dateJalali?: string;
  loggedDateJalali?: string;
  loggedTime?: string;
  waterBathTempC?: number; // target: 23.0 ± 2.0
  waterTempC?: number;
  roomTempC?: number;
  curingChamberHumidityRh?: number; // target: >95%
  humidityPercent?: number;
  limeSaturationPh?: number;
  tankId?: string;
  labAmbientTempC?: number;
  operatorName: string;
  complianceStatus?: 'NORMAL' | 'ALERT';
  status?: 'compliant' | 'warning' | 'alert';
  notes?: string;
}

export type MediaCategory = 'concrete_cube' | 'slump_test' | 'sampling_site' | 'ndt_rebound' | 'breaking_test' | 'other';

export interface LabMediaItem {
  id: string;
  title: string;
  category: MediaCategory;
  imageUrl: string;
  fileSizeBytes: number; // strictly <= 2MB (2097152 bytes)
  customerId: string;
  customerName: string;
  projectName: string;
  reportNo?: string;
  uploadedBy: string;
  uploaderName: string;
  jalaliDate: string;
  createdAt: string;
  description?: string;
}

export type SmsEvent = 
  | 'sample_registered' 
  | 'sample_received'
  | 'test_7d_result' 
  | 'test_28d_result' 
  | 'test_ready'
  | 'test_failed'
  | 'certificate_issued' 
  | 'invoice_issued' 
  | 'payment_received' 
  | 'payment_reminder'
  | 'dispatch_scheduled' 
  | 'custom';

export interface SmsLog {
  id: string;
  recipientPhone: string;
  recipientName: string;
  customerId?: string;
  customerName?: string;
  projectName?: string;
  event: SmsEvent;
  message: string;
  status: 'sent' | 'delivered' | 'failed';
  jalaliDate: string;
  jalaliTime: string;
  createdAt: string;
}

