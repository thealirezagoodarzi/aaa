import React, { useState, useEffect, useRef } from 'react';
import { 
  JalaliDate, 
  JALALI_MONTH_NAMES_FA, 
  WEEKDAYS_SHORT_FA, 
  getDaysInJalaliMonth, 
  getTodayJalali, 
  formatJalali, 
  parseJalali, 
  toPersianDigits,
  addDaysToJalali,
  getFirstWeekdayOfJalaliMonth
} from '../../utils/jalali';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Clock, 
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';

interface JalaliDatePickerProps {
  id?: string;
  value: string; // e.g. "1403/06/18"
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  id,
  value,
  onChange,
  label,
  placeholder = '۱۴۰۳/۰۶/۱۸',
  required = false,
  disabled = false,
  helperText
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const parsed = parseJalali(value) || getTodayJalali();
  const [viewYear, setViewYear] = useState<number>(parsed.jy);
  const [viewMonth, setViewMonth] = useState<number>(parsed.jm);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const daysInMonth = getDaysInJalaliMonth(viewYear, viewMonth);
  const firstWeekday = getFirstWeekdayOfJalaliMonth(viewYear, viewMonth);
  const today = getTodayJalali();

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsYearPickerOpen(false);
        setIsMonthPickerOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Update view when value changes from outside
  useEffect(() => {
    const p = parseJalali(value);
    if (p) {
      setViewYear(p.jy);
      setViewMonth(p.jm);
    }
  }, [value]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const selected: JalaliDate = { jy: viewYear, jm: viewMonth, jd: day };
    onChange(formatJalali(selected));
    setIsOpen(false);
  };

  const handlePreset = (presetDate: JalaliDate) => {
    setViewYear(presetDate.jy);
    setViewMonth(presetDate.jm);
    onChange(formatJalali(presetDate));
    setIsOpen(false);
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const yearsList = [1398, 1399, 1400, 1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408];

  return (
    <div ref={containerRef} className="relative w-full text-start">
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative group">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={value ? toPersianDigits(value) : ''}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          placeholder={placeholder}
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed shadow-xs transition"
        />
        
        <div className="absolute end-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="پاک کردن تاریخ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition"
            title="تقویم جلالی"
          >
            <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          {helperText}
        </p>
      )}

      {isOpen && (
        <div className="absolute start-0 top-full mt-2 z-50 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 text-start">
          
          {/* Header: Month & Year with Quick Dropdown Jumper */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 relative">
            {/* Previous Month */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>

            {/* Jumpers */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMonthPickerOpen(!isMonthPickerOpen);
                  setIsYearPickerOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition"
              >
                {JALALI_MONTH_NAMES_FA[viewMonth - 1]}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsYearPickerOpen(!isYearPickerOpen);
                  setIsMonthPickerOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition font-mono"
              >
                {toPersianDigits(viewYear)}
              </button>
            </div>

            {/* Next Month */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>

            {/* Month Picker Dropdown Overlay */}
            {isMonthPickerOpen && (
              <div className="absolute top-12 inset-x-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 grid grid-cols-3 gap-1 z-20 animate-in fade-in">
                {JALALI_MONTH_NAMES_FA.map((mName, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setViewMonth(idx + 1);
                      setIsMonthPickerOpen(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                      viewMonth === idx + 1
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            )}

            {/* Year Picker Dropdown Overlay */}
            {isYearPickerOpen && (
              <div className="absolute top-12 inset-x-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 grid grid-cols-3 gap-1.5 z-20 animate-in fade-in font-mono max-h-52 overflow-y-auto">
                {yearsList.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setIsYearPickerOpen(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                      viewYear === y
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {toPersianDigits(y)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Laboratory Presets */}
          <div className="py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => handlePreset(today)}
              className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => handlePreset(addDaysToJalali(today, -1))}
              className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition"
            >
              دیروز
            </button>
            <button
              type="button"
              onClick={() => handlePreset(addDaysToJalali(today, -7))}
              className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
              title="نمونه‌گیری ۷ روز پیش (شکست امروز)"
            >
              ۷ روز پیش
            </button>
            <button
              type="button"
              onClick={() => handlePreset(addDaysToJalali(today, -28))}
              className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
              title="نمونه‌گیری ۲۸ روز پیش (شکست امروز)"
            >
              ۲۸ روز پیش
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800">
            {WEEKDAYS_SHORT_FA.map((wd, idx) => (
              <span key={idx} className={idx === 6 ? 'text-rose-500 font-extrabold' : ''}>
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center pt-2">
            {/* Empty slots for weekdays before 1st of month */}
            {Array.from({ length: firstWeekday }).map((_, idx) => (
              <div key={`offset-${idx}`} className="h-8 w-8" />
            ))}
            {daysArray.map((day) => {
              const isSelected = parsed && parsed.jy === viewYear && parsed.jm === viewMonth && parsed.jd === day;
              const isCurrentToday = today.jy === viewYear && today.jm === viewMonth && today.jd === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition font-mono ${
                    isSelected
                      ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30 ring-2 ring-blue-400'
                      : isCurrentToday
                      ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[11px] text-slate-400">
              امروز: <strong className="font-mono text-slate-700 dark:text-slate-300">{toPersianDigits(formatJalali(today))}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold"
            >
              تایید و بستن
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
