(function() {
    'use strict';

    var LANG_PREF_KEY = 'user-language-preference';

    function saveLanguagePreference(lang) {
        if (lang) {
            localStorage.setItem(LANG_PREF_KEY, lang);
        }
    }

    var header = document.querySelector('.header');
    var nav = document.querySelector('.nav');
    var navMenuToggle = document.getElementById('nav-menu-toggle');
    var menu = document.getElementById('menu');
    var navBackdrop = document.querySelector('.header .nav-backdrop');

    if (nav && navMenuToggle && menu) {
        function closeMobileMenu() {
            nav.classList.remove('mobile-menu-open');
            if (header) {
                header.classList.remove('mobile-menu-open');
            }
            navMenuToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }

        function openMobileMenu() {
            nav.classList.add('mobile-menu-open');
            if (header) {
                header.classList.add('mobile-menu-open');
            }
            navMenuToggle.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }

        navMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (nav.classList.contains('mobile-menu-open')) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        if (navBackdrop) {
            navBackdrop.addEventListener('click', closeMobileMenu);
        }

        document.addEventListener('click', function(e) {
            if (!nav.contains(e.target)) {
                closeMobileMenu();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeMobileMenu();
            }
        });

        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });

        menu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        });
    }

    var dropdown = document.querySelector('.lang-switch-dropdown');
    if (!dropdown) {
        return;
    }

    var toggleBtn = dropdown.querySelector('.lang-toggle-btn');
    var dropdownMenu = dropdown.querySelector('.lang-dropdown-menu');

    dropdownMenu.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            var href = link.getAttribute('href') || '';
            var match = href.match(/\/(en|pt)(\/|$)/i);
            if (match) {
                saveLanguagePreference(match[1].toLowerCase());
            }
        });
    });

    toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('open');
        closeDropdown();
        if (!isOpen) {
            dropdown.classList.add('open');
            toggleBtn.setAttribute('aria-expanded', 'true');
        }
    });

    function closeDropdown() {
        dropdown.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDropdown();
        }
    });
})();