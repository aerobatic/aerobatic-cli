const log = require('winston');
const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

// Display info about the current application.
module.exports = program => {
  output.blankLine();
  output('Information about application ' + chalk.white.bold(program.virtualApp.name));
  output.blankLine();

  // Display the URLs of all deployed stages
  const stages = Object.keys(program.virtualApp.urls);
  stages.forEach(stage => {
    output('    ' + _.padStart(stage, 15, ' ') + ' => ' +
      chalk.underline.yellow(program.virtualApp.urls[stage]));
  });

  output.blankLine();

  if (!program.virtualApp.paidPlan) {
    output('This app is in TRIAL mode. Upgrade to a paid plan in order to add a custom domain.');
    output(chalk.underline.yellow(`https://portal.aerobatic.com/${program.virtualApp.customerId}/${program.virtualApp.name}/upgrade`));
    output.blankLine();
  }

  log.debug('List versions for appplication %s', program.virtualApp.name);
  return api.get({
    url: urlJoin(program.apiUrl, `/apps/${program.virtualApp.appId}/versions`),
    authToken: program.authToken
  })
  .then(versions => {
    const deployedVersions = program.virtualApp.deployedVersions;
    const deployedStages = Object.keys(deployedVersions);

    output(chalk.dim('Versions:'));
    output.blankLine();

    if (versions.length === 0) {
      output('There are no versions right now.');
      output('Deploy a new version with the ' + chalk.green.underline('aero deploy') + ' command.');
    }

    versions.forEach(version => {
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
        process.stdout.write('  <= ' + stagesWhereVersionDeployed.join(', '));
      }
      process.stdout.write('\n');
    });

    output.blankLine();
  });
};
