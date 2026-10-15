/**
 * Bilingual Translation Dictionary (Persian / English)
 */

export type Language = 'fa' | 'en';

export const translations = {
  fa: {
    appName: 'آزما بتن پایش خاک و پی جهان بین',
    appShortName: 'آزما بتن پایش خاک و پی جهان بین',
    appSubtitle: 'سامانه هوشمند کنترل کیفیت و آزمون‌های مقاومت بتن',
    
    // Auth & Navigation
    login: 'ورود به سامانه',
    logout: 'خروج از حساب',
    emailOrUsername: 'ایمیل یا نام کاربری',
    password: 'رمز عبور',
    loginButton: 'ورود به پنل کاربری',
    quickDemoAccounts: 'ورود سریع با حساب‌های آزمایشی:',
    adminRole: 'مدیر ارشد آزمایشگاه (Admin)',
    operatorRole: 'اپراتور فنی و تکنسین (Operator)',
    customerRole: 'کارفرما و مشتری (Customer)',
    activeUser: 'کاربر فعال',
    welcome: 'خوش آمدید',
    role: 'نقش کاربری',
    viewSqlSchema: 'مشاهده اسکریپت دیتابیس Supabase (SQL)',
    realtimeConnected: 'اتصال ریل‌تایم آنلاین',
    systemStatus: 'وضعیت سیستم',
    
    // Roles
    roleAdmin: 'مدیر سیستم',
    roleOperator: 'اپراتور آزمایشگاه',
    roleCustomer: 'مشتری و کارفرما',

    // Nav Tabs - Admin
    tabApprovalQueue: 'کارتابل تایید نتایج',
    tabAccounting: 'امور مالی و حسابداری',
    tabAiSuite: 'سوئیت هوش مصنوعی (Gemini)',
    tabUsers: 'مدیریت کاربران و مشتریان',
    tabAllReports: 'آرشیو تمام گزارش‌ها',

    // Nav Tabs - Operator
    tabNewTest: 'ثبت آزمایش جدید',
    tabMySubmissions: 'آزمایش‌های ارسالی من',
    tabNewCustomer: 'تعریف مشتری جدید',

    // Nav Tabs - Customer
    tabApprovedReports: 'گواهینامه‌های تایید شده',
    tabInvoices: 'فاکتورها و پرداخت آنلاین',
    tabProjectGallery: 'گالری تصاویر پروژه',

    // Test Form & Data
    reportNo: 'شماره گزارش',
    customer: 'کارفرما / شرکت',
    selectCustomer: 'انتخاب کارفرما...',
    projectName: 'نام پروژه',
    sampleLocation: 'محل بتن‌ریزی و المان سازه‌ای',
    sampleLocationPlaceholder: 'مثال: سقف طبقه ۳ - ستون C4',
    concreteGrade: 'رده مقاومتی بتن',
    targetStrength: 'مقاومت مشخصه ۲۸ روزه (MPa)',
    moldType: 'نوع قالب نمونه‌گیری',
    cube150: 'مکعبی ۱۵×۱۵×۱۵ سانتی‌متر',
    cylinder150: 'استوانه‌ای ۱۵×۳۰ سانتی‌متر',
    slumpMm: 'اسلامپ (میلی‌متر)',
    waterCementRatio: 'نسبت آب به سیمان (W/C)',
    cementType: 'نوع و کارخانه سیمان',
    samplingDate: 'تاریخ نمونه‌گیری (جلالی)',
    samplingTime: 'ساعت بتن‌ریزی',
    truckBatchNo: 'شماره بارنامه / تراک‌میکسر',
    curingMethod: 'روش عمل‌آوری نمونه‌ها',
    
    // Breaking Data
    breaking7dLoad: 'نیروی شکست ۷ روزه (kN)',
    breaking7dStrength: 'مقاومت فشاری ۷ روزه (MPa)',
    breaking28dLoad: 'نیروی شکست ۲۸ روزه (kN)',
    breaking28dStrength: 'مقاومت فشاری ۲۸ روزه (MPa)',
    breakDate7d: 'تاریخ شکست ۷ روزه',
    breakDate28d: 'تاریخ شکست ۲۸ روزه',
    gpsCoordinates: 'موقعیت مکانی (GPS)',
    lat: 'عرض جغرافیایی (Lat)',
    lng: 'طول جغرافیایی (Lng)',
    projectAddress: 'آدرس محل پروژه',
    uploadPhotos: 'بارگذاری تصاویر نمونه‌گیری و جک هیدرولیک شکست',
    dropPhotos: 'تصاویر را اینجا بکشید یا برای انتخاب کلیک کنید',
    submitReport: 'ثبت و ارسال به کارتابل مدیر',
    submitting: 'در حال ذخیره‌سازی...',
    submissionSuccess: 'آزمایش با موفقیت ثبت شد و در انتظار تایید مدیریت قرار گرفت.',
    
    // Approval
    status: 'وضعیت',
    pending: 'در انتظار تایید',
    approved: 'تایید شده و نهایی',
    rejected: 'رد شده',
    approve: 'تایید گواهینامه',
    reject: 'رد گزارش',
    approvalNotes: 'توضیحات و دستور مدیر',
    approvedBy: 'تایید کننده',
    
    // Quality Status
    pass: 'منطبق بر استاندارد (Pass)',
    fail: 'عدم انطباق (Fail)',
    targetMet: 'مقاومت لازم تامین شده است',
    targetNotMet: 'مقاومت کمتر از حد مجاز استاندارد است',

    // Actions
    viewCertificate: 'مشاهده گواهینامه رسمی',
    downloadPdf: 'دریافت فایل PDF',
    printReport: 'چاپ گواهینامه A4',
    filter: 'فیلتر',
    search: 'جستجو...',
    actions: 'عملیات',
    save: 'ذخیره',
    cancel: 'انصراف',
    delete: 'حذف',
    edit: 'ویرایش',
    close: 'بستن',

    // Accounting
    financialOverview: 'داشبورد مالی و حسابداری آزمایشگاه',
    totalRevenue: 'کل درآمد وصول شده',
    totalExpenses: 'کل هزینه‌های جاری',
    netProfit: 'سود خالص عملیاتی',
    pendingInvoicesAmount: 'مطالبات معوق (فاکتورهای پرداخت نشده)',
    newTransaction: 'ثبت سند مالی جدید',
    newInvoice: 'صدور فاکتور رسمی',
    income: 'درآمد',
    expense: 'هزینه',
    category: 'دسته‌بندی',
    amount: 'مبلغ (تومان)',
    referenceNo: 'شماره پیگیری / سند',
    description: 'شرح سند',
    invoicesList: 'لیست فاکتورها',
    unpaid: 'پرداخت نشده',
    paid: 'پرداخت شده',
    payOnline: 'پرداخت آنلاین فاکتور',
    paymentSuccess: 'پرداخت با موفقیت انجام شد و گواهینامه‌ها آزاد شدند.',

    // AI Suite
    aiStrengthPredictor: 'پیش‌بینی هوشمند مقاومت ۲۸ روزه بتن (Gemini AI)',
    aiStrengthDesc: 'تخمین مقاومت فشاری ۲۸ روزه بر اساس مقاومت ۷ روزه، روانی (اسلامپ) و طرح مخلوط بر مبنای هوش مصنوعی و آئین‌نامه بتن ایران',
    predictButton: 'تحلیل و پیش‌بینی با جمنای',
    predicting: 'در حال تحلیل با هوش مصنوعی...',
    aiFinancialSummary: 'گزارش تحلیلی و مدیریتی مالی (Gemini AI)',
    generateFinancialReport: 'تولید گزارش هوشمند عملکرد مالی',
    predicted28dValue: 'مقاومت پیش‌بینی شده ۲۸ روزه',
    confidenceScore: 'ضریب اطمینان مدل',
    riskLevel: 'سطح ریسک سازه‌ای',
    aiRecommendations: 'توصیه‌های فنی و مهندسی هوش مصنوعی',
    curingAdvice: 'دستورالعمل مراقبت و عمل‌آوری بتن',
    
    // Customer Portal
    customerPortalTitle: 'پرتال اختصاصی کارفرمایان و مهندسین ناظر',
    myApprovedReports: 'نتایج و گواهینامه‌های رسمی آزمایش‌های بتن پروژه شما',
    onlinePaymentGateway: 'درگاه پرداخت آنلاین شاپرک / زرین‌پال',
    paymentReceipt: 'رسید پرداخت الکترونیک',

    // Common
    toman: 'تومان',
    rial: 'ریال',
    mpa: 'MPa',
    kn: 'kN',
    mm: 'mm',
    date: 'تاریخ',
    time: 'زمان',
  },
  en: {
    appName: 'Concrete Testing Laboratory Management System',
    appShortName: 'BetonLab',
    appSubtitle: 'QC Lab Management, Accounting, 28-Day Strength AI Predictor & Jalali Support',
    
    // Auth & Navigation
    login: 'Log In',
    logout: 'Sign Out',
    emailOrUsername: 'Email or Username',
    password: 'Password',
    loginButton: 'Sign In to Portal',
    quickDemoAccounts: 'Quick Demo Switch:',
    adminRole: 'Lab Administrator (Admin)',
    operatorRole: 'Field Technician (Operator)',
    customerRole: 'Project Client (Customer)',
    activeUser: 'Active User',
    welcome: 'Welcome',
    role: 'User Role',
    viewSqlSchema: 'View Supabase SQL Schema & RLS',
    realtimeConnected: 'Realtime Live Sync Active',
    systemStatus: 'System Status',

    // Roles
    roleAdmin: 'Administrator',
    roleOperator: 'Lab Operator',
    roleCustomer: 'Customer / Client',

    // Nav Tabs - Admin
    tabApprovalQueue: 'Approval Queue',
    tabAccounting: 'Accounting & Finance',
    tabAiSuite: 'Gemini AI Engineering Suite',
    tabUsers: 'User & Client Directory',
    tabAllReports: 'All Test Reports',

    // Nav Tabs - Operator
    tabNewTest: 'New Concrete Test Entry',
    tabMySubmissions: 'My Submissions',
    tabNewCustomer: 'Onboard Customer',

    // Nav Tabs - Customer
    tabApprovedReports: 'Certified Reports',
    tabInvoices: 'Invoices & Online Pay',
    tabProjectGallery: 'Project Gallery & GPS',

    // Test Form & Data
    reportNo: 'Report No.',
    customer: 'Customer / Company',
    selectCustomer: 'Select Customer...',
    projectName: 'Project Name',
    sampleLocation: 'Sampling Location & Structural Member',
    sampleLocationPlaceholder: 'e.g. 4th Floor Slab - Grid A-B',
    concreteGrade: 'Concrete Grade',
    targetStrength: 'Target 28-Day Strength (MPa)',
    moldType: 'Mold Specimen Type',
    cube150: '150x150x150 mm Cube',
    cylinder150: '150x300 mm Cylinder',
    slumpMm: 'Slump (mm)',
    waterCementRatio: 'Water/Cement Ratio (W/C)',
    cementType: 'Cement Type & Source',
    samplingDate: 'Sampling Date (Jalali)',
    samplingTime: 'Sampling Time',
    truckBatchNo: 'Truck / Batch No.',
    curingMethod: 'Curing Environment',

    // Breaking Data
    breaking7dLoad: '7-Day Breaking Load (kN)',
    breaking7dStrength: '7-Day Compressive Strength (MPa)',
    breaking28dLoad: '28-Day Breaking Load (kN)',
    breaking28dStrength: '28-Day Compressive Strength (MPa)',
    breakDate7d: '7-Day Break Date',
    breakDate28d: '28-Day Break Date',
    gpsCoordinates: 'GPS Location',
    lat: 'Latitude',
    lng: 'Longitude',
    projectAddress: 'Project Site Address',
    uploadPhotos: 'Upload Specimen & Breaking Test Photos',
    dropPhotos: 'Drag & drop photos or click to browse',
    submitReport: 'Submit Test for Admin Review',
    submitting: 'Submitting Data...',
    submissionSuccess: 'Test submitted successfully and queued for Administrator approval.',

    // Approval
    status: 'Status',
    pending: 'Pending Review',
    approved: 'Approved & Certified',
    rejected: 'Rejected',
    approve: 'Approve & Issue Certificate',
    reject: 'Reject Test Report',
    approvalNotes: 'Administrator Remarks',
    approvedBy: 'Certified By',

    // Quality Status
    pass: 'Compliant (Pass)',
    fail: 'Non-Compliant (Fail)',
    targetMet: 'Specified target strength satisfied',
    targetNotMet: 'Measured strength below code allowance',

    // Actions
    viewCertificate: 'View Official Certificate',
    downloadPdf: 'Download PDF',
    printReport: 'Print A4 Certificate',
    filter: 'Filter',
    search: 'Search...',
    actions: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',

    // Accounting
    financialOverview: 'Laboratory Financial & Accounting Overview',
    totalRevenue: 'Total Collected Revenue',
    totalExpenses: 'Operating Expenses',
    netProfit: 'Net Operating Profit',
    pendingInvoicesAmount: 'Outstanding Receivables',
    newTransaction: 'Record Transaction',
    newInvoice: 'Create Invoice',
    income: 'Income',
    expense: 'Expense',
    category: 'Category',
    amount: 'Amount (Toman)',
    referenceNo: 'Reference / Voucher No.',
    description: 'Description',
    invoicesList: 'Invoice Register',
    unpaid: 'Unpaid',
    paid: 'Paid',
    payOnline: 'Pay Invoice Online',
    paymentSuccess: 'Payment processed successfully! Certificates unlocked.',

    // AI Suite
    aiStrengthPredictor: 'AI 28-Day Concrete Strength Predictor (Gemini)',
    aiStrengthDesc: 'Estimates 28-day compressive strength based on 7-day slump & mix parameters using Google Gemini API and ACI 209R standards.',
    predictButton: 'Analyze & Predict with Gemini',
    predicting: 'Analyzing with AI Model...',
    aiFinancialSummary: 'Financial Performance AI Summary (Gemini)',
    generateFinancialReport: 'Generate AI Executive Summary',
    predicted28dValue: 'Predicted 28-Day Strength',
    confidenceScore: 'Confidence Score',
    riskLevel: 'Structural Risk Assessment',
    aiRecommendations: 'Engineering Recommendations',
    curingAdvice: 'Recommended Curing Protocol',

    // Customer Portal
    customerPortalTitle: 'Client & Supervising Engineer Portal',
    myApprovedReports: 'Approved Test Certificates for Your Projects',
    onlinePaymentGateway: 'Secure Online Payment Gateway',
    paymentReceipt: 'Electronic Payment Receipt',

    // Common
    toman: 'Toman',
    rial: 'IRR',
    mpa: 'MPa',
    kn: 'kN',
    mm: 'mm',
    date: 'Date',
    time: 'Time',
  }
};
