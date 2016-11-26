const assert = require('assert');
const os = require('os');
const path = require('path');
const uuid = require('node-uuid');
const fs = require('fs-promise');
const log = require('winston');
const rimraf = require('rimraf');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('sinon-chai'));
const express = require('express');
const bodyParser = require('body-parser');
const manifest = require('../../lib/manifest');

const API_PORT = 1797;
const FILE_PORT = 1798;

log.level = 'debug';
const createCommand = require('../../commands/create');

require('dash-assert');

describe('create command', () => {
  var apiServer;
  var fileServer;
  var program;
  var apiPostHandler;
  var apiGetRandomName;
  var downloadFileHandler;
  const customerId = uuid.v4();

  before(done => {
    const api = express();

    api.post('/apps', [bodyParser.json()], (req, res, next) => {
      apiPostHandler(req, res, next);
    });

    api.get('/apps/random-name', (req, res) => {
      apiGetRandomName(req, res);
    });

    apiServer = api.listen(API_PORT, done);
  });

  before(done => {
    const fileApp = express();

    fileApp.get('/html5-template', (req, res) => {
      downloadFileHandler(req, res);
    });

    fileServer = fileApp.listen(FILE_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  after(done => {
    fileServer.close(done);
  });

  beforeEach(() => {
    program = {
      cwd: path.join(os.tmpdir(), Date.now().toString()),
      customerId,
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434'
    };

    apiPostHandler = sinon.spy((req, res) => {
      res.json(req.body);
    });

    return fs.emptyDir(program.cwd);
  });

  afterEach(done => {
    return rimraf(program.cwd, done);
  });

  it('invokes api post endpoint', () => {
    return createCommand(program)
      .then(() => {
        assert.isTrue(apiPostHandler.calledWith(sinon.match({
          body: {customerId}
        })));

        return;
      });
  });

  it('creates app from a source zip download', () => {
    const randomName = Date.now().toString();
    apiGetRandomName = sinon.spy((req, res) => res.json({name: randomName}));
    downloadFileHandler = sinon.spy((req, res) => {
      res.sendFile(path.join(__dirname, '../fixtures/html5-template.zip'));
    });

    program.source = 'http://localhost:' + FILE_PORT + '/html5-template';
    return createCommand(program)
      .then(() => {
        expect(apiGetRandomName).to.have.been.called;
        expect(downloadFileHandler).to.have.been.called;

        expect(fs.existsSync(path.join(program.cwd, manifest.fileName))).to.be.true;
        expect(fs.existsSync(path.join(program.cwd, 'index.html'))).to.be.true;
      });
  });

  // it('catches invalidAppName', () => {
  //   const appName = 'test-app';
  //   apiPostHandler = sinon.spy((req, res) => {
  //     res.status(400).json({code: 'invalidAppName'});
  //   });
  //
  //   return createCommand(Object.assign(program, {appName}))
  //     .catch(err => {
  //       assert.isTrue(/^App name is invalid/.test(err.message));
  //       return;
  //     });
  // });

  // it('catches invalidAppName', () => {
  //   const appName = 'test-app';
  //   apiPostHandler = sinon.spy((req, res) => {
  //     res.status(400).json({code: 'appNameUnavailable'});
  //   });
  //
  //   return createCommand(Object.assign(program, {appName}))
  //     .catch(err => {
  //       assert.isTrue(/is already taken/.test(err.message));
  //       return;
  //     });
  // });
});
