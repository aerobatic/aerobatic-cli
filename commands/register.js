const inquirer = require('inquirer');
const urlJoin = require('url-join');
const chalk = require('chalk');
const userConfig = require('../lib/user-config');
const api = require('../lib/api');
const output = require('../lib/output');

module.exports = program => {
  output('Register new Aerobatic account');
  output.blankLine();

  // Prompt for login
  return inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:'
    }, {
      type: 'password',
      name: 'password',
      message: 'Password:'
    }, {
      type: 'input',
      name: 'organization',
      message: 'Organization:'
    }
  ])
  .then(answers => {
    return api.post({
      url: urlJoin(program.apiUrl, '/auth/register'),
      body: answers,
      requireAuth: false
    })
    .then(result => {
      return userConfig.set({
        authToken: result.idToken,
        email: answers.email,
        customerRoles: result.customerRoles
      });
    });
  })
  .then(config => {
    Object.assign(program, config);
    output(chalk.green('Account created'));
    output(chalk.dim('To complete registration, click on the link in the ' +
      'verification email sent to ' + chalk.white.underline(config.email) + '.'));
    return null;
  });
};
