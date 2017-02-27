const _ = require('lodash');
const AWS = require('aws-sdk');
const log = require('winston');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const uuid = require('uuid');
const sinon = require('sinon');
const md5File = require('md5-file');
const path = require('path');
const Promise = require('bluebird');

const expect = chai.expect;
chai.use(sinonChai);

log.level = 'debug';
AWS.config.setPromisesDependency(Promise);

require('simple-errors');

describe('uploader', () => {
  const mockS3 = {};
  var uploader;

  before(() => {
    sinon.stub(AWS, 'S3', () => mockS3);
  });

  after(() => {
    sinon.restore(AWS, 'S3');
  });

  beforeEach(() => {
    this.appId = uuid.v4();
    this.versionId = uuid.v4();

    uploader = require('../lib/uploader');

    this.application = {
      appId: this.appId
    };

    this.version = {
      appId: this.appId,
      versionId: this.versionId,
      status: 'queued',
      manifest: {
        router: [
          {module: 'webpage'}
        ]
      }
    };

    this.multiPartUploadId = _.random(1000, 2000);

    _.assign(mockS3, {
      createMultipartUpload: sinon.spy((params, callback) => {
        callback(null, {UploadId: this.multiPartUploadId});
      }),
      uploadPart: sinon.spy((params, callback) => {
        callback(null, {});
      }),
      completeMultipartUpload: sinon.spy((params, callback) => {
        callback(null, {});
      })
    });
  });

  it('uploads all files', () => {
    const deployPath = path.join(__dirname, './fixtures/sample-app');
    const params = {
      versionId: uuid.v4(),
      files: {
        'index.html': md5File.sync(path.join(deployPath, 'index.html')),
        'styles.css': md5File.sync(path.join(deployPath, 'styles.css')),
        'images/image.jpg': md5File.sync(path.join(deployPath, 'images/image.jpg'))
      },
      deployPath,
      uploadBucket: 'aerobaticapp-versions'
    };

    const program = {
      website: {appId: uuid.v4()}
    };

    return uploader(params, program)
      .then(() => {
        expect(mockS3.completeMultipartUpload.callCount).to.equal(3);
        expect(mockS3.createMultipartUpload).to.have.been.calledWith({
          Bucket: params.uploadBucket,
          ACL: 'authenticated-read',
          Key: program.website.appId + '/' + params.versionId + '/index.html',
          ContentType: 'text/html',
          Metadata: {
            md5Hash: params.files['index.html']
          }
        });

        expect(mockS3.createMultipartUpload).to.have.been.calledWith({
          Bucket: params.uploadBucket,
          ACL: 'authenticated-read',
          Key: program.website.appId + '/' + params.versionId + '/styles.css',
          ContentType: 'text/css',
          Metadata: {
            md5Hash: params.files['styles.css']
          }
        });

        expect(mockS3.createMultipartUpload).to.have.been.calledWith({
          Bucket: params.uploadBucket,
          ACL: 'authenticated-read',
          Key: program.website.appId + '/' + params.versionId + '/images/image.jpg',
          ContentType: 'image/jpeg',
          Metadata: {
            md5Hash: params.files['images/image.jpg']
          }
        });
      });
  });
});
