/* ============================================================
   script.js (site base)
   ============================================================ */
/* ============================================================
   MOTION SWITCH (one place for the whole site)
   true  = every visitor gets the full animations, on Windows, Edge and Mac alike.
           (Windows PCs with "Animation effects" switched off report "reduce motion",
            and would otherwise get a calm, animation-free version of the site.)
   false = follow the visitor's system "reduce motion" setting.
   ============================================================ */
const ALWAYS_ANIMATE = true;

const toggleBtn = document.getElementById("themeToggle");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");
const identityBadge = document.getElementById("identityBadge");
const settingsRows = document.querySelectorAll(".settings-row");

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
});

identityBadge?.addEventListener("click", () => {
    const isFlipped = identityBadge.classList.toggle("is-flipped");
    identityBadge.setAttribute("aria-pressed", String(isFlipped));
});

const syncThemeToggleLayout = () => {
    if (!toggleBtn) {
        return;
    }

    toggleBtn.style.removeProperty("--theme-toggle-size");
    toggleBtn.style.removeProperty("--theme-toggle-icon-size");
    toggleBtn.style.removeProperty("--theme-toggle-bottom");
    toggleBtn.style.removeProperty("--theme-toggle-left");
    toggleBtn.style.removeProperty("--theme-toggle-right");

    if (window.matchMedia("(max-width: 640px)").matches) {
        return;
    }

    const firstNavLink = navLinks[0];
    const lastNavLink = navLinks[navLinks.length - 1];

    if (!firstNavLink || !lastNavLink) {
        return;
    }

    const desiredGap = 16;
    const defaultSize = 56;
    const minSize = 42;
    const defaultBottom = 24;
    const minBottom = 12;
    const alignedLeft = Math.round(firstNavLink.getBoundingClientRect().left);
    const lastNavRect = lastNavLink.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    let size = defaultSize;
    let bottom = defaultBottom;

    const getToggleTop = () => viewportHeight - bottom - size;

    while (getToggleTop() < lastNavRect.bottom + desiredGap && size > minSize) {
        size -= 2;
    }

    while (getToggleTop() < lastNavRect.bottom + desiredGap && bottom > minBottom) {
        bottom -= 2;
    }

    if (size !== defaultSize || bottom !== defaultBottom || window.matchMedia("(max-width: 980px)").matches) {
        const iconSize = Math.round(size * 0.46);
        toggleBtn.style.setProperty("--theme-toggle-size", `${size}px`);
        toggleBtn.style.setProperty("--theme-toggle-icon-size", `${iconSize}px`);
        toggleBtn.style.setProperty("--theme-toggle-bottom", `${bottom}px`);
        toggleBtn.style.setProperty("--theme-toggle-left", "auto");
        toggleBtn.style.setProperty("--theme-toggle-right", "24px");
        return;
    }

    toggleBtn.style.setProperty("--theme-toggle-left", `${alignedLeft}px`);
};

syncThemeToggleLayout();
window.addEventListener("resize", syncThemeToggleLayout);
window.addEventListener("load", syncThemeToggleLayout);

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        const targetSection = link.dataset.section;

        navLinks.forEach((item) => item.classList.remove("active"));
        sections.forEach((section) => section.classList.remove("active"));

        link.classList.add("active");
        document.querySelector(`.section[data-section="${targetSection}"]`)?.classList.add("active");
    });
});

