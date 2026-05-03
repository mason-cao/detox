/* Effects — reusable visual primitives. SVG-mounted (glowHalo) and
   DOM-mounted (waxSeal, chalkDust, currencyFloat, pageTurn, slamIn). */

const Effects = {
    // Mount a glow halo into a parent SVG <g>. Returns the <circle> node.
    // The halo is a soft yellow filled circle with a blur filter; opacity
    // pulses 0.45 → 0.15 over 1.4s. Reduced motion: static at 0.30.
    glowHalo(parent, opts = {}) {
        const r = opts.r || 22;
        const cx = opts.cx || 0;
        const cy = opts.cy || 0;
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        node.setAttribute('class', 'effect-halo');
        node.setAttribute('r', String(r));
        node.setAttribute('cx', String(cx));
        node.setAttribute('cy', String(cy));
        parent.appendChild(node);
        return node;
    },

    // Stamp a wax seal at the given screen point inside `host`. The host
    // must be position: relative or absolute. `text` is the 1-3 char glyph
    // shown on the disk. Auto-removes after 1 s. Returns the seal node.
    waxSeal(host, opts = {}) {
        if (!host) return null;
        const text = opts.text || '✓';
        const x = opts.x != null ? opts.x : host.clientWidth / 2;
        const y = opts.y != null ? opts.y : host.clientHeight / 2;
        const seal = document.createElement('div');
        seal.className = 'effect-seal';
        seal.style.left = `${x}px`;
        seal.style.top = `${y}px`;
        seal.innerHTML = `<div class="effect-seal__disk">${text}</div>`;
        host.appendChild(seal);
        setTimeout(() => seal.remove(), 1000);
        return seal;
    },

    // Burst N chalk-dust particles outward from (x, y) inside host.
    // Particles auto-remove after their keyframe. n defaults to 12.
    chalkDust(host, opts = {}) {
        if (!host) return;
        if (App.prefersReducedMotion()) return;
        const n = opts.n || 12;
        const x = opts.x != null ? opts.x : host.clientWidth / 2;
        const y = opts.y != null ? opts.y : host.clientHeight / 2;
        for (let i = 0; i < n; i++) {
            const p = document.createElement('span');
            p.className = 'effect-chalk-dust';
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
            const angle = (Math.PI * 2 * i) / n;
            const dist = 18 + Math.random() * 14;
            p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--dy', `${Math.sin(angle) * dist - 8}px`);
            host.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    },

    // Float a coin from `fromEl` to `toEl`. Both must be on-screen. The
    // coin is a fixed-position div animated via CSS custom properties.
    // Auto-removes after 600 ms.
    currencyFloat(fromEl, toEl) {
        if (!fromEl || !toEl) return;
        if (App.prefersReducedMotion()) return;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const startX = a.left + a.width / 2 - 11;
        const startY = a.top + a.height / 2 - 11;
        const endX = b.left + b.width / 2 - 11;
        const endY = b.top + b.height / 2 - 11;

        const coin = document.createElement('div');
        coin.className = 'effect-coin';
        coin.style.setProperty('--cx', `${startX}px`);
        coin.style.setProperty('--cy', `${startY}px`);
        coin.style.setProperty('--tx', `${endX}px`);
        coin.style.setProperty('--ty', `${endY}px`);
        coin.style.transform = `translate(${startX}px, ${startY}px)`;
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 600);
    },

    // Apply a page-turn flip class to `el`, removing it after the keyframe.
    // Caller passes a mutate fn that runs at the half-flip frame (~190 ms)
    // so the content swap lands while the page is edge-on.
    pageTurn(el, mutate) {
        if (!el) return;
        if (App.prefersReducedMotion()) {
            if (typeof mutate === 'function') mutate();
            return;
        }
        el.classList.remove('effect-page-turn');
        // Force reflow so the animation restarts on consecutive calls.
        void el.offsetWidth;
        el.classList.add('effect-page-turn');
        if (typeof mutate === 'function') setTimeout(mutate, 190);
        setTimeout(() => el.classList.remove('effect-page-turn'), 400);
    },

    // Slide an element in (postcard, modal). The element should already be
    // in the DOM at its final position; this adds and removes the keyframe class.
    slamIn(el) {
        if (!el) return;
        if (App.prefersReducedMotion()) return;
        el.classList.remove('effect-postcard-in');
        void el.offsetWidth;
        el.classList.add('effect-postcard-in');
        setTimeout(() => el.classList.remove('effect-postcard-in'), 520);
    },
};

window.Effects = Effects;
