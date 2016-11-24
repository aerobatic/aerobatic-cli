const yaml = require('js-yaml');
const log = require('winston');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');
const fs = require('fs-promise');

require('simple-errors');
const FILENAME = 'static.yml';

module.exports = {
  fileName: FILENAME,
  load,
  loadSafe,
  create,
  ensureNotExists,
  save
};

function ensureNotExists(program) {
  const filePath = path.join(program.cwd, FILENAME);
  return fs.exists(filePath)
    .then(exists => {
      if (exists) {
        throw Error.create('There is already a ' + chalk.bold(FILENAME) + ' file in this directory.\n' +
          'If you want to overwrite this with a new app, delete the ' + chalk.bold('appId') + ' ' +
          'key and re-run ' + chalk.green.underline('aero create') + '.',
          {formatted: true, code: 'manifestAlreadyExists'});
      }
      return;
    });
}

function loadSafe(program) {
  const filePath = path.join(program.cwd, FILENAME);

  log.debug('Check for manifest file at %s', filePath);
  return fs.exists(filePath)
    .then(exists => {
      if (exists) {
        return loadManifestYaml(program);
      }
      return fs.readFile(path.join(__dirname, '../default-manifest.yml'))
        .then(contents => {
          return yaml.safeLoad(contents.toString());
        });
    });
}

function load(program) {
  const filePath = path.join(program.cwd, FILENAME);

  log.debug('Check for manifest file at %s', filePath);
  return fs.exists(filePath)
    .then(exists => {
      if (!exists) {
        throw Error.create('There is no ' + chalk.bold(FILENAME) + ' file in this directory. ' +
          'First run ' + chalk.green.underline('aero create') + '.',
          {formatted: true, code: 'missingManifest'});
      }
    })
    .then(() => loadManifestYaml(program))
    .then(appManifest => {
      if (!appManifest.id) {
        throw Error.create('There is no ' + chalk.bold('id') +
        ' value in ' + chalk.bold(FILENAME) + '.\n' +
        'First run ' + chalk.underline.green('aero create') + '.',
        {formatted: true, code: 'noManifestAppId'});
      }

      return appManifest;
    });
}

function loadManifestYaml(program) {
  return fs.readFile(path.join(program.cwd, FILENAME))
    .then(contents => {
      const yamlString = contents ? contents.toString() : '';

      var appManifest;
      try {
        appManifest = yaml.safeLoad(yamlString) || {};
      } catch (err) {
        throw Error.create('The ' + chalk.bold(FILENAME) + ' file is not valid yaml.\n' +
          'Try using ' + chalk.underline('www.yamllint.com') + ' to validate.', {formatted: true});
      }

      // If there isn't a deploy section, add an empty object.
      if (!_.isObject(appManifest.deploy)) {
        appManifest.deploy = {};
      }

      return appManifest;
    });
}

function save(program, appManifest) {
  const ymlString = yaml.dump(appManifest);
  return fs.writeFile(path.join(program.cwd, FILENAME), ymlString)
    .then(() => null);
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
