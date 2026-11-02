/* ==========================================================================
   brandzaak.js — interactive parts of brandzaak.html
   1. Story reel: on desktop the stories slide sideways while you scroll
      down (or swipe / drag / arrows / skip); on phones a normal swipe row
   2. Origin picker (band colour + ad + taste notes)
   3. Collection lightbox
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = (n) => String(n).padStart(2, '0');

    /* ---------- 1. Story reel ----------
       Desktop: the reel sticks to the screen and slides sideways while you
       scroll down. You can also swipe or drag it, scroll sideways on a
       trackpad, use the arrow buttons or skip it. All of these move the page
       scroll, so the reel and the page always stay in sync.
       Phones: a normal swipe row with arrow buttons. */
    const SPEED = 1.6;   // px sideways per px scrolled down (higher = shorter section)

    document.querySelectorAll('[data-reel]').forEach((reel) => {
        const track = reel.querySelector('.bz-reel__track');
        const count = reel.querySelector('[data-count]');
        const bar = reel.querySelector('[data-progress]');
        const prev = reel.querySelector('[data-reel-prev]');
        const next = reel.querySelector('[data-reel-next]');
        const skip = reel.querySelector('[data-reel-skip]');
        const items = [...track.children];
        const desktop = window.matchMedia('(min-width: 901px)');
        let travel = 0;      // how far the track moves sideways
        let distance = 0;    // how far the page scrolls while the reel is stuck
        let ticking = false;

        const pinned = () => reel.classList.contains('is-pinned');
        const reelTop = () => reel.getBoundingClientRect().top + window.scrollY;
        const current = (p) => Math.min(items.length - 1, Math.round(p * (items.length - 1)));

        const show = (p) => {
            const i = current(p);
            if (count) count.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(items.length)}`;
            if (bar) bar.style.setProperty('--p', Math.max(0.04, p).toFixed(3));
            if (prev) prev.disabled = p <= 0.001;
            if (next) next.disabled = p >= 0.999;
        };

        const progress = () => {
            if (pinned()) return distance ? Math.min(1, Math.max(0, -reel.getBoundingClientRect().top / distance)) : 0;
            const max = track.scrollWidth - track.clientWidth;
            return max > 0 ? track.scrollLeft / max : 0;
        };

        const measure = () => {
            const on = desktop.matches && !reducedMotion;
            reel.classList.toggle('is-pinned', on);
            if (!on) {
                reel.style.height = '';
                track.style.transform = '';
                show(progress());
                return;
            }
            travel = Math.max(0, track.scrollWidth - window.innerWidth);
            distance = travel / SPEED;
            reel.style.height = `${window.innerHeight + distance}px`;
            update();
        };

        const update = () => {
            ticking = false;
            if (!pinned()) return;
            const p = progress();
            track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`;
            show(p);
        };

        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        window.addEventListener('resize', measure);
        window.addEventListener('load', measure);
        desktop.addEventListener('change', measure);

        // Phones: progress follows the sideways scroll
        track.addEventListener('scroll', () => { if (!pinned()) show(progress()); }, { passive: true });

        // Is the reel currently stuck to the screen?
        const stuck = () => {
            const r = reel.getBoundingClientRect();
            return r.top <= 1 && r.bottom >= window.innerHeight - 1;
        };

        // Sideways trackpad scroll / shift + mouse wheel moves the reel
        reel.addEventListener('wheel', (e) => {
            if (!pinned() || !stuck()) return;
            const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
            if (Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return;
            e.preventDefault();
            window.scrollBy(0, dx / SPEED);
        }, { passive: false });

        // Drag with the mouse, or swipe sideways on a touch screen
        let drag = null;
        track.addEventListener('pointerdown', (e) => {
            if (!pinned() || e.button !== 0) return;
            drag = { x: e.clientX, y: e.clientY, top: window.scrollY, moved: false };
        });
        track.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            if (!drag.moved) {
                if (Math.abs(dx) < 6) return;
                if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }   // vertical swipe: let the page scroll
                drag.moved = true;
                track.setPointerCapture(e.pointerId);
                track.classList.add('is-dragging');
            }
            window.scrollTo(0, drag.top - dx / SPEED);
        });
        const endDrag = () => {
            if (drag && drag.moved) track.classList.remove('is-dragging');
            drag = null;
        };
        track.addEventListener('pointerup', endDrag);
        track.addEventListener('pointercancel', endDrag);

        // Go to story number i
        const goTo = (i) => {
            const n = Math.max(0, Math.min(items.length - 1, i));
            if (pinned()) {
                const p = n / (items.length - 1);
                window.scrollTo({ top: reelTop() + p * distance, behavior: reducedMotion ? 'auto' : 'smooth' });
            } else {
                track.scrollTo({ left: items[n].offsetLeft - items[0].offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' });
            }
        };
        prev?.addEventListener('click', () => goTo(current(progress()) - 1));
        next?.addEventListener('click', () => goTo(current(progress()) + 1));
        track.tabIndex = 0;
        track.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current(progress()) + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current(progress()) - 1); }
        });

        // Skip: straight to the section after the reel
        skip?.addEventListener('click', () => {
            window.scrollTo({ top: reelTop() + reel.offsetHeight, behavior: 'auto' });
        });

        measure();
        show(0);
    });


    /* ---------- 2. Origin picker ---------- */
    document.querySelectorAll('[data-origins]').forEach((band) => {
        const buttons = [...band.querySelectorAll('.bz-origin')];
        const ad = band.querySelector('[data-ad]');
        const name = band.querySelector('[data-name]');
        const notes = band.querySelector('[data-notes]');

        // Preload the other ads so the swap is instant
        buttons.forEach((b) => { new Image().src = b.dataset.src; });

        const pick = (btn) => {
            buttons.forEach((b) => b.setAttribute('aria-pressed', b === btn));
            band.style.setProperty('--c', btn.dataset.colour);
            name.textContent = btn.dataset.name;
            notes.textContent = btn.dataset.notes;
            const swapIn = () => {
                ad.src = btn.dataset.src;
                ad.alt = btn.dataset.alt;
                requestAnimationFrame(() => ad.classList.remove('is-fading'));
            };
            if (reducedMotion) { swapIn(); return; }
            ad.classList.add('is-fading');
            setTimeout(swapIn, 300);
        };

        buttons.forEach((b) => b.addEventListener('click', () => {
            if (b.getAttribute('aria-pressed') !== 'true') pick(b);
        }));
    });


    /* ---------- 3. Collection lightbox ---------- */
    const dialog = document.querySelector('.bz-lightbox');
    const tiles = [...document.querySelectorAll('.bz-tile')];
    if (dialog && tiles.length && typeof dialog.showModal === 'function') {
        const img = dialog.querySelector('[data-image]');
        const count = dialog.querySelector('[data-count]');
        let index = 0;
        let opener = null;

        const show = (i) => {
            index = (i + tiles.length) % tiles.length;
            const tile = tiles[index];
            img.src = tile.dataset.full;
            img.alt = tile.querySelector('img').alt;
            count.innerHTML = `<b>${pad(index + 1)}</b> / ${pad(tiles.length)}`;
            // Load the neighbours in the background
            [index - 1, index + 1].forEach((n) => {
                const t = tiles[(n + tiles.length) % tiles.length];
                new Image().src = t.dataset.full;
            });
        };

        tiles.forEach((tile, i) => tile.addEventListener('click', () => {
            opener = tile;
            show(i);
            dialog.showModal();
            document.documentElement.style.overflow = 'hidden';
        }));

        dialog.querySelector('[data-prev]').addEventListener('click', () => show(index - 1));
        dialog.querySelector('[data-next]').addEventListener('click', () => show(index + 1));
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
        });
        // Click on the dark area around the image closes it
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog || e.target.classList.contains('bz-lightbox__stage')) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.documentElement.style.overflow = '';
            opener?.focus();
        });
    }
})();