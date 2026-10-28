/* ==========================================================================
   projects.js — stacking project cards
   1. All cards stick at the same spot (CSS), so the next card slides over
      the previous one. Here we work out how far each card is covered and
      set --depth on it: 0 = in front, 1 = one card on top, and so on.
      CSS turns --depth into a card that's lifted up, smaller and darker.
   2. The hover circle follows the cursor anywhere over the card, with a
      little lag, and disappears when the cursor leaves.
   ========================================================================== */
(() => {
    'use strict';

    const stack = document.querySelector('[data-stack]');
    if (!stack) return;

    const items = [...stack.children];
    const cards = items.map((item) => item.querySelector('.project-card'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. Stack depth ---------- */
    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

    function update() {
        ticking = false;
        const vh = window.innerHeight;

        // How far each card has slid into its stuck position (0 → 1)
        const arrived = items.map((item) => {
            const top = item.getBoundingClientRect().top;
            const stickyTop = parseFloat(getComputedStyle(item).top) || 0;
            return clamp01((vh - top) / (vh - stickyTop));
        });

        // A card's depth = how much of every later card is on top of it
        cards.forEach((card, i) => {
            let depth = 0;
            for (let j = i + 1; j < items.length; j++) depth += arrived[j];
            card.style.setProperty('--depth', Math.min(depth, 4).toFixed(3));
        });
    }

    let ticking = false;
    const requestUpdate = () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    };

    if (!reducedMotion) {
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        update();
    }

    /* ---------- 2. Hover circle that follows the cursor ---------- */
    const FOLLOW = 0.22;   // how quickly the circle catches up (0–1, higher = snappier)

    cards.forEach((card) => {
        const circle = card.querySelector('.project-card__arrow');
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
            // The card may be scaled down in the stack; convert to its own units
            const scale = r.width / card.offsetWidth || 1;
            target.x = (e.clientX - r.left) / scale;
            target.y = (e.clientY - r.top) / scale;
        };

        card.addEventListener('pointerenter', (e) => {
            setTarget(e);
            // Appear right under the cursor rather than sliding in from elsewhere
            pos.x = target.x;
            pos.y = target.y;
            place();
            card.classList.add('is-hovered');
        });

        card.addEventListener('pointermove', (e) => {
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

        // Keyboard focus only (Tab): CSS centres the circle, so clear the
        // cursor position. A mouse click also focuses the link, so skip that.
        card.addEventListener('focus', () => {
            if (card.matches(':focus-visible')) circle.style.translate = '';
        });
    });

    // Coming back with the browser's Back button: reset the clicked card
    window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        cards.forEach((card) => {
            delete card.dataset.clicked;
            card.classList.remove('is-hovered');
        });
    });
})();