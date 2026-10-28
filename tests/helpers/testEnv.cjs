/**
 * Shared Test Isolation Helper.
 * Ensures every test suite runs against a disposable, isolated directory
 * and never touches or pollutes the repository's real data/ directory.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupTestEnv(prefix = 'azma-test-') {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dataDir = path.join(tmpRoot, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  process.env.NODE_ENV = 'production';
  process.env.PORT = '0';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars-long-secure';
  process.env.LAB_DATA_ROOT = tmpRoot;
  process.env.LAB_DATA_DIR = dataDir;

  const cleanup = () => {
    try {
      if (fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    } catch (e) {
      // non-critical cleanup failure
    }
  };

  process.on('exit', cleanup);

  return {
    tmpRoot,
    dataDir,
    cleanup
  };
}

module.exports = {
  setupTestEnv
};
