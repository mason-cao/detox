/* Effects — reusable SVG visual primitives.
   1f wires glowHalo. waxSeal / chalkDust / currencyFloat scaffolded for 1g. */

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

    // 1g placeholders — keep the namespace stable so per-tab signatures
    // can land without re-introducing this module.
    waxSeal()       { /* 1g */ },
    chalkDust()     { /* 1g */ },
    currencyFloat() { /* 1g */ },
};

window.Effects = Effects;
