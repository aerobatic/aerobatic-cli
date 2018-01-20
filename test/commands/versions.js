const uuid = require('uuid');
const sinon = require('sinon');
const express = require('express');
const chai = require('chai');
chai.use(require('sinon-chai'));
const expect = chai.expect;

const API_PORT = 1797;

const versionCommand = require('../../commands/versions');

describe('versions command', () => {
  var apiServer;
  var program;
  var apiHandlers = {};
  var website;
  const appId = uuid.v4();
  const customerId = uuid.v4();

  before(done => {
    const api = express();

    api.get('/apps/:appId/versions', (req, res, next) => {
      apiHandlers.listVersions(req, res, next);
    });

    api.delete('/apps/:appId/versions/:versionId', (req, res, next) => {
      apiHandlers.deleteVersion(req, res, next);
    });

    api.post('/apps/:appId/versions/:versionId/deploy/:stage', (req, res) => {
      apiHandlers.pushVersion(req, res);
    });

    api.delete('/apps/:appId/versions/deploy/:stage', (req, res) => {
      apiHandlers.deleteStage(req, res);
    });

    apiServer = api.listen(API_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  beforeEach(() => {
    website = {
      appId,
      name: 'test-website',
      deployedVersions: {}
    };

    program = {
      customerId,
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434',
      website
    };
  });

  it('lists versions', () => {
    apiHandlers.listVersions = sinon.spy((req, res) => {
      res.json([{versionId: '123', versionNum: 1}]);
    });

    return versionCommand(program).then(() => {
      const listVersionsReq = apiHandlers.listVersions.lastCall.args[0];
      expect(listVersionsReq.params.appId).to.equal(appId);
      return;
    });
  });

  describe('delete version', () => {
    it('success', () => {
      program.delete = true;
      program.name = 'v1';
      const versionId = uuid.v4();

      apiHandlers.listVersions = sinon.spy((req, res) => {
        res.json([{versionId, versionNum: 1}]);
      });

      apiHandlers.deleteVersion = sinon.spy((req, res) => {
        res.status(204).end();
      });

      return versionCommand(program).then(() => {
        const listVersionsReq = apiHandlers.listVersions.lastCall.args[0];
        expect(listVersionsReq.params.appId).to.equal(appId);

        const deleteVersionReq = apiHandlers.deleteVersion.lastCall.args[0];
        expect(apiHandlers.deleteVersion).to.have.been.called;
        expect(deleteVersionReq.params.versionId).to.equal(versionId);

        return;
      });
    });

    it('Invalid --name arg', () => {
      program.delete = true;
      program.name = 'vg454';
      return versionCommand(program).catch(err => {
        expect(err.message).matches(/^Invalid --name arg/);
      });
    });

    it('Invalid version number', () => {
      program.delete = true;
      program.name = 'v2';
      const versionId = uuid.v4();

      apiHandlers.listVersions = sinon.spy((req, res) => {
        res.json([{versionId, versionNum: 1}]);
      });

      return versionCommand(program).catch(err => {
        expect(err.message).to.match(/^Invalid version number 2/);
      });
    });
  });

  it('push version to stage', () => {
    const versionId = uuid.v4();
    program.name = 'v1';
    program.stage = 'test';

    apiHandlers.listVersions = sinon.spy((req, res) => {
      res.json([{versionId, versionNum: 1}]);
    });

    apiHandlers.pushVersion = sinon.spy((req, res) => {
      res.json({
        appId: req.params.appId,
        urls: {
          test: 'https://test.site.com'
        }
      });
    });

    return versionCommand(program).then(() => {
      expect(apiHandlers.pushVersion).to.have.been.called;
      const pushVersionReq = apiHandlers.pushVersion.getCall(0).args[0];
      expect(pushVersionReq.params).to.eql({
        appId,
        versionId,
        stage: 'test'
      });
    });
  });

  it('delete stage', () => {
    program.delete = true;
    program.stage = 'test';

    apiHandlers.deleteStage = sinon.spy((req, res) => {
      res.json({appId});
    });

    return versionCommand(program).then(() => {
      expect(apiHandlers.deleteStage).to.have.been.called;
      const deleteStageReq = apiHandlers.deleteStage.lastCall.args[0];
      expect(deleteStageReq.params).to.eql({appId, stage: 'test'});
    });
  });
});
