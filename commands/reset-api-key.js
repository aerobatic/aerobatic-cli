const chalk = require('chalk');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

// Display info about the current application.
module.exports = program => {
  output.blankLine();
  output('Resetting your account\'s api key.');
  output.blankLine();

  return api.post({
    url: urlJoin(program.apiUrl, `/customers/${program.customerId}/api-key`),
    authToken: program.authToken
  })
  .then(resp => {
    output(chalk.dim('New api key:'));
    output(resp.apiKey);
    output.blankLine();

    output('You should update any ' + chalk.yellow('AEROBATIC_API_KEY') + ' environment variables to this new value.');
    output.blankLine();
  });
};
