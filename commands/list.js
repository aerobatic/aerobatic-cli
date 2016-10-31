const log = require('winston');
const _ = require('lodash');
const urlJoin = require('url-join');
const api = require('../lib/api');

// Command to create a new application
module.exports = program => {
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
    url: urlJoin(program.apiUrl, `/customers/${customerId}/apps`),
    authToken: program.authToken
  })
  .then(apps => {
    apps.forEach(app => {
      process.stdout.write(_.padEnd(app.name, 25, ' '));
      process.stdout.write(_.padEnd(app.url, 40, ' '));
      process.stdout.write(_.padEnd(app.paidPlan ? 'PROD' : 'DEV'));
      process.stdout.write('\n');
    });
  });
};
