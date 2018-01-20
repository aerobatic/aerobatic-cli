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
  const downloadId = Date.now().toString();
  const tempExtractDir = path.join(osenv.tmpdir(), downloadId);
  const tempArchive = path.join(osenv.tmpdir(), downloadId + '.archive');
  log.debug('Temp archive path %s', tempArchive);

  return fs
    .emptyDir(tempExtractDir)
    .then(() => downloadTempArchive(url, tempArchive))
    .then(archiveFileType => {
      var mimeType;
      if (archiveFileType) mimeType = archiveFileType.mime;

      log.debug('Extract archive to %s', tempExtractDir);
      return extractArchive(mimeType, tempArchive, tempExtractDir);
    })
    .then(() => {
      // Check if the extract directory contains just a single folder.
      // If so, advance to that folder.
      var moveDirectory = tempExtractDir;
      const files = fs.readdirSync(tempExtractDir);
      if (files.length === 1) {
        if (fs.lstatSync(path.join(tempExtractDir, files[0])).isDirectory()) {
          log.debug('Archive has a single root directory, strip it off');
          moveDirectory = path.join(tempExtractDir, files[0]);
        }
      }

      log.debug('Move extracted files to dest directory');
      return fs.move(moveDirectory, destDirectory, {clobber: true});
    })
    .then(() => {
      return Promise.all([fs.remove(tempArchive), fs.remove(tempExtractDir)]);
    });
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
          return reject(
            Error.create('Source archive ' + url + ' could not be found.', {
              formatted: true
            })
          );
        }
        if (
          resp.statusCode === 403 &&
          url.indexOf('/aerobatic-themes') !== -1
        ) {
          return reject(Error.create('Invalid quick start', {formatted: true}));
        }
        if (resp.statusCode !== 200) {
          downloadError = true;
          return reject(
            Error.create(
              'Received status ' +
                resp.statusCode +
                ' trying to download archive from ' +
                url +
                '.',
              {formatted: true}
            )
          );
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
        readStream
          .pipe(unzip.Extract({path: destDirectory}))
          .on('end', resolve)
          .on('error', err => {
            reject(
              Error.create('Error extracting zip: ' + err.message, {
                formatted: true
              })
            );
          })
          // Important that we wait for "close" event, not "finish".
          .on('close', resolve);
      });
    case 'application/gzip':
      return new Promise((resolve, reject) => {
        readStream.pipe(
          unpack(destDirectory, {strip: 0}, err => {
            if (err) {
              return reject(
                Error.create(
                  'Error extracting source tarball: ' + err.message,
                  {formatted: true}
                )
              );
            }
            resolve();
          })
        );
      });
    default:
      return Promise.reject(
        Error.create('Unsupported source mimetype ' + mimeType, {
          formatted: true
        })
      );
  }
}
