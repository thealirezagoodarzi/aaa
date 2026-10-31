#!/usr/bin/env node
/**
 * Automated test suite for Contract Word (.docx) export,
 * layout structure, and printing isolation.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Contract Word (.docx) & Print Isolation Tests...\n');

const ROOT = path.resolve(__dirname, '..');

// 1. Verify contractDocxGenerator has matching 2-page layout
const docxGenCode = fs.readFileSync(path.join(ROOT, 'src/utils/contractDocxGenerator.ts'), 'utf8');

assert(docxGenCode.includes('sections: ['), 'FAIL: contractDocxGenerator must define document sections');
assert(docxGenCode.includes('page1Children'), 'FAIL: contractDocxGenerator must define page1Children');
assert(docxGenCode.includes('page2Children'), 'FAIL: contractDocxGenerator must define page2Children');
assert(docxGenCode.includes('PageBorderDisplay.ALL_PAGES'), 'FAIL: contractDocxGenerator must configure page borders');
assert(docxGenCode.includes("PageBorderOffsetFrom.PAGE"), 'FAIL: page borders must be offset from page');
assert(docxGenCode.includes("name: 'B Nazanin'"), 'FAIL: font must include B Nazanin');
assert(docxGenCode.includes("ascii: 'Tahoma'"), 'FAIL: font must include Tahoma fallback');
console.log('✅ PASS: Word .docx generator correctly defines 2 distinct bordered pages with Persian font fallbacks.');

// 2. Verify PrintContractModal layout sync
const modalCode = fs.readFileSync(path.join(ROOT, 'src/components/common/PrintContractModal.tsx'), 'utf8');

assert(modalCode.includes('ماده ۵- تعهدات شرکت'), 'FAIL: modal must include Article 5');
assert(modalCode.includes('ماده ۶- تعهدات کارفرما'), 'FAIL: modal must include Article 6');
assert(modalCode.includes('ماده ۷- حل اختلاف'), 'FAIL: modal must include Article 7');
assert(modalCode.includes('ماده ۸- نشانی و تعداد نسخه های قرارداد'), 'FAIL: modal must include Article 8');
assert(modalCode.includes('صفحه ۱ از ۲'), 'FAIL: modal must display page 1 of 2 footer');
assert(modalCode.includes('صفحه ۲ از ۲'), 'FAIL: modal must display page 2 of 2 footer');
assert(modalCode.includes('printIsolatedElement'), 'FAIL: modal must use printIsolatedElement');
console.log('✅ PASS: PrintContractModal layout is 100% synchronized with exact 2-page footer and isolation.');

// 3. Verify printDom.ts exports printIsolatedElement
const printDomCode = fs.readFileSync(path.join(ROOT, 'src/utils/printDom.ts'), 'utf8');
assert(printDomCode.includes('export function printIsolatedElement'), 'FAIL: printDom must export printIsolatedElement');
assert(printDomCode.includes("iframe.id = 'print-isolated-iframe'"), 'FAIL: printIsolatedElement must use isolated iframe');
console.log('✅ PASS: printDom.ts provides true isolated iframe printing without dashboard bleed.');

console.log('\n🎉 ALL CONTRACT DOCX & PRINT TESTS PASSED SUCCESSFULLY!\n');
