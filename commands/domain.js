// Register a custom domain for a website
const chalk = require('chalk');
const _ = require('lodash');
const log = require('winston');
const wordwrap = require('wordwrap');
const urlJoin = require('url-join');
const output = require('../lib/output');
const api = require('../lib/api');
const urls = require('../lib/urls');

const TROUBLESHOOTING_URL = 'http://bit.ly/2lbV2SC';
const DNS_SETUP_URL = 'http://bit.ly/2ll4B0c';
const SUPPORT_EMAIL = 'support@aerobatic.com';

module.exports = program => {
  // Validate that the domain name is valid.
  if (_.isString(program.name)) {
    return registerDomain(program);
  }

  if (program.reset) {
    return resendValidationEmail(program);
  }

  // If the command is run without a name arg then check the status of the domain
  return domainStatus(program);
};

function registerDomain(program) {
  output.blankLine();

  // Check if the current website already has a custom domain.
  if (!_.isEmpty(program.website.domainName)) {
    return Promise.reject(
      Error.create(
        'This website is already bound to the custom domain ' +
          chalk.yellow(program.website.domainName),
        {formatted: true}
      )
    );
  }

  // Cursory check that the domain name looks ok.
  if (!/^[.a-z0-9_-]+$/.test(program.name)) {
    return Promise.reject(
      Error.create('Domain name has invalid characters', {formatted: true})
    );
  }

  if (_.isEmpty(program.subdomain)) {
    return Promise.reject(
      Error.create('Missing --subdomain argument.', {formatted: true})
    );
  }

  if (
    program.subdomain !== '@' &&
    program.subDomain !== '*' &&
    !/^[a-z0-9-]{3,50}$/.test(program.subdomain)
  ) {
    return Promise.reject(
      Error.create(
        'Invalid sub-domain. Valid characters are ' +
          'letters, numbers, and dashes.',
        {formatted: true}
      )
    );
  }

  output('Register custom domain ' + chalk.bold(program.name));
  output.blankLine();

  // Validate that this website is on the pro plan.
  if (_.isEmpty(program.website.subscriptionPlan)) {
    return Promise.reject(
      Error.create(
        'In order to register a custom domain, this website ' +
          'first needs to be upgraded to the Pro plan. Visit the following URL to upgrade:\n' +
          chalk.yellow(urls.upgradeWebsite(program.website))
      )
    );
  }

  return createDomain(program)
    .then(domain => {
      // Update the application with the domain name.
      log.info(
        'Updating website %s to custom domain %s',
        program.website.appId,
        program.name
      );
      return api
        .put({
          url: urlJoin(program.apiUrl, `/apps/${program.website.appId}`),
          authToken: program.authToken,
          body: {
            domainName: domain.domainName,
            subDomain: program.subdomain,
            customerId: program.customerId
          }
        })
        .then(() => domain);
    })
    .then(domain => {
      displayNextSteps(domain);
      return domain;
    });
}

