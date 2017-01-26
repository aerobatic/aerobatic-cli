const urlJoin = require('url-join');
const config = require('config');

// Build the URL to the upgrade website page in the control panel
module.exports.upgradeWebsite = function(website) {
  return urlJoin(config.dashboardUrl,
    website.customerId, website.name, 'upgrade');
};
