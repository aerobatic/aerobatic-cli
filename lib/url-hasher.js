'use strict';

const replaceStream = require('replacestream');
const StringDecoder = require('string_decoder').StringDecoder;
const _ = require('lodash');
const log = require('winston');
const path = require('path');
const multipipe = require('multipipe');
const through2 = require('through2');

const BASE_URL = 'https://__baseurl__';
const HASH_DELIMITER = '--md5--';
const ATTR_REGEX = /(src|href|srcset|style)=["'](.*?)["']/ig;

// TODO: use a SRC_ATTR_REGEX and LINK_HREF_TAG regexes
const CSS_URL_REGEX = /url\(['"]?(.*?)['"]?\)/ig;
const STYLE_TAG_REGEX = /<style.*?>(.*?)<\/style>/ig;

class HashReplacer {
  constructor(filePath, params) {
    this.filePath = filePath;
    this.params = params;

    var parentDir = path.dirname(filePath);
    if (parentDir === '.') parentDir = '';
    this.parentDir = '/' + parentDir;
  }

  attributeReplacer(match, attrName, attrValue) {
    if (attrName === 'src' || attrName === 'href') {
      return this.urlReplacer(match, attrValue);
    } else if (attrName === 'srcset') {
      return this.srcSetReplacer(match, attrValue);
    } else if (attrName === 'style') {
      // Run a regex to find inline urls in inline style attributes
      const updatedCss = this.rewriteAssetUrlsInCss(attrValue);
      return match.replace(attrValue, updatedCss);
    }
    return match;
  }

  urlReplacer(match, url) {
    // If this is not a hashable asset path, keep the original.
    if (!shouldHashAssetPath(url)) return match;

    var originalAssetPath = url;

    // It's possible the matched assetUrl has a querystring, i.e.
    // <img src="/images/logo.jpg?v=4.6.3">
    const queryIndex = originalAssetPath.indexOf('?');
    if (queryIndex !== -1) {
      originalAssetPath = originalAssetPath.substr(0, queryIndex);
    }

    var normalizedPath = this.normalizeAssetPath(originalAssetPath);
    var assetHash = this.params.files[normalizedPath];

    // If we don't have a hash for the asset, just return the original value
    if (!assetHash) return match;

    const hashedPath = hashAssetPath(originalAssetPath, assetHash);
    return match.replace(originalAssetPath, hashedPath);
  }

  // Replace asset paths in inline style blocks
  styleReplacer(match, css) {
    const updatedCss = this.rewriteAssetUrlsInCss(css);
    return match.replace(css, updatedCss);
  }

  srcSetReplacer(match, attrValue) {
    const srcSet = parseSrcSet(attrValue);

    const srcToString = function(src) {
      var str = src.url;
      if (src.query) str += src.query;
      if (src.descriptor) str += ' ' + src.descriptor;
      return str;
    };

    // A list of one or more strings separated by commas indicating a set of possible
    // image sources for the user agent to use. Each string is composed of:
    // srcset="e021e5193fe0.jpg 1211w, asdf300x200.jpg 300w
    const hashedSrcSet = srcSet.map(src => {
      if (!shouldHashAssetPath(src.url)) return srcToString(src);

      const normalizedSrc = this.normalizeAssetPath(src.url);
      var imageHash = this.params.files[normalizedSrc];
      if (!imageHash) return srcToString(src);

      src.url = hashAssetPath(src.url, imageHash);
      return srcToString(src);
    }).join(', ');

    return match.replace(attrValue, hashedSrcSet);
  }

  // Normalize the asset path starting from the website root. So an assetPath
  // like "../images/foo.jpg" becomes "images/foo.jpg". The hostDirName is the
  // absolute path of the parent html or css file from which the assetPath
  // is referenced.
  normalizeAssetPath(assetPath) {
    if (_.startsWith(assetPath, BASE_URL)) {
      assetPath = assetPath.substr(BASE_URL.length);
    }

    if (_.startsWith(assetPath, '/')) {
      // If the assetPath has a leading slash, strip it off.
      return _.trimStart(assetPath, '/');
    }

    log.debug('normalize asset path %s', assetPath);
    return path.relative('/', path.resolve(this.parentDir, assetPath));
  }

  rewriteAssetUrlsInCss(cssString) {
    const attributeReplacer = (match, assetUrl) => {
      if (!shouldHashAssetPath(assetUrl)) return match;

      // It's possible the matched assetUrl has a querystring, i.e.
      // src:url('../fonts/fontawesome-webfont.woff2?v=4.6.3')
      const queryIndex = assetUrl.indexOf('?');
      if (queryIndex !== -1) {
        assetUrl = assetUrl.substr(0, queryIndex);
      }

      const normalizedPath = this.normalizeAssetPath(assetUrl);
      const assetHash = this.params.files[normalizedPath];
      if (!assetHash) return match;

      const hashedUrl = hashAssetPath(assetUrl, assetHash);
      return match.replace(assetUrl, hashedUrl);
    };

    return cssString.replace(CSS_URL_REGEX, attributeReplacer);
  }
}

// Return a new asset path that mirrors the original but with
// the content hash injecdted before the file extension.
function hashAssetPath(originalPath, assetHash) {
  const parsedPath = path.parse(originalPath);
  return originalPath.replace(parsedPath.base,
    parsedPath.name + HASH_DELIMITER + assetHash + parsedPath.ext);
}

function shouldHashAssetPath(assetUrl) {
  // Check for a proto agnostic double-slash url
  if (_.startsWith(assetUrl, '//')) return false;

  // Check for an absolute asset url with a proto, i.e. https://, http://, mailto://, etc.
  // Exception to this rule is for the special https://__baseurl__ token
  if (!_.startsWith(assetUrl, BASE_URL) && /^[a-z]+:\/\//i.test(assetUrl)) return false;

  // If the asset path does not have an extension, return false.
  const extName = path.extname(assetUrl);
  if (extName.length === 0 || extName === '.html') return false;

  return true;
}

// Parse a srcset attribute into an array of objects
function parseSrcSet(srcset) {
  return srcset.split(',').map(srcPair => {
    const src = {};
    srcPair = _.trim(srcPair);
    const spaceIndex = srcPair.indexOf(' ');

    if (spaceIndex === -1) {
      src.url = srcPair;
    } else {
      src.url = srcPair.substr(0, spaceIndex);
      src.descriptor = _.trim(srcPair.substr(spaceIndex));
    }

    const queryIndex = src.url.indexOf('?');
    if (queryIndex !== -1) {
      src.query = src.url.substr(queryIndex);
      src.url = src.url.substr(0, queryIndex);
    }
    return src;
  });
}

module.exports = params => {
  return function(filePath) {
    const extName = path.extname(filePath);
    const replacer = new HashReplacer(filePath, params);
    const decoder = new StringDecoder('utf-8');

    const decoderPipe = through2(function(chunk, enc, callback) {
      chunk = decoder.write(chunk);
      this.push(chunk);
      callback();
    });

    if (extName === '.html') {
      return multipipe(
        replaceStream(ATTR_REGEX, replacer.attributeReplacer.bind(replacer)),
        replaceStream(STYLE_TAG_REGEX, replacer.styleReplacer.bind(replacer)),
        decoderPipe
      );
    } else if (extName === '.css') {
      return multipipe(
        replaceStream(CSS_URL_REGEX, replacer.urlReplacer.bind(replacer)),
        decoderPipe
      );
    }
  };
};
