/* Compass HUD — compact destination list alongside the Isle.
   The Isle itself is the primary navigation surface, so this stays tucked
   behind an icon and only mirrors the building catalog when opened.

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
        toggle.setAttribute('aria-label', 'Open town map');
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 4 L15 12 L12 20 L9 12 Z"></path>
                <path d="M4 12 H20 M12 4 V20"></path>
            </svg>
        `;
        toggle.addEventListener('click', () => this.toggleOpen());

        const card = document.createElement('aside');
        card.id = 'compass';
        card.className = 'compass';
        card.setAttribute('aria-label', 'Isle compass');
        card.innerHTML = `
            <span class="compass__title" data-role="compass-handle" title="Drag to move, double-click to reset">Compass</span>
            <div class="compass__list" id="compassList"></div>
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
        const card = document.getElementById('compass');
        const toggle = document.getElementById('compassToggle');
        if (!list || !window.Buildings) return;

        const onIsle = App.currentTab === 'dashboard';
        card?.classList.toggle('compass--subtab-hidden', !onIsle);
        toggle?.classList.toggle('compass-toggle--subtab-hidden', !onIsle);
        if (!onIsle) this.toggleOpen(false);

        list.innerHTML = this.renderList();
        list.querySelectorAll('[data-tab]').forEach(button => {
            const go = () => {
                App.showTab(button.dataset.tab);
                if (window.matchMedia('(max-width: 760px)').matches) {
                    this.toggleOpen(false);
                }
            };
            button.addEventListener('click', go);
        });
    },

    renderList() {
        return Buildings.catalog.map(b => {
            const cur = App.currentTab === b.tab ? 'is-current' : '';
            const abbr = b.label.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
            return `
                <button class="compass__item ${cur}" type="button" data-tab="${App.escapeAttr(b.tab)}">
                    <span class="compass__abbr" aria-hidden="true">${App.escapeHtml(abbr)}</span>
                    <span>${App.escapeHtml(b.label)}</span>
                </button>
            `;
        }).join('');
    },

    toggleOpen(force) {
        const card = document.getElementById('compass');
        if (!card) return;
        const next = typeof force === 'boolean' ? force : !card.classList.contains('is-open');
        card.classList.toggle('is-open', next);
    },
};

window.Compass = Compass;
