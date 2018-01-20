const yaml = require('js-yaml');
const log = require('winston');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');
const fs = require('fs-promise');

require('simple-errors');
const FILENAME = 'aerobatic.yml';

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
  return fs.exists(filePath).then(exists => {
    if (exists) {
      throw Error.create(
        'There is already a ' +
          chalk.bold(FILENAME) +
          ' file in this directory.\n' +
          'If you want to overwrite this with a new app, delete the ' +
          chalk.bold('appId') +
          ' ' +
          'key and re-run ' +
          chalk.green.underline('aero create') +
          '.',
        {formatted: true, code: 'manifestAlreadyExists'}
      );
    }
    return;
  });
}

function loadSafe(program, validateId) {
  const filePath = path.join(program.cwd, FILENAME);

  log.debug('Check for manifest file at %s', filePath);
  return fs.exists(filePath).then(exists => {
    if (exists) {
      return loadManifestYaml(program, validateId);
    }
    return fs
      .readFile(path.join(__dirname, '../default-manifest.yml'))
      .then(contents => {
        return yaml.safeLoad(contents.toString());
      });
  });
}

function load(program) {
  const filePath = path.join(program.cwd, FILENAME);

  log.debug('Check for manifest file at %s', filePath);
  return fs
    .exists(filePath)
    .then(exists => {
      if (!exists) {
        throw Error.create(
          'There is no ' +
            chalk.bold(FILENAME) +
            ' file in this directory. ' +
            'First run ' +
            chalk.green.underline('aero create') +
            '.',
          {formatted: true, code: 'missingManifest'}
        );
      }
    })
    .then(() => loadManifestYaml(program));
}

function loadManifestYaml(program, validateId) {
  return fs.readFile(path.join(program.cwd, FILENAME)).then(contents => {
    const yamlString = contents ? contents.toString() : '';

    var appManifest;
    try {
      appManifest = yaml.safeLoad(yamlString) || {};
    } catch (err) {
      throw Error.create(
        'The ' +
          chalk.bold(FILENAME) +
          ' file is not valid yaml.\n' +
          'Try using ' +
          chalk.underline('www.yamllint.com') +
          ' to validate.',
        {formatted: true}
      );
    }

    if (validateId !== false) {
      if (!appManifest.id) {
        throw Error.create(
          'There is no ' +
            chalk.bold('id') +
            ' value in ' +
            chalk.bold(FILENAME) +
            '.\n' +
            'First run ' +
            chalk.underline.green('aero create') +
            '.',
          {formatted: true, code: 'noManifestAppId'}
        );
      }

      appManifest.id = fixGuid(appManifest.id);
    }

    // If there isn't a deploy section, add an empty object.
    if (!_.isObject(appManifest.deploy)) {
      appManifest.deploy = {};
    }

    return appManifest;
  });
}

// Ensure the dashes in the guid are actual dashes and appear in the correct positions.
function fixGuid(str) {
  str = str.replace(/[^a-z0-9]/g, '');
  if (str.length !== 32) {
    throw Error.create('Invalid id property in the aerobatic.yml', {
      code: 'invalidAppId'
    });
  }

  return (
    str.substr(0, 8) +
    '-' +
    str.substr(8, 4) +
    '-' +
    str.substr(12, 4) +
    '-' +
    str.substr(16, 4) +
    '-' +
    str.substr(20, 12)
  );
}

function save(program, appManifest) {
  const ymlString = yaml.dump(appManifest);
  const fileName = path.join(program.cwd, FILENAME);
  log.debug('Save manifest to %s', fileName);
  return fs.writeFile(fileName, ymlString).then(() => null);
}

// Create a new default manifest yml file for the specified appId
function create(program, appId) {
  return fs
    .readFile(path.join(__dirname, '../default-manifest.yml'))
    .then(ymlString => {
      ymlString = ymlString.toString().replace('__appId__', appId);
      return fs
        .writeFile(path.join(program.cwd, FILENAME), ymlString)
        .then(() => null);
    });
}
