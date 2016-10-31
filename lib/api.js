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
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Error.http(response.statusCode,
          response.body.message, _.omit(response.body, 'message'));
      }
      return response.body;
    });
}

function get(options) {
  return makeRequest('get', options);
}

function post(options) {
  return makeRequest('post', options);
}
