/**
 * Robust Multi-Page PDF Generator for Contract, Invoice, and Certificate Documents.
 * Uses html2canvas + jsPDF with per-page rendering.
 * Guarantees all authored pages (e.g., both Page 1 and Page 2 of official contracts)
 * are cleanly output without canvas-slicing clipping, DOM pollution, or thread freeze.
 */

export type PdfGenerationResult = 'SUCCESS' | 'ELEMENT_NOT_FOUND' | 'TIMEOUT' | 'ERROR' | 'BUSY';

export interface PdfExportResponse {
  status: PdfGenerationResult;
  pageCount?: number;
  error?: string;
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

  try {
    // 1. Detect authored sub-pages (.contract-page or .certificate-page).
    // If explicit page containers exist, each represents one distinct A4 page.
    // If none exist, the root container itself is rendered as a single page.
    const pageSections = Array.from(
      element.querySelectorAll<HTMLElement>('.contract-page, .certificate-page')
    );
    const targets: HTMLElement[] = pageSections.length > 0 ? pageSections : [element];

    // 2. Load html2canvas and jsPDF dynamically
    const [html2canvasModule, jspdfModule] = await Promise.all([
      import('html2canvas-pro'),
      import('jspdf')
    ]);
    const html2canvas: any = (html2canvasModule as any).default || html2canvasModule;
    const { jsPDF } = jspdfModule;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const rawFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const finalFilename = rawFilename.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'document.pdf';

    // 3. Render each authored page individually onto an A4 PDF sheet
    for (let i = 0; i < targets.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const sec = targets[i];
      const canvas = await html2canvas(sec, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (_document: Document, clonedElement: HTMLElement) => {
          clonedElement.style.width = '210mm';
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.margin = '0';
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      // Keep the page's proportions; shrink an unusually long page rather
      // than stretching or clipping its contents.
      const factor = Math.min(210 / canvas.width, 297 / canvas.height);
      const width = canvas.width * factor;
      const height = canvas.height * factor;
      pdf.addImage(imgData, 'JPEG', (210 - width) / 2, 0, width, height, undefined, 'FAST');
    }

    // 4. Trigger download
    pdf.save(finalFilename);

    return {
      status: 'SUCCESS',
      success: true,
      pageCount: targets.length
    };
  } catch (err: any) {
    console.error('[PDF] Export error:', err);
    return {
      status: 'ERROR',
      success: false,
      error: err?.message || 'خطا در تولید فایل PDF.'
    };
  } finally {
    isRendering = false;
  }
}
