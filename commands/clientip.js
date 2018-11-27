const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

module.exports = program => {
  // If a value argument is specified, then set clientIP ranges
  if (program.delete === true) {
    return deleteClientIpRange(program);
  }
  if (program.value) {
    return setClientIpRange(program);
  }
};

function setClientIpRange(program) {
  output.blankLine();
  output('Setting allowed client IP ranges to "' + program.value + '"');
  output.blankLine();

  if (!_.isString(program.value)) {
    return Promise.reject(
      Error.create(
        'Must provide comma delimited list of IPs in the --value option',
        {
          formatted: true
        }
      )
    );
  }

  return api
    .put({
      url: urlJoin(
        program.apiUrl,
        `/apps/${program.website.appId}/clientip-range`
      ),
      authToken: program.authToken,
      body: {
        clientIpRange: _.map(program.value.split(','), _.trim)
      }
    })
    .then(() => {
      output(
        chalk.green(
          'Client IP range updated. Only end users whose IP address falls in the range can now access the website.'
        )
      );
      output.blankLine();
    });
}

function deleteClientIpRange(program) {
  return api
    .delete({
      url: urlJoin(
        program.apiUrl,
        `/apps/${program.website.appId}/clientip-range`
      ),
      authToken: program.authToken
    })
    .then(() => {
      output(
        chalk.green(
          'Client IP range deleted. The website is now available to all IP addresses.'
        )
      );
    });
}
