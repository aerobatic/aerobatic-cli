const log = require('winston');
const path = require('path');
const chai = require('chai');
const md5File = require('md5-file');
const expect = chai.expect;

chai.use(require('sinon-chai'));

log.level = 'debug';

const fileCollector = require('../lib/file-collector');

const expectedHashes = {
  'index.html': md5File.sync(path.join(__dirname, './fixtures/sample-app/index.html')),
  'styles.css': md5File.sync(path.join(__dirname, './fixtures/sample-app/styles.css')),
  'images/image.jpg': md5File.sync(path.join(__dirname, './fixtures/sample-app/images/image.jpg'))
};

describe('fileCollector', () => {
  it('collects the right files', () => {
    const params = {
      deployPath: path.join(__dirname, './fixtures/sample-app')
    };

    return fileCollector(params)
      .then(() => {
        expect(Object.keys(params.files).length).to.equal(3);
        expect(params.files).to.have.ownProperty('index.html');
        expect(params.files).to.have.ownProperty('styles.css');
        expect(params.files).to.have.ownProperty('images/image.jpg');
        expect(params.files['index.html']).to.equal(expectedHashes['index.html']);
        expect(params.files['styles.css']).to.equal(expectedHashes['styles.css']);
        expect(params.files['images/image.jpg']).to.equal(expectedHashes['images/image.jpg']);
      });
  });
});
