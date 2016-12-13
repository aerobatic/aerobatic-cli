const log = require('winston');
const fs = require('fs-promise');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');
const config = require('config');
const request = require('request');
const urlJoin = require('url-join');
const camelCase = require('camel-case');
const pack = require('tar-pack').pack;
const uuid = require('node-uuid');
const Promise = require('bluebird');
const promiseUntil = require('promise-until');
const minimatch = require('minimatch');
const Spinner = require('cli-spinner').Spinner;
const api = require('../lib/api');
const manifest = require('../lib/manifest');
const output = require('../lib/output');

const IGNORE_PATTERNS = ['node_modules/**', '.*', '.*/**',
  '*.tar.gz', 'README.*', 'LICENSE', '**/*.less', '**/*.scss', '**/*.php',
  '**/*.asp', 'package.json', '*.log', manifest.fileName];

// Command to create a new application
module.exports = program => {
  const deployStage = program.stage || 'production';

  output.blankLine();
  output('Deploy new Aerobatic app version to stage ' + chalk.bold(deployStage));
  output.blankLine();

  _.defaults(program, {
    uploader: require('../lib/uploader')
  });

  // Default to
  _.defaults(program, {
    versionId: uuid.v4(),
    deployStage: 'production'
  });

  const deployManifest = program.appManifest.deploy;

  // First check for a command line deployDir followed by a value in the manifest.
  var deployDirectory = program.deployDir || deployManifest.directory;
  var deployPath;

  // If there is a directory specified in the deploy manifest, ensure that the
  // sub-directory exists.
  if (deployManifest.directory) {
    deployPath = path.join(program.cwd, deployDirectory);

    if (!fs.existsSync(deployDirectory)) {
      return Promise.reject(Error.create('The deploy directory ' + deployDirectory + ' does not exist.', {formatted: true}));
    }
  } else {
    deployPath = program.cwd;
  }

  return verifyDeployAssets(deployPath, program)
    .then(() => createTarball(deployPath, program))
    .then(tarballFile => {
      return uploadTarballToS3(program, deployStage, tarballFile);
    })
    .then(() => {
      const url = urlJoin(program.apiUrl, `/apps/${program.website.appId}/versions`);
      const postBody = {
        versionId: program.versionId,
        message: program.versionMessage,
        manifest: _.omit(program.appManifest, 'appId'),
        commitUrl: program.commitUrl
      };

      log.debug('Invoke API to create version %s', program.versionId);
      return api.post({url, authToken: program.authToken, body: postBody});
    })
    .then(version => waitForDeployComplete(program, deployStage, version))
    .then(version => {
      if (program.unitTest !== true && _.includes(['development', 'test'], process.env.NODE_ENV)) {
        return flushAppForTest(program).then(() => version);
      }
      return Promise.resolve(version);
    })
    .then(version => {
      output.blankLine();
      output('Version ' + version.name + ' deployment complete.');
      output('View now at ' + chalk.underline.yellow(version.deployedUrl));
      output.blankLine();
      return;
    });
};

function verifyDeployAssets(deployDirectory) {
  // Ensure that there is a index.html in the deployDirectory
  return fs.exists(path.join(deployDirectory, 'index.html'))
    .then(exists => {
      if (!exists) {
        throw Error.create('No index.html file exists in the deploy directory', {formatted: true});
      }
      return;
    });
}

function createTarball(deployDirectory, program) {
  const spinner = startSpinner(program, 'Compressing app directory');
  const deployManifest = program.appManifest.deploy;

  var ignorePatterns = [].concat(IGNORE_PATTERNS);
  if (_.isArray(deployManifest.ignorePatterns)) {
    ignorePatterns = ignorePatterns.concat(deployManifest.ignore);
  }

  const filter = entry => {
    const filePath = path.relative(deployDirectory, entry.path);
    return !_.some(ignorePatterns, pattern => minimatch(filePath, pattern));
  };

  const tarballFile = path.join(program.cwd, 'aero-deploy.tar.gz');
  fs.removeSync(tarballFile);

  const outStream = fs.createWriteStream(tarballFile);

  return new Promise((resolve, reject) => {
    log.debug('Create deployment bundle %s', tarballFile);

    pack(deployDirectory, {filter})
      .pipe(outStream)
      .on('error', reject)
      .on('close', () => {
        spinner.stop(true);
        resolve(tarballFile);
      });
  });
}

