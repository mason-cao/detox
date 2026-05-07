/* Compass HUD — diegetic nav alongside clickable buildings on the Isle.
   Lists Buildings.catalog entries. Highlights current tab. Click teleports.
   On <760px, collapses to a 🧭 toggle button.

   Draggable by its title bar; position persists in localStorage so the
   user's preferred spot survives reloads. Double-click the title to
   reset it back to the top-right anchor. */

const Compass = {
    POS_KEY: 'detox.compass.pos',
    EDGE_PAD: 8, // viewport-edge buffer when clamping

    init() {
        this.mount();
        document.addEventListener('detox:tab-changed', () => this.refresh());
        window.addEventListener('resize', () => this.clampToViewport());
    },

    mount() {
        if (document.getElementById('compass')) return;

        const toggle = document.createElement('button');
        toggle.id = 'compassToggle';
        toggle.className = 'compass-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Open compass');
        toggle.textContent = '🧭';
        toggle.addEventListener('click', () => this.toggleOpen());

        const card = document.createElement('aside');
        card.id = 'compass';
        card.className = 'compass';
        card.setAttribute('aria-label', 'Isle compass');
        card.innerHTML = `
            <span class="compass__title" data-role="compass-handle" title="Drag to move, double-click to reset">🧭 Isle</span>
            <ul class="compass__list" id="compassList"></ul>
        `;

        document.body.appendChild(toggle);
        document.body.appendChild(card);
        this.refresh();
        this.bindDrag(card);
        this.restorePosition(card);
    },

    bindDrag(card) {
        const handle = card.querySelector('[data-role="compass-handle"]');
        if (!handle) return;

        let dragging = false;
        let startClient = { x: 0, y: 0 };
        let startTopLeft = { left: 0, top: 0 };
        let activePointerId = null;

        const onPointerDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            // Switch from right-anchored to left-anchored before measuring,
            // so subsequent moves work in absolute pixels.
            const rect = card.getBoundingClientRect();
            card.style.left = `${rect.left}px`;
            card.style.top = `${rect.top}px`;
            card.style.right = 'auto';

            dragging = true;
            activePointerId = e.pointerId;
            startClient = { x: e.clientX, y: e.clientY };
            startTopLeft = { left: rect.left, top: rect.top };
            card.classList.add('is-dragging');
            try { handle.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startClient.x;
            const dy = e.clientY - startClient.y;
            this.applyPosition(card, startTopLeft.left + dx, startTopLeft.top + dy);
        };

        const onPointerUp = () => {
            if (!dragging) return;
            dragging = false;
            card.classList.remove('is-dragging');
            if (activePointerId !== null) {
                try { handle.releasePointerCapture(activePointerId); } catch (_) {}
                activePointerId = null;
            }
            this.persistPosition(card);
        };

        const onDoubleClick = () => this.resetPosition(card);

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
        handle.addEventListener('lostpointercapture', onPointerUp);
        handle.addEventListener('dblclick', onDoubleClick);
    },

    applyPosition(card, left, top) {
        const rect = card.getBoundingClientRect();
        const maxLeft = Math.max(this.EDGE_PAD, window.innerWidth - rect.width - this.EDGE_PAD);
        const maxTop = Math.max(this.EDGE_PAD, window.innerHeight - rect.height - this.EDGE_PAD);
        const clampedLeft = Math.max(this.EDGE_PAD, Math.min(maxLeft, left));
        const clampedTop = Math.max(this.EDGE_PAD, Math.min(maxTop, top));
        card.style.left = `${clampedLeft}px`;
        card.style.top = `${clampedTop}px`;
        card.style.right = 'auto';
    },

    persistPosition(card) {
        try {
            const left = parseFloat(card.style.left) || 0;
            const top = parseFloat(card.style.top) || 0;
            localStorage.setItem(this.POS_KEY, JSON.stringify({ left, top }));
        } catch (_) { /* localStorage unavailable */ }
    },

    restorePosition(card) {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(this.POS_KEY) || 'null'); } catch (_) {}
        if (!saved || typeof saved.left !== 'number' || typeof saved.top !== 'number') return;
        // Defer one frame so layout has settled and getBoundingClientRect is accurate.
        requestAnimationFrame(() => this.applyPosition(card, saved.left, saved.top));
    },

    clampToViewport() {
        const card = document.getElementById('compass');
        if (!card || !card.style.left) return; // still anchored to right; let CSS handle it
        const left = parseFloat(card.style.left) || 0;
        const top = parseFloat(card.style.top) || 0;
        this.applyPosition(card, left, top);
        this.persistPosition(card);
    },

    resetPosition(card) {
        card.style.left = '';
        card.style.top = '';
        card.style.right = '';
        try { localStorage.removeItem(this.POS_KEY); } catch (_) {}
    },

    refresh() {
        const list = document.getElementById('compassList');
        if (!list || !window.Buildings) return;

        list.innerHTML = Buildings.catalog.map(b => {
            const cur = App.currentTab === b.tab ? 'is-current' : '';
            return `<li><button class="compass__item ${cur}" type="button" data-tab="${b.tab}">${App.escapeHtml(b.label)}</button></li>`;
        }).join('');

        list.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                App.showTab(btn.dataset.tab);
                if (window.matchMedia('(max-width: 760px)').matches) {
                    this.toggleOpen(false);
                }
            });
        });
    },

    toggleOpen(force) {
        const card = document.getElementById('compass');
        if (!card) return;
        const next = typeof force === 'boolean' ? force : !card.classList.contains('is-open');
        card.classList.toggle('is-open', next);
    },
};

window.Compass = Compass;
