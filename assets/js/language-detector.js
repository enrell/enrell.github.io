/**
 * Language Detection and Auto-Redirect Script
 * Detects browser language preference and redirects to the appropriate language version
 */

(function() {
    'use strict';

    // Supported languages on this site
    var supportedLanguages = ['en', 'pt'];
    
    // Get current path
    var currentPath = window.location.pathname;
    
    // Check if user has already manually selected a language
    var userLangPreference = localStorage.getItem('user-language-preference');
    
    // Don't redirect if user already made a choice
    if (userLangPreference) {
        return;
    }
    
    // Get browser language
    var browserLang = navigator.language || navigator.userLanguage;
    
    // Extract language code (e.g., 'pt-BR' -> 'pt')
    var langCode = browserLang.toLowerCase().split('-')[0];
    
    // Check if browser language is supported
    if (supportedLanguages.indexOf(langCode) === -1) {
        // Default to English if not supported
        langCode = 'en';
    }
    
    // Get current language from URL path
    var currentLangMatch = currentPath.match(/^\/([a-z]{2})(\/|$)/i);
    var currentLang = currentLangMatch ? currentLangMatch[1].toLowerCase() : '';
    
    // If already on the correct language page, don't redirect
    if (currentLang === langCode) {
        return;
    }
    
    // Function to get the correct URL for the language
    function getRedirectUrl(targetLang) {
        var baseUrl = window.location.origin;
        
        // If we're on the root or a language root, just change the prefix
        if (currentPath === '/' || currentPath === '/index.html') {
            return baseUrl + '/' + targetLang + '/';
        }
        
        // Remove existing language prefix if present
        var pathWithoutLang = currentPath.replace(/^\/[a-z]{2}/i, '');
        
        return baseUrl + '/' + targetLang + pathWithoutLang;
    }
    
    // Only redirect on home page or if the current path doesn't have content
    // This prevents redirecting when viewing a specific post
    var isHomePage = currentPath === '/' || 
                     currentPath === '/index.html' || 
                     currentPath === '/posts/' ||
                     currentPath === '/categories/' ||
                     currentPath === '/tags/';
    
    // Only do auto-redirect on first visit to home page
    // Use sessionStorage to prevent redirect loops
    var hasRedirected = sessionStorage.getItem('hasRedirected');
    
    if (isHomePage && !hasRedirected) {
        sessionStorage.setItem('hasRedirected', 'true');
        
        // Small delay to ensure page loads first
        setTimeout(function() {
            var redirectUrl = getRedirectUrl(langCode);
            window.location.href = redirectUrl;
        }, 100);
    }
})();
