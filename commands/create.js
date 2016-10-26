const log = require('winston');
const api = require('../lib/api');
const manifest = require('../lib/manifest');

// Command to create a new application
module.exports = program => {
  log.debug('Create application %s', program.appName);
  return manifest.ensureNotExists(program)
    .then(() => {
      return api.post({
        url: '/apps',
        authToken: program.userConfig.auth,
        body: {
          name: program.appName,
          customerId: program.customerId
        }
      })
      .catch(error => {
        switch (error.code) {
          case 'invalidAppName':
            throw new Error('App name is invalid. Must be url-friendly string consisting only of numbers, lowercase letters, and dashes.');
          case 'appNameUnavailable':
            throw new Error('The app name ' + program.appName + ' is already taken. Please try a different name.');
          default:
            throw error;
        }
      });
    })
    .then(virtualApp => {
      // Write the appId to the manifest
      return manifest.create(program, virtualApp.appId)
        .then(() => {
          log.info('Application %s created successfully', virtualApp.name);
        });
    });
};
