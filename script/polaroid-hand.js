/* ==========================================================================
   polaroid-hand.js — a hand carries the polaroid in from the right and
   sticks it in place, driven by scroll (styles: polaroid-hand.css).

   Scrolling down plays it forward, scrolling up plays it back:
     0.00 – 0.55  carry: hand + polaroid slide in from the right, lifted
     0.55 – 0.72  press: the polaroid is pressed onto the page
     0.72 – 1.00  leave: the hand slides back out along the arm
   ========================================================================== */
(() => {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* ---------- Tweakables ---------- */
    const CARRY_END = 0.55;
    const PRESS_END = 0.72;
    const LIFT_SCALE = 0.07;     // how much bigger the polaroid is while lifted
    const START_TILT = 12;       // degrees of tilt while it's carried in

    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeIn = (t) => t * t * t;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    document.querySelectorAll('[data-polaroid-hand]').forEach((scene) => {
        const carry = scene.querySelector('.ph-carry');
        const photoShadow = scene.querySelector('.ph-photo__shadow');
        const hand = scene.querySelector('.ph-hand');
        const handShadow = scene.querySelector('.ph-hand__shadow');
        if (!carry || !hand) return;

        let ticking = false;

        const update = () => {
            ticking = false;
            const vh = window.innerHeight;
            const vw = document.documentElement.clientWidth;
            const r = scene.getBoundingClientRect();

            // 0 when the polaroid's spot enters the bottom of the screen,
            // 1 when it's centred on screen
            const endTop = (vh - r.height) / 2;
            const p = clamp01((vh - r.top) / Math.max(1, vh - endTop));

            const c = easeOut(clamp01(p / CARRY_END));                          // carry
            const k = easeInOut(clamp01((p - CARRY_END) / (PRESS_END - CARRY_END)));   // press
            const l = easeIn(clamp01((p - PRESS_END) / (1 - PRESS_END)));       // leave

            // Carry: start fully off-screen to the right, arc up a little on the way
            const startX = vw - r.left + 60;
            const x = (1 - c) * startX;
            const y = -Math.sin(c * Math.PI) * 40;
            const tilt = (1 - c) * START_TILT;
            const lift = 1 - k;                                  // 1 = held up, 0 = stuck down
            carry.style.transform =
                `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 + LIFT_SCALE * lift).toFixed(4)})`;

            if (photoShadow) {
                photoShadow.style.opacity = (0.12 + 0.3 * lift).toFixed(3);
                photoShadow.style.transform = `translate(${(8 + 22 * lift).toFixed(1)}px, ${(12 + 34 * lift).toFixed(1)}px)`;
            }

            // Hand: presses down with the polaroid, then leaves along the arm
            // (the arm points down-right at about 28°)
            const away = Math.max(vw, 900) * 1.1 * l;
            const handScale = 1 + 0.05 * lift + 0.04 * l;
            hand.style.transform =
                `translate3d(${(away * 0.88).toFixed(1)}px, ${(away * 0.47).toFixed(1)}px, 0) scale(${handScale.toFixed(4)})`;

            if (handShadow) {
                const hl = Math.max(lift, l * 1.4);              // how high the hand is above the page
                handShadow.style.opacity = (0.55 - 0.2 * hl).toFixed(3);
                handShadow.style.transform = `translate(${(6 + 26 * hl).toFixed(1)}px, ${(8 + 34 * hl).toFixed(1)}px)`;
            }
        };

        const request = () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        };

        scene.classList.add('is-ready');
        window.addEventListener('scroll', request, { passive: true });
        window.addEventListener('resize', request);
        window.addEventListener('load', request);
        update();
    });
})();
