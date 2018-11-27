const uuid = require('uuid');
const log = require('winston');
const sinon = require('sinon');
const chai = require('chai');
const {expect} = chai;
chai.use(require('sinon-chai'));
const express = require('express');
const bodyParser = require('body-parser');

process.env.UNIT_TEST = '1';
const API_PORT = 1797;

log.level = 'debug';
const clientIpCommand = require('../../commands/clientip');

describe('clientIp command', () => {
  var apiServer;
  var program;
  var apiHandlers = {};
  const appId = uuid.v4();

  before(done => {
    const api = express();

    api.use(bodyParser.json());
    api.put('/apps/:appId/clientip-range', (req, res) => {
      apiHandlers.putClientIpRange(req, res);
    });

    api.delete('/apps/:appId/clientip-range', (req, res, next) => {
      apiHandlers.deleteClientIpRange(req, res, next);
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

    apiHandlers.putClientIpRange = sinon.spy((req, res) => {
      res.json({});
    });

    apiHandlers.deleteClientIpRange = sinon.spy((req, res) => {
      res.status(200).json({});
    });
  });

  afterEach(() => {});

  it('set clientIp range', () => {
    program.value = '102.1.5.2/24, ::1/128, ::2';

    return clientIpCommand(program).then(() => {
      expect(apiHandlers.putClientIpRange).to.have.been.called;
      const putReq = apiHandlers.putClientIpRange.getCall(0).args[0];
      expect(putReq.method).to.equal('PUT');
      expect(putReq.params).to.eql({appId});
      expect(putReq.body).to.eql({
        clientIpRange: ['102.1.5.2/24', '::1/128', '::2']
      });
    });
  });

  it('delete clientIp range', () => {
    program.delete = true;
    return clientIpCommand(program).then(() => {
      expect(apiHandlers.deleteClientIpRange).to.have.been.called;
      const deleteReq = apiHandlers.deleteClientIpRange.getCall(0).args[0];
      expect(deleteReq.method).to.equal('DELETE');
      expect(deleteReq.params).to.eql({appId});
    });
  });
});
