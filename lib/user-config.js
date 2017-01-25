const fs = require('fs-promise');
const config = require('config');
const osenv = require('osenv');
const path = require('path');
const yaml = require('js-yaml');
const log = require('winston');

const CONFIG_FILE = path.join(osenv.home(), config.userConfigFile);

var _config;

module.exports.initialize = () => {
  read().then(userConfig => {
    _config = userConfig;
    return;
  });
};

module.exports.read = read;

module.exports.get = key => {
  log.debug('Get key %s from config', key);
  if (!_config) throw new Error('User config has not been initialized.');

  return read()
    .then(userConfig => {
      return userConfig[key];
    });
};

module.exports.set = values => {
  log.debug('Setting keys %s in config', Object.keys(values));
  return read()
    .then(userConfig => {
      Object.assign(userConfig, values);
      return userConfig;
    })
    .then(userConfig => {
      return fs.writeFile(CONFIG_FILE, yaml.safeDump(userConfig))
        .then(() => userConfig);
    });
};

function read() {
  log.debug('Reading config file %s', CONFIG_FILE);
  return fs.ensureFile(CONFIG_FILE)
    .then(() => {
      return fs.readFile(CONFIG_FILE)
        .then(contents => {
          return contents ? contents.toString() : '';
        });
    })
    .then(contents => {
      var userConfig;
      try {
        userConfig = yaml.safeLoad(contents) || {};
      } catch (err) {
        userConfig = {};
      }

      return userConfig;
    });
}
