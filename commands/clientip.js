const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const publicIp = require('public-ip');
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

function putValueWithApi(program) {
  return api
    .put({
      url: urlJoin(
        _.compact([
          program.apiUrl,
          `/apps/${program.website.appId}/clientip-range`,
          program.stage
        ])
      ),
      authToken: program.authToken,
      body: {
        clientIpRange: _.map(program.value.split(','), _.trim)
      }
    })
    .then(() => {
      output(
        chalk.green(
          'Client IP range updated to ' +
            program.value +
            '. Only end users whose IP address falls in the range can now access the website.'
        )
      );
      output.blankLine();
    });
}

function setClientIpRange(program) {
  output.blankLine();
  output('Setting allowed client IP ranges to "' + program.value + '"');
  output.blankLine();

  if (!_.isString(program.value)) {
    return Promise.reject(
      Error.create(
        'Must provide comma delimited list of IPs or the value "myip" in the --value option',
        {
          formatted: true
        }
      )
    );
  }

  if (program.value === 'myip') {
    publicIp.v4().then(ip => {
      program.value = ip;
      return putValueWithApi(program);
    });
  } else {
    return putValueWithApi(program);
  }
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
