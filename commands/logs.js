// Command to switch the current account.
const log = require('winston');
const _ = require('lodash');
const urlJoin = require('url-join');
const chalk = require('chalk');
const Promise = require('bluebird');
const promiseUntil = require('promise-until');

const api = require('../lib/api');
const output = require('../lib/output');

module.exports = program => {
  var lastTimestamp;

  log.debug('Load latest web logs');
  return fetchLatestEntries().then(() => {
    return promiseUntil(
      () => false,
      () => {
        return Promise.delay(3000).then(() => fetchLatestEntries());
      }
    );
  });

  function fetchLatestEntries() {
    var url = `/apps/${program.website.appId}/logs/latest`;
    if (lastTimestamp) url += '?lastTimestamp=' + lastTimestamp;

    return api
      .get({
        url: urlJoin(program.apiUrl, url),
        authToken: program.authToken
      })
      .then(results => {
        // eslint-disable-next-line
        lastTimestamp = results.lastTimestamp;

        results.entries.forEach(entry => {
          if (program.format === 'json') {
            output(JSON.stringify(entry));
          } else {
            // Apache combined log format.
            // morgan.format('combined', ':remote-addr - :remote-user [:date[clf]]
            // ":method :url HTTP/:http-version" :status :res[content-length]
            // ":referrer" ":user-agent"')
            // https://github.com/expressjs/morgan/blob/master/index.js
            output(
              [
                _.padEnd(entry.ip, 15, ' '),
                chalk.yellow(entry.timestamp),
                entry.statusCode,
                entry.method + ' HTTP/' + entry.httpVersion,
                entry.url,
                geoipLocation(entry),
                entry.awsRegion
              ].join(' - ')
            );
          }
        });
        return null;
      });
  }
};

function geoipLocation(entry) {
  const locInfo = _.compact([entry.city, entry.region, entry.country]);
  if (locInfo.length === 0) return '';
  return '"' + locInfo.join(', ') + '"';
}
