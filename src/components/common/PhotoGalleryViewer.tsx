import React, { useState, useEffect, useRef } from 'react';
import { LabMediaItem, MediaCategory, Customer, UserProfile } from '../../types';
import { labDb } from '../../services/supabase';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { downloadBlob, downloadDataUrl } from '../../utils/printDom';
import { optimizeAndReadImageFile } from '../../utils/fileUpload';
import { 
  Camera, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  X, 
  Filter, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle,
  FileCheck,
  Building2,
  Calendar,
  Layers,
  ZoomIn,
  Search,
  Plus
} from 'lucide-react';

interface PhotoGalleryViewerProps {
  currentUser: UserProfile;
  customerId?: string;
  readOnly?: boolean;
}

const CATEGORY_LABELS: Record<MediaCategory, string> = {
  breaking_test: 'آزمایش شکست و گسیختگی مکعب',
  concrete_cube: 'نمونه‌گیری و کیورینگ حوضچه',
  slump_test: 'تست اسلامپ و روانی کارگاه',
  ndt_rebound: 'آزمون غیرمخرب چکش اشمیت',
  sampling_site: 'بتن‌ریزی و محل کارگاه',
  other: 'سایر مستندات فنی'
};

const CATEGORY_COLORS: Record<MediaCategory, string> = {
  breaking_test: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/50',
  concrete_cube: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
  slump_test: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
  ndt_rebound: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900/50',
  sampling_site: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
  other: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit

export const PhotoGalleryViewer: React.FC<PhotoGalleryViewerProps> = ({
  currentUser,
  customerId,
  readOnly = false
}) => {
  const [mediaItems, setMediaItems] = useState<LabMediaItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedImageForView, setSelectedImageForView] = useState<LabMediaItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Upload form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MediaCategory>('breaking_test');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customerId || '');
  const [projectName, setProjectName] = useState('');
  const [reportNo, setReportNo] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = () => {
    const items = labDb.getMediaItems(customerId);
    setMediaItems(items);
    setCustomers(labDb.getCustomers());
  };

  useEffect(() => {
    refreshData();
    const unsub = labDb.subscribe(refreshData);
    return () => unsub();
  }, [customerId]);

  const handleFileSelection = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('تنها بارگذاری فایل‌های تصویری (JPG, PNG, WebP) مجاز است.');
      return;
    }

    try {
      const dataUrl = await optimizeAndReadImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      setImagePreviewUrl(dataUrl);
      setFileSizeBytes(Math.round(dataUrl.length * 0.75));
    } catch (err: any) {
      setUploadError(err?.message || 'خطا در بهینه‌سازی و بارگذاری تصویر.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreviewUrl) {
      setUploadError('لطفاً ابتدا تصویر مورد نظر را انتخاب نمایید.');
      return;
    }
    if (!title.trim()) {
      setUploadError('عنوان تصویر الزامی است.');
      return;
    }

    const targetCustomer = customers.find(c => c.id === selectedCustomer) || customers[0];

    try {
      labDb.addMediaItem({
        title: title.trim(),
        category,
        imageUrl: imagePreviewUrl,
        fileSizeBytes,
        customerId: targetCustomer?.id || customerId || 'cust-01',
        customerName: targetCustomer?.companyName || 'مشتری آزمایشگاه',
        projectName: projectName.trim() || targetCustomer?.projectNames?.[0] || 'پروژه جاری',
        reportNo: reportNo.trim() || undefined,
        uploadedBy: currentUser.id,
        uploaderName: currentUser.fullName,
        jalaliDate: formatJalali(getTodayJalali()),
        description: description.trim() || undefined
      });

      setUploadSuccess('تصویر با موفقیت در گالری مستندات ثبت شد.');
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(null);
        resetUploadForm();
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'خطا در ثبت تصویر.');
    }
  };

  const resetUploadForm = () => {
    setTitle('');
    setCategory('breaking_test');
    setProjectName('');
    setReportNo('');
    setDescription('');
    setImagePreviewUrl(null);
    setFileSizeBytes(0);
    setUploadError(null);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('آیا از حذف این تصویر از مستندات اطمینان دارید؟')) {
      labDb.deleteMediaItem(id);
    }
  };

  const handleDownloadImage = async (item: LabMediaItem) => {
    const filename = `BetonLab-${item.category}-${item.jalaliDate.replace(/\//g, '-')}-${item.id}.jpg`;
    try {
      // Try fetching as a Blob first so the download attribute works even for
      // cross-origin URLs (e.g. Supabase Storage links open in a tab otherwise).
      const res = await fetch(item.imageUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      downloadBlob(blob, filename);
    } catch {
      // Fallback: direct anchor download (works for same-origin / data URLs)
      downloadDataUrl(item.imageUrl, filename);
    }
  };

  const filteredItems = mediaItems.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.projectName.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.reportNo && item.reportNo.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                گالری تصاویر و مستندات تصویری بتن
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مستندسازی مراحل نمونه‌گیری، حوضچه کیورینگ، تست اسلامپ و شکست آزمایشگاهی با محدودیت سقف ۲ مگابایت
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() => {
              resetUploadForm();
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>بارگذاری تصویر جدید (زیر ۲ مگابایت)</span>
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            همه تصاویر ({toPersianDigits(mediaItems.length)})
          </button>
          {(Object.keys(CATEGORY_LABELS) as MediaCategory[]).map(cat => {
            const count = mediaItems.filter(m => m.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {CATEGORY_LABELS[cat]} ({toPersianDigits(count)})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، پروژه، شماره شیت..."
            className="w-full ps-9 pe-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            هیچ تصویری در این دسته‌بندی یافت نشد
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {readOnly 
              ? 'تصاویر آزمایش‌ها پس از بارگذاری توسط اپراتور در این بخش قابل رویت و دانلود خواهند بود.'
              : 'برای افزودن تصاویر و مستندات نمونه‌های بتن، دکمه بارگذاری تصویر جدید را بفشارید.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedImageForView(item)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs hover:shadow-lg transition duration-200 flex flex-col cursor-pointer"
            >
              {/* Image Preview with Hover Zoom */}
              <div className="relative aspect-4/3 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="p-2.5 rounded-full bg-white/90 text-slate-900 shadow-lg font-bold text-xs flex items-center gap-1.5">
                    <ZoomIn className="w-4 h-4" />
                    <span>مشاهده باکیفیت</span>
                  </span>
                </div>

                {/* Badge Category */}
                <div className="absolute top-3 start-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-xs ${CATEGORY_COLORS[item.category]}`}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>

                {/* File Size Badge */}
                <div className="absolute bottom-2 end-2 bg-black/70 text-white font-mono text-[9px] px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {toPersianDigits(Math.round(item.fileSizeBytes / 1024))} KB
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white leading-snug line-clamp-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{item.projectName}</span>
                  </div>
                  {item.reportNo && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      کد شیت: <span className="font-bold text-slate-600 dark:text-slate-300">{toPersianDigits(item.reportNo)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">{toPersianDigits(item.jalaliDate)}</span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadImage(item);
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 transition"
                      title="دانلود تصویر"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {!readOnly && (
                      <button
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition"
                        title="حذف تصویر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {selectedImageForView && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
            {/* Top Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${CATEGORY_COLORS[selectedImageForView.category]}`}>
                  {CATEGORY_LABELS[selectedImageForView.category]}
                </span>
                <h3 className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                  {selectedImageForView.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(selectedImageForView)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل اصلی</span>
                </button>
                <button
                  onClick={() => setSelectedImageForView(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Image */}
            <div className="p-4 bg-black/60 flex items-center justify-center max-h-[70vh]">
              <img
                src={selectedImageForView.imageUrl}
                alt={selectedImageForView.title}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Meta Info */}
            <div className="p-4 bg-slate-900/90 text-slate-300 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800">
              <div>
                <span className="text-slate-500 block">پروژه و کارفرما:</span>
                <span className="font-bold text-white">{selectedImageForView.projectName}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedImageForView.customerName}</p>
              </div>

              <div>
                <span className="text-slate-500 block">ثبت کننده و تاریخ:</span>
                <span className="font-bold text-white">{selectedImageForView.uploaderName}</span>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{toPersianDigits(selectedImageForView.jalaliDate)}</p>
              </div>

              <div>
                <span className="text-slate-500 block">مشخصات فایل:</span>
                <span className="font-mono text-emerald-400 font-bold">{toPersianDigits(Math.round(selectedImageForView.fileSizeBytes / 1024))} KB</span>
                <span className="text-slate-400 text-[10px] block">سقف استاندارد ۲ مگابایت</span>
              </div>

              {selectedImageForView.description && (
                <div className="sm:col-span-3 pt-2 border-t border-slate-800/60 text-slate-300 text-xs">
                  <span className="text-slate-500 block font-bold mb-0.5">توضیحات فنی تکنسین:</span>
                  <p className="leading-relaxed bg-slate-800/50 p-2 rounded-lg">{selectedImageForView.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload New Image Modal */}
      {showUploadModal && !readOnly && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  بارگذاری تصویر آزمایش بتن (حداکثر ۲ مگابایت)
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 min-h-[140px] ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                    : imagePreviewUrl 
                      ? 'border-emerald-500/60 bg-emerald-50/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />

                {imagePreviewUrl ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={imagePreviewUrl}
                      alt="پیش‌نمایش"
                      className="w-20 h-20 object-cover rounded-xl border border-slate-300 shadow-sm"
                    />
                    <div className="text-start space-y-1">
                      <span className="font-bold text-emerald-600 block flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تصویر بارگذاری شد
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        حجم: {toPersianDigits(Math.round(fileSizeBytes / 1024))} کیلوبایت (مجاز)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreviewUrl(null);
                          setFileSizeBytes(0);
                        }}
                        className="text-[11px] text-rose-500 underline block cursor-pointer"
                      >
                        تغییر عکس
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      عکس را اینجا بکشید یا برای انتخاب کلیک کنید
                    </p>
                    <p className="text-[11px] text-slate-400">
                      فرمت‌های مجاز: JPG, PNG, WebP • <strong className="text-blue-600">حداکثر حجم مجاز: ۲ مگابایت</strong>
                    </p>
                  </>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">عنوان تصویر *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: شکست مکعب بتن ۲۸ روزه ستون طبقه ۲"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">دسته‌بندی آزمون</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MediaCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {(Object.keys(CATEGORY_LABELS) as MediaCategory[]).map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">مشتری / شرکت</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => {
                      setSelectedCustomer(e.target.value);
                      const c = customers.find(x => x.id === e.target.value);
                      if (c && c.projectNames && c.projectNames[0]) {
                        setProjectName(c.projectNames[0]);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName} ({c.representativeName})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">نام پروژه</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="مثال: مجتمع مسکونی نگین"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">کد شیت یا شماره گزارش (اختیاری)</label>
                  <input
                    type="text"
                    value={reportNo}
                    onChange={(e) => setReportNo(e.target.value)}
                    placeholder="مثال: CTL-1403-0892"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">توضیحات و گزارش فنی</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="نکات مربوط به نحوه شکست، اسلامپ، مقاومت یا نظارت کارگاهی..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md active:scale-95"
                >
                  ثبت و بارگذاری در گالری
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
