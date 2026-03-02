(function() {
    'use strict';

    const nav = document.querySelector('.nav');
    const navMenuToggle = document.getElementById('nav-menu-toggle');
    const menu = document.getElementById('menu');
    const desktopThemeToggle = document.getElementById('theme-toggle');
    const menuThemeBtn = document.querySelector('.menu-theme-btn');

    if (nav && navMenuToggle && menu) {
        function closeMobileMenu() {
            nav.classList.remove('mobile-menu-open');
            navMenuToggle.setAttribute('aria-expanded', 'false');
        }

        navMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = nav.classList.toggle('mobile-menu-open');
            navMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

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

    if (desktopThemeToggle && menuThemeBtn) {
        menuThemeBtn.addEventListener('click', function() {
            desktopThemeToggle.click();
        });
    }

    const dropdown = document.querySelector('.lang-switch-dropdown');
    if (!dropdown) return;

    const toggleBtn = dropdown.querySelector('.lang-toggle-btn');
    const dropdownMenu = dropdown.querySelector('.lang-dropdown-menu');

    toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        closeDropdown();
        if (!isOpen) {
            dropdown.classList.add('open');
            dropdownMenu.style.display = 'block';
        }
    });

    function closeDropdown() {
        dropdown.classList.remove('open');
        dropdownMenu.style.display = '';
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
