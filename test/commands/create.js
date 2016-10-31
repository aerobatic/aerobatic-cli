const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs-promise');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const manifest = require('../../lib/manifest');

const API_PORT = 1797;

const createCommand = require('../../commands/create');

require('dash-assert');

describe('create command', () => {
  var apiServer;
  var program;
  var apiPostHandler;

  before(done => {
    const api = express();

    api.post('/apps', [bodyParser.json()], (req, res, next) => {
      apiPostHandler(req, res, next);
    });

    apiServer = api.listen(API_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  beforeEach(() => {
    program = {
      cwd: os.tmpdir(),
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434'
    };

    return fs.removeSync(path.join(os.tmpdir(), manifest.fileName));
  });

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
