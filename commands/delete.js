// const log = require('winston');
// const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const inquirer = require('inquirer');
const output = require('../lib/output');
const api = require('../lib/api');

require('simple-errors');

// Delete the website
module.exports = program => {
  // Seems like commander automatically calls the delete command if -D arg
  // is specified. Ensure that the command "delete" was explicitly typed.
  if (!_.includes(program.rawArgs, 'delete')) return Promise.resolve();

  output('WARNING: Deleting this website will take down ' + program.website.url);
  output.blankLine();

  return inquirer.prompt([
    {
      name: 'name',
      type: 'input',
      message: 'Confirm website name to continue:'
    }
  ])
  .then(answers => {
    if (answers.name !== program.website.name) {
      return Promise.reject(Error.create('Website name does not match', {formatted: true}));
    }

    return api.delete({
      url: urlJoin(program.apiUrl, `/apps/${program.website.appId}`),
      authToken: program.authToken
    }).then(() => {
      output.blankLine();
      output('    Website has been deleted from Aerobatic.');
      if (!_.isEmpty(program.website.subscriptionPlan)) {
        output('    No more subscription charges will be incurred');
      }
      output.blankLine();
    });
  });
};
