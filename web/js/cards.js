/* ── Postcards View ───────────────────────────────────────────────── */

const Cards = {
    generatedUrl: null,

    async render(container) {
        destroyCharts();
        const date = App.currentDate;

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-bar">
                    ${App.backToIsleButton()}
                    <h1 class="page-heading">Postcards</h1>
                    <div class="postcard-date-nav">
                        <button class="pixel-button" onclick="App.prevDate()">&#8249;</button>
                        <span>${App.formatDate(date)}</span>
                        <button class="pixel-button" onclick="App.nextDate()">&#8250;</button>
                    </div>
                </div>

                <div class="postcard-intro">
                    <div class="postcard-compose">
                        <div class="postcard-compose__art" aria-hidden="true">
                            <svg viewBox="0 0 190 132" role="presentation">
                                <rect x="5" y="6" width="180" height="120"></rect>
                                <path class="postcard-compose__sea" d="M10 84 C38 75 58 96 86 85 S138 76 180 92"></path>
                                <path class="postcard-compose__sand" d="M30 82 C40 48 88 34 128 48 C162 60 166 88 132 104 C92 122 18 106 30 82 Z"></path>
                                <path class="postcard-compose__grass" d="M58 82 L92 56 L132 76 L98 102 Z"></path>
                                <path class="postcard-compose__path" d="M70 84 L96 70 L120 80"></path>
                                <circle class="postcard-compose__sun" cx="148" cy="30" r="11"></circle>
                                <path class="postcard-compose__stamp" d="M22 24 H52 V50 H22 Z"></path>
                            </svg>
                        </div>
                        <div class="postcard-compose__copy">
                            <span class="postcard-compose__eyebrow">Detox Isle Post</span>
                            <h2>Greetings from the Isle</h2>
                            <p>Stamp today's screen-time report as a warm island postcard.</p>
                            <button class="pixel-button pixel-button--primary" onclick="Cards.generate('${date}')" id="generateBtn">
                                STAMP POSTCARD
                            </button>
                        </div>
                        <div class="postcard-compose__seal" aria-hidden="true">D</div>
                    </div>
                </div>

                <div id="cardPreview"></div>
            </div>
        `;

        if (this.generatedUrl) {
            this.showPreview(this.generatedUrl);
        }
    },

    async generate(date) {
        const btn = document.getElementById('generateBtn');
        btn.textContent = 'STAMPING...';
        btn.disabled = true;

        try {
            const result = await App.api('/api/cards/generate', {
                method: 'POST',
                body: { date },
            });
            this.generatedUrl = result.url;
            this.showPreview(result.url);
            App.toast('Postcard stamped', 'success');
        } catch (e) {
            btn.textContent = 'ERROR - TRY AGAIN';
            btn.disabled = false;
            App.toast('Failed to stamp postcard', 'error');
        }
    },

    showPreview(url) {
        const preview = document.getElementById('cardPreview');
        if (!preview) return;
        const safeUrl = App.escapeAttr(url);
        preview.innerHTML = `
            <div class="postcard-preview">
                <div class="postcard-preview__frame">
                    <img src="${safeUrl}" alt="Island postcard">
                </div>
                <div class="postcard-preview__actions">
                    <a href="${safeUrl}" download="detox-postcard.png" class="pixel-button pixel-button--primary">DOWNLOAD</a>
                    <button class="pixel-button" onclick="Cards.generatedUrl=null; Cards.render(document.getElementById('content'))">STAMP ANOTHER</button>
                </div>
            </div>
        `;
        const card = preview.querySelector('.postcard-preview');
        if (!card) return;
        if (!card.style.position) card.style.position = 'relative';
        Effects.slamIn(card);
        setTimeout(() => {
            Effects.waxSeal(card, { x: card.clientWidth - 56, y: 56, text: 'D' });
        }, 320);
    },
};
