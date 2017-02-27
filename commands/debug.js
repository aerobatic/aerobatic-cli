const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');

module.exports = program => {
  output.blankLine();
  output('Running CLI diagnostics');

  return api.get({
    url: urlJoin(program.apiUrl, 'debug'),
    authToken: program.authToken
  })
  .then(info => {
    output(JSON.stringify(info, null, 2));
  });
};
