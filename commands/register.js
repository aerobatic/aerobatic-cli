const inquirer = require('inquirer');
const urlJoin = require('url-join');
const chalk = require('chalk');
const userConfig = require('../lib/user-config');
const api = require('../lib/api');
const output = require('../lib/output');

const PASSWORD_REGEXES = [/[a-z]+/, /[A-Z]+/, /[0-9]+/];

module.exports = program => {
  output.blankLine();
  output('Welcome to Aerobatic premium static hosting');
  output('Register new account');
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
      message: 'Password:',
      validate: input => {
        if (input.length < 8) return 'Password must be at least 8 characters long';
        if (PASSWORD_REGEXES.some(re => !re.test(input))) {
          return 'Password must contain a lowercase letter, uppercase letter, and number.';
        }
        return true;
      }
    }, {
      type: 'input',
      name: 'customerName',
      message: 'Organization:'
    }
  ])
  .then(answers => {
    return api.post({
      url: urlJoin(program.apiUrl, '/auth/register'),
      body: answers,
      requireAuth: false
    })
    .then(() => {
      return userConfig.set({
        email: answers.email
      });
    });
  })
  .then(config => {
    Object.assign(program, config);
    output.blankLine();
    output(chalk.green('Account created'));
    output('To complete registration, click on the link in the ' +
      'verification email sent to ' + chalk.white.underline(config.email) + '.');
    output.blankLine();
    return null;
  });
};
