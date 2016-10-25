const _ = require('lodash');
// const api = require('./api');
const Promise = require('bluebird');
const userConfig = require('./user-config');
// const parseUrl = require('url').parse;
// const manifest = require('./manifest');
// const inquirer = require('inquirer');

const log = require('winston');

require('simple-errors');

// Initialization routine that runs before any CLI command
module.exports = (program, options) => {
  log.debug('initiliazing CLI');

  options = _.defaults(options || {}, {
    requireAuth: true,
    loadManifest: false,
    loadVirtualApp: false
  });

  var initPromise = loadUserConfig();
  if (options.requireAuth) {
    initPromise = initPromise.then(() => ensureAuthToken());
  }

  // if (options.loadManifest === true) {
  //   initPromises.push(loadManifest);
  // }
  //
  // if (options.loadVirtualApp) {
  //   initPromises.push(loadVirtualApp);
  // }

  log.debug('Run cli initialization promises');
  return initPromise;

  function ensureAuthToken() {
    return new Promise((resolve, reject) => {
      log.debug('Ensure auth token in userConfig');
      if (_.isEmpty(program.userConfig.auth)) {
        return reject(new Error('Command requires you to be authenticated. First run `aero login`'));
      }
      resolve();
    });
  }

  function loadUserConfig() {
    return userConfig.read()
      .then(conf => {
        log.debug('Assign userConfig to program object');
        program.userConfig = conf;
        return null;
      });
  }

  // function loadManifest(cb) {
  //   log.debug('loading virtual app config from package.json');
  //
  //   manifest.load(program, (err, config) => {
  //     if (err) return cb(err);
  //
  //     program.virtualAppManifest = config;
  //     cb();
  //   });
  // }
  //
  // function loadVirtualApp(cb) {
  //   if (!program.virtualAppManifest) return cb();
  //
  //   var appId;
  //   if (program.appId) {
  //     appId = program.appId;
  //   } else if (program.virtualAppManifest) {
  //     appId = program.virtualAppManifest.appId;
  //   } else {
  //     return cb();
  //   }
  //
  //   log.debug('invoking api to fetch the virtual app');
  //   api(program, {method: 'GET', path: '/apps/' + appId}, function(err, app) {
  //     if (err) return cb(err);
  //     if (!app) {
  //       return cb('Application ' + program.virtualAppManifest.appId + ' could not be found.');
  //     }
  //
  //     debug('virtual app loaded from API');
  //     program.virtualApp = app;
  //     cb();
  //   });
  // }
};
