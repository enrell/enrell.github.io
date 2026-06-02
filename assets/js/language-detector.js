/**
 * Redirect first-time visitors to their browser language on language home pages only.
 */
(function() {
    'use strict';

    var supportedLanguages = ['en', 'pt'];
    var LANG_PREF_KEY = 'user-language-preference';
    var currentPath = window.location.pathname;

    if (localStorage.getItem(LANG_PREF_KEY)) {
        return;
    }

    var browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase().split('-')[0];
    var langCode = supportedLanguages.indexOf(browserLang) === -1 ? 'en' : browserLang;

    var currentLangMatch = currentPath.match(/^\/(en|pt)(\/|$)/i);
    var currentLang = currentLangMatch ? currentLangMatch[1].toLowerCase() : '';

    if (currentLang === langCode) {
        return;
    }

    function isLanguageHome(path) {
        return /^\/(en|pt)\/?$/.test(path) ||
            /^\/(en|pt)\/posts\/?$/.test(path) ||
            /^\/(en|pt)\/categories\/?$/.test(path) ||
            /^\/(en|pt)\/tags\/?$/.test(path) ||
            path === '/' ||
            path === '/index.html';
    }

    function getRedirectUrl(targetLang, path) {
        var baseUrl = window.location.origin;

        if (path === '/' || path === '/index.html') {
            return baseUrl + '/' + targetLang + '/';
        }

        var pathWithoutLang = path.replace(/^\/(en|pt)/i, '');
        if (!pathWithoutLang || pathWithoutLang === '/') {
            return baseUrl + '/' + targetLang + '/';
        }

        return baseUrl + '/' + targetLang + pathWithoutLang;
    }

    var path = currentPath;
    var hasRedirected = sessionStorage.getItem('hasRedirected');

    if (isLanguageHome(path) && !hasRedirected) {
        sessionStorage.setItem('hasRedirected', 'true');
        window.location.replace(getRedirectUrl(langCode, path));
    }
})();