const yaml = require('js-yaml');
const log = require('winston');
const path = require('path');
const fs = require('fs-promise');

const FILENAME = 'aerobatic.yml';
const DEFAULT_MANIFEST = {
  appId: null,
  router: [
    {
      module: 'webpage'
    }
  ]
};

module.exports = {
  load,
  create,
  ensureNotExists
};

function ensureNotExists(program) {
  const filePath = path.join(program.cwd, FILENAME);
  return fs.exists(filePath)
    .then(exists => {
      if (exists) {
        throw new Error(`Manifest file ${FILENAME} already exists in this directory. If you want to ` +
          'overwrite with a new app, delete this file first then re-run `aero create`.');
      }
      return;
    });
}

function load(program) {
  const filePath = path.join(program.cwd, FILENAME);

  log.debug('Ensure manifest at %s', filePath);
  return fs.ensureFile(filePath)
    .then(() => {
      return fs.readFile(filePath)
        .then(contents => (contents ? contents.toString() : ''));
    })
    .then(yamlString => {
      var manifestJson;
      try {
        log.debug('Load manifest yaml %s', yamlString);
        manifestJson = yaml.safeLoad(yamlString);
      } catch (err) {
        log.warn('Invalid yaml file %s', filePath);
      }

      return manifestJson || {};
    });
}

// Create a new manifest yml file for the appId
function create(program, appId) {
  const manifest = Object.assign(DEFAULT_MANIFEST, {appId});
  return save(program, manifest);
}

function save(program, manifest) {
  var ymlContents = yaml.safeDump(manifest);
  ymlContents = '# Application manifest \n\n' + ymlContents;

  return fs.writeFile(path.join(program.cwd, FILENAME), ymlContents)
    .then(() => manifest);
}
