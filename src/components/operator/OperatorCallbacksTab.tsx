import React, { useState } from 'react';
import type { TechnicianDispatch } from '../../types';
import { labDb } from '../../services/supabase';
import { isCallbackRequest } from '../../utils/dispatchKind';

export const OperatorCallbacksTab: React.FC<{ dispatches: TechnicianDispatch[] }> = ({ dispatches }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const requests = dispatches.filter(isCallbackRequest);

  const complete = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      if (!await labDb.completeCallbackRequest(id)) setError('ثبت پیگیری ناموفق بود. لطفاً دوباره تلاش کنید.');
    } finally {
      setBusy(null);
    }
  };

  return <section className="space-y-4" dir="rtl">
    <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">درخواست‌های تماس وب‌سایت</h2>
      <p className="text-xs text-slate-500 mt-1">این درخواست‌ها جدا از اعزام تکنسین ثبت و پیگیری می‌شوند.</p></div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {requests.length === 0 && <p className="text-sm text-slate-500">درخواست تماسی ثبت نشده است.</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {requests.map(request => <article key={request.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-3 text-sm">
        <div className="flex justify-between gap-2"><strong>{request.customerName}</strong><span className="text-xs text-slate-500">{request.status === 'requested' ? 'در انتظار تماس' : 'پیگیری شده'}</span></div>
        <div className="text-xs text-slate-500">{request.scheduledDateJalali} - {request.scheduledTime} | {request.ticketNo}</div>
        <div className="flex items-center gap-2"><a dir="ltr" className="text-blue-600 font-bold" href={`tel:${request.contactPhone}`}>{request.contactPhone}</a></div>
        {request.status === 'requested' && <button disabled={!!busy} onClick={() => complete(request.id)} className="rounded-lg px-3 py-2 bg-emerald-600 text-white text-xs disabled:opacity-50">{busy === request.id ? 'در حال ثبت...' : 'ثبت تماس گرفته شد'}</button>}
      </article>)}
    </div>
  </section>;
};
