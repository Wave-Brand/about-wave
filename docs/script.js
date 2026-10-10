const toggleBtn = document.getElementById("themeToggle");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");
const timelineTabs = document.querySelectorAll(".timeline-tab");
const timelineViews = document.querySelectorAll(".timeline-view");
const timelineSwitch = document.querySelector(".timeline-switch");
const identityBadge = document.getElementById("identityBadge");
const timelineFlipCards = document.querySelectorAll(".timeline-card-flip");
const timelineCardStacks = document.querySelectorAll(".timeline-card-stack");
const aboutPanelFlip = document.getElementById("aboutPanelFlip");
const aboutPanelToggles = document.querySelectorAll("[data-about-panel-toggle]");
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

const syncTimelineSwitch = (activeTab = document.querySelector(".timeline-tab.active")) => {
    if (!timelineSwitch || !activeTab) {
        return;
    }

    const tabs = Array.from(timelineTabs);
    const activeIndex = Math.max(tabs.indexOf(activeTab), 0);
    timelineSwitch.style.setProperty("--timeline-toggle-index", String(activeIndex));
};

const syncTimelineCardHeights = () => {
    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    timelineCardStacks.forEach((stack) => {
        if (!isMobile) {
            stack.style.minHeight = "";
            return;
        }

        const faces = stack.querySelectorAll(".timeline-card");
        let maxHeight = 0;

        faces.forEach((face) => {
            maxHeight = Math.max(maxHeight, face.scrollHeight);
        });

        stack.style.minHeight = `${maxHeight}px`;
    });
};

syncThemeToggleLayout();
syncTimelineSwitch();
syncTimelineCardHeights();
window.addEventListener("resize", syncThemeToggleLayout);
window.addEventListener("resize", syncTimelineCardHeights);
window.addEventListener("load", syncThemeToggleLayout);
window.addEventListener("load", syncTimelineCardHeights);

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        const targetSection = link.dataset.section;

        navLinks.forEach((item) => item.classList.remove("active"));
        sections.forEach((section) => section.classList.remove("active"));

        link.classList.add("active");
        document.querySelector(`.section[data-section="${targetSection}"]`)?.classList.add("active");
    });
});

timelineTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        const targetTimeline = tab.dataset.timeline;

        timelineTabs.forEach((item) => item.classList.remove("active"));
        timelineViews.forEach((view) => view.classList.remove("active"));

        tab.classList.add("active");
        syncTimelineSwitch(tab);
        document.querySelector(`.timeline-view[data-timeline-view="${targetTimeline}"]`)?.classList.add("active");
        syncTimelineCardHeights();
    });
});

timelineFlipCards.forEach((card) => {
    card.addEventListener("click", () => {
        const timelineItem = card.closest(".timeline-item");
        timelineItem?.classList.toggle("is-flipped");
        syncTimelineCardHeights();
    });
});

aboutPanelToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
        const isFlipped = aboutPanelFlip?.classList.toggle("is-flipped");
        aboutPanelFlip?.setAttribute("data-panel-state", isFlipped ? "schedule" : "story");
    });

    toggle.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const isFlipped = aboutPanelFlip?.classList.toggle("is-flipped");
            aboutPanelFlip?.setAttribute("data-panel-state", isFlipped ? "schedule" : "story");
        }
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

    // Visitors whose system asks for reduced motion still get a plain, continuous glide
    // (never a teleport), just without the squeeze and bounce.
    // Set to true if you want everyone to see the full effect.
    const ALWAYS_ANIMATE = false;
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
