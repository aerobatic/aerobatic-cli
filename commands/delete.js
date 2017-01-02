// const log = require('winston');
// const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const inquirer = require('inquirer');
const output = require('../lib/output');
const api = require('../lib/api');

require('simple-errors');

// Rename the website
module.exports = program => {
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
