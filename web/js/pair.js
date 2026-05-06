/* ── Pair page logic ──────────────────────────────────────────────
 * Mints a 6-character pairing code via /v1/devices/pair-init and
 * polls /v1/devices to detect when the agent has claimed it.
 */

(function () {
    const codeEl = document.getElementById('pairCode');
    const expiresEl = document.getElementById('pairExpires');
    const statusEl = document.getElementById('pairStatus');
    const refreshBtn = document.getElementById('pairRefresh');

    let knownDeviceIds = new Set();
    let pollTimer = null;

    function setStatus(message, tone) {
        statusEl.textContent = message || '';
        if (tone) statusEl.dataset.tone = tone;
        else delete statusEl.dataset.tone;
    }

    function setCode(value, state) {
        codeEl.textContent = value;
        codeEl.dataset.state = state || 'ok';
    }

    async function loadDevices() {
        try {
            const resp = await Cloud.fetch('/api/devices');
            if (!resp.ok) return [];
            return await resp.json();
        } catch (_) {
            return [];
        }
    }

    async function mintCode() {
        setCode('Generating code…', 'loading');
        expiresEl.textContent = '';
        setStatus('Waiting for the Mac to claim the code.');

        const baseline = await loadDevices();
        knownDeviceIds = new Set(baseline.map((d) => d.id));

        try {
            const resp = await Cloud.fetch('/api/devices/pair-init', {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!resp.ok) {
                const detail = await resp.text();
                throw new Error(detail || `pair-init failed (${resp.status})`);
            }
            const body = await resp.json();
            setCode(body.code, 'ok');
            if (body.expires_at) {
                const when = new Date(body.expires_at);
                expiresEl.textContent = `Expires at ${when.toLocaleTimeString()}`;
            }
            startPolling();
        } catch (err) {
            setCode('Could not get a code', 'empty');
            setStatus(err.message || 'Pairing init failed.', 'error');
        }
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            const devices = await loadDevices();
            for (const d of devices) {
                if (!knownDeviceIds.has(d.id)) {
                    setStatus(`✓ Paired ${d.device_name || 'this Mac'}.`, 'ok');
                    setCode('Paired', 'empty');
                    clearInterval(pollTimer);
                    pollTimer = null;
                    return;
                }
            }
        }, 5000);
    }

    refreshBtn.addEventListener('click', mintCode);

    Auth.bootstrap().then(async () => {
        if (!Auth.configured()) {
            setCode('Cloud not configured', 'empty');
            setStatus('This build of Detox does not have cloud auth wired up.', 'error');
            return;
        }
        const session = await Auth.session();
        if (!session) {
            location.href = '/sign-in.html';
            return;
        }
        mintCode();
    });
})();
