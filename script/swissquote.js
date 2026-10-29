/* ==========================================================================
   swissquote.js — interactive parts of swissquote.html
   1. Slide sets (what lives in images/swissquote/)
   2. Carousel (used by the players and the lightbox)
   3. Players with tabs
   4. Marquee
   5. Count-up stats
   6. Anatomy hotspots
   7. AI zoom (tap on touch screens)
   8. Safe margins vs full bleed
   9. Collection + lightbox
   ========================================================================== */
(() => {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. Slide sets ----------
       Files are named <set>-01.webp (1080px) and <set>-01-s.webp (540px).
       To add a carousel: export its slides with that naming and add a line here. */
    const DIR = 'images/swissquote/';
    const SETS = {
        lux:          { title: 'Wealth in Luxembourg',                 count: 10 },
        hedge:        { title: 'Do hedge funds beat the market?',      count: 9 },
        numbers:      { title: '2025 in numbers',                      count: 5 },
        cycling:      { title: 'Lessons in cycling & building wealth', count: 8 },
        bonds:        { title: 'You hate bonds. What now?',            count: 8 },
        decade:       { title: 'The lost decade',                      count: 9 },
        lombard:      { title: 'Liquidity without liquidating',        count: 9 },
        ride:         { title: 'One mission that matters',             count: 8 },
    };

    const pad = (n) => String(n).padStart(2, '0');
    const file = (set, n, small) => `${DIR}${set}-${pad(n)}${small ? '-s' : ''}.webp`;

    function slideImage(set, n, sizes, eager) {
        const img = document.createElement('img');
        img.src = file(set, n);
        img.srcset = `${file(set, n, true)} 540w, ${file(set, n)} 1080w`;
        img.sizes = sizes;
        img.width = 1080;
        img.height = 1080;
        img.alt = `${SETS[set].title}, slide ${n} of ${SETS[set].count}`;
        img.decoding = 'async';
        if (!eager) img.loading = 'lazy';
        img.draggable = false;
        return img;
    }


    /* ---------- 2. Carousel ----------
       Markup: .sq-carousel > .sq-carousel__viewport > ul.sq-carousel__track
               + [data-prev] [data-next] [data-count] [data-progress] */
    class Carousel {
        constructor(root, sizes) {
            this.root = root;
            this.sizes = sizes;
            this.viewport = root.querySelector('.sq-carousel__viewport');
            this.track = root.querySelector('.sq-carousel__track');
            this.prevBtn = root.querySelector('[data-prev]');
            this.nextBtn = root.querySelector('[data-next]');
            this.countEl = root.querySelector('[data-count]');
            this.progressEl = root.querySelector('[data-progress]');
            this.index = 0;
            this.slides = [];

            this.prevBtn?.addEventListener('click', () => this.go(this.index - 1));
            this.nextBtn?.addEventListener('click', () => this.go(this.index + 1));
            this.viewport.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.index - 1); }
                if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.index + 1); }
            });
            this.bindDrag();
            new ResizeObserver(() => this.layout(false)).observe(this.viewport);
        }

        load(set, startAt = 0) {
            const { count } = SETS[set];
            this.set = set;
            this.track.innerHTML = '';
            this.slides = [];
            for (let n = 1; n <= count; n++) {
                const li = document.createElement('li');
                li.className = 'sq-carousel__slide';
                li.appendChild(slideImage(set, n, this.sizes, n <= 2));
                li.addEventListener('click', () => {
                    if (this.dragged) return;
                    const i = this.slides.indexOf(li);
                    if (i !== this.index) this.go(i);
                });
                this.track.appendChild(li);
                this.slides.push(li);
            }
            this.viewport.setAttribute('aria-label', `${SETS[set].title}, ${count} slides`);
            this.index = Math.min(startAt, count - 1);
            this.layout(false);
        }

        // Swap to another set with a quick fade
        swap(set) {
            if (reducedMotion) { this.load(set); return; }
            this.track.classList.add('is-swapping');
            setTimeout(() => {
                this.load(set);
                requestAnimationFrame(() => this.track.classList.remove('is-swapping'));
            }, 300);
        }

        offsetFor(i) {
            const slide = this.slides[0];
            if (!slide) return 0;
            const w = slide.offsetWidth;
            const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
            return (this.viewport.clientWidth - w) / 2 - i * (w + gap);
        }

        layout(animate = true) {
            this.track.classList.toggle('no-anim', !animate);
            this.base = this.offsetFor(this.index);
            this.track.style.transform = `translate3d(${this.base}px, 0, 0)`;
            if (!animate) {
                this.track.getBoundingClientRect();          // apply before re-enabling transitions
                this.track.classList.remove('no-anim');
            }
            this.slides.forEach((s, i) => {
                const active = i === this.index;
                s.classList.toggle('is-active', active);
                s.setAttribute('aria-hidden', active ? 'false' : 'true');
            });
            const total = this.slides.length;
            if (this.countEl) this.countEl.innerHTML = `<b>${pad(this.index + 1)}</b> / ${pad(total)}`;
            if (this.progressEl) this.progressEl.style.setProperty('--p', (this.index + 1) / total);
            if (this.prevBtn) this.prevBtn.disabled = this.index === 0;
            if (this.nextBtn) this.nextBtn.disabled = this.index === total - 1;
        }

        go(i) {
            const next = Math.max(0, Math.min(this.slides.length - 1, i));
            if (next === this.index) { this.layout(true); return; }
            this.index = next;
            this.layout(true);
        }

        bindDrag() {
            let startX = 0, startY = 0, dx = 0, active = false, horizontal = null;
            const vp = this.viewport;

            vp.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                active = true; horizontal = null; dx = 0; this.dragged = false;
                startX = e.clientX; startY = e.clientY;
            });
            vp.addEventListener('pointermove', (e) => {
                if (!active) return;
                dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                    horizontal = Math.abs(dx) > Math.abs(dy);
                    if (horizontal) {
                        vp.setPointerCapture(e.pointerId);
                        vp.classList.add('is-dragging');
                        this.track.classList.add('no-anim');
                    }
                }
                if (!horizontal) return;
                this.dragged = true;
                // Resist at the ends
                const atEdge = (this.index === 0 && dx > 0) || (this.index === this.slides.length - 1 && dx < 0);
                const move = atEdge ? dx * 0.3 : dx;
                this.track.style.transform = `translate3d(${this.base + move}px, 0, 0)`;
            });
            const end = () => {
                if (!active) return;
                active = false;
                vp.classList.remove('is-dragging');
                this.track.classList.remove('no-anim');
                if (horizontal) {
                    const w = this.slides[0]?.offsetWidth || 400;
                    const threshold = Math.min(80, w * 0.15);
                    if (dx < -threshold) this.go(this.index + 1);
                    else if (dx > threshold) this.go(this.index - 1);
                    else this.layout(true);
                }
                // let the click that follows a drag be ignored
                setTimeout(() => { this.dragged = false; }, 0);
            };
            vp.addEventListener('pointerup', end);
            vp.addEventListener('pointercancel', end);
        }
    }


    /* ---------- 3. Players with tabs ---------- */
    const PLAYER_SIZES = '(max-width: 600px) 78vw, (max-width: 1400px) 40vw, 560px';

    document.querySelectorAll('[data-player]').forEach((player) => {
        const carousel = new Carousel(player.querySelector('.sq-carousel'), PLAYER_SIZES);
        const tabs = [...player.querySelectorAll('[role="tab"]')];

        if (!tabs.length) {
            carousel.load(player.dataset.player);
            return;
        }

        const select = (tab, focus) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', on);
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) panel.hidden = !on;
            });
            if (focus) tab.focus();
        };

        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => {
                if (tab.getAttribute('aria-selected') === 'true') return;
                select(tab);
                carousel.swap(tab.dataset.set);
            });
            // Arrow keys move between tabs
            tab.addEventListener('keydown', (e) => {
                const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!dir) return;
                const next = tabs[(i + dir + tabs.length) % tabs.length];
                select(next, true);
                carousel.swap(next.dataset.set);
            });
        });

        select(tabs[0]);
        carousel.load(tabs[0].dataset.set);
    });


    /* ---------- 4. Marquee ----------
       data-slides="set:n set:n ..." on each row. The list is doubled so the
       -50% animation loops without a jump. */
    document.querySelectorAll('[data-marquee]').forEach((row) => {
        const track = row.querySelector('.sq-marquee__track');
        const items = row.dataset.marquee.trim().split(/\s+/).map((s) => s.split(':'));
        const build = (hidden) => items.forEach(([set, n]) => {
            const img = document.createElement('img');
            img.src = file(set, +n, true);
            img.width = 540;
            img.height = 540;
            img.alt = hidden ? '' : `${SETS[set].title}, slide ${+n}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            track.appendChild(img);
        });
        build(false);
        build(true);
        // Same speed on every screen: ~45px per second
        const setSpeed = () => {
            const half = track.scrollWidth / 2;
            if (half) track.style.setProperty('--duration', `${Math.round(half / 45)}s`);
        };
        setSpeed();
        window.addEventListener('load', setSpeed, { once: true });
    });


    /* ---------- 5. Count-up stats ---------- */
    const counters = document.querySelectorAll('[data-count-to]');
    const format = (el, v) => {
        const d = +(el.dataset.decimals || 0);
        const num = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
        const prefix = el.dataset.prefix ? `<small>${el.dataset.prefix}</small>` : '';
        el.innerHTML = `${prefix}${num}${el.dataset.suffix || ''}`;
    };
    if ('IntersectionObserver' in window && !reducedMotion) {
        counters.forEach((el) => format(el, 0));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                io.unobserve(entry.target);
                const el = entry.target;
                const to = parseFloat(el.dataset.countTo);
                const t0 = performance.now();
                const dur = 1600;
                const tick = (t) => {
                    const p = Math.min(1, (t - t0) / dur);
                    format(el, to * (1 - Math.pow(1 - p, 3)));
                    if (p < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
        }, { threshold: 0.6 });
        counters.forEach((el) => io.observe(el));
    }


    /* ---------- 6. Anatomy hotspots ---------- */
    document.querySelectorAll('[data-anatomy]').forEach((box) => {
        const spots = [...box.querySelectorAll('.sq-hotspot')];
        const notes = [...box.querySelectorAll('.sq-anatomy__note')];
        const activate = (id) => {
            box.dataset.active = id;
            spots.forEach((s) => {
                const on = s.dataset.note === id;
                s.classList.toggle('is-active', on);
                s.setAttribute('aria-pressed', on);
            });
            notes.forEach((n) => n.classList.toggle('is-active', n.dataset.note === id));
        };
        [...spots, ...notes].forEach((el) => {
            el.addEventListener('mouseenter', () => activate(el.dataset.note));
            el.addEventListener('focus', () => activate(el.dataset.note));
            el.addEventListener('click', () => activate(el.dataset.note));
        });
        activate('1');
    });


    /* ---------- 7. AI zoom: hover zooms on desktop, tap toggles on touch ---------- */
    document.querySelectorAll('.sq-ai__frame').forEach((frame) => {
        frame.addEventListener('click', () => {
            const on = !frame.classList.contains('is-zoomed');
            document.querySelectorAll('.sq-ai__frame.is-zoomed').forEach((f) => {
                f.classList.remove('is-zoomed');
                f.setAttribute('aria-pressed', 'false');
            });
            frame.classList.toggle('is-zoomed', on);
            frame.setAttribute('aria-pressed', on);
        });
    });


    /* ---------- 8. Safe margins vs full bleed ---------- */
    document.querySelectorAll('[data-compare]').forEach((box) => {
        const guides = box.querySelector('[data-guides]');
        guides?.addEventListener('click', () => {
            const on = !box.classList.contains('show-guides');
            box.classList.toggle('show-guides', on);
            guides.setAttribute('aria-pressed', on);
        });

        const slots = {
            before: box.querySelector('[data-slot="before"]'),
            after: box.querySelector('[data-slot="after"]'),
        };
        const pairs = [...box.querySelectorAll('[data-pair]')];
        const show = (btn) => {
            pairs.forEach((p) => p.setAttribute('aria-pressed', p === btn));
            ['before', 'after'].forEach((side) => {
                const slot = slots[side];
                const img = slot.querySelector('img');
                const [set, n] = btn.dataset[side].split(':');
                const caption = slot.querySelector('figcaption span');
                const swapIn = () => {
                    img.src = file(set, +n);
                    img.srcset = `${file(set, +n, true)} 540w, ${file(set, +n)} 1080w`;
                    img.alt = `${SETS[set].title}, slide ${+n}`;
                    if (caption) caption.textContent = btn.dataset[`${side}Date`] || '';
                    img.onload = () => img.classList.remove('is-fading');
                };
                if (reducedMotion) { swapIn(); return; }
                img.classList.add('is-fading');
                setTimeout(swapIn, 300);
            });
        };
        pairs.forEach((btn) => btn.addEventListener('click', () => {
            if (btn.getAttribute('aria-pressed') !== 'true') show(btn);
        }));
    });


    /* ---------- 9. Collection + lightbox ---------- */
    const dialog = document.querySelector('.sq-lightbox');
    if (dialog && typeof dialog.showModal === 'function') {
        const lightbox = new Carousel(dialog.querySelector('.sq-carousel'), '(max-width: 900px) 92vw, 860px');
        const title = dialog.querySelector('[data-title]');
        let opener = null;

        const open = (set, btn) => {
            opener = btn;
            title.innerHTML = `${SETS[set].title} <span>· ${SETS[set].count} slides</span>`;
            dialog.showModal();
            document.documentElement.style.overflow = 'hidden';
            lightbox.load(set);
            dialog.querySelector('.sq-carousel__viewport').focus();
        };
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        // Arrow keys work wherever focus is inside the lightbox
        dialog.addEventListener('keydown', (e) => {
            if (e.target.closest('.sq-carousel__viewport')) return;   // handled by the carousel
            if (e.key === 'ArrowRight') { e.preventDefault(); lightbox.go(lightbox.index + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); lightbox.go(lightbox.index - 1); }
        });
        dialog.addEventListener('close', () => {
            document.documentElement.style.overflow = '';
            opener?.focus();
        });
        // Click on the dark area (outside slide and buttons) closes it
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog || e.target.classList.contains('sq-lightbox__body')) dialog.close();
        });

        document.querySelectorAll('[data-open]').forEach((btn) => {
            btn.addEventListener('click', () => open(btn.dataset.open, btn));
        });
    }
})();