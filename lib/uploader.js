const AWS = require('aws-sdk');
const log = require('winston');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const mime = require('mime');
const urlJoin = require('url-join');
const BluebirdQueue = require('bluebird-queue');
const awsConfig = require('aws-config');
const s3UploadStream = require('s3-upload-stream');

// The number of files to upload concurrently
const UPLOAD_CONCURRENCY = 10;

module.exports = (params, program) => {
  // Use the temporary IAM creds to create the S3 connection
  const s3 = new AWS.S3(awsConfig(Object.assign({
    region: 'us-west-2',
    endpoint: 's3-accelerate.amazonaws.com'
  }, params.uploadCreds)));

  const s3Stream = s3UploadStream(s3);
  const urlHasher = require('./url-hasher')(params);

  // Parallelize the uploading
  const uploadPromise = filePath => {
    return new Promise((resolve, reject) => {
      var stream = fs.createReadStream(path.join(params.deployPath, filePath));

      if (_.includes(['.html', '.css'], path.extname(filePath))) {
        stream = stream.pipe(urlHasher(filePath));
      }

      var upload = s3Stream.upload({
        Bucket: params.uploadBucket,
        ACL: 'authenticated-read',
        Key: urlJoin(program.website.appId, params.versionId, filePath),
        ContentType: mime.lookup(filePath),
        Metadata: {
          md5Hash: params.files[filePath]
        }
      });

      upload.on('error', error => {
        if (error.code === 'AccessDenied') {
          return reject(new Error('Permission to upload to bucket ' + params.bucket + ' denied'));
        }

        return reject(Error.create('Error uploading to S3: %j', {error: error.message, filePath}));
      });

      upload.on('part', details => {
        log.debug(details);
      });

      /* Handle upload completion. Example details object:
      { Location: 'https://bucketName.s3.amazonaws.com/filename.ext',
       Bucket: 'bucketName',
       Key: 'filename.ext',
       ETag: '"bf2acbedf84207d696c8da7dbb205b9f-5"' }
      */
      upload.on('uploaded', details => {
        log.debug('done uploading file %s', filePath);
        resolve(details);
      });

      stream.pipe(upload);
    });
  };

  const filePaths = Object.keys(params.files);

  const queue = new BluebirdQueue({concurrency: UPLOAD_CONCURRENCY});
  queue.add(filePaths.map(filePath => uploadPromise.bind(null, filePath)));

  return queue.start().then(() => {
    log.info('Done uploading all %s files', filePaths.length);
    return;
  });
};
