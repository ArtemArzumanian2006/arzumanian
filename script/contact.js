/* ==========================================================================
   contact.js — "Let's talk" section + footer
   2. Title: the letters of "Let's Talk" rise up one by one when the section
      comes into view.
   2. Badge: spins slowly, and faster while you scroll.
   3. Copy button: copies the email address.
   4. Footer "Back to top".
   5. Links to #contact (the orange "Let's Talk" tab) scroll there smoothly.
   6. The orange tab slides away to the right once you reach the Let's talk
      section, and comes back when you scroll up above it again.
   Also loaded on the project pages for the footer (the section parts are
   simply skipped there).
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
    const section = document.querySelector('[data-contact]');

    /* ---------- Tweakables ---------- */
    const BADGE_SPEED = 18;           // degrees per second when idle
    const BADGE_SCROLL_BOOST = 0.35;  // extra spin per px scrolled


    /* ======================================================================
       1. Title letters
       ====================================================================== */
    if (section) {
        let i = 0;
        section.querySelectorAll('.contact__line > span').forEach((letter) => {
            letter.style.setProperty('--d', i++);
        });

        new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                section.classList.add('is-in');
                obs.disconnect();
            }
        }, { threshold: 0.25 }).observe(section);
    }


    /* ======================================================================
       2. Spinning badge
       ====================================================================== */
    const ring = section && section.querySelector('.contact__badge-ring');
    let angle = 0;
    let lastScroll = window.scrollY;
    let boost = 0;
    let badgeVisible = false;
    let lastTime = 0;

    function spin(now) {
        if (!badgeVisible) return;
        const dt = Math.min((now - (lastTime || now)) / 1000, 0.05);
        lastTime = now;
        boost *= Math.pow(0.04, dt);          // scroll boost fades out quickly
        angle = (angle + BADGE_SPEED * dt + boost * dt * 60) % 360;
        ring.style.transform = `rotate(${angle.toFixed(2)}deg)`;
        requestAnimationFrame(spin);
    }

    if (ring && !reducedMotion) {
        new IntersectionObserver((entries) => {
            badgeVisible = entries[0].isIntersecting;
            if (badgeVisible) {
                lastTime = 0;
                requestAnimationFrame(spin);
            }
        }).observe(ring);
    }


    /* ======================================================================
       Scroll
       ====================================================================== */
    // Scrolling speeds up the badge
    function onScroll() {
        const y = window.scrollY;
        boost += Math.abs(y - lastScroll) * BADGE_SCROLL_BOOST * 0.1;
        boost = Math.min(boost, 30);
        lastScroll = y;
    }

    if (!reducedMotion) {
        window.addEventListener('scroll', onScroll, { passive: true });
    }


    /* ======================================================================
       3. Copy email
       ====================================================================== */
    document.querySelectorAll('[data-copy]').forEach((btn) => {
        const label = btn.textContent;
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy);
                btn.textContent = 'Copied!';
            } catch (e) {
                btn.textContent = 'Copy failed';
            }
            btn.classList.add('is-copied');
            setTimeout(() => {
                btn.textContent = label;
                btn.classList.remove('is-copied');
            }, 1600);
        });
    });


    /* ======================================================================
       4. Back to top
       ====================================================================== */
    document.querySelectorAll('[data-to-top]').forEach((btn) => {
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    });


    /* ======================================================================
       6. Hide the "Let's Talk" tab at the Let's talk section
       ====================================================================== */
    const tab = document.querySelector('.talk-tab');
    const HIDE_AT = 0.6;   // hidden once the section's top is above 60% of the viewport

    function updateTab() {
        if (!tab || !section) return;
        const reached = section.getBoundingClientRect().top < window.innerHeight * HIDE_AT;
        tab.classList.toggle('is-hidden', reached);
        if (reached) tab.setAttribute('tabindex', '-1');
        else tab.removeAttribute('tabindex');
    }

    if (tab && section) {
        window.addEventListener('scroll', updateTab, { passive: true });
        window.addEventListener('resize', updateTab);
        updateTab();
    }


    /* ======================================================================
       5. Smooth scroll to the Let's talk section
       ====================================================================== */
    document.querySelectorAll('a[href="#contact"]').forEach((link) => {
        link.addEventListener('click', (e) => {
            const target = document.getElementById('contact');
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
            history.replaceState(null, '', '#contact');
        });
    });
})();