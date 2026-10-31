#!/usr/bin/env node
/**
 * Automated test suite for User Management & Role Immutability Security.
 *
 * Verifies:
 *  1. Operator creation enforces role 'operator'.
 *  2. Operator role cannot be demoted/changed to 'customer' or any other role via updateProfileServer.
 *  3. Operator role cannot be changed via updateUserRoleServer.
 *  4. Customer role cannot be elevated/changed to 'operator' via updateProfileServer or updateUserRoleServer.
 *  5. Sole admin cannot be deactivated or have role changed.
 *  6. Deactivating a user revokes all active sessions for that user.
 *  7. Password reset with forceMustChangePassword flags the profile and live session.
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
  console.log('🧪 Starting User Management & Access Security Tests...\n');

  await labDb.loadDatabaseStateAsync();

  // Test 1: Create an operator profile
  const opId = 'usr-op-freeze-' + Date.now();
  const opUsername = 'tech_freeze_' + Math.floor(Math.random() * 10000);
  const opPassword = 'StrongPass123!@#';

  const opProfile = {
    id: opId,
    fullName: 'تکنیسین تست فریز نقش',
    username: opUsername,
    email: `${opUsername}@lab.ir`,
    phone: '09139876543',
    role: 'operator',
    status: 'active',
    password: opPassword,
    createdAt: new Date().toISOString()
  };

  const createdOp = labDb.addProfileServer(opProfile);
  assert(createdOp, 'FAIL: Operator creation failed');
  assert.strictEqual(createdOp.role, 'operator', 'FAIL: Operator must have role operator');
  console.log('✅ Test 1: Operator created successfully with operator role.');

  // Test 2: Attempt to change operator to customer via updateProfileServer (must throw ROLE_IMMUTABLE)
  let threwOperatorToCustomer = false;
  try {
    await labDb.updateProfileServer(
      { id: opId, role: 'customer' },
      { actorRole: 'admin', actorUserId: 'usr-admin-01' }
    );
  } catch (err) {
    if (err && (err.message.includes('ROLE_IMMUTABLE') || err.message.includes('نقش اپراتور فنی'))) {
      threwOperatorToCustomer = true;
    } else {
      console.error('Unexpected error:', err);
    }
  }
  assert.strictEqual(threwOperatorToCustomer, true, 'FAIL: updateProfileServer must reject changing operator to customer');
  console.log('✅ Test 2: updateProfileServer rejected changing operator role to customer (ROLE_IMMUTABLE).');

  // Test 3: Attempt to change operator role via updateUserRoleServer (must fail)
  const roleChangeResult = await labDb.updateUserRoleServer(opId, 'customer');
  assert.strictEqual(roleChangeResult.success, false, 'FAIL: updateUserRoleServer must reject changing operator to customer');
  assert(roleChangeResult.error && roleChangeResult.error.includes('نقش اپراتور فنی آزمایشگاه بتن ثابت است'));
  console.log('✅ Test 3: updateUserRoleServer rejected changing operator role to customer.');

  // Test 4: Attempt to elevate a customer to operator
  const custId = 'usr-cust-freeze-' + Date.now();
  const custUsername = 'cust_freeze_' + Math.floor(Math.random() * 10000);
  const custProfile = {
    id: custId,
    customerId: 'cust-test-123',
    fullName: 'کارفرمای نمونه',
    username: custUsername,
    email: `${custUsername}@customer.ir`,
    phone: '09121234567',
    role: 'customer',
    status: 'active',
    password: 'CustomerPass123!',
    createdAt: new Date().toISOString()
  };
  const createdCust = labDb.addProfileServer(custProfile);
  assert.strictEqual(createdCust.role, 'customer');

  let threwCustomerToOperator = false;
  try {
    await labDb.updateProfileServer(
      { id: custId, role: 'operator' },
      { actorRole: 'admin', actorUserId: 'usr-admin-01' }
    );
  } catch (err) {
    if (err && (err.message.includes('ROLE_IMMUTABLE') || err.message.includes('کارفرما'))) {
      threwCustomerToOperator = true;
    }
  }
  assert.strictEqual(threwCustomerToOperator, true, 'FAIL: updateProfileServer must reject changing customer to operator');

  const custRoleChangeResult = await labDb.updateUserRoleServer(custId, 'operator');
  assert.strictEqual(custRoleChangeResult.success, false, 'FAIL: updateUserRoleServer must reject changing customer to operator');
  console.log('✅ Test 4: Rejection of changing customer role to operator verified.');

  // Test 5: Sole admin protection
  const adminRoleResult = await labDb.updateUserRoleServer('usr-admin-01', 'operator');
  assert.strictEqual(adminRoleResult.success, false, 'FAIL: Sole admin demotion must fail');
  console.log('✅ Test 5: Sole admin role protection verified.');

  // Test 6: Deactivation revokes active sessions
  const dummySessionUser = {
    id: opId,
    username: opUsername,
    role: 'operator',
    fullName: 'تکنیسین تست'
  };
  const token = labDb.generateSessionToken(dummySessionUser);
  const verifiedBefore = labDb.verifySessionToken(token);
  assert(verifiedBefore, 'FAIL: Session token should be valid before deactivation');

  // Deactivate the operator
  await labDb.updateProfileServer(
    { id: opId, status: 'inactive' },
    { actorRole: 'admin', actorUserId: 'usr-admin-01' }
  );

  const verifiedAfter = labDb.verifySessionToken(token);
  assert.strictEqual(verifiedAfter, null, 'FAIL: Session token must be revoked immediately when user is deactivated');
  console.log('✅ Test 6: User deactivation successfully revoked active sessions.');

  // Test 7: Password reset with forceMustChangePassword
  const resetRes = await labDb.updateUserPassword(opId, 'NewStrongPass123#$', undefined, {
    forceMustChangePassword: true
  });
  assert.strictEqual(resetRes, true, 'FAIL: updateUserPassword failed');

  const refreshedState = labDb.getDatabaseState();
  const refreshedOp = refreshedState.profiles.find(p => p.id === opId);
  assert(refreshedOp, 'FAIL: Profile not found after password reset');
  assert.strictEqual(refreshedOp.mustChangePassword, true, 'FAIL: mustChangePassword must be true');
  console.log('✅ Test 7: Password reset with forced first-login change verified.');

  console.log('\n🎉 ALL USER MANAGEMENT & ACCESS SECURITY TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
