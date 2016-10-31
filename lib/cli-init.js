const _ = require('lodash');
const urlJoin = require('url-join');
const api = require('./api');
const Promise = require('bluebird');
const config = require('config');
const userConfig = require('./user-config');
const manifest = require('./manifest');

const log = require('winston');

require('simple-errors');

// Initialization routine that runs before any CLI command
module.exports = (program, options) => {
  log.debug('initiliazing CLI');

  _.defaults(program, {
    cwd: process.cwd(),
    customerId: process.env.AERO_CUSTOMER,
    subCommand: (options || {}).subCommand
  });

  // Map all the settings in config to the program object
  _.assign(program, config);

  options = _.defaults(options || {}, {
    requireAuth: true,
    loadManifest: false,
    loadVirtualApp: false
  });

  // The appManifest has to be loaded in order to load the application
  // since that's where the appId is gotten from.
  if (options.loadVirtualApp) {
    options.loadManifest = true;
    options.requireAuth = true;
  }

  var initPromise = userConfig.read().then(conf => {
    log.debug('Assign userConfig to program object');
    _.assign(program, conf);
    // program.userConfig = conf;
    return;
  });

  if (options.requireAuth) {
    initPromise = initPromise.then(() => {
      return new Promise((resolve, reject) => {
        log.debug('Ensure auth token in userConfig');
        if (_.isEmpty(program.authToken)) {
          return reject(new Error('Command requires you to be authenticated. First run `aero login`'));
        }
        resolve();
      });
    });
  }

  if (options.loadManifest === true) {
    initPromise = initPromise.then(() => {
      return manifest.load(program)
        .then(appManifest => {
          program.appManifest = appManifest;
          return;
        });
    });
  }

  if (options.loadVirtualApp === true) {
    initPromise = initPromise.then(() => {
      const requestOptions = {
        url: urlJoin(program.apiUrl, `/apps/${program.appManifest.appId}`),
        authToken: program.auth
      };

      log.debug('Invoke API to fetch application %s', program.appManifest.appId);
      return api.get(requestOptions)
        .then(virtualApp => {
          program.virtualApp = virtualApp;
          return;
        });
    });
  }

  log.debug('Run cli initialization promises');
  return initPromise;
};
