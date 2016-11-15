const log = require('winston');
const _ = require('lodash');
const urlJoin = require('url-join');
const api = require('../lib/api');
const output = require('../lib/output');
const chalk = require('chalk');

// Command to create a new application
module.exports = program => {
  output.blankLine();

  var customerId = program.customerId;
  if (!customerId && _.isObject(program.customerRoles)) {
    const customerIds = Object.keys(program.customerRoles);
    if (customerIds.length > 0) {
      customerId = customerIds[0];
    }
  }

  if (!customerId) {
    throw new Error('No customerId context available. Run `aero accounts` to see a list of available accounts.');
  }

  log.debug('List applications for customer %s', customerId);
  return api.get({
    url: urlJoin(program.apiUrl, `/customers/${customerId}`),
    authToken: program.authToken
  })
  .then(customer => {
    output('Details for account ' + chalk.underline.bold(customer.name));
    output.blankLine();

    return api.get({
      url: urlJoin(program.apiUrl, `/customers/${customerId}/apps`),
      authToken: program.authToken
    });
  })
  .then(apps => {
    output(chalk.dim('Apps:'));
    output.blankLine();

    if (apps.length === 0) {
      output('You don\'t have any apps yet.');
      output('Run ' + chalk.green.underline('aero create') + ' in the root of your project directory.');
    } else {
      apps.forEach(app => {
        process.stdout.write(_.padEnd(app.name, 25, ' '));
        process.stdout.write(_.padEnd(app.url, 40, ' '));
        process.stdout.write(_.padEnd(app.paidPlan ? 'PAID' : 'TRIAL'));
        process.stdout.write('\n');
      });
    }

    output.blankLine();
  });
};
