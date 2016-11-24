const assert = require('assert');
const fs = require('fs-promise');
const manifest = require('../lib/manifest');
const uuid = require('node-uuid');
const path = require('path');
const os = require('os');

require('dash-assert');
const tmpdir = os.tmpdir();

describe('manifest', () => {
  it('creates default manifest', () => {
    const appId = uuid.v4();
    const program = {cwd: tmpdir};

    return manifest.create(program, appId)
      .then(() => manifest.load(program))
      .then(appManifest => {
        assert.equal(appManifest.id, appId);
        assert.equal(appManifest.router.length, 1);
        assert.deepEqual(appManifest.router[0], {module: 'webpage'});
        return;
      });
  });

  it('loading invalid yml throws error', () => {
    const program = {cwd: tmpdir};
    return fs.writeFile(path.join(tmpdir, manifest.fileName), 'yaml: -{it: updates, in: real-time}')
      .then(() => manifest.load(program))
      .catch(err => {
        assert.isTrue(/not valid yaml/.test(err.message));
        return;
      });
  });

  it('throws error if file missing', () => {
    const program = {cwd: tmpdir};
    return fs.remove(path.join(tmpdir, manifest.fileName))
      .then(() => manifest.load(program))
      .catch(err => {
        assert.equal(err.code, 'missingManifest');
        return;
      });
  });

  it('throws error if appId not in manifest', () => {
    const program = {cwd: tmpdir};
    return fs.writeFile(path.join(tmpdir, manifest.fileName), 'router: []')
      .then(() => manifest.load(program))
      .catch(err => {
        assert.equal(err.code, 'noManifestAppId');
        return;
      });
  });

  it('ensure not exists throws error if file exists', () => {
    const program = {cwd: tmpdir};
    return fs.writeFile(path.join(tmpdir, manifest.fileName), 'router: []')
      .then(() => manifest.ensureNotExists(program))
      .catch(err => {
        assert.equal(err.code, 'manifestAlreadyExists');
        return;
      });
  });

  it('ensure not exists does not throw error if file missing', () => {
    const program = {cwd: tmpdir};
    return fs.remove(path.join(tmpdir, manifest.fileName))
      .then(() => manifest.ensureNotExists(program));
  });
});
