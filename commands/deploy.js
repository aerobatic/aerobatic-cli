const log = require('winston');
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');
const config = require('config');
const urlJoin = require('url-join');
const tar = require('tar');
const uuid = require('uuid');
const Promise = require('bluebird');
const wordwrap = require('wordwrap');
const promiseUntil = require('promise-until');
const minimatch = require('minimatch');
const {exec} = require('child_process');
const ora = require('ora');
const api = require('../lib/api');
const manifest = require('../lib/manifest');
const output = require('../lib/output');
const urls = require('../lib/urls');

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.*',
  '.*/**',
  '*.tar.gz',
  '**/README.*',
  'LICENSE',
  '**/*.less',
  '**/*.scss',
  '**/*.php',
  '**/*.asp',
  '**/*.DS_STORE',
  'package.json',
  '*.log',
  'aero-deploy.tar.gz',
  '**/.git/**',
  manifest.fileName
];

// Command to create a new website version
module.exports = program => {
  const deployStage = program.stage || 'production'.replace(/[^a-z0-9-]/g, '-');

  output.blankLine();
  output(
    'Deploy new Aerobatic website version to stage ' + chalk.bold(deployStage)
  );
  output.blankLine();

  _.defaults(program, {
    uploader: require('../lib/uploader')
  });

  // Default to
  _.defaults(program, {
    versionId: uuid.v4(),
    deployStage: 'production'
  });

  if (!/^[a-z0-9-]{3,50}$/.test(deployStage)) {
    return Promise.reject(
      Error.create(
        'Invalid deploy stage arg. Must consist ' +
          'only of lowercase letter, numbers, and dashes.',
        {formatted: true}
      )
    );
  }

  const deployManifest = program.appManifest.deploy;

  // First check for a command line  followed by a value in the manifest.
  var deployDirectory = program.directory || deployManifest.directory;
  var deployPath;
  program.bundleFileCount = 0;

  return Promise.resolve()
    .then(() => {
      if (_.isArray(deployManifest.build)) {
        return runBuildSteps(program, deployManifest.build);
      }
      return null;
    })
    .then(() => {
      // If there is a directory specified in the deploy manifest, ensure that the
      // sub-directory exists.
      if (deployDirectory && deployDirectory !== '.') {
        deployPath = path.join(program.cwd, deployDirectory);

        log.debug('Ensure deployPath %s exists', deployPath);
        if (!fs.existsSync(deployPath)) {
          throw Error.create(
            'The deploy directory ' + deployDirectory + ' does not exist.',
            {formatted: true}
          );
        }
      } else {
        deployPath = program.cwd;
      }

      return verifyDeployAssets(deployPath, program);
    })
    .then(() => createTarball(deployPath, program))
    .then(tarballFile => {
      return uploadTarballToS3(program, deployStage, tarballFile);
    })
    .then(() => {
      const url = urlJoin(
        program.apiUrl,
        `/apps/${program.website.appId}/versions`
      );
      const postBody = {
        versionId: program.versionId,
        message: program.message,
        manifest: _.omit(program.appManifest, 'appId'),
        commitUrl: program.commitUrl,
        keyFormat: 'v2'
      };

      log.debug('Invoke API to create version %s', program.versionId);
      return api.post({url, authToken: program.authToken, body: postBody});
    })
    .then(version => waitForDeployComplete(program, deployStage, version))
    .then(version => {
      output.blankLine();
      var message = 'Version ' + version.name + ' deployment complete';
      if (
        _.isObject(version.metadata) &&
        _.isNumber(version.metadata.duration)
      ) {
        message += ' - ' + version.metadata.duration + 'ms';
      }

      output(message);
      output('View now at ' + chalk.underline.yellow(version.deployedUrl));
      output.blankLine();
    })
    .catch(err => {
      if (err.code === 'invalidManifest') {
        output.blankLine();
        output(
          '     ' + chalk.red('The aerobatic.yml has the following errors:')
        );
        output.blankLine();
        err.errors.forEach(message => {
          output('     * ' + chalk.dim(message));
        });
        throw Error.create('Already handled', {doNothing: true});
      } else if (err.code === 'appTrialOver') {
        output.blankLine();
        output('     --- ' + chalk.bold('FREE TRIAL HAS ENDED') + ' --');
        output('     Please upgrade to the Pro Plan to reactivate.');
        output('     ' + chalk.yellow(urls.upgradeWebsite(program.website)));
        throw Error.create('Already handled', {doNothing: true});
      } else {
        throw err;
      }
    });
};

