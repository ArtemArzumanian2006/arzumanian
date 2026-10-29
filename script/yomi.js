/* ==========================================================================
   yomi.js — the few interactive bits on yomi.html
   1. Flavour picker (band colour + label + can swap)
   2. Olympic reveal toggle (full & cold / empty & warm)
   3. 3D can: show the "drag to spin" hint once the model has loaded
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DIR = 'images/yomi/';

    /* ---------- 1. Flavour picker ---------- */
    document.querySelectorAll('[data-flavours]').forEach((band) => {
        const swatches = [...band.querySelectorAll('.yo-swatch')];
        const name = band.querySelector('[data-name]');
        const label = band.querySelector('[data-label]');
        const can = band.querySelector('[data-can]');

        // Preload the other flavours so the swap is instant
        swatches.forEach((s) => {
            new Image().src = `${DIR}label-${s.dataset.flavour}.webp`;
            new Image().src = `${DIR}can-back-${s.dataset.flavour}.webp`;
        });

        const pick = (swatch) => {
            const f = swatch.dataset.flavour;
            swatches.forEach((s) => s.setAttribute('aria-pressed', s === swatch));
            band.style.setProperty('--c', `var(--yo-${f})`);
            name.textContent = swatch.dataset.title;

            const swapIn = () => {
                label.src = `${DIR}label-${f}.webp`;
                label.alt = `Final ${swatch.dataset.title} label, flat`;
                can.src = `${DIR}can-back-${f}.webp`;
                can.alt = `${swatch.dataset.title} cans on ice, back with nutrition facts`;
                requestAnimationFrame(() => [label, can].forEach((img) => img.classList.remove('is-fading')));
            };
            if (reducedMotion) { swapIn(); return; }
            [label, can].forEach((img) => img.classList.add('is-fading'));
            setTimeout(swapIn, 300);
        };

        swatches.forEach((s) => s.addEventListener('click', () => {
            if (s.getAttribute('aria-pressed') !== 'true') pick(s);
        }));
    });


    /* ---------- 2. Olympic reveal ---------- */
    document.querySelectorAll('[data-reveal]').forEach((box) => {
        const btn = box.querySelector('.yo-toggle');
        const state = box.querySelector('.yo-toggle__state');
        btn.addEventListener('click', () => {
            const empty = !box.classList.contains('is-empty');
            box.classList.toggle('is-empty', empty);
            btn.setAttribute('aria-pressed', empty);
            state.textContent = empty ? 'Empty & warm' : 'Full & cold';
        });
    });


    /* ---------- 3. 3D can ---------- */
    document.querySelectorAll('.yo-3d').forEach((wrap) => {
        const viewer = wrap.querySelector('model-viewer');
        if (!viewer) return;
        viewer.addEventListener('load', () => wrap.classList.add('is-loaded'));
        // Hide the hint after the first drag
        viewer.addEventListener('camera-change', (e) => {
            if (e.detail && e.detail.source === 'user-interaction') wrap.classList.add('is-touched');
        });
    });
})();
