/* ==========================================================================
   transition.js — page transitions
   Leaving:  a black panel slides up over the page, the mountain icon in the
             centre fills from grey to white (left → right), then the next
             page loads.
   Arriving: the next page starts covered by the same panel with the filled
             icon, which then slides up and away to reveal it.

   Load this in the <head> of every page, WITHOUT defer:
       <script src="script/transition.js"></script>
   ========================================================================== */
(() => {
    'use strict';

    /* ---------- Tweakables ---------- */
    const COVER_MS = 600;
    const FILL_MS = 750;
    const FILL_DELAY = 250;
    const HOLD_MS = 150;
    const REVEAL_MS = 800;
    const FLAG = 'page-transition';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const html = document.documentElement;

    // Arriving through a transition: cover the page straight away (CSS in
    // style.css paints a black screen) so it never flashes before the reveal
    let arriving = false;
    try {
        arriving = sessionStorage.getItem(FLAG) === '1';
        sessionStorage.removeItem(FLAG);
    } catch (e) { /* storage blocked: no transition */ }
    if (arriving && !reducedMotion) html.classList.add('pt-cover');

    // Mountain icon (images/Loading_bar.svg), drawn twice: grey underneath,
    // white on top, and the white one is revealed from left to right
    const ICON = '<path d="M0 168H22.1765L44.3529 108.267L54.5882 123.2L63.4375 80L93.8235 168H116L58 0L0 168Z"/>';

    function buildOverlay() {
        const el = document.createElement('div');
        el.className = 'pt';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = `
            <div class="pt__icon">
                <svg class="pt__base" viewBox="0 0 116 168">${ICON}</svg>
                <svg class="pt__fill" viewBox="0 0 116 168">${ICON}</svg>
            </div>`;
        document.body.appendChild(el);
        return el;
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    /* ---------- Arriving ---------- */
    async function reveal() {
        const el = buildOverlay();
        el.classList.add('is-covering', 'is-filled', 'no-anim');
        html.classList.remove('pt-cover');
        await nextFrame();
        el.classList.remove('no-anim');
        await wait(HOLD_MS);
        el.classList.add('is-leaving');           // icon lifts, panel slides up
        await wait(REVEAL_MS);
        el.remove();
    }

    /* ---------- Leaving ---------- */
    let busy = false;

    async function leave(url) {
        if (busy) return;
        busy = true;

        // Start fetching the next page while the animation plays
        const prefetch = document.createElement('link');
        prefetch.rel = 'prefetch';
        prefetch.href = url;
        document.head.appendChild(prefetch);

        const el = buildOverlay();
        await nextFrame();
        el.classList.add('is-covering');
        await wait(FILL_DELAY);
        el.classList.add('is-filled');
        await wait(Math.max(COVER_MS - FILL_DELAY, FILL_MS) + 40);

        try { sessionStorage.setItem(FLAG, '1'); } catch (e) { /* ignore */ }
        window.location.href = url;
    }

    // Which clicks should get the transition: normal left-clicks on links to
    // another page of this site (not new tabs, downloads, mailto or #anchors)
    function shouldHandle(e, a) {
        if (e.defaultPrevented || e.button !== 0) return false;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
        if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return false;
        if (a.dataset.noTransition !== undefined) return false;
        const url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return false;
        if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') return false;
        // Same page, only the #hash differs: let the browser scroll
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
        return true;
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (reducedMotion || !shouldHandle(e, a)) return;
        e.preventDefault();
        leave(a.href);
    });

    document.addEventListener('DOMContentLoaded', () => {
        if (html.classList.contains('pt-cover')) reveal();
    });

    // Back/forward cache: the old page comes back exactly as it was left
    // (covered), so clear it
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            document.querySelectorAll('.pt').forEach((el) => el.remove());
            html.classList.remove('pt-cover');
            busy = false;
        }
    });
})();