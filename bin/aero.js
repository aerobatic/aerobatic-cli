#!/usr/bin/env node

require('any-promise/register/bluebird');

const path = require('path');
const program = require('commander');
const _ = require('lodash');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
const winston = require('winston');
const chalk = require('chalk');
const output = require('../lib/output');

require('simple-errors');

// Need to look for the --env arg as early as possible before the config module
// has a chance to be require'd. Waiting for commander to parse process.argv
// is too late.
const envArgIndex = process.argv.indexOf('--env');
if (envArgIndex !== -1 && envArgIndex < process.argv.length - 1) {
  process.env.NODE_ENV = process.argv[envArgIndex + 1];
} else {
  process.env.NODE_ENV = 'production';
}
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../config');

winston.remove(winston.transports.Console);
winston.add(winston.transports.File, {
  filename: path.join(process.cwd(), 'aero-debug.log')
});

const log = winston;

updateNotifier({
  packageName: pkg.name,
  packageVersion: pkg.version,
  updateCheckInterval: 1000 * 60 * 60 * 2 // Check for updates every 2 hours
}).notify();

program.version(pkg.version)
  .option('--debug', 'Emit debug messages')
  .option('--customer [customerId]', 'The id of the Aerobatic customer account to perform the command on behalf of.')
  // Use command line switch to control NODE_ENV since this is running on local desktop
  .option('--env [nodeEnv]', 'Override the NODE_ENV', 'production')
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

process.on('SIGINT', () => {
  output.blankLine();
  output.yellow('Aborted');

  process.exit(1);
});

function commandAction(command, commandOptions) {
  // Extend any options from program to options.
  return () => {
    if (process.env.NODE_ENV === 'development' || program.debug) {
      winston.level = 'debug';
    }

    // Don't require config until after NODE_ENV has been set
    const config = require('config');

    log.debug('Config environment is %s', config.util.getEnv('NODE_ENV'));

    _.defaults(program, {
      cwd: process.cwd(),
      customerId: process.env.AERO_CUSTOMER,
      subCommand: (commandOptions || {}).subCommand
    });

    // Run the command
    require('../lib/cli-init')(program, commandOptions)
      .then(() => command(program))
      .catch(err => {
        output.blankLine();
        if (err.status === 401) {
          output(chalk.dim('Invalid authToken. Try logging in first with ') + chalk.green.underline('aero login'));
        } else if (err.formatted === true) {
          output(err.message);
        } else {
          log.error(Error.toJson(err));
          output(chalk.dim('Unexpected error:'));
          output(chalk.red(err.message));
        }
        output.blankLine();

        process.exit(1);
      });
  };
}
