/* ── Shareable Cards View ─────────────────────────────────────────── */

const Cards = {
    generatedUrl: null,

    async render(container) {
        destroyCharts();
        const date = App.currentDate;

        container.innerHTML = `
            <div class="fade-in">
                <div class="page-header">
                    <h1>Share Card</h1>
                    <div class="date-nav">
                        <button onclick="App.prevDate()">&#8249;</button>
                        <span class="date-label">${App.formatDate(date)}</span>
                        <button onclick="App.nextDate()">&#8250;</button>
                    </div>
                </div>

                <div class="card" style="text-align: center; padding: 40px;">
                    <p style="color: var(--text-muted); margin-bottom: 24px;">
                        Generate a personalized card showing your screen time stats.<br>
                        Share it with friends to encourage healthier habits!
                    </p>
                    <button class="btn btn-primary" onclick="Cards.generate('${date}')" id="generateBtn">
                        Generate Card
                    </button>
                </div>

                <div id="cardPreview" style="margin-top: 32px;"></div>
            </div>
        `;

        if (this.generatedUrl) {
            this.showPreview(this.generatedUrl);
        }
    },

    async generate(date) {
        const btn = document.getElementById('generateBtn');
        btn.textContent = 'Generating...';
        btn.disabled = true;

        try {
            const result = await App.api('/api/cards/generate', {
                method: 'POST',
                body: { date },
            });
            this.generatedUrl = result.url;
            this.showPreview(result.url);
            App.toast('Card generated!', 'success');
        } catch (e) {
            btn.textContent = 'Error - Try Again';
            btn.disabled = false;
            App.toast('Failed to generate card', 'error');
        }
    },

    showPreview(url) {
        const preview = document.getElementById('cardPreview');
        if (!preview) return;
        preview.innerHTML = `
            <div style="text-align: center;">
                <div class="card-preview">
                    <img src="${url}" alt="Screen Time Card">
                </div>
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center;">
                    <a href="${url}" download="detox-card.png" class="btn btn-primary">Download PNG</a>
                    <button class="btn btn-secondary" onclick="Cards.generatedUrl=null; Cards.render(document.getElementById('content'))">Generate New</button>
                </div>
            </div>
        `;
    },
};
