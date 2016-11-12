// const log = require('winston');
const chalk = require('chalk');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');
const manifest = require('../lib/manifest');

// Command to create a new application
module.exports = program => {
  output.blankLine();
  output('Creating new Aerobatic application in this directory');
  output.blankLine();

  return manifest.loadSafe(program)
    .then(appManifest => {
      return api.post({
        url: urlJoin(program.apiUrl, '/apps'),
        authToken: program.authToken,
        body: {
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
      }).then(virtualApp => ({virtualApp, appManifest}));
    })
    .then(params => {
      params.appManifest.appId = params.virtualApp.appId;

      return manifest.save(program, params.appManifest).then(() => {
        output.blankLine();
        output('Application ' + chalk.underline(params.virtualApp.url) + ' created.');
        output('To deploy your first version, run ' + chalk.underline.green('aero deploy') + '.');
        output.blankLine();
      });
    });
};
