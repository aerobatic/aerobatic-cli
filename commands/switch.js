// Command to switch the current account.
// const log = require('winston');
const inquirer = require('inquirer');
const _ = require('lodash');
const urlJoin = require('url-join');
const chalk = require('chalk');

const api = require('../lib/api');
const output = require('../lib/output');
const userConfig = require('../lib/user-config');

// Command to create a new application
module.exports = program => {
  return api.get({
    url: urlJoin(program.apiUrl, '/customers'),
    authToken: program.authToken
  })
  .then(customers => {
    output.blankLine();

    return inquirer.prompt([
      {
        name: 'customerId',
        type: 'list',
        message: 'Select active Aerobatic account:',
        choices: customers.map(customer => {
          return {
            name: _.padEnd(customer.name, 30, ' ') +
              _.padEnd(customer.customerType, 15, ' ') +
              chalk.dim(customer.customerId),
            value: customer.customerId
          };
        }),
        default: program.customerId,
      }
    ])
    .then(answers => {
      return userConfig.set(answers)
        .then(() => {
          output.blankLine();
          output('    Account is now set to ' + chalk.bold(_.find(customers, answers).name));
          output.blankLine();
        });
    });
  });
};
