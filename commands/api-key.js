const chalk = require('chalk');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

// Display info about the current application.
module.exports = program => {
  output.blankLine();
  output('Get the account access key');
  output.blankLine();

  return api.get({
    url: urlJoin(program.apiUrl, `/customers/${program.customerId}/api-key`),
    authToken: program.authToken
  })
  .then(resp => {
    output(chalk.dim('Access key:'));
    output(resp.apiKey);
    output.blankLine();

    output('This value can be set as an environment variable named ' + chalk.yellow('AEROBATIC_API_KEY') + '.');
    output('Typically this is used for a non-interactive process such as a CI/CD build.');
    output.blankLine();
  });
};
