/* ==========================================================================
   hero.js — landing hero interactions

   1. Liquid reveal: the cursor stirs a small fluid simulation. The faster
      you move, the bigger the blob; slow movements leave a small one.
      Where the ink flows:
        - the portrait becomes the mountain version
        - the background is painted black (covering the lines)
        - the lettering and small copy swap colours (white ↔ blue)
   2. Idle swipe: after 10s without movement, an invisible cursor swipes
      across the face to show visitors they can do it.
   3. Parallax: portrait drifts with the cursor, lettering and the contour
      image (images/hero/contours.svg) drift the opposite way.

   The liquid needs WebGL2 and a page served over http(s). Without it a
   simpler 2D brush is used, so there's always an effect.
   ========================================================================== */
(() => {
    'use strict';

    const hero = document.querySelector('[data-hero]');
    if (!hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Tweakables ---------- */
    const FLUID = {
        simResolution: 128,      // fluid grid; higher = finer swirls, slower
        dyeResolution: 512,      // ink grid; higher = sharper shapes
        brushSize: 0.0009,       // blob size at full speed (squared share of the hero height)
        minSize: 0.25,           // blob size when moving slowly (share of full size)
        fullSpeed: 1.4,          // speed (hero heights / s) at which the blob reaches full size
        force: 2400,             // how hard the cursor pushes the fluid
        ink: 1.0,                // ink added per splat
        inkFade: 0.9,            // how fast the ink disappears (higher = shorter trail)
        inkClear: 0.3,           // ink removed per second, so no faint leftovers come back
        flowFade: 1.8,           // how fast the motion calms down (higher = less drift)
        swirl: 10,               // vorticity: higher = curlier shapes
        pressure: 0.8,
        pressureIterations: 20,
        edge: 0.3,               // ink level where the shape's edge sits
        settleTime: 3500,        // ms after the last stroke before the sim sleeps

        patch: [0, 0, 0]         // background colour inside the ink (black, covers the lines)
    };

    const DEMO = {
        interval: 10000,         // ms without movement before it swipes by itself
        firstDelay: 2500,        // ms after load for the first swipe
        passDuration: 900,       // ms per pass across the face
        gap: 180,
        passes: [                // height on the portrait (0 top – 1 bottom) and direction
            { y: 0.34, dir: 1 },
            { y: 0.5, dir: -1 }
        ]
    };

    const PARALLAX_EASE = 0.1;   // depth per element: data-depth in the HTML


    /* ======================================================================
       Shared state
       ====================================================================== */
    const pointer = { x: 0, y: 0, nx: 0, ny: 0, dirty: false, reset: true };
    let running = false;
    let lastTime = 0;

    const ease = (amount, dtMs) => 1 - Math.pow(1 - amount, dtMs / 16.667);
    const smoothstep = (a, b, x) => {
        const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
        return t * t * (3 - 2 * t);
    };

    const portraitEl = hero.querySelector('[data-reveal]');
    const snowEl = hero.querySelector('.landing__snow');
    const textEls = [...hero.querySelectorAll('[data-recolor]')];


    /* ======================================================================
       Parallax
       ====================================================================== */
    const layers = reducedMotion
        ? []
        : [...hero.querySelectorAll('[data-depth]')].map((el) => ({
              el,
              depth: parseFloat(el.dataset.depth) || 0,
              x: 0,
              y: 0
          }));

    function stepParallax(dtMs) {
        let moving = false;
        const k = ease(PARALLAX_EASE, dtMs);
        for (const layer of layers) {
            const tx = pointer.nx * layer.depth;
            const ty = pointer.ny * layer.depth;
            layer.x += (tx - layer.x) * k;
            layer.y += (ty - layer.y) * k;
            if (Math.abs(tx - layer.x) > 0.05 || Math.abs(ty - layer.y) > 0.05) {
                moving = true;
            } else {
                layer.x = tx;
                layer.y = ty;
            }
            layer.el.style.transform = `translate3d(${layer.x.toFixed(2)}px, ${layer.y.toFixed(2)}px, 0)`;
        }
        return moving;
    }


    /* ======================================================================
       Idle swipe path (shared by both effects)
       Returns a point on the portrait (0–1, top-left origin) or null.
       ====================================================================== */
    function createDemo() {
        const d = { active: false, start: null, passes: [], last: null };
        return {
            get active() { return d.active; },
            start() {
                d.active = true;
                d.start = null;
                d.last = null;
                d.passes = DEMO.passes.map((p) => ({ ...p, y: p.y + (Math.random() - 0.5) * 0.06 }));
            },
            stop() {
                d.active = false;
                d.last = null;
            },
            // Returns [previous, current] portrait points while a pass is running
            next(now) {
                if (!d.active) return null;
                if (d.start === null) d.start = now;
                const slot = DEMO.passDuration + DEMO.gap;
                const t = Math.max(0, now - d.start);
                if (t >= d.passes.length * slot) {
                    d.active = false;
                    d.last = null;
                    return null;
                }
                const i = Math.floor(t / slot);
                const local = (t - i * slot) / DEMO.passDuration;
                if (local > 1) {
                    d.last = null;
                    return null;
                }
                const pass = d.passes[i];
                const e = 0.5 - 0.5 * Math.cos(Math.PI * local);
                const pt = {
                    pass: i,
                    x: -0.1 + (pass.dir > 0 ? e : 1 - e) * 1.2,
                    y: pass.y + Math.sin(local * Math.PI * 2) * 0.025
                };
                const prev = d.last && d.last.pass === i ? d.last : null;
                d.last = pt;
                return prev ? [prev, pt] : null;
            }
        };
    }


    /* ======================================================================
       Liquid reveal (WebGL2)
       ----------------------------------------------------------------------
       A "stable fluids" solver: the cursor adds velocity and ink, the
       velocity moves itself and the ink, swirls are boosted, and pressure
       keeps it flowing like a liquid. The WebGL layer then draws the whole
       hero picture: the black patch, portrait, snow and lettering,
       using the thresholded ink as the mask.
       ====================================================================== */
    let fx = null;
    const useFallback = (reason) => {
        if (reason) console.warn('Hero: liquid effect unavailable, using simple brush.', reason);
        hero.classList.remove('is-fx-ready');
        fx = createSimpleReveal();
        kick();
    };

    if (location.protocol === 'file:') {
        console.warn('Hero: open this page through a local server (e.g. VS Code Live Server) to see the liquid effect. Browsers block it on file:// pages.');
    }

    function createFluid(onFail) {
        if (!portraitEl || location.protocol === 'file:') return null;

        let canvas = hero.querySelector('.landing__fx');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'landing__fx';
            canvas.setAttribute('aria-hidden', 'true');
            hero.prepend(canvas);
        }

        const gl = canvas.getContext('webgl2', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            depth: false,
            stencil: false
        });
        if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
            canvas.remove();
            console.warn('Hero: WebGL2 float textures not supported, using simple brush.');
            return null;
        }

        /* ---------- Shaders ---------- */
        const VERT = `#version 300 es
            precision highp float;
            in vec2 aPos;
            uniform vec2 texelSize;
            out vec2 vUv, vL, vR, vT, vB;
            void main() {
                vUv = aPos * 0.5 + 0.5;
                vL = vUv - vec2(texelSize.x, 0.0);
                vR = vUv + vec2(texelSize.x, 0.0);
                vT = vUv + vec2(0.0, texelSize.y);
                vB = vUv - vec2(0.0, texelSize.y);
                gl_Position = vec4(aPos, 0.0, 1.0);
            }`;

        const HEAD = `#version 300 es
            precision highp float;
            precision highp sampler2D;
            in vec2 vUv, vL, vR, vT, vB;
            out vec4 o;
        `;

        // Elongated splat, stretched along the direction of travel.
        // mode 0 (velocity): steer the flow towards the cursor's direction
        // mode 1 (ink): keep the strongest value, so lingering on one spot
        //               never builds up into a big round puddle
        const SPLAT = HEAD + `
            uniform sampler2D uTarget;
            uniform float aspectRatio, radius, maxValue;
            uniform vec3 color;
            uniform vec2 point;
            void main() {
                vec2 p = vUv - point;
                p.x *= aspectRatio;
                vec3 s = exp(-dot(p, p) / radius) * color;
                vec3 base = texture(uTarget, vUv).xyz;
                o = vec4(clamp(base + s, -maxValue, maxValue), 1.0);
            }`;

        const ADVECT = HEAD + `
            uniform sampler2D uVelocity, uSource;
            uniform vec2 texelSize;
            uniform float dt, dissipation, clearRate;
            void main() {
                vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
                vec4 v = texture(uSource, coord) / (1.0 + dissipation * dt);
                // Linear clean-up, so faint leftovers fully disappear
                o = sign(v) * max(abs(v) - clearRate * dt, 0.0);
            }`;

        const DIVERGENCE = HEAD + `
            uniform sampler2D uVelocity;
            void main() {
                float L = texture(uVelocity, vL).x;
                float R = texture(uVelocity, vR).x;
                float T = texture(uVelocity, vT).y;
                float B = texture(uVelocity, vB).y;
                vec2 C = texture(uVelocity, vUv).xy;
                if (vL.x < 0.0) L = -C.x;
                if (vR.x > 1.0) R = -C.x;
                if (vT.y > 1.0) T = -C.y;
                if (vB.y < 0.0) B = -C.y;
                o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
            }`;

        const CURL = HEAD + `
            uniform sampler2D uVelocity;
            void main() {
                float L = texture(uVelocity, vL).y;
                float R = texture(uVelocity, vR).y;
                float T = texture(uVelocity, vT).x;
                float B = texture(uVelocity, vB).x;
                o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
            }`;

        const VORTICITY = HEAD + `
            uniform sampler2D uVelocity, uCurl;
            uniform float curl, dt;
            void main() {
                float L = texture(uCurl, vL).x;
                float R = texture(uCurl, vR).x;
                float T = texture(uCurl, vT).x;
                float B = texture(uCurl, vB).x;
                float C = texture(uCurl, vUv).x;
                vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
                force /= length(force) + 0.0001;
                force *= curl * C;
                force.y *= -1.0;
                vec2 v = texture(uVelocity, vUv).xy + force * dt;
                o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
            }`;

        const PRESSURE = HEAD + `
            uniform sampler2D uPressure, uDivergence;
            void main() {
                float L = texture(uPressure, vL).x;
                float R = texture(uPressure, vR).x;
                float T = texture(uPressure, vT).x;
                float B = texture(uPressure, vB).x;
                float div = texture(uDivergence, vUv).x;
                o = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
            }`;

        const GRADIENT = HEAD + `
            uniform sampler2D uPressure, uVelocity;
            void main() {
                float L = texture(uPressure, vL).x;
                float R = texture(uPressure, vR).x;
                float T = texture(uPressure, vT).x;
                float B = texture(uPressure, vB).x;
                vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
                o = vec4(v, 0.0, 1.0);
            }`;

        const SCALE = HEAD + `
            uniform sampler2D uTexture;
            uniform float value;
            void main() { o = value * texture(uTexture, vUv); }`;

        // Shared helpers for the two picture passes
        const MASK = `
            uniform sampler2D uDye;
            uniform float uEdge;
            float inkMask() {
                float d = texture(uDye, vUv).r;
                float aa = max(fwidth(d), 0.0005);
                return smoothstep(uEdge - aa, uEdge + aa, d);
            }
            // Samples a texture placed at a box (x, y, w, h in hero uv); 0 outside
            vec4 boxed(sampler2D t, vec4 box, vec2 shift) {
                vec2 uv = (vUv - box.xy) / box.zw - shift;
                vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
                return texture(t, clamp(uv, 0.0, 1.0)) * inside.x * inside.y;
            }
        `;

        // Background, patch, portrait and snow
        const SCENE = HEAD + MASK + `
            uniform sampler2D uBase, uMountain, uSnow;
            uniform vec4 uPortrait, uSnowBox;
            uniform vec3 uPatch;
            uniform float uHasSnow;
            void main() {
                float m = inkMask();

                // Background: transparent (the contour image shows through),
                // painted with the patch colour where the ink is
                vec4 bg = vec4(uPatch, 1.0) * m;

                vec4 p = mix(boxed(uBase, uPortrait, vec2(0.0)), boxed(uMountain, uPortrait, vec2(0.0)), m);
                vec4 snow = boxed(uSnow, uSnowBox, vec2(0.0)) * uHasSnow;

                vec4 scene = p + bg * (1.0 - p.a);
                o = snow + scene * (1.0 - snow.a);
            }`;

        // One text element: its normal colour outside the ink, swapped inside
        const TEXT = HEAD + MASK + `
            uniform sampler2D uText;
            uniform vec4 uBox;
            uniform vec3 uColor, uColorInk;
            void main() {
                float a = boxed(uText, uBox, vec2(0.0)).a;
                vec3 c = mix(uColor, uColorInk, inkMask());
                o = vec4(c * a, a);
            }`;

        /* ---------- GL helpers ---------- */
        function compile(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        }

        let vert;
        function program(fragSrc) {
            const p = gl.createProgram();
            gl.attachShader(p, vert);
            gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
            gl.bindAttribLocation(p, 0, 'aPos');
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
            const u = {};
            const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < n; i++) {
                const name = gl.getActiveUniform(p, i).name;
                u[name] = gl.getUniformLocation(p, name);
            }
            return { use: () => (gl.useProgram(p), u) };
        }

        let P;
        try {
            vert = compile(gl.VERTEX_SHADER, VERT);
            P = {
                splat: program(SPLAT),
                advect: program(ADVECT),
                divergence: program(DIVERGENCE),
                curl: program(CURL),
                vorticity: program(VORTICITY),
                pressure: program(PRESSURE),
                gradient: program(GRADIENT),
                scale: program(SCALE),
                scene: program(SCENE),
                text: program(TEXT)
            };
        } catch (err) {
            canvas.remove();
            console.warn('Hero: shader setup failed, using simple brush.', err);
            return null;
        }

        gl.bindVertexArray(gl.createVertexArray());
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        function blit(target) {
            if (target) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
                gl.viewport(0, 0, target.w, target.h);
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            }
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }

        function target(w, h, internal, format) {
            gl.activeTexture(gl.TEXTURE0);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error('Float render targets not supported');
            }
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return {
                tex, fbo, w, h,
                texel: [1 / w, 1 / h],
                bind(unit) {
                    gl.activeTexture(gl.TEXTURE0 + unit);
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    return unit;
                },
                free() {
                    gl.deleteTexture(tex);
                    gl.deleteFramebuffer(fbo);
                }
            };
        }

        function doubleTarget(w, h, internal, format) {
            let a = target(w, h, internal, format);
            let b = target(w, h, internal, format);
            return {
                w, h, texel: a.texel,
                get read() { return a; },
                get write() { return b; },
                swap() { [a, b] = [b, a]; },
                free() { a.free(); b.free(); }
            };
        }

        function imageTexture(source, mipmaps, old) {
            if (old) gl.deleteTexture(old);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            if (mipmaps) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            return tex;
        }

        /* ---------- Text → textures ---------- */
        // Each recoloured element is drawn (white) onto its own canvas, in the
        // same font and position as the real text, and uploaded once per resize.
        const PAD = 0.25;   // extra room around the text, in em
        const texts = textEls.map((el) => ({ el, tex: null, pad: 0, color: [1, 1, 1], ink: [1, 1, 1] }));

        const parseColor = (str) => {
            const c = document.createElement('canvas').getContext('2d');
            c.fillStyle = str;
            const hex = c.fillStyle;                     // normalised to #rrggbb
            if (hex.startsWith('#')) {
                return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
            }
            const m = hex.match(/[\d.]+/g) || [255, 255, 255];
            return m.slice(0, 3).map((v) => +v / 255);
        };

        function buildTextTexture(t) {
            const el = t.el;
            const cs = getComputedStyle(el);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const fontSize = parseFloat(cs.fontSize);
            const pad = fontSize * PAD;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.ceil((w + pad * 2) * dpr));
            c.height = Math.max(1, Math.ceil((h + pad * 2) * dpr));
            const g = c.getContext('2d');
            g.scale(dpr, dpr);
            g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
            g.fillStyle = '#fff';
            g.textBaseline = 'alphabetic';

            const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
            const lines = el.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
            const align = cs.textAlign;
            lines.forEach((line, i) => {
                const m = g.measureText(line);
                const asc = m.fontBoundingBoxAscent ?? fontSize * 0.958;
                const desc = m.fontBoundingBoxDescent ?? fontSize * 0.475;
                const y = pad + i * lineHeight + (lineHeight - (asc + desc)) / 2 + asc;
                let x = pad;
                if (align === 'right' || align === 'end') x = pad + w - m.width;
                else if (align === 'center') x = pad + (w - m.width) / 2;
                g.fillText(line, x, y);
            });

            t.pad = pad;
            t.color = parseColor(cs.getPropertyValue('--text-color').trim() || cs.color);
            t.ink = parseColor(cs.getPropertyValue('--ink-color').trim() || cs.color);
            t.tex = imageTexture(c, false, t.tex);
        }

        function buildTextTextures() {
            texts.forEach(buildTextTexture);
        }

        /* ---------- Resources ---------- */
        let velocity, dye, pressure, divergence, curlTarget;
        let baseTex, mountainTex, snowTex;
        let ready = false;
        let lastSplat = -Infinity;
        const boxes = { hero: null, portrait: [0, 0, 1, 1], snow: [0, 0, 0, 0] };

        function gridSize(res) {
            let aspect = canvas.width / canvas.height;
            if (aspect < 1) aspect = 1 / aspect;
            const big = Math.round(res * aspect);
            return canvas.width > canvas.height ? [big, res] : [res, big];
        }

        function buildTargets() {
            [velocity, pressure, divergence, curlTarget, dye].forEach((t) => t && t.free());
            const [sw, sh] = gridSize(FLUID.simResolution);
            const [dw, dh] = gridSize(FLUID.dyeResolution);
            velocity = doubleTarget(sw, sh, gl.RG16F, gl.RG);
            pressure = doubleTarget(sw, sh, gl.R16F, gl.RED);
            divergence = target(sw, sh, gl.R16F, gl.RED);
            curlTarget = target(sw, sh, gl.R16F, gl.RED);
            dye = doubleTarget(dw, dh, gl.R16F, gl.RED);
        }

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, Math.round(hero.clientWidth * dpr));
            const h = Math.max(1, Math.round(hero.clientHeight * dpr));
            const sizeChanged = canvas.width !== w || canvas.height !== h;
            if (sizeChanged) {
                canvas.width = w;
                canvas.height = h;
                buildTargets();
            }
            if (ready) {
                buildTextTextures();
                measure();
                render();
            }
        }

        /* ---------- Simulation ---------- */
        function splat(x, y, vx, vy, size) {
            let radius = FLUID.brushSize * size * size;
            const aspect = canvas.width / canvas.height;
            if (aspect > 1) radius *= aspect;

            const u = P.splat.use();
            gl.uniform1f(u.aspectRatio, aspect);
            gl.uniform2f(u.point, x, y);
            gl.uniform1f(u.radius, radius);

            gl.uniform1i(u.uTarget, velocity.read.bind(0));
            gl.uniform3f(u.color, vx, vy, 0);
            gl.uniform1f(u.maxValue, 1000);
            blit(velocity.write);
            velocity.swap();

            gl.uniform1i(u.uTarget, dye.read.bind(0));
            gl.uniform3f(u.color, FLUID.ink, 0, 0);
            gl.uniform1f(u.maxValue, 1);
            blit(dye.write);
            dye.swap();
        }

        // A stroke between two points (hero uv), split into a few splats so
        // fast movements still leave a continuous shape. The faster you
        // move, the bigger the blob; slow movements leave a small one.
        function stroke(from, to, now, dt) {
            const aspect = canvas.width / canvas.height;
            let dx = to[0] - from[0];
            const dy = to[1] - from[1];
            const dist = Math.hypot(dx * aspect, dy);           // in hero-height units
            if (!dist || dt <= 0) return;

            const speed = dist / dt;
            const size = FLUID.minSize + (1 - FLUID.minSize) * smoothstep(0, FLUID.fullSpeed, speed);
            const r = Math.sqrt(FLUID.brushSize) * size;
            const steps = Math.min(12, Math.max(1, Math.ceil(dist / (r * 0.6))));

            // The push is shared between the splats, so frame rate doesn't change it
            if (aspect < 1) dx *= aspect;
            const vx = (dx * FLUID.force) / steps;
            const vy = (dy * FLUID.force) / steps;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                splat(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, vx, vy, size);
            }
            lastSplat = now;
        }

        function simulate(dt) {
            let u;

            u = P.curl.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1i(u.uVelocity, velocity.read.bind(0));
            blit(curlTarget);

            u = P.vorticity.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1i(u.uVelocity, velocity.read.bind(0));
            gl.uniform1i(u.uCurl, curlTarget.bind(1));
            gl.uniform1f(u.curl, FLUID.swirl);
            gl.uniform1f(u.dt, dt);
            blit(velocity.write);
            velocity.swap();

            u = P.divergence.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1i(u.uVelocity, velocity.read.bind(0));
            blit(divergence);

            u = P.scale.use();
            gl.uniform1i(u.uTexture, pressure.read.bind(0));
            gl.uniform1f(u.value, FLUID.pressure);
            blit(pressure.write);
            pressure.swap();

            u = P.pressure.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1i(u.uDivergence, divergence.bind(0));
            for (let i = 0; i < FLUID.pressureIterations; i++) {
                gl.uniform1i(u.uPressure, pressure.read.bind(1));
                blit(pressure.write);
                pressure.swap();
            }

            u = P.gradient.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1i(u.uPressure, pressure.read.bind(0));
            gl.uniform1i(u.uVelocity, velocity.read.bind(1));
            blit(velocity.write);
            velocity.swap();

            u = P.advect.use();
            gl.uniform2fv(u.texelSize, velocity.texel);
            gl.uniform1f(u.dt, dt);
            gl.uniform1i(u.uVelocity, velocity.read.bind(0));
            gl.uniform1i(u.uSource, velocity.read.bind(0));
            gl.uniform1f(u.dissipation, FLUID.flowFade);
            gl.uniform1f(u.clearRate, 0);
            blit(velocity.write);
            velocity.swap();

            gl.uniform1i(u.uVelocity, velocity.read.bind(0));
            gl.uniform1i(u.uSource, dye.read.bind(1));
            gl.uniform1f(u.dissipation, FLUID.inkFade);
            gl.uniform1f(u.clearRate, FLUID.inkClear);
            blit(dye.write);
            dye.swap();
        }

        /* ---------- Layout → shader coordinates ---------- */
        // DOM box → [x, y, w, h] in hero uv (origin bottom-left, like GL)
        function toUv(r, h, pad = 0) {
            return [
                (r.left - pad - h.left) / h.width,
                1 - (r.bottom + pad - h.top) / h.height,
                (r.width + pad * 2) / h.width,
                (r.height + pad * 2) / h.height
            ];
        }

        function measure() {
            const h = hero.getBoundingClientRect();
            boxes.hero = h;
            boxes.portrait = toUv(portraitEl.getBoundingClientRect(), h);
            if (snowEl) boxes.snow = toUv(snowEl.getBoundingClientRect(), h);
            for (const t of texts) t.box = toUv(t.el.getBoundingClientRect(), h, t.pad);
        }

        const clientToUv = (cx, cy) => {
            const h = boxes.hero;
            return [(cx - h.left) / h.width, 1 - (cy - h.top) / h.height];
        };

        const portraitToUv = (p) => {
            const [x, y, w, h] = boxes.portrait;
            return [x + p.x * w, y + (1 - p.y) * h];
        };

        /* ---------- Render ---------- */
        const rgb = (a) => a.map((v) => v / 255);
        const patch = rgb(FLUID.patch);

        function bindTex(unit, tex) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            return unit;
        }

        function render() {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.disable(gl.BLEND);

            let u = P.scene.use();
            gl.uniform1i(u.uDye, dye.read.bind(0));
            gl.uniform1f(u.uEdge, FLUID.edge);
            gl.uniform1i(u.uVelocity, velocity.read.bind(1));
            gl.uniform1i(u.uBase, bindTex(2, baseTex));
            gl.uniform1i(u.uMountain, bindTex(3, mountainTex));
            gl.uniform1i(u.uSnow, bindTex(5, snowTex || null));
            gl.uniform4fv(u.uPortrait, boxes.portrait);
            gl.uniform4fv(u.uSnowBox, boxes.snow);
            gl.uniform1f(u.uHasSnow, snowTex ? 1 : 0);
            gl.uniform3fv(u.uPatch, patch);
            blit(null);

            // Lettering on top, blended
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            u = P.text.use();
            gl.uniform1i(u.uDye, dye.read.bind(0));
            gl.uniform1f(u.uEdge, FLUID.edge);
            for (const t of texts) {
                if (!t.tex || !t.box) continue;
                gl.uniform1i(u.uText, bindTex(1, t.tex));
                gl.uniform4fv(u.uBox, t.box);
                gl.uniform3fv(u.uColor, t.color);
                gl.uniform3fv(u.uColorInk, t.ink);
                blit(null);
            }
            gl.disable(gl.BLEND);
        }

        /* ---------- Per frame ---------- */
        const demo = createDemo();
        let lastPointerUv = null;

        function step(now, dt) {
            if (!ready) return false;
            measure();

            if (pointer.dirty) {
                const uv = clientToUv(pointer.x, pointer.y);
                if (lastPointerUv && !pointer.reset) stroke(lastPointerUv, uv, now, dt);
                lastPointerUv = uv;
                pointer.dirty = false;
                pointer.reset = false;
            }

            const seg = demo.next(now);
            if (seg) stroke(portraitToUv(seg[0]), portraitToUv(seg[1]), now, dt);

            const alive = demo.active || now - lastSplat < FLUID.settleTime;
            if (alive) simulate(dt);
            render();
            return alive;
        }

        /* ---------- Load ---------- */
        const baseImg = portraitEl.querySelector('img');
        const mountainImg = new Image();
        mountainImg.decoding = 'async';
        mountainImg.src = portraitEl.dataset.revealSrc;

        Promise.all([
            baseImg.decode(),
            mountainImg.decode(),
            snowEl ? snowEl.decode().catch(() => null) : null,
            document.fonts ? document.fonts.ready : null
        ])
            .then(() => {
                baseTex = imageTexture(baseImg, true);
                mountainTex = imageTexture(mountainImg, true);
                if (snowEl && snowEl.naturalWidth) snowTex = imageTexture(snowEl, true);
                ready = true;
                resize();
                hero.classList.add('is-fx-ready');
            })
            .catch((err) => {
                ready = false;
                canvas.remove();
                onFail(err);
            });

        new ResizeObserver(resize).observe(hero);

        // Fonts that finish loading later change the text shapes
        if (document.fonts) {
            document.fonts.addEventListener('loadingdone', () => {
                if (ready) {
                    buildTextTextures();
                    render();
                }
            });
        }

        canvas.addEventListener('webglcontextlost', () => {
            ready = false;
            canvas.remove();
            onFail('WebGL context lost');
        });

        return {
            step,
            isReady: () => ready,
            startDemo: () => ready && demo.start(),
            stopDemo: () => demo.stop()
        };
    }


    /* ======================================================================
       Simple brush (fallback)
       ----------------------------------------------------------------------
       Used when WebGL isn't available or the page is opened from file://.
       Same rules: only fast movements draw, blobs are pushed ahead in the
       direction of travel, drift on and shrink away.
       ====================================================================== */
    function createSimpleReveal() {
        const root = portraitEl;
        if (!root) return null;
        const baseImg = root.querySelector('img');

        let canvas = root.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.setAttribute('aria-hidden', 'true');
            root.appendChild(canvas);
        }
        Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
        const ctx = canvas.getContext('2d');
        const layer = document.createElement('canvas');
        const lctx = layer.getContext('2d');
        const mask = document.createElement('canvas');
        const mctx = mask.getContext('2d', { willReadFrequently: true });

        const SIMPLE = { radius: 0.055, life: 700, drift: 0.92, edge: [0.48, 0.52] };

        const mountainImg = new Image();
        mountainImg.src = root.dataset.revealSrc;

        let ready = false;
        let blobs = [];
        let lastPt = null;
        let wasEmpty = true;
        let lastNow = 0;
        const demo = createDemo();

        const lut = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) lut[i] = Math.round(smoothstep(SIMPLE.edge[0], SIMPLE.edge[1], i / 255) * 255);

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = layer.width = Math.max(1, Math.round(root.clientWidth * dpr));
            canvas.height = layer.height = Math.max(1, Math.round(root.clientHeight * dpr));
            mask.width = Math.max(1, Math.round(canvas.width / 4));
            mask.height = Math.max(1, Math.round(canvas.height / 4));
            wasEmpty = false;
            if (ready) draw(lastNow);
        }

        // Client point → portrait share (0–1)
        function toShare(cx, cy) {
            const r = root.getBoundingClientRect();
            return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height, h: r.height / (hero.clientHeight || 1) };
        }

        function addStroke(a, b, now, dt) {
            const mw = mask.width;
            const mh = mask.height;
            const dx = (b.x - a.x) * mw;
            const dy = (b.y - a.y) * mh;
            const dist = Math.hypot(dx, dy);
            if (!dist || dt <= 0) return;
            // speed in hero heights per second, like the WebGL version
            const speed = (Math.hypot((b.x - a.x) * (mw / mh), b.y - a.y) * (a.h || 1)) / dt;
            const strength = smoothstep(0, FLUID.fullSpeed, speed);
            const R = SIMPLE.radius * mw * (FLUID.minSize + (1 - FLUID.minSize) * strength);
            const ux = dx / dist;
            const uy = dy / dist;
            const n = Math.min(12, Math.max(1, Math.ceil(dist / (R * 0.3))));
            for (let i = 1; i <= n; i++) {
                const t = i / n;
                blobs.push({
                    x: a.x * mw + dx * t + ux * R * 0.6 * strength,
                    y: a.y * mh + dy * t + uy * R * 0.6 * strength,
                    vx: ux * R * (1.5 + 3 * strength),    // always drifts the way you moved
                    vy: uy * R * (1.5 + 3 * strength),
                    r: R * (0.85 + Math.random() * 0.3),
                    t: now
                });
            }
        }

        function draw(now) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(baseImg, 0, 0, w, h);
            if (!blobs.length) return;

            mctx.globalCompositeOperation = 'source-over';
            mctx.clearRect(0, 0, mask.width, mask.height);
            mctx.globalCompositeOperation = 'lighter';
            for (const b of blobs) {
                const k = Math.max(0, 1 - (now - b.t) / SIMPLE.life);
                const r = b.r * Math.sqrt(k) * 2;
                if (r < 0.5) continue;
                const g = mctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
                g.addColorStop(0, 'rgba(255,255,255,1)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                mctx.fillStyle = g;
                mctx.beginPath();
                mctx.arc(b.x, b.y, r, 0, Math.PI * 2);
                mctx.fill();
            }
            const img = mctx.getImageData(0, 0, mask.width, mask.height);
            for (let i = 3; i < img.data.length; i += 4) img.data[i] = lut[img.data[i]];
            mctx.putImageData(img, 0, 0);

            lctx.globalCompositeOperation = 'source-over';
            lctx.clearRect(0, 0, w, h);
            lctx.drawImage(mountainImg, 0, 0, w, h);
            lctx.globalCompositeOperation = 'destination-in';
            lctx.drawImage(mask, 0, 0, w, h);

            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(mask, 0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(layer, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }

        function step(now, dt) {
            if (!ready) return false;
            lastNow = now;

            if (pointer.dirty) {
                const pt = toShare(pointer.x, pointer.y);
                if (lastPt && !pointer.reset) addStroke(lastPt, pt, now, dt);
                lastPt = pt;
                pointer.dirty = false;
                pointer.reset = false;
            }

            const seg = demo.next(now);
            if (seg) {
                const h = root.clientHeight / (hero.clientHeight || 1);
                addStroke({ ...seg[0], h }, { ...seg[1], h }, now, dt);
            }

            const f = Math.pow(SIMPLE.drift, dt * 60);
            for (const b of blobs) {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.vx *= f;
                b.vy *= f;
            }
            blobs = blobs.filter((b) => now - b.t < SIMPLE.life);

            const empty = !blobs.length;
            if (!(empty && wasEmpty)) draw(now);
            wasEmpty = empty;
            return demo.active || !empty;
        }

        Promise.all([baseImg.decode(), mountainImg.decode()])
            .then(() => {
                ready = true;
                resize();
                baseImg.style.visibility = 'hidden';
            })
            .catch((err) => console.warn('Hero: portrait images failed to load.', err));

        new ResizeObserver(resize).observe(root);

        return {
            step,
            isReady: () => ready,
            startDemo: () => ready && demo.start(),
            stopDemo: () => demo.stop()
        };
    }


    /* ======================================================================
       Start
       ====================================================================== */

    fx = createFluid(useFallback) || createSimpleReveal();


    /* ======================================================================
       Loop
       ====================================================================== */
    function frame(now) {
        const dtMs = Math.min(Math.max(now - lastTime, 0), 50);   // cap so a background tab doesn't cause a jump
        lastTime = now;

        const parallaxMoving = stepParallax(dtMs);
        const fxMoving = fx ? fx.step(now, Math.max(dtMs, 1) / 1000) : false;

        if (parallaxMoving || fxMoving) {
            requestAnimationFrame(frame);
        } else {
            running = false;
        }
    }

    function kick() {
        if (!running) {
            running = true;
            lastTime = performance.now();
            requestAnimationFrame(frame);
        }
    }


    /* ======================================================================
       Idle swipe scheduling
       Runs when the hero is on screen, the tab is visible and the cursor
       hasn't moved for DEMO.interval (even if it's resting on the hero).
       ====================================================================== */
    let demoTimer = null;
    let heroVisible = true;

    function scheduleDemo(delay = DEMO.interval) {
        if (reducedMotion) return;
        clearTimeout(demoTimer);
        demoTimer = setTimeout(runDemo, delay);
    }

    function runDemo() {
        if (!fx || !heroVisible || document.hidden) {
            scheduleDemo();
            return;
        }
        if (!fx.isReady()) {
            scheduleDemo(500);
            return;
        }
        fx.startDemo();
        kick();
        scheduleDemo(DEMO.interval + DEMO.passes.length * (DEMO.passDuration + DEMO.gap));
    }

    function onInteract() {
        if (fx) fx.stopDemo();
        scheduleDemo();
    }

    new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
    }).observe(hero);

    scheduleDemo(DEMO.firstDelay);


    /* ======================================================================
       Input
       ====================================================================== */
    function track(e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.dirty = true;
        if (e.pointerType === 'mouse') {
            const rect = hero.getBoundingClientRect();
            pointer.nx = (e.clientX - rect.left) / rect.width - 0.5;
            pointer.ny = (e.clientY - rect.top) / rect.height - 0.5;
        }
    }

    hero.addEventListener('pointerenter', () => {
        pointer.reset = true;          // no streak from where the cursor left
    });

    hero.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' && !(e.buttons > 0 || e.pressure > 0)) return;
        track(e);
        onInteract();
        kick();
    });

    hero.addEventListener('pointerdown', (e) => {
        pointer.reset = true;
        track(e);
        onInteract();
        kick();
    });

    const release = (e) => {
        if (e.pointerType !== 'mouse') pointer.reset = true;
    };
    hero.addEventListener('pointerup', release);
    hero.addEventListener('pointercancel', release);

    hero.addEventListener('pointerleave', () => {
        pointer.reset = true;
        pointer.nx = 0;
        pointer.ny = 0;
        kick();
    });
})();