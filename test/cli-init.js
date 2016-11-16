const path = require('path');
const os = require('os');
const fs = require('fs-promise');
const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
const config = require('config');
const uuid = require('node-uuid');
config.userConfigFile = '.aerorc-test.yml';

const userConfig = require('../lib/user-config');
const expect = chai.expect;
const MockApi = require('./mock-api');
const cliInit = require('../lib/cli-init');

describe('cliInit', () => {
  var program;
  var mockApi;

  beforeEach(() => {
    program = {};

    mockApi = new MockApi();
    mockApi.start();
  });

  afterEach(done => {
    mockApi.stop(done);
  });

  it('extends program with userConfig settings', () => {
    return userConfig.set({userValue1: 1, userValue2: 2})
      .then(() => cliInit(program, {requireAuth: false}))
      .then(() => {
        expect(program.userValue1).to.equal(1);
        expect(program.userValue2).to.equal(2);
        return;
      });
  });

  it('loads virtual app', () => {
    const customerId = uuid.v4();
    const appId = uuid.v4();

    program.cwd = path.join(os.tmpdir(), Date.now().toString());
    program.authToken = '252454334';
    program.customerRoles = {[customerId]: 'admin'};

    const virtualApp = {appId};
    const getApp = sinon.spy((req, res) => {
      res.json(virtualApp);
    });

    mockApi.registerRoute('get', '/apps/:appId', getApp);

    return fs.outputFile(path.join(program.cwd, 'static.yml'), 'appId: ' + appId)
      .then(() => cliInit(program, {loadVirtualApp: true}))
      .then(() => {
        expect(getApp).to.have.been.calledWith(sinon.match({
          params: {appId}
        }));

        expect(program.virtualApp).to.eql(virtualApp);
      });
  });
});
