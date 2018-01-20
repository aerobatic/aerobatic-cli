const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const fileSize = require('filesize');
const output = require('../lib/output');
const api = require('../lib/api');
const urls = require('../lib/urls');
const commaNumber = require('comma-number');

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
    output(
      '    ' +
        _.padEnd(stage, 15, ' ') +
        ' => ' +
        chalk.underline.yellow(program.website.urls[stage])
    );
  });

  output.blankLine();
  output(chalk.dim('Plan:'));
  if (!program.website.subscriptionPlan) {
    if (_.isNumber(program.website.trialEnd)) {
      if (program.website.trialEnd < Date.now()) {
        output('   ' + chalk.bold('Trial over!'));
        output('   Upgrade to the Pro plan to reactivate your site.');
        output('   ' + chalk.yellow(urls.upgradeWebsite(program.website)));
      } else {
        const daysTillTrialEnds = Math.floor(
          (Date.now() - program.website.trialEnd) / 86400000
        );
        if (daysTillTrialEnds === 0) {
          output('   Trial ends ' + chalk.bold('today!'));
          output('   Upgrade to the Pro plan to keep your site active');
          output('   ' + chalk.yellow(urls.upgradeWebsite(program.website)));
        } else {
          output(
            '   Trial ends in ' +
              chalk.bold(
                daysTillTrialEnds + ' day' + (daysTillTrialEnds > 1 ? 's' : '')
              )
          );
          output('   Upgrade to the Pro plan in order to add a custom domain');
          output('   ' + chalk.yellow(urls.upgradeWebsite(program.website)));
        }
      }
    } else {
      output('   Trial');
      output('   Upgrade to the Pro plan in order to add a custom domain');
      output('   ' + chalk.yellow(urls.upgradeWebsite(program.website)));
      output.blankLine();
    }
  } else {
    output('   Pro plan');
  }

  return displayUsage(program);
};

function displayUsage(program) {
  return api
    .get({
      url: urlJoin(program.apiUrl, `/apps/${program.website.appId}/usage`),
      authToken: program.authToken
    })
    .then(usage => {
      output.blankLine();
      output(chalk.dim('Usage:'));
      output(
        '      Day: ' +
          fileSize(usage.day.bytesOut) +
          ' data out | ' +
          commaNumber(usage.day.requestCount) +
          ' requests'
      );
      output(
        '    Month: ' +
          fileSize(usage.month.bytesOut) +
          ' data out | ' +
          commaNumber(usage.month.requestCount) +
          ' requests'
      );
      if (_.isEmpty(program.website.subscriptionPlan)) {
        output(
          '    Quota: ' +
            usage.day.bytesOutPercentUsed +
            '% of ' +
            fileSize(usage.day.bytesOutQuota) +
            ' daily data transfer used'
        );
      } else {
        output(
          '    Quota: ' +
            usage.month.bytesOutPercentUsed +
            '% of ' +
            fileSize(usage.month.bytesOutQuota) +
            ' monthly data transfer used'
        );
      }
      output.blankLine();
    });
}
