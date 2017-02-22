const request = require('request-promise');
const log = require('winston');
const _ = require('lodash');
const retry = require('bluebird-retry');

require('simple-errors');

module.exports.get = options => {
  return makeRequest('get', options);
};

module.exports.post = options => {
  return makeRequest('post', options);
};

module.exports.put = options => {
  return makeRequest('put', options);
};

module.exports.delete = options => {
  return makeRequest('delete', options);
};

function makeRequest(method, options) {
  if (_.isString(options)) {
    options = {url: options};
  }

  log.debug('making API call to %s', options.url);

  Object.assign(options, {
    method,
    json: true,
    simple: false,
    resolveWithFullResponse: true,
    headers: {
      // Send the local timezone offset
      'X-UTC-Offset': new Date().getTimezoneOffset()
    },
    timeout: options.timeout || 10000
  });

  if (options.authToken) {
    options.headers['X-Access-Token'] = options.authToken;
  }

  log.debug('Making API call with options: %j', options);

  return retry(() => executeRequest(options), {
    max_tries: options.maxTries || 4,
    interval: 200,
    throw_original: true,
    predicate: err => err.retryable
  });
}

function executeRequest(options) {
  return request(options)
    .then(response => {
      if (response.statusCode === 204) {
        return null;
      }

      const isJsonResponse = /^application\/json/.test(response.headers['content-type']);
      if (!isJsonResponse) {
        log.debug('Content-Type of API response is not application/json');
        throw Error.http(406, 'Did not get back JSON from the API');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errorMeta = response.body || {};
        errorMeta.statusCode = response.statusCode;
        errorMeta.headers = response.headers;

        log.error('Error response from api: %j', errorMeta, {});

        const message = (response.body && response.body.message) ?
          response.body.message : 'Undefined error from Aerobatic API';

        // Retry the request if error message is 'Internal server error'
        const retryable = (
          response.body.code === 'EAI_AGAIN' ||
          message === 'Internal server error'
        );

        throw Error.http(response.statusCode, message,
          Object.assign(_.omit(response.body, 'message'), {formatted: true, retryable}));
      }

      return response.body;
    })
    .catch(err => {
      if (/ESOCKETTIMEDOUT/.test(err.message)) {
        throw Error.create('Aerobatic API timeout', {formatted: true, retryable: true});
      }
      throw err;
    });
}