settingsRows.forEach((row) => {
    const value = row.querySelector("strong");
    const label = row.querySelector("span");
    const text = value?.textContent?.trim();

    if (!value || !text) {
        return;
    }

    row.setAttribute("tabindex", "0");
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Copy ${label?.textContent?.trim() ?? "setting"} value ${text}`);

    const copyValue = async () => {
        try {
            await navigator.clipboard.writeText(text);
            row.classList.add("is-copied");
            window.setTimeout(() => {
                row.classList.remove("is-copied");
            }, 1200);
        } catch (_error) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(value);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    };

    row.addEventListener("click", copyValue);
    row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            copyValue();
        }
    });
});

// Social strip highlight: a glass droplet that glides to the icon under the cursor.
//  - switches icons once the cursor passes the halfway point between two icons
//  - squeezes slightly while travelling (stretched long, pressed flat)
//  - lands with a small inertial bounce (After Effects style:
//    arrival velocity * amp * sin(freq * t) / e^(decay * t))
// Transform-only; the frame loop stops as soon as everything has settled.
document.querySelectorAll(".socials").forEach((strip) => {
    const links = Array.from(strip.querySelectorAll("a"));
    const glass = document.createElement("span");
    glass.className = "socials-glass";
    glass.setAttribute("aria-hidden", "true");
    strip.prepend(glass);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const calm = () => reduceMotion.matches && !ALWAYS_ANIMATE;

    // Inertial bounce (AE: amp / freq / decay)
    const AMP = 3.6;            // % of arrival velocity used as overshoot (AE default is 5)
    const FREQ = 2.4;           // wobbles per second
    const DECAY = 4.4;          // how fast the wobble dies out (higher = calmer)
    const END_SLOPE = 1.4;      // speed at arrival, so the bounce has momentum
    const BOUNCE_TIME = 0.9;    // seconds until the bounce is considered finished
    const MAX_BOUNCE_SPEED = 270;
    const EDGE_ROOM = 6;        // px the bounce may travel into the strip padding (presses the edge)

    // Squeeze while travelling, jelly wobble on landing (kept small)
    const TRAVEL_STRETCH = 0.26;  // wider while moving
    const TRAVEL_SQUEEZE = 0.19;  // flatter while moving
    const LAND_STRETCH = 0.11;
    const LAND_SQUEEZE = 0.09;

    const SWITCH_MARGIN = 3;    // px past the halfway point before switching (stops flicker)
    const PULL = 0.25;          // how much the droplet leans toward the cursor
    const LEAN_RATE = 14;

    let spots = [];
    let stripLeft = 0;
    let minX = 0;
    let maxX = 0;
    let current = null;
    let targetSpot = null;

    let seg = { x0: 0, x1: 0, t0: 0, dur: 0.001, m0: 0, vEnd: 0, d: 0, calm: false };
    let baseX = 0;
    let vel = 0;
    let lean = 0;
    let leanTarget = 0;
    let sx = 1;
    let sy = 1;
    let raf = 0;
    let last = 0;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const measure = () => {
        const rect = strip.getBoundingClientRect();
        stripLeft = rect.left + strip.clientLeft;
        spots = links.map((link) => ({
            link,
            left: link.offsetLeft,
            center: link.offsetLeft + link.offsetWidth / 2,
        }));
        glass.style.width = `${links[0].offsetWidth}px`;
        minX = spots[0].left;
        maxX = spots[spots.length - 1].left;
    };

    // Eased move that is still travelling when it arrives (so the bounce has momentum).
    const glide = (s, m0) =>
        3 * s * s - 2 * s * s * s + m0 * (s * s * s - 2 * s * s + s) + END_SLOPE * (s * s * s - s * s);

    const evaluate = (now) => {
        const u = Math.max(0, (now - seg.t0) / 1000);
        const hop = clamp(Math.abs(seg.d) / 48, 0.6, 1.1);

        if (u < seg.dur) {
            const s = u / seg.dur;
            return {
                x: seg.x0 + (seg.x1 - seg.x0) * glide(s, seg.m0),
                travel: seg.calm ? 0 : Math.sin(Math.PI * s) * hop,
                wobble: 0,
                done: false,
            };
        }

        const t = u - seg.dur;
        if (t >= BOUNCE_TIME || seg.calm) {
            return { x: seg.x1, travel: 0, wobble: 0, done: true };
        }

        const wobble = Math.sin(2 * Math.PI * FREQ * t) / Math.exp(DECAY * t);
        return { x: seg.x1 + seg.vEnd * (AMP / 100) * wobble, travel: 0, wobble, done: false };
    };

    const paint = () => {
        const x = clamp(baseX + lean, minX - EDGE_ROOM, maxX + EDGE_ROOM);
        glass.style.transform = `translate3d(${x.toFixed(2)}px,0,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    };

    const tick = (now) => {
        const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
        last = now;

        const r = evaluate(now);
        vel = dt > 0 ? (r.x - baseX) / dt : 0;
        baseX = r.x;
        sx = 1 + TRAVEL_STRETCH * r.travel + LAND_STRETCH * r.wobble;
        sy = 1 - TRAVEL_SQUEEZE * r.travel - LAND_SQUEEZE * r.wobble;
        lean += (leanTarget - lean) * (1 - Math.exp(-LEAN_RATE * dt));
        paint();

        if (r.done && Math.abs(leanTarget - lean) < 0.05) {
            lean = leanTarget;
            vel = 0;
            sx = 1;
            sy = 1;
            paint();
            raf = 0;
            return;
        }

        raf = requestAnimationFrame(tick);
    };

    const kick = () => {
        if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(tick);
        }
    };

    // New "keyframe": glide from wherever the droplet is now to the next icon.
    const goTo = (left, snap) => {
        const x1 = clamp(left, minX, maxX);
        const now = performance.now();

        if (snap) {
            seg = { x0: x1, x1, t0: now, dur: 0.001, m0: 0, vEnd: 0, d: 0, calm: true };
            baseX = x1;
            vel = 0;
            lean = leanTarget;
            sx = 1;
            sy = 1;
            paint();
            return;
        }

        const d = x1 - baseX;
        if (Math.abs(d) < 0.5) {
            seg = { x0: baseX, x1, t0: now, dur: 0.001, m0: 0, vEnd: 0, d: 0, calm: true };
            kick();
            return;
        }

        const quiet = calm();
        const dur = quiet ? 0.22 : clamp(0.2 + Math.abs(d) / 900, 0.2, 0.42);
        const m0 = clamp((vel * dur) / d, -1.5, 1.5); // keep current momentum if interrupted
        seg = {
            x0: baseX,
            x1,
            t0: now,
            dur,
            m0,
            d,
            calm: quiet,
            vEnd: clamp((d * END_SLOPE) / dur, -MAX_BOUNCE_SPEED, MAX_BOUNCE_SPEED),
        };
        kick();
    };

    const setCurrent = (link) => {
        if (current === link) {
            return;
        }
        current?.classList.remove("is-current");
        current = link;
        current?.classList.add("is-current");
    };

    const activate = (spot, pointerX) => {
        const wasActive = strip.classList.contains("is-active");
        leanTarget = pointerX == null ? 0 : clamp((pointerX - spot.center) * PULL, -8, 8);

        if (spot !== targetSpot) {
            targetSpot = spot;
            goTo(spot.left, !wasActive);
            setCurrent(spot.link);
        } else {
            kick();
        }

        if (!wasActive) {
            strip.classList.add("is-active");
        }
    };

    const followPointer = (event) => {
        if (!strip.classList.contains("is-active")) {
            measure();
            targetSpot = null;
        }

        const px = event.clientX - stripLeft;
        let nearest = spots[0];
        let best = Infinity;

        for (const spot of spots) {
            const distance = Math.abs(px - spot.center);
            if (distance < best) {
                best = distance;
                nearest = spot;
            }
        }

        // only switch once the cursor is clearly past the halfway point
        if (targetSpot && nearest !== targetSpot && best + SWITCH_MARGIN > Math.abs(px - targetSpot.center)) {
            nearest = targetSpot;
        }

        activate(nearest, px);
    };

    const hide = () => {
        strip.classList.remove("is-active");
        targetSpot = null;
        setCurrent(null);
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    };

    strip.addEventListener("pointerenter", followPointer);
    strip.addEventListener("pointermove", followPointer);
    strip.addEventListener("pointerleave", hide);

    links.forEach((link) =>
        link.addEventListener("focus", () => {
            if (!strip.classList.contains("is-active")) {
                measure();
                targetSpot = null;
            }
            activate(spots.find((spot) => spot.link === link) ?? spots[0], null);
        })
    );
    strip.addEventListener("focusout", (event) => {
        if (!strip.contains(event.relatedTarget)) {
            hide();
        }
    });
});

/* ============================================================
   motion toolkit
   ============================================================ */
/* Shared motion toolkit for the About redesign concepts.
   Disney principles used: anticipation, squash & stretch, slow in / slow out,
   follow-through (inertial bounce), arcs, overlapping action, secondary action.
   Everything animates transform/opacity only (Web Animations API + one rAF for orbits). */
