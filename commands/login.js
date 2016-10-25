const log = require('winston');
const inquirer = require('inquirer');
const userConfig = require('../lib/user-config');
const api = require('../lib/api');

module.exports = program => {
  log.debug('Running the login command');

  // Prompt for login
  inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      default: program.userConfig.email,
      message: 'Email:'
    }, {
      type: 'password',
      name: 'password',
      message: 'Password:'
    }
  ])
  .then(answers => {
    return api.post({
      url: '/auth/login',
      body: {email: answers.email, password: answers.password},
      requireAuth: false
    })
    .then(result => {
      return userConfig.set({
        auth: result.idToken,
        email: answers.email,
        customerRoles: result.customerRoles
      });
    });
  })
  .then(config => {
    program.userConfig = config;
    log.info('Successfully logged in');
    return null;
  });
};
