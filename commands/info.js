const log = require('winston');
const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');
const urls = require('../lib/urls');

// Display info about the current application.
module.exports = program => {
  output.blankLine();
  output(chalk.dim('Name:'));
  output('    ' + program.website.name);

  output.blankLine();
  output(chalk.dim('Website ID:'));
  output('    ' + program.website.appId);

  output.blankLine();
  output(chalk.dim('Account ID:'));
  output('    ' + program.website.customerId);

  // Display the URLs of all deployed stages
  output.blankLine();
  output(chalk.dim('URLs:'));
  const stages = Object.keys(program.website.urls);
  stages.forEach(stage => {
    output('    ' + _.padEnd(stage, 15, ' ') + ' => ' +
      chalk.underline.yellow(program.website.urls[stage]));
  });

  // TODO: Display bandwidth quota and MTD usage
  output.blankLine();
  output(chalk.dim('Plan:'));
  if (!program.website.subscriptionPlan) {
    output('   FREE. Upgrade to a paid plan in order to add a custom domain.');
    output('   ' + chalk.yellow(urls.upgradeWebsite(program.website)));
    output.blankLine();
  } else {
    output('   Paid subscripton');
  }
  output.blankLine();

  log.debug('List versions for website %s', program.website.name);
  return api.get({
    url: urlJoin(program.apiUrl, `/apps/${program.website.appId}/versions`),
    authToken: program.authToken
  })
  .then(versions => {
    const deployedVersions = program.website.deployedVersions;
    const deployedStages = Object.keys(deployedVersions);

    output(chalk.dim('Versions:'));

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
        process.stdout.write('  <= ' + stagesWhereVersionDeployed.join(', '));
      }
      process.stdout.write('\n');
    });

    output.blankLine();
  });
};
