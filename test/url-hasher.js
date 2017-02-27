const log = require('winston');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const Promise = require('bluebird');
const expect = require('chai').expect;

log.level = 'debug';

describe('urlHasher', () => {
  var urlHasher;

  before(() => {
    urlHasher = require('../lib/url-hasher')({
      files: {
        'image.jpg': '12345',
        'images/image.jpg': '12345',
        'images/image-275.jpg': '88888',
        'css/styles.css': '99999',
        'images/image-1100.jpg': '77777',
        'fonts/fontawesome-webfont.woff2': 'abcde',
        'img/PBPIBM small.png': '11111',
        'dist/main.js': '22222',
        'pages/about.html': '00000'
      }
    });
  });

  it('basic image replacement', () => {
    const html = '<html><img src="image.jpg" /></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="image--md5--12345.jpg" /></html>');
      });
  });

  it('maintains quote style', () => {
    const html = '<html><img src=\'image.jpg\' /></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src=\'image--md5--12345.jpg\' /></html>');
      });
  });

  it('adjusts relative path', () => {
    const html = '<html><img src="../images/image.jpg" /></html>';

    return run(html, 'folder/index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="../images/image--md5--12345.jpg" /></html>');
      });
  });

  it('ignores absolute urls', () => {
    const html = '<html><head><link href="css/styles.css" />' +
      '<script src="https://cdn.com/jquery.js"></script></head></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><head><link href="css/styles--md5--99999.css" />' +
          '<script src="https://cdn.com/jquery.js"></script></head></html>');
      });
  });

  it('does not hash .html paths', () => {
    const html = '<html><a href="pages/about.html">About</a></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal(html);
      });
  });

  it('handles site rooted asset paths', () => {
    const html = '<html><img src="/image.jpg" /></html>';
    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="/image--md5--12345.jpg" /></html>');
      });
  });

  it('hashes absolute https://__baseurl__ urls', () => {
    const html = '<html><img src="https://__baseurl__/image.jpg" />' +
      '<img src="https://__baseurl__/images/image.jpg" /></html>';
    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="https://__baseurl__/image--md5--12345.jpg" />' +
          '<img src="https://__baseurl__/images/image--md5--12345.jpg" /></html>');
      });
  });

  it('image with space in name', () => {
    const html = '<html><img src="/img/PBPIBM small.png" /></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="/img/PBPIBM small--md5--11111.png" /></html>');
      });
  });

  it('preserves querystring on assets', () => {
    const html = '<html><link href="/css/styles.css?v=4.1" /></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><link href="/css/styles--md5--99999.css?v=4.1" /></html>');
      });
  });

  it('handles ./ style asset paths', () => {
    const html = '<html><img src="./image.jpg" /></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><img src="./image--md5--12345.jpg" /></html>');
      });
  });

  it('uses same hashed path for same file in two different html files', () => {
    const html = '<html><img src="image.jpg" /></html>';

    const htmlFiles = ['a.html', 'b.html'];

    return Promise.map(htmlFiles, file => run(html, file))
      .then(results => {
        const expected = '<html><img src="image--md5--12345.jpg" /></html>';
        expect(results[0]).to.equal(expected);
        expect(results[1]).to.equal(expected);
      });
  });

  it('rewrites assets paths in style attributes', () => {
    const html = '<html><div style="background-image:url(./images/image.jpg);"></div></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><div style="background-image:url' +
          '(./images/image--md5--12345.jpg);"></div></html>');
      });
  });

  it('rewrites asset urls in css files', () => {
    const css = 'div.hero { background-image: url("../images/image.jpg")}';
    return run(css, 'css/main.css')
      .then(output => {
        expect(output).to.equal('div.hero { background-image: url' +
          '("../images/image--md5--12345.jpg")}');
      });
  });

  it('rewrites font urls in css files', () => {
    const css = '@font-face{font-family:\'FontAwesome\';' +
      'src:url(\'../fonts/fontawesome-webfont.woff2?v=4.6.3\')';

    return run(css, 'css/main.css')
      .then(output => {
        expect(output).to.equal('@font-face{font-family:\'FontAwesome\';' +
          'src:url(\'../fonts/fontawesome-webfont--md5--abcde.woff2?v=4.6.3\')');
      });
  });

  it('rewrites asset urls in inline style tag', () => {
    const html = '<html><style type="text/css">div.hero ' +
      '{background-image: url(images/image.jpg);}</style></html>';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<html><style type="text/css">div.hero ' +
          '{background-image: url(images/image--md5--12345.jpg);}</style></html>');
      });
  });

  it('rewrites image urls in a srcset attribute', () => {
    const html = '<img src="/images/image.jpg" srcset="/images/image-275.jpg 300w, ' +
      '/images/image-1100.jpg?v=1234, /images/missing.jpg 100w" sizes="100vw" />';

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal('<img src="/images/image--md5--12345.jpg" ' +
          'srcset="/images/image-275--md5--88888.jpg 300w, ' +
          '/images/image-1100--md5--77777.jpg?v=1234, /images/missing.jpg 100w" sizes="100vw" />');
      });
  });

  it('does not cause mojibake', () => {
    const html = fs.readFileSync(path.join(__dirname, './fixtures/mojibake.html')).toString();

    return run(html, 'index.html')
      .then(output => {
        expect(output).to.equal(html);
      });
  });

  function run(html, filePath) {
    return new Promise((resolve, reject) => {
      var output = '';
      readStream(html)
        .pipe(urlHasher(filePath))
        .on('data', chunk => {
          output += chunk.toString();
        })
        .on('error', err => {
          reject(err);
        })
        .on('end', () => {
          resolve(output);
        });
    });
  }
});

function readStream(str) {
  var rs = stream.Readable();
  rs._read = function() {
    rs.push(str);
    rs.push(null);
  };
  return rs;
}
