const urlJoin = require('url-join');
const chalk = require('chalk');

const api = require('../lib/api');
const output = require('../lib/output');

module.exports = program => {
  return api
    .post({
      url: urlJoin(program.apiUrl, '/validate'),
      authToken: program.authToken,
      body: {manifest: program.appManifest}
    })
    .then(() => {
      output.blankLine();
      output('     ' + chalk.green('The aerobatic.yml is valid'));
    })
    .catch(err => {
      if (err.code === 'invalidManifest') {
        output.blankLine();
        output(
          '     ' + chalk.red('The aerobatic.yml has the following errors:')
        );
        output.blankLine();
        err.errors.forEach(message => {
          output('     * ' + chalk.dim(message));
        });
        output.blankLine();
        process.exit(1);
      } else {
        throw err;
      }
    });
};
