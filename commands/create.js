// const log = require('winston');
const chalk = require('chalk');
const path = require('path');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');
const download = require('../lib/download');
const manifest = require('../lib/manifest');

// Command to create a new application
module.exports = program => {
  output.blankLine();
  output('Creating new Aerobatic application in this directory');
  output.blankLine();

  return Promise.resolve()
    .then(() => {
      // if (program.siteName) {
        // Check if name is available.
      // }
      return null;
    })
    .then(() => {
      // If a repo argument was provided then create a new folder to extract
      // the repo contents to.
      if (program.source) {
        return createSourceDirectory(program);
      }
      return null;
    })
    .then(() => manifest.loadSafe(program))
    .then(appManifest => {
      return createWebsite(program)
        .then(website => ({website, appManifest}));
    })
    .then(params => {
      params.appManifest.id = params.website.appId;

      return manifest.save(program, params.appManifest).then(() => {
        output.blankLine();
        output('Website ' + chalk.yellow.underline(params.website.url) + ' created.');
        if (program.source) {
          output('To deploy your first version, run ' +
            chalk.underline.green('cd ' + program.siteName) +
            ' then ' + chalk.underline.green('aero deploy') + '.');
        } else {
          output('To deploy your first version, run ' + chalk.underline.green('aero deploy') + '.');
        }

        output.blankLine();
      });
    });
};

// Invoke the API to create the website
function createWebsite(program) {
  return api.post({
    url: urlJoin(program.apiUrl, '/apps'),
    authToken: program.authToken,
    body: {
      customerId: program.customerId,
      name: program.siteName
    }
  })
  .catch(error => {
    switch (error.code) {
      case 'invalidAppName':
        throw Error.create('Website name is invalid. Must be url-friendly string consisting only of numbers, lowercase letters, and dashes.', {formatted: true});
      case 'appNameUnavailable':
        throw Error.create('The website name ' + program.siteName + ' is already taken. Please try a different name.', {formatted: true});
      default:
        throw error;
    }
  });
}

function createSourceDirectory(program) {
  return Promise.resolve().then(() => {
    if (!program.siteName) {
      return getRandomSiteName(program)
        .then(siteName => {
          program.siteName = siteName;
          return;
        });
    }
    return;
  })
  .then(() => {
    program.cwd = path.join(program.cwd, program.siteName);
    output('    ' + chalk.dim('Downloading source archive ' + program.source));
    return download(program.source, program.cwd);
  });
}

function getRandomSiteName(program) {
  const opts = {
    url: urlJoin(program.apiUrl, '/apps/random-name'),
    authToken: program.authToken
  };
  return api.get(opts).then(result => result.name);
}
