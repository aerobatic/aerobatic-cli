const yaml = require('js-yaml');
const log = require('winston');
const path = require('path');
const _ = require('lodash');
const fs = require('fs-promise');

const FILENAME = 'aerobatic.yml';

module.exports = {
  fileName: FILENAME,
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

  log.debug('Check for manifest file at %s', filePath);
  return fs.exists(filePath)
    .then(exists => {
      if (!exists) throw new Error('Missing manifest file ' + filePath);
      return;
    })
    .then(() => {
      return fs.readFile(filePath)
        .then(contents => (contents ? contents.toString() : ''));
    })
    .then(yamlString => {
      var appManifest;
      try {
        log.debug('Load manifest yaml %s', yamlString);
        appManifest = yaml.safeLoad(yamlString) || {};
      } catch (err) {
        throw new Error('Manifest file ' + filePath + ' is not valid yaml');
      }

      if (!appManifest.appId) {
        throw new Error('Missing appId in ' + FILENAME + ' manifest file.');
      }

      // If there isn't a deploy section, add an empty object.
      if (!_.isObject(appManifest.deploy)) {
        appManifest.deploy = {};
      }

      return appManifest;
    });
}

// Create a new default manifest yml file for the specified appId
function create(program, appId) {
  return fs.readFile(path.join(__dirname, '../default-manifest.yml'))
    .then(ymlString => {
      ymlString = ymlString.toString().replace('__appId__', appId);
      return fs.writeFile(path.join(program.cwd, FILENAME), ymlString)
        .then(() => null);
    });
}
