const AWS = require('aws-sdk');
const Promise = require('bluebird');
const fs = require('fs');
// const uuid = require('uuid');
const path = require('path');

const sts = new AWS.STS({region: 'us-west-2'});

AWS.config.setPromisesDependency(Promise);
const appId = 'fa818dc1-eb8c-4500-9f54-a19882233f73';
const disallowedAppId = 'd914db09-198e-49c4-83bb-7ce5f0000f87';

const bucket = 'aerobatic-deploy-staging-test';

// const policy = {
//   Statement: {
//     Effect: 'Allow',
//     Action: 's3:PutObject',
//     Resource: ['arn:aws:s3:::' + bucket],
//     Condition: {
//       StringLike: {
//         's3:prefix': [appId, appId + '/*'],
//         's3:delimiter': ['/']
//       }
//     }
//   }
// };

// http://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_assumerole.html
const policy = {
  Statement: {
    Effect: 'Allow',
    Action: 's3:PutObject',
    Resource: ['arn:aws:s3:::' + bucket + '/' + appId + '/*']
  }
};

var s3;
Promise.resolve()
  .then(() => {
    return sts.assumeRole({
      RoleArn: 'arn:aws:iam::677305290892:role/client-deploy-role',
      RoleSessionName: appId,
      DurationSeconds: 900,
      ExternalId: appId,
      Policy: JSON.stringify(policy)
    }).promise();
  })
  .then(data => {
    // console.log(JSON.stringify(data));
    const tempCreds = {
      accessKeyId: data.Credentials.AccessKeyId,
      secretAccessKey: data.Credentials.SecretAccessKey,
      sessionToken: data.Credentials.SessionToken
    };

    s3 = new AWS.S3(Object.assign({region: 'us-west-2'}, tempCreds));

    // Now try and upload a file to the bucket
    const key = appId + '/.eslintrc.json';
    console.log('Write allowed object %s', key);
    return s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(path.join(__dirname, '../.eslintrc.json'))
    }).promise();
  })
  .then(() => {
    const key = disallowedAppId + '/.eslintrc.json';
    // Now try deploying to some other disallowed key
    console.log('Write to a disallowed key %s', key);
    return s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(path.join(__dirname, '../.eslintrc.json'))
    }).promise()
    .then(() => {
      console.error('This should not have succeeded');
    });
  })
  .catch(err => {
    console.error(err);
    return process.exit(1);
  });
