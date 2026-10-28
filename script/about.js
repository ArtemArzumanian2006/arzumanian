/* ==========================================================================
   about.js — scroll effects for the About section
   1. Parallax: [data-speed] elements move faster (+) or slower (−) than
      the page. 0.12 = 12% faster.
   2. Line reveal: [data-lines] text is split into its visual lines; each
      line darkens from grey to black, one after another, as you scroll.
      The two colours come from --about-muted and --about-ink in style.css.
   3. Signature: every <path> in [data-signature] is written in order as you
      scroll, like a pen, with short pen lifts between strokes. Stop
      scrolling and it stops mid-stroke.
   All three follow the scroll position (scrolling back up reverses them).
   ========================================================================== */
(() => {
    'use strict';

    const section = document.querySelector('[data-about]');
    if (!section) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Tweakables ---------- */
    // Where in the viewport an effect starts and ends, as a share of the
    // viewport height measured from the top (1 = bottom edge, 0 = top edge).
    const LINES_RANGE = [0.9, 0.45];      // a paragraph starts filling when its top is at 90%, done at 45%
    const SIGNATURE_RANGE = [0.85, 0.35]; // starts writing when its top is at 85% of the viewport, done at 35%
    const PEN_LIFT = 0.08;                // pause between strokes, as a share of an average stroke
    const LINE_OVERLAP = 0.35;            // how much the next line starts before the previous one finishes (0–1)

    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

    // 0 → 1 as the element's top moves from range[0] to range[1] of the viewport
    function progress(el, range) {
        const vh = window.innerHeight;
        const top = el.getBoundingClientRect().top;
        return clamp01((range[0] * vh - top) / ((range[0] - range[1]) * vh));
    }


    /* ======================================================================
       1. Split text into lines
       Words are wrapped in spans, grouped by the line they land on, and each
       line becomes one <span class="line"> followed by a <br>. Re-done on
       resize because the line breaks change.
       ====================================================================== */
    const paragraphs = [...section.querySelectorAll('[data-lines]')].map((el) => ({
        el,
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        lines: []
    }));

    function splitLines(p) {
        const { el, text } = p;
        el.textContent = '';
        const words = text.split(' ').map((w, i, all) => {
            const span = document.createElement('span');
            span.textContent = w + (i < all.length - 1 ? ' ' : '');
            el.appendChild(span);
            return span;
        });

        // Group words by their vertical position
        const rows = [];
        let lastTop = null;
        for (const w of words) {
            const top = w.offsetTop;
            if (lastTop === null || Math.abs(top - lastTop) > 2) rows.push([]);
            rows[rows.length - 1].push(w.textContent);
            lastTop = top;
        }

        el.textContent = '';
        p.lines = rows.map((row, i) => {
            const line = document.createElement('span');
            line.className = 'line';
            line.textContent = row.join('').trimEnd();
            el.appendChild(line);
            if (i < rows.length - 1) el.appendChild(document.createElement('br'));
            return line;
        });
    }

    // Read the two colours from CSS so they're set in one place
    const parse = (str) => (str.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    let muted = [189, 189, 189];
    let ink = [13, 13, 13];
    function readColours() {
        const probe = document.createElement('span');
        section.appendChild(probe);
        probe.style.color = 'var(--about-muted)';
        muted = parse(getComputedStyle(probe).color);
        probe.style.color = 'var(--about-ink)';
        ink = parse(getComputedStyle(probe).color);
        probe.remove();
    }
    const mixColour = (t) => `rgb(${muted.map((m, i) => Math.round(m + (ink[i] - m) * t)).join(',')})`;

    function updateLines() {
        for (const p of paragraphs) {
            const t = progress(p.el, LINES_RANGE);
            const n = p.lines.length;
            // Each line gets its own slice of the progress, slightly overlapping
            const span = 1 / (n - (n - 1) * LINE_OVERLAP);
            p.lines.forEach((line, i) => {
                const start = i * span * (1 - LINE_OVERLAP);
                const v = clamp01((t - start) / span);
                line.style.color = mixColour(v);
            });
        }
    }


    /* ======================================================================
       2. Signature
       Each stroke is drawn with stroke-dashoffset: the dash starts fully
       offset (invisible) and is pulled back to 0 (fully drawn).
       ====================================================================== */
    const signature = section.querySelector('[data-signature]');
    const strokes = signature
        ? [...signature.querySelectorAll('path')].map((path) => {
              const length = path.getTotalLength();
              path.style.strokeDasharray = `${length} ${length}`;
              path.style.strokeDashoffset = `${length}`;
              return { path, length };
          })
        : [];

    // Timeline: each stroke gets a slice of the scroll range in proportion to
    // its length, with a short pen lift before the next one
    const average = strokes.reduce((sum, s) => sum + s.length, 0) / (strokes.length || 1);
    let t = 0;
    const timeline = strokes.map((s) => {
        const item = { ...s, start: t, duration: s.length };
        t += s.length + average * PEN_LIFT;
        return item;
    });
    const totalTime = t || 1;

    // Pen speed eases in and out within each stroke, like a real hand
    const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

    function drawSignatureAt(pos) {
        for (const s of timeline) {
            const k = easeInOut(clamp01((pos - s.start) / s.duration));
            s.path.style.strokeDashoffset = `${s.length * (1 - k)}`;
        }
    }

    function updateSignature() {
        if (!signature) return;
        drawSignatureAt(progress(signature, SIGNATURE_RANGE) * totalTime);
    }


    /* ======================================================================
       3. Parallax
       ====================================================================== */
    const movers = [...section.querySelectorAll('[data-speed]')].map((el) => ({
        el,
        speed: parseFloat(el.dataset.speed) || 0,
        centre: 0
    }));

    // Where each element sits on the page without any transform
    function measureMovers() {
        for (const m of movers) {
            m.el.style.transform = '';
            const r = m.el.getBoundingClientRect();
            m.centre = r.top + window.scrollY + r.height / 2;
        }
    }

    function updateMovers() {
        const viewCentre = window.scrollY + window.innerHeight / 2;
        for (const m of movers) {
            // Below the screen centre: pushed down; it then catches up faster
            // than the page scrolls (or lags behind for negative speeds)
            const y = (m.centre - viewCentre) * m.speed;
            m.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        }
    }


    /* ======================================================================
       Loop & setup
       ====================================================================== */
    let ticking = false;

    function update() {
        ticking = false;
        updateLines();
        updateSignature();
        if (!reducedMotion) updateMovers();
    }

    function requestUpdate() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    function layout() {
        readColours();
        paragraphs.forEach(splitLines);
        if (!reducedMotion) measureMovers();
        update();
    }

    if (reducedMotion) {
        // Everything shown in its final state
        layout();
        paragraphs.forEach((p) => p.lines.forEach((l) => (l.style.color = '')));
        strokes.forEach((s) => (s.path.style.strokeDashoffset = '0'));
        return;
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 150);
    });

    // Line breaks depend on the font, so split once it has loaded
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(layout);
    layout();
})();