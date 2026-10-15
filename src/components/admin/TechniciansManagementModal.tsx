import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  Shield, 
  X, 
  Search,
  AlertCircle
} from 'lucide-react';
import { FieldTechnician } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits } from '../../utils/jalali';

interface TechniciansManagementModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onTechniciansChanged?: () => void;
  onUpdated?: () => void;
}

export const TechniciansManagementModal: React.FC<TechniciansManagementModalProps> = ({
  isOpen = true,
  onClose,
  onTechniciansChanged,
  onUpdated
}) => {
  const [technicians, setTechnicians] = useState<FieldTechnician[]>(() => labDb.getTechnicians());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create / Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [specialty, setSpecialty] = useState('تکنسین ارشد نمونه‌برداری بتن');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const notifyChange = () => {
    if (onTechniciansChanged) onTechniciansChanged();
    if (onUpdated) onUpdated();
  };

  // Subscribe to storage changes
  useEffect(() => {
    if (!isOpen) return;
    const unsub = labDb.subscribe(() => {
      setTechnicians(labDb.getTechnicians());
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingTechId(null);
    setFullName('');
    setPhone('');
    setNationalCode('');
    setSpecialty('تکنسین ارشد نمونه‌برداری بتن');
    setIsActive(true);
    setNotes('');
    setFormError(null);
  };

  const handleStartEdit = (tech: FieldTechnician) => {
    setIsEditing(true);
    setEditingTechId(tech.id);
    setFullName(tech.fullName);
    setPhone(tech.phone || '');
    setNationalCode(tech.nationalCode || '');
    setSpecialty(tech.specialty || 'تکنسین نمونه‌برداری');
    setIsActive(tech.isActive);
    setNotes(tech.notes || '');
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('لطفاً نام و نام خانوادگی تکنسین را وارد فرمایید.');
      return;
    }
    if (!phone.trim()) {
      setFormError('لطفاً شماره تماس معتبر تکنسین را وارد فرمایید.');
      return;
    }

    if (editingTechId) {
      labDb.updateTechnician(editingTechId, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalCode: nationalCode.trim() || undefined,
        specialty: specialty.trim(),
        isActive,
        notes: notes.trim() || undefined
      });
      setActionSuccess(`اطلاعات تکنسین «${fullName}» با موفقیت بروزرسانی شد.`);
    } else {
      labDb.addTechnician({
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalCode: nationalCode.trim() || undefined,
        specialty: specialty.trim(),
        isActive,
        notes: notes.trim() || undefined
      });
      setActionSuccess(`تکنسین جدید «${fullName}» با موفقیت در سامانه آزمایشگاه ثبت گردید.`);
    }

    setTechnicians(labDb.getTechnicians());
    notifyChange();
    resetForm();
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleDelete = (tech: FieldTechnician) => {
    if (confirm(`آیا از حذف تکنسین «${tech.fullName}» از فهرست آزمایشگاه اطمینان دارید؟`)) {
      labDb.deleteTechnician(tech.id);
      setTechnicians(labDb.getTechnicians());
      notifyChange();
      setActionSuccess(`تکنسین «${tech.fullName}» حذف شد.`);
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  const handleToggleStatus = (tech: FieldTechnician) => {
    labDb.updateTechnician(tech.id, { isActive: !tech.isActive });
    setTechnicians(labDb.getTechnicians());
    notifyChange();
  };

  const filteredTechs = technicians.filter(t => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return true;
    return (
      (t.fullName || '').toLowerCase().includes(s) ||
      (t.phone || '').includes(s) ||
      (t.specialty || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 max-h-[92vh] flex flex-col text-start">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>مدیریت تکنسین‌های مسئول اعزام به کارگاه</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono">
                  {toPersianDigits(technicians.length)} نفر
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تعریف، ویرایش مشخصات، تخصیص تخصص‌ها و حذف تکنسین‌های نمونه‌برداری و مقیم
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success / Error Alerts */}
        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Action Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام، تلفن یا تخصص تکنسین..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 pe-9 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {!isEditing && (
            <button
              onClick={() => {
                resetForm();
                setIsEditing(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>تعریف تکنسین جدید</span>
            </button>
          )}
        </div>

        {/* Form Container (When Creating or Editing) */}
        {isEditing && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900/50 space-y-4 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                {editingTechId ? <Pencil className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>{editingTechId ? 'ویرایش مشخصات تکنسین مسئول اعزام' : 'تعریف و ثبت مشخصات تکنسین جدید'}</span>
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                انصراف
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900/40">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نام و نام خانوادگی تکنسین *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: مهندس سهراب مرادی"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شماره تماس همراه *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0913..."
                  dir="ltr"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  کد ملی تکنسین
                </label>
                <input
                  type="text"
                  value={nationalCode}
                  onChange={(e) => setNationalCode(e.target.value)}
                  placeholder="۱۰ رقمی..."
                  dir="ltr"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حوزه تخصصی و صلاحیت فنی
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="سرپرست اکیپ و تکنسین ارشد بتن">سرپرست اکیپ و تکنسین ارشد بتن</option>
                  <option value="تکنسین آزمایشگاه بتن و قالب‌گیری">تکنسین آزمایشگاه بتن و قالب‌گیری</option>
                  <option value="نمونه‌بردار مقیم و آزمون اسلامپ">نمونه‌بردار مقیم و آزمون اسلامپ</option>
                  <option value="تکنسین آزمون‌های غیرمخرب (اشمیت و التراسونیک)">تکنسین آزمون‌های غیرمخرب (اشمیت و التراسونیک)</option>
                  <option value="تکنسین کرگیری و مغزه‌گیری بتن">تکنسین کرگیری و مغزه‌گیری بتن</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وضعیت فعالیت
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={isActive}
                      onChange={() => setIsActive(true)}
                      className="text-blue-600"
                    />
                    <span className="text-xs font-bold text-emerald-600">فعال و آماده اعزام</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isActive}
                      onChange={() => setIsActive(false)}
                      className="text-rose-600"
                    />
                    <span className="text-xs font-bold text-slate-400">غیرفعال (مرخصی/معلق)</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات و یادداشت اداری
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="شماره گواهینامه فنی، شماره وسیله نقلیه یا اولویت اعزام..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
                >
                  {editingTechId ? 'ذخیره تغییرات تکنسین' : 'ثبت تکنسین جدید'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Technicians List / Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold sticky top-0">
              <tr>
                <th className="p-3.5 text-start">نام تکنسین</th>
                <th className="p-3.5 text-start">حوزه تخصص / صلاحیت</th>
                <th className="p-3.5 text-start">شماره تماس</th>
                <th className="p-3.5 text-start">کد ملی</th>
                <th className="p-3.5 text-start">وضعیت نوبت اعزام</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTechs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    هیچ تکنسینی با مشخصات وارد شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredTechs.map((tech) => (
                  <tr key={tech.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {tech.fullName}
                      </div>
                      {tech.notes && (
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {tech.notes}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                        {tech.specialty}
                      </span>
                    </td>

                    <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                      {tech.phone}
                    </td>

                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                      {tech.nationalCode || '-'}
                    </td>

                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleStatus(tech)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                          tech.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                        }`}
                        title="جهت تغییر وضعیت کلیک کنید"
                      >
                        {tech.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>آماده اعزام</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>غیرفعال</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(tech)}
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition"
                          title="ویرایش اطلاعات تکنسین"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tech)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
                          title="حذف تکنسین"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 shrink-0">
          <span>تکنسین‌های فعال به‌صورت خودکار در فرم‌های تخصیص نوبت و اعزام به پروژه پیشنهاد می‌شوند.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
