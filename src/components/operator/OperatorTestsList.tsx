import React, { useState } from 'react';
import { TestReport, Customer } from '../../types';
import { Search, Filter, Eye, PenTool, CheckCircle2, AlertTriangle, Clock, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali';
import { OperatorResultModal } from './OperatorResultModal';
import { PrintCertificate } from '../common/PrintCertificate';
import { PrintStandardSheetModal } from '../common/PrintStandardSheetModal';

interface OperatorTestsListProps {
  reports: TestReport[];
  customers: Customer[];
  onRefresh?: () => void;
}

export const OperatorTestsList: React.FC<OperatorTestsListProps> = ({ 
  reports, 
  customers,
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  
  // Modals
  const [selectedForEntry, setSelectedForEntry] = useState<TestReport | null>(null);
  const [selectedForPreview, setSelectedForPreview] = useState<TestReport | null>(null);
  const [selectedForStandardSheet, setSelectedForStandardSheet] = useState<TestReport | null>(null);

  const filteredReports = reports.filter(r => {
    const reportCode = (r.reportNo || r.id).toLowerCase();
    const matchesSearch = 
      reportCode.includes(searchTerm.toLowerCase()) || 
      r.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sampleLocation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesGrade = gradeFilter === 'all' || r.concreteGrade === gradeFilter;

    return matchesSearch && matchesStatus && matchesGrade;
  });

  const getCustomerForReport = (report: TestReport) => {
    return customers.find(c => c.id === report.customerId);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              بانک آزمایش‌ها و نمونه‌های آزمایشگاه
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مدیریت نمونه‌های در حال کیورینگ، ثبت بار گسیختگی جک هیدرولیکی و مشاهده شیت آزمون
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 lg:w-64">
              <input 
                type="text" 
                placeholder="جستجو کد گزارش، پروژه یا کارفرما..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            </div>

            {/* Status Filter */}
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="pending">در انتظار شکست / کیورینگ</option>
              <option value="approved">تایید شده</option>
              <option value="rejected">مردود</option>
            </select>

            {/* Grade Filter */}
            <select 
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value="all">همه رده‌ها</option>
              <option value="C20">C20</option>
              <option value="C25">C25</option>
              <option value="C30">C30</option>
              <option value="C35">C35</option>
              <option value="C40">C40</option>
            </select>

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition"
                title="تازه‌سازی لیست"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-slate-400 border-b border-slate-100 dark:border-slate-800 text-xs">
                <th className="pb-3.5 font-bold">شناسه شیت</th>
                <th className="pb-3.5 font-bold">کارفرما و پروژه</th>
                <th className="pb-3.5 font-bold">موقعیت سازه‌ای</th>
                <th className="pb-3.5 font-bold">رده بتن</th>
                <th className="pb-3.5 font-bold">شکست ۷ روزه</th>
                <th className="pb-3.5 font-bold">شکست ۲۸ روزه</th>
                <th className="pb-3.5 font-bold">وضعیت</th>
                <th className="pb-3.5 font-bold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredReports.length > 0 ? filteredReports.map(r => {
                const is28Ready = !!r.breaking28dStrengthMpa;
                const is7Ready = !!r.breaking7dStrengthMpa;
                
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="py-4 font-mono text-xs text-blue-600 font-bold">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.reportNo || r.id}</span>
                      </div>
                      <span className="block text-[10px] text-slate-400 font-sans mt-0.5">
                        {toPersianDigits(r.samplingDateJalali)}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {r.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.projectName}</div>
                    </td>
                    <td className="py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={r.sampleLocation}>
                      {r.sampleLocation}
                    </td>
                    <td className="py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {r.concreteGrade}
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {r.moldType === 'cube_150' ? 'مکعبی ۱۵cm' : 'استوانه‌ای'}
                      </span>
                    </td>
                    <td className="py-4 font-mono text-xs">
                      {is7Ready ? (
                        <span className="font-bold text-blue-600">
                          {toPersianDigits(r.breaking7dStrengthMpa!)} MPa
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" /> در انتظار
                        </span>
                      )}
                    </td>
                    <td className="py-4 font-mono text-xs">
                      {is28Ready ? (
                        <span className={`font-bold ${r.breaking28dStrengthMpa! >= r.targetStrengthMpa ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {toPersianDigits(r.breaking28dStrengthMpa!)} MPa
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" /> در انتظار
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      {r.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[11px] font-bold border border-emerald-100 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> تایید شده
                        </span>
                      ) : r.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 text-[11px] font-bold border border-amber-100 dark:border-amber-800">
                          <Clock className="w-3 h-3" /> در حال آزمایش
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-[11px] font-bold border border-rose-100 dark:border-rose-800">
                          <AlertTriangle className="w-3 h-3" /> عدم انطباق
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => setSelectedForStandardSheet(r)}
                          className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer" 
                          title="مشاهده، چاپ و دانلود شیت رسمی شکست بتن (ISIRI 3201)"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSelectedForPreview(r)}
                          className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:border-blue-300 transition cursor-pointer" 
                          title="مشاهده شیت و گواهینامه آزمایشگاه"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSelectedForEntry(r)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center gap-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-bold transition cursor-pointer" 
                          title="ثبت بار شکست جک هیدرولیکی"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>ثبت بار شکست</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    هیچ نمونه‌ای با شرایط فیلتر انتخاب شده یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Break Test Entry Modal */}
      {selectedForEntry && (
        <OperatorResultModal
          report={selectedForEntry}
          onClose={() => setSelectedForEntry(null)}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
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

      {/* Official Concrete Resistance Standard Sheet Modal (ISIRI 3201) */}
      {selectedForStandardSheet && (
        <PrintStandardSheetModal
          report={selectedForStandardSheet}
          customer={getCustomerForReport(selectedForStandardSheet)}
          onClose={() => setSelectedForStandardSheet(null)}
        />
      )}
    </div>
  );
};
