(function() {
    'use strict';

    const dropdown = document.querySelector('.lang-switch-dropdown');
    if (!dropdown) return;

    const toggleBtn = dropdown.querySelector('.lang-toggle-btn');
    const menu = dropdown.querySelector('.lang-dropdown-menu');

    toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        closeDropdown();
        if (!isOpen) {
            dropdown.classList.add('open');
            menu.style.display = 'block';
        }
    });

    function closeDropdown() {
        dropdown.classList.remove('open');
        menu.style.display = '';
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