(() => {
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const M = (window.Motion = { full: ALWAYS_ANIMATE || !reduceMq.matches });
    document.body.classList.toggle('is-calm', !M.full);
    reduceMq.addEventListener?.('change', () => {
        M.full = ALWAYS_ANIMATE || !reduceMq.matches;
        document.body.classList.toggle('is-calm', !M.full);
        M.onMotionChange?.();
    });
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const FPS = 60;
    const calm = () => !M.full;
    M.calm = calm;

    /* ---------- glide with squeeze + inertial bounce (same maths as the social strip) ---------- */
    const END = 1.4;
    const hermite = (s) => 3 * s * s - 2 * s * s * s + END * (s * s * s - s * s);

    M.glideFrames = (x0, x1, o = {}) => {
        const d = x1 - x0;
        const dur = o.dur ?? clamp(0.2 + Math.abs(d) / 1200, 0.2, 0.46);
        const AMP = o.amp ?? 3.6, F = 2.4, DEC = 4.4, BT = 0.8;
        const vmax = o.vmax ?? 300;
        const vEnd = clamp((d * END) / dur, -vmax, vmax);
        const hop = clamp(Math.abs(d) / 48, 0.6, 1.1), q = o.q ?? 1;   // q scales the squeeze (wide buttons want less)
        const frames = [];
        const N = Math.ceil((dur + BT) * FPS);
        for (let i = 0; i <= N; i++) {
            const t = i / FPS;
            if (t < dur) {
                const s = t / dur, travel = Math.sin(Math.PI * s) * hop;
                frames.push({ x: x0 + d * hermite(s), sx: 1 + 0.26 * travel * q, sy: 1 - 0.19 * travel * q });
            } else {
                const tb = t - dur, w = Math.sin(2 * Math.PI * F * tb) / Math.exp(DEC * tb);
                frames.push({ x: x1 + vEnd * (AMP / 100) * w, sx: 1 + 0.11 * w * q, sy: 1 - 0.09 * w * q });
            }
        }
        return { frames, ms: (dur + BT) * 1000 };
    };

    M.currentX = (el) => new DOMMatrix(getComputedStyle(el).transform).m41;
    M.currentY = (el) => new DOMMatrix(getComputedStyle(el).transform).m42;

    M.playGlide = (el, v1, o = {}) => {
        const vert = o.axis === 'y';
        const v0 = o.from ?? (vert ? M.currentY(el) : M.currentX(el));
        el._glide?.cancel();
        const rest = vert ? `translate3d(0,${v1}px,0)` : `translate3d(${v1}px,0,0)`;
        if (calm() || Math.abs(v1 - v0) < 0.5) { el.style.transform = rest; return; }
        const { frames, ms } = M.glideFrames(v0, v1, o);
        el.style.transform = rest;
        el._glide = el.animate(
            frames.map((f) => ({ transform: vert
                ? `translate3d(0,${f.x.toFixed(2)}px,0) scale(${f.sy.toFixed(3)},${f.sx.toFixed(3)})`   // stretch along the motion, squeeze across
                : `translate3d(${f.x.toFixed(2)}px,0,0) scale(${f.sx.toFixed(3)},${f.sy.toFixed(3)})` })),
            { duration: ms, easing: 'linear' }
        );
    };

    /* ---------- squash & stretch pulse (negative a = squash first, positive = stretch first) ---------- */
    M.pop = (el, o = {}) => {
        if (calm() || !el) return;
        const A = o.a ?? 0.3, F = o.f ?? 2.6, DEC = o.d ?? 5.5, T = o.t ?? 0.9, base = o.base ?? '';
        const kf = [];
        const N = Math.ceil(T * FPS);
        for (let i = 0; i <= N; i++) {
            const t = i / FPS, w = Math.sin(2 * Math.PI * F * t) / Math.exp(DEC * t);
            kf.push({ transform: `${base} scale(${(1 - A * 0.7 * w).toFixed(3)},${(1 + A * w).toFixed(3)})` });
        }
        el.animate(kf, { duration: T * 1000, easing: 'linear' });
    };

    /* ---------- entrance: anticipation dip, overshoot, settle ---------- */
    M.enter = (el, o = {}) => {
        if (!el) return;
        const y = o.y ?? 26;
        el.style.removeProperty('opacity');
        if (calm()) return;
        el.animate([
            { opacity: 0, transform: `translate3d(0,${y}px,0) scale(0.98,1.04)`, offset: 0 },
            { opacity: 1, transform: `translate3d(0,${-y * 0.18}px,0) scale(1.012,0.99)`, offset: 0.62 },
            { opacity: 1, transform: `translate3d(0,${y * 0.05}px,0) scale(0.998,1.004)`, offset: 0.82 },
            { opacity: 1, transform: 'translate3d(0,0,0) scale(1,1)', offset: 1 },
        ], { duration: o.dur ?? 780, delay: o.delay ?? 0, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'backwards' });
    };

    // reveal elements once, staggered, when they scroll into view
    M.reveal = (els, o = {}) => {
        const list = [...els];
        if (calm()) return;
        list.forEach((el) => { el.style.opacity = '0'; });
        const io = new IntersectionObserver((entries) => {
            entries.filter((e) => e.isIntersecting).forEach((e) => {
                io.unobserve(e.target);
                M.enter(e.target, { delay: (+e.target.dataset.rv || 0) * (o.stagger ?? 70), y: o.y });
            });
        }, { threshold: 0.12 });
        list.forEach((el, i) => { el.dataset.rv ??= i % (o.group ?? 6); io.observe(el); });
    };

    /* ---------- droplet that falls along a route: swell, stretch with speed, squash on impact ---------- */
    M.routeLine = (a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => ({ x: lerp(a.x, b.x, i / n), y: lerp(a.y, b.y, i / n) }));
    M.routePath = (path, l0, l1, kx = 1, ky = kx, n = 90) =>
        Array.from({ length: n + 1 }, (_, i) => { const p = path.getPointAtLength(lerp(l0, l1, i / n)); return { x: p.x * kx, y: p.y * ky }; });

    M.resample = (pts, n = 140) => {
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const total = cum[cum.length - 1] || 1, out = [];
        let j = 0;
        for (let k = 0; k <= n; k++) {
            const d = (total * k) / n;
            while (j < pts.length - 2 && cum[j + 1] < d) j++;
            const f = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
            out.push({ x: lerp(pts[j].x, pts[j + 1].x, f), y: lerp(pts[j].y, pts[j + 1].y, f) });
        }
        return { pts: out, fr: cum.map((c) => c / total) };
    };

    M.ripple = (host, p, o = {}) => {
        if (calm()) return;
        const r = document.createElement('i');
        r.className = 'rip';
        r.style.cssText = `left:${p.x}px;top:${p.y}px;width:${o.size ?? 64}px;height:${o.size ?? 64}px;margin:${-(o.size ?? 64) / 2}px 0 0 ${-(o.size ?? 64) / 2}px`;
        host.appendChild(r);
        r.animate([{ opacity: 0.6, transform: 'scale(0.15)' }, { opacity: 0, transform: 'scale(1)' }],
            { duration: o.ms ?? 760, easing: 'cubic-bezier(0.2,0.7,0.3,1)' }).onfinish = () => r.remove();
    };

    M.drop = (host, pts, o = {}) => new Promise((resolve) => {
        const last = pts[pts.length - 1];
        if (calm() || pts.length < 2) { o.marks?.forEach((m) => m.cb()); o.onImpact?.(); resolve(); return; }
        const el = document.createElement('i');
        el.className = 'drop' + (o.small ? ' small' : '');
        host.appendChild(el);
        let dist = 0;
        for (let i = 1; i < pts.length; i++) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const pre = o.pre ?? 150, travel = o.dur ?? clamp(300 + dist * 0.85, 380, 980), post = 280;
        const total = pre + travel + post, N = Math.ceil((total / 1000) * FPS), n = pts.length - 1;
        const at = (idx) => { const i = clamp(Math.floor(idx), 0, n - 1), f = idx - i; return { x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f), i }; };
        const kf = [];
        for (let k = 0; k <= N; k++) {
            const t = (k / N) * total;
            let tr, sx, sy, op = 1, ang;
            if (t < pre) {                                   // anticipation: gather and swell at the source
                const s = t / pre;
                tr = pts[0]; ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) - Math.PI / 2;
                sx = 1 + 0.3 * s; sy = 1 - 0.25 * s; op = Math.min(1, s * 2.5);
            } else if (t < pre + travel) {                  // fall: gravity ease-in, stretch grows with speed
                const s = (t - pre) / travel, u = Math.pow(s, 2.1), p = at(u * n), q = at(Math.min(n - 0.001, u * n + 0.6));
                tr = p; ang = Math.atan2(q.y - p.y, q.x - p.x) - Math.PI / 2;
                const stretch = 1 + 1.7 * Math.pow(s, 1.4);
                sy = stretch; sx = 1 / Math.pow(stretch, 0.6);
            } else {                                          // impact: flatten and merge
                const s = clamp((t - pre - travel) / post, 0, 1), e = 1 - Math.pow(1 - s, 3);
                tr = last; ang = Math.atan2(last.y - pts[n - 1].y, last.x - pts[n - 1].x) - Math.PI / 2;
                sy = lerp(2.7, 0.2, e); sx = lerp(0.65, 2.1, e); op = 1 - e;
            }
            kf.push({ transform: `translate3d(${tr.x.toFixed(1)}px,${tr.y.toFixed(1)}px,0) rotate(${ang.toFixed(3)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`, opacity: op });
        }
        const a = el.animate(kf, { duration: total, easing: 'linear' });
        a.onfinish = () => el.remove();
        // impacts follow the droplet's OWN clock (not a wall-clock timer), so a node / the goal reacts exactly when the droplet lands
        const events = [
            ...(o.marks || []).map((mk) => ({ t: pre + travel * Math.pow(clamp(mk.f, 0, 1), 1 / 2.1), cb: mk.cb })),
            { t: pre + travel, cb: () => { o.onImpact?.(); resolve(); } },
        ].sort((x, y) => x.t - y.t);
        const poll = () => {
            const t = a.currentTime == null ? 0 : +a.currentTime;           // null while the animation is still waiting for its first frame
            while (events.length && t >= events[0].t) events.shift().cb();
            if (!events.length) return;
            if (a.playState === 'finished' || a.playState === 'idle') { events.splice(0).forEach((e) => e.cb()); return; }
            requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
    });

    /* ---------- orbiters (secondary action): eased speed, depth scale, pass behind the planet ---------- */
    const orbits = new Set();
    let raf = 0, last = 0;
    const tick = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        let any = false;
        orbits.forEach((o) => {
            if (!o.vis || !o.root.isConnected) return;
            any = true;
            o.boost += (o.target - o.boost) * (1 - Math.exp(-dt * 3));
            o.t += dt * o.boost;
            for (const it of o.items) {
                const a = it.ph + it.w * o.t, th = a + it.e * Math.sin(a);
                const cx = it.rx * Math.cos(th), cy = it.ry * Math.sin(th);
                const x = cx * Math.cos(it.tilt) - cy * Math.sin(it.tilt), y = cx * Math.sin(it.tilt) + cy * Math.cos(it.tilt);
                const z = Math.sin(th);
                it.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(1 + 0.28 * z).toFixed(3)})`;
                it.el.style.zIndex = z > 0 ? 4 : 1;
                it.el.style.opacity = (0.5 + 0.5 * (z + 1) / 2).toFixed(2);
            }
        });
        raf = any ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    M.orbit = (root) => {
        const o = {
            root, boost: 1, target: 1, t: Math.random() * 6, vis: true,
            items: [...root.querySelectorAll('.pl-orb')].map((el) => ({
                el, rx: +el.dataset.rx, ry: +el.dataset.ry, tilt: (+el.dataset.tilt * Math.PI) / 180,
                w: +el.dataset.w, ph: (+el.dataset.ph * Math.PI) / 180, e: +el.dataset.e || 0.25,
            })),
        };
        new IntersectionObserver(([en]) => { o.vis = en.isIntersecting; if (o.vis) wake(); }).observe(root);
        orbits.add(o);
        root._orbit = o;
        wake();
        return o;
    };
    M.boost = (root, to = 3.4, ms = 1400) => {
        const o = root._orbit; if (!o) return;
        o.target = to;
        clearTimeout(o._bt);
        o._bt = setTimeout(() => { o.target = 1; }, ms);
    };

    /* ---------- glass tabs: the droplet glides, squeezes and bounces, like the social strip ---------- */
    M.tabs = (root, onChange) => {
        const glass = root.querySelector('.ab-glass');
        const btns = [...root.querySelectorAll('.ab-tab')];
        const place = (btn, animate) => {
            if (!btn || !btn.offsetWidth) return;      // page is hidden right now; measured again when shown
            glass.style.width = `${btn.offsetWidth}px`;
            if (animate) M.playGlide(glass, btn.offsetLeft, { vmax: 260 });
            else { glass._glide?.cancel(); glass.style.transform = `translate3d(${btn.offsetLeft}px,0,0)`; }
        };
        btns.forEach((btn) => btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;
            btns.forEach((b) => b.classList.toggle('active', b === btn));
            place(btn, true);
            M.pop(btn, { a: 0.12, t: 0.6 });
            onChange?.(btn.dataset.key);
        }));
        const sync = () => place(root.querySelector('.ab-tab.active'), false);
        requestAnimationFrame(sync);
        addEventListener('resize', sync);
        document.fonts?.ready.then(sync);
        return { sync };
    };
})();

/* ============================================================
   progress timeline
   ============================================================ */
/* Progress timeline (v4): the labelled droplet curve you liked, able to hold 20+ milestones.
   - The curve shows a WINDOW of up to 4 milestones (5 on very wide screens), each with its label and stem.
   - With more milestones than fit, a SLIDER appears below: drag the handle and the milestones slide along the curve live;
     on release it settles on the nearest milestone with a small elastic bounce.
   - On narrow screens it becomes a vertical rail; older milestones sit behind "Show N earlier".
   ADD AN ACHIEVEMENT: add one object to the right list below (oldest first). The goal always stays last. */
(() => {
    const M = window.Motion;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const esc = (s) => String(s).replace(/"/g, '&quot;');
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parse = (d) => { const m = /(\d+)\s+(\w{3})\w*\s+(\d{4})/.exec(d || ''); return m ? new Date(+m[3], MON.indexOf(m[2]), +m[1]).getTime() : 0; };
    const fmt = (t) => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };

    /* ---------------- your milestones (oldest first) ---------------- */
    const DATA = {
        esports: {
            items: [
                { tag: 'The beginning', title: 'Competitive Start', date: '17 Jan 2026', desc: 'Started my grind up at the beginning of 2026 and am slowly grinding my way to the top level of the FACEIT playerbase.' },
                { tag: 'Breakthrough', title: 'First Serious Milestone', date: '30 Mar 2026', desc: 'Reached 3k ELO for the first time.' },
            ],
            goal: { tag: 'Next', title: 'Final Goal', desc: 'Aim to reach 4k ELO and earn a spot on my first esports team.' },
        },
        channel: {
            items: [
                { tag: 'The start', title: 'Channel Launch', date: '10 Nov 2020', desc: 'Created the Wave channel and uploaded the first Call of Duty Warzone montage.' },
                { tag: 'Video milestone', title: 'First Big Short', date: '24 Dec 2025', desc: '"Justice Rains From Above" became the first Arc Raiders Short to reach one hundred thousand views on Christmas Eve and it felt unreal.' },
                { tag: 'Video milestone', title: 'First Hundred Views', date: '16 Mar 2026', desc: '"Solo Queue Dust 2 FACEIT – Road to 3K" became the first video to pass one hundred views.' },
            ],
            goal: { tag: 'Goal', title: 'Channel Goal', desc: 'Reach 100 subscribers on YouTube.' },
        },
    };
    M.timelineData = DATA;

    /* ---------------- markers ---------------- */
    const goalHTML = () => `<div class="gl" aria-hidden="true">
        <svg class="gl-rings" viewBox="0 0 62 62"><circle class="r1" cx="31" cy="31" r="27"/><circle class="r2" cx="31" cy="31" r="19"/></svg>
        <span class="gl-orbit o1"><i></i></span><span class="gl-orbit o2"><i></i></span>
        <span class="gl-core"><svg viewBox="0 0 62 62"><circle cx="31" cy="31" r="10.5"/><path d="M31 13.5v7M31 41.5v7M13.5 31h7M41.5 31h7"/><circle class="dot" cx="31" cy="31" r="3.2"/></svg></span></div>`;
    const centerIn = (el, host) => {
        let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
        while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
        return { x, y };
    };
    const PATH = 'M 40 178 C 190 178 215 36 372 44 C 528 52 560 188 700 164 C 812 144 834 62 930 72';
    const VBW = 1000, VBH = 245;

    M.timeline = (host, opts = {}) => {
        let key = 'esports', token = 0, ambient = 0, seen = false, mode = '';
        let all = [], offset = 0, expanded = false, pagerSig = '';
        // curve state
        let Wc = 4, kx = 1, ky = 1, H = 0, w = 0, labW = 200, labA = 14, len = 0, path = null, P0, T0, P1, T1, stemBase = 1;
        let els = { pts: [], stems: [], labs: [] };
        // slider state: pos = index of the left-most visible milestone (fractional while scrubbing)
        let pos = 0, vel = 0, target = 0, raf = 0, last = 0, dragging = false, lastRound = -1, slider = null;
        const pager = opts.pager;
        const curveOK = () => host.clientWidth >= 840;
        const perPage = () => { const w = host.clientWidth; return w >= 2650 ? 10 : w >= 2300 ? 9 : w >= 1840 ? 8 : w >= 1560 ? 7 : w >= 1300 ? 6 : w >= 1030 ? 5 : 4; };   // bigger screens show more milestones at once
        const maxPos = () => Math.max(0, all.length - Wc);
        const span = () => Math.max(1, Wc - 1);

        const text = (it) => `<div class="tl-text"><small>${it.tag}</small><h3>${it.title}</h3><p>${it.desc}</p><time${it.date ? '' : ' class="dest"'}>${it.date || 'Destination'}</time></div>`;
        const mark = (goal) => `<div class="tl-mark">${goal ? goalHTML() : '<span class="tn"><i></i></span>'}</div>`;
        const norm = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };

        /* ---------- render ---------- */
        const render = () => {
            token++; clearInterval(ambient); cancelAnimationFrame(raf); raf = 0; vel = 0; dragging = false;   // a re-render cancels anything running
            all = [...DATA[key].items, DATA[key].goal];
            mode = curveOK() ? 'curve' : 'v';
            host.classList.remove('tl-h', 'tl-v', 'tl-curve', 'is-dormant');
            host.classList.add('tl', `tl-${mode}`);
            if (mode === 'curve') {
                Wc = Math.min(perPage(), all.length);
                host.innerHTML = `<svg class="tl-svg" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="none" aria-hidden="true">
                    <path class="tl-path-glow" d="${PATH}"/><path class="tl-path" d="${PATH}"/></svg>
                    ${all.map((it, i) => `<div class="tl-pt" data-i="${i}">${mark(i === all.length - 1)}</div>`).join('')}
                    ${all.map(() => '<i class="tl-stem" aria-hidden="true"></i>').join('')}
                    ${all.map((it, i) => `<div class="tl-lab" data-i="${i}">${text(it)}</div>`).join('')}`;
                layoutCurve();
                pos = target = maxPos();            // open on the newest milestones + the goal
                update(pos);
            } else {
                const keep = expanded || all.length <= 6 ? all.length : 5;
                offset = all.length - keep;
                const view = all.slice(offset), isGoal = (i) => offset + i === all.length - 1;
                host.style.removeProperty('height');
                host.innerHTML = `${offset > 0 ? `<button type="button" class="tl-earlier"><span>Show ${offset} earlier milestone${offset > 1 ? 's' : ''}</span><i class="arr"></i></button>` : ''}
                    <ol class="tl-items" style="--n:${view.length}">${view.map((it, i) => `<li class="tl-item${isGoal(i) ? ' is-goal' : ''}">${mark(isGoal(i))}${text(it)}</li>`).join('')}</ol>`;
                host.querySelector('.tl-earlier')?.addEventListener('click', () => {
                    expanded = true; render(); lightAll();
                    [...host.querySelectorAll('.tl-item')].slice(0, offset).forEach((li, i) => M.enter(li, { delay: i * 45, y: 14, dur: 600 }));
                });
            }
            host.querySelectorAll('.tn').forEach((n) => n.addEventListener('pointerenter', () => M.pop(n, { a: 0.28, t: 0.7 })));
            host.querySelectorAll('.gl').forEach((g) => g.addEventListener('pointerenter', () => M.pop(g.querySelector('.gl-core'), { a: -0.16, t: 0.8 })));
            ensurePager();
        };

        /* ---------- the curve: every milestone lives on it; `pos` decides which ones are in view ---------- */
        function layoutCurve() {
            path = host.querySelector('.tl-path'); len = path.getTotalLength();
            w = host.clientWidth; kx = w / VBW; ky = Math.min(kx, 1.4); H = VBH * ky;   // wider screens stretch the curve sideways more than upwards
            host.querySelector('.tl-svg').style.height = `${H}px`;
            P0 = path.getPointAtLength(0); const a = path.getPointAtLength(2); T0 = norm(a.x - P0.x, a.y - P0.y);
            P1 = path.getPointAtLength(len); const b = path.getPointAtLength(len - 2); T1 = norm(P1.x - b.x, P1.y - b.y);
            labA = Math.max(0, P0.x * kx - 26);
            labW = Math.max(130, Math.min(w >= 2300 ? 340 : w >= 1560 ? 300 : w >= 1200 ? 270 : 240, (w - labA - 12 * (Wc - 1)) / Wc));
            els = { pts: [...host.querySelectorAll('.tl-pt')], stems: [...host.querySelectorAll('.tl-stem')], labs: [...host.querySelectorAll('.tl-lab')] };
            els.labs.forEach((l) => { l.style.width = `${labW}px`; l.style.top = `${H + 8}px`; });
            const maxH = Math.max(...els.labs.map((l) => l.offsetHeight));       // tallest label of ALL milestones, so the card never jumps in height
            host.style.height = `${H + 8 + maxH + 14}px`;
            stemBase = Math.max(40, H);
            els.stems.forEach((s) => { s.style.height = `${stemBase}px`; });
            els.pts.forEach((p) => { p._h = false; }); els.labs.forEach((l) => { l._h = false; });
        }
        const xyAt = (t) => {                      // position on the curve; extends along the end tangents so milestones can slide in and out
            const L = t * len; let x, y;
            if (L < 0) { x = P0.x + T0.x * L; y = P0.y + T0.y * L; }
            else if (L > len) { x = P1.x + T1.x * (L - len); y = P1.y + T1.y * (L - len); }
            else { const p = path.getPointAtLength(L); x = p.x; y = p.y; }
            return { x: x * kx, y: y * ky };
        };
        const fadeOf = (t) => clamp(1 - Math.max(-t, t - 1) / Math.min(0.2, 0.8 / span()), 0, 1);   // the fade distance shrinks with the spacing, so a neighbour outside the window is fully hidden at rest
        function update(p) {
            const sp = span();
            for (let i = 0; i < all.length; i++) {
                const t = (i - p) / sp, o = fadeOf(t), pt = els.pts[i], st = els.stems[i], lb = els.labs[i];
                if (o <= 0.001) { if (!pt._h) { pt.style.visibility = st.style.visibility = lb.style.visibility = 'hidden'; pt._h = true; } continue; }
                if (pt._h) { pt.style.visibility = st.style.visibility = lb.style.visibility = 'visible'; pt._h = false; }
                const { x, y } = xyAt(t), left = labA + (w - labW - labA) * t, sy = Math.max(0, (H + 8 - (y + 22)) / stemBase);
                pt.style.transform = `translate3d(${(x - 31).toFixed(1)}px,${(y - 31).toFixed(1)}px,0)`;
                st.style.transform = `translate3d(${x.toFixed(1)}px,${(y + 22).toFixed(1)}px,0) scaleY(${sy.toFixed(3)})`;
                lb.style.transform = `translate3d(${left.toFixed(1)}px,0,0)`;
                pt.style.opacity = st.style.opacity = lb.style.opacity = o.toFixed(3);
            }
        }

        // the droplet lands on the goal: the crosshair flicks like an aim shot and locks on, then the rings and orbiters shoot out
        const aimShot = (gl, c) => {
            if (M.calm()) { gl.classList.add('revealed'); return; }
            gl.querySelector('.gl-core').animate([
                { transform: 'rotate(0deg) scale(1)', offset: 0 },
                { transform: 'rotate(-58deg) scale(1.3)', offset: 0.2 },       // wind-up, zooms out
                { transform: 'rotate(12deg) scale(0.74)', offset: 0.5 },        // snap + lock-on: the crosshair tightens
                { transform: 'rotate(-4deg) scale(1.08)', offset: 0.72 },
                { transform: 'rotate(0deg) scale(1)', offset: 1 },
            ], { duration: 820, easing: 'cubic-bezier(0.3,0.8,0.4,1)' });
            setTimeout(() => {
                gl.classList.add('revealed');
                M.ripple(host, c, { size: 190, ms: 1000 });
                gl.querySelectorAll('.gl-rings circle').forEach((ring, i) => ring.animate([
                    { opacity: 0, transform: 'scale(0.5)', offset: 0 }, { opacity: 1, transform: 'scale(1.07)', offset: 0.65 }, { opacity: 1, transform: 'scale(1)', offset: 1 },
                ], { duration: 760, delay: i * 110, easing: 'cubic-bezier(0.2,0.9,0.3,1)', fill: 'backwards' }));
                gl.querySelectorAll('.gl-orbit i').forEach((dot, i) => {
                    const R = i === 0 ? 27 : 19;
                    dot.animate([
                        { transform: `translateY(${R}px) scale(0.15)`, opacity: 0, offset: 0 },
                        { transform: `translateY(${-R * 0.1}px) scale(1.55)`, opacity: 1, offset: 0.6 },
                        { transform: 'translateY(0) scale(1)', opacity: 1, offset: 1 },
                    ], { duration: 820, delay: 60 + i * 150, easing: 'cubic-bezier(0.25,0.9,0.35,1)', fill: 'backwards' });
                });
            }, 330);
        };

        const nodes = () => [...host.querySelectorAll('.tl-mark')];
        const texts = () => [...host.querySelectorAll('.tl-text')];
        const lightAll = (keepGoalReveal) => { if (!keepGoalReveal) host.querySelectorAll('.gl').forEach((g) => g.classList.add('revealed')); nodes().forEach((m) => m.classList.add('on')); texts().forEach((t) => t.style.removeProperty('opacity')); host.classList.remove('is-dormant'); };

        /* ---------- the droplets: fall from node to node, each lights up on impact (as before) ---------- */
        const play = async () => {
            const my = ++token;
            clearInterval(ambient);
            if (M.calm()) { lightAll(); return; }
            const curve = mode === 'curve';
            host.classList.add('is-dormant');
            host.querySelectorAll('.gl').forEach((g) => g.classList.remove('revealed'));
            nodes().forEach((m) => m.classList.remove('on'));
            texts().forEach((t) => { t.style.opacity = '0'; });
            await wait(260); if (my !== token) return;
            let vis, ms, pts, Ls = [];
            if (curve) {
                const sp = span();
                vis = all.map((_, i) => i).filter((i) => fadeOf((i - pos) / sp) > 0.5);
                ms = vis.map((i) => els.pts[i].querySelector('.tl-mark'));
                Ls = vis.map((i) => ((i - pos) / sp) * len);
                pts = vis.map((i) => xyAt((i - pos) / sp));
            } else {
                vis = nodes().map((_, i) => i); ms = nodes(); pts = ms.map((m) => centerIn(m, host));
            }
            const ts = vis.map((i) => host.querySelectorAll('.tl-text')[i]);
            const start = { x: pts[0].x, y: pts[0].y - (curve ? 110 : 90) };
            for (let i = 0; i < pts.length; i++) {
                if (my !== token) return;
                const from = i === 0 ? start : pts[i - 1];
                const route = curve && i > 0 ? M.routePath(path, Ls[i - 1], Ls[i], kx, ky) : M.routeLine(from, pts[i]);
                await M.drop(host, route, {
                    onImpact: () => {
                        if (my !== token) return;
                        ms[i].classList.add('on');
                        const goal = ms[i].querySelector('.gl');
                        M.ripple(host, pts[i], { size: goal ? 150 : 76 });
                        if (goal) aimShot(goal, pts[i]);
                        else M.pop(ms[i].querySelector('.tn'), { a: -0.45, t: 0.9 });
                        M.enter(ts[i], { y: 16, dur: 720 });
                    },
                });
            }
            if (my !== token) return;
            lightAll(true);   // the goal reveals itself through the aim shot
            ambient = setInterval(() => {
                if (!M.full || document.hidden || !host.isConnected || dragging || raf) return;
                const r = host.getBoundingClientRect();
                if (r.bottom < 0 || r.top > innerHeight) return;
                const route = curve ? M.routePath(path, 0, len, kx, ky) : M.routeLine(pts[0], pts[pts.length - 1]);
                M.drop(host, route, { small: true, pre: 60, dur: 1900, onImpact: () => { if (host.querySelector('.gl') && (!curve || pos >= maxPos() - 0.05)) M.ripple(host, pts[pts.length - 1], { size: 110, ms: 900 }); } });
            }, 5200);
        };

        /* ---------- slider ---------- */
        const buildPager = () => {
            pager.innerHTML = `<div class="ts" style="--n:${all.length}">
                <div class="ts-track" role="slider" tabindex="0" aria-label="Scrub through milestones" aria-valuemin="1" aria-valuemax="${maxPos() + 1}" aria-valuenow="${maxPos() + 1}">
                    <span class="ts-thumb" aria-hidden="true"></span>${all.map((it, i) => i === all.length - 1 ? `<span class="ts-dot is-goal" title="${esc(it.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.6"/><path d="M12 2.6v4M12 17.4v4M2.6 12h4M17.4 12h4"/><circle class="dot" cx="12" cy="12" r="1.9"/></svg></span>` : `<span class="ts-dot" title="${esc(it.title)}"></span>`).join('')}</div>
                <span class="ts-count"></span></div>`;
            const track = pager.querySelector('.ts-track');
            let grab = 0, rect = null;
            const toPos = (clientX) => {
                const px = clientX - rect.left - grab;
                return clamp((px - slider.c0) / slider.s - (Wc - 1) / 2, 0, maxPos());
            };
            track.addEventListener('pointerdown', (e) => {
                if (!slider) return;
                track.setPointerCapture(e.pointerId);
                rect = track.getBoundingClientRect();
                const px = e.clientX - rect.left, centre = slider.c0 + (pos + (Wc - 1) / 2) * slider.s;
                grab = e.target.closest('.ts-thumb') ? px - centre : 0;      // grab the handle where you touched it
                dragging = true; track.classList.add('is-drag');
                setTarget(toPos(e.clientX), true);
                track.focus({ preventScroll: true });
            });
            track.addEventListener('pointermove', (e) => { if (dragging && rect) setTarget(toPos(e.clientX), true); });
            const release = () => { if (!dragging) return; dragging = false; track.classList.remove('is-drag'); setTarget(Math.round(target)); };
            track.addEventListener('pointerup', release);
            track.addEventListener('pointercancel', release);
            track.addEventListener('keydown', (e) => {
                const r = Math.round(target), map = { ArrowLeft: r - 1, ArrowDown: r - 1, ArrowRight: r + 1, ArrowUp: r + 1, PageDown: r - Wc, PageUp: r + Wc, Home: 0, End: maxPos() };
                if (e.key in map) { e.preventDefault(); setTarget(clamp(map[e.key], 0, maxPos())); }
            });
        };
        const measureSlider = () => {
            if (!pager || pager.hidden) { slider = null; return; }
            const track = pager.querySelector('.ts-track'), thumb = pager.querySelector('.ts-thumb'), dots = [...pager.querySelectorAll('.ts-dot')];
            if (!dots.length) { slider = null; return; }
            const d0 = dots[0], dN = dots[dots.length - 1], pad = 9;
            slider = { track, thumb, dots, count: pager.querySelector('.ts-count'), c0: d0.offsetLeft + d0.offsetWidth / 2, s: (dN.offsetLeft - d0.offsetLeft) / Math.max(1, dots.length - 1), dw: d0.offsetWidth, pad };
            thumb.style.width = `${(Wc - 1) * slider.s + slider.dw + 2 * pad}px`;
        };
        const syncSlider = (p, v, force) => {
            if (!slider) return;
            const x = slider.c0 - slider.dw / 2 - slider.pad + p * slider.s, sx = 1 + Math.min(Math.abs(v) * 0.035, 0.2);
            slider.thumb.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${sx.toFixed(3)},${(1 - (sx - 1) * 0.5).toFixed(3)})`;
            const r = Math.round(clamp(p, 0, maxPos()));
            if (r !== lastRound || force) {
                lastRound = r;
                slider.dots.forEach((d, i) => d.classList.toggle('in', i >= r && i < r + Wc));
                slider.count.textContent = `${r + 1}–${r + Wc} of ${all.length}`;
                slider.track.setAttribute('aria-valuenow', String(r + 1));
                slider.track.setAttribute('aria-valuetext', `Milestones ${r + 1} to ${r + Wc} of ${all.length}`);
            }
        };
        function ensurePager() {
            if (!pager) return;
            if (mode !== 'curve' || maxPos() <= 0) { pager.hidden = true; pager.innerHTML = ''; pagerSig = ''; slider = null; return; }
            pager.hidden = false;
            const sig = `${key}|${all.length}|${Wc}`;
            if (sig !== pagerSig) { pagerSig = sig; buildPager(); }
            requestAnimationFrame(() => { measureSlider(); syncSlider(pos, 0, true); });
        }

        /* ---------- motion: a spring drives `pos`, so the curve follows the handle and settles with a small bounce ---------- */
        const tick = (now) => {
            const dt = Math.min(Math.max((now - last) / 1000, 0), 0.04);
            last = now;
            const K = dragging ? 520 : 210, C = dragging ? 40 : 19.5;
            vel += (K * (target - pos) - C * vel) * dt;
            pos += vel * dt;
            update(pos); syncSlider(pos, vel);
            if (!dragging && Math.abs(target - pos) < 0.002 && Math.abs(vel) < 0.01) { pos = target; vel = 0; update(pos); syncSlider(pos, 0); raf = 0; return; }
            raf = requestAnimationFrame(tick);
        };
        const setTarget = (v, live) => {
            target = clamp(v, 0, maxPos());
            if (M.calm()) { pos = target; vel = 0; update(pos); syncSlider(pos, 0); return; }
            if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
        };

        // touch: drag the chart itself
        let tx = 0, t0 = 0, touching = false;
        host.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && mode === 'curve' && maxPos() > 0) { touching = true; tx = e.clientX; t0 = target; dragging = true; } });
        host.addEventListener('pointermove', (e) => { if (touching) setTarget(t0 - (e.clientX - tx) / ((w - labW - labA) / span()), true); });
        const endTouch = () => { if (!touching) return; touching = false; dragging = false; setTarget(Math.round(target)); };
        host.addEventListener('pointerup', endTouch); host.addEventListener('pointercancel', endTouch);

        const switchTo = (nk) => {
            const swap = () => { key = nk; expanded = false; render(); };
            if (M.calm()) { swap(); lightAll(); return; }
            host.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 140, easing: 'ease-in' }).onfinish = () => {
                swap();
                host.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
                play();
            };
        };

        render();
        if (opts.tabs) M.tabs(opts.tabs, switchTo);
        new IntersectionObserver((es) => { if (!seen && es[0].isIntersecting) { seen = true; play(); } }, { threshold: 0.3 }).observe(host);
        let rt = 0, lastSig = `${curveOK()}|${perPage()}`;
        addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => {
                const sig = `${curveOK()}|${perPage()}`;
                if (sig !== lastSig) { lastSig = sig; render(); if (seen) lightAll(); }
                else if (mode === 'curve') { layoutCurve(); update(pos); requestAnimationFrame(() => { measureSlider(); syncSlider(pos, 0, true); }); }
            }, 120);
        });
        const prevHook = M.onMotionChange;
        M.onMotionChange = () => { prevHook?.(); if (M.calm()) { token++; clearInterval(ambient); lightAll(); } else play(); };

        return {};
    };
})();