function verifyDeployAssets(deployDirectory, program) {
  // Check if this appears to be a Jekyll site.
  return Promise.resolve()
    .then(() => {
      if (program.force === true) return null;

      return warnIfStaticGeneratorConfig(
        deployDirectory,
        '_config.yml',
        'Jekyll',
        '_site'
      ).then(() =>
        warnIfStaticGeneratorConfig(
          deployDirectory,
          'config.toml',
          'Hugo',
          'public'
        )
      );
    })
    .then(() => {
      // Ensure that there is a index.html in the deployDirectory
      return fs
        .exists(path.join(deployDirectory, 'index.html'))
        .then(exists => {
          if (!exists) {
            throw Error.create(
              'No index.html file exists in the deploy directory',
              {formatted: true}
            );
          }
        });
    });
}

function warnIfStaticGeneratorConfig(
  deployDirectory,
  configFile,
  generatorName,
  outputDirectory
) {
  return fs.exists(path.join(deployDirectory, configFile)).then(exists => {
    if (!exists) return null;

    output(
      wordwrap(4, 70)(
        chalk.yellow('WARNING:') +
          ' Detected a ' +
          configFile +
          ' file in the deploy directory. If this site is ' +
          'built with ' +
          generatorName +
          ' or another static site generator, you should ' +
          'run the following command:'
      )
    );
    output.blankLine();

    output(
      '    $ ' + chalk.green('aero deploy --directory ' + outputDirectory)
    );
    output.blankLine();
    output(
      wordwrap(4, 70)(
        'Or you can set the directory option in the deploy section of your aerobatic.yml file:'
      )
    );

    output.blankLine();
    output(chalk.dim('    deploy:'));
    output(chalk.dim('       directory: ' + outputDirectory));

    output.blankLine();
    output(
      '    If you know what you are doing, you can override this warning by passing the --force option.'
    );
    throw Error.create('', {
      code: 'staticGeneratorConfigInDeployDir',
      doNothing: true
    });
  });
}

function createTarball(deployDirectory, program) {
  const spinner = startSpinner(program, 'Compressing website assets');
  const deployManifest = program.appManifest.deploy;

  var ignorePatterns = [].concat(IGNORE_PATTERNS);
  if (_.isArray(deployManifest.ignorePatterns)) {
    ignorePatterns = ignorePatterns.concat(deployManifest.ignore);
  }

  const filter = (pathname, stat) => {
    if (pathname.startsWith(`${program.website.name}/`)) {
      pathname = pathname.substr(program.website.name.length + 1);
    }
    log.debug('test filter for entry %s', pathname);

    // Attempt to fix issue with Windows needing the execute bit
    // set on directories.
    // https://github.com/npm/node-tar/issues/7#issuecomment-17572926
    // https://github.com/sindresorhus/gulp-zip/issues/64#issuecomment-205324031
    if (stat.isDirectory()) {
      log.debug('Set mode of directory to 777');
      stat.mode = parseInt('40777', 8); // eslint-disable-line
    }

    const include = !_.some(ignorePatterns, pattern =>
      minimatch(pathname, pattern)
    );
    if (include) {
      program.bundleFileCount += 1;
    }
    return include;
  };

  const tarballFile = path.join(program.cwd, 'aero-deploy.tar.gz');
  fs.removeSync(tarballFile);

  return new Promise((resolve, reject) => {
    log.debug('Create deployment bundle %s', tarballFile);

    tar.create(
      {
        gzip: true,
        filter,
        file: tarballFile,
        prefix: program.website.name,
        cwd: deployDirectory
      },
      fs.readdirSync(deployDirectory),
      err => {
        spinner.succeed();
        if (err) {
          return reject(err);
        }
        resolve(tarballFile);
      }
    );
  });
}

