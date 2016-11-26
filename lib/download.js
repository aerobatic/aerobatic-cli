const request = require('request');
const fs = require('fs-promise');
const fileType = require('file-type');
const osenv = require('osenv');
const unpack = require('tar-pack').unpack;
const unzip = require('unzip');
const path = require('path');
const log = require('winston');

require('simple-errors');

// Download source code from a tarball or zip file and
// extract to a directory.

module.exports = (url, destDirectory) => {
  const tempArchive = path.join(osenv.tmpdir(), Date.now() + '.archive');
  log.debug('Temp archive path %s', tempArchive);
  return downloadTempArchive(url, tempArchive)
    .then(archiveFileType => {
      var mimeType;
      if (archiveFileType) mimeType = archiveFileType.mime;
      return extractArchive(mimeType, tempArchive, destDirectory);
    })
    .then(() => fs.remove(tempArchive));
};

function downloadTempArchive(url, tempArchive) {
  var archiveFileType;
  var downloadError;

  return new Promise((resolve, reject) => {
    log.debug('Downloading file %s', url);
    request(url)
      .on('response', resp => {
        if (resp.statusCode === 404) {
          downloadError = true;
          return reject(Error.create('Source archive ' + url + ' could not be found.', {formatted: true}));
        }
        if (resp.statusCode !== 200) {
          downloadError = true;
          return reject(Error.create('Received status ' + resp.statusCode +
            ' trying to download archive from ' + url + '.', {formatted: true}));
        }
      })
      .once('data', chunk => {
        archiveFileType = fileType(chunk);
        if (archiveFileType) {
          log.debug('Detected archive file type of %s', archiveFileType.mime);
        }
      })
      .pipe(fs.createWriteStream(tempArchive))
      .on('finish', () => {
        if (downloadError) return;
        log.debug('Done downloading');
        resolve(archiveFileType);
      })
      .on('error', err => {
        if (downloadError) return;
        throw err;
      });
  });
}

function extractArchive(mimeType, archiveFile, destDirectory) {
  var readStream = fs.createReadStream(archiveFile);
  switch (mimeType) {
    case 'application/zip':
      log.debug('Extract zip file');
      return new Promise((resolve, reject) => {
        readStream.pipe(unzip.Extract({path: destDirectory}))
          .on('end', resolve)
          .on('error', err => {
            reject(Error.create('Error extracting zip: ' + err.message, {formatted: true}));
          })
          .on('finish', resolve);
      });
    case 'application/gzip':
      return new Promise((resolve, reject) => {
        readStream.pipe(unpack(destDirectory, err => {
          if (err) {
            return reject(Error.create('Error extracting source tarball: ' + err.message, {formatted: true}));
          }
          resolve();
        }));
      });
    default:
      return Promise.reject(Error.create('Unsupported source mimetype ' + mimeType, {formatted: true}));
  }
}
