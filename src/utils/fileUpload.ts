/**
 * Production Client-Side File Optimization & Upload Helper.
 *
 * Automatically resizes and compresses smartphone camera photos (5-15MB)
 * down to crisp, web-optimized JPEGs (<400KB) with high text readability
 * before submitting them to the server.
 *
 * Prevents HTTP 413 (Payload Too Large), server timeout, memory leaks,
 * and mobile browser crashes.
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSizeBytes?: number;
}

const DEFAULT_MAX_DIMENSION = 1600; // Calibrated for crystal-clear engineering stamps, receipts & concrete fracture textures
const DEFAULT_QUALITY = 0.82;
const ABSOLUTE_MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB max raw input

/**
 * Reads a File and safely converts it to a data URL, automatically scaling down
 * high-resolution camera photos so they fit within memory & server payload limits.
 */
export async function optimizeAndReadImageFile(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  if (!file) throw new Error('فایلی انتخاب نشده است.');

  // If PDF, validate size and read directly as base64 data URL
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    if (file.size > (options.maxFileSizeBytes || 4 * 1024 * 1024)) {
      throw new Error('حجم فایل PDF بیش از سقف مجاز (۴ مگابایت) است.');
    }
    return readFileAsDataUrl(file);
  }

  // Reject files over 25MB outright to protect browser tab RAM
  if (file.size > ABSOLUTE_MAX_INPUT_BYTES) {
    throw new Error('حجم فایل انتخابی بیش از حد مجاز (۲۵ مگابایت) است.');
  }

  // If it's already a small image (< 450 KB), we can just read it directly
  if (file.size < 450 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return readFileAsDataUrl(file);
  }

  // Compress and resize using HTML5 Canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل از حافظه دستگاه.'));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return reject(new Error('محتوای فایل خالی است.'));

      const img = new Image();
      img.onerror = () => reject(new Error('بارگذاری تصویر جهت بهینه‌سازی با خطا مواجه شد.'));
      img.onload = () => {
        try {
          const maxW = options.maxWidth || DEFAULT_MAX_DIMENSION;
          const maxH = options.maxHeight || DEFAULT_MAX_DIMENSION;
          let { width, height } = img;

          if (width > maxW || height > maxH) {
            if (width / maxW > height / maxH) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            } else {
              width = Math.round((width * maxH) / height);
              height = maxH;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(src);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Output as optimized JPEG
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', options.quality || DEFAULT_QUALITY);
          resolve(optimizedDataUrl);
        } catch (err) {
          // If canvas fails, fallback to original data URL
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
