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
const domainCommand = require('../../commands/domain');

describe('domain command', () => {
  var apiServer;
  var program;
  var apiHandlers = {};
  const customerId = uuid.v4();

  before(done => {
    const api = express();

    api.use(bodyParser.json());
    api.post('/customers/:customerId/domains', (req, res, next) => {
      apiHandlers.createDomain(req, res, next);
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
      customerId,
      apiUrl: `http://localhost:${API_PORT}`,
      authToken: '23434',
      website: {appId: uuid.v4(), customerId}
    };

    apiHandlers.createDomain = sinon.spy((req, res) => {
      res.json(req.body);
    });

    apiHandlers.updateWebsite = sinon.spy((req, res) => {
      res.json({});
    });
  });

  afterEach(() => {
  });

  it('website already has domain', () => {
    program.name = 'test.com';
    program.website.domainName = 'domain.com';
    return domainCommand(program)
      .catch(err => {
        expect(err.message).to.match(/This website is already bound to the custom domain/);
      });
  });

  it('invalid domain name characters', () => {
    program.name = '*&##.com';
    return domainCommand(program)
      .catch(err => {
        expect(err.message).to.match(/Domain name has invalid characters/);
      });
  });

  it('missing sub-domain', () => {
    program.website.domainName = 'domain.com';
    return domainCommand(program)
      .catch(err => {
        expect(err.message).to.match(/Missing --subdomain argument/);
      });
  });

  it('invalid sub-domain', () => {
    program.name = 'domain.com';
    program.subdomain = '*&#';
    return domainCommand(program)
      .catch(err => {
        expect(err.message).to.match(/Invalid sub-domain/);
      });
  });

  it('website is on free plan', () => {
    program.name = 'domain.com';
    program.subdomain = '@';
    program.website.subscriptionPlan = null;
    return domainCommand(program)
      .catch(err => {
        expect(err.message).to.match(/first needs to be upgraded to the paid plan/);
      });
  });

  it('creates domain', () => {
    program.name = 'domain.com';
    program.subdomain = '@';
    program.website.subscriptionPlan = 'paid-plan';
    return domainCommand(program)
      .then(() => {
        expect(apiHandlers.createDomain).to.have.been.called;
        expect(apiHandlers.createDomain.getCall(0).args[0].params).to.eql({customerId});
        expect(apiHandlers.createDomain.getCall(0).args[0].body).to.eql({
          domainName: program.name,
          customerId
        });

        expect(apiHandlers.updateWebsite).to.have.been.called;
        expect(apiHandlers.updateWebsite.getCall(0).args[0].params)
          .to.eql({appId: program.website.appId});
        expect(apiHandlers.updateWebsite.getCall(0).args[0].body).to.eql({
          domainName: program.name,
          subDomain: program.subdomain,
          customerId
        });
      });
  });

  // it('invokes api post endpoint', () => {
  //   program.name = 'test.com';
  //   program.subdomain = 'www';
  //
  //
  // });
});
