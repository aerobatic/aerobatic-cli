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
const uuid = require('uuid');
const Promise = require('bluebird');
const promiseUntil = require('promise-until');
const minimatch = require('minimatch');
const Spinner = require('cli-spinner').Spinner;
const api = require('../lib/api');
const manifest = require('../lib/manifest');
const output = require('../lib/output');

const IGNORE_PATTERNS = ['node_modules/**', '.*', '.*/**',
  '*.tar.gz', 'README.*', 'LICENSE', '**/*.less', '**/*.scss', '**/*.php',
  '**/*.asp', 'package.json', '*.log', 'aero-deploy.tar.gz', manifest.fileName];

// Command to create a new website version
module.exports = program => {
  const deployStage = program.stage || 'production';

  output.blankLine();
  output('Deploy new Aerobatic website version to stage ' + chalk.bold(deployStage));
  output.blankLine();

  _.defaults(program, {
    uploader: require('../lib/uploader')
  });

  // Default to
  _.defaults(program, {
    versionId: uuid.v4(),
    deployStage: 'production'
  });

  if (!/^[a-z0-9-]{3,50}$/.test(program.deployStage)) {
    return Promise.reject(Error.create('Invalid deploy stage arg. Must consist ' +
      'only of lowercase letter, numbers, and dashes.', {formatted: true}));
  }

  const deployManifest = program.appManifest.deploy;

  // First check for a command line  followed by a value in the manifest.
  var deployDirectory = program.directory || deployManifest.directory;
  var deployPath;

  // If there is a directory specified in the deploy manifest, ensure that the
  // sub-directory exists.
  if (deployDirectory) {
    deployPath = path.join(program.cwd, deployDirectory);

    log.debug('Ensure deployPath %s exists', deployPath);
    if (!fs.existsSync(deployPath)) {
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
        commitUrl: program.commitUrl,
        keyFormat: 'v2'
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
      var message = 'Version ' + version.name + ' deployment complete';
      if (_.isObject(version.metadata) && _.isNumber(version.metadata.duration)) {
        message += ' - ' + version.metadata.duration + 'ms';
      }

      output(message);
      output('View now at ' + chalk.underline.yellow(version.deployedUrl));
      output.blankLine();
      return;
    })
    .catch(err => {
      if (err.code === 'invalidManifest') {
        output.blankLine();
        output('     ' + chalk.red('The aerobatic.yml has the following errors:'));
        output.blankLine();
        err.errors.forEach(message => {
          output('     * ' + chalk.dim(message));
        });
        throw Error.create('Already handled', {doNothing: true});
      } else {
        throw err;
      }
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
    // .then(() => {
    //   ['_config.yml', 'config.toml', 'config.yml'].map((fileName) => {
    //     return fs.exists(path.join(deployDirectory, fileName))
    //       .then(exists => {
    //         if (exists) {
    //           throw Error.create('Deploy directory contains a ' + fileName +
    // '. You probably want to set the --directory ');
    //         }
    //       });
    //   });
    //
    //   return Promise.each()
    //
    //
    //   Promise.any()
    // }
    //   Promise.
    // });
}

function createTarball(deployDirectory, program) {
  const spinner = startSpinner(program, 'Compressing website assets');
  const deployManifest = program.appManifest.deploy;

  var ignorePatterns = [].concat(IGNORE_PATTERNS);
  if (_.isArray(deployManifest.ignorePatterns)) {
    ignorePatterns = ignorePatterns.concat(deployManifest.ignore);
  }

  const filter = entry => {
    log.debug('test filter for entry %s', entry.path);
    const filePath = path.relative(deployDirectory, entry.path);

    // Attempt to fix issue with Windows needing the execute bit
    // set on directories.
    // https://github.com/npm/node-tar/issues/7#issuecomment-17572926
    // https://github.com/sindresorhus/gulp-zip/issues/64#issuecomment-205324031
    if (entry.props.type === 'Directory') {
      log.debug('Set mode of directory to 777');
      entry.props.mode = parseInt('40777', 8); // eslint-disable-line
    }

    return !_.some(ignorePatterns, pattern => minimatch(filePath, pattern));
  };

  const tarballFile = path.join(program.cwd, 'aero-deploy.tar.gz');
  fs.removeSync(tarballFile);

  const outStream = fs.createWriteStream(tarballFile);

  return new Promise((resolve, reject) => {
    log.debug('Create deployment bundle %s', tarballFile);

    // pack(fstream.Reader({path: deployDirectory, filter}))
    // Set ignoreFiles to an empty array. The filter command
    pack(deployDirectory, {filter, ignoreFiles: []})
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

  return Promise.resolve()
    .then(() => {
      return api.get({
        url: urlJoin(program.apiUrl, `/customers/${program.website.customerId}/deploy-creds`),
        authToken: program.authToken
      })
      .catch(err => {
        throw Error.create('Error getting deploy creds: ' + err.message, {}, err);
      });
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
      throw Error.create('Error uploading to S3: ' + err.message, {}, err);
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

  const startTime = Date.now();

  return promiseUntil(() => {
    if ((Date.now() - startTime) > config.deployTimeoutSeconds * 1000) {
      throw Error.create('Deployment has timed out', {code: 'deploymentTimedOut'});
    }

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
  })
  .catch(err => {
    // If deployment timed out, update the version status and re-throw
    if (err.code === 'deploymentTimedOut') {
      return cleanupVersions(program)
        .then(() => {
          throw err;
        });
    }
    throw err;
  });
}

function cleanupVersions(program) {
  const url = urlJoin(program.apiUrl,
    `/apps/${program.website.appId}/versions/cleanup`);

  log.debug('Update version status to timedOut');
  return api.post({url, authToken: program.authToken});
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
  if (program.unitTest || process.env.CI) {
    log.info(message);
    return {isSpinning: () => false, stop: () => {}};
  }

  process.stdout.write('     ' + chalk.dim(message));
  var spinner = new Spinner('     %s');
  spinner.setSpinnerString('|/-\\');
  spinner.start();
  process.stdout.write('\n');
  return spinner;
}
