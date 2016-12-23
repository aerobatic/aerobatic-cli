const uuid = require('node-uuid');
const log = require('winston');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('sinon-chai'));
const express = require('express');
const bodyParser = require('body-parser');

process.env.UNIT_TEST = '1';
const API_PORT = 1797;

log.level = 'debug';
const envCommand = require('../../commands/env');

describe('env command', () => {
  var apiServer;
  var program;
  var envVariables = {};
  var apiHandlers = {};
  const appId = uuid.v4();

  before(done => {
    const api = express();

    api.use(bodyParser.json());
    api.get('/apps/:appId/env', (req, res) => {
      apiHandlers.getEnvVars(req, res);
    });

    api.put('/apps/:appId/env/:key', (req, res, next) => {
      apiHandlers.putEnvVar(req, res, next);
    });

    api.put('/apps/:appId/env/:stage/:key', (req, res, next) => {
      apiHandlers.putEnvVar(req, res, next);
    });

    api.delete('/apps/:appId/env/:key', (req, res) => {
      apiHandlers.deleteEnvVar(req, res);
    });

    api.delete('/apps/:appId/env/:stage/:key', (req, res, next) => {
      apiHandlers.deleteEnvVar(req, res, next);
    });

    api.put('/apps/:appId', (req, res) => {
      apiHandlers.updateWebsite(req, res);
    });

    apiServer = api.listen(API_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  beforeEach(() => {
    program = {
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434',
      website: {appId, deployedVersions: {test: '2345435'}}
    };

    apiHandlers.getEnvVars = sinon.spy((req, res) => {
      res.json(envVariables);
    });

    apiHandlers.putEnvVar = sinon.spy((req, res) => {
      res.status(204).end();
    });

    apiHandlers.deleteEnvVar = sinon.spy((req, res) => {
      res.status(204).end();
    });
  });

  afterEach(() => {
  });

  it('get environment variables', () => {
    envVariables._global = {FOO: {value: '10'}};
    return envCommand(program)
      .then(() => {
        const getParams = apiHandlers.getEnvVars.getCall(0).args[0].params;
        expect(getParams).to.eql({appId});
      });
  });

  it('set global environment variable', () => {
    program.name = 'FOO';
    program.value = '10';
    return envCommand(program)
      .then(() => {
        expect(apiHandlers.putEnvVar).to.have.been.called;
        const putReq = apiHandlers.putEnvVar.getCall(0).args[0];
        expect(putReq.method).to.equal('PUT');
        expect(putReq.params).to.eql({appId, key: 'FOO'});
        expect(putReq.body).to.eql({value: '10'});
      });
  });

  it('set stage specific environment variable', () => {
    program.name = 'FOO';
    program.value = '10';
    program.stage = 'test';

    return envCommand(program)
      .then(() => {
        expect(apiHandlers.putEnvVar).to.have.been.called;
        const putReq = apiHandlers.putEnvVar.getCall(0).args[0];
        expect(putReq.method).to.equal('PUT');
        expect(putReq.params).to.eql({appId, key: 'FOO', stage: 'test'});
        expect(putReq.body).to.eql({value: '10'});
      });
  });

  it('delete global environment variable', () => {
    program.name = 'FOO';
    program.value = '10';
    program.delete = true;
    return envCommand(program)
      .then(() => {
        expect(apiHandlers.deleteEnvVar).to.have.been.called;
        const deleteReq = apiHandlers.deleteEnvVar.getCall(0).args[0];
        expect(deleteReq.method).to.equal('DELETE');
        expect(deleteReq.params).to.eql({appId, key: 'FOO'});
      });
  });

  it('delete stage specific environment variable', () => {
    program.name = 'FOO';
    program.value = '10';
    program.delete = true;
    program.stage = 'test';
    return envCommand(program)
      .then(() => {
        expect(apiHandlers.deleteEnvVar).to.have.been.called;
        const deleteReq = apiHandlers.deleteEnvVar.getCall(0).args[0];
        expect(deleteReq.method).to.equal('DELETE');
        expect(deleteReq.params).to.eql({appId, key: 'FOO', stage: 'test'});
      });
  });
});
