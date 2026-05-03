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
                    <div class="postcard-intro__copy">
                        Stamp a postcard for today's island and send it to a friend. No one sees your data but you.
                    </div>
                    <button class="pixel-button pixel-button--primary" onclick="Cards.generate('${date}')" id="generateBtn">
                        STAMP POSTCARD
                    </button>
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
