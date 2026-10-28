/* ==========================================================================
   nav.js — full-screen projects menu
   Opens from the "Projects" button. Closes with the × button, Escape, or
   when a link inside is clicked. While open, the page can't scroll and Tab
   stays inside the menu.
   ========================================================================== */
(() => {
    'use strict';

    const toggle = document.querySelector('.menu-toggle');
    const menu = document.getElementById('site-menu');
    if (!toggle || !menu) return;

    const closeBtn = menu.querySelector('.site-menu__close');
    const focusables = () => [...menu.querySelectorAll('a[href], button')];

    function open() {
        menu.inert = false;
        menu.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
        // Focus the close button once the wipe has started
        setTimeout(() => closeBtn && closeBtn.focus(), 50);
    }

    function close() {
        menu.classList.remove('is-open');
        menu.inert = true;
        toggle.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
        toggle.focus();
    }

    toggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Clicking a link closes the menu (the page then navigates)
    menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
            menu.classList.remove('is-open');
            document.documentElement.style.overflow = '';
        }
    });

    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            close();
            return;
        }
        // Keep Tab inside the menu
        if (e.key === 'Tab') {
            const items = focusables();
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // Coming back with the browser's Back button: make sure it's closed
    window.addEventListener('pageshow', () => {
        if (menu.classList.contains('is-open')) close();
    });
})();