function uploadTarballToS3(program, deployStage, tarballFile) {
  const spinner = startSpinner(program, 'Uploading archive to Aerobatic');
  log.debug('Invoke API to get temporary AWS credentials for uploading tarball to S3');
  return api.get({
    url: urlJoin(program.apiUrl, `/customers/${program.website.customerId}/deploy-creds`),
    authToken: program.authToken
  })
  .then(creds => {
    // Use the temporary IAM creds to create the S3 connection
    return program.uploader({
      creds: _.mapKeys(creds, (value, key) => camelCase(key)),
      tarballFile,
      key: program.website.appId + '/' + program.versionId + '.tar.gz',
      bucket: program.deployBucket,
      metadata: {stage: deployStage}
    });
  }).then(() => {
    spinner.stop(true);
    return;
  })
  .catch(err => {
    throw Error.create('Error uploading to S3', {}, err);
  });
}

// Poll the api for the version until the status is no longer "running".
function waitForDeployComplete(program, deployStage, version) {
  const queueSpinner = startSpinner(program, 'Waiting for cloud deployment to begin');
  var runningSpinner;

  var latestVersionState = version;
  const url = urlJoin(program.apiUrl,
    `/apps/${program.website.appId}/versions/${version.versionId}?stage=${deployStage}`);

  const stopSpinners = () => {
    if (queueSpinner.isSpinning()) queueSpinner.stop(true);
    if (runningSpinner && runningSpinner.isSpinning()) runningSpinner.stop(true);
  };

  return promiseUntil(() => {
    switch (latestVersionState.status) {
      case 'queued':
      case 'running':
        if (queueSpinner.isSpinning()) queueSpinner.stop(true);
        if (!runningSpinner) {
          runningSpinner = startSpinner(program, 'Cloud deployment in-progress');
        }
        return false;
      case 'complete':
        stopSpinners();
        return true;
      case 'failed':
        stopSpinners();
        throw new Error('Version deployment failed with message: ' + latestVersionState.error);
      default:
        throw new Error('Unexpected version status: ' + latestVersionState.status);
    }
  }, () => {
    return Promise.delay(config.pollVersionStatusInterval)
      .then(() => {
        log.debug('Checking on version status');
        return api.get({url, authToken: program.authToken});
      })
      .then(updatedVersion => {
        latestVersionState = updatedVersion;
        return;
      });
  })
  .then(() => {
    return latestVersionState;
  });
}

// Invoke the local cdn app to flush the app from cache.
function flushAppForTest(program) {
  const params = {
    url: 'http://aerobatic.dev/__internal/flush-cache',
    json: true,
    body: {appIds: [program.website.appId]}
  };

  log.debug('Flush local cache');
  return new Promise((resolve, reject) => {
    request.post(params, (err, resp, body) => {
      if (err) return reject(err);
      if (resp.statusCode !== 200) {
        return reject(new Error(resp.statusCode + ' status code ' +
          'returned from flush-cache endpoint: ' + JSON.stringify(body)));
      }
      resolve();
    });
  });
}

function startSpinner(program, message) {
  // Assume if there is an AEROBATIC_API_KEY this is running in a CI build.
  // Don't show spinners, it just messes up the CI log output.
  if (program.unitTest || process.env.AEROBATIC_API_KEY) {
    process.stdout.write(message + '\n');
    return {isSpinning: () => false, stop: () => {}};
  }

  process.stdout.write('     ' + chalk.dim(message));
  var spinner = new Spinner('     %s');
  spinner.setSpinnerString('|/-\\');
  spinner.start();
  process.stdout.write('\n');
  return spinner;
}
