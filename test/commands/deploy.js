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

log.level = 'none';

// Force a short polling interval for testing
config.pollVersionStatusInterval = 20;

require('dash-assert');

describe('deploy command', () => {
  var api;
  var apiServer;
  var program;
  var customerId;
  var deployCommand;
  var deployCreds;
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

    api.get('/apps/:appId/versions/:versionId', (req, res, next) => {
      apiHandlers.getVersionHandler(req, res, next);
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
      uploader: mockUploader,
      stage: 'staging',
      unitTest: true
    };

    deployCreds = {
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
      res.json(_.assign(req.body, {
        status: 'running',
        appId: program.website.appId
      }));
    });

    var getVersionCall = 0;
    apiHandlers.getVersionHandler = sinon.spy((req, res) => {
      getVersionCall += 1;
      const version = req.params;
      if (getVersionCall === 1) {
        version.status = 'queued';
      } else if (getVersionCall === 2) {
        version.status = 'running';
      } else {
        version.status = 'complete';
        version.deployedUrl = `https://${req.query.stage}.test.com`;
      }
      res.json(version);
    });

    deployCommand = require('../../commands/deploy');
  });

  it('deploys', () => {
    const sampleAppDir = path.join(__dirname, '../fixtures/sample-app');
    Object.assign(program, {cwd: sampleAppDir});

    return manifest.load(program)
      .then(appManifest => {
        program.appManifest = appManifest;
        program.website = {appId: appManifest.id, customerId};
        return deployCommand(program);
      })
      .then(() => {
        assert.isTrue(fs.existsSync(sampleAppDir + '/aero-deploy.tar.gz'));
        // unpack the tarball and verify the contents
        assert.isTrue(mockUploader.calledWith({
          creds: deployCreds,
          tarballFile: sampleAppDir + '/aero-deploy.tar.gz',
          key: program.website.appId + '/' + program.versionId + '.tar.gz',
          bucket: config.deployBucket,
          metadata: {stage: program.stage}
        }));

        assert.isTrue(apiHandlers.postVersionHandler.calledWith(sinon.match({
          body: {
            versionId: program.versionId,
            message: program.versionMessage,
            manifest: _.omit(program.appManifest, 'id')
          }
        })));

        assert.equal(apiHandlers.getVersionHandler.callCount, 3);
      });
  });

  it('version deploy fails', () => {
    const sampleAppDir = path.join(__dirname, '../fixtures/sample-app');
    Object.assign(program, {cwd: sampleAppDir});

    var getVersionCall = 0;
    apiHandlers.getVersionHandler = sinon.spy((req, res) => {
      getVersionCall += 1;
      const version = req.params;
      if (getVersionCall === 2) {
        res.json(Object.assign(version, {status: 'failed', error: 'Deploy failed'}));
      } else {
        res.json(Object.assign(version, {status: 'running'}));
      }
    });

    return manifest.load(program)
      .then(appManifest => {
        program.appManifest = appManifest;
        program.website = {appId: appManifest.id, customerId};
        return deployCommand(program);
      })
      .catch(err => {
        assert.isTrue(/Deploy failed/.test(err.message));
        assert.equal(apiHandlers.getVersionHandler.callCount, 2);
      });
  });
});
