const _ = require('lodash');
const chalk = require('chalk');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

module.exports = program => {
  // Validate that the domain name is valid.
  if (program.delete === true) {
    return deleteVersion(program);
  }

  if (_.isString(program.name) && program.stage) {
    return pushVersionToStage(program);
  }
};

function deleteVersion(program) {
  return findVersionByName(program)
    .then(version => {
      output('    Deleting version ' + version.versionNum);
      return api.delete({
        url: urlJoin(program.apiUrl, `apps/${program.website.appId}/versions/${version.versionId}`),
        authToken: program.authToken
      })
      .then(() => version);
    })
    .then(version => {
      output('Version ' + version.versionNum + ' deleted');
      return null;
    });
}

function pushVersionToStage(program) {
  return findVersionByName(program)
    .then(version => {
      output('Pushing version ' + version.versionNum + ' to stage ' + program.stage);
      const urlPath = `apps/${program.website.appId}/versions/${version.versionId}/deploy/${encodeURIComponent(program.stage)}`;
      return api.post({
        url: urlJoin(program.apiUrl, urlPath),
        authToken: program.authToken
      })
      .then(updatedApp => {
        output('Version ' + version.versionNum + ' now deployed to stage ' + program.stage);
        output('View now at ' + chalk.underline.yellow(updatedApp.urls[program.stage]));
      });
    });
}

function findVersionByName(program) {
  if (!_.isString(program.name)) {
    return Promise.reject(Error.create('Must specify --name arg specifying ' +
      'which version to delete', {formatted: true}));
  }

  var versionNum = program.name;
  if (_.startsWith(versionNum, 'v')) {
    versionNum = versionNum.substr(1);
  }

  versionNum = parseInt(versionNum, 10);
  if (_.isNaN(versionNum)) {
    return Promise.reject(Error.create('Invalid --name argument', {formatted: true}));
  }

  return listVersions(program)
    .then(versions => {
      var version = _.find(versions, {versionNum});
      if (!version) {
        throw Error.create('Invalid version number ' + versionNum, {formatted: true});
      }
      return version;
    });
}

function listVersions(program) {
  const url = urlJoin(program.apiUrl, `apps/${program.website.appId}/versions`);
  return api.get({url, authToken: program.authToken});
}
