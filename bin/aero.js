#!/usr/bin/env node

require('any-promise/register/bluebird');

const program = require('commander');
const _ = require('lodash');
const updateNotifier = require('update-notifier');
const shortid = require('shortid');
const pkg = require('../package.json');
const winston = require('winston');
const cliInit = require('../lib/cli-init');

require('simple-errors');

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  timestamp: false,
  colorize: true
});

const log = winston;

// Limit any generated IDs to alpha-numeric characters
shortid.characters(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$-');

updateNotifier({
  packageName: pkg.name,
  packageVersion: pkg.version,
  updateCheckInterval: 1000 * 60 * 60 * 2 // Check for updates every 2 hours
}).notify();

program.version(pkg.version)
  .option('--debug', 'Emit debug messages')
  .option('--customer [customerId]', 'The id of the Aerobatic customer account to perform the command on behalf of.')
  // .option('--token [token]', 'JSON web token')
  .option('--app-id [appId]', 'Set appId (in place of the one defined in package.json)');

// Create new application
program
  .option('-n, --app-name [appName]', 'The unique name of the application')
  .command('create')
  .description('Create a new Aerobatic app from the current working directory')
  .action(commandAction(require('../commands/create')));

// program
//   .command('delete-app')
//   .description('Delete an existing application')
//   .action(commandAction('delete-app', {
//     requireAuth: true,
//     loadVirtualApp: true,
//     loadManifest: false
//   }));

// List the applications for an organization
program
  .command('list')
  .description('List the applications for customer account')
  .action(commandAction(require('../commands/list')));

// Set an environment variable
// program
//   .option('--key [key]')
//   .option('--value [value]')
//   .option('--virtual-env [virtualEnv]')
//   .option('--encrypt')
//   .command('set-env')
//   .description('Set an environment variable')
//   .action(commandAction('env', {
//     requireAuth: true,
//     loadManifest: true,
//     loadVirtualApp: true,
//     subCommand: 'set'
//   }));

// List the environment variables
// program
//   .command('list-env')
//   .description('List the environment variables')
//   .action(commandAction('env', {
//     requireAuth: true,
//     loadManifest: true,
//     loadVirtualApp: true,
//     subCommand: 'list'
//   }));
//
//   // Set an environment variable
// program
//   .option('--key [key]')
//   .option('--virtual-env [virtualEnv]')
//   .command('delete-env')
//   .description('Deletes an environment variable')
//   .action(commandAction('env', {
//     requireAuth: true,
//     loadManifest: true,
//     loadVirtualApp: true,
//     subCommand: 'delete'
//   }));

// Deploy app version
program
  .option('-m, --message [versionMessage]', 'Version message')
  .option('-s, --stage', 'Stage to deploy to')
  .option('-d, --directory [deployDir]', 'The directory containing the files to deploy')
  .option('-i, --ignore [ignore]', 'Glob patterns for files to exclude from the deployment.')
  .option('--open', 'Open the newly deployed version in a browser tab', false)
  .command('deploy')
  .description('Deploy a new version of the application')
  .action(commandAction(require('../commands/deploy'), {
    loadVirtualApp: true,
    loadManifest: true
  }));

program
  .option('-u --email [email]', 'Email username')
  .command('login')
  .description('Login to Aerobatic to generate a new JWT in the ~/.aerobatic.json file')
  .action(commandAction(require('../commands/login'), {
    requireAuth: false
  }));

program.command('*')
  .action(() => {
    log.error('Invalid command ' + process.argv.slice(2));
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

if (program.debug) {
  winston.level = 'debug';
}

process.on('exit', () => {
  log.debug('Exiting');
});

function commandAction(command, commandOptions) {
  // debugger;
  // Extend any options from program to options.
  return () => {
    _.defaults(program, {
      cwd: process.cwd(),
      customerId: process.env.AERO_CUSTOMER,
      subCommand: (commandOptions || {}).subCommand
    });

    // Run the command
    log.debug('Initialize the CLI');
    cliInit(program, commandOptions)
      .then(() => command(program))
      .catch(err => {
        if (err.status === 401) {
          log.error('Invalid authToken. Try logging in first with `aero login`.');
        } else {
          const errMessage = err.message;

          if (err.status === 500 && program.debug) {
            var errorJson = _.omit(Error.toJson(err), 'message');
            log.error(errMessage + ': %j', errorJson);
          } else {
            log.error(errMessage);
          }
        }

        process.exit(1);
      });
  };
}
