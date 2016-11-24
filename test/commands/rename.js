const uuid = require('node-uuid');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const chai = require('chai');
chai.use(require('sinon-chai'));
const expect = chai.expect;

const API_PORT = 1797;

const renameCommand = require('../../commands/rename');

describe('rename command', () => {
  var apiServer;
  var program;
  var apiPutHandler;
  const appId = uuid.v4();
  const customerId = uuid.v4();

  before(done => {
    const api = express();

    api.put('/apps/:appId', [bodyParser.json()], (req, res, next) => {
      apiPutHandler(req, res, next);
    });

    apiServer = api.listen(API_PORT, done);
  });

  after(done => {
    apiServer.close(done);
  });

  beforeEach(() => {
    program = {
      customerId,
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434',
      website: {appId}
    };
  });

  it('invokes api app update endpoint', () => {
    apiPutHandler = sinon.spy((req, res) => {
      res.json(req.body);
    });

    program.name = 'new-website-name';
    return renameCommand(program)
      .then(() => {
        const args = apiPutHandler.lastCall.args;
        expect(args[0].params.appId).to.equal(appId);
        expect(args[0].body).to.eql({customerId, name: program.name});

        return;
      });
  });
});
