#! /usr/bin/env node

require('any-promise/register/bluebird');

const path = require('path');
const program = require('commander');
const _ = require('lodash');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
const winston = require('winston');
const chalk = require('chalk');
const fs = require('fs');
const dotenv = require('dotenv');
const output = require('../lib/output');
const wordwrap = require('wordwrap');

require('simple-errors');

// Look for a .env file two levels up and in the current directory
const dotenvPaths = [path.join(process.cwd(), '../'), process.cwd()];
dotenvPaths.forEach(dir => {
  const filePath = path.join(dir, '.env');
  if (fs.existsSync(filePath)) {
    const envConfig = dotenv.parse(fs.readFileSync(filePath));

    _.forEach(envConfig, (value, key) => {
      if (_.startsWith(key, 'AEROBATIC_')) {
        process.env[key] = value;
      }
    });
  }
});

if (process.env.AEROBATIC_ENV) {
  process.env.NODE_ENV = process.env.AEROBATIC_ENV;
} else {
  process.env.NODE_ENV = 'production';
}
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../config');

// If the CI environment variables is not set and there is an AEROBATIC_API_KEY
// then assume this is a CI env.
if (!process.env.CI && process.env.AEROBATIC_API_KEY) {
  process.env.CI = 1;
}

// If this is not a CI build then log to a file rather than stdout
if (!process.env.CI) {
  winston.remove(winston.transports.Console);
  winston.add(winston.transports.File, {
    filename: path.join(process.cwd(), 'aero-debug.log')
  });
}

const log = winston;

updateNotifier({
  packageName: pkg.name,
  packageVersion: pkg.version,
  updateCheckInterval: 1000 * 60 * 60 * 2 // Check for updates every 2 hours
}).notify();

program.version(pkg.version)
  .option('--debug', 'Emit debug messages')
  .option('--customer [customerId]', 'The id of the Aerobatic customer account to perform the command on behalf of.')
  .option('-n, --name [name]')
  .option('-v, --value [value]')
  .option('-N, --subdomain [subdomain]')
  .option('-m, --message [message]')
  .option('-s, --stage [stage]')
  .option('-d, --directory [directory]')
  .option('-S, --source [source]')
  .option('-t, --theme [theme]')
  .option('-r, --repo [repo]')
  .option('-c, --commit-url [commitUrl]')
  .option('-R, --reset [reset]')
  .option('-f, --format [format]')
  .option('-D, --delete')
  .option('-f, --force');

// Create new website
program
  .command('create')
  .action(commandAction(require('../commands/create')));

program
  .command('delete')
  .action(commandAction(require('../commands/delete'), {
    loadWebsite: true
  }));

program
  .command('account')
  .action(commandAction(require('../commands/account')));

program
  .command('apikey')
  .action(commandAction(require('../commands/apikey')));

program
  .command('info')
  .action(commandAction(require('../commands/info'), {
    loadWebsite: true,
    requireAuth: true
  }));

program
  .command('domain')
  .action(commandAction(require('../commands/domain'), {
    loadWebsite: true
  }));

// Set an environment variable
program
  .command('env')
  .action(commandAction(require('../commands/env'), {
    loadWebsite: true
  }));

// Deploy app version
program
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
  .command('validate')
  .action(commandAction(require('../commands/validate'), {
    loadManifest: true,
    requireAuth: false
  }));

program
  .command('switch')
  .action(commandAction(require('../commands/switch')));

program.command('help')
  .action(commandAction(require('../commands/help'), {
    requireAuth: false
  }));

program.command('logs')
  .action(commandAction(require('../commands/logs'), {
    loadWebsite: true,
    requireAuth: true
  }));

program.command('versions')
  .action(commandAction(require('../commands/versions'), {
    loadWebsite: true
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
        } else if (err.doNothing !== true) {
          log.error(Error.toJson(err));
          output(chalk.dim('Unexpected error:'));
          output(wordwrap(4, 70)(chalk.red(err.message)));
          if (process.env.NODE_ENV !== 'production' || program.debug) {
            output(JSON.stringify(Error.toJson(err)));
          }
        }
        output.blankLine();

        process.exit(1);
      });
  };
}
