#!/usr/bin/env node
/**
 * Security & Input Validation Regression Tests.
 *
 * Exercises the production bundle (dist/server.cjs) to verify:
 *  1. Malicious / invalid MIME file upload rejection in customer registration/update.
 *  2. Oversized file payload rejection (> 3MB).
 *  3. Preservation of authorized dispatch scheduling fields and customerId binding.
 *  4. Strong password policy rejecting common and default credentials.
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

// Load testables from bundle
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long';
const server = require(BUNDLE);
const labDb = server.__testables;

console.log('🧪 Starting Security & Input Validation Tests...');

// 1. Password Policy: isLegacyDefaultChoice
assert.strictEqual(labDb.isLegacyDefaultChoice('Ag12258'), true, '❌ FAIL: Ag12258 should be recognized as legacy default');
assert.strictEqual(labDb.isLegacyDefaultChoice('ag12258'), true, '❌ FAIL: ag12258 should be recognized as legacy default');
assert.strictEqual(labDb.isLegacyDefaultChoice('admin@123'), true, '❌ FAIL: admin@123 should be rejected as default');
assert.strictEqual(labDb.isLegacyDefaultChoice('admin123'), true, '❌ FAIL: admin123 should be rejected as default');
assert.strictEqual(labDb.isLegacyDefaultChoice('12345678'), true, '❌ FAIL: 12345678 should be rejected as weak default');
assert.strictEqual(labDb.isLegacyDefaultChoice('SecureP@ssw0rd2026!'), false, '❌ FAIL: Strong password should not be flagged');
console.log('✅ PASS: Password policy correctly rejects legacy and default credentials.');

// 2. Customer Payload Validation: Safe Uploads
const validCustomer = {
  name: 'شرکت مهندسی تست سازه',
  phone: '09121234567',
  totalContractAmount: 50000000,
  receiptImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
};

assert.doesNotThrow(() => {
  labDb.validateCustomerPayload(validCustomer);
}, '❌ FAIL: Valid customer with JPEG receipt should pass validation');

const invalidMimeCustomer = {
  name: 'شرکت مهندسی تست سازه',
  phone: '09121234567',
  receiptImage: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
};

assert.throws(() => {
  labDb.validateCustomerPayload(invalidMimeCustomer);
}, /فرمت تصویر فیش یا سند معتبر نیست/, '❌ FAIL: Malicious MIME data URL must be rejected');

const oversizedCustomer = {
  name: 'شرکت مهندسی تست سازه',
  phone: '09121234567',
  receiptImage: 'data:image/jpeg;base64,' + 'A'.repeat(3.5 * 1024 * 1024)
};

assert.throws(() => {
  labDb.validateCustomerPayload(oversizedCustomer);
}, /بیش از حد مجاز/, '❌ FAIL: Oversized receipt image must be rejected');

console.log('✅ PASS: Malicious MIME and oversized file uploads correctly rejected.');

// 3. Dispatch Schema Whitelist & Preservation
const sampleDispatch = {
  id: 'dsp-test-01',
  ticketNo: 'DSP-1403-999',
  status: 'requested',
  customerId: 'cust-99',
  customerName: 'کارفرمای نمونه',
  contactPhone: '09123456789',
  projectName: 'برج آفتاب',
  scheduledDateJalali: '1403/08/15',
  scheduledTime: '10:30',
  serviceType: 'نمونه‌گیری بتن فونداسیون',
  unknownInjectedField: 'malicious_content'
};

const cleaned = labDb.validateAndNormalizeDispatchPayload(sampleDispatch);
assert.strictEqual(cleaned.customerId, 'cust-99', '❌ FAIL: customerId was unexpectedly stripped');
assert.strictEqual(cleaned.scheduledDateJalali, '1403/08/15', '❌ FAIL: scheduledDateJalali was unexpectedly stripped');
assert.strictEqual(cleaned.scheduledTime, '10:30', '❌ FAIL: scheduledTime was unexpectedly stripped');
assert.strictEqual(cleaned.serviceType, 'نمونه‌گیری بتن فونداسیون', '❌ FAIL: serviceType was unexpectedly stripped');
assert.strictEqual(cleaned.unknownInjectedField, undefined, '❌ FAIL: Unknown injected field was not stripped');

console.log('✅ PASS: Dispatch schema whitelist correctly preserves authorized fields and drops unwhitelisted keys.');

console.log('🎉 ALL SECURITY & INPUT VALIDATION CHECKS PASSED!\n');
process.exit(0);
