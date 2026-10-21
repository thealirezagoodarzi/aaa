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

export function printOnlyElement(elementId: string): boolean {
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