function domainStatus(program) {
  output.blankLine();
  if (_.isEmpty(program.website.domainName)) {
    return noCustomDomainMessage();
  }

  // Make api call to create the domain.
  return api
    .get({
      url: urlJoin(
        program.apiUrl,
        `/customers/${program.customerId}/domains?` +
          `domainName=${encodeURIComponent(program.website.domainName)}`
      ),
      authToken: program.authToken
    })
    .then(domain => {
      output(chalk.dim('Domain name:'));
      output('    ' + chalk.bold(domain.domainName));
      output.blankLine();

      switch (domain.status.toUpperCase()) {
        case 'REQUESTED':
          output(chalk.dim('Domain status:'));
          output(
            wordwrap(4, 80)(
              'Your domain has been requested. Try running ' +
                output.command('aero domain') +
                ' again in just a few moments. You will then be presented with your validation CNAME record.'
            )
          );
          break;

        case 'CERTIFICATE_PENDING':
          output(chalk.dim('Domain status:'));

          if (_.isObject(domain.dnsValidationRecord)) {
            output(
              wordwrap(4, 80)(
                'In order to begin the provisioning of this domain, you first need to ' +
                  'validate that you are the rightful owner. This is done by creating the ' +
                  'following CNAME with your DNS provider:'
              )
            );

            output.blankLine();
            output('     Name: ' + chalk.bold(domain.dnsValidationRecord.name));
            output(
              '    Value: ' + chalk.bold(domain.dnsValidationRecord.value)
            );
            output.blankLine();

            output(
              wordwrap(4, 80)(
                "If you've already created the record, it can take up to an hour " +
                  '(occasionally longer) for the record to be recoginized. An email will ' +
                  'be sent to ' +
                  chalk.underline(domain.contactEmail) +
                  ' once validation is complete. You can always ' +
                  'check on the current status of your domain by re-running ' +
                  output.command('aero domain') +
                  '.'
              )
            );

            output.blankLine();
            output(
              wordwrap(4, 80)(
                chalk.bold('IMPORTANT:') +
                  ' do not delete this CNAME after validation. It will be re-checked every time the certificate renews itself.'
              )
            );
          } else {
            output(
              wordwrap(4, 80)(
                'Certificate is still pending. A validation email was ' +
                  'sent to the email on the WHOIS record for the domain as well as ' +
                  'admin@' +
                  domain.domainName +
                  ' and webmaster@' +
                  domain.domainName +
                  ". If it's been more than 5 minutes since you registered the domain with Aerobatic, see " +
                  'these troubleshooting tips: ' +
                  chalk.yellow(TROUBLESHOOTING_URL)
              )
            );
            output.blankLine();
            output(
              '    You can trigger the validation email to be resent by running:'
            );
            output('    ' + output.command('aero domain --reset'));
          }
          output.blankLine();
          output(
            wordwrap(4, 80)(
              "If you need assistance, don't hesitate to contact us at " +
                chalk.underline(SUPPORT_EMAIL)
            )
          );
          break;
        case 'DISTRIBUTION_CREATING':
          output(chalk.dim('Domain status:'));
          output(
            wordwrap(4, 80)(
              'Your certificate has been approved and your CDN distribution ' +
                'is being provisioned. Once your distribution is ready, running this ' +
                ' same CLI command again will output the DNS value ' +
                " for your website's CNAME or ANAME. The process takes " +
                'anywhere from 30-60 minutes to complete from the time you initiated the domain.'
            )
          );

          output.blankLine();
          output(
            wordwrap(4, 80)(
              'Here is the DNS value you will use for your CNAME or ANAME record:'
            )
          );
          output.blankLine();
          output('    ' + chalk.bold(domain.dnsValue) + '.');
          output.blankLine();

          output(
            wordwrap(4, 80)(
              chalk.bold('IMPORTANT: ') +
                'If your DNS resolves to an existing live website hosted elsewhere, you should ' +
                chalk.bold('NOT') +
                ' update your DNS records yet. You can run ' +
                output.command('aero domain') +
                ' again and it will tell you when it is fully ready to go. An email will also be sent to ' +
                chalk.underline(domain.contactEmail) +
                '.'
            )
          );

          output.blankLine();
          output(
            wordwrap(4, 80)(
              'If this is a brand new domain, you can safely go ahead and setup DNS now and your URL will start to resolve as soon as provisioning is complete. Full documentation can be found at ' +
                chalk.yellow(DNS_SETUP_URL) +
                '. Contact ' +
                chalk.underline(SUPPORT_EMAIL) +
                ' if you need any assistance.'
            )
          );

          break;
        case 'DEPLOYED':
          // output(chalk.dim('DNS Value:'));
          // output('    ' + domain.dnsValue);
          // output.blankLine();

          output(chalk.dim('Domain status:'));
          output(
            wordwrap(4, 80)(
              'Your SSL certificate and CDN distribution are fully provisioned. Here is the DNS value to ' +
                'use for your CNAME or ANAME so that your website URL resolves to your Aerobatic CDN distribution:'
            )
          );

          output.blankLine();
          output('    ' + chalk.bold(domain.dnsValue) + '.');
          output.blankLine();

          output(
            wordwrap(4, 80)(
              'Full details on configuring DNS available at ' +
                chalk.yellow(DNS_SETUP_URL) +
                '. Contact ' +
                chalk.underline(SUPPORT_EMAIL) +
                ' if you need any assistance.'
            )
          );
          break;
        default:
          output('    Unknown domain status ' + domain.status);
          break;
      }
      output.blankLine();
      return null;
    });
}

function noCustomDomainMessage() {
  output('This website does not have a custom domain.');
  output(
    'You can register one by running ' +
      output.command('aero domain --name yourdomain.com')
  );
  output.blankLine();
  return Promise.resolve(null);
}

function createDomain(program) {
  // Make api call to create the domain.
  return api
    .post({
      url: urlJoin(program.apiUrl, `/customers/${program.customerId}/domains`),
      authToken: program.authToken,
      body: {
        customerId: program.customerId,
        domainName: program.name
      }
    })
    .catch(error => {
      if (error.status === 400) {
        throw Error.create(error.message, {formatted: true});
      }
      throw error;
    });
}

function resendValidationEmail(program) {
  if (_.isEmpty(program.website.domainName)) {
    return noCustomDomainMessage();
  }

  return api
    .post({
      url: urlJoin(
        program.apiUrl,
        `/customers/${program.customerId}/domains/resend`
      ),
      authToken: program.authToken,
      body: {
        domainName: program.website.domainName
      }
    })
    .then(() => {
      output.blankLine();
      output('     ' + chalk.green('Validation email has been resent.'));
    });
}

function displayNextSteps() {
  // Display next steps to the user.
  output(
    wordwrap(4, 80)(
      'Please run ' +
        output.command('aero domain') +
        ' (with no arguments) in about 30 seconds. You will be presented with ' +
        'the CNAME you need to create to validate domain ownership. Once this CNAME is detected the ' +
        'provisioning of your SSL certificate and CDN distribution will start.'
    )
  );

  output.blankLine();

  output(
    wordwrap(4, 80)(
      "If you need any assistance, don't hesitate to contact us at " +
        chalk.underline(SUPPORT_EMAIL)
    )
  );
  output.blankLine();
}
