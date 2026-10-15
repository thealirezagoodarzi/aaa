#!/usr/bin/env node
/**
 * Credential-repair regression tests (FIX verification).
 *
 * Run:  npm run test:credentials   (requires a prior `npm run build`)
 *
 * Exercises the EXACT production bundle (dist/server.cjs) in library mode —
 * server.ts auto-closes its HTTP listener when required as a non-entry module,
 * and LAB_DATA_ROOT isolates every scenario in a temp directory so the real
 * repository database is never touched.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// SELF-CONTAINED TEST ENVIRONMENT:
// Ensure fixed, deterministic defaults prior to loading any server modules
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars-long';
process.env.ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'EnvBoot123456!';
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || 'test-bootstrap-token';

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'server.cjs');
if (!fs.existsSync(BUNDLE)) {
  console.error('dist/server.cjs not found — run `npm run build` first.');
  process.exit(1);
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log(`  ok - ${name}`);
  } else {
    failures++;
    console.error(`FAIL - ${name}${extra ? ' :: ' + extra : ''}`);
  }
}

// Independent implementations of the two stored-hash shapes (deliberately NOT
// using the bundle's helpers, to prove the repair logic on raw data):
function genuineHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');            // 32 hex chars
  const digest = crypto.scryptSync(password, salt, 64).toString('hex'); // 128 hex
  return `scrypt:${salt}:${digest}`;
}
function fakeLegacyHash() {
  const salt = crypto.randomBytes(32).toString('hex');            // 64 hex — wrong shape
  const digest = crypto.pbkdf2Sync('whatever', salt, 1000, 64, 'sha512').toString('hex');
  return `scrypt:${salt}:${digest}`;
}

/**
 * Run `snippet` inside a fresh node process that has required the production
 * bundle. The snippet must print exactly one line `RESULT:<json>`.
 */
