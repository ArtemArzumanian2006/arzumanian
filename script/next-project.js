/* ==========================================================================
   next-project.js — the "next project" card at the bottom of project pages
   The round button appears under the cursor when you hover the card and
   follows it with a little lag (same feel as the cards on the home page).
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FOLLOW = 0.22;   // how quickly the circle catches up (0–1, higher = snappier)

    document.querySelectorAll('.next-card').forEach((card) => {
        const circle = card.querySelector('.next-card__arrow');
        if (!circle) return;

        const pos = { x: 0, y: 0 };      // where the circle is
        const target = { x: 0, y: 0 };   // where the cursor is
        let raf = null;

        const place = () => {
            circle.style.translate = `${pos.x.toFixed(1)}px ${pos.y.toFixed(1)}px`;
        };

        const follow = () => {
            pos.x += (target.x - pos.x) * FOLLOW;
            pos.y += (target.y - pos.y) * FOLLOW;
            place();
            const settled = Math.abs(target.x - pos.x) < 0.3 && Math.abs(target.y - pos.y) < 0.3;
            raf = settled ? null : requestAnimationFrame(follow);
        };

        const setTarget = (e) => {
            const r = card.getBoundingClientRect();
            target.x = e.clientX - r.left;
            target.y = e.clientY - r.top;
        };

        card.addEventListener('pointerenter', (e) => {
            if (e.pointerType !== 'mouse') return;   // touch: the circle sits in the corner (CSS)
            setTarget(e);
            // Appear right under the cursor rather than sliding in from elsewhere
            pos.x = target.x;
            pos.y = target.y;
            place();
            card.classList.add('is-hovered');
        });

        card.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            setTarget(e);
            if (reducedMotion) {
                pos.x = target.x;
                pos.y = target.y;
                place();
            } else if (!raf) {
                raf = requestAnimationFrame(follow);
            }
        });

        card.addEventListener('pointerleave', () => {
            // After a click the page transition covers the screen, which counts
            // as leaving the card: keep the circle where it is instead
            if (card.dataset.clicked) return;
            card.classList.remove('is-hovered');
        });

        card.addEventListener('click', (e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey) card.dataset.clicked = '1';
        });

        // Keyboard focus (Tab): CSS centres the circle, so clear the cursor position
        card.addEventListener('focus', () => {
            if (card.matches(':focus-visible')) circle.style.translate = '';
        });
    });

    // Coming back with the browser's Back button: reset the card
    window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        document.querySelectorAll('.next-card').forEach((card) => {
            delete card.dataset.clicked;
            card.classList.remove('is-hovered');
        });
    });
})();