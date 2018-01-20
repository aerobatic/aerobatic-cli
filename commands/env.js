const chalk = require('chalk');
const _ = require('lodash');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

module.exports = program => {
  // If a value argument is specified, then set the environment variable
  if (program.delete === true) {
    return deleteEnvironmentVariable(program);
  }
  if (program.value) {
    return setEnvironmentVariable(program);
  }

  // Otherwise read the env variables.
  return readEnvironmentVariable(program);
};

function readEnvironmentVariable(program) {
  output.blankLine();

  return api
    .get({
      url: urlJoin(program.apiUrl, `/apps/${program.website.appId}/env`),
      authToken: program.authToken
    })
    .then(resp => {
      output(chalk.dim('Environment variables:'));
      output.blankLine();

      output(JSON.stringify(resp, null, 2));

      output.blankLine();
    });
}

function setEnvironmentVariable(program) {
  output.blankLine();
  output('Setting environment variable ' + program.name);
  output.blankLine();

  return validateArgs(program, ['name', 'value'])
    .then(() => {
      return api.put({
        url: urlJoin(
          program.apiUrl,
          `/apps/${program.website.appId}/env/`,
          program.stage,
          program.name
        ),
        authToken: program.authToken,
        body: {
          value: program.value
        }
      });
    })
    .then(() => {
      output(chalk.dim('Value updated'));
      output.blankLine();
    });
}

function deleteEnvironmentVariable(program) {
  return validateArgs(program, ['name'])
    .then(() => {
      return api.delete({
        url: urlJoin(
          program.apiUrl,
          `/apps/${program.website.appId}/env/`,
          program.stage,
          program.name
        ),
        authToken: program.authToken
      });
    })
    .then(() => {
      output(
        chalk.dim(
          'Variable ' +
            program.name +
            ' deleted' +
            (program.stage ? ' for stage ' + program.stage : '')
        )
      );
    });
}

function validateArgs(program, whatToValidate) {
  if (_.includes(whatToValidate, 'name')) {
    if (!_.isString(program.name)) {
      return Promise.reject(
        Error.create('Must provide value for the --name option', {
          formatted: true
        })
      );
    }
    if (!/^[a-z0-9_-]{3,30}$/i.test(program.name)) {
      return Promise.reject(
        Error.create('Invalid environment variable name', {formatted: true})
      );
    }
  }

  if (_.includes(whatToValidate, 'value')) {
    if (!_.isString(program.value) || program.value.length === 0) {
      return Promise.reject(
        Error.create('Must provide value for the --value option', {
          formatted: true
        })
      );
    }
  }

  if (
    program.stage &&
    !_.includes(Object.keys(program.website.deployedVersions), program.stage)
  ) {
    return Promise.reject(
      Error.create('Invalid --stage option ' + program.stage, {formatted: true})
    );
  }

  return Promise.resolve();
}
