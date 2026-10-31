import type { TechnicianDispatch } from '../types';

// Older website forms did not persist a source, so recognise their exact
// project labels as well. Do not infer this from status: dispatches can also
// legitimately be in the requested state.
export function isCallbackRequest(record: TechnicianDispatch): boolean {
  return record.source === 'website_callback' ||
    (!record.source && (record.projectName === 'درخواست آنلاین آزمایشگاه' || record.projectName === 'درخواست آزمایش وب‌سایت'));
}
