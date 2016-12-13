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
const wordwrap = require('wordwrap');

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
  .option('--app-id [appId]')
  .option('-n, --name [siteName]')
  .option('-m, --message [message]')
  .option('-s, --stage [stage]')
  .option('-d, --directory [deployDir]')
  .option('-S, --source [source]')
  .option('-r, --repo [repo]');

// Create new application
program
  .command('create')
  .action(commandAction(require('../commands/create')));

// program
//   .command('delete-app')
//   .description('Delete an existing application')
//   .action(commandAction('delete-app', {
//     requireAuth: true,
//     loadWebsite: true,
//     loadManifest: false
//   }));

// List the applications for an organization
program
  .command('account')
  .action(commandAction(require('../commands/account')));

program
  .command('api-key')
  .action(commandAction(require('../commands/api-key')));

program
  .command('reset-api-key')
  .action(commandAction(require('../commands/reset-api-key')));

program
  .command('info')
  .action(commandAction(require('../commands/info'), {
    loadWebsite: true,
    requireAuth: true
  }));

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
//     loadWebsite: true,
//     subCommand: 'set'
//   }));

// List the environment variables
// program
//   .command('list-env')
//   .description('List the environment variables')
//   .action(commandAction('env', {
//     requireAuth: true,
//     loadManifest: true,
//     loadWebsite: true,
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
//     loadWebsite: true,
//     subCommand: 'delete'
//   }));

// Deploy app version
program
  .option('-d, --directory [deployDir]')
  .option('-i, --ignore [ignore]')
  .command('deploy')
  .action(commandAction(require('../commands/deploy'), {
    loadWebsite: true,
    loadManifest: true
  }));

program
  .command('login')
  .action(commandAction(require('../commands/login'), {
    requireAuth: false
  }));

program
  .command('rename')
  .action(commandAction(require('../commands/rename'), {
    loadManifest: true,
    loadWebsite: true
  }));

program
  .command('register')
  .action(commandAction(require('../commands/register'), {
    requireAuth: false
  }));

program
  .command('switch')
  .action(commandAction(require('../commands/switch')));

program.command('help')
  .action(commandAction(require('../commands/help')), {
    requireAuth: false
  });

program.command('logs')
  .action(commandAction(require('../commands/logs'), {
    loadWebsite: true,
    requireAuth: true
  }));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  require('../commands/help')(program);
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
        // console.log
        if (err.status === 401) {
          output(chalk.dim('Invalid authToken. Try logging in first with ') + chalk.green.underline('aero login'));
        } else if (err.formatted === true) {
          output(chalk.dim('Error:'));
          output(wordwrap(4, 70)(err.message));
        } else {
          log.error(Error.toJson(err));
          output(chalk.dim('Unexpected error:'));
          output(wordwrap(4, 70)(chalk.red(err.message)));
          if (process.env.NODE_ENV !== 'production' || program.debug) {
            output(err.stack);
          }
        }
        output.blankLine();

        process.exit(1);
      });
  };
}
