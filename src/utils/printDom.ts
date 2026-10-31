/**
 * Shared DOM helpers for reliable Print / Save-as-PDF flows.
 *
 * Why this exists:
 *  - Several modals (contract, invoice, certificate, standard sheet) render
 *    their toolbars OUTSIDE the printable document element and relied only on
 *    `no-print` / `print:hidden` CSS classes. If any ancestor had a stacking
 *    or overflow issue, fixed toolbars could bleed into printed pages.
 *  - These helpers make printing deterministic by temporarily hiding every
 *    direct child of <body> except the one that contains the target element,
 *    then restoring the DOM exactly as it was afterwards.
 */

let isPrinting = false;

export function isCurrentlyPrinting(): boolean {
  return isPrinting;
}

/**
 * Prints an isolated element using a dedicated hidden iframe.
 * Prevents background app DOM (e.g. navbar, sidebar, admin dashboard tabs)
 * from bleeding into printed pages or distorting page breaks.
 */
export function printIsolatedElement(elementId: string, documentTitle: string = 'قرارداد رسمی آزمایشگاه'): boolean {
  if (typeof document === 'undefined') return false;
  const target = document.getElementById(elementId);
  if (!target) return false;

  try {
    const existingIframe = document.getElementById('print-isolated-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-isolated-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return printOnlyNode(target);
    }

    // Collect all stylesheets and style blocks from the host document
    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
      stylesHtml += el.outerHTML;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>${documentTitle}</title>
        ${stylesHtml}
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'B Nazanin', 'Vazirmatn', 'Tahoma', system-ui, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .contract-page-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }
          .contract-page {
            width: 100% !important;
            max-width: 198mm !important;
            min-height: 278mm !important;
            max-height: 284mm !important;
            margin: 0 auto !important;
            padding: 8mm 10mm !important;
            box-sizing: border-box !important;
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .contract-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          * {
            color: #000000 !important;
            text-shadow: none !important;
          }
        </style>
      </head>
      <body>
        ${target.outerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('iframe print failed, falling back to printOnlyNode:', err);
        printOnlyNode(target);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            iframe.remove();
          }
        }, 5000);
      }
    }, 450);

    return true;
  } catch (err) {
    console.error('printIsolatedElement error, falling back to printOnlyNode:', err);
    return printOnlyNode(target);
  }
}

export function printOnlyElement(elementId: string): boolean {
  // Use isolated iframe printing to prevent React SPA dashboard bleeding
  if (printIsolatedElement(elementId)) {
    return true;
  }
  const target = document.getElementById(elementId);
  if (!target) return false;
  return printOnlyNode(target);
}

/**
 * Same as printOnlyElement but accepts a live element reference (e.g. from a
 * React ref), so callers don't need to assign DOM ids to printable regions.
 */
export function printOnlyNode(target: HTMLElement): boolean {
  if (isPrinting) {
    console.warn('[Print] Print dialog already active, ignoring invocation.');
    return false;
  }
  if (!target || !document.body.contains(target)) return false;

  isPrinting = true;

  // Find the top-level ancestor of the target that is a direct child of body.
  let root: HTMLElement = target;
  while (root.parentElement && root.parentElement !== document.body) {
    root = root.parentElement as HTMLElement;
  }

  const restored: Array<{ el: HTMLElement; prevDisplay: string }> = [];
  Array.from(document.body.children).forEach(node => {
    const el = node as HTMLElement;
    if (el === root || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    restored.push({ el, prevDisplay: el.style.display });
    el.setAttribute('data-print-hidden', '1');
    el.style.display = 'none';
  });

  let cleanedUp = false;
  let intervalTimer: any = null;
  let safetyTimer: any = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (intervalTimer) clearInterval(intervalTimer);
    if (safetyTimer) clearTimeout(safetyTimer);
    window.removeEventListener('afterprint', cleanup);

    // Restore tracked elements
    restored.forEach(({ el, prevDisplay }) => {
      if (el && el.getAttribute('data-print-hidden') === '1') {
        el.removeAttribute('data-print-hidden');
        el.style.display = prevDisplay;
      }
    });

    // Clean any stray elements that have data-print-hidden="1"
    try {
      const strays = document.querySelectorAll('[data-print-hidden="1"]');
      strays.forEach(s => {
        (s as HTMLElement).removeAttribute('data-print-hidden');
        (s as HTMLElement).style.display = '';
      });
    } catch { /* ignore */ }

    isPrinting = false;
  };

  // Restored by BOTH afterprint and a MutationObserver-free interval check
  window.addEventListener('afterprint', cleanup);

  intervalTimer = setInterval(() => {
    if (document.hasFocus && document.hasFocus() && !cleanedUp) {
      setTimeout(cleanup, 500);
    }
  }, 600);

  // Safety net at 8000ms
  safetyTimer = setTimeout(cleanup, 8000);

  try {
    window.print();
  } catch (err) {
    console.error('window.print() failed:', err);
    cleanup();
  }
  return true;
}

/**
 * Sanitizes a filename across all operating systems (Windows, macOS, Linux, Android, iOS),
 * stripping reserved characters (/ \ ? % * : | " < >) and control characters.
 */
export function sanitizeFilename(filename: string, fallback = 'download'): string {
  if (!filename || typeof filename !== 'string') return fallback;
  let clean = filename.replace(/[/\\?%*:|"<>]/g, '-').trim();
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  clean = clean.replace(/-+/g, '-');
  return clean || fallback;
}

/**
 * Triggers a real browser download for a Blob and revokes the object URL.
 * Works across desktop and mobile browsers (Chrome, Safari, Firefox, Edge).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const safeFilename = sanitizeFilename(filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke asynchronously so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Downloads a data-URL (e.g. canvas.toDataURL) without leaking anchors.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const safeFilename = sanitizeFilename(filename);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = safeFilename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
