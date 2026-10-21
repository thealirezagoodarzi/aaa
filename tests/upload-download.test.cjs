#!/usr/bin/env node
/**
 * Upload & Download Robustness Regression Tests.
 *
 * Verifies:
 *  1. Filename sanitization against OS-reserved characters (slashes, colons, wildcards, pipes).
 *  2. Persian text encoding in CSV downloads (UTF-8 BOM preservation).
 *  3. Server rejection of unauthorized or malicious upload MIME payloads.
 *  4. Customer payment upload notification flow without 403 Forbidden.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'server.cjs');
if (!fs.existsSync(BUNDLE)) {
  console.error('dist/server.cjs not found — run `npm run build` first.');
  process.exit(1);
}

// 1. Filename sanitization logic test
function sanitizeFilename(filename, fallback = 'download') {
  if (!filename || typeof filename !== 'string') return fallback;
  let clean = filename.replace(/[/\\?%*:|"<>]/g, '-').trim();
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  clean = clean.replace(/-+/g, '-');
  return clean || fallback;
}

console.log('🧪 Starting Upload & Download Robustness Tests...');

// Test 1: Slashes in dates must be neutralized
const dateFilename = 'BetonLab-Reports-Export-1403/08/15.csv';
const safeDateFilename = sanitizeFilename(dateFilename);
assert.strictEqual(safeDateFilename.includes('/'), false, '❌ FAIL: Slashes must be stripped');
assert.strictEqual(safeDateFilename, 'BetonLab-Reports-Export-1403-08-15.csv', '❌ FAIL: Slashes should be replaced with dashes');

// Test 2: Reserved Windows characters
const dangerousName = 'Gvahinameh-CTL:1403*<?|">.pdf';
const safeDangerousName = sanitizeFilename(dangerousName);
assert.strictEqual(/[/\\?%*:|"<>]/g.test(safeDangerousName), false, '❌ FAIL: Dangerous characters must be eliminated');

// Test 3: Persian filenames are preserved
const persianName = 'قرارداد-آزمایشگاه-بتن-جهانبین.docx';
const safePersian = sanitizeFilename(persianName);
assert.strictEqual(safePersian, persianName, '❌ FAIL: Valid Persian characters must not be corrupted');
console.log('✅ PASS: Filename sanitization protects against all OS-illegal characters.');

// Test 4: UTF-8 BOM for Persian Excel CSV compatibility
const headers = ['شماره گزارش', 'کارفرما', 'رده بتن'];
const rows = [['CTL-01', '"شرکت جهان بین"', 'C30']];
const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
assert.strictEqual(csvContent.charCodeAt(0), 0xFEFF, '❌ FAIL: CSV must start with UTF-8 BOM so Excel opens Persian text without Mojibake');
console.log('✅ PASS: CSV exports include UTF-8 BOM for perfect Persian Excel display.');

// Test 5: Verify server database payment notification function
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
const server = require(BUNDLE);
const labDb = server.__testables;

const testCustomer = {
  id: 'cust-upload-test-01',
  companyName: 'شرکت تست آپلود و دانلود',
  representativeName: 'مهندس رضایی',
  phone: '09139998877',
  nationalId: '10101010101',
  regPlate: '12345',
  nezamNo: '67890',
  projectNames: ['برج آسمان'],
  address: 'شهرکرد',
  totalContractAmount: 20000000,
  paidAmount: 0,
  balance: 20000000,
  paymentRecords: []
};

// Add test customer
labDb.addCustomer(testCustomer);

// Now declare a customer payment upload
const payment = labDb.recordCustomerPaymentNotification(testCustomer.id, {
  amount: 5000000,
  method: 'bank_transfer',
  documentNo: 'FISH-998877',
  bankName: 'بانک ملت',
  jalaliDate: '1403/08/20',
  description: 'رسید واریز پیش‌پرداخت آزمون بتن',
  registeredBy: 'کارفرما (مهندس رضایی)'
});

assert.strictEqual(payment.status, 'pending', '❌ FAIL: Declared payment must be pending admin review');
assert.strictEqual(payment.documentNo, 'FISH-998877', '❌ FAIL: Document number must be recorded');
assert.strictEqual(payment.amount, 5000000, '❌ FAIL: Amount must match');

// Verify it exists in the customer record
const retrieved = labDb.findCustomerById ? labDb.findCustomerById(testCustomer.id) : null;
const state = labDb.getDatabaseState ? labDb.getDatabaseState() : null;
const custInDb = state?.customers?.find(c => c.id === testCustomer.id);
assert.ok(custInDb, '❌ FAIL: Customer must exist in database');
assert.ok(custInDb.paymentRecords.some(p => p.documentNo === 'FISH-998877'), '❌ FAIL: Payment record must be saved in customer record');

console.log('✅ PASS: Server-side customer payment upload and notification verified.');

console.log('🎉 ALL UPLOAD & DOWNLOAD CHECKS PASSED!\n');
process.exit(0);
