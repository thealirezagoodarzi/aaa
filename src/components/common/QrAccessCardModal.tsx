import React, { useRef, useState } from 'react';
import { Customer, UserProfile } from '../../types';
import { LAB_INFO } from '../../services/supabase';
import { CompanyLogo } from './CompanyLogo';
import { toPersianDigits, getTodayJalali, formatJalali } from '../../utils/jalali';
import { useModalBack } from '../../hooks/useModalBack';
import { printOnlyNode, downloadDataUrl } from '../../utils/printDom';
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  X, 
  Building2, 
  User, 
  Key, 
  ShieldCheck, 
  Phone, 
  ExternalLink,
  Globe,
  Sparkles
} from 'lucide-react';

interface QrAccessCardModalProps {
  customer?: Customer | null;
  user?: UserProfile | null;
  password?: string;
  onClose: () => void;
}

export const QrAccessCardModal: React.FC<QrAccessCardModalProps> = ({
  customer,
  user,
  password,
  onClose
}) => {
  useModalBack(true, onClose, 'qr-access-card-modal');

  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const today = formatJalali(getTodayJalali());
  // No fabricated fallback credentials: if a real password is unavailable, the card
  // shows an explicit placeholder instead of a fake working-looking one.
  const username = user?.username || (customer?.phone ? customer.phone.slice(-6) : '');
  const pass = password || user?.password || '— (رمز عبور ثبت‌نشده — جهت دریافت با پشتیبانی تماس بگیرید)';
  const hasRealCredentials = Boolean(username && pass);
  const companyName = customer?.companyName || user?.fullName || 'شرکت طرف قرارداد';
  const representativeName = customer?.representativeName || user?.fullName || 'نماینده رسمی';
  const customerId = customer?.id || user?.customerId || '';
  const primaryProject = customer?.projectNamePrimary || customer?.projectNames?.[0] || 'کلیه پروژه‌های تحت نظارت';
  const contractNo = customer?.contractNo || 'CTL-CN-1403';

  // Construct QR Payload URL
  const basePortalUrl = window.location.origin.includes('azmajahanbin.ir')
    ? 'https://www.azmajahanbin.ir'
    : window.location.origin;
  const portalAccessUrl = `${basePortalUrl}/?login=${encodeURIComponent(username)}&cust=${encodeURIComponent(customerId)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(portalAccessUrl)}`;

  const handleCopyCredentials = () => {
    const text = `سامانه جامع آزمایشگاه بتن آزما بتن پایش خاک و پی جهان بین\nپرتال مشتریان و استعلام اصالت شیت‌های بتن\n\nوب‌سایت رسمی: https://www.azmajahanbin.ir\nورود مستقیم: ${portalAccessUrl}\nنام کاربری: ${username}\nکلمه عبور: ${pass}\nکد مشتری: ${customerId}\nشرکت: ${companyName}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrintCard = () => {
    // Print only the card itself (hide toolbar/backdrop and the rest of the page)
    if (cardRef.current) {
      printOnlyNode(cardRef.current);
    } else {
      window.print();
    }
  };

  const handleDownloadPng = async () => {
    setIsDownloading(true);
    try {
      // Create a clean HTML5 canvas to draw high-res 1200x750 card
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 760;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas not supported');
      }

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 760);
      bgGrad.addColorStop(0, '#0a1128');
      bgGrad.addColorStop(0.6, '#101f42');
      bgGrad.addColorStop(1, '#080d1e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 760);

      // Gold Accent Header Banner
      const bannerGrad = ctx.createLinearGradient(0, 0, 1200, 0);
      bannerGrad.addColorStop(0, '#2563eb');
      bannerGrad.addColorStop(0.5, '#3b82f6');
      bannerGrad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = bannerGrad;
      ctx.fillRect(0, 0, 1200, 140);

      // Card Borders
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 1160, 720);

      // Header Texts
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(LAB_INFO.name, 1120, 65);

      ctx.fillStyle = '#bfdbfe';
      ctx.font = '20px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('کارت هوشمند هویت کارفرما و دسترسی اختصاصی پرتال نتایج آزمایشگاه', 1120, 105);

      // Status Pill on top left
      ctx.textAlign = 'left';
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 22px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('● کارت فعال و معتبر', 60, 80);

      // Info Labels and Values
      ctx.textAlign = 'right';

      const drawField = (label: string, value: string, x: number, y: number, isValueBold = true) => {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText(label, x, y);

        ctx.fillStyle = '#ffffff';
        ctx.font = isValueBold ? 'bold 24px Vazirmatn, Tahoma, sans-serif' : '22px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText(value, x, y + 36);
      };

      drawField('نام شرکت / کارفرما:', companyName, 1120, 200);
      drawField('نماینده رسمی و مجری:', representativeName, 700, 200);
      
      drawField('نام پروژه اصلی:', primaryProject, 1120, 310);
      drawField('شماره قرارداد رسمی:', contractNo, 700, 310);

      drawField('نام کاربری پرتال (Username):', username, 1120, 420);
      drawField('کلمه عبور امنیتی (Password):', pass, 700, 420);

      drawField('کد شناسایی کارفرما:', customerId, 1120, 530);
      drawField('تاریخ صدور کارت:', today, 700, 530);

      // Bottom Contact bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(40, 630, 1120, 80);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(`وب‌سایت: www.azmajahanbin.ir | پشتیبانی: ${LAB_INFO.phone} | دفتر مرکزی: ${LAB_INFO.address}`, 1120, 680);

      // Draw QR Code onto Canvas
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        // Draw white frame for QR
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(60, 190, 240, 240, 16);
        ctx.fill();

        ctx.drawImage(qrImg, 70, 200, 220, 220);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText('اسکن هوشمند با دوربین', 180, 465);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText('ورود مستقیم به پرونده آزمایشگاهی', 180, 495);

        // Convert to Download
        const dataUrl = canvas.toDataURL('image/png');
        downloadDataUrl(dataUrl, `smart-id-card-${username}-${Date.now().toString().slice(-4)}.png`);
        setIsDownloading(false);
      };

      qrImg.onerror = () => {
        // Fallback without dynamic QR image
        const dataUrl = canvas.toDataURL('image/png');
        downloadDataUrl(dataUrl, `smart-id-card-${username}.png`);
        setIsDownloading(false);
      };

      qrImg.src = qrApiUrl;

    } catch (err) {
      console.error('Error generating card image:', err);
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn print:p-0 print:bg-white print:block">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-700 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:p-0">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>کارت هوشمند احراز هویت و ورود QR</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  فعال
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                قابلیت دانلود تصویر باکیفیت و اسکن بارکد برای استعلام آنلاین شیت‌ها
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable & Downloadable Visual Card Preview */}
        <div 
          ref={cardRef}
          className="relative rounded-3xl overflow-hidden border border-slate-700 shadow-2xl bg-gradient-to-br from-[#0c1427] via-[#111c3a] to-[#0a0f1d] p-6 sm:p-7 text-white"
        >
          {/* Decorative Corner Glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar of Card */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <CompanyLogo className="w-12 h-12 rounded-2xl shadow-md border border-white/10" />
              <div>
                <h4 className="text-sm font-black text-white leading-tight">
                  {LAB_INFO.name}
                </h4>
                <span className="text-[10px] text-blue-300 font-medium block mt-0.5">
                  کارت شناسایی کارفرما و دسترسی سریع به پرتال نتایج بتن
                </span>
              </div>
            </div>

            <div className="text-start sm:text-end hidden sm:block">
              <div className="text-[10px] text-slate-400">تاریخ صدور کارت:</div>
              <div className="text-xs font-mono font-bold text-slate-200">{toPersianDigits(today)}</div>
            </div>
          </div>

          {/* Card Body: Info Grid & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            
            {/* Info Columns (2 cols) */}
            <div className="sm:col-span-2 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-2">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] text-slate-400 block">نام شرکت / کارفرما:</span>
                    <strong className="text-sm font-bold text-white block mt-0.5">{companyName}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px]">
                  <span className="text-slate-400">نماینده پروژه:</span>
                  <span className="font-bold text-slate-200">{representativeName}</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">پروژه تحت پوشش:</span>
                  <span className="font-bold text-blue-300 truncate max-w-[200px]" title={primaryProject}>{primaryProject}</span>
                </div>
              </div>

              {/* Login Credentials Box */}
              <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-blue-300 flex items-center gap-1.5 font-bold">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    نام کاربری پرتال:
                  </span>
                  <span className="font-mono font-bold text-sm text-white px-2 py-0.5 rounded bg-blue-900/60">
                    {username}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-blue-900/40">
                  <span className="text-blue-300 flex items-center gap-1.5 font-bold">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    کلمه عبور اختصاصی:
                  </span>
                  <span className="font-mono font-bold text-sm text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30">
                    {pass}
                  </span>
                </div>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white text-slate-900 shadow-xl border-2 border-slate-200 text-center">
              <div className="w-36 h-36 flex items-center justify-center overflow-hidden">
                <img 
                  src={qrApiUrl} 
                  alt="QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-2 text-[10px] font-bold text-blue-700 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>اسکن ورود مستقیم</span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                ID: {customerId}
              </span>
            </div>

          </div>

          {/* Bottom Card Footer */}
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-blue-400" />
              <span>پشتیبانی: {LAB_INFO.phone}</span>
            </div>
            <a 
              href="https://www.azmajahanbin.ir" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-1.5 font-mono text-[10px] text-sky-400 hover:text-sky-300 transition"
              dir="ltr"
            >
              <Globe className="w-3 h-3" />
              <span>www.azmajahanbin.ir</span>
            </a>
            <div className="font-mono text-[9px] text-slate-500">
              SECURE QR AUTHENTICATION • BETONLAB
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden pt-2">
          <button
            onClick={handleDownloadPng}
            disabled={isDownloading}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-98 disabled:opacity-70"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'در حال ایجاد فایل...' : 'دانلود تصویر کارت (PNG باکیفیت)'}</span>
          </button>

          <button
            onClick={handleCopyCredentials}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition active:scale-98"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'مشخصات کپی شد' : 'کپی مشخصات ورود'}</span>
          </button>

          <button
            onClick={handlePrintCard}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ کارت پرسنلی</span>
          </button>
        </div>

      </div>
    </div>
  );
};
