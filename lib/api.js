const request = require('request-promise');
const log = require('winston');
const _ = require('lodash');

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
    }
  });

  if (options.authToken) {
    options.headers['X-Access-Token'] = options.authToken;
  }

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
        log.error('Error response from api: %j', errorMeta, {});

        const message = (response.body && response.body.message) ?
          response.body.message : 'Undefined error from Aerobatic API';
        throw Error.http(response.statusCode, message,
          Object.assign(_.omit(response.body, 'message'), {formatted: true}));
      }

      return response.body;
    });
}
