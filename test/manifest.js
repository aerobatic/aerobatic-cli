const assert = require('assert');
const fs = require('fs-extra');
const uuid = require('uuid');
const path = require('path');
const os = require('os');

const manifest = require('../lib/manifest');

require('dash-assert');
const tmpdir = os.tmpdir();

describe('manifest', () => {
  it('creates default manifest', () => {
    const appId = uuid.v4();
    const program = {cwd: tmpdir};

    return manifest
      .create(program, appId)
      .then(() => manifest.load(program))
      .then(appManifest => {
        assert.equal(appManifest.id, appId);
        assert.equal(appManifest.plugins.length, 1);
        assert.deepEqual(appManifest.plugins[0], {name: 'webpage'});
      });
  });

  it('loading invalid yml throws error', () => {
    const program = {cwd: tmpdir};
    return fs
      .writeFile(
        path.join(tmpdir, manifest.fileName),
        'yaml: -{it: updates, in: real-time}'
      )
      .then(() => manifest.load(program))
      .catch(err => {
        assert.isTrue(/not valid yaml/.test(err.message));
      });
  });

  it('throws error if file missing', () => {
    const program = {cwd: tmpdir};
    return fs
      .remove(path.join(tmpdir, manifest.fileName))
      .then(() => manifest.load(program))
      .catch(err => {
        assert.equal(err.code, 'missingManifest');
      });
  });

  it('throws error if appId not in manifest', () => {
    const program = {cwd: tmpdir};
    return fs
      .writeFile(path.join(tmpdir, manifest.fileName), 'router: []')
      .then(() => manifest.load(program))
      .catch(err => {
        assert.equal(err.code, 'noManifestAppId');
      });
  });

  it('throws error if appId invalid', () => {
    const program = {cwd: tmpdir};
    return fs
      .writeFile(path.join(tmpdir, manifest.fileName), 'id: 123abc')
      .then(() => manifest.load(program))
      .catch(err => {
        assert.equal(err.code, 'invalidAppId');
      });
  });

  it('ensure not exists throws error if file exists', () => {
    const program = {cwd: tmpdir};
    return fs
      .writeFile(path.join(tmpdir, manifest.fileName), 'router: []')
      .then(() => manifest.ensureNotExists(program))
      .catch(err => {
        assert.equal(err.code, 'manifestAlreadyExists');
      });
  });

  it('ensure not exists does not throw error if file missing', () => {
    const program = {cwd: tmpdir};
    return fs
      .remove(path.join(tmpdir, manifest.fileName))
      .then(() => manifest.ensureNotExists(program));
  });
});
