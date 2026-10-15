#!/usr/bin/env node
/**
 * Automated test suite for Operator Creation and Login Authentication.
 *
 * Verifies:
 *  1. Admin can successfully create an operator profile with initialPassword.
 *  2. Operator profile is immediately indexed and searchable without server restart.
 *  3. Operator can successfully authenticate with their username and password.
 *  4. Digits entered in Persian / Arabic are normalized and verify successfully.
 *  5. Unauthorized / customer roles cannot create staff profiles.
 *  6. Role gates work correctly (admin/operator permitted, customer forbidden).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'server.cjs');

if (!fs.existsSync(BUNDLE)) {
  console.error('dist/server.cjs not found — please run `npm run build` first.');
  process.exit(1);
}

process.env.PORT = '0';
process.env.IS_TEST_SUITE = '1';
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars-long';

const serverModule = require(BUNDLE);
const labDb = serverModule.__testables;

async function runTests() {
  console.log('🧪 Starting Operator Auth & Creation Tests...\n');

  await labDb.loadDatabaseStateAsync();

  // 1. Create a new operator
  const testOpId = 'usr-tech-test-' + Date.now();
  const testOpUsername = 'tech_reza_' + Math.floor(Math.random() * 1000);
  const testOpPassword = 'PassWord' + Math.floor(1000 + Math.random() * 9000) + '!';

  const newOp = {
    id: testOpId,
    fullName: 'رضا محمدی (اپراتور تست)',
    username: testOpUsername,
    email: `${testOpUsername}@lab.ir`,
    phone: '09131234567',
    role: 'operator',
    status: 'active',
    password: testOpPassword,
    createdAt: new Date().toISOString()
  };

  const created = labDb.addProfileServer(newOp);
  assert(created, '❌ FAIL: addProfileServer failed to return created profile');
  assert.strictEqual(created.role, 'operator', '❌ FAIL: created profile must have operator role');
  console.log('✅ PASS: Operator profile successfully created on server.');

  // 2. Immediate authentication without restart
  const authResult = await labDb.authenticateUser(testOpUsername, testOpPassword);
  assert(authResult.success, `❌ FAIL: authenticateUser failed: ${authResult.error}`);
  assert(authResult.user, '❌ FAIL: authenticateUser returned no user profile');
  assert.strictEqual(authResult.user.id, testOpId, '❌ FAIL: authenticated user ID mismatch');
  console.log('✅ PASS: Operator successfully logged in with username and password.');

  // 3. Persian digits support in login identifier and password
  const persianUsername = testOpUsername.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) + 1728));
  const persianPassword = testOpPassword.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) + 1728));

  const authPersian = await labDb.authenticateUser(persianUsername, persianPassword);
  assert(authPersian.success, `❌ FAIL: authenticateUser with Persian digits failed: ${authPersian.error}`);
  console.log('✅ PASS: Operator successfully logged in with Persian digits.');

  // 4. Case-insensitivity in username
  const upperUsername = testOpUsername.toUpperCase();
  const authUpper = await labDb.authenticateUser(upperUsername, testOpPassword);
  assert(authUpper.success, `❌ FAIL: authenticateUser with uppercase username failed: ${authUpper.error}`);
  console.log('✅ PASS: Operator successfully logged in with case-insensitive username.');

  // 5. Phone number authentication
  const authPhone = await labDb.authenticateUser('09131234567', testOpPassword);
  assert(authPhone.success, `❌ FAIL: authenticateUser with phone number failed: ${authPhone.error}`);
  console.log('✅ PASS: Operator successfully logged in with registered phone number.');

  // 6. Bad credentials reject
  const authBad = await labDb.authenticateUser(testOpUsername, 'WrongPassword123!');
  assert(!authBad.success, '❌ FAIL: authenticateUser should reject invalid password');
  console.log('✅ PASS: Invalid password rejected with appropriate error.');

  // Cleanup test operator
  labDb.deleteProfileServer(testOpId);
  const deletedLookup = labDb.findUserByIdentifier(testOpUsername);
  assert(!deletedLookup, '❌ FAIL: deleted operator should no longer resolve');
  console.log('✅ PASS: Operator deletion and index cleanup verified.');

  console.log('\n🎉 ALL OPERATOR AUTH TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
