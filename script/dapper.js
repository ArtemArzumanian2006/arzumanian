/* ==========================================================================
   dapper.js — interactive parts of dapper.html
   1. Award banner: numbered notes (hover / tap a number or a note)
   2. Suitcase front / back toggle
   3. Poster wall: drag to scroll + progress bar
   4. Phones: wallpapers change one after another
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


    /* ---------- 1. Award banner notes ----------
       Each note has data-focus="left top width height" (in % of the banner):
       the rest of the banner dims around that area. */
    document.querySelectorAll('[data-award]').forEach((box) => {
        const spots = [...box.querySelectorAll('.dp-hotspot')];
        const notes = [...box.querySelectorAll('.dp-award__note')];
        const focus = box.querySelector('.dp-award__focus');

        const activate = (id) => {
            spots.forEach((s) => {
                const on = s.dataset.note === id;
                s.classList.toggle('is-active', on);
                s.setAttribute('aria-pressed', on);
            });
            notes.forEach((n) => n.classList.toggle('is-active', n.dataset.note === id));
            const note = notes.find((n) => n.dataset.note === id);
            if (note && focus) {
                const [x, y, w, h] = note.dataset.focus.split(' ');
                focus.style.setProperty('--fx', x);
                focus.style.setProperty('--fy', y);
                focus.style.setProperty('--fw', w);
                focus.style.setProperty('--fh', h);
                box.classList.add('has-focus');
            }
        };
        const clear = () => {
            box.classList.remove('has-focus');
            spots.forEach((s) => { s.classList.remove('is-active'); s.setAttribute('aria-pressed', 'false'); });
            notes.forEach((n) => n.classList.remove('is-active'));
        };

        [...spots, ...notes].forEach((el) => {
            el.addEventListener('mouseenter', () => activate(el.dataset.note));
            el.addEventListener('focus', () => activate(el.dataset.note));
            el.addEventListener('click', () => activate(el.dataset.note));
        });
        box.addEventListener('mouseleave', clear);
    });


    /* ---------- 2. Suitcase front / back ---------- */
    document.querySelectorAll('[data-flip]').forEach((card) => {
        const buttons = [...card.querySelectorAll('.dp-flip button')];
        buttons.forEach((btn) => btn.addEventListener('click', () => {
            buttons.forEach((b) => b.setAttribute('aria-pressed', b === btn));
            card.classList.toggle('is-back', btn.dataset.side === 'back');
        }));
    });


    /* ---------- 3. Poster wall ---------- */
    document.querySelectorAll('[data-posters]').forEach((wrap) => {
        const row = wrap.querySelector('.dp-posters');
        const bar = wrap.querySelector('[data-progress]');

        const update = () => {
            const max = row.scrollWidth - row.clientWidth;
            const visible = row.clientWidth / row.scrollWidth;
            const p = max > 0 ? visible + (1 - visible) * (row.scrollLeft / max) : 1;
            bar?.style.setProperty('--p', p.toFixed(3));
        };
        row.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        window.addEventListener('load', update);
        update();

        // Mouse drag (touch screens already swipe natively)
        let down = false, startX = 0, startLeft = 0, moved = false;
        row.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            down = true; moved = false; startX = e.clientX; startLeft = row.scrollLeft;
        });
        row.addEventListener('pointermove', (e) => {
            if (!down) return;
            const dx = e.clientX - startX;
            if (!moved && Math.abs(dx) > 4) {
                moved = true;
                row.setPointerCapture(e.pointerId);
                row.classList.add('is-dragging');
            }
            if (moved) row.scrollLeft = startLeft - dx;
        });
        const end = () => {
            if (!down) return;
            down = false;
            if (moved) {
                const left = row.scrollLeft;
                row.classList.remove('is-dragging');
                row.scrollLeft = left;      // let scroll-snap settle on the nearest poster
            }
        };
        row.addEventListener('pointerup', end);
        row.addEventListener('pointercancel', end);
        row.addEventListener('keydown', (e) => {
            const step = (row.querySelector('li')?.offsetWidth || 300) + 16;
            if (e.key === 'ArrowRight') { e.preventDefault(); row.scrollBy({ left: step, behavior: 'smooth' }); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); row.scrollBy({ left: -step, behavior: 'smooth' }); }
        });
    });


    /* ---------- 4. Phones: wallpapers change one after another ---------- */
    const phones = [...document.querySelectorAll('[data-phone]')];
    if (phones.length && !reducedMotion) {
        const INTERVAL = 2600;   // ms between changes
        let turn = 0;
        let timer = null;
        const step = () => {
            // One phone changes at a time, taking turns
            const phone = phones[turn % phones.length];
            const imgs = [...phone.querySelectorAll('img')];
            const i = imgs.findIndex((img) => img.classList.contains('is-on'));
            imgs[i]?.classList.remove('is-on');
            imgs[(i + 1) % imgs.length].classList.add('is-on');
            turn++;
        };
        // Only run while the phones are on screen
        new IntersectionObserver((entries) => {
            const visible = entries.some((e) => e.isIntersecting);
            if (visible && !timer) timer = setInterval(step, INTERVAL / phones.length);
            if (!visible && timer) { clearInterval(timer); timer = null; }
        }).observe(phones[0].closest('.dp-phones'));
    }
})();
