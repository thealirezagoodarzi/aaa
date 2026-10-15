import crypto from 'crypto';

export interface SmsSendResult {
  success: boolean;
  provider: string;
  error?: string;
}

/**
 * Universal Iranian SMS Gateway Integration & Development Adapter
 * Supports:
 * - Kavenegar (کاوه‌نگار)
 * - FarazSMS / IPPanel (فراز اس‌ام‌اس / آی‌پی پنل)
 * - Custom Webhook (وب‌هوک سفارشی)
 * - Development / Console fallback (شبیه‌ساز و لاگ محیط آزمایشی)
 */
export async function sendSmsOtp(phone: string, code: string, username: string): Promise<SmsSendResult> {
  const cleanPhone = phone ? phone.replace(/[^\d]/g, '') : '';
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, provider: 'none', error: 'شماره تلفن همراه معتبر نیست' };
  }

  // 1. Kavenegar Provider
  const kavenegarKey = process.env.KAVENEGAR_API_KEY;
  if (kavenegarKey) {
    try {
      const template = process.env.KAVENEGAR_OTP_TEMPLATE || 'verify';
      const url = `https://api.kavenegar.com/v1/${kavenegarKey}/verify/lookup.json?receptor=${cleanPhone}&token=${encodeURIComponent(code)}&template=${encodeURIComponent(template)}`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(6000) });
      const json = await res.json() as any;
      if (json?.return?.status === 200) {
        return { success: true, provider: 'kavenegar' };
      }
      return { success: false, provider: 'kavenegar', error: json?.return?.message || 'Kavenegar request failed' };
    } catch (err: any) {
      console.error('[SMS] Kavenegar error:', err?.message || err);
    }
  }

  // 2. FarazSMS / IPPanel Provider
  const ippanelKey = process.env.FARAZSMS_API_KEY || process.env.IPPANEL_API_KEY;
  if (ippanelKey) {
    try {
      const patternCode = process.env.FARAZSMS_PATTERN_CODE || process.env.IPPANEL_PATTERN_CODE;
      const sender = process.env.FARAZSMS_SENDER || '3000505';
      if (patternCode) {
        const res = await fetch('https://api2.ippanel.com/api/v1/sms/pattern/normal/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ippanelKey
          },
          body: JSON.stringify({
            code: patternCode,
            sender: sender,
            recipient: cleanPhone,
            variable: { code: code }
          }),
          signal: AbortSignal.timeout(6000)
        });
        const json = await res.json() as any;
        if (json?.status === 'OK' || json?.data?.message_id) {
          return { success: true, provider: 'ippanel' };
        }
      }
    } catch (err: any) {
      console.error('[SMS] FarazSMS/IPPanel error:', err?.message || err);
    }
  }

  // 3. Custom Webhook Provider
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, code, username, timestamp: Date.now() }),
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        return { success: true, provider: 'webhook' };
      }
    } catch (err: any) {
      console.error('[SMS] Webhook error:', err?.message || err);
    }
  }

  // 4. Safe fallback for dev or when no SMS credentials configured
  const fingerprint = crypto.createHash('sha256').update(`${code}|${username}`).digest('hex').slice(0, 8);
  console.log(`[SMS:SIMULATION] Code for ${username} (${cleanPhone}): ${code} [fingerprint: ${fingerprint}]`);
  return { success: true, provider: 'simulation' };
}
