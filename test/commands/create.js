const assert = require('assert');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');

const API_PORT = 1797;
process.env.AERO_API_URL = `http://localhost:${API_PORT}`;

const createCommand = require('../../commands/create');

require('dash-assert');

describe('create command', () => {
  var api;
  var program;
  var apiPostHandler;

  before(done => {
    api = express();

    api.post('/apps', [bodyParser.json()], (req, res, next) => {
      apiPostHandler(req, res, next);
    });

    api.listen(API_PORT, done);
  });

  beforeEach(() => {
    program = {
      userConfig: {
        authToken: '23434'
      }
    };
  });

  // afterEach(function() {
  // });

  it('invokes api post endpoint', () => {
    const appName = 'test-app';
    apiPostHandler = sinon.spy((req, res) => {
      res.json(req.body);
    });

    return createCommand(Object.assign(program, {appName}))
      .then(() => {
        assert.isTrue(apiPostHandler.calledWith(sinon.match({
          body: {name: appName}
        })));

        return;
      });
  });

  it('catches invalidAppName', () => {
    const appName = 'test-app';
    apiPostHandler = sinon.spy((req, res) => {
      res.status(400).json({code: 'invalidAppName'});
    });

    return createCommand(Object.assign(program, {appName}))
      .catch(err => {
        assert.isTrue(/^App name is invalid/.test(err.message));
        return;
      });
  });

  it('catches invalidAppName', () => {
    const appName = 'test-app';
    apiPostHandler = sinon.spy((req, res) => {
      res.status(400).json({code: 'appNameUnavailable'});
    });

    return createCommand(Object.assign(program, {appName}))
      .catch(err => {
        assert.isTrue(/is already taken/.test(err.message));
        return;
      });
  });
});
