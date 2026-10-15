/**
 * Automated test suite to verify navigation history safety,
 * tab switching, modal back-stack, and session expiry protections.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Navigation & Session Protection Tests...\n');

// 1. Verify AdminDashboard.tsx does not use useModalBack for tabs
const adminDashboardCode = fs.readFileSync(path.join(__dirname, '../src/components/admin/AdminDashboard.tsx'), 'utf8');
assert(
  !adminDashboardCode.includes("useModalBack(activeTab"),
  '❌ FAIL: AdminDashboard should not use useModalBack for activeTab!'
);
console.log('✅ PASS: AdminDashboard does not use useModalBack for activeTab.');

// Verify no duplicate modal hooks for modals that handle their own back buttons
assert(
  !adminDashboardCode.includes("useModalBack(Boolean(selectedReportForCert)"),
  '❌ FAIL: Duplicate useModalBack for PrintCertificate found in AdminDashboard!'
);
assert(
  !adminDashboardCode.includes("useModalBack(Boolean(selectedInvoiceForPrint)"),
  '❌ FAIL: Duplicate useModalBack for PrintInvoice found in AdminDashboard!'
);
assert(
  !adminDashboardCode.includes("useModalBack(showTrashModal"),
  '❌ FAIL: Duplicate useModalBack for AdminCustomerTrashModal found in AdminDashboard!'
);
assert(
  !adminDashboardCode.includes("useModalBack(Boolean(viewingQrUser)"),
  '❌ FAIL: Duplicate useModalBack for QrAccessCardModal found in AdminDashboard!'
);
console.log('✅ PASS: No duplicate useModalBack registrations in AdminDashboard.');

// 2. Verify OperatorDashboard.tsx does not use useModalBack for tabs
const operatorDashboardCode = fs.readFileSync(path.join(__dirname, '../src/components/operator/OperatorDashboard.tsx'), 'utf8');
assert(
  !operatorDashboardCode.includes("useModalBack(activeTab"),
  '❌ FAIL: OperatorDashboard should not use useModalBack for activeTab!'
);
console.log('✅ PASS: OperatorDashboard does not use useModalBack for activeTab.');

// 3. Verify navigationHistory.ts portal safety
const navHistoryCode = fs.readFileSync(path.join(__dirname, '../src/services/navigationHistory.ts'), 'utf8');
assert(
  navHistoryCode.includes("this.currentView === 'portal'"),
  '❌ FAIL: navigationHistory should contain portal guards!'
);
// In goBack, ensure fallback does not navigate to landing when in portal
assert(
  navHistoryCode.includes("if (this.currentView === 'portal') {\n      this.notifyToast("),
  '❌ FAIL: goBack() must prevent fallback navigation to landing when in portal!'
);
// In handlePopState, ensure root anchor never sets #home when in portal
assert(
  navHistoryCode.includes("const rootHash = this.currentView === 'landing' ? '#home' : `#${this.currentView}`;"),
  '❌ FAIL: handlePopState root state must anchor to currentView and not unconditionally #home!'
);
console.log('✅ PASS: navigationHistory guarantees user cannot be accidentally ejected from portal.');

// 4. Verify ConcreteLabStorage.ts session expiration & refresh protections
const storageCode = fs.readFileSync(path.join(__dirname, '../src/services/ConcreteLabStorage.ts'), 'utf8');
// Must not expire session if refresh token is still present (transient errors / 429)
assert(
  storageCode.includes("if (!this.getRefreshToken()) {\n        this.handleSessionExpired();\n      }"),
  '❌ FAIL: authedFetch must not trigger handleSessionExpired if refresh token is still present!'
);
// Proactive refresh margin must not trigger 30s tight loop
assert(
  storageCode.includes("3 * 60 * 1000"),
  '❌ FAIL: scheduleProactiveRefresh must have at least 3m minimum delay to prevent rate limit starvation!'
);
console.log('✅ PASS: ConcreteLabStorage prevents spurious session expiration and rate limit exhaustion.');

// 5. Verify server refresh rate limit
const middlewareCode = fs.readFileSync(path.join(__dirname, '../server/labDbMiddleware.ts'), 'utf8');
assert(
  middlewareCode.includes("checkRateLimit(`refresh:${getClientIp(req)}`, 120,"),
  '❌ FAIL: server refresh rate limit must be at least 120 per 10m!'
);
console.log('✅ PASS: Server rate limit on token refresh is sufficiently permissive.');

// 6. Verify App.tsx session restoration maintains portal view
const appCode = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
assert(
  appCode.includes("if (window.location.hash.startsWith('#portal') || activeView === 'portal')"),
  '❌ FAIL: App.tsx must maintain portal view when restoring authenticated session!'
);
console.log('✅ PASS: App.tsx maintains portal view after page refresh or session restore.');

console.log('\n🎉 ALL NAVIGATION & SESSION PROTECTION CHECKS PASSED!');
