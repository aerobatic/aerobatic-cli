const _ = require('lodash');
const chalk = require('chalk');

var display;
module.exports = display = (msg, indent) => {
  console.log((_.isNumber(indent) ? _.repeat(' ', indent) : '') + msg);
};

_.assign(display, {
  yellow,
  success,
  command,
  space10,
  blankLine
});

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