/* ============================================================
   About page
   ============================================================ */
(() => {
    const M = window.Motion;
    M.reveal(document.querySelectorAll('.c-head, .c-frame, .c-tags, .c-body, .c-pill, .c-journey, .c-outro'), { stagger: 90, group: 4, y: 28 });
    document.querySelectorAll('.c-tags li').forEach((t) => t.addEventListener('pointerenter', () => M.pop(t, { a: 0.3, t: 0.6 })));
    M.timeline(document.getElementById('cTimeline'), { tabs: document.querySelector('#cJourney .ab-tabs'), pager: document.getElementById('cPager') });
    document.querySelector(`#cDays span[data-d="${new Date().getDay()}"]`)?.classList.add('today');
    document.querySelectorAll('#cDays span').forEach((d) => d.addEventListener('pointerenter', () => M.pop(d.querySelector('.mk'), { a: 0.5, t: 0.7 })));
})();

/* ============================================================
   sidebar nav + moon
   ============================================================ */
/* Sidebar nav + moon motion. Runs after the site's own script, so classes are already switched when we animate. */
(() => {
    const M = window.Motion;
    const nav = document.querySelector('.nav');
    const links = nav ? [...nav.querySelectorAll('.nav-link')] : [];

    /* ---------- nav: glass droplet glides between buttons, squeezes in flight, bounces on landing ---------- */
    if (nav && links.length) {
        const glass = document.createElement('span');
        glass.className = 'nav-glass';
        glass.setAttribute('aria-hidden', 'true');
        nav.prepend(glass);
        let cur = Math.max(0, links.findIndex((l) => l.classList.contains('active')));
        const place = (i, animate) => {
            const l = links[i];
            glass.style.height = `${l.offsetHeight}px`;
            if (animate) M.playGlide(glass, l.offsetTop, { axis: 'y', q: 0.5, vmax: 300 });
            else { glass._glide?.cancel(); glass.style.transform = `translate3d(0,${l.offsetTop}px,0)`; }
        };
        place(cur, false);
        const sync = () => place(cur, false);
        addEventListener('resize', sync); addEventListener('load', sync); document.fonts?.ready.then(sync);

        // the incoming page's blocks bounce in (staggered), like the rest of the site
        const blocksOf = (sec) => {
            if (sec.querySelector('.c-wrap')) return [...sec.querySelectorAll('.c-head,.c-frame,.c-tags,.c-body,.c-pill,.c-journey,.c-outro')];
            const out = [];
            sec.querySelectorAll(':scope > .section-title, :scope > .settings-head, :scope > .panel:not([hidden])').forEach((el) => {
                if (el.classList.contains('panel')) {
                    const cards = el.querySelectorAll('.card'); if (cards.length) { cards.forEach((c) => out.push(c)); return; }
                    const groups = el.querySelectorAll('.settings-group'); if (groups.length) { groups.forEach((g) => out.push(g)); return; }
                }
                out.push(el);
            });
            return out;
        };
        const enterPage = (sec) => blocksOf(sec).forEach((el, i) => M.enter(el, { delay: Math.min(i * 45, 420), y: 22, dur: 720 }));

        links.forEach((l, i) => l.addEventListener('click', () => {
            const hover = l.matches(':hover') && !l.classList.contains('active') ? '' : '';
            if (i === cur) { M.pop(l, { a: -0.08, t: 0.5 }); return; }
            cur = i;
            place(i, true);
            M.pop(l, { a: -0.16, t: 0.85, base: hover });
            const sec = document.querySelector(`.section[data-section="${l.dataset.section}"]`);
            if (sec) enterPage(sec);
        }));
    }

    /* ---------- moon: squash, wind-up, spin with overshoot, settle + a soft ripple ---------- */
    const moon = document.getElementById('themeToggle');
    if (moon) {
        moon.addEventListener('click', () => {
            if (M.calm()) return;
            M.pop(moon, { a: -0.24, t: 0.9 });
            try {
                moon.animate([
                    { transform: 'rotate(0deg) scale(1)', offset: 0 },
                    { transform: 'rotate(-38deg) scale(0.74)', offset: 0.16 },          // anticipation
                    { transform: 'rotate(398deg) scale(1.26)', offset: 0.6 },           // overshoot
                    { transform: 'rotate(350deg) scale(0.95)', offset: 0.8 },           // follow-through
                    { transform: 'rotate(360deg) scale(1)', offset: 1 },
                ], { duration: 900, easing: 'cubic-bezier(0.25,0.8,0.35,1)', pseudoElement: '::before' });
            } catch (_e) { /* very old browsers: the button squash above still plays */ }
            const r = moon.getBoundingClientRect(), size = 120;
            const rip = document.createElement('i');
            rip.className = 'moon-rip';
            rip.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px`;
            document.body.appendChild(rip);
            rip.animate([{ opacity: 0.6, transform: 'scale(0.2)' }, { opacity: 0, transform: 'scale(1)' }], { duration: 760, easing: 'cubic-bezier(0.2,0.7,0.3,1)' }).onfinish = () => rip.remove();
        });
    }
})();

/* ============================================================
   Settings game switcher
   ============================================================ */
/* Settings: game switcher (tabs build themselves from the .game-pane blocks) + bouncy copy feedback. */
(() => {
    const M = window.Motion;
    const sec = document.querySelector('.section[data-section="settings"]');
    if (!sec) return;
    const panes = [...sec.querySelectorAll('.game-pane')];
    const tabs = sec.querySelector('#gameTabs');
    let api = null;

    if (tabs && panes.length > 1) {
        tabs.innerHTML = '<span class="ab-glass" aria-hidden="true"></span>' +
            panes.map((p, i) => `<button type="button" class="ab-tab${i ? '' : ' active'}" data-key="${p.dataset.game}" aria-label="${p.dataset.label}">${p.dataset.short}</button>`).join('');
        tabs.hidden = false;
        const swap = (key) => {
            const cur = panes.find((p) => !p.hidden), next = panes.find((p) => p.dataset.game === key);
            if (!next || cur === next) return;
            const show = () => {
                cur.hidden = true; next.hidden = false;
                if (M.calm()) return;
                M.enter(next, { y: 10, dur: 600 });
                next.querySelectorAll('.settings-group').forEach((g, i) => M.enter(g, { delay: 70 + i * 70, y: 22, dur: 720 }));
                next.querySelectorAll('.game-empty > *').forEach((el, i) => M.enter(el, { delay: 80 + i * 70, y: 16, dur: 700 }));
            };
            if (M.calm()) { show(); return; }
            cur.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 130, easing: 'ease-in' }).onfinish = show;
        };
        api = M.tabs(tabs, swap);
        // the Settings page is hidden at load, so measure the droplet again when the page is shown
        document.querySelector('.nav-link[data-section="settings"]')?.addEventListener('click', () => requestAnimationFrame(() => api.sync()));
    } else if (tabs) {
        tabs.hidden = true;   // one game: no switcher needed
    }

    // copying a value: the value squashes and springs back
    sec.querySelectorAll('.settings-row').forEach((row) => row.addEventListener('click', () => M.pop(row.querySelector('strong'), { a: -0.3, t: 0.7 })));
})();
