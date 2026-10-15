/**
 * Real PDF Generator for Contract, Invoice, and Certificate Documents
 * Uses html2pdf.js with bulletproof timeout, off-screen isolation, and double-render lock.
 */

export type PdfGenerationResult = 'SUCCESS' | 'ELEMENT_NOT_FOUND' | 'TIMEOUT' | 'ERROR' | 'BUSY';

export interface PdfExportResponse {
  status: PdfGenerationResult;
  pageCount?: number;
  error?: string;
  // Backward compatibility helper
  success?: boolean;
}

let isRendering = false;

export function forceResetRenderLock(): void {
  isRendering = false;
}

export function isPdfRendering(): boolean {
  return isRendering;
}

export async function downloadContractPdf(
  elementId: string,
  filename: string = 'document.pdf'
): Promise<PdfExportResponse> {
  if (isRendering) {
    console.warn('[PDF] Render already in progress. Ignoring concurrent request.');
    return { status: 'BUSY', success: false, error: 'عملیات ساخت PDF در حال انجام است. لطفاً چند لحظه صبر نمایید.' };
  }

  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`[PDF] Element with id "${elementId}" not found for PDF export.`);
    return { status: 'ELEMENT_NOT_FOUND', success: false, error: 'سند قابل چاپ یافت نشد.' };
  }

  isRendering = true;

  // (i) Clone target node into an off-screen container so unmounts cannot detach it
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = `${elementId}-offscreen-pdf-clone`;
  clone.style.position = 'fixed';
  clone.style.left = '-10000px';
  clone.style.top = '0px';
  clone.style.width = '210mm';
  clone.style.minWidth = '210mm';
  clone.style.maxWidth = '210mm';
  clone.style.zIndex = '-999999';
  clone.style.backgroundColor = '#ffffff';
  clone.style.margin = '0';

  // BUG FIX (problem #3 — "the contract PDF comes out as ONE page"): the
  // printable contract is built from explicit A4 sections (.contract-page /
  // .certificate-page, each min-height 297mm). html2canvas flattens the whole
  // clone into a single tall bitmap and html2pdf then slices that bitmap at
  // arbitrary pixel heights — which both merges the two authored pages into one
  // cramped sheet and can produce ragged mid-content breaks. Normalize the
  // clone BEFORE rendering: every authored section gets an exact A4 height and
  // `break-after: page`, so html2pdf's css-page-break mode starts a fresh PDF
  // page for each section. The final wrapper child additionally gets
  // `break-after: auto` so no trailing blank page is emitted.
  const MM_TO_PX = 96 / 25.4; // CSS px per millimetre @96dpi
  const A4_HEIGHT_PX = Math.round(297 * MM_TO_PX); // ≈1123px
  const pageSections = Array.from(
    clone.querySelectorAll<HTMLElement>('.contract-page, .certificate-page')
  );
  if (pageSections.length > 1) {
    pageSections.forEach((sec, i) => {
      sec.style.boxSizing = 'border-box';
      sec.style.height = `${A4_HEIGHT_PX}px`;
      sec.style.minHeight = `${A4_HEIGHT_PX}px`;
      sec.style.maxHeight = `${A4_HEIGHT_PX}px`;
      sec.style.overflow = 'hidden';
      sec.style.breakAfter = i === pageSections.length - 1 ? 'auto' : 'page';
      sec.style.pageBreakAfter = i === pageSections.length - 1 ? 'auto' : 'always';
    });
    // Drop inter-page gaps that would otherwise shrink the rendered area.
    clone.style.gap = '0';
    clone.style.rowGap = '0';
    clone.classList.remove('space-y-8');
  }

  document.body.appendChild(clone);

  let timer: any = null;
  let hasTimedOut = false;

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;

    const opt = {
      margin: [0, 0, 0, 0],
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.9 },
      html2canvas: {
        scale: 1.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794 // 210mm at standard 96 DPI
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: {
        // BUG FIX (problem #3 — single-page PDF): 'avoid-all' forbids ALL page
        // breaks, so a genuinely multi-page document was squeezed into one
        // sheet. Use css/legacy break detection instead and explicitly honour
        // the authored A4 sections via `before`, while still protecting table
        // rows / signature blocks marked `.no-split` through `avoid`.
        mode: ['css', 'legacy'],
        before: '.contract-page, .certificate-page',
        after: '.pdf-page-break-after',
        avoid: ['.no-split', 'tr', 'table']
      }
    };

    // (ii) Render with html2pdf().set(opt).from(clone).toPdf() and save only after resolution
    const renderPromise = (async () => {
      const worker = html2pdf().set(opt).from(clone).toPdf();
      const pdf = await worker.get('pdf');
      if (hasTimedOut) throw new Error('PDF_TIMEOUT');
      
      const pageCount: number = typeof pdf.getNumberOfPages === 'function'
        ? pdf.getNumberOfPages()
        : (Array.isArray(pdf.internal?.pages) ? Math.max(1, pdf.internal.pages.length - 1) : 1);

      await pdf.save(opt.filename);
      return pageCount;
    })();

    // (iii) Strict timeout race. BUG FIX (problem #3 — "the site freezes after
    // the PDF download"): a hard 6s budget was far too small for a real
    // two-page A4 render at scale 1.2; every legitimate export tripped the
    // timeout, and the abandoned html2canvas/jsPDF pipeline kept hammering the
    // main thread while the UI retried — which felt like a full browser hang.
    // The budget is now adaptive to the number of authored pages and the lock
    // in `finally` guarantees a second click can never queue a parallel render.
    const pageBudget = Math.max(pageSections.length || 1, 1);
    const renderBudgetMs = Math.min(90_000, 25_000 + pageBudget * 20_000);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        hasTimedOut = true;
        reject(new Error('PDF_TIMEOUT'));
      }, renderBudgetMs);
    });

    const pageCount = await Promise.race([renderPromise, timeoutPromise]);
    clearTimeout(timer);

    return {
      status: 'SUCCESS',
      success: true,
      pageCount
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.message === 'PDF_TIMEOUT' || hasTimedOut) {
      console.warn('[PDF] Generation timed out after 6000ms');
      return {
        status: 'TIMEOUT',
        success: false,
        error: 'مدت زمان تولید فایل PDF بیش از حد طول کشید. لطفاً مجدداً تلاش نمایید یا از خروجی Word استفاده فرمایید.'
      };
    }
    console.error('[PDF] Export error:', err);
    return {
      status: 'ERROR',
      success: false,
      error: err?.message || 'خطا در تولید فایل PDF.'
    };
  } finally {
    // (iv) ALWAYS remove clone and clear isRendering lock
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
    isRendering = false;
  }
}
