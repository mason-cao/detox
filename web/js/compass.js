/* Compass HUD — diegetic nav alongside clickable buildings on the Isle.
   Lists Buildings.catalog entries. Highlights current tab. Click teleports.
   On <760px, collapses to a 🧭 toggle button. */

const Compass = {
    init() {
        this.mount();
        document.addEventListener('detox:tab-changed', () => this.refresh());
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
            <span class="compass__title">🧭 Isle</span>
            <ul class="compass__list" id="compassList"></ul>
        `;

        document.body.appendChild(toggle);
        document.body.appendChild(card);
        this.refresh();
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
