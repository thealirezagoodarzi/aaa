const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-lab-data-'));
const adminPw = process.env.ADMIN_INITIAL_PASSWORD || 'EnvBoot123456!';
const p = spawn('node', ['dist/server.cjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    SESSION_SECRET: 'a'.repeat(48),
    PORT: '5099',
    LAB_DATA_DIR: tmpDir,
    ADMIN_INITIAL_PASSWORD: adminPw,
  },
  cwd: __dirname,
});
let srvlog = '';
p.stdout.on('data', d => srvlog += d);
p.stderr.on('data', d => srvlog += d);

(async () => {
  const base = 'http://127.0.0.1:5099';
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  const results = [];
  async function t(name, fn) { try { results.push(name + ': ' + await fn()); } catch (e) { results.push(name + ': ERR ' + e.message); } }

  await t('health', async () => { const r = await fetch(base + '/api/health'); return r.status + ' ' + (await r.text()).slice(0, 60); });
  await t('lab-data-guest', async () => { const r = await fetch(base + '/api/lab-data'); const j = await r.json(); return r.status + ' profiles=' + JSON.stringify(j.data.profiles) + ' calib=' + j.data.calibrations.length; });
  await t('login-bad', async () => { const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'wrong' }) }); return r.status + ' ' + (await r.text()).slice(0, 60); });
  await t('sync-noauth', async () => { const r = await fetch(base + '/api/lab-data/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reports: [] }) }); return r.status + ' ' + (await r.text()).slice(0, 60); });
  await t('reset-noauth', async () => { const r = await fetch(base + '/api/lab-data/reset', { method: 'POST' }); return r.status; });
  await t('export-noauth', async () => { const r = await fetch(base + '/api/lab-data/export'); return r.status; });
  await t('sync-collection-noauth', async () => { const r = await fetch(base + '/api/lab-data/sync-collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: 'reports', data: [{ id: 'x' }] }) }); return r.status + ' ' + (await r.text()).slice(0, 60); });
  await t('gemini-nokey', async () => { const r = await fetch(base + '/api/gemini/predict-strength', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slump: 10, strength7d: 20 }) }); return r.status + ' ' + (await r.text()).slice(0, 90); });
  await t('spa-fallback', async () => { const r = await fetch(base + '/some/route'); return r.status + ' ct=' + r.headers.get('content-type'); });
  await t('servercjs-blocked', async () => { const r = await fetch(base + '/server.cjs'); return r.status; });
  await t('sourcemap-exposed', async () => { const r = await fetch(base + '/server.cjs.map'); return r.status + ' len=' + (await r.text()).length; });
  await t('logo-jpg', async () => { const r = await fetch(base + '/logo.jpg'); return r.status + ' len=' + (await r.arrayBuffer()).byteLength; });

  let token = null;
  await t('login-admin-otp', async () => {
    const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: adminPw }) });
    const j = await r.json();
    if (j.requiresOtp) { global.__tempToken = j.tempToken; return r.status + ' requiresOtp=true simulatedOtp=' + ('simulatedOtp' in j); }
    if (j.token) { token = j.token; return r.status + ' token issued'; }
    return r.status + ' ' + JSON.stringify(j).slice(0, 120);
  });
  await t('otp-code-in-log', async () => 'OTP logged: ' + /code=(\d{5})/.test(srvlog));
  const m = srvlog.match(/code=(\d{5})/);
  if (m && global.__tempToken) {
    await t('verify-otp', async () => {
      const r = await fetch(base + '/api/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tempToken: global.__tempToken, otp: m[1] }) });
      const j = await r.json();
      if (j.token) token = j.token;
      return r.status + ' mustChangePassword=' + j.mustChangePassword + ' hasToken=' + !!j.token;
    });
  }
  if (token) {
    // Server-side forced-password-change gate: non-allowlisted endpoints must be blocked while flag set
    await t('gate-blocks-lab-data', async () => { const r = await fetch(base + '/api/lab-data', { headers: { Authorization: 'Bearer ' + token } }); return r.status + ' (expect 428 or 403 gate) ' + (await r.text()).slice(0, 80); });
    await t('gate-allows-me', async () => { const r = await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } }); return r.status; });
    await t('update-password-short', async () => { const r = await fetch(base + '/api/lab-data/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: 'usr-admin-01', newPassword: 'short' }) }); return r.status + ' ' + (await r.text()).slice(0, 60); });
    await t('update-password-legacy', async () => { const r = await fetch(base + '/api/lab-data/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: 'usr-admin-01', newPassword: 'Ag12258' }) }); return r.status + ' ' + (await r.text()).slice(0, 80); });
    await t('update-password-good', async () => { const r = await fetch(base + '/api/lab-data/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: 'usr-admin-01', newPassword: 'FreshPass#2026' }) }); return r.status + ' ' + (await r.text()).slice(0, 60); });
    await t('admin-lab-data-after-fix', async () => { const r = await fetch(base + '/api/lab-data', { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); return r.status + ' customers=' + (j.data ? j.data.customers.length : '?') + ' invoices=' + (j.data ? j.data.invoices.length : '?'); });
    await t('admin-export', async () => { const r = await fetch(base + '/api/lab-data/export', { headers: { Authorization: 'Bearer ' + token } }); return r.status + ' hasPassword=' + ((await r.text()).includes('scrypt:')); });
    await t('update-password-fake-scrypt', async () => { const r = await fetch(base + '/api/lab-data/update-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: 'usr-nonexistent', newPassword: 'scrypt:' + 'a'.repeat(64) + ':' + 'b'.repeat(128) }) }); return r.status + ' ' + (await r.text()).slice(0, 80); });
    await t('add-second-admin', async () => { const r = await fetch(base + '/api/lab-data/add-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ profile: { id: 'usr-x', username: 'x', role: 'admin', fullName: 'X', password: 'SomePass123' } }) }); const j = await r.json(); return r.status + ' savedRole=' + (j.data ? j.data.role : '?'); });
    await t('relogin-new-pw', async () => {
      const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'FreshPass#2026' }) });
      const j = await r.json();
      if (j.requiresOtp) {
        const mm = srvlog.matchAll(/code=(\d{5})/g); const last = [...mm].pop();
        const v = await fetch(base + '/api/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tempToken: j.tempToken, otp: last[1] }) });
        const vj = await v.json();
        if (vj.token) token = vj.token;
        return r.status + ' relogin ok mustChange=' + vj.mustChangePassword;
      }
      return r.status + ' ' + JSON.stringify(j).slice(0, 100);
    });
    await t('logout', async () => { const r = await fetch(base + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); return r.status + ' ' + (await r.text()).slice(0, 40); });
    await t('token-after-logout', async () => { const r = await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } }); return r.status + ' (expect 401)'; });
  }
  console.log(results.join('\n'));
  console.log('--- server log tail ---\n' + srvlog.slice(-400));
  p.kill();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
})();