function uploadTarballToS3(program, deployStage, tarballFile) {
  const spinner = startSpinner(program, 'Uploading archive to Aerobatic');
  log.debug(
    'Invoke API to get temporary AWS credentials for uploading tarball to S3'
  );

  return Promise.resolve()
    .then(() => {
      return api
        .get({
          url: urlJoin(
            program.apiUrl,
            `/customers/${program.website.customerId}/deploy-creds`
          ),
          authToken: program.authToken
        })
        .catch(err => {
          throw Error.create(
            'Error getting deploy creds: ' + err.message,
            {},
            err
          );
        });
    })
    .then(creds => {
      // Use the temporary IAM creds to create the S3 connection
      return program.uploader({
        creds: _.mapKeys(creds, (value, key) => _.camelCase(key)),
        tarballFile,
        key: program.website.appId + '/' + program.versionId + '.tar.gz',
        bucket: program.deployBucket,
        metadata: {
          stage: deployStage,
          // S3 metadata must be strings
          fileCount: program.bundleFileCount.toString()
        }
      });
    })
    .then(() => {
      spinner.succeed();
    })
    .catch(err => {
      spinner.fail();
      console.log(err);
      throw Error.create('Error uploading to S3: ' + err.message, {}, err);
    });
}

// Poll the api for the version until the status is no longer "running".
function waitForDeployComplete(program, deployStage, version) {
  const queueSpinner = startSpinner(
    program,
    'Waiting for cloud deployment to begin'
  );
  var runningSpinner;

  var latestVersionState = version;
  const url = urlJoin(
    program.apiUrl,
    `/apps/${program.website.appId}/versions/${
      version.versionId
    }?stage=${deployStage}`
  );

  const stopSpinners = () => {
    if (queueSpinner.isSpinning) queueSpinner.succeed();
    if (runningSpinner && runningSpinner.isSpinning) runningSpinner.succeed();
  };

  const startTime = Date.now();

  return promiseUntil(
    () => {
      if (Date.now() - startTime > config.deployTimeoutSeconds * 1000) {
        throw Error.create('Deployment has timed out', {
          code: 'deploymentTimedOut'
        });
      }

      switch (latestVersionState.status) {
        case 'queued':
        case 'running':
          if (queueSpinner.isSpinning) queueSpinner.succeed();
          if (!runningSpinner) {
            runningSpinner = startSpinner(
              program,
              'Cloud deployment in-progress'
            );
          }
          return false;
        case 'complete':
          stopSpinners();
          return true;
        case 'failed':
          stopSpinners();
          throw new Error(
            'Version deployment failed with message: ' +
              latestVersionState.error
          );
        default:
          throw new Error(
            'Unexpected version status: ' + latestVersionState.status
          );
      }
    },
    () => {
      return Promise.delay(config.pollVersionStatusInterval)
        .then(() => {
          log.debug('Checking on version status');
          return api.get({url, authToken: program.authToken});
        })
        .then(updatedVersion => {
          latestVersionState = updatedVersion;
        });
    }
  )
    .then(() => {
      return latestVersionState;
    })
    .catch(err => {
      // If deployment timed out, update the version status and re-throw
      if (err.code === 'deploymentTimedOut') {
        return cleanupVersions(program).then(() => {
          throw err;
        });
      }
      throw err;
    });
}

function runBuildSteps(program, steps) {
  log.debug('Running pre-deploy build steps in dir ' + program.cwd);
  const spinner = startSpinner(program, 'Building site');
  return Promise.each(steps, step => {
    return new Promise((resolve, reject) => {
      exec(step, {cwd: program.cwd}, (err, stepOutput) => {
        if (err) return reject(err);
        log.debug(stepOutput.toString());
        resolve();
      });
    });
  }).then(() => {
    spinner.stop(true);
  });
}

function cleanupVersions(program) {
  const url = urlJoin(
    program.apiUrl,
    `/apps/${program.website.appId}/versions/cleanup`
  );

  log.debug('Update version status to timedOut');
  return api.post({url, authToken: program.authToken});
}

function startSpinner(program, message) {
  // Assume if there is an AEROBATIC_API_KEY this is running in a CI build.
  // Don't show spinners, it just messes up the CI log output.
  if (program.unitTest || process.env.CI) {
    log.info(message);
    return {isSpinning: false, succeed: () => {}, fail: () => {}};
  }

  return ora({text: message, color: 'white'}).start();
}
