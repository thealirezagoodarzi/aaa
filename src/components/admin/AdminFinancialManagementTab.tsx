import React, { useState } from 'react';
import { Customer, CustomerPaymentRecord } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
// BUG FIX (ID collision): DOC number was uniqueRefNo('DOC')
import { uniqueRefNo } from '../../utils/uniqueId';
import {
  Wallet, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  FileText, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Check, 
  X, 
  Calendar,
  Layers,
  Sparkles,
  Filter,
  DollarSign
} from 'lucide-react';

interface AdminFinancialManagementTabProps {
  customers: Customer[];
  onCustomersUpdated: () => void;
}

export const AdminFinancialManagementTab: React.FC<AdminFinancialManagementTabProps> = ({
  customers,
  onCustomersUpdated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    customers[0]?.id || null
  );

  // Modal for Adding / Editing Payment Record
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cheque' | 'pos' | 'card_to_card'>('bank_transfer');
  const [paymentDocNo, setPaymentDocNo] = useState('');
  const [paymentBank, setPaymentBank] = useState('بانک ملت');
  const [paymentDateJalali, setPaymentDateJalali] = useState(formatJalali(getTodayJalali()));
  const [paymentDueDateJalali, setPaymentDueDateJalali] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'cleared' | 'pending'>('cleared');

  // Modal for Quick Editing Customer Financial Budget
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false);
  const [budgetTotalContract, setBudgetTotalContract] = useState('');
  const [budgetPaidAmount, setBudgetPaidAmount] = useState('');

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  // Calculate Overall Financial Aggregates
  const totalContractAll = customers.reduce((sum, c) => sum + (c.totalContractAmount || 0), 0);
  const totalPaidAll = customers.reduce((sum, c) => sum + (c.paidAmount || (c.paymentRecords?.reduce((pSum, r) => pSum + (r.status === 'cleared' ? r.amount : 0), 0) || 0)), 0);
  const totalBalanceAll = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const filteredCustomers = customers.filter(c => 
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.representativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contractNo && c.contractNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.projectNamePrimary && c.projectNamePrimary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenAddPayment = () => {
    setPaymentAmount('');
    setPaymentDocNo(uniqueRefNo('DOC'));
    setPaymentBank('بانک ملت');
    setPaymentDateJalali(formatJalali(getTodayJalali()));
    setPaymentDueDateJalali('');
    setPaymentDescription('');
    setPaymentStatus('cleared');
    setShowAddPaymentModal(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amountNum = parseInt(paymentAmount.replace(/,/g, '') || '0', 10);
    if (amountNum <= 0) return;

    labDb.addCustomerPayment(selectedCustomer.id, {
      amount: amountNum,
      method: paymentMethod,
      documentNo: paymentDocNo,
      bankName: paymentBank,
      jalaliDate: paymentDateJalali,
      dueDateJalali: paymentDueDateJalali || undefined,
      description: paymentDescription || 'ثبت دستی توسط مدیریت مالی',
      registeredBy: 'مدیریت مالی',
      status: paymentStatus
    });

    onCustomersUpdated();
    setShowAddPaymentModal(false);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!selectedCustomer) return;
    if (window.confirm('آیا از حذف این سند و بازگشت مانده حساب اطمینان دارید؟')) {
      labDb.deleteCustomerPayment(selectedCustomer.id, paymentId);
      onCustomersUpdated();
    }
  };

  const handleOpenEditBudget = () => {
    if (!selectedCustomer) return;
    setBudgetTotalContract(String(selectedCustomer.totalContractAmount || 0));
    setBudgetPaidAmount(String(selectedCustomer.paidAmount || 0));
    setShowEditBudgetModal(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const totalNum = parseInt(budgetTotalContract.replace(/,/g, '') || '0', 10);
    const paidNum = parseInt(budgetPaidAmount.replace(/,/g, '') || '0', 10);
    const balanceNum = Math.max(0, totalNum - paidNum);

    labDb.updateCustomerFinancials(selectedCustomer.id, {
      totalContractAmount: totalNum,
      paidAmount: paidNum,
      balance: balanceNum
    });

    onCustomersUpdated();
    setShowEditBudgetModal(false);
  };

  const getMethodBadge = (method: CustomerPaymentRecord['method']) => {
    switch (method) {
      case 'bank_transfer':
        return <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-[10px]">حواله ساتنا/پایا</span>;
      case 'cheque':
        return <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-bold text-[10px]">چک صیادی</span>;
      case 'pos':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">کارتخوان (POS)</span>;
      case 'card_to_card':
        return <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold text-[10px]">کارت به کارت</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800 dark:text-slate-100">
      
      {/* Top Financial KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              کل ارزش قراردادهای ثبتی
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {toPersianDigits(totalContractAll.toLocaleString())}
              <span className="text-xs font-sans text-slate-500 mr-1.5">تومان</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold block mt-1">
              {toPersianDigits(customers.length)} شرکت و پروژه فعال
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              مجموع مبالغ وصول‌شده (تسویه)
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {toPersianDigits(totalPaidAll.toLocaleString())}
              <span className="text-xs font-sans text-slate-500 mr-1.5">تومان</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold block mt-1">
              {totalContractAll > 0 ? toPersianDigits(Math.round((totalPaidAll / totalContractAll) * 100)) : 0}٪ وصولی کل
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              مانده مطالبات وصول‌نشده (بدهی)
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
              {toPersianDigits(totalBalanceAll.toLocaleString())}
              <span className="text-xs font-sans text-slate-500 mr-1.5">تومان</span>
            </div>
            <span className="text-[11px] text-rose-500 font-bold block mt-1">
              نیاز به پیگیری و تسویه
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Financial Master-Detail Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (4 cols): Customer Accounts List */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span>حساب‌های مالی کارفرمایان</span>
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {toPersianDigits(filteredCustomers.length)}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام شرکت، پروژه، قرارداد..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pr-9 pl-4 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* List of Customers */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredCustomers.map(cust => {
              const isSelected = selectedCustomer?.id === cust.id;
              const total = cust.totalContractAmount || 0;
              const paid = cust.paidAmount || (cust.paymentRecords?.reduce((s, r) => s + (r.status === 'cleared' ? r.amount : 0), 0) || 0);
              const bal = cust.balance || Math.max(0, total - paid);
              const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

              return (
                <button
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`w-full text-right p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                    isSelected 
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-sm'
                      : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[180px]">
                      {cust.companyName}
                    </span>
                    {bal === 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        تسویه کامل
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                        بدهکار
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {cust.projectNamePrimary || cust.projectNames?.[0] || 'پروژه جاری'}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">وصولی: {toPersianDigits(percent)}٪</span>
                      <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                        {toPersianDigits(paid.toLocaleString())} / {toPersianDigits(total.toLocaleString())}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Selected Customer Financial Details & Payments Ledger */}
        <div className="lg:col-span-8 space-y-6">
          
          {selectedCustomer ? (
            <>
              {/* Detailed Financial Profile Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
                
                {/* Header Profile */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-slate-900 dark:text-white">
                        {selectedCustomer.companyName}
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono font-bold">
                        {selectedCustomer.contractNo || 'CTL-CN-1403'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      نماینده: {selectedCustomer.representativeName} ({selectedCustomer.phone}) • پروژه: {selectedCustomer.projectNamePrimary || selectedCustomer.projectNames?.[0]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenEditBudget}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      <span>ویرایش مبالغ قرارداد</span>
                    </button>

                    <button
                      onClick={handleOpenAddPayment}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ثبت واریزی / سند جدید</span>
                    </button>
                  </div>
                </div>

                {/* 3 Core Numbers Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-xs block">مبلغ کل تعهد قرارداد:</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                      {toPersianDigits((selectedCustomer.totalContractAmount || 0).toLocaleString())} تومان
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      تعداد سری: {toPersianDigits(selectedCustomer.sampleSeriesCount || 0)} سری
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <span className="text-emerald-700 dark:text-emerald-400 text-xs block font-bold">مجموع واریزی‌های معتبر:</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                      {toPersianDigits((selectedCustomer.paidAmount || 0).toLocaleString())} تومان
                    </span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">
                      تعداد اسناد واریزی: {toPersianDigits(selectedCustomer.paymentRecords?.length || 0)} سند
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                    <span className="text-rose-700 dark:text-rose-400 text-xs block font-bold">مانده قابل پرداخت (بدهی):</span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                      {toPersianDigits((selectedCustomer.balance || 0).toLocaleString())} تومان
                    </span>
                    <span className="text-[10px] text-rose-500 block mt-0.5">
                      {(selectedCustomer.balance || 0) === 0 ? 'تسویه کامل می‌باشد' : 'عدم صدور شیت نهایی تا تسویه'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Payment Documents & Vouchers Ledger */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      ریز اسناد پرداختی و فیش‌های واریزی کارفرما
                    </h3>
                  </div>

                  <span className="text-xs text-slate-500">
                    {toPersianDigits(selectedCustomer.paymentRecords?.length || 0)} تراکنش مالی ثبت شده
                  </span>
                </div>

                {/* Ledger Table */}
                {(!selectedCustomer.paymentRecords || selectedCustomer.paymentRecords.length === 0) ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      هیچ سند پرداختی برای این شرکت ثبت نشده است.
                    </p>
                    <button
                      onClick={handleOpenAddPayment}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ثبت اولین سند واریزی</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                          <th className="pb-3 font-bold">روش و سند</th>
                          <th className="pb-3 font-bold">شماره سند / پیگیری</th>
                          <th className="pb-3 font-bold">بانک و تاریخ</th>
                          <th className="pb-3 font-bold">مبلغ (تومان)</th>
                          <th className="pb-3 font-bold">توضیحات و بابت</th>
                          <th className="pb-3 font-bold">وضعیت</th>
                          <th className="pb-3 font-bold text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {selectedCustomer.paymentRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                            <td className="py-3.5 font-bold">
                              {getMethodBadge(rec.method)}
                            </td>

                            <td className="py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {rec.documentNo}
                            </td>

                            <td className="py-3.5 text-slate-600 dark:text-slate-400">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{rec.bankName || 'بانک ملت'}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{toPersianDigits(rec.jalaliDate)}</div>
                            </td>

                            <td className="py-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {toPersianDigits(rec.amount.toLocaleString())}
                            </td>

                            <td className="py-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={rec.description}>
                              {rec.description || 'بابت خدمات آزمایشگاهی'}
                            </td>

                            <td className="py-3.5">
                              {rec.status === 'cleared' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1 w-max">
                                  <CheckCircle className="w-3 h-3" />
                                  وصول شده
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1 w-max">
                                  <Clock className="w-3 h-3" />
                                  در انتظار تایید
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 text-center">
                              <button
                                onClick={() => handleDeletePayment(rec.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition"
                                title="حذف این سند"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
              <p className="text-slate-400 text-xs">لطفاً یک شرکت را از لیست سمت راست انتخاب نمایید.</p>
            </div>
          )}

        </div>

      </div>

      {/* MODAL: ADD PAYMENT RECORD */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ثبت سند واریزی جدید برای {selectedCustomer?.companyName}
                </h3>
              </div>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ واریزی (تومان) *
                </label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="مثال: 25000000"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    روش پرداخت *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="bank_transfer">حواله پایا / ساتنا</option>
                    <option value="cheque">چک صیادی بانکی</option>
                    <option value="pos">کارتخوان آزمایشگاه (POS)</option>
                    <option value="card_to_card">کارت به کارت</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره فیش / سند / چک *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentDocNo}
                    onChange={(e) => setPaymentDocNo(e.target.value)}
                    placeholder="TR-982410"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام بانک مقصد
                  </label>
                  <input
                    type="text"
                    value={paymentBank}
                    onChange={(e) => setPaymentBank(e.target.value)}
                    placeholder="بانک ملت شعبه کاج"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاریخ واریز شمسی *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentDateJalali}
                    onChange={(e) => setPaymentDateJalali(e.target.value)}
                    placeholder="1403/07/28"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {paymentMethod === 'cheque' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاریخ سررسید چک صیادی
                  </label>
                  <input
                    type="text"
                    value={paymentDueDateJalali}
                    onChange={(e) => setPaymentDueDateJalali(e.target.value)}
                    placeholder="1403/10/15"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات و بابت سند
                </label>
                <input
                  type="text"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="بابت تسویه قسط مرحله فونداسیون و سقف اول"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>ثبت سند و اعمال در مانده حساب</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: QUICK EDIT BUDGET */}
      {showEditBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ویرایش مبالغ قرارداد و تراز مالی
                </h3>
              </div>
              <button
                onClick={() => setShowEditBudgetModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ کل قرارداد پروژه (تومان)
                </label>
                <input
                  type="number"
                  required
                  value={budgetTotalContract}
                  onChange={(e) => setBudgetTotalContract(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مجموع واریزی‌ها (تومان)
                </label>
                <input
                  type="number"
                  required
                  value={budgetPaidAmount}
                  onChange={(e) => setBudgetPaidAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-600"
                />
              </div>

              <div>
                <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مانده جدید:
                </span>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                  {toPersianDigits(
                    Math.max(
                      0,
                      (parseInt(budgetTotalContract || '0') - parseInt(budgetPaidAmount || '0'))
                    ).toLocaleString()
                  )} تومان
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditBudgetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
