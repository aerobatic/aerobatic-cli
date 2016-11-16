const config = require('config');
const express = require('express');
const bodyParser = require('body-parser');

const API_PORT = 1797;
config.apiUrl = 'http://localhost:' + API_PORT;

class MockApi {
  constructor() {
    this.api = express();
  }

  registerRoute(method, path, handler) {
    this.api[method](path, bodyParser.json(), handler);
  }

  start(callback) {
    this.server = this.api.listen(API_PORT, callback);
  }

  stop(callback) {
    this.server.close(callback);
  }
}

module.exports = MockApi;
