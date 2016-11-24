const _ = require('lodash');
const chalk = require('chalk');
const pkg = require('../package.json');

var display;
module.exports = display = (msg, indent) => {
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
  console.log();
  console.log(chalk.bold('Aerobatic') + ' - Professional static web publishing. ' + chalk.dim('(v' + pkg.version + ')\n'));
}

function blankLine() {
  console.log('');
}

function success(msg) {
  console.log(chalk.green(msg));
}

function yellow(msg) {
  console.log(chalk.yellow(msg));
}

function command(text) {
  return chalk.green.underline(text);
}

function space10() {
  return _.repeat(' ', 10);
}
