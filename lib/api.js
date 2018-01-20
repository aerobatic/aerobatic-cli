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

module.exports.head = options => {
  return makeRequest('head', options);
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
    timeout: options.timeout || 9000
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

      const isJsonResponse = /^application\/json/.test(
        response.headers['content-type']
      );
      if (!isJsonResponse) {
        log.debug('Content-Type of API response is not application/json');
        throw Error.http(406, 'Did not get back JSON from the API');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errorMeta = response.body || {};
        errorMeta.statusCode = response.statusCode;
        errorMeta.headers = response.headers;

        log.error('Error response from api: %j', errorMeta, {});

        const message =
          response.body && response.body.message
            ? response.body.message
            : 'Undefined error from Aerobatic API';

        // Retry the request if error message is 'Internal server error'
        const retryable = isErrorRetryable(options, response, message);
        throw Error.http(
          response.statusCode,
          message,
          Object.assign(_.omit(response.body, 'message'), {
            formatted: true,
            retryable
          })
        );
      }

      return response.body;
    })
    .catch(err => {
      if (/ESOCKETTIMEDOUT|ETIMEDOUT/.test(err.message)) {
        log.debug('Api call timed out, will retry');
        throw Error.create('Aerobatic API timeout', {
          formatted: true,
          retryable: true
        });
      }
      throw err;
    });
}

function isErrorRetryable(options, response, message) {
  // Don't retry GET and HEAD requests
  // if (!_.includes(['get', 'head'])) return false;
  if (_.isObject(response.body) && response.body.code === 'EAI_AGAIN') {
    return true;
  }
  if (message === 'Internal server error') return true;
  return false;
}
