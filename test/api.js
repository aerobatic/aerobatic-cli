const config = require('config');
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
chai.use(require('sinon-chai'));

const api = require('../lib/api');
const MockApi = require('./mock-api');

describe('api', () => {
  var mockApi;
  const MAX_TRIES = 4;

  beforeEach(() => {
    mockApi = new MockApi();
    mockApi.start();
  });

  afterEach(done => {
    mockApi.stop(done);
  });

  it('retries on Internal server error', () => {
    var callNumber = 0;

    const apiHandler = sinon.spy((req, res) => {
      callNumber += 1;
      // The api call succeeds on the last try
      if (callNumber === MAX_TRIES) {
        res.json({status: 'OK'});
      } else {
        res.status(500).json({message: 'Internal server error'});
      }
    });

    mockApi.registerRoute('get', '/', apiHandler);

    return api.get({url: config.apiUrl + '/', maxTries: MAX_TRIES})
      .then(res => {
        expect(res).to.eql({status: 'OK'});
        expect(apiHandler.callCount).to.equal(MAX_TRIES);
      });
  });

  it('fails after MAX_TRIES', () => {
    const apiHandler = sinon.spy((req, res) => {
      res.status(500).json({message: 'Internal server error'});
    });

    mockApi.registerRoute('get', '/', apiHandler);

    var errorCaught;
    return api.get({url: config.apiUrl + '/', maxTries: MAX_TRIES})
      .catch(err => {
        errorCaught = true;
        expect(err.message).to.equal('Internal server error');
        expect(err.retryable).to.be.true;
      })
      .then(() => {
        expect(apiHandler.callCount).to.equal(MAX_TRIES);
        expect(errorCaught).to.be.true;
      });
  });

  it('does not retry non-retryable errors', () => {
    const apiHandler = sinon.spy((req, res) => {
      res.status(500).json({message: 'Some other error'});
    });

    mockApi.registerRoute('get', '/', apiHandler);

    var errorCaught;
    return api.get({url: config.apiUrl + '/', maxTries: MAX_TRIES})
      .catch(err => {
        errorCaught = true;
        expect(err.message).to.equal('Some other error');
        expect(err.retryable).to.be.false;
      })
      .then(() => {
        expect(apiHandler.callCount).to.equal(1);
        expect(errorCaught).to.be.true;
      });
  });

  it('retries timed-out api calls', () => {
    var callNumber = 0;

    const apiHandler = sinon.spy((req, res) => {
      callNumber += 1;
      // The api call succeeds on the last try
      if (callNumber === MAX_TRIES) {
        res.json({status: 'OK'});
      } else {
        setTimeout(() => res.json({status: 'nope'}), 50);
      }
    });

    mockApi.registerRoute('get', '/', apiHandler);

    return api.get({url: config.apiUrl + '/', maxTries: MAX_TRIES, timeout: 10})
      .then(res => {
        expect(res).to.eql({status: 'OK'});
        expect(apiHandler.callCount).to.equal(MAX_TRIES);
      });
  });

  it('fails after too many timeouts', () => {
    const apiHandler = sinon.spy((req, res) => {
      setTimeout(() => res.json({status: 'nope'}), 50);
    });

    mockApi.registerRoute('get', '/', apiHandler);

    var errorCaught;
    return api.get({url: config.apiUrl + '/', maxTries: MAX_TRIES, timeout: 10})
      .catch(err => {
        errorCaught = true;
        expect(err.message).to.equal('Aerobatic API timeout');
        expect(err.retryable).to.be.true;
      })
      .then(() => {
        expect(errorCaught).to.be.true;
        expect(apiHandler.callCount).to.equal(MAX_TRIES);
      });
  });
});
