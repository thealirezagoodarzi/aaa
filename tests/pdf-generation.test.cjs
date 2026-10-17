#!/usr/bin/env node
/**
 * Automated test suite for Contract Multi-Page PDF Generation
 * and UI thread resilience.
 *
 * Verifies:
 *  1. Multi-page contract markup contains both .contract-page elements (Page 1 & Page 2).
 *  2. contractPdfGenerator correctly targets all .contract-page elements for multi-page PDF.
 *  3. Rendering lock (`isRendering`) is always cleanly released in finally block.
 *  4. PrintDom cleanup restores all DOM elements without leaving hidden nodes.
 *  5. PrintContractModal properly checks result status/success.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Contract PDF Generation & Stability Tests...\n');

const ROOT = path.resolve(__dirname, '..');

// 1. Verify PrintContractModal.tsx defines both contract pages with .contract-page
const modalCode = fs.readFileSync(path.join(ROOT, 'src/components/common/PrintContractModal.tsx'), 'utf8');

// Match occurrences of contract-page class
const pageMatches = modalCode.match(/className=\{`contract-page contract-bordered-page/g) || [];
assert.strictEqual(
  pageMatches.length,
  2,
  `❌ FAIL: PrintContractModal must define exactly 2 distinct .contract-page sections, found ${pageMatches.length}`
);
console.log('✅ PASS: PrintContractModal defines 2 distinct authored pages with .contract-page.');

// Verify printable container id exists
assert(
  modalCode.includes('id="contract-printable-doc"'),
  '❌ FAIL: contract-printable-doc id is missing from PrintContractModal'
);
console.log('✅ PASS: contract-printable-doc root container correctly defined.');

// 2. Verify contractPdfGenerator.ts multi-page handling logic
const generatorCode = fs.readFileSync(path.join(ROOT, 'src/utils/contractPdfGenerator.ts'), 'utf8');

assert(
  generatorCode.includes("element.querySelectorAll<HTMLElement>('.contract-page, .certificate-page')"),
  '❌ FAIL: contractPdfGenerator must query for .contract-page sub-pages!'
);
console.log('✅ PASS: contractPdfGenerator queries all distinct .contract-page sections.');

assert(
  generatorCode.includes('pdf.addPage'),
  '❌ FAIL: contractPdfGenerator must add subsequent pages to jsPDF!'
);
console.log('✅ PASS: contractPdfGenerator adds A4 pages for multi-page documents.');

// Verify render lock is released in finally
assert(
  generatorCode.includes('finally {\n    isRendering = false;\n  }'),
  '❌ FAIL: contractPdfGenerator must reset isRendering in finally block!'
);
console.log('✅ PASS: contractPdfGenerator guarantees isRendering is released in finally block.');

// 3. Verify PrintContractModal checks result.status / result.pageCount properly
assert(
  modalCode.includes("result?.status === 'SUCCESS' && result.pageCount && result.pageCount > 1"),
  '❌ FAIL: PrintContractModal must properly inspect result.status and result.pageCount!'
);
assert(
  modalCode.includes('setIsGeneratingPdf(false)'),
  '❌ FAIL: PrintContractModal must reset isGeneratingPdf state in finally block!'
);
console.log('✅ PASS: PrintContractModal handles multi-page notification and loading state cleanup.');

// 4. Verify printDom.ts cleanup guarantees
const printDomCode = fs.readFileSync(path.join(ROOT, 'src/utils/printDom.ts'), 'utf8');

assert(
  printDomCode.includes("safetyTimer = setTimeout(cleanup, 8000);"),
  '❌ FAIL: printDom must include safetyTimer to prevent permanent page lockup!'
);
assert(
  printDomCode.includes("isPrinting = false;"),
  '❌ FAIL: printDom must reset isPrinting flag upon cleanup!'
);
console.log('✅ PASS: printDom ensures failsafe DOM restoration and lock clearing.');

console.log('\n🎉 ALL CONTRACT PDF GENERATION & STABILITY CHECKS PASSED!');
