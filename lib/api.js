const request = require('request-promise');
const log = require('winston');
const _ = require('lodash');

require('simple-errors');

module.exports = {
  get,
  post,
  // del,
  // put
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
    resolveWithFullResponse: true
  });

  if (options.authToken) {
    options.headers = {
      'X-Access-Token': options.authToken
    };
  }

  return request(options)
    .then(response => {
      const isJsonResponse = /^application\/json/.test(response.headers['content-type']);
      if (!isJsonResponse) {
        log.debug('Content-Type of API response is not application/json');
        throw Error.http(406, 'Did not get back JSON from the API');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Error.http(response.statusCode,
          response.body.message, _.omit(response.body, 'message'));
      }

      log.debug('api response: ' + JSON.stringify(response.body));
      return response.body;
    });
}

function get(options) {
  return makeRequest('get', options);
}

function post(options) {
  return makeRequest('post', options);
}
