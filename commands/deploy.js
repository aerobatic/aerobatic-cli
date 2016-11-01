const log = require('winston');
const fs = require('fs-promise');
const path = require('path');
const _ = require('lodash');
const urlJoin = require('url-join');
const camelCase = require('camel-case');
const pack = require('tar-pack').pack;
const uuid = require('node-uuid');
const Promise = require('bluebird');
const minimatch = require('minimatch');
const api = require('../lib/api');

const IGNORE_PATTERNS = ['node_modules/**', '.*', '.*/**',
  '*.tar.gz', 'README.*', 'LICENSE', '**/*.less', '**/*.scss', '**/*.php', '**/*.asp'];

// Command to create a new application
module.exports = program => {
  _.defaults(program, {
    uploader: require('../lib/uploader')
  });

  // Default to
  _.defaults(program, {
    versionId: uuid.v4(),
    deployStage: 'production'
  });

  return createTarball(program)
    .then(tarballFile => {
      return uploadTarballToS3(program, tarballFile);
    })
    .then(() => {
      const url = urlJoin(program.apiUrl, `/apps/${program.virtualApp.appId}/versions`);
      const postBody = {
        versionId: program.versionId,
        message: program.versionMessage,
        manifest: _.omit(program.appManifest, 'appId')
      };

      log.debug('Invoke API to create version %s', program.versionId);
      return api.post({url, authToken: program.authToken, body: postBody});
    })
    .then(version => {
      // Now the version is created in the database with a status of 'staged'.
      // Need to poll the API for status updates until the status has changed
      // to 'deployed' or 'failed'.
      // poll
      log.info('Version %s created', version.versionId);
      return;
    });
};

function createTarball(program) {
  const deployManifest = program.appManifest.deploy;
  const deployDir = deployManifest.directory || program.cwd;

  var ignorePatterns = [].concat(IGNORE_PATTERNS);
  if (_.isArray(deployManifest.ignorePatterns)) {
    ignorePatterns = ignorePatterns.concat(deployManifest.ignore);
  }

  const filter = entry => {
    const filePath = path.relative(deployDir, entry.path);
    return !_.some(ignorePatterns, pattern => minimatch(filePath, pattern));
  };

  const tarballFile = path.join(program.cwd, 'aero-deploy.tar.gz');
  fs.removeSync(tarballFile);

  const outStream = fs.createWriteStream(tarballFile);

  return new Promise((resolve, reject) => {
    log.debug('Create deployment bundle %s', tarballFile);

    pack(deployDir, {filter})
      .pipe(outStream)
      .on('error', reject)
      .on('close', () => resolve(tarballFile));
  });
}

function uploadTarballToS3(program, tarballFile) {
  log.debug('Invoke API to get temporary AWS credentials for uploading tarball to S3');
  return api.get({
    url: urlJoin(program.apiUrl, `/customers/${program.virtualApp.customerId}/deploy-creds`),
    authToken: program.authToken
  })
  .then(creds => {
    // Use the temporary IAM creds to create the S3 connection
    return program.uploader({
      creds: _.mapKeys(creds, (value, key) => camelCase(key)),
      tarballFile,
      key: program.virtualApp.appId + '/' + program.versionId + '.tar.gz',
      bucket: program.deployBucket,
      metadata: {stage: program.deployStage}
    });
  });
}
