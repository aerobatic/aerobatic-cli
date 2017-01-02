const _ = require('lodash');
const chalk = require('chalk');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

module.exports = program => {
  // Validate that the domain name is valid.
  if (program.delete === true && _.isString(program.name)) {
    return deleteVersion(program);
  }

  if (_.isString(program.name) && program.stage) {
    return pushVersionToStage(program);
  }

  if (program.delete === true && _.isString(program.stage)) {
    return deleteStage(program);
  }

  return displayVersions(program);
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

function deleteStage(program) {
  output('Delete deploy stage ' + program.stage);

  const urlPath = `apps/${program.website.appId}/versions/deploy/${encodeURIComponent(program.stage)}`;
  return api.delete({
    url: urlJoin(program.apiUrl, urlPath),
    authToken: program.authToken
  })
  .then(() => {
    output('Stage ' + program.stage + ' deleted');
  });
}

function findVersionByName(program) {
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

function displayVersions(program) {
  output.blankLine();
  output('All website versions');
  output.blankLine();

  return listVersions(program)
    .then(versions => {
      const deployedVersions = program.website.deployedVersions;
      const deployedStages = Object.keys(deployedVersions);

      if (versions.length === 0) {
        output('There are no versions right now.');
        output('Deploy a new version with the ' + chalk.green.underline('aero deploy') + ' command.');
      }

      versions.forEach(version => {
        if (!version.metadata) version.metadata = {size: ''};
        process.stdout.write(_.padStart(version.name, 10, ' '));
        process.stdout.write(_.padStart(version.metadata.size, 10, ' '));
        process.stdout.write('    ');
        process.stdout.write(_.padEnd(version.metadata.fileCount ? version.metadata.fileCount + ' files' : '', 12, ' '));
        process.stdout.write(_.padEnd(version.created, 20, ' '));

        // Check if this version is deployed to any stages
        const stagesWhereVersionDeployed = [];
        deployedStages.forEach(stage => {
          if (deployedVersions[stage] === version.versionId) {
            stagesWhereVersionDeployed.push(stage);
          }
        });

        if (stagesWhereVersionDeployed.length > 0) {
          process.stdout.write(chalk.yellow('  <= ' + stagesWhereVersionDeployed.join(', ')));
        }
        process.stdout.write('\n');
      });

      output.blankLine();
    });
}