function evalInBundle(snippet, root, env) {
  const bootstrap = `
    (async () => {
      const m = require(${JSON.stringify(BUNDLE)});
      const labDb = m.__testables;
      await labDb.loadDatabaseStateAsync();
      ${snippet}
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;
  const out = execFileSync(process.execPath, ['-e', bootstrap], {
    env: { ...process.env, ...env, LAB_DATA_ROOT: root },
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const line = out.split('\n').filter(l => l.startsWith('RESULT:')).pop();
  if (!line) throw new Error('no RESULT line in output:\n' + out);
  return JSON.parse(line.slice('RESULT:'.length));
}

function makeTempRoot(withDataDir = true) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'azma-credtest-'));
  if (withDataDir) fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
  return tmp;
}

function baseState(profiles) {
  return {
    version: 1, lastUpdated: Date.now(), profiles,
    customers: [], reports: [], invoices: [], accounting: [], calibrations: [],
    dispatches: [], technicians: [], envLogs: [], media: [], smsLogs: [], trashCustomers: [],
  };
}

const COMMON_ENV = {
  SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
  ADMIN_INITIAL_PASSWORD: 'EnvBoot123456!',
  ADMIN_BOOTSTRAP_TOKEN: 'test-bootstrap-token',
  NODE_ENV: 'production',
  PORT: '0',
};

// ---------------------------------------------------------------------------
// Scenario 1 (CRITICAL REGRESSION): profiles WITHOUT any password field —
// e.g. OTP-only staff accounts — must NOT be stamped with a random UNUSABLE
// placeholder hash on every load. Previously repairCorruptedCredentials fell
// through for missing/empty passwords and silently corrupted their stored
// credential on each restart. Now: no password field → untouched (undefined),
// and nothing is rewritten repeatedly.
// ---------------------------------------------------------------------------
{
  console.log('\n== S1: OTP-only / passwordless profiles are left untouched ==');
  const tmp = makeTempRoot();
  const dataDir = path.join(tmp, 'data');
  const dbFile = path.join(dataDir, 'laboratory_db.json');
  fs.writeFileSync(dbFile, JSON.stringify(baseState([
    { id: 'usr-admin-01', username: 'admin', role: 'admin', email: 'admin@azmajahanbin.ir', password: genuineHash('BootstrapPass1!'), status: 'active' },
    { id: 'usr-otp-1', username: 'technician1', role: 'operator', fullName: 'تکنسین', phone: '09120000001', status: 'active' }, // NO password field
    { id: 'usr-otp-2', username: 'technician2', role: 'operator', fullName: 'تکنسین ۲', phone: '09120000002', password: '', status: 'active' }, // empty string
  ]), null, 2));

  const r1 = evalInBundle(`
    const s = labDb.getDatabaseState();
    const otp1 = s.profiles.find(p => p.id === 'usr-otp-1');
    const otp2 = s.profiles.find(p => p.id === 'usr-otp-2');
    console.log('RESULT:' + JSON.stringify({
      otp1HasField: Object.prototype.hasOwnProperty.call(otp1, 'password'),
      otp1Value: otp1.password === undefined ? '__UNDEFINED__' : otp1.password,
      otp2Value: otp2.password === undefined ? '__UNDEFINED__' : otp2.password,
    }));
  `, tmp, COMMON_ENV);

  const diskAfterFirstLoad = fs.readFileSync(dbFile, 'utf-8');
  const r2 = evalInBundle(`
    const s = labDb.getDatabaseState();
    const otp1 = s.profiles.find(p => p.id === 'usr-otp-1');
    console.log('RESULT:' + JSON.stringify({
      otp1HasField: Object.prototype.hasOwnProperty.call(otp1, 'password'),
      otp1Value: otp1.password === undefined ? '__UNDEFINED__' : otp1.password,
    }));
  `, tmp, COMMON_ENV);
  const diskAfterSecondLoad = fs.readFileSync(dbFile, 'utf-8');

  check('passwordless profile keeps NO password field after load (not corrupted)',
    r1.otp1HasField === false || r1.otp1Value === '__UNDEFINED__', JSON.stringify(r1));
  check('empty-string password stays empty (no random hash injected)',
    (r2.otp1HasField === false || r2.otp1Value === '__UNDEFINED__') && (r1.otp2Value === '' || r1.otp2Value === '__UNDEFINED__'), JSON.stringify(r1) + ' / ' + JSON.stringify(r2));
  check('repeated loads do NOT rewrite the DB file (no corruption loop)',
    diskAfterFirstLoad === diskAfterSecondLoad);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Scenario 2: genuine legacy-fake digests ARE repaired at load time:
// admin → env bootstrap credential (+mustChangePassword), other users →
// non-loginable placeholder, while healthy hashes are left working.
// ---------------------------------------------------------------------------
{
  console.log('\n== S2: corrupted fake hashes self-heal ==');
  const tmp = makeTempRoot();
  const dbFile = path.join(tmp, 'data', 'laboratory_db.json');
  fs.writeFileSync(dbFile, JSON.stringify(baseState([
    { id: 'usr-admin-01', username: 'admin', role: 'admin', email: 'admin@azmajahanbin.ir', password: fakeLegacyHash(), status: 'active' },
    { id: 'usr-op-1', username: 'op1', role: 'operator', password: fakeLegacyHash(), status: 'active' },
    { id: 'usr-op-2', username: 'op2', role: 'operator', password: genuineHash('GoodPass123'), status: 'active' },
  ]), null, 2));

  const BOOT = 'EnvBootstrap99!';
  const r = evalInBundle(`
    const s = labDb.getDatabaseState();
    const adm = s.profiles.find(p => p.id === 'usr-admin-01');
    const op1 = s.profiles.find(p => p.id === 'usr-op-1');
    const op2 = s.profiles.find(p => p.id === 'usr-op-2');
    const diskProfiles = (JSON.parse(require('fs').readFileSync(${JSON.stringify(dbFile)}, 'utf-8')).profiles) || [];
    const diskAdm = diskProfiles.find(p => p.id === 'usr-admin-01');
    console.log('RESULT:' + JSON.stringify({
      adminVerifies: adm ? labDb.verifyPassword(${JSON.stringify(BOOT)}, adm.password) : false,
      adminMustChange: !!(adm && adm.mustChangePassword),
      op1FakeGone: op1 ? !labDb.isFakeClientScryptHash(op1.password) : false,
      op1Locked: op1 ? !labDb.verifyPassword('anything', op1.password) : false,
      op2StillWorks: op2 ? labDb.verifyPassword('GoodPass123', op2.password) : false,
      persistedHealed: diskAdm ? !labDb.isFakeClientScryptHash(diskAdm.password) : false,
    }));
  `, tmp, { ...COMMON_ENV, ADMIN_INITIAL_PASSWORD: BOOT });

  check('admin fake hash repaired to env bootstrap credential', r.adminVerifies === true);
  check('repaired admin flagged mustChangePassword', r.adminMustChange === true);
  check('non-admin fake hash replaced & made non-loginable', r.op1FakeGone === true && r.op1Locked === true);
  check('genuine operator hash left working', r.op2StillWorks === true);
  check('repair persisted to disk', r.persistedHealed === true);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Scenario 3: second-pass repair — a fake digest arriving via the SEED merge
// (which happens AFTER the first repair pass) is healed before persistence.
// ---------------------------------------------------------------------------
{
  console.log('\n== S3: fake digest from seed merge healed on second pass ==');
  const tmp = makeTempRoot();
  const dbFile = path.join(tmp, 'data', 'laboratory_db.json');
  fs.writeFileSync(dbFile, JSON.stringify(baseState([
    { id: 'usr-admin-01', username: 'admin', role: 'admin', email: 'admin@azmajahanbin.ir', password: genuineHash('BootstrapPass1!'), status: 'active' },
  ]), null, 2));
  fs.writeFileSync(path.join(tmp, 'data', 'initial_seed_data.json'), JSON.stringify({
    profiles: [{ id: 'usr-seed-1', username: 'seeded', role: 'operator', password: fakeLegacyHash(), status: 'active' }],
  }));

  const r = evalInBundle(`
    const s = labDb.getDatabaseState();
    const seeded = s.profiles.find(p => p.id === 'usr-seed-1');
    const diskProfiles = (JSON.parse(require('fs').readFileSync(${JSON.stringify(dbFile)}, 'utf-8')).profiles) || [];
    const disk = diskProfiles.find(p => p.id === 'usr-seed-1');
    console.log('RESULT:' + JSON.stringify({
      memoryHealed: seeded ? !labDb.isFakeClientScryptHash(seeded.password) : false,
      diskHealed: disk ? !labDb.isFakeClientScryptHash(disk.password) : false,
      flagged: seeded ? !!seeded.mustChangePassword : false,
    }));
  `, tmp, COMMON_ENV);

  check('seeded fake digest healed in memory', r.memoryHealed === true);
  check('healed value persisted to disk (not re-poisoned)', r.diskHealed === true);
  check('healed account flagged for reset', r.flagged === true);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Scenario 4: hijack-prevention guards on tryBootstrapAdminPassword.
// ---------------------------------------------------------------------------
{
  console.log('\n== S4: bootstrap reset cannot hijack healthy accounts ==');
  const tmp = makeTempRoot();
  const dbFile = path.join(tmp, 'data', 'laboratory_db.json');
  fs.writeFileSync(dbFile, JSON.stringify(baseState([
    { id: 'usr-admin-01', username: 'admin', role: 'admin', email: 'admin@azmajahanbin.ir', password: genuineHash('RealOwnerPass1!'), status: 'active' },
  ]), null, 2));

  const r = evalInBundle(`
    const okNonForce = await labDb.tryBootstrapAdminPassword('AttackerPass1!', false);
    const adm = labDb.getDatabaseState().profiles.find(p => p.id === 'usr-admin-01');
    const stillOriginal = labDb.verifyPassword('RealOwnerPass1!', adm.password);
    const okForce = await labDb.tryBootstrapAdminPassword('RecoveredPass1!', true);
    const afterForce = labDb.verifyPassword('RecoveredPass1!', labDb.getDatabaseState().profiles.find(p => p.id === 'usr-admin-01').password);
    console.log('RESULT:' + JSON.stringify({ okNonForce, stillOriginal, okForce, afterForce }));
  `, tmp, { ...COMMON_ENV, ADMIN_INITIAL_PASSWORD: 'EnvBoot123456' });

  check('non-forced bootstrap REFUSED on healthy admin hash', r.okNonForce === false);
  check('healthy admin credential untouched by refusal', r.stillOriginal === true);
  check('forced bootstrap succeeds (operator escape hatch w/ token)', r.okForce === true);
  check('forced bootstrap installs new working credential', r.afterForce === true);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL CREDENTIAL TESTS PASSED ✅' : `\n${failures} TEST(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
