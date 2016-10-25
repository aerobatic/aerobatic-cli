const fs = require('fs-promise');
const osenv = require('osenv');
const path = require('path');
const yaml = require('js-yaml');
const log = require('winston');

const CONFIG_FILE = path.join(osenv.home(), 'aerorc.yml');

module.exports = {
  read,
  get,
  set
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
      var config;
      try {
        config = yaml.safeLoad(contents) || {};
      } catch (err) {
        config = {};
      }

      return config;
    });
}

function get(key) {
  log.debug('Get key %s from config', key);
  return read()
    .then(config => {
      return config[key];
    });
}

function set(values) {
  log.debug('Setting keys %s in config', Object.keys(values));
  return read()
    .then(config => {
      Object.assign(config, values);
      return config;
    })
    .then(config => {
      return fs.writeFile(CONFIG_FILE, yaml.safeDump(config))
        .then(() => config);
    });
}
