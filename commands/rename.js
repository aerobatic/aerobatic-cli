// const log = require('winston');
const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

require('simple-errors');

const NAME_REGEX = /^[a-z0-9-]{3,50}$/;

// Rename the website
module.exports = program => {
  if (_.isEmpty(program.name)) {
    throw Error.create('Missing -n or --name option value', {formatted: true});
  }

  // Do some initial validation of the website name
  if (!NAME_REGEX.test(program.name)) {
    throw Error.create(
      'Name must be URL friendly consisting only of numbers, ' +
        'lowercase letters, and dashes.',
      {formatted: true}
    );
  }

  const postData = {
    name: program.name,
    customerId: program.customerId
  };

  return api
    .put({
      url: urlJoin(program.apiUrl, `/apps/${program.website.appId}`),
      body: postData,
      authToken: program.authToken
    })
    .then(updatedWebsite => {
      // TODO: Only display the new url if it's not using a custom domain
      output('   Website name updated.');
      if (!updatedWebsite.domainName) {
        output(
          '   The new url is ' + chalk.yellow.underline(updatedWebsite.url)
        );
      }
    })
    .catch(err => {
      if (err.code === 'appNameUnavailable') {
        throw Error.create(
          'Website name ' + program.name + ' is not available.',
          {formatted: true}
        );
      }
      throw err;
    });
};
