/** Behavioural regression checks for portal navigation, callbacks and PDF export. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');

function loadTs(path, globals = {}) {
  const code = esbuild.transformSync(fs.readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console, ...globals }, { filename: path });
  return module.exports;
}

(async () => {
  const { isCallbackRequest } = loadTs('src/utils/dispatchKind.ts');
  assert.equal(isCallbackRequest({ source: 'website_callback', status: 'requested' }), true);
  assert.equal(isCallbackRequest({ projectName: 'درخواست آنلاین آزمایشگاه' }), true);
  assert.equal(isCallbackRequest({ projectName: 'درخواست آزمایش وب‌سایت' }), true);
  assert.equal(isCallbackRequest({ projectName: 'درخواست آنلاین آزمایشگاه', source: 'dispatch' }), false);
  assert.equal(isCallbackRequest({ status: 'requested', projectName: 'ساختمان' }), false);

  const location = { hash: '' };
  const entries = [{ state: null, hash: '' }];
  let index = 0, listener, exits = 0;
  const history = {
    get state() { return entries[index].state; },
    pushState(state, _, hash) { entries.splice(index + 1); entries.push({state, hash}); index++; location.hash = hash; },
    replaceState(state, _, hash) { entries[index] = {state, hash}; location.hash = hash; },
    back() { if (index === 0) { exits++; return; } index--; location.hash = entries[index].hash; listener({state: entries[index].state}); }
  };
  const window = { history, location, addEventListener: (_, cb) => { listener = cb; }, scrollTo() {} };
  const { navHistory } = loadTs('src/services/navigationHistory.ts', { window, document: { documentElement: { lang: 'fa' } } });
  let tab;
  navHistory.subscribeView((view, meta) => { if (view === 'portal' && meta?.fromPop) tab = meta.tab || 'dashboard'; });
  navHistory.navigateView('portal');
  navHistory.navigateTab('requests');
  navHistory.navigateTab('callbacks');
  history.back();
  assert.equal(tab, 'requests');
  history.back();
  assert.equal(tab, 'dashboard');
  for (let i = 0; i < 5; i++) history.back();
  assert.equal(exits, 0);
  assert.equal(navHistory.getCurrentView(), 'portal');
  // StrictMode cleanup and immediate re-registration must not queue a silent back.
  let closed = 0;
  const cleanup = navHistory.registerModal('example', () => closed++);
  cleanup();
  navHistory.registerModal('example', () => closed++);
  history.back();
  assert.equal(closed, 1);
  for (let i = 0; i < 5; i++) history.back();
  assert.equal(exits, 0);

  const result = await esbuild.build({
    entryPoints: ['src/utils/contractPdfGenerator.ts'], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'mock-pdf-deps', setup(build) {
      build.onResolve({ filter: /^(html2canvas-pro|jspdf)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'jspdf'
        ? `export class jsPDF { addPage(){globalThis.calls.pages++} addImage(...a){globalThis.calls.images.push(a)} save(name){globalThis.calls.filename=name} }`
        : `export default async function(el, options){ if(globalThis.calls.fail) throw Error('render failed'); options.onclone({}, el); globalThis.calls.rendered.push(el); return {width: 800, height: 1200, toDataURL: () => 'data:image/jpeg;base64,AA=='} }`, loader: 'js' }));
    }}]
  });
  const calls = { pages: 0, images: [], rendered: [] };
  const pages = [{style:{}}, {style:{}}];
  const root = { querySelectorAll: () => pages };
  const context = { module: { exports: {} }, exports: {}, console, calls, document: { getElementById: id => id === 'doc' ? root : null } };
  context.exports = context.module.exports;
  vm.runInNewContext(result.outputFiles[0].text, context);
  const pdf = context.module.exports;
  assert.equal((await pdf.downloadContractPdf('missing')).status, 'ELEMENT_NOT_FOUND');
  const output = await pdf.downloadContractPdf('doc', 'قرارداد.pdf');
  assert.equal(output.status, 'SUCCESS');
  assert.equal(output.pageCount, 2);
  assert.equal(calls.pages, 1);
  assert.equal(calls.images.length, 2);
  assert.equal(calls.filename, 'قرارداد.pdf');
  assert.equal(pages[0].style.width, '210mm');
  assert.ok(calls.images[0][4] <= 210 && calls.images[0][5] <= 297);
  calls.fail = true;
  assert.equal((await pdf.downloadContractPdf('doc')).status, 'ERROR');
  assert.equal(pdf.isPdfRendering(), false);
  console.log('PASS: callback separation, portal history and PDF export workflow');
})().catch(e => { console.error(e); process.exitCode = 1; });
