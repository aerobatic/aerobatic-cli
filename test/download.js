const express = require('express');
const path = require('path');
const fs = require('fs-promise');
const os = require('os');
const download = require('../lib/download');
const chai = require('chai');
const log = require('winston');
const expect = chai.expect;

log.level = 'debug';
const PORT = 1797;

describe('download', () => {
  var httpServer;

  before(done => {
    const app = express();
    app.get('/html5-template', (req, res) => {
      res.sendFile(path.join(__dirname, './fixtures/html5-template.zip'));
    });

    app.get('/stylish-portfolio', (req, res) => {
      res.sendFile(path.join(__dirname, './fixtures/stylish-portfolio.zip'));
    });

    app.get('/bootstrap-starter', (req, res) => {
      res.sendFile(path.join(__dirname, './fixtures/bootstrap-starter.tar.gz'));
    });

    app.get('/not-found', (req, res) => {
      res.status(404).end();
    });

    app.get('/invalid-archive', (req, res) => {
      res.set('Content-Type', 'text/plain').end('some text');
    });

    httpServer = app.listen(PORT, done);
  });

  after(done => {
    httpServer.close(done);
  });

  it('downloads zip file', () => {
    const destDir = path.join(os.tmpdir(), 'html5-template');
    log.debug('download and extract html5-template to %s', destDir);
    return download(
      'http://localhost:' + PORT + '/html5-template',
      destDir
    ).then(() => {
      expect(fs.existsSync(path.join(destDir, 'index.html'))).to.be.true;
      expect(fs.existsSync(path.join(destDir, 'assets/css/main.css'))).to.be
        .true;
      return;
    });
  });

  it('downloads zip file with root directory', () => {
    const destDir = path.join(os.tmpdir(), 'stylish-portfolio');
    log.debug('download and extract html5-template to %s', destDir);
    return download(
      'http://localhost:' + PORT + '/stylish-portfolio',
      destDir
    ).then(() => {
      expect(fs.existsSync(path.join(destDir, 'index.html'))).to.be.true;
      expect(fs.existsSync(path.join(destDir, 'css/bootstrap.css'))).to.be.true;
      return;
    });
  });

  it('downloads tarball file', () => {
    const destDir = path.join(os.tmpdir(), 'bootstrap-starter');
    return fs
      .emptyDir(destDir)
      .then(() => {
        return download(
          'http://localhost:' + PORT + '/bootstrap-starter',
          destDir
        );
      })
      .then(() => {
        expect(fs.existsSync(path.join(destDir, 'index.html'))).to.be.true;
        expect(fs.existsSync(path.join(destDir, 'css/bootstrap.css'))).to.be
          .true;
        return;
      });
  });

  it('handles 404 of source url', () => {
    const url = 'http://localhost:' + PORT + '/not-found';
    return download(url, process.cwd()).catch(err => {
      expect(err.message).to.equal(
        'Source archive ' + url + ' could not be found.'
      );
      return null;
    });
  });

  it('handles an invalid archive', () => {
    const destDir = path.join(os.tmpdir(), 'invalid-archive');
    return fs
      .emptyDir(destDir)
      .then(() => {
        return download(
          'http://localhost:' + PORT + '/invalid-archive',
          destDir
        );
      })
      .catch(err => {
        expect(err.message).to.match(/^Unsupported source mimetype/);
        return null;
      });
  });
});
