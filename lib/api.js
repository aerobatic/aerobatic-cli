const request = require('request-promise');
const urlJoin = require('url-join');
const _ = require('lodash');
const baseUrl = 'http://localhost:9000';

module.exports = {
  get,
  post,
  // del,
  // put
};

function makeRequest(method, options) {
  if (_.isString(options)) {
    options = {url: options};
  } else {
    options.url = urlJoin(baseUrl, options.url);
  }

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
