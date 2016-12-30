const _ = require('lodash');
const chalk = require('chalk');
const pkg = require('../package.json');

var display;
module.exports = display = (msg, indent) => {
  if (process.env.UNIT_TEST) return;
  console.log((_.isNumber(indent) ? _.repeat(' ', indent) : '') + msg);
};

_.assign(display, {
  intro,
  yellow,
  success,
  command,
  space10,
  blankLine
});

function intro() {
  if (process.env.UNIT_TEST) return;
  console.log();

  var text = chalk.bold('Aerobatic') + ' - Professional static web publishing. '
    + chalk.dim('(v' + pkg.version + ')');

  if (process.env.NODE_ENV !== 'production') {
    text += ' ' + chalk.yellow('[' + process.env.NODE_ENV.toUpperCase() + ']');
  }

  console.log(text + '\n');
}

function blankLine() {
  if (process.env.UNIT_TEST) return;
  console.log('');
}

function success(msg) {
  if (process.env.UNIT_TEST) return;
  console.log(chalk.green(msg));
}

function yellow(msg) {
  if (process.env.UNIT_TEST) return;
  console.log(chalk.yellow(msg));
}

function command(text) {
  if (process.env.UNIT_TEST) return;
  return chalk.green.underline(text);
}

function space10() {
  if (process.env.UNIT_TEST) return;
  return _.repeat(' ', 10);
}
