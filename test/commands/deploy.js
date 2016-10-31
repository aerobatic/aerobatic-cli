const assert = require('assert');
const path = require('path');
const log = require('winston');
const _ = require('lodash');
const config = require('config');
const uuid = require('node-uuid');
const sinon = require('sinon');
const manifest = require('../../lib/manifest');
const express = require('express');
const fs = require('fs-promise');
const bodyParser = require('body-parser');

const API_PORT = 1797;

log.level = 'debug';

require('dash-assert');

describe('deploy command', () => {
  var api;
  var apiServer;
  var program;
  var customerId;
  var deployCommand;
  var mockUploader;
  var apiHandlers = {};

  before(done => {
    api = express();

    api.use(bodyParser.json());
    api.get('/customers/:customerId/deploy-creds', (req, res, next) => {
      apiHandlers.getDeployCreds(req, res, next);
    });

    api.post('/apps/:appId/versions', (req, res, next) => {
      apiHandlers.postVersionHandler(req, res, next);
    });

    apiServer = api.listen(API_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  beforeEach(() => {
    customerId = uuid.v4();
    mockUploader = sinon.spy(() => Promise.resolve());

    program = {
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434',
      deployBucket: config.deployBucket,
      uploader: mockUploader
    };

    deployCommand = require('../../commands/deploy');
  });

  it('deploys', () => {
    const deployCreds = {
      accessKeyId: '1234',
      secretAccessKey: 'asdfasdf',
      sessionToken: '32535'
    };

    program.versionId = uuid.v4();
    program.versionMessage = 'New version message';

    apiHandlers.getDeployCreds = sinon.spy((req, res) => {
      res.json(deployCreds);
    });

    apiHandlers.postVersionHandler = sinon.spy((req, res) => {
      res.json(req.body);
    });

    const sampleAppDir = path.join(__dirname, '../fixtures/sample-app');
    Object.assign(program, {cwd: sampleAppDir});

    return manifest.load(program)
      .then(appManifest => {
        program.appManifest = appManifest;
        program.virtualApp = {appId: appManifest.appId, customerId};
        return deployCommand(program);
      })
      .then(() => {
        assert.isTrue(fs.existsSync(sampleAppDir + '/aero-deploy.tar.gz'));
        // unpack the tarball and verify the contents
        assert.isTrue(mockUploader.calledWith({
          creds: deployCreds,
          tarballFile: sampleAppDir + '/aero-deploy.tar.gz',
          key: program.virtualApp.appId + '/' + program.versionId + '.tar.gz',
          bucket: config.deployBucket,
          metadata: {deployToStage: 'production'}
        }));

        assert.isTrue(apiHandlers.postVersionHandler.calledWith(sinon.match({
          body: {
            versionId: program.versionId,
            message: program.versionMessage,
            manifest: _.omit(program.appManifest, 'appId')
          }
        })));
      });
  });
});
