/**
 * Attestto demo page i18n runtime.
 * - Detects saved locale (localStorage) or browser default; falls back to ES.
 * - Loads /demo/i18n/{locale}.json once per session, applies translations.
 * - Walks elements with [data-i18n] (textContent) and [data-i18n-html] (innerHTML).
 * - Updates document.title, meta description, html lang, og:locale on switch.
 * - Exposes window.AttesttoDemoI18n.{getLocale,setLocale,onChange} for the
 *   compliance matrix loader and any other module that needs to react to locale changes.
 *
 * No external dependencies. Spanish remains the canonical fallback (matches og:locale, JSON-LD).
 */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'es'];
  var STORAGE_KEY = 'attestto:demo:locale';
  var DEFAULT_LOCALE = 'es';

  var listeners = [];
  var dictionaries = {};
  var currentLocale = null;

  function detectInitialLocale() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      // localStorage may be unavailable (privacy mode); fall through.
    }
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;

    var browser = (navigator.language || '').toLowerCase();
    if (browser.indexOf('es') === 0) return 'es';
    if (browser.indexOf('en') === 0) return 'en';
    return DEFAULT_LOCALE;
  }

  function resolveKey(dict, path) {
    var parts = path.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : null;
  }

  function fetchDictionary(locale) {
    if (dictionaries[locale]) return Promise.resolve(dictionaries[locale]);
    return fetch('/demo/i18n/' + locale + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load /demo/i18n/' + locale + '.json: ' + r.status);
        return r.json();
      })
      .then(function (json) {
        dictionaries[locale] = json;
        return json;
      });
  }

  function applyTextNodes(dict) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var translated = resolveKey(dict, key);
      if (translated != null) nodes[i].textContent = translated;
    }
  }

  function applyHtmlNodes(dict) {
    var nodes = document.querySelectorAll('[data-i18n-html]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n-html');
      var translated = resolveKey(dict, key);
      if (translated != null) nodes[i].innerHTML = translated;
    }
  }

  function applyAttrNodes(dict) {
    // Format: data-i18n-attr="aria-label:nav.langSwitcher;title:nav.langSwitcher"
    var nodes = document.querySelectorAll('[data-i18n-attr]');
    for (var i = 0; i < nodes.length; i++) {
      var spec = nodes[i].getAttribute('data-i18n-attr');
      var pairs = spec.split(';');
      for (var j = 0; j < pairs.length; j++) {
        var parts = pairs[j].split(':');
        if (parts.length !== 2) continue;
        var attr = parts[0].trim();
        var key = parts[1].trim();
        var translated = resolveKey(dict, key);
        if (translated != null) nodes[i].setAttribute(attr, translated);
      }
    }
  }

  function applyMeta(dict, locale) {
    var title = resolveKey(dict, 'meta.title');
    if (title) document.title = title;

    var descNode = document.querySelector('meta[name="description"]');
    var desc = resolveKey(dict, 'meta.description');
    if (descNode && desc) descNode.setAttribute('content', desc);

    var ogTitleNode = document.querySelector('meta[property="og:title"]');
    var ogTitle = resolveKey(dict, 'meta.ogTitle');
    if (ogTitleNode && ogTitle) ogTitleNode.setAttribute('content', ogTitle);

    var ogDescNode = document.querySelector('meta[property="og:description"]');
    var ogDesc = resolveKey(dict, 'meta.ogDescription');
    if (ogDescNode && ogDesc) ogDescNode.setAttribute('content', ogDesc);

    var ogLocaleNode = document.querySelector('meta[property="og:locale"]');
    if (ogLocaleNode) ogLocaleNode.setAttribute('content', locale === 'es' ? 'es_CR' : 'en_US');

    var twTitleNode = document.querySelector('meta[name="twitter:title"]');
    var twTitle = resolveKey(dict, 'meta.twitterTitle');
    if (twTitleNode && twTitle) twTitleNode.setAttribute('content', twTitle);

    var twDescNode = document.querySelector('meta[name="twitter:description"]');
    var twDesc = resolveKey(dict, 'meta.twitterDescription');
    if (twDescNode && twDesc) twDescNode.setAttribute('content', twDesc);

    document.documentElement.setAttribute('lang', locale);
  }

  function applyToggleButton(dict) {
    var btn = document.getElementById('lang-toggle');
    if (!btn) return;
    var label = resolveKey(dict, 'nav.langOpposite');
    if (label) btn.textContent = label;
    var aria = resolveKey(dict, 'nav.langSwitcherAria');
    if (aria) btn.setAttribute('aria-label', aria);
  }

  function notifyListeners(locale) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](locale);
      } catch (e) {
        if (window.console) console.error('[i18n] listener error', e);
      }
    }
  }

  function applyLocale(locale) {
    return fetchDictionary(locale).then(function (dict) {
      applyTextNodes(dict);
      applyHtmlNodes(dict);
      applyAttrNodes(dict);
      applyMeta(dict, locale);
      applyToggleButton(dict);
      currentLocale = locale;
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch (_) {
        // localStorage unavailable — locale persists in memory only.
      }
      notifyListeners(locale);
    });
  }

  function setLocale(locale) {
    if (SUPPORTED.indexOf(locale) === -1) return Promise.reject(new Error('Unsupported locale: ' + locale));
    if (locale === currentLocale) return Promise.resolve();
    return applyLocale(locale);
  }

  function getLocale() {
    return currentLocale;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function wireToggle() {
    var btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = currentLocale === 'es' ? 'en' : 'es';
      setLocale(next);
    });
  }

  // Public API — exposed before initial apply so the matrix loader can
  // register an onChange listener synchronously.
  window.AttesttoDemoI18n = {
    getLocale: getLocale,
    setLocale: setLocale,
    onChange: onChange,
    SUPPORTED: SUPPORTED.slice(),
  };

  function init() {
    var initial = detectInitialLocale();
    applyLocale(initial).catch(function (e) {
      if (window.console) console.error('[i18n] failed to apply initial locale', e);
    });
    wireToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
