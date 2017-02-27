const log = require('winston');
const Promise = require('bluebird');
const klaw = require('klaw');
const _ = require('lodash');
const through2 = require('through2');
const path = require('path');
const md5File = require('md5-file');
const minimatch = require('minimatch');
const manifest = require('./manifest');

const IGNORE_PATTERNS = ['node_modules/**', '*.tar.gz', 'README.*', 'LICENSE',
  '**/*.less', '**/*.scss', '**/*.php', '**/*.asp', 'package.json', '*.log',
  '*.coffee', manifest.fileName];

module.exports = params => {
  params.files = {};
  // params.fileCount = 0;
  params.totalSize = 0;

  var ignorePatterns = [].concat(IGNORE_PATTERNS);
  if (_.isArray(params.ignorePatterns)) {
    ignorePatterns = ignorePatterns.concat(params.ignorePatterns);
  }

  const filter = through2.obj(function(item, enc, next) {
    if (item.stats.isDirectory()) return next();

    // Skip dot files
    if (_.startsWith(path.basename(item.path), '.')) return next();

    const relativePath = path.relative(params.deployPath, item.path);

    // Skip any files that match an ignore pattern
    if (_.some(ignorePatterns, pattern => minimatch(relativePath, pattern))) return next();

    this.push(item);

    params.totalSize += item.stats.size;

    log.debug('Hashing file: %j', {filePath: relativePath}, {});
    md5File(item.path, (err, hash) => {
      if (err) return next(err);
      params.files[relativePath] = hash;
      next();
    });
  });

  return new Promise((resolve, reject) => {
    klaw(params.deployPath)
      .pipe(filter)
      .on('finish', () => {
        log.debug('done collecting files');
        resolve();
      })
      .on('error', err => {
        reject(err);
      });
  });
};
