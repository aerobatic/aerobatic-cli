const AWS = require('aws-sdk');
const log = require('winston');
const fs = require('fs');
const awsConfig = require('aws-config');
const s3UploadStream = require('s3-upload-stream');

module.exports = params => {
  // Use the temporary IAM creds to create the S3 connection
  const s3 = new AWS.S3(awsConfig(Object.assign({
    region: 'us-west-2',
    endpoint: 's3-accelerate.amazonaws.com'
  }, params.creds)));

  const s3Stream = s3UploadStream(s3);
  const readStream = fs.createReadStream(params.tarballFile);

  // const key = program.website.customerId + '/' + versionId + '.tar.gz';
  log.debug('Uploading %s to S3 staging bucket', params.key);
  var upload = s3Stream.upload({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: 'application/gzip',
    Metadata: params.metadata
  });

  return new Promise((resolve, reject) => {
    // Handle errors.
    upload.on('error', error => {
      if (error.code === 'AccessDenied') {
        return reject(new Error('Permission to upload to bucket ' + params.bucket + ' denied'));
      }

      return reject(Error.create('Error uploading to S3: ' + error.message, {}, error));
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
      log.debug('done uploading');
      resolve(details);
    });

    // Pipe the incoming filestream through compression, and up to S3.
    readStream.pipe(upload);
  });
};